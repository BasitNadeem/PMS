import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  BedDouble,
  BellRing,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  Clock3,
  Copy,
  CreditCard,
  Mail,
  MapPin,
  Package,
  Palette,
  Plus,
  ReceiptText,
  Rocket,
  ShieldCheck,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { hotelsService } from "@/services/hotels";
import { authService } from "@/services/auth";
import { settingsService, type ThemeKey, type UpdateSettingsDto } from "@/services/settings";
import { roomsService, type RoomStatus, type RoomTypeName } from "@/services/rooms";
import { usersService, type Role } from "@/services/users";
import { applyTheme } from "@/lib/theme";
import { pkrInWords } from "@/lib/numberToWords";
import { ThemePicker } from "@/components/settings/ThemePicker";
import { getPhoneErrorMessage } from "@/lib/validation";

const STEP_LABELS = ["Welcome", "Property", "Rooms", "Team", "Finish"];
const STEP_DESCRIPTIONS = [
  "A quick launch, focused on what the front desk needs first.",
  "Identity, operating hours and optional tax defaults.",
  "Create room categories, then add the physical rooms inside them.",
  "Invite essential staff now, or do it later from Settings.",
  "Choose the workspace look and open your command center.",
];

const PROPERTY_TYPES = [
  "HOTEL",
  "GUESTHOUSE",
  "RESORT",
  "LODGE",
  "HOSTEL",
  "SERVICED_APARTMENT",
  "CAMPSITE",
];

const PROPERTY_LABELS: Record<string, string> = {
  HOTEL: "Hotel",
  GUESTHOUSE: "Guesthouse",
  RESORT: "Resort",
  LODGE: "Lodge",
  HOSTEL: "Hostel",
  SERVICED_APARTMENT: "Serviced Apartment",
  CAMPSITE: "Campsite",
};

const BED_TYPES: { label: string; value: RoomTypeName }[] = [
  { label: "Single", value: "SINGLE" },
  { label: "Double", value: "DOUBLE" },
  { label: "Twin", value: "TWIN" },
  { label: "Triple", value: "TRIPLE" },
  { label: "Family", value: "FAMILY" },
  { label: "Suite", value: "SUITE" },
  { label: "Dormitory", value: "DORMITORY" },
  { label: "Cottage", value: "COTTAGE" },
  { label: "Tent / Glamping", value: "TENT_GLAMPING" },
];

const TEAM_ROLES = [
  { name: "MANAGER", label: "Manager" },
  { name: "FRONT_DESK", label: "Front Desk" },
  { name: "HOUSEKEEPING", label: "Housekeeping" },
  { name: "KITCHEN", label: "Kitchen" },
  { name: "MAINTENANCE", label: "Maintenance" },
  { name: "ACCOUNTANT", label: "Accountant" },
];

const LAUNCH_OUTCOMES: { icon: LucideIcon; title: string; copy: string }[] = [
  { icon: CalendarDays, title: "A ready reservation desk", copy: "Rooms, rates and availability become one working calendar." },
  { icon: BellRing, title: "Operations that reach the team", copy: "Booking alerts and housekeeping work stay visible to staff." },
  { icon: ReceiptText, title: "Billing with the right defaults", copy: "Your hotel’s times and tax behavior are configured from day one." },
];

const COMPLETION_LINES = [
  "Packing your property details",
  "Adding rooms and operating rules",
  "Connecting the right staff access",
  "Innflo is ready for your first shift",
];

const PACKING_ICONS: LucideIcon[] = [Building2, BedDouble, Users, CreditCard, Sparkles];

const inputCls =
  "w-full rounded-xl border border-line bg-white px-3.5 py-3 text-[14px] text-ink placeholder:text-ink-faint outline-none transition focus:border-coral/60 focus:ring-2 focus:ring-coral/15";
const selectCls = cn(
  inputCls,
  "h-12 cursor-pointer appearance-none py-0 pr-10 leading-[1.25] [-webkit-appearance:none]",
);
const labelCls = "mb-1.5 block text-[12px] font-bold text-ink-soft";
const primaryButton =
  "inline-flex w-full items-center justify-center rounded-xl bg-coral px-5 py-3.5 text-[14px] font-bold text-white shadow-pop transition hover:bg-coral-dark disabled:cursor-not-allowed disabled:opacity-60";
const secondaryButton =
  "inline-flex items-center justify-center rounded-xl border border-line bg-white px-4 py-3 text-[13px] font-bold text-ink-soft transition hover:border-coral/40 hover:text-coral-dark disabled:opacity-60";

const stepVariants = {
  initial: (direction: number) => ({ opacity: 0, x: direction > 0 ? 34 : -34 }),
  animate: { opacity: 1, x: 0 },
  exit: (direction: number) => ({ opacity: 0, x: direction > 0 ? -34 : 34 }),
};
const stepTransition = { duration: 0.28, ease: [0.22, 1, 0.36, 1] as const };

function getCurrentUserId(): string | null {
  const token = localStorage.getItem("accessToken");
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split(".")[1] ?? "")) as { userId?: string };
    return payload.userId ?? null;
  } catch {
    return null;
  }
}

function generateTempPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  let password = "";
  for (let index = 0; index < 10; index += 1) {
    password += chars[Math.floor(Math.random() * chars.length)];
  }
  return password;
}

function numberSetting(value: unknown, fallback: number) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function booleanSetting(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function ErrorNotice({ message }: { message: string }) {
  return (
    <div className="mb-5 rounded-xl border border-clay/20 bg-clay-soft px-4 py-3 text-[13px] font-semibold text-clay">
      {message}
    </div>
  );
}

function DesktopRail({
  hotelName,
  currentStep,
  onSkip,
}: {
  hotelName?: string;
  currentStep: number;
  onSkip: () => void;
}) {
  const progress = Math.round((currentStep / STEP_LABELS.length) * 100);

  return (
    <aside className="relative hidden min-h-screen w-[32%] max-w-[430px] shrink-0 overflow-hidden bg-ink px-9 py-9 text-white lg:flex lg:flex-col">
      <div className="absolute -left-24 bottom-12 h-72 w-72 rounded-full bg-coral/20 blur-3xl" />
      <div className="relative flex items-center justify-between">
        <span className="font-display text-[27px] font-semibold italic">Innflo</span>
        <span className="rounded-full border border-white/10 bg-white/[.06] px-3 py-1.5 text-[9px] font-bold uppercase tracking-[.16em] text-white/60">
          Property launch
        </span>
      </div>

      <div className="relative mt-16">
        <p className="text-[10px] font-bold uppercase tracking-[.18em] text-coral">Setting up</p>
        <h2 className="mt-3 truncate font-display text-[34px] font-medium leading-tight">{hotelName || "Your hotel"}</h2>
        <p className="mt-4 max-w-xs text-[13px] leading-relaxed text-white/55">{STEP_DESCRIPTIONS[currentStep - 1]}</p>
      </div>

      <div className="relative mt-12 space-y-1">
        {STEP_LABELS.map((label, index) => {
          const step = index + 1;
          const completed = step < currentStep;
          const current = step === currentStep;
          return (
            <div key={label} className={cn("flex items-center gap-3 rounded-2xl px-3 py-3 transition", current && "bg-white/[.07]")}>
              <span className={cn(
                "grid h-8 w-8 place-items-center rounded-xl border text-[11px] font-bold",
                completed && "border-coral bg-coral text-white",
                current && "border-white/25 bg-white/10 text-white",
                !completed && !current && "border-white/10 text-white/35",
              )}>
                {completed ? <Check className="h-4 w-4" /> : step}
              </span>
              <div>
                <p className={cn("text-[13px] font-bold", current ? "text-white" : "text-white/45")}>{label}</p>
                {current && <p className="mt-0.5 text-[10px] text-coral">{progress}% complete</p>}
              </div>
            </div>
          );
        })}
      </div>

      <div className="relative mt-auto rounded-2xl border border-white/10 bg-white/[.055] p-4">
        <div className="flex items-center gap-2 text-[11px] font-bold text-white/75">
          <ShieldCheck className="h-4 w-4 text-coral" /> Everything is hotel-specific
        </div>
        <p className="mt-2 text-[10px] leading-relaxed text-white/42">Rates, rooms, taxes and staff access are saved only to this property.</p>
      </div>
      <button onClick={onSkip} className="relative mt-5 text-left text-[11px] font-semibold text-white/40 hover:text-white/70">
        Skip the guided setup
      </button>
    </aside>
  );
}

function MobileProgress({
  hotelName,
  currentStep,
}: {
  hotelName?: string;
  currentStep: number;
}) {
  return (
    <div className="sticky top-0 z-30 border-b border-line bg-paper/95 px-5 py-4 backdrop-blur lg:hidden">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-display text-[21px] font-semibold italic">Innflo</p>
          <p className="mt-0.5 max-w-[220px] truncate text-[10px] font-bold uppercase tracking-wider text-ink-mute">{hotelName || "Property setup"}</p>
        </div>
        <span className="text-[11px] font-bold text-coral-dark">{currentStep} / {STEP_LABELS.length}</span>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-coral-soft">
        <motion.div className="h-full rounded-full bg-coral" animate={{ width: `${(currentStep / STEP_LABELS.length) * 100}%` }} />
      </div>
    </div>
  );
}

function StepHeader({
  eyebrow,
  title,
  subtitle,
  onBack,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  onBack: () => void;
}) {
  return (
    <div className="mb-8">
      <button onClick={onBack} className="mb-6 inline-flex items-center gap-1 text-[12px] font-bold text-ink-mute hover:text-ink">
        <ChevronLeft className="h-4 w-4" /> Back
      </button>
      <p className="mb-3 text-[10px] font-bold uppercase tracking-[.18em] text-coral-dark">{eyebrow}</p>
      <h1 className="font-display text-[clamp(32px,4vw,46px)] font-semibold leading-[1.04] text-ink">{title}</h1>
      <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-ink-soft">{subtitle}</p>
    </div>
  );
}

function StepWelcome({ ownerName, onNext }: { ownerName: string; onNext: () => void }) {
  return (
    <div>
      <div className="inline-flex items-center gap-2 rounded-full bg-coral-soft px-3 py-2 text-[10px] font-bold uppercase tracking-[.15em] text-coral-dark">
        <Sparkles className="h-3.5 w-3.5" /> About five useful minutes
      </div>
      <h1 className="mt-6 font-display text-[clamp(40px,6vw,64px)] font-semibold leading-[.98] text-ink">
        Welcome, {ownerName}.<br /><span className="italic text-coral-dark">Let’s open the hotel.</span>
      </h1>
      <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-ink-soft">
        We’ll configure the details that make reservations, receipts and staff workflows work properly. Everything else can wait until the first shift.
      </p>

      <div className="mt-9 grid gap-3">
        {LAUNCH_OUTCOMES.map(({ icon: Icon, title, copy }, index) => (
          <motion.div
            key={title}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 + index * 0.07 }}
            className="flex items-start gap-4 rounded-2xl border border-line bg-card p-4 shadow-card"
          >
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-ink text-coral"><Icon className="h-4.5 w-4.5" /></div>
            <div>
              <p className="text-[13px] font-bold text-ink">{title}</p>
              <p className="mt-1 text-[12px] leading-relaxed text-ink-mute">{copy}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <button onClick={onNext} className={cn(primaryButton, "mt-8")}>
        Set up my property <ArrowRight className="ml-2 h-4 w-4" />
      </button>
    </div>
  );
}

type ProfileForm = {
  name: string;
  propertyType: string;
  city: string;
  address: string;
  phone: string;
  email: string;
  checkInTime: string;
  checkOutTime: string;
  shiftMorningStart: string;
  shiftEveningStart: string;
  shiftNightStart: string;
  description: string;
  gstEnabled: boolean;
  gstRate: string;
  pstEnabled: boolean;
  pstRate: string;
  taxInclusive: boolean;
};

function StepHotelProfile({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const { data: settings, isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: settingsService.getSettings,
    staleTime: 30_000,
  });
  const [form, setForm] = useState<ProfileForm>({
    name: "",
    propertyType: "HOTEL",
    city: "",
    address: "",
    phone: "",
    email: "",
    checkInTime: "14:00",
    checkOutTime: "12:00",
    shiftMorningStart: "06:00",
    shiftEveningStart: "14:00",
    shiftNightStart: "22:00",
    description: "",
    gstEnabled: false,
    gstRate: "0",
    pstEnabled: false,
    pstRate: "0",
    taxInclusive: false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);

  useEffect(() => {
    if (!settings) return;
    const values = settings.settings ?? {};
    setForm({
      name: settings.name ?? "",
      propertyType: settings.propertyType ?? "HOTEL",
      city: settings.city ?? "",
      address: settings.address ?? "",
      phone: settings.phone ?? "",
      email: settings.email ?? "",
      checkInTime: String(values.checkInTime ?? "14:00"),
      checkOutTime: String(values.checkOutTime ?? "12:00"),
      shiftMorningStart: String(values.shiftMorningStart ?? "06:00"),
      shiftEveningStart: String(values.shiftEveningStart ?? "14:00"),
      shiftNightStart: String(values.shiftNightStart ?? "22:00"),
      description: settings.description ?? "",
      gstEnabled: booleanSetting(values.gstEnabled, false),
      gstRate: String(numberSetting(values.gstRate, 0)),
      pstEnabled: booleanSetting(values.pstEnabled, false),
      pstRate: String(numberSetting(values.pstRate, 0)),
      taxInclusive: booleanSetting(values.taxInclusive, false),
    });
  }, [settings]);

  async function handleSave() {
    if (!form.name.trim() || !form.city.trim()) {
      setError("Hotel name and city are required.");
      return;
    }
    const nextPhoneError = form.phone.trim() ? getPhoneErrorMessage(form.phone) : null;
    if (nextPhoneError) {
      setPhoneError(nextPhoneError);
      return;
    }
    const gstRate = numberSetting(form.gstRate, 0);
    const pstRate = numberSetting(form.pstRate, 0);
    if ((form.gstEnabled && (gstRate < 0 || gstRate > 100)) || (form.pstEnabled && (pstRate < 0 || pstRate > 100))) {
      setError("Tax rates must be between 0 and 100.");
      return;
    }
    const toMinutes = (value: string) => {
      const [hour, minute] = value.split(":").map(Number);
      return hour * 60 + minute;
    };
    if (!(
      toMinutes(form.shiftMorningStart) < toMinutes(form.shiftEveningStart)
      && toMinutes(form.shiftEveningStart) < toMinutes(form.shiftNightStart)
    )) {
      setError("Shift starts must be ordered Morning, Evening, then Night.");
      return;
    }

    setError(null);
    setPhoneError(null);
    setSaving(true);
    try {
      const dto: UpdateSettingsDto = {
        name: form.name.trim(),
        propertyType: form.propertyType,
        city: form.city.trim(),
        address: form.address.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        checkInTime: form.checkInTime,
        checkOutTime: form.checkOutTime,
        shiftMorningStart: form.shiftMorningStart,
        shiftEveningStart: form.shiftEveningStart,
        shiftNightStart: form.shiftNightStart,
        description: form.description.trim(),
        gstEnabled: form.gstEnabled,
        gstRate: form.gstEnabled ? gstRate : 0,
        pstEnabled: form.pstEnabled,
        pstRate: form.pstEnabled ? pstRate : 0,
        taxInclusive: form.taxInclusive,
        onboardingStep: 2,
      };
      await settingsService.updateSettings(dto);
      onNext();
    } catch {
      setError("We couldn’t save the property profile. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (isLoading) return <div className="h-[520px] animate-pulse rounded-3xl bg-line-soft" />;

  return (
    <div>
      <StepHeader
        eyebrow="Property essentials"
        title="Make every guest-facing detail yours."
        subtitle="These details power receipts, confirmation emails, hotel policies and day-to-day operating rules."
        onBack={onBack}
      />
      {error && <ErrorNotice message={error} />}

      <div className="space-y-5">
        <div className="rounded-2xl border border-line bg-card p-5">
          <div className="mb-5 flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-coral-soft"><Building2 className="h-4 w-4 text-coral-dark" /></div>
            <div><p className="text-[13px] font-bold">Hotel identity</p><p className="text-[11px] text-ink-mute">Shown to guests and staff</p></div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className={labelCls}>Hotel name *
              <input className={cn(inputCls, "mt-1.5")} value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Mountain View Hotel" />
            </label>
            <label className={labelCls}>Property type
              <div className="relative mt-1.5">
                <select className={selectCls} value={form.propertyType} onChange={(event) => setForm((current) => ({ ...current, propertyType: event.target.value }))}>
                  {PROPERTY_TYPES.map((type) => <option key={type} value={type}>{PROPERTY_LABELS[type] ?? type}</option>)}
                </select>
                <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-mute" />
              </div>
            </label>
            <label className={labelCls}>City *
              <div className="relative mt-1.5"><MapPin className="absolute left-3 top-3.5 h-4 w-4 text-ink-faint" /><input className={cn(inputCls, "pl-9")} value={form.city} onChange={(event) => setForm((current) => ({ ...current, city: event.target.value }))} placeholder="Hunza" /></div>
            </label>
            <label className={labelCls}>Street address
              <input className={cn(inputCls, "mt-1.5")} value={form.address} onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))} placeholder="Karimabad Road, Hunza" />
            </label>
            <label className={labelCls}>Hotel phone
              <input
                className={cn(inputCls, "mt-1.5", phoneError && "border-clay")}
                value={form.phone}
                onChange={(event) => { setForm((current) => ({ ...current, phone: event.target.value })); setPhoneError(null); }}
                onBlur={() => setPhoneError(form.phone.trim() ? getPhoneErrorMessage(form.phone) : null)}
                placeholder="03XX XXXXXXX"
              />
              {phoneError && <span className="mt-1 block text-[11px] text-clay">{phoneError}</span>}
            </label>
            <label className={labelCls}>Hotel email
              <div className="relative mt-1.5"><Mail className="absolute left-3 top-3.5 h-4 w-4 text-ink-faint" /><input type="email" className={cn(inputCls, "pl-9")} value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} placeholder="stay@hotel.com" /></div>
            </label>
          </div>
        </div>

        <div className="grid items-stretch gap-5 xl:grid-cols-2">
          <div className="flex h-full flex-col rounded-2xl border border-line bg-card p-5">
            <div className="mb-4 flex min-h-[48px] items-start gap-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-coral-soft"><Clock3 className="h-4 w-4 text-coral-dark" /></div>
              <div>
                <p className="text-[13px] font-bold">Operating day</p>
                <p className="text-[10px] text-ink-mute">Guest arrival and departure defaults</p>
              </div>
            </div>
            <div className="mt-auto grid grid-cols-2 gap-3">
              <label className={labelCls}>Check-in
                <input type="time" className={cn(inputCls, "mt-1.5")} value={form.checkInTime} onChange={(event) => setForm((current) => ({ ...current, checkInTime: event.target.value }))} />
              </label>
              <label className={labelCls}>Check-out
                <input type="time" className={cn(inputCls, "mt-1.5")} value={form.checkOutTime} onChange={(event) => setForm((current) => ({ ...current, checkOutTime: event.target.value }))} />
              </label>
            </div>
          </div>

          <div className="flex h-full flex-col rounded-2xl border border-line bg-card p-5">
            <div className="mb-4 flex min-h-[48px] items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-coral-soft"><ReceiptText className="h-4 w-4 text-coral-dark" /></div>
                <div><p className="text-[13px] font-bold">Taxes</p><p className="text-[10px] text-ink-mute">Optional—fine-tune later</p></div>
              </div>
              <label className="flex cursor-pointer items-center gap-2 pt-2 text-[10px] font-bold text-ink-mute">
                <input type="checkbox" checked={form.taxInclusive} onChange={(event) => setForm((current) => ({ ...current, taxInclusive: event.target.checked }))} className="h-4 w-4 shrink-0 accent-coral" />
                Prices include tax
              </label>
            </div>
            <div className="mt-auto grid grid-cols-2 gap-3">
              {([
                ["GST", "gstEnabled", "gstRate"],
                ["PST", "pstEnabled", "pstRate"],
              ] as const).map(([label, enabledKey, rateKey]) => (
                <div key={label} className={cn("flex min-h-[76px] flex-col justify-center rounded-xl border p-3 transition", form[enabledKey] ? "border-coral/30 bg-coral-soft/40" : "border-line bg-mist")}>
                  <label className="flex cursor-pointer items-center justify-between text-[11px] font-bold">
                    {label}
                    <input type="checkbox" checked={form[enabledKey]} onChange={(event) => setForm((current) => ({ ...current, [enabledKey]: event.target.checked }))} className="h-4 w-4 shrink-0 accent-coral" />
                  </label>
                  {form[enabledKey] && (
                    <div className="relative mt-2"><input type="number" min="0" max="100" step="0.01" value={form[rateKey]} onChange={(event) => setForm((current) => ({ ...current, [rateKey]: event.target.value }))} className={cn(inputCls, "py-2 pr-8")} /><span className="absolute right-3 top-2.5 text-[11px] text-ink-mute">%</span></div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-card p-5">
          <div className="mb-4 flex items-center gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-coral-soft">
              <Clock3 className="h-4 w-4 text-coral-dark" />
            </div>
            <div>
              <p className="text-[13px] font-bold">Staff shifts</p>
              <p className="text-[10px] text-ink-mute">Optional defaults — change them any time in Settings</p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {([
              ["Morning starts", "shiftMorningStart"],
              ["Evening starts", "shiftEveningStart"],
              ["Night starts", "shiftNightStart"],
            ] as const).map(([label, key]) => (
              <label key={key} className={labelCls}>
                {label}
                <input
                  type="time"
                  className={cn(inputCls, "mt-1.5")}
                  value={form[key]}
                  onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))}
                />
              </label>
            ))}
          </div>
        </div>

        <label className={labelCls}>Short property description
          <textarea className={cn(inputCls, "mt-1.5 h-20 resize-none")} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="A warm introduction for your Booking Engine and confirmation emails." />
        </label>
      </div>

      <button onClick={handleSave} disabled={saving} className={cn(primaryButton, "mt-7")}>
        {saving ? "Saving property…" : "Save & build rooms"} {!saving && <ArrowRight className="ml-2 h-4 w-4" />}
      </button>
    </div>
  );
}

function StepRooms({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const {
    data: roomTypesResponse,
    isLoading: roomTypesLoading,
    refetch: refetchRoomTypes,
  } = useQuery({ queryKey: ["onboarding-room-types"], queryFn: roomsService.getRoomTypes });
  const {
    data: roomsResponse,
    isLoading: roomsLoading,
    refetch: refetchRooms,
  } = useQuery({ queryKey: ["onboarding-rooms"], queryFn: () => roomsService.getRooms() });

  const roomTypes = roomTypesResponse?.data ?? [];
  const roomCount = roomsResponse?.meta.total ?? roomsResponse?.data.length ?? 0;
  const [selectedRoomTypeId, setSelectedRoomTypeId] = useState("");
  const [showTypeForm, setShowTypeForm] = useState(false);
  const [roomTypeForm, setRoomTypeForm] = useState({ name: "", baseRate: "", maxOccupancy: "2", bedType: "DOUBLE" as RoomTypeName });
  const [roomForm, setRoomForm] = useState({ number: "", floor: "" });
  const [recentRooms, setRecentRooms] = useState<string[]>([]);
  const [saving, setSaving] = useState<"type" | "room" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (roomTypes.length === 0) {
      setShowTypeForm(true);
      return;
    }
    if (!roomTypes.some((roomType) => roomType.id === selectedRoomTypeId)) {
      setSelectedRoomTypeId(roomTypes[0]?.id ?? "");
    }
  }, [roomTypes, selectedRoomTypeId]);

  const selectedRoomType = roomTypes.find((roomType) => roomType.id === selectedRoomTypeId);

  async function addRoomType() {
    if (!roomTypeForm.name.trim() || !roomTypeForm.baseRate || !roomTypeForm.maxOccupancy) {
      setError("Name, base rate and occupancy are required for a room type.");
      return;
    }
    const baseRate = Number(roomTypeForm.baseRate);
    const maxOccupancy = Number(roomTypeForm.maxOccupancy);
    if (!Number.isFinite(baseRate) || baseRate < 0 || !Number.isInteger(maxOccupancy) || maxOccupancy < 1) {
      setError("Enter a valid non-negative rate and an occupancy of at least one.");
      return;
    }

    setError(null);
    setSaving("type");
    try {
      const created = await roomsService.createRoomType({
        name: roomTypeForm.name.trim(),
        typeName: roomTypeForm.bedType,
        maxOccupancy,
        defaultRate: Math.round(baseRate * 100),
      });
      setSelectedRoomTypeId(created.id);
      setRoomTypeForm({ name: "", baseRate: "", maxOccupancy: "2", bedType: "DOUBLE" });
      setShowTypeForm(false);
      await refetchRoomTypes();
    } catch {
      setError("We couldn’t create that room type. Check the details and try again.");
    } finally {
      setSaving(null);
    }
  }

  async function addRoom() {
    if (!roomForm.number.trim() || !selectedRoomType) {
      setError("Choose a room type and enter a room number.");
      return;
    }
    const floor = roomForm.floor.trim() ? Number(roomForm.floor) : undefined;
    if (floor !== undefined && !Number.isInteger(floor)) {
      setError("Floor must be a whole number.");
      return;
    }

    setError(null);
    setSaving("room");
    try {
      const room = await roomsService.createRoom({
        number: roomForm.number.trim(),
        floor,
        roomTypeId: selectedRoomType.id,
        status: "VACANT_CLEAN" as RoomStatus,
      });
      setRecentRooms((current) => [`${room.number} · ${selectedRoomType.name}`, ...current].slice(0, 4));
      setRoomForm({ number: "", floor: "" });
      await refetchRooms();
    } catch {
      setError("We couldn’t add that room. The room number may already exist.");
    } finally {
      setSaving(null);
    }
  }

  if (roomTypesLoading || roomsLoading) return <div className="h-[500px] animate-pulse rounded-3xl bg-line-soft" />;

  return (
    <div>
      <StepHeader
        eyebrow="Rooms & rates"
        title="Build the hotel guests can book."
        subtitle="Create as many room categories as you need, select one, then add the physical rooms that belong to it."
        onBack={onBack}
      />
      {error && <ErrorNotice message={error} />}

      <div className="rounded-2xl border border-line bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[13px] font-bold">Room categories</p>
            <p className="mt-1 text-[11px] text-ink-mute">{roomTypes.length} configured · {roomCount} rooms in this hotel</p>
          </div>
          <button
            onClick={() => { setShowTypeForm(true); setError(null); }}
            className={secondaryButton}
          >
            <Plus className="mr-1.5 h-4 w-4 text-coral-dark" /> New room type
          </button>
        </div>

        {roomTypes.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-2">
            {roomTypes.map((roomType) => (
              <button
                key={roomType.id}
                onClick={() => { setSelectedRoomTypeId(roomType.id); setShowTypeForm(false); }}
                className={cn(
                  "rounded-xl border px-4 py-3 text-left transition",
                  roomType.id === selectedRoomTypeId && !showTypeForm
                    ? "border-coral bg-coral-soft text-coral-dark"
                    : "border-line bg-white text-ink-soft hover:border-coral/35",
                )}
              >
                <p className="text-[12px] font-bold">{roomType.name}</p>
                <p className="mt-0.5 text-[10px] opacity-65">PKR {(roomType.defaultRate / 100).toLocaleString()} · up to {roomType.maxOccupancy}</p>
              </button>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence mode="wait">
        {showTypeForm ? (
          <motion.div key="type-form" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-5 rounded-2xl border border-coral/20 bg-coral-soft/35 p-5">
            <div className="mb-5 flex items-center justify-between">
              <div><p className="text-[13px] font-bold">Create a room type</p><p className="mt-1 text-[11px] text-ink-mute">Example: Deluxe King, Family Suite, Garden Cottage</p></div>
              {roomTypes.length > 0 && <button onClick={() => setShowTypeForm(false)} className="text-[11px] font-bold text-ink-mute hover:text-ink">Cancel</button>}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className={labelCls}>Category name
                <input className={cn(inputCls, "mt-1.5")} value={roomTypeForm.name} onChange={(event) => setRoomTypeForm((current) => ({ ...current, name: event.target.value }))} placeholder="Deluxe Room" />
              </label>
              <label className={labelCls}>Bed / unit type
                <div className="relative mt-1.5">
                  <select className={selectCls} value={roomTypeForm.bedType} onChange={(event) => setRoomTypeForm((current) => ({ ...current, bedType: event.target.value as RoomTypeName }))}>
                    {BED_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
                  </select>
                  <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-mute" />
                </div>
              </label>
              <label className={labelCls}>Base nightly rate (PKR)
                <input type="number" min="0" className={cn(inputCls, "mt-1.5")} value={roomTypeForm.baseRate} onChange={(event) => setRoomTypeForm((current) => ({ ...current, baseRate: event.target.value }))} placeholder="8000" />
                {Number(roomTypeForm.baseRate) > 0 && <span className="mt-1 block text-[10px] italic text-ink-mute">{pkrInWords(Number(roomTypeForm.baseRate))}</span>}
              </label>
              <label className={labelCls}>Maximum guests
                <input type="number" min="1" className={cn(inputCls, "mt-1.5")} value={roomTypeForm.maxOccupancy} onChange={(event) => setRoomTypeForm((current) => ({ ...current, maxOccupancy: event.target.value }))} />
              </label>
            </div>
            <button onClick={addRoomType} disabled={saving !== null} className={cn(primaryButton, "mt-5")}>
              {saving === "type" ? "Creating category…" : "Create room type"}
            </button>
          </motion.div>
        ) : (
          <motion.div key="room-form" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-5 rounded-2xl border border-line bg-card p-5">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <p className="text-[13px] font-bold">Add a room to {selectedRoomType?.name || "a category"}</p>
                <p className="mt-1 text-[11px] text-ink-mute">Add one now to unlock the reservation calendar. Add the rest here or later from Rooms.</p>
              </div>
              <BedDouble className="h-5 w-5 shrink-0 text-coral-dark" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className={labelCls}>Room number
                <input className={cn(inputCls, "mt-1.5")} value={roomForm.number} onChange={(event) => setRoomForm((current) => ({ ...current, number: event.target.value }))} placeholder="101" />
              </label>
              <label className={labelCls}>Floor (optional)
                <input type="number" className={cn(inputCls, "mt-1.5")} value={roomForm.floor} onChange={(event) => setRoomForm((current) => ({ ...current, floor: event.target.value }))} placeholder="1" />
              </label>
            </div>
            <button onClick={addRoom} disabled={saving !== null || !selectedRoomType} className={cn(secondaryButton, "mt-5 w-full border-coral/40 text-coral-dark")}>
              <Plus className="mr-1.5 h-4 w-4" /> {saving === "room" ? "Adding room…" : "Add room"}
            </button>
            {recentRooms.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {recentRooms.map((room) => <span key={room} className="inline-flex items-center gap-1.5 rounded-full bg-pine-soft px-3 py-1.5 text-[10px] font-bold text-pine-deep"><Check className="h-3 w-3" />{room}</span>)}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {roomCount > 0 ? (
        <button onClick={onNext} className={cn(primaryButton, "mt-6")}>Continue with {roomCount} room{roomCount === 1 ? "" : "s"} <ArrowRight className="ml-2 h-4 w-4" /></button>
      ) : (
        <button onClick={onNext} className="mt-5 w-full text-center text-[12px] font-bold text-ink-mute hover:text-ink">Skip rooms for now</button>
      )}
    </div>
  );
}

type AddedMember = { name: string; roleLabel: string; tempPassword: string };

function StepTeam({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const { data: roles = [] } = useQuery<Role[]>({
    queryKey: ["roles"],
    queryFn: usersService.getRoles,
    staleTime: 5 * 60_000,
  });
  const teamRoleOptions = TEAM_ROLES
    .map((teamRole) => {
      const role = roles.find((candidate) => candidate.name === teamRole.name);
      return role ? { roleId: role.id, label: teamRole.label } : null;
    })
    .filter((role): role is { roleId: string; label: string } => role !== null);

  const [form, setForm] = useState({ name: "", email: "", roleId: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [members, setMembers] = useState<AddedMember[]>([]);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  async function addMember() {
    if (!form.name.trim() || !form.email.trim() || !form.roleId) {
      setError("Name, email and role are required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const tempPassword = generateTempPassword();
      await usersService.createUser({ name: form.name.trim(), email: form.email.trim(), password: tempPassword, roleId: form.roleId });
      const roleLabel = teamRoleOptions.find((role) => role.roleId === form.roleId)?.label ?? "Staff";
      setMembers((current) => [...current, { name: form.name.trim(), roleLabel, tempPassword }]);
      setForm({ name: "", email: "", roleId: "" });
    } catch {
      setError("We couldn’t create that login. The email may already be in use.");
    } finally {
      setSaving(false);
    }
  }

  function copyCredentials(member: AddedMember, index: number) {
    void navigator.clipboard.writeText(`Temporary password: ${member.tempPassword}`);
    setCopiedIndex(index);
    window.setTimeout(() => setCopiedIndex(null), 1500);
  }

  return (
    <div>
      <StepHeader
        eyebrow="People & access"
        title="Invite only the team you need today."
        subtitle="Every person gets an individual login and a role. Permissions can be fine-tuned later without sharing the owner account."
        onBack={onBack}
      />
      {error && <ErrorNotice message={error} />}

      <div className="rounded-2xl border border-line bg-card p-5">
        <div className="mb-5 flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-coral-soft"><Users className="h-4 w-4 text-coral-dark" /></div>
          <div><p className="text-[13px] font-bold">Create a staff login</p><p className="text-[11px] text-ink-mute">This step is optional</p></div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={labelCls}>Full name
            <input className={cn(inputCls, "mt-1.5")} value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Ayesha Khan" />
          </label>
          <label className={labelCls}>Email
            <input type="email" className={cn(inputCls, "mt-1.5")} value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} placeholder="ayesha@hotel.com" />
          </label>
          <label className={cn(labelCls, "sm:col-span-2")}>Role
            <div className="relative mt-1.5">
              <select className={selectCls} value={form.roleId} onChange={(event) => setForm((current) => ({ ...current, roleId: event.target.value }))}>
                <option value="">Select the staff role…</option>
                {teamRoleOptions.map((role) => <option key={role.roleId} value={role.roleId}>{role.label}</option>)}
              </select>
              <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-mute" />
            </div>
          </label>
        </div>
        <button onClick={addMember} disabled={saving} className={cn(secondaryButton, "mt-5 w-full border-coral/40 text-coral-dark")}>
          <Plus className="mr-1.5 h-4 w-4" /> {saving ? "Creating login…" : "Add team member"}
        </button>
      </div>

      {members.length > 0 && (
        <div className="mt-4 space-y-2">
          {members.map((member, index) => (
            <div key={`${member.name}-${index}`} className="flex flex-col justify-between gap-3 rounded-2xl border border-pine/20 bg-pine-soft p-4 sm:flex-row sm:items-center">
              <div>
                <p className="text-[12px] font-bold text-pine-deep"><CheckCircle2 className="mr-1.5 inline h-4 w-4" />{member.name} · {member.roleLabel}</p>
                <p className="mt-1 text-[11px] text-ink-mute">Temporary password: <span className="font-mono font-bold text-ink">{member.tempPassword}</span></p>
              </div>
              <button onClick={() => copyCredentials(member, index)} className="inline-flex items-center text-[11px] font-bold text-pine-deep">
                <Copy className="mr-1.5 h-3.5 w-3.5" />{copiedIndex === index ? "Copied" : "Copy"}
              </button>
            </div>
          ))}
        </div>
      )}

      <button onClick={onNext} className={cn(primaryButton, "mt-6")}>
        {members.length > 0 ? "Continue" : "Continue without staff"} <ArrowRight className="ml-2 h-4 w-4" />
      </button>
    </div>
  );
}

function StepTheme({ onBack, onFinish }: { onBack: () => void; onFinish: () => void }) {
  const [themeKey, setThemeKey] = useState<ThemeKey>("WARM_CLAY");
  const [saving, setSaving] = useState(false);

  function chooseTheme(key: ThemeKey) {
    setThemeKey(key);
    applyTheme(key);
  }

  async function finish() {
    setSaving(true);
    try {
      await settingsService.updateSettings({ themeKey, onboardingStep: 4 });
    } catch {
      // Theme is a preference, not a reason to block the hotel from opening.
    } finally {
      setSaving(false);
      onFinish();
    }
  }

  return (
    <div>
      <StepHeader
        eyebrow="Your workspace"
        title="Make the first shift feel like yours."
        subtitle="Choose a calm operating palette. This changes the staff PMS only and can be updated any time in Settings."
        onBack={onBack}
      />

      <div className="rounded-2xl border border-line bg-card p-5">
        <div className="mb-5 flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-coral-soft"><Palette className="h-4 w-4 text-coral-dark" /></div>
          <div><p className="text-[13px] font-bold">Choose a palette</p><p className="text-[11px] text-ink-mute">Live preview is applied immediately</p></div>
        </div>
        <ThemePicker value={themeKey} onChange={chooseTheme} />
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {[
          [Building2, "Property", "Saved"],
          [BedDouble, "Rooms", "Ready to sell"],
          [ShieldCheck, "Access", "Role-based"],
        ].map(([Icon, label, status]) => {
          const SummaryIcon = Icon as LucideIcon;
          return (
            <div key={String(label)} className="rounded-2xl border border-line bg-mist p-4">
              <SummaryIcon className="h-4 w-4 text-coral-dark" />
              <p className="mt-3 text-[11px] font-bold text-ink">{String(label)}</p>
              <p className="mt-0.5 text-[10px] text-ink-mute">{String(status)}</p>
            </div>
          );
        })}
      </div>

      <button onClick={finish} disabled={saving} className={cn(primaryButton, "mt-7")}>
        {saving ? "Opening Innflo…" : "Open my dashboard"} {!saving && <Rocket className="ml-2 h-4 w-4" />}
      </button>
    </div>
  );
}

function CompletionOverlay({ onDone }: { onDone: () => void }) {
  const [lineIndex, setLineIndex] = useState(0);

  useEffect(() => {
    const lineTimer = window.setInterval(() => {
      setLineIndex((current) => Math.min(current + 1, COMPLETION_LINES.length - 1));
    }, 950);
    const doneTimer = window.setTimeout(onDone, 4400);
    return () => {
      window.clearInterval(lineTimer);
      window.clearTimeout(doneTimer);
    };
  }, [onDone]);

  return (
    <motion.div className="fixed inset-0 z-50 grid place-items-center overflow-hidden bg-ink px-6 text-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="absolute inset-0 opacity-[0.08] [background-image:radial-gradient(circle_at_center,white_1px,transparent_1px)] [background-size:24px_24px]" />
      <motion.div className="relative w-full max-w-lg" initial={{ opacity: 0, y: 22, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ delay: 0.1, duration: 0.5, ease: "easeOut" }}>
        <div className="relative mx-auto h-36 w-52">
          {PACKING_ICONS.map((Icon, index) => {
            const angle = (index / PACKING_ICONS.length) * Math.PI * 2 - Math.PI / 2;
            const startX = Math.cos(angle) * 82;
            const startY = Math.sin(angle) * 52;
            return (
              <motion.div
                key={Icon.displayName ?? index}
                className="absolute left-1/2 top-[42%] grid h-10 w-10 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-xl border border-white/15 bg-white/10 text-white backdrop-blur-sm"
                initial={{ x: startX, y: startY, opacity: 0, scale: 0.75 }}
                animate={{ x: [startX, startX, 0], y: [startY, startY, 32], opacity: [0, 1, 0], scale: [0.75, 1, 0.55] }}
                transition={{ delay: 0.18 + index * 0.09, duration: 1.55, times: [0, 0.48, 1], ease: "easeInOut" }}
              >
                <Icon className="h-4 w-4" />
              </motion.div>
            );
          })}
          <motion.div
            className="absolute bottom-0 left-1/2 grid h-24 w-24 -translate-x-1/2 place-items-center rounded-[26px] bg-coral text-white shadow-pop"
            initial={{ opacity: 0, scale: 0.55, rotate: -7 }}
            animate={{ opacity: 1, scale: [0.55, 1.08, 1], rotate: [-7, 3, 0] }}
            transition={{ delay: 1.25, duration: 0.7, ease: "easeOut" }}
          >
            <Package className="h-11 w-11" />
            <motion.span
              className="absolute right-1 top-1 grid h-7 w-7 place-items-center rounded-full bg-pine text-white"
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 2.25, type: "spring", stiffness: 360, damping: 18 }}
            >
              <Check className="h-4 w-4" />
            </motion.span>
          </motion.div>
        </div>

        <p className="mt-7 text-[10px] font-bold uppercase tracking-[.22em] text-coral">Putting everything together</p>
        <div className="mt-3 min-h-[52px]">
          <AnimatePresence mode="wait">
            <motion.h2
              key={lineIndex}
              className="font-display text-[clamp(30px,5vw,46px)] font-semibold text-white"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.24 }}
            >
              {COMPLETION_LINES[lineIndex]}
            </motion.h2>
          </AnimatePresence>
        </div>

        <div className="mx-auto mt-7 flex max-w-xs gap-1.5">
          {COMPLETION_LINES.map((_, index) => (
            <motion.span
              key={index}
              className={cn("h-1 flex-1 rounded-full", index <= lineIndex ? "bg-coral" : "bg-white/15")}
              layout
            />
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function OnboardingPage() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [direction, setDirection] = useState(1);
  const [completing, setCompleting] = useState(false);

  const { data: hotel } = useQuery({ queryKey: ["onboarding-hotel-me"], queryFn: hotelsService.getMe });
  const { data: staff = [] } = useQuery({ queryKey: ["onboarding-users"], queryFn: usersService.getUsers });
  const ownerName = staff.find((member) => member.user.id === getCurrentUserId())?.user.name?.split(" ")[0] ?? "there";

  function goTo(step: number) {
    setDirection(step > currentStep ? 1 : -1);
    setCurrentStep(step);
  }

  async function finishNow() {
    await authService.completeOnboarding();
    localStorage.setItem("isFirstLogin", "false");
    localStorage.setItem("onboardingCompleted", "true");
    navigate("/");
  }

  return (
    <div className="min-h-screen bg-paper lg:flex">
      <DesktopRail hotelName={hotel?.name} currentStep={currentStep} onSkip={() => void finishNow()} />
      <main className="min-h-screen min-w-0 flex-1">
        <MobileProgress hotelName={hotel?.name} currentStep={currentStep} />
        <div className="mx-auto w-full max-w-3xl px-5 py-8 sm:px-8 sm:py-12 lg:px-12 lg:py-14">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div key={currentStep} custom={direction} variants={stepVariants} initial="initial" animate="animate" exit="exit" transition={stepTransition}>
              {currentStep === 1 && <StepWelcome ownerName={ownerName} onNext={() => goTo(2)} />}
              {currentStep === 2 && <StepHotelProfile onBack={() => goTo(1)} onNext={() => goTo(3)} />}
              {currentStep === 3 && <StepRooms onBack={() => goTo(2)} onNext={() => goTo(4)} />}
              {currentStep === 4 && <StepTeam onBack={() => goTo(3)} onNext={() => goTo(5)} />}
              {currentStep === 5 && <StepTheme onBack={() => goTo(4)} onFinish={() => setCompleting(true)} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      <AnimatePresence>{completing && <CompletionOverlay onDone={() => void finishNow()} />}</AnimatePresence>
    </div>
  );
}
