import { Link } from "react-router-dom";
import Reveal from "../components/motion/Reveal";
import SplitHeading from "../components/motion/SplitHeading";
import MagneticButton from "../components/motion/MagneticButton";

export default function About() {
  return (
    <div className="bg-paper text-ink">

      {/* ── Opener ─────────────────────────────────────────────────────────── */}
      <section className="pt-40 pb-20 px-6 bg-grid">
        <div className="mx-auto max-w-4xl">
          <Reveal variant="fade"><p className="eyebrow mb-6">About</p></Reveal>
          <h1 className="font-display text-[clamp(42px,6.5vw,72px)] font-medium leading-[1.0] text-ink">
            <SplitHeading as="span" className="block">We built what</SplitHeading>
            <SplitHeading as="span" delay={0.25} className="block italic text-coral-dark">we couldn't find.</SplitHeading>
          </h1>
        </div>
      </section>

      {/* ── Story ──────────────────────────────────────────────────────────── */}
      <section className="py-20 px-6">
        <div className="mx-auto max-w-4xl">
          <div className="grid grid-cols-1 lg:grid-cols-[60%_40%] gap-16">

            <Reveal className="space-y-6 font-body text-[17.5px] text-ink-soft leading-[1.85]">
              <p className="first-letter:font-display first-letter:text-[64px] first-letter:font-medium first-letter:text-coral-dark first-letter:mr-2 first-letter:float-left first-letter:leading-[0.85]">
                The hotels we know in northern Pakistan — the ones in Hunza, Skardu, Naran, and the valleys in between — run on spreadsheets, WhatsApp groups, and paper notebooks. Not because their owners are behind the times, but because the software that exists was built for someone else.
              </p>
              <p>
                Enterprise PMS systems are designed for large city hotels with dedicated IT staff, reliable internet, and budgets that include per-booking commission fees. A 12-room guesthouse at 3,000 meters can't afford a Mews subscription, doesn't have the bandwidth for a cloud-heavy app, and doesn't need a revenue management API.
              </p>
              <p>
                InnFlo started from a simple question: what would a PMS look like if it was designed specifically for small, independently-run properties in markets like north Pakistan and the Gulf — where connectivity is variable, staff may not be particularly technical, and the owner is also the front desk?
              </p>
              <p>
                The answer is what you see here. A system that works offline when the internet cuts out. A housekeeping app that runs on any Android phone. A nightly WhatsApp briefing because the owner is more likely to see it there than in a dashboard. Payment methods that include JazzCash and EasyPaisa because that's how guests actually pay. Booking sources that include Bookme.pk and Sastaticket.pk because that's where guests in this market actually book.
              </p>
              <p>
                We haven't been running since 2015. We don't have 10,000 customers. We're not backed by a global SaaS fund. InnFlo is early-stage software built by people who know what these hotels need because we've spent time in them.
              </p>
            </Reveal>

            <Reveal delay={0.1} className="space-y-8">
              <div className="pt-8 border-t border-line">
                <p className="eyebrow mb-3">What we are</p>
                <ul className="space-y-2.5 font-body text-[15.5px] text-ink-soft">
                  {["Early-stage, actively built", "Pakistan-first, expanding to the Gulf", "Built by hoteliers and engineers", "Honest about what's ready and what isn't"].map(f => (
                    <li key={f} className="flex items-start gap-2.5">
                      <span className="text-coral mt-0.5">—</span>{f}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="pt-8 border-t border-line">
                <p className="eyebrow mb-3">What we're not</p>
                <ul className="space-y-2.5 font-body text-[15.5px] text-ink-mute">
                  {["A rebadged Western SaaS product", "Charging per-booking commission", "Hiding features behind upsell tiers", "Inflating customer counts or fake reviews"].map(f => (
                    <li key={f} className="flex items-start gap-2.5">
                      <span style={{ color: "#B8B1A6" }}>✗</span>{f}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="pt-8 border-t border-line">
                <p className="eyebrow mb-3">Where we're building toward</p>
                <p className="font-body text-[15.5px] text-ink-soft leading-relaxed">
                  Channel Manager (OTA sync), guest messaging, email notifications, and a guest portal. These are on the roadmap — not vaporware, but not ready today.
                </p>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── Closing statement ──────────────────────────────────────────────── */}
      <section className="py-24 px-6 border-t border-line bg-mist">
        <div className="mx-auto max-w-4xl">
          <Reveal>
            <p className="font-display text-[clamp(26px,3.6vw,46px)] font-medium leading-tight text-ink mb-9">
              If you run a hotel in northern Pakistan or the Gulf region and you're tired of Excel, we'd genuinely like to talk.
            </p>
            <MagneticButton>
              <Link
                to="/contact"
                className="inline-flex items-center h-12 px-8 rounded-full text-[16px] font-semibold font-body text-white bg-coral hover:bg-coral-dark transition-colors shadow-pop"
              >
                Get in touch →
              </Link>
            </MagneticButton>
          </Reveal>
        </div>
      </section>

    </div>
  );
}
