import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Building2, Landmark, HeartHandshake, Briefcase, Users,
  CheckCircle2, X, Search, Plus, MapPin, ExternalLink, Receipt,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { getErrorMessage } from "@/lib/api";
import {
  groupsService,
  type GroupStatus,
  type PayerType,
  type PaymentTerms,
  type GroupReservation,
} from "@/services/groups";
import { guestsService, type GuestSummary } from "@/services/guests";
import { roomsService, type Room } from "@/services/rooms";
import { Card } from "@/components/ui/Card";
import { StatusBadge, TONE } from "@/components/ui/StatusBadge";
import { Avatar } from "@/components/ui/Avatar";
import { ToastContainer } from "@/components/ui/ToastContainer";
import { useToast } from "@/hooks/useToast";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { usePermissions } from "@/hooks/usePermissions";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtPkr(paisas: number): string {
  return `PKR ${Math.round(paisas / 100).toLocaleString("en-PK")}`;
}
function fmtDate(iso: string): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-PK", { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso + "T00:00:00"));
}
function nightsBetween(from: string, to: string): number {
  if (!from || !to) return 0;
  return Math.max(0, Math.ceil((new Date(to).getTime() - new Date(from).getTime()) / 86_400_000));
}

const GROUP_STATUS_LABEL: Record<GroupStatus, string> = {
  ENQUIRY:     "Pending",
  CONFIRMED:   "Confirmed",
  CHECKED_IN:  "Checked In",
  CHECKED_OUT: "Checked Out",
  CANCELLED:   "Cancelled",
};

const RES_STATUS_LABEL: Record<string, string> = {
  ENQUIRY: "Pending", CONFIRMED: "Confirmed", CHECKED_IN: "Checked In",
  CHECKED_OUT: "Checked Out", CANCELLED: "Cancelled", NO_SHOW: "No Show",
};

const PAYMENT_TERMS_LABEL: Record<PaymentTerms, string> = {
  CASH:           "Cash on Arrival",
  ADVANCE_50:     "50% Advance",
  ADVANCE_100:    "100% Advance",
  ADVANCE_CUSTOM: "Custom Advance",
  CREDIT_30:      "30-Day Credit",
  CREDIT_60:      "60-Day Credit",
};

const PAYER_TYPE_META: Record<PayerType, { label: string; tone: string; icon: React.ElementType }> = {
  TOUR_AGENCY: { label: "Tour Agency", tone: "slate", icon: Briefcase },
  CORPORATE:   { label: "Corporate",   tone: "dusk",  icon: Building2 },
  GOVERNMENT:  { label: "Govt",        tone: "ink",   icon: Landmark },
  NGO:         { label: "NGO",         tone: "pine",  icon: HeartHandshake },
  INDIVIDUAL:  { label: "Individual / Family", tone: "amber", icon: Users },
};

function PayerTypeBadge({ type }: { type: PayerType }) {
  const meta = PAYER_TYPE_META[type] ?? PAYER_TYPE_META.INDIVIDUAL;
  const tone = TONE[meta.tone] ?? TONE.ink;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold"
      style={{ background: tone.bg, color: tone.fg }}
    >
      <meta.icon size={12} />
      {meta.label}
    </span>
  );
}

// ── Add Guest modal ───────────────────────────────────────────────────────────

function AddGuestModal({ groupId, existingGuestIds, onClose }: { groupId: string; existingGuestIds: string[]; onClose: () => void }) {
  useEscapeKey(onClose);
  const qc = useQueryClient();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setSearch(searchInput.trim()), 350);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [searchInput]);

  const { data, isFetching } = useQuery({
    queryKey: ["guests-add-member", search],
    queryFn: () => guestsService.getGuests({ limit: 20, search: search || undefined }),
    enabled: search.length > 0,
  });
  const results: GuestSummary[] = (data?.data ?? []).filter((g) => !existingGuestIds.includes(g.id));

  const addMutation = useMutation({
    mutationFn: (guestId: string) => groupsService.addMember(groupId, { guestId, isLeader: false }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["group", groupId] });
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 bg-ink/35 backdrop-blur-[3px] z-50 grid place-items-center p-4 anim-fade-in" onMouseDown={onClose}>
      <div className="w-full max-w-md bg-card rounded-[1.75rem] shadow-float p-6 anim-scale-in" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="serif text-[20px] text-ink">Add guest to group</h3>
          <button onClick={onClose} className="grid place-items-center h-8 w-8 rounded-full hover:bg-line-soft text-ink-mute transition-colors"><X size={16} /></button>
        </div>
        <div className="relative mb-3">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint pointer-events-none" />
          <input
            type="text" autoFocus value={searchInput} onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by name or phone…"
            className="w-full h-10 rounded-xl border border-line bg-white pl-9 pr-3.5 text-[13.5px] text-ink placeholder:text-ink-faint focus:outline-none focus:border-coral focus:ring-2 focus:ring-coral/15 transition-all"
          />
          {isFetching && <div className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 rounded-full border-2 border-coral/30 border-t-coral animate-spin" />}
        </div>
        <div className="space-y-1.5 max-h-[40vh] overflow-y-auto scroll-area">
          {!search ? (
            <p className="py-6 text-center text-[13px] text-ink-mute">Start typing to search guests</p>
          ) : results.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-ink-mute">No guests found</p>
          ) : (
            results.map((g) => (
              <button
                key={g.id}
                onClick={() => addMutation.mutate(g.id)}
                disabled={addMutation.isPending}
                className="flex items-center gap-3 w-full rounded-xl border border-line bg-white p-2.5 text-left hover:border-ink-faint transition-all disabled:opacity-50"
              >
                <Avatar name={g.fullName} size={36} />
                <div className="min-w-0 flex-1">
                  <div className="text-[13.5px] font-semibold text-ink truncate">{g.fullName}</div>
                  <div className="text-[12px] text-ink-mute truncate">{g.phone ?? "—"}</div>
                </div>
                <Plus size={15} className="text-ink-faint shrink-0" />
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ── Assign Room modal ─────────────────────────────────────────────────────────

function AssignRoomModal({
  groupId, reservationId, roomTypeId, roomTypeName, onClose,
}: { groupId: string; reservationId: string; roomTypeId: string; roomTypeName: string; onClose: () => void }) {
  useEscapeKey(onClose);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["rooms", "vacant"],
    queryFn: () => roomsService.getRooms("VACANT_CLEAN"),
  });
  const candidates: Room[] = (data?.data ?? []).filter((r) => r.roomTypeId === roomTypeId);

  const [assignError, setAssignError] = useState("");

  const assignMutation = useMutation({
    mutationFn: (roomId: string) => groupsService.assignRoom(groupId, reservationId, roomId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["group", groupId] });
      onClose();
    },
    onError: (err) => setAssignError(getErrorMessage(err)),
  });

  return (
    <div className="fixed inset-0 bg-ink/35 backdrop-blur-[3px] z-50 grid place-items-center p-4 anim-fade-in" onMouseDown={onClose}>
      <div className="w-full max-w-md bg-card rounded-[1.75rem] shadow-float p-6 anim-scale-in" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h3 className="serif text-[20px] text-ink">Assign room</h3>
          <button onClick={onClose} className="grid place-items-center h-8 w-8 rounded-full hover:bg-line-soft text-ink-mute transition-colors"><X size={16} /></button>
        </div>
        <p className="mb-4 text-[13px] text-ink-mute">Choose a vacant {roomTypeName} room for this reservation.</p>
        <div className="space-y-1.5 max-h-[40vh] overflow-y-auto scroll-area">
          {isLoading ? (
            <p className="py-6 text-center text-[13px] text-ink-mute">Loading…</p>
          ) : candidates.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-ink-mute">No vacant {roomTypeName} rooms available</p>
          ) : (
            candidates.map((room) => (
              <button
                key={room.id}
                onClick={() => { setAssignError(""); assignMutation.mutate(room.id); }}
                disabled={assignMutation.isPending}
                className="flex items-center gap-3 w-full rounded-xl border border-line bg-white p-3 text-left hover:border-ink-faint transition-all disabled:opacity-50"
              >
                <span className="grid place-items-center h-9 w-9 rounded-lg bg-mist text-ink-soft"><MapPin size={15} /></span>
                <div className="min-w-0 flex-1">
                  <div className="text-[13.5px] font-semibold text-ink">Room {room.number}</div>
                  <div className="text-[12px] text-ink-mute">{room.floor !== null ? `Floor ${room.floor}` : "—"}</div>
                </div>
              </button>
            ))
          )}
        </div>

        {assignError && (
          <p className="mt-3 text-[13px] text-clay font-medium">{assignError}</p>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function GroupDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  useRealtimeSync();
  const { has } = usePermissions();
  const canUpdate = has("groups:update");
  const { toasts, addToast, removeToast } = useToast();
  const [showAddGuest, setShowAddGuest] = useState(false);
  const [assignTarget, setAssignTarget] = useState<{ reservationId: string; roomTypeId: string; roomTypeName: string } | null>(null);

  const { data: group, isLoading } = useQuery({
    queryKey: ["group", id],
    queryFn: () => groupsService.getGroup(id!),
    enabled: !!id,
    refetchInterval: 60_000,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["group", id] });
    qc.invalidateQueries({ queryKey: ["groups"] });
    qc.invalidateQueries({ queryKey: ["groups-summary"] });
    qc.invalidateQueries({ queryKey: ["rooms"] });
  };

  const statusMutation = useMutation({
    mutationFn: (status: GroupStatus) => groupsService.updateGroupStatus(id!, status),
    onSuccess: invalidate,
  });
  const checkInMutation = useMutation({
    mutationFn: () => groupsService.checkInGroup(id!),
    onSuccess: invalidate,
  });
  const checkOutMutation = useMutation({
    mutationFn: () => groupsService.checkOutGroup(id!),
    onSuccess: invalidate,
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        "Failed to check out. Please try again.";
      addToast(msg, "error");
    },
  });

  if (isLoading || !group) {
    return (
      <div className="space-y-4 anim-fade-in">
        <div className="h-8 w-48 bg-line-soft rounded animate-pulse" />
        <div className="h-12 w-96 bg-line-soft rounded animate-pulse" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 h-64 bg-line-soft rounded-2xl animate-pulse" />
          <div className="h-64 bg-line-soft rounded-2xl animate-pulse" />
        </div>
      </div>
    );
  }

  const nights = nightsBetween(group.checkInDate, group.checkOutDate);
  const isMutating = statusMutation.isPending || checkInMutation.isPending || checkOutMutation.isPending;

  const roomTypeLines = Object.values(
    group.reservations.reduce<Record<string, { name: string; rooms: number; amount: number }>>((acc, r) => {
      if (!r.room) return acc;
      const key = r.room.roomType.id;
      acc[key] ??= { name: r.room.roomType.name, rooms: 0, amount: 0 };
      acc[key].rooms += 1;
      acc[key].amount += r.totalAmount;
      return acc;
    }, {})
  );
  const rateSubtotal = roomTypeLines.reduce((sum, l) => sum + l.amount, 0);
  const rateTax = Math.round(rateSubtotal * 0.05);

  return (
    <div className="anim-fade-in">
      <button
        onClick={() => navigate("/reservations")}
        className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink-mute hover:text-ink transition-colors"
      >
        <ArrowLeft size={15} /> Back to Reservations
      </button>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <span className="font-mono text-[14px] font-bold tracking-wide text-ink-mute">{group.groupRef ?? "—"}</span>
          <StatusBadge status={GROUP_STATUS_LABEL[group.status]} />
        </div>
        <h1 className="serif text-[34px] leading-tight text-ink">{group.name}</h1>
        <div className="mt-2.5 flex items-center gap-2.5 flex-wrap">
          <PayerTypeBadge type={group.payerType} />
          <span className="text-[14.5px] font-semibold text-ink-soft">{group.payerName}</span>
          {group.payerContact && <span className="text-[13px] text-ink-mute">· {group.payerContact}</span>}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* LEFT */}
        <div className="lg:col-span-2 space-y-5">
          {/* Rooms & Reservations */}
          <Card pad={false} className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-line-soft">
              <h3 className="serif text-[18px] text-ink">Rooms ({group.summary.totalRooms} total)</h3>
              <div className="flex items-center gap-2">
                {canUpdate && group.status === "CONFIRMED" && (
                  <button
                    onClick={() => checkInMutation.mutate()}
                    disabled={isMutating}
                    className="h-9 px-4 rounded-full bg-pine text-white text-[13px] font-semibold hover:bg-pine-deep transition-colors disabled:opacity-50"
                  >
                    Check In All
                  </button>
                )}
                {canUpdate && group.status === "CHECKED_IN" && (
                  <button
                    onClick={() => checkOutMutation.mutate()}
                    disabled={isMutating}
                    className="h-9 px-4 rounded-full bg-coral text-white text-[13px] font-semibold hover:bg-coral-dark transition-colors disabled:opacity-50"
                  >
                    Check Out Group
                  </button>
                )}
              </div>
            </div>

            {/* SPLIT billing prompt — surfaces remaining unsettled rooms so staff don't have
                to hunt for the next folio after checking out the first room */}
            {group.billingType === "SPLIT" && group.reservations.some(r => r.status === "CHECKED_IN" && r.folio && r.folio.balanceDue > 0) && (
              <div className="mx-5 my-3 rounded-xl border border-amber/30 bg-amber-soft px-4 py-3 flex items-start gap-2.5">
                <Receipt size={15} className="text-amber shrink-0 mt-0.5" />
                <p className="text-[12.5px] text-ink-soft leading-snug">
                  <strong>Split billing</strong> — settle each room's folio individually using the <em>Settle folio</em> button next to each checked-in room.
                </p>
              </div>
            )}

            <div className="hidden md:grid grid-cols-[1.4fr_1.4fr_1fr_auto] gap-3 px-5 py-2.5 text-[11px] font-bold uppercase tracking-wider text-ink-faint border-b border-line-soft">
              <span>Room</span><span>Guest</span><span>Status</span><span />
            </div>

            {group.reservations.length === 0 ? (
              <div className="px-5 py-8 text-center text-[13px] text-ink-mute">No reservations in this group yet.</div>
            ) : (
              group.reservations.map((r: GroupReservation) => (
                <div
                  key={r.id}
                  className="grid grid-cols-2 md:grid-cols-[1.4fr_1.4fr_1fr_auto] gap-3 px-5 py-3.5 items-center border-b border-line-soft last:border-0"
                >
                  <div className="text-[13.5px] font-semibold text-ink">
                    {r.room ? (
                      r.room.pending ? (
                        canUpdate ? (
                          <button
                            onClick={() => setAssignTarget({ reservationId: r.id, roomTypeId: r.room!.roomType.id, roomTypeName: r.room!.roomType.name })}
                            className="inline-flex items-center gap-1.5 text-amber hover:underline"
                          >
                            TBD <span className="text-[12px] font-semibold underline">Assign Room</span>
                          </button>
                        ) : (
                          <span className="text-amber">TBD</span>
                        )
                      ) : (
                        <span>{r.room.number} <span className="text-ink-mute font-medium">· {r.room.roomType.name}</span></span>
                      )
                    ) : "—"}
                  </div>
                  <div className="text-[13.5px] text-ink-soft truncate">{r.guest?.fullName ?? "—"}</div>
                  <div><StatusBadge status={RES_STATUS_LABEL[r.status] ?? r.status} size="sm" /></div>
                  <div className="flex items-center justify-end gap-2">
                    {/* For SPLIT billing: surface the folio link directly on the room row so
                        staff don't have to navigate through the reservation detail to settle */}
                    {group.billingType === "SPLIT" && r.status === "CHECKED_IN" && r.folio && (
                      <Link
                        to={`/financials/folio/${r.id}`}
                        className="inline-flex items-center gap-1 rounded-full h-8 px-3 text-[12px] font-semibold bg-coral text-white hover:bg-coral-dark transition-all whitespace-nowrap shadow-sm"
                      >
                        <Receipt size={12} />
                        {r.folio.balanceDue > 0 ? "Settle folio" : "Check out"}
                      </Link>
                    )}
                    <Link
                      to={`/reservations/${r.id}`}
                      className="inline-flex items-center gap-1 rounded-full h-8 px-3 text-[12px] font-semibold bg-line-soft text-ink-mute hover:text-ink-soft transition-all whitespace-nowrap"
                    >
                      View Reservation <ExternalLink size={12} />
                    </Link>
                  </div>
                </div>
              ))
            )}
          </Card>

          {/* Members */}
          <Card pad={false} className="overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-line-soft">
              <h3 className="serif text-[18px] text-ink">Guests ({group.members.length} members)</h3>
              {canUpdate && (
                <button
                  onClick={() => setShowAddGuest(true)}
                  className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full bg-line-soft text-ink-soft text-[13px] font-semibold hover:bg-line transition-colors"
                >
                  <Plus size={14} /> Add Guest
                </button>
              )}
            </div>
            {group.members.length === 0 ? (
              <div className="px-5 py-8 text-center text-[13px] text-ink-mute">No guests added yet.</div>
            ) : (
              <div className="divide-y divide-line-soft">
                {group.members.map((m) => (
                  <div key={m.id} className="flex items-center gap-3 px-5 py-3">
                    <Avatar name={m.guest.fullName} size={36} />
                    <span className="text-[13.5px] font-semibold text-ink">{m.guest.fullName}</span>
                    {m.isLeader && (
                      <span className="rounded-full bg-coral-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-coral-deep">Leader</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* RIGHT */}
        <div className="space-y-5">
          {/* Action panel */}
          {canUpdate && (
            <Card className="space-y-2.5">
              {group.status === "ENQUIRY" && (
                <button
                  onClick={() => statusMutation.mutate("CONFIRMED")}
                  disabled={isMutating}
                  className="w-full h-11 rounded-full bg-slate text-white text-[14px] font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 inline-flex items-center justify-center gap-2"
                >
                  <CheckCircle2 size={16} /> Confirm Booking
                </button>
              )}
              {group.status === "CONFIRMED" && (
                <button
                  onClick={() => checkInMutation.mutate()}
                  disabled={isMutating}
                  className="w-full h-11 rounded-full bg-pine text-white text-[14px] font-semibold hover:bg-pine-deep transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-2"
                >
                  <CheckCircle2 size={16} /> Check In Group
                </button>
              )}
              {group.status === "CHECKED_IN" && (
                <button
                  onClick={() => checkOutMutation.mutate()}
                  disabled={isMutating}
                  className="w-full h-11 rounded-full bg-coral text-white text-[14px] font-semibold hover:bg-coral-dark transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-2"
                >
                  <CheckCircle2 size={16} /> Check Out Group
                </button>
              )}
              {(group.status === "ENQUIRY" || group.status === "CONFIRMED") && (
                <button
                  onClick={() => statusMutation.mutate("CANCELLED")}
                  disabled={isMutating}
                  className="w-full h-11 rounded-full border border-clay text-clay text-[14px] font-semibold hover:bg-clay-soft transition-colors disabled:opacity-50"
                >
                  Cancel Booking
                </button>
              )}
              {(group.status === "CHECKED_OUT" || group.status === "CANCELLED") && (
                <p className="text-center text-[13px] text-ink-mute py-1">
                  This group is {GROUP_STATUS_LABEL[group.status].toLowerCase()}.
                </p>
              )}
            </Card>
          )}

          {/* Group summary */}
          <Card>
            <h3 className="mb-3.5 text-[12px] font-bold uppercase tracking-wider text-ink-faint">Group Summary</h3>
            <div className="flex items-center justify-between text-[14px]">
              <span className="font-semibold text-ink">{fmtDate(group.checkInDate)}</span>
              <span className="text-ink-faint">→</span>
              <span className="font-semibold text-ink">{fmtDate(group.checkOutDate)}</span>
            </div>
            <div className="mt-3.5 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-mist border border-line p-3 text-center">
                <div className="text-[11px] font-bold uppercase text-ink-faint tracking-wider">Nights</div>
                <div className="serif text-[20px] text-ink mt-0.5 tnum">{nights}</div>
              </div>
              <div className="rounded-xl bg-mist border border-line p-3 text-center">
                <div className="text-[11px] font-bold uppercase text-ink-faint tracking-wider">Total Rooms</div>
                <div className="serif text-[20px] text-ink mt-0.5 tnum">{group.summary.totalRooms}</div>
              </div>
            </div>
            <div className="mt-3.5 space-y-2.5">
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-ink-mute">Billing</span>
                <span className="font-semibold text-ink">{group.billingType === "SINGLE" ? "Single Bill" : "Split by Room"}</span>
              </div>
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-ink-mute">Payment Terms</span>
                <StatusBadge status={PAYMENT_TERMS_LABEL[group.paymentTerms]} dot={false} size="sm" />
              </div>
              {group.advancePaid > 0 && (
                <div className="flex items-center justify-between text-[13px]">
                  <span className="text-ink-mute">Advance Paid</span>
                  <span className="font-semibold text-pine-deep">{fmtPkr(group.advancePaid)}</span>
                </div>
              )}
            </div>
          </Card>

          {/* Rate summary — one line per room type so mixed-room-type group bookings aren't priced as if every room shared one rate */}
          {roomTypeLines.length > 0 && (
            <Card>
              <h3 className="mb-3.5 text-[12px] font-bold uppercase tracking-wider text-ink-faint">Rate Summary</h3>
              <div className="space-y-2">
                {roomTypeLines.map((line) => (
                  <div key={line.name} className="flex items-center justify-between text-[13px]">
                    <span className="text-ink-mute">
                      {line.name} — {fmtPkr(nights > 0 ? line.amount / line.rooms / nights : 0)}/night × {line.rooms} room{line.rooms !== 1 ? "s" : ""} × {nights} night{nights !== 1 ? "s" : ""}
                    </span>
                    <span className="font-semibold text-ink tnum">{fmtPkr(line.amount)}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between text-[13px] pt-2 border-t border-line-soft">
                  <span className="text-ink-mute">Service tax (5%)</span>
                  <span className="font-semibold text-ink tnum">{fmtPkr(rateTax)}</span>
                </div>
                <div className="flex items-center justify-between text-[13px] pt-2 border-t border-line-soft">
                  <span className="font-semibold text-ink-soft">Total</span>
                  <span className="font-bold text-ink tnum">{fmtPkr(rateSubtotal + rateTax)}</span>
                </div>
              </div>
            </Card>
          )}

          {/* Financial summary */}
          <Card>
            <h3 className="mb-3.5 text-[12px] font-bold uppercase tracking-wider text-ink-faint">Financial Summary</h3>
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-ink-mute">Total Charged</span>
                <span className="font-semibold text-ink tnum">{fmtPkr(group.summary.totalCharged)}</span>
              </div>
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-ink-mute">Total Paid</span>
                <span className="font-semibold text-ink tnum">{fmtPkr(group.summary.totalPaid)}</span>
              </div>
              <div className="flex items-center justify-between text-[13px] pt-2.5 border-t border-line-soft">
                <span className="font-semibold text-ink-soft">Balance Due</span>
                <span className={cn("font-bold tnum", group.summary.totalBalance > 0 ? "text-clay" : "text-ink")}>
                  {fmtPkr(group.summary.totalBalance)}
                </span>
              </div>
            </div>
            <Link
              to="/financials"
              className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-semibold text-coral hover:text-coral-dark transition-colors"
            >
              View All Folios <ExternalLink size={13} />
            </Link>
          </Card>
        </div>
      </div>

      {showAddGuest && (
        <AddGuestModal
          groupId={group.id}
          existingGuestIds={group.members.map((m) => m.guest.id)}
          onClose={() => setShowAddGuest(false)}
        />
      )}
      {assignTarget && (
        <AssignRoomModal
          groupId={group.id}
          reservationId={assignTarget.reservationId}
          roomTypeId={assignTarget.roomTypeId}
          roomTypeName={assignTarget.roomTypeName}
          onClose={() => setAssignTarget(null)}
        />
      )}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
