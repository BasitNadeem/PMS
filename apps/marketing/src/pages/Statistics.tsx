import { useState } from "react";
import type { ElementType } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp, BedDouble, Wallet, Users, FileSpreadsheet,
  Printer, CheckCircle2, Plus, LogIn, LogOut, Banknote,
  BarChart3, CalendarDays, CreditCard, Search, Wrench, Package,
  Utensils, RotateCcw, Scale, ArrowRight, ChevronRight, Activity,
} from "lucide-react";
import Reveal from "../components/motion/Reveal";
import SplitHeading from "../components/motion/SplitHeading";
import MagneticButton from "../components/motion/MagneticButton";

const EASE = [0.16, 1, 0.3, 1] as const;

type ReportCategoryId = "financial" | "occupancy" | "guests" | "operations" | "inventory" | "dining";

const REPORT_CATEGORIES: Array<{
  id: ReportCategoryId;
  label: string;
  shortLabel: string;
  icon: ElementType;
  count: number;
  question: string;
  reports: Array<{ name: string; detail: string; icon: ElementType }>;
}> = [
  {
    id: "financial",
    label: "Financial",
    shortLabel: "Money",
    icon: Banknote,
    count: 9,
    question: "Where did the money go—and does the close reconcile?",
    reports: [
      { name: "Daily Operations", detail: "Revenue, occupancy and shift close", icon: CalendarDays },
      { name: "Revenue by Source", detail: "Rooms, POS and other income", icon: TrendingUp },
      { name: "Outstanding Balances", detail: "Open folios aged by days", icon: Wallet },
      { name: "Cash / Bank Reconciliation", detail: "Account flows and net positions", icon: Scale },
    ],
  },
  {
    id: "occupancy",
    label: "Occupancy & performance",
    shortLabel: "Rooms",
    icon: BedDouble,
    count: 5,
    question: "Which rooms, rates and channels are actually performing?",
    reports: [
      { name: "Occupancy Trend", detail: "Daily occupancy over any range", icon: BarChart3 },
      { name: "ADR / RevPAR", detail: "Rate and room revenue performance", icon: TrendingUp },
      { name: "Room Type Performance", detail: "Occupancy and revenue by category", icon: BedDouble },
      { name: "Source of Business", detail: "Bookings and revenue by channel", icon: Activity },
    ],
  },
  {
    id: "guests",
    label: "Guests",
    shortLabel: "Guests",
    icon: Users,
    count: 4,
    question: "Who stays, who returns, and who creates the most value?",
    reports: [
      { name: "Guest Directory", detail: "Searchable guest history", icon: Users },
      { name: "Repeat Guests / VIP", detail: "Repeat stays ranked by spend", icon: TrendingUp },
      { name: "Guest Demographics", detail: "Nationality and guest-type mix", icon: PieChartIcon },
      { name: "Guest Blacklist", detail: "Current risk and severity snapshot", icon: RotateCcw },
    ],
  },
  {
    id: "operations",
    label: "Operations",
    shortLabel: "Ops",
    icon: Wrench,
    count: 4,
    question: "Where is the team fast, slow, blocked or over budget?",
    reports: [
      { name: "Housekeeping Performance", detail: "Tasks and completion time by staff", icon: CheckCircle2 },
      { name: "Maintenance Summary", detail: "Status, priority and cost variance", icon: Wrench },
      { name: "Staff Activity", detail: "Actions grouped by team member", icon: Users },
      { name: "Group Bookings", detail: "Room-nights, revenue and operator mix", icon: BedDouble },
    ],
  },
  {
    id: "inventory",
    label: "Inventory",
    shortLabel: "Stock",
    icon: Package,
    count: 3,
    question: "What was consumed, wasted, or needs reordering now?",
    reports: [
      { name: "Stock Consumption", detail: "Usage by period and category", icon: Package },
      { name: "Waste & Loss", detail: "Quantity and cost lost per item", icon: RotateCcw },
      { name: "Low Stock / Reorder", detail: "Priority and estimated reorder cost", icon: CheckCircle2 },
    ],
  },
  {
    id: "dining",
    label: "POS & dining",
    shortLabel: "Dining",
    icon: Utensils,
    count: 2,
    question: "What is selling—and how are guests ordering it?",
    reports: [
      { name: "POS Sales", detail: "Top items, categories and order value", icon: CreditCard },
      { name: "QR Orders", detail: "Volume by delivery and payment type", icon: Utensils },
    ],
  },
];

function PieChartIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M11 3a8 8 0 1 0 8 8h-8V3Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M14 3.6A8 8 0 0 1 20.4 10H14V3.6Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

function ReportsCommandCenter() {
  const [activeId, setActiveId] = useState<ReportCategoryId>("financial");
  const active = REPORT_CATEGORIES.find((category) => category.id === activeId) ?? REPORT_CATEGORIES[0];

  return (
    <div className="relative">
      <div className="absolute -inset-8 rounded-full bg-coral/15 blur-3xl" />
      <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[#211E1A] shadow-hero">
        <div className="flex h-12 items-center justify-between border-b border-white/10 px-4 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#F5A6A0]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#F5D183]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#9EDDC7]" />
            </div>
            <span className="truncate text-[9px] font-black text-white/45">InnFlo / Reports</span>
          </div>
          <span className="flex items-center gap-1.5 rounded-full bg-emerald-400/10 px-2.5 py-1 text-[7px] font-black text-emerald-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> LIVE PROPERTY DATA
          </span>
        </div>

        <div className="grid min-h-[430px] sm:grid-cols-[150px_minmax(0,1fr)]">
          <div className="hidden border-r border-white/10 p-3 sm:block">
            <p className="px-2 pb-2 pt-1 text-[7px] font-black uppercase tracking-[.18em] text-white/25">Report library</p>
            <div className="space-y-1">
              {REPORT_CATEGORIES.map((category) => {
                const Icon = category.icon;
                const selected = category.id === activeId;
                return (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => setActiveId(category.id)}
                    className={`flex w-full items-center gap-2 rounded-xl px-2.5 py-2.5 text-left transition-all ${
                      selected ? "bg-coral text-white shadow-[0_12px_24px_rgba(224,83,43,.2)]" : "text-white/45 hover:bg-white/[.06] hover:text-white"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span className="min-w-0 flex-1 truncate text-[7.5px] font-black">{category.shortLabel}</span>
                    <span className={`text-[7px] font-black ${selected ? "text-white/65" : "text-white/20"}`}>{category.count}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="min-w-0 bg-[#F7F3EE] p-4 sm:p-5">
            <div className="flex gap-2 overflow-x-auto pb-3 sm:hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {REPORT_CATEGORIES.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => setActiveId(category.id)}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-[7px] font-black ${
                    category.id === activeId ? "bg-coral text-white" : "border border-line bg-white text-ink-mute"
                  }`}
                >
                  {category.shortLabel}
                </button>
              ))}
            </div>

            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[7px] font-black uppercase tracking-[.18em] text-coral-dark">{active.label}</p>
                <h3 className="mt-2 max-w-[370px] font-display text-[21px] font-medium leading-tight text-ink">{active.question}</h3>
              </div>
              <div className="hidden h-8 items-center gap-2 rounded-xl border border-line bg-white px-3 sm:flex">
                <Search className="h-3 w-3 text-ink-faint" />
                <span className="text-[7px] font-bold text-ink-faint">Search reports</span>
              </div>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={active.id}
                initial={{ opacity: 0, y: 7 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.2 }}
                className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2"
              >
                {active.reports.map(({ name, detail, icon: Icon }, index) => (
                  <motion.div
                    key={name}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.045 }}
                    className="group flex min-h-[82px] items-center gap-3 rounded-2xl border border-line bg-white p-3 shadow-card"
                  >
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-coral-soft text-coral-dark">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[8.5px] font-black text-ink">{name}</span>
                      <span className="mt-1 block text-[6.5px] leading-relaxed text-ink-mute">{detail}</span>
                    </span>
                    <ChevronRight className="h-3.5 w-3.5 text-ink-faint" />
                  </motion.div>
                ))}
              </motion.div>
            </AnimatePresence>

            <div className="mt-4 flex items-center justify-between rounded-2xl border border-line bg-white px-4 py-3">
              <div>
                <p className="text-[8px] font-black text-ink">27 live report views</p>
                <p className="mt-0.5 text-[6.5px] text-ink-mute">Filtered by the dates and property data you choose</p>
              </div>
              <span className="flex items-center gap-1.5 text-[7px] font-black text-emerald-700">
                <FileSpreadsheet className="h-3.5 w-3.5" /> Excel ready
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── 1. Owner's glance — Dashboard KPI row + revenue trend ──────────────────
const OWNER_KPIS = [
  { icon: LogIn,    label: "Arrivals today",   value: "6",           delta: "+2",   dir: "up" as const },
  { icon: LogOut,   label: "Departures today", value: "4",           delta: "−1",   dir: "down" as const },
  { icon: Wallet,   label: "To collect",       value: "PKR 38,200",  delta: "+12%", dir: "up" as const },
  { icon: Banknote, label: "Revenue today",    value: "PKR 96,400",  delta: "+18%", dir: "up" as const },
];

const TREND_SETS: Record<"14d" | "30d" | "6m", number[]> = {
  "14d": [38, 52, 44, 61, 58, 70, 65, 82, 74, 91, 85, 96, 88, 100],
  "30d": [66, 61, 70, 74, 69, 82, 78, 85, 91, 87, 94, 90, 98, 96],
  "6m": [52, 58, 55, 64, 70, 68, 76, 72, 81, 88, 84, 92, 96, 100],
};

function OwnerGlanceMockup() {
  const [range, setRange] = useState<"14d" | "30d" | "6m">("14d");
  const trendPoints = TREND_SETS[range];
  const max = Math.max(...trendPoints);
  const peakIdx = trendPoints.indexOf(max);
  const w = 320, h = 100, step = w / (trendPoints.length - 1);
  const points = trendPoints.map((v, i) => `${i * step},${h - (v / max) * (h - 10)}`).join(" ");
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
            key={`${range}-area`}
            points={areaPoints}
            fill="url(#rev-fill)"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          />
          <motion.polyline
            key={`${range}-line`}
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
            cy={h - (trendPoints[peakIdx] / max) * (h - 10)}
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

type ReaderId = "owner" | "accountant" | "auditor";

const READER_VIEWS: Array<{
  id: ReaderId;
  label: string;
  eyebrow: string;
  question: string;
  answer: string;
  signal: string;
  signalMeta: string;
  reports: Array<{ name: string; meta: string; icon: ElementType }>;
}> = [
  {
    id: "owner",
    label: "Owner",
    eyebrow: "Morning view",
    question: "What needs my attention before breakfast?",
    answer: "A fast read of the day—then the detail is one click away when a number looks wrong.",
    signal: "3 rooms",
    signalMeta: "need attention today",
    reports: [
      { name: "Today at a Glance", meta: "Occupancy, arrivals and revenue", icon: Activity },
      { name: "Occupancy Trend", meta: "78% average over 30 days", icon: TrendingUp },
      { name: "Outstanding Balances", meta: "PKR 38,200 still to collect", icon: Wallet },
    ],
  },
  {
    id: "accountant",
    label: "Accountant",
    eyebrow: "Close-of-day view",
    question: "Does the day actually balance?",
    answer: "Collections, ledger movement and payment mix reconcile in the same place—without rebuilding the day in Excel.",
    signal: "PKR 0",
    signalMeta: "cash variance",
    reports: [
      { name: "Daily Operations", meta: "The complete business-day close", icon: CalendarDays },
      { name: "Cash / Bank Reconciliation", meta: "Expected and ledger values aligned", icon: Scale },
      { name: "Payment Method Breakdown", meta: "Cash, bank and mobile wallets", icon: CreditCard },
    ],
  },
  {
    id: "auditor",
    label: "Auditor",
    eyebrow: "Traceable view",
    question: "Can I follow the number back to an action?",
    answer: "Voids, refunds, staff actions and month-end summaries keep the paper trail attached to the hotel day.",
    signal: "100%",
    signalMeta: "actions attributed",
    reports: [
      { name: "Void & Refund Log", meta: "Every adjustment, reason and user", icon: RotateCcw },
      { name: "Staff Activity", meta: "Actions grouped by staff member", icon: Users },
      { name: "Monthly Summary", meta: "Exportable management picture", icon: FileSpreadsheet },
    ],
  },
];

function ReaderWorkspace() {
  const [activeId, setActiveId] = useState<ReaderId>("owner");
  const active = READER_VIEWS.find((reader) => reader.id === activeId) ?? READER_VIEWS[0];

  return (
    <div className="overflow-hidden rounded-[30px] border border-line bg-card shadow-float">
      <div className="flex flex-col gap-5 border-b border-line-soft bg-[#FBF8F4] px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[.18em] text-coral-dark">Same hotel data</p>
          <p className="mt-1 font-display text-[20px] font-medium text-ink">A useful answer for whoever is reading.</p>
        </div>
        <div className="flex rounded-full border border-line bg-white p-1 shadow-card">
          {READER_VIEWS.map((reader) => (
            <button
              key={reader.id}
              type="button"
              onClick={() => setActiveId(reader.id)}
              className={`rounded-full px-4 py-2 text-[11px] font-black transition-all ${
                activeId === reader.id ? "bg-ink text-white shadow-pop" : "text-ink-mute hover:text-ink"
              }`}
            >
              {reader.label}
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={active.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.22 }}
          className="grid lg:grid-cols-[.86fr_1.14fr]"
        >
          <div className="relative overflow-hidden bg-ink p-7 text-white sm:p-9 lg:min-h-[430px]">
            <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-coral/20 blur-3xl" />
            <div className="relative flex h-full flex-col">
              <p className="text-[9px] font-black uppercase tracking-[.18em] text-coral">{active.eyebrow}</p>
              <h3 className="mt-5 max-w-md font-display text-[clamp(30px,4vw,46px)] font-medium leading-[1.06]">
                {active.question}
              </h3>
              <p className="mt-5 max-w-md text-[14px] leading-relaxed text-white/52">{active.answer}</p>
              <div className="mt-9 rounded-2xl border border-white/10 bg-white/[.06] p-5 lg:mt-auto">
                <p className="font-display text-[34px] font-medium text-coral">{active.signal}</p>
                <p className="mt-1 text-[10px] font-bold text-white/42">{active.signalMeta}</p>
              </div>
            </div>
          </div>

          <div className="bg-[#F7F3EE] p-5 sm:p-7 lg:p-9">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[.18em] text-ink-mute">{active.label}&apos;s workspace</p>
                <p className="mt-1 text-[13px] font-bold text-ink">Only the reports this reader needs</p>
              </div>
              <span className="hidden items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-[8px] font-black text-emerald-700 sm:flex">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> CURRENT
              </span>
            </div>

            <div className="mt-6 space-y-3">
              {active.reports.map(({ name, meta, icon: Icon }, index) => (
                <motion.div
                  key={name}
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.07 }}
                  className="flex items-center gap-4 rounded-2xl border border-line bg-white p-4 shadow-card"
                >
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-coral-soft text-coral-dark">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-black text-ink">{name}</p>
                    <p className="mt-1 text-[9px] text-ink-mute">{meta}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-ink-faint" />
                </motion.div>
              ))}
            </div>

            <div className="mt-4 flex items-center gap-3 rounded-2xl border border-dashed border-coral/35 bg-coral-soft/45 px-4 py-3.5">
              <FileSpreadsheet className="h-4 w-4 shrink-0 text-coral-dark" />
              <p className="text-[9px] font-bold leading-relaxed text-ink-soft">
                Operational reports export to Excel. Daily and Monthly reports also print cleanly to PDF.
              </p>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

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
    a: "Not necessarily — the Dashboard KPI row is built for a fast daily glance. Reports are there when you or your accountant need the full detail.",
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
      <section className="relative overflow-hidden bg-grid px-6 pb-24 pt-36 lg:pt-40">
        <div
          className="pointer-events-none absolute left-[18%] top-[-12%] h-[62%] w-[62%]"
          style={{ background: "radial-gradient(ellipse, rgba(224,83,43,0.11), transparent 67%)" }}
        />
        <div className="relative mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-[.82fr_1.18fr]">
          <div>
            <Reveal variant="fade"><p className="eyebrow mb-6">Statistics</p></Reveal>
            <h1 className="font-display text-[clamp(42px,6vw,72px)] font-medium leading-[1.01] text-ink">
              <SplitHeading as="span" className="block">From a glance</SplitHeading>
              <SplitHeading as="span" delay={0.2} className="block italic text-coral-dark">to an audit.</SplitHeading>
            </h1>
            <Reveal delay={0.4}>
              <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-ink-soft">
                One source of truth for the owner&apos;s morning check, the accountant&apos;s daily close, and every question that comes after.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <MagneticButton>
                  <Link
                    to="/contact"
                    className="inline-flex h-12 items-center gap-2 rounded-full bg-coral px-7 text-[14px] font-bold text-white shadow-pop transition-colors hover:bg-coral-dark"
                  >
                    See reports in a walkthrough <ArrowRight className="h-4 w-4" />
                  </Link>
                </MagneticButton>
                <a
                  href="#report-readers"
                  className="inline-flex h-12 items-center gap-2 rounded-full border border-line bg-white px-6 text-[14px] font-bold text-ink transition-colors hover:border-coral/45"
                >
                  Who sees what <ChevronRight className="h-4 w-4 text-coral-dark" />
                </a>
              </div>
              <div className="mt-9 flex flex-wrap gap-x-7 gap-y-3 border-t border-line pt-5">
                {[
                  ["27", "live report views"],
                  ["6", "report categories"],
                  ["1", "property truth"],
                ].map(([value, label]) => (
                  <div key={label} className="flex items-baseline gap-2">
                    <span className="font-display text-[24px] font-medium text-coral-dark">{value}</span>
                    <span className="text-[10px] font-bold text-ink-mute">{label}</span>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
          <Reveal delay={0.12} variant="scale"><ReportsCommandCenter /></Reveal>
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
                Arrivals, departures, what&apos;s still to collect, and today&apos;s revenue sit together—so the first read tells you where to look next.
              </p>
              <div className="grid grid-cols-1 gap-2.5 font-body text-[13.5px] text-ink-soft">
                {[
                  "Occupancy, collections and room movement in one view",
                  "Revenue trend across short and long ranges",
                  "Open balances visible before they become surprises",
                  "Deeper reports stay one click away",
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

      {/* ── Who reads the numbers ─────────────────────────────────────────────── */}
      <section id="report-readers" className="border-y border-line bg-mist px-6 py-24">
        <div className="mx-auto max-w-7xl">
          <Reveal variant="fade" className="mx-auto mb-12 max-w-3xl text-center">
            <p className="eyebrow mb-4">Built for three readers</p>
            <h2 className="font-display text-[clamp(28px,3.8vw,42px)] font-medium leading-tight text-ink">
              The same numbers. A different answer for each role.
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-[15px] leading-relaxed text-ink-soft">
              InnFlo keeps the underlying property data consistent, then surfaces the reports each person needs to make their decision.
            </p>
          </Reveal>
          <Reveal variant="rise"><ReaderWorkspace /></Reveal>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────────────── */}
      <section className="bg-white px-6 py-24">
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
