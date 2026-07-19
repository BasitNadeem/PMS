import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { X, Users2, LogIn } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  reservationsService,
  type CalendarReservation,
} from "@/services/reservations";
import { roomsService } from "@/services/rooms";
import { useEscapeKey } from "@/hooks/useEscapeKey";

const COL_WIDTH  = 52;
const ROOM_COL   = 152;
const ROW_HEIGHT = 58;
const BAR_HEIGHT = 36;

// Warm earthy palette — all muted, all readable with white text
const STATUS_STYLE: Record<string, { bg: string; shadow: string; dot: string; label: string }> = {
  ENQUIRY:     { bg: "#D97706", shadow: "rgba(217,119,6,0.32)",   dot: "#FCD34D", label: "Enquiry"     },
  CONFIRMED:   { bg: "#2563EB", shadow: "rgba(37,99,235,0.32)",   dot: "#93C5FD", label: "Confirmed"   },
  CHECKED_IN:  { bg: "#059669", shadow: "rgba(5,150,105,0.32)",   dot: "#6EE7B7", label: "Checked In"  },
  CHECKED_OUT: { bg: "#64748B", shadow: "rgba(100,116,139,0.32)", dot: "#CBD5E1", label: "Checked Out" },
  CANCELLED:   { bg: "#E11D48", shadow: "rgba(225,29,72,0.32)",   dot: "#FDA4AF", label: "Cancelled"   },
};

function styleOf(status: string) {
  return STATUS_STYLE[status] ?? STATUS_STYLE.CONFIRMED;
}

export interface TimelineViewProps {
  year: number;
  month: number;
  onMonthChange: (year: number, month: number) => void;
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
    const d = new Date(r.checkIn);
    return d.getUTCFullYear() === year && d.getUTCMonth() + 1 === month && d.getUTCDate() === day;
  });
}

function OccupancyBar({ pct }: { pct: number }) {
  const color = pct >= 0.75 ? "#4A7A5A" : pct >= 0.4 ? "#9C6B3C" : pct > 0 ? "#8C4A48" : "transparent";
  const h     = pct > 0 ? Math.max(Math.round(pct * 22), 4) : 0;
  return (
    <div className="flex items-end justify-center w-full h-full pb-1">
      <div className="w-[5px] rounded-full transition-all" style={{ height: h, background: color }} />
    </div>
  );
}

export function TimelineView({
  year,
  month,
  onMonthChange: _onMonthChange,
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
        const ci = new Date(r.checkIn);
        const co = new Date(r.checkOut);
        return ci < dayEnd && co > dayStart;
      }),
    ).length;
    return occupied / rooms.length;
  });

  const monthLabel = new Date(year, month - 1).toLocaleString("en-PK", { month: "long" });
  const dayArrivals = selectedDay !== null
    ? getArrivalsOnDay(reservations, year, month, selectedDay)
    : [];

  return (
    <>
      <div className="overflow-x-auto scroll-area">
        <div style={{ minWidth: ROOM_COL + daysInMonth * COL_WIDTH }}>

          {/* ── Date header ────────────────────────────────────── */}
          <div
            className="flex sticky top-0 z-10 bg-white border-b-2 border-line shadow-sm"
            style={{ paddingLeft: ROOM_COL }}
          >
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
                      ? "bg-slate-50 hover:bg-slate-100/80"
                      : "hover:bg-mist/60",
                  )}
                  style={{ width: COL_WIDTH }}
                >
                  <span className={cn(
                    "text-[10px] font-bold uppercase tracking-wide",
                    weekend ? "text-slate-400" : "text-ink-faint",
                    isToday && "text-coral",
                  )}>
                    {dayLabel}
                  </span>
                  <span className={cn(
                    "text-[14px] font-bold tnum leading-none",
                    isToday
                      ? "bg-coral text-white h-6 w-6 rounded-full flex items-center justify-center text-[12px]"
                      : weekend ? "text-slate-500" : "text-ink-soft",
                  )}>
                    {d}
                  </span>
                </button>
              );
            })}
          </div>

          {/* ── Occupancy sparkline row ─────────────────────────── */}
          <div
            className="relative flex items-end border-b border-line-soft bg-slate-50/60"
            style={{ paddingLeft: ROOM_COL, height: 40 }}
          >
            {days.map((d, i) => {
              const isToday = isThisMonth && d === todayDay;
              const weekend = isWeekend(year, month, d);
              const pct     = occupancyByDay[i] ?? 0;
              return (
                <div
                  key={d}
                  className={cn(
                    "shrink-0 flex items-end justify-center pb-1",
                    isToday ? "bg-coral/5" : weekend ? "bg-slate-100/50" : "",
                  )}
                  style={{ width: COL_WIDTH, height: 40 }}
                >
                  <OccupancyBar pct={pct} />
                </div>
              );
            })}
            {/* Occupancy label pinned left — shown as room col overlay */}
            <div
              className="absolute left-0 flex items-center px-3 h-10 z-[6]"
              style={{ width: ROOM_COL, background: "rgba(248,249,250,0.97)" }}
            >
              <span className="text-[10px] font-bold uppercase tracking-widest text-ink-faint">Occupancy</span>
            </div>
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
                      weekend      ? "border-slate-200  bg-slate-50/70" :
                                     "border-line-soft",
                    )}
                    style={{ width: COL_WIDTH }}
                  />
                );
              })}
            </div>

            {rooms.length === 0 ? (
              <div className="py-16 text-center text-[13px] text-ink-mute">No rooms configured</div>
            ) : (
              rooms.map((room, rowIdx) => {
                const roomRes = resByRoom.get(room.id) ?? [];
                const isEven  = rowIdx % 2 === 0;
                return (
                  <div
                    key={room.id}
                    className={cn(
                      "flex items-center border-b border-line-soft relative group",
                      isEven ? "bg-white" : "bg-slate-50/40",
                    )}
                    style={{ height: ROW_HEIGHT }}
                  >
                    {/* Today line */}
                    {isThisMonth && (
                      <div
                        className="absolute top-0 bottom-0 w-[2px] bg-coral/40 z-[4] pointer-events-none"
                        style={{ left: ROOM_COL + (todayDay - 1) * COL_WIDTH + COL_WIDTH / 2 }}
                      />
                    )}

                    {/* Sticky room label */}
                    <div
                      className={cn(
                        "shrink-0 flex items-center gap-2.5 px-3 sticky left-0 z-[5] h-full border-r border-line-soft",
                        isEven ? "bg-white" : "bg-slate-50/80",
                      )}
                      style={{ width: ROOM_COL }}
                    >
                      <div className="flex flex-col items-center justify-center h-9 w-10 rounded-xl bg-ink text-white shrink-0">
                        <span className="text-[13px] font-bold tnum leading-none">{room.number}</span>
                      </div>
                      <div className="min-w-0">
                        <div className="text-[12px] font-semibold text-ink truncate leading-tight">
                          {room.roomType?.name ?? room.roomType?.typeName ?? "Room"}
                        </div>
                        <div className={cn(
                          "text-[10px] font-bold uppercase tracking-wide mt-0.5",
                          room.status === "VACANT_CLEAN"   ? "text-emerald-500" :
                          room.status === "VACANT_DIRTY"   ? "text-amber-500"   :
                          room.status === "OCCUPIED"        ? "text-blue-500"    :
                          room.status === "OUT_OF_ORDER"    ? "text-red-400"     : "text-ink-faint",
                        )}>
                          {room.status === "VACANT_CLEAN"  ? "Clean"       :
                           room.status === "VACANT_DIRTY"  ? "Dirty"       :
                           room.status === "OCCUPIED"       ? "Occupied"    :
                           room.status === "OUT_OF_ORDER"   ? "Out of order" : room.status}
                        </div>
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
                        // Pill radius: full (999) on months that start/end here, flat (3) for continuation
                        const rTL = geo.startsThisMonth ? "999px" : "3px";
                        const rBL = geo.startsThisMonth ? "999px" : "3px";
                        const rTR = geo.endsThisMonth   ? "999px" : "3px";
                        const rBR = geo.endsThisMonth   ? "999px" : "3px";
                        return (
                          <button
                            key={r.id}
                            onMouseEnter={() => setHoveredRes(r.id)}
                            onMouseLeave={() => setHoveredRes(null)}
                            onClick={() => r.groupId ? navigate(`/groups/${r.groupId}`) : onReservationClick?.(r.id)}
                            title={`${r.guest.fullName} · ${r.confirmationNumber}${r.groupId ? " · Group" : ""}`}
                            className="absolute flex items-center gap-2 px-3 overflow-hidden anim-fade-in"
                            style={{
                              left:         geo.left,
                              width:        geo.width,
                              height:       BAR_HEIGHT,
                              top:          (ROW_HEIGHT - BAR_HEIGHT) / 2,
                              background:   s.bg,
                              borderRadius: `${rTL} ${rTR} ${rBR} ${rBL}`,
                              boxShadow:    isHovered
                                ? `0 4px 12px ${s.shadow}, inset 0 1px 0 rgba(255,255,255,0.15)`
                                : `0 1px 3px ${s.shadow}, inset 0 1px 0 rgba(255,255,255,0.10)`,
                              transform:    isHovered ? "translateY(-1px)" : "none",
                              transition:   "box-shadow 0.15s ease, transform 0.15s ease",
                              zIndex:       isHovered ? 20 : 10,
                            }}
                          >
                            {showName && (
                              <span className="text-[11px] font-semibold tracking-wide truncate leading-none text-white">
                                {firstName}
                                {showLast && (
                                  <span className="opacity-60"> {lastInitial}.</span>
                                )}
                              </span>
                            )}
                            {r.groupId && (
                              <Users2 size={10} className="shrink-0 ml-auto text-white/60" />
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
          <div className="flex items-center gap-3 px-4 py-3 border-t border-line-soft bg-slate-50/50 flex-wrap">
            {Object.entries(STATUS_STYLE).map(([, s]) => (
              <div key={s.label} className="flex items-center gap-1.5">
                <span
                  className="h-3 w-5 rounded-full shrink-0"
                  style={{ background: s.bg }}
                />
                <span className="text-[11px] font-medium text-ink-mute">{s.label}</span>
              </div>
            ))}
            <div className="ml-auto flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-slate-200 shrink-0" />
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
                      <span className="shrink-0 grid place-items-center h-9 w-10 rounded-xl bg-ink text-white text-[12px] font-bold tnum">
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
                        className="shrink-0 text-[11px] font-semibold rounded-full px-2.5 py-1 text-white"
                        style={{ background: s.bg }}
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
