import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence, useScroll, useTransform } from "framer-motion";
import Reveal from "../components/motion/Reveal";
import SplitHeading from "../components/motion/SplitHeading";
import MagneticButton from "../components/motion/MagneticButton";
import Marquee from "../components/motion/Marquee";
import { ArrowRight, ShieldCheck, LifeBuoy, CloudCog, Activity, Plus } from "lucide-react";
import TabbedFeatureBlock from "../components/features/TabbedFeatureBlock";
import {
  FrontDeskMockup, HousekeepingMockup, ReportsSnapshotMockup, ChannelManagerComingSoonMockup, TeamAccessMockup,
} from "../components/features/HomeTabMockups";

const REGIONS = ["Hunza", "Skardu", "Naran", "Gilgit", "Swat", "Murree", "Fairy Meadows", "Kaghan"];

const STAY_TYPES = [
  {
    title: "Hotels",
    description: "Boutiques, motels, resorts and multi-site brands",
    image: "/images/hotels.webp",
    to: "/stays/hotels",
  },
  {
    title: "B&Bs and guesthouses",
    description: "Intimate stays with personality",
    image: "/images/guesthouses.webp",
    to: "/stays/guesthouses",
  },
  {
    title: "Vacation rentals",
    description: "Single homes to multi-unit portfolios",
    image: "/images/vacation_rentals.webp",
    to: "/stays/vacation-rentals",
  },
  {
    title: "Glamping sites",
    description: "Cabins, pods, domes, tents and yurts",
    image: "/images/glamping.webp",
    to: "/stays/glamping",
  },
];


function HeroMockup() {
  const { scrollY } = useScroll();
  const y = useTransform(scrollY, [0, 700], [0, 90]);
  const rotateY = useTransform(scrollY, [0, 700], [-7, 0]);
  const rotateX = useTransform(scrollY, [0, 700], [3, 0]);
  const videoRef = useRef<HTMLVideoElement>(null);

  // The video is above the fold, but its bytes shouldn't compete with the
  // page's critical resources (HTML/CSS/JS/fonts) on first paint. preload="none"
  // stops the browser from eagerly fetching it during parsing; assigning src
  // on a deferred tick pushes the request past the initial critical path
  // instead of racing it. (Not requestIdleCallback: unsupported in Safari,
  // and a fixed short delay is plenty for "after the page is interactive".)
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const id = window.setTimeout(() => {
      video.src = "/video/hero-software_2.mp4";
      video.load();
      void video.play();
    }, 300);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 1, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
      style={{ y, perspective: 1400 }}
    >
      <motion.div style={{ rotateY, rotateX, transformStyle: "preserve-3d" }}>
        <div className="rounded-2xl overflow-hidden bg-ink border border-line shadow-[0_32px_80px_rgba(0,0,0,0.10)]">
          <video
            ref={videoRef}
            className="w-full h-full object-cover aspect-[4/3]"
            preload="none"
            muted
            loop
            playsInline
          />
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── FAQ ────────────────────────────────────────────────────────────────────
const FAQS = [
  {
    q: "What is InnFlo?",
    a: "InnFlo is hotel property management software — reservations, billing, housekeeping, QR dining, and reporting in one dashboard, built specifically for small, independently-run properties rather than large city hotel chains.",
  },
  {
    q: "Which types of properties can use InnFlo?",
    a: "Hotels, B&Bs and guesthouses, hostels, vacation rentals, glamping sites, and long-term stays — anything from a single room to a multi-property portfolio.",
  },
  {
    q: "Does InnFlo work when the internet is unreliable?",
    a: "Yes. Housekeeping runs offline-first, so staff can keep checking off rooms with no signal, and everything syncs the moment connection returns — built for the connectivity that mountain and rural properties actually have.",
  },
  {
    q: "How is InnFlo priced?",
    a: "Three flat monthly plans — Essentials, Growth, and Complete — priced by what your property needs, not by how many bookings you take. No commission per booking, no hidden per-guest fees.",
  },
  {
    q: "Is InnFlo ready for my property today?",
    a: "Most of it, yes — reservations, billing, housekeeping, QR dining, and reporting are live and in use. Channel Manager (direct OTA sync) is still in development, and we'll tell you exactly that rather than pretend otherwise.",
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
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <p className="text-[14.5px] text-ink-soft font-body leading-relaxed text-justify px-6 sm:px-8 pb-6 pr-14">
              {a}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────
export default function Home() {
  const heroRef = useRef<HTMLDivElement>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <div className="bg-paper text-ink">

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section ref={heroRef} className="relative min-h-screen flex items-center pt-20 overflow-hidden">
        <div
          className="absolute inset-0 bg-grid"
          style={{ maskImage: "linear-gradient(to bottom, black, transparent)" }}
        />
        <div
          className="absolute pointer-events-none"
          style={{
            top: "-10%", left: "-10%", width: "70%", height: "70%",
            background: "radial-gradient(ellipse, rgba(224,83,43,0.10), transparent 65%)",
          }}
        />

        <div className="relative mx-auto max-w-7xl px-6 w-full py-20">
          <div className="grid grid-cols-1 lg:grid-cols-[52%_48%] gap-16 items-center">
            <div>
              <Reveal variant="fade">
                <p className="eyebrow mb-6">Hotel property management</p>
              </Reveal>
              <h1 className="mb-7">
                <SplitHeading as="span" className="font-display block text-[clamp(52px,7.5vw,100px)] leading-[0.98] font-medium text-ink">
                  Your hotel,
                </SplitHeading>
                <SplitHeading as="span" delay={0.3} className="font-display italic block text-[clamp(52px,7.5vw,100px)] leading-[0.98] font-medium text-coral-dark">
                  running itself.
                </SplitHeading>
              </h1>
              <Reveal delay={0.5}>
                <p className="text-[18px] text-ink-soft leading-relaxed max-w-md mb-10 font-body font-medium">
                  From check-in to checkout, reservations to room service — InnFlo connects every corner of your property in one dashboard.
                </p>
              </Reveal>
              <Reveal delay={0.62}>
                <div className="flex items-center gap-5 flex-wrap">
                  <MagneticButton>
                    <Link
                      to="/contact"
                      className="h-12 px-8 rounded-full text-[16px] font-semibold font-body text-white bg-coral hover:bg-coral-dark transition-colors shadow-pop flex items-center"
                    >
                      Request access
                    </Link>
                  </MagneticButton>
                  <Link
                    to="/pms"
                    className="h-12 px-2 text-[16px] font-medium text-ink-soft hover:text-coral-dark transition-colors font-body flex items-center gap-1.5 group"
                  >
                    See all features
                    <span className="transition-transform group-hover:translate-x-1">→</span>
                  </Link>
                </div>
              </Reveal>
            </div>

            <div style={{ marginRight: "clamp(-4rem, -4vw, 0px)" }}>
              <HeroMockup />
            </div>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-24 pointer-events-none" style={{ background: "linear-gradient(to bottom, transparent, #F5EBE4)" }} />
      </section>

      {/* ── REGIONS MARQUEE — thin, honest, breaks rhythm ─────────────────── */}
      <section className="border-y border-line bg-mist py-6 overflow-hidden">
        <div className="flex items-center gap-8">
          <p className="eyebrow whitespace-nowrap pl-6 shrink-0">Built for properties across —</p>
          <Marquee items={REGIONS} className="text-[15.5px] text-ink-soft font-body flex-1" />
        </div>
      </section>

      {/* ── BY THE NUMBERS — dark panel, deliberate break from the paper bg ─── */}
      <section className="py-20 px-6">
        <div className="mx-auto max-w-7xl">
          <Reveal variant="scale">
            <div className="relative overflow-hidden rounded-3xl bg-ink px-8 md:px-12 py-16">
              <div
                className="absolute inset-0 pointer-events-none opacity-[0.05]"
                style={{ backgroundImage: "radial-gradient(circle, #F5EBE4 1px, transparent 1px)", backgroundSize: "22px 22px" }}
              />
              <div
                className="absolute pointer-events-none"
                style={{ top: "-40%", right: "-10%", width: "55%", height: "160%", background: "radial-gradient(ellipse, rgba(224,83,43,0.28), transparent 65%)" }}
              />
              <div
                className="absolute pointer-events-none"
                style={{ bottom: "-45%", left: "-10%", width: "45%", height: "150%", background: "radial-gradient(ellipse, rgba(224,83,43,0.16), transparent 65%)" }}
              />

              <div className="relative grid grid-cols-2 lg:grid-cols-4 divide-y divide-x-0 lg:divide-y-0 lg:divide-x divide-white/10">
                {[
                  { value: "10", label: "Payment methods, one guest folio" },
                  { value: "100%", label: "Checkouts trigger a housekeeping task, automatically" },
                  { value: "100%", label: "POS orders post straight to the folio" },
                  { value: "24/7", label: "Real support, not a chatbot queue" },
                ].map((stat, i) => (
                  <Reveal key={stat.label} delay={i * 0.08} variant="rise" className="px-0 lg:px-8 py-6 lg:py-0 first:pl-0 last:pr-0">
                    <p className="font-display text-[clamp(38px,4.8vw,58px)] font-medium text-coral leading-none">{stat.value}</p>
                    <p className="text-[13.5px] font-body leading-snug mt-4 max-w-[200px]" style={{ color: "rgba(245,235,228,0.68)" }}>
                      {stat.label}
                    </p>
                  </Reveal>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── RUN THE FRONT OF HOUSE — tab block ──────────────────────────────── */}
      <TabbedFeatureBlock
        eyebrow="Run the front of house"
        headline="Everything the desk touches, in one place."
        mockupSide="left"
        mockupMinHeight="360px"
        tabs={[
          {
            label: "Front Desk",
            heading: "Every guest, one glance away.",
            copy: "Arrivals, departures, and room status for the whole day — check someone in without leaving this screen.",
            mockup: <FrontDeskMockup />,
          },
          {
            label: "Housekeeping",
            heading: "Keeps working when the Wi-Fi doesn't.",
            copy: "Staff mark rooms clean from their own phone, even offline — everything syncs the moment a signal comes back.",
            mockup: <HousekeepingMockup />,
          },
          {
            label: "Reports",
            heading: "The numbers, already done.",
            copy: "Occupancy, ADR, revenue, and profit — a finished report waiting for you, not a spreadsheet you have to build.",
            mockup: <ReportsSnapshotMockup />,
          },
          {
            label: "Team & Access",
            heading: "Every role, only what they need.",
            copy: "Owner, Manager, Front Desk, Housekeeping — each sees only the modules their job touches. Add staff without handing over the whole system.",
            mockup: <TeamAccessMockup />,
          },
          {
            label: "Channel Manager",
            heading: "Coming soon.",
            copy: "Direct two-way sync with Booking.com, Expedia, Agoda, and Airbnb is in development — not live yet, so we're not going to pretend it is.",
            mockup: <ChannelManagerComingSoonMockup />,
          },
        ]}
      />

      {/* ── WHO WE SERVE ──────────────────────────────────────────────────── */}
      <section className="py-24 px-6 bg-paper relative overflow-hidden">
        <div className="mx-auto max-w-7xl">
          <Reveal variant="fade" className="text-center mb-12">
            <p className="eyebrow text-[#0A5C53] mb-4">Who we serve</p>
            <h2 className="font-body text-[clamp(32px,4vw,44px)] font-bold text-ink tracking-tight mb-4">
              Built for every kind of stay
            </h2>
            <p className="text-[16.5px] text-ink-soft max-w-xl mx-auto leading-relaxed">
              From a single room to a global portfolio — and everything in between.
            </p>
          </Reveal>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
            {STAY_TYPES.map((type, index) => (
              <Reveal key={type.title} delay={index * 0.06} variant="rise" className="h-full">
                <Link to={type.to} className="relative aspect-[3/4] rounded-2xl overflow-hidden group shadow-card hover:shadow-float transition-all duration-300 cursor-pointer block">
                  {/* Background Image */}
                  <img
                    src={type.image}
                    alt={type.title}
                    loading="lazy"
                    decoding="async"
                    className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  {/* Gradient Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-black/50 z-10 group-hover:from-black/85 group-hover:via-black/40 group-hover:to-black/55 transition-all duration-300" />

                  {/* Card Content */}
                  <div className="absolute inset-0 p-5 flex flex-col justify-between z-20">
                    <div>
                      <h3 className="text-white text-[16px] font-bold tracking-tight mb-1 font-body leading-snug">
                        {type.title}
                      </h3>
                      <p className="text-white/80 text-[12px] leading-snug font-body">
                        {type.description}
                      </p>
                    </div>
                    <div className="flex justify-end mt-auto">
                      <div className="w-8 h-8 rounded-full bg-black/40 border border-white/20 text-white flex items-center justify-center transition-all duration-300 group-hover:bg-white group-hover:text-black">
                        <ArrowRight className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── TRUST — built for peace of mind ─────────────────────────────────── */}
      <section className="py-28">
        <div className="mx-auto max-w-7xl px-6">
          <Reveal variant="fade" className="text-center mb-16">
            <p className="eyebrow mb-4">Reliability</p>
            <h2 className="font-display text-[clamp(30px,4vw,44px)] font-medium leading-tight text-ink">
              Built for peace of mind.
            </h2>
          </Reveal>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-10 gap-y-12 items-stretch">
            {[
              {
                icon: CloudCog,
                title: "Powered by AWS",
                body: "InnFlo runs on Amazon Web Services — the same cloud infrastructure trusted by banks and governments.",
              },
              {
                icon: Activity,
                title: "99.9% uptime",
                body: "Monitored around the clock on infrastructure built to stay up — a stalled dashboard shouldn't be why a guest waits.",
              },
              {
                icon: ShieldCheck,
                title: "Your data, walled off",
                body: "Tenant isolation enforced at the database level, encrypted end to end — one property's data never touches another's.",
              },
              {
                icon: LifeBuoy,
                title: "Real support, 24/7",
                body: "No chatbot loop, no ticket number to wait on. Message us and talk to someone who actually built the product.",
              },
            ].map((item, i) => (
              <Reveal key={item.title} delay={i * 0.06} variant="rise" className="h-full">
                <div className="h-full rounded-2xl border border-ink-faint hover:border-coral hover:shadow-float p-5 transition-all duration-300">
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

      {/* ── CTA — soft rounded panel, on-brand gradient ────────────────────── */}
      <section className="pb-24">
        <div className="mx-auto max-w-7xl px-6">
          <Reveal variant="scale">
            <div
              className="relative overflow-hidden rounded-3xl px-10 py-16 sm:px-16 sm:py-20"
              style={{ background: "linear-gradient(135deg, #9E3417, #E0532B)" }}
            >
              <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10" />
              <div className="absolute -right-6 bottom-[-4rem] h-40 w-40 rounded-full bg-white/10" />
              <div className="relative max-w-xl">
                <h2 className="font-display text-[clamp(32px,4vw,48px)] font-medium text-white leading-tight mb-6">
                  Purpose-built for properties that don't fit the enterprise template.
                </h2>
                <p className="text-[16.5px] font-body mb-9 leading-relaxed" style={{ color: "rgba(255,255,255,0.82)" }}>
                  Flat monthly pricing. No per-booking commission. No minimum contract. Built for hotels that need real software without the corporate overhead.
                </p>
                <div className="flex items-center gap-6 flex-wrap">
                  <MagneticButton>
                    <Link
                      to="/contact"
                      className="h-12 px-8 rounded-full text-[16px] font-semibold font-body bg-white text-coral-deep hover:bg-paper transition-colors flex items-center"
                    >
                      Request early access
                    </Link>
                  </MagneticButton>
                  <Link to="/pricing" className="text-[16px] text-white/85 hover:text-white font-body transition-colors">
                    See pricing →
                  </Link>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── FAQ — got a question ────────────────────────────────────────────── */}
      <section className="py-24 bg-paper">
        <div className="mx-auto max-w-4xl px-6">
          <Reveal variant="fade" className="text-center mb-14">
            <h2 className="font-display text-[clamp(30px,4vw,44px)] font-medium leading-tight text-ink">
              Got a question?
            </h2>
          </Reveal>

          <Reveal variant="rise">
            <div className="rounded-3xl bg-card shadow-float overflow-hidden">
              {FAQS.map((item, i) => (
                <FaqRow
                  key={item.q}
                  q={item.q}
                  a={item.a}
                  isLast={i === FAQS.length - 1}
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
