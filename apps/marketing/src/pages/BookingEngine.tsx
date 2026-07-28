import { useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowDownRight,
  ArrowRight,
  BarChart3,
  BellRing,
  BedDouble,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Globe2,
  Layers3,
  Lock,
  MailCheck,
  Palette,
  Percent,
  ShieldCheck,
  Sparkles,
  Tag,
  TrendingUp,
  UsersRound,
  WalletCards,
} from "lucide-react";
import Reveal from "../components/motion/Reveal";
import SplitHeading from "../components/motion/SplitHeading";
import MagneticButton from "../components/motion/MagneticButton";

const EASE = [0.16, 1, 0.3, 1] as const;

function BrowserFrame({ children, url }: { children: React.ReactNode; url: string }) {
  return (
    <div className="overflow-hidden rounded-[24px] border border-line bg-white shadow-[0_32px_100px_rgba(53,36,26,.2)]">
      <div className="flex h-11 items-center gap-3 border-b border-line-soft bg-[#FBF8F4] px-4">
        <div className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#F5A6A0]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#F5D183]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#9EDDC7]" />
        </div>
        <div className="flex h-7 min-w-0 flex-1 items-center gap-2 rounded-lg border border-line-soft bg-white px-3">
          <Lock className="h-2.5 w-2.5 shrink-0 text-emerald-600" />
          <span className="truncate text-[8px] font-bold text-ink-mute">{url}</span>
        </div>
      </div>
      {children}
    </div>
  );
}

function HeroBookingMockup() {
  return (
    <div className="relative">
      <div className="absolute -inset-8 rounded-full bg-coral/15 blur-3xl" />
      <div className="relative lg:rotate-[1deg]">
        <BrowserFrame url="eagles-nest.innflo.co">
          <div className="bg-[#F8F7F5]">
            <div className="flex items-center justify-between border-b border-gray-100 bg-white px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-[#C54D2B] text-[9px] font-black text-white">EN</span>
                <div>
                  <p className="text-[8px] font-black text-gray-900">Eagle&apos;s Nest Hotel</p>
                  <p className="text-[6px] text-gray-400">Hunza · Pakistan</p>
                </div>
              </div>
              <span className="text-[6.5px] font-bold text-gray-400">Property login</span>
            </div>

            <div className="grid gap-3 p-3 sm:grid-cols-[1fr_170px]">
              <div className="min-w-0">
                <div className="grid grid-cols-[1fr_1fr_70px] gap-1.5 rounded-xl bg-white p-2 shadow-sm">
                  {[
                    ["Check-in", "18 Aug"],
                    ["Check-out", "21 Aug"],
                    ["Guests", "2 adults"],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-lg border border-gray-100 px-2 py-1.5">
                      <p className="text-[5px] font-black uppercase tracking-wider text-gray-400">{label}</p>
                      <p className="mt-0.5 text-[7px] font-black text-gray-800">{value}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-2 overflow-hidden rounded-xl border border-gray-100 bg-white">
                  <div className="grid grid-cols-[105px_1fr]">
                    <img src="/images/hotels.webp" alt="Mountain view deluxe room" className="h-full min-h-[142px] w-full object-cover" />
                    <div className="flex min-w-0 flex-col justify-between p-3">
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-[9px] font-black text-gray-900">Mountain View Deluxe</p>
                            <p className="mt-0.5 flex items-center gap-1 text-[6px] text-gray-400"><UsersRound className="h-2.5 w-2.5" /> Sleeps 2</p>
                          </div>
                          <span className="rounded-full bg-emerald-50 px-2 py-1 text-[5px] font-black text-emerald-700">3 LEFT</span>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-1">
                          {["Breakfast", "Wi-Fi", "Mountain view"].map((item) => (
                            <span key={item} className="rounded bg-gray-50 px-1.5 py-1 text-[5px] font-bold text-gray-500">{item}</span>
                          ))}
                        </div>
                      </div>
                      <div className="mt-3 flex items-end justify-between">
                        <div><p className="text-[5px] text-gray-400">Per night</p><p className="text-[10px] font-black text-gray-900">PKR 12,500</p></div>
                        <span className="rounded-lg bg-[#C54D2B] px-3 py-2 text-[6px] font-black text-white">Add room</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col rounded-xl border border-gray-100 bg-white p-3 shadow-sm">
                <p className="text-[6px] font-black uppercase tracking-wider text-gray-400">Your stay</p>
                <div className="mt-3 flex items-center gap-2 border-b border-gray-100 pb-3">
                  <span className="grid h-7 w-7 place-items-center rounded-lg bg-[#F9E8E1] text-[#C54D2B]"><BedDouble className="h-3.5 w-3.5" /></span>
                  <div><p className="text-[7px] font-black text-gray-800">1 room · 3 nights</p><p className="text-[5.5px] text-gray-400">Sleeps your party of 2</p></div>
                </div>
                <div className="mt-3 rounded-lg border border-dashed border-gray-200 p-2">
                  <p className="flex items-center gap-1 text-[5.5px] font-bold text-gray-500"><Tag className="h-2.5 w-2.5" /> Promo / corporate code</p>
                </div>
                <div className="mt-auto pt-4">
                  <div className="flex items-center justify-between"><span className="text-[6px] font-bold text-gray-500">Total</span><span className="text-[10px] font-black text-gray-900">PKR 37,500</span></div>
                  <div className="mt-2 rounded-lg bg-[#C54D2B] py-2.5 text-center text-[6.5px] font-black text-white">Continue to details</div>
                  <p className="mt-2 flex items-center justify-center gap-1 text-[5px] text-gray-400"><ShieldCheck className="h-2.5 w-2.5" /> Secure booking request</p>
                </div>
              </div>
            </div>
          </div>
        </BrowserFrame>
      </div>

      <motion.div
        animate={{ y: [0, -7, 0] }}
        transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -bottom-8 -left-4 hidden w-[210px] rounded-2xl border border-white/80 bg-[rgba(255,253,250,.92)] p-3 shadow-float backdrop-blur-xl sm:block"
      >
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><BellRing className="h-4 w-4" /></span>
          <div><p className="text-[8px] font-black text-ink">New online booking</p><p className="text-[6.5px] text-ink-mute">Front desk alerted instantly</p></div>
        </div>
      </motion.div>
    </div>
  );
}

function MultiRoomMockup() {
  return (
    <BrowserFrame url="your-hotel.innflo.co">
      <div className="grid bg-[#F8F7F5] sm:grid-cols-[1fr_190px]">
        <div className="border-b border-line-soft p-3 sm:border-b-0 sm:border-r">
          <div className="flex items-center justify-between">
            <div><p className="text-[10px] font-black text-ink">Choose your rooms</p><p className="text-[6.5px] text-ink-mute">2 adults · 2 children · 3 nights</p></div>
            <span className="rounded-full bg-coral-soft px-2 py-1 text-[6px] font-black text-coral-dark">LIVE AVAILABILITY</span>
          </div>
          <div className="mt-3 space-y-2">
            {[
              ["Deluxe King", "Sleeps 2", "12,500", 1],
              ["Family Suite", "Sleeps 4", "18,000", 1],
              ["Twin Room", "Sleeps 2", "10,000", 0],
            ].map(([name, sleeps, price, quantity], index) => (
              <div key={String(name)} className={`flex items-center gap-2.5 rounded-xl border bg-white p-2.5 ${index < 2 ? "border-coral/20" : "border-line-soft"}`}>
                <div className={`h-12 w-14 shrink-0 rounded-lg ${index === 0 ? "bg-[linear-gradient(135deg,#C66B48,#EDC19E)]" : index === 1 ? "bg-[linear-gradient(135deg,#58786E,#B7C8A7)]" : "bg-[linear-gradient(135deg,#687D9D,#C0CADD)]"}`} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[8px] font-black text-ink">{name}</p>
                  <p className="text-[6px] text-ink-mute">{sleeps} · PKR {price}</p>
                </div>
                {Number(quantity) > 0 ? (
                  <div className="flex items-center gap-2 rounded-lg bg-mist px-2 py-1.5 text-[7px] font-black text-ink"><span>−</span><span>{quantity}</span><span className="text-coral-dark">+</span></div>
                ) : (
                  <span className="rounded-lg bg-coral px-2.5 py-2 text-[6px] font-black text-white">Add</span>
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-col bg-white p-3">
          <p className="text-[6px] font-black uppercase tracking-wider text-ink-mute">Multi-room cart</p>
          <p className="mt-2 text-[12px] font-black text-ink">2 rooms selected</p>
          <p className="text-[6.5px] text-emerald-700">Sleeps 6 · fits your party</p>
          <div className="mt-3 space-y-2 border-y border-line-soft py-3 text-[6.5px]">
            <p className="flex justify-between font-bold text-ink-soft"><span>Deluxe King</span><span>37,500</span></p>
            <p className="flex justify-between font-bold text-ink-soft"><span>Family Suite</span><span>54,000</span></p>
            <p className="flex justify-between text-ink-mute"><span>Promo: NORTH10</span><span className="font-black text-emerald-700">−9,150</span></p>
          </div>
          <div className="mt-auto pt-4">
            <p className="flex items-end justify-between"><span className="text-[7px] font-bold text-ink">Total</span><span className="text-[13px] font-black text-ink">PKR 82,350</span></p>
            <div className="mt-2 rounded-lg bg-coral py-2.5 text-center text-[6.5px] font-black text-white">Review booking request</div>
          </div>
        </div>
      </div>
    </BrowserFrame>
  );
}

function BrandControlsMockup() {
  return (
    <div className="grid gap-4 sm:grid-cols-[.72fr_1.28fr]">
      <div className="rounded-[22px] border border-line bg-white p-4 shadow-card">
        <p className="text-[7px] font-black uppercase tracking-[.16em] text-ink-mute">Your presentation</p>
        <div className="mt-4 space-y-3">
          <div className="rounded-xl border border-line-soft p-3">
            <p className="text-[6px] font-black text-ink-mute">HOTEL BRAND</p>
            <div className="mt-2 flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-lg bg-ink text-[8px] font-black text-white">EN</span><span className="text-[8px] font-black text-ink">Eagle&apos;s Nest</span></div>
          </div>
          <div className="rounded-xl border border-line-soft p-3">
            <p className="text-[6px] font-black text-ink-mute">THEME</p>
            <div className="mt-2 grid grid-cols-4 gap-1.5">
              {["#C54D2B", "#2F7256", "#3A6BC4", "#4338A8"].map((color, index) => (
                <span key={color} className={`h-7 rounded-lg ${index === 0 ? "ring-2 ring-offset-2 ring-coral" : ""}`} style={{ background: color }} />
              ))}
            </div>
          </div>
          {[
            ["Room photography", "3 / 3 ready"],
            ["Cancellation policy", "Published"],
            ["Booking terms", "Published"],
          ].map(([label, value]) => (
            <div key={label} className="flex items-center justify-between rounded-xl bg-mist px-3 py-2.5">
              <span className="text-[6.5px] font-bold text-ink-soft">{label}</span>
              <span className="flex items-center gap-1 text-[6px] font-black text-emerald-700"><Check className="h-2.5 w-2.5" /> {value}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="relative overflow-hidden rounded-[22px] border border-line bg-[#F8F7F5] shadow-float">
        <div className="h-28 bg-[linear-gradient(135deg,rgba(23,26,24,.12),rgba(23,26,24,.02)),url('/images/hotels.webp')] bg-cover bg-center" />
        <div className="p-4">
          <div className="flex items-center justify-between">
            <div><p className="text-[11px] font-black text-ink">Mountain View Deluxe</p><p className="mt-0.5 text-[6.5px] text-ink-mute">Breakfast · Wi-Fi · Balcony</p></div>
            <p className="text-right"><span className="block text-[11px] font-black text-ink">PKR 12,500</span><span className="text-[5.5px] text-ink-mute">per night</span></p>
          </div>
          <div className="mt-4 rounded-xl border border-line-soft bg-white p-3">
            <div className="flex items-start gap-2">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-coral-soft text-coral-dark"><ShieldCheck className="h-3.5 w-3.5" /></span>
              <div><p className="text-[7px] font-black text-ink">Hotel policies, shown before submission</p><p className="mt-1 text-[6px] leading-relaxed text-ink-mute">Cancellation and payment terms are captured with the booking request.</p></div>
            </div>
          </div>
        </div>
        <span className="absolute right-3 top-3 rounded-full bg-white/90 px-2 py-1 text-[6px] font-black text-ink shadow-sm backdrop-blur">YOUR HOTEL · YOUR LOOK</span>
      </div>
    </div>
  );
}

function HubMockup() {
  const bars = [34, 48, 43, 67, 58, 82, 76, 94, 85, 100, 88, 96];
  return (
    <div className="overflow-hidden rounded-[26px] border border-white/10 bg-white/[.055] shadow-[0_28px_80px_rgba(0,0,0,.22)] backdrop-blur">
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
        <div><p className="text-[9px] font-black text-white">Booking Engine performance</p><p className="text-[6.5px] text-white/40">Last 30 days · direct channel only</p></div>
        <span className="rounded-full bg-emerald-400/15 px-2 py-1 text-[6px] font-black text-emerald-300">LIVE</span>
      </div>
      <div className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-4">
        {[
          ["Direct requests", "42", "+12 this month"],
          ["Progressed", "31", "7 awaiting action"],
          ["Room nights", "96", "8 multi-room carts"],
          ["Est. direct value", "1.24M", "PKR · no commission"],
        ].map(([label, value, detail], index) => (
          <div key={label} className={`rounded-xl border p-3 ${index === 3 ? "border-coral/25 bg-coral/10" : "border-white/10 bg-white/[.04]"}`}>
            <p className="text-[5.5px] font-black uppercase tracking-wider text-white/35">{label}</p>
            <p className={`mt-2 text-[16px] font-black ${index === 3 ? "text-coral" : "text-white"}`}>{value}</p>
            <p className="mt-1 text-[6px] text-white/35">{detail}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-3 px-4 pb-4 sm:grid-cols-[1fr_180px]">
        <div className="rounded-xl border border-white/10 bg-white/[.035] p-3">
          <div className="flex items-center justify-between"><p className="text-[7px] font-black text-white/65">Booking momentum</p><p className="text-[6px] font-bold text-emerald-300">+18.6%</p></div>
          <div className="mt-4 flex h-28 items-end gap-1.5 border-b border-white/10">
            {bars.map((height, index) => <span key={`${height}-${index}`} className={`flex-1 rounded-t-sm ${index === bars.length - 1 ? "bg-coral" : "bg-white/15"}`} style={{ height: `${height}%` }} />)}
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[.035] p-3">
          <p className="text-[6px] font-black uppercase tracking-wider text-white/35">Latest request</p>
          <p className="mt-3 text-[9px] font-black text-white">Zara Khan</p>
          <p className="mt-0.5 text-[6px] text-white/40">2 rooms · 14–17 Aug</p>
          <div className="mt-3 rounded-lg bg-amber-400/10 p-2 text-[6px] font-black text-amber-300">AWAITING HOTEL</div>
          <div className="mt-2 rounded-lg bg-coral py-2 text-center text-[6px] font-black text-white">Open reservation</div>
        </div>
      </div>
    </div>
  );
}

function CommissionComparisonMockup() {
  const bookingValue = 50_000;
  const [otaRate, setOtaRate] = useState(15);
  const otaCommission = Math.round(bookingValue * otaRate / 100);
  const otaKeeps = bookingValue - otaCommission;
  const formatPkr = (value: number) => `PKR ${value.toLocaleString("en-PK")}`;

  return (
    <div className="overflow-hidden rounded-[30px] border border-line bg-[#211E1A] shadow-[0_34px_90px_rgba(49,34,25,.24)]">
      <div className="flex flex-col gap-4 border-b border-white/10 px-5 py-5 text-white sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <p className="text-[8px] font-black uppercase tracking-[.17em] text-coral">Same guest · same stay</p>
          <p className="mt-2 font-display text-[24px] font-medium">Booking value: {formatPkr(bookingValue)}</p>
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-white/[.06] p-1">
          {[12, 15, 18].map((rate) => (
            <button
              key={rate}
              type="button"
              onClick={() => setOtaRate(rate)}
              aria-pressed={otaRate === rate}
              className={`rounded-full px-3 py-2 text-[8px] font-black transition-all ${
                otaRate === rate ? "bg-coral text-white shadow-pop" : "text-white/40 hover:text-white"
              }`}
            >
              {rate}%
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-px bg-white/10 lg:grid-cols-2">
        <div className="bg-[#292622] p-5 text-white sm:p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-white/[.07] text-white/55">
                <Building2 className="h-4 w-4" />
              </span>
              <div>
                <p className="text-[10px] font-black">Booked through an OTA</p>
                <p className="mt-1 text-[7px] text-white/35">Illustrative {otaRate}% commission</p>
              </div>
            </div>
            <ArrowDownRight className="h-5 w-5 text-rose-300" />
          </div>

          <div className="mt-7 overflow-hidden rounded-full bg-white/10">
            <motion.div
              animate={{ width: `${100 - otaRate}%` }}
              transition={{ duration: 0.45, ease: EASE }}
              className="h-2.5 rounded-full bg-white/35"
            />
          </div>

          <div className="mt-6 space-y-3 text-[8px]">
            <div className="flex justify-between text-white/40"><span>Guest booking value</span><span>{formatPkr(bookingValue)}</span></div>
            <div className="flex justify-between text-rose-300"><span>OTA commission</span><span>− {formatPkr(otaCommission)}</span></div>
            <div className="h-px bg-white/10" />
            <div className="flex items-end justify-between">
              <span className="font-black text-white/65">Your hotel keeps</span>
              <motion.span
                key={otaKeeps}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="font-display text-[25px] text-white"
              >
                {formatPkr(otaKeeps)}
              </motion.span>
            </div>
          </div>
        </div>

        <div className="relative overflow-hidden bg-white p-5 sm:p-6">
          <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-emerald-100 blur-2xl" />
          <div className="relative">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
                  <WalletCards className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-[10px] font-black text-ink">Direct through your Booking Engine</p>
                  <p className="mt-1 text-[7px] text-ink-mute">0% commission on booking value</p>
                </div>
              </div>
              <span className="rounded-full bg-emerald-50 px-2.5 py-1.5 text-[8px] font-black text-emerald-700">0%</span>
            </div>

            <div className="mt-7 overflow-hidden rounded-full bg-emerald-50">
              <motion.div
                initial={{ width: 0 }}
                whileInView={{ width: "100%" }}
                viewport={{ once: true }}
                transition={{ duration: 0.7, ease: EASE }}
                className="h-2.5 rounded-full bg-emerald-500"
              />
            </div>

            <div className="mt-6 space-y-3 text-[8px]">
              <div className="flex justify-between text-ink-mute"><span>Guest booking value</span><span>{formatPkr(bookingValue)}</span></div>
              <div className="flex justify-between text-emerald-700"><span>InnFlo commission</span><span>{formatPkr(0)}</span></div>
              <div className="h-px bg-line" />
              <div className="flex items-end justify-between">
                <span className="font-black text-ink-soft">Your hotel keeps</span>
                <span className="font-display text-[25px] text-ink">{formatPkr(bookingValue)}</span>
              </div>
            </div>

            <motion.div
              key={otaCommission}
              initial={{ opacity: 0, scale: .96 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mt-5 flex items-center gap-3 rounded-2xl bg-emerald-50 px-4 py-3 text-emerald-800"
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-emerald-600 text-white">
                <TrendingUp className="h-4 w-4" />
              </span>
              <div>
                <p className="text-[9px] font-black">{formatPkr(otaCommission)} more stays with your hotel</p>
                <p className="mt-0.5 text-[6.5px] font-semibold text-emerald-700/65">On this single illustrative booking</p>
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      <p className="px-5 py-3 text-[7px] leading-relaxed text-white/30 sm:px-6">
        OTA commission rates vary by platform, market and contract. This calculator is an illustrative comparison—not a claim about every OTA agreement.
      </p>
    </div>
  );
}

const FAQS = [
  {
    q: "Does InnFlo collect online payment from the guest?",
    a: "Not today. The guest submits a secure booking request and the hotel confirms the stay and handles any deposit using its existing process. The guest sees this clearly before submitting.",
  },
  {
    q: "Is room availability actually live?",
    a: "Yes. The public page reads current availability, and InnFlo checks it again inside the final booking transaction. If the requested inventory is no longer available, no partial or conflicting booking is created.",
  },
  {
    q: "Can one guest request several rooms?",
    a: "Yes. Guests can combine room types and quantities in one cart. InnFlo validates total sleeping capacity and processes the entire multi-room request atomically.",
  },
  {
    q: "Can hotels create promo and corporate codes?",
    a: "Yes. Codes are managed through rate plans, validated securely against their active dates, and update eligible room rates and the cart total before the guest submits.",
  },
  {
    q: "Where does the Booking Engine live?",
    a: "Every enabled hotel gets its own guest-facing InnFlo subdomain using the hotel slug. The page uses that hotel’s name, logo, room images, theme, policies, taxes and rate plans.",
  },
];

export default function BookingEngine() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <div className="bg-paper text-ink">
      <section className="relative overflow-hidden px-6 pb-28 pt-36 lg:min-h-screen lg:pt-40">
        <div className="absolute inset-0 bg-grid [mask-image:linear-gradient(to_bottom,black,transparent_82%)]" />
        <div className="absolute -left-24 top-0 h-[500px] w-[700px] rounded-full bg-coral/10 blur-3xl" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-16 lg:grid-cols-[.85fr_1.15fr]">
          <div>
            <Reveal><p className="eyebrow mb-6">Direct Booking Engine · Live now</p></Reveal>
            <h1 className="font-display text-[clamp(50px,7vw,88px)] font-medium leading-[.94] tracking-[-.035em]">
              <SplitHeading as="span" className="block">Your rooms.</SplitHeading>
              <SplitHeading as="span" delay={0.2} className="block italic text-coral-dark">Your guest.</SplitHeading>
              <SplitHeading as="span" delay={0.4} className="block">Zero commission.</SplitHeading>
            </h1>
            <Reveal delay={0.55}>
              <p className="mt-7 max-w-xl text-[18px] font-medium leading-relaxed text-ink-soft">
                A branded direct booking experience connected to the same rooms, rates, policies and front desk your team already runs in InnFlo.
              </p>
            </Reveal>
            <Reveal delay={0.65}>
              <div className="mt-9 flex flex-wrap items-center gap-4">
                <MagneticButton>
                  <a href="https://demo-hotel.innflo.co" target="_blank" rel="noopener noreferrer" className="flex h-12 items-center gap-2 rounded-full bg-coral px-7 text-[14px] font-black text-white shadow-pop hover:bg-coral-dark">
                    Explore the live demo <ArrowRight className="h-4 w-4" />
                  </a>
                </MagneticButton>
                <Link to="/contact" className="flex h-12 items-center rounded-full border border-ink px-7 text-[14px] font-black text-ink transition-colors hover:bg-ink hover:text-white">
                  Book a walkthrough
                </Link>
              </div>
              <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-[11px] font-bold text-ink-mute">
                <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-700" /> No guest account</span>
                <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-700" /> No commission</span>
                <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-700" /> No double entry</span>
              </div>
            </Reveal>
          </div>
          <Reveal variant="scale" delay={0.15}>
            <HeroBookingMockup />
          </Reveal>
        </div>
      </section>

      <section className="border-y border-line bg-ink px-6 py-9 text-white">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-6 lg:grid-cols-4">
          {[
            ["0%", "commission on direct requests"],
            ["1", "hotel-branded subdomain"],
            ["Multi", "room and room-type carts"],
            ["Live", "front-desk alerts and insights"],
          ].map(([value, label], index) => (
            <Reveal key={label} delay={index * 0.06}>
              <div className="border-l border-white/10 pl-5">
                <p className="font-display text-[38px] font-medium text-coral">{value}</p>
                <p className="mt-1 max-w-[190px] text-[11px] font-bold leading-relaxed text-white/48">{label}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="border-b border-line bg-[#F9F1EA] px-6 py-28">
        <div className="mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-[.78fr_1.22fr]">
          <Reveal>
            <p className="eyebrow mb-5">Keep the booking value</p>
            <h2 className="font-display text-[clamp(40px,5.5vw,64px)] font-medium leading-[1.01]">
              OTAs bring reach.<br />
              <span className="italic text-coral-dark">Direct bookings bring the margin home.</span>
            </h2>
            <p className="mt-6 max-w-lg text-[16px] leading-relaxed text-ink-soft">
              An OTA can take a percentage of every stay booked through its marketplace. Bring that guest through your own InnFlo Booking Engine and InnFlo takes 0% of the booking value.
            </p>
            <div className="mt-8 space-y-3">
              {[
                "The guest requests under your hotel’s own brand",
                "The request lands directly inside your PMS",
                "More of the room revenue stays in your wallet",
              ].map((item) => (
                <p key={item} className="flex items-center gap-3 text-[13px] font-bold text-ink-soft">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-emerald-50 text-emerald-700">
                    <Check className="h-3 w-3" />
                  </span>
                  {item}
                </p>
              ))}
            </div>
            <Link to="/pricing" className="mt-8 inline-flex items-center gap-2 text-[13px] font-black text-coral-dark hover:underline">
              See flat monthly pricing <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Reveal>

          <Reveal delay={0.1} variant="scale">
            <CommissionComparisonMockup />
          </Reveal>
        </div>
      </section>

      <section className="px-6 py-28">
        <div className="mx-auto max-w-7xl">
          <Reveal className="mx-auto max-w-3xl text-center">
            <p className="eyebrow mb-5">One connected journey</p>
            <h2 className="font-display text-[clamp(38px,5.5vw,64px)] font-medium leading-[1.02]">A guest request should never become front-desk data entry.</h2>
          </Reveal>
          <div className="mt-16 grid gap-4 md:grid-cols-4">
            {[
              { number: "01", icon: CalendarDays, title: "Guest searches", copy: "Dates, party size and live room inventory." },
              { number: "02", icon: Layers3, title: "Builds the stay", copy: "One room or a capacity-checked multi-room cart." },
              { number: "03", icon: ShieldCheck, title: "Reviews & submits", copy: "Rates, taxes, promo savings and hotel policies." },
              { number: "04", icon: BellRing, title: "Your team knows", copy: "Reservation, alert, email and insight—already connected." },
            ].map((step, index) => (
              <Reveal key={step.number} delay={index * 0.08} className="h-full">
                <div className="group h-full rounded-[24px] border border-line bg-card p-6 shadow-card transition-all hover:-translate-y-1 hover:shadow-float">
                  <div className="flex items-center justify-between"><span className="text-[10px] font-black tracking-[.16em] text-ink-faint">{step.number}</span><step.icon className="h-5 w-5 text-coral-dark" /></div>
                  <h3 className="mt-12 text-[16px] font-black text-ink">{step.title}</h3>
                  <p className="mt-2 text-[13px] leading-relaxed text-ink-mute">{step.copy}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-line bg-mist px-6 py-28">
        <div className="mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-[1.08fr_.92fr]">
          <Reveal variant="scale"><MultiRoomMockup /></Reveal>
          <Reveal delay={0.08}>
            <p className="eyebrow mb-5">Built for real stays</p>
            <h2 className="font-display text-[clamp(38px,5vw,58px)] font-medium leading-[1.03]">One cart, several rooms, no availability gamble.</h2>
            <p className="mt-6 text-[16px] leading-relaxed text-ink-soft">
              Guests can combine room types and quantities, see whether the selection fits their party, apply a valid promo code and review one clear total.
            </p>
            <div className="mt-8 space-y-3">
              {["Real-time room counts by date", "Atomic multi-room submission—never half a booking", "Promo and corporate rates update before submission"].map((item) => (
                <p key={item} className="flex items-center gap-3 text-[13px] font-bold text-ink-soft"><span className="grid h-6 w-6 place-items-center rounded-full bg-emerald-50 text-emerald-700"><Check className="h-3 w-3" /></span>{item}</p>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      <section className="px-6 py-28">
        <div className="mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-[.88fr_1.12fr]">
          <Reveal>
            <p className="eyebrow mb-5">The hotel stays visible</p>
            <h2 className="font-display text-[clamp(38px,5vw,58px)] font-medium leading-[1.03]">InnFlo powers it. Your hotel owns the experience.</h2>
            <p className="mt-6 text-[16px] leading-relaxed text-ink-soft">
              Your name, logo, room photography, amenities and chosen color theme shape the guest journey. Your cancellation policy and booking terms appear before the request is sent.
            </p>
            <div className="mt-8 grid grid-cols-2 gap-3">
              {[
                [Palette, "4 visual themes"],
                [Globe2, "Hotel subdomain"],
                [Tag, "Rate-plan codes"],
                [Percent, "Tax-aware totals"],
              ].map(([Icon, label]) => {
                const ItemIcon = Icon as typeof Palette;
                return <div key={String(label)} className="flex items-center gap-2.5 rounded-2xl border border-line bg-white p-3 text-[11px] font-black text-ink-soft"><ItemIcon className="h-4 w-4 text-coral-dark" />{String(label)}</div>;
              })}
            </div>
          </Reveal>
          <Reveal variant="scale" delay={0.08}><BrandControlsMockup /></Reveal>
        </div>
      </section>

      <section className="overflow-hidden bg-ink px-6 py-28 text-white">
        <div className="mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-[.9fr_1.1fr]">
          <Reveal>
            <p className="mb-5 text-[11px] font-black uppercase tracking-[.18em] text-coral">Back at the hotel</p>
            <h2 className="font-display text-[clamp(40px,5vw,62px)] font-medium leading-[1.02] text-paper">The request lands where the work already happens.</h2>
            <p className="mt-6 max-w-xl text-[16px] leading-relaxed text-white/55">
              The front desk receives a persistent alert and chime. The reservation appears in the PMS as an enquiry. If the guest provided email, InnFlo sends a polished request receipt automatically.
            </p>
            <div className="mt-9 grid gap-3 sm:grid-cols-3">
              {[
                [BellRing, "Live staff alert"],
                [MailCheck, "Guest email"],
                [BarChart3, "Direct insights"],
              ].map(([Icon, label]) => {
                const ItemIcon = Icon as typeof BellRing;
                return <div key={String(label)} className="rounded-2xl border border-white/10 bg-white/[.05] p-4"><ItemIcon className="h-5 w-5 text-coral" /><p className="mt-5 text-[11px] font-black text-white/75">{String(label)}</p></div>;
              })}
            </div>
          </Reveal>
          <Reveal variant="scale" delay={0.08}><HubMockup /></Reveal>
        </div>
      </section>

      <section className="border-b border-line bg-[#F9F1EA] px-6 py-24">
        <Reveal className="mx-auto grid max-w-5xl items-center gap-8 rounded-[30px] border border-coral/15 bg-white p-7 shadow-card sm:p-10 lg:grid-cols-[auto_1fr_auto]">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-coral-soft text-coral-dark"><Clock3 className="h-6 w-6" /></span>
          <div>
            <p className="text-[17px] font-black text-ink">A booking-request flow, by design today.</p>
            <p className="mt-2 text-[13px] leading-relaxed text-ink-mute">No payment is collected online yet. The hotel confirms the request and handles its deposit process directly—clearly stated to the guest before submission.</p>
          </div>
          <Link to="/contact" className="flex h-11 items-center justify-center rounded-full bg-ink px-6 text-[12px] font-black text-white hover:bg-coral-dark">Talk through your flow</Link>
        </Reveal>
      </section>

      <section className="px-6 py-28">
        <Reveal variant="scale" className="mx-auto max-w-6xl overflow-hidden rounded-[36px] bg-coral px-7 py-16 text-center text-white shadow-hero sm:px-12">
          <Sparkles className="mx-auto h-6 w-6 text-white/75" />
          <h2 className="mx-auto mt-7 max-w-3xl font-display text-[clamp(42px,6vw,70px)] font-medium leading-[.98]">Turn your own traffic into direct booking requests.</h2>
          <p className="mx-auto mt-6 max-w-xl text-[15px] leading-relaxed text-white/70">See the guest journey, the front-desk alert and the Booking Engine hub in one live walkthrough.</p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <Link to="/contact" className="flex h-12 items-center gap-2 rounded-full bg-ink px-7 text-[13px] font-black text-white">Book a walkthrough <ArrowRight className="h-4 w-4" /></Link>
            <a href="https://demo-hotel.innflo.co" target="_blank" rel="noopener noreferrer" className="flex h-12 items-center rounded-full border border-white/35 px-7 text-[13px] font-black text-white hover:bg-white/10">Open live demo</a>
          </div>
        </Reveal>
      </section>

      <section className="px-6 py-28">
        <div className="mx-auto max-w-4xl">
          <Reveal className="text-center">
            <p className="eyebrow mb-4">Straight answers</p>
            <h2 className="font-display text-[clamp(38px,5vw,56px)] font-medium">Before you put it on your website.</h2>
          </Reveal>
          <Reveal delay={0.08} className="mt-12 overflow-hidden rounded-[26px] border border-line bg-white shadow-card">
            {FAQS.map((faq, index) => {
              const expanded = openFaq === index;
              return (
                <div key={faq.q} className={index === FAQS.length - 1 ? "" : "border-b border-line-soft"}>
                  <button type="button" onClick={() => setOpenFaq(expanded ? null : index)} className="flex w-full items-center justify-between gap-6 px-6 py-5 text-left sm:px-8" aria-expanded={expanded}>
                    <span className="text-[15px] font-black text-ink">{faq.q}</span>
                    <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full transition-colors ${expanded ? "bg-coral text-white" : "bg-mist text-ink-soft"}`}><ChevronDown className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`} /></span>
                  </button>
                  <AnimatePresence initial={false}>
                    {expanded && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.28, ease: EASE }} className="overflow-hidden">
                        <p className="px-6 pb-6 pr-14 text-[13.5px] leading-relaxed text-ink-mute sm:px-8 sm:pr-20">{faq.a}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </Reveal>
        </div>
      </section>
    </div>
  );
}
