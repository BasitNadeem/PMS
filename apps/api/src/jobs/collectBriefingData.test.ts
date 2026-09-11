import assert from "node:assert/strict";
import test from "node:test";
import { calculateBriefingMetrics } from "./briefingMetrics";
import { calculateHotelMetricSnapshot } from "../services/HotelMetricsService";

test("nightly briefing uses the canonical occupancy, ADR and RevPAR calculation", () => {
  const edgeCases = [
    { date: "2026-08-28", physicalRooms: 0, outOfServiceRooms: 0, roomRates: [] },
    { date: "2026-08-28", physicalRooms: 11, outOfServiceRooms: 0, roomRates: [10_000_00, 15_000_00, 20_000_00, 25_000_00, 30_000_00] },
    { date: "2026-08-28", physicalRooms: 8, outOfServiceRooms: 2, roomRates: Array.from({ length: 8 }, () => 20_000_00) },
    { date: "2026-08-28", physicalRooms: 8, outOfServiceRooms: 8, roomRates: [20_000_00] },
    { date: "2026-08-28", physicalRooms: 8, outOfServiceRooms: 20, roomRates: [20_000_00] },
  ];

  // Fixed-seed fuzzing protects the briefing adapter from drifting away from
  // Reports again while remaining deterministic in CI.
  let seed = 0x1f10_2026;
  const random = () => {
    seed = (Math.imul(seed, 1_664_525) + 1_013_904_223) >>> 0;
    return seed / 0x1_0000_0000;
  };
  const fuzzCases = Array.from({ length: 5_000 }, () => {
    const physicalRooms = Math.floor(random() * 151);
    const outOfServiceRooms = Math.floor(random() * (physicalRooms + 21));
    const soldRooms = Math.floor(random() * (physicalRooms + 21));
    return {
      date: "2026-08-28",
      physicalRooms,
      outOfServiceRooms,
      roomRates: Array.from({ length: soldRooms }, () => Math.floor(random() * 100_000_00)),
    };
  });

  for (const input of [...edgeCases, ...fuzzCases]) {
    const briefing = calculateBriefingMetrics(input);
    const canonical = calculateHotelMetricSnapshot({ ...input, arrivals: 0, departures: 0, stayovers: 0 });
    assert.deepEqual(briefing, canonical);
  }
});
