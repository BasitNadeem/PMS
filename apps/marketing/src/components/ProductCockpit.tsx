import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  BedDouble,
  Bell,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  CreditCard,
  LayoutDashboard,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  UserRound,
  Users,
} from "lucide-react";

const SCENE_DURATION = 3_600;

const SCENES = [
  { label: "Direct booking", caption: "A guest books from your hotel website." },
  { label: "Front desk", caption: "The reservation reaches the desk instantly." },
  { label: "Checkout", caption: "Payment settles and checkout closes the stay." },
  { label: "Housekeeping", caption: "The room becomes a cleaning task automatically." },
  { label: "Ready again", caption: "Housekeeping finishes. Availability is ready to sell." },
] as const;

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: "Overview" },
  { icon: CalendarDays, label: "Reservations" },
  { icon: BedDouble, label: "Rooms" },
  { icon: Users, label: "Guests" },
  { icon: CircleDollarSign, label: "Billing" },
] as const;

const CURSOR_TARGETS = [
  { left: "83%", top: "21%" },
  { left: "68%", top: "54%" },
  { left: "72%", top: "75%" },
  { left: "79%", top: "64%" },
  { left: "88%", top: "19%" },
] as const;

function ReservationTimeline({ scene }: { scene: number }) {
  const bookingVisible = scene >= 0;
  return (
    <div className="h-full min-h-0 overflow-hidden rounded-[14px] border border-line bg-white shadow-card">
      <div className="flex items-center justify-between border-b border-line px-3 py-2">
        <div>
          <p className="text-[7px] font-extrabold text-ink">Reservation timeline</p>
          <p className="text-[5px] text-ink-mute">28 July — 1 August</p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="rounded-full bg-coral-soft px-2 py-1 text-[5px] font-bold text-coral-dark">Today</span>
          <span className="grid h-5 w-5 place-items-center rounded-full border border-line text-[7px] text-ink-mute">→</span>
        </div>
      </div>

      <div className="grid grid-cols-[62px_repeat(4,1fr)] text-[5px]">
        <div className="border-b border-r border-line-soft bg-mist px-2 py-2 font-bold text-ink-mute">Room</div>
        {["Tue 28", "Wed 29", "Thu 30", "Fri 31"].map((day, index) => (
          <div key={day} className={`border-b border-r border-line-soft px-1 py-2 text-center font-bold ${index === 0 ? "bg-coral-soft text-coral-dark" : "bg-mist text-ink-mute"}`}>{day}</div>
        ))}
        {[
          { room: "101", type: "Standard", guest: "Sara Ahmed", start: 1, span: 2, color: "bg-[#DDEFE7] text-[#286247]" },
          { room: "201", type: "Deluxe", guest: "Hira & Usman", start: 2, span: 2, color: "bg-[#F6E3D8] text-coral-deep" },
          { room: "203", type: "Deluxe", guest: "Ali Raza", start: 1, span: 3, color: "bg-[#E6E4F5] text-[#585085]" },
          { room: "301", type: "Family", guest: "New direct booking", start: 3, span: 2, color: "bg-coral text-white" },
        ].map((row, rowIndex) => (
          <div key={row.room} className="contents">
            <div className="border-b border-r border-line-soft px-2 py-2">
              <p className="text-[6px] font-extrabold text-ink">{row.room}</p>
              <p className="text-[4.5px] text-ink-mute">{row.type}</p>
            </div>
            <div className="relative col-span-4 grid grid-cols-4 border-b border-line-soft">
              {[0, 1, 2, 3].map((column) => <span key={column} className="border-r border-line-soft" />)}
              {rowIndex < 3 && (
                <div
                  className={`absolute inset-y-1.5 flex items-center rounded-md px-2 text-[5px] font-bold ${row.color}`}
                  style={{ left: `${(row.start - 1) * 25 + 2}%`, width: `${row.span * 25 - 4}%` }}
                >
                  {row.guest}
                </div>
              )}
              {rowIndex === 3 && bookingVisible && (
                <motion.div
                  initial={{ opacity: 0, scaleX: 0, transformOrigin: "left" }}
                  animate={{ opacity: 1, scaleX: 1 }}
                  transition={{ delay: 0.55, duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
                  className={`absolute inset-y-1.5 flex items-center rounded-md px-2 text-[5px] font-bold ${row.color}`}
                  style={{ left: `${(row.start - 1) * 25 + 2}%`, width: `${row.span * 25 - 4}%` }}
                >
                  <Sparkles className="mr-1 h-2 w-2" /> {row.guest}
                </motion.div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BookingAlert() {
  return (
    <motion.div
      initial={{ opacity: 0, x: 38, scale: 0.92 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 24, scale: 0.96 }}
      transition={{ delay: 0.85, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="absolute right-3 top-3 z-30 w-[188px] overflow-hidden rounded-[14px] border border-white/10 bg-[#172321] p-3 text-white shadow-[0_18px_45px_rgba(23,35,33,.35)]"
    >
      <motion.span
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ delay: 1.05, duration: 1.8, ease: "linear" }}
        className="absolute inset-x-0 bottom-0 h-[2px] origin-left bg-coral"
      />
      <div className="flex items-start gap-2.5">
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-coral text-white">
          <Bell className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0">
          <p className="text-[6px] font-bold uppercase tracking-[.14em] text-coral">Booking Engine</p>
          <p className="mt-1 text-[8px] font-extrabold">New direct booking</p>
          <p className="mt-1 text-[5.5px] leading-relaxed text-white/55">Zain Malik · Family Suite<br />30 Jul — 01 Aug · PKR 28,000</p>
        </div>
      </div>
    </motion.div>
  );
}

function ReservationDrawer() {
  return (
    <motion.div
      initial={{ x: "105%" }}
      animate={{ x: 0 }}
      exit={{ x: "105%" }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      className="absolute inset-y-0 right-0 z-20 w-[43%] border-l border-line bg-white p-3 shadow-[-18px_0_45px_rgba(33,30,26,.12)]"
    >
      <div className="flex items-start justify-between border-b border-line-soft pb-3">
        <div>
          <span className="rounded-full bg-coral-soft px-2 py-1 text-[5px] font-bold text-coral-dark">DIRECT · CONFIRMED</span>
          <p className="mt-2 text-[10px] font-extrabold text-ink">Zain Malik</p>
          <p className="text-[5px] text-ink-mute">IF-2847 · created just now</p>
        </div>
        <span className="text-[10px] text-ink-faint">×</span>
      </div>
      <div className="mt-3 rounded-xl bg-mist p-3">
        <div className="flex items-center gap-2">
          <div className="grid h-7 w-7 place-items-center rounded-lg bg-white"><BedDouble className="h-3.5 w-3.5 text-coral-dark" /></div>
          <div><p className="text-[7px] font-bold text-ink">Family Suite · Room 301</p><p className="text-[5px] text-ink-mute">2 adults · 2 nights</p></div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 border-t border-line-soft pt-3">
          <div><p className="text-[4.5px] uppercase text-ink-mute">Check-in</p><p className="mt-1 text-[6px] font-bold">30 Jul · 2:00 PM</p></div>
          <div><p className="text-[4.5px] uppercase text-ink-mute">Check-out</p><p className="mt-1 text-[6px] font-bold">01 Aug · 12:00 PM</p></div>
        </div>
      </div>
      <div className="mt-3 space-y-2">
        <div className="flex items-center gap-2 rounded-xl border border-line p-2.5">
          <UserRound className="h-3.5 w-3.5 text-ink-mute" />
          <div><p className="text-[6px] font-bold">+92 300 845 2201</p><p className="text-[4.5px] text-ink-mute">zain@example.com</p></div>
        </div>
        <div className="flex items-center justify-between rounded-xl border border-line p-2.5">
          <div><p className="text-[5px] text-ink-mute">Booking value</p><p className="text-[8px] font-extrabold">PKR 28,000</p></div>
          <CheckCircle2 className="h-4 w-4 text-[#2F7256]" />
        </div>
      </div>
      <motion.button
        initial={{ boxShadow: "0 0 0 0 rgba(224,83,43,0)" }}
        animate={{ boxShadow: ["0 0 0 0 rgba(224,83,43,0)", "0 0 0 5px rgba(224,83,43,.15)", "0 0 0 0 rgba(224,83,43,0)"] }}
        transition={{ delay: 1.5, duration: 0.9 }}
        className="absolute inset-x-3 bottom-3 rounded-xl bg-coral py-2.5 text-[6px] font-bold text-white"
      >
        Open reservation
      </motion.button>
    </motion.div>
  );
}

function FolioCheckout() {
  return (
    <div className="grid h-full grid-cols-[1.2fr_.8fr] gap-3">
      <div className="rounded-[14px] border border-line bg-white p-3 shadow-card">
        <div className="flex items-center justify-between border-b border-line-soft pb-3">
          <div><p className="text-[8px] font-extrabold">Folio · Room 103</p><p className="text-[5px] text-ink-mute">Sara Ahmed · IF-2791</p></div>
          <span className="rounded-full bg-[#E8F4EF] px-2 py-1 text-[5px] font-bold text-[#2F7256]">IN HOUSE</span>
        </div>
        <div className="mt-3 space-y-2">
          {[
            ["Room charge · 2 nights", "PKR 24,000"],
            ["QR room service · Order 4082", "PKR 2,450"],
            ["GST", "PKR 1,322"],
          ].map(([label, amount], index) => (
            <motion.div key={label} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.12 }} className="flex items-center justify-between rounded-lg bg-mist px-3 py-2">
              <span className="text-[5.5px] font-semibold text-ink-soft">{label}</span><span className="text-[6px] font-bold">{amount}</span>
            </motion.div>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
          <p className="text-[6px] font-bold text-ink-mute">Total</p><p className="text-[11px] font-extrabold">PKR 27,772</p>
        </div>
      </div>
      <div className="flex flex-col rounded-[14px] border border-line bg-white p-3 shadow-card">
        <div className="grid h-8 w-8 place-items-center rounded-xl bg-coral-soft"><CreditCard className="h-4 w-4 text-coral-dark" /></div>
        <p className="mt-3 text-[8px] font-extrabold">Settle & check out</p>
        <p className="mt-1 text-[5px] leading-relaxed text-ink-mute">Payment received by card. The folio balance is clear.</p>
        <div className="mt-3 flex items-center justify-between rounded-lg bg-[#E8F4EF] px-2.5 py-2">
          <span className="text-[5px] font-bold text-[#2F7256]">Balance due</span><span className="text-[7px] font-extrabold text-[#2F7256]">PKR 0</span>
        </div>
        <motion.button
          animate={{ scale: [1, 1, 0.96, 1] }}
          transition={{ delay: 1.5, duration: 0.55 }}
          className="mt-auto rounded-xl bg-coral py-2.5 text-[6px] font-bold text-white"
        >
          Check out guest
        </motion.button>
      </div>
    </div>
  );
}

function HousekeepingScene({ complete }: { complete: boolean }) {
  return (
    <div className="grid h-full grid-cols-[1fr_170px] gap-3">
      <div className="rounded-[14px] border border-line bg-white p-3 shadow-card">
        <div className="flex items-center justify-between">
          <div><p className="text-[8px] font-extrabold">Room status board</p><p className="text-[5px] text-ink-mute">Live across front desk and housekeeping</p></div>
          <span className="text-[5px] font-bold text-coral-dark">6 rooms</span>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {[
            ["101", "Occupied", "bg-[#E8F4EF] text-[#2F7256]"],
            ["102", "Ready", "bg-[#E8F4EF] text-[#2F7256]"],
            ["103", complete ? "Ready" : "Needs cleaning", complete ? "bg-[#E8F4EF] text-[#2F7256]" : "bg-[#FFF0D5] text-[#8C5B0C]"],
            ["201", "Occupied", "bg-coral-soft text-coral-dark"],
            ["202", "Ready", "bg-[#E8F4EF] text-[#2F7256]"],
            ["203", "Maintenance", "bg-mist text-ink-mute"],
          ].map(([room, status, tone], index) => (
            <motion.div
              key={room}
              animate={room === "103" ? { scale: [1, 1.05, 1] } : undefined}
              transition={{ delay: complete ? 0.8 : 0.4, duration: 0.55 }}
              className={`rounded-xl p-3 ${tone}`}
            >
              <div className="flex items-center justify-between"><p className="text-[8px] font-extrabold">{room}</p><span className="h-1.5 w-1.5 rounded-full bg-current opacity-50" /></div>
              <p className="mt-2 text-[5px] font-bold">{status}</p>
              <p className="mt-0.5 text-[4.5px] opacity-60">{index < 3 ? "First floor" : "Second floor"}</p>
            </motion.div>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-line bg-mist p-2.5">
          <Clock3 className="h-3.5 w-3.5 text-coral-dark" />
          <p className="text-[5px] font-semibold text-ink-soft">{complete ? "Room 103 marked ready · just now" : "Checkout created cleaning task · just now"}</p>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 28, rotate: 2 }}
        animate={{ opacity: 1, y: 0, rotate: 0 }}
        transition={{ delay: 0.35, duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
        className="relative overflow-hidden rounded-[25px] border-[5px] border-ink bg-white shadow-float"
      >
        <div className="flex h-5 items-end justify-center bg-ink"><span className="mb-1 h-1 w-10 rounded-full bg-white/20" /></div>
        <div className="bg-[#183B38] px-3 pb-3 pt-2 text-white">
          <p className="text-[4.5px] font-bold uppercase tracking-wider text-[#9EC1BB]">Housekeeping</p>
          <p className="mt-1 text-[8px] font-extrabold">Good afternoon, Ayesha</p>
        </div>
        <div className="p-2.5">
          <div className="rounded-xl border border-line bg-mist p-2.5">
            <div className="flex items-center justify-between">
              <span className="rounded-md bg-coral px-1.5 py-1 text-[4.5px] font-bold text-white">PRIORITY</span>
              <span className="text-[4.5px] text-ink-mute">Just now</span>
            </div>
            <p className="mt-2 text-[8px] font-extrabold">Room 103</p>
            <p className="mt-0.5 text-[5px] text-ink-mute">Checkout cleaning · First floor</p>
            <motion.button
              animate={complete ? { backgroundColor: "#2F7256" } : { backgroundColor: "#E0532B" }}
              className="mt-3 flex w-full items-center justify-center rounded-lg py-2 text-[5px] font-bold text-white"
            >
              {complete ? <><Check className="mr-1 h-2.5 w-2.5" /> Room ready</> : "Start cleaning"}
            </motion.button>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            <div className="rounded-lg bg-mist p-2"><p className="text-[7px] font-extrabold">4</p><p className="text-[4.5px] text-ink-mute">Done today</p></div>
            <div className="rounded-lg bg-mist p-2"><p className="text-[7px] font-extrabold">1</p><p className="text-[4.5px] text-ink-mute">Remaining</p></div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function AppCanvas({ scene }: { scene: number }) {
  const activeNavigation = scene === 0 || scene === 1 ? "Reservations" : scene === 2 ? "Billing" : "Rooms";
  return (
    <div className="relative grid h-full grid-cols-[92px_1fr] bg-paper">
      <aside className="border-r border-white/5 bg-[#201F1B] p-2.5 text-white">
        <div className="mb-4 font-display text-[16px] italic">InnFlo</div>
        <div className="space-y-1">
          {NAV_ITEMS.map(({ icon: Icon, label }) => (
            <div key={label} className={`flex items-center gap-1.5 rounded-lg px-2 py-2 text-[5.5px] font-semibold transition-colors ${activeNavigation === label ? "bg-coral text-white" : "text-white/45"}`}>
              <Icon className="h-2.5 w-2.5" /> {label}
            </div>
          ))}
        </div>
        <div className="mt-5 rounded-xl border border-white/10 bg-white/[.055] p-2">
          <p className="text-[5px] font-bold uppercase tracking-wider text-coral">Live operation</p>
          <p className="mt-1.5 text-[5.5px] leading-relaxed text-white/55">{SCENES[scene]?.caption}</p>
        </div>
      </aside>

      <main className="relative min-w-0 overflow-hidden p-3">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-[5px] font-bold uppercase tracking-[.14em] text-coral-dark">{SCENES[scene]?.label}</p>
            <p className="mt-1 text-[11px] font-extrabold text-ink">
              {scene < 2 ? "Reservations" : scene === 2 ? "Guest folio" : "Housekeeping pulse"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden rounded-full border border-line bg-white px-2 py-1 text-[5px] text-ink-mute sm:inline">Mountain View Hotel</span>
            <div className="relative grid h-7 w-7 place-items-center rounded-full bg-ink text-[5px] font-bold text-white">BN<span className="absolute right-0 top-0 h-2 w-2 rounded-full border border-white bg-emerald-500" /></div>
          </div>
        </div>

        <div className="h-[calc(100%_-_42px)] min-h-0">
          <AnimatePresence mode="wait">
            {(scene === 0 || scene === 1) && (
              <motion.div key="reservations" className="relative h-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
                <ReservationTimeline scene={scene} />
                <AnimatePresence>{scene === 0 && <BookingAlert />}</AnimatePresence>
                <AnimatePresence>{scene === 1 && <ReservationDrawer />}</AnimatePresence>
              </motion.div>
            )}
            {scene === 2 && (
              <motion.div key="folio" className="h-full" initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}>
                <FolioCheckout />
              </motion.div>
            )}
            {(scene === 3 || scene === 4) && (
              <motion.div key="housekeeping" className="h-full" initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}>
                <HousekeepingScene complete={scene === 4} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <motion.div
          className="pointer-events-none absolute z-40"
          animate={CURSOR_TARGETS[scene]}
          transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1] }}
        >
          <motion.span
            key={scene}
            initial={{ opacity: 0, scale: 0.4 }}
            animate={{ opacity: [0, 0, 0.4, 0], scale: [0.4, 0.4, 2.2, 2.8] }}
            transition={{ delay: 1.35, duration: 0.7 }}
            className="absolute -left-2 -top-2 h-5 w-5 rounded-full bg-coral"
          />
          <svg width="15" height="19" viewBox="0 0 15 19" fill="none" className="drop-shadow-md">
            <path d="M1 1L13.2 11.1L7.2 11.9L4.6 17.4L1 1Z" fill="#211E1A" stroke="white" strokeWidth="1.2" strokeLinejoin="round" />
          </svg>
        </motion.div>
      </main>
    </div>
  );
}

export default function ProductCockpit() {
  const reduceMotion = useReducedMotion();
  const [scene, setScene] = useState(0);
  const [playing, setPlaying] = useState(!reduceMotion);
  const [cycle, setCycle] = useState(0);

  useEffect(() => {
    if (!playing || reduceMotion) return;
    const timer = window.setTimeout(() => {
      setScene((current) => (current + 1) % SCENES.length);
      setCycle((current) => current + 1);
    }, SCENE_DURATION);
    return () => window.clearTimeout(timer);
  }, [scene, playing, reduceMotion, cycle]);

  function selectScene(nextScene: number) {
    setScene(nextScene);
    setCycle((current) => current + 1);
  }

  function replay() {
    setScene(0);
    setPlaying(true);
    setCycle((current) => current + 1);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 28, rotateX: 4 }}
      animate={{ opacity: 1, y: 0, rotateX: 0 }}
      transition={{ duration: 0.9, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className="relative"
      style={{ perspective: 1500 }}
    >
      <div className="absolute -inset-8 rounded-[3rem] bg-coral/12 blur-3xl" />
      <div className="relative overflow-hidden rounded-[24px] border border-white/80 bg-white shadow-hero">
        <div className="flex h-10 items-center justify-between border-b border-line bg-mist px-4">
          <div className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#FF8B72]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#F3C76B]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#72BC93]" />
          </div>
          <div className="flex items-center gap-1.5 rounded-full border border-line bg-white px-4 py-1 text-[6px] font-semibold text-ink-mute">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> app.innflo.co
          </div>
          <Bell className="h-3.5 w-3.5 text-ink-mute" />
        </div>

        <div className="aspect-[16/9.7] min-h-[330px] overflow-hidden">
          <AppCanvas scene={scene} />
        </div>

        <div className="border-t border-line bg-white px-3 py-3 sm:px-4">
          <div className="mb-2.5 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <AnimatePresence mode="wait">
                <motion.div key={scene} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}>
                  <p className="text-[8px] font-extrabold text-ink">{SCENES[scene]?.label}</p>
                  <p className="truncate text-[5.5px] text-ink-mute">{SCENES[scene]?.caption}</p>
                </motion.div>
              </AnimatePresence>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <button onClick={() => setPlaying((current) => !current)} aria-label={playing ? "Pause product story" : "Play product story"} className="grid h-7 w-7 place-items-center rounded-full bg-ink text-white transition hover:bg-coral">
                {playing ? <Pause className="h-3 w-3" /> : <Play className="ml-0.5 h-3 w-3" />}
              </button>
              <button onClick={replay} aria-label="Replay product story" className="grid h-7 w-7 place-items-center rounded-full border border-line text-ink-mute transition hover:border-coral hover:text-coral-dark">
                <RotateCcw className="h-3 w-3" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-5 gap-1.5">
            {SCENES.map((item, index) => (
              <button key={item.label} onClick={() => selectScene(index)} aria-label={`Show ${item.label} scene`} className="group">
                <span className="block h-1 overflow-hidden rounded-full bg-line-soft">
                  {index < scene && <span className="block h-full w-full bg-coral/55" />}
                  {index === scene && (
                    <motion.span
                      key={`${scene}-${cycle}-${playing}`}
                      initial={{ width: 0 }}
                      animate={{ width: playing && !reduceMotion ? "100%" : "22%" }}
                      transition={{ duration: playing && !reduceMotion ? SCENE_DURATION / 1000 : 0.2, ease: "linear" }}
                      className="block h-full rounded-full bg-coral"
                    />
                  )}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <motion.div
        animate={{ y: [0, -7, 0] }}
        transition={{ duration: 4.6, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -bottom-5 -left-5 hidden items-center gap-2 rounded-2xl border border-line bg-paper/95 px-3 py-2.5 shadow-float backdrop-blur sm:flex"
      >
        <div className="grid h-7 w-7 place-items-center rounded-xl bg-[#E8F4EF]"><CheckCircle2 className="h-3.5 w-3.5 text-[#2F7256]" /></div>
        <div><p className="text-[7px] font-extrabold text-ink">One event. Every team updated.</p><p className="text-[5px] text-ink-mute">Watch the full hotel flow</p></div>
        <ChevronRight className="h-3 w-3 text-coral-dark" />
      </motion.div>
    </motion.div>
  );
}
