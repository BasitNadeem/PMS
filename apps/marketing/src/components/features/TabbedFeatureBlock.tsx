import { useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import Reveal from "../motion/Reveal";

export interface FeatureTab {
  label: string;
  heading: string;
  copy: string;
  mockup: React.ReactNode;
  learnMoreTo: string;
  learnMoreLabel?: string;
}

interface TabbedFeatureBlockProps {
  id?: string;
  eyebrow: string;
  headline: string;
  tabs: FeatureTab[];
  mockupSide?: "left" | "right";
  /** Fixed height for the mockup slot so switching tabs never resizes the block — size it to the tallest mockup among the tabs. */
  mockupMinHeight?: string;
}

const EASE = [0.16, 1, 0.3, 1] as const;

export default function TabbedFeatureBlock({
  id,
  eyebrow,
  headline,
  tabs,
  mockupSide = "left",
  mockupMinHeight = "420px",
}: TabbedFeatureBlockProps) {
  const [active, setActive] = useState(0);
  const tab = tabs[active];

  const mockupCol = (
    <div
      className="relative flex w-full min-w-0 max-w-full items-center justify-center overflow-x-hidden"
      style={{ height: mockupMinHeight }}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={tab.label}
          className="relative w-full min-w-0 max-w-full overflow-x-hidden"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.45, ease: EASE }}
        >
          {tab.mockup}
        </motion.div>
      </AnimatePresence>
    </div>
  );

  const copyCol = (
    <AnimatePresence mode="wait">
      <motion.div
        className="flex h-full w-full min-w-0 flex-col justify-center"
        key={tab.label}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.45, ease: EASE, delay: 0.05 }}
      >
        <div className="mb-5 flex items-center gap-3">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-ink text-[11px] font-black text-white">
            {String(active + 1).padStart(2, "0")}
          </span>
          <span className="text-[11px] font-black uppercase tracking-[0.18em] text-coral-dark">
            {tab.label}
          </span>
        </div>
        <p className="font-display text-[clamp(34px,4vw,52px)] font-medium text-ink leading-[1.08] mb-6">
          {tab.heading}
        </p>
        <p className="text-[17px] text-ink-soft font-body font-medium leading-relaxed max-w-xl">
          {tab.copy}
        </p>
        <Link
          to={tab.learnMoreTo}
          className="group mt-9 inline-flex h-12 w-fit items-center gap-3 rounded-full bg-ink px-6 text-[14px] font-bold text-white shadow-pop transition-all hover:-translate-y-0.5 hover:bg-coral-dark hover:shadow-float"
        >
          {tab.learnMoreLabel ?? "Learn more"}
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </Link>
      </motion.div>
    </AnimatePresence>
  );

  return (
    <section id={id} className="scroll-mt-24 py-24">
      <div className="mx-auto max-w-[96rem] px-6">
        <Reveal className="text-center mb-12">
          <p className="eyebrow mb-4">{eyebrow}</p>
          <h2 className="font-display text-[clamp(36px,5vw,58px)] font-medium leading-[1.05] text-ink max-w-3xl mx-auto">
            {headline}
          </h2>
        </Reveal>

        <Reveal variant="scale" className="w-full min-w-0">
          <div
            className="w-full min-w-0 max-w-full overflow-hidden rounded-[34px] border border-line bg-card p-3 shadow-float sm:p-5 lg:p-8"
            style={{ background: "linear-gradient(155deg, #FFFFFF 0%, #FDF9F3 58%, #F8EFE5 100%)" }}
          >
            <div className="border-b border-line-soft px-1 pb-5 pt-1 sm:px-4">
              <div
                className="no-scrollbar flex items-center gap-2 overflow-x-auto lg:justify-center"
                role="tablist"
                aria-label={`${eyebrow} product areas`}
              >
                {tabs.map((t, i) => (
                  <button
                    key={t.label}
                    id={`feature-tab-${i}`}
                    role="tab"
                    aria-controls={`feature-panel-${i}`}
                    aria-selected={i === active}
                    tabIndex={i === active ? 0 : -1}
                    onClick={() => setActive(i)}
                    className={`shrink-0 rounded-full px-5 py-3 text-[14px] font-bold font-body transition-all sm:px-6 sm:text-[15px] ${
                      i === active
                        ? "bg-coral-soft text-coral-dark shadow-[inset_0_0_0_1px_rgba(224,83,43,0.08)]"
                        : "text-ink-soft hover:bg-mist hover:text-ink"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div
              id={`feature-panel-${active}`}
              role="tabpanel"
              aria-labelledby={`feature-tab-${active}`}
              className="grid w-full min-w-0 max-w-full grid-cols-1 items-stretch gap-8 overflow-x-hidden px-1 pb-1 pt-6 sm:px-3 sm:pt-8 lg:grid-cols-[minmax(0,1.18fr)_minmax(0,.82fr)] lg:gap-14"
              style={{ minHeight: mockupMinHeight }}
            >
              {mockupSide === "left" ? (
                <>
                  <div className="w-full min-w-0">{mockupCol}</div>
                  <div className="w-full min-w-0 py-4 lg:py-8">{copyCol}</div>
                </>
              ) : (
                <>
                  <div className="w-full min-w-0 lg:order-2">{mockupCol}</div>
                  <div className="w-full min-w-0 py-4 lg:order-1 lg:py-8">{copyCol}</div>
                </>
              )}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
