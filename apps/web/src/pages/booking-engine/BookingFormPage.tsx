import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Calendar as DateCalendar } from "react-date-range";
import "react-date-range/dist/styles.css";
import "react-date-range/dist/theme/default.css";
import {
  ArrowLeft, CheckCircle2, AlertTriangle, Minus, Plus, ChevronLeft, ChevronDown,
  Lock, Calendar, FileText, ShieldCheck, UserRound, Users, Gift, Cake, Heart, X,
} from "lucide-react";
import {
  bookingEngineService,
  upsellLineAmount,
  type BookMultiConfirmation,
  type CartItem,
  type CartUpsell,
} from "@/services/bookingEngine";
import { cn } from "@/lib/cn";
import { getPhoneErrorMessage, getEmailErrorMessage } from "@/lib/validation";
import { calculateAccommodationCharges } from "@/lib/accommodationCharges";
import type { PublicHotel } from "@/services/bookingEngine";

const CART_KEY = (slug: string) => `be_cart_${slug}`;
const UPSELL_KEY = (slug: string) => `be_upsells_${slug}`;
const PROMO_KEY = (slug: string) => `be_promo_${slug}`;

const fmt = (pkr: number) =>
  new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR", maximumFractionDigits: 0 }).format(pkr);

function fmtDate(iso: string) {
  if (!iso) return "";
  return new Intl.DateTimeFormat("en-PK", {
    weekday: "short", day: "numeric", month: "short",
  }).format(new Date(iso + "T00:00:00"));
}

function getErrorMessage(err: unknown): string {
  if (err && typeof err === "object" && "response" in err) {
    const res = (err as { response?: { data?: { error?: string } } }).response;
    return res?.data?.error ?? "Something went wrong. Please try again.";
  }
  return "Something went wrong. Please try again.";
}

// ── Field wrapper ─────────────────────────────────────────────────────────────

function Field({ label, required, optional, error, children }: {
  label: string; required?: boolean; optional?: boolean; error?: string | null; children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[13px] font-medium text-gray-700">
        {label}
        {required && <span className="ml-1 text-rose-400">*</span>}
        {optional && <span className="ml-1.5 text-[11px] font-normal text-gray-400">(optional)</span>}
      </label>
      {children}
      {error && <p className="text-[12px] text-rose-500 font-medium">{error}</p>}
    </div>
  );
}

// ── Styled input ──────────────────────────────────────────────────────────────

function Input({
  error, className, ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { error?: string | null }) {
  const [focused, setFocused] = useState(false);
  return (
    <input
      {...props}
      onFocus={(e) => { setFocused(true); props.onFocus?.(e); }}
      onBlur={(e)  => { setFocused(false); props.onBlur?.(e); }}
      className={cn(
        "w-full rounded-xl px-4 py-3 text-[15px] text-gray-900 placeholder:text-gray-300 bg-white outline-none transition-all",
        error   ? "border-2 border-rose-400"
        : focused ? "border-2 border-gray-900 shadow-[0_0_0_4px_rgba(0,0,0,0.04)]"
                  : "border border-gray-200",
        className,
      )}
    />
  );
}

// ── Date field ────────────────────────────────────────────────────────────────
// The native <input type="date"> picker renders in the browser's own chrome,
// which ignores the engine accent. This mirrors the app's DatePicker instead so
// the calendar matches the rest of the booking engine.

function toLocalDateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function parseLocalDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function DateField({
  value, onChange, max, placeholder = "Select date", icon,
}: {
  value: string;
  onChange: (value: string) => void;
  max?: string;
  placeholder?: string;
  icon: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const width = 336;
    const height = 380;
    const left = Math.min(rect.left, window.innerWidth - width - 12);
    const flipUp = rect.bottom + height > window.innerHeight && rect.top > height;
    setCoords({
      top: flipUp ? rect.top - height - 8 : rect.bottom + 8,
      left: Math.max(12, left),
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      setOpen(false);
    };
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    const handleScrollOrResize = () => setOpen(false);
    document.addEventListener("mousedown", handleClick, true);
    document.addEventListener("keydown", handleKey);
    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);
    return () => {
      document.removeEventListener("mousedown", handleClick, true);
      document.removeEventListener("keydown", handleKey);
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [open]);

  const display = value
    ? new Intl.DateTimeFormat("en-PK", { day: "numeric", month: "long", year: "numeric" }).format(parseLocalDate(value))
    : "";

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-xl bg-white px-4 py-3 text-left text-[15px] outline-none transition-all",
          open ? "border-2 border-gray-900 shadow-[0_0_0_4px_rgba(0,0,0,0.04)]" : "border border-gray-200",
        )}
      >
        <span className="shrink-0 text-gray-400">{icon}</span>
        <span className={cn("flex-1 truncate", display ? "text-gray-900" : "text-gray-300")}>
          {display || placeholder}
        </span>
        {value ? (
          <span
            role="button"
            tabIndex={-1}
            aria-label="Clear date"
            onClick={(e) => { e.stopPropagation(); onChange(""); setOpen(false); }}
            className="shrink-0 rounded-full p-0.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
          >
            <X size={14} />
          </span>
        ) : (
          <Calendar size={15} className="shrink-0 text-gray-400" />
        )}
      </button>

      {open && createPortal(
        <div
          ref={popoverRef}
          style={{ position: "fixed", top: coords.top, left: coords.left }}
          className="z-[100] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl"
        >
          <DateCalendar
            date={value ? parseLocalDate(value) : new Date()}
            onChange={(d: Date) => { onChange(toLocalDateString(d)); setOpen(false); }}
            maxDate={max ? parseLocalDate(max) : undefined}
            color="rgb(var(--be-accent))"
          />
        </div>,
        document.body,
      )}
    </>
  );
}

function Textarea({
  className, ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const [focused, setFocused] = useState(false);
  return (
    <textarea
      {...props}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      className={cn(
        "w-full rounded-xl px-4 py-3 text-[15px] text-gray-900 placeholder:text-gray-300 bg-white outline-none resize-none transition-all",
        focused ? "border-2 border-gray-900 shadow-[0_0_0_4px_rgba(0,0,0,0.04)]"
                : "border border-gray-200",
        className,
      )}
    />
  );
}

// ── Stepper ───────────────────────────────────────────────────────────────────

function Stepper({ value, min = 0, max = 99, onChange, accentColor }: {
  value: number; min?: number; max?: number; onChange: (v: number) => void; accentColor: string;
}) {
  return (
    <div className="flex items-center gap-0 rounded-xl border border-gray-200 bg-white overflow-hidden w-max">
      <button type="button" disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
        className="h-11 w-11 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-50 disabled:opacity-30 transition-colors">
        <Minus size={14} strokeWidth={2.5} />
      </button>
      <span className="w-10 text-center text-[16px] font-bold text-gray-900 select-none">{value}</span>
      <button type="button" disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
        className="h-11 w-11 flex items-center justify-center text-white disabled:opacity-30 transition-opacity"
        style={{ background: accentColor }}>
        <Plus size={14} strokeWidth={2.5} />
      </button>
    </div>
  );
}

// ── Booking Summary ───────────────────────────────────────────────────────────

function SummaryCard({ cart, upsells, checkIn, checkOut, nights, adults, children, promoCode, accentColor, cancellationPolicy, taxSettings }: {
  cart: CartItem[]; upsells: CartUpsell[]; checkIn: string; checkOut: string;
  nights: number; adults: number; children: number; promoCode: string; accentColor: string;
  cancellationPolicy: string | null;
  taxSettings: PublicHotel["accommodationTax"];
}) {
  const nightlyTotal = cart.reduce((s, c) => s + (c.ratePerNight ?? c.defaultRate) * c.quantity, 0);
  const charges = calculateAccommodationCharges(
    nightlyTotal * nights,
    taxSettings as unknown as Record<string, unknown>,
  );
  const upsellsTotal = upsells.reduce((s, u) => s + upsellLineAmount(u, nights, adults + children), 0);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.05)] overflow-hidden sticky top-24">
      {/* Header band */}
      <div className="px-5 py-4 border-b border-gray-50">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-gray-400 mb-0.5">Your stay</p>
        <div className="flex items-center gap-2 text-[13px] font-semibold text-gray-700">
          <Calendar size={13} className="text-gray-400" />
          <span>{fmtDate(checkIn)}</span>
          <span className="text-gray-300">→</span>
          <span>{fmtDate(checkOut)}</span>
          <span className="ml-auto text-gray-400 font-medium">{nights}N</span>
        </div>
      </div>

      {/* Room lines */}
      <div className="px-5 py-4 flex flex-col gap-3 border-b border-gray-50">
        {cart.map((c) => {
          const rate      = c.ratePerNight ?? c.defaultRate;
          const subtotal  = rate * c.quantity * nights;
          return (
            <div key={c.roomTypeId}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <div className="h-2 w-2 rounded-full mt-[5px] shrink-0" style={{ background: accentColor }} />
                  <div>
                    <p className="text-[13px] font-semibold text-gray-800 leading-snug">
                      {c.quantity > 1 ? `${c.quantity}× ` : ""}{c.roomTypeName}
                    </p>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      {fmt(rate)} × {c.quantity > 1 ? `${c.quantity} rooms × ` : ""}{nights} night{nights !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
                <span className="text-[13px] font-semibold text-gray-800 shrink-0">{fmt(subtotal)}</span>
              </div>
            </div>
          );
        })}
      </div>

      {upsells.length > 0 && (
        <div className="px-5 py-4 flex flex-col gap-2.5 border-b border-gray-50">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-gray-400">Extras</p>
          {upsells.map((u) => (
            <div key={u.upsellItemId} className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[13px] font-semibold text-gray-800 leading-snug">
                  {u.quantity > 1 ? `${u.quantity}× ` : ""}{u.name}
                </p>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  {fmt(u.unitAmount)}
                  {u.priceType === "PER_NIGHT" ? ` × ${nights} night${nights !== 1 ? "s" : ""}`
                    : u.priceType === "PER_GUEST" ? ` × ${adults + children} guest${adults + children !== 1 ? "s" : ""}`
                    : ""}
                </p>
              </div>
              <span className="text-[13px] font-semibold text-gray-800 shrink-0">
                {fmt(upsellLineAmount(u, nights, adults + children))}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="px-5 py-3 border-b border-gray-50 text-[12px] text-gray-500 flex items-center justify-between gap-3">
        <span>{adults} adult{adults !== 1 ? "s" : ""}{children > 0 ? ` · ${children} child${children !== 1 ? "ren" : ""}` : ""}</span>
        <span>{cart.reduce((sum, item) => sum + item.quantity, 0)} room{cart.reduce((sum, item) => sum + item.quantity, 0) !== 1 ? "s" : ""}</span>
      </div>

      {promoCode && <div className="px-5 py-3 border-b border-gray-50 text-[12px] font-semibold" style={{ color: accentColor }}>Promo / corporate code: {promoCode}</div>}

      {cancellationPolicy && (
        <div className="px-5 py-4 border-b border-gray-50">
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck size={14} style={{ color: accentColor }} />
            <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-gray-500">Cancellation policy</p>
          </div>
          <p className="text-[12px] leading-relaxed text-gray-600 whitespace-pre-line line-clamp-5">{cancellationPolicy}</p>
          <a href="#booking-terms" className="inline-block mt-2 text-[11.5px] font-semibold hover:opacity-70" style={{ color: accentColor }}>Read full policy</a>
        </div>
      )}

      {/* Total */}
      <div className="px-5 py-4">
        {charges.taxBreakdown.map((tax) => (
          <div key={tax.key} className="mb-2 flex items-center justify-between text-[12px] text-gray-500">
            <span>{tax.label} ({tax.rate}%){charges.taxInclusive ? " · included" : ""}</span>
            <span>{fmt(tax.amount)}</span>
          </div>
        ))}
        {upsellsTotal > 0 && (
          <div className="mb-2 flex items-center justify-between text-[12px] text-gray-500">
            <span>Extras</span>
            <span>{fmt(upsellsTotal)}</span>
          </div>
        )}
        <div className="flex items-baseline justify-between mb-3">
          <span className="text-[13px] font-medium text-gray-500">Estimated total</span>
          <span className="text-[24px] font-bold text-gray-900 leading-none">{fmt(charges.totalAmount + upsellsTotal)}</span>
        </div>
        <div className="flex items-center gap-2 text-[11.5px] text-gray-400 mb-4">
          <Lock size={11} />
          <span>No payment collected now. Hotel will confirm.</span>
        </div>
        <Link to={`/?checkIn=${checkIn}&checkOut=${checkOut}`}
          className="flex items-center gap-1 text-[12px] font-semibold transition-opacity hover:opacity-70"
          style={{ color: accentColor }}>
          <ChevronLeft size={13} /> Change rooms
        </Link>
      </div>
    </div>
  );
}

// ── Compact mobile summary ────────────────────────────────────────────────────

function CompactSummary({ cart, upsells, checkIn, checkOut, nights, adults, children, promoCode, accentColor, taxSettings }: {
  cart: CartItem[]; upsells: CartUpsell[]; checkIn: string; checkOut: string;
  nights: number; adults: number; children: number; promoCode: string; accentColor: string;
  taxSettings: PublicHotel["accommodationTax"];
}) {
  const charges = calculateAccommodationCharges(
    cart.reduce((s, c) => s + (c.ratePerNight ?? c.defaultRate) * c.quantity, 0) * nights,
    taxSettings as unknown as Record<string, unknown>,
  );
  const upsellsTotal = upsells.reduce((s, u) => s + upsellLineAmount(u, nights, adults + children), 0);

  return (
    <div className="flex items-center justify-between gap-3 px-5 py-3">
      <div className="min-w-0">
        <p className="text-[12px] text-gray-500 truncate">
          {cart.map((c) => `${c.quantity > 1 ? `${c.quantity}× ` : ""}${c.roomTypeName}`).join(" + ")}
          {" · "}{nights} night{nights !== 1 ? "s" : ""}
          {upsells.length > 0 && ` · ${upsells.length} extra${upsells.length !== 1 ? "s" : ""}`}
        </p>
        <p className="text-[12px] text-gray-500">{adults} adult{adults !== 1 ? "s" : ""}{children > 0 ? ` · ${children} child${children !== 1 ? "ren" : ""}` : ""}{promoCode ? ` · ${promoCode}` : ""}</p>
        <p className="text-[15px] font-bold text-gray-900">
          {fmt(charges.totalAmount + upsellsTotal)}
          {charges.taxAmount > 0 && (
            <span className="ml-1 text-[10px] font-medium text-gray-400">
              tax {charges.taxInclusive ? "included" : "added"}
            </span>
          )}
        </p>
      </div>
      <Link to={`/?checkIn=${checkIn}&checkOut=${checkOut}`}
        className="text-[12px] font-semibold shrink-0 px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">
        Edit
      </Link>
    </div>
  );
}

// ── Success screen ────────────────────────────────────────────────────────────

function SuccessScreen({ confirmation, themeKey }: {
  confirmation: BookMultiConfirmation; themeKey: string;
}) {
  const isMulti = confirmation.rooms.length > 1;

  return (
    <div className="booking-theme min-h-screen bg-[#F8F7F5] flex items-center justify-center p-5" data-be-theme={themeKey}>
      <div className="w-full max-w-md">
        {/* Top card */}
        <div className="bg-white rounded-3xl shadow-[0_4px_24px_rgba(0,0,0,0.07)] border border-gray-100 overflow-hidden">
          {/* Colored band */}
          <div className="h-2" style={{ background: "rgb(var(--be-accent))" }} />

          <div className="p-8 text-center">
            {/* Icon */}
            <div className="mx-auto mb-5 h-16 w-16 rounded-2xl flex items-center justify-center"
              style={{ background: "rgb(var(--be-accent-soft))" }}>
              <CheckCircle2 size={34} style={{ color: "rgb(var(--be-accent))" }} strokeWidth={1.5} />
            </div>

            <h1 className="be-serif text-[28px] font-semibold text-gray-900 mb-2">
              {isMulti ? "Rooms Reserved!" : "Room Reserved!"}
            </h1>
            <p className="text-[14px] text-gray-500 leading-relaxed max-w-xs mx-auto">
              {confirmation.message}
            </p>
          </div>

          {/* Confirmation numbers */}
          <div className="mx-5 mb-5 rounded-2xl bg-gray-50 border border-gray-100 overflow-hidden">
            {isMulti ? (
              <>
                <div className="px-4 py-3 border-b border-gray-100">
                  <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-gray-400 mb-0.5">Group Reference</p>
                  <p className="font-mono text-[20px] font-bold" style={{ color: "rgb(var(--be-accent))" }}>
                    {confirmation.confirmationReference}
                  </p>
                </div>
                <div className="px-4 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-gray-400 mb-2.5">Per Room</p>
                  <div className="flex flex-col gap-2">
                    {confirmation.rooms.map((r) => (
                      <div key={r.confirmationNumber} className="flex items-center justify-between gap-3">
                        <span className="text-[13px] text-gray-600 truncate">{r.roomTypeName}</span>
                        <span className="font-mono text-[13px] font-bold text-gray-800 shrink-0">{r.confirmationNumber}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="px-4 py-4 text-center">
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-gray-400 mb-1">Res ID</p>
                <p className="font-mono text-[28px] font-bold" style={{ color: "rgb(var(--be-accent))" }}>
                  {confirmation.rooms[0].confirmationNumber}
                </p>
              </div>
            )}
          </div>

          <div className="px-5 pb-6 text-center">
            <p className="text-[12px] text-gray-400 leading-relaxed mb-5">
              This is a <strong className="text-gray-600">booking request</strong> — no payment has been collected.
              The hotel will reach out to confirm your stay.
            </p>
            <Link to="/"
              className="inline-flex items-center gap-1.5 text-[13px] font-semibold transition-opacity hover:opacity-70"
              style={{ color: "rgb(var(--be-accent))" }}>
              <ArrowLeft size={13} /> Back to hotel
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export interface BookingFormPageProps {
  hotelSlug: string;
}

export default function BookingFormPage({ hotelSlug }: BookingFormPageProps) {
  const [searchParams]   = useSearchParams();
  const navigate         = useNavigate();

  const checkIn  = searchParams.get("checkIn")  ?? "";
  const checkOut = searchParams.get("checkOut") ?? "";
  const nights   = checkIn && checkOut
    ? Math.ceil((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86_400_000)
    : 0;

  const [cart] = useState<CartItem[]>(() => {
    try { return JSON.parse(sessionStorage.getItem(CART_KEY(hotelSlug)) ?? "[]") as CartItem[]; }
    catch { return []; }
  });

  const [upsellCart] = useState<CartUpsell[]>(() => {
    try { return JSON.parse(sessionStorage.getItem(UPSELL_KEY(hotelSlug)) ?? "[]") as CartUpsell[]; }
    catch { return []; }
  });

  useEffect(() => {
    if (cart.length === 0) navigate("/", { replace: true });
  }, [cart.length, navigate]);

  const { data: hotel } = useQuery({
    queryKey: ["booking-hotel", hotelSlug],
    queryFn:  () => bookingEngineService.getHotel(hotelSlug),
  });

  const themeKey    = hotel?.themeKey ?? "WARM_CLAY";
  const accentColor = "rgb(var(--be-accent))";
  const maxOccupancy = cart.reduce((s, c) => s + c.maxOccupancy * c.quantity, 0);

  const adultsFromUrl = Math.max(1, parseInt(searchParams.get("adults") ?? "1", 10) || 1);
  const childrenFromUrl = Math.max(0, parseInt(searchParams.get("children") ?? "0", 10) || 0);
  const [promoCode] = useState(() => sessionStorage.getItem(PROMO_KEY(hotelSlug)) ?? "");
  const [form, setForm] = useState({
    guestName: "", guestPhone: "", guestEmail: "",
    adults: adultsFromUrl, children: childrenFromUrl, specialRequests: "",
    dateOfBirth: "", anniversaryDate: "", marketingOptIn: false,
  });
  const [phoneError,  setPhoneError]  = useState<string | null>(null);
  const [emailError,  setEmailError]  = useState<string | null>(null);
  const [submitting,  setSubmitting]  = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<BookMultiConfirmation | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const hasBookingTerms = Boolean(hotel?.cancellationPolicy || hotel?.bookingPaymentTerms);

  if (confirmation) {
    return <SuccessScreen confirmation={confirmation} themeKey={themeKey} />;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!checkIn || !checkOut || cart.length === 0) return;
    const pErr = getPhoneErrorMessage(form.guestPhone);
    const eErr = form.guestEmail.trim() ? getEmailErrorMessage(form.guestEmail) : null;
    setPhoneError(pErr);
    setEmailError(eErr);
    if (pErr || eErr) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await bookingEngineService.bookMulti(hotelSlug, {
        checkInDate:     checkIn,
        checkOutDate:    checkOut,
        items:           cart.map((c) => ({ roomTypeId: c.roomTypeId, quantity: c.quantity })),
        upsells:         upsellCart.length
          ? upsellCart.map((u) => ({ upsellItemId: u.upsellItemId, quantity: u.quantity }))
          : undefined,
        guestName:       form.guestName.trim(),
        guestPhone:      form.guestPhone.trim(),
        guestEmail:      form.guestEmail.trim() || undefined,
        adults:          form.adults,
        children:        form.children || undefined,
        specialRequests: form.specialRequests.trim() || undefined,
        dateOfBirth:     form.dateOfBirth || undefined,
        anniversaryDate: form.anniversaryDate || undefined,
        marketingOptIn: form.marketingOptIn,
        promoCode:       promoCode || undefined,
        termsAccepted,
      });
      sessionStorage.removeItem(CART_KEY(hotelSlug));
      sessionStorage.removeItem(UPSELL_KEY(hotelSlug));
      sessionStorage.removeItem(PROMO_KEY(hotelSlug));
      setConfirmation(result);
    } catch (err) {
      const msg = getErrorMessage(err);
      setSubmitError(
        msg.toLowerCase().includes("available") || msg.toLowerCase().includes("no rooms")
          ? "Sorry, one or more rooms are no longer available. Please go back and choose different options."
          : msg
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="booking-theme min-h-screen bg-[#F8F7F5]" data-be-theme={themeKey}>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-gray-100 shadow-sm">
        <div className="max-w-6xl mx-auto px-5 sm:px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {hotel?.logoUrl ? (
              <img src={hotel.logoUrl} alt={hotel.name} className="h-7 w-7 rounded-lg object-cover shrink-0" />
            ) : hotel ? (
              <div className="h-7 w-7 rounded-lg flex items-center justify-center text-white text-sm font-bold shrink-0"
                style={{ background: "rgb(var(--be-accent))" }}>
                {hotel.name.charAt(0).toUpperCase()}
              </div>
            ) : null}
            {hotel && <span className="font-semibold text-[14px] text-gray-900 truncate">{hotel.name}</span>}
          </div>
          <div className="flex items-center gap-3">
            <Link to={`/?checkIn=${checkIn}&checkOut=${checkOut}`}
              className="hidden sm:flex items-center gap-1.5 text-[12px] font-medium text-gray-400 hover:text-gray-600 transition-colors">
              <ArrowLeft size={13} /> Back to rooms
            </Link>
            <a href={`https://app.innflo.co/login?slug=${hotelSlug}`}
              className="flex items-center px-4 py-2 rounded-lg border-2 border-gray-800 text-[13px] font-bold text-gray-800 hover:bg-gray-800 hover:text-white transition-all whitespace-nowrap">
              Property Login
            </a>
          </div>
        </div>
      </header>

      {/* ── Mobile sticky summary ────────────────────────────────────────────── */}
      <div className="lg:hidden sticky top-14 z-30 bg-white border-b border-gray-100 shadow-sm">
        <CompactSummary
          cart={cart} upsells={upsellCart} checkIn={checkIn} checkOut={checkOut}
          nights={nights} adults={form.adults} children={form.children} promoCode={promoCode} accentColor={accentColor}
          taxSettings={hotel?.accommodationTax ?? { gstEnabled: false, gstRate: 0, pstEnabled: false, pstRate: 0, taxInclusive: false }}
        />
      </div>

      {/* ── Content ─────────────────────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-4 py-6 sm:px-6 sm:py-9">
        <div className="flex flex-col items-start gap-7 lg:flex-row lg:gap-8">

          {/* ── Form ──────────────────────────────────────────────────────── */}
          <div className="w-full lg:flex-1 min-w-0">
            <div className="overflow-hidden rounded-[1.75rem] border border-gray-100 bg-white shadow-[0_18px_50px_rgba(25,25,25,0.07)]">

              {/* Form header */}
              <div className="border-b border-gray-100 bg-gradient-to-br from-white via-white to-[rgb(var(--be-accent-soft))] px-5 pb-6 pt-7 sm:px-8 sm:pt-8">
                <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-[rgb(var(--be-accent))] mb-2"><span className="grid place-items-center h-5 w-5 rounded-full bg-[rgb(var(--be-accent-soft))]">2</span> Final step</div>
                <h1 className="be-serif text-[29px] font-semibold leading-tight text-gray-900 sm:text-[32px]">Complete your booking request</h1>
                <p className="mt-2 max-w-xl text-[13.5px] leading-6 text-gray-500">
                  Tell the hotel who is arriving. No payment is collected until the property confirms your stay.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="flex flex-col gap-6 px-4 py-5 sm:px-8 sm:py-7">

                {/* Error */}
                {submitError && (
                  <div className="flex gap-3 bg-rose-50 border border-rose-100 rounded-xl px-4 py-3">
                    <AlertTriangle size={15} className="text-rose-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[13px] text-rose-700">{submitError}</p>
                      {(submitError.toLowerCase().includes("available") || submitError.toLowerCase().includes("option")) && (
                        <Link to="/"
                          className="text-[12px] text-rose-600 underline mt-1 inline-block">
                          Choose different rooms →
                        </Link>
                      )}
                    </div>
                  </div>
                )}

                <section className="rounded-2xl border border-gray-200/80 bg-white p-4 sm:p-5">
                  <div className="mb-5 flex items-start gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[rgb(var(--be-accent-soft))] text-[rgb(var(--be-accent))]">
                      <UserRound size={17} />
                    </span>
                    <div>
                      <h2 className="text-[15px] font-bold text-gray-900">Your contact details</h2>
                      <p className="mt-0.5 text-[12px] text-gray-500">Used only for this stay unless you choose offers below.</p>
                    </div>
                  </div>

                  <div className="space-y-5">
                    <Field label="Full Name" required>
                      <Input
                        type="text" required autoComplete="name"
                        value={form.guestName}
                        onChange={(e) => setForm((f) => ({ ...f, guestName: e.target.value }))}
                        placeholder="Ahmed Hassan"
                      />
                    </Field>

                    <div className="grid gap-5 sm:grid-cols-2">
                      <Field label="Phone Number" required error={phoneError}>
                    <Input
                      type="tel" required autoComplete="tel"
                      value={form.guestPhone}
                      error={phoneError}
                      onChange={(e) => { setForm((f) => ({ ...f, guestPhone: e.target.value })); setPhoneError(null); }}
                      onBlur={() => setPhoneError(getPhoneErrorMessage(form.guestPhone))}
                      placeholder="03XX XXXXXXX"
                    />
                      </Field>
                      <Field label="Email Address" optional error={emailError}>
                        <Input
                          type="email" autoComplete="email"
                          value={form.guestEmail}
                          error={emailError}
                          onChange={(e) => {
                            const guestEmail = e.target.value;
                            setForm((f) => ({ ...f, guestEmail, ...(!guestEmail.trim() ? { marketingOptIn: false } : {}) }));
                            setEmailError(null);
                          }}
                          onBlur={() => { if (form.guestEmail.trim()) setEmailError(getEmailErrorMessage(form.guestEmail)); }}
                          placeholder="ahmed@example.com"
                        />
                      </Field>
                    </div>
                  </div>
                </section>

                {/* Guests */}
                <section className="rounded-2xl border border-gray-200/80 bg-white p-4 sm:p-5">
                  <div className="mb-5 flex items-start gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gray-100 text-gray-700">
                      <Users size={17} />
                    </span>
                    <div>
                      <h2 className="text-[15px] font-bold text-gray-900">Guests &amp; stay notes</h2>
                      <p className="mt-0.5 text-[12px] text-gray-500">Confirm the party size and anything the hotel should prepare.</p>
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
                      <div>
                        <p className="text-[13px] font-semibold text-gray-800">Adults</p>
                        <p className="text-[11px] text-gray-400">Age 13+</p>
                      </div>
                      <Stepper
                        value={form.adults} min={1} max={maxOccupancy}
                        accentColor={accentColor}
                        onChange={(v) => setForm((f) => ({ ...f, adults: v, children: Math.min(f.children, Math.max(0, maxOccupancy - v)) }))}
                      />
                    </div>
                    <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
                      <div>
                        <p className="text-[13px] font-semibold text-gray-800">Children</p>
                        <p className="text-[11px] text-gray-400">Under 13</p>
                      </div>
                      <Stepper
                        value={form.children} min={0} max={Math.max(0, maxOccupancy - form.adults)}
                        accentColor={accentColor}
                        onChange={(v) => setForm((f) => ({ ...f, children: v }))}
                      />
                    </div>
                  </div>

                {/* Special requests */}
                  <div className="mt-5">
                    <Field label="Special Requests" optional>
                      <Textarea
                        rows={3}
                        value={form.specialRequests}
                        onChange={(e) => setForm((f) => ({ ...f, specialRequests: e.target.value }))}
                        placeholder="Early check-in, high floor, dietary requirements, accessibility needs…"
                      />
                    </Field>
                  </div>
                </section>

                <section className="overflow-hidden rounded-2xl border border-[rgb(var(--be-accent))]/20 bg-[rgb(var(--be-accent-soft))]">
                  <div className="flex items-start gap-3 px-4 pb-4 pt-5 sm:px-5">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/85 text-[rgb(var(--be-accent))] shadow-sm">
                      <Gift size={17} />
                    </span>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-[15px] font-bold text-gray-900">Make future stays more personal</h2>
                        <span className="rounded-full bg-white/75 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gray-500">Optional</span>
                      </div>
                      <p className="mt-1 max-w-xl text-[12.5px] leading-5 text-gray-600">
                        Share a special date if you would like this hotel to remember it for birthday or anniversary rewards.
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-4 border-t border-[rgb(var(--be-accent))]/15 bg-white/55 px-4 py-4 sm:grid-cols-2 sm:px-5">
                    <Field label="Birthday" optional>
                      <DateField
                        icon={<Cake size={15} />}
                        placeholder="Select your birthday"
                        max={new Date().toISOString().slice(0, 10)}
                        value={form.dateOfBirth}
                        onChange={(v) => setForm((f) => ({ ...f, dateOfBirth: v }))}
                      />
                    </Field>
                    <Field label="Anniversary" optional>
                      <DateField
                        icon={<Heart size={15} />}
                        placeholder="Select your anniversary"
                        max={new Date().toISOString().slice(0, 10)}
                        value={form.anniversaryDate}
                        onChange={(v) => setForm((f) => ({ ...f, anniversaryDate: v }))}
                      />
                    </Field>
                  </div>

                  <label className={cn(
                    "flex items-start gap-3 border-t border-[rgb(var(--be-accent))]/15 px-4 py-4 sm:px-5",
                    form.guestEmail.trim() ? "cursor-pointer" : "cursor-not-allowed opacity-60",
                  )}>
                    <input
                      type="checkbox"
                      checked={form.marketingOptIn}
                      disabled={!form.guestEmail.trim()}
                      onChange={(event) => setForm((f) => ({ ...f, marketingOptIn: event.target.checked }))}
                      className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 accent-[rgb(var(--be-accent))]"
                    />
                    <span className="text-[12.5px] leading-5 text-gray-700">
                      <strong className="font-semibold text-gray-900">Email me discounts, coupon codes, and occasion rewards from this hotel.</strong>
                      <span className="block text-gray-500">
                        {form.guestEmail.trim()
                          ? "This is optional and does not affect your booking request."
                          : "Add an email address above to receive offers."}
                      </span>
                    </span>
                  </label>
                </section>

                {hasBookingTerms && (
                  <details id="booking-terms" className="group scroll-mt-36 overflow-hidden rounded-2xl border border-gray-200 bg-gray-50/70">
                    <summary className="flex cursor-pointer list-none items-center gap-3 bg-white px-4 py-4 marker:hidden sm:px-5">
                      <span className="grid place-items-center h-9 w-9 rounded-xl bg-[rgb(var(--be-accent-soft))] shrink-0">
                        <FileText size={17} className="text-[rgb(var(--be-accent))]" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <h2 className="text-[15px] font-bold text-gray-900">Policies &amp; booking terms</h2>
                        <p className="mt-0.5 text-[12px] text-gray-500">Open and review the hotel’s full terms.</p>
                      </div>
                      <ChevronDown size={17} className="shrink-0 text-gray-400 transition-transform group-open:rotate-180" />
                    </summary>
                    <div className="space-y-5 border-t border-gray-200 px-4 py-5 sm:px-5">
                      {hotel?.cancellationPolicy && (
                        <div>
                          <h3 className="text-[13px] font-bold text-gray-800 mb-2">Cancellation policy</h3>
                          <p className="text-[13px] leading-6 text-gray-600 whitespace-pre-line">{hotel.cancellationPolicy}</p>
                        </div>
                      )}
                      {hotel?.bookingPaymentTerms && (
                        <div className={hotel.cancellationPolicy ? "pt-5 border-t border-gray-200" : ""}>
                          <h3 className="text-[13px] font-bold text-gray-800 mb-2">Booking &amp; payment terms</h3>
                          <p className="text-[13px] leading-6 text-gray-600 whitespace-pre-line">{hotel.bookingPaymentTerms}</p>
                        </div>
                      )}
                    </div>
                  </details>
                )}

                {hasBookingTerms && (
                  <label className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white px-4 py-4 cursor-pointer">
                    <input
                      type="checkbox"
                      required
                      checked={termsAccepted}
                      onChange={(event) => setTermsAccepted(event.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-gray-300 accent-[rgb(var(--be-accent))]"
                    />
                    <span className="text-[13px] leading-relaxed text-gray-600">
                      I have read and agree to this hotel’s cancellation policy and booking &amp; payment terms.
                    </span>
                  </label>
                )}

                {/* Submit */}
                <div className="pt-1">
                  <button
                    type="submit" disabled={submitting || (hasBookingTerms && !termsAccepted)}
                    className={cn(
                      "w-full py-4 rounded-xl text-white font-semibold text-[16px] transition-all",
                      submitting || (hasBookingTerms && !termsAccepted) ? "opacity-60 cursor-not-allowed" : "hover:opacity-90 active:scale-[0.99]"
                    )}
                    style={{ background: "rgb(var(--be-accent))" }}
                  >
                    {submitting ? "Submitting your request…" : "Submit Booking Request"}
                  </button>
                  <div className="flex items-center justify-center gap-1.5 mt-3 text-[12px] text-gray-400">
                    <Lock size={11} />
                    No payment required. The hotel will contact you to confirm.
                  </div>
                </div>
              </form>
            </div>
          </div>

          {/* ── Summary (desktop only) ─────────────────────────────────────── */}
          <div className="hidden w-80 shrink-0 lg:block xl:w-[22rem]">
            <SummaryCard
              cart={cart} upsells={upsellCart} checkIn={checkIn} checkOut={checkOut}
              nights={nights} adults={form.adults} children={form.children} promoCode={promoCode} accentColor={accentColor}
              cancellationPolicy={hotel?.cancellationPolicy ?? null}
              taxSettings={hotel?.accommodationTax ?? { gstEnabled: false, gstRate: 0, pstEnabled: false, pstRate: 0, taxInclusive: false }}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="mt-10 pt-5 border-t border-gray-200">
          <p className="text-[12px] text-gray-400">Powered by Innflo</p>
        </div>
      </div>
    </div>
  );
}
