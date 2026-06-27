import { useState, useEffect, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, CalendarX, ChevronLeft, ChevronRight, List, CalendarDays, GanttChartSquare, ChevronRight as ArrowRight, Star } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  reservationsService,
  type ReservationSummary,
  type ReservationStatus,
} from "@/services/reservations";
import { NewReservationModal } from "@/components/reservations/NewReservationModal";
import { ReservationDrawer } from "@/components/reservations/ReservationDrawer";
import { CalendarView } from "@/components/reservations/CalendarView";
import { TimelineView } from "@/components/reservations/TimelineView";
import { Card } from "@/components/ui/Card";
import { StatusBadge, toneOf } from "@/components/ui/StatusBadge";
import { Avatar } from "@/components/ui/Avatar";
import { Segmented } from "@/components/ui/Segmented";
import { SearchInput } from "@/components/ui/SearchInput";
import { EmptyState } from "@/components/ui/EmptyState";
import { usePermissions } from "@/hooks/usePermissions";

// ── Helpers ───────────────────────────────────────────────────────────────────

function toLocalIsoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ── Constants ─────────────────────────────────────────────────────────────────

type TabKey = "ACTIVE" | "ENQUIRY" | "CONFIRMED" | "CHECKED_IN" | "CHECKED_OUT" | "CANCELLED";

const ACTIVE_STATUSES = "ENQUIRY,CONFIRMED,CHECKED_IN";

const TABS: { key: TabKey; label: string; status?: ReservationStatus; statuses?: string }[] = [
  { key: "ACTIVE",      label: "Active",      statuses: ACTIVE_STATUSES },
  { key: "ENQUIRY",     label: "Pending",     status: "ENQUIRY" },
  { key: "CONFIRMED",   label: "Confirmed",   status: "CONFIRMED" },
  { key: "CHECKED_IN",  label: "Checked In",  status: "CHECKED_IN" },
  { key: "CHECKED_OUT", label: "Checked Out", status: "CHECKED_OUT" },
  { key: "CANCELLED",   label: "Cancelled",   status: "CANCELLED" },
];

const STATUS_LABEL: Record<string, string> = {
  ENQUIRY: "Pending", CONFIRMED: "Confirmed", CHECKED_IN: "Checked In",
  CHECKED_OUT: "Checked Out", CANCELLED: "Cancelled", NO_SHOW: "No Show",
};

type ViewMode = "list" | "calendar" | "timeline";

const VIEW_OPTIONS: { value: ViewMode; label: string; icon: React.ElementType }[] = [
  { value: "list",     label: "List",     icon: List },
  { value: "calendar", label: "Calendar", icon: CalendarDays },
  { value: "timeline", label: "Timeline", icon: GanttChartSquare },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  return new Intl.DateTimeFormat("en-PK", { day: "numeric", month: "short" }).format(new Date(iso));
}

function nightsBetween(checkIn: string, checkOut: string): number {
  return Math.ceil((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86_400_000);
}

// ── Reservation row ───────────────────────────────────────────────────────────

function ReservationRow({ r, groupRoomCount, onOpen }: {
  r: ReservationSummary;
  groupRoomCount?: number;
  onOpen: (id: string) => void;
}) {
  const navigate    = useNavigate();
  const statusLabel = STATUS_LABEL[r.status] ?? r.status;
  const nights      = nightsBetween(r.checkInDate, r.checkOutDate);
  const isGroup     = !!r.groupId && (groupRoomCount ?? 1) > 1;

  // For groups: "3 rooms · Mixed" summary. For individuals: room number · type.
  const roomStr = isGroup
    ? `${groupRoomCount} rooms`
    : r.rooms.length > 0
      ? `${r.rooms[0].room.number} · ${r.rooms[0].roomType.name}`
      : "—";

  const showCheckIn = !isGroup && r.status === "CONFIRMED";
  const showConfirm = !isGroup && r.status === "ENQUIRY";

  function handleClick() {
    if (isGroup) navigate(`/groups/${r.groupId}`);
    else onOpen(r.id);
  }

  return (
    <div
      onClick={handleClick}
      className="group grid grid-cols-2 md:grid-cols-[1.6fr_1fr_1.4fr_0.8fr_1fr_auto] gap-3 px-5 py-3.5 items-center hover:bg-mist cursor-pointer transition-colors border-b border-line-soft last:border-0"
    >
      <div className="flex items-center gap-3 min-w-0 col-span-2 md:col-span-1">
        <Avatar name={r.guest.fullName} size={40} />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <div className="text-[14.5px] font-semibold text-ink truncate">{r.guest.fullName}</div>
            {r.isVip && <Star size={13} className="text-amber fill-amber shrink-0" />}
          </div>
          <div className="flex items-center gap-1.5 text-[12px] text-ink-faint tnum">
            <span>{isGroup ? `GRP-${r.groupId!.slice(0, 8).toUpperCase()}` : (r.confirmationNumber || "—")}</span>
            {isGroup && (
              <span className="rounded-full bg-dusk-soft px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-dusk">
                GROUP
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="min-w-0 hidden md:block">
        <div className={cn("text-[14px] font-semibold truncate", isGroup ? "text-dusk" : "text-ink")}>{roomStr}</div>
      </div>
      <div className="text-[13px] text-ink-soft tnum hidden md:block">
        <span>{fmtDate(r.checkInDate)}</span>
        <span className="mx-1.5 text-ink-faint">→</span>
        <span>{fmtDate(r.checkOutDate)}</span>
      </div>
      <div className="text-[14px] font-semibold text-ink tnum hidden md:block">{nights}n</div>
      <div className="flex items-center gap-2">
        <StatusBadge status={statusLabel} size="sm" />
        {showCheckIn && (
          <span className="rounded-full h-6 px-2.5 text-[11px] font-semibold bg-pine-soft text-pine-deep hidden md:inline-flex items-center">
            Check in
          </span>
        )}
        {showConfirm && (
          <span className="rounded-full h-6 px-2.5 text-[11px] font-semibold bg-slate-soft text-slate hidden md:inline-flex items-center">
            Confirm
          </span>
        )}
      </div>
      <div className="flex items-center justify-end">
        <ArrowRight size={18} className="text-ink-faint group-hover:text-ink-mute hidden md:block" />
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ReservationsPage() {
  const qc = useQueryClient();
  const { has } = usePermissions();
  const canCreate = has("reservations:create");
  const [searchParams, setSearchParams] = useSearchParams();
  const [view, setView]             = useState<ViewMode>(() =>
    searchParams.get("view") === "calendar" ? "calendar" : "list"
  );
  const [activeTab, setActiveTab]   = useState<TabKey>("ACTIVE");
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage]             = useState(1);
  const [sortBy, setSortBy]         = useState<"checkIn" | "checkOut" | "created" | "status">("checkIn");
  const [sortDir, setSortDir]       = useState<"asc" | "desc">("desc");
  const [showNew, setShowNew]           = useState(() => searchParams.get("new") === "1");
  const [newCheckIn,  setNewCheckIn]    = useState<string | undefined>(undefined);
  const [newCheckOut, setNewCheckOut]   = useState<string | undefined>(undefined);
  const [selectionStart, setSelectionStart] = useState<Date | null>(null);
  const [selectionEnd,   setSelectionEnd]   = useState<Date | null>(null);
  const [hoverDate,      setHoverDate]      = useState<Date | null>(null);
  const [openDrawerId, setOpenDrawerId] = useState<string | null>(null);
  const [calYear, setCalYear]       = useState(new Date().getFullYear());
  const [calMonth, setCalMonth]     = useState(new Date().getMonth() + 1);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear ?new=1 / ?view=calendar from URL once consumed
  useEffect(() => {
    if (searchParams.get("new") === "1" || searchParams.get("view")) {
      setSearchParams({}, { replace: true });
    }
  }, []);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => { setDebouncedSearch(searchInput); setPage(1); }, 400);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [searchInput]);

  const activeTab_ = TABS.find((t) => t.key === activeTab);
  const activeStatus   = activeTab_?.status;
  const activeStatuses = activeTab_?.statuses;

  const { data, isLoading } = useQuery({
    queryKey: ["reservations", { status: activeStatus, statuses: activeStatuses, search: debouncedSearch, page, sortBy, sortDir }],
    queryFn: () => reservationsService.getReservations({
      status:   activeStatus,
      statuses: activeStatuses,
      search:   debouncedSearch || undefined,
      page, limit: 20, sortBy, sortDir,
    }),
  });

  const { data: counts } = useQuery({
    queryKey: ["reservations-counts"],
    queryFn: reservationsService.getCounts,
    staleTime: 30_000,
  });

  const rawReservations = data?.data ?? [];
  const meta            = data?.meta;

  // Collapse group reservations — keep only the first entry per groupId.
  // Clicking a group row navigates to the group page instead of the drawer.
  const groupRoomCounts = rawReservations.reduce<Record<string, number>>((acc, r) => {
    if (r.groupId) acc[r.groupId] = (acc[r.groupId] ?? 0) + 1;
    return acc;
  }, {});
  const reservations = rawReservations.filter((r, idx, arr) =>
    !r.groupId || arr.findIndex((x) => x.groupId === r.groupId) === idx
  );
  const totalPages   = meta?.totalPages ?? 1;

  function clearSelection() {
    setSelectionStart(null);
    setSelectionEnd(null);
    setHoverDate(null);
  }

  function handleRangeSelected(checkIn: Date, checkOut: Date) {
    clearSelection();
    if (!canCreate) return;
    setNewCheckIn(toLocalIsoDate(checkIn));
    setNewCheckOut(toLocalIsoDate(checkOut));
    setShowNew(true);
  }

  function handleMonthChange(year: number, month: number) {
    if (month < 1)  { setCalYear(year - 1); setCalMonth(12); }
    else if (month > 12) { setCalYear(year + 1); setCalMonth(1); }
    else { setCalYear(year); setCalMonth(month); }
  }

  const monthName = new Date(calYear, calMonth - 1).toLocaleDateString("en-PK", { month: "long", year: "numeric" });

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <div className="mb-1.5 text-[12px] font-bold uppercase tracking-[0.14em] text-coral">Front Office</div>
          <h1 className="serif text-[34px] leading-[1.05] text-ink">Reservations</h1>
          <p className="mt-1.5 text-[15px] text-ink-mute">
            {meta ? `${meta.total.toLocaleString()} booking${meta.total !== 1 ? "s" : ""}` : "—"}
            {counts?.ENQUIRY ? ` · ${counts.ENQUIRY} pending` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Segmented
            value={view}
            onChange={(v) => setView(v as ViewMode)}
            options={VIEW_OPTIONS}
          />
          {canCreate && (
            <button
              onClick={() => { setNewCheckIn(undefined); setNewCheckOut(undefined); setShowNew(true); }}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-full bg-ink text-white text-sm font-semibold hover:bg-ink-soft transition-colors shadow-pop whitespace-nowrap"
            >
              <Plus size={17} /> New
            </button>
          )}
        </div>
      </div>

      {/* Calendar / Timeline views */}
      {view === "calendar" && (
        <Card pad={false} className="anim-fade-up overflow-hidden">
          <div className="flex items-center justify-between p-5 border-b border-line-soft">
            <div className="flex items-center gap-3">
              <h3 className="serif text-[22px] text-ink">{monthName}</h3>
              <div className="flex gap-1">
                <button onClick={() => handleMonthChange(calYear, calMonth - 1)} className="grid place-items-center h-8 w-8 rounded-lg border border-line hover:bg-line-soft text-ink-mute transition-colors">
                  <ChevronLeft size={16} />
                </button>
                <button onClick={() => handleMonthChange(calYear, calMonth + 1)} className="grid place-items-center h-8 w-8 rounded-lg border border-line hover:bg-line-soft text-ink-mute transition-colors">
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
            <div className="flex items-center gap-3 text-[12px] font-semibold text-ink-mute">
              {["Checked In", "Confirmed", "Pending"].map((s) => (
                <span key={s} className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: toneOf(s).dot }} />
                  {s}
                </span>
              ))}
            </div>
          </div>
          <CalendarView
            year={calYear}
            month={calMonth}
            onMonthChange={handleMonthChange}
            onReservationClick={setOpenDrawerId}
            selectionStart={selectionStart}
            selectionEnd={selectionEnd}
            hoverDate={hoverDate}
            onSelectionStartChange={setSelectionStart}
            onSelectionEndChange={setSelectionEnd}
            onHoverDateChange={setHoverDate}
            onRangeSelected={handleRangeSelected}
          />
        </Card>
      )}

      {view === "timeline" && (
        <Card pad={false} className="anim-fade-up overflow-hidden">
          <div className="flex items-center justify-between p-5 border-b border-line-soft">
            <div>
              <h3 className="serif text-[22px] text-ink">Room timeline</h3>
              <p className="text-[13px] text-ink-mute">{monthName} · drag-free occupancy grid</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex gap-1">
                <button onClick={() => handleMonthChange(calYear, calMonth - 1)} className="grid place-items-center h-8 w-8 rounded-lg border border-line hover:bg-line-soft text-ink-mute transition-colors">
                  <ChevronLeft size={16} />
                </button>
                <button onClick={() => handleMonthChange(calYear, calMonth + 1)} className="grid place-items-center h-8 w-8 rounded-lg border border-line hover:bg-line-soft text-ink-mute transition-colors">
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>
          <TimelineView year={calYear} month={calMonth} onMonthChange={handleMonthChange} onReservationClick={setOpenDrawerId} />
        </Card>
      )}

      {/* List view */}
      {view === "list" && (
        <Card pad={false} className="anim-fade-up overflow-hidden">
          {/* Filters bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-line-soft">
            <div className="flex flex-wrap items-center gap-1.5">
              {TABS.map((tab) => {
                const count = tab.statuses
                  ? (counts?.ENQUIRY ?? 0) + (counts?.CONFIRMED ?? 0) + (counts?.CHECKED_IN ?? 0)
                  : tab.status ? (counts?.[tab.status] ?? 0) : undefined;
                const on = activeTab === tab.key;
                const tone = tab.status ? toneOf(STATUS_LABEL[tab.status] ?? tab.status) : null;
                return (
                  <button
                    key={tab.key}
                    onClick={() => { setActiveTab(tab.key); setPage(1); }}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-3 h-9 text-[13px] font-semibold transition-all",
                      on ? "bg-ink text-white" : "bg-line-soft text-ink-mute hover:text-ink-soft",
                    )}
                  >
                    {tab.status && tone && (
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: on ? "#fff" : tone.dot }} />
                    )}
                    {tab.label}
                    {count !== undefined && count > 0 && (
                      <span className={cn("tnum text-[11px]", on ? "text-white/60" : "text-ink-faint")}>{count}</span>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <SearchInput
                value={searchInput}
                onChange={(v) => setSearchInput(v)}
                placeholder="Search guest, confirmation…"
                className="w-full sm:w-64"
              />
              {(() => {
                const current = `${sortBy}:${sortDir}`;
                const opts = [
                  { value: "checkIn:asc",   label: "Check-in ↑" },
                  { value: "checkIn:desc",  label: "Check-in ↓" },
                  { value: "checkOut:asc",  label: "Check-out ↑" },
                  { value: "checkOut:desc", label: "Check-out ↓" },
                  { value: "created:desc",  label: "Newest first" },
                  { value: "created:asc",   label: "Oldest first" },
                  { value: "status:asc",    label: "Status A–Z" },
                ];
                const sorted = [...opts].sort((a) => (a.value === current ? -1 : 0));
                return (
                  <select
                    value={current}
                    onChange={(e) => {
                      const [s, d] = e.target.value.split(":");
                      setSortBy(s as typeof sortBy);
                      setSortDir(d as "asc" | "desc");
                      setPage(1);
                    }}
                    className="rounded-xl border border-line bg-mist px-3 py-2 text-[13px] text-ink focus:outline-none"
                  >
                    {sorted.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                );
              })()}
            </div>
          </div>

          {/* Column header */}
          <div className="hidden md:grid grid-cols-[1.6fr_1fr_1.4fr_0.8fr_1fr_auto] gap-3 px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-ink-faint border-b border-line-soft">
            <span>Guest</span><span>Room</span><span>Stay</span><span>Nights</span><span>Status</span><span />
          </div>

          {/* Rows */}
          <div>
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-5 py-3.5 border-b border-line-soft animate-pulse">
                  <div className="w-10 h-10 rounded-full bg-line-soft shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 bg-line-soft rounded w-1/3" />
                    <div className="h-2.5 bg-line-soft rounded w-1/4" />
                  </div>
                  <div className="h-6 bg-line-soft rounded-full w-20 hidden md:block" />
                </div>
              ))
            ) : reservations.length === 0 ? (
              <EmptyState
                icon={CalendarX}
                title="No reservations match"
                subtitle="Try a different status filter or search term."
              />
            ) : (
              reservations.map((r) => (
                <ReservationRow
                  key={r.id}
                  r={r}
                  groupRoomCount={r.groupId ? groupRoomCounts[r.groupId] : undefined}
                  onOpen={setOpenDrawerId}
                />
              ))
            )}
          </div>

          {/* Pagination */}
          {meta && (
            <div className="flex items-center justify-between px-5 py-3.5 border-t border-line-soft">
              <span className="text-[13px] text-ink-mute">
                {meta.total === 0 ? "No results" : `${((page - 1) * meta.limit) + 1}–${Math.min(page * meta.limit, meta.total)} of ${meta.total.toLocaleString()}`}
              </span>
              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="grid place-items-center h-8 w-8 rounded-lg border border-line text-ink-mute hover:bg-line-soft disabled:opacity-40 disabled:pointer-events-none transition-colors"
                  >
                    <ChevronLeft size={15} />
                  </button>
                  {(() => {
                    const pages: (number | "…")[] = [];
                    if (totalPages <= 7) {
                      for (let i = 1; i <= totalPages; i++) pages.push(i);
                    } else {
                      pages.push(1);
                      if (page > 3) pages.push("…");
                      for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
                      if (page < totalPages - 2) pages.push("…");
                      pages.push(totalPages);
                    }
                    return pages.map((p, i) =>
                      p === "…" ? (
                        <span key={`ellipsis-${i}`} className="px-1 text-[13px] text-ink-faint select-none">…</span>
                      ) : (
                        <button
                          key={p}
                          onClick={() => setPage(p)}
                          className={cn(
                            "h-8 min-w-8 px-2 rounded-lg text-[13px] font-semibold tnum transition-colors",
                            page === p ? "bg-ink text-white" : "text-ink-mute hover:bg-line-soft",
                          )}
                        >
                          {p}
                        </button>
                      )
                    );
                  })()}
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="grid place-items-center h-8 w-8 rounded-lg border border-line text-ink-mute hover:bg-line-soft disabled:opacity-40 disabled:pointer-events-none transition-colors"
                  >
                    <ChevronRight size={15} />
                  </button>
                </div>
              )}
            </div>
          )}
        </Card>
      )}

      {showNew && (
        <NewReservationModal
          initialCheckInDate={newCheckIn}
          initialCheckOutDate={newCheckOut}
          onClose={() => {
            setShowNew(false);
            setNewCheckIn(undefined);
            setNewCheckOut(undefined);
            clearSelection();
          }}
          onSuccess={() => {
            setShowNew(false);
            setNewCheckIn(undefined);
            setNewCheckOut(undefined);
            clearSelection();
            qc.invalidateQueries({ queryKey: ["reservations"] });
          }}
        />
      )}

      <ReservationDrawer
        reservationId={openDrawerId}
        onClose={() => setOpenDrawerId(null)}
        onStatusChange={() => {
          qc.invalidateQueries({ queryKey: ["reservations"] });
          qc.invalidateQueries({ queryKey: ["reservations-counts"] });
        }}
      />
    </div>
  );
}
