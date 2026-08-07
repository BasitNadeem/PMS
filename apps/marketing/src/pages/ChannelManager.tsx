import { useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap, ShieldCheck, BarChart3, RefreshCcw, Globe2, Clock,
  Layers, GitMerge, TrendingUp, CheckCircle2, Plus,
} from "lucide-react";
import Reveal from "../components/motion/Reveal";
import SplitHeading from "../components/motion/SplitHeading";
import MagneticButton from "../components/motion/MagneticButton";

const CM_FAQS = [
  {
    q: "What is a channel manager?",
    a: "Software that keeps your room availability and rates synchronized across every OTA you list on — so a booking on one channel automatically closes that room everywhere else.",
  },
  {
    q: "How does Innflo's channel manager work?",
    a: "The planned flow is to set rates and inventory once inside Innflo, distribute them to connected OTAs, and return incoming bookings to the Innflo calendar. This module is still in development.",
  },
  {
    q: "Which channels and OTAs can I connect to?",
    a: "Booking.com, Airbnb, Expedia and Agoda are the initial integration targets. Final supported channels will be confirmed before launch.",
  },
  {
    q: "Will a channel manager stop overbookings?",
    a: "That's the point of it — the instant a room sells on any connected channel, it closes on every other channel automatically, so the same room can't be sold twice.",
  },
  {
    q: "How much will Channel Manager cost?",
    a: "Pricing has not been finalized. Innflo’s existing PMS plans remain flat monthly subscriptions with no percentage commission on direct Booking Engine reservations.",
  },
  {
    q: "Can I connect a channel Innflo doesn't list?",
    a: "Get in touch and tell us which one — the channel list above is what we're building first, not the ceiling of what's possible.",
  },
  {
    q: "How long does it take to set up?",
    a: "Once it's live, connecting a channel is meant to take minutes, not days — map your room types once and the sync takes over from there.",
  },
  {
    q: "Can I manage more than one property?",
    a: "Innflo accounts are property-isolated today. Multi-property management is separate roadmap work and is not being promised as part of the first Channel Manager release.",
  },
];

function ChannelFaqRow({ q, a, isOpen, isLast, onClick }: { q: string; a: string; isOpen: boolean; isLast: boolean; onClick: () => void }) {
  return (
    <div className={isLast ? "" : "border-b border-line-soft"}>
      <button
        onClick={onClick}
        aria-expanded={isOpen}
        className="w-full flex items-center justify-between gap-6 px-6 sm:px-8 py-5 text-left"
      >
        <span className="text-[16px] sm:text-[17px] font-bold font-body text-ink">{q}</span>
        <span
          className={`shrink-0 h-5 w-5 rounded-md bg-coral shadow-pop grid place-items-center transition-transform duration-300 ${isOpen ? "rotate-45" : ""}`}
        >
          <Plus className="h-2.5 w-2.5 text-white" strokeWidth={3} />
        </span>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <p className="text-[14.5px] text-ink-soft font-body leading-relaxed text-justify px-6 sm:px-8 pb-6 pr-14">
              {a}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Data (mirrors apps/web's in-app Channel Manager "coming soon" page) ───
const CHANNELS = [
  { id: "booking", name: "Booking.com", color: "#003580", bg: "#E8EFF9", abbr: "B.", angle: 270 },
  { id: "airbnb",  name: "Airbnb",      color: "#FF5A5F", bg: "#FFF0F0", abbr: "A.", angle: 330 },
  { id: "expedia", name: "Expedia",     color: "#FFC000", bg: "#FFF8E0", abbr: "E.", angle: 30,  dark: true },
  { id: "agoda",   name: "Agoda",       color: "#5B1E96", bg: "#F1EBFB", abbr: "Ag", angle: 90  },
  { id: "more",    name: "+2 more",     color: "#4A453E", bg: "#EFE9E0", abbr: "···", angle: 150 },
];

const STATS = [
  { value: "6",    label: "Channels connecting" },
  { value: "<1s",  label: "Target sync speed" },
  { value: "0",    label: "Double bookings, by design" },
  { value: "24/7", label: "Always watching inventory" },
];

const FEATURES = [
  { icon: Zap,        title: "Real-time sync",        body: "Availability and rates update across every connected channel the moment you make a change in Innflo — no delays, no manual publishing." },
  { icon: ShieldCheck, title: "Zero double bookings",  body: "The instant a room sells anywhere, it closes everywhere else. Overbooking stops being something you have to watch for." },
  { icon: BarChart3,  title: "Channel performance",    body: "See which OTAs actually drive revenue for your property, and shift availability toward the ones that perform." },
  { icon: RefreshCcw, title: "Two-way sync",           body: "Bookings from any channel land directly in Innflo. Changes you make in Innflo sync back out automatically." },
  { icon: Globe2,      title: "Every major OTA",        body: "Booking.com, Airbnb, Expedia, and Agoda to start — with Bookme.pk and Sastaticket.pk built for how guests actually book in this market." },
  { icon: Clock,       title: "Hours back, every day",  body: "No more logging into five different extranets to update the same rate. Set it once, in one place." },
];

const STEPS = [
  { n: "01", icon: Layers,     title: "Set rates & inventory once",       body: "Configure room types, pricing, restrictions, and availability inside Innflo — one place, one time." },
  { n: "02", icon: GitMerge,   title: "Channel Manager distributes",      body: "Your inventory pushes out to every connected OTA, kept in sync with no manual re-entry." },
  { n: "03", icon: TrendingUp, title: "Bookings flow back automatically", body: "A reservation from any channel lands directly in Innflo, and every other channel updates in real time." },
];

const BENEFITS = [
  "Stop losing bookings to manual update delays",
  "Appear on every major platform guests already search",
  "Adjust rates across all channels from one dashboard",
  "Reservations from Airbnb, Expedia, and Booking.com in one inbox",
  "Set channel-specific restrictions — minimum nights, stop-sell",
  "Overbooking protection running automatically, around the clock",
];

// ─── Live hub mockup — channels orbiting into Innflo, animated data flow ───
const SVG_W = 460, SVG_H = 340, CX = 230, CY = 170, RX = 170, RY = 118;
function toRad(deg: number) { return (deg * Math.PI) / 180; }
function orbital(angle: number) {
  return { x: CX + RX * Math.cos(toRad(angle)), y: CY + RY * Math.sin(toRad(angle)) };
}

function ChannelHubMockup() {
  return (
    <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="w-full max-w-[460px] mx-auto select-none">
      <defs>
        <radialGradient id="hub-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#E0532B" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#E0532B" stopOpacity="0" />
        </radialGradient>
        <filter id="hub-shadow" x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="3" stdDeviation="6" floodColor="rgba(33,30,26,0.14)" />
        </filter>
      </defs>

      <ellipse cx={CX} cy={CY} rx={210} ry={140} fill="url(#hub-glow)" />
      <ellipse cx={CX} cy={CY} rx={RX} ry={RY} fill="none" stroke="#E0D3BC" strokeWidth="1.5" strokeDasharray="5 5" />

      {CHANNELS.map(ch => {
        const p = orbital(ch.angle);
        return <line key={`l-${ch.id}`} x1={p.x} y1={p.y} x2={CX} y2={CY} stroke={ch.color} strokeWidth="1.5" strokeOpacity="0.25" strokeDasharray="4 3" />;
      })}

      {CHANNELS.map((ch, i) => {
        const p = orbital(ch.angle);
        const dur = 1.8 + i * 0.22;
        const delay = i * 0.4;
        return (
          <circle key={`pkt-${ch.id}`} r="3.5" fill={ch.color}>
            <animateMotion dur={`${dur}s`} begin={`${delay}s`} repeatCount="indefinite" path={`M ${p.x} ${p.y} L ${CX} ${CY}`} />
            <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.08;0.88;1" dur={`${dur}s`} begin={`${delay}s`} repeatCount="indefinite" />
          </circle>
        );
      })}

      {[0, 1.2, 2.4].map((delay, i) => (
        <circle key={`pulse-${i}`} cx={CX} cy={CY} r="30" fill="none" stroke="#E0532B" strokeWidth="1.5">
          <animate attributeName="r" values="26;70" dur="3.2s" begin={`${delay}s`} repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.45;0" dur="3.2s" begin={`${delay}s`} repeatCount="indefinite" />
        </circle>
      ))}

      {CHANNELS.map(ch => {
        const p = orbital(ch.angle);
        const below = p.y > CY;
        return (
          <g key={`n-${ch.id}`} filter="url(#hub-shadow)">
            <circle cx={p.x} cy={p.y} r="26" fill={ch.bg} stroke={ch.color} strokeWidth="1.8" strokeOpacity="0.7" />
            <text x={p.x} y={p.y} textAnchor="middle" dominantBaseline="central" fontSize="10.5" fontWeight="800" fontFamily="system-ui, sans-serif" fill={ch.color}>
              {ch.abbr}
            </text>
            <text
              x={p.x} y={below ? p.y + 40 : p.y - 34}
              textAnchor="middle"
              fontSize="9.5"
              fontWeight="700"
              fontFamily="system-ui, sans-serif"
              fill="#4A453E"
            >
              {ch.name}
            </text>
          </g>
        );
      })}

      <g filter="url(#hub-shadow)">
        <circle cx={CX} cy={CY} r="38" fill="#211E1A" />
        <text x={CX} y={CY - 4} textAnchor="middle" fontFamily="Fraunces, Georgia, serif" fontStyle="italic" fontSize="15" fill="#F5EBE4">IF</text>
        <text x={CX} y={CY + 14} textAnchor="middle" fontSize="6.5" fontWeight="800" letterSpacing="0.1em" fill="#E0532B">INNFLO</text>
      </g>
    </svg>
  );
}

// ─── Live availability mockup — paired next to the hub ──────────────────
function AvailabilityMockup() {
  const rooms = [
    { num: "Single",  bars: [{ start: 0, span: 3, color: "#D97706", label: "Steve Patel" }, { start: 4, span: 3, color: "#2563EB", label: "Noah A." }] },
    { num: "Double",  bars: [{ start: 0, span: 2, color: "#2563EB", label: "Alison Larsen" }, { start: 3, span: 4, color: "#D97706", label: "Ethan Cooper" }] },
    { num: "Queen",   bars: [{ start: 0, span: 2, color: "#059669", label: "Paul Bergen" }, { start: 3, span: 3, color: "#0A5C53", label: "Ava Mitchell" }] },
    { num: "King",    bars: [{ start: 0, span: 3, color: "#D97706", label: "Jason Brooks" }, { start: 4, span: 3, color: "#2563EB", label: "Loa Erikson" }] },
  ];
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const COL = 40, ROOM = 62, ROW = 40;

  return (
    <div className="rounded-2xl overflow-hidden font-body bg-card border border-line shadow-float">
      <div className="flex items-center gap-1.5 px-4 py-3 border-b border-line-soft bg-mist">
        <span className="h-2.5 w-2.5 rounded-full bg-red-400 opacity-50" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-400 opacity-50" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 opacity-50" />
        <span className="ml-3 text-[11px] text-ink-mute font-semibold tracking-wide">Innflo — Availability</span>
      </div>

      <div className="flex bg-mist border-b border-line-soft">
        <div style={{ width: ROOM }} className="shrink-0 px-2 py-2">
          <span className="text-[9px] font-bold text-ink-mute uppercase tracking-wider">Room</span>
        </div>
        {days.map((d, i) => (
          <div key={d} style={{ width: COL }} className="shrink-0 text-center py-2">
            <span className={`text-[9px] font-bold ${i === 2 ? "text-coral-dark" : "text-ink-mute"}`}>{d}</span>
          </div>
        ))}
      </div>

      {rooms.map(room => (
        <div key={room.num} className="flex items-center relative border-b border-line-soft/60" style={{ height: ROW }}>
          <div style={{ width: ROOM }} className="shrink-0 px-2">
            <span className="text-[10px] font-bold text-ink-soft">{room.num}</span>
          </div>
          <div className="relative flex-1" style={{ height: "100%" }}>
            {room.bars.map((bar, bi) => (
              <div
                key={bi}
                className="absolute flex items-center px-2 rounded-full shadow-sm overflow-hidden"
                style={{
                  left: bar.start * COL + 2,
                  width: bar.span * COL - 4,
                  height: 22,
                  top: (ROW - 22) / 2,
                  background: bar.color,
                }}
              >
                <span className="text-[8px] font-bold text-white truncate">{bar.label}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ChannelManager() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <div className="bg-paper text-ink">

      {/* ── Opener ─────────────────────────────────────────────────────────── */}
      <section className="pt-40 pb-16 px-6 bg-grid relative overflow-hidden text-center">
        <div
          className="absolute pointer-events-none left-1/2 -translate-x-1/2"
          style={{ top: "-15%", width: "70%", height: "60%", background: "radial-gradient(ellipse, rgba(224,83,43,0.09), transparent 65%)" }}
        />
        <div className="relative mx-auto max-w-2xl">
          <div className="flex items-center justify-center gap-3 mb-6">
            <Reveal variant="fade"><p className="eyebrow">Always in sync</p></Reveal>
            <span className="text-[10px] font-bold font-body text-coral-dark bg-coral-soft px-2.5 py-1 rounded-full uppercase tracking-wider">
              In development
            </span>
          </div>
          <h1 className="font-display text-[clamp(38px,6vw,64px)] font-medium leading-[1.05] text-ink">
            <SplitHeading as="span" className="block">Connect to the</SplitHeading>
            <SplitHeading as="span" delay={0.2} className="block italic text-coral-dark">channels that matter.</SplitHeading>
          </h1>
          <Reveal delay={0.45}>
            <p className="text-[17px] text-ink-soft font-body leading-relaxed max-w-lg mx-auto mt-6">
              Sync availability and rates across every channel and manage it all from one place — this is what we're building toward, no double bookings, no manual publishing.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ── Live mockup: hub + availability ──────────────────────────────────── */}
      <section className="pb-20 px-6">
        <div className="mx-auto max-w-7xl">
          <Reveal variant="scale">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.15fr] gap-8 items-center rounded-3xl bg-mist border border-line p-8 md:p-12">
              <ChannelHubMockup />
              <AvailabilityMockup />
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <div className="flex items-center justify-center gap-10 flex-wrap mt-12">
              {STATS.map(s => (
                <div key={s.label} className="text-center">
                  <p className="font-display text-[28px] text-coral-dark leading-none">{s.value}</p>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-ink-mute mt-1.5">{s.label}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Features ──────────────────────────────────────────────────────────── */}
      <section className="py-24 px-6 bg-mist border-y border-line">
        <div className="mx-auto max-w-7xl">
          <Reveal variant="fade" className="text-center mb-14">
            <p className="eyebrow mb-4">What's included</p>
            <h2 className="font-display text-[clamp(28px,3.8vw,42px)] font-medium leading-tight text-ink">
              Everything you need, nothing you don't.
            </h2>
          </Reveal>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={i * 0.05} variant="rise">
                <div className="h-full rounded-2xl bg-card border border-line p-7 shadow-card hover:shadow-float transition-all duration-300">
                  <div className="h-11 w-11 rounded-xl bg-coral-soft grid place-items-center mb-5">
                    <f.icon className="h-5 w-5 text-coral-dark" strokeWidth={2.25} />
                  </div>
                  <p className="text-[16px] font-bold text-ink font-body mb-2">{f.title}</p>
                  <p className="text-[14px] text-ink-soft font-body leading-relaxed">{f.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────────── */}
      <section className="py-24 px-6">
        <div className="mx-auto max-w-2xl">
          <Reveal variant="fade" className="text-center mb-14">
            <p className="eyebrow mb-4">How it works</p>
            <h2 className="font-display text-[clamp(28px,3.8vw,42px)] font-medium leading-tight text-ink">
              Three steps, zero effort.
            </h2>
          </Reveal>

          <div className="relative">
            <div className="absolute left-6 top-6 bottom-6 w-px bg-line" aria-hidden="true" />
            <div className="space-y-10">
              {STEPS.map((step, i) => (
                <Reveal key={step.n} delay={i * 0.1} className="flex items-start gap-6">
                  <div className="relative z-10 grid place-items-center h-12 w-12 rounded-2xl bg-coral-soft text-coral-dark shrink-0 shadow-card">
                    <step.icon className="h-5 w-5" strokeWidth={2.25} />
                  </div>
                  <div className="pt-1">
                    <div className="flex items-center gap-2.5 mb-1.5">
                      <span className="text-[11px] font-black tracking-[0.2em] text-coral-dark">{step.n}</span>
                      <h3 className="text-[16px] font-bold text-ink font-body">{step.title}</h3>
                    </div>
                    <p className="text-[14.5px] text-ink-soft font-body leading-relaxed">{step.body}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Benefits ─────────────────────────────────────────────────────────── */}
      <section className="py-24 px-6 bg-mist border-y border-line">
        <div className="mx-auto max-w-4xl">
          <Reveal variant="fade" className="text-center mb-12">
            <p className="eyebrow mb-4">Why it matters</p>
            <h2 className="font-display text-[clamp(28px,3.8vw,42px)] font-medium leading-tight text-ink">
              The competitive edge.
            </h2>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {BENEFITS.map((b, i) => (
              <Reveal key={b} delay={i * 0.04}>
                <div className="flex items-start gap-3 rounded-xl border border-line bg-card p-4">
                  <CheckCircle2 className="h-4 w-4 text-coral-dark mt-0.5 shrink-0" />
                  <p className="text-[14.5px] text-ink-soft font-body leading-snug">{b}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Trial CTA — footer background ───────────────────────────────────── */}
      <section className="py-24 px-6 bg-ink">
        <div className="mx-auto max-w-2xl text-center">
          <Reveal>
            <p className="eyebrow mb-5" style={{ color: "#E0532B" }}>Get in early</p>
            <h2 className="font-display italic text-[clamp(30px,4vw,46px)] font-medium text-paper leading-tight mb-6">
              Start with a guided Innflo trial.
            </h2>
            <p className="text-[16px] font-body leading-relaxed max-w-lg mx-auto mb-9" style={{ color: "rgba(245,235,228,0.68)" }}>
              Be first in line when Channel Manager goes live — no card required, no obligation to continue.
            </p>
            <MagneticButton>
              <Link
                to="/contact"
                className="inline-flex items-center h-12 px-9 rounded-full text-[16px] font-bold font-body bg-coral hover:bg-coral-dark text-white transition-colors shadow-pop"
              >
                Book a guided trial →
              </Link>
            </MagneticButton>
          </Reveal>
        </div>
      </section>

      {/* ── FAQ ────────────────────────────────────────────────────────────── */}
      <section className="py-24 px-6 bg-paper">
        <div className="mx-auto max-w-4xl">
          <Reveal variant="fade" className="text-center mb-10">
            <h2 className="font-display text-[clamp(28px,3.8vw,42px)] font-medium leading-tight text-ink">
              Got a question?
            </h2>
          </Reveal>

          <Reveal variant="rise">
            <div className="rounded-3xl bg-card shadow-float overflow-hidden">
              {CM_FAQS.map((item, i) => (
                <ChannelFaqRow
                  key={item.q}
                  q={item.q}
                  a={item.a}
                  isLast={i === CM_FAQS.length - 1}
                  isOpen={openFaq === i}
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                />
              ))}
            </div>
          </Reveal>
        </div>
      </section>

    </div>
  );
}
