import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useAnimation } from "framer-motion";
import {
  ArrowUpRight, BedDouble, Bell, CalendarCheck2, ChevronsUpDown, CreditCard,
  LayoutDashboard, MousePointer2, Search, Sparkles, Users, Utensils, Wallet,
} from "lucide-react";

/**
 * Hero visual for /pms — an "app window" showing the real front-desk shape of
 * the product: sidebar, KPI strip with trend, an arrivals table, and a live
 * activity rail. Everything animates off one scripted loop so the window reads
 * as a system in motion rather than a screenshot.
 *
 * No props, no network, no external assets.
 */

const EASE = [0.16, 1, 0.3, 1] as const;

const NAV = [
  { label: "Overview",     icon: LayoutDashboard, badge: null },
  { label: "Reservations", icon: CalendarCheck2,  badge: "6" },
  { label: "Rooms",        icon: BedDouble,       badge: null },
  { label: "Guests",       icon: Users,           badge: null },
  { label: "Dining",       icon: Utensils,        badge: "3" },
  { label: "Billing",      icon: CreditCard,      badge: null },
];

type Row = {
  id: string;
  ref: string;
  name: string;
  initials: string;
  room: string;
  nights: string;
  source: "Direct" | "Booking.com" | "Walk-in";
  status: "due" | "inhouse" | "new";
  tint: string;
};

const BASE_ROWS: Row[] = [
  { id: "r1", ref: "RES-1042", name: "Sara Ahmed",   initials: "SA", room: "204", nights: "2 nights", source: "Direct",      status: "due",    tint: "#E0532B" },
  { id: "r2", ref: "RES-1041", name: "Imran Shah",   initials: "IS", room: "108", nights: "1 night",  source: "Booking.com", status: "inhouse", tint: "#2563EB" },
  { id: "r3", ref: "RES-1039", name: "Nadia Iqbal",  initials: "NI", room: "306", nights: "4 nights", source: "Direct",      status: "inhouse", tint: "#0A8272" },
  { id: "r4", ref: "RES-1038", name: "Bilal Hassan", initials: "BH", room: "112", nights: "3 nights", source: "Walk-in",     status: "inhouse", tint: "#9333EA" },
];

const NEW_ROW: Row = {
  id: "r0", ref: "RES-1043", name: "Ayesha Malik", initials: "AM", room: "302",
  nights: "3 nights", source: "Direct", status: "new", tint: "#C2431F",
};

const BASE_FEED = [
  "Folio settled · Room 112",
  "Rate plan updated · Deluxe",
  "Room 306 inspected · 11:20",
  "POS charge posted · Room 108",
  "Housekeeping assigned · 204",
  "Night audit closed · 03:04",
];

const SOURCE_STYLE: Record<Row["source"], string> = {
  "Direct":      "bg-coral-soft text-coral-deep",
  "Booking.com": "bg-blue-50 text-blue-700",
  "Walk-in":     "bg-violet-50 text-violet-700",
};

/** Tiny trend line. Deterministic — no random, so SSR/prerender stays stable. */
function Spark({ points, tone }: { points: number[]; tone: string }) {
  const w = 56, h = 18;
  const max = Math.max(...points), min = Math.min(...points);
  const span = max - min || 1;
  const d = points
    .map((p, i) => `${(i / (points.length - 1)) * w},${h - ((p - min) / span) * (h - 3) - 1.5}`)
    .join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible" aria-hidden="true">
      <polyline points={d} fill="none" stroke={tone} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={w} cy={h - ((points[points.length - 1] - min) / span) * (h - 3) - 1.5} r="2.1" fill={tone} />
    </svg>
  );
}

function StatusPill({ status }: { status: Row["status"] }) {
  if (status === "inhouse") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-[3px] text-[8.5px] font-black uppercase tracking-[.1em] text-emerald-700">
        <span className="h-1 w-1 rounded-full bg-emerald-500" /> In house
      </span>
    );
  }
  if (status === "new") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-coral px-2 py-[3px] text-[8.5px] font-black uppercase tracking-[.1em] text-white">
        <Sparkles className="h-2.5 w-2.5" /> New
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[#FDF1E3] px-2 py-[3px] text-[8.5px] font-black uppercase tracking-[.1em] text-[#8d5f14]">
      <span className="h-1 w-1 rounded-full bg-[#c98a2e]" /> Due 14:00
    </span>
  );
}

export default function PmsHeroMockup() {
  const cursor = useAnimation();
  const [rows, setRows] = useState<Row[]>(BASE_ROWS);
  const [occupancy, setOccupancy] = useState(75);
  const [revenue, setRevenue] = useState(364);
  const [arrivals, setArrivals] = useState(4);
  const [toast, setToast] = useState(false);
  const [feed, setFeed] = useState<string[]>(BASE_FEED);
  const [pressed, setPressed] = useState(false);
  const [ripple, setRipple] = useState<{ x: number; y: number; k: number } | null>(null);
  const alive = useRef(true);
  const shellRef = useRef<HTMLDivElement>(null);
  const checkInRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    alive.current = true;
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

    /**
     * Cursor coordinates are measured off the live DOM, in pixels relative to
     * the shell. Percentage x/y would resolve against the 16px cursor itself,
     * not the window, so it would never leave the top-left corner.
     */
    function pointAt(el: HTMLElement | null) {
      const shell = shellRef.current;
      if (!shell) return null;
      const box = shell.getBoundingClientRect();
      if (!el) return { x: box.width * 0.76, y: box.height * 0.55 };
      const target = el.getBoundingClientRect();
      return {
        x: target.left - box.left + target.width / 2,
        y: target.top - box.top + target.height / 2,
      };
    }

    function restPoint() {
      const shell = shellRef.current;
      if (!shell) return { x: 0, y: 0 };
      const box = shell.getBoundingClientRect();
      return { x: box.width * 0.82, y: box.height * 0.88 };
    }

    async function loop() {
      while (alive.current) {
        // ── reset ───────────────────────────────────────────────────────────
        setRows(BASE_ROWS);
        setOccupancy(75); setRevenue(364); setArrivals(4);
        setToast(false);
        setFeed(BASE_FEED);
        const rest = restPoint();
        cursor.set({ x: rest.x, y: rest.y, opacity: 0, scale: 1 });
        await wait(480); if (!alive.current) return;

        // ── cursor travels to the row's check-in control ────────────────────
        const target = pointAt(checkInRef.current);
        if (!target) return;
        await cursor.start({ opacity: 1, transition: { duration: 0.18 } });
        await cursor.start({ x: target.x, y: target.y, transition: { duration: 0.6, ease: EASE } });
        if (!alive.current) return;

        // ── click: Sara Ahmed checks in ─────────────────────────────────────
        setPressed(true);
        await cursor.start({ scale: 0.78, transition: { duration: 0.08 } });
        setRipple({ x: target.x, y: target.y, k: Date.now() });
        await cursor.start({ scale: 1, transition: { duration: 0.1 } });
        setPressed(false);
        setRows((prev) => prev.map((r) => (r.id === "r1" ? { ...r, status: "inhouse" } : r)));
        setOccupancy(83);
        setFeed((f) => ["Room 204 checked in · now", ...f].slice(0, 7));
        await wait(720); if (!alive.current) return;

        // ── a direct booking lands while you watch ──────────────────────────
        // Cursor drifts rather than vanishing — not awaited, so the booking
        // lands underneath the movement instead of queueing behind it.
        void cursor.start({ x: rest.x, y: rest.y, transition: { duration: 0.85, ease: EASE } });
        setToast(true);
        await wait(340); if (!alive.current) return;
        setRows((prev) => [NEW_ROW, ...prev].slice(0, 5));
        setArrivals(5);
        setRevenue(404);
        setFeed((f) => ["Direct booking · Ayesha Malik", ...f].slice(0, 7));
        await wait(1700); if (!alive.current) return;

        setToast(false);
        await cursor.start({ opacity: 0, transition: { duration: 0.28 } });
        await wait(360);
      }
    }

    void loop();
    return () => { alive.current = false; };
  }, [cursor]);

  return (
    <div ref={shellRef} className="relative mx-auto w-full min-w-0 max-w-[860px]">
      {/* ── app window ─────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-[22px] border border-line bg-white shadow-[0_40px_100px_-24px_rgba(68,43,30,.30),0_12px_32px_-12px_rgba(68,43,30,.14)]">

        {/* chrome */}
        <div className="flex h-10 items-center gap-3 border-b border-line-soft bg-gradient-to-b from-[#FCFAF7] to-[#F6F1EA] px-3.5">
          <div className="flex shrink-0 gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#F0A29B]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#F0CE85]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#9BD8C2]" />
          </div>
          <div className="mx-auto hidden min-w-0 items-center gap-1.5 rounded-md border border-line-soft bg-white/80 px-2.5 py-1 sm:flex">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
            <span className="truncate text-[9.5px] font-semibold text-ink-mute">app.innflo.co / front-desk</span>
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <Search className="h-3 w-3 text-ink-faint" />
            <span className="relative">
              <Bell className="h-3 w-3 text-ink-faint" />
              <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-coral" />
            </span>
            <span className="grid h-5 w-5 place-items-center rounded-full bg-ink text-[7.5px] font-black text-white">FR</span>
          </div>
        </div>

        <div className="grid grid-cols-[52px_1fr] sm:grid-cols-[150px_1fr]">
          {/* ── sidebar ────────────────────────────────────────────────────── */}
          <aside className="flex flex-col bg-[#181410] px-2 pb-3 pt-3 sm:px-2.5">
            <div className="mb-3 flex items-center gap-2 rounded-lg px-1 py-1 sm:bg-white/[.05] sm:px-2 sm:py-1.5">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-coral text-[9px] font-black text-white">I</span>
              <span className="hidden min-w-0 flex-1 sm:block">
                <span className="block truncate text-[10px] font-black leading-tight text-white">Central Inn</span>
                <span className="block truncate text-[8px] text-white/40">14 rooms</span>
              </span>
              <ChevronsUpDown className="hidden h-2.5 w-2.5 shrink-0 text-white/30 sm:block" />
            </div>

            <nav className="flex flex-col gap-0.5">
              {NAV.map((item) => {
                const active = item.label === "Reservations";
                return (
                  <span
                    key={item.label}
                    className={`relative flex items-center gap-2 rounded-lg px-1.5 py-[7px] text-[9.5px] font-bold transition-colors sm:px-2 ${
                      active ? "bg-white/[.09] text-white" : "text-white/45"
                    }`}
                  >
                    {active && <span className="absolute left-0 top-1/2 h-3.5 w-[2px] -translate-y-1/2 rounded-full bg-coral" />}
                    <item.icon className={`h-3.5 w-3.5 shrink-0 ${active ? "text-coral" : ""}`} />
                    <span className="hidden truncate sm:block">{item.label}</span>
                    {item.badge && (
                      <span className="ml-auto hidden rounded-full bg-white/10 px-1.5 py-px text-[7.5px] font-black text-white/70 sm:block">
                        {item.badge}
                      </span>
                    )}
                  </span>
                );
              })}
            </nav>

            {/* tonight-at-a-glance — keeps the rail from dead-ending in empty space */}
            <div className="mt-3 hidden rounded-lg border border-white/[.07] bg-white/[.03] p-2 sm:block">
              <p className="text-[7.5px] font-black uppercase tracking-[.14em] text-white/30">Tonight</p>
              <div className="mt-1.5 flex flex-col gap-1">
                {[["Arrivals", `${arrivals}`], ["Departures", "3"], ["To clean", "2"]].map(([k, v]) => (
                  <span key={k} className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-[8px] text-white/45">{k}</span>
                    <span className="shrink-0 text-[9px] font-black text-white/85">{v}</span>
                  </span>
                ))}
              </div>
            </div>

            {/* Always rendered so the icon-only rail on phones still terminates
                in something, rather than trailing off into empty black. */}
            <div className="mt-auto flex items-center justify-center gap-2 rounded-lg px-1 py-1.5 sm:justify-start sm:bg-white/[.04] sm:px-2">
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-gradient-to-br from-coral to-coral-deep text-[7.5px] font-black text-white">FR</span>
              <span className="hidden min-w-0 flex-1 sm:block">
                <span className="block truncate text-[8.5px] font-bold leading-tight text-white/85">Faisal R.</span>
                <span className="block truncate text-[7.5px] text-white/35">Front desk</span>
              </span>
            </div>
          </aside>

          {/* ── main ───────────────────────────────────────────────────────── */}
          <div className="min-w-0 bg-[#FCFBF8] p-3 sm:p-4">
            {/* title row */}
            <div className="mb-3 flex items-end justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[8px] font-black uppercase tracking-[.16em] text-coral-dark">Wednesday · 7 July</p>
                <h3 className="truncate font-display text-[15px] font-medium leading-tight text-ink sm:text-[17px]">Front desk</h3>
              </div>
              <span className="hidden shrink-0 items-center gap-1.5 rounded-full bg-ink px-2.5 py-1 text-[8.5px] font-black text-white sm:inline-flex">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                </span>
                Live
              </span>
            </div>

            {/* KPI strip */}
            <div className="mb-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
              {[
                { label: "Occupancy", value: `${occupancy}%`, delta: "+8", tone: "#0A8272", spark: [58, 62, 60, 68, 72, 75, occupancy], icon: BedDouble },
                { label: "Arrivals",  value: `${arrivals}`,   delta: "+1", tone: "#2563EB", spark: [2, 3, 3, 4, 3, 4, arrivals],      icon: CalendarCheck2 },
                { label: "In house",  value: "18",            delta: "+3", tone: "#9333EA", spark: [12, 14, 13, 16, 17, 17, 18],      icon: Users },
                { label: "Revenue",   value: `${revenue}K`,   delta: "+11", tone: "#E0532B", spark: [240, 268, 255, 300, 322, 364, revenue], icon: Wallet },
              ].map((kpi) => (
                <div key={kpi.label} className="min-w-0 rounded-xl border border-line-soft bg-white p-2.5 shadow-[0_1px_2px_rgba(33,30,26,.04)]">
                  <div className="flex items-center gap-1.5">
                    <kpi.icon className="h-3 w-3 shrink-0 text-ink-faint" />
                    <span className="truncate text-[8px] font-black uppercase tracking-[.12em] text-ink-mute">{kpi.label}</span>
                  </div>
                  <div className="mt-1 flex items-end justify-between gap-1">
                    <div className="shrink-0">
                      <motion.p
                        key={kpi.value}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.26, ease: EASE }}
                        className="whitespace-nowrap text-[16px] font-black leading-none text-ink"
                      >
                        {kpi.value}
                      </motion.p>
                      <span className="mt-1 inline-flex items-center gap-0.5 whitespace-nowrap text-[8px] font-bold" style={{ color: kpi.tone }}>
                        <ArrowUpRight className="h-2.5 w-2.5" />{kpi.delta}%
                      </span>
                    </div>
                    <span className="hidden min-w-0 shrink lg:block"><Spark points={kpi.spark} tone={kpi.tone} /></span>
                  </div>
                </div>
              ))}
            </div>

            {/* Table + activity rail. Height is locked: an arriving row would
                otherwise grow the window ~42px and shove the whole hero, twice
                a loop. The list scrolls under a stable frame instead. */}
            <div className="grid h-[193px] gap-2 lg:grid-cols-[1fr_136px]">
              <div className="min-w-0 overflow-hidden rounded-xl border border-line-soft bg-white">
                <div className="flex items-center justify-between border-b border-line-soft px-2.5 py-1.5">
                  <span className="text-[8.5px] font-black uppercase tracking-[.12em] text-ink-mute">Arrivals today</span>
                  <span className="text-[8.5px] font-bold text-coral-dark">View all</span>
                </div>

                <div className="divide-y divide-line-soft">
                  <AnimatePresence initial={false}>
                    {rows.map((row) => (
                      <motion.div
                        key={row.id}
                        layout
                        initial={row.status === "new" ? { opacity: 0, height: 0, backgroundColor: "#FDECE2" } : false}
                        animate={{ opacity: 1, height: "auto", backgroundColor: "#FFFFFF" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.36, ease: EASE, backgroundColor: { duration: 1, delay: 0.2 } }}
                        className="flex items-center gap-2 px-2.5 py-[7px]"
                      >
                        <span
                          className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[7.5px] font-black text-white"
                          style={{ background: row.tint }}
                        >
                          {row.initials}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5">
                            <span className="truncate text-[10px] font-black leading-tight text-ink">{row.name}</span>
                            <span className="hidden shrink-0 text-[8px] font-semibold text-ink-faint sm:inline">{row.ref}</span>
                          </span>
                          <span className="mt-px flex items-center gap-1.5">
                            <span className="text-[8.5px] text-ink-mute">Room {row.room}</span>
                            <span className="hidden text-[8.5px] text-ink-faint sm:inline">· {row.nights}</span>
                            <span className={`hidden rounded px-1 py-px text-[7.5px] font-bold sm:inline ${SOURCE_STYLE[row.source]}`}>
                              {row.source}
                            </span>
                          </span>
                        </span>
                        <span className="shrink-0">
                          {row.id === "r1" && row.status === "due" ? (
                            <motion.span
                              ref={checkInRef}
                              animate={{ scale: pressed ? 0.93 : 1 }}
                              transition={{ duration: 0.09 }}
                              className="inline-flex items-center rounded-full bg-coral px-2 py-[3px] text-[8.5px] font-black text-white shadow-[0_2px_6px_rgba(193,67,35,.28)]"
                            >
                              Check in
                            </motion.span>
                          ) : (
                            <StatusPill status={row.status} />
                          )}
                        </span>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>

              {/* live activity rail — only where there is width for it */}
              <div className="relative hidden min-w-0 overflow-hidden rounded-xl border border-line-soft bg-white p-2.5 lg:block">
                <p className="mb-1.5 text-[8px] font-black uppercase tracking-[.12em] text-ink-mute">Activity</p>
                <div className="flex flex-col gap-1.5">
                  <AnimatePresence initial={false}>
                    {feed.map((entry) => (
                      <motion.p
                        key={entry}
                        layout
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3, ease: EASE }}
                        className="flex gap-1.5 text-[8px] leading-snug text-ink-mute"
                      >
                        <span className="mt-[3px] h-1 w-1 shrink-0 rounded-full bg-coral" />
                        <span className="min-w-0">{entry}</span>
                      </motion.p>
                    ))}
                  </AnimatePresence>
                </div>
                {/* softens the clip so the overflow reads as "more below" */}
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-white to-transparent" />
              </div>
            </div>

            {/* Status bar. Reserved height, so the alert can never cover a row —
                it morphs in place instead of floating over the table. */}
            <div className="relative mt-2 h-[26px] overflow-hidden rounded-lg">
              <AnimatePresence initial={false}>
                {toast ? (
                  <motion.div
                    key="alert"
                    initial={{ y: 26, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -26, opacity: 0 }}
                    transition={{ duration: 0.3, ease: EASE }}
                    className="absolute inset-0 flex items-center gap-2 rounded-lg bg-ink px-2.5"
                  >
                    <span className="grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full bg-coral">
                      <Sparkles className="h-2 w-2 text-white" />
                    </span>
                    <span className="truncate text-[8.5px] font-black text-white">Direct booking · no commission</span>
                    <span className="ml-auto hidden shrink-0 text-[8px] text-white/50 sm:block">Ayesha Malik · Room 302</span>
                  </motion.div>
                ) : (
                  <motion.div
                    key="idle"
                    initial={{ y: 26, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -26, opacity: 0 }}
                    transition={{ duration: 0.3, ease: EASE }}
                    className="absolute inset-0 flex items-center gap-2 rounded-lg border border-line-soft bg-white px-2.5"
                  >
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                    <span className="truncate text-[8.5px] font-semibold text-ink-mute">All channels synced</span>
                    <span className="ml-auto hidden shrink-0 text-[8px] text-ink-faint sm:block">Updated just now</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      {/* click ripple, keyed so each press replays the ring */}
      {ripple && (
        <motion.span
          key={ripple.k}
          initial={{ opacity: 0.5, scale: 0.2 }}
          animate={{ opacity: 0, scale: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          style={{ left: ripple.x, top: ripple.y }}
          className="pointer-events-none absolute z-40 h-11 w-11 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-coral"
        />
      )}

      {/* cursor rides above the whole window */}
      <motion.div
        animate={cursor}
        initial={{ opacity: 0 }}
        className="pointer-events-none absolute left-0 top-0 z-50 drop-shadow-[0_4px_8px_rgba(0,0,0,.18)]"
      >
        <MousePointer2 className="h-4 w-4 -rotate-12 fill-white text-ink" />
      </motion.div>
    </div>
  );
}
