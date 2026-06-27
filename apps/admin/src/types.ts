export interface Hotel {
  id: string;
  name: string;
  slug: string;
  subdomain: string | null;
  city: string | null;
  isActive: boolean;
  onboardingCompleted: boolean;
  createdAt: string;
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
