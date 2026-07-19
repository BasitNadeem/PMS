import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  X, Copy, Phone, Mail, BadgeCheck, MapPin,
  LogIn, Check, Receipt, BedDouble, Users, Star, ArrowRight, Plus, Tag,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { cn } from "@/lib/cn";
import { api } from "@/lib/api";
import {
  reservationsService,
  type ReservationStatus,
} from "@/services/reservations";
import { Drawer } from "@/components/ui/Drawer";
import { Avatar } from "@/components/ui/Avatar";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { usePermissions } from "@/hooks/usePermissions";
import { AddChargeModal } from "@/components/folio/AddChargeModal";

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  ENQUIRY: "Pending", CONFIRMED: "Confirmed", CHECKED_IN: "Checked In",
  CHECKED_OUT: "Checked Out", CANCELLED: "Cancelled",
  NO_SHOW: "No Show", WAITLISTED: "Waitlisted",
};

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-PK", { day: "2-digit", month: "short" });
}
function fmtPkr(paise: number): string {
  return `Rs ${(paise / 100).toLocaleString("en-PK")}`;
}
function nightsBetween(a: string, b: string): number {
  return Math.max(1, Math.ceil((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000));
}

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

// ── Main component ─────────────────────────────────────────────────────────────

export interface ReservationDrawerProps {
  reservationId: string | null;
  onClose: () => void;
  onStatusChange?: () => void;
}

export function ReservationDrawer({ reservationId, onClose, onStatusChange }: ReservationDrawerProps) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { has } = usePermissions();
  const canUpdate = has("reservations:update");
  const [showAddCharge, setShowAddCharge] = useState(false);

  const { data: reservation, isLoading } = useQuery({
    queryKey: ["reservation", reservationId],
    queryFn: () => reservationsService.getReservation(reservationId!),
    enabled: !!reservationId,
  });

  const room0 = reservation?.rooms[0];
  const { data: suggestData } = useQuery({
    queryKey: ["rate-suggest", room0?.roomTypeId, reservation?.checkInDate?.slice(0, 10), reservation?.checkOutDate?.slice(0, 10)],
    queryFn: async () => {
      const res = await api.get("/api/rate-plans/suggest", {
        params: { roomTypeId: room0!.roomTypeId, checkIn: reservation!.checkInDate.slice(0, 10), checkOut: reservation!.checkOutDate.slice(0, 10) },
      });
      return res.data.data as { suggestedRate: number; matchedPlan: { id: string; name: string } | null };
    },
    enabled: !!room0 && !!reservation?.checkInDate && !!reservation?.checkOutDate,
    staleTime: 60_000,
  });

  const statusMutation = useMutation({
    mutationFn: (status: ReservationStatus) =>
      reservationsService.updateReservationStatus(reservationId!, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reservation", reservationId] });
      qc.invalidateQueries({ queryKey: ["reservations"] });
      qc.invalidateQueries({ queryKey: ["reservations-counts"] });
      qc.invalidateQueries({ queryKey: ["rooms"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      onStatusChange?.();
    },
  });

  const vipMutation = useMutation({
    mutationFn: (isVip: boolean) => reservationsService.updateReservation(reservationId!, { isVip }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reservation", reservationId] });
      qc.invalidateQueries({ queryKey: ["reservations"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  const open = !!reservationId;

  return (
    <>
      <Drawer open={open} onClose={onClose} width="max-w-[520px]">
        {isLoading || !reservation ? (
          <div className="flex-1 p-6 space-y-4 animate-pulse">
            <div className="flex gap-3">
              <div className="h-14 w-14 rounded-full bg-line-soft shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-6 bg-line-soft rounded w-1/2" />
                <div className="h-4 bg-line-soft rounded w-1/3" />
              </div>
            </div>
            <div className="h-24 bg-line-soft rounded-xl2" />
            <div className="h-20 bg-line-soft rounded-xl2" />
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-start gap-3 px-6 pt-6 pb-5 border-b border-line bg-card">
              <Avatar name={reservation.guest.fullName} size={52} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="serif text-[24px] leading-tight text-ink">{reservation.guest.fullName}</h3>
                  {reservation.groupId && (
                    <Link
                      to={`/groups/${reservation.groupId}`}
                      className="rounded-full bg-dusk-soft px-2 py-0.5 text-[10px] font-bold tracking-wide text-dusk hover:bg-dusk/20 transition-colors"
                    >
                      GROUP
                    </Link>
                  )}
                  {canUpdate ? (
                    <button
                      onClick={() => vipMutation.mutate(!reservation.isVip)}
                      disabled={vipMutation.isPending}
                      title={reservation.isVip ? "Remove VIP status" : "Mark as VIP"}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide transition-colors",
                        reservation.isVip
                          ? "bg-amber text-white hover:bg-amber/90"
                          : "bg-line-soft text-ink-faint hover:bg-amber-soft hover:text-amber",
                      )}
                    >
                      <Star size={11} className={reservation.isVip ? "fill-white" : ""} /> VIP
                    </button>
                  ) : reservation.isVip && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber text-white px-2 py-0.5 text-[10px] font-bold tracking-wide">
                      <Star size={11} className="fill-white" /> VIP
                    </span>
                  )}
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-[13px] text-ink-mute tnum">
                  <span>{reservation.confirmationNumber}</span>
                  {reservation.confirmationNumber && (
                    <button
                      onClick={() => navigator.clipboard?.writeText(reservation.confirmationNumber)}
                      className="text-ink-faint hover:text-coral transition-colors"
                    >
                      <Copy size={13} />
                    </button>
                  )}
                </div>
              </div>
              <button
                onClick={onClose}
                className="grid place-items-center h-9 w-9 rounded-full hover:bg-line-soft text-ink-mute transition-colors -mr-1 -mt-1"
              >
                <X size={18} />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto scroll-area p-6 space-y-5">
              {/* Group notice — prevents partial checkout confusion */}
              {reservation.groupId && (
                <div className="rounded-xl border border-dusk/20 bg-dusk-soft px-4 py-3 flex items-start gap-2.5">
                  <BadgeCheck size={15} className="text-dusk shrink-0 mt-0.5" />
                  <p className="text-[12.5px] text-dusk-deep leading-snug">
                    This is part of a <strong>group booking</strong>. Confirm and check-in through the group page to keep all rooms in sync. For checkout, open the folio to settle the bill — the checkout button there will handle all rooms automatically.
                  </p>
                </div>
              )}

              {/* Status + source */}
              <div className="flex items-center gap-2 flex-wrap">
                <StatusBadge status={STATUS_LABEL[reservation.status] ?? reservation.status} />
                {reservation.balanceDue > 0
                  ? <StatusBadge status="Partial" />
                  : reservation.status === "CHECKED_OUT" || reservation.status === "CHECKED_IN"
                  ? <StatusBadge status="Paid" />
                  : null
                }
                <span className="ml-auto text-[12px] text-ink-mute">
                  {reservation.source.replace(/_/g, " ")}
                </span>
              </div>

              {/* Stay summary */}
              <div className="rounded-xl2 border border-line bg-card p-4">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <div className="text-[11px] font-bold uppercase text-ink-faint">Check-in</div>
                    <div className="serif text-[20px] text-ink mt-0.5">{fmtDate(reservation.checkInDate)}</div>
                    <div className="text-[11px] text-ink-mute">after 14:00</div>
                  </div>
                  <div className="border-x border-line-soft">
                    <div className="text-[11px] font-bold uppercase text-ink-faint">Nights</div>
                    <div className="serif text-[32px] text-coral leading-none mt-0.5 tnum">
                      {nightsBetween(reservation.checkInDate, reservation.checkOutDate)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] font-bold uppercase text-ink-faint">Check-out</div>
                    <div className="serif text-[20px] text-ink mt-0.5">{fmtDate(reservation.checkOutDate)}</div>
                    <div className="text-[11px] text-ink-mute">before 12:00</div>
                  </div>
                </div>
              </div>

              {/* Room + Occupancy tiles */}
              {reservation.rooms[0] && (
                <div className="grid grid-cols-2 gap-3">
                  <InfoTile
                    icon={BedDouble} label="Room"
                    value={`${reservation.rooms[0].room.number} · ${reservation.rooms[0].roomType.name}`}
                    sub={`${reservation.rooms[0].roomType.typeName.replace(/_/g, " ")} · Floor ${reservation.rooms[0].room.floor ?? "—"}`}
                  />
                  <InfoTile
                    icon={Users} label="Occupancy"
                    value={`${reservation.adults} adult${reservation.adults !== 1 ? "s" : ""}`}
                    sub={reservation.children > 0 ? `${reservation.children} children` : "No children"}
                  />
                </div>
              )}

              {/* Guest contact */}
              <div>
                <SectionLabel>Guest</SectionLabel>
                <div className="rounded-xl2 border border-line bg-card divide-y divide-line-soft">
                  {reservation.bookingContactName && (
                    <div className="px-3 py-2.5 flex items-start gap-2.5">
                      <Tag size={14} className="text-emerald shrink-0 mt-0.5" />
                      <div>
                        <div className="text-[13px] font-semibold text-ink">{reservation.bookingContactName}</div>
                        <div className="text-[11px] text-ink-faint">Booking contact · profile: {reservation.guest.fullName}</div>
                      </div>
                    </div>
                  )}
                  {reservation.guest.phone && <ContactRow icon={Phone} value={reservation.guest.phone} />}
                  {reservation.guest.email && <ContactRow icon={Mail} value={reservation.guest.email} />}
                  {reservation.guest.documentNumber && (
                    <ContactRow icon={BadgeCheck} value={`${reservation.guest.documentType} · ${reservation.guest.documentNumber}`} />
                  )}
                  {reservation.guest.nationality && (
                    <ContactRow icon={MapPin} value={reservation.guest.nationality} />
                  )}
                </div>
              </div>

              {/* Rate summary */}
              {reservation.rooms[0] && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">Rate summary</span>
                    {suggestData?.matchedPlan && (
                      <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-pine bg-pine/20 border border-pine/40 px-2.5 py-1 rounded-lg">
                        <Tag size={11} strokeWidth={2.5} />
                        {suggestData.matchedPlan.name}
                      </span>
                    )}
                  </div>
                  <div className="rounded-xl2 border border-line bg-card p-4 space-y-2.5">
                    {(() => {
                      const nights = nightsBetween(reservation.checkInDate, reservation.checkOutDate);
                      const rate = reservation.rooms[0].ratePerNight;
                      const subtotal = rate * nights;
                      const tax = Math.round(subtotal * 0.05);
                      return (
                        <>
                          <div className="flex items-center justify-between text-[14px]">
                            <span className="text-ink-mute">{fmtPkr(rate)} × {nights} nights</span>
                            <span className="font-semibold text-ink tnum">{fmtPkr(subtotal)}</span>
                          </div>
                          <div className="flex items-center justify-between text-[14px]">
                            <span className="text-ink-mute">Service tax (5%)</span>
                            <span className="font-semibold text-ink tnum">{fmtPkr(tax)}</span>
                          </div>
                          <div className="border-t border-line-soft pt-2.5 flex items-center justify-between">
                            <span className="text-[15px] font-bold text-ink">Total</span>
                            <span className="serif text-[22px] text-ink tnum">{fmtPkr(subtotal + tax)}</span>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-line bg-card p-4 flex items-center gap-2.5">
              {reservation.folio && reservation.status !== "CHECKED_IN" && (
                <Link
                  to={`/financials/folio/${reservation.id}`}
                  onClick={onClose}
                  className="inline-flex items-center gap-2 h-10 px-4 rounded-full border border-line text-ink-soft text-sm font-semibold hover:bg-line-soft hover:text-ink transition-colors"
                >
                  <Receipt size={16} /> Folio
                </Link>
              )}
              <div className="flex-1" />
              {reservation.groupId ? (
                <>
                  {/* CHECKED_IN: add charge directly, or open folio for settlement */}
                  {reservation.status === "CHECKED_IN" && reservation.folio && (
                    <>
                      {canUpdate && (
                        <button
                          onClick={() => setShowAddCharge(true)}
                          className="inline-flex items-center gap-1.5 h-10 px-4 rounded-full border border-line text-ink-soft text-sm font-semibold hover:bg-line-soft hover:text-ink transition-colors"
                        >
                          <Plus size={15} /> Add Charge
                        </button>
                      )}
                      <Link
                        to={`/financials/folio/${reservation.id}`}
                        onClick={onClose}
                        className="inline-flex items-center gap-2 h-10 px-5 rounded-full bg-coral text-white text-sm font-semibold hover:bg-coral-dark transition-all shadow-pop"
                      >
                        <Receipt size={16} /> Settle &amp; Check Out
                      </Link>
                    </>
                  )}
                  {/* ENQUIRY / CONFIRMED: must go through group page to sync all rooms */}
                  {(reservation.status === "ENQUIRY" || reservation.status === "CONFIRMED") && (
                    <button
                      onClick={() => { navigate(`/groups/${reservation.groupId}`); onClose(); }}
                      className="inline-flex items-center gap-2 h-10 px-5 rounded-full bg-ink text-white text-sm font-semibold hover:bg-ink/90 transition-all shadow-pop"
                    >
                      Manage Group <ArrowRight size={15} />
                    </button>
                  )}
                </>
              ) : (
                <>
                  {canUpdate && (reservation.status === "ENQUIRY" || reservation.status === "CONFIRMED") && (
                    <button
                      onClick={() => statusMutation.mutate("CANCELLED")}
                      disabled={statusMutation.isPending}
                      className="h-10 px-4 rounded-full border border-clay/30 text-clay text-sm font-semibold hover:bg-clay-soft transition-colors disabled:opacity-40"
                    >
                      Cancel
                    </button>
                  )}
                  {canUpdate && reservation.status === "ENQUIRY" && (
                    <button
                      onClick={() => statusMutation.mutate("CONFIRMED")}
                      disabled={statusMutation.isPending}
                      className="inline-flex items-center gap-2 h-10 px-5 rounded-full bg-slate text-white text-sm font-semibold hover:brightness-95 transition-all shadow-pop disabled:opacity-40"
                    >
                      <Check size={16} /> Confirm
                    </button>
                  )}
                  {canUpdate && reservation.status === "CONFIRMED" && (
                    <button
                      onClick={() => statusMutation.mutate("CHECKED_IN")}
                      disabled={statusMutation.isPending}
                      className="inline-flex items-center gap-2 h-10 px-5 rounded-full bg-pine text-white text-sm font-semibold hover:bg-pine-deep transition-all shadow-pop disabled:opacity-40"
                    >
                      <LogIn size={16} />
                      {statusMutation.isPending ? "Checking in…" : "Check in"}
                    </button>
                  )}
                  {reservation.status === "CHECKED_IN" && reservation.folio && (
                    <>
                      {canUpdate && (
                        <button
                          onClick={() => setShowAddCharge(true)}
                          className="inline-flex items-center gap-1.5 h-10 px-4 rounded-full border border-line text-ink-soft text-sm font-semibold hover:bg-line-soft hover:text-ink transition-colors"
                        >
                          <Plus size={15} /> Add Charge
                        </button>
                      )}
                      <Link
                        to={`/financials/folio/${reservation.id}`}
                        onClick={onClose}
                        className="inline-flex items-center gap-2 h-10 px-5 rounded-full bg-coral text-white text-sm font-semibold hover:bg-coral-dark transition-all shadow-pop"
                      >
                        <Receipt size={16} />
                        Settle &amp; Check Out
                      </Link>
                    </>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </Drawer>

      {showAddCharge && reservation && (
        <AddChargeModal
          reservationId={reservation.id}
          onClose={() => setShowAddCharge(false)}
        />
      )}
    </>
  );
}
