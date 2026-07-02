import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { X, Users2 } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  reservationsService,
  type CalendarReservation,
} from "@/services/reservations";
import { toneOf } from "@/components/ui/StatusBadge";
import { useEscapeKey } from "@/hooks/useEscapeKey";

const DAY_HEADERS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const STATUS_LABEL: Record<string, string> = {
  ENQUIRY: "Pending", CONFIRMED: "Confirmed", CHECKED_IN: "Checked In",
  CHECKED_OUT: "Checked Out", CANCELLED: "Cancelled",
};

export interface CalendarViewProps {
  year: number;
  month: number;
  onMonthChange: (year: number, month: number) => void;
  // Called when a reservation pill or overflow-panel row is clicked
  onReservationClick?: (id: string) => void;
  // Range selection
  selectionStart: Date | null;
  selectionEnd: Date | null;
  hoverDate: Date | null;
  onSelectionStartChange: (date: Date | null) => void;
  onSelectionEndChange: (date: Date | null) => void;
  onHoverDateChange: (date: Date | null) => void;
  onRangeSelected: (checkIn: Date, checkOut: Date) => void;
}

function buildCells(year: number, month: number): (number | null)[] {
  const first    = new Date(year, month - 1, 1);
  const startDow = (first.getDay() + 6) % 7; // Mon = 0
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function groupByDay(
  reservations: CalendarReservation[],
  year: number,
  month: number,
): Map<number, CalendarReservation[]> {
  const map = new Map<number, CalendarReservation[]>();
  for (const r of reservations) {
    const d = new Date(r.checkIn);
    if (d.getUTCFullYear() === year && d.getUTCMonth() + 1 === month) {
      const day = d.getUTCDate();
      map.set(day, [...(map.get(day) ?? []), r]);
    }
  }
  return map;
}

// Normalise a Date to midnight local time so day-level comparisons are safe
function dayTs(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

export function CalendarView({
  year, month, onMonthChange: _onMonthChange,
  onReservationClick,
  selectionStart, selectionEnd, hoverDate,
  onSelectionStartChange, onSelectionEndChange, onHoverDateChange,
  onRangeSelected,
}: CalendarViewProps) {
  const today    = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  // Overflow day panel state — tracks which day's full list is open
  const [overflowDay, setOverflowDay] = useState<number | null>(null);
  useEscapeKey(() => setOverflowDay(null), overflowDay !== null);

  const { data, isLoading } = useQuery({
    queryKey: ["reservations", "calendar", year, month],
    queryFn:  () => reservationsService.getCalendarReservations(year, month),
  });

  const navigate = useNavigate();

  const raw = data ?? [];

  // Count how many rooms each group has across all fetched reservations
  const groupRoomCounts = raw.reduce<Record<string, number>>((acc, r) => {
    if (r.groupId) acc[r.groupId] = (acc[r.groupId] ?? 0) + r.rooms.length;
    return acc;
  }, {});

  // Collapse group reservations — keep only the first entry per groupId,
  // identical to the list-view logic so groups appear as a single calendar pill.
  const reservations = raw.filter((r, idx, arr) =>
    !r.groupId || arr.findIndex((x) => x.groupId === r.groupId) === idx
  );

  const cells    = buildCells(year, month);
  const resByDay = groupByDay(reservations, year, month);
  const isoDay       = (d: number) =>
    `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  const startTs    = selectionStart ? dayTs(selectionStart) : null;
  const rangeEndTs = selectionEnd
    ? dayTs(selectionEnd)
    : hoverDate
      ? dayTs(hoverDate)
      : null;

  const isSelecting = selectionStart !== null && selectionEnd === null;

  function handleDayClick(date: Date) {
    const clickTs = dayTs(date);
    if (!selectionStart) {
      onSelectionStartChange(date);
      return;
    }
    if (startTs !== null && clickTs <= startTs) {
      onSelectionStartChange(date);
      onSelectionEndChange(null);
      onHoverDateChange(null);
    } else {
      onRangeSelected(selectionStart, date);
    }
  }

  function handleCancel() {
    onSelectionStartChange(null);
    onSelectionEndChange(null);
    onHoverDateChange(null);
  }

  // Overflow panel data
  const overflowReservations = overflowDay !== null ? (resByDay.get(overflowDay) ?? []) : [];
  const monthLabel = new Date(year, month - 1).toLocaleString("en-PK", { month: "long" });

  return (
    <div>
      {/* Selection hint — only visible while awaiting check-out click */}
      {isSelecting && (
        <div className="flex items-center justify-center gap-2 py-2 border-b border-line-soft bg-coral-tint">
          <span className="text-[12px] font-medium text-ink-soft">
            Click a check-out date
          </span>
          <span className="text-[12px] text-ink-faint">—</span>
          <button
            onClick={handleCancel}
            className="inline-flex items-center gap-1 text-[12px] font-semibold text-ink-mute hover:text-clay transition-colors"
          >
            <X size={12} />
            cancel
          </button>
        </div>
      )}

      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-line-soft">
        {DAY_HEADERS.map((d) => (
          <div
            key={d}
            className="px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider text-ink-faint text-center"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div
        className="grid grid-cols-7"
        onMouseLeave={() => { if (isSelecting) onHoverDateChange(null); }}
      >
        {cells.map((d, i) => {
          if (d === null) {
            return (
              <div
                key={i}
                className="min-h-[112px] border-r border-b border-line-soft bg-mist/40 cursor-default"
              />
            );
          }

          const cellDate = new Date(year, month - 1, d);
          const cellTs   = dayTs(cellDate);
          const isToday  = isoDay(d) === todayStr;

          const isStart    = startTs !== null && cellTs === startTs;
          const isRangeEnd =
            rangeEndTs !== null &&
            startTs    !== null &&
            cellTs     === rangeEndTs &&
            cellTs     > startTs;
          const isInRange =
            startTs    !== null &&
            rangeEndTs !== null &&
            cellTs     > startTs &&
            cellTs     < rangeEndTs;

          const dayRes  = resByDay.get(d) ?? [];
          const visible = dayRes.slice(0, 3);
          const overflow = dayRes.length - visible.length;

          return (
            <div
              key={i}
              onClick={() => handleDayClick(cellDate)}
              onMouseEnter={() => { if (isSelecting) onHoverDateChange(cellDate); }}
              className={cn(
                "min-h-[112px] border-r border-b border-line-soft p-2 transition-colors cursor-pointer select-none",
                isInRange
                  ? "bg-coral/10"
                  : isToday
                    ? "bg-coral-tint"
                    : "hover:bg-mist/60",
              )}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span
                  className={cn(
                    "grid place-items-center h-6 w-6 rounded-full text-[12px] font-bold tnum transition-colors",
                    isStart
                      ? "bg-coral text-white"
                      : isRangeEnd
                        ? "bg-coral/30 text-coral-deep"
                        : isToday
                          ? "bg-coral text-white"
                          : "text-ink-soft",
                  )}
                >
                  {d}
                </span>
                {dayRes.length > 0 && (
                  <span className="text-[10px] font-bold text-ink-faint">
                    {dayRes.length} in
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-1">
                {isLoading && (
                  <div className="space-y-1">
                    <div className="h-4 bg-line-soft rounded animate-pulse" />
                    <div className="h-4 bg-line-soft rounded animate-pulse w-3/4" />
                  </div>
                )}
                {!isLoading && visible.map((r) => {
                  const statusLabel = STATUS_LABEL[r.status] ?? r.status;
                  const t           = toneOf(statusLabel);
                  const firstName   = r.guest.fullName.split(" ")[0];
                  const isGroup     = !!r.groupId;
                  const roomCount   = isGroup ? (groupRoomCounts[r.groupId!] ?? 1) : 0;
                  const roomLabel   = isGroup ? `${roomCount} rooms` : (r.rooms[0]?.room.number ?? "?");
                  return (
                    <button
                      key={r.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isGroup) navigate(`/groups/${r.groupId}`);
                        else onReservationClick?.(r.id);
                      }}
                      title={isGroup ? `Group · ${roomCount} rooms` : undefined}
                      className="flex items-center gap-1.5 rounded-md px-1.5 py-1 text-left hover:brightness-95 transition"
                      style={{ background: t.bg }}
                    >
                      <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: t.dot }} />
                      <span className="text-[11px] font-semibold truncate" style={{ color: t.fg }}>
                        {firstName} · {roomLabel}
                      </span>
                      {isGroup && <Users2 size={10} className="shrink-0" style={{ color: t.fg }} />}
                    </button>
                  );
                })}
                {overflow > 0 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setOverflowDay(d);
                    }}
                    className="text-left text-[10.5px] font-semibold text-ink-mute pl-1.5 hover:text-coral transition-colors"
                  >
                    +{overflow} more
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Overflow day panel ───────────────────────────────────────────────── */}
      {overflowDay !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 backdrop-blur-[2px] anim-fade-in"
          onClick={() => setOverflowDay(null)}
        >
          <div
            className="bg-paper rounded-xl2 shadow-float w-72 flex flex-col overflow-hidden anim-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-line">
              <div>
                <p className="serif text-[18px] text-ink leading-tight">
                  {monthLabel} {overflowDay}
                </p>
                <p className="text-[12px] text-ink-mute mt-0.5">
                  {overflowReservations.length} reservation{overflowReservations.length !== 1 ? "s" : ""}
                </p>
              </div>
              <button
                onClick={() => setOverflowDay(null)}
                className="grid place-items-center h-8 w-8 rounded-full hover:bg-mist text-ink-mute transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Reservation list */}
            <div className="overflow-y-auto scroll-area p-2 space-y-1 max-h-72">
              {overflowReservations.map((r) => {
                const statusLabel = STATUS_LABEL[r.status] ?? r.status;
                const t           = toneOf(statusLabel);
                const fullName    = r.guest.fullName;
                const isGroup     = !!r.groupId;
                const roomCount   = isGroup ? (groupRoomCounts[r.groupId!] ?? 1) : 0;
                const roomLabel   = isGroup ? `${roomCount} rooms` : (r.rooms[0]?.room.number ?? "?");
                return (
                  <button
                    key={r.id}
                    onClick={() => {
                      if (isGroup) navigate(`/groups/${r.groupId}`);
                      else onReservationClick?.(r.id);
                      setOverflowDay(null);
                    }}
                    className="w-full flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-left hover:bg-mist transition-colors"
                  >
                    <span
                      className="flex items-center gap-1.5 flex-1 min-w-0 rounded-md px-2 py-1"
                      style={{ background: t.bg }}
                    >
                      <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: t.dot }} />
                      <span className="text-[12px] font-semibold truncate" style={{ color: t.fg }}>
                        {fullName} · {roomLabel}
                      </span>
                      {isGroup && <Users2 size={11} className="shrink-0" style={{ color: t.fg }} />}
                    </span>
                    <span className="text-[11px] text-ink-faint shrink-0">
                      {statusLabel}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
