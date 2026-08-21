import type { TenantTx } from "@pms/db";

type WithTenantFn = <T>(fn: (db: TenantTx) => Promise<T>) => Promise<T>;

const ACTIVE_STAY_STATUSES = ["CONFIRMED", "CHECKED_IN", "CHECKED_OUT"] as const;

function dateAtUtcMidnight(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

function addDays(date: string, days: number): string {
  const value = dateAtUtcMidnight(date);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function eachDate(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  for (let date = startDate; date <= endDate; date = addDays(date, 1)) dates.push(date);
  return dates;
}

function asDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function roundRate(numerator: number, denominator: number): number {
  return denominator > 0 ? Math.round(numerator / denominator) : 0;
}

function roundPercentage(numerator: number, denominator: number): number {
  return denominator > 0 ? Math.round((numerator / denominator) * 1_000) / 10 : 0;
}

export function classifyBusinessContribution(input: {
  groupId: string | null;
  companyId: string | null;
  source: string;
}): string {
  if (input.groupId) return "GROUP";
  if (input.companyId) return "COMPANY";
  if (input.source === "BOOKING_ENGINE" || input.source === "DIRECT_WEBSITE") return "DIRECT";
  if (["BOOKING_COM", "AGODA", "EXPEDIA", "AIRBNB", "BOOKME_PK", "SASTATICKET_PK", "OTA_OTHER"].includes(input.source)) return "OTA";
  return "OTHER";
}

export function calculateHotelMetricSnapshot(input: {
  date: string;
  physicalRooms: number;
  outOfServiceRooms: number;
  roomRates: number[];
  arrivals: number;
  departures: number;
  stayovers: number;
}): HotelMetricDay {
  const sellableRooms = Math.max(0, input.physicalRooms - input.outOfServiceRooms);
  const roomsSold = input.roomRates.length;
  const expectedRoomRevenue = input.roomRates.reduce((sum, rate) => sum + rate, 0);
  return {
    date: input.date,
    physicalRooms: input.physicalRooms,
    outOfServiceRooms: input.outOfServiceRooms,
    sellableRooms,
    roomsSold,
    availableRooms: Math.max(0, sellableRooms - roomsSold),
    occupancyRate: roundPercentage(roomsSold, sellableRooms),
    adr: roundRate(expectedRoomRevenue, roomsSold),
    revpar: roundRate(expectedRoomRevenue, sellableRooms),
    expectedRoomRevenue,
    arrivals: input.arrivals,
    departures: input.departures,
    stayovers: input.stayovers,
  };
}

export interface HotelMetricDay {
  date: string;
  physicalRooms: number;
  outOfServiceRooms: number;
  sellableRooms: number;
  roomsSold: number;
  availableRooms: number;
  occupancyRate: number;
  adr: number;
  revpar: number;
  expectedRoomRevenue: number;
  arrivals: number;
  departures: number;
  stayovers: number;
}

export interface HotelMetricRoomTypeDay {
  date: string;
  roomTypeId: string;
  roomTypeName: string;
  physicalRooms: number;
  outOfServiceRooms: number;
  sellableRooms: number;
  roomsSold: number;
  availableRooms: number;
  occupancyRate: number;
  expectedRoomRevenue: number;
  adr: number;
  revpar: number;
}

export interface HotelMetricsReport {
  startDate: string;
  endDate: string;
  days: HotelMetricDay[];
  roomTypes: Array<{
    id: string;
    name: string;
    days: HotelMetricRoomTypeDay[];
  }>;
  contribution: {
    categories: Array<{ category: string; reservations: number; roomNights: number; expectedRoomRevenue: number; percentage: number }>;
    companies: Array<{ companyId: string; companyName: string; reservations: number; roomNights: number; expectedRoomRevenue: number; percentage: number }>;
  };
  operational: {
    enquiryDemand: Array<{ date: string; rooms: number }>;
    groups: Array<{
      groupId: string;
      groupName: string;
      groupRef: string | null;
      arrivalDate: string;
      departureDate: string;
      rooms: number;
    }>;
    maintenanceReturns: Array<{
      blockId: string;
      date: string;
      roomNumber: string;
      roomTypeName: string;
      reason: string;
    }>;
  };
  summary: {
    physicalRoomNights: number;
    outOfServiceRoomNights: number;
    sellableRoomNights: number;
    roomsSold: number;
    availableRoomNights: number;
    expectedRoomRevenue: number;
    occupancyRate: number;
    adr: number;
    revpar: number;
  };
}

export const HotelMetricsService = {
  async getRangeFromDb(db: TenantTx, startDate: string, endDate: string): Promise<HotelMetricsReport> {
    const dates = eachDate(startDate, endDate);
    const rangeStart = dateAtUtcMidnight(startDate);
    const rangeEndExclusive = dateAtUtcMidnight(addDays(endDate, 1));

    return (async () => {
      const [rooms, roomTypes, reservationRooms, enquiryRooms, inventoryBlocks] = await Promise.all([
        db.room.findMany({ where: { isActive: true }, select: { id: true, roomTypeId: true } }),
        db.roomType.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
        db.reservationRoom.findMany({
          where: {
            checkInDate: { lt: rangeEndExclusive },
            checkOutDate: { gt: rangeStart },
            reservation: { status: { in: [...ACTIVE_STAY_STATUSES] } },
          },
          select: {
            reservationId: true,
            roomId: true,
            roomTypeId: true,
            ratePerNight: true,
            checkInDate: true,
            checkOutDate: true,
            reservation: {
              select: {
                groupId: true,
                companyId: true,
                source: true,
                company: { select: { id: true, name: true } },
                group: { select: { id: true, name: true, groupRef: true } },
              },
            },
          },
        }),
        db.reservationRoom.findMany({
          where: {
            checkInDate: { lt: rangeEndExclusive },
            checkOutDate: { gt: rangeStart },
            reservation: { status: "ENQUIRY" },
          },
          select: { checkInDate: true, checkOutDate: true },
        }),
        db.roomInventoryBlock.findMany({
          where: { cancelledAt: null, startDate: { lt: rangeEndExclusive }, endDate: { gte: rangeStart } },
          select: {
            id: true,
            roomId: true,
            startDate: true,
            endDate: true,
            reason: true,
            room: { select: { roomTypeId: true, number: true, roomType: { select: { name: true } } } },
          },
        }),
      ]);

      const roomTypesWithInventory = roomTypes.filter((roomType) => rooms.some((room) => room.roomTypeId === roomType.id));
      const roomIdsByType = new Map<string, Set<string>>();
      for (const room of rooms) {
        const ids = roomIdsByType.get(room.roomTypeId) ?? new Set<string>();
        ids.add(room.id);
        roomIdsByType.set(room.roomTypeId, ids);
      }

      const categoryMap = new Map<string, { reservations: Set<string>; roomNights: number; expectedRoomRevenue: number }>();
      const companyMap = new Map<string, { companyName: string; reservations: Set<string>; roomNights: number; expectedRoomRevenue: number }>();

      const buildDay = (date: string, roomTypeId?: string): HotelMetricDay | HotelMetricRoomTypeDay => {
        const nextDate = addDays(date, 1);
        const candidateRoomIds = roomTypeId ? (roomIdsByType.get(roomTypeId) ?? new Set<string>()) : new Set(rooms.map((room) => room.id));
        const dayBlocks = inventoryBlocks.filter((block) =>
          candidateRoomIds.has(block.roomId) && asDate(block.startDate) < nextDate && asDate(block.endDate) > date,
        );
        const blockedRoomIds = new Set(dayBlocks.map((block) => block.roomId));
        const stays = reservationRooms.filter((stay) =>
          (!roomTypeId || stay.roomTypeId === roomTypeId) && asDate(stay.checkInDate) < nextDate && asDate(stay.checkOutDate) > date,
        );
        const physicalRooms = candidateRoomIds.size;
        const outOfServiceRooms = blockedRoomIds.size;
        const sellableRooms = Math.max(0, physicalRooms - outOfServiceRooms);
        const common = calculateHotelMetricSnapshot({
          date,
          physicalRooms,
          outOfServiceRooms,
          roomRates: stays.map((stay) => stay.ratePerNight),
          arrivals: stays.filter((stay) => asDate(stay.checkInDate) === date).length,
          departures: reservationRooms.filter((stay) => (!roomTypeId || stay.roomTypeId === roomTypeId) && asDate(stay.checkOutDate) === date).length,
          stayovers: stays.filter((stay) => asDate(stay.checkInDate) < date).length,
        });
        if (!roomTypeId) return common;
        const roomType = roomTypesWithInventory.find((candidate) => candidate.id === roomTypeId)!;
        return { ...common, roomTypeId, roomTypeName: roomType.name };
      };

      const days = dates.map((date) => buildDay(date) as HotelMetricDay);
      const roomTypeRows = roomTypesWithInventory.map((roomType) => ({
        id: roomType.id,
        name: roomType.name,
        days: dates.map((date) => buildDay(date, roomType.id) as HotelMetricRoomTypeDay),
      }));

      for (const date of dates) {
        const nextDate = addDays(date, 1);
        for (const stay of reservationRooms.filter((row) => asDate(row.checkInDate) < nextDate && asDate(row.checkOutDate) > date)) {
          const category = classifyBusinessContribution({ groupId: stay.reservation.groupId, companyId: stay.reservation.companyId, source: stay.reservation.source });
          const categoryEntry = categoryMap.get(category) ?? { reservations: new Set<string>(), roomNights: 0, expectedRoomRevenue: 0 };
          categoryEntry.reservations.add(stay.reservationId);
          categoryEntry.roomNights += 1;
          categoryEntry.expectedRoomRevenue += stay.ratePerNight;
          categoryMap.set(category, categoryEntry);

          if (stay.reservation.company) {
            const companyEntry = companyMap.get(stay.reservation.company.id) ?? { companyName: stay.reservation.company.name, reservations: new Set<string>(), roomNights: 0, expectedRoomRevenue: 0 };
            companyEntry.reservations.add(stay.reservationId);
            companyEntry.roomNights += 1;
            companyEntry.expectedRoomRevenue += stay.ratePerNight;
            companyMap.set(stay.reservation.company.id, companyEntry);
          }
        }
      }

      const physicalRoomNights = days.reduce((sum, day) => sum + day.physicalRooms, 0);
      const outOfServiceRoomNights = days.reduce((sum, day) => sum + day.outOfServiceRooms, 0);
      const sellableRoomNights = days.reduce((sum, day) => sum + day.sellableRooms, 0);
      const roomsSold = days.reduce((sum, day) => sum + day.roomsSold, 0);
      const expectedRoomRevenue = days.reduce((sum, day) => sum + day.expectedRoomRevenue, 0);
      const groupMap = new Map<string, {
        groupName: string;
        groupRef: string | null;
        arrivalDate: string;
        departureDate: string;
        rooms: Set<string>;
      }>();
      for (const stay of reservationRooms) {
        const group = stay.reservation.group;
        if (!group) continue;
        const arrivalDate = asDate(stay.checkInDate);
        const departureDate = asDate(stay.checkOutDate);
        const entry = groupMap.get(group.id) ?? {
          groupName: group.name,
          groupRef: group.groupRef,
          arrivalDate,
          departureDate,
          rooms: new Set<string>(),
        };
        if (arrivalDate < entry.arrivalDate) entry.arrivalDate = arrivalDate;
        if (departureDate > entry.departureDate) entry.departureDate = departureDate;
        entry.rooms.add(stay.roomId);
        groupMap.set(group.id, entry);
      }
      const toContribution = (entry: { reservations: Set<string>; roomNights: number; expectedRoomRevenue: number }) => ({
        reservations: entry.reservations.size,
        roomNights: entry.roomNights,
        expectedRoomRevenue: entry.expectedRoomRevenue,
        percentage: roundPercentage(entry.expectedRoomRevenue, expectedRoomRevenue),
      });

      return {
        startDate,
        endDate,
        days,
        roomTypes: roomTypeRows,
        contribution: {
          categories: [...categoryMap.entries()].map(([category, entry]) => ({ category, ...toContribution(entry) })).sort((a, b) => b.expectedRoomRevenue - a.expectedRoomRevenue),
          companies: [...companyMap.entries()].map(([companyId, entry]) => ({ companyId, companyName: entry.companyName, ...toContribution(entry) })).sort((a, b) => b.expectedRoomRevenue - a.expectedRoomRevenue),
        },
        operational: {
          enquiryDemand: dates.map((date) => ({
            date,
            rooms: enquiryRooms.filter((stay) => asDate(stay.checkInDate) <= date && asDate(stay.checkOutDate) > date).length,
          })),
          groups: [...groupMap.entries()].map(([groupId, entry]) => ({
            groupId,
            groupName: entry.groupName,
            groupRef: entry.groupRef,
            arrivalDate: entry.arrivalDate,
            departureDate: entry.departureDate,
            rooms: entry.rooms.size,
          })).sort((a, b) => a.arrivalDate.localeCompare(b.arrivalDate)),
          maintenanceReturns: inventoryBlocks
            .filter((block) => {
              const returnDate = asDate(block.endDate);
              return returnDate >= startDate && returnDate <= endDate;
            })
            .map((block) => ({
              blockId: block.id,
              date: asDate(block.endDate),
              roomNumber: block.room.number,
              roomTypeName: block.room.roomType.name,
              reason: block.reason,
            }))
            .sort((a, b) => a.date.localeCompare(b.date) || a.roomNumber.localeCompare(b.roomNumber)),
        },
        summary: {
          physicalRoomNights,
          outOfServiceRoomNights,
          sellableRoomNights,
          roomsSold,
          availableRoomNights: Math.max(0, sellableRoomNights - roomsSold),
          expectedRoomRevenue,
          occupancyRate: roundPercentage(roomsSold, sellableRoomNights),
          adr: roundRate(expectedRoomRevenue, roomsSold),
          revpar: roundRate(expectedRoomRevenue, sellableRoomNights),
        },
      };
    })();
  },

  async getRange(withTenant: WithTenantFn, startDate: string, endDate: string): Promise<HotelMetricsReport> {
    return withTenant((db) => this.getRangeFromDb(db, startDate, endDate));
  },
};
