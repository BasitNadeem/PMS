import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  ArrowLeft, Copy, Phone, Mail, BadgeCheck, MapPin,
  LogIn, LogOut, Check, Receipt, BedDouble, Users,
} from "lucide-react";
import { cn } from "@/lib/cn";
import {
  reservationsService,
  type ReservationDetail,
  type ReservationStatus,
} from "@/services/reservations";
import { CheckOutModal } from "@/components/reservations/CheckOutModal";
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
  const [showCheckOut, setShowCheckOut] = useState(false);

  const { data: reservation, isLoading } = useQuery({
    queryKey: ["reservation", id],
    queryFn: () => reservationsService.getReservation(id!),
    enabled: !!id,
  });

  const statusMutation = useMutation({
    mutationFn: (status: ReservationStatus) =>
      reservationsService.updateReservationStatus(id!, status),
    onSuccess: (_res, status) => {
      qc.invalidateQueries({ queryKey: ["reservation", id] });
      qc.invalidateQueries({ queryKey: ["reservations"] });
      qc.invalidateQueries({ queryKey: ["reservations-counts"] });
      qc.invalidateQueries({ queryKey: ["rooms"] });
      const labels: Partial<Record<ReservationStatus, string>> = {
        CONFIRMED: "Reservation confirmed", CHECKED_IN: "Guest checked in",
        CHECKED_OUT: "Guest checked out", CANCELLED: "Reservation cancelled",
      };
      addToast(labels[status] ?? "Status updated");
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        "Failed to update status";
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
            <h1 className="serif text-[34px] leading-tight text-ink">{reservation.guest.fullName}</h1>
            <StatusBadge status={statusLabel} />
            {reservation.groupId && (
              <Link
                to={`/groups/${reservation.groupId}`}
                className="rounded-full bg-dusk-soft px-2.5 py-1 text-[11px] font-bold tracking-wide text-dusk hover:bg-dusk/20 transition-colors"
              >
                GROUP BOOKING
              </Link>
            )}
          </div>
          <div className="mt-1 flex items-center gap-2 text-[13px] text-ink-mute">
            <span className="tnum font-semibold">{reservation.confirmationNumber || "—"}</span>
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
                  <div className="text-[11px] text-ink-mute">after 14:00</div>
                </div>
                <div className="border-x border-line-soft">
                  <div className="text-[11px] font-bold uppercase text-ink-faint">Nights</div>
                  <div className="serif text-[32px] text-coral leading-none mt-0.5 tnum">{nights}</div>
                </div>
                <div>
                  <div className="text-[11px] font-bold uppercase text-ink-faint">Check-out</div>
                  <div className="serif text-[20px] text-ink mt-0.5">{fmtDate(reservation.checkOutDate)}</div>
                  <div className="text-[11px] text-ink-mute">before 12:00</div>
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
            <Link
              to={`/guests/${reservation.guest.id}`}
              className="mt-3 inline-flex items-center gap-1 text-[13px] font-semibold text-coral hover:text-coral-dark transition-colors"
            >
              View guest profile →
            </Link>
          </Card>

          {/* Rate summary */}
          {room && (
            <Card>
              <SectionLabel>Rate summary</SectionLabel>
              <div className="rounded-xl2 border border-line bg-card p-4 space-y-2.5">
                <div className="flex items-center justify-between text-[14px]">
                  <span className="text-ink-mute">{fmtPkr(room.ratePerNight)} × {nights} nights</span>
                  <span className="font-semibold text-ink tnum">{fmtPkr(room.ratePerNight * nights)}</span>
                </div>
                <div className="border-t border-line-soft pt-2.5 flex items-center justify-between">
                  <span className="text-[14px] font-bold text-ink">Total</span>
                  <span className="serif text-[22px] text-ink tnum">{fmtPkr(reservation.totalAmount)}</span>
                </div>
              </div>
            </Card>
          )}

          {/* Folio summary */}
          {reservation.folio && (
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

          {/* Special requests */}
          {reservation.specialRequests && (
            <Card>
              <SectionLabel>Special requests</SectionLabel>
              <p className="text-[13.5px] text-ink-soft leading-relaxed whitespace-pre-line bg-mist rounded-xl border border-line-soft px-4 py-3">
                {reservation.specialRequests}
              </p>
            </Card>
          )}
        </div>

        {/* ── Right: actions + timeline ── */}
        <div className="space-y-4">
          {/* Action card */}
          <Card className="space-y-3">
            <div className="text-[11px] font-bold uppercase tracking-wider text-ink-faint mb-1">Actions</div>

            {canUpdate && nextStatus && nextLabel && (
              <button
                onClick={() => reservation.status === "CHECKED_IN" ? setShowCheckOut(true) : statusMutation.mutate(nextStatus)}
                disabled={statusMutation.isPending}
                className={cn(
                  "w-full h-11 rounded-full font-semibold text-sm transition-all flex items-center justify-center gap-2",
                  nextStatus === "CHECKED_IN"  ? "bg-pine text-white hover:bg-pine-deep" :
                  nextStatus === "CHECKED_OUT" ? "bg-ink text-white hover:bg-ink-soft" :
                  "bg-coral text-white hover:bg-coral-dark",
                  "disabled:opacity-40 disabled:pointer-events-none",
                )}
              >
                <NextIcon size={17} />
                {statusMutation.isPending ? "Updating…" : nextLabel}
              </button>
            )}

            <Link
              to={`/financials/folio/${reservation.id}`}
              className="flex items-center justify-center gap-2 w-full h-11 rounded-full border border-line text-ink-soft text-sm font-semibold hover:bg-line-soft hover:text-ink transition-colors"
            >
              <Receipt size={16} /> View Folio
            </Link>

            {canCancel && (
              <button
                onClick={() => statusMutation.mutate("CANCELLED")}
                disabled={statusMutation.isPending}
                className="w-full h-11 rounded-full border border-clay/40 text-clay text-sm font-semibold hover:bg-clay-soft transition-colors disabled:opacity-40 disabled:pointer-events-none"
              >
                Cancel Reservation
              </button>
            )}

            {!(canUpdate && nextStatus) && !canCancel && (
              <p className="text-[13px] text-ink-faint text-center py-2">No actions available</p>
            )}
          </Card>

          {/* Timeline */}
          <Card>
            <div className="text-[11px] font-bold uppercase tracking-wider text-ink-faint mb-4">Timeline</div>
            <Timeline reservation={reservation} />
          </Card>

          {/* Meta */}
          <Card>
            <div className="text-[11px] font-bold uppercase tracking-wider text-ink-faint mb-3">Details</div>
            <div className="space-y-2.5">
              {[
                ["Source",   reservation.source.replace(/_/g, " ")],
                ["Check-in", fmtDateLong(reservation.checkInDate)],
                ["Check-out",fmtDateLong(reservation.checkOutDate)],
                ["Adults",   String(reservation.adults)],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between text-[13px]">
                  <span className="text-ink-mute">{k}</span>
                  <span className="font-semibold text-ink tnum">{v}</span>
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
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
