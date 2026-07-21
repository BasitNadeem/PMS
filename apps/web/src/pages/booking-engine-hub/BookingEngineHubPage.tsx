import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ExternalLink, Building2, Palette, BedDouble, Tag, ArrowRight,
  AlertTriangle, Lock, ImagePlus, Sparkles, Network,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { DatePicker } from "@/components/ui/DatePicker";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { settingsService } from "@/services/settings";
import { roomsService } from "@/services/rooms";
import { ratePlansService } from "@/services/ratePlans";
import { bookingEngineHubService } from "@/services/bookingEngineHub";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtPkr(paisas: number): string {
  return `PKR ${Math.round(paisas / 100).toLocaleString("en-PK")}`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" });
}

const STATUS_LABEL: Record<string, string> = {
  ENQUIRY: "Pending", CONFIRMED: "Confirmed", CHECKED_IN: "Checked In",
  CHECKED_OUT: "Checked Out", CANCELLED: "Cancelled", NO_SHOW: "No Show",
  WAITLISTED: "Waitlisted",
};

const THEME_LABEL: Record<string, string> = {
  WARM_CLAY:    "Warm Clay",
  PINE_TEAL:    "Pine Teal",
  AZURE_SLATE:  "Azure Slate",
  INDIGO_NIGHT: "Indigo Night",
};

// ── Section B row ─────────────────────────────────────────────────────────────

interface PresentationRowProps {
  icon: React.ElementType;
  title: string;
  value: React.ReactNode;
  note?: string;
  noteTone?: "amber" | "neutral";
  to: string;
}

function PresentationRow({ icon: Icon, title, value, note, noteTone = "neutral", to }: PresentationRowProps) {
  return (
    <div className="flex items-center gap-4 px-5 py-4">
      <span className="grid place-items-center h-10 w-10 rounded-xl bg-mist text-ink-mute shrink-0">
        <Icon size={18} />
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-[13.5px] font-semibold text-ink">{title}</div>
        <div className="text-[13px] text-ink-mute truncate mt-0.5">{value}</div>
        {note && (
          <div className={noteTone === "amber" ? "text-[12px] text-amber mt-1 font-medium" : "text-[12px] text-ink-faint mt-1"}>
            {note}
          </div>
        )}
      </div>
      <Link
        to={to}
        className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-coral hover:text-coral-dark transition-colors shrink-0"
      >
        Edit <ArrowRight size={13} />
      </Link>
    </div>
  );
}

// ── Section C stat card ───────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <Card className="!p-4">
      <div className="text-[11px] font-bold uppercase tracking-wide text-ink-faint">{label}</div>
      <div className="serif text-[26px] text-ink leading-none mt-2 tnum">{value}</div>
      {sub && <div className="text-[12px] text-ink-mute mt-1.5">{sub}</div>}
    </Card>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function BookingEngineHubPage() {
  const [startDate, setStartDate] = useState("");
  const [endDate,   setEndDate]   = useState("");

  const { data: plan, isLoading: planLoading } = useQuery({
    queryKey: ["settings", "plan"],
    queryFn:  settingsService.getPlan,
  });

  const bookingEngineEnabled = plan?.features?.bookingEngine === true;

  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn:  settingsService.getSettings,
    enabled:  bookingEngineEnabled,
  });

  const { data: roomTypesResp } = useQuery({
    queryKey: ["room-types"],
    queryFn:  roomsService.getRoomTypes,
    enabled:  bookingEngineEnabled,
  });

  const { data: ratePlansResp } = useQuery({
    queryKey: ["rate-plans", { isActive: true }],
    queryFn:  () => ratePlansService.list({ isActive: true }),
    enabled:  bookingEngineEnabled,
  });

  const { data: insights, isLoading: insightsLoading } = useQuery({
    queryKey: ["booking-engine", "insights", startDate, endDate],
    queryFn:  () => bookingEngineHubService.getInsights(
      startDate && endDate ? { startDate, endDate } : undefined,
    ),
    enabled:  bookingEngineEnabled,
  });

  const roomTypes = roomTypesResp?.data ?? [];
  const ratePlans = ratePlansResp?.data ?? [];
  const roomTypesWithPhotos = roomTypes.filter((rt) => rt.photoUrls.length > 0).length;
  const roomTypesWithoutPhotos = roomTypes.length - roomTypesWithPhotos;

  const hotelSlug = settings?.slug ?? "";
  const publicUrl = hotelSlug ? `https://${hotelSlug}.innflo.co` : "";
  const logoUrl  = (settings?.settings?.logoUrl as string | undefined) ?? null;
  const themeKey = (settings?.settings?.themeKey as string | undefined) ?? "WARM_CLAY";

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <div className="mb-1.5 text-[12px] font-bold uppercase tracking-[0.14em] text-coral">Distribution</div>
        <h1 className="serif text-[34px] leading-[1.05] text-ink">Booking Engine</h1>
        <p className="mt-1.5 text-[15px] text-ink-mute">Your guest-facing booking site — presentation, insights, and what's coming next.</p>
      </div>

      {planLoading ? (
        <Card className="anim-fade-up h-32 animate-pulse" />
      ) : !bookingEngineEnabled ? (
        <Card className="anim-fade-up">
          <div className="flex items-start gap-4">
            <span className="grid place-items-center h-11 w-11 rounded-xl bg-amber-soft text-amber shrink-0">
              <AlertTriangle size={20} />
            </span>
            <div>
              <h2 className="text-[16px] font-bold text-ink">Booking Engine isn't enabled on your plan</h2>
              <p className="text-[13.5px] text-ink-mute mt-1 leading-relaxed">
                Contact support to enable the Booking Engine and start taking direct bookings from a guest-facing
                site of your own.
              </p>
            </div>
          </div>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* ── Section A — Live Preview + Quick Status ──────────────────── */}
          <Card className="anim-fade-up">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-pine shrink-0" />
                  <span className="text-[13px] font-semibold text-ink">Booking Engine is live</span>
                </div>
                <p className="text-[13px] text-ink-mute mt-1 truncate">{publicUrl || "—"}</p>
              </div>
              {publicUrl && (
                <a
                  href={publicUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 h-10 px-4 rounded-full bg-coral text-white text-sm font-semibold hover:bg-coral-dark transition-colors shadow-pop whitespace-nowrap shrink-0"
                >
                  View Live Site <ExternalLink size={15} />
                </a>
              )}
            </div>
          </Card>

          {/* ── Section B — Property Presentation ────────────────────────── */}
          <div>
            <h2 className="text-[13px] font-bold uppercase tracking-wide text-ink-faint mb-3">Property presentation</h2>
            <Card pad={false} className="anim-fade-up divide-y divide-line-soft overflow-hidden">
              <PresentationRow
                icon={Building2}
                title="Hotel Name, Description &amp; Amenities"
                value={settings?.name ?? "—"}
                note={
                  !settings?.description
                    ? "No description set — guests see a generic tagline instead"
                    : settings.amenities.length === 0
                      ? "No amenities listed"
                      : `${settings.amenities.length} amenities listed`
                }
                noteTone={!settings?.description || settings?.amenities.length === 0 ? "amber" : "neutral"}
                to="/settings"
              />
              <PresentationRow
                icon={ImagePlus}
                title="Logo"
                value={logoUrl ? "Uploaded" : "Not set"}
                note={!logoUrl ? "Falls back to your hotel name as text" : undefined}
                noteTone="amber"
                to="/settings"
              />
              <PresentationRow
                icon={Palette}
                title="Theme Color"
                value={THEME_LABEL[themeKey] ?? themeKey}
                to="/settings"
              />
              <PresentationRow
                icon={BedDouble}
                title="Room Types"
                value={`${roomTypes.length} room type${roomTypes.length === 1 ? "" : "s"}`}
                note={
                  roomTypes.length === 0
                    ? "No room types yet — guests won't see anything to book"
                    : roomTypesWithoutPhotos > 0
                      ? `${roomTypesWithPhotos} have photos, ${roomTypesWithoutPhotos} don't`
                      : "All room types have photos"
                }
                noteTone={roomTypes.length === 0 || roomTypesWithoutPhotos > 0 ? "amber" : "neutral"}
                to="/rooms"
              />
              <PresentationRow
                icon={Tag}
                title="Rate Plans"
                value={`${ratePlans.length} active rate plan${ratePlans.length === 1 ? "" : "s"}`}
                note={ratePlans.length === 0 ? "Guests will see each room type's base rate only" : undefined}
                noteTone="amber"
                to="/rate-plans"
              />
            </Card>
          </div>

          {/* ── Section C — Insights ─────────────────────────────────────── */}
          <div>
            <div className="flex flex-wrap items-end justify-between gap-3 mb-3">
              <h2 className="text-[13px] font-bold uppercase tracking-wide text-ink-faint">Insights</h2>
              <div className="flex items-end gap-2">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wide text-ink-faint mb-1">From</div>
                  <DatePicker value={startDate} onChange={setStartDate} max={endDate || undefined} />
                </div>
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wide text-ink-faint mb-1">To</div>
                  <DatePicker value={endDate} onChange={setEndDate} min={startDate || undefined} />
                </div>
                {(startDate || endDate) && (
                  <button
                    onClick={() => { setStartDate(""); setEndDate(""); }}
                    className="h-[38px] px-3 text-[12.5px] font-semibold text-ink-faint hover:text-ink-soft underline underline-offset-2 transition-colors"
                  >
                    All time
                  </button>
                )}
              </div>
            </div>

            {insightsLoading ? (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[...Array(4)].map((_, i) => <div key={i} className="h-24 rounded-xl2 bg-line-soft animate-pulse" />)}
              </div>
            ) : (
              <>
                {insights && insights.totalCount > 0 && insights.totalCount < 5 && (
                  <Card className="anim-fade-up mb-3 !py-3 !px-4 bg-mist border-line-soft">
                    <p className="text-[13px] text-ink-mute">
                      Your Booking Engine is new — insights will become more useful as you get more direct bookings.
                    </p>
                  </Card>
                )}

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                  <StatCard
                    label="Total bookings"
                    value={insights?.totalCount ?? 0}
                  />
                  <StatCard
                    label="Status breakdown"
                    value={
                      insights && Object.keys(insights.byStatus).length > 0
                        ? Object.entries(insights.byStatus)
                            .map(([s, c]) => `${c} ${STATUS_LABEL[s] ?? s}`)
                            .join(" · ")
                        : "—"
                    }
                  />
                  <StatCard
                    label="Multi-room vs single"
                    value={`${insights?.multiRoomCount ?? 0} / ${insights?.singleRoomCount ?? 0}`}
                    sub="multi-room cart · single"
                  />
                  <StatCard
                    label="Est. revenue"
                    value={fmtPkr(insights?.totalEstimatedRevenue ?? 0)}
                    sub="quoted rate × nights"
                  />
                </div>

                {insights && insights.totalCount === 0 ? (
                  <Card className="anim-fade-up text-center !py-10">
                    <p className="text-[14px] font-semibold text-ink-soft">No Booking Engine reservations yet</p>
                    <p className="text-[13px] text-ink-faint mt-1">
                      Once guests start booking directly from your site, they'll show up here.
                    </p>
                  </Card>
                ) : (
                  <Card pad={false} className="anim-fade-up overflow-hidden">
                    <div className="hidden md:grid grid-cols-[1fr_1fr_0.8fr_0.8fr_0.6fr] gap-3 px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-ink-faint border-b border-line-soft">
                      <span>Confirmation #</span><span>Guest</span><span>Check-in</span><span>Status</span><span>Rooms</span>
                    </div>
                    {insights?.recent.map((r) => (
                      <Link
                        key={r.id}
                        to={r.isGroup ? `/groups/${r.id}` : `/reservations/${r.id}`}
                        className="grid grid-cols-2 md:grid-cols-[1fr_1fr_0.8fr_0.8fr_0.6fr] gap-3 px-5 py-3 items-center border-b border-line-soft last:border-0 hover:bg-mist transition-colors"
                      >
                        <span className="text-[13px] font-semibold text-ink">{r.confirmationNumber}</span>
                        <span className="text-[13px] text-ink-soft truncate">{r.guestName}</span>
                        <span className="hidden md:block text-[13px] text-ink-mute">{fmtDate(r.checkInDate)}</span>
                        <span className="hidden md:block">
                          <StatusBadge status={STATUS_LABEL[r.status] ?? r.status} size="sm" />
                        </span>
                        <span className="hidden md:block text-[12.5px] text-ink-faint">{r.roomCount} room{r.roomCount === 1 ? "" : "s"}</span>
                      </Link>
                    ))}
                  </Card>
                )}
              </>
            )}
          </div>

          {/* ── Section D — Channel Manager (placeholder) ────────────────── */}
          <div>
            <h2 className="text-[13px] font-bold uppercase tracking-wide text-ink-faint mb-3">What's next</h2>
            <Card className="anim-fade-up opacity-70">
              <div className="flex items-start gap-4">
                <span className="grid place-items-center h-11 w-11 rounded-xl bg-mist text-ink-faint shrink-0">
                  <Network size={20} />
                </span>
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-[15px] font-bold text-ink">Channel Manager</h3>
                    <span className="inline-flex items-center gap-1 text-[10.5px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-line-soft text-ink-mute">
                      <Lock size={9} /> In Development
                    </span>
                  </div>
                  <p className="text-[13.5px] text-ink-mute mt-1.5 leading-relaxed">
                    Sync your availability and rates with Booking.com, Airbnb, Agoda and more — all from one place.
                  </p>
                </div>
                <Sparkles size={16} className="text-ink-faint shrink-0 mt-1" />
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
