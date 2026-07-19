import { useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp, BedDouble, Wallet, Users, FileSpreadsheet,
  Printer, ShieldCheck, CheckCircle2, PieChart, Plus, LogIn, LogOut, Banknote,
} from "lucide-react";
import Reveal from "../components/motion/Reveal";
import SplitHeading from "../components/motion/SplitHeading";
import MagneticButton from "../components/motion/MagneticButton";

const EASE = [0.16, 1, 0.3, 1] as const;

// ─── 1. Owner's glance — Dashboard KPI row + revenue trend ──────────────────
const OWNER_KPIS = [
  { icon: LogIn,    label: "Arrivals today",   value: "6",           delta: "+2",   dir: "up" as const },
  { icon: LogOut,   label: "Departures today", value: "4",           delta: "−1",   dir: "down" as const },
  { icon: Wallet,   label: "To collect",       value: "PKR 38,200",  delta: "+12%", dir: "up" as const },
  { icon: Banknote, label: "Revenue today",    value: "PKR 96,400",  delta: "+18%", dir: "up" as const },
];

const TREND_POINTS = [38, 52, 44, 61, 58, 70, 65, 82, 74, 91, 85, 96, 88, 100];

function OwnerGlanceMockup() {
  const [range, setRange] = useState<"14d" | "30d" | "6m">("14d");
  const max = Math.max(...TREND_POINTS);
  const peakIdx = TREND_POINTS.indexOf(max);
  const w = 320, h = 100, step = w / (TREND_POINTS.length - 1);
  const points = TREND_POINTS.map((v, i) => `${i * step},${h - (v / max) * (h - 10)}`).join(" ");
  const areaPoints = `0,${h} ${points} ${w},${h}`;

  return (
    <div className="rounded-2xl overflow-hidden font-body bg-card border border-line shadow-float">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-line-soft bg-mist">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-red-400 opacity-50" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400 opacity-50" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 opacity-50" />
          <span className="ml-3 text-[11.5px] text-ink-mute font-semibold tracking-wide">InnFlo — Dashboard</span>
        </div>
        <span className="text-[10px] font-bold text-ink-mute">Good morning, Ahmed</span>
      </div>

      <div className="p-5">
        <div className="grid grid-cols-2 gap-3 mb-5">
          {OWNER_KPIS.map((k, i) => (
            <motion.div
              key={k.label}
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08, duration: 0.4, ease: EASE }}
              className="rounded-xl border border-line-soft bg-mist p-3"
            >
              <div className="flex items-center justify-between mb-1.5">
                <k.icon className="h-3.5 w-3.5 text-ink-mute" strokeWidth={2} />
                <span className={`text-[9.5px] font-bold ${k.dir === "up" ? "text-emerald-600" : "text-coral-dark"}`}>
                  {k.delta}
                </span>
              </div>
              <p className="text-[14px] font-black text-ink leading-none">{k.value}</p>
              <p className="text-[9.5px] text-ink-mute mt-1">{k.label}</p>
            </motion.div>
          ))}
        </div>

        <div className="flex items-center justify-between mb-2.5">
          <p className="text-[10.5px] font-bold uppercase tracking-wider text-ink-mute">Revenue trend</p>
          <div className="flex items-center rounded-full border border-line-soft overflow-hidden">
            {(["14d", "30d", "6m"] as const).map(r => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-2.5 py-1 text-[9px] font-bold transition-colors ${range === r ? "bg-coral text-white" : "text-ink-mute"}`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        <svg viewBox={`0 0 ${w} ${h + 10}`} className="w-full h-[100px]">
          <defs>
            <linearGradient id="rev-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#E0532B" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#E0532B" stopOpacity="0" />
            </linearGradient>
          </defs>
          <motion.polygon
            points={areaPoints}
            fill="url(#rev-fill)"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          />
          <motion.polyline
            points={points}
            fill="none"
            stroke="#E0532B"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            whileInView={{ pathLength: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1.1, ease: EASE }}
          />
          <circle
            cx={peakIdx * step}
            cy={h - (TREND_POINTS[peakIdx] / max) * (h - 10)}
            r="4"
            fill="#E0532B"
            stroke="white"
            strokeWidth="2"
          />
        </svg>
      </div>
    </div>
  );
}

// ─── 2. Daily report — accountant reconciliation angle ──────────────────────
function DailyReportMockup() {
  return (
    <div className="rounded-2xl overflow-hidden font-body bg-card border border-line shadow-float">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-line-soft bg-mist">
        <div>
          <p className="text-[12.5px] font-bold text-ink">Daily Operations Report</p>
          <p className="text-[10px] text-ink-mute">Saturday, 5 July 2026</p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-7 w-7 rounded-lg border border-line-soft grid place-items-center"><FileSpreadsheet className="h-3.5 w-3.5 text-ink-mute" /></span>
          <span className="h-7 w-7 rounded-lg border border-line-soft grid place-items-center"><Printer className="h-3.5 w-3.5 text-ink-mute" /></span>
        </div>
      </div>

      <div className="p-5 space-y-4">
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: "Occupancy", value: "82%" },
            { label: "Collected", value: "PKR 96k" },
            { label: "Check-ins", value: "6" },
            { label: "Check-outs", value: "4" },
          ].map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06 }}
              className="rounded-lg bg-mist border border-line-soft p-2 text-center"
            >
              <p className="text-[13px] font-black text-ink">{s.value}</p>
              <p className="text-[8.5px] text-ink-mute mt-0.5">{s.label}</p>
            </motion.div>
          ))}
        </div>

        <div>
          <p className="text-[9.5px] font-bold uppercase tracking-wider text-ink-mute mb-1.5">Revenue by method</p>
          <div className="flex flex-wrap gap-1.5">
            {["Cash: PKR 24k", "JazzCash: PKR 31k", "Bank: PKR 41k"].map(m => (
              <span key={m} className="text-[9.5px] font-semibold bg-mist border border-line-soft text-ink-soft px-2 py-1 rounded-full">{m}</span>
            ))}
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 6 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 flex items-center justify-between"
        >
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-800">Cash Variance</p>
            <p className="text-[9.5px] text-emerald-700 mt-0.5">Expected PKR 24,000 · Ledger PKR 24,000</p>
          </div>
          <span className="flex items-center gap-1 text-[10.5px] font-bold text-emerald-700">
            <CheckCircle2 className="h-3.5 w-3.5" /> Reconciled
          </span>
        </motion.div>
      </div>
    </div>
  );
}

// ─── 3. Monthly report — business intelligence / auditor angle ─────────────
const REVENUE_BARS = [64, 78, 58, 92, 71, 85, 60];
const PAYMENT_SPLIT = [
  { label: "Bank Transfer", pct: 38, color: "#3A6BC4" },
  { label: "JazzCash",      pct: 27, color: "#E0532B" },
  { label: "Cash",          pct: 21, color: "#0A5C53" },
  { label: "Easypaisa",     pct: 14, color: "#D97706" },
];

function MonthlyBIMockup() {
  let acc = 0;
  const segments = PAYMENT_SPLIT.map(p => {
    const start = acc;
    acc += p.pct;
    return { ...p, start, end: acc };
  });
  const r = 34, circumference = 2 * Math.PI * r;

  return (
    <div className="rounded-2xl overflow-hidden font-body bg-card border border-line shadow-float">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-line-soft bg-mist">
        <p className="text-[12.5px] font-bold text-ink">Monthly Summary — June 2026</p>
        <span className="text-[9px] font-bold text-coral-dark bg-coral-soft px-2 py-0.5 rounded-full uppercase tracking-wider">Exec Summary</span>
      </div>

      <div className="p-5 space-y-4">
        <div className="grid grid-cols-2 gap-2.5">
          <div className="rounded-lg bg-emerald-50/60 border border-emerald-200/60 p-2.5">
            <div className="flex items-center gap-1 text-emerald-700"><TrendingUp className="h-3 w-3" /><span className="text-[8.5px] font-bold uppercase">Net Profit</span></div>
            <p className="text-[15px] font-black text-emerald-800 mt-0.5">PKR 2.32M</p>
            <p className="text-[8.5px] text-emerald-700">Margin: 34%</p>
          </div>
          <div className="rounded-lg bg-mist border border-line-soft p-2.5">
            <div className="flex items-center gap-1 text-ink-mute"><BedDouble className="h-3 w-3" /><span className="text-[8.5px] font-bold uppercase">Avg Occupancy</span></div>
            <p className="text-[15px] font-black text-ink mt-0.5">78%</p>
            <p className="text-[8.5px] text-ink-mute">ADR: PKR 12,400</p>
          </div>
          <div className="rounded-lg bg-mist border border-line-soft p-2.5">
            <span className="text-[8.5px] font-bold uppercase text-ink-mute">RevPAR</span>
            <p className="text-[15px] font-black text-ink mt-0.5">PKR 9,300</p>
          </div>
          <div className="rounded-lg bg-mist border border-line-soft p-2.5">
            <span className="text-[8.5px] font-bold uppercase text-ink-mute">Avg Stay</span>
            <p className="text-[15px] font-black text-ink mt-0.5">2.4 nights</p>
          </div>
        </div>

        <div className="flex items-center gap-5">
          <div className="flex-1">
            <p className="text-[9px] font-bold uppercase tracking-wider text-ink-mute mb-2">Revenue trend</p>
            <div className="flex items-end gap-1.5 h-[64px]">
              {REVENUE_BARS.map((v, i) => (
                <motion.div
                  key={i}
                  className="flex-1 rounded-t-sm bg-coral"
                  style={{ opacity: 0.55 + (v / 100) * 0.45 }}
                  initial={{ height: 0 }}
                  whileInView={{ height: `${v}%` }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: i * 0.06, ease: EASE }}
                />
              ))}
            </div>
          </div>

          <div className="shrink-0">
            <svg width="88" height="88" viewBox="0 0 88 88">
              {segments.map(s => (
                <motion.circle
                  key={s.label}
                  cx="44" cy="44" r={r}
                  fill="none"
                  stroke={s.color}
                  strokeWidth="10"
                  strokeDasharray={`${(s.end - s.start) / 100 * circumference} ${circumference}`}
                  strokeDashoffset={-(s.start / 100) * circumference}
                  transform="rotate(-90 44 44)"
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5 }}
                />
              ))}
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}

const AUDIENCE_FEATURES = [
  { icon: BedDouble,     tag: "Owner",      text: "Check in from anywhere — arrivals, departures, and revenue vs. yesterday, in four numbers, no report to open" },
  { icon: ShieldCheck,   tag: "Accountant", text: "Cash variance reconciliation flags a drawer mismatch the same day it happens, not weeks later at month-end" },
  { icon: FileSpreadsheet, tag: "Auditor",  text: "Every daily and monthly report exports to Excel or prints to PDF — a paper trail that holds up to scrutiny" },
  { icon: PieChart,      tag: "Accountant", text: "ADR, RevPAR, profit margin, and payment-method splits — the exact vocabulary an accountant already uses" },
  { icon: Users,         tag: "Owner",      text: "Top guests, occupancy by room type, and department summaries roll up automatically, no manual cross-referencing" },
];

const STAT_FAQS = [
  {
    q: "What's the difference between the Dashboard and the Reports?",
    a: "The Dashboard is the fast glance — today's arrivals, departures, and revenue with a trend chart. Daily and Monthly Reports are the deeper, exportable documents built for closing the books.",
  },
  {
    q: "Can I export reports for my accountant?",
    a: "Yes — both Daily and Monthly reports export to Excel and print cleanly to PDF, formatted for handing off rather than screenshotting.",
  },
  {
    q: "Does it catch cash drawer discrepancies?",
    a: "Yes — the Daily Report includes a cash variance reconciliation comparing expected cash to the ledger balance, and flags it the same day if the two don't match.",
  },
  {
    q: "What accounting terms does it actually use?",
    a: "ADR, RevPAR, profit margin, average length of stay — the same vocabulary an accountant already works in, not a homegrown metric you have to translate.",
  },
  {
    q: "Do I need to open a report every day as the owner?",
    a: "No — the Dashboard KPI row and the nightly WhatsApp briefing are built for a glance. Reports are there when you or your accountant need the full detail.",
  },
];

function StatFaqRow({ q, a, isOpen, isLast, onClick }: { q: string; a: string; isOpen: boolean; isLast: boolean; onClick: () => void }) {
  return (
    <div className={isLast ? "" : "border-b border-line-soft"}>
      <button
        onClick={onClick}
        aria-expanded={isOpen}
        className="w-full flex items-center justify-between gap-6 px-6 sm:px-8 py-5 text-left"
      >
        <span className="text-[16px] sm:text-[17px] font-bold font-body text-ink">{q}</span>
        <span className={`shrink-0 h-5 w-5 rounded-md bg-coral shadow-pop grid place-items-center transition-transform duration-300 ${isOpen ? "rotate-45" : ""}`}>
          <Plus className="h-2.5 w-2.5 text-white" strokeWidth={3} />
        </span>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: EASE }}
            className="overflow-hidden"
          >
            <p className="text-[14.5px] text-ink-soft font-body leading-relaxed text-justify px-6 sm:px-8 pb-6 pr-14">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function Statistics() {
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
          <Reveal variant="fade"><p className="eyebrow mb-6">Statistics</p></Reveal>
          <h1 className="font-display text-[clamp(38px,6vw,64px)] font-medium leading-[1.05] text-ink">
            <SplitHeading as="span" className="block">From a glance</SplitHeading>
            <SplitHeading as="span" delay={0.2} className="block italic text-coral-dark">to an audit.</SplitHeading>
          </h1>
          <Reveal delay={0.45}>
            <p className="text-[17px] text-ink-soft font-body leading-relaxed max-w-lg mx-auto mt-6">
              One set of numbers, three ways to read them — a morning glance for the owner, a reconciled daily close for the accountant, and an exportable monthly picture for whoever asks questions with a calculator.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ── 1. Owner's glance ─────────────────────────────────────────────────── */}
      <section className="py-20 px-6">
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-1 lg:grid-cols-[45%_55%] gap-14 items-center">
            <Reveal>
              <p className="eyebrow mb-4">For the owner</p>
              <h2 className="font-display text-[clamp(28px,3.4vw,40px)] font-medium leading-tight text-ink mb-5">
                The whole day, in four numbers.
              </h2>
              <p className="text-[15.5px] text-ink-soft font-body leading-relaxed mb-6 max-w-lg">
                Arrivals, departures, what's still to collect, and today's revenue — each compared against yesterday, so you know at a glance whether today is ahead or behind, not just what the number is.
              </p>
              <div className="grid grid-cols-1 gap-2.5 font-body text-[13.5px] text-ink-soft">
                {[
                  "Day-over-day deltas on every KPI, not just a static number",
                  "Revenue trend chart — 14 days, 30 days, or 6 months",
                  "Peak day called out automatically",
                  "No report to open — this is the first thing you see",
                ].map(f => <p key={f} className="flex items-start gap-2.5"><span className="text-coral mt-0.5">—</span>{f}</p>)}
              </div>
            </Reveal>
            <Reveal delay={0.1}><OwnerGlanceMockup /></Reveal>
          </div>
        </div>
      </section>

      {/* ── 2. Daily report — accountant ──────────────────────────────────────── */}
      <section className="py-20 px-6 bg-mist border-y border-line">
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-1 lg:grid-cols-[55%_45%] gap-14 items-center">
            <Reveal delay={0.1} className="order-2 lg:order-1"><DailyReportMockup /></Reveal>
            <Reveal className="order-1 lg:order-2">
              <p className="eyebrow mb-4">For the accountant</p>
              <h2 className="font-display text-[clamp(28px,3.4vw,40px)] font-medium leading-tight text-ink mb-5">
                The daily close, reconciled.
              </h2>
              <p className="text-[15.5px] text-ink-soft font-body leading-relaxed mb-6 max-w-lg">
                Occupancy, collections, and revenue by payment method — plus a cash variance check that compares the expected drawer amount against the ledger and flags a mismatch same-day, not at month-end.
              </p>
              <div className="grid grid-cols-1 gap-2.5 font-body text-[13.5px] text-ink-soft">
                {[
                  "Cash drawer reconciliation, flagged the day it happens",
                  "Arrivals, departures, and stay-overs, fully itemized",
                  "Expenses broken down by category, same day",
                  "Export to Excel or print to PDF directly",
                ].map(f => <p key={f} className="flex items-start gap-2.5"><span className="text-coral mt-0.5">—</span>{f}</p>)}
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── 3. Monthly report — business intelligence / auditor ────────────────── */}
      <section className="py-20 px-6">
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-1 lg:grid-cols-[45%_55%] gap-14 items-center">
            <Reveal>
              <p className="eyebrow mb-4">For the auditor</p>
              <h2 className="font-display text-[clamp(28px,3.4vw,40px)] font-medium leading-tight text-ink mb-5">
                The monthly picture, already built.
              </h2>
              <p className="text-[15.5px] text-ink-soft font-body leading-relaxed mb-6 max-w-lg">
                Net profit and margin, ADR, RevPAR, average length of stay, revenue trend, payment-method mix, top guests, occupancy by room type — the full monthly summary, in the vocabulary an accountant already uses.
              </p>
              <div className="grid grid-cols-1 gap-2.5 font-body text-[13.5px] text-ink-soft">
                {[
                  "Net profit / loss with margin %, ADR, and RevPAR",
                  "Revenue trend against occupancy, side by side",
                  "Payment method mix as a proportional breakdown",
                  "Group bookings, maintenance cost, and top guests included",
                ].map(f => <p key={f} className="flex items-start gap-2.5"><span className="text-coral mt-0.5">—</span>{f}</p>)}
              </div>
            </Reveal>
            <Reveal delay={0.1}><MonthlyBIMockup /></Reveal>
          </div>
        </div>
      </section>

      {/* ── Who it's for ───────────────────────────────────────────────────────── */}
      <section className="py-24 px-6 bg-mist border-y border-line">
        <div className="mx-auto max-w-7xl">
          <Reveal variant="fade" className="text-center mb-14">
            <p className="eyebrow mb-4">Built for three readers</p>
            <h2 className="font-display text-[clamp(28px,3.8vw,42px)] font-medium leading-tight text-ink">
              The owner, the accountant, and whoever's checking their work.
            </h2>
          </Reveal>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
            {AUDIENCE_FEATURES.map((f, i) => (
              <Reveal key={f.text} delay={i * 0.05} variant="rise">
                <div className="h-full rounded-2xl bg-card border border-line p-6 shadow-card hover:shadow-float transition-all duration-300">
                  <div className="flex items-center justify-between mb-4">
                    <div className="h-10 w-10 rounded-xl bg-coral-soft grid place-items-center">
                      <f.icon className="h-4.5 w-4.5 text-coral-dark" strokeWidth={2.25} />
                    </div>
                    <span className="text-[9px] font-bold text-coral-dark bg-coral-soft px-2 py-0.5 rounded-full uppercase tracking-wider">{f.tag}</span>
                  </div>
                  <p className="text-[13.5px] text-ink-soft font-body leading-relaxed">{f.text}</p>
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
              Start your free 14-day trial.
            </h2>
            <p className="text-[16px] font-body leading-relaxed max-w-lg mx-auto mb-9" style={{ color: "rgba(245,235,228,0.68)" }}>
              No card required, no obligation to continue — see if InnFlo fits your property first.
            </p>
            <MagneticButton>
              <Link
                to="/contact"
                className="inline-flex items-center h-12 px-9 rounded-full text-[16px] font-bold font-body bg-coral hover:bg-coral-dark text-white transition-colors shadow-pop"
              >
                Start your free 14-day trial →
              </Link>
            </MagneticButton>
          </Reveal>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────────────── */}
      <section className="py-24 px-6">
        <div className="mx-auto max-w-4xl">
          <Reveal variant="fade" className="text-center mb-10">
            <h2 className="font-display text-[clamp(30px,4vw,44px)] font-medium leading-tight text-ink">
              Got a question?
            </h2>
          </Reveal>
          <Reveal variant="rise">
            <div className="rounded-3xl bg-card shadow-float overflow-hidden">
              {STAT_FAQS.map((item, i) => (
                <StatFaqRow
                  key={item.q}
                  q={item.q}
                  a={item.a}
                  isLast={i === STAT_FAQS.length - 1}
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
