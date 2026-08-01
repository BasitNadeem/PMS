import type { TenantTx } from "@pms/db";
import type { UpdateSettingsDto } from "../schemas/settings";
import { AppError } from "../utils/AppError";

type WithTenantFn = <T>(fn: (db: TenantTx) => Promise<T>) => Promise<T>;

const SETTINGS_JSON_KEYS = [
  "starRating", "timezone",
  "checkInTime", "checkOutTime",
  "shiftMorningStart", "shiftEveningStart", "shiftNightStart",
  "requireIndependentShiftSignoff",
  "shiftHandoverRemindersEnabled", "nightAuditRemindersEnabled",
  "shiftReminderLeadMinutes",
  "lateCheckoutFee", "earlyCheckinFee",
  "defaultSource", "autoConfirm", "maxAdvanceDays",
  "gstEnabled", "gstRate", "pstEnabled", "pstRate",
  "taxInclusive", "fbrEnabled", "invoicePrefix",
  "ownerWhatsappNumber", "themeKey", "posTaxRate", "logoUrl",
  "birthdayOffersEnabled", "anniversaryOffersEnabled",
  "occasionOfferDiscountPercent", "occasionOfferLeadDays", "occasionOfferValidityDays",
] as const;

const HOTEL_MODEL_KEYS = [
  "name", "propertyType", "description", "amenities",
  "phone", "email", "website",
  "address", "city", "country", "onboardingStep",
  "cancellationPolicy", "bookingPaymentTerms",
] as const;

export const SettingsService = {
  async getSettings(withTenant: WithTenantFn, hotelId: string) {
    return withTenant((db) =>
      db.hotel.findUniqueOrThrow({
        where: { id: hotelId },
        select: {
          id: true, name: true, slug: true, propertyType: true,
          description: true, amenities: true,
          phone: true, email: true, website: true,
          address: true, city: true, country: true,
          cancellationPolicy: true, bookingPaymentTerms: true,
          settings: true,
          isActive: true,
        },
      })
    );
  },

  async updateSettings(withTenant: WithTenantFn, hotelId: string, dto: UpdateSettingsDto, actorRole: string) {
    if (!["OWNER", "MANAGER"].includes(actorRole)) {
      throw new AppError(403, "Only owners and managers can update settings");
    }

    return withTenant(async (db) => {
      // Split dto into model fields and settings JSON fields
      const modelData: Record<string, unknown> = {};
      for (const key of HOTEL_MODEL_KEYS) {
        if (dto[key] !== undefined) modelData[key] = dto[key];
      }

      // Fetch existing settings to merge
      const existing = await db.hotel.findUniqueOrThrow({
        where: { id: hotelId },
        select: { settings: true },
      });

      const existingSettings = (existing.settings as Record<string, unknown>) ?? {};
      const settingsUpdate: Record<string, unknown> = { ...existingSettings };

      for (const key of SETTINGS_JSON_KEYS) {
        if (dto[key] !== undefined) settingsUpdate[key] = dto[key];
      }

      const hotel = await db.hotel.update({
        where: { id: hotelId },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: { ...modelData, settings: settingsUpdate as any },
        select: {
          id: true, name: true, slug: true, propertyType: true,
          description: true, amenities: true,
          phone: true, email: true, website: true,
          address: true, city: true, country: true,
          cancellationPolicy: true, bookingPaymentTerms: true,
          settings: true,
          isActive: true,
        },
      });

      return hotel;
    });
  },
};
