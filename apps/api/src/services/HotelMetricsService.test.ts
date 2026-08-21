import assert from "node:assert/strict";
import test from "node:test";
import { calculateHotelMetricSnapshot, classifyBusinessContribution } from "./HotelMetricsService";

test("occupancy, ADR and RevPAR use sellable inventory", () => {
  const result = calculateHotelMetricSnapshot({
    date: "2026-08-14",
    physicalRooms: 10,
    outOfServiceRooms: 2,
    roomRates: [20_000_00, 30_000_00, 40_000_00, 10_000_00],
    arrivals: 2,
    departures: 1,
    stayovers: 2,
  });
  assert.equal(result.sellableRooms, 8);
  assert.equal(result.roomsSold, 4);
  assert.equal(result.availableRooms, 4);
  assert.equal(result.occupancyRate, 50);
  assert.equal(result.adr, 25_000_00);
  assert.equal(result.revpar, 12_500_00);
  assert.equal(result.expectedRoomRevenue, 100_000_00);
});

test("zero sellable rooms never produces invalid metrics", () => {
  const result = calculateHotelMetricSnapshot({ date: "2026-08-14", physicalRooms: 2, outOfServiceRooms: 2, roomRates: [], arrivals: 0, departures: 0, stayovers: 0 });
  assert.equal(result.occupancyRate, 0);
  assert.equal(result.adr, 0);
  assert.equal(result.revpar, 0);
  assert.equal(result.availableRooms, 0);
});

test("contribution precedence keeps group and company business distinct", () => {
  assert.equal(classifyBusinessContribution({ groupId: "group", companyId: "company", source: "TRAVEL_AGENT" }), "GROUP");
  assert.equal(classifyBusinessContribution({ groupId: null, companyId: "company", source: "TRAVEL_AGENT" }), "COMPANY");
  assert.equal(classifyBusinessContribution({ groupId: null, companyId: null, source: "BOOKING_ENGINE" }), "DIRECT");
  assert.equal(classifyBusinessContribution({ groupId: null, companyId: null, source: "BOOKING_COM" }), "OTA");
  assert.equal(classifyBusinessContribution({ groupId: null, companyId: null, source: "WALK_IN" }), "OTHER");
});
