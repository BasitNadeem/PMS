import { useState } from "react";
import { useParams, useSearchParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Phone, Mail, BadgeCheck, MapPin, Pencil, CalendarPlus, ShieldAlert, ShieldOff,
  Cake, Heart, Star, MailCheck, MailX,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { guestsService, SPECIAL_DATE_LABEL, type ReservationSummary } from "@/services/guests";
import { EditGuestModal } from "@/components/guests/EditGuestModal";
import { ToastContainer } from "@/components/ui/ToastContainer";
import { useToast } from "@/hooks/useToast";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { StatusBadge, TONE } from "@/components/ui/StatusBadge";
import { BlacklistModal } from "@/components/guests/BlacklistModal";
import { VipBadge } from "@/components/guests/VipBadge";
import { GuestPromoPanel } from "@/components/guests/GuestPromoPanel";
import { usePermissions } from "@/hooks/usePermissions";

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  CONFIRMED: "Confirmed", CHECKED_IN: "Checked In", CHECKED_OUT: "Checked Out",
  CANCELLED: "Cancelled", NO_SHOW: "No Show", ENQUIRY: "Pending", WAITLISTED: "Waitlisted",
};

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-PK", { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));
}
function fmtMoney(paise: number): string {
  return `PKR ${(paise / 100).toLocaleString("en-PK")}`;
}
/** "14 Aug" — no year, because the guest may not have given one. */
function monthDay(month: number, day: number): string {
  return new Intl.DateTimeFormat("en-PK", { day: "numeric", month: "short", timeZone: "UTC" })
    .format(new Date(Date.UTC(2024, month - 1, day)));
}
/** Days until an ID expires — negative once it has already lapsed. */
function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
}
function nightsBetween(a: string, b: string): number {
  return Math.max(0, Math.ceil((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000));
}

// ── Stay history card ─────────────────────────────────────────────────────────

function StayCard({ stay }: { stay: ReservationSummary }) {
  const rooms = stay.rooms.map((r) => r.room.number).join(", ");
  const nights = nightsBetween(stay.checkInDate, stay.checkOutDate);
  const statusLabel = STATUS_LABEL[stay.status] ?? stay.status;
  return (
    <Link
      to={`/reservations/${stay.id}`}
      className="block rounded-xl2 border border-line bg-card p-3.5 hover:bg-mist transition-colors"
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-[13px] font-semibold text-ink tnum">{stay.confirmationNumber || "—"}</span>
        <StatusBadge status={statusLabel} size="sm" />
      </div>
      <div className="flex items-center justify-between text-[13px] text-ink-mute">
        <span className="tnum">{fmtDate(stay.checkInDate)} → {fmtDate(stay.checkOutDate)} · {nights}n</span>
        <span>{rooms ? `Room ${rooms}` : "—"}</span>
      </div>
    </Link>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function GuestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toasts, addToast, removeToast } = useToast();
  const { has } = usePermissions();
  const qc = useQueryClient();
  const canEdit = has("guests:update");
  const [activeTab, setActiveTab] = useState<"details" | "stays" | "offers">("details");
  const [showBlacklist, setShowBlacklist] = useState(false);

  const removeBlacklistMutation = useMutation({
    mutationFn: () => guestsService.removeFromBlacklist(id!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["guest", id] });
      qc.invalidateQueries({ queryKey: ["guests"] });
      addToast("Guest removed from blacklist");
    },
  });

  const isEditOpen = searchParams.get("edit") === "1";

  const { data: guest, isLoading } = useQuery({
    queryKey: ["guest", id],
    queryFn: () => guestsService.getGuest(id!),
    enabled: !!id,
    refetchInterval: 15_000,
  });

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-5">
        <div className="h-5 w-28 bg-line-soft rounded" />
        <div className="h-28 bg-line-soft rounded-xl2" />
        <div className="h-48 bg-line-soft rounded-xl2" />
      </div>
    );
  }

  if (!guest) {
    return <div className="py-10 text-center text-ink-mute">Guest not found.</div>;
  }

  const expiryDays = daysUntil(guest.documentExpiry);

  return (
    <div>
      {/* Back */}
      <button
        onClick={() => navigate("/guests")}
        className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink-mute hover:text-ink transition-colors mb-6"
      >
        <ArrowLeft size={15} /> All Guests
      </button>

      {/* Profile header card */}
      <Card className="mb-5">
        <div className="flex items-start gap-3.5">
          <Avatar name={guest.fullName} size={56} />
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className="serif text-[30px] leading-tight text-ink flex items-center gap-2 flex-wrap">
                  {guest.fullName}
                  <VipBadge level={guest.vipLevel} />
                </h1>
                <div className="mt-1 flex items-center gap-2 flex-wrap text-[13px] text-ink-mute">
                  {guest.nationality && (
                    <span className="inline-flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-slate" />
                      {guest.nationality}
                    </span>
                  )}
                  {guest.city && <span>{guest.city}</span>}
                  {guest.isBlacklisted && (
                    <span className="text-[11px] font-bold bg-clay-soft text-clay rounded-full px-2 py-0.5">Blacklisted</span>
                  )}
                </div>
                {guest.tags.length > 0 && (
                  <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                    {guest.tags.map((tag) => (
                      <span key={tag} className="text-[11.5px] font-semibold text-ink-soft bg-mist border border-line rounded-full px-2 py-0.5">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              {canEdit && (
                <button
                  onClick={() => setSearchParams({ edit: "1" })}
                  className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full border border-line text-ink-soft text-[13px] font-semibold hover:bg-line-soft hover:text-ink transition-colors shrink-0"
                >
                  <Pencil size={14} /> Edit
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            ["Stays",       String(guest.totalStays)],
            ["Nights",      String(guest.stats.totalNights)],
            ["Lifetime",    fmtMoney(guest.totalSpend)],
            ["Guest since", fmtDate(guest.createdAt)],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl bg-mist border border-line-soft p-3 text-center">
              <div className="serif text-[19px] text-ink tnum truncate">{v}</div>
              <div className="text-[11px] font-semibold text-ink-mute">{k}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* Blacklist banner */}
      {guest.isBlacklisted && (
        <div
          className="mb-5 rounded-xl2 border px-4 py-4 flex items-start gap-3"
          style={{ background: TONE.clay.bg, borderColor: TONE.clay.dot, color: TONE.clay.fg }}
        >
          <ShieldAlert size={20} className="shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[14px] font-bold">Blacklisted guest</span>
              <StatusBadge status={guest.blacklistSeverity ?? "Flagged"} size="sm" dot={false} />
            </div>
            <p className="mt-1 text-[13.5px]">{guest.blacklistReason || "No reason recorded."}</p>
          </div>
          {canEdit && (
            <button
              onClick={() => removeBlacklistMutation.mutate()}
              disabled={removeBlacklistMutation.isPending}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full bg-card text-[13px] font-semibold shrink-0 hover:bg-mist transition-colors disabled:opacity-40"
              style={{ color: TONE.clay.fg }}
            >
              <ShieldOff size={15} /> Remove
            </button>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-0 border-b border-line mb-5 overflow-x-auto">
        {(["details", "stays", "offers"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "px-4 pb-3 text-[14px] font-semibold transition-colors border-b-2 -mb-px whitespace-nowrap",
              activeTab === tab ? "border-coral text-coral" : "border-transparent text-ink-mute hover:text-ink",
            )}
          >
            {tab === "details" ? "Details"
              : tab === "stays" ? `Stay History (${guest.reservationCount})`
              : "Offers"}
          </button>
        ))}
      </div>

      {/* ID expiry warning — a lapsed CNIC or passport is a check-in blocker,
          so it belongs on the profile rather than being discovered at the desk. */}
      {expiryDays !== null && expiryDays < 60 && (
        <div
          className="mb-5 rounded-xl2 border px-4 py-3 flex items-center gap-3"
          style={{ background: TONE.amber.bg, borderColor: TONE.amber.dot, color: TONE.amber.fg }}
        >
          <BadgeCheck size={18} className="shrink-0" />
          <p className="text-[13.5px]">
            {expiryDays < 0
              ? `${guest.documentType} expired on ${fmtDate(guest.documentExpiry)}.`
              : `${guest.documentType} expires in ${expiryDays} day${expiryDays === 1 ? "" : "s"} (${fmtDate(guest.documentExpiry)}).`}
          </p>
        </div>
      )}

      {/* Details tab */}
      {activeTab === "details" && (
        <Card>
          {/* Contact */}
          <div className="mb-5">
            <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-ink-faint">Contact &amp; ID</div>
            <div className="rounded-xl2 border border-line bg-card divide-y divide-line-soft">
              {guest.phone && (
                <div className="flex items-center gap-3 px-4 py-3">
                  <Phone size={16} className="text-ink-faint shrink-0" />
                  <span className="text-[13.5px] text-ink-soft tnum">{guest.phone}</span>
                </div>
              )}
              {guest.email && (
                <div className="flex items-center gap-3 px-4 py-3">
                  <Mail size={16} className="text-ink-faint shrink-0" />
                  <span className="text-[13.5px] text-ink-soft tnum">{guest.email}</span>
                </div>
              )}
              {guest.documentNumber && (
                <div className="flex items-center gap-3 px-4 py-3">
                  <BadgeCheck size={16} className="text-ink-faint shrink-0" />
                  <span className="text-[13.5px] text-ink-soft tnum">{guest.documentType} · {guest.documentNumber}</span>
                </div>
              )}
              {(guest.city || guest.country) && (
                <div className="flex items-center gap-3 px-4 py-3">
                  <MapPin size={16} className="text-ink-faint shrink-0" />
                  <span className="text-[13.5px] text-ink-soft">{[guest.city, guest.country].filter(Boolean).join(", ")}</span>
                </div>
              )}
            </div>
          </div>

          {/* Relationship — everything here is derived per request from
              reservations and payments, so it needs no upkeep by staff. */}
          <div className="mb-5">
            <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-ink-faint">Relationship</div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-4 rounded-xl2 border border-line bg-card px-4 py-4">
              {([
                ["Last stay",       guest.stats.lastStayAt ? fmtDate(guest.stats.lastStayAt) : "Never"],
                ["Days since",      guest.stats.daysSinceLastStay !== null ? `${guest.stats.daysSinceLastStay}` : "—"],
                ["Avg. nights",     guest.stats.avgNightsPerStay > 0 ? String(guest.stats.avgNightsPerStay) : "—"],
                ["Avg. spend",      guest.stats.avgSpendPerStay > 0 ? fmtMoney(guest.stats.avgSpendPerStay) : "—"],
                ["Usual room",      guest.stats.favouriteRoomType ?? "—"],
                ["Upcoming",        guest.stats.upcomingCount > 0 ? String(guest.stats.upcomingCount) : "—"],
                ["Cancellations",   String(guest.stats.cancelledCount)],
                ["No-shows",        String(guest.stats.noShowCount)],
              ] as const).map(([k, v]) => (
                <div key={k}>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-ink-faint mb-0.5">{k}</p>
                  <p className="text-[13.5px] text-ink-soft tnum truncate">{v}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Special dates. Shown even when empty so the gap is visible and
              staff know there is something worth asking about. */}
          <div className="mb-5">
            <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-ink-faint">Special Dates</div>
            <div className="rounded-xl2 border border-line bg-card px-4 py-3.5">
              {guest.specialDates.length > 0 ? (
                <div className="flex flex-wrap items-center gap-2">
                  {guest.specialDates.map((d) => (
                    <span
                      key={`${d.kind}-${d.month}-${d.day}`}
                      className="inline-flex items-center gap-1.5 rounded-full bg-mist border border-line px-3 py-1 text-[12.5px] text-ink-soft"
                    >
                      {d.kind === "BIRTHDAY" ? <Cake size={13} className="text-coral" />
                        : d.kind === "ANNIVERSARY" ? <Heart size={13} className="text-coral" />
                        : <Star size={13} className="text-coral" />}
                      <span className="font-semibold">{d.label || SPECIAL_DATE_LABEL[d.kind]}</span>
                      <span className="tnum">{monthDay(d.month, d.day)}</span>
                      {d.year && <span className="text-ink-faint tnum">{d.year}</span>}
                    </span>
                  ))}
                </div>
              ) : guest.specialDatesDeclinedAt ? (
                <p className="text-[13px] text-ink-mute">
                  Guest preferred not to share — please don’t ask again.
                </p>
              ) : (
                <p className="text-[13px] text-ink-faint">
                  Nothing on file yet.
                </p>
              )}

              <div className="mt-3 pt-3 border-t border-line-soft flex items-center gap-2">
                {guest.marketingOptIn ? (
                  <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-pine-deep">
                    <MailCheck size={14} /> Agreed to receive offers
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-mute">
                    <MailX size={14} className="text-ink-faint" /> No consent for offers — nothing will be emailed
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Full details grid */}
          <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-ink-faint">Profile</div>
          <div className="grid grid-cols-2 gap-x-8 gap-y-4">
            {[
              ["First name",  guest.firstName],
              ["Last name",   guest.lastName],
              ["Date of birth", fmtDate(guest.dateOfBirth)],
              ["Gender",      guest.gender],
              ["Nationality", guest.nationality],
              ["Language",    guest.language],
              ["Alternate phone", guest.alternatePhone],
              ["Address",     guest.address],
              ["ID expiry",   fmtDate(guest.documentExpiry)],
            ].filter(([, v]) => v).map(([k, v]) => (
              <div key={k}>
                <p className="text-[11px] font-bold uppercase tracking-wider text-ink-faint mb-0.5">{k}</p>
                <p className="text-[13.5px] text-ink-soft">{v}</p>
              </div>
            ))}
          </div>

          {guest.internalNotes && (
            <div className="mt-5 pt-5 border-t border-line-soft">
              <p className="text-[11px] font-bold uppercase tracking-wider text-ink-faint mb-1.5">Internal Notes</p>
              <p className="text-[13.5px] text-ink-soft whitespace-pre-line bg-mist rounded-xl border border-line-soft px-4 py-3">
                {guest.internalNotes}
              </p>
            </div>
          )}
        </Card>
      )}

      {/* Stay History tab */}
      {activeTab === "stays" && (
        <div>
          {guest.reservations.length === 0 ? (
            <div className="flex flex-col items-center py-16">
              <div className="grid place-items-center h-14 w-14 rounded-2xl bg-line-soft text-ink-faint mb-4">
                <CalendarPlus size={26} />
              </div>
              <p className="text-base font-semibold text-ink-soft">No stays yet</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {guest.reservationCount > guest.reservations.length && (
                <p className="text-[12px] text-ink-faint">Showing the latest {guest.reservations.length} of {guest.reservationCount} bookings.</p>
              )}
              {guest.reservations.map((stay) => (
                <StayCard key={stay.id} stay={stay} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Offers tab */}
      {activeTab === "offers" && (
        <GuestPromoPanel guest={guest} canIssue={canEdit} onNotify={addToast} />
      )}

      {/* Footer action */}
      <div className="mt-5 pt-5 border-t border-line-soft space-y-3">
        <Link
          to={`/reservations?new=single&guestId=${guest.id}`}
          className="inline-flex items-center justify-center gap-2 w-full h-11 rounded-full bg-coral text-white text-sm font-semibold hover:bg-coral-dark transition-colors"
        >
          <CalendarPlus size={17} />
          New reservation for {guest.firstName}
        </Link>
        {canEdit && !guest.isBlacklisted && (
          <button
            onClick={() => setShowBlacklist(true)}
            className="inline-flex items-center justify-center gap-2 w-full h-11 rounded-full border text-sm font-semibold transition-colors hover:bg-clay-soft"
            style={{ borderColor: TONE.clay.dot, color: TONE.clay.fg }}
          >
            <ShieldAlert size={17} />
            Flag as blacklisted
          </button>
        )}
      </div>

      {isEditOpen && guest && canEdit && (
        <EditGuestModal guest={guest} onClose={() => setSearchParams({})} onSuccess={addToast} />
      )}
      {showBlacklist && (
        <BlacklistModal
          guestId={guest.id}
          guestName={guest.fullName}
          onClose={() => setShowBlacklist(false)}
          onSuccess={addToast}
        />
      )}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
