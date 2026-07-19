import { useState } from "react";
import Reveal from "../components/motion/Reveal";
import SplitHeading from "../components/motion/SplitHeading";
import MagneticButton from "../components/motion/MagneticButton";

const inputCls = [
  "w-full px-4 py-3 font-body text-[15.5px] text-ink bg-card rounded-xl",
  "border border-line focus:border-coral focus:outline-none focus:ring-2 focus:ring-coral/15",
  "transition-colors placeholder:text-ink-faint",
].join(" ");

export default function Contact() {
  const [sent, setSent] = useState(false);
  const [form, setForm] = useState({ name: "", hotel: "", email: "", message: "" });

  function update(k: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [k]: e.target.value }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setSent(true);
  }

  return (
    <div className="bg-paper text-ink">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <section className="pt-40 pb-20 px-6 bg-grid">
        <div className="mx-auto max-w-4xl">
          <Reveal variant="fade"><p className="eyebrow mb-6">Contact</p></Reveal>
          <h1 className="font-display text-[clamp(40px,6vw,68px)] font-medium leading-[1.0] text-ink mb-6">
            <SplitHeading as="span" className="block">Let's talk.</SplitHeading>
          </h1>
          <Reveal delay={0.35}>
            <p className="text-[17.5px] text-ink-soft font-body max-w-md leading-relaxed">
              We're happy to walk you through InnFlo, answer specific questions, or just hear about your property.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ── Contact options + form ────────────────────────────────────────── */}
      <section className="py-16 px-6">
        <div className="mx-auto max-w-4xl">
          <div className="grid grid-cols-1 lg:grid-cols-[40%_60%] gap-16">

            <Reveal className="space-y-10">
              <div>
                <p className="eyebrow mb-4">Fastest response</p>
                <a
                  href="https://wa.me/+923001234567"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-4 group"
                >
                  <div className="h-12 w-12 grid place-items-center flex-shrink-0 rounded-2xl transition-transform group-hover:scale-105" style={{ background: "#E7F5E9" }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                      <path d="M20.52 3.48A11.93 11.93 0 0 0 12 0C5.37 0 0 5.37 0 12c0 2.12.55 4.17 1.6 5.98L0 24l6.2-1.63A11.97 11.97 0 0 0 12 24c6.63 0 12-5.37 12-12a11.93 11.93 0 0 0-3.48-8.52z" fill="#25D366" opacity=".18"/>
                      <path d="M12 2.4A9.6 9.6 0 1 0 21.6 12 9.61 9.61 0 0 0 12 2.4zm4.77 13.26c-.2.56-1.17 1.07-1.63 1.14-.42.06-.96.09-1.54-.1-.36-.11-.82-.27-1.42-.53-2.48-1.07-4.1-3.57-4.23-3.74-.12-.16-.99-1.32-.99-2.52s.63-1.78.86-2.03c.2-.23.45-.29.6-.29l.43.01c.14 0 .32-.05.5.38.2.46.67 1.64.73 1.76.06.12.1.26.02.42-.08.15-.12.25-.24.38-.12.14-.26.3-.37.4-.12.12-.25.24-.1.48.14.23.63.96 1.35 1.55a5.7 5.7 0 0 0 1.95 1.05c.23.08.36.07.5-.04.13-.12.56-.65.71-.87.14-.22.29-.18.49-.1.2.07 1.25.59 1.46.7.22.1.36.16.41.25.06.1.06.55-.14 1.1z" fill="#25D366"/>
                    </svg>
                  </div>
                  <div>
                    <p className="text-[17px] font-semibold text-ink group-hover:text-coral-dark transition-colors font-body">
                      Message us on WhatsApp
                    </p>
                    <p className="text-[14.5px] text-ink-soft font-body">+92 300 1234567</p>
                  </div>
                </a>
              </div>

              <div>
                <p className="eyebrow mb-4">Email</p>
                <a href="mailto:hello@innflo.app" className="text-[17px] text-ink-soft hover:text-coral-dark transition-colors font-body">
                  hello@innflo.app
                </a>
              </div>

              <div className="pt-8 border-t border-line">
                <p className="eyebrow mb-4">What to expect</p>
                <ul className="space-y-3 font-body text-[15px] text-ink-soft">
                  {[
                    "A real conversation, not a sales deck",
                    "Honest answer on whether InnFlo fits your property",
                    "Live walkthrough of the actual software",
                    "Response within 24 hours",
                  ].map(item => (
                    <li key={item} className="flex items-start gap-2.5">
                      <span className="text-coral mt-0.5 shrink-0">—</span>{item}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>

            <Reveal delay={0.1}>
              {sent ? (
                <div className="p-10 rounded-3xl bg-card border border-line shadow-card" style={{ borderTop: "3px solid #E0532B" }}>
                  <p className="font-display text-[30px] font-medium text-ink mb-4">We'll be in touch.</p>
                  <p className="text-[15.5px] text-ink-soft font-body leading-relaxed">
                    Thanks for reaching out. Expect a message within 24 hours — usually via WhatsApp if you included a number, email otherwise.
                  </p>
                </div>
              ) : (
                <form onSubmit={submit} className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-[12px] font-semibold text-ink-mute font-body uppercase tracking-wider mb-2">
                        Your name
                      </label>
                      <input type="text" required value={form.name} onChange={update("name")} placeholder="Ahmed Raza" className={inputCls} />
                    </div>
                    <div>
                      <label className="block text-[12px] font-semibold text-ink-mute font-body uppercase tracking-wider mb-2">
                        Property name
                      </label>
                      <input type="text" value={form.hotel} onChange={update("hotel")} placeholder="Eagle's Nest, Hunza" className={inputCls} />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[12px] font-semibold text-ink-mute font-body uppercase tracking-wider mb-2">
                      Email address
                    </label>
                    <input type="email" required value={form.email} onChange={update("email")} placeholder="ahmed@yourhotel.pk" className={inputCls} />
                  </div>

                  <div>
                    <label className="block text-[12px] font-semibold text-ink-mute font-body uppercase tracking-wider mb-2">
                      What would you like to know?
                    </label>
                    <textarea
                      rows={5}
                      value={form.message}
                      onChange={update("message")}
                      placeholder="How many rooms do you have? What software are you using now? Any specific modules you're most interested in?"
                      className={`${inputCls} resize-none`}
                    />
                  </div>

                  <MagneticButton strength={0.15} className="w-full">
                    <button
                      type="submit"
                      className="h-12 px-8 w-full text-[16px] font-semibold font-body transition-colors rounded-full bg-coral text-white hover:bg-coral-dark shadow-pop"
                    >
                      Send message
                    </button>
                  </MagneticButton>

                  <p className="text-[13px] text-ink-mute font-body text-center">
                    Or just WhatsApp us — it's faster.
                  </p>
                </form>
              )}
            </Reveal>

          </div>
        </div>
      </section>

    </div>
  );
}
