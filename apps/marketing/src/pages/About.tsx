import { Link } from "react-router-dom";
import {
  ArrowRight,
  BellRing,
  CheckCircle2,
  Cloud,
  Hotel,
  KeyRound,
  MapPin,
  MessageSquareText,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import Reveal from "../components/motion/Reveal";
import SplitHeading from "../components/motion/SplitHeading";

const PRINCIPLES = [
  {
    icon: Hotel,
    title: "Manager-first",
    copy: "The important question is not how many features fit in a menu. It is whether a manager can understand the property before the first cup of chai.",
  },
  {
    icon: MessageSquareText,
    title: "Familiar workflows",
    copy: "Innflo replaces the paper register, spreadsheet and WhatsApp guessing game without asking the team to become software experts.",
  },
  {
    icon: ShieldCheck,
    title: "Control without complexity",
    copy: "Tenant isolation, role permissions and an audit trail sit underneath a product that still feels straightforward at the front desk.",
  },
];

const FLOW = [
  { time: "08:12", label: "Direct booking received", detail: "Reservation, rate and guest details arrive together.", icon: BellRing },
  { time: "11:00", label: "Room turns over", detail: "Checkout moves the room into the housekeeping flow.", icon: KeyRound },
  { time: "17:40", label: "Manager closes the loop", detail: "Folios, cash, reports and handover notes stay in one record.", icon: CheckCircle2 },
];

export default function About() {
  return (
    <div className="bg-paper text-ink">
      <section className="relative overflow-hidden bg-grid px-6 pb-24 pt-40">
        <div className="absolute -right-40 top-28 h-[430px] w-[430px] rounded-full bg-coral/10 blur-3xl" />
        <div className="relative mx-auto grid max-w-6xl gap-14 lg:grid-cols-[1.05fr_.95fr] lg:items-center">
          <div>
            <Reveal><p className="eyebrow mb-6">Why Innflo exists</p></Reveal>
            <h1 className="font-display text-[clamp(44px,6.5vw,76px)] font-medium leading-[.98]">
              <SplitHeading as="span" className="block">Hotel software for</SplitHeading>
              <SplitHeading as="span" delay={0.2} className="block italic text-coral-dark">the people on the floor.</SplitHeading>
            </h1>
            <Reveal delay={0.4}>
              <p className="mt-7 max-w-xl font-body text-[17px] leading-relaxed text-ink-soft">
                Innflo is a manager-first operating system for independent hotels—starting with the properties that make Pakistan’s mountain tourism unforgettable.
              </p>
            </Reveal>
            <Reveal delay={0.48}>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link to="/pms" className="inline-flex h-12 items-center rounded-full bg-coral px-7 text-[14px] font-bold text-white shadow-pop hover:bg-coral-dark">
                  Explore the product <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
                <Link to="/contact" className="inline-flex h-12 items-center rounded-full border border-line bg-white px-7 text-[14px] font-bold text-ink hover:border-ink">
                  Talk about your hotel
                </Link>
              </div>
            </Reveal>
          </div>

          <Reveal delay={0.2}>
            <div className="relative overflow-hidden rounded-[30px] bg-ink p-6 text-white shadow-hero sm:p-8">
              <div className="mb-8 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[.16em] text-coral">A day in flow</p>
                  <p className="mt-2 font-display text-[28px] font-medium">The hotel keeps moving.</p>
                </div>
                <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white/10">
                  <Sparkles className="h-5 w-5 text-coral" />
                </div>
              </div>
              <div className="space-y-3">
                {FLOW.map(({ time, label, detail, icon: Icon }, index) => (
                  <div key={label} className="relative flex gap-4 rounded-2xl border border-white/10 bg-white/[.055] p-4">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-coral/15">
                      <Icon className="h-4 w-4 text-coral" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <p className="text-[13px] font-bold text-white">{label}</p>
                        <span className="text-[10px] font-semibold text-white/35">{time}</span>
                      </div>
                      <p className="mt-1 text-[12px] leading-relaxed text-white/55">{detail}</p>
                    </div>
                    {index < FLOW.length - 1 && <span className="absolute -bottom-3 left-9 h-3 w-px bg-white/20" />}
                  </div>
                ))}
              </div>
              <div className="mt-6 flex items-center justify-between rounded-2xl bg-coral p-4">
                <p className="text-[12px] font-bold">One source of truth. No group-chat archaeology.</p>
                <ArrowRight className="h-4 w-4" />
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-14 lg:grid-cols-[.8fr_1.2fr] lg:items-start">
            <Reveal>
              <p className="eyebrow mb-5">The starting point</p>
              <h2 className="font-display text-[clamp(34px,5vw,54px)] font-medium leading-[1.04]">Informal tools are flexible. They are also invisible.</h2>
            </Reveal>
            <Reveal delay={0.1} className="space-y-6 font-body text-[17px] leading-[1.8] text-ink-soft">
              <p>
                Independent hotels are often held together by capable people using paper registers, spreadsheets, calls and WhatsApp. Those tools feel easy until availability changes, a payment is missed, a room is not cleaned, or the manager needs a reliable answer from yesterday.
              </p>
              <p>
                Enterprise PMS products solve a different problem. They assume specialist teams, complex integrations and a software budget shaped around international chains. Innflo sits between those worlds: serious operational control with a learning curve that respects a busy hotel team.
              </p>
              <p>
                We are early, actively built, and honest about what is live. Channel distribution and deeper guest messaging are roadmap work; reservations, hotel operations, direct booking, financial control, POS, QR ordering, inventory and reporting are here today.
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      <section className="bg-mist px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <Reveal className="mb-12 max-w-2xl">
            <p className="eyebrow mb-4">Product principles</p>
            <h2 className="font-display text-[clamp(34px,5vw,54px)] font-medium leading-tight">Built around the shift, not the sales deck.</h2>
          </Reveal>
          <div className="grid gap-5 md:grid-cols-3">
            {PRINCIPLES.map(({ icon: Icon, title, copy }, index) => (
              <Reveal key={title} delay={index * 0.08}>
                <article className="h-full rounded-[26px] border border-line bg-white p-7 shadow-card">
                  <div className="grid h-11 w-11 place-items-center rounded-2xl bg-coral-soft">
                    <Icon className="h-5 w-5 text-coral-dark" />
                  </div>
                  <h3 className="mt-7 font-display text-[27px] font-medium">{title}</h3>
                  <p className="mt-3 text-[14px] leading-relaxed text-ink-soft">{copy}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-24">
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-2">
          <Reveal>
            <div className="h-full rounded-[30px] bg-[#183B38] p-8 text-white sm:p-10">
              <Cloud className="h-7 w-7 text-coral" />
              <h2 className="mt-8 font-display text-[38px] font-medium leading-tight">Cloud access. Property-level isolation.</h2>
              <p className="mt-5 text-[14px] leading-relaxed text-white/65">
                Staff sign in to their hotel account, roles control what each person can do, and tenant identity comes from authenticated access—not a browser hostname or a client-supplied hotel ID.
              </p>
              <div className="mt-8 grid grid-cols-2 gap-3 text-[12px] font-semibold">
                {["Role permissions", "Audit history", "Hotel-scoped data", "Secure sign-in"].map((item) => (
                  <span key={item} className="flex items-center gap-2 rounded-xl bg-white/[.07] px-3 py-3">
                    <CheckCircle2 className="h-3.5 w-3.5 text-coral" /> {item}
                  </span>
                ))}
              </div>
            </div>
          </Reveal>
          <Reveal delay={0.08}>
            <div className="h-full rounded-[30px] border border-line bg-card p-8 sm:p-10">
              <MapPin className="h-7 w-7 text-coral-dark" />
              <h2 className="mt-8 font-display text-[38px] font-medium leading-tight">Pakistan-first. Hospitality-minded.</h2>
              <p className="mt-5 text-[14px] leading-relaxed text-ink-soft">
                PKR, JazzCash, EasyPaisa, GST/PST settings and the realities of seasonal independent properties are part of the product context—not an afterthought in a global localization menu.
              </p>
              <p className="mt-7 border-t border-line pt-6 text-[13px] leading-relaxed text-ink-mute">
                Starting in Hunza, Skardu, Naran and Swat, with city hotels and regional markets next.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

    </div>
  );
}
