import { calculateHotelMetricSnapshot } from "../services/HotelMetricsService";

export function calculateBriefingMetrics(input: {
  date: string;
  physicalRooms: number;
  outOfServiceRooms: number;
  roomRates: number[];
}) {
  return calculateHotelMetricSnapshot({
    ...input,
    arrivals: 0,
    departures: 0,
    stayovers: 0,
  });
}
