import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useAnimation } from "framer-motion";
import { ArrowRight, Crown, Lock, MousePointer2 } from "lucide-react";

/**
 * Room timeline for /pms — shows how a booking actually gets made in Innflo:
 * click a night, sweep across the room row while the range previews live, click
 * the check-out day, and the new-reservation form opens with room and dates
 * already filled in.
 *
 * The gesture mirrors apps/web TimelineView (click → hover-preview → click),
 * not a press-and-drag, because that is what the product does.
 *
 * No props, no network, no external assets.
 */

const EASE = [0.16, 1, 0.3, 1] as const;
const ROW_H = 44;

const DAYS: Array<[string, string]> = [
  ["Mon", "7"], ["Tue", "8"], ["Wed", "9"], ["Thu", "10"], ["Fri", "11"],
  ["Sat", "12"], ["Sun", "13"], ["Mon", "14"], ["Tue", "15"], ["Wed", "16"],
];

const ROOMS = [
  { label: "101 · Deluxe Double", ready: true },
  { label: "102 · Deluxe Double", ready: true },
  { label: "103–114 · Suite Block", ready: false },
  { label: "201 · Sea View Suite", ready: true },
  { label: "202 · Twin Standard", ready: true },
  { label: "301 · Family Room", ready: false },
];

// Sources you can record against a booking today. Two-way OTA sync is Channel
// Manager roadmap work and is not claimed here.
const SOURCES = ["Walk-in", "Phone", "WhatsApp", "Direct", "Booking.com", "Agoda", "Airbnb"];

type Bar = { row: number; start: number; span: number; label: string; color: string; vip?: boolean };

const BOOKINGS: Bar[] = [
  { row: 0, start: 0, span: 3, label: "Ahmed R.", color: "#059669" },
  { row: 0, start: 5, span: 3, label: "Hamza A.", color: "#2563EB" },
  { row: 0, start: 8, span: 2, label: "Nadia S.", color: "#9333EA", vip: true },
  { row: 1, start: 0, span: 3, label: "Bilal M.", color: "#059669" },
  { row: 1, start: 8, span: 2, label: "Rao F.",   color: "#2563EB" },
  { row: 2, start: 1, span: 5, label: "Group — 12 rooms", color: "#2563EB" },
  { row: 3, start: 2, span: 4, label: "Zara K.",  color: "#9333EA", vip: true },
  { row: 3, start: 7, span: 3, label: "Ali M.",   color: "#059669" },
  { row: 4, start: 0, span: 2, label: "Sana T.",  color: "#2563EB" },
  { row: 4, start: 3, span: 4, label: "Usman K.", color: "#059669" },
  { row: 5, start: 2, span: 3, label: "Kamran A.", color: "#059669" },
  { row: 5, start: 7, span: 3, label: "Hina R.",  color: "#2563EB" },
];

// The nights the cursor books: room 102, Fri 11 → Mon 14. Kept clear of BOOKINGS.
const PICK_ROW = 1;
const PICK_FROM = 4;
const PICK_TO = 6;

const pct = (n: number) => `${(n / DAYS.length) * 100}%`;

type Phase = "idle" | "picking" | "done";

export default function ReservationTimelineMockup() {
  const cursor = useAnimation();
  const [phase, setPhase] = useState<Phase>("idle");
  const [range, setRange] = useState<{ from: number; to: number } | null>(null);
  const alive = useRef(true);
  const shellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    alive.current = true;
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

    /** Cell centre in pixels relative to the shell — percentages would resolve
     *  against the 16px cursor itself, never the grid. */
    function cellPoint(row: number, col: number) {
      const shell = shellRef.current;
      const cell = shell?.querySelector<HTMLElement>(`[data-cell="${row}-${col}"]`);
      if (!shell || !cell) return null;
      const s = shell.getBoundingClientRect();
      const c = cell.getBoundingClientRect();
      return { x: c.left - s.left + c.width / 2, y: c.top - s.top + c.height / 2 };
    }

    function restPoint() {
      const shell = shellRef.current;
      if (!shell) return { x: 0, y: 0 };
      const b = shell.getBoundingClientRect();
      return { x: b.width * 0.86, y: b.height * 0.9 };
    }

    async function loop() {
      while (alive.current) {
        setPhase("idle");
        setRange(null);
        const rest = restPoint();
        cursor.set({ x: rest.x, y: rest.y, opacity: 0, scale: 1 });
        await wait(500); if (!alive.current) return;

        const start = cellPoint(PICK_ROW, PICK_FROM);
        if (!start) return;

        // ── travel to the check-in night ────────────────────────────────────
        await cursor.start({ opacity: 1, transition: { duration: 0.18 } });
        await cursor.start({ x: start.x, y: start.y, transition: { duration: 0.55, ease: EASE } });
        if (!alive.current) return;

        // ── click one: this is the check-in day ─────────────────────────────
        await cursor.start({ scale: 0.78, transition: { duration: 0.08 } });
        setPhase("picking");
        setRange({ from: PICK_FROM, to: PICK_FROM });
        await cursor.start({ scale: 1, transition: { duration: 0.1 } });
        await wait(260); if (!alive.current) return;

        // ── sweep across the row; the range previews under the cursor ───────
        for (let col = PICK_FROM + 1; col <= PICK_TO; col++) {
          const p = cellPoint(PICK_ROW, col);
          if (!p) return;
          await cursor.start({ x: p.x, y: p.y, transition: { duration: 0.26, ease: "easeInOut" } });
          setRange({ from: PICK_FROM, to: col });
          if (!alive.current) return;
        }
        await wait(320); if (!alive.current) return;

        // ── click two: check-out day confirms the range ─────────────────────
        await cursor.start({ scale: 0.78, transition: { duration: 0.08 } });
        await cursor.start({ scale: 1, transition: { duration: 0.1 } });
        setPhase("done");
        await wait(280); if (!alive.current) return;

        void cursor.start({ x: rest.x, y: rest.y, transition: { duration: 0.7, ease: EASE } });
        await wait(1900); if (!alive.current) return;

        await cursor.start({ opacity: 0, transition: { duration: 0.28 } });
        await wait(380);
      }
    }

    void loop();
    return () => { alive.current = false; };
  }, [cursor]);

  const nights = range ? range.to - range.from + 1 : 0;

  return (
    <div ref={shellRef} className="relative mx-auto w-full min-w-0 max-w-[760px]">
      <div className="overflow-hidden rounded-[18px] border border-line bg-white shadow-[0_30px_70px_-22px_rgba(68,43,30,.26),0_10px_26px_-12px_rgba(68,43,30,.12)]">

        {/* toolbar */}
        <div className="flex items-center gap-2 border-b border-line-soft bg-gradient-to-b from-[#FCFAF7] to-[#F6F1EA] px-3 py-2">
          <span className="shrink-0 text-[11px] font-black tracking-tight text-ink">July 2026</span>
          <span className="hidden shrink-0 rounded-full border border-line-soft bg-white px-2 py-0.5 text-[8.5px] font-bold text-ink-mute sm:inline">
            ← Week →
          </span>
          <span className="ml-auto flex shrink-0 items-center gap-1.5 text-[8.5px] font-bold text-ink-mute">
            <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-[#059669]" />In house</span>
            <span className="hidden items-center gap-1 sm:flex"><span className="h-1.5 w-1.5 rounded-full bg-[#2563EB]" />Confirmed</span>
            <span className="hidden items-center gap-1 sm:flex"><span className="h-1.5 w-1.5 rounded-full bg-[#9333EA]" />VIP</span>
          </span>
        </div>

        {/* day header */}
        <div className="flex border-b border-line-soft bg-mist">
          <div className="w-[78px] shrink-0 px-2 py-1.5 text-[7.5px] font-black uppercase tracking-[.12em] text-ink-faint sm:w-[138px] sm:px-3">
            Room · Type
          </div>
          <div className="flex min-w-0 flex-1">
            {DAYS.map(([name, num], i) => (
              <div
                key={num}
                className={`min-w-0 flex-1 border-l border-line-soft/50 py-1.5 text-center leading-tight ${
                  i >= PICK_FROM && i <= PICK_TO && phase !== "idle" ? "bg-coral-soft/60" : ""
                }`}
              >
                <span className="block text-[7px] font-bold text-ink-faint">{name}</span>
                <span className="block text-[9px] font-black text-ink-mute">{num}</span>
              </div>
            ))}
          </div>
        </div>

        {/* room rows */}
        {ROOMS.map((room, rowIdx) => (
          <div key={room.label} className="flex border-b border-line-soft/60 last:border-b-0">
            <div
              className="flex w-[78px] shrink-0 items-center gap-1.5 border-r border-line-soft/60 bg-[#FDFBF8] px-2 sm:w-[138px] sm:px-3"
              style={{ height: ROW_H }}
            >
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${room.ready ? "bg-emerald-500" : "bg-amber-400"}`} />
              <span className="truncate text-[10px] font-bold text-ink">{room.label}</span>
            </div>

            <div className="relative min-w-0 flex-1" style={{ height: ROW_H }}>
              <div className="flex h-full">
                {DAYS.map((_, col) => (
                  <div key={col} data-cell={`${rowIdx}-${col}`} className="min-w-0 flex-1 border-l border-line-soft/40" />
                ))}
              </div>

              {BOOKINGS.filter((b) => b.row === rowIdx).map((b) => (
                <div
                  key={`${b.row}-${b.start}`}
                  className="absolute flex items-center gap-1 overflow-hidden rounded-md px-1.5"
                  style={{
                    left: pct(b.start),
                    width: `calc(${pct(b.span)} - 4px)`,
                    marginLeft: 2,
                    top: 6,
                    height: ROW_H - 12,
                    background: b.color,
                  }}
                >
                  {b.vip && <Crown className="h-2.5 w-2.5 shrink-0 text-amber-300" />}
                  <span className="truncate text-[9.5px] font-bold leading-none text-white">{b.label}</span>
                </div>
              ))}

              {/* the range being picked, then the reservation it becomes */}
              <AnimatePresence>
                {rowIdx === PICK_ROW && range && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{
                      opacity: 1,
                      left: pct(range.from),
                      width: `calc(${pct(nights)} - 4px)`,
                      backgroundColor: phase === "done" ? "#E0532B" : "rgba(224,83,43,0.14)",
                    }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.24, ease: EASE }}
                    className="absolute flex items-center justify-center gap-1 overflow-hidden rounded-md px-1.5"
                    style={{
                      marginLeft: 2,
                      top: 6,
                      height: ROW_H - 12,
                      borderWidth: 1.5,
                      borderStyle: phase === "done" ? "solid" : "dashed",
                      borderColor: "#E0532B",
                    }}
                  >
                    <span className={`truncate text-[8.5px] font-black leading-none ${phase === "done" ? "text-white" : "text-coral-deep"}`}>
                      {phase === "done" ? "New booking" : `${nights} night${nights === 1 ? "" : "s"}`}
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        ))}

        {/* Status strip. Reserved height so it morphs in place rather than
            pushing the grid around. */}
        <motion.div
          animate={{ backgroundColor: phase === "done" ? "#211E1A" : phase === "picking" ? "#FCF3EE" : "#FAF8F4" }}
          transition={{ duration: 0.28, ease: EASE }}
          className="relative h-[30px] overflow-hidden border-t border-line-soft"
        >
          <AnimatePresence initial={false}>
            <motion.div
              key={phase}
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -30, opacity: 0 }}
              transition={{ duration: 0.28, ease: EASE }}
              className="absolute inset-0 flex items-center gap-2 px-3"
            >
              {phase === "idle" && (
                <>
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                  <span className="truncate text-[8.5px] font-semibold text-ink-mute">
                    Click a night on any room to start a booking
                  </span>
                </>
              )}
              {phase === "picking" && (
                <>
                  <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-coral" />
                  <span className="truncate text-[8.5px] font-bold text-coral-deep">
                    Room 102 · click a check-out date
                  </span>
                  <span className="ml-auto hidden shrink-0 text-[8px] font-bold text-coral-dark sm:block">
                    {nights} night{nights === 1 ? "" : "s"}
                  </span>
                </>
              )}
              {phase === "done" && (
                <>
                  <span className="truncate text-[8.5px] font-black text-white">
                    New reservation · 102 · Fri 11 → Mon 14
                  </span>
                  <span className="ml-auto hidden shrink-0 items-center gap-1 rounded-full bg-coral px-2 py-[3px] text-[8px] font-black text-white sm:inline-flex">
                    Continue <ArrowRight className="h-2 w-2" />
                  </span>
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </motion.div>

        <div className="flex flex-wrap items-center gap-1 border-t border-line-soft bg-mist px-3 py-2">
          {SOURCES.map((src) => (
            <span key={src} className="rounded border border-line-soft bg-white px-1.5 py-0.5 text-[7.5px] font-bold text-ink-mute">
              {src}
            </span>
          ))}
          <span className="ml-auto hidden items-center gap-1 text-[7.5px] font-black text-coral-dark sm:flex">
            <Lock className="h-2.5 w-2.5" /> No double-booking
          </span>
        </div>
      </div>

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
