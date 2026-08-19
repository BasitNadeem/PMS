import { useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import Reveal from "../components/motion/Reveal";
import SplitHeading from "../components/motion/SplitHeading";
import MagneticButton from "../components/motion/MagneticButton";
import Marquee from "../components/motion/Marquee";
import { ArrowRight, ShieldCheck, LifeBuoy, Cloud, Activity, Plus, Check, X } from "lucide-react";
import TabbedFeatureBlock from "../components/features/TabbedFeatureBlock";
import ProductCockpit from "../components/ProductCockpit";
import {
  FrontDeskMockup, BookingEngineMockup, HousekeepingMockup, ReportsSnapshotMockup, ChannelManagerComingSoonMockup, TeamAccessMockup,
} from "../components/features/HomeTabMockups";

const REGIONS = [
  "Lahore",
  "Hunza",
  "Karachi",
  "Skardu",
  "Islamabad",
  "Naran",
  "Peshawar",
  "Gilgit",
  "Multan",
  "Swat",
  "Faisalabad",
  "Murree",
  "Quetta",
  "Fairy Meadows",
  "Rawalpindi",
  "Kaghan",
];

const SHIFTS: { before: string; after: string }[] = [
  {
    before: "Bookings scattered across a register, WhatsApp and somebody's notebook",
    after: "Every booking in one list — walk-in, phone or your own website",
  },
  {
    before: "The desk phones housekeeping to ask whether 204 is ready yet",
    after: "Cleaners update room status from their own phone, even offline",
  },
  {
    before: "Guest bills added up by hand from a pile of paper slips",
    after: "An itemised folio is ready the moment they ask to check out",
  },
  {
    before: "Commission taken out of every booking that arrives through an OTA",
    after: "Your own branded booking site takes zero commission",
  },
  {
    before: "Month-end means a late night with a calculator and a spreadsheet",
    after: "Occupancy, ADR and revenue are already written when you open them",
  },
];

const STAY_TYPES = [
  {
    title: "Hotels",
    description: "Independent hotels, boutiques, lodges and resorts",
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
    description: "Serviced apartments and independent rental units",
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

// ─── FAQ ────────────────────────────────────────────────────────────────────
const FAQS = [
  {
    q: "What is Innflo?",
    a: "Innflo is hotel property management software — reservations, billing, housekeeping, QR dining, and reporting in one dashboard, built specifically for small, independently-run properties rather than large city hotel chains.",
  },
  {
    q: "Which types of properties can use Innflo?",
    a: "Independent hotels, B&Bs and guesthouses, hostels, serviced apartments, lodges, resorts, and glamping sites. Innflo is focused on one property per hotel account today.",
  },
  {
    q: "Does Innflo work when the internet is unreliable?",
    a: "Yes. Housekeeping runs offline-first, so staff can keep checking off rooms with no signal, and everything syncs the moment connection returns — built for the connectivity that mountain and rural properties actually have.",
  },
  {
    q: "How is Innflo priced?",
    a: "Three flat monthly plans — Essentials, Growth, and Complete — with no commission on direct bookings and no per-booking cut.",
  },
  {
    q: "Is Innflo ready for my property today?",
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
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <div className="bg-paper text-ink">

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex items-center pt-20 overflow-hidden">
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
          <div className="grid grid-cols-1 lg:grid-cols-[44fr_56fr] [&>*]:min-w-0 gap-12 xl:gap-16 items-center">
            <div>
              <Reveal variant="fade">
                <p className="eyebrow mb-6">Hotel property management</p>
              </Reveal>
              <h1 className="mb-7">
                <SplitHeading as="span" className="font-display block text-[clamp(52px,7.5vw,100px)] leading-[0.98] font-medium text-ink">
                  Your hotel,
                </SplitHeading>
                <SplitHeading as="span" delay={0.3} className="font-display italic block text-[clamp(52px,7.5vw,100px)] leading-[0.98] font-medium text-coral-dark">
                  finally in flow.
                </SplitHeading>
              </h1>
              <Reveal delay={0.5}>
                <p className="text-[18px] text-ink-soft leading-relaxed max-w-md mb-10 font-body font-medium">
                  Reservations, rooms, guests, folios, housekeeping, dining and reporting—one calm operating system for independent hotels.
                </p>
              </Reveal>
              <Reveal delay={0.62}>
                <div className="flex items-center gap-5 flex-wrap">
                  <MagneticButton>
                    <Link
                      to="/contact"
                      className="h-12 px-8 rounded-full text-[16px] font-semibold font-body text-white bg-coral hover:bg-coral-dark transition-colors shadow-pop flex items-center"
                    >
                      Book a walkthrough
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

            <div className="min-w-0">
              <ProductCockpit />
            </div>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-24 pointer-events-none" style={{ background: "linear-gradient(to bottom, transparent, #F5EBE4)" }} />
      </section>

      {/* ── REGIONS MARQUEE — thin, honest, breaks rhythm ─────────────────── */}
      <section className="border-y border-line bg-mist py-6 overflow-hidden">
        <div className="flex items-center gap-8">
          <p className="eyebrow whitespace-nowrap pl-6 shrink-0">Built for properties across —</p>
          <Marquee items={REGIONS} speed={64} className="text-[15.5px] text-ink-soft font-body flex-1" />
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
                  { value: "26+", label: "Operational and management reports" },
                  { value: "1", label: "Checkout action creates the next cleaning task" },
                  { value: "<1s", label: "For booking alerts to reach every open front-desk screen" },
                  { value: "0%", label: "Commission on your direct Booking Engine reservations" },
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
        mockupMinHeight="420px"
        tabs={[
          {
            label: "Front Desk",
            heading: "Every guest, one glance away.",
            copy: "Arrivals, departures, and room status for the whole day — check someone in without leaving this screen.",
            mockup: <FrontDeskMockup />,
            learnMoreTo: "/pms",
          },
          {
            label: "Booking Engine",
            heading: "Your own booking site, zero commission.",
            copy: "Guests pick their dates, room and extras on your branded site — the reservation lands on the front desk instantly, and none of it goes to an OTA.",
            mockup: <BookingEngineMockup />,
            learnMoreTo: "/booking-engine",
          },
          {
            label: "Housekeeping",
            heading: "Keeps working when the Wi-Fi doesn't.",
            copy: "Staff mark rooms clean from their own phone, even offline — everything syncs the moment a signal comes back.",
            mockup: <HousekeepingMockup />,
            learnMoreTo: "/pms",
          },
          {
            label: "Reports",
            heading: "The numbers, already done.",
            copy: "Occupancy, ADR, revenue, and profit — a finished report waiting for you, not a spreadsheet you have to build.",
            mockup: <ReportsSnapshotMockup />,
            learnMoreTo: "/statistics",
          },
          {
            label: "Team & Access",
            heading: "Every role, only what they need.",
            copy: "Owner, Manager, Front Desk, Housekeeping — each sees only the modules their job touches. Add staff without handing over the whole system.",
            mockup: <TeamAccessMockup />,
            learnMoreTo: "/pms",
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

      {/* ── WHO WE SERVE ──────────────────────────────────────────────────── */}
      <section className="py-24 px-6 bg-paper relative overflow-hidden">
        <div className="mx-auto max-w-7xl">
          <Reveal variant="fade" className="text-center mb-12">
            <p className="eyebrow text-[#0A5C53] mb-4">Who we serve</p>
            <h2 className="font-body text-[clamp(32px,4vw,44px)] font-bold text-ink tracking-tight mb-4">
              Built for every kind of stay
            </h2>
            <p className="text-[16.5px] text-ink-soft max-w-xl mx-auto leading-relaxed">
              Purpose-built for independent properties that want one dependable source of truth.
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

      {/* ── BEFORE / AFTER — the same week, run two ways ────────────────────── */}
      <section className="px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <Reveal variant="fade" className="mb-14 text-center">
            <p className="eyebrow mb-4">The difference</p>
            <h2 className="font-display text-[clamp(32px,4.6vw,50px)] font-medium leading-tight text-ink">
              The same week, run two ways.
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-[16.5px] leading-relaxed text-ink-soft">
              Not a wishlist — this is the everyday friction that goes away once the property is on one system.
            </p>
          </Reveal>

          <div className="relative grid gap-5 lg:grid-cols-2 lg:gap-7">
            <Reveal variant="rise" className="h-full">
              <div className="h-full rounded-[28px] border border-line bg-mist/60 p-7 sm:p-9">
                <div className="mb-8 flex items-center gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-line bg-white text-ink-mute">
                    <X className="h-4 w-4" strokeWidth={3} />
                  </span>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-ink-mute">Before Innflo</p>
                    <p className="font-display text-[19px] font-medium text-ink-soft">Held together by memory</p>
                  </div>
                </div>
                <ul className="space-y-5">
                  {SHIFTS.map((shift, i) => (
                    <li key={shift.before}>
                      <Reveal delay={0.1 * i} variant="rise" className="flex gap-3 items-start group cursor-default">
                        <X className="mt-[3px] h-4 w-4 shrink-0 text-red-400/50 transition-colors duration-300 group-hover:text-red-400" strokeWidth={3} />
                        <span className="text-[14.5px] leading-relaxed text-ink-mute transition-colors duration-300 group-hover:text-ink-soft">{shift.before}</span>
                      </Reveal>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>

            <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 hidden -translate-x-1/2 -translate-y-1/2 lg:block">
              <span className="grid h-12 w-12 place-items-center rounded-full border-4 border-paper bg-coral text-white shadow-pop">
                <ArrowRight className="h-5 w-5" strokeWidth={2.5} />
              </span>
            </div>

            <Reveal variant="rise" delay={0.12} className="h-full">
              <div className="relative h-full overflow-hidden rounded-[28px] bg-ink p-7 text-white shadow-hero sm:p-9">
                <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-coral/20 blur-3xl" />
                <div className="relative">
                  <div className="mb-8 flex items-center gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-coral text-white">
                      <Check className="h-4 w-4" strokeWidth={3} />
                    </span>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-coral">After Innflo</p>
                      <p className="font-display text-[19px] font-medium text-white">One source of truth</p>
                    </div>
                  </div>
                  <ul className="space-y-5">
                    {SHIFTS.map((shift, i) => (
                      <li key={shift.after}>
                        <Reveal delay={0.2 + (0.1 * i)} variant="rise" className="flex gap-3 items-start group cursor-default">
                          <Check className="mt-[3px] h-4 w-4 shrink-0 text-coral transition-transform duration-300 group-hover:scale-125" strokeWidth={3} />
                          <span className="text-[14.5px] leading-relaxed text-white/80 transition-colors duration-300 group-hover:text-white">{shift.after}</span>
                        </Reveal>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </Reveal>
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
                icon: Cloud,
                title: "Secure cloud delivery",
                body: "Managed infrastructure, encrypted HTTPS connections, and monitored services keep your team working without maintaining a server.",
              },
              {
                icon: Activity,
                title: "Built for daily operations",
                body: "Fast route-based loading, production monitoring, and a phone-first housekeeping PWA designed for the realities of hotel work.",
              },
              {
                icon: ShieldCheck,
                title: "Your data, walled off",
                body: "Authenticated hotel scoping, role permissions, and explicit tenant filters keep one property's operating data out of another's workspace.",
              },
              {
                icon: LifeBuoy,
                title: "Human product support",
                body: "Talk to the small team building Innflo. We can explain the workflow, help with setup, and tell you honestly what is ready.",
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
                      Book a product walkthrough
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
