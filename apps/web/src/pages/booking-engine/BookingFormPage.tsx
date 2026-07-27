import { useState, useEffect } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, AlertTriangle, Minus, Plus, ChevronLeft, Lock, Calendar, FileText, ShieldCheck } from "lucide-react";
import {
  bookingEngineService,
  type BookMultiConfirmation,
  type CartItem,
} from "@/services/bookingEngine";
import { cn } from "@/lib/cn";
import { getPhoneErrorMessage, getEmailErrorMessage } from "@/lib/validation";
import { calculateAccommodationCharges } from "@/lib/accommodationCharges";
import type { PublicHotel } from "@/services/bookingEngine";

const CART_KEY = (slug: string) => `be_cart_${slug}`;
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

function SummaryCard({ cart, checkIn, checkOut, nights, adults, children, promoCode, accentColor, cancellationPolicy, taxSettings }: {
  cart: CartItem[]; checkIn: string; checkOut: string;
  nights: number; adults: number; children: number; promoCode: string; accentColor: string;
  cancellationPolicy: string | null;
  taxSettings: PublicHotel["accommodationTax"];
}) {
  const nightlyTotal = cart.reduce((s, c) => s + (c.ratePerNight ?? c.defaultRate) * c.quantity, 0);
  const charges = calculateAccommodationCharges(
    nightlyTotal * nights,
    taxSettings as unknown as Record<string, unknown>,
  );

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
        <div className="flex items-baseline justify-between mb-3">
          <span className="text-[13px] font-medium text-gray-500">Estimated total</span>
          <span className="text-[24px] font-bold text-gray-900 leading-none">{fmt(charges.totalAmount)}</span>
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

function CompactSummary({ cart, checkIn, checkOut, nights, adults, children, promoCode, accentColor, taxSettings }: {
  cart: CartItem[]; checkIn: string; checkOut: string;
  nights: number; adults: number; children: number; promoCode: string; accentColor: string;
  taxSettings: PublicHotel["accommodationTax"];
}) {
  const charges = calculateAccommodationCharges(
    cart.reduce((s, c) => s + (c.ratePerNight ?? c.defaultRate) * c.quantity, 0) * nights,
    taxSettings as unknown as Record<string, unknown>,
  );

  return (
    <div className="flex items-center justify-between gap-3 px-5 py-3">
      <div className="min-w-0">
        <p className="text-[12px] text-gray-500 truncate">
          {cart.map((c) => `${c.quantity > 1 ? `${c.quantity}× ` : ""}${c.roomTypeName}`).join(" + ")}
          {" · "}{nights} night{nights !== 1 ? "s" : ""}
        </p>
        <p className="text-[12px] text-gray-500">{adults} adult{adults !== 1 ? "s" : ""}{children > 0 ? ` · ${children} child${children !== 1 ? "ren" : ""}` : ""}{promoCode ? ` · ${promoCode}` : ""}</p>
        <p className="text-[15px] font-bold text-gray-900">
          {fmt(charges.totalAmount)}
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
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-gray-400 mb-1">Confirmation Number</p>
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
        guestName:       form.guestName.trim(),
        guestPhone:      form.guestPhone.trim(),
        guestEmail:      form.guestEmail.trim() || undefined,
        adults:          form.adults,
        children:        form.children || undefined,
        specialRequests: form.specialRequests.trim() || undefined,
        promoCode:       promoCode || undefined,
        termsAccepted,
      });
      sessionStorage.removeItem(CART_KEY(hotelSlug));
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
        <div className="max-w-5xl mx-auto px-5 sm:px-6 h-14 flex items-center justify-between gap-4">
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
          cart={cart} checkIn={checkIn} checkOut={checkOut}
          nights={nights} adults={form.adults} children={form.children} promoCode={promoCode} accentColor={accentColor}
          taxSettings={hotel?.accommodationTax ?? { gstEnabled: false, gstRate: 0, pstEnabled: false, pstRate: 0, taxInclusive: false }}
        />
      </div>

      {/* ── Content ─────────────────────────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-5 sm:px-6 py-8">
        <div className="flex flex-col lg:flex-row gap-6 items-start">

          {/* ── Form ──────────────────────────────────────────────────────── */}
          <div className="w-full lg:flex-1 min-w-0">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.05)] overflow-hidden">

              {/* Form header */}
              <div className="px-6 pt-6 pb-5 border-b border-gray-50">
                <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-[rgb(var(--be-accent))] mb-2"><span className="grid place-items-center h-5 w-5 rounded-full bg-[rgb(var(--be-accent-soft))]">2</span> Final step</div>
                <h1 className="be-serif text-[26px] font-semibold text-gray-900 leading-tight">Review &amp; request booking</h1>
                <p className="text-[13px] text-gray-400 mt-1">
                  Submit a request — the hotel will confirm your booking shortly.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="px-6 py-6 flex flex-col gap-5">

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

                {/* Name */}
                <Field label="Full Name" required>
                  <Input
                    type="text" required
                    value={form.guestName}
                    onChange={(e) => setForm((f) => ({ ...f, guestName: e.target.value }))}
                    placeholder="Ahmed Hassan"
                  />
                </Field>

                {/* Phone + Email row */}
                <div className="grid sm:grid-cols-2 gap-5">
                  <Field label="Phone Number" required error={phoneError}>
                    <Input
                      type="tel" required
                      value={form.guestPhone}
                      error={phoneError}
                      onChange={(e) => { setForm((f) => ({ ...f, guestPhone: e.target.value })); setPhoneError(null); }}
                      onBlur={() => setPhoneError(getPhoneErrorMessage(form.guestPhone))}
                      placeholder="03XX XXXXXXX"
                    />
                  </Field>
                  <Field label="Email Address" optional error={emailError}>
                    <Input
                      type="email"
                      value={form.guestEmail}
                      error={emailError}
                      onChange={(e) => { setForm((f) => ({ ...f, guestEmail: e.target.value })); setEmailError(null); }}
                      onBlur={() => { if (form.guestEmail.trim()) setEmailError(getEmailErrorMessage(form.guestEmail)); }}
                      placeholder="ahmed@example.com"
                    />
                  </Field>
                </div>

                {/* Guests */}
                <div>
                  <p className="text-[13px] font-medium text-gray-700 mb-3">Number of Guests</p>
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
                </div>

                {/* Special requests */}
                <Field label="Special Requests" optional>
                  <Textarea
                    rows={3}
                    value={form.specialRequests}
                    onChange={(e) => setForm((f) => ({ ...f, specialRequests: e.target.value }))}
                    placeholder="Early check-in, high floor, dietary requirements, accessibility needs…"
                  />
                </Field>

                {hasBookingTerms && (
                  <section id="booking-terms" className="scroll-mt-36 rounded-2xl border border-gray-200 bg-gray-50/70 overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-200 bg-white flex items-start gap-3">
                      <span className="grid place-items-center h-9 w-9 rounded-xl bg-[rgb(var(--be-accent-soft))] shrink-0">
                        <FileText size={17} className="text-[rgb(var(--be-accent))]" />
                      </span>
                      <div>
                        <h2 className="text-[15px] font-bold text-gray-900">Policies &amp; booking terms</h2>
                        <p className="text-[12px] text-gray-500 mt-0.5">Please review the hotel’s terms before submitting.</p>
                      </div>
                    </div>
                    <div className="px-5 py-5 space-y-5">
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
                  </section>
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
          <div className="hidden lg:block w-72 xl:w-80 shrink-0">
            <SummaryCard
              cart={cart} checkIn={checkIn} checkOut={checkOut}
              nights={nights} adults={form.adults} children={form.children} promoCode={promoCode} accentColor={accentColor}
              cancellationPolicy={hotel?.cancellationPolicy ?? null}
              taxSettings={hotel?.accommodationTax ?? { gstEnabled: false, gstRate: 0, pstEnabled: false, pstRate: 0, taxInclusive: false }}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="mt-10 pt-5 border-t border-gray-200">
          <p className="text-[12px] text-gray-400">Powered by InnFlo</p>
        </div>
      </div>
    </div>
  );
}
