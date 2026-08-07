import { useEffect, useMemo, useState } from "react";
import type { ElementType, ReactNode } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ExternalLink, Building2, Palette, BedDouble, Tag, ArrowRight, AlertTriangle,
  CheckCircle2, Clock3, ImagePlus, Network, Radio, TrendingUp, UsersRound,
  CalendarDays, FileText, Save, ChevronDown,
} from "lucide-react";
import {
  Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Card } from "@/components/ui/Card";
import { DatePicker } from "@/components/ui/DatePicker";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { cn } from "@/lib/cn";
import { settingsService } from "@/services/settings";
import { roomsService } from "@/services/rooms";
import { ratePlansService } from "@/services/ratePlans";
import { bookingEngineHubService, type BookingEngineInsights } from "@/services/bookingEngineHub";
import { UpsellsTab } from "./UpsellsTab";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtPkr(paisas: number): string {
  return `PKR ${Math.round(paisas / 100).toLocaleString("en-PK")}`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtChartDate(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("en-PK", { day: "numeric", month: "short" });
}

function pktToday(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function pktDaysAgo(days: number): string {
  const [year, month, day] = pktToday().split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

const STATUS_LABEL: Record<string, string> = {
  ENQUIRY: "Pending", CONFIRMED: "Confirmed", CHECKED_IN: "Checked In",
  CHECKED_OUT: "Checked Out", CANCELLED: "Cancelled", NO_SHOW: "No Show",
  WAITLISTED: "Waitlisted", MIXED: "Mixed",
};

const THEME_LABEL: Record<string, string> = {
  WARM_CLAY: "Warm Clay",
  PINE_TEAL: "Pine Teal",
  AZURE_SLATE: "Azure Slate",
  INDIGO_NIGHT: "Indigo Night",
};

type RangeOption = "7d" | "30d" | "90d" | "all" | "custom";

const RANGE_OPTIONS: Array<{ value: Exclude<RangeOption, "custom">; label: string }> = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
  { value: "all", label: "All time" },
];

// ── Presentation rows ─────────────────────────────────────────────────────────

interface PresentationRowProps {
  icon: ElementType;
  title: string;
  value: ReactNode;
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
      <Link to={to} className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-coral hover:text-coral-dark transition-colors shrink-0">
        Edit <ArrowRight size={13} />
      </Link>
    </div>
  );
}

interface InsightCardProps {
  icon: ElementType;
  label: string;
  value: ReactNode;
  sub: string;
  tone: "coral" | "pine" | "slate" | "amber";
}

function InsightCard({ icon: Icon, label, value, sub, tone }: InsightCardProps) {
  const toneClass = {
    coral: "bg-coral-soft text-coral",
    pine: "bg-pine-soft text-pine",
    slate: "bg-slate-soft text-slate",
    amber: "bg-amber-soft text-amber",
  }[tone];

  return (
    <Card className="!p-4">
      <div className="flex items-start justify-between gap-3">
        <span className={cn("grid place-items-center h-9 w-9 rounded-xl", toneClass)}><Icon size={17} /></span>
        <span className="text-[11px] font-bold uppercase tracking-wide text-ink-faint text-right">{label}</span>
      </div>
      <div className="serif text-[27px] text-ink leading-none mt-4 tnum">{value}</div>
      <div className="text-[12px] text-ink-mute mt-1.5">{sub}</div>
    </Card>
  );
}

function BookingPerformanceChart({ insights }: { insights: BookingEngineInsights }) {
  const data = useMemo(() => insights.daily.map((day) => ({
    ...day,
    label: fmtChartDate(day.date),
    revenuePkr: Math.round(day.estimatedRevenue / 100),
  })), [insights.daily]);

  if (data.length === 0) {
    return (
      <div className="h-[250px] grid place-items-center text-center px-6">
        <div>
          <TrendingUp size={22} className="mx-auto text-ink-faint mb-2" />
          <p className="text-[13px] font-semibold text-ink-soft">Your booking trend will appear here</p>
          <p className="text-[12.5px] text-ink-faint mt-1">Share your direct booking link to start building it.</p>
        </div>
      </div>
    );
  }

  const tickInterval = Math.max(0, Math.ceil(data.length / 6) - 1);

  return (
    <ResponsiveContainer width="100%" height={250}>
      <ComposedChart data={data} margin={{ top: 14, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid stroke="#E8E3DC" strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="label"
          interval={tickInterval}
          axisLine={false}
          tickLine={false}
          tickMargin={10}
          tick={{ fontSize: 10.5, fontWeight: 600, fill: "#9B9390" }}
        />
        <YAxis
          yAxisId="revenue"
          width={52}
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 10.5, fill: "#9B9390" }}
          tickFormatter={(value: number) => value >= 1000 ? `${Math.round(value / 1000)}k` : value.toLocaleString("en-PK")}
        />
        <YAxis yAxisId="bookings" orientation="right" allowDecimals={false} width={22} axisLine={false} tickLine={false} tick={{ fontSize: 10.5, fill: "#2F7256" }} />
        <Tooltip
          contentStyle={{ borderRadius: 12, border: "1px solid #E8E3DC", fontSize: 12.5 }}
          formatter={(value: unknown, name: unknown) => {
            const numericValue = Number(Array.isArray(value) ? value[0] : value ?? 0);
            return [
              name === "Estimated value" ? `PKR ${numericValue.toLocaleString("en-PK")}` : numericValue,
              String(name ?? ""),
            ];
          }}
        />
        <Bar yAxisId="revenue" dataKey="revenuePkr" name="Estimated value" fill="#E0532B" fillOpacity={0.82} radius={[4, 4, 0, 0]} />
        <Line yAxisId="bookings" type="monotone" dataKey="bookings" name="Bookings" stroke="#2F7256" strokeWidth={2.5} dot={{ r: 3, fill: "#fff", strokeWidth: 2 }} activeDot={{ r: 5 }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function BookingEngineHubPage() {
  const queryClient = useQueryClient();
  const [range, setRange] = useState<RangeOption>("30d");
  const [startDate, setStartDate] = useState(() => pktDaysAgo(29));
  const [endDate, setEndDate] = useState(pktToday);
  const [cancellationPolicy, setCancellationPolicy] = useState("");
  const [bookingPaymentTerms, setBookingPaymentTerms] = useState("");
  const [policySaveState, setPolicySaveState] = useState<"idle" | "saved" | "error">("idle");
  const [activeTab, setActiveTab] = useState<"overview" | "upsells">("overview");
  const [showPolicyEditor, setShowPolicyEditor] = useState(false);

  const { data: plan, isLoading: planLoading } = useQuery({
    queryKey: ["settings", "plan"],
    queryFn: settingsService.getPlan,
  });

  const bookingEngineEnabled = plan?.features?.bookingEngine === true;

  const { data: settings } = useQuery({
    queryKey: ["settings"], queryFn: settingsService.getSettings, enabled: bookingEngineEnabled,
  });
  const { data: roomTypesResp } = useQuery({
    queryKey: ["room-types"], queryFn: roomsService.getRoomTypes, enabled: bookingEngineEnabled,
  });
  const { data: ratePlansResp } = useQuery({
    queryKey: ["rate-plans", { isActive: true }], queryFn: () => ratePlansService.list({ isActive: true }), enabled: bookingEngineEnabled,
  });
  const { data: insights, isLoading: insightsLoading } = useQuery({
    queryKey: ["booking-engine", "insights", startDate, endDate],
    queryFn: () => bookingEngineHubService.getInsights(startDate && endDate ? { startDate, endDate } : undefined),
    enabled: bookingEngineEnabled,
  });

  useEffect(() => {
    if (!settings) return;
    setCancellationPolicy(settings.cancellationPolicy ?? "");
    setBookingPaymentTerms(settings.bookingPaymentTerms ?? "");
  }, [settings]);

  const savePoliciesMutation = useMutation({
    mutationFn: () => settingsService.updateSettings({
      cancellationPolicy: cancellationPolicy.trim() || null,
      bookingPaymentTerms: bookingPaymentTerms.trim() || null,
    }),
    onSuccess: async () => {
      setPolicySaveState("saved");
      await queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: () => setPolicySaveState("error"),
  });

  const roomTypes = roomTypesResp?.data ?? [];
  const ratePlans = ratePlansResp?.data ?? [];
  const roomTypesWithPhotos = roomTypes.filter((rt) => rt.photoUrls.length > 0).length;
  const roomTypesWithoutPhotos = roomTypes.length - roomTypesWithPhotos;
  const hotelSlug = settings?.slug ?? "";
  const publicUrl = hotelSlug ? `https://${hotelSlug}.innflo.co` : "";
  const logoUrl = (settings?.settings?.logoUrl as string | undefined) ?? null;
  const themeKey = (settings?.settings?.themeKey as string | undefined) ?? "WARM_CLAY";
  const policiesReady = Boolean(settings?.cancellationPolicy && settings?.bookingPaymentTerms);
  const presentationChecks = [Boolean(settings?.description), Boolean(logoUrl), roomTypes.length > 0, roomTypesWithoutPhotos === 0 && roomTypes.length > 0, policiesReady];
  const presentationReady = presentationChecks.filter(Boolean).length;

  function selectRange(nextRange: Exclude<RangeOption, "custom">) {
    setRange(nextRange);
    if (nextRange === "all") {
      setStartDate("");
      setEndDate("");
      return;
    }
    const days = Number.parseInt(nextRange, 10);
    setStartDate(pktDaysAgo(days - 1));
    setEndDate(pktToday());
  }

  function setCustomStartDate(value: string) {
    setRange("custom");
    setStartDate(value);
  }

  function setCustomEndDate(value: string) {
    setRange("custom");
    setEndDate(value);
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-1.5 text-[12px] font-bold uppercase tracking-[0.14em] text-coral">Distribution</div>
          <h1 className="serif text-[34px] leading-[1.05] text-ink">Booking Engine</h1>
          <p className="mt-1.5 text-[15px] text-ink-mute">Your direct channel, live performance, and distribution readiness in one place.</p>
        </div>
        {publicUrl && (
          <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 h-10 px-4 rounded-full bg-coral text-white text-sm font-semibold hover:bg-coral-dark transition-colors shadow-pop whitespace-nowrap">
            View live site <ExternalLink size={15} />
          </a>
        )}
      </div>

      {planLoading ? (
        <Card className="anim-fade-up h-32 animate-pulse" />
      ) : !bookingEngineEnabled ? (
        <Card className="anim-fade-up">
          <div className="flex items-start gap-4">
            <span className="grid place-items-center h-11 w-11 rounded-xl bg-amber-soft text-amber shrink-0"><AlertTriangle size={20} /></span>
            <div>
              <h2 className="text-[16px] font-bold text-ink">Booking Engine isn't enabled on your plan</h2>
              <p className="text-[13.5px] text-ink-mute mt-1 leading-relaxed">Contact support to enable the Booking Engine and start taking direct bookings from a guest-facing site of your own.</p>
            </div>
          </div>
        </Card>
      ) : (
        <>
        <div className="mb-6 flex gap-6 border-b border-line">
          {([
            { key: "overview", label: "Overview" },
            { key: "upsells",  label: "Extras & Add-ons" },
          ] as const).map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "-mb-px border-b-2 pb-2.5 text-[14px] font-bold transition-colors",
                activeTab === tab.key
                  ? "border-coral text-coral"
                  : "border-transparent text-ink-mute hover:text-ink-soft",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "upsells" ? <UpsellsTab /> : (
        <div className="space-y-6">
          <Card className="anim-fade-up bg-gradient-to-r from-card via-card to-coral-tint/70">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-pine shrink-0 animate-pulse" /><span className="text-[13px] font-semibold text-ink">Direct bookings are live</span></div>
                <p className="text-[13px] text-ink-mute mt-1 truncate">{publicUrl || "Your public booking link is being prepared"}</p>
              </div>
              <div className="flex items-center gap-2 text-[12px] font-semibold text-pine bg-pine-soft px-3 py-2 rounded-full"><Radio size={13} /> Direct channel connected</div>
            </div>
          </Card>

          <section>
            <div className="flex flex-wrap items-end justify-between gap-3 mb-3">
              <div>
                <h2 className="text-[13px] font-bold uppercase tracking-wide text-ink-faint">Direct booking performance</h2>
                <p className="text-[12.5px] text-ink-mute mt-1">Bookings are grouped by guest cart, so multi-room stays count once.</p>
              </div>
              <div className="flex flex-wrap items-end justify-end gap-2">
                <div className="inline-flex items-center rounded-full bg-line-soft p-1">
                  {RANGE_OPTIONS.map((option) => (
                    <button key={option.value} onClick={() => selectRange(option.value)} className={cn("rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors", range === option.value ? "bg-white text-ink shadow-sm" : "text-ink-mute hover:text-ink-soft")}>
                      {option.label}
                    </button>
                  ))}
                </div>
                <div className="hidden sm:flex items-end gap-2">
                  <div><div className="text-[10px] font-bold uppercase tracking-wide text-ink-faint mb-1">From</div><DatePicker value={startDate} onChange={setCustomStartDate} max={endDate || undefined} /></div>
                  <div><div className="text-[10px] font-bold uppercase tracking-wide text-ink-faint mb-1">To</div><DatePicker value={endDate} onChange={setCustomEndDate} min={startDate || undefined} /></div>
                </div>
              </div>
            </div>

            {insightsLoading ? (
              <div className="space-y-3"><div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-32 rounded-xl2 bg-line-soft animate-pulse" />)}</div><div className="h-[310px] rounded-xl2 bg-line-soft animate-pulse" /></div>
            ) : insights ? (
              <>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
                  <InsightCard icon={UsersRound} label="Direct bookings" value={insights.totalCount} sub={`${insights.roomReservationCount} room reservation${insights.roomReservationCount === 1 ? "" : "s"}`} tone="coral" />
                  <InsightCard icon={CheckCircle2} label="Progressed" value={insights.confirmedCount} sub={insights.pendingCount > 0 ? `${insights.pendingCount} awaiting action` : "No pending requests"} tone="pine" />
                  <InsightCard icon={BedDouble} label="Room nights" value={insights.totalRoomNights} sub={`${insights.multiRoomCount} multi-room cart${insights.multiRoomCount === 1 ? "" : "s"}`} tone="slate" />
                  <InsightCard icon={TrendingUp} label="Est. direct value" value={fmtPkr(insights.totalEstimatedRevenue)} sub={`${insights.avgLeadTimeDays} day average lead time`} tone="amber" />
                </div>

                <Card pad={false} className="anim-fade-up overflow-hidden">
                  <div className="p-5 pb-0 flex flex-wrap items-start justify-between gap-3">
                    <div><h3 className="serif text-[20px] text-ink">Booking momentum</h3><p className="text-[12.5px] text-ink-mute mt-0.5">Quoted direct-booking value and booking volume by day.</p></div>
                    <div className="flex items-center gap-3 text-[11px] font-semibold text-ink-mute"><span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-sm bg-coral" /> Est. value</span><span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-pine" /> Bookings</span></div>
                  </div>
                  <div className="px-3 sm:px-5 pb-4"><BookingPerformanceChart insights={insights} /></div>
                </Card>
              </>
            ) : null}
          </section>

          {insights && insights.pendingCount > 0 && (
            <Card className="anim-fade-up border-amber/30 bg-amber-soft/40">
              <div className="flex flex-wrap items-center justify-between gap-4"><div className="flex items-start gap-3"><Clock3 size={19} className="text-amber shrink-0 mt-0.5" /><div><p className="text-[14px] font-bold text-ink">{insights.pendingCount} direct booking request{insights.pendingCount === 1 ? "" : "s"} need attention</p><p className="text-[12.5px] text-ink-mute mt-0.5">Confirm or follow up quickly while the guest is still deciding.</p></div></div><Link to="/reservations" className="inline-flex items-center gap-1 text-[12.5px] font-bold text-coral hover:text-coral-dark">Open reservations <ArrowRight size={14} /></Link></div>
            </Card>
          )}

          <section className="grid xl:grid-cols-[1.25fr_0.75fr] gap-6 items-start">
            <div>
              <h2 className="text-[13px] font-bold uppercase tracking-wide text-ink-faint mb-3">Recent direct bookings</h2>
              {!insights || insights.totalCount === 0 ? (
                <Card className="anim-fade-up text-center !py-10"><CalendarDays size={22} className="mx-auto text-ink-faint mb-2" /><p className="text-[14px] font-semibold text-ink-soft">No Booking Engine reservations in this period</p><p className="text-[13px] text-ink-faint mt-1">Try a longer range, or share your direct booking link.</p></Card>
              ) : (
                <Card pad={false} className="anim-fade-up overflow-hidden">
                  <div className="hidden md:grid grid-cols-[1fr_1fr_0.8fr_0.8fr_0.6fr] gap-3 px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-ink-faint border-b border-line-soft"><span>Confirmation #</span><span>Guest</span><span>Check-in</span><span>Status</span><span>Rooms</span></div>
                  {insights.recent.map((booking) => <Link key={booking.id} to={booking.isGroup ? `/groups/${booking.id}` : `/reservations/${booking.id}`} className="grid grid-cols-2 md:grid-cols-[1fr_1fr_0.8fr_0.8fr_0.6fr] gap-3 px-5 py-3 items-center border-b border-line-soft last:border-0 hover:bg-mist transition-colors"><span className="text-[13px] font-semibold text-ink">{booking.confirmationNumber}</span><span className="text-[13px] text-ink-soft truncate">{booking.guestName}</span><span className="hidden md:block text-[13px] text-ink-mute">{fmtDate(booking.checkInDate)}</span><span className="hidden md:block"><StatusBadge status={STATUS_LABEL[booking.status] ?? booking.status} size="sm" /></span><span className="hidden md:block text-[12.5px] text-ink-faint">{booking.roomCount} room{booking.roomCount === 1 ? "" : "s"}</span></Link>)}
                </Card>
              )}
            </div>

            <div>
              <h2 className="text-[13px] font-bold uppercase tracking-wide text-ink-faint mb-3">Distribution readiness</h2>
              <Card className="anim-fade-up !p-0 overflow-hidden">
                <div className="p-5 bg-gradient-to-br from-coral-tint to-card border-b border-line-soft"><div className="flex items-start gap-3"><span className="grid place-items-center h-10 w-10 rounded-xl bg-white text-coral shadow-card"><Network size={19} /></span><div><p className="text-[14px] font-bold text-ink">One direct channel, live</p><p className="text-[12.5px] text-ink-mute mt-0.5">Your website is already the source of truth for availability and rates.</p></div></div></div>
                <div className="divide-y divide-line-soft">
                  <div className="flex items-center gap-3 px-5 py-4"><span className="h-2 w-2 rounded-full bg-pine" /><div className="flex-1"><p className="text-[13px] font-semibold text-ink">Innflo Booking Engine</p><p className="text-[12px] text-ink-mute">Live · direct bookings tracked above</p></div><CheckCircle2 size={17} className="text-pine" /></div>
                  <Link to="/channel-manager" className="flex items-center gap-3 px-5 py-4 hover:bg-mist transition-colors"><span className="h-2 w-2 rounded-full bg-ink-faint" /><div className="flex-1"><p className="text-[13px] font-semibold text-ink">Channel Manager</p><p className="text-[12px] text-ink-mute">OTA connections and channel-level insights are coming next</p></div><ArrowRight size={16} className="text-ink-faint" /></Link>
                </div>
              </Card>
            </div>
          </section>

          <section>
            <div className="flex items-end justify-between gap-3 mb-3"><div><h2 className="text-[13px] font-bold uppercase tracking-wide text-ink-faint">Guest-facing presentation</h2><p className="text-[12.5px] text-ink-mute mt-1">{presentationReady} of 5 booking-site essentials ready.</p></div><span className={cn("text-[12px] font-bold px-2.5 py-1 rounded-full", presentationReady === 5 ? "bg-pine-soft text-pine" : "bg-amber-soft text-amber")}>{presentationReady === 5 ? "Ready to share" : "A few improvements left"}</span></div>
            <Card pad={false} className="anim-fade-up divide-y divide-line-soft overflow-hidden">
              <PresentationRow icon={Building2} title="Hotel name, description & amenities" value={settings?.name ?? "—"} note={!settings?.description ? "No description set — guests see a generic tagline instead" : settings.amenities.length === 0 ? "No amenities listed" : `${settings.amenities.length} amenities listed`} noteTone={!settings?.description || settings?.amenities.length === 0 ? "amber" : "neutral"} to="/settings" />
              <PresentationRow icon={ImagePlus} title="Logo" value={logoUrl ? "Uploaded" : "Not set"} note={!logoUrl ? "Falls back to your hotel name as text" : undefined} noteTone="amber" to="/settings" />
              <PresentationRow icon={Palette} title="Theme color" value={THEME_LABEL[themeKey] ?? themeKey} to="/settings" />
              <PresentationRow icon={BedDouble} title="Room types" value={`${roomTypes.length} room type${roomTypes.length === 1 ? "" : "s"}`} note={roomTypes.length === 0 ? "No room types yet — guests won't see anything to book" : roomTypesWithoutPhotos > 0 ? `${roomTypesWithPhotos} have photos, ${roomTypesWithoutPhotos} don't` : "All room types have photos"} noteTone={roomTypes.length === 0 || roomTypesWithoutPhotos > 0 ? "amber" : "neutral"} to="/rooms" />
              <PresentationRow icon={Tag} title="Rate plans" value={`${ratePlans.length} active rate plan${ratePlans.length === 1 ? "" : "s"}`} note={ratePlans.length === 0 ? "Guests will see each room type's base rate only" : undefined} noteTone="amber" to="/rate-plans" />
              <button
                type="button"
                onClick={() => setShowPolicyEditor((open) => !open)}
                aria-expanded={showPolicyEditor}
                className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-mist transition-colors"
              >
                <span className="grid place-items-center h-10 w-10 rounded-xl bg-mist text-ink-mute shrink-0"><FileText size={18} /></span>
                <div className="flex-1 min-w-0">
                  <div className="text-[13.5px] font-semibold text-ink">Cancellation policy &amp; booking terms</div>
                  <div className="text-[13px] text-ink-mute mt-0.5">{policiesReady ? "Both policies are shown before guests submit" : "Add both policies so guests know the terms before booking"}</div>
                </div>
                <span className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-coral shrink-0">
                  {showPolicyEditor ? "Close" : "Edit"}
                  <ChevronDown size={14} className={cn("transition-transform", showPolicyEditor && "rotate-180")} />
                </span>
              </button>

              {showPolicyEditor && (
              <div className="px-5 py-5">
                <p className="text-[12.5px] text-ink-mute mb-4">Guests see these on the final reserve page and must acknowledge them before submitting.</p>
                <div className="grid lg:grid-cols-2 gap-5">
                <label className="block">
                  <span className="text-[13px] font-bold text-ink">Cancellation policy</span>
                  <span className="block text-[12px] text-ink-mute mt-1 mb-2">State cancellation deadlines, refund eligibility, fees, and no-show treatment.</span>
                  <textarea
                    value={cancellationPolicy}
                    onChange={(event) => { setCancellationPolicy(event.target.value); setPolicySaveState("idle"); }}
                    maxLength={5000}
                    rows={9}
                    placeholder="Example: Free cancellation up to 72 hours before arrival. Later cancellations and no-shows are charged one night's stay."
                    className="w-full rounded-xl border border-line bg-white px-4 py-3 text-[13.5px] leading-relaxed text-ink outline-none resize-y focus:border-coral focus:ring-2 focus:ring-coral/10"
                  />
                  <span className="block text-right text-[11px] text-ink-faint mt-1">{cancellationPolicy.length}/5,000</span>
                </label>
                <label className="block">
                  <span className="text-[13px] font-bold text-ink">Booking &amp; payment terms</span>
                  <span className="block text-[12px] text-ink-mute mt-1 mb-2">Explain confirmation, deposits, payment timing, refunds, taxes, and early checkout.</span>
                  <textarea
                    value={bookingPaymentTerms}
                    onChange={(event) => { setBookingPaymentTerms(event.target.value); setPolicySaveState("idle"); }}
                    maxLength={10000}
                    rows={9}
                    placeholder="Example: This submission is a booking request. The hotel will contact the guest to confirm availability and any required deposit."
                    className="w-full rounded-xl border border-line bg-white px-4 py-3 text-[13.5px] leading-relaxed text-ink outline-none resize-y focus:border-coral focus:ring-2 focus:ring-coral/10"
                  />
                  <span className="block text-right text-[11px] text-ink-faint mt-1">{bookingPaymentTerms.length}/10,000</span>
                </label>
              </div>
              <div className="mt-5 pt-4 border-t border-line-soft flex flex-wrap items-center justify-between gap-3">
                <p className={cn("text-[12.5px]", policySaveState === "error" ? "text-red-600" : policySaveState === "saved" ? "text-pine font-semibold" : "text-ink-mute")}>
                  {policySaveState === "error" ? "Policies could not be saved. Please try again." : policySaveState === "saved" ? "Policies saved and live on the booking page." : "Line breaks are preserved. Plain text only."}
                </p>
                <button
                  type="button"
                  disabled={savePoliciesMutation.isPending}
                  onClick={() => { setPolicySaveState("idle"); savePoliciesMutation.mutate(); }}
                  className="inline-flex h-10 items-center gap-2 rounded-full bg-coral px-4 text-[13px] font-bold text-white shadow-pop transition-colors hover:bg-coral-dark disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Save size={15} /> {savePoliciesMutation.isPending ? "Saving…" : "Save policies"}
                </button>
              </div>
              </div>
              )}
            </Card>
          </section>
        </div>
        )}
        </>
      )}
    </div>
  );
}
