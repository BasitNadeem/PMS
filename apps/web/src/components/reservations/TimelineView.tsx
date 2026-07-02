import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { X, Users2 } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  reservationsService,
  type CalendarReservation,
} from "@/services/reservations";
import { roomsService } from "@/services/rooms";
import { toneOf } from "@/components/ui/StatusBadge";
import { useEscapeKey } from "@/hooks/useEscapeKey";

const COL_WIDTH  = 48;
const ROOM_COL   = 132;
const ROW_HEIGHT = 44;

const STATUS_LABEL: Record<string, string> = {
  ENQUIRY: "Pending", CONFIRMED: "Confirmed", CHECKED_IN: "Checked In",
  CHECKED_OUT: "Checked Out", CANCELLED: "Cancelled",
};

export interface TimelineViewProps {
  year: number;
  month: number;
  onMonthChange: (year: number, month: number) => void;
  onReservationClick?: (id: string) => void;
}

function getBarGeometry(r: CalendarReservation, year: number, month: number, daysInMonth: number) {
  const checkIn  = new Date(r.checkIn);
  const checkOut = new Date(r.checkOut);
  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd   = new Date(Date.UTC(year, month, 0));
  if (checkOut <= monthStart || checkIn > monthEnd) return null;
  const startDay = checkIn < monthStart ? 1 : checkIn.getUTCDate();
  const endDay   = checkOut > monthEnd  ? daysInMonth + 1 : checkOut.getUTCDate();
  return {
    left:  (startDay - 1) * COL_WIDTH + 3,
    width: Math.max((endDay - startDay) * COL_WIDTH - 6, 20),
  };
}

function isWeekend(year: number, month: number, day: number): boolean {
  const dow = new Date(year, month - 1, day).getDay();
  return dow === 0 || dow === 6;
}

// Returns reservations checking IN on the given day.
// The timeline bars already show the full stay duration, so arrivals is the
// additive information — who to expect at front desk on this specific date.
function getArrivalsOnDay(
  reservations: CalendarReservation[],
  year: number,
  month: number,
  day: number,
): CalendarReservation[] {
  return reservations.filter((r) => {
    const d = new Date(r.checkIn);
    return d.getUTCFullYear() === year
      && d.getUTCMonth() + 1 === month
      && d.getUTCDate()       === day;
  });
}

export function TimelineView({ year, month, onMonthChange: _onMonthChange, onReservationClick }: TimelineViewProps) {
  const navigate    = useNavigate();
  const today       = new Date();
  const isThisMonth = today.getFullYear() === year && today.getMonth() + 1 === month;
  const todayDay    = today.getDate();

  const [selectedDay, setSelectedDay] = useState<number | null>(null);
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
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const resByRoom = new Map<string, CalendarReservation[]>();
  for (const r of reservations) {
    for (const rr of r.rooms) {
      resByRoom.set(rr.roomId, [...(resByRoom.get(rr.roomId) ?? []), r]);
    }
  }

  const monthLabel = new Date(year, month - 1).toLocaleString("en-PK", { month: "long" });

  // Arrivals on the selected day
  const dayArrivals = selectedDay !== null
    ? getArrivalsOnDay(reservations, year, month, selectedDay)
    : [];

  return (
    <>
      <div className="overflow-x-auto scroll-area">
        <div style={{ minWidth: ROOM_COL + daysInMonth * COL_WIDTH }}>
          {/* Date header — each cell is a clickable button */}
          <div className="flex sticky top-0 z-10 bg-card border-b border-line-soft" style={{ paddingLeft: ROOM_COL }}>
            {days.map((d) => {
              const isToday = isThisMonth && d === todayDay;
              return (
                <button
                  key={d}
                  onClick={() => setSelectedDay(d)}
                  className={cn(
                    "shrink-0 text-center py-2 transition-colors hover:bg-mist/70",
                    isToday ? "bg-coral-tint hover:bg-coral-tint" : "",
                  )}
                  style={{ width: COL_WIDTH }}
                >
                  <div className="text-[10px] font-bold uppercase text-ink-faint">
                    {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"][new Date(year, month - 1, d).getDay()]}
                  </div>
                  <div className={cn("text-[13px] font-bold tnum", isToday ? "text-coral" : "text-ink-soft")}>
                    {d}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Rows */}
          <div className="relative">
            {/* Vertical grid lines */}
            <div className="absolute inset-0 flex pointer-events-none" style={{ paddingLeft: ROOM_COL }}>
              {days.map((d, i) => (
                <div
                  key={i}
                  className={cn(
                    "shrink-0 border-r border-line-soft",
                    isThisMonth && d === todayDay && "bg-coral-tint/40",
                    isWeekend(year, month, d) && "bg-mist/60",
                  )}
                  style={{ width: COL_WIDTH }}
                />
              ))}
            </div>

            {rooms.length === 0 ? (
              <div className="py-16 text-center text-[13px] text-ink-mute">No rooms found</div>
            ) : (
              rooms.map((room) => {
                const roomRes = resByRoom.get(room.id) ?? [];
                return (
                  <div
                    key={room.id}
                    className="flex items-center border-b border-line-soft relative hover:bg-mist/50"
                    style={{ height: ROW_HEIGHT }}
                  >
                    {/* Sticky room label */}
                    <div
                      className="shrink-0 flex items-center gap-2 px-3 sticky left-0 bg-card/95 backdrop-blur z-[5] h-full border-r border-line-soft"
                      style={{ width: ROOM_COL }}
                    >
                      <span className="grid place-items-center h-7 w-9 rounded-md bg-ink text-white text-[11px] font-bold tnum">
                        {room.number}
                      </span>
                      <span className="text-[11px] text-ink-mute truncate">{room.roomType.typeName}</span>
                    </div>

                    {/* Reservation bars */}
                    <div className="relative flex-1 h-full">
                      {isThisMonth && (
                        <div
                          className="absolute top-0 bottom-0 border-l-2 border-coral/50 z-10 pointer-events-none"
                          style={{ left: (todayDay - 1) * COL_WIDTH }}
                        />
                      )}
                      {roomRes.map((r) => {
                        const geo = getBarGeometry(r, year, month, daysInMonth);
                        if (!geo) return null;
                        const statusLabel = STATUS_LABEL[r.status] ?? r.status;
                        const t = toneOf(statusLabel);
                        const firstName = r.guest.fullName.split(" ")[0];
                        return (
                          <button
                            key={r.id}
                            onClick={() => r.groupId ? navigate(`/groups/${r.groupId}`) : onReservationClick?.(r.id)}
                            title={`${r.guest.fullName} · ${r.confirmationNumber}${r.groupId ? " · Group booking (click to view group)" : ""}`}
                            className="absolute top-1/2 -translate-y-1/2 flex items-center gap-1.5 rounded-lg px-2 h-7 hover:brightness-95 hover:shadow-pop transition anim-fade-in"
                            style={{ left: geo.left, width: geo.width, background: t.bg, border: `1px solid ${t.dot}33` }}
                          >
                            <span className="h-2 w-2 rounded-full shrink-0" style={{ background: t.dot }} />
                            <span className="text-[11px] font-semibold truncate" style={{ color: t.fg }}>
                              {firstName}
                            </span>
                            {r.groupId && <Users2 size={10} className="shrink-0" style={{ color: t.fg }} />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* ── Day reservations popup ─────────────────────────────────────────── */}
      {selectedDay !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 backdrop-blur-[2px] anim-fade-in"
          onClick={() => setSelectedDay(null)}
        >
          <div
            className="bg-paper rounded-xl2 shadow-float w-80 flex flex-col overflow-hidden anim-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-line">
              <div>
                <p className="serif text-[18px] text-ink leading-tight">
                  {monthLabel} {selectedDay}
                </p>
                <p className="text-[12px] text-ink-mute mt-0.5">
                  {dayArrivals.length === 0
                    ? "No arrivals"
                    : `${dayArrivals.length} arrival${dayArrivals.length !== 1 ? "s" : ""} expected`}
                </p>
              </div>
              <button
                onClick={() => setSelectedDay(null)}
                className="grid place-items-center h-8 w-8 rounded-full hover:bg-mist text-ink-mute transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* List */}
            <div className="overflow-y-auto scroll-area p-2 space-y-1 max-h-80">
              {dayArrivals.length === 0 ? (
                <p className="text-[13px] text-ink-faint text-center py-6">
                  No check-ins on this date
                </p>
              ) : (
                dayArrivals.map((r) => {
                  const statusLabel = STATUS_LABEL[r.status] ?? r.status;
                  const t           = toneOf(statusLabel);
                  const room        = r.rooms[0]?.room.number ?? "?";
                  const checkOut    = new Date(r.checkOut);
                  const nights      = Math.round(
                    (checkOut.getTime() - new Date(r.checkIn).getTime()) / 86_400_000
                  );
                  return (
                    <button
                      key={r.id}
                      onClick={() => { r.groupId ? navigate(`/groups/${r.groupId}`) : onReservationClick?.(r.id); setSelectedDay(null); }}
                      className="w-full flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-left hover:bg-mist transition-colors"
                    >
                      {/* Room badge */}
                      <span className="shrink-0 grid place-items-center h-7 w-9 rounded-md bg-ink text-white text-[11px] font-bold tnum">
                        {room}
                      </span>
                      {/* Guest + nights */}
                      <div className="flex-1 min-w-0">
                        <p className="flex items-center gap-1.5 text-[13px] font-semibold text-ink truncate">
                          {r.guest.fullName}
                          {r.groupId && <Users2 size={12} className="shrink-0 text-ink-faint" />}
                        </p>
                        <p className="text-[11px] text-ink-faint tnum">
                          {nights} night{nights !== 1 ? "s" : ""} · {r.confirmationNumber}
                        </p>
                      </div>
                      {/* Status pill */}
                      <span
                        className="shrink-0 text-[11px] font-semibold rounded-full px-2 py-0.5"
                        style={{ background: t.bg, color: t.fg }}
                      >
                        {statusLabel}
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
