/**
 * Innflo — animated "product cockpit" hero visual (v2).
 * Calmer than v1: no camera zoom, one focal card per scene, larger type.
 * Single file, no required props, no network requests, no external assets.
 * React 18 + TypeScript + Tailwind + framer-motion.
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "framer-motion";

/* ------------------------------------------------------------------ clock */

const DESIGN_W = 740;
const DESIGN_H = 520;
const SCENE_MS = 3800;
const SCENE_COUNT = 5;

type Phase = "travel" | "hover" | "press" | "react" | "hold";

const PHASE_ENDS: Array<[Phase, number]> = [
  ["travel", 1000],
  ["hover", 1400],
  ["press", 1560],
  ["react", 2300],
  ["hold", SCENE_MS],
];

function phaseAt(ms: number): Phase {
  for (let i = 0; i < PHASE_ENDS.length; i++) if (ms < PHASE_ENDS[i][1]) return PHASE_ENDS[i][0];
  return "hold";
}

const EASE_OUT = [0.16, 1, 0.3, 1] as const;
const SPRING = { type: "spring", stiffness: 90, damping: 18, mass: 0.9 } as const;

type SceneDef = { caption: string; nav: number };

const SCENES: SceneDef[] = [
  { caption: "A guest books directly on your own site.", nav: 1 },
  { caption: "The reservation reaches the front desk instantly.", nav: 1 },
  { caption: "Checkout settles the folio and closes the stay.", nav: 4 },
  { caption: "Housekeeping picks the room up automatically.", nav: 2 },
  { caption: "Cleaning is signed off — the room is sellable again.", nav: 2 },
];

/* ------------------------------------------------------------------ icons */

type IconProps = { className?: string };
const S = (p: React.SVGProps<SVGSVGElement>) => ({
  viewBox: "0 0 16 16",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  ...p,
});

const IcGrid = ({ className }: IconProps) => (
  <svg {...S({ className })}>
    <rect x="2" y="2" width="5" height="5" rx="1.2" />
    <rect x="9" y="2" width="5" height="5" rx="1.2" />
    <rect x="2" y="9" width="5" height="5" rx="1.2" />
    <rect x="9" y="9" width="5" height="5" rx="1.2" />
  </svg>
);
const IcCalendar = ({ className }: IconProps) => (
  <svg {...S({ className })}>
    <rect x="2" y="3.5" width="12" height="10.5" rx="1.6" />
    <path d="M2 6.6h12M5.4 2v2.6M10.6 2v2.6" />
  </svg>
);
const IcBed = ({ className }: IconProps) => (
  <svg {...S({ className })}>
    <path d="M2 12.5V4M2 8h12v4.5M14 12.5V8" />
    <path d="M4.6 6.2h2.2M9.4 6.2h2" />
  </svg>
);
const IcUsers = ({ className }: IconProps) => (
  <svg {...S({ className })}>
    <circle cx="6" cy="5.6" r="2.4" />
    <path d="M2 13.4c.6-2.3 2.2-3.4 4-3.4s3.4 1.1 4 3.4" />
    <path d="M10.8 4.1a2.3 2.3 0 010 4.3M11.6 13.4c-.2-1.2-.5-2.1-1-2.8" />
  </svg>
);
const IcReceipt = ({ className }: IconProps) => (
  <svg {...S({ className })}>
    <path d="M3.4 2h9.2v12l-1.8-1.1-1.8 1.1-1.8-1.1-1.8 1.1L3.4 14V2z" />
    <path d="M6 5.6h4M6 8.4h4" />
  </svg>
);
const IcCheck = ({ className }: IconProps) => (
  <svg {...S({ className, strokeWidth: 2.2 })}>
    <path d="M3.2 8.4l3.2 3.2 6.4-7" />
  </svg>
);
const IcArrow = ({ className }: IconProps) => (
  <svg {...S({ className })}>
    <path d="M3 8h10M9 4l4 4-4 4" />
  </svg>
);

/* ------------------------------------------------------------------ atoms */

function Pill({
  tone = "mute",
  children,
}: {
  tone?: "mute" | "coral" | "emerald" | "amber" | "ink";
  children: React.ReactNode;
}) {
  const tones: Record<string, string> = {
    mute: "bg-[#F1ECE4] text-[#938C81]",
    coral: "bg-[#FBEAE1] text-[#C2431F]",
    emerald: "bg-emerald-50 text-emerald-700",
    amber: "bg-[#FDF3E2] text-[#B0700F]",
    ink: "bg-[#211E1A] text-[#F5EBE4]",
  };
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 py-[3px] text-[7.5px] font-black uppercase tracking-[0.1em] ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

const pkr = (n: number) => Math.round(n).toLocaleString("en-US");

function AnimatedNumber({
  value,
  format,
  duration = 0.9,
}: {
  value: number;
  format?: (n: number) => string;
  duration?: number;
}) {
  const fmt = format ?? ((n: number) => String(Math.round(n)));
  const mv = useMotionValue(value);
  const [txt, setTxt] = useState(() => fmt(value));
  useEffect(() => {
    const controls = animate(mv, value, {
      duration,
      ease: EASE_OUT,
      onUpdate: (v) => setTxt(fmt(v)),
    });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return <>{txt}</>;
}

function Avatar({ initials, tone = "ink" }: { initials: string; tone?: "ink" | "coral" }) {
  return (
    <span
      className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full text-[8px] font-black ${
        tone === "coral" ? "bg-[#FBEAE1] text-[#C2431F]" : "bg-[#F1ECE4] text-[#4A453E]"
      }`}
    >
      {initials}
    </span>
  );
}

function Card({
  focused,
  children,
}: {
  focused: boolean;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      animate={{
        boxShadow: focused
          ? "0 14px 34px rgba(49,35,26,0.10)"
          : "0 4px 14px rgba(49,35,26,0.035)",
      }}
      transition={{ duration: 0.5, ease: EASE_OUT }}
      className="flex h-full flex-col overflow-hidden rounded-2xl border border-[#F1ECE4] bg-white"
    >
      {children}
    </motion.div>
  );
}

function PanelHead({
  title,
  meta,
  right,
}: {
  title: string;
  meta?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-[#F1ECE4] px-3.5 py-2.5">
      <div className="flex min-w-0 items-baseline gap-2">
        <h3 className="truncate text-[11px] font-black leading-none text-[#211E1A]">{title}</h3>
        {meta && <span className="truncate text-[8px] font-semibold text-[#B8B1A6]">{meta}</span>}
      </div>
      <div className="shrink-0 whitespace-nowrap">{right}</div>
    </div>
  );
}

/* -------------------------------------------------------- scene 1: booking */

type SceneProps = {
  hovered: boolean;
  pressed: boolean;
  reacted: boolean;
  focused: boolean;
  setTarget: (el: HTMLElement | null) => void;
};

function SceneBooking({ hovered, pressed, reacted, focused, setTarget }: SceneProps) {
  return (
    <Card focused={focused}>
      <PanelHead title="Booking engine" meta="your own site" right={<Pill tone="coral">direct</Pill>} />
      <div className="flex min-h-0 flex-1 flex-col gap-3 p-3.5">
        <div className="overflow-hidden rounded-xl border border-[#EAE4DB]">
          <div className="flex h-[24px] items-center gap-2 border-b border-[#F1ECE4] bg-[#FBF8F4] px-2.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[#EAE4DB]" />
            <span className="truncate text-[8px] font-bold text-[#B8B1A6]">hunzaviewlodge.pk</span>
          </div>
          <div className="relative h-[104px] overflow-hidden">
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(150deg,#6E5B4B 0%,#A07C5E 42%,#E0A268 74%,#F0D6B4 100%)",
              }}
            />
            <div
              className="absolute inset-x-0 bottom-0 h-16"
              style={{ background: "linear-gradient(to top,rgba(33,30,26,0.7),rgba(33,30,26,0))" }}
            />
            <div className="absolute inset-x-0 bottom-0 p-3">
              <p
                className="truncate text-[16px] leading-none text-white"
                style={{ fontFamily: "Georgia, serif" }}
              >
                Hunza View Lodge
              </p>
              <p className="mt-1.5 text-[8.5px] font-semibold text-white/75">Karimabad · 14 rooms</p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-[11px] font-bold leading-none text-[#211E1A]">
              Deluxe Valley View
            </p>
            <p className="mt-1.5 text-[8.5px] font-semibold text-[#938C81]">
              12–14 Aug · 2 nights · 2 guests
            </p>
          </div>
          <p className="shrink-0 text-[9px] font-bold text-[#938C81]">
            PKR 18,000 <span className="font-semibold text-[#B8B1A6]">/ night</span>
          </p>
        </div>

        <div className="mt-auto flex flex-col gap-3">
          <div className="flex items-baseline justify-between border-t border-dashed border-[#EAE4DB] pt-3">
            <span className="text-[8px] font-black uppercase tracking-[0.14em] text-[#938C81]">
              Total
            </span>
            <span className="text-[20px] font-black leading-none text-[#211E1A]">
              <span className="mr-1 text-[10px] font-bold text-[#938C81]">PKR</span>40,400
            </span>
          </div>

          <motion.button
            ref={setTarget as unknown as React.Ref<HTMLButtonElement>}
            type="button"
            animate={{
              scale: pressed ? 0.97 : 1,
              backgroundColor: reacted ? "#0F7A55" : hovered ? "#C2431F" : "#E0532B",
            }}
            transition={{ duration: 0.22, ease: EASE_OUT }}
            className="flex h-[36px] w-full items-center justify-center gap-2 rounded-full text-[10.5px] font-black text-white shadow-[0_6px_16px_rgba(224,83,43,0.26)]"
          >
            {reacted ? (
              <>
                <IcCheck className="h-3 w-3" />
                Booking confirmed
              </>
            ) : (
              <>
                Confirm booking
                <IcArrow className="h-3 w-3" />
              </>
            )}
          </motion.button>
        </div>
      </div>
    </Card>
  );
}

/* ----------------------------------------------------- scene 2: front desk */

const ARRIVALS = [
  { name: "Ayesha Malik", initials: "AM", room: "302 · Suite", status: "due" },
  { name: "Imran Shah", initials: "IS", room: "108 · Standard", status: "due" },
  { name: "Nadia Iqbal", initials: "NI", room: "206 · Twin", status: "due" },
];

function SceneFrontDesk({ hovered, pressed, reacted, focused, setTarget }: SceneProps) {
  return (
    <Card focused={focused}>
      <PanelHead
        title="Front desk"
        meta="arrivals today"
        right={<span className="text-[8px] font-black text-[#938C81]">4 expected</span>}
      />
      <div className="flex min-h-0 flex-1 flex-col gap-2 p-3">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...SPRING, delay: 0.15 }}
          className="relative flex items-center gap-2.5 overflow-hidden rounded-xl border border-[#F5C9B4] bg-[#FCF3EE] px-3 py-3"
        >
          <span className="absolute left-0 top-0 h-full w-[2px] bg-[#E0532B]" />
          <Avatar initials="SA" tone="coral" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate text-[11px] font-black leading-none text-[#211E1A]">
                Sara Ahmed
              </p>
              <Pill tone="coral">new</Pill>
            </div>
            <p className="mt-1.5 truncate text-[8.5px] font-semibold text-[#938C81]">
              Room 204 · 2 nights · PKR 40,400
            </p>
          </div>
          {reacted ? (
            <motion.span initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }}>
              <Pill tone="emerald">
                <IcCheck className="h-2 w-2" />
                in house
              </Pill>
            </motion.span>
          ) : (
            <motion.button
              ref={setTarget as unknown as React.Ref<HTMLButtonElement>}
              type="button"
              animate={{
                scale: pressed ? 0.97 : 1,
                backgroundColor: hovered ? "#C2431F" : "#E0532B",
              }}
              transition={{ duration: 0.2, ease: EASE_OUT }}
              className="shrink-0 rounded-full px-3 py-[7px] text-[9px] font-black text-white shadow-[0_4px_10px_rgba(224,83,43,0.24)]"
            >
              Check in
            </motion.button>
          )}
        </motion.div>

        {ARRIVALS.map((r, i) => (
          <motion.div
            key={r.name}
            animate={{ backgroundColor: hovered && i === 0 ? "#FAF8F4" : "#FFFFFF" }}
            transition={{ duration: 0.35 }}
            className="flex items-center gap-2.5 rounded-xl border border-[#F1ECE4] px-3 py-3"
          >
            <Avatar initials={r.initials} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[10.5px] font-bold leading-none text-[#211E1A]">
                {r.name}
              </p>
              <p className="mt-1.5 truncate text-[8.5px] font-semibold text-[#938C81]">{r.room}</p>
            </div>
            <Pill>due 14:00</Pill>
          </motion.div>
        ))}

        <div className="mt-auto flex items-center justify-between rounded-xl bg-[#FAF8F4] px-3 py-2.5">
          <span className="text-[8.5px] font-semibold text-[#938C81]">Occupancy tonight</span>
          <span className="text-[11px] font-black text-[#211E1A]">
            <AnimatedNumber value={reacted ? 86 : 84} />% · 12 of 14
          </span>
        </div>
      </div>
    </Card>
  );
}

/* -------------------------------------------------------- scene 3: folio */

const FOLIO: Array<[string, string]> = [
  ["Room · 2 nights", "36,000"],
  ["Restaurant", "6,400"],
  ["Laundry", "1,200"],
  ["Taxes & service", "4,400"],
];

function SceneCheckout({ hovered, pressed, reacted, focused, setTarget }: SceneProps) {
  return (
    <Card focused={focused}>
      <PanelHead
        title="Folio · Sara Ahmed"
        meta="Room 204"
        right={reacted ? <Pill tone="emerald">paid</Pill> : <Pill tone="amber">open</Pill>}
      />
      <div className="flex min-h-0 flex-1 flex-col gap-2.5 p-3.5">
        {FOLIO.map(([label, amt]) => (
          <div
            key={label}
            className="flex items-center justify-between border-b border-[#F1ECE4] pb-2.5 last:border-b-0"
          >
            <span className="text-[10px] font-semibold text-[#4A453E]">{label}</span>
            <span className="text-[10px] font-bold text-[#211E1A]">{amt}</span>
          </div>
        ))}

        <div className="mt-auto flex flex-col gap-3">
          <div className="flex items-end justify-between rounded-xl bg-[#211E1A] px-3.5 py-3">
            <div>
              <p className="text-[7.5px] font-black uppercase tracking-[0.14em] text-[#B8B1A6]">
                {reacted ? "Settled · card" : "Balance due"}
              </p>
              <p className="mt-1.5 text-[8px] font-semibold text-[#938C81]">
                {reacted ? "Receipt sent to guest" : "4 charges · 2 nights"}
              </p>
            </div>
            <p className="text-[22px] font-black leading-none text-[#F5EBE4]">
              <span className="mr-1 text-[10px] font-bold text-[#B8B1A6]">PKR</span>
              {reacted ? "0" : <AnimatedNumber value={48000} format={pkr} />}
            </p>
          </div>

          <motion.button
            ref={setTarget as unknown as React.Ref<HTMLButtonElement>}
            type="button"
            animate={{
              scale: pressed ? 0.97 : 1,
              backgroundColor: reacted ? "#0F7A55" : hovered ? "#C2431F" : "#E0532B",
            }}
            transition={{ duration: 0.22, ease: EASE_OUT }}
            className="flex h-[34px] w-full items-center justify-center gap-2 rounded-full text-[10.5px] font-black text-white shadow-[0_6px_16px_rgba(224,83,43,0.26)]"
          >
            {reacted ? (
              <>
                <IcCheck className="h-3 w-3" />
                Stay closed · 11:02
              </>
            ) : (
              <>Settle PKR 48,000</>
            )}
          </motion.button>
        </div>
      </div>
    </Card>
  );
}

/* ------------------------------------------- scenes 4 & 5: housekeeping */

const ROOMS = [
  { n: "101", s: "in" },
  { n: "102", s: "ready" },
  { n: "204", s: "dyn" },
  { n: "108", s: "in" },
  { n: "206", s: "clean" },
  { n: "302", s: "in" },
  { n: "305", s: "ready" },
  { n: "306", s: "ready" },
  { n: "401", s: "ready" },
];

function roomStyle(s: string) {
  switch (s) {
    case "in":
      return { box: "border-[#EAE4DB] bg-[#FAF8F4]", dot: "bg-[#211E1A]", label: "In house" };
    case "ready":
      return { box: "border-emerald-100 bg-emerald-50/60", dot: "bg-emerald-600", label: "Ready" };
    case "clean":
      return { box: "border-[#F6E3C4] bg-[#FDF9F1]", dot: "bg-[#D79A2B]", label: "Cleaning" };
    default:
      return { box: "border-[#F5C9B4] bg-[#FCF3EE]", dot: "bg-[#E0532B]", label: "Needs clean" };
  }
}

function SceneHousekeeping({
  hovered,
  pressed,
  reacted,
  focused,
  setTarget,
  stage,
}: SceneProps & { stage: 3 | 4 }) {
  const done = stage === 4 && reacted;
  const dyn = done ? "ready" : stage === 4 || reacted ? "clean" : "dirty";
  const progress = done ? 1 : stage === 4 ? 1 : reacted ? 0.35 : 0;

  return (
    <Card focused={focused}>
      <PanelHead
        title="Housekeeping"
        meta="today"
        right={
          <span className="text-[8px] font-black text-[#938C81]">{done ? "0 open" : "1 open"}</span>
        }
      />
      <div className="flex min-h-0 flex-1 flex-col gap-3 p-3.5">
        <div className="grid grid-cols-3 gap-2">
          {ROOMS.map((r) => {
            const s = r.s === "dyn" ? dyn : r.s;
            const st = roomStyle(s);
            return (
              <div key={r.n} className={`rounded-xl border px-2.5 py-2 ${st.box}`}>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black leading-none text-[#211E1A]">{r.n}</span>
                  <motion.span
                    key={s}
                    initial={r.s === "dyn" ? { scale: 0.4, opacity: 0 } : false}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={SPRING}
                    className={`h-1.5 w-1.5 rounded-full ${st.dot}`}
                  />
                </div>
                <p className="mt-1.5 truncate text-[7px] font-black uppercase tracking-[0.1em] text-[#938C81]">
                  {st.label}
                </p>
              </div>
            );
          })}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...SPRING, delay: 0.1 }}
          className="mt-auto rounded-xl border border-[#F1ECE4] bg-[#FAF8F4] p-3"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10.5px] font-black leading-none text-[#211E1A]">
              Departure clean · 204
            </p>
            {done ? (
              <Pill tone="emerald">done</Pill>
            ) : stage === 4 || reacted ? (
              <Pill tone="amber">in progress</Pill>
            ) : (
              <Pill tone="coral">new task</Pill>
            )}
          </div>
          <p className="mt-1.5 text-[8.5px] font-semibold text-[#938C81]">
            Created at checkout · est. 35 min
          </p>

          <div className="mt-3 h-[4px] w-full overflow-hidden rounded-full bg-[#EAE4DB]">
            <motion.div
              className={`h-full w-full origin-left rounded-full ${
                done ? "bg-emerald-600" : "bg-[#E0532B]"
              }`}
              animate={{ scaleX: progress }}
              transition={{ duration: 0.9, ease: EASE_OUT }}
            />
          </div>

          <div className="mt-3 flex items-center justify-between gap-2">
            {stage === 3 && !reacted ? (
              <span className="text-[9px] font-semibold text-[#938C81]">Unassigned</span>
            ) : (
              <motion.div
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, ease: EASE_OUT }}
                className="flex items-center gap-2"
              >
                <Avatar initials="NB" />
                <span className="text-[9px] font-bold text-[#4A453E]">Nasreen B.</span>
              </motion.div>
            )}

            <motion.button
              ref={setTarget as unknown as React.Ref<HTMLButtonElement>}
              type="button"
              animate={{
                scale: pressed ? 0.97 : 1,
                backgroundColor: (stage === 3 && reacted) || done ? "#0F7A55" : hovered ? "#C2431F" : "#E0532B",
              }}
              transition={{ duration: 0.22, ease: EASE_OUT }}
              className="flex h-[28px] shrink-0 items-center gap-1.5 rounded-full px-3 text-[9px] font-black text-white shadow-[0_4px_12px_rgba(224,83,43,0.24)]"
            >
              {stage === 3 ? (
                reacted ? (
                  <>
                    <IcCheck className="h-2.5 w-2.5" />
                    Assigned
                  </>
                ) : (
                  <>Assign</>
                )
              ) : done ? (
                <>
                  <IcCheck className="h-2.5 w-2.5" />
                  Back on sale
                </>
              ) : (
                <>Mark clean</>
              )}
            </motion.button>
          </div>
        </motion.div>
      </div>
    </Card>
  );
}

/* -------------------------------------------------------------- side rail */

type Feed = { title: string; live?: boolean };

const AGES = ["just now", "12 min ago", "1 hr ago"];

const BASE_FEED: Feed[] = [
  { title: "3 rooms inspected" },
  { title: "Night audit closed" },
];

const SCENE_FEED: Feed[] = [
  { title: "Direct booking · Sara Ahmed" },
  { title: "Checked in · Room 204" },
  { title: "Payment settled · PKR 48,000" },
  { title: "Cleaning task · Room 204" },
  { title: "Room 204 back on sale" },
];

function SideRail({ stage }: { stage: number }) {
  const items = useMemo(
    () =>
      [
        ...SCENE_FEED.slice(0, stage)
          .map((f, i) => ({ ...f, live: i === stage - 1 }))
          .reverse(),
        ...BASE_FEED,
      ].slice(0, 3),
    [stage]
  );

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="rounded-2xl border border-[#F1ECE4] bg-white p-3.5 shadow-[0_4px_14px_rgba(49,35,26,0.035)]">
        <p className="text-[7.5px] font-black uppercase tracking-[0.14em] text-[#938C81]">
          Revenue today
        </p>
        <p className="mt-2 text-[22px] font-black leading-none text-[#211E1A]">
          <span className="mr-1 text-[10px] font-bold text-[#938C81]">PKR</span>
          <AnimatedNumber value={stage >= 3 ? 412600 : 364600} format={pkr} />
        </p>
        <p className="mt-2 text-[8px] font-semibold text-[#B8B1A6]">
          {stage >= 3 ? "6 folios posted" : "5 folios posted"}
        </p>
      </div>

      <div className="flex min-h-0 flex-1 flex-col rounded-2xl border border-[#F1ECE4] bg-white p-3.5 shadow-[0_4px_14px_rgba(49,35,26,0.035)]">
        <p className="text-[7.5px] font-black uppercase tracking-[0.14em] text-[#938C81]">
          Activity
        </p>
        <div className="mt-2.5 flex flex-col gap-2.5">
          <AnimatePresence initial={false}>
            {items.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: f.live ? 1 : 0.62, y: 0 }}
                exit={{ opacity: 0 }}
                transition={SPRING}
                className="flex gap-2"
              >
                <span
                  className={`mt-[4px] h-1.5 w-1.5 shrink-0 rounded-full ${
                    f.live ? "bg-[#E0532B]" : "bg-[#D8D1C7]"
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[9px] font-bold leading-snug text-[#211E1A]">{f.title}</p>
                  <p className="mt-1 text-[7.5px] font-semibold text-[#B8B1A6]">{AGES[i]}</p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        <div className="mt-auto rounded-xl bg-[#211E1A] px-3 py-2.5">
          <p
            className="text-[11px] leading-snug text-[#F5EBE4]"
            style={{ fontFamily: "Georgia, serif" }}
          >
            One event, every team updated.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- sidebar */

const NAV = [
  { label: "Overview", Icon: IcGrid },
  { label: "Reservations", Icon: IcCalendar },
  { label: "Rooms", Icon: IcBed },
  { label: "Guests", Icon: IcUsers },
  { label: "Billing", Icon: IcReceipt },
];

function Sidebar({ active }: { active: number }) {
  return (
    <div className="relative flex w-[146px] shrink-0 flex-col overflow-hidden bg-[#211E1A] px-3 py-4">
      <div className="pointer-events-none absolute -left-8 -top-10 h-28 w-28 rounded-full bg-[#E0532B]/20 blur-2xl" />
      <div className="relative flex items-center gap-2 px-1.5 pb-4">
        <span className="flex h-[20px] w-[20px] items-center justify-center rounded-md bg-[#E0532B] text-[10px] font-black text-white">
          i
        </span>
        <span
          className="text-[14px] leading-none text-[#F5EBE4]"
          style={{ fontFamily: "Georgia, serif" }}
        >
          innflo
        </span>
      </div>

      <div className="relative">
        <motion.div
          className="absolute left-0 h-[30px] w-full rounded-lg bg-[#E0532B]/15"
          animate={{ y: active * 34 }}
          transition={SPRING}
        />
        <div className="relative flex flex-col gap-1">
          {NAV.map((n, i) => (
            <div
              key={n.label}
              className="flex h-[30px] items-center gap-2.5 rounded-lg px-2"
              style={{ color: i === active ? "#FF8156" : "#8C8378" }}
            >
              <n.Icon className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate text-[9.5px] font-bold">{n.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="relative mt-auto flex items-center gap-2 rounded-xl bg-white/[0.05] px-2.5 py-2">
        <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-[#E0532B] text-[7.5px] font-black text-white">
          FR
        </span>
        <div className="min-w-0">
          <p className="truncate text-[9px] font-bold leading-none text-[#F5EBE4]">Faisal R.</p>
          <p className="mt-1 truncate text-[7px] font-semibold text-[#8C8378]">Hunza View Lodge</p>
        </div>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- progress */

function Segment({
  i,
  scene,
  progress,
  reduced,
}: {
  i: number;
  scene: number;
  progress: ReturnType<typeof useMotionValue<number>>;
  reduced: boolean;
}) {
  const scaleX = useTransform(progress, (p) =>
    i < scene ? 1 : i === scene ? (reduced ? 1 : p) : 0
  );
  return (
    <span className="block h-[3px] w-[20px] overflow-hidden rounded-full bg-[#EAE4DB]">
      <motion.span
        className="block h-full w-full origin-left rounded-full bg-[#E0532B]"
        style={{ scaleX }}
      />
    </span>
  );
}

/* ---------------------------------------------------------------- the hero */

export default function ProductCockpit({ className = "" }: { className?: string }) {
  const reduced = !!useReducedMotion();

  const [scale, setScale] = useState(1);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const layerRef = useRef<HTMLDivElement | null>(null);

  const [scene, setScene] = useState(0);
  const [phase, setPhase] = useState<Phase>("travel");
  const [paused, setPaused] = useState(false);
  const [cursor, setCursor] = useState({ x: 360, y: 300 });

  const progress = useMotionValue(0);
  const tRef = useRef(0);
  const sceneRef = useRef(0);
  const phaseRef = useRef<Phase>("travel");
  const pausedRef = useRef(false);
  const targets = useRef<Record<number, HTMLElement | null>>({});

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth;
      if (w > 0) setScale(Math.min(w / DESIGN_W, 1.14));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (reduced) {
      const id = window.setInterval(() => setScene((s) => (s + 1) % SCENE_COUNT), SCENE_MS);
      setPhase("hold");
      return () => window.clearInterval(id);
    }
    let last = performance.now();
    let raf = 0;
    const loop = (now: number) => {
      const dt = Math.min(now - last, 64);
      last = now;
      if (!pausedRef.current) tRef.current += dt;
      if (!Number.isFinite(tRef.current)) tRef.current = 0;
      const t = tRef.current % (SCENE_MS * SCENE_COUNT);
      const s = Math.min(SCENE_COUNT - 1, Math.max(0, Math.floor(t / SCENE_MS) || 0));
      const local = t - s * SCENE_MS;
      progress.set(local / SCENE_MS);
      const p = phaseAt(local);
      if (s !== sceneRef.current) {
        sceneRef.current = s;
        setScene(s);
      }
      if (p !== phaseRef.current) {
        phaseRef.current = p;
        setPhase(p);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced]);

  useEffect(() => {
    if (reduced) return;
    const id = window.setTimeout(() => {
      const el = targets.current[scene];
      const layer = layerRef.current;
      if (!el || !layer) return;
      const a = el.getBoundingClientRect();
      const b = layer.getBoundingClientRect();
      const s = b.width / DESIGN_W || 1;
      setCursor({
        x: (a.left - b.left) / s + a.width / (2 * s) - 3,
        y: (a.top - b.top) / s + a.height / (2 * s) - 2,
      });
    }, 240);
    return () => window.clearTimeout(id);
  }, [scene, reduced]);

  const def = SCENES[scene] ?? SCENES[0];
  const hovered = phase === "hover" || phase === "press";
  const pressed = phase === "press";
  const reacted = phase === "react" || phase === "hold";
  const focused = !reduced && phase !== "travel";
  const stage = scene + (reacted ? 1 : 0);

  const sceneProps: SceneProps = {
    hovered,
    pressed,
    reacted,
    focused,
    setTarget: (el) => {
      targets.current[scene] = el;
    },
  };

  const panelKey = scene <= 2 ? `s${scene}` : "hk";
  const panel =
    scene === 0 ? (
      <SceneBooking {...sceneProps} />
    ) : scene === 1 ? (
      <SceneFrontDesk {...sceneProps} />
    ) : scene === 2 ? (
      <SceneCheckout {...sceneProps} />
    ) : (
      <SceneHousekeeping {...sceneProps} stage={scene === 3 ? 3 : 4} />
    );

  return (
    <div
      ref={wrapRef}
      className={`relative w-full min-w-0 max-w-full overflow-hidden ${className}`}
      style={{ aspectRatio: `${DESIGN_W} / ${DESIGN_H}` }}
    >
      <div
        className="absolute left-0 top-0 origin-top-left"
        style={{
          width: DESIGN_W,
          height: DESIGN_H,
          transform: `scale(${scale})`,
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        }}
      >
        <div
          ref={layerRef}
          className="relative h-full w-full overflow-hidden rounded-[22px] border border-[#EAE4DB] bg-white shadow-[0_24px_65px_rgba(74,45,31,0.15)]"
        >
          <div className="flex h-11 items-center justify-between border-b border-[#F1ECE4] bg-[#FBF8F4] px-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex shrink-0 gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[#F5A6A0]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#F5D183]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#9EDDC7]" />
              </div>
              <span className="truncate rounded-full bg-white px-2.5 py-[3px] text-[10px] font-bold text-[#938C81] ring-1 ring-[#F1ECE4]">
                app.innflo.co
              </span>
            </div>
            <span className="flex items-center gap-1.5 rounded-full bg-white px-2 py-[3px] text-[8px] font-black uppercase tracking-[0.1em] text-[#938C81] ring-1 ring-[#F1ECE4]">
              <motion.span
                className="h-1.5 w-1.5 rounded-full bg-[#E0532B]"
                animate={reduced ? {} : { opacity: [1, 0.35, 1] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
              />
              live
            </span>
          </div>

          <div className="flex h-[432px]">
            <Sidebar active={def.nav} />

            <div className="relative min-w-0 flex-1 bg-[#F8F4EF] p-4">
              <div className="grid h-full grid-cols-[1fr_186px] gap-3.5">
                <div className="relative min-w-0">
                  <AnimatePresence initial={false}>
                    <motion.div
                      key={panelKey}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.5, ease: EASE_OUT }}
                      className="absolute inset-0"
                    >
                      {panel}
                    </motion.div>
                  </AnimatePresence>
                </div>
                <SideRail stage={stage} />
              </div>
            </div>
          </div>

          <div className="flex h-11 items-center justify-between gap-3 border-t border-[#F1ECE4] bg-[#FBF8F4] px-4">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-[#FBEAE1] text-[8px] font-black text-[#C2431F]">
                {scene + 1}
              </span>
              <AnimatePresence mode="wait">
                <motion.p
                  key={scene}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.3, ease: EASE_OUT }}
                  className="truncate text-[10.5px] font-bold text-[#4A453E]"
                >
                  {def.caption}
                </motion.p>
              </AnimatePresence>
            </div>

            <div className="flex shrink-0 items-center gap-2.5">
              <div className="flex items-center gap-1">
                {[0, 1, 2, 3, 4].map((i) => (
                  <Segment key={i} i={i} scene={scene} progress={progress} reduced={reduced} />
                ))}
              </div>
              <button
                type="button"
                onClick={() => setPaused((p) => !p)}
                aria-label={paused ? "Play" : "Pause"}
                className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-white text-[#4A453E] ring-1 ring-[#EAE4DB] transition-colors hover:text-[#C2431F]"
              >
                {paused ? (
                  <svg width="9" height="9" viewBox="0 0 10 10" fill="currentColor">
                    <path d="M2 1l6 4-6 4V1z" />
                  </svg>
                ) : (
                  <svg width="9" height="9" viewBox="0 0 10 10" fill="currentColor">
                    <rect x="2" y="1.5" width="2" height="7" rx="0.7" />
                    <rect x="6" y="1.5" width="2" height="7" rx="0.7" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {!reduced && (
            <>
              <AnimatePresence>
                {pressed && (
                  <motion.span
                    key={`ripple-${scene}`}
                    className="pointer-events-none absolute z-20 h-6 w-6 rounded-full border-2 border-[#E0532B]"
                    style={{ left: cursor.x - 12, top: cursor.y - 12 }}
                    initial={{ scale: 0.3, opacity: 0.5 }}
                    animate={{ scale: 2.2, opacity: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.55, ease: EASE_OUT }}
                  />
                )}
              </AnimatePresence>
              <motion.div
                className="pointer-events-none absolute left-0 top-0 z-30"
                animate={{ x: cursor.x, y: cursor.y }}
                transition={{ duration: 1, ease: EASE_OUT }}
                style={{ willChange: "transform" }}
              >
                <motion.div
                  animate={{ scale: pressed ? 0.86 : 1 }}
                  transition={{ duration: 0.16, ease: EASE_OUT }}
                >
                  <svg
                    width="17"
                    height="17"
                    viewBox="0 0 20 20"
                    className="drop-shadow-[0_2px_4px_rgba(33,30,26,0.35)]"
                  >
                    <path
                      d="M4 2.5l11.2 6.6-4.9.7-2.4 4.6L4 2.5z"
                      fill="#FFFFFF"
                      stroke="#211E1A"
                      strokeWidth="1.3"
                      strokeLinejoin="round"
                    />
                  </svg>
                </motion.div>
              </motion.div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
