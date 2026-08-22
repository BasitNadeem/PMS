import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  ArrowLeft, Copy, Phone, Mail, BadgeCheck,
  LogIn, LogOut, Check, Receipt, BedDouble, Users, Tag, Pencil,
  Building2, CreditCard, Gift, History, BadgePercent, Banknote,
  CarFront, ClipboardList, Globe2, AlertTriangle,
  UserX, X,
  ArrowRightLeft,
  RotateCcw,
  IdCard, ShieldAlert,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { getErrorDetails } from "@/lib/api";
import { todayInHotelTime } from "@/lib/hotelTime";
import {
  reservationsService,
  type ReservationDetail,
  type ReservationStatus,
} from "@/services/reservations";
import { CheckOutModal } from "@/components/reservations/CheckOutModal";
import { EditReservationModal } from "@/components/reservations/EditReservationModal";
import { ManageStayModal } from "@/components/reservations/ManageStayModal";
import { CaptureIdModal } from "@/components/reservations/CaptureIdModal";
import { GuestIdDocuments } from "@/components/guests/GuestIdDocuments";
import { guestDocumentsService } from "@/services/guestDocuments";
import { ToastContainer } from "@/components/ui/ToastContainer";
import { useToast } from "@/hooks/useToast";
import { Card } from "@/components/ui/Card";
import { StatusBadge, toneOf } from "@/components/ui/StatusBadge";
import { Avatar } from "@/components/ui/Avatar";
import { usePermissions } from "@/hooks/usePermissions";

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<ReservationStatus, string> = {
  ENQUIRY: "Pending", CONFIRMED: "Confirmed", CHECKED_IN: "Checked In",
  CHECKED_OUT: "Checked Out", CANCELLED: "Cancelled",
  NO_SHOW: "No Show", WAITLISTED: "Waitlisted",
};

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-PK", { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));
}
function fmtDateLong(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-PK", { dateStyle: "long" }).format(new Date(iso));
}
function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-PK", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
}
function fmtPkr(paise: number): string {
  return `PKR ${(paise / 100).toLocaleString("en-PK")}`;
}
function sourceLabel(source: string, otaSource?: string | null): string {
  if (source === "BOOKING_ENGINE") return "Booking Engine";
  const labels: Record<string, string> = {
    BOOKING_COM: "Booking.com", AGODA: "Agoda", EXPEDIA: "Expedia", AIRBNB: "Airbnb",
    BOOKME_PK: "Bookme.pk", SASTATICKET_PK: "Sastaticket.pk", OTA_OTHER: "Other OTA",
  };
  if (otaSource) return `${labels[source] ?? source.replace(/_/g, " ")} · ${otaSource}`;
  if (labels[source]) return labels[source];
  return source.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}
function nightsBetween(a: string, b: string): number {
  return Math.ceil((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000);
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-ink-faint">{children}</div>;
}
function ContactRow({ icon: Icon, value }: { icon: React.ElementType; value: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Icon size={16} className="text-ink-faint shrink-0" />
      <span className="text-[13.5px] text-ink-soft tnum">{value ?? "—"}</span>
    </div>
  );
}
function InfoTile({ icon: Icon, label, value, sub }: { icon: React.ElementType; label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl2 border border-line bg-card p-3.5">
      <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-ink-faint mb-1.5">
        <Icon size={13} />{label}
      </div>
      <div className="text-[14px] font-semibold text-ink">{value}</div>
      {sub && <div className="text-[12px] text-ink-mute">{sub}</div>}
    </div>
  );
}

// ── Timeline ──────────────────────────────────────────────────────────────────

function Timeline({ reservation }: { reservation: ReservationDetail }) {
  const steps: { label: string; time: string | null; done: boolean; tone: string }[] = [
    { label: "Created",    time: reservation.createdAt,  done: true,                                  tone: "ink" },
    { label: "Confirmed",  time: null,                   done: !["ENQUIRY","WAITLISTED","CANCELLED"].includes(reservation.status), tone: "slate" },
    { label: "Checked In", time: reservation.actualCheckIn,  done: !!reservation.actualCheckIn,       tone: "pine" },
    { label: "Checked Out",time: reservation.actualCheckOut, done: !!reservation.actualCheckOut,      tone: "coral" },
  ];
  if (reservation.status === "CANCELLED") {
    return (
      <div className="space-y-3">
        <div className="flex items-start gap-3">
          <div className="h-2.5 w-2.5 rounded-full bg-ink-mute mt-1 shrink-0" />
          <div><p className="text-[13px] font-semibold text-ink">Created</p><p className="text-[12px] text-ink-faint">{fmtDateTime(reservation.createdAt)}</p></div>
        </div>
        <div className="flex items-start gap-3">
          <div className="h-2.5 w-2.5 rounded-full bg-clay mt-1 shrink-0" />
          <div><p className="text-[13px] font-semibold text-clay">Cancelled</p><p className="text-[12px] text-ink-faint">{fmtDateTime(reservation.cancelledAt)}</p></div>
        </div>
      </div>
    );
  }
  if (reservation.status === "NO_SHOW") {
    const noShowActivity = reservation.activity.find((entry) =>
      entry.action.toLowerCase().includes("no_show"),
    );
    return (
      <div className="space-y-3">
        <div className="flex items-start gap-3">
          <div className="h-2.5 w-2.5 rounded-full bg-ink-mute mt-1 shrink-0" />
          <div><p className="text-[13px] font-semibold text-ink">Created</p><p className="text-[12px] text-ink-faint">{fmtDateTime(reservation.createdAt)}</p></div>
        </div>
        <div className="flex items-start gap-3">
          <div className="h-2.5 w-2.5 rounded-full bg-clay mt-1 shrink-0" />
          <div><p className="text-[13px] font-semibold text-clay">Marked No Show</p><p className="text-[12px] text-ink-faint">{fmtDateTime(noShowActivity?.createdAt)}</p></div>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {steps.map((s, i) => {
        const t = toneOf(s.tone === "pine" ? "Checked In" : s.tone === "coral" ? "Occupied" : s.tone === "slate" ? "Confirmed" : "Checked Out");
        return (
          <div key={i} className="flex items-start gap-3">
            <div className={cn("h-2.5 w-2.5 rounded-full mt-1 shrink-0", s.done ? "" : "bg-line")} style={s.done ? { background: t.dot } : {}} />
            <div>
              <p className={cn("text-[13px] font-semibold", s.done ? "text-ink" : "text-ink-faint")}>{s.label}</p>
              {s.time && <p className="text-[12px] text-ink-faint">{fmtDateTime(s.time)}</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ReservationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { toasts, addToast, removeToast } = useToast();
  const { has } = usePermissions();
  const canUpdate = has("reservations:update");
  const canReadGuests = has("guests:read");
  const canReadBilling = has("billing:read");
  const canUpdateBilling = has("billing:update");
  const canReadCompanies = has("companies:read");
  const canReadGroups = has("groups:read");
  const canReverseLifecycle = has("RESERVATION_REVERSE");
  // Same key the API gates the override on — reservations:cancel is OWNER and
  // MANAGER only, unlike RESERVATION_CANCEL which the front desk also holds.
  const canOverrideId = has("reservations:cancel");
  const [showCheckOut, setShowCheckOut] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showNoShow, setShowNoShow] = useState(false);
  const [showManageStay, setShowManageStay] = useState(false);
  const [showCaptureId, setShowCaptureId] = useState(false);
  // Most stays are booked by phone, mail or an agent, so check-in is the first
  // moment an ID can be asked for. When the gate refuses, a toast is the wrong
  // surface — it vanishes while the guest is still standing there and offers no
  // way forward. This panel keeps both routes out in view instead.
  const [idBlocked,      setIdBlocked]      = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const [noShowReason, setNoShowReason] = useState("");
  const [reversalAction, setReversalAction] = useState<"CHECK_IN" | "CHECK_OUT" | null>(null);
  const [reversalReason, setReversalReason] = useState("");

  const { data: idDocuments = [] } = useQuery({
    queryKey: ["reservation-documents", id],
    queryFn:  () => guestDocumentsService.list(id!),
    enabled:  Boolean(id),
  });

  const { data: reservation, isLoading } = useQuery({
    queryKey: ["reservation", id],
    queryFn: () => reservationsService.getReservation(id!),
    enabled: !!id,
  });

  const statusMutation = useMutation({
    mutationFn: ({ status, reason }: { status: ReservationStatus; reason?: string }) =>
      reservationsService.updateReservationStatus(id!, status, reason),
    onSuccess: (_res, { status }) => {
      qc.invalidateQueries({ queryKey: ["reservation", id] });
      qc.invalidateQueries({ queryKey: ["reservations"] });
      qc.invalidateQueries({ queryKey: ["reservations-counts"] });
      qc.invalidateQueries({ queryKey: ["rooms"] });
      const labels: Partial<Record<ReservationStatus, string>> = {
        CONFIRMED: "Reservation confirmed", CHECKED_IN: "Guest checked in",
        CHECKED_OUT: "Guest checked out", CANCELLED: "Reservation cancelled", NO_SHOW: "Reservation marked as no-show",
      };
      if (status === "NO_SHOW") {
        setShowNoShow(false);
        setNoShowReason("");
      }
      setIdBlocked(false);
      setOverrideReason("");
      addToast(labels[status] ?? "Status updated");
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        "Failed to update status";
      const code = (getErrorDetails(err) as { code?: string } | undefined)?.code;
      if (code === "ID_REQUIRED") {
        setIdBlocked(true);
        return;
      }
      addToast(msg, "error");
    },
  });

  const reversalMutation = useMutation({
    mutationFn: ({ action, reason }: { action: "CHECK_IN" | "CHECK_OUT"; reason: string }) =>
      reservationsService.reverseLifecycle(id!, action, reason),
    onSuccess: (_result, { action }) => {
      qc.invalidateQueries({ queryKey: ["reservation", id] });
      qc.invalidateQueries({ queryKey: ["reservations"] });
      qc.invalidateQueries({ queryKey: ["reservations-counts"] });
      qc.invalidateQueries({ queryKey: ["rooms"] });
      qc.invalidateQueries({ queryKey: ["billing-folios"] });
      qc.invalidateQueries({ queryKey: ["housekeeping-tasks"] });
      setReversalAction(null);
      setReversalReason("");
      addToast(action === "CHECK_IN" ? "Check-in reversed" : "Checkout reversed");
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
        ?? "The lifecycle action could not be reversed";
      addToast(msg, "error");
    },
  });

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-5">
        <div className="h-6 w-32 bg-line-soft rounded" />
        <div className="h-20 bg-line-soft rounded-xl2" />
        <div className="grid grid-cols-3 gap-5">
          <div className="col-span-2 space-y-4">
            <div className="h-40 bg-line-soft rounded-xl2" />
            <div className="h-32 bg-line-soft rounded-xl2" />
          </div>
          <div className="h-56 bg-line-soft rounded-xl2" />
        </div>
      </div>
    );
  }

  if (!reservation) {
    return <div className="py-10 text-center text-ink-mute">Reservation not found.</div>;
  }

  const nights      = nightsBetween(reservation.checkInDate, reservation.checkOutDate);
  const room        = reservation.rooms[0] ?? null;
  const statusLabel = STATUS_LABEL[reservation.status] ?? reservation.status;

  const nextStatus: ReservationStatus | null =
    reservation.status === "ENQUIRY"   ? "CONFIRMED"   :
    reservation.status === "CONFIRMED" ? "CHECKED_IN"  :
    reservation.status === "CHECKED_IN"? "CHECKED_OUT" : null;

  const nextLabel =
    nextStatus === "CONFIRMED"   ? "Confirm reservation" :
    nextStatus === "CHECKED_IN"  ? "Check in guest" :
    nextStatus === "CHECKED_OUT" ? "Check out" : null;

  const NextIcon = nextStatus === "CHECKED_IN" ? LogIn : nextStatus === "CHECKED_OUT" ? LogOut : Check;
  const canCancel = canUpdate && (reservation.status === "ENQUIRY" || reservation.status === "CONFIRMED");
  const canEdit = canUpdate
    && (reservation.status !== "CHECKED_IN" || canUpdateBilling)
    && !["CHECKED_OUT", "CANCELLED", "NO_SHOW"].includes(reservation.status);
  const arrivalDate = reservation.checkInDate.slice(0, 10);
  const canMarkNoShow = canUpdate && reservation.status === "CONFIRMED" && arrivalDate <= todayInHotelTime();
  const hasIdOnFile = idDocuments.length > 0;

  return (
    <div>
      {/* Back */}
      <button
        onClick={() => navigate("/reservations")}
        className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink-mute hover:text-ink transition-colors mb-6"
      >
        <ArrowLeft size={15} />
        All Reservations
      </button>

      {/* Guest header */}
      <div className="flex items-start gap-4 mb-6">
        <Avatar name={reservation.guest.fullName} size={56} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            {canReadGuests ? (
              <Link to={`/guests/${reservation.guest.id}`} className="serif text-[34px] leading-tight text-ink hover:text-coral transition-colors">
                {reservation.guest.fullName}
              </Link>
            ) : (
              <h1 className="serif text-[34px] leading-tight text-ink">{reservation.guest.fullName}</h1>
            )}
            <StatusBadge status={statusLabel} />
            {reservation.groupId && canReadGroups && (
              <Link
                to={`/groups/${reservation.groupId}`}
                className="rounded-full bg-dusk-soft px-2.5 py-1 text-[11px] font-bold tracking-wide text-dusk hover:bg-dusk/20 transition-colors"
              >
                GROUP BOOKING
              </Link>
            )}
          </div>
          <div className="mt-1 flex items-center gap-2 text-[13px] text-ink-mute">
            <span className="font-semibold text-ink-mute">Res ID</span>
            <span className="tnum font-bold text-coral">{reservation.confirmationNumber || "—"}</span>
            {reservation.confirmationNumber && (
              <button
                onClick={() => navigator.clipboard?.writeText(reservation.confirmationNumber)}
                className="text-ink-faint hover:text-coral transition-colors"
              >
                <Copy size={13} />
              </button>
            )}
            <span className="h-1 w-1 rounded-full bg-ink-faint" />
            <span>Created {fmtDate(reservation.createdAt)}</span>
          </div>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* ── Left: detail panels ── */}
        <div className="lg:col-span-2 space-y-5">
          {/* Stay summary */}
          <Card>
            <div className="rounded-xl2 border border-line bg-mist p-4 mb-5">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-[11px] font-bold uppercase text-ink-faint">Check-in</div>
                  <div className="serif text-[20px] text-ink mt-0.5">{fmtDate(reservation.checkInDate)}</div>
                  <div className="text-[11px] text-ink-mute">Scheduled arrival</div>
                  {reservation.actualCheckIn && <div className="mt-1 text-[10.5px] font-semibold text-pine">Actual · {fmtDateTime(reservation.actualCheckIn)}</div>}
                </div>
                <div className="border-x border-line-soft">
                  <div className="text-[11px] font-bold uppercase text-ink-faint">Nights</div>
                  <div className="serif text-[32px] text-coral leading-none mt-0.5 tnum">{nights}</div>
                </div>
                <div>
                  <div className="text-[11px] font-bold uppercase text-ink-faint">Check-out</div>
                  <div className="serif text-[20px] text-ink mt-0.5">{fmtDate(reservation.checkOutDate)}</div>
                  <div className="text-[11px] text-ink-mute">Scheduled departure</div>
                  {reservation.actualCheckOut && <div className="mt-1 text-[10.5px] font-semibold text-pine">Actual · {fmtDateTime(reservation.actualCheckOut)}</div>}
                </div>
              </div>
            </div>
            {/* Info tiles */}
            <div className="grid grid-cols-2 gap-3">
              {room && (
                <InfoTile
                  icon={BedDouble} label="Room"
                  value={`Room ${room.room.number} · ${room.roomType.name}`}
                  sub={`Floor ${room.room.floor ?? "—"} · ${fmtPkr(room.ratePerNight)}/night`}
                />
              )}
              <InfoTile
                icon={Users} label="Occupancy"
                value={`${reservation.adults} adult${reservation.adults !== 1 ? "s" : ""}`}
                sub={reservation.children > 0 ? `${reservation.children} children` : "No children"}
              />
            </div>
          </Card>

          {/* Guest contact */}
          <Card>
            <SectionLabel>Guest</SectionLabel>
            <div className="rounded-xl2 border border-line bg-card divide-y divide-line-soft">
              {reservation.guest.phone && <ContactRow icon={Phone} value={reservation.guest.phone} />}
              {reservation.guest.email && <ContactRow icon={Mail} value={reservation.guest.email} />}
              {reservation.guest.documentNumber && (
                <ContactRow icon={BadgeCheck} value={`${reservation.guest.documentType} · ${reservation.guest.documentNumber}`} />
              )}
            </div>
            {canReadGuests && (
              <Link
                to={`/guests/${reservation.guest.id}`}
                className="mt-3 inline-flex items-center gap-1 text-[13px] font-semibold text-coral hover:text-coral-dark transition-colors"
              >
                View guest profile →
              </Link>
            )}
          </Card>

          {(reservation.company || reservation.group) && (
            <Card>
              <SectionLabel>Booking account</SectionLabel>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {reservation.company && (canReadCompanies ? (
                  <Link to={`/companies/${reservation.company.id}`} className="rounded-xl2 border border-line bg-card p-4 hover:border-coral/30 hover:bg-coral-soft/30 transition-colors">
                    <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-ink-faint"><Building2 size={14} /> Company</div>
                    <div className="mt-2 text-[14px] font-semibold text-ink">{reservation.company.name}</div>
                    <div className="text-[12px] text-ink-mute">{reservation.company.code ?? reservation.company.type.replace(/_/g, " ")}</div>
                  </Link>
                ) : (
                  <div className="rounded-xl2 border border-line bg-card p-4"><div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-ink-faint"><Building2 size={14} /> Company</div><div className="mt-2 text-[14px] font-semibold text-ink">{reservation.company.name}</div></div>
                ))}
                {reservation.group && (canReadGroups ? (
                  <Link to={`/groups/${reservation.groupId}`} className="rounded-xl2 border border-line bg-card p-4 hover:border-dusk/30 hover:bg-dusk-soft/40 transition-colors">
                    <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-ink-faint"><Users size={14} /> Group</div>
                    <div className="mt-2 text-[14px] font-semibold text-ink">{reservation.group.name}</div>
                    <div className="text-[12px] text-ink-mute tnum">{reservation.group.groupRef}</div>
                  </Link>
                ) : (
                  <div className="rounded-xl2 border border-line bg-card p-4"><div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-ink-faint"><Users size={14} /> Group</div><div className="mt-2 text-[14px] font-semibold text-ink">{reservation.group.name}</div></div>
                ))}
              </div>
            </Card>
          )}

          {/* Rate summary */}
          {room && (
            <Card>
              <div className="flex items-center justify-between mb-2">
                <SectionLabel>Rate summary</SectionLabel>
                {reservation.appliedRatePlanName && (
                  <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-pine bg-pine/20 border border-pine/40 px-2.5 py-1 rounded-lg">
                    <Tag size={11} strokeWidth={2.5} />
                    {reservation.appliedRatePlanName}
                  </span>
                )}
              </div>
              <div className="rounded-xl2 border border-line bg-card p-4 space-y-2.5">
                <div className="flex items-center justify-between text-[14px]">
                  <span className="text-ink-mute">{fmtPkr(room.ratePerNight)} × {nights} nights</span>
                  <span className="font-semibold text-ink tnum">{fmtPkr(room.ratePerNight * nights)}</span>
                </div>
                {reservation.discountAmount > 0 && (
                  <div className="flex items-center justify-between text-[14px]">
                    <span className="inline-flex items-center gap-1.5 text-pine"><BadgePercent size={14} /> Discount{reservation.promoCode ? ` · ${reservation.promoCode}` : ""}</span>
                    <span className="font-semibold text-pine tnum">−{fmtPkr(reservation.discountAmount)}</span>
                  </div>
                )}
                {reservation.taxAmount > 0 && (reservation.taxBreakdown?.length ? reservation.taxBreakdown.map((tax) => (
                  <div key={tax.key} className="flex items-center justify-between text-[14px]">
                    <span className="text-ink-mute">{tax.label} · {tax.rate}%{reservation.taxInclusive ? " (included)" : ""}</span>
                    <span className="font-semibold text-ink tnum">{fmtPkr(tax.amount)}</span>
                  </div>
                )) : (
                  <div className="flex items-center justify-between text-[14px]">
                    <span className="text-ink-mute">Tax{reservation.taxInclusive ? " (included)" : ""}</span>
                    <span className="font-semibold text-ink tnum">{fmtPkr(reservation.taxAmount)}</span>
                  </div>
                ))}
                <div className="border-t border-line-soft pt-2.5 flex items-center justify-between">
                  <span className="text-[14px] font-bold text-ink">Total</span>
                  <span className="serif text-[22px] text-ink tnum">{fmtPkr(reservation.totalAmount)}</span>
                </div>
                {reservation.advancePaid > 0 && (
                  <div className="rounded-xl border border-pine/20 bg-pine-soft/55 px-3.5 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="inline-flex items-center gap-2 text-[13px] font-semibold text-pine-deep"><Banknote size={15} /> Advance received</span>
                      <span className="text-[15px] font-bold text-pine tnum">{fmtPkr(reservation.advancePaid)}</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[12px] text-ink-mute">
                      <span>Remaining on reservation</span>
                      <span className="font-semibold text-ink tnum">{fmtPkr(reservation.balanceDue)}</span>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          )}

          {(reservation.arrivalMode || reservation.estimatedArrivalTime || reservation.purposeOfVisit || reservation.dietaryRequirements || reservation.requiresPickup || reservation.internalNotes) && (
            <Card>
              <SectionLabel>Stay information</SectionLabel>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {reservation.estimatedArrivalTime && <InfoTile icon={CarFront} label="Expected arrival" value={fmtDateTime(reservation.estimatedArrivalTime)} sub={reservation.arrivalMode ?? undefined} />}
                {!reservation.estimatedArrivalTime && reservation.arrivalMode && <InfoTile icon={CarFront} label="Arrival mode" value={reservation.arrivalMode} />}
                {reservation.purposeOfVisit && <InfoTile icon={ClipboardList} label="Purpose of visit" value={reservation.purposeOfVisit} />}
                {reservation.dietaryRequirements && <InfoTile icon={Gift} label="Dietary requirements" value={reservation.dietaryRequirements} />}
                {reservation.requiresPickup && <InfoTile icon={CarFront} label="Pickup" value="Pickup required" sub="Coordinate before arrival" />}
              </div>
              {reservation.internalNotes && (
                <div className="mt-3 rounded-xl border border-amber/25 bg-amber-soft/45 px-4 py-3">
                  <div className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-amber"><AlertTriangle size={13} /> Internal note</div>
                  <p className="whitespace-pre-line text-[13px] leading-relaxed text-ink-soft">{reservation.internalNotes}</p>
                </div>
              )}
            </Card>
          )}

          {/* Folio summary */}
          {canReadBilling && reservation.folio && (
            <Card>
              <div className="flex items-center justify-between mb-4">
                <SectionLabel>Folio</SectionLabel>
                <Link
                  to={`/financials/folio/${reservation.id}`}
                  className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-coral hover:text-coral-dark"
                >
                  <Receipt size={14} /> View itemized folio
                </Link>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                {[
                  ["Charges",  fmtPkr(reservation.folio.chargesTotal),  "text-ink"],
                  ["Paid",     fmtPkr(reservation.folio.paymentsTotal), "text-pine"],
                  ["Balance",  fmtPkr(reservation.folio.balanceDue),    reservation.folio.balanceDue > 0 ? "text-coral" : "text-ink-mute"],
                ].map(([label, val, cls]) => (
                  <div key={label} className="rounded-xl bg-mist border border-line-soft p-3">
                    <div className={cn("serif text-[20px] tnum", cls)}>{val}</div>
                    <div className="text-[11px] font-semibold text-ink-mute mt-0.5">{label}</div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {canReadBilling && reservation.payments.length > 0 && (
            <Card>
              <SectionLabel>Payments</SectionLabel>
              <div className="divide-y divide-line-soft rounded-xl2 border border-line bg-card">
                {reservation.payments.map((payment) => (
                  <div key={payment.id} className="flex items-center justify-between gap-4 px-4 py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-pine-soft text-pine-deep"><CreditCard size={16} /></span>
                      <div className="min-w-0">
                        <div className="text-[13px] font-semibold text-ink">{payment.isRefund ? "Refund" : payment.method.replace(/_/g, " ")}</div>
                        <div className="text-[11.5px] text-ink-faint">{fmtDateTime(payment.postedAt)}{payment.receiptNumber ? ` · ${payment.receiptNumber}` : ""}</div>
                      </div>
                    </div>
                    <div className={cn("text-[14px] font-bold tnum", payment.isRefund ? "text-clay" : "text-pine")}>{payment.isRefund ? "−" : ""}{fmtPkr(payment.amount)}</div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {reservation.upsells.length > 0 && (
            <Card>
              <SectionLabel>Added services</SectionLabel>
              <div className="divide-y divide-line-soft rounded-xl2 border border-line bg-card">
                {reservation.upsells.map((upsell) => (
                  <div key={upsell.id} className="flex items-center justify-between gap-4 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Gift size={16} className="text-coral" />
                      <div><div className="text-[13px] font-semibold text-ink">{upsell.name}</div><div className="text-[11.5px] text-ink-faint">Qty {upsell.quantity} · {upsell.postedAt ? "Posted to folio" : "Pending"}</div></div>
                    </div>
                    <span className="text-[14px] font-semibold text-ink tnum">{fmtPkr(upsell.amount)}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {reservation.stayChanges.length > 0 && (
            <Card>
              <div className="mb-4 flex items-center gap-2"><ArrowRightLeft size={15} className="text-coral" /><SectionLabel>In-stay changes</SectionLabel></div>
              <div className="divide-y divide-line-soft overflow-hidden rounded-xl2 border border-line bg-card">
                {reservation.stayChanges.map((change) => (
                  <div key={change.id} className="px-4 py-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-[13.5px] font-semibold text-ink">{change.customerDescription}</div>
                        <div className="mt-0.5 text-[11.5px] text-ink-mute">Effective {fmtDate(change.effectiveDate)} · {fmtDateTime(change.createdAt)}</div>
                      </div>
                      <div className="text-right text-[12px] font-semibold tnum">
                        {change.rateAdjustment > 0 && <div className="text-coral">+{fmtPkr(change.rateAdjustment)}</div>}
                        {change.rateAdjustment < 0 && <div className="text-pine">−{fmtPkr(Math.abs(change.rateAdjustment))}</div>}
                        {change.rebateAmount > 0 && <div className="text-pine">Rebate −{fmtPkr(change.rebateAmount)}</div>}
                        {change.rateAdjustment === 0 && change.rebateAmount === 0 && <div className="text-ink-mute">No rate change</div>}
                      </div>
                    </div>
                    <div className="mt-3 rounded-lg border border-amber/15 bg-amber-soft/35 px-3 py-2">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-amber">Internal reason</div>
                      <div className="mt-0.5 text-[12px] leading-relaxed text-ink-soft">{change.internalReason}</div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Special requests */}
          {reservation.specialRequests && (
            <Card>
              <SectionLabel>Special requests</SectionLabel>
              <p className="text-[13.5px] text-ink-soft leading-relaxed whitespace-pre-line bg-mist rounded-xl border border-line-soft px-4 py-3">
                {reservation.specialRequests}
              </p>
            </Card>
          )}

          {reservation.status === "CANCELLED" && (reservation.cancellationReason || reservation.cancellationFee > 0) && (
            <Card className="border-clay/25 bg-clay-soft/20">
              <SectionLabel>Cancellation</SectionLabel>
              {reservation.cancellationReason && <p className="text-[13.5px] leading-relaxed text-ink-soft">{reservation.cancellationReason}</p>}
              {reservation.cancellationFee > 0 && <div className="mt-3 flex items-center justify-between border-t border-clay/15 pt-3 text-[13px]"><span className="text-ink-mute">Cancellation fee</span><span className="font-bold text-clay tnum">{fmtPkr(reservation.cancellationFee)}</span></div>}
            </Card>
          )}
        </div>

        {/* ── Right: actions + timeline ── */}
        <div className="space-y-4">
          {/* Action card */}
          <Card className="space-y-3">
            <div className="text-[11px] font-bold uppercase tracking-wider text-ink-faint mb-1">Actions</div>

            {canUpdate && !["CHECKED_OUT", "CANCELLED", "NO_SHOW"].includes(reservation.status) && (
              <button
                onClick={() => setShowCaptureId(true)}
                className={cn(
                  "w-full h-11 rounded-full font-semibold text-sm transition-all flex items-center justify-center gap-2 border",
                  hasIdOnFile
                    ? "border-line text-ink-mute hover:bg-mist"
                    : "border-pine/40 bg-pine/5 text-pine-deep hover:bg-pine/10",
                )}
              >
                <IdCard size={17} />
                {hasIdOnFile ? "Recapture guest ID" : "Capture guest ID"}
              </button>
            )}

            {hasIdOnFile && (
              <GuestIdDocuments guestId={reservation.guest.id} reservationId={reservation.id} />
            )}

            {idBlocked && (
              <div className="rounded-2xl border border-amber/40 bg-amber-soft/60 p-3.5">
                <div className="flex items-start gap-2.5">
                  <ShieldAlert size={17} className="text-amber shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <div className="text-[13px] font-bold text-ink">ID required before check-in</div>
                    <p className="mt-1 text-[12.5px] leading-relaxed text-ink-soft">
                      {reservation.guest.fullName} has no ID on file. Capture it now, or have a
                      manager record why check-in went ahead without one.
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setShowCaptureId(true)}
                  className="mt-3 w-full h-10 rounded-full bg-pine text-white text-[13px] font-semibold hover:bg-pine-deep transition-colors flex items-center justify-center gap-2"
                >
                  <IdCard size={16} /> Capture guest ID
                </button>

                {canOverrideId ? (
                  <div className="mt-3 border-t border-amber/30 pt-3">
                    <label className="block text-[11px] font-bold uppercase tracking-[0.12em] text-ink-mute mb-1.5">
                      Manager override
                    </label>
                    <textarea
                      value={overrideReason}
                      onChange={(e) => setOverrideReason(e.target.value)}
                      rows={2}
                      placeholder="Why is this guest being checked in without ID?"
                      className="w-full rounded-xl border border-line bg-card px-3 py-2 text-[13px] text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-coral/30 resize-none"
                    />
                    <button
                      onClick={() => statusMutation.mutate({ status: "CHECKED_IN", reason: overrideReason.trim() })}
                      disabled={overrideReason.trim().length < 10 || statusMutation.isPending}
                      className="mt-2 w-full h-10 rounded-full border border-amber/50 text-amber text-[13px] font-semibold hover:bg-amber/10 transition-colors disabled:opacity-40 disabled:pointer-events-none"
                    >
                      {statusMutation.isPending ? "Checking in…" : "Check in without ID"}
                    </button>
                    <p className="mt-1.5 text-[11px] text-ink-mute">
                      Recorded against this reservation with your name.
                    </p>
                  </div>
                ) : (
                  <p className="mt-3 text-[11.5px] text-ink-mute">
                    Only a manager can approve check-in without ID.
                  </p>
                )}
              </div>
            )}

            {canUpdate && nextStatus && nextLabel && (
              <button
                onClick={() => reservation.status === "CHECKED_IN" ? setShowCheckOut(true) : statusMutation.mutate({ status: nextStatus })}
                disabled={statusMutation.isPending}
                className={cn(
                  "w-full h-11 rounded-full font-semibold text-sm transition-all flex items-center justify-center gap-2",
                  nextStatus === "CHECKED_IN"  ? "bg-pine text-white hover:bg-pine-deep" :
                  nextStatus === "CHECKED_OUT" ? "bg-coral text-white hover:bg-coral-dark" :
                  "bg-coral text-white hover:bg-coral-dark",
                  "disabled:opacity-40 disabled:pointer-events-none",
                )}
              >
                <NextIcon size={17} />
                {statusMutation.isPending ? "Updating…" : nextLabel}
              </button>
            )}

            {canReadBilling && (
              <Link
                to={`/financials/folio/${reservation.id}`}
                className="flex items-center justify-center gap-2 w-full h-11 rounded-full border border-line text-ink-soft text-sm font-semibold hover:bg-line-soft hover:text-ink transition-colors"
              >
                <Receipt size={16} /> View Folio
              </Link>
            )}

            {canEdit && (
              <button
                onClick={() => reservation.status === "CHECKED_IN" ? setShowManageStay(true) : setShowEdit(true)}
                className="flex items-center justify-center gap-2 w-full h-11 rounded-full border border-line text-ink-soft text-sm font-semibold hover:bg-line-soft hover:text-ink transition-colors"
              >
                <Pencil size={15} /> Edit
              </button>
            )}

            {canCancel && (
              <button
                onClick={() => statusMutation.mutate({ status: "CANCELLED" })}
                disabled={statusMutation.isPending}
                className="w-full h-11 rounded-full border border-clay/40 text-clay text-sm font-semibold hover:bg-clay-soft transition-colors disabled:opacity-40 disabled:pointer-events-none"
              >
                Cancel Reservation
              </button>
            )}

            {canMarkNoShow && (
              <button
                onClick={() => setShowNoShow(true)}
                disabled={statusMutation.isPending}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-full border border-amber/45 text-sm font-semibold text-amber hover:bg-amber-soft transition-colors disabled:pointer-events-none disabled:opacity-40"
              >
                <UserX size={16} /> Mark as no-show
              </button>
            )}

            {canReverseLifecycle && reservation.status === "CHECKED_IN" && (
              <button
                onClick={() => setReversalAction("CHECK_IN")}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-full border border-amber/45 text-sm font-semibold text-amber transition-colors hover:bg-amber-soft"
              >
                <RotateCcw size={15} /> Undo check-in
              </button>
            )}

            {canReverseLifecycle && reservation.status === "CHECKED_OUT" && (
              <button
                onClick={() => setReversalAction("CHECK_OUT")}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-full border border-amber/45 text-sm font-semibold text-amber transition-colors hover:bg-amber-soft"
              >
                <RotateCcw size={15} /> Undo checkout
              </button>
            )}

            {!(canUpdate && nextStatus) && !canCancel && !canEdit
              && !(canReverseLifecycle && ["CHECKED_IN", "CHECKED_OUT"].includes(reservation.status)) && (
              <p className="text-[13px] text-ink-faint text-center py-2">No actions available</p>
            )}
          </Card>

          {/* Timeline */}
          <Card>
            <div className="text-[11px] font-bold uppercase tracking-wider text-ink-faint mb-4">Timeline</div>
            <Timeline reservation={reservation} />
          </Card>

          {reservation.activity.length > 0 && (
            <Card>
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-ink-faint mb-4"><History size={14} /> Recorded activity</div>
              <div className="space-y-3">
                {reservation.activity.map((entry) => (
                  <div key={entry.id} className="border-l-2 border-line pl-3">
                    <div className="text-[12.5px] font-semibold text-ink">{entry.action.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase())}</div>
                    <div className="text-[11.5px] text-ink-faint">{entry.user?.name ?? "System"} · {fmtDateTime(entry.createdAt)}</div>
                    {entry.notes && <div className="mt-1 text-[12px] text-ink-mute">{entry.notes}</div>}
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Meta */}
          <Card>
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-ink-faint mb-3"><Globe2 size={13} /> Booking details</div>
            <div className="space-y-2.5">
              {[
                ["Source", sourceLabel(reservation.source, reservation.otaSource)],
                ...(reservation.otaBookingRef ? [["OTA reference", reservation.otaBookingRef]] : []),
                ...(reservation.promoCode ? [["Promo code", reservation.promoCode]] : []),
                ...(reservation.appliedRatePlanName ? [["Booked rate", reservation.appliedRatePlanName]] : []),
                ...(reservation.bookingContactName ? [["Booking contact", reservation.bookingContactName]] : []),
                ...(reservation.bookingContactEmail ? [["Contact email", reservation.bookingContactEmail]] : []),
                ["Guests", `${reservation.adults} adult${reservation.adults === 1 ? "" : "s"}${reservation.children ? ` · ${reservation.children} child${reservation.children === 1 ? "" : "ren"}` : ""}${reservation.infants ? ` · ${reservation.infants} infant${reservation.infants === 1 ? "" : "s"}` : ""}`],
                ...(reservation.billToCompany ? [["Billing", "BTC · Bill to company"]] : []),
                ...(reservation.termsAcceptedAt ? [["Terms accepted", fmtDateTime(reservation.termsAcceptedAt)]] : []),
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between text-[13px]">
                  <span className="text-ink-mute">{k}</span>
                  <span className="max-w-[62%] text-right font-semibold text-ink tnum break-words">{v}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {showCheckOut && reservation && (
        <CheckOutModal
          reservation={reservation}
          onClose={() => setShowCheckOut(false)}
          onSuccess={addToast}
        />
      )}
      {showEdit && reservation && (
        <EditReservationModal
          reservation={reservation}
          onClose={() => setShowEdit(false)}
          onSuccess={addToast}
        />
      )}
      {showCaptureId && reservation && (
        <CaptureIdModal
          reservationId={reservation.id}
          guestName={reservation.guest.fullName}
          onClose={() => setShowCaptureId(false)}
          onCaptured={() => {
            qc.invalidateQueries({ queryKey: ["reservation-documents", id] });
            qc.invalidateQueries({ queryKey: ["reservation", id] });
            // Capturing was the answer to a blocked check-in, so carry it
            // through rather than making the clerk press the button twice
            // with the guest still at the desk.
            if (idBlocked) {
              setShowCaptureId(false);
              statusMutation.mutate({ status: "CHECKED_IN" });
            }
          }}
        />
      )}
      {showManageStay && reservation && (
        <ManageStayModal
          reservation={reservation}
          onClose={() => setShowManageStay(false)}
          onSuccess={addToast}
        />
      )}
      {showNoShow && reservation && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4 backdrop-blur-sm anim-fade-in" role="dialog" aria-modal="true" aria-labelledby="no-show-title">
          <div className="w-full max-w-lg overflow-hidden rounded-xl2 border border-line bg-card shadow-pop">
            <div className="flex items-start justify-between gap-4 border-b border-line-soft px-6 py-5">
              <div>
                <div className="mb-1 flex items-center gap-2 text-amber"><UserX size={18} /><span className="text-[11px] font-bold uppercase tracking-[0.14em]">Arrival not completed</span></div>
                <h2 id="no-show-title" className="serif text-[26px] text-ink">Mark this reservation as no-show?</h2>
              </div>
              <button onClick={() => setShowNoShow(false)} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-ink-mute hover:bg-line-soft hover:text-ink" aria-label="Close"><X size={18} /></button>
            </div>
            <div className="space-y-4 px-6 py-5">
              <p className="text-[13.5px] leading-relaxed text-ink-mute">
                <span className="font-semibold text-ink">{reservation.guest.fullName}</span> will move to the No Show list and the room will be released from booking inventory. This action is recorded in the audit trail.
              </p>
              <label className="block">
                <span className="mb-2 block text-[12px] font-bold uppercase tracking-wider text-ink-faint">Reason <span className="text-clay">*</span></span>
                <textarea
                  value={noShowReason}
                  onChange={(event) => setNoShowReason(event.target.value)}
                  rows={3}
                  maxLength={500}
                  autoFocus
                  placeholder="For example: Guest did not arrive and could not be reached"
                  className="w-full resize-none rounded-xl border border-line bg-white px-4 py-3 text-[13.5px] text-ink outline-none focus:border-amber focus:ring-2 focus:ring-amber/10"
                />
              </label>
            </div>
            <div className="flex flex-col-reverse gap-2 border-t border-line-soft bg-mist/60 px-6 py-4 sm:flex-row sm:justify-end">
              <button onClick={() => setShowNoShow(false)} className="h-10 rounded-full border border-line px-5 text-sm font-semibold text-ink-soft hover:bg-white">Keep reservation</button>
              <button
                onClick={() => statusMutation.mutate({ status: "NO_SHOW", reason: noShowReason.trim() })}
                disabled={noShowReason.trim().length < 3 || statusMutation.isPending}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-amber px-5 text-sm font-semibold text-white hover:brightness-95 disabled:pointer-events-none disabled:opacity-40"
              >
                <UserX size={15} /> {statusMutation.isPending ? "Updating…" : "Confirm no-show"}
              </button>
            </div>
          </div>
        </div>
      )}
      {reversalAction && reservation && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/45 p-4 backdrop-blur-sm anim-fade-in" role="dialog" aria-modal="true" aria-labelledby="reversal-title">
          <div className="w-full max-w-lg overflow-hidden rounded-xl2 border border-line bg-card shadow-pop">
            <div className="flex items-start justify-between gap-4 border-b border-line-soft px-6 py-5">
              <div>
                <div className="mb-1 flex items-center gap-2 text-amber"><RotateCcw size={17} /><span className="text-[11px] font-bold uppercase tracking-[0.14em]">Controlled correction</span></div>
                <h2 id="reversal-title" className="serif text-[26px] text-ink">Undo {reversalAction === "CHECK_IN" ? "check-in" : "checkout"}?</h2>
              </div>
              <button onClick={() => { setReversalAction(null); setReversalReason(""); }} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-ink-mute hover:bg-line-soft hover:text-ink" aria-label="Close"><X size={18} /></button>
            </div>
            <div className="space-y-4 px-6 py-5">
              <div className="rounded-xl border border-amber/25 bg-amber-soft px-4 py-3 text-[13px] leading-relaxed text-ink-soft">
                {reversalAction === "CHECK_IN"
                  ? "The reservation returns to Confirmed and its automatic check-in room charges are voided. The action is blocked if payments or guest charges were posted."
                  : "The reservation returns to Checked In, the folio reopens, and the room becomes Occupied. The action is blocked if the room was reassigned, cleaning started, or later financial activity exists."}
              </div>
              <p className="text-[12.5px] leading-relaxed text-ink-mute">The original event remains in history. This correction records your name, time, reason, and every affected record.</p>
              <label className="block">
                <span className="mb-2 block text-[12px] font-bold uppercase tracking-wider text-ink-faint">Reason <span className="text-clay">*</span></span>
                <textarea
                  value={reversalReason}
                  onChange={(event) => setReversalReason(event.target.value)}
                  rows={3}
                  maxLength={500}
                  autoFocus
                  placeholder="For example: Checkout was recorded against the wrong reservation"
                  className="w-full resize-none rounded-xl border border-line bg-white px-4 py-3 text-[13.5px] text-ink outline-none focus:border-amber focus:ring-2 focus:ring-amber/10"
                />
              </label>
            </div>
            <div className="flex flex-col-reverse gap-2 border-t border-line-soft bg-mist/60 px-6 py-4 sm:flex-row sm:justify-end">
              <button onClick={() => { setReversalAction(null); setReversalReason(""); }} className="h-10 rounded-full border border-line px-5 text-sm font-semibold text-ink-soft hover:bg-white">Keep current status</button>
              <button
                onClick={() => reversalMutation.mutate({ action: reversalAction, reason: reversalReason.trim() })}
                disabled={reversalReason.trim().length < 5 || reversalMutation.isPending}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-amber px-5 text-sm font-semibold text-white hover:brightness-95 disabled:pointer-events-none disabled:opacity-40"
              >
                <RotateCcw size={15} /> {reversalMutation.isPending ? "Reversing…" : `Undo ${reversalAction === "CHECK_IN" ? "check-in" : "checkout"}`}
              </button>
            </div>
          </div>
        </div>
      )}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
