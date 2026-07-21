import { api } from "@/lib/api";

export interface BookingEngineRecentBooking {
  id:                 string;
  confirmationNumber: string;
  status:             string;
  guestName:          string;
  checkInDate:        string;
  checkOutDate:       string;
  isMultiRoom:        boolean;
  createdAt:          string;
}

export interface BookingEngineInsights {
  totalCount:            number;
  byStatus:               Record<string, number>;
  multiRoomCount:         number;
  singleRoomCount:        number;
  totalEstimatedRevenue:  number;
  recent:                 BookingEngineRecentBooking[];
}

export const bookingEngineHubService = {
  getInsights: async (params?: { startDate?: string; endDate?: string }): Promise<BookingEngineInsights> => {
    const res = await api.get("/api/booking-engine/insights", { params });
    return res.data.data;
  },
};
