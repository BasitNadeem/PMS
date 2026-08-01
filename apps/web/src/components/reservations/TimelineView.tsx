import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { X, Users2, LogIn, BedDouble } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  reservationsService,
  type CalendarReservation,
} from "@/services/reservations";
import { roomsService } from "@/services/rooms";
import { useEscapeKey } from "@/hooks/useEscapeKey";

const COL_WIDTH  = 54;
const ROOM_COL   = 184;
const ROW_HEIGHT = 64;
const BAR_HEIGHT = 40;

// Mid-saturation fills keep reservation state immediately scannable without
// returning to the previous neon palette. A darker rail reinforces each state.
const STATUS_STYLE: Record<string, {
  bg: string; fg: string; rail: string; border: string; shadow: string; label: string;
}> = {
  ENQUIRY:     { bg: "#E3A43B", fg: "#352408", rail: "#9B650D", border: "#C9871C", shadow: "rgba(155,101,13,0.24)", label: "Enquiry" },
  CONFIRMED:   { bg: "#557896", fg: "#FFFFFF", rail: "#29465E", border: "#3E627F", shadow: "rgba(41,70,94,0.25)", label: "Confirmed" },
  CHECKED_IN:  { bg: "#438469", fg: "#FFFFFF", rail: "#205D45", border: "#317158", shadow: "rgba(32,93,69,0.25)", label: "Checked In" },
  CHECKED_OUT: { bg: "#82786D", fg: "#FFFFFF", rail: "#504941", border: "#6C6258", shadow: "rgba(80,73,65,0.23)", label: "Checked Out" },
  CANCELLED:   { bg: "#C65D47", fg: "#FFFFFF", rail: "#8E3827", border: "#AD4834", shadow: "rgba(142,56,39,0.24)", label: "Cancelled" },
  NO_SHOW:     { bg: "#995445", fg: "#FFFFFF", rail: "#653226", border: "#7D4033", shadow: "rgba(101,50,38,0.24)", label: "No Show" },
  WAITLISTED:  { bg: "#75669A", fg: "#FFFFFF", rail: "#4B3D70", border: "#625286", shadow: "rgba(75,61,112,0.24)", label: "Waitlisted" },
};

const ROOM_STATUS_STYLE: Record<string, {
  label: string; bg: string; fg: string; border: string; dot: string;
}> = {
  VACANT_CLEAN: { label: "Clean", bg: "#DDF2E6", fg: "#1D6747", border: "#A9D7BE", dot: "#2E8A5F" },
  VACANT_DIRTY: { label: "Dirty", bg: "#FFF0CD", fg: "#875400", border: "#E8C46F", dot: "#D88900" },
  OCCUPIED: { label: "Occupied", bg: "#E4ECF3", fg: "#315069", border: "#B9CAD8", dot: "#557A98" },
  OUT_OF_ORDER: { label: "Out of order", bg: "#F7E1DB", fg: "#8B3929", border: "#E3B2A6", dot: "#BE4C37" },
};

function styleOf(status: string) {
  return STATUS_STYLE[status] ?? STATUS_STYLE.CONFIRMED;
}

function roomStatusOf(status: string) {
  return ROOM_STATUS_STYLE[status] ?? {
    label: status.replace(/_/g, " "),
    bg: "#EFECE7",
    fg: "#625C54",
    border: "#D9D2C9",
    dot: "#8A8177",
  };
}

export interface TimelineViewProps {
  year: number;
  month: number;
  onReservationClick?: (id: string) => void;
}

interface BarGeo {
  left: number;
  width: number;
  startsThisMonth: boolean;
  endsThisMonth: boolean;
}

function getBarGeometry(
  r: CalendarReservation,
  year: number,
  month: number,
  daysInMonth: number,
): BarGeo | null {
  const checkIn    = new Date(r.checkIn);
  const checkOut   = new Date(r.checkOut);
  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd   = new Date(Date.UTC(year, month, 0));
  if (checkOut <= monthStart || checkIn > monthEnd) return null;
  const startsThisMonth = checkIn >= monthStart;
  const endsThisMonth   = checkOut <= monthEnd;
  const startDay = startsThisMonth ? checkIn.getUTCDate() : 1;
  const endDay   = endsThisMonth   ? checkOut.getUTCDate() : daysInMonth + 1;
  const leftPad  = startsThisMonth ? 4 : 0;
  const rightPad = endsThisMonth   ? 4 : 0;
  return {
    left:  (startDay - 1) * COL_WIDTH + leftPad,
    width: Math.max((endDay - startDay) * COL_WIDTH - leftPad - rightPad, 24),
    startsThisMonth,
    endsThisMonth,
  };
}

function isWeekend(year: number, month: number, day: number): boolean {
  const dow = new Date(year, month - 1, day).getDay();
  return dow === 0 || dow === 6;
}

function getArrivalsOnDay(
  reservations: CalendarReservation[],
  year: number,
  month: number,
  day: number,
): CalendarReservation[] {
  return reservations.filter((r) => {
    if (["CANCELLED", "NO_SHOW", "WAITLISTED"].includes(r.status)) return false;
    const d = new Date(r.checkIn);
    return d.getUTCFullYear() === year && d.getUTCMonth() + 1 === month && d.getUTCDate() === day;
  });
}

function OccupancyBar({ pct }: { pct: number }) {
  const h = pct > 0 ? Math.max(Math.round(pct * 20), 4) : 0;
  return (
    <div className="flex h-full w-full items-end justify-center pb-1.5">
      <div
        className="w-[6px] rounded-full bg-coral transition-all"
        style={{ height: h, opacity: pct > 0 ? 0.45 + pct * 0.55 : 0 }}
      />
    </div>
  );
}

export function TimelineView({
  year,
  month,
  onReservationClick,
}: TimelineViewProps) {
  const navigate    = useNavigate();
  const today       = new Date();
  const isThisMonth = today.getFullYear() === year && today.getMonth() + 1 === month;
  const todayDay    = today.getDate();

  const [selectedDay, setSelectedDay]   = useState<number | null>(null);
  const [hoveredRes,  setHoveredRes]    = useState<string | null>(null);
  useEscapeKey(() => setSelectedDay(null), selectedDay !== null);

  const { data: calData } = useQuery({
    queryKey: ["reservations", "calendar", year, month],
    queryFn:  () => reservationsService.getCalendarReservations(year, month),
  });

  const { data: roomsData } = useQuery({
    queryKey: ["rooms"],
    queryFn:  () => roomsService.getRooms(),
  });

  const reservations = calData ?? [];
  const rooms = (roomsData?.data ?? [])
    .filter((rm) => rm.isActive)
    .sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true, sensitivity: "base" }));

  const daysInMonth = new Date(year, month, 0).getDate();
  const days        = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const resByRoom = new Map<string, CalendarReservation[]>();
  for (const r of reservations) {
    for (const rr of r.rooms) {
      resByRoom.set(rr.roomId, [...(resByRoom.get(rr.roomId) ?? []), r]);
    }
  }

  // Occupancy % per day
  const occupancyByDay = days.map((day) => {
    if (rooms.length === 0) return 0;
    const dayStart = new Date(Date.UTC(year, month - 1, day));
    const dayEnd   = new Date(Date.UTC(year, month - 1, day + 1));
    const occupied = rooms.filter((room) =>
      (resByRoom.get(room.id) ?? []).some((r) => {
        if (["CANCELLED", "NO_SHOW", "WAITLISTED"].includes(r.status)) return false;
        const ci = new Date(r.checkIn);
        const co = new Date(r.checkOut);
        return ci < dayEnd && co > dayStart;
      }),
    ).length;
    return occupied / rooms.length;
  });
  const averageOccupancy = occupancyByDay.length > 0
    ? Math.round((occupancyByDay.reduce((total, pct) => total + pct, 0) / occupancyByDay.length) * 100)
    : 0;

  const monthLabel = new Date(year, month - 1).toLocaleString("en-PK", { month: "long" });
  const dayArrivals = selectedDay !== null
    ? getArrivalsOnDay(reservations, year, month, selectedDay)
    : [];

  return (
    <>
      <div className="overflow-x-auto scroll-area">
        <div style={{ minWidth: ROOM_COL + daysInMonth * COL_WIDTH }}>

          {/* ── Date header ────────────────────────────────────── */}
          <div className="flex sticky top-0 z-20 bg-card border-b border-line shadow-sm">
            <div
              className="sticky left-0 z-30 shrink-0 flex items-center gap-2.5 border-r border-line bg-card px-4"
              style={{ width: ROOM_COL }}
            >
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-coral-soft text-coral">
                <BedDouble size={16} />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink">Rooms</p>
                <p className="text-[10px] text-ink-faint">{rooms.length} active</p>
              </div>
            </div>
            {days.map((d) => {
              const isToday   = isThisMonth && d === todayDay;
              const weekend   = isWeekend(year, month, d);
              const dayLabel  = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"][new Date(year, month - 1, d).getDay()];
              return (
                <button
                  key={d}
                  onClick={() => setSelectedDay(d)}
                  className={cn(
                    "shrink-0 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors",
                    isToday
                      ? "bg-coral/8 hover:bg-coral/12"
                      : weekend
                      ? "bg-mist/70 hover:bg-mist"
                      : "hover:bg-mist/60",
                  )}
                  style={{ width: COL_WIDTH }}
                >
                  <span className={cn(
                    "text-[10px] font-bold uppercase tracking-wide",
                    "text-ink-faint",
                    isToday && "text-coral",
                  )}>
                    {dayLabel}
                  </span>
                  <span className={cn(
                    "text-[14px] font-bold tnum leading-none",
                    isToday
                      ? "bg-coral text-white h-6 w-6 rounded-full flex items-center justify-center text-[12px]"
                      : weekend ? "text-ink-mute" : "text-ink-soft",
                  )}>
                    {d}
                  </span>
                </button>
              );
            })}
          </div>

          {/* ── Occupancy sparkline row ─────────────────────────── */}
          <div className="relative flex items-end border-b border-line-soft bg-mist/45" style={{ height: 42 }}>
            <div
              className="sticky left-0 z-[8] shrink-0 flex items-center justify-between border-r border-line-soft bg-mist px-4"
              style={{ width: ROOM_COL, height: 42 }}
            >
              <span className="text-[10px] font-bold uppercase tracking-[0.13em] text-ink-faint">Occupancy</span>
              <span className="text-[10px] font-bold tnum text-coral">{averageOccupancy}% avg</span>
            </div>
            {days.map((d, i) => {
              const isToday = isThisMonth && d === todayDay;
              const weekend = isWeekend(year, month, d);
              const pct     = occupancyByDay[i] ?? 0;
              return (
                <div
                  key={d}
                  className={cn(
                    "shrink-0 flex items-end justify-center pb-1",
                    isToday ? "bg-coral/5" : weekend ? "bg-mist" : "",
                  )}
                  style={{ width: COL_WIDTH, height: 42 }}
                  title={`${Math.round(pct * 100)}% occupied`}
                >
                  <OccupancyBar pct={pct} />
                </div>
              );
            })}
          </div>

          {/* ── Room rows ───────────────────────────────────────── */}
          <div className="relative">
            {/* Vertical grid lines + column backgrounds */}
            <div className="absolute inset-0 flex pointer-events-none" style={{ paddingLeft: ROOM_COL }}>
              {days.map((d, i) => {
                const isToday = isThisMonth && d === todayDay;
                const weekend = isWeekend(year, month, d);
                return (
                  <div
                    key={i}
                    className={cn(
                      "shrink-0 border-r",
                      isToday      ? "border-coral/30 bg-coral/4" :
                      weekend      ? "border-line-soft bg-mist/55" :
                                     "border-line-soft",
                    )}
                    style={{ width: COL_WIDTH }}
                  />
                );
              })}
            </div>

            {isThisMonth && (
              <div
                className="absolute bottom-0 top-0 z-[4] w-px bg-coral/55 pointer-events-none"
                style={{ left: ROOM_COL + (todayDay - 1) * COL_WIDTH + COL_WIDTH / 2 }}
              >
                <span className="absolute -left-[3px] top-0 h-[7px] w-[7px] rounded-full bg-coral shadow-sm" />
              </div>
            )}

            {rooms.length === 0 ? (
              <div className="py-16 text-center text-[13px] text-ink-mute">No rooms configured</div>
            ) : (
              rooms.map((room, rowIdx) => {
                const roomRes = resByRoom.get(room.id) ?? [];
                const isEven  = rowIdx % 2 === 0;
                const roomStatus = roomStatusOf(room.status);
                return (
                  <div
                    key={room.id}
                    className={cn(
                      "flex items-center border-b border-line-soft relative group",
                      isEven ? "bg-card" : "bg-mist/30",
                    )}
                    style={{ height: ROW_HEIGHT }}
                  >
                    {/* Sticky room label */}
                    <div
                      className={cn(
                        "shrink-0 flex items-center gap-2.5 px-3 sticky left-0 z-[5] h-full border-r border-line-soft",
                        isEven ? "bg-card" : "bg-mist",
                      )}
                      style={{ width: ROOM_COL }}
                    >
                      <div className="flex flex-col items-center justify-center h-9 w-10 rounded-xl border border-line bg-paper text-ink shrink-0 shadow-sm">
                        <span className="text-[13px] font-extrabold tnum leading-none">{room.number}</span>
                      </div>
                      <div className="min-w-0">
                        <div className="text-[12px] font-semibold text-ink truncate leading-tight">
                          {room.roomType?.name ?? room.roomType?.typeName ?? "Room"}
                        </div>
                        <span
                          className="mt-1 inline-flex max-w-full items-center gap-1 rounded-full border px-1.5 py-[3px] text-[8.5px] font-extrabold uppercase tracking-[0.08em] leading-none"
                          style={{ background: roomStatus.bg, color: roomStatus.fg, borderColor: roomStatus.border }}
                        >
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: roomStatus.dot }} />
                          <span className="truncate">{roomStatus.label}</span>
                        </span>
                      </div>
                    </div>

                    {/* Reservation bars */}
                    <div className="relative flex-1 h-full">
                      {roomRes.map((r) => {
                        const geo = getBarGeometry(r, year, month, daysInMonth);
                        if (!geo) return null;
                        const s           = styleOf(r.status);
                        const nameParts   = r.guest.fullName.split(" ");
                        const firstName   = nameParts[0];
                        const lastInitial = nameParts[1]?.[0];
                        const isHovered   = hoveredRes === r.id;
                        const showName    = geo.width > 48;
                        const showLast    = geo.width > 130 && lastInitial;
                        const rTL = geo.startsThisMonth ? "11px" : "3px";
                        const rBL = geo.startsThisMonth ? "11px" : "3px";
                        const rTR = geo.endsThisMonth   ? "11px" : "3px";
                        const rBR = geo.endsThisMonth   ? "11px" : "3px";
                        return (
                          <button
                            key={r.id}
                            onMouseEnter={() => setHoveredRes(r.id)}
                            onMouseLeave={() => setHoveredRes(null)}
                            onClick={() => r.groupId ? navigate(`/groups/${r.groupId}`) : onReservationClick?.(r.id)}
                            title={`${r.guest.fullName} · ${r.confirmationNumber}${r.groupId ? " · Group" : ""}`}
                            className="absolute flex items-center gap-2 overflow-hidden px-3 text-left anim-fade-in"
                            style={{
                              left:         geo.left,
                              width:        geo.width,
                              height:       BAR_HEIGHT,
                              top:          (ROW_HEIGHT - BAR_HEIGHT) / 2,
                              background:   s.bg,
                              color:        s.fg,
                              border:       `1px solid ${s.border}`,
                              borderLeft:   `4px solid ${s.rail}`,
                              borderRadius: `${rTL} ${rTR} ${rBR} ${rBL}`,
                              boxShadow:    isHovered
                                ? `0 7px 18px ${s.shadow}`
                                : `0 2px 7px ${s.shadow}`,
                              transform:    isHovered ? "translateY(-1px)" : "none",
                              transition:   "box-shadow 0.15s ease, transform 0.15s ease",
                              zIndex:       isHovered ? 20 : 10,
                            }}
                          >
                            {showName && (
                              <span className="text-[11px] font-bold tracking-[0.01em] truncate leading-none">
                                {firstName}
                                {showLast && (
                                  <span className="opacity-65"> {lastInitial}.</span>
                                )}
                              </span>
                            )}
                            {r.groupId && (
                              <Users2 size={11} className="shrink-0 ml-auto opacity-60" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* ── Legend ─────────────────────────────────────────── */}
          <div className="flex items-center gap-2 px-4 py-3 border-t border-line-soft bg-mist/45 flex-wrap">
            {Object.entries(STATUS_STYLE).map(([, s]) => (
              <div key={s.label} className="flex items-center gap-1.5 rounded-full border border-line-soft bg-card px-2.5 py-1">
                <span
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ background: s.rail }}
                />
                <span className="text-[11px] font-medium text-ink-mute">{s.label}</span>
              </div>
            ))}
            <div className="ml-auto flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-line shrink-0" />
              <span className="text-[11px] font-medium text-ink-mute">Weekend</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Day arrivals popup ──────────────────────────────────── */}
      {selectedDay !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 backdrop-blur-[2px] anim-fade-in"
          onClick={() => setSelectedDay(null)}
        >
          <div
            className="bg-paper rounded-2xl shadow-float w-[340px] flex flex-col overflow-hidden anim-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-line">
              <div>
                <p className="serif text-[20px] text-ink leading-tight">
                  {monthLabel} {selectedDay}
                </p>
                <p className="text-[12px] text-ink-mute mt-0.5 flex items-center gap-1.5">
                  {dayArrivals.length === 0 ? (
                    "No arrivals scheduled"
                  ) : (
                    <>
                      <LogIn size={12} className="text-coral" />
                      {dayArrivals.length} arrival{dayArrivals.length !== 1 ? "s" : ""} expected
                    </>
                  )}
                </p>
              </div>
              <button
                onClick={() => setSelectedDay(null)}
                className="grid place-items-center h-8 w-8 rounded-full hover:bg-mist text-ink-mute transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="overflow-y-auto scroll-area p-3 space-y-1 max-h-80">
              {dayArrivals.length === 0 ? (
                <p className="text-[13px] text-ink-faint text-center py-8">No check-ins on this date</p>
              ) : (
                dayArrivals.map((r) => {
                  const s      = styleOf(r.status);
                  const room   = r.rooms[0]?.room.number ?? "?";
                  const nights = Math.round(
                    (new Date(r.checkOut).getTime() - new Date(r.checkIn).getTime()) / 86_400_000,
                  );
                  return (
                    <button
                      key={r.id}
                      onClick={() => {
                        r.groupId ? navigate(`/groups/${r.groupId}`) : onReservationClick?.(r.id);
                        setSelectedDay(null);
                      }}
                      className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-mist transition-colors"
                    >
                      <span className="shrink-0 grid place-items-center h-9 w-10 rounded-xl border border-line bg-mist text-ink text-[12px] font-bold tnum">
                        {room}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="flex items-center gap-1.5 text-[13px] font-semibold text-ink truncate">
                          {r.guest.fullName}
                          {r.groupId && <Users2 size={12} className="shrink-0 text-ink-faint" />}
                        </p>
                        <p className="text-[11px] text-ink-faint tnum mt-0.5">
                          {nights} night{nights !== 1 ? "s" : ""} · {r.confirmationNumber}
                        </p>
                      </div>
                      <span
                        className="shrink-0 text-[11px] font-semibold rounded-full border px-2.5 py-1"
                        style={{ background: s.bg, color: s.fg, borderColor: s.border }}
                      >
                        {s.label}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
