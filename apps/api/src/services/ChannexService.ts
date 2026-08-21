/**
 * ChannexService — HTTP client for the Channex channel manager.
 *
 * Modelled on EmailService: native fetch, no SDK, a discriminated result type,
 * and it NEVER throws to callers. A channel-manager outage must not surface in
 * a booking response.
 *
 * Deliberately free of business logic and database access. It does not decide
 * what to sync, when, or for whom — it only speaks HTTP. Callers supply the
 * API key (see channexClient below); ChannexProvisioningService and the ARI
 * worker own the decisions.
 *
 * Two Channex behaviours drive the shape of this file:
 *
 *   1. The ARI endpoints return 200 with a task id. That means ACCEPTED
 *      ASYNCHRONOUSLY, not applied. Validation failures also come back as
 *      200 OK with meta.warnings[] populated. So `success: true` alone is
 *      never proof of anything — callers must inspect `warnings`.
 *
 *   2. Rate limits are PER PROPERTY (10 availability + 10 restrictions per
 *      minute). A 429 is surfaced as `rateLimited: true` so the worker can
 *      pause that one property for 60s without starving other hotels.
 */

import { env } from "../lib/env";
import type { ChannexRate } from "../utils/channexMoney";

// ── Result type ──────────────────────────────────────────────────────────────

export interface ChannexResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  /** HTTP status, when a response was received at all. */
  status?: number;
  /** True on HTTP 429. The caller should back off this property for ~60s. */
  rateLimited?: boolean;
  /**
   * meta.warnings[] from an ARI response. Non-empty means Channex accepted the
   * request but rejected some of its contents — treat as a partial failure.
   */
  warnings?: string[];
}

// ── Request/response payload types ───────────────────────────────────────────

/** Channex returns every entity as { data: { id, type, attributes } }. */
interface ChannexEntity {
  id: string;
  type?: string;
  attributes?: Record<string, unknown>;
}

export interface ChannexPropertyInput {
  title: string;
  currency: string; // ISO 4217
  email?: string;
  phone?: string;
  zip_code?: string;
  country?: string; // ISO 3166-1 alpha-2
  state?: string;
  city?: string;
  address?: string;
  latitude?: string;
  longitude?: string;
  timezone?: string; // IANA
  property_type?: string;
  content?: {
    description?: string;
    photos?: Array<{ url: string; position?: number; description?: string }>;
  };
}

export interface ChannexRoomTypeInput {
  property_id: string;
  title: string;
  count_of_rooms: number;
  occ_adults: number;
  occ_children: number;
  occ_infants: number;
  /** MUST be <= occ_adults or Channex responds 422. */
  default_occupancy: number;
  room_kind?: string;
  content?: {
    description?: string;
    photos?: Array<{ url: string; position?: number; description?: string }>;
  };
}

export interface ChannexRatePlanOption {
  occupancy: number;
  is_primary: boolean;
  /** Branded — must come from paisasToChannexRate(). */
  rate: ChannexRate;
}

export interface ChannexRatePlanInput {
  property_id: string;
  room_type_id: string;
  /** Must be unique per property. */
  title: string;
  currency: string;
  sell_mode?: "per_room" | "per_person";
  rate_mode?: string;
  /** 7-element Mon..Sun defaults. */
  max_stay?: number[];
  min_stay_arrival?: number[];
  min_stay_through?: number[];
  closed_to_arrival?: boolean[];
  closed_to_departure?: boolean[];
  stop_sell?: boolean[];
  options?: ChannexRatePlanOption[];
}

export interface ChannexAvailabilityValue {
  property_id: string;
  room_type_id: string;
  date_from: string; // YYYY-MM-DD
  date_to: string;   // YYYY-MM-DD
  availability: number;
  /** Restrict a range to specific weekdays, e.g. ["mo","sa"]. */
  days?: string[];
}

export interface ChannexRestrictionValue {
  property_id: string;
  rate_plan_id: string;
  date_from: string; // YYYY-MM-DD
  date_to: string;   // YYYY-MM-DD
  /** Branded — must come from paisasToChannexRate(). */
  rate?: ChannexRate;
  min_stay_arrival?: number;
  min_stay_through?: number;
  closed_to_arrival?: boolean;
  closed_to_departure?: boolean;
  stop_sell?: boolean;
  max_stay?: number;
  days?: string[];
}

export type ChannexRestrictionField = "rate" | "availability" | "min_stay_arrival"
  | "min_stay_through" | "closed_to_arrival" | "closed_to_departure" | "stop_sell" | "max_stay";

export interface ChannexBookingRevision {
  id: string;
  attributes?: Record<string, unknown>;
  [key: string]: unknown;
}

// ── Client ───────────────────────────────────────────────────────────────────

export interface ChannexClientOptions {
  /**
   * Per-hotel key from channel_configs.credentials.api_key. Falls back to the
   * account-level CHANNEX_API_KEY, which is the normal case — one account key
   * provisions many properties.
   */
  apiKey?: string | null;
  /** Log context only; never sent upstream. */
  hotelId?: string;
}

/** A request timing out must not hold a queue worker open indefinitely. */
const REQUEST_TIMEOUT_MS = 20_000;

interface RequestOptions {
  method: "GET" | "POST" | "PUT";
  path: string;
  body?: unknown;
  query?: Record<string, string>;
  /** ARI endpoints answer 200-with-warnings; extract meta.warnings for them. */
  expectWarnings?: boolean;
}

/**
 * Pulls a human-usable message out of Channex's several error shapes:
 *   { errors: { code, title, details } }
 *   { errors: { code: "http_too_many_requests" } }
 *   { error: "..." } / { message: "..." }
 */
function extractError(body: unknown, status: number): string {
  if (body && typeof body === "object") {
    const record = body as Record<string, unknown>;

    const errors = record.errors;
    if (typeof errors === "string") return errors;
    if (errors && typeof errors === "object") {
      const e = errors as Record<string, unknown>;
      const parts = [e.title, e.code, e.details]
        .filter((v): v is string => typeof v === "string" && v.length > 0);
      if (parts.length > 0) return parts.join(" — ");
      return JSON.stringify(errors);
    }

    for (const key of ["error", "message"]) {
      const value = record[key];
      if (typeof value === "string" && value.length > 0) return value;
    }
  }
  return `Channex API returned ${status}`;
}

/** meta.warnings is where a 200 hides its failures. */
function extractWarnings(body: unknown): string[] {
  if (!body || typeof body !== "object") return [];
  const meta = (body as Record<string, unknown>).meta;
  if (!meta || typeof meta !== "object") return [];
  const warnings = (meta as Record<string, unknown>).warnings;
  if (!Array.isArray(warnings)) return [];
  return warnings.map((w) => (typeof w === "string" ? w : JSON.stringify(w)));
}

export interface ChannexClient {
  createProperty(input: ChannexPropertyInput): Promise<ChannexResult<ChannexEntity>>;
  updateProperty(propertyId: string, input: Partial<ChannexPropertyInput>): Promise<ChannexResult<ChannexEntity>>;
  getProperty(propertyId: string): Promise<ChannexResult<ChannexEntity>>;

  createRoomType(input: ChannexRoomTypeInput): Promise<ChannexResult<ChannexEntity>>;
  updateRoomType(roomTypeId: string, input: Partial<ChannexRoomTypeInput>): Promise<ChannexResult<ChannexEntity>>;

  createRatePlan(input: ChannexRatePlanInput): Promise<ChannexResult<ChannexEntity>>;
  updateRatePlan(ratePlanId: string, input: Partial<ChannexRatePlanInput>): Promise<ChannexResult<ChannexEntity>>;

  pushAvailability(values: ChannexAvailabilityValue[]): Promise<ChannexResult<ChannexEntity[]>>;
  pushRestrictions(values: ChannexRestrictionValue[]): Promise<ChannexResult<ChannexEntity[]>>;
  getRestrictions(
    propertyId: string,
    dateFrom: string,
    dateTo: string,
    fields?: ChannexRestrictionField[],
  ): Promise<ChannexResult<unknown>>;

  listBookingRevisions(propertyId?: string): Promise<ChannexResult<ChannexBookingRevision[]>>;
  getBooking(revisionId: string): Promise<ChannexResult<ChannexBookingRevision>>;
  acknowledgeBooking(revisionId: string): Promise<ChannexResult<unknown>>;
}

/**
 * Builds a client bound to one API key. Business services construct one per
 * hotel so a property-scoped key can override the account key without any
 * call site knowing which applied.
 */
export function channexClient(options: ChannexClientOptions = {}): ChannexClient {
  const apiKey = options.apiKey?.trim() || env.CHANNEX_API_KEY;
  const context = options.hotelId ? ` [hotel ${options.hotelId}]` : "";

  async function request<T>(opts: RequestOptions): Promise<ChannexResult<T>> {
    if (!apiKey) {
      const error = "Channex API key is not configured (set CHANNEX_API_KEY or a per-hotel key)";
      console.error(`❌ Channex ${opts.method} ${opts.path}${context}: ${error}`);
      return { success: false, error };
    }

    const url = new URL(`${env.CHANNEX_BASE_URL.replace(/\/+$/, "")}${opts.path}`);
    for (const [key, value] of Object.entries(opts.query ?? {})) {
      url.searchParams.set(key, value);
    }

    let res: Response;
    try {
      res = await fetch(url, {
        method: opts.method,
        headers: {
          // Verified against staging: `user-api-key`, not Bearer, not x-api-key.
          "user-api-key": apiKey,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        ...(opts.body === undefined ? {} : { body: JSON.stringify(opts.body) }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (err) {
      const error = err instanceof Error
        ? (err.name === "TimeoutError" ? `Channex request timed out after ${REQUEST_TIMEOUT_MS}ms` : err.message)
        : "Unknown error calling Channex";
      console.error(`❌ Channex ${opts.method} ${opts.path}${context}: ${error}`);
      return { success: false, error };
    }

    const body = await res.json().catch(() => null) as unknown;

    if (res.status === 429) {
      const error = extractError(body, res.status);
      console.warn(`⏳ Channex rate limited ${opts.method} ${opts.path}${context}: ${error}`);
      return { success: false, error, status: res.status, rateLimited: true };
    }

    if (!res.ok) {
      const error = extractError(body, res.status);
      console.error(`❌ Channex ${opts.method} ${opts.path}${context}: ${error}`);
      return { success: false, error, status: res.status };
    }

    const warnings = opts.expectWarnings ? extractWarnings(body) : [];
    if (warnings.length > 0) {
      // A 200 is not success. Surface these — the caller writes them to
      // channel_configs.last_sync_error.
      console.warn(
        `⚠️  Channex ${opts.method} ${opts.path}${context} accepted with ${warnings.length} warning(s): ${warnings.join("; ")}`,
      );
    }

    const data = (body && typeof body === "object" ? (body as Record<string, unknown>).data : undefined) as T | undefined;
    return {
      success: true,
      data,
      status: res.status,
      ...(warnings.length > 0 && { warnings }),
    };
  }

  return {
    // ── Structure ────────────────────────────────────────────────────────────
    createProperty: (input) =>
      request<ChannexEntity>({ method: "POST", path: "/properties", body: { property: input } }),

    updateProperty: (propertyId, input) =>
      request<ChannexEntity>({ method: "PUT", path: `/properties/${propertyId}`, body: { property: input } }),

    getProperty: (propertyId) =>
      request<ChannexEntity>({ method: "GET", path: `/properties/${propertyId}` }),

    createRoomType: (input) =>
      request<ChannexEntity>({ method: "POST", path: "/room_types", body: { room_type: input } }),

    updateRoomType: (roomTypeId, input) =>
      request<ChannexEntity>({ method: "PUT", path: `/room_types/${roomTypeId}`, body: { room_type: input } }),

    createRatePlan: (input) =>
      request<ChannexEntity>({ method: "POST", path: "/rate_plans", body: { rate_plan: input } }),

    updateRatePlan: (ratePlanId, input) =>
      request<ChannexEntity>({ method: "PUT", path: `/rate_plans/${ratePlanId}`, body: { rate_plan: input } }),

    // ── ARI ──────────────────────────────────────────────────────────────────
    // `values` is an array on purpose: batch every room type into one call.
    // Later entries override earlier ones (last-win FIFO), so a broad range
    // plus narrow overrides in a single call is valid and cheap.
    pushAvailability: (values) =>
      request<ChannexEntity[]>({
        method: "POST", path: "/availability", body: { values }, expectWarnings: true,
      }),

    pushRestrictions: (values) =>
      request<ChannexEntity[]>({
        method: "POST", path: "/restrictions", body: { values }, expectWarnings: true,
      }),

    getRestrictions: (propertyId, dateFrom, dateTo, fields = ["rate", "availability"]) =>
      request<unknown>({
        method: "GET",
        path: "/restrictions",
        query: {
          "filter[property_id]": propertyId,
          "filter[date][gte]": dateFrom,
          "filter[date][lte]": dateTo,
          "filter[restrictions]": fields.join(","),
        },
      }),

    // ── Bookings ─────────────────────────────────────────────────────────────
    listBookingRevisions: (propertyId) =>
      request<ChannexBookingRevision[]>({
        method: "GET",
        path: "/booking_revisions/feed",
        ...(propertyId ? { query: { "filter[property_id]": propertyId } } : {}),
      }),

    getBooking: (revisionId) =>
      request<ChannexBookingRevision>({ method: "GET", path: `/booking_revisions/${revisionId}` }),

    acknowledgeBooking: (revisionId) =>
      request<unknown>({ method: "POST", path: `/booking_revisions/${revisionId}/ack` }),
  };
}
