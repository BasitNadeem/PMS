import { useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Plus } from "lucide-react";
import Reveal from "../components/motion/Reveal";
import SplitHeading from "../components/motion/SplitHeading";
import MagneticButton from "../components/motion/MagneticButton";

const EASE = [0.16, 1, 0.3, 1] as const;

interface Tier {
  name: string;
  price: string;
  tagline: string;
  popular?: boolean;
  inheritsFrom?: string;
  features: string[];
}

const TIERS: Tier[] = [
  {
    name: "Essentials",
    price: "8,000",
    tagline: "A single small property running day-to-day.",
    features: [
      "Reservations & timeline, with group bookings",
      "Guest folios & billing — 10 payment methods, 14 charge categories",
      "Housekeeping, with tasks auto-created on checkout",
      "Guest profiles & stay history",
      "Daily report",
      "Email support",
    ],
  },
  {
    name: "Growth",
    price: "18,000",
    tagline: "An owner who wants to see the numbers, not just run the desk.",
    popular: true,
    inheritsFrom: "Essentials",
    features: [
      "Expense tracking across 10 categories",
      "Balance Book — a live, auto-logged cash & bank ledger",
      "Monthly BI report & owner's dashboard",
      "Nightly WhatsApp briefing",
      "Priority support",
    ],
  },
  {
    name: "Complete",
    price: "32,000",
    tagline: "F&B, multiple units, or more than one channel to watch.",
    inheritsFrom: "Growth",
    features: [
      "Point of Sale — QR ordering, kitchen board, menu & inventory linkage",
      "Camera-scan inventory updates & low-stock alerts",
      "Channel Manager — included the moment it goes live (in development today)",
      "Full custom team roles & permissions",
      "Multi-property portfolio view",
      "Dedicated onboarding call",
    ],
  },
];

const PRICING_FAQS = [
  {
    q: "Is pricing based on how many rooms I have?",
    a: "Not for now — each plan is a flat monthly fee regardless of room count. If you're a much larger property, get in touch and we'll figure out what's fair together.",
  },
  {
    q: "Can I pay yearly instead of monthly?",
    a: "Not yet — every plan is billed monthly right now. Annual billing (with a discount) is something we're planning to add later.",
  },
  {
    q: "Is there a setup fee or minimum contract?",
    a: "No — no setup fee, no minimum contract. Cancel any time.",
  },
  {
    q: "Can I switch plans later?",
    a: "Yes — move up to Growth or Complete whenever your property needs more, or down if it doesn't. Nothing is locked in.",
  },
  {
    q: "Is Channel Manager included?",
    a: "It's part of Complete, but it's still in development — you won't be charged for a feature that isn't live, and it unlocks automatically once it ships.",
  },
  {
    q: "Do you offer a free trial?",
    a: "Yes — 14 days, full features for your plan, no credit card required.",
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

export default function Pricing() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <div className="bg-paper text-ink">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <section className="pt-40 pb-16 px-6 bg-grid relative overflow-hidden text-center">
        <div
          className="absolute pointer-events-none left-1/2 -translate-x-1/2"
          style={{ top: "-15%", width: "70%", height: "60%", background: "radial-gradient(ellipse, rgba(224,83,43,0.09), transparent 65%)" }}
        />
        <div className="relative mx-auto max-w-2xl">
          <Reveal variant="fade"><p className="eyebrow mb-6">Pricing</p></Reveal>
          <h1 className="font-display text-[clamp(38px,6vw,64px)] font-medium leading-[1.05] text-ink">
            <SplitHeading as="span" className="block">Flat monthly fee.</SplitHeading>
            <SplitHeading as="span" delay={0.25} className="block italic text-coral-dark">No per-booking cuts.</SplitHeading>
          </h1>
          <Reveal delay={0.5}>
            <p className="text-[17px] text-ink-soft font-body leading-relaxed max-w-lg mx-auto mt-6">
              Three plans, priced by what your property actually uses — pick the one that fits today, and grow into the next one when you're ready. Billed monthly, no yearly contract required.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ── Tiers ──────────────────────────────────────────────────────────── */}
      <section className="pb-24 px-6">
        <div className="mx-auto max-w-6xl">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            {TIERS.map((tier, i) => (
              <Reveal key={tier.name} delay={i * 0.08} variant="rise">
                <div
                  className={`h-full rounded-3xl p-8 flex flex-col ${
                    tier.popular
                      ? "bg-ink text-paper shadow-float lg:-translate-y-3"
                      : "bg-card border border-line shadow-card"
                  }`}
                >
                  {tier.popular && (
                    <span className="self-start text-[10px] font-bold uppercase tracking-wider text-coral bg-white/10 px-2.5 py-1 rounded-full mb-4">
                      Most popular
                    </span>
                  )}
                  <p className={`text-[19px] font-bold font-body mb-1 ${tier.popular ? "text-paper" : "text-ink"}`}>{tier.name}</p>
                  <p className={`text-[13px] font-body leading-snug mb-6 ${tier.popular ? "opacity-70" : "text-ink-soft"}`} style={tier.popular ? { color: "rgba(245,235,228,0.7)" } : undefined}>
                    {tier.tagline}
                  </p>

                  <div className="flex items-baseline gap-1.5 mb-7">
                    <span className={`font-display text-[42px] font-medium leading-none ${tier.popular ? "text-white" : "text-ink"}`}>
                      PKR {tier.price}
                    </span>
                    <span className={`text-[14px] font-body ${tier.popular ? "opacity-60" : "text-ink-mute"}`}>/month</span>
                  </div>

                  <MagneticButton className="mb-7">
                    <Link
                      to="/contact"
                      className={`block w-full h-11 text-center leading-[44px] text-[15px] font-bold font-body rounded-full transition-colors ${
                        tier.popular
                          ? "bg-coral hover:bg-coral-dark text-white shadow-pop"
                          : "bg-ink hover:bg-ink-soft text-white"
                      }`}
                    >
                      Start free trial →
                    </Link>
                  </MagneticButton>

                  {tier.inheritsFrom && (
                    <p className={`text-[11.5px] font-bold uppercase tracking-wide mb-3 ${tier.popular ? "opacity-60" : "text-ink-faint"}`} style={tier.popular ? { color: "rgba(245,235,228,0.6)" } : undefined}>
                      Everything in {tier.inheritsFrom}, plus
                    </p>
                  )}
                  <ul className="space-y-3">
                    {tier.features.map(f => (
                      <li key={f} className="flex items-start gap-2.5 text-[13.5px] font-body leading-snug">
                        <Check className={`h-4 w-4 mt-0.5 shrink-0 ${tier.popular ? "text-coral" : "text-coral-dark"}`} strokeWidth={2.5} />
                        <span className={tier.popular ? "" : "text-ink-soft"} style={tier.popular ? { color: "rgba(245,235,228,0.85)" } : undefined}>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={0.2} className="mt-10 text-center">
            <p className="text-[13.5px] text-ink-mute font-body">
              No setup fee · No minimum contract · Cancel any time · 14-day free trial, no card required
            </p>
          </Reveal>
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
              No card required, no obligation to continue — see which plan actually fits your property first.
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
      <section className="py-24 px-6 bg-paper">
        <div className="mx-auto max-w-4xl">
          <Reveal variant="fade" className="text-center mb-14">
            <h2 className="font-display text-[clamp(30px,4vw,44px)] font-medium leading-tight text-ink">
              Got a question?
            </h2>
          </Reveal>

          <Reveal variant="rise">
            <div className="rounded-3xl bg-card shadow-float overflow-hidden">
              {PRICING_FAQS.map((item, i) => (
                <FaqRow
                  key={item.q}
                  q={item.q}
                  a={item.a}
                  isLast={i === PRICING_FAQS.length - 1}
                  isOpen={openFaq === i}
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                />
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Honest note ────────────────────────────────────────────────────── */}
      <section className="py-24 px-6 border-t border-line bg-mist">
        <div className="mx-auto max-w-3xl">
          <Reveal>
            <p className="font-display italic text-[clamp(20px,2.8vw,30px)] text-ink-soft leading-relaxed text-center">
              "InnFlo is early-stage software. You won't get a polished enterprise demo or a 50-slide pitch. You'll get a conversation, a real look at what's built, and an honest answer on whether it fits your property."
            </p>
          </Reveal>
        </div>
      </section>

    </div>
  );
}
