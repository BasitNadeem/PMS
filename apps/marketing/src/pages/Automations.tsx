import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion, useMotionValue, useTransform, AnimatePresence } from "framer-motion";
import {
  Sparkles, RefreshCw, Camera, AlertTriangle,
  Users, CheckCircle2, ArrowRight, Plus, BedDouble, Wrench, TrendingUp,
} from "lucide-react";
import Reveal from "../components/motion/Reveal";
import SplitHeading from "../components/motion/SplitHeading";
import MagneticButton from "../components/motion/MagneticButton";

const EASE = [0.16, 1, 0.3, 1] as const;

// ─── Flagship — Nightly WhatsApp Briefing, a real 3D tilting phone ─────────
function NightlyBriefingMockup() {
  const ref = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0.5);
  const my = useMotionValue(0.5);
  const rotateY = useTransform(mx, [0, 1], [-14, 14]);
  const rotateX = useTransform(my, [0, 1], [10, -10]);

  function onMove(e: React.MouseEvent) {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    mx.set((e.clientX - rect.left) / rect.width);
    my.set((e.clientY - rect.top) / rect.height);
  }
  function onLeave() {
    mx.set(0.5);
    my.set(0.5);
  }

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className="mx-auto w-[280px]"
      style={{ perspective: "1400px" }}
    >
      <motion.div
        style={{ rotateY, rotateX, transformStyle: "preserve-3d" }}
        transition={{ type: "spring", stiffness: 90, damping: 14 }}
        className="relative rounded-[2.4rem] border-[6px] border-ink bg-ink shadow-float"
      >
        <div className="relative h-[520px] rounded-[2rem] overflow-hidden bg-[#0B141A]">
          <div className="absolute top-0 inset-x-0 h-6 bg-ink z-20 rounded-b-2xl w-24 mx-auto" />

          {/* WhatsApp header layer — floats slightly forward in Z */}
          <div
            style={{ transform: "translateZ(38px)" }}
            className="relative z-10 flex items-center gap-2.5 px-4 pt-9 pb-3 bg-[#1F2C34]"
          >
            <div className="h-8 w-8 rounded-full bg-[#2A3942] grid place-items-center">
              <BedDouble className="h-4 w-4 text-[#25D366]" strokeWidth={2} />
            </div>
            <div>
              <p className="text-[12.5px] font-bold text-white">InnFlo Nightly Briefing</p>
              <p className="text-[10px] text-[#8696A0]">11:00 PM · every night</p>
            </div>
          </div>

          {/* Message bubble layer — sits slightly back in Z for parallax depth */}
          <div style={{ transform: "translateZ(14px)" }} className="relative px-3 py-4">
            <div className="rounded-xl rounded-tl-sm bg-[#005C4B] p-3.5 shadow-lg max-w-[92%]">
              <p className="text-[11px] font-bold text-white mb-2">Good evening — here's tonight's summary 🌙</p>
              {[
                { icon: BedDouble, label: "Occupancy tonight", value: "84%" },
                { icon: TrendingUp, label: "Revenue today", value: "PKR 186,400" },
                { icon: Users, label: "Arrivals tomorrow", value: "7 guests" },
                { icon: Wrench, label: "Open maintenance tickets", value: "2" },
              ].map((row, i) => (
                <motion.div
                  key={row.label}
                  initial={{ opacity: 0, x: -6 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.3 + i * 0.12, duration: 0.4, ease: EASE }}
                  className="flex items-center justify-between gap-3 py-1.5 border-t border-white/10 first:border-t-0"
                >
                  <span className="flex items-center gap-1.5 text-[10.5px] text-white/80">
                    <row.icon className="h-3 w-3 text-[#25D366]" strokeWidth={2.25} /> {row.label}
                  </span>
                  <span className="text-[10.5px] font-bold text-white">{row.value}</span>
                </motion.div>
              ))}
              <p className="text-[9px] text-white/50 text-right mt-2">11:00 PM ✓✓</p>
            </div>
          </div>
        </div>
      </motion.div>
      <p className="text-center text-[11px] text-ink-mute font-body mt-4">Move your cursor over the phone</p>
    </div>
  );
}

// ─── Housekeeping — task appears the moment a room checks out ─────────────
function HousekeepingAutoMockup() {
  const [triggered, setTriggered] = useState(false);
  return (
    <motion.div
      onViewportEnter={() => setTriggered(true)}
      viewport={{ once: true }}
      className="rounded-2xl overflow-hidden font-body bg-card border border-line shadow-float p-5"
    >
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-line-soft">
        <p className="text-[12.5px] font-bold text-ink">Room 214 — checked out</p>
        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
      </div>
      <AnimatePresence>
        {triggered && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.4, ease: EASE }}
            className="flex items-center gap-3 rounded-xl bg-coral-soft/60 border border-coral/20 p-3"
          >
            <div className="h-9 w-9 rounded-lg bg-coral-soft grid place-items-center shrink-0">
              <Sparkles className="h-4 w-4 text-coral-dark" strokeWidth={2.25} />
            </div>
            <div>
              <p className="text-[11.5px] font-bold text-ink">Cleaning task created — auto</p>
              <p className="text-[10.5px] text-ink-mute">Assigned to next available housekeeper</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Folio — charges land automatically, tied to POS ───────────────────────
const FOLIO_AUTO_ITEMS = [
  { label: "Room Service — Dinner", src: "POS order #4021", amt: 2300 },
  { label: "Spa — Hot Stone Massage", src: "Manual entry", amt: 6500 },
];

function FolioAutoMockup() {
  return (
    <div className="rounded-2xl overflow-hidden font-body bg-card border border-line shadow-float p-5">
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-line-soft">
        <p className="text-[12.5px] font-bold text-ink">Room 214 — live folio</p>
        <span className="flex items-center gap-1.5 text-[9.5px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/50">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live
        </span>
      </div>
      <div className="space-y-2">
        {FOLIO_AUTO_ITEMS.map((it, i) => (
          <motion.div
            key={it.label}
            initial={{ opacity: 0, x: -8 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.15, duration: 0.4, ease: EASE }}
            className="flex items-center justify-between rounded-lg bg-mist/60 px-3 py-2.5"
          >
            <div className="min-w-0">
              <p className="text-[11.5px] font-bold text-ink truncate">{it.label}</p>
              <p className="text-[10px] text-ink-mute">{it.src}</p>
            </div>
            <span className="text-[11.5px] font-bold text-ink shrink-0">PKR {it.amt.toLocaleString()}</span>
          </motion.div>
        ))}
      </div>
      <p className="text-[10.5px] text-ink-mute mt-3 pt-3 border-t border-line-soft">
        POS orders post here the moment they're placed — no re-typing at the front desk.
      </p>
    </div>
  );
}

// ─── Inventory — camera scan updates stock, low levels flag themselves ────
function InventoryAutoMockup() {
  const [scanned, setScanned] = useState(false);
  return (
    <motion.div
      onViewportEnter={() => setScanned(true)}
      viewport={{ once: true }}
      className="rounded-2xl overflow-hidden font-body bg-card border border-line shadow-float p-5"
    >
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-line-soft">
        <p className="text-[12.5px] font-bold text-ink">Inventory — Linens</p>
        <motion.div
          animate={{ opacity: scanned ? [1, 0.4, 1] : 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="flex items-center gap-1.5 text-[9.5px] font-bold text-ink-mute"
        >
          <Camera className="h-3.5 w-3.5" /> Scanned
        </motion.div>
      </div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10.5px] font-semibold text-ink-mute">Bath Towels</span>
        <span className="text-[10.5px] font-bold text-ink">18 pcs</span>
      </div>
      <div className="h-2 rounded-full bg-mist overflow-hidden mb-3">
        <motion.div
          className="h-full rounded-full bg-amber-500"
          initial={{ width: "60%" }}
          animate={{ width: scanned ? "22%" : "60%" }}
          transition={{ duration: 0.9, delay: 0.4, ease: EASE }}
        />
      </div>
      <AnimatePresence>
        {scanned && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.1, duration: 0.4 }}
            className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2"
          >
            <AlertTriangle className="h-3.5 w-3.5 text-amber-700 shrink-0" />
            <p className="text-[10.5px] font-semibold text-amber-800">Below reorder level — flagged automatically</p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Group checkout — every room in the block settles at once ─────────────
const GROUP_ROOMS = ["Room 108", "Room 110", "Room 112", "Room 114"];

function GroupCheckoutMockup() {
  const [settled, setSettled] = useState(false);
  return (
    <motion.div
      onViewportEnter={() => setSettled(true)}
      viewport={{ once: true }}
      className="rounded-2xl overflow-hidden font-body bg-card border border-line shadow-float p-5"
    >
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-line-soft">
        <p className="text-[12.5px] font-bold text-ink">Rao Family — group booking</p>
        <Users className="h-4 w-4 text-ink-mute" />
      </div>
      <div className="space-y-2">
        {GROUP_ROOMS.map((room, i) => (
          <motion.div
            key={room}
            animate={{
              backgroundColor: settled ? "rgba(16,185,129,0.08)" : "#F6F3EE",
              borderColor: settled ? "rgba(16,185,129,0.3)" : "#EFE4D6",
            }}
            transition={{ delay: 0.3 + i * 0.15, duration: 0.4 }}
            className="flex items-center justify-between rounded-lg border px-3 py-2"
          >
            <span className="text-[11px] font-semibold text-ink">{room}</span>
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: settled ? 1 : 0 }}
              transition={{ delay: 0.4 + i * 0.15, duration: 0.3 }}
              className="flex items-center gap-1 text-[10px] font-bold text-emerald-700"
            >
              <CheckCircle2 className="h-3 w-3" /> Settled
            </motion.span>
          </motion.div>
        ))}
      </div>
      <p className="text-[10.5px] text-ink-mute mt-3 pt-3 border-t border-line-soft">
        One checkout on the group closes every room's folio together — no chasing four separate bills.
      </p>
    </motion.div>
  );
}

// ─── Channel sync — compact hub, same visual language as Channel Manager ──
function ChannelSyncMockup() {
  return (
    <div className="rounded-2xl overflow-hidden font-body bg-card border border-line shadow-float p-6">
      <div className="flex items-center justify-center gap-4 flex-wrap mb-5">
        {[
          { name: "Booking.com", color: "#003580", bg: "#E8EFF9" },
          { name: "Airbnb",      color: "#FF5A5F", bg: "#FFF0F0" },
          { name: "Expedia",     color: "#B8860B", bg: "#FFF8E0" },
          { name: "Agoda",       color: "#5B1E96", bg: "#F1EBFB" },
        ].map((ch, i) => (
          <motion.div
            key={ch.name}
            initial={{ opacity: 0, y: -8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1, duration: 0.4, ease: EASE }}
            className="h-11 w-11 rounded-xl grid place-items-center shrink-0"
            style={{ background: ch.bg }}
          >
            <RefreshCw className="h-4.5 w-4.5" style={{ color: ch.color }} strokeWidth={2.25} />
          </motion.div>
        ))}
      </div>
      <div className="flex items-center justify-center gap-2">
        <div className="h-9 w-9 rounded-lg bg-ink grid place-items-center">
          <span className="font-display italic text-[11px] text-paper">IF</span>
        </div>
        <div className="h-px w-16 bg-line-soft" />
        <span className="text-[10.5px] font-bold text-ink-mute uppercase tracking-wide">Your calendar</span>
      </div>
    </div>
  );
}

const AUTO_FAQS = [
  {
    q: "Do I have to set any of these up manually?",
    a: "No — the nightly briefing, housekeeping tasks, folio posting, and low-stock flags all run on their own once InnFlo is set up. There's no schedule to configure or button to remember to press.",
  },
  {
    q: "Can I turn the WhatsApp briefing off, or change the time?",
    a: "Yes — it's a toggle in Settings. Enter the number that should receive it, and it sends automatically at 11 PM every night.",
  },
  {
    q: "What happens if I edit something an automation already touched?",
    a: "It's flagged, not silently overwritten — an order edited after posting to a folio, for instance, shows a review warning at front desk instead of quietly drifting.",
  },
  {
    q: "Is Channel Manager sync live yet?",
    a: "It's in development — the automation described here is what we're building toward. Everything else on this page is live today.",
  },
];

function AutoFaqRow({ q, a, isOpen, isLast, onClick }: { q: string; a: string; isOpen: boolean; isLast: boolean; onClick: () => void }) {
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

export default function Automations() {
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
          <Reveal variant="fade"><p className="eyebrow mb-6">Automations</p></Reveal>
          <h1 className="font-display text-[clamp(38px,6vw,64px)] font-medium leading-[1.05] text-ink">
            <SplitHeading as="span" className="block">Things that happen</SplitHeading>
            <SplitHeading as="span" delay={0.25} className="block italic text-coral-dark">without you.</SplitHeading>
          </h1>
          <Reveal delay={0.5}>
            <p className="text-[17px] text-ink-soft font-body leading-relaxed max-w-lg mx-auto mt-6">
              The parts of running a property that shouldn't need a person watching them — InnFlo handles them in the background, so your team's attention goes to the guest in front of them.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ── Flagship: Nightly WhatsApp Briefing ──────────────────────────────── */}
      <section className="py-20 px-6">
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-1 lg:grid-cols-[55%_45%] gap-14 items-center">
            <Reveal>
              <p className="eyebrow mb-4">The flagship</p>
              <h2 className="font-display text-[clamp(28px,3.4vw,40px)] font-medium leading-tight text-ink mb-5">
                Your day, summarized before you ask.
              </h2>
              <p className="text-[15.5px] text-ink-soft font-body leading-relaxed mb-6 max-w-lg">
                Every night at 11 PM, InnFlo sends a complete operational summary straight to WhatsApp — occupancy, revenue, tomorrow's arrivals, housekeeping backlog, open maintenance tickets. No login, no dashboard to open.
              </p>
              <div className="grid grid-cols-1 gap-2.5 font-body text-[13.5px] text-ink-soft">
                {[
                  "Sent automatically, every night, no one has to trigger it",
                  "Occupancy, revenue, and tomorrow's arrivals in one message",
                  "Housekeeping backlog and open maintenance tickets included",
                  "Turn it on with a phone number — one toggle in Settings",
                ].map(f => (
                  <p key={f} className="flex items-start gap-2.5"><span className="text-coral mt-0.5">—</span>{f}</p>
                ))}
              </div>
            </Reveal>
            <Reveal delay={0.1}><NightlyBriefingMockup /></Reveal>
          </div>
        </div>
      </section>

      {/* ── Housekeeping ──────────────────────────────────────────────────────── */}
      <section className="py-20 px-6 bg-mist border-y border-line">
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-1 lg:grid-cols-[45%_55%] gap-14 items-center">
            <Reveal className="order-2 lg:order-1">
              <p className="eyebrow mb-4">Housekeeping</p>
              <h2 className="font-display text-[clamp(28px,3.4vw,40px)] font-medium leading-tight text-ink mb-5">
                Checkout closes, the task appears.
              </h2>
              <p className="text-[15.5px] text-ink-soft font-body leading-relaxed mb-6 max-w-lg">
                No one has to notice a room went vacant, remember to write it down, or radio housekeeping. The cleaning task creates itself, and staff mark rooms done from their phone.
              </p>
              <div className="grid grid-cols-1 gap-2.5 font-body text-[13.5px] text-ink-soft">
                {[
                  "Task created the moment a room checks out",
                  "Assigned automatically to the next available housekeeper",
                  "Marked done from a phone — no paper checklist",
                ].map(f => (
                  <p key={f} className="flex items-start gap-2.5"><span className="text-coral mt-0.5">—</span>{f}</p>
                ))}
              </div>
            </Reveal>
            <Reveal delay={0.1} className="order-1 lg:order-2"><HousekeepingAutoMockup /></Reveal>
          </div>
        </div>
      </section>

      {/* ── Folio automation — routes to Point of Sale ───────────────────────── */}
      <section className="py-20 px-6">
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-1 lg:grid-cols-[55%_45%] gap-14 items-center">
            <Reveal>
              <p className="eyebrow mb-4">Folio</p>
              <h2 className="font-display text-[clamp(28px,3.4vw,40px)] font-medium leading-tight text-ink mb-5">
                Every charge finds its folio on its own.
              </h2>
              <p className="text-[15.5px] text-ink-soft font-body leading-relaxed mb-6 max-w-lg">
                Room, F&B, spa, laundry, tax — every charge lands on the right guest folio the moment it happens. A room-service order placed at the Point of Sale terminal posts itself; nothing gets re-typed at the front desk.
              </p>
              <div className="grid grid-cols-1 gap-2.5 font-body text-[13.5px] text-ink-soft mb-7">
                {[
                  "POS orders post to a verified guest's folio automatically",
                  "Manual charges still work for anything that didn't come from POS",
                  "An order edited after posting is flagged, never silently wrong",
                ].map(f => (
                  <p key={f} className="flex items-start gap-2.5"><span className="text-coral mt-0.5">—</span>{f}</p>
                ))}
              </div>
              <MagneticButton>
                <Link to="/pos" className="inline-flex items-center gap-1.5 text-[14px] font-bold text-coral-dark hover:underline">
                  See it in Point of Sale <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </MagneticButton>
            </Reveal>
            <Reveal delay={0.1}><FolioAutoMockup /></Reveal>
          </div>
        </div>
      </section>

      {/* ── Inventory — camera scan + low stock ──────────────────────────────── */}
      <section className="py-20 px-6 bg-mist border-y border-line">
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-1 lg:grid-cols-[45%_55%] gap-14 items-center">
            <Reveal className="order-2 lg:order-1">
              <p className="eyebrow mb-4">Inventory</p>
              <h2 className="font-display text-[clamp(28px,3.4vw,40px)] font-medium leading-tight text-ink mb-5">
                Point the camera, stock updates itself.
              </h2>
              <p className="text-[15.5px] text-ink-soft font-body leading-relaxed mb-6 max-w-lg">
                Scan stock with a phone camera and the count updates on its own — no app needed. And when anything drops to its reorder level, it flags itself as low stock before it becomes a problem.
              </p>
              <div className="grid grid-cols-1 gap-2.5 font-body text-[13.5px] text-ink-soft">
                {[
                  "Camera scan updates the count — no manual tally",
                  "Every POS sale deducts linked ingredients automatically",
                  "Items at or below reorder level flag themselves as low stock",
                ].map(f => (
                  <p key={f} className="flex items-start gap-2.5"><span className="text-coral mt-0.5">—</span>{f}</p>
                ))}
              </div>
            </Reveal>
            <Reveal delay={0.1} className="order-1 lg:order-2"><InventoryAutoMockup /></Reveal>
          </div>
        </div>
      </section>

      {/* ── Group checkout ────────────────────────────────────────────────────── */}
      <section className="py-20 px-6">
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-1 lg:grid-cols-[55%_45%] gap-14 items-center">
            <Reveal>
              <p className="eyebrow mb-4">Group bookings</p>
              <h2 className="font-display text-[clamp(28px,3.4vw,40px)] font-medium leading-tight text-ink mb-5">
                One checkout, every room settled.
              </h2>
              <p className="text-[15.5px] text-ink-soft font-body leading-relaxed mb-6 max-w-lg">
                A family or group booking spanning four rooms shouldn't mean four separate checkouts. Close the group's folio once, and every room in it settles together, automatically.
              </p>
              <div className="grid grid-cols-1 gap-2.5 font-body text-[13.5px] text-ink-soft">
                {[
                  "One checkout closes every room in the group",
                  "Settle as one combined bill, or split by room",
                  "No chasing individual folios room by room",
                ].map(f => (
                  <p key={f} className="flex items-start gap-2.5"><span className="text-coral mt-0.5">—</span>{f}</p>
                ))}
              </div>
            </Reveal>
            <Reveal delay={0.1}><GroupCheckoutMockup /></Reveal>
          </div>
        </div>
      </section>

      {/* ── Channel sync — routes to Channel Manager ─────────────────────────── */}
      <section className="py-20 px-6 bg-mist border-y border-line">
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-1 lg:grid-cols-[45%_55%] gap-14 items-center">
            <Reveal className="order-2 lg:order-1">
              <div className="flex items-center gap-3 mb-4">
                <p className="eyebrow">Channel sync</p>
                <span className="text-[10px] font-bold font-body text-coral-dark bg-coral-soft px-2.5 py-1 rounded-full uppercase tracking-wider">
                  In development
                </span>
              </div>
              <h2 className="font-display text-[clamp(28px,3.4vw,40px)] font-medium leading-tight text-ink mb-5">
                No more five extranets, five tabs.
              </h2>
              <p className="text-[15.5px] text-ink-soft font-body leading-relaxed mb-6 max-w-lg">
                Rates and availability update across Booking.com, Airbnb, Expedia, and Agoda the moment something changes in InnFlo — this is what we're building toward, no manual publishing, no double bookings.
              </p>
              <MagneticButton>
                <Link to="/channel-manager" className="inline-flex items-center gap-1.5 text-[14px] font-bold text-coral-dark hover:underline">
                  See Channel Manager <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </MagneticButton>
            </Reveal>
            <Reveal delay={0.1} className="order-1 lg:order-2"><ChannelSyncMockup /></Reveal>
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
              {AUTO_FAQS.map((item, i) => (
                <AutoFaqRow
                  key={item.q}
                  q={item.q}
                  a={item.a}
                  isLast={i === AUTO_FAQS.length - 1}
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
