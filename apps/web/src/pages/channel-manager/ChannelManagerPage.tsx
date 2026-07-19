import { useState, useRef } from "react";
import {
  Globe, Zap, RefreshCcw, BarChart3, Shield, Clock,
  TrendingUp, CheckCircle2, Layers, GitMerge, Bell,
} from "lucide-react";
import { cn } from "@/lib/cn";

// ─── Keyframe CSS ─────────────────────────────────────────────────────────────

const STYLES = `
@keyframes hub-float {
  0%, 100% { transform: translateY(0px); }
  50%       { transform: translateY(-10px); }
}
@keyframes cm-shimmer {
  0%   { background-position: -200% center; }
  100% { background-position: 200% center; }
}
@keyframes cm-badge-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(var(--color-accent), 0.4); }
  50%       { box-shadow: 0 0 0 8px rgba(var(--color-accent), 0); }
}
@keyframes cm-step-in {
  from { opacity: 0; transform: translateX(-16px); }
  to   { opacity: 1; transform: translateX(0); }
}
`;

// ─── Types ────────────────────────────────────────────────────────────────────

interface Channel {
  id:    string;
  name:  string;
  color: string;
  bg:    string;
  abbr:  string;
  angle: number;
}

interface Feature {
  icon:  React.ElementType;
  title: string;
  desc:  string;
  color: string;
  bg:    string;
}

interface Step {
  n:     string;
  title: string;
  desc:  string;
  icon:  React.ElementType;
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const CHANNELS: Channel[] = [
  { id: "booking", name: "Booking.com", color: "#003580", bg: "#E8EFF9", abbr: "BK", angle: 0   },
  { id: "expedia", name: "Expedia",     color: "#FFB700", bg: "#FFF8E0", abbr: "EX", angle: 60  },
  { id: "airbnb",  name: "Airbnb",      color: "#FF5A5F", bg: "#FFF0F0", abbr: "AB", angle: 120 },
  { id: "hotels",  name: "Hotels.com",  color: "#D4001E", bg: "#FDE8EB", abbr: "HC", angle: 180 },
  { id: "agoda",   name: "Agoda",       color: "#5C85FF", bg: "#EEF2FF", abbr: "AG", angle: 240 },
  { id: "direct",  name: "Direct Book", color: "#059669", bg: "#E6F4EF", abbr: "WB", angle: 300 },
];

const FEATURES: Feature[] = [
  {
    icon:  Zap,
    title: "Real-time Sync",
    desc:  "Availability and rates update across every channel the moment you make a change — no delays, no gaps.",
    color: "#D97706",
    bg:    "#FFF8E1",
  },
  {
    icon:  Shield,
    title: "Zero Double Bookings",
    desc:  "When a room is sold, inventory closes on all other channels instantly. No more overbooking embarrassments.",
    color: "#059669",
    bg:    "#E6F4EF",
  },
  {
    icon:  BarChart3,
    title: "Channel Performance",
    desc:  "See which OTAs drive the most revenue. Shift availability toward your best-performing channels.",
    color: "#2563EB",
    bg:    "#EEF3FF",
  },
  {
    icon:  RefreshCcw,
    title: "Two-way Sync",
    desc:  "Bookings from any channel flow directly into the PMS. Changes you make sync back automatically.",
    color: "#7C3AED",
    bg:    "#F3EEFF",
  },
  {
    icon:  Globe,
    title: "100+ Channels",
    desc:  "Connect to every major OTA — Booking.com, Expedia, Airbnb, Agoda, MakeMyTrip, and many more.",
    color: "#E11D48",
    bg:    "#FFF0F3",
  },
  {
    icon:  Clock,
    title: "Save 3+ Hours Daily",
    desc:  "Eliminate manual updates across every platform. What takes hours of work now happens in milliseconds.",
    color: "#64748B",
    bg:    "#F1F5F9",
  },
];

const STEPS: Step[] = [
  {
    n:     "01",
    title: "Set rates & inventory once",
    desc:  "Configure room types, pricing, restrictions, and availability inside your PMS — one place, one time.",
    icon:  Layers,
  },
  {
    n:     "02",
    title: "Channel Manager distributes",
    desc:  "Your inventory is instantly pushed to all connected OTAs — perfectly synchronized, no manual work.",
    icon:  GitMerge,
  },
  {
    n:     "03",
    title: "Bookings flow back automatically",
    desc:  "Reservations from any channel land directly in your PMS. Rooms update in real-time across all platforms.",
    icon:  TrendingUp,
  },
];

const STATS = [
  { value: "100+", label: "OTA Channels" },
  { value: "<1s",  label: "Sync Speed" },
  { value: "0",    label: "Double Bookings" },
  { value: "3hrs", label: "Saved Daily" },
];

// ─── SVG Hub geometry ─────────────────────────────────────────────────────────

const SVG_W = 540;
const SVG_H = 390;
const CX = 270;
const CY = 192;
const RX = 200;
const RY = 86;

function toRad(deg: number) { return (deg * Math.PI) / 180; }

function orbitalPos(angle: number) {
  return {
    x: CX + RX * Math.cos(toRad(angle)),
    y: CY + RY * Math.sin(toRad(angle)),
  };
}

// ─── Hub Visualization ────────────────────────────────────────────────────────

function HubVisualization() {
  return (
    <svg
      viewBox={`0 0 ${SVG_W} ${SVG_H}`}
      className="w-full max-w-[540px] mx-auto select-none"
    >
      <defs>
        <radialGradient id="cm-center-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="rgb(var(--color-accent))" stopOpacity="0.18" />
          <stop offset="100%" stopColor="rgb(var(--color-accent))" stopOpacity="0" />
        </radialGradient>
        <filter id="cm-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="4" stdDeviation="8" floodColor="rgba(0,0,0,0.10)" />
        </filter>
        <filter id="cm-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* Ambient center glow */}
      <ellipse cx={CX} cy={CY} rx={240} ry={110} fill="url(#cm-center-glow)" />

      {/* Outer dashed orbit ring */}
      <ellipse
        cx={CX} cy={CY} rx={RX} ry={RY}
        fill="none"
        stroke="rgba(0,0,0,0.07)"
        strokeWidth="1.5"
        strokeDasharray="5 5"
      />
      {/* Inner orbit ring (subtle) */}
      <ellipse
        cx={CX} cy={CY} rx={RX * 0.55} ry={RY * 0.55}
        fill="none"
        stroke="rgba(var(--color-accent),0.12)"
        strokeWidth="1"
        strokeDasharray="3 6"
      />

      {/* Connection lines */}
      {CHANNELS.map((ch) => {
        const p = orbitalPos(ch.angle);
        const depth = (Math.sin(toRad(ch.angle)) + 1) / 2;
        return (
          <line
            key={`line-${ch.id}`}
            x1={p.x} y1={p.y} x2={CX} y2={CY}
            stroke={ch.color}
            strokeWidth="1.5"
            strokeOpacity={0.12 + 0.22 * depth}
            strokeDasharray="4 3"
          />
        );
      })}

      {/* Animated data packets — channel → center */}
      {CHANNELS.map((ch, i) => {
        const p  = orbitalPos(ch.angle);
        const dur = 1.6 + i * 0.18;
        const delay = i * 0.42;
        return (
          <circle key={`pkt-${ch.id}`} r="3.5" fill={ch.color} filter="url(#cm-glow)">
            <animateMotion
              dur={`${dur}s`}
              begin={`${delay}s`}
              repeatCount="indefinite"
              path={`M ${p.x} ${p.y} L ${CX} ${CY}`}
            />
            <animate
              attributeName="opacity"
              values="0;1;1;0"
              keyTimes="0;0.08;0.88;1"
              dur={`${dur}s`}
              begin={`${delay}s`}
              repeatCount="indefinite"
            />
            <animate
              attributeName="r"
              values="2;3.5;3.5;1.5"
              keyTimes="0;0.08;0.88;1"
              dur={`${dur}s`}
              begin={`${delay}s`}
              repeatCount="indefinite"
            />
          </circle>
        );
      })}

      {/* Pulse rings from center */}
      {[0, 1.0, 2.0].map((delay, i) => (
        <circle key={`pulse-${i}`} cx={CX} cy={CY} fill="none" stroke="rgb(var(--color-accent))" strokeWidth="1.5">
          <animate attributeName="r"       values="30;78"  dur="3s" begin={`${delay}s`} repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.5;0"  dur="3s" begin={`${delay}s`} repeatCount="indefinite" />
        </circle>
      ))}

      {/* Channel nodes — rendered in depth order (back to front) */}
      {[...CHANNELS]
        .sort((a, b) => Math.sin(toRad(a.angle)) - Math.sin(toRad(b.angle)))
        .map((ch) => {
          const p     = orbitalPos(ch.angle);
          const depth = (Math.sin(toRad(ch.angle)) + 1) / 2;
          const r     = 24 + 5 * depth;
          const below = p.y > CY;
          const lx    = p.x;
          const ly    = below ? p.y + r + 15 : p.y - r - 5;

          return (
            <g key={`node-${ch.id}`}>
              {/* Drop shadow ellipse */}
              <ellipse
                cx={p.x} cy={p.y + r + 2}
                rx={r * 0.65} ry={3.5}
                fill="rgba(0,0,0,0.07)"
              />
              {/* Circle background */}
              <circle
                cx={p.x} cy={p.y} r={r}
                fill={ch.bg}
                stroke={ch.color}
                strokeWidth="1.8"
                strokeOpacity={0.4 + 0.35 * depth}
                filter="url(#cm-shadow)"
              />
              {/* Abbreviation */}
              <text
                x={p.x} y={p.y}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={9.5 + 2 * depth}
                fontWeight="800"
                fontFamily="system-ui, sans-serif"
                fill={ch.color}
              >
                {ch.abbr}
              </text>
              {/* Channel name label */}
              <text
                x={lx} y={ly}
                textAnchor="middle"
                dominantBaseline={below ? "hanging" : "auto"}
                fontSize="9"
                fontWeight="600"
                fontFamily="system-ui, sans-serif"
                fill="#555"
                opacity={0.55 + 0.35 * depth}
              >
                {ch.name}
              </text>
            </g>
          );
        })}

      {/* Center hotel node */}
      <g filter="url(#cm-shadow)">
        {/* Outer halo */}
        <circle cx={CX} cy={CY} r="46" fill="white" opacity="0.95" />
        {/* Accent ring */}
        <circle cx={CX} cy={CY} r="46" fill="none" stroke="rgb(var(--color-accent))" strokeWidth="2" strokeOpacity="0.2" />
        {/* Inner tinted disc */}
        <circle cx={CX} cy={CY} r="36" fill="rgb(var(--color-accent))" fillOpacity="0.08" />

        {/* Hotel building icon (SVG paths, no emoji) */}
        <g transform={`translate(${CX - 11}, ${CY - 14})`}>
          {/* Building body */}
          <rect x="0" y="7" width="22" height="18" rx="1.5" fill="rgb(var(--color-accent))" fillOpacity="0.75" />
          {/* Roof */}
          <rect x="4" y="2" width="14" height="5.5" rx="1" fill="rgb(var(--color-accent))" fillOpacity="0.5" />
          {/* Roof peak */}
          <polygon points="11,0 6,2 16,2" fill="rgb(var(--color-accent))" fillOpacity="0.6" />
          {/* Windows row 1 */}
          <rect x="2"  y="9.5" width="4" height="4" rx="0.8" fill="white" fillOpacity="0.75" />
          <rect x="9"  y="9.5" width="4" height="4" rx="0.8" fill="white" fillOpacity="0.75" />
          <rect x="16" y="9.5" width="4" height="4" rx="0.8" fill="white" fillOpacity="0.75" />
          {/* Windows row 2 */}
          <rect x="2"  y="15.5" width="4" height="4" rx="0.8" fill="white" fillOpacity="0.65" />
          <rect x="16" y="15.5" width="4" height="4" rx="0.8" fill="white" fillOpacity="0.65" />
          {/* Door */}
          <rect x="9" y="16" width="4" height="9" rx="0.8" fill="white" fillOpacity="0.5" />
        </g>
      </g>

      {/* "YOUR PMS" label under center */}
      <text
        x={CX} y={CY + 58}
        textAnchor="middle"
        fontSize="8.5"
        fontWeight="800"
        fontFamily="system-ui, sans-serif"
        fill="rgb(var(--color-accent))"
        letterSpacing="0.12em"
        opacity="0.85"
      >
        YOUR PMS
      </text>
    </svg>
  );
}

// ─── Tilt Card ────────────────────────────────────────────────────────────────

function TiltCard({ feature: f }: { feature: Feature }) {
  const ref  = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const Icon = f.icon;

  function onMove(e: React.MouseEvent) {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const cx = rect.left + rect.width  / 2;
    const cy = rect.top  + rect.height / 2;
    setTilt({
      x: ((e.clientY - cy) / rect.height) * -10,
      y: ((e.clientX - cx) / rect.width)  *  10,
    });
  }

  const isResting = tilt.x === 0 && tilt.y === 0;

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={() => setTilt({ x: 0, y: 0 })}
      style={{
        transform:  `perspective(900px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) translateZ(${isResting ? 0 : 6}px)`,
        transition: isResting ? "transform 0.5s cubic-bezier(.2,.8,.2,1)" : "transform 0.08s linear",
        transformStyle: "preserve-3d",
      }}
      className="rounded-2xl border border-line bg-card p-6 cursor-default shadow-card hover:shadow-pop"
    >
      <div
        className="grid place-items-center h-11 w-11 rounded-xl mb-4"
        style={{ background: f.bg, color: f.color }}
      >
        <Icon size={20} />
      </div>
      <h3 className="font-semibold text-ink text-[15px] mb-2">{f.title}</h3>
      <p className="text-[13.5px] text-ink-mute leading-relaxed">{f.desc}</p>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ChannelManagerPage() {
  const [email,   setEmail]   = useState("");
  const [notified, setNotified] = useState(false);

  function handleNotify(e: React.FormEvent) {
    e.preventDefault();
    if (email.trim()) setNotified(true);
  }

  return (
    <div className="min-h-screen bg-paper pb-24">
      <style>{STYLES}</style>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden px-6 pt-14 pb-4 text-center">
        {/* Radial background wash */}
        <div
          className="pointer-events-none absolute inset-0 -z-10"
          style={{ background: "radial-gradient(ellipse 70% 50% at 50% 0%, rgba(var(--color-accent),0.07), transparent)" }}
        />

        {/* Coming Soon badge */}
        <div
          className="inline-flex items-center gap-2 rounded-full bg-coral-soft px-4 py-1.5 mb-6"
          style={{ animation: "cm-badge-pulse 2.5s ease-in-out infinite" }}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-coral animate-pulse" />
          <span className="text-[11px] font-black uppercase tracking-[0.18em] text-coral">Coming Soon</span>
        </div>

        <h1 className="serif text-[46px] leading-tight text-ink mb-3">
          Channel Manager
        </h1>
        <p className="text-[15.5px] text-ink-mute max-w-lg mx-auto leading-relaxed mb-10">
          Connect your hotel to 100+ booking platforms simultaneously.
          Rates, availability, and reservations — synchronized in under one second.
        </p>

        {/* Stats strip */}
        <div className="flex items-center justify-center gap-8 mb-12 flex-wrap">
          {STATS.map((s) => (
            <div key={s.label} className="text-center">
              <p className="serif text-[28px] text-coral leading-none">{s.value}</p>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* 3D Hub */}
        <div
          className="max-w-[540px] mx-auto"
          style={{ animation: "hub-float 4.5s ease-in-out infinite" }}
        >
          <HubVisualization />
        </div>

        <p className="text-[12px] text-ink-faint mt-2 tracking-wide">
          Live data packets flowing between channels and your PMS
        </p>
      </section>

      {/* ── Features ─────────────────────────────────────────────────────── */}
      <section className="px-6 pt-16 pb-12">
        <div className="max-w-5xl mx-auto">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-coral text-center mb-2">
            What's included
          </p>
          <h2 className="serif text-[32px] text-ink text-center mb-2">
            Everything you need, nothing you don't
          </h2>
          <p className="text-[14px] text-ink-mute text-center max-w-md mx-auto mb-10">
            Built for hotels that want to scale distribution without scaling complexity.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f, i) => (
              <div key={i} className="anim-fade-up" style={{ animationDelay: `${i * 60}ms` }}>
                <TiltCard feature={f} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────── */}
      <section className="px-6 py-16 bg-mist border-y border-line-soft">
        <div className="max-w-2xl mx-auto">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-coral text-center mb-2">
            How it works
          </p>
          <h2 className="serif text-[32px] text-ink text-center mb-12">
            Three steps, zero effort
          </h2>

          <div className="relative">
            {/* Vertical connecting line */}
            <div className="absolute left-6 top-6 bottom-6 w-px bg-line-soft" aria-hidden="true" />

            <div className="space-y-10">
              {STEPS.map((step, i) => {
                const Icon = step.icon;
                return (
                  <div
                    key={i}
                    className="flex items-start gap-6 anim-fade-up"
                    style={{ animationDelay: `${i * 120}ms` }}
                  >
                    {/* Step icon — sits on the connecting line */}
                    <div className="relative z-10 grid place-items-center h-12 w-12 rounded-2xl bg-coral-soft text-coral shrink-0 shadow-card">
                      <Icon size={20} />
                    </div>

                    <div className="pt-1">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-[10.5px] font-black tracking-[0.2em] text-coral">{step.n}</span>
                        <h3 className="text-[15px] font-bold text-ink">{step.title}</h3>
                      </div>
                      <p className="text-[13.5px] text-ink-mute leading-relaxed">{step.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ── Benefits list ────────────────────────────────────────────────── */}
      <section className="px-6 py-16">
        <div className="max-w-3xl mx-auto">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-coral text-center mb-2">
            Why it matters
          </p>
          <h2 className="serif text-[32px] text-ink text-center mb-10">
            The competitive edge
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              "Stop losing bookings to manual update delays",
              "Appear on every major platform guests use to search",
              "Adjust rates across all channels from one dashboard",
              "Get reservations from Airbnb, Expedia, Booking all in one inbox",
              "Set channel-specific restrictions (min nights, stop sell)",
              "Overbooking protection runs automatically, 24/7",
              "Track which channels have the best conversion rate",
              "Reduce dependency on any single OTA with diversification",
            ].map((benefit, i) => (
              <div
                key={i}
                className="flex items-start gap-3 rounded-xl border border-line-soft bg-card p-4 anim-fade-up"
                style={{ animationDelay: `${i * 40}ms` }}
              >
                <CheckCircle2 size={16} className="text-coral mt-0.5 shrink-0" />
                <p className="text-[13.5px] text-ink-soft leading-snug">{benefit}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Notify CTA ───────────────────────────────────────────────────── */}
      <section className="px-6 py-16">
        <div className="max-w-md mx-auto text-center">
          <div className="grid place-items-center h-14 w-14 rounded-2xl bg-coral-soft text-coral mx-auto mb-5">
            <Bell size={24} />
          </div>

          <h2 className="serif text-[28px] text-ink mb-2">Be the first to know</h2>
          <p className="text-[14px] text-ink-mute mb-7 leading-relaxed">
            We're building Channel Manager right now. Drop your email and we'll notify you the moment it goes live.
          </p>

          {notified ? (
            <div className="flex items-center justify-center gap-2.5 rounded-2xl bg-pine-soft border border-pine/20 px-5 py-4 anim-scale-in">
              <CheckCircle2 size={18} className="text-pine-deep" />
              <p className="text-[14px] font-semibold text-pine-deep">You're on the list — we'll reach out soon!</p>
            </div>
          ) : (
            <form onSubmit={handleNotify} className="flex gap-2.5">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="flex-1 h-11 rounded-full border border-line bg-card px-4 text-[14px] text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-coral/20 focus:border-coral/40 transition-colors"
              />
              <button
                type="submit"
                className="h-11 px-5 rounded-full bg-coral text-white text-[13.5px] font-semibold hover:bg-coral-dark transition-colors shadow-pop whitespace-nowrap"
              >
                Notify me
              </button>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}
