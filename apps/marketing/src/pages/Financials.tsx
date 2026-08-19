import { useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Wallet, Landmark, Smartphone,
  ShieldCheck, Filter, CalendarClock, CheckCircle2, Plus,
} from "lucide-react";
import Reveal from "../components/motion/Reveal";
import SplitHeading from "../components/motion/SplitHeading";
import MagneticButton from "../components/motion/MagneticButton";

const FIN_FAQS = [
  {
    q: "Does Balance Book replace our physical cash book?",
    a: "That's the intent — every folio payment and expense posts to it automatically, so the manual tallying a physical book requires shouldn't be necessary day to day.",
  },
  {
    q: "What counts as a payment method in the balance breakdown?",
    a: "Cash drawer, bank account, JazzCash, and Easypaisa each get their own running balance — so you can see exactly how much sits in each, not just one combined number.",
  },
  {
    q: "Can I still record something manually?",
    a: "Yes — a cash withdrawal, a bank deposit, or any one-off adjustment that didn't originate from a folio or an expense can be logged by hand, and it shows up in the same ledger.",
  },
  {
    q: "Can I see the balance as of a past date, not just right now?",
    a: "Yes — pick any date and Balance Book shows what each account's balance looked like as of that day, not only the live figure.",
  },
  {
    q: "How many expense categories are there?",
    a: "Ten — salary, utilities, supplies, maintenance, food & beverage, marketing, rent, insurance, equipment, and miscellaneous — each filterable by date range.",
  },
  {
    q: "How many payment methods does a guest folio support?",
    a: "Ten — cash, JazzCash, EasyPaisa, credit card, debit card, bank transfer, cheque, advance deposit, OTA collect, and complimentary.",
  },
  {
    q: "Can a group booking split the bill across rooms?",
    a: "Yes — a group can settle as one combined bill or split by room, and each folio still rolls up into the same Balance Book automatically.",
  },
];

function FinFaqRow({ q, a, isOpen, isLast, onClick }: { q: string; a: string; isOpen: boolean; isLast: boolean; onClick: () => void }) {
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

const EASE = [0.16, 1, 0.3, 1] as const;

// ─── Live folio mockup — real charge categories & payment methods ──────────
const FOLIO_ITEMS = [
  { label: "Room Charge (Deluxe Suite · 2 nights)", cat: "Room",     tone: "#2563EB", amt: 24000 },
  { label: "Spa — Hot Stone Massage",                cat: "Spa",      tone: "#7C3AED", amt: 6500 },
  { label: "Room Service — Dinner",                  cat: "F&B",      tone: "#D97706", amt: 3200 },
  { label: "GST Sales Tax (8%)",                      cat: "Tax",      tone: "#4A453E", amt: 2696 },
];

function FolioMockup() {
  const total = FOLIO_ITEMS.reduce((s, i) => s + i.amt, 0);
  return (
    <div className="rounded-2xl overflow-hidden font-body bg-card border border-line shadow-float">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-line-soft bg-mist">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-red-400 opacity-50" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400 opacity-50" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 opacity-50" />
          <span className="ml-3 text-[11.5px] text-ink-mute font-semibold tracking-wide">Innflo — Guest Folio</span>
        </div>
        <span className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/50">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live
        </span>
      </div>

      <div className="p-5">
        <div className="flex items-center justify-between pb-3 mb-1 border-b border-line-soft">
          <div>
            <p className="text-[13.5px] font-bold text-ink">Alison Larsen · Room 108</p>
            <p className="text-[11px] text-ink-mute">Booking Ref: HPM-2026-00214</p>
          </div>
          <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">Open</span>
        </div>

        {FOLIO_ITEMS.map((item, i) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, x: -8 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1, duration: 0.4, ease: EASE }}
            className="flex items-center justify-between py-2.5 border-b border-line-soft/60"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span
                className="text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0"
                style={{ background: `${item.tone}18`, color: item.tone }}
              >
                {item.cat}
              </span>
              <span className="text-[12.5px] text-ink-soft truncate">{item.label}</span>
            </div>
            <span className="text-[12.5px] font-bold text-ink shrink-0 ml-3">PKR {item.amt.toLocaleString()}</span>
          </motion.div>
        ))}

        <div className="flex items-center justify-between pt-3 mt-1">
          <span className="text-[13px] font-bold text-ink">Total due</span>
          <span className="text-[16px] font-black text-ink">PKR {total.toLocaleString()}</span>
        </div>

        <div className="flex gap-2 mt-4">
          <button className="flex-1 h-9 rounded-lg border border-line text-[11.5px] font-bold text-ink-soft">+ Add Charge</button>
          <button className="flex-1 h-9 rounded-lg bg-coral text-white text-[11.5px] font-bold shadow-pop">Record Payment</button>
        </div>
      </div>
    </div>
  );
}

// ─── Expense category breakdown — animated bars ────────────────────────────
const EXPENSE_CATEGORIES = [
  { label: "Salary",         pct: 100, amt: 185000 },
  { label: "Supplies",       pct: 68,  amt: 126000 },
  { label: "Utilities",      pct: 52,  amt: 96000 },
  { label: "Maintenance",    pct: 34,  amt: 63000 },
  { label: "Marketing",      pct: 21,  amt: 39000 },
];

function ExpenseBreakdownMockup() {
  return (
    <div className="rounded-2xl overflow-hidden font-body bg-card border border-line shadow-float p-5">
      <div className="flex items-center justify-between pb-3 mb-4 border-b border-line-soft">
        <div>
          <p className="text-[13.5px] font-bold text-ink">June 2026 — By category</p>
          <p className="text-[11px] text-ink-mute">Top 5 of 10 categories</p>
        </div>
        <Filter className="h-4 w-4 text-ink-mute" strokeWidth={2} />
      </div>

      <div className="space-y-3.5">
        {EXPENSE_CATEGORIES.map((c, i) => (
          <div key={c.label} className="flex items-center gap-3">
            <span className="text-[11.5px] font-semibold text-ink-soft w-[76px] shrink-0 truncate">{c.label}</span>
            <div className="flex-1 h-4 rounded-full bg-mist overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-coral"
                style={{ opacity: 1 - i * 0.14 }}
                initial={{ width: 0 }}
                whileInView={{ width: `${c.pct}%` }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, delay: i * 0.08, ease: EASE }}
              />
            </div>
            <span className="text-[11.5px] font-bold text-ink-soft w-[70px] text-right shrink-0">
              PKR {(c.amt / 1000).toFixed(0)}k
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Balance Book — the star mockup: auto-logged ledger + per-method balances ──
const LEDGER = [
  { desc: "Room payment — Room 108",     source: "Folio",   method: "JazzCash",      dir: "in",  amt: 24000 },
  { desc: "Supplier invoice — Linens",   source: "Expense", method: "Bank Transfer", dir: "out", amt: 18500 },
  { desc: "Room payment — Room 104",     source: "Folio",   method: "Cash",          dir: "in",  amt: 15000 },
  { desc: "Staff salary — Housekeeping", source: "Expense", method: "Bank Transfer", dir: "out", amt: 45000 },
];

const ACCOUNTS = [
  { label: "Cash Drawer",  Icon: Wallet,     bg: "#E6F4EF", fg: "#0A5C53", balance: 42500,  pct: 38 },
  { label: "Bank Account", Icon: Landmark,   bg: "#EAF0FB", fg: "#3A6BC4", balance: 318200, pct: 61 },
  { label: "JazzCash",     Icon: Smartphone, bg: "#FEF0E7", fg: "#C7521A", balance: 76300,  pct: 74 },
  { label: "Easypaisa",    Icon: Smartphone, bg: "#E6F7EE", fg: "#1A7A45", balance: 29800,  pct: 22 },
];

function BalanceBookMockup() {
  const totalBalance = ACCOUNTS.reduce((s, a) => s + a.balance, 0);
  return (
    <div className="rounded-3xl overflow-hidden font-body bg-card border border-line shadow-float">
      <div className="flex items-center justify-between px-6 py-4 border-b border-line-soft bg-mist">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-red-400 opacity-50" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400 opacity-50" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 opacity-50" />
          <span className="ml-3 text-[12px] text-ink-mute font-semibold tracking-wide">Innflo — Balance Book</span>
        </div>
        <span className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200/50">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> Auto-logged
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-0">
        {/* Ledger feed */}
        <div className="p-6 border-b lg:border-b-0 lg:border-r border-line-soft">
          <div className="flex items-center gap-2 mb-4">
            <CalendarClock className="h-3.5 w-3.5 text-ink-mute" />
            <p className="text-[10.5px] font-bold uppercase tracking-wider text-ink-mute">Today, live</p>
          </div>
          <div className="space-y-2.5">
            {LEDGER.map((entry, i) => (
              <motion.div
                key={entry.desc}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.12, duration: 0.4, ease: EASE }}
                className={`flex items-center justify-between gap-3 rounded-xl px-3.5 py-2.5 border-l-2 ${
                  entry.dir === "in" ? "border-l-emerald-500 bg-emerald-50/40" : "border-l-coral bg-coral-soft/40"
                }`}
              >
                <div className="min-w-0">
                  <p className="text-[12px] font-bold text-ink truncate">{entry.desc}</p>
                  <p className="text-[10.5px] text-ink-mute">{entry.source} · {entry.method}</p>
                </div>
                <span className={`text-[12.5px] font-black shrink-0 ${entry.dir === "in" ? "text-emerald-700" : "text-coral-dark"}`}>
                  {entry.dir === "in" ? "+" : "−"}{entry.amt.toLocaleString()}
                </span>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Per-method balances */}
        <div className="p-6">
          <p className="text-[10.5px] font-bold uppercase tracking-wider text-ink-mute mb-4">Balance per method</p>
          <div className="space-y-3">
            {ACCOUNTS.map((a, i) => (
              <motion.div
                key={a.label}
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08, duration: 0.4 }}
                className="flex items-center gap-3"
              >
                <div className="h-8 w-8 rounded-lg grid place-items-center shrink-0" style={{ background: a.bg }}>
                  <a.Icon className="h-3.5 w-3.5" style={{ color: a.fg }} strokeWidth={2.25} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-[11.5px] font-bold text-ink">{a.label}</span>
                    <span className="text-[11.5px] font-black text-ink">PKR {a.balance.toLocaleString()}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-mist overflow-hidden mt-1">
                    <motion.div
                      className="h-full rounded-full bg-coral"
                      initial={{ width: 0 }}
                      whileInView={{ width: `${a.pct}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.7, delay: 0.2 + i * 0.08, ease: EASE }}
                    />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-4 mt-4 border-t border-line-soft">
            <span className="text-[11px] font-bold uppercase tracking-wide text-ink-mute">Total, all accounts</span>
            <span className="text-[18px] font-black text-ink">PKR {totalBalance.toLocaleString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

const BALANCE_FEATURES = [
  { icon: CheckCircle2,   text: "Folio payments and expenses post automatically — no manual entry for what Innflo already knows about" },
  { icon: Wallet,         text: "See total balance per payment method — cash drawer, bank, JazzCash, Easypaisa — without opening five different apps" },
  { icon: Filter,         text: "Filter by today, this week, this month, or a custom range, and by incoming vs. outgoing" },
  { icon: CalendarClock,  text: "Check the balance as of any past date — not just what it is right now" },
  { icon: ShieldCheck,    text: "Manual entries still work for the odd cash withdrawal or bank deposit that didn't come from Innflo itself" },
];

export default function Financials() {
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
          <Reveal variant="fade"><p className="eyebrow mb-6">Financials</p></Reveal>
          <h1 className="font-display text-[clamp(38px,6vw,64px)] font-medium leading-[1.05] text-ink">
            <SplitHeading as="span" className="block">The books that</SplitHeading>
            <SplitHeading as="span" delay={0.25} className="block italic text-coral-dark">balance themselves.</SplitHeading>
          </h1>
          <Reveal delay={0.5}>
            <p className="text-[17px] text-ink-soft font-body leading-relaxed max-w-lg mx-auto mt-6">
              Folios, expenses, and a full balance book — every charge, payment, and expense lands in one place, automatically, so nothing gets tallied by hand at the end of the day.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ── Folio ──────────────────────────────────────────────────────────── */}
      <section className="py-20 px-6">
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-1 lg:grid-cols-[45fr_55fr] [&>*]:min-w-0 gap-14 items-center">
            <Reveal>
              <p className="eyebrow mb-4">Guest folios</p>
              <h2 className="font-display text-[clamp(28px,3.4vw,40px)] font-medium leading-tight text-ink mb-5">
                Every charge, one live folio.
              </h2>
              <p className="text-[15.5px] text-ink-soft font-body leading-relaxed mb-6 max-w-lg">
                Room, F&B, spa, laundry, transport, tax, discount — every charge lands on the same guest folio the moment it happens, across 10 payment methods including JazzCash, EasyPaisa, and OTA collect.
              </p>
              <div className="grid grid-cols-1 gap-2.5 font-body text-[13.5px] text-ink-soft">
                {[
                  "14 charge categories, from room rate to damage charges",
                  "10 payment methods — cash, cards, wallets, bank transfer, OTA collect",
                  "Void a charge with a reason, kept in the audit trail",
                  "Group bookings settle as one bill or split by room",
                ].map(f => (
                  <p key={f} className="flex items-start gap-2.5"><span className="text-coral mt-0.5">—</span>{f}</p>
                ))}
              </div>
            </Reveal>
            <Reveal delay={0.1}><FolioMockup /></Reveal>
          </div>
        </div>
      </section>

      {/* ── Expenses ───────────────────────────────────────────────────────── */}
      <section className="py-20 px-6 bg-mist border-y border-line">
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-1 lg:grid-cols-[55fr_45fr] [&>*]:min-w-0 gap-14 items-center">
            <Reveal delay={0.1} className="order-2 lg:order-1"><ExpenseBreakdownMockup /></Reveal>
            <Reveal className="order-1 lg:order-2">
              <p className="eyebrow mb-4">Expenses</p>
              <h2 className="font-display text-[clamp(28px,3.4vw,40px)] font-medium leading-tight text-ink mb-5">
                Where the money actually goes.
              </h2>
              <p className="text-[15.5px] text-ink-soft font-body leading-relaxed mb-6 max-w-lg">
                Salary, supplies, utilities, maintenance, marketing, rent, insurance, equipment — 10 categories, filterable by date range, broken down so you can see what's actually driving cost.
              </p>
              <div className="grid grid-cols-1 gap-2.5 font-body text-[13.5px] text-ink-soft">
                {[
                  "Category breakdown, ranked by spend",
                  "Filter by date range and category together",
                  "Every expense tied to a payment method automatically",
                  "Edit or remove an entry without losing the history",
                ].map(f => (
                  <p key={f} className="flex items-start gap-2.5"><span className="text-coral mt-0.5">—</span>{f}</p>
                ))}
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── Balance Book — the star feature ──────────────────────────────────── */}
      <section className="py-24 px-6">
        <div className="mx-auto max-w-7xl">
          <Reveal variant="fade" className="text-center mb-14">
            <p className="eyebrow mb-4">Balance Book</p>
            <h2 className="font-display text-[clamp(30px,4.2vw,48px)] font-medium leading-tight text-ink max-w-3xl mx-auto">
              Whatever goes out or comes in, gets logged automatically —<br className="hidden sm:block" />
              <span className="text-coral-dark italic">so you don't have to worry about it.</span>
            </h2>
            <p className="text-[16.5px] text-ink-soft font-body leading-relaxed max-w-2xl mx-auto mt-6">
              See the total balance per payment method, filtered however you need — today, this month, a custom range. Time to retire the physical books and the manual tallying that comes with them.
            </p>
          </Reveal>

          <Reveal variant="scale" className="mb-14">
            <BalanceBookMockup />
          </Reveal>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
            {BALANCE_FEATURES.map((f, i) => (
              <Reveal key={f.text} delay={i * 0.05} variant="rise">
                <div className="h-full rounded-2xl bg-card border border-line p-6 shadow-card hover:shadow-float transition-all duration-300">
                  <div className="h-10 w-10 rounded-xl bg-coral-soft grid place-items-center mb-4">
                    <f.icon className="h-4.5 w-4.5 text-coral-dark" strokeWidth={2.25} />
                  </div>
                  <p className="text-[13.5px] text-ink-soft font-body leading-relaxed">{f.text}</p>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={0.2} className="mt-14 text-center">
            <p className="text-[14.5px] text-ink-soft font-body">
              Room service and restaurant sales feed the same folio too.{" "}
              <Link to="/pos" className="font-bold text-coral-dark hover:underline">
                See how Point of Sale works →
              </Link>
            </p>
          </Reveal>
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
              No card required, no obligation to continue — see if Innflo fits your property first.
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

      {/* ── FAQ — got a question ─────────────────────────────────────────────── */}
      <section className="py-24 px-6">
        <div className="mx-auto max-w-4xl">
          <Reveal variant="fade" className="text-center mb-14">
            <h2 className="font-display text-[clamp(30px,4vw,44px)] font-medium leading-tight text-ink">
              Got a question?
            </h2>
          </Reveal>

          <Reveal variant="rise">
            <div className="rounded-3xl bg-card shadow-float overflow-hidden">
              {FIN_FAQS.map((item, i) => (
                <FinFaqRow
                  key={item.q}
                  q={item.q}
                  a={item.a}
                  isLast={i === FIN_FAQS.length - 1}
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
