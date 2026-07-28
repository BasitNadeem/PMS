import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  QrCode, Smartphone, ChefHat, Package, Clock, CheckCircle2,
  AlertTriangle, Wallet, Receipt, BarChart3, Plus, MonitorSmartphone,
  Coffee, Soup, Sandwich, Timer, UtensilsCrossed,
} from "lucide-react";
import Reveal from "../components/motion/Reveal";
import SplitHeading from "../components/motion/SplitHeading";
import MagneticButton from "../components/motion/MagneticButton";

const EASE = [0.16, 1, 0.3, 1] as const;

const POS_FAQS = [
  {
    q: "Does the guest need to download an app to order?",
    a: "No — scanning the QR code opens a web menu in whatever browser is already on their phone. No app, no account, no login.",
  },
  {
    q: "How does an order end up on the guest's room bill?",
    a: "Once the room number is verified, front desk can post the order straight to that guest's folio with one tap — or the guest can choose to pay on the spot instead, at the counter.",
  },
  {
    q: "What happens if the kitchen edits an order after it's already posted to the room?",
    a: "It gets flagged for folio review automatically — an amber warning tells front desk the charge may no longer match what's on the bill, so it can be reconciled by hand instead of silently drifting.",
  },
  {
    q: "Can a menu item run out of stock?",
    a: "Link an item to an inventory item and set how much one serving uses — each order sold quietly deducts that amount, so stock stays accurate without a separate count.",
  },
  {
    q: "Can the breakfast menu disappear after breakfast hours?",
    a: "Yes — set a time window on any category and it only shows on the guest menu inside that window. Leave it blank and the category is always available.",
  },
  {
    q: "Is there a dedicated kitchen screen?",
    a: "Three, actually — an interactive board for managing tickets, a kanban view for the pass, and a read-only wall display that refreshes itself every few seconds. Pick whichever fits the station.",
  },
  {
    q: "Does POS revenue show up in reports?",
    a: "Yes — total orders, revenue, how much was posted to rooms versus paid directly, all sit right alongside room revenue on the same daily and monthly reports.",
  },
];

function PosFaqRow({ q, a, isOpen, isLast, onClick }: { q: string; a: string; isOpen: boolean; isLast: boolean; onClick: () => void }) {
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
            transition={{ duration: 0.3, ease: EASE }}
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

// ─── Scene 0 — The POS terminal itself, a walk-in order being rung up ─────
const TERMINAL_CATEGORIES = ["Mains", "Beverages", "Sides", "Grill"];
const TERMINAL_ITEMS = [
  { name: "Chicken Karahi",     price: 1450, Icon: Soup },
  { name: "Beef Seekh Kebab",   price: 980,  Icon: UtensilsCrossed },
  { name: "Club Sandwich",      price: 850,  Icon: Sandwich },
  { name: "Loaded Fries",       price: 620,  Icon: Sandwich },
  { name: "Kashmiri Chai",      price: 320,  Icon: Coffee },
];

function PosTerminalMockup() {
  const settleStep = TERMINAL_ITEMS.length;
  const [step, setStep] = useState(0); // 0..N-1: ringing up items, N: settling

  useEffect(() => {
    const t = setTimeout(() => setStep(s => (s === settleStep ? 0 : s + 1)), step === settleStep ? 2800 : 950);
    return () => clearTimeout(t);
  }, [step, settleStep]);

  const cart = TERMINAL_ITEMS.slice(0, Math.min(step + 1, TERMINAL_ITEMS.length));
  const total = cart.reduce((s, i) => s + i.price, 0);
  const activeIdx = Math.min(step, TERMINAL_ITEMS.length - 1);
  const settling = step === settleStep;

  return (
    <div className="rounded-2xl overflow-hidden font-body bg-card border border-line shadow-float">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-line-soft bg-mist">
        <div className="flex items-center gap-2">
          <MonitorSmartphone className="h-4 w-4 text-ink-mute" strokeWidth={2} />
          <span className="text-[11.5px] text-ink-mute font-semibold tracking-wide">InnFlo — POS Terminal</span>
        </div>
        <span className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/50">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live
        </span>
      </div>

      <div className="grid grid-cols-[1.3fr_1fr]">
        <div className="p-5 border-r border-line-soft">
          <div className="flex gap-1.5 mb-4">
            {TERMINAL_CATEGORIES.map((c, i) => (
              <span
                key={c}
                className={`text-[9.5px] font-bold px-2.5 py-1 rounded-full ${
                  i === 0 ? "bg-coral text-white" : "bg-mist text-ink-mute"
                }`}
              >
                {c}
              </span>
            ))}
          </div>
          <div className="space-y-2.5">
            {TERMINAL_ITEMS.map((it, i) => (
              <motion.div
                key={it.name}
                animate={{
                  borderColor: i === activeIdx && !settling ? "#E0532B" : "#EFE4D6",
                  backgroundColor: i === activeIdx && !settling ? "rgba(224,83,43,0.06)" : "#FFFFFF",
                }}
                transition={{ duration: 0.4 }}
                className="flex items-center gap-2.5 rounded-xl border p-3"
              >
                <div className="h-9 w-9 rounded-lg bg-coral-soft grid place-items-center shrink-0">
                  <it.Icon className="h-4 w-4 text-coral-dark" strokeWidth={2} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-bold text-ink truncate">{it.name}</p>
                  <p className="text-[10.5px] text-ink-mute">PKR {it.price}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="p-5 flex flex-col">
          <p className="text-[10px] font-bold uppercase tracking-wider text-ink-mute mb-3">Current order</p>
          <div className="flex-1 space-y-2">
            <AnimatePresence>
              {cart.map(it => (
                <motion.div
                  key={it.name}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3 }}
                  className="flex items-center justify-between"
                >
                  <span className="text-[11.5px] text-ink-soft truncate">{it.name}</span>
                  <span className="text-[11.5px] font-bold text-ink shrink-0">{it.price}</span>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          <div className="flex items-center justify-between pt-3 mt-2 border-t border-line-soft">
            <span className="text-[12px] font-bold text-ink">Total</span>
            <span className="text-[14px] font-black text-ink">PKR {total.toLocaleString()}</span>
          </div>

          <AnimatePresence mode="wait">
            {!settling ? (
              <motion.div key="ringing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-4">
                <div className="h-9 rounded-lg bg-mist grid place-items-center">
                  <span className="text-[10.5px] font-semibold text-ink-mute">Ringing up order…</span>
                </div>
              </motion.div>
            ) : (
              <motion.div key="settle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-4 space-y-2">
                <div className="h-9 rounded-lg border border-line text-[11px] font-bold text-ink-soft flex items-center justify-center gap-1.5">
                  <Wallet className="h-3.5 w-3.5" /> Direct payment
                </div>
                <div className="h-9 rounded-lg bg-coral text-white text-[11px] font-bold shadow-pop flex items-center justify-center gap-1.5">
                  <Receipt className="h-3.5 w-3.5" /> Charge to room
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

// ─── Scene 1 — Scan-to-order phone, cycling through 3 real screens ─────────
const MENU_ITEMS = [
  { name: "Chicken Karahi",     price: 1450, Icon: Soup,      badge: "Chef's pick" },
  { name: "Club Sandwich",      price: 850,  Icon: Sandwich,  badge: null },
  { name: "Kashmiri Chai",      price: 320,  Icon: Coffee,    badge: null },
];

const TRACK_STEPS = ["Order Received", "Confirmed", "Preparing", "Ready for Delivery"];

function ScanOrderMockup() {
  const [scene, setScene] = useState<0 | 1 | 2>(0);
  const [trackStep, setTrackStep] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setScene(s => (s === 2 ? 0 : ((s + 1) as 0 | 1 | 2))), scene === 2 ? 3400 : 2600);
    return () => clearTimeout(t);
  }, [scene]);

  useEffect(() => {
    if (scene !== 2) { setTrackStep(0); return; }
    const iv = setInterval(() => setTrackStep(s => (s < TRACK_STEPS.length - 1 ? s + 1 : s)), 750);
    return () => clearInterval(iv);
  }, [scene]);

  return (
    <div className="mx-auto w-[280px] rounded-[2.4rem] border-[6px] border-ink bg-ink shadow-float overflow-hidden">
      <div className="relative h-[540px] bg-[#FBF3EA] overflow-hidden">
        <div className="absolute top-0 inset-x-0 h-6 bg-ink z-10 rounded-b-2xl w-24 mx-auto" />

        <AnimatePresence mode="wait">
          {scene === 0 && (
            <motion.div
              key="scan"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="h-full flex flex-col items-center justify-center px-6 text-center"
            >
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#C7521A] mb-4">Room 214</p>
              <div className="relative h-28 w-28 rounded-2xl bg-white border-2 border-[#E0532B]/30 grid place-items-center shadow-sm mb-5">
                <QrCode className="h-14 w-14 text-ink" strokeWidth={1.4} />
                <motion.div
                  className="absolute left-2 right-2 h-[2px] bg-[#E0532B]"
                  initial={{ top: "8%" }}
                  animate={{ top: ["8%", "88%", "8%"] }}
                  transition={{ duration: 1.8, repeat: Infinity, ease: "linear" }}
                />
              </div>
              <p className="text-[14px] font-bold text-ink font-body">Scan to order room service</p>
              <p className="text-[11.5px] text-[#8A8378] font-body mt-1.5">No app needed — opens in your browser</p>
            </motion.div>
          )}

          {scene === 1 && (
            <motion.div
              key="menu"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="h-full flex flex-col"
            >
              <div className="px-5 pt-9 pb-3 border-b border-[#EFE4D6]">
                <p className="text-[9.5px] font-bold uppercase tracking-[0.16em] text-[#C7521A]">Ridgeview Hotel</p>
                <p className="font-display italic text-[17px] text-ink">Room Service</p>
              </div>
              <div className="flex-1 px-4 py-3 space-y-2.5 overflow-hidden">
                {MENU_ITEMS.map((it, i) => (
                  <motion.div
                    key={it.name}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 + i * 0.12, duration: 0.4 }}
                    className="flex items-center gap-3 rounded-xl bg-white border border-[#EFE4D6] p-2.5"
                  >
                    <div className="h-10 w-10 rounded-lg bg-[#FEF0E7] grid place-items-center shrink-0">
                      <it.Icon className="h-4.5 w-4.5 text-[#C7521A]" strokeWidth={2} />
                    </div>
                    <div className="min-w-0 flex-1">
                      {it.badge && <span className="text-[8px] font-bold text-[#C7521A]">{it.badge}</span>}
                      <p className="text-[12px] font-bold text-ink truncate">{it.name}</p>
                      <p className="text-[11px] text-[#8A8378]">PKR {it.price}</p>
                    </div>
                    <span className="h-6 w-6 rounded-full bg-[#E0532B] grid place-items-center shrink-0">
                      <Plus className="h-3 w-3 text-white" strokeWidth={3} />
                    </span>
                  </motion.div>
                ))}
              </div>
              <div className="px-4 pb-5">
                <div className="h-11 rounded-full bg-ink text-white text-[12.5px] font-bold flex items-center justify-center gap-2">
                  <span>2 items</span><span className="opacity-50">·</span><span>PKR 2,300</span>
                </div>
              </div>
            </motion.div>
          )}

          {scene === 2 && (
            <motion.div
              key="track"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="h-full flex flex-col px-6 pt-14"
            >
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#8A8378] text-center">Order #4021</p>
              <p className="font-display italic text-[19px] text-ink text-center mb-8">On its way</p>
              <div className="space-y-0">
                {TRACK_STEPS.map((label, i) => {
                  const done = i <= trackStep;
                  return (
                    <div key={label} className="flex items-start gap-3">
                      <div className="flex flex-col items-center">
                        <motion.div
                          animate={{ backgroundColor: done ? "#1F7A45" : "#EFE4D6", scale: done ? 1 : 0.9 }}
                          transition={{ duration: 0.3 }}
                          className="h-5 w-5 rounded-full grid place-items-center"
                        >
                          {done && <CheckCircle2 className="h-3.5 w-3.5 text-white" strokeWidth={3} />}
                        </motion.div>
                        {i < TRACK_STEPS.length - 1 && (
                          <div className={`w-[2px] h-8 ${i < trackStep ? "bg-[#1F7A45]" : "bg-[#EFE4D6]"}`} />
                        )}
                      </div>
                      <p className={`text-[12.5px] font-semibold pt-0.5 ${done ? "text-ink" : "text-[#B0A99C]"}`}>{label}</p>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── Scene 2 — Kitchen board, a ticket advancing across columns ────────────
const BOARD_COLUMNS = [
  { key: "pending",   label: "Pending",   color: "#B45309", bg: "#FEF3E2" },
  { key: "confirmed", label: "Confirmed", color: "#3A6BC4", bg: "#EAF0FB" },
  { key: "preparing", label: "Preparing", color: "#0A5C53", bg: "#E6F4EF" },
  { key: "ready",     label: "Ready",     color: "#15803D", bg: "#E9F8EE" },
];

const STATIC_TICKETS = [
  { id: "ORD-4018", room: "108", col: 3, items: "Club Sandwich × 1" },
  { id: "ORD-4019", room: "212", col: 2, items: "Chicken Karahi × 2" },
  { id: "ORD-4020", room: "301", col: 1, items: "Kashmiri Chai × 3" },
];

function KitchenBoardMockup() {
  const [movingCol, setMovingCol] = useState(0);

  useEffect(() => {
    const iv = setInterval(() => setMovingCol(c => (c + 1) % BOARD_COLUMNS.length), 1600);
    return () => clearInterval(iv);
  }, []);

  return (
    <div className="rounded-2xl overflow-hidden font-body bg-card border border-line shadow-float">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-line-soft bg-mist">
        <div className="flex items-center gap-2">
          <ChefHat className="h-4 w-4 text-ink-mute" strokeWidth={2} />
          <span className="text-[11.5px] text-ink-mute font-semibold tracking-wide">InnFlo — Live Orders</span>
        </div>
        <span className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/50">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> Refreshes every 8s
        </span>
      </div>

      <div className="grid grid-cols-4 gap-2.5 p-4">
        {BOARD_COLUMNS.map((col, ci) => (
          <div key={col.key} className="rounded-xl bg-mist/60 p-2 min-h-[168px]">
            <div className="flex items-center gap-1.5 mb-2 px-1">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: col.color }} />
              <span className="text-[9px] font-bold uppercase tracking-wide" style={{ color: col.color }}>{col.label}</span>
            </div>

            <div className="space-y-1.5">
              {STATIC_TICKETS.filter(t => t.col === ci).map(t => (
                <div key={t.id} className="rounded-lg bg-card border border-line p-2 shadow-sm">
                  <p className="text-[9.5px] font-bold text-ink">{t.id} · Rm {t.room}</p>
                  <p className="text-[8.5px] text-ink-mute truncate">{t.items}</p>
                </div>
              ))}

              {ci === movingCol && (
                <motion.div
                  layout
                  layoutId="live-ticket"
                  transition={{ duration: 0.6, ease: EASE }}
                  className="rounded-lg p-2 shadow-sm border"
                  style={{ background: col.bg, borderColor: col.color + "55" }}
                >
                  <div className="flex items-center gap-1 mb-0.5">
                    <Timer className="h-2.5 w-2.5" style={{ color: col.color }} />
                    <p className="text-[9.5px] font-bold" style={{ color: col.color }}>ORD-4021 · Rm 214</p>
                  </div>
                  <p className="text-[8.5px]" style={{ color: col.color }}>Chicken Karahi × 1, Chai × 2</p>
                </motion.div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Scene 3 — Menu setup, category time-window + inventory deduction ─────
function MenuInventoryMockup() {
  const [stock, setStock] = useState(64);

  useEffect(() => {
    const iv = setInterval(() => setStock(s => (s <= 20 ? 64 : s - 4)), 900);
    return () => clearInterval(iv);
  }, []);

  return (
    <div className="rounded-2xl overflow-hidden font-body bg-card border border-line shadow-float">
      <div className="flex items-center gap-1.5 px-4 py-3 border-b border-line-soft bg-mist">
        <span className="h-2.5 w-2.5 rounded-full bg-red-400 opacity-50" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-400 opacity-50" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 opacity-50" />
        <span className="ml-3 text-[11px] text-ink-mute font-semibold tracking-wide">InnFlo — Menu Setup</span>
      </div>

      <div className="p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[12.5px] font-bold text-ink">Breakfast</p>
          <span className="flex items-center gap-1 text-[9.5px] font-bold text-ink-mute bg-mist px-2 py-0.5 rounded-full border border-line">
            <Clock className="h-2.5 w-2.5" /> 07:00 – 11:00
          </span>
        </div>

        <div className="rounded-xl border border-line p-3 mb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-coral-soft grid place-items-center shrink-0">
                <Soup className="h-4 w-4 text-coral-dark" strokeWidth={2} />
              </div>
              <div>
                <p className="text-[12px] font-bold text-ink">Chicken Karahi</p>
                <p className="text-[10px] text-ink-mute">Linked to inventory · Chicken (kg)</p>
              </div>
            </div>
            <div className="flex gap-1.5 shrink-0">
              <span className="text-[8px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">POS</span>
              <span className="text-[8px] font-bold text-coral-dark bg-coral-soft px-1.5 py-0.5 rounded">QR Menu</span>
            </div>
          </div>

          <div className="flex items-center justify-between mb-1">
            <span className="text-[9.5px] font-semibold text-ink-mute">Stock remaining</span>
            <span className="text-[9.5px] font-bold text-ink">{stock.toFixed(1)} kg</span>
          </div>
          <div className="h-2 rounded-full bg-mist overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ background: stock < 30 ? "#DC5A3C" : "#0A5C53" }}
              animate={{ width: `${stock}%` }}
              transition={{ duration: 0.5, ease: "linear" }}
            />
          </div>
          <p className="text-[9px] text-ink-mute mt-1.5">0.2 kg deducted per serving, automatically</p>
        </div>

        <div className="flex items-center justify-between text-[10.5px]">
          <span className="text-ink-soft font-semibold">Club Sandwich</span>
          <span className="text-ink-mute">Not linked · unlimited</span>
        </div>
      </div>
    </div>
  );
}

// ─── Scene 4 — Settlement: folio vs direct, with the review flag ──────────
function SettlementMockup() {
  const [flagged, setFlagged] = useState(false);
  useEffect(() => {
    const iv = setInterval(() => setFlagged(f => !f), 3200);
    return () => clearInterval(iv);
  }, []);

  return (
    <div className="rounded-2xl overflow-hidden font-body bg-card border border-line shadow-float p-5">
      <div className="flex items-center justify-between pb-3 mb-4 border-b border-line-soft">
        <p className="text-[12.5px] font-bold text-ink">ORD-4018 · Room 108</p>
        <span className="text-[9.5px] font-bold text-ink-mute">PKR 850</span>
      </div>

      <AnimatePresence mode="wait">
        {!flagged ? (
          <motion.div key="clean" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }}>
            <div className="flex items-center gap-2.5 rounded-xl bg-emerald-50/60 border border-emerald-200 p-3 mb-3">
              <CheckCircle2 className="h-4 w-4 text-emerald-700 shrink-0" />
              <p className="text-[11.5px] font-semibold text-emerald-800">Room verified — posted to folio</p>
            </div>
            <div className="flex gap-2">
              <div className="flex-1 h-9 rounded-lg border border-line text-[11px] font-bold text-ink-soft flex items-center justify-center gap-1.5">
                <Wallet className="h-3.5 w-3.5" /> Pay now
              </div>
              <div className="flex-1 h-9 rounded-lg bg-coral text-white text-[11px] font-bold shadow-pop flex items-center justify-center gap-1.5">
                <Receipt className="h-3.5 w-3.5" /> Charge to room
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div key="flag" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }}>
            <div className="flex items-start gap-2.5 rounded-xl bg-amber-50 border border-amber-200 p-3">
              <AlertTriangle className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
              <p className="text-[11px] font-semibold text-amber-800 leading-snug">
                Order edited after posting — flagged for folio review at front desk
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const STATION_FEATURES = [
  { icon: Smartphone,   role: "Guest",       text: "Scan the QR code in the room, browse the menu, and order — no app, no account, tracked live from pending to delivered." },
  { icon: ChefHat,      role: "Kitchen",     text: "Orders land on the kitchen board the instant they're placed. One tap advances status; editing mid-flight flags it for review." },
  { icon: Package,      role: "Menu owner",  text: "Build categories with time windows, mark items 'Chef's pick', and toggle POS-only vs. QR-visible per item." },
  { icon: Wallet,       role: "Front desk",  text: "Post a verified order straight to the guest's room folio, or settle it directly at the counter — either way, one tap." },
  { icon: BarChart3,    role: "Owner",       text: "Total orders, revenue, and the split between posted-to-room and paid-direct sit right on the daily report, next to room revenue." },
];

export default function PointOfSale() {
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
          <Reveal variant="fade"><p className="eyebrow mb-6">Point of Sale</p></Reveal>
          <h1 className="font-display text-[clamp(38px,6vw,64px)] font-medium leading-[1.05] text-ink">
            <SplitHeading as="span" className="block">Order in, plated,</SplitHeading>
            <SplitHeading as="span" delay={0.25} className="block italic text-coral-dark">and already on the bill.</SplitHeading>
          </h1>
          <Reveal delay={0.5}>
            <p className="text-[17px] text-ink-soft font-body leading-relaxed max-w-lg mx-auto mt-6">
              A guest scans a QR code from their room, orders off the real menu, and the kitchen sees it instantly — no terminal, no app, and the charge lands on the right folio without anyone re-typing it.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ── POS Terminal ───────────────────────────────────────────────────── */}
      <section className="py-20 px-6">
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-1 lg:grid-cols-[45%_55%] gap-14 items-center">
            <Reveal>
              <p className="eyebrow mb-4">The terminal</p>
              <h2 className="font-display text-[clamp(28px,3.4vw,40px)] font-medium leading-tight text-ink mb-5">
                A real register, not a side app.
              </h2>
              <p className="text-[15.5px] text-ink-soft font-body leading-relaxed mb-6 max-w-lg">
                Walk-in restaurant sales ring up on the same terminal that runs the rest of the property — tap items by category, watch the total build, then settle it to a verified room or take payment directly at the counter.
              </p>
              <div className="grid grid-cols-1 gap-2.5 font-body text-[13.5px] text-ink-soft">
                {[
                  "Tap-to-add items grouped by category",
                  "Same order model whether it's a walk-in or room service",
                  "Settle to a checked-in guest's folio or take payment directly",
                  "Every order status tracked — open, posted to folio, or paid",
                ].map(f => (
                  <p key={f} className="flex items-start gap-2.5"><span className="text-coral mt-0.5">—</span>{f}</p>
                ))}
              </div>
            </Reveal>
            <Reveal delay={0.1}><PosTerminalMockup /></Reveal>
          </div>
        </div>
      </section>

      {/* ── Scan-to-order ─────────────────────────────────────────────────── */}
      <section className="py-20 px-6 bg-mist border-y border-line">
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-1 lg:grid-cols-[55%_45%] gap-14 items-center">
            <Reveal>
              <p className="eyebrow mb-4">Scan-to-order</p>
              <h2 className="font-display text-[clamp(28px,3.4vw,40px)] font-medium leading-tight text-ink mb-5">
                The menu is a QR code away.
              </h2>
              <p className="text-[15.5px] text-ink-soft font-body leading-relaxed mb-6 max-w-lg">
                No app to download, no account to create — scanning the code in the room opens the real menu in whatever browser the guest already has open, with the room pre-verified before anything is ordered.
              </p>
              <div className="grid grid-cols-1 gap-2.5 font-body text-[13.5px] text-ink-soft">
                {[
                  "Room number verified before an order is placed",
                  "Room delivery, pickup, or dine-in — guest picks",
                  "Pay now at the counter, or charge straight to the room",
                  "A live 5-step tracker, from received to delivered",
                ].map(f => (
                  <p key={f} className="flex items-start gap-2.5"><span className="text-coral mt-0.5">—</span>{f}</p>
                ))}
              </div>
            </Reveal>
            <Reveal delay={0.1}><ScanOrderMockup /></Reveal>
          </div>
        </div>
      </section>

      {/* ── Kitchen ────────────────────────────────────────────────────────── */}
      <section className="py-20 px-6">
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-1 lg:grid-cols-[45%_55%] gap-14 items-center">
            <Reveal className="order-2 lg:order-1">
              <p className="eyebrow mb-4">Kitchen</p>
              <h2 className="font-display text-[clamp(28px,3.4vw,40px)] font-medium leading-tight text-ink mb-5">
                The kitchen never checks a screen twice.
              </h2>
              <p className="text-[15.5px] text-ink-soft font-body leading-relaxed mb-6 max-w-lg">
                Every order — room service or walk-in — lands on the kitchen board the second it's placed. One tap moves a ticket from pending to confirmed to preparing to ready, and the board refreshes itself every 8 seconds.
              </p>
              <div className="grid grid-cols-1 gap-2.5 font-body text-[13.5px] text-ink-soft">
                {[
                  "Three views — an interactive board, a kanban pass, and a read-only wall display",
                  "Elapsed time shown per ticket, so nothing sits forgotten",
                  "Edit an item or quantity mid-flight, right from the ticket",
                  "Editing an in-progress order flags it for folio review",
                ].map(f => (
                  <p key={f} className="flex items-start gap-2.5"><span className="text-coral mt-0.5">—</span>{f}</p>
                ))}
              </div>
            </Reveal>
            <Reveal delay={0.1} className="order-1 lg:order-2"><KitchenBoardMockup /></Reveal>
          </div>
        </div>
      </section>

      {/* ── Menu setup + inventory ────────────────────────────────────────── */}
      <section className="py-20 px-6 bg-mist border-y border-line">
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-1 lg:grid-cols-[55%_45%] gap-14 items-center">
            <Reveal delay={0.1} className="order-2 lg:order-1"><MenuInventoryMockup /></Reveal>
            <Reveal className="order-1 lg:order-2">
              <p className="eyebrow mb-4">Menu setup</p>
              <h2 className="font-display text-[clamp(28px,3.4vw,40px)] font-medium leading-tight text-ink mb-5">
                A menu that knows your stock.
              </h2>
              <p className="text-[15.5px] text-ink-soft font-body leading-relaxed mb-6 max-w-lg">
                Build categories with a time window — Breakfast only shows from 7 to 11 — and link any item to an inventory item with a quantity per serving. Sell it, and the stock quietly deducts itself.
              </p>
              <div className="grid grid-cols-1 gap-2.5 font-body text-[13.5px] text-ink-soft">
                {[
                  "Time-windowed categories — breakfast, lunch, dinner",
                  "Toggle each item on or off for POS, QR menu, or both",
                  "Mark an item 'Chef's pick' — it's badged on the guest menu",
                  "Link to inventory once; stock updates on every order",
                ].map(f => (
                  <p key={f} className="flex items-start gap-2.5"><span className="text-coral mt-0.5">—</span>{f}</p>
                ))}
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── Settlement ─────────────────────────────────────────────────────── */}
      <section className="py-20 px-6">
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-1 lg:grid-cols-[55%_45%] gap-14 items-center">
            <Reveal>
              <p className="eyebrow mb-4">Settlement</p>
              <h2 className="font-display text-[clamp(28px,3.4vw,40px)] font-medium leading-tight text-ink mb-5">
                Folio or counter — it settles either way.
              </h2>
              <p className="text-[15.5px] text-ink-soft font-body leading-relaxed mb-6 max-w-lg">
                A verified room order posts straight to that guest's folio with one tap. Anything else settles directly — cash, card, JazzCash, or Easypaisa — right at checkout, no separate system to reconcile.
              </p>
              <div className="grid grid-cols-1 gap-2.5 font-body text-[13.5px] text-ink-soft">
                {[
                  "One-tap post to the verified guest's folio",
                  "Direct payment across five methods when there's no room to charge",
                  "Edited-after-posting orders are flagged, never silently wrong",
                  "Total orders, revenue, and posted-vs-direct split on the daily report",
                ].map(f => (
                  <p key={f} className="flex items-start gap-2.5"><span className="text-coral mt-0.5">—</span>{f}</p>
                ))}
              </div>
            </Reveal>
            <Reveal delay={0.1}><SettlementMockup /></Reveal>
          </div>
        </div>
      </section>

      {/* ── Built for every station ──────────────────────────────────────────── */}
      <section className="py-24 px-6">
        <div className="mx-auto max-w-7xl">
          <Reveal variant="fade" className="text-center mb-14">
            <p className="eyebrow mb-4">One system, every station</p>
            <h2 className="font-display text-[clamp(30px,4.2vw,48px)] font-medium leading-tight text-ink max-w-2xl mx-auto">
              Built for whoever's holding the ticket.
            </h2>
          </Reveal>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
            {STATION_FEATURES.map((f, i) => (
              <Reveal key={f.role} delay={i * 0.05} variant="rise">
                <div className="h-full rounded-2xl bg-card border border-line p-6 shadow-card hover:shadow-float transition-all duration-300">
                  <div className="h-10 w-10 rounded-xl bg-coral-soft grid place-items-center mb-4">
                    <f.icon className="h-4.5 w-4.5 text-coral-dark" strokeWidth={2.25} />
                  </div>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-coral-dark mb-1.5">{f.role}</p>
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
              Start with a guided InnFlo trial.
            </h2>
            <p className="text-[16px] font-body leading-relaxed max-w-lg mx-auto mb-9" style={{ color: "rgba(245,235,228,0.68)" }}>
              No card required, no obligation to continue — see if InnFlo fits your property first.
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
      <section className="py-24 px-6">
        <div className="mx-auto max-w-4xl">
          <Reveal variant="fade" className="text-center mb-14">
            <h2 className="font-display text-[clamp(30px,4vw,44px)] font-medium leading-tight text-ink">
              Got a question?
            </h2>
          </Reveal>

          <Reveal variant="rise">
            <div className="rounded-3xl bg-card shadow-float overflow-hidden">
              {POS_FAQS.map((item, i) => (
                <PosFaqRow
                  key={item.q}
                  q={item.q}
                  a={item.a}
                  isLast={i === POS_FAQS.length - 1}
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
