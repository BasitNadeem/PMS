import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Building2, CalendarDays, Check, Lock, Sun, Tag, User } from "lucide-react";

/**
 * Rate plans for /pms — shows the part of pricing nobody else puts on a page:
 * which plan won a given stay, and why the others did not.
 *
 * Every scenario is a plain rate-plan lookup with fixed per-room-type rates,
 * mirroring RatePlanService.suggestRate. Percentage/fixed rate MODIFIERS are
 * deliberately never shown — that path has a known pricing bug and marketing
 * must not depict it (see product-knowledge/MARKETING_FACTS.md).
 *
 * No props, no network, no external assets.
 */

const EASE = [0.16, 1, 0.3, 1] as const;

const TYPE_STYLE: Record<string, string> = {
  STANDARD:    "bg-ink/8 text-ink-soft",
  SEASONAL:    "bg-amber-100 text-amber-800",
  CORPORATE:   "bg-blue-50 text-blue-700",
  PROMOTIONAL: "bg-coral-soft text-coral-deep",
};

const PLANS = [
  { id: "std",   name: "Standard Rate", type: "STANDARD",    cond: "All year · min 1 night",     rate: 12000 },
  { id: "peak",  name: "Summer Peak",   type: "SEASONAL",    cond: "1 Jun – 31 Aug · min 2",     rate: 15500 },
  { id: "corp",  name: "Corporate",     type: "CORPORATE",   cond: "Serena Group · contracted", rate: 10800 },
  { id: "promo", name: "Early Bird",    type: "PROMOTIONAL", cond: "Code required · min 2",      rate: 9900  },
] as const;

type PlanId = (typeof PLANS)[number]["id"];
type State = { kind: "applied" } | { kind: "eligible" } | { kind: "blocked"; why: string };

const applied: State = { kind: "applied" };
const eligible: State = { kind: "eligible" };
const blocked = (why: string): State => ({ kind: "blocked", why });

const noCompany = blocked("Needs a company");
const noCode = blocked("Needs a code");

const SCENARIOS = [
  {
    label: "Walk-in · 7 Nov",
    icon: User,
    states: { std: applied, peak: blocked("Outside date window"), corp: noCompany, promo: noCode },
    rate: 12000,
    source: "Rate plan",
    why: "the only eligible plan",
  },
  {
    label: "Same room · 14 Jul",
    icon: Sun,
    states: { std: eligible, peak: applied, corp: noCompany, promo: noCode },
    rate: 15500,
    source: "Rate plan",
    why: "outranks Standard on priority",
  },
  {
    label: "Booked by Serena Group",
    icon: Building2,
    states: { std: eligible, peak: eligible, corp: applied, promo: noCode },
    rate: 10800,
    source: "Company rate",
    why: "contracted plan on the account",
  },
  {
    label: "Guest enters HUNZA25",
    icon: Tag,
    states: { std: eligible, peak: eligible, corp: noCompany, promo: applied },
    rate: 9900,
    source: "Access code",
    why: "unlocked by HUNZA25",
  },
] satisfies ReadonlyArray<{
  label: string;
  icon: typeof User;
  states: Record<PlanId, State>;
  rate: number;
  source: string;
  why: string;
}>;

const money = (n: number) => n.toLocaleString("en-US");

export default function RatePlanMockup() {
  const [step, setStep] = useState(0);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    const id = setInterval(() => {
      if (alive.current) setStep((s) => (s + 1) % SCENARIOS.length);
    }, 2600);
    return () => { alive.current = false; clearInterval(id); };
  }, []);

  const scenario = SCENARIOS[step];
  const ContextIcon = scenario.icon;

  return (
    <div className="relative mx-auto w-full min-w-0 max-w-[720px]">
      <div className="overflow-hidden rounded-[20px] border border-line bg-white shadow-[0_32px_74px_-22px_rgba(68,43,30,.28),0_10px_26px_-12px_rgba(68,43,30,.12)]">

        {/* chrome */}
        <div className="flex h-10 items-center gap-3 border-b border-line-soft bg-gradient-to-b from-[#FCFAF7] to-[#F6F1EA] px-3.5">
          <div className="flex shrink-0 gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#F0A29B]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#F0CE85]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#9BD8C2]" />
          </div>
          <div className="mx-auto hidden min-w-0 items-center gap-1.5 rounded-md border border-line-soft bg-white/80 px-2.5 py-1 sm:flex">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
            <span className="truncate text-[9.5px] font-semibold text-ink-mute">app.innflo.co / rates</span>
          </div>
          <span className="ml-auto shrink-0 text-[9px] font-black uppercase tracking-[.12em] text-ink-faint">Rate plans</span>
        </div>

        {/* the stay being priced */}
        <div className="flex flex-wrap items-center gap-2 border-b border-line-soft bg-[#FCFBF8] px-3.5 py-2.5">
          <span className="flex shrink-0 items-center gap-1.5 rounded-md border border-line-soft bg-white px-2 py-1 text-[9.5px] font-bold text-ink">
            <CalendarDays className="h-3 w-3 text-ink-faint" /> Deluxe Double · 3 nights
          </span>
          {/* Fixed width so the swapping context chip cannot reflow the row. */}
          <span className="relative ml-auto h-[26px] w-[164px] shrink-0 sm:w-[186px]">
            <AnimatePresence initial={false}>
              <motion.span
                key={scenario.label}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3, ease: EASE }}
                className="absolute inset-0 flex items-center justify-center gap-1.5 rounded-full bg-ink px-2.5 text-[9.5px] font-black text-white"
              >
                <ContextIcon className="h-3 w-3 shrink-0 text-coral" />
                <span className="truncate">{scenario.label}</span>
              </motion.span>
            </AnimatePresence>
          </span>
        </div>

        {/* the plans considered */}
        <div className="px-3.5 pb-1 pt-3">
          <p className="mb-2 text-[8px] font-black uppercase tracking-[.14em] text-ink-faint">
            Plans considered
          </p>
          <div className="flex flex-col gap-1.5">
            {PLANS.map((plan) => {
              const state = scenario.states[plan.id];
              const isApplied = state.kind === "applied";
              const isBlocked = state.kind === "blocked";
              return (
                <motion.div
                  key={plan.id}
                  animate={{
                    backgroundColor: isApplied ? "#FBEAE1" : "#FFFFFF",
                    borderColor: isApplied ? "#E0532B" : "#F1ECE4",
                    opacity: isBlocked ? 0.55 : 1,
                  }}
                  transition={{ duration: 0.35, ease: EASE }}
                  className="flex h-[46px] items-center gap-2.5 rounded-xl border px-2.5"
                >
                  <span className={`hidden shrink-0 rounded px-1.5 py-0.5 text-[7px] font-black tracking-[.08em] sm:inline ${TYPE_STYLE[plan.type]}`}>
                    {plan.type}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-[11px] font-black leading-tight ${isApplied ? "text-coral-deep" : "text-ink"}`}>
                      {plan.name}
                    </span>
                    <span className="mt-px block truncate text-[8.5px] text-ink-mute">{plan.cond}</span>
                  </span>

                  {/* Fixed width keeps the rate column from shifting as the
                      right-hand content swaps between rate / reason / applied. */}
                  <span className="relative h-[30px] w-[104px] shrink-0 sm:w-[128px]">
                    <AnimatePresence initial={false}>
                      <motion.span
                        key={state.kind + (isBlocked ? state.why : "")}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.25, ease: EASE }}
                        className="absolute inset-0 flex items-center justify-end gap-1.5"
                      >
                        {isBlocked ? (
                          <span className="flex items-center gap-1 truncate text-[8.5px] font-bold text-ink-faint">
                            <Lock className="h-2.5 w-2.5 shrink-0" />
                            <span className="truncate">{state.why}</span>
                          </span>
                        ) : (
                          <>
                            <span className={`whitespace-nowrap text-[11px] font-black ${isApplied ? "text-coral-deep" : "text-ink-mute"}`}>
                              {money(plan.rate)}
                            </span>
                            {isApplied && (
                              <span className="flex shrink-0 items-center gap-0.5 rounded-full bg-coral px-1.5 py-[3px] text-[7.5px] font-black text-white">
                                <Check className="h-2 w-2" /> Applied
                              </span>
                            )}
                          </>
                        )}
                      </motion.span>
                    </AnimatePresence>
                  </span>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* what the desk actually gets quoted */}
        <div className="m-3.5 flex h-[62px] items-center gap-3 overflow-hidden rounded-xl bg-ink px-3.5">
          <span className="min-w-0 flex-1">
            <span className="block text-[7.5px] font-black uppercase tracking-[.14em] text-white/40">Rate applied</span>
            <span className="relative mt-0.5 block h-[22px]">
              <AnimatePresence initial={false}>
                <motion.span
                  key={scenario.rate}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3, ease: EASE }}
                  className="absolute inset-0 flex items-baseline gap-1.5"
                >
                  <span className="whitespace-nowrap text-[19px] font-black leading-none text-white">
                    PKR {money(scenario.rate)}
                  </span>
                  <span className="whitespace-nowrap text-[8.5px] font-bold text-white/45">
                    / night · {money(scenario.rate * 3)} total
                  </span>
                </motion.span>
              </AnimatePresence>
            </span>
          </span>

          <span className="relative hidden h-[34px] w-[178px] shrink-0 sm:block">
            <AnimatePresence initial={false}>
              <motion.span
                key={scenario.source + scenario.why}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3, ease: EASE }}
                className="absolute inset-0 flex flex-col items-end justify-center gap-1"
              >
                <span className="rounded-full bg-coral px-2 py-[3px] text-[7.5px] font-black uppercase tracking-[.1em] text-white">
                  {scenario.source}
                </span>
                <span className="w-full truncate text-right text-[8px] font-semibold text-white/50">
                  {scenario.why}
                </span>
              </motion.span>
            </AnimatePresence>
          </span>
        </div>
      </div>
    </div>
  );
}
