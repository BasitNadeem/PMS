/**
 * ChannexProvisioningService — maps Innflo structure onto Channex structure.
 *
 * Designed so onboarding hotel #50 is a button click, not a code change:
 *   - Idempotent. Re-running never duplicates; an entity that already has a
 *     Channex id is updated, not recreated.
 *   - Incremental. Each id is saved the moment its create succeeds, in its own
 *     write. If room type 3 of 5 fails, 1 and 2 keep their ids and a re-run
 *     resumes at 3.
 *   - Opt-in for rate plans. See the eligibility rules below — this is a
 *     commercial safety boundary, not a filter.
 *
 * Database access is via adminPrisma with an explicit hotelId predicate on
 * every query, matching lib/reservationEmails.ts and jobs/briefingWorker.ts:
 * provisioning is invoked from both an HTTP route (tenant context) and
 * background jobs (no tenant context), so it cannot depend on req.withTenant.
 */

import { adminPrisma } from "@pms/db";
import { env } from "../lib/env";
import {
  channexClient,
  type ChannexPropertyInput,
  type ChannexRoomTypeInput,
  type ChannexRatePlanInput,
} from "./ChannexService";
import { paisasToChannexRate } from "../utils/channexMoney";
import { queueChannexSync } from "../lib/channexSync";
import { OVERBOOKING_PREFIX } from "../jobs/channexBookingWorker";
import {
  evaluateOtaEligibility,
  validateHotelForChannex,
  CHANNEX_FIELD_LOCATIONS,
  settingsRecord,
  readZipCode,
  readCurrency,
  readTimezone,
  type RatePlanExclusionReason,
} from "../lib/channexEligibility";

// Re-exported so callers have one import for the whole Channex provisioning
// surface; the rules themselves live in lib/channexEligibility.ts, which is
// pure and tested independently of the database.
export {
  evaluateOtaEligibility,
  validateHotelForChannex,
  OTA_ELIGIBLE_RATE_PLAN_TYPES,
} from "../lib/channexEligibility";
export type {
  OtaEligibility,
  RatePlanEligibilityInput,
  RatePlanExclusionReason,
  HotelValidationResult,
} from "../lib/channexEligibility";

const CHANNEL_TYPE = "CHANNEL_MANAGER" as const;

// ── Credentials ──────────────────────────────────────────────────────────────

export interface ChannexCredentials {
  channex_property_id?: string;
  /** Optional property-scoped key overriding the account-level env key. */
  api_key?: string;
}

function readCredentials(raw: unknown): ChannexCredentials {
  if (!raw || typeof raw !== "object") return {};
  const record = raw as Record<string, unknown>;
  return {
    ...(typeof record.channex_property_id === "string" && { channex_property_id: record.channex_property_id }),
    ...(typeof record.api_key === "string" && { api_key: record.api_key }),
  };
}

// ── Mapping helpers ──────────────────────────────────────────────────────────

/**
 * Channex fetches and copies images server-side, so a relative path silently
 * yields no photo. Everything must be absolute against API_PUBLIC_URL.
 */
function toAbsoluteUrl(url: string): string | null {
  const trimmed = url?.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const base = env.API_PUBLIC_URL.replace(/\/+$/, "");
  return `${base}${trimmed.startsWith("/") ? "" : "/"}${trimmed}`;
}

function toPhotos(urls: string[]): Array<{ url: string; position: number }> {
  return urls
    .map((url) => toAbsoluteUrl(url))
    .filter((url): url is string => url !== null)
    .map((url, index) => ({ url, position: index }));
}

const PROPERTY_TYPE_MAP: Record<string, string> = {
  HOTEL: "hotel",
  GUESTHOUSE: "guest_house",
  RESORT: "resort",
  LODGE: "lodge",
  HOSTEL: "hostel",
  SERVICED_APARTMENT: "apartment",
  CAMPSITE: "campsite",
};

// ── Result types ─────────────────────────────────────────────────────────────

export interface EntityOutcome {
  /**
   * The local row this outcome is about. For rate plans that is a
   * rate_plan_item id (one per rate plan x room type pair), except on a
   * whole-plan SKIP where it is the rate plan id.
   */
  id: string;
  /** Set on rate plan outcomes so the UI can group pairs under their plan. */
  ratePlanId?: string;
  name: string;
  status: "CREATED" | "UPDATED" | "SKIPPED" | "FAILED";
  channexId?: string;
  reason?: RatePlanExclusionReason;
  error?: string;
}

export interface ProvisionResult {
  success: boolean;
  error?: string;
  /** Populated when the hotel is missing Channex-required fields. */
  missingFields?: string[];
  propertyId?: string;
  propertyStatus?: "CREATED" | "UPDATED" | "UNCHANGED";
  roomTypes: EntityOutcome[];
  ratePlans: EntityOutcome[];
}

function emptyResult(): Pick<ProvisionResult, "roomTypes" | "ratePlans"> {
  return { roomTypes: [], ratePlans: [] };
}

// ── Inbound failure surfacing ────────────────────────────────────────────────

export interface IngestionAlert {
  id: string;
  /**
   * OVERBOOKING is called out separately from GENERIC on purpose: it means a
   * guest holds a confirmed booking for a room the property does not have, and
   * somebody has to move a guest or open inventory. Everything else is a
   * technical failure that retrying or fixing config will clear.
   */
  kind: "OVERBOOKING" | "GENERIC";
  sourceKey: string;
  eventType: string;
  origin: string;
  message: string;
  attempts: number;
  receivedAt: Date;
}

export interface IngestionAlerts {
  overbookings: IngestionAlert[];
  failures: IngestionAlert[];
  overbookingCount: number;
  failureCount: number;
}

/** Unresolved inbound failures, newest first. */
async function readIngestionAlerts(hotelId: string): Promise<IngestionAlerts> {
  const rows = await adminPrisma.channelWebhookEvent.findMany({
    where:   { hotelId, status: "FAILED" },
    orderBy: { receivedAt: "desc" },
    take:    50,
    select: {
      id: true, sourceKey: true, eventType: true, origin: true,
      error: true, attempts: true, receivedAt: true,
    },
  });

  const alerts: IngestionAlert[] = rows.map((row) => {
    const raw = row.error ?? "Ingestion failed";
    const isOverbooking = raw.startsWith(OVERBOOKING_PREFIX);
    return {
      id: row.id,
      kind: isOverbooking ? "OVERBOOKING" : "GENERIC",
      sourceKey: row.sourceKey,
      eventType: row.eventType,
      origin: row.origin,
      message: isOverbooking ? raw.slice(OVERBOOKING_PREFIX.length) : raw,
      attempts: row.attempts,
      receivedAt: row.receivedAt,
    };
  });

  const overbookings = alerts.filter((a) => a.kind === "OVERBOOKING");
  const failures = alerts.filter((a) => a.kind === "GENERIC");
  return {
    overbookings,
    failures,
    overbookingCount: overbookings.length,
    failureCount: failures.length,
  };
}

/** Clears an alert once staff have dealt with it. */
export async function acknowledgeIngestionAlert(hotelId: string, eventId: string): Promise<boolean> {
  const result = await adminPrisma.channelWebhookEvent.updateMany({
    where: { id: eventId, hotelId, status: "FAILED" },
    data:  { status: "ACKNOWLEDGED", processedAt: new Date() },
  });
  return result.count > 0;
}

// ── Service ──────────────────────────────────────────────────────────────────

async function loadConfig(hotelId: string) {
  return adminPrisma.channelConfig.findUnique({
    where: { hotelId_channelType: { hotelId, channelType: CHANNEL_TYPE } },
  });
}

async function clientFor(hotelId: string) {
  const config = await loadConfig(hotelId);
  const credentials = readCredentials(config?.credentials);
  return {
    config,
    credentials,
    client: channexClient({ apiKey: credentials.api_key, hotelId }),
  };
}

/** Merges into credentials rather than replacing — never drops an api_key. */
async function saveCredentials(hotelId: string, patch: ChannexCredentials): Promise<void> {
  const config = await loadConfig(hotelId);
  const merged = { ...readCredentials(config?.credentials), ...patch };
  await adminPrisma.channelConfig.upsert({
    where:  { hotelId_channelType: { hotelId, channelType: CHANNEL_TYPE } },
    create: { hotelId, channelType: CHANNEL_TYPE, credentials: merged, isActive: false },
    update: { credentials: merged },
  });
}

export const ChannexProvisioningService = {
  /**
   * Create-or-update the whole structure for a hotel, then leave ARI to the
   * caller (the sync queue lands in step 4).
   *
   * Rate plans are OPT-IN: only ids passed in `ratePlanIds`, plus any plan that
   * already carries a channex_rate_plan_id, are considered — and each still has
   * to clear evaluateOtaEligibility. Explicit selection alone is not enough.
   */
  async provisionHotel(
    hotelId: string,
    options: { ratePlanIds?: string[] } = {},
  ): Promise<ProvisionResult> {
    const hotel = await adminPrisma.hotel.findUnique({
      where: { id: hotelId },
      select: {
        id: true, name: true, email: true, phone: true, address: true, city: true,
        country: true, region: true, province: true, zipCode: true,
        latitude: true, longitude: true,
        propertyType: true, description: true, settings: true,
      },
    });
    if (!hotel) return { success: false, error: "Hotel not found", ...emptyResult() };

    const validation = validateHotelForChannex(hotel);
    if (!validation.valid) {
      return {
        success: false,
        error: "Channex requires these details before a property can connect to any OTA",
        missingFields: validation.missing,
        ...emptyResult(),
      };
    }

    const { credentials, client } = await clientFor(hotelId);
    const settings = settingsRecord(hotel.settings);
    const logo = typeof settings.logoUrl === "string" ? toAbsoluteUrl(settings.logoUrl) : null;

    const propertyInput: ChannexPropertyInput = {
      title:     hotel.name,
      currency:  readCurrency(hotel.settings),
      email:     hotel.email ?? undefined,
      phone:     hotel.phone ?? undefined,
      zip_code:  readZipCode(hotel) ?? undefined,
      country:   (hotel.country ?? "PK").toUpperCase(),
      state:     (hotel.region ?? hotel.province) ?? undefined,
      city:      hotel.city ?? undefined,
      address:   hotel.address ?? undefined,
      latitude:  hotel.latitude  === null ? undefined : String(hotel.latitude),
      longitude: hotel.longitude === null ? undefined : String(hotel.longitude),
      timezone:  readTimezone(hotel.settings),
      property_type: PROPERTY_TYPE_MAP[hotel.propertyType] ?? "hotel",
      content: {
        ...(hotel.description ? { description: hotel.description } : {}),
        ...(logo ? { photos: [{ url: logo, position: 0 }] } : {}),
      },
    };

    // Create once, update forever after — never duplicate a property.
    let propertyId = credentials.channex_property_id;
    let propertyStatus: ProvisionResult["propertyStatus"];

    if (propertyId) {
      const updated = await client.updateProperty(propertyId, propertyInput);
      if (!updated.success) {
        return { success: false, error: `Property update failed: ${updated.error}`, propertyId, ...emptyResult() };
      }
      propertyStatus = "UPDATED";
    } else {
      const created = await client.createProperty(propertyInput);
      if (!created.success || !created.data?.id) {
        return { success: false, error: `Property creation failed: ${created.error ?? "no id returned"}`, ...emptyResult() };
      }
      propertyId = created.data.id;
      // Persist immediately: a failure after this point must not orphan the
      // property and cause a duplicate on the next run.
      await saveCredentials(hotelId, { channex_property_id: propertyId });
      propertyStatus = "CREATED";
    }

    const roomTypes = await this.syncRoomTypes(hotelId, propertyId);
    const ratePlans = await this.syncRatePlans(hotelId, propertyId, options.ratePlanIds ?? []);

    // Structure exists — publish ARI for it. A newly created Channex room type
    // sits at zero availability until an availability push happens, so this is
    // required for the property to sell at all, not just an optimisation.
    queueChannexSync({ hotelId, reason: "PROVISION", immediate: true });

    const failed = [...roomTypes, ...ratePlans].filter((o) => o.status === "FAILED");
    return {
      success: failed.length === 0,
      ...(failed.length > 0 && { error: `${failed.length} entit${failed.length === 1 ? "y" : "ies"} failed — re-run to resume` }),
      propertyId,
      propertyStatus,
      roomTypes,
      ratePlans,
    };
  },

  /** Every active room type is provisioned; room types carry no pricing secrecy. */
  async syncRoomTypes(hotelId: string, propertyId: string): Promise<EntityOutcome[]> {
    const roomTypes = await adminPrisma.roomType.findMany({
      where:  { hotelId, isActive: true },
      select: {
        id: true, name: true, description: true, maxOccupancy: true,
        photoUrls: true, channexRoomTypeId: true,
        _count: { select: { rooms: { where: { isActive: true } } } },
      },
      orderBy: { sortOrder: "asc" },
    });

    const { client } = await clientFor(hotelId);
    const outcomes: EntityOutcome[] = [];

    for (const roomType of roomTypes) {
      const occAdults = Math.max(1, roomType.maxOccupancy);
      const input: ChannexRoomTypeInput = {
        property_id:    propertyId,
        title:          roomType.name,
        count_of_rooms: roomType._count.rooms,
        occ_adults:     occAdults,
        occ_children:   0,
        occ_infants:    0,
        // Channex 422s unless default_occupancy <= occ_adults.
        default_occupancy: Math.min(occAdults, 2),
        room_kind:      "room",
        content: {
          ...(roomType.description ? { description: roomType.description } : {}),
          ...(roomType.photoUrls.length > 0 ? { photos: toPhotos(roomType.photoUrls) } : {}),
        },
      };

      if (roomType.channexRoomTypeId) {
        const res = await client.updateRoomType(roomType.channexRoomTypeId, input);
        outcomes.push(res.success
          ? { id: roomType.id, name: roomType.name, status: "UPDATED", channexId: roomType.channexRoomTypeId }
          : { id: roomType.id, name: roomType.name, status: "FAILED", error: res.error });
        continue;
      }

      const res = await client.createRoomType(input);
      if (!res.success || !res.data?.id) {
        outcomes.push({ id: roomType.id, name: roomType.name, status: "FAILED", error: res.error ?? "no id returned" });
        continue;
      }
      // Saved per entity, immediately — this is what makes a re-run resume.
      await adminPrisma.roomType.update({
        where: { id: roomType.id },
        data:  { channexRoomTypeId: res.data.id },
      });
      outcomes.push({ id: roomType.id, name: roomType.name, status: "CREATED", channexId: res.data.id });
    }

    return outcomes;
  },

  /**
   * Opt-in, and one Channex rate plan per (rate plan x room type) pair — that
   * pair is a rate_plan_item, and its channex_rate_plan_id is where each id
   * lands. A plan covering three room types produces three Channex rate plans
   * and three outcomes.
   *
   * `selectedIds` is the owner's explicit choice of RATE PLANS; any pair that
   * is already provisioned is always refreshed so an edit propagates.
   * Everything else is reported as SKIPPED with a reason, never dropped.
   */
  async syncRatePlans(hotelId: string, propertyId: string, selectedIds: string[]): Promise<EntityOutcome[]> {
    const plans = await adminPrisma.ratePlan.findMany({
      where:  { hotelId },
      select: {
        id: true, name: true, type: true, isActive: true, codeRequired: true,
        companyId: true,
        items: { select: { id: true, roomTypeId: true, rate: true, channexRatePlanId: true } },
      },
      orderBy: { priority: "desc" },
    });

    // Fetched once rather than per item — this loop is already N API calls,
    // it does not need to be N database round trips as well.
    const roomTypes = await adminPrisma.roomType.findMany({
      where:  { hotelId },
      select: { id: true, name: true, maxOccupancy: true, channexRoomTypeId: true },
    });
    const roomTypeById = new Map(roomTypes.map((rt) => [rt.id, rt]));

    const selected = new Set(selectedIds);
    const { client } = await clientFor(hotelId);
    const hotel = await adminPrisma.hotel.findUnique({
      where: { id: hotelId }, select: { settings: true },
    });
    const currency = readCurrency(hotel?.settings);
    const outcomes: EntityOutcome[] = [];

    for (const plan of plans) {
      const alreadyProvisioned = plan.items.some((i) => i.channexRatePlanId !== null);
      const optedIn = selected.has(plan.id) || alreadyProvisioned;
      if (!optedIn) continue; // not chosen for OTA distribution — not an error

      const eligibility = evaluateOtaEligibility({
        isActive:     plan.isActive,
        codeRequired: plan.codeRequired,
        companyId:    plan.companyId,
        type:         plan.type,
        roomTypeIds:  plan.items.map((i) => i.roomTypeId),
      });

      // Fails closed even when explicitly selected: a corporate rate must not
      // reach an OTA because someone ticked the wrong box.
      if (!eligibility.eligible) {
        outcomes.push({
          id: plan.id, ratePlanId: plan.id, name: plan.name, status: "SKIPPED",
          reason: eligibility.reason ?? undefined,
          ...(eligibility.label ? { error: eligibility.label } : {}),
        });
        continue;
      }

      for (const item of plan.items) {
        const roomType = roomTypeById.get(item.roomTypeId);
        // Channex enforces title uniqueness per property, so a plan spanning
        // several room types cannot reuse its own name for each one. Plain
        // hyphen, not an em-dash: OTA extranets render it inconsistently.
        const pairName = `${plan.name} - ${roomType?.name ?? "Unknown room type"}`;

        if (!roomType?.channexRoomTypeId) {
          outcomes.push({
            id: item.id, ratePlanId: plan.id, name: pairName, status: "FAILED",
            error: "Its room type is not provisioned on Channex yet",
          });
          continue;
        }

        const input: ChannexRatePlanInput = {
          property_id:  propertyId,
          room_type_id: roomType.channexRoomTypeId,
          title:        pairName,
          currency,
          sell_mode:    "per_room", // rate_plan_items price per room, not per person
          options: [{
            occupancy:  Math.max(1, roomType.maxOccupancy),
            is_primary: true,
            rate:       paisasToChannexRate(item.rate),
          }],
        };

        if (item.channexRatePlanId) {
          const res = await client.updateRatePlan(item.channexRatePlanId, input);
          outcomes.push(res.success
            ? { id: item.id, ratePlanId: plan.id, name: pairName, status: "UPDATED", channexId: item.channexRatePlanId }
            : { id: item.id, ratePlanId: plan.id, name: pairName, status: "FAILED", error: res.error });
          continue;
        }

        const res = await client.createRatePlan(input);
        if (!res.success || !res.data?.id) {
          outcomes.push({
            id: item.id, ratePlanId: plan.id, name: pairName, status: "FAILED",
            error: res.error ?? "no id returned",
          });
          continue;
        }
        // Persisted per pair, immediately — this is what lets a re-run resume
        // partway through a multi-room-type plan.
        await adminPrisma.ratePlanItem.update({
          where: { id: item.id },
          data:  { channexRatePlanId: res.data.id },
        });
        outcomes.push({
          id: item.id, ratePlanId: plan.id, name: pairName,
          status: "CREATED", channexId: res.data.id,
        });
      }
    }

    return outcomes;
  },

  /**
   * Incremental single-entity provisioning, for a room type added after initial
   * onboarding. Must not require a full re-provision.
   */
  async provisionRoomType(roomTypeId: string): Promise<EntityOutcome> {
    const roomType = await adminPrisma.roomType.findUnique({
      where: { id: roomTypeId },
      select: { id: true, name: true, hotelId: true },
    });
    if (!roomType) return { id: roomTypeId, name: "", status: "FAILED", error: "Room type not found" };

    const { credentials } = await clientFor(roomType.hotelId);
    if (!credentials.channex_property_id) {
      return { id: roomType.id, name: roomType.name, status: "SKIPPED", error: "Hotel is not provisioned on Channex" };
    }

    const [outcome] = await this.syncRoomTypes(roomType.hotelId, credentials.channex_property_id);
    return outcome ?? { id: roomType.id, name: roomType.name, status: "SKIPPED" };
  },

  /**
   * Incremental single-plan provisioning — this is also the opt-in action.
   *
   * Returns an array, not a single outcome: one rate plan spanning N room
   * types becomes N Channex rate plans, each with its own success or failure.
   */
  async provisionRatePlan(ratePlanId: string): Promise<EntityOutcome[]> {
    const plan = await adminPrisma.ratePlan.findUnique({
      where: { id: ratePlanId },
      select: { id: true, name: true, hotelId: true },
    });
    if (!plan) return [{ id: ratePlanId, name: "", status: "FAILED", error: "Rate plan not found" }];

    const { credentials } = await clientFor(plan.hotelId);
    if (!credentials.channex_property_id) {
      return [{
        id: plan.id, ratePlanId: plan.id, name: plan.name,
        status: "SKIPPED", error: "Hotel is not provisioned on Channex",
      }];
    }

    const outcomes = await this.syncRatePlans(plan.hotelId, credentials.channex_property_id, [plan.id]);
    const mine = outcomes.filter((o) => o.ratePlanId === plan.id);
    return mine.length > 0
      ? mine
      : [{ id: plan.id, ratePlanId: plan.id, name: plan.name, status: "SKIPPED" }];
  },

  /**
   * Read-only snapshot for the Settings panel. Deliberately reports every
   * excluded plan with its reason so an owner sees "3 of 7 synced, 4 excluded"
   * instead of quietly missing rates.
   */
  async getStatus(hotelId: string) {
    const [hotel, config, roomTypes, ratePlans] = await Promise.all([
      adminPrisma.hotel.findUnique({
        where: { id: hotelId },
        select: {
          email: true, phone: true, address: true, city: true, country: true,
          region: true, province: true, zipCode: true,
          latitude: true, longitude: true, settings: true,
        },
      }),
      loadConfig(hotelId),
      adminPrisma.roomType.findMany({
        where:  { hotelId, isActive: true },
        select: { id: true, name: true, channexRoomTypeId: true },
        orderBy: { sortOrder: "asc" },
      }),
      adminPrisma.ratePlan.findMany({
        where:  { hotelId },
        select: {
          id: true, name: true, type: true, isActive: true, codeRequired: true,
          companyId: true,
          items: {
            select: { id: true, roomTypeId: true, channexRatePlanId: true },
          },
        },
        orderBy: { priority: "desc" },
      }),
    ]);

    const credentials = readCredentials(config?.credentials);
    const roomTypeNameById = new Map(roomTypes.map((rt) => [rt.id, rt.name]));

    const plans = ratePlans.map((plan) => {
      const eligibility = evaluateOtaEligibility({
        isActive:     plan.isActive,
        codeRequired: plan.codeRequired,
        companyId:    plan.companyId,
        type:         plan.type,
        roomTypeIds:  plan.items.map((i) => i.roomTypeId),
      });
      const syncedPairs = plan.items.filter((i) => i.channexRatePlanId !== null).length;
      return {
        id: plan.id,
        name: plan.name,
        type: plan.type,
        /** A plan is only fully synced once every one of its pairs is. */
        synced: plan.items.length > 0 && syncedPairs === plan.items.length,
        partiallySynced: syncedPairs > 0 && syncedPairs < plan.items.length,
        eligible: eligibility.eligible,
        exclusionReason: eligibility.reason,
        exclusionLabel: eligibility.label,
        /** One row per room type — the grain Channex actually stores. */
        pairs: plan.items.map((item) => ({
          id: item.id,
          roomTypeId: item.roomTypeId,
          roomTypeName: roomTypeNameById.get(item.roomTypeId) ?? null,
          synced: item.channexRatePlanId !== null,
        })),
      };
    });

    return {
      provisioned: Boolean(credentials.channex_property_id),
      propertyId:  credentials.channex_property_id ?? null,
      isActive:      config?.isActive ?? false,
      syncInventory: config?.syncInventory ?? true,
      syncRates:     config?.syncRates ?? true,
      lastSyncAt:     config?.lastSyncAt ?? null,
      lastSyncStatus: config?.lastSyncStatus ?? null,
      lastSyncError:  config?.lastSyncError ?? null,
      validation: hotel ? validateHotelForChannex(hotel) : { valid: false, missing: ["Hotel not found"] },
      /** Where each missing field is filled in, so the panel can point at it. */
      fieldLocations: CHANNEX_FIELD_LOCATIONS,
      ingestionAlerts: await readIngestionAlerts(hotelId),
      roomTypes: roomTypes.map((rt) => ({
        id: rt.id, name: rt.name, synced: rt.channexRoomTypeId !== null,
      })),
      ratePlans: plans,
      summary: {
        roomTypesSynced: roomTypes.filter((rt) => rt.channexRoomTypeId !== null).length,
        roomTypesTotal:  roomTypes.length,
        ratePlansSynced: plans.filter((p) => p.synced).length,
        ratePlansEligible: plans.filter((p) => p.eligible).length,
        ratePlansExcluded: plans.filter((p) => !p.eligible).length,
        // Pair counts, since one plan can be several Channex rate plans.
        ratePlanPairsSynced: plans.reduce((n, p) => n + p.pairs.filter((x) => x.synced).length, 0),
        ratePlanPairsTotal:  plans.filter((p) => p.eligible).reduce((n, p) => n + p.pairs.length, 0),
      },
    };
  },
};
