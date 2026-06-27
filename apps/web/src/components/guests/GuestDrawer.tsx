import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { X, Phone, Mail, BadgeCheck, MapPin, Pencil, CalendarPlus } from "lucide-react";
import { cn } from "@/lib/cn";
import { guestsService } from "@/services/guests";
import { Drawer } from "@/components/ui/Drawer";
import { Avatar } from "@/components/ui/Avatar";
import { StatusBadge } from "@/components/ui/StatusBadge";

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  ENQUIRY: "Pending", CONFIRMED: "Confirmed", CHECKED_IN: "Checked In",
  CHECKED_OUT: "Checked Out", CANCELLED: "Cancelled",
};

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-PK", { day: "2-digit", month: "short" });
}
function fmtPkrK(paise: number): string {
  const r = paise / 100;
  if (r >= 100_000) return `Rs ${(r / 100_000).toFixed(1)}L`;
  if (r >= 1_000)   return `Rs ${(r / 1_000).toFixed(1)}k`;
  return `Rs ${r.toLocaleString("en-PK")}`;
}
function nightsBetween(a: string, b: string): number {
  return Math.max(1, Math.ceil((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000));
}
function memberDuration(iso: string): string {
  const months = Math.floor((Date.now() - new Date(iso).getTime()) / (30 * 24 * 3600_000));
  if (months >= 24) return `${Math.floor(months / 12)}y`;
  if (months >= 12) return `${Math.floor(months / 12)}y`;
  return `${months}mo`;
}

function ContactRow({ icon: Icon, value }: { icon: React.ElementType; value: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Icon size={16} className="text-ink-faint shrink-0" />
      <span className="text-[13.5px] text-ink-soft tnum">{value ?? "—"}</span>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export interface GuestDrawerProps {
  guestId: string | null;
  onClose: () => void;
  onEdit?: (id: string) => void;
}

export function GuestDrawer({ guestId, onClose, onEdit }: GuestDrawerProps) {
  const { data: guest, isLoading } = useQuery({
    queryKey: ["guest", guestId],
    queryFn: () => guestsService.getGuest(guestId!),
    enabled: !!guestId,
  });

  return (
    <Drawer open={!!guestId} onClose={onClose} width="max-w-[480px]">
      {isLoading || !guest ? (
        <div className="flex-1 p-6 space-y-4 animate-pulse">
          <div className="flex gap-3">
            <div className="h-14 w-14 rounded-full bg-line-soft shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-6 bg-line-soft rounded w-1/2" />
              <div className="h-4 bg-line-soft rounded w-1/3" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[...Array(3)].map((_, i) => <div key={i} className="h-16 bg-line-soft rounded-xl" />)}
          </div>
        </div>
      ) : (
        <>
          {/* Header */}
          <div className="px-6 pt-6 pb-5 border-b border-line bg-card">
            <div className="flex items-start gap-3.5">
              <Avatar
                name={guest.fullName}
                size={56}
                vip={guest.vipLevel > 0 || guest.totalStays >= 5}
              />
              <div className="flex-1 min-w-0">
                <h3 className="serif text-[24px] leading-tight text-ink">{guest.fullName}</h3>
                {(guest.city || guest.nationality) && (
                  <div className="mt-0.5 flex items-center gap-1.5 text-[13px] text-ink-mute">
                    <MapPin size={13} />
                    <span>{[guest.city, guest.nationality].filter(Boolean).join(", ")}</span>
                  </div>
                )}
              </div>
              <div className="flex gap-1 -mt-1 -mr-1">
                {onEdit && (
                  <button
                    onClick={() => onEdit(guest.id)}
                    className="grid place-items-center h-9 w-9 rounded-full hover:bg-line-soft text-ink-mute transition-colors"
                  >
                    <Pencil size={16} />
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="grid place-items-center h-9 w-9 rounded-full hover:bg-line-soft text-ink-mute transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Stats */}
            <div className="mt-4 grid grid-cols-3 gap-3">
              {[
                ["Stays",    String(guest.totalStays)],
                ["Lifetime", fmtPkrK(guest.totalSpend)],
                ["Member",   memberDuration(guest.createdAt)],
              ].map(([k, v]) => (
                <div key={k} className="rounded-xl bg-mist border border-line-soft p-3 text-center">
                  <div className="serif text-[22px] text-ink tnum">{v}</div>
                  <div className="text-[11px] font-semibold text-ink-mute">{k}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto scroll-area p-6 space-y-5">
            {/* Contact & ID */}
            <div>
              <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-ink-faint">
                Contact &amp; ID
              </div>
              <div className="rounded-xl2 border border-line bg-card divide-y divide-line-soft">
                {guest.phone     && <ContactRow icon={Phone}     value={guest.phone} />}
                {guest.email     && <ContactRow icon={Mail}      value={guest.email} />}
                {guest.documentNumber && (
                  <ContactRow icon={BadgeCheck} value={`${guest.documentType} · ${guest.documentNumber}`} />
                )}
              </div>
            </div>

            {/* Stay history */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">
                  Stay history
                </span>
                <span className="text-[12px] text-ink-mute">{guest.reservations.length} bookings</span>
              </div>
              {guest.reservations.length === 0 ? (
                <div className="rounded-xl2 border border-dashed border-line p-6 text-center text-[13px] text-ink-mute">
                  No stays yet
                </div>
              ) : (
                <div className="space-y-2.5">
                  {guest.reservations.map((r) => {
                    const rooms = r.rooms.map((rr) => rr.room.number).join(", ");
                    const nights = nightsBetween(r.checkInDate, r.checkOutDate);
                    const statusLabel = STATUS_LABEL[r.status] ?? r.status;
                    return (
                      <Link
                        key={r.id}
                        to={`/reservations/${r.id}`}
                        onClick={onClose}
                        className="block rounded-xl2 border border-line bg-card p-3.5 hover:bg-mist transition-colors"
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[13px] font-semibold text-ink tnum">
                            {r.confirmationNumber || "—"}
                          </span>
                          <StatusBadge status={statusLabel} size="sm" />
                        </div>
                        <div className="flex items-center justify-between text-[13px] text-ink-mute">
                          <span className="tnum">
                            {fmtDate(r.checkInDate)} → {fmtDate(r.checkOutDate)} · {nights}n
                          </span>
                          <span>
                            {rooms ? `Room ${rooms}` : "—"}
                          </span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-line bg-card p-4">
            <Link
              to="/reservations"
              onClick={onClose}
              className="flex items-center justify-center gap-2 w-full h-11 rounded-full bg-coral text-white text-sm font-semibold hover:bg-coral-dark transition-colors"
            >
              <CalendarPlus size={17} />
              New reservation for {guest.firstName}
            </Link>
          </div>
        </>
      )}
    </Drawer>
  );
}
