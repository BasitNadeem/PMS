import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Reveal from "../motion/Reveal";

export interface FeatureTab {
  label: string;
  heading: string;
  copy: string;
  mockup: React.ReactNode;
}

interface TabbedFeatureBlockProps {
  eyebrow: string;
  headline: string;
  tabs: FeatureTab[];
  mockupSide?: "left" | "right";
  /** Fixed height for the mockup slot so switching tabs never resizes the block — size it to the tallest mockup among the tabs. */
  mockupMinHeight?: string;
}

const EASE = [0.16, 1, 0.3, 1] as const;

export default function TabbedFeatureBlock({
  eyebrow,
  headline,
  tabs,
  mockupSide = "left",
  mockupMinHeight = "440px",
}: TabbedFeatureBlockProps) {
  const [active, setActive] = useState(0);
  const tab = tabs[active];

  const mockupCol = (
    <div className="flex items-center justify-center" style={{ minHeight: mockupMinHeight }}>
      <AnimatePresence mode="wait">
        <motion.div
          key={tab.label}
          className="w-full"
          initial={{ opacity: 0, y: 10 }}
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
        key={tab.label}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.45, ease: EASE, delay: 0.05 }}
      >
        <p className="font-display text-[clamp(28px,3.2vw,38px)] font-semibold text-ink leading-snug mb-6">
          {tab.heading}
        </p>
        <p className="text-[18px] text-ink-soft font-body font-medium leading-relaxed max-w-xl">
          {tab.copy}
        </p>
      </motion.div>
    </AnimatePresence>
  );

  return (
    <section className="py-20">
      <div className="mx-auto max-w-[96rem] px-6">
        <Reveal className="text-center mb-14">
          <p className="eyebrow mb-4">{eyebrow}</p>
          <h2 className="font-display text-[clamp(30px,4vw,44px)] font-medium leading-tight text-ink max-w-2xl mx-auto">
            {headline}
          </h2>
        </Reveal>

        <Reveal variant="scale">
          <div
            className="rounded-3xl shadow-float ring-1 ring-black/[0.04] px-8 md:px-16 pt-6 md:pt-8 pb-8 md:pb-16"
            style={{ background: "linear-gradient(160deg, #FFFFFF 0%, #FDF9F3 55%, #FBF3E9 100%)" }}
          >
            <div
              className="flex items-center justify-center gap-3 flex-wrap border-b border-line-soft pb-6 mb-12"
              role="tablist"
            >
              {tabs.map((t, i) => (
                <button
                  key={t.label}
                  role="tab"
                  aria-selected={i === active}
                  onClick={() => setActive(i)}
                  className={`relative px-6 py-3.5 text-[16px] font-bold font-body rounded-full transition-colors ${
                    i === active
                      ? "text-coral-dark bg-coral-soft"
                      : "text-ink-soft hover:text-ink"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-10 lg:gap-20 items-center">
              {mockupSide === "left" ? (
                <>
                  <div className="w-full">{mockupCol}</div>
                  <div className="w-full">{copyCol}</div>
                </>
              ) : (
                <>
                  <div className="w-full lg:order-2">{mockupCol}</div>
                  <div className="w-full lg:order-1">{copyCol}</div>
                </>
              )}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
