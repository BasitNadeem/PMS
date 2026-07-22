import { useState, useEffect, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, CalendarX, ChevronLeft, ChevronRight, List, CalendarDays, GanttChartSquare, ChevronRight as ArrowRight, ExternalLink, Star } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  reservationsService,
  type ReservationSummary,
  type ReservationStatus,
} from "@/services/reservations";
import { NewReservationModal } from "@/components/reservations/NewReservationModal";
import { NewReservationTypeModal, type NewReservationType } from "@/components/reservations/NewReservationTypeModal";
import { NewGroupModal } from "@/components/groups/NewGroupModal";
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
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { useToast } from "@/hooks/useToast";
import { ToastContainer } from "@/components/ui/ToastContainer";

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

// Booking source → compact display label for the Type column
// Group payer type → compact badge label
const PAYER_LABEL: Record<string, { label: string; bg: string; text: string }> = {
  TOUR_AGENCY: { label: "Tour",      bg: "bg-slate-soft",  text: "text-slate" },
  CORPORATE:   { label: "Corporate", bg: "bg-dusk-soft",   text: "text-dusk" },
  GOVERNMENT:  { label: "Govt",      bg: "bg-ink/8",       text: "text-ink-soft" },
  NGO:         { label: "NGO",       bg: "bg-pine-soft",   text: "text-pine-deep" },
  INDIVIDUAL:  { label: "Individual",bg: "bg-amber-soft",  text: "text-amber" },
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
  // A reservation is a group booking as long as it has a groupId — regardless of
  // how many sibling rooms are currently visible in the active filter. Without this,
  // checking out one room of a SPLIT group drops the count to 1 and the remaining
  // room incorrectly loses its GROUP badge and group name.
  const isGroup         = !!r.groupId;
  const hasMultipleRooms = isGroup && (groupRoomCount ?? 1) > 1;

  const roomStr = hasMultipleRooms
    ? `${groupRoomCount} rooms`
    : r.rooms.length > 0
      ? `${r.rooms[0].room.number} · ${r.rooms[0].roomType.name}`
      : "—";

  const payerMeta = isGroup && r.group?.payerType ? PAYER_LABEL[r.group.payerType] : null;

  const showCheckIn = !isGroup && r.status === "CONFIRMED";
  const showConfirm = !isGroup && r.status === "ENQUIRY";

  function handleClick() {
    if (isGroup) navigate(`/groups/${r.groupId}`);
    else onOpen(r.id);
  }

  return (
    <div
      onClick={handleClick}
      className={cn(
        "group grid grid-cols-2 md:grid-cols-[1.4fr_1.2fr_0.9fr_1.2fr_0.45fr_1fr_100px] gap-3 px-5 py-3.5 items-center cursor-pointer transition-all border-b border-line-soft last:border-0",
        // Group rows: inset box-shadow left stripe + a more vibrant dusk hover tint
        // so the different-destination click is viscerally obvious before the click lands.
        isGroup
          ? "shadow-[inset_3px_0_0_#5B4B82] hover:bg-[#EDE9F4]"
          : "hover:bg-line-soft",
      )}
    >
      {/* GUEST */}
      <div className="flex items-center gap-3 min-w-0 col-span-2 md:col-span-1">
        <Avatar name={r.guest.fullName} size={38} />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <div className="text-[14px] font-semibold text-ink truncate">
              {r.bookingContactName ?? r.guest.fullName}
            </div>
            {r.isVip && <Star size={12} className="text-amber fill-amber shrink-0" />}
          </div>
          {r.bookingContactName && (
            <div className="text-[11px] text-ink-faint truncate">
              profile: {r.guest.fullName}
            </div>
          )}
          <div className="flex items-center gap-1.5 text-[12px] text-ink-faint tnum">
            <span>{isGroup ? (r.group?.groupRef ?? `GRP-${r.groupId!.slice(0, 8).toUpperCase()}`) : (r.confirmationNumber || "—")}</span>
            {isGroup && (
              <span className="rounded-full bg-dusk px-2 py-0.5 text-[10px] font-bold tracking-wide text-white">
                GROUP
              </span>
            )}
          </div>
        </div>
      </div>

      {/* BOOKING — group name + payer badge for groups; "Single" for individuals */}
      <div className="hidden md:flex flex-col justify-center gap-1 min-w-0">
        {isGroup ? (
          <>
            <div className="text-[13px] font-semibold text-ink truncate">{r.group?.name ?? "—"}</div>
            {payerMeta ? (
              <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-semibold w-fit", payerMeta.bg, payerMeta.text)}>
                {payerMeta.label}
              </span>
            ) : null}
          </>
        ) : (
          <div className="flex flex-col gap-1">
            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold bg-line-soft text-ink-soft w-fit">
              Single
            </span>
            {r.source === "BOOKING_ENGINE" && (
              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold bg-emerald-soft text-emerald tracking-wide w-fit">
                Online Request
              </span>
            )}
          </div>
        )}
      </div>

      {/* ROOM */}
      <div className="hidden md:block min-w-0">
        <div className={cn("text-[13.5px] font-semibold truncate", isGroup ? "text-dusk" : "text-ink")}>{roomStr}</div>
        {!isGroup && r.rooms[0]?.roomType && (
          <div className="text-[11.5px] text-ink-faint truncate">{r.rooms[0].roomType.name}</div>
        )}
      </div>

      {/* DATES */}
      <div className="text-[13px] text-ink-soft tnum hidden md:block">
        <span>{fmtDate(r.checkInDate)}</span>
        <span className="mx-1.5 text-ink-faint">→</span>
        <span>{fmtDate(r.checkOutDate)}</span>
      </div>

      {/* NIGHTS */}
      <div className="text-[13.5px] font-semibold text-ink tnum hidden md:block">{nights}n</div>

      {/* STATUS */}
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

      {/* Navigation hint — ↗ for group (full page), › for single (drawer) */}
      <div className="flex items-center justify-end gap-1">
        {isGroup ? (
          <>
            <span className="text-[11px] font-semibold text-dusk/60 group-hover:text-dusk hidden md:block transition-colors">
              Group page
            </span>
            <ExternalLink size={13} className="text-dusk/50 group-hover:text-dusk hidden md:block transition-colors" />
          </>
        ) : (
          <ArrowRight size={18} className="text-ink-faint group-hover:text-ink-mute hidden md:block" />
        )}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ReservationsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { has } = usePermissions();
  const canCreate = has("reservations:create");
  const canCreateGroups = has("groups:create");
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
  const [showChooser, setShowChooser]   = useState(() => searchParams.get("new") === "1");
  const [showNew, setShowNew]           = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [newCheckIn,  setNewCheckIn]    = useState<string | undefined>(undefined);
  const [newCheckOut, setNewCheckOut]   = useState<string | undefined>(undefined);
  const [selectionStart, setSelectionStart] = useState<Date | null>(null);
  const [selectionEnd,   setSelectionEnd]   = useState<Date | null>(null);
  const [hoverDate,      setHoverDate]      = useState<Date | null>(null);
  const [openDrawerId, setOpenDrawerId] = useState<string | null>(null);
  const [calYear, setCalYear]       = useState(new Date().getFullYear());
  const [calMonth, setCalMonth]     = useState(new Date().getMonth() + 1);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { toasts, addToast, removeToast } = useToast();
  useRealtimeSync(() => addToast("New booking request received — check Reservations"));

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
    // SSE (useRealtimeSync) pushes instant invalidation on real changes —
    // this interval is just a fallback in case the connection drops.
    refetchInterval: 60_000,
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

  function handleTypeSelected(type: NewReservationType) {
    setShowChooser(false);
    if (type === "SINGLE") setShowNew(true);
    else setShowNewGroup(true);
  }

  function handleRangeSelected(checkIn: Date, checkOut: Date) {
    clearSelection();
    if (!canCreate) return;
    setNewCheckIn(toLocalIsoDate(checkIn));
    setNewCheckOut(toLocalIsoDate(checkOut));
    // Open the type chooser so calendar drag also asks single vs group
    setShowChooser(true);
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
            {meta ? `${reservations.length.toLocaleString()} booking${reservations.length !== 1 ? "s" : ""}` : "—"}
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
              onClick={() => { setNewCheckIn(undefined); setNewCheckOut(undefined); setShowChooser(true); }}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-full bg-coral text-white text-sm font-semibold hover:bg-coral-dark transition-colors shadow-pop whitespace-nowrap"
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
          <div className="flex items-center justify-between px-6 py-5 border-b border-line-soft">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-ink-faint mb-1">Room Timeline</p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleMonthChange(calYear, calMonth - 1)}
                  className="grid place-items-center h-7 w-7 rounded-full hover:bg-line-soft text-ink-mute transition-colors"
                >
                  <ChevronLeft size={15} />
                </button>
                <h3 className="serif text-[32px] leading-none text-ink">
                  {monthName}
                  <span className="text-ink-mute ml-2.5 text-[24px]">{calYear}</span>
                </h3>
                <button
                  onClick={() => handleMonthChange(calYear, calMonth + 1)}
                  className="grid place-items-center h-7 w-7 rounded-full hover:bg-line-soft text-ink-mute transition-colors"
                >
                  <ChevronRight size={15} />
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
                // Each status gets its own semantic colour when active — immediately readable without labels
                const activeStyle: React.CSSProperties =
                  tab.key === "ENQUIRY"     ? { background: "#b97c1e", color: "#fff" }
                  : tab.key === "CONFIRMED" ? { background: "#2c455c", color: "#fff" }
                  : tab.key === "CHECKED_IN"? { background: "#2F7256", color: "#fff" }
                  : tab.key === "CHECKED_OUT"? { background: "#584238", color: "#fff" }
                  : tab.key === "CANCELLED" ? { background: "#aa4432", color: "#fff" }
                  : { background: "#211e1a", color: "#fff" };
                return (
                  <button
                    key={tab.key}
                    onClick={() => { setActiveTab(tab.key); setPage(1); }}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-full px-3.5 h-9 text-[13px] font-semibold transition-all",
                      on ? "shadow-sm" : "bg-white border border-line text-ink-soft hover:border-ink/20 hover:text-ink",
                    )}
                    style={on ? activeStyle : undefined}
                  >
                    {tab.status && tone && (
                      <span
                        className="h-2 w-2 rounded-full flex-shrink-0"
                        style={{ background: on ? "rgba(255,255,255,0.5)" : tone.dot }}
                      />
                    )}
                    {tab.label}
                    {count !== undefined && count > 0 && (
                      <span className={cn(
                        "tnum text-[11px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1",
                        on ? "bg-white/20 text-white" : "bg-line-soft text-ink-mute",
                      )}>
                        {count}
                      </span>
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
          <div className="hidden md:grid grid-cols-[1.4fr_1.2fr_0.9fr_1.2fr_0.45fr_1fr_100px] gap-3 px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-ink-faint border-b border-line-soft">
            <span>Guest</span><span>Booking / Group</span><span>Room</span><span>Dates</span><span>Nights</span><span>Status</span><span />
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

      {showChooser && (
        <NewReservationTypeModal
          onClose={() => { setShowChooser(false); clearSelection(); setNewCheckIn(undefined); setNewCheckOut(undefined); }}
          onSelect={handleTypeSelected}
          canCreateGroup={canCreateGroups}
        />
      )}

      {showNew && (
        <NewReservationModal
          initialCheckInDate={newCheckIn}
          initialCheckOutDate={newCheckOut}
          onClose={() => { setShowNew(false); setNewCheckIn(undefined); setNewCheckOut(undefined); clearSelection(); }}
          onSuccess={() => {
            setShowNew(false);
            setNewCheckIn(undefined);
            setNewCheckOut(undefined);
            clearSelection();
            qc.invalidateQueries({ queryKey: ["reservations"] });
          }}
        />
      )}

      {showNewGroup && (
        <NewGroupModal
          initialCheckIn={newCheckIn}
          initialCheckOut={newCheckOut}
          onClose={() => { setShowNewGroup(false); setNewCheckIn(undefined); setNewCheckOut(undefined); clearSelection(); }}
          onSuccess={(id) => {
            setShowNewGroup(false);
            setNewCheckIn(undefined);
            setNewCheckOut(undefined);
            clearSelection();
            qc.invalidateQueries({ queryKey: ["reservations"] });
            navigate(`/groups/${id}`);
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

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
