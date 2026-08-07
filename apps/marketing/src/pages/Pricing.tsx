import { Fragment, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight, Check, CheckCircle2, Minus, Plus, Sparkles,
} from "lucide-react";
import Reveal from "../components/motion/Reveal";
import SplitHeading from "../components/motion/SplitHeading";

type Cycle = "monthly" | "yearly";

const YEARLY_DISCOUNT = 0.15;

type Tier = {
  name: string;
  monthly: number | null;
  eyebrow: string;
  description: string;
  bestFor: string;
  scale: string;
  cta: string;
  ctaTo: string;
  badge?: string;
  featured?: boolean;
  features: string[];
};

const TIERS: Tier[] = [
  {
    name: "Essentials",
    monthly: 8000,
    eyebrow: "Run the desk",
    description: "A dependable daily operating system for a small independent property.",
    bestFor: "Guesthouses, lodges and small hotels moving off paper or spreadsheets.",
    scale: "Up to 25 rooms · 5 staff accounts",
    cta: "Start free trial",
    ctaTo: "/contact",
    features: [
      "Reservation calendar and room availability",
      "Guest profiles and stay history",
      "Folios, payments and printable invoices",
      "Room status and housekeeping workflow",
      "Daily dashboard and operating report",
      "Core staff roles and permissions",
    ],
  },
  {
    name: "Growth",
    monthly: 18000,
    eyebrow: "See the whole business",
    description: "More control for the manager who runs operations and watches the numbers.",
    bestFor: "Busy independent hotels with several departments and direct bookings.",
    scale: "Up to 80 rooms · 20 staff accounts",
    cta: "Start free trial",
    ctaTo: "/contact",
    badge: "Most popular",
    featured: true,
    features: [
      "Everything in Essentials",
      "Public Booking Engine with multi-room cart",
      "Rate plans and promotional codes",
      "Groups, maintenance and shift handovers",
      "Expenses, cash book and night audit",
      "26+ performance and control reports",
      "Audit log and custom role controls",
    ],
  },
  {
    name: "Complete",
    monthly: 32000,
    eyebrow: "Connect every department",
    description: "The full InnFlo operating stack for properties with food, inventory and QR service.",
    bestFor: "Hotels with a restaurant, kitchen, room service or stock operations.",
    scale: "Unlimited rooms · unlimited staff",
    cta: "Start free trial",
    ctaTo: "/contact",
    features: [
      "Everything in Growth",
      "Point of Sale and direct folio posting",
      "Guest QR menu and ordering",
      "Kitchen display board",
      "Inventory, recipes and stock movement",
      "Housekeeping mobile PWA and push alerts",
      "Guided onboarding and priority support",
    ],
  },
  {
    name: "Enterprise",
    monthly: null,
    eyebrow: "Run a portfolio",
    description: "For groups running several properties under one finance and reporting structure.",
    bestFor: "Hotel groups, resort chains and managed-property operators.",
    scale: "Multi-property · custom limits",
    cta: "Talk to sales",
    ctaTo: "/contact",
    badge: "Custom",
    features: [
      "Everything in Complete",
      "Multi-property dashboard and switching",
      "Consolidated group financial reporting",
      "Dedicated onboarding and data migration",
      "Named account manager",
      "Self-hosted or private deployment option",
      "Custom SLA and support hours",
    ],
  },
];

type Cell = boolean | string;

const COMPARISON: { category: string; rows: { label: string; values: Cell[] }[] }[] = [
  {
    category: "Property & reservations",
    rows: [
      { label: "Reservation calendar & availability", values: [true, true, true, true] },
      { label: "Guest profiles & stay history", values: [true, true, true, true] },
      { label: "Housekeeping operations", values: [true, true, true, true] },
      { label: "Groups, maintenance & shift handover", values: [false, true, true, true] },
      { label: "Rooms included", values: ["25", "80", "Unlimited", "Unlimited"] },
    ],
  },
  {
    category: "Distribution",
    rows: [
      { label: "Public Booking Engine", values: [false, true, true, true] },
      { label: "Rate plans & promo codes", values: [false, true, true, true] },
      { label: "Commission on direct bookings", values: ["None", "None", "None", "None"] },
      { label: "Channel Manager (OTA sync)", values: ["Roadmap", "Roadmap", "Roadmap", "Roadmap"] },
    ],
  },
  {
    category: "Food & beverage",
    rows: [
      { label: "Point of Sale & folio posting", values: [false, false, true, true] },
      { label: "Guest QR menu & ordering", values: [false, false, true, true] },
      { label: "Kitchen display board", values: [false, false, true, true] },
      { label: "Inventory & recipe linkage", values: [false, false, true, true] },
    ],
  },
  {
    category: "Finance & reporting",
    rows: [
      { label: "Folios, billing & payments", values: [true, true, true, true] },
      { label: "Expenses, cash book & night audit", values: [false, true, true, true] },
      { label: "Full report library & exports", values: [false, true, true, true] },
      { label: "Consolidated group reporting", values: [false, false, false, true] },
      { label: "Audit log & custom roles", values: [false, true, true, true] },
    ],
  },
  {
    category: "Support & setup",
    rows: [
      { label: "Guided configuration", values: [true, true, true, true] },
      { label: "Support response", values: ["Standard", "Standard", "Priority", "Custom SLA"] },
      { label: "Data migration assistance", values: [false, false, true, true] },
      { label: "Named account manager", values: [false, false, false, true] },
    ],
  },
];

const FAQS = [
  {
    q: "Is there a setup fee or a long contract?",
    a: "No setup fee and no long-term lock-in. We help configure the hotel, then bill monthly. If InnFlo is not the right fit, you can leave without a cancellation penalty.",
  },
  {
    q: "How does yearly billing work?",
    a: "Yearly plans are paid once for twelve months and take 15% off the monthly rate. You can start monthly and switch to yearly later—we credit the unused portion of the month you are in.",
  },
  {
    q: "Can I change plans as the hotel grows?",
    a: "Yes, in both directions. Upgrades take effect immediately and are prorated. Downgrades apply at the start of the next billing period, and nothing is deleted when a module becomes unavailable.",
  },
  {
    q: "Does InnFlo take commission on direct bookings?",
    a: "No. Reservations made through your InnFlo Booking Engine belong to your hotel. InnFlo does not take a percentage of the booking value.",
  },
  {
    q: "What happens during the trial?",
    a: "You get a real hotel account, guided setup, and enough time to run your own front-desk workflow. We do not ask for a card before the trial starts.",
  },
  {
    q: "Who owns the data?",
    a: "Your hotel does. You can export reservations, guests, folios and reports at any time, and we hand over a full dump if you decide to leave.",
  },
  {
    q: "Are taxes and local payment methods supported?",
    a: "Yes. Each hotel configures its own GST/PST behavior, tax-inclusive pricing, POS tax, and operational payment methods including cash, bank transfer, JazzCash and EasyPaisa.",
  },
  {
    q: "Is Channel Manager included?",
    a: "Direct OTA synchronization is on the roadmap and is clearly marked as not live. It is not counted as part of the value in the plans shown above.",
  },
  {
    q: "Can you price a larger or unusual property?",
    a: "Yes. If your property has an unusual room count or operating model, contact us. We would rather quote a fair plan than force a poor fit.",
  },
  {
    q: "How long does onboarding take?",
    a: "A small property is usually live within a week. Hotels bringing across historical data, POS menus and stock records typically take two to three weeks.",
  },
];

function priceFor(tier: Tier, cycle: Cycle) {
  if (tier.monthly === null) return null;
  const value = cycle === "yearly" ? tier.monthly * (1 - YEARLY_DISCOUNT) : tier.monthly;
  return Math.round(value / 100) * 100;
}

function BillingToggle({ cycle, onChange }: { cycle: Cycle; onChange: (next: Cycle) => void }) {
  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-line bg-card p-1 shadow-pop">
      {(["monthly", "yearly"] as const).map((option) => (
        <button
          key={option}
          onClick={() => onChange(option)}
          className={`relative rounded-full px-5 py-2 text-[13px] font-bold capitalize transition-colors ${
            cycle === option ? "text-white" : "text-ink-soft hover:text-ink"
          }`}
        >
          {cycle === option && (
            <motion.span
              layoutId="cycle-pill"
              className="absolute inset-0 rounded-full bg-ink"
              transition={{ type: "spring", stiffness: 420, damping: 34 }}
            />
          )}
          <span className="relative">{option}</span>
        </button>
      ))}
      <span className="ml-1 mr-2 text-[11px] font-bold uppercase tracking-wider text-coral-dark">
        Save 15%
      </span>
    </div>
  );
}

function CompareCell({ value }: { value: Cell }) {
  if (value === true) return <Check className="mx-auto h-4 w-4 text-[#2F7256]" strokeWidth={3} />;
  if (value === false) return <Minus className="mx-auto h-4 w-4 text-ink-faint" />;
  return <span className="text-[12px] font-bold text-ink-soft">{value}</span>;
}

function Faq({ item, open, onToggle }: { item: (typeof FAQS)[number]; open: boolean; onToggle: () => void }) {
  return (
    <div className="border-b border-line-soft last:border-0">
      <button onClick={onToggle} className="flex w-full items-center justify-between gap-5 px-6 py-5 text-left sm:px-8">
        <span className="font-body text-[16px] font-bold text-ink">{item.q}</span>
        <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full bg-coral text-white transition-transform ${open ? "rotate-45" : ""}`}>
          <Plus className="h-3 w-3" strokeWidth={3} />
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <p className="px-6 pb-6 pr-14 font-body text-[14px] leading-relaxed text-ink-soft sm:px-8">{item.a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function Pricing() {
  const [openFaq, setOpenFaq] = useState(0);
  const [cycle, setCycle] = useState<Cycle>("monthly");

  return (
    <div className="bg-paper text-ink">
      <section className="relative overflow-hidden bg-grid px-6 pb-16 pt-40">
        <div className="absolute left-1/2 top-0 h-[420px] w-[900px] -translate-x-1/2 rounded-full bg-coral/10 blur-3xl" />
        <div className="relative mx-auto max-w-4xl text-center">
          <Reveal><p className="eyebrow mb-6">Simple launch pricing</p></Reveal>
          <h1 className="font-display text-[clamp(44px,7vw,76px)] font-medium leading-[.98]">
            <SplitHeading as="span" className="block">Pay for the operation</SplitHeading>
            <SplitHeading as="span" delay={0.2} className="block italic text-coral-dark">you actually run.</SplitHeading>
          </h1>
          <Reveal delay={0.4}>
            <p className="mx-auto mt-7 max-w-2xl font-body text-[17px] leading-relaxed text-ink-soft">
              Flat plans, no per-booking commission, and no invented value from features that are still on the roadmap.
            </p>
          </Reveal>
          <Reveal delay={0.5}>
            <div className="mt-9 flex justify-center">
              <BillingToggle cycle={cycle} onChange={setCycle} />
            </div>
          </Reveal>
          <Reveal delay={0.6}>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[13px] font-semibold text-ink-soft">
              {["Guided trial account", "No card required", "No setup fee", "Cancel monthly"].map((item) => (
                <span key={item} className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-[#2F7256]" />{item}</span>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      <section className="px-6 pb-24">
        <div className="mx-auto grid max-w-7xl gap-5 md:grid-cols-2 lg:grid-cols-4 lg:items-start">
          {TIERS.map((tier, index) => {
            const price = priceFor(tier, cycle);
            return (
              <Reveal key={tier.name} delay={index * 0.07}>
                <article className={`relative flex min-h-[700px] flex-col overflow-hidden rounded-[26px] p-6 sm:p-7 ${
                  tier.featured ? "bg-ink text-white shadow-hero lg:-translate-y-3" : "border border-line bg-card shadow-card"
                }`}>
                  {tier.badge && (
                    <div className={`absolute right-0 top-0 rounded-bl-2xl px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-wider ${
                      tier.featured ? "bg-coral text-white" : "bg-mist text-coral-dark"
                    }`}>
                      {tier.badge}
                    </div>
                  )}
                  <p className={`text-[10px] font-bold uppercase tracking-[.18em] ${tier.featured ? "text-coral" : "text-coral-dark"}`}>{tier.eyebrow}</p>
                  <h2 className={`mt-3 font-display text-[30px] font-medium ${tier.featured ? "text-white" : "text-ink"}`}>{tier.name}</h2>
                  <p className={`mt-3 min-h-[80px] text-[13px] leading-relaxed ${tier.featured ? "text-white/65" : "text-ink-soft"}`}>{tier.description}</p>

                  <div className="mt-5 min-h-[74px]">
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.div
                        key={`${tier.name}-${cycle}`}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.22 }}
                      >
                        {price === null ? (
                          <span className={`font-display text-[36px] font-medium leading-none ${tier.featured ? "text-white" : "text-ink"}`}>Custom</span>
                        ) : (
                          <div className="flex items-end gap-1.5">
                            <span className={`font-display text-[36px] font-medium leading-none ${tier.featured ? "text-white" : "text-ink"}`}>
                              PKR {price.toLocaleString()}
                            </span>
                            <span className={`pb-1 text-[12px] ${tier.featured ? "text-white/50" : "text-ink-mute"}`}>/ mo</span>
                          </div>
                        )}
                        <p className={`mt-2 text-[11px] font-semibold ${tier.featured ? "text-white/45" : "text-ink-mute"}`}>
                          {price === null
                            ? "Quoted per portfolio"
                            : cycle === "yearly"
                              ? `Billed yearly · PKR ${(price * 12).toLocaleString()}`
                              : "Billed monthly"}
                        </p>
                      </motion.div>
                    </AnimatePresence>
                  </div>

                  <Link
                    to={tier.ctaTo}
                    className={`mt-5 flex h-12 items-center justify-center rounded-full text-[14px] font-bold transition-colors ${
                      tier.featured ? "bg-coral text-white hover:bg-coral-dark" : "bg-ink text-white hover:bg-ink-soft"
                    }`}
                  >
                    {tier.cta} <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>

                  <p className={`mt-4 text-center text-[11px] font-bold ${tier.featured ? "text-white/45" : "text-ink-mute"}`}>{tier.scale}</p>

                  <div className={`my-6 h-px ${tier.featured ? "bg-white/12" : "bg-line"}`} />
                  <p className={`mb-4 text-[11px] font-bold uppercase tracking-wider ${tier.featured ? "text-white/45" : "text-ink-faint"}`}>What’s included</p>
                  <ul className="space-y-2.5">
                    {tier.features.map((feature) => (
                      <li key={feature} className={`flex gap-2.5 text-[13px] leading-relaxed ${tier.featured ? "text-white/78" : "text-ink-soft"}`}>
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-coral" strokeWidth={2.5} />{feature}
                      </li>
                    ))}
                  </ul>
                  <div className={`mt-auto rounded-2xl p-4 ${tier.featured ? "bg-white/[0.06]" : "bg-mist"}`}>
                    <p className={`text-[10px] font-bold uppercase tracking-wider ${tier.featured ? "text-white/40" : "text-ink-faint"}`}>Best for</p>
                    <p className={`mt-2 text-[12px] leading-relaxed ${tier.featured ? "text-white/68" : "text-ink-soft"}`}>{tier.bestFor}</p>
                  </div>
                </article>
              </Reveal>
            );
          })}
        </div>
      </section>

      <section className="bg-mist px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <Reveal className="mb-12 max-w-2xl">
            <p className="eyebrow mb-4">Compare plans</p>
            <h2 className="font-display text-[clamp(34px,5vw,52px)] font-medium leading-tight">The useful detail, without the maze.</h2>
          </Reveal>
          <Reveal>
            <div className="overflow-x-auto rounded-3xl border border-line bg-white shadow-card">
              <table className="w-full min-w-[820px] border-collapse">
                <thead>
                  <tr className="border-b border-line bg-paper">
                    <th className="px-6 py-5 text-left text-[11px] uppercase tracking-wider text-ink-mute">Capability</th>
                    {TIERS.map((tier) => (
                      <th key={tier.name} className="px-4 py-5 text-center">
                        <span className={`font-display text-[19px] font-medium ${tier.featured ? "text-coral-dark" : "text-ink"}`}>{tier.name}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON.map((group) => (
                    <Fragment key={group.category}>
                      <tr className="bg-mist/70">
                        <td colSpan={TIERS.length + 1} className="px-6 py-3 text-[10px] font-bold uppercase tracking-[.16em] text-coral-dark">
                          {group.category}
                        </td>
                      </tr>
                      {group.rows.map((row) => (
                        <tr key={row.label} className="border-b border-line-soft last:border-0">
                          <td className="px-6 py-3.5 text-[13px] font-semibold text-ink-soft">{row.label}</td>
                          {row.values.map((value, index) => (
                            <td key={TIERS[index]?.name ?? String(index)} className="px-4 py-3.5 text-center">
                              <CompareCell value={value} />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="px-6 py-24">
        <Reveal className="mx-auto max-w-6xl">
          <div className="grid gap-8 overflow-hidden rounded-[32px] bg-[#183B38] p-8 text-white sm:p-12 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-coral">
                <Sparkles className="h-3.5 w-3.5" /> Roadmap stays separate
              </div>
              <h2 className="max-w-2xl font-display text-[clamp(30px,4vw,46px)] font-medium leading-tight">Channel Manager is coming—but you are not paying for a promise.</h2>
              <p className="mt-4 max-w-2xl text-[14px] leading-relaxed text-white/65">
                Direct OTA synchronization is in development. Today’s plans are priced around modules that are already built and usable.
              </p>
            </div>
            <Link to="/channel-manager" className="inline-flex h-12 items-center justify-center rounded-full border border-white/25 px-6 text-[13px] font-bold text-white hover:bg-white/10">
              View the roadmap <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </div>
        </Reveal>
      </section>

      <section className="bg-paper px-6 pb-28">
        <div className="mx-auto max-w-4xl">
          <Reveal className="mb-10 text-center">
            <p className="eyebrow mb-4">Questions before you commit</p>
            <h2 className="font-display text-[clamp(34px,5vw,50px)] font-medium">Plain answers.</h2>
          </Reveal>
          <Reveal>
            <div className="overflow-hidden rounded-3xl border border-line bg-card shadow-float">
              {FAQS.map((item, index) => <Faq key={item.q} item={item} open={openFaq === index} onToggle={() => setOpenFaq(openFaq === index ? -1 : index)} />)}
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="mt-10 flex flex-col items-center gap-4 rounded-3xl bg-grid border border-line px-8 py-10 text-center">
              <h3 className="font-display text-[26px] font-medium">Still not sure which plan fits?</h3>
              <p className="max-w-md text-[14px] leading-relaxed text-ink-soft">
                Tell us the room count and which departments you run. We will point you at the smallest plan that covers it.
              </p>
              <Link to="/contact" className="inline-flex h-12 items-center justify-center rounded-full bg-ink px-7 text-[14px] font-bold text-white transition-colors hover:bg-ink-soft">
                Talk to us <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

    </div>
  );
}
