import { useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { RotateCcw, Download, Smartphone, Banknote, Plus } from "lucide-react";
import Reveal from "../../components/motion/Reveal";
import SplitHeading from "../../components/motion/SplitHeading";
import MagneticButton from "../../components/motion/MagneticButton";
import TabbedFeatureBlock from "../../components/features/TabbedFeatureBlock";
import {
  FrontDeskMockup, HousekeepingMockup, ReportsSnapshotMockup, ChannelManagerComingSoonMockup,
} from "../../components/features/HomeTabMockups";

const EASE = [0.16, 1, 0.3, 1] as const;

export interface StayTypeContent {
  eyebrow: string;
  heading: [string, string];
  image: string;
  intro: string;
  ctaLabel?: string;
  points: { icon: LucideIcon; title: string; body: string }[];
  benefits: {
    tagline: string;
    heading: string;
    items: { icon: LucideIcon; title: string; body: string; image?: string }[];
  };
  faqs: { q: string; a: string }[];
}

const TRUST_ITEMS = [
  {
    icon: RotateCcw,
    title: "Backed up, always",
    body: "Every change is backed up continuously — nothing depends on one hard drive or a backup somebody forgot to run.",
  },
  {
    icon: Download,
    title: "Your data is yours",
    body: "Export your guest and booking data whenever you want — nothing is held hostage if you ever decide to leave.",
  },
  {
    icon: Smartphone,
    title: "Runs on what you already have",
    body: "No special hardware, no dedicated terminal — Innflo runs in a browser, on the phone or laptop staff already carry.",
  },
  {
    icon: Banknote,
    title: "Built for how this market pays",
    body: "JazzCash, Easypaisa, and bank transfers are first-class payment methods — not bolted onto software built elsewhere.",
  },
];

function FaqRow({ q, a, isOpen, isLast, onClick }: { q: string; a: string; isOpen: boolean; isLast: boolean; onClick: () => void }) {
  return (
    <div className={isLast ? "" : "border-b border-line-soft"}>
      <button
        onClick={onClick}
        aria-expanded={isOpen}
        className="w-full flex items-center justify-between gap-6 px-6 sm:px-8 py-5 text-left"
      >
        <span className="text-[15px] sm:text-[16px] font-bold text-ink font-body">{q}</span>
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
            <p className="text-[14.5px] text-ink-soft font-body leading-relaxed text-justify px-6 sm:px-8 pb-6 pr-14">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function StayTypeTemplate({ eyebrow, heading, image, intro, ctaLabel = "Start a free trial", points, benefits, faqs }: StayTypeContent) {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <main className="w-full bg-paper text-ink selection:bg-coral-soft selection:text-coral-dark">
      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <section className="pt-32 pb-20 px-6 bg-grid relative overflow-hidden">
        <div
          className="absolute pointer-events-none"
          style={{ top: "-15%", left: "-10%", width: "55%", height: "70%", background: "radial-gradient(ellipse, rgba(224,83,43,0.09), transparent 65%)" }}
        />
        <div className="relative mx-auto max-w-7xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div>
              <Reveal variant="fade">
                <p className="eyebrow mb-4">{eyebrow}</p>
              </Reveal>
              <Reveal variant="rise" delay={0.05}>
                <h1 className="font-display text-[clamp(32px,5vw,52px)] font-medium leading-[1.1] text-ink tracking-tight mb-6">
                  <SplitHeading>{heading[0]}</SplitHeading>
                  <span className="block text-ink-soft">{heading[1]}</span>
                </h1>
              </Reveal>
              <Reveal variant="rise" delay={0.1}>
                <p className="text-[16px] sm:text-[17px] text-ink-soft font-body leading-relaxed mb-8 max-w-lg">
                  {intro}
                </p>
              </Reveal>
              <Reveal variant="rise" delay={0.15}>
                <MagneticButton>
                  <Link
                    to="/contact"
                    className="inline-flex items-center h-12 px-8 rounded-full text-[16px] font-semibold font-body text-white bg-coral hover:bg-coral-dark transition-colors shadow-pop"
                  >
                    {ctaLabel}
                  </Link>
                </MagneticButton>
                <p className="text-[13px] text-ink-mute font-body mt-3">Guided trial · no credit card required.</p>
              </Reveal>
            </div>
            <Reveal variant="scale" delay={0.1}>
              <div className="rounded-3xl overflow-hidden shadow-float aspect-[4/3]">
                <img
                  src={image}
                  alt={heading.join(" ")}
                  decoding="async"
                  fetchPriority="high"
                  className="h-full w-full object-cover"
                />
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── 3 tiles ────────────────────────────────────────────────────────── */}
      <section className="pb-20 px-6">
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {points.map((p, i) => (
              <Reveal key={p.title} delay={i * 0.06} variant="rise">
                <div className="h-full rounded-2xl bg-card border border-line p-6 shadow-card hover:shadow-float transition-all duration-300">
                  <div className="h-10 w-10 rounded-xl bg-coral-soft grid place-items-center mb-4">
                    <p.icon className="h-4.5 w-4.5 text-coral-dark" strokeWidth={2.25} />
                  </div>
                  <p className="text-[15px] font-bold text-ink font-body mb-2">{p.title}</p>
                  <p className="text-[13.5px] text-ink-soft font-body leading-relaxed">{p.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── All-in-one — shared tabbed feature block ─────────────────────────── */}
      <TabbedFeatureBlock
        eyebrow="All-in-one"
        headline="Everything you need to run your property"
        tabs={[
          {
            label: "Front Desk",
            heading: "Every guest, one glance away.",
            copy: "Arrivals, departures, and room status for the whole day — check someone in without leaving this screen.",
            mockup: <FrontDeskMockup />,
            learnMoreTo: "/pms",
          },
          {
            label: "Automations",
            heading: "Keeps working when the Wi-Fi doesn't.",
            copy: "Staff mark rooms clean from their own phone, even offline — everything syncs the moment a signal comes back.",
            mockup: <HousekeepingMockup />,
            learnMoreTo: "/automations",
          },
          {
            label: "Reports",
            heading: "The numbers, already done.",
            copy: "Occupancy, ADR, revenue, and profit — a finished report waiting for you, not a spreadsheet you have to build.",
            mockup: <ReportsSnapshotMockup />,
            learnMoreTo: "/statistics",
          },
          {
            label: "Channel Manager",
            heading: "Coming soon.",
            copy: "Direct two-way sync with Booking.com, Expedia, Agoda, and Airbnb is in development — not live yet, so we're not going to pretend it is.",
            mockup: <ChannelManagerComingSoonMockup />,
            learnMoreTo: "/channel-manager",
            learnMoreLabel: "View the roadmap",
          },
        ]}
      />

      {/* ── Benefits — tailored to this accommodation type ───────────────────── */}
      <section className="py-24 px-6 bg-mist border-y border-line">
        <div className="mx-auto max-w-7xl">
          <Reveal variant="fade" className="text-center mb-14">
            <p className="eyebrow mb-4">{benefits.tagline}</p>
            <h2 className="font-display text-[clamp(28px,3.8vw,42px)] font-medium leading-tight text-ink max-w-2xl mx-auto">
              {benefits.heading}
            </h2>
          </Reveal>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {benefits.items.map((item, i) => (
              <Reveal key={item.title} delay={i * 0.06} variant="rise">
                <div className="h-full rounded-2xl bg-card border border-line overflow-hidden shadow-card hover:shadow-float transition-all duration-300 flex flex-col">
                  {item.image && (
                    <div className="w-full aspect-[4/3] overflow-hidden border-b border-line bg-[#EAE8E4]">
                      <img
                        src={item.image}
                        alt={item.title}
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover"
                      />
                    </div>
                  )}
                  <div className="p-6 flex-1 flex flex-col">
                    {!item.image ? (
                      <div className="h-11 w-11 rounded-xl bg-coral-soft grid place-items-center mb-5">
                        <item.icon className="h-5 w-5 text-coral-dark" strokeWidth={2.25} />
                      </div>
                    ) : (
                      <div className="h-7 w-7 rounded-lg bg-coral-soft grid place-items-center mb-4">
                        <item.icon className="h-3.5 w-3.5 text-coral-dark" strokeWidth={2.25} />
                      </div>
                    )}
                    <p className="text-[16px] font-bold text-ink font-body mb-2">{item.title}</p>
                    <p className="text-[13.5px] sm:text-[14px] text-ink-soft font-body leading-relaxed">{item.body}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Trust / peace of mind ─────────────────────────────────────────────── */}
      <section className="py-24 px-6">
        <div className="mx-auto max-w-7xl">
          <Reveal variant="fade" className="text-center mb-14">
            <p className="eyebrow mb-4">Reliability</p>
            <h2 className="font-display text-[clamp(28px,3.8vw,42px)] font-medium leading-tight text-ink">
              Peace of mind that comes from software you can count on.
            </h2>
          </Reveal>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-10 gap-y-12 items-stretch">
            {TRUST_ITEMS.map((item, i) => (
              <Reveal key={item.title} delay={i * 0.06} variant="rise" className="h-full">
                <div className="h-full rounded-2xl border border-ink-faint hover:border-coral hover:shadow-float transition-all duration-300 p-5">
                  <div className="h-11 w-11 rounded-xl bg-coral-soft border-2 border-ink grid place-items-center mb-5">
                    <item.icon className="h-4.5 w-4.5 text-coral-dark" strokeWidth={2.25} />
                  </div>
                  <p className="text-[16px] font-bold text-ink font-body mb-2 leading-snug">{item.title}</p>
                  <p className="text-[13.5px] text-ink-soft font-body leading-relaxed text-justify">{item.body}</p>
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

      {/* ── FAQ ────────────────────────────────────────────────────────────── */}
      <section className="py-24 px-6 bg-paper">
        <div className="mx-auto max-w-4xl">
          <Reveal variant="fade" className="text-center mb-14">
            <h2 className="font-display text-[clamp(28px,3.8vw,42px)] font-medium leading-tight text-ink">
              Got a question?
            </h2>
          </Reveal>

          <Reveal variant="rise">
            <div className="rounded-3xl bg-card shadow-float overflow-hidden">
              {faqs.map((item, i) => (
                <FaqRow
                  key={item.q}
                  q={item.q}
                  a={item.a}
                  isLast={i === faqs.length - 1}
                  isOpen={openFaq === i}
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                />
              ))}
            </div>
          </Reveal>
        </div>
      </section>

    </main>
  );
}
