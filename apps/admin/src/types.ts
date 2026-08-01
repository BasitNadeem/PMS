export interface SubscriptionPlan {
  id: string;
  name: string;
  slug: string;
  priceMonthly: number;
  limits: Record<string, number | null>;
  features: Record<string, boolean>;
  isActive: boolean;
  displayOrder: number;
  _count: { hotels: number };
}

export interface PlanMetadata {
  features: Array<{ key: string; label: string; built: boolean }>;
  limits: Array<{ key: string; label: string; minimum: number; fallback: number }>;
}

export interface Hotel {
  id: string;
  name: string;
  slug: string;
  subdomain: string | null;
  city: string | null;
  isActive: boolean;
  onboardingCompleted: boolean;
  createdAt: string;
  subscriptionPlanId: string | null;
  subscriptionPlan: {
    id: string;
    name: string;
    slug: string;
    priceMonthly: number;
    limits: Record<string, number | null>;
    features: Record<string, boolean>;
  } | null;
  limitOverrides: Record<string, number | null> | null;
  featureOverrides: Record<string, boolean> | null;
  _count: {
    rooms: number;
    reservations: number;
    users: number;
  };
}

export interface CreateHotelDto {
  hotelName: string;
  subdomain: string;
  ownerName: string;
  ownerEmail: string;
  city?: string;
  propertyType: "HOTEL" | "GUESTHOUSE" | "HOSTEL" | "RESORT" | "LODGE" | "CAMPSITE" | "SERVICED_APARTMENT";
  subscriptionPlanId?: string;
}

export interface CreateHotelResult {
  hotel: { id: string; name: string; subdomain: string | null; slug: string };
  owner: { name: string; email: string; tempPassword: string };
}

export interface ResetOwnerPasswordResult {
  owner: { name: string; email: string; tempPassword: string };
}

export interface ApiError {
  error: string;
  details?: unknown;
}
