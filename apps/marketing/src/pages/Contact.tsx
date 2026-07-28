import { useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Facebook,
  Instagram,
  LifeBuoy,
  Mail,
  MessageCircle,
  PhoneCall,
  Send,
  Sparkles,
} from "lucide-react";
import Reveal from "../components/motion/Reveal";
import SplitHeading from "../components/motion/SplitHeading";
import {
  CONTACT_EMAIL,
  CONTACT_PHONE_DISPLAY,
  CONTACT_PHONE_HREF,
  CONTACT_PHONE_NUMERIC,
  FACEBOOK_URL,
  getWhatsAppUrl,
  INSTAGRAM_URL,
  SUPPORT_EMAIL,
} from "../lib/contact";

const inputCls = [
  "w-full rounded-xl border border-line bg-white px-4 py-3.5 font-body text-[14px] text-ink",
  "outline-none transition focus:border-coral focus:ring-2 focus:ring-coral/15",
  "placeholder:text-ink-faint",
].join(" ");

type ContactForm = {
  name: string;
  property: string;
  city: string;
  rooms: string;
  phone: string;
  email: string;
  currentSystem: string;
  message: string;
};

const initialForm: ContactForm = {
  name: "",
  property: "",
  city: "",
  rooms: "",
  phone: "",
  email: "",
  currentSystem: "",
  message: "",
};

export default function Contact() {
  const [form, setForm] = useState<ContactForm>(initialForm);

  function update(key: keyof ContactForm) {
    return (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((current) => ({ ...current, [key]: event.target.value }));
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const body = [
      "Hi InnFlo, I’d like to book a product walkthrough.",
      "",
      `Name: ${form.name}`,
      `Property: ${form.property || "Not provided"}`,
      `City: ${form.city || "Not provided"}`,
      `Rooms: ${form.rooms || "Not provided"}`,
      `Phone: ${form.phone || "Not provided"}`,
      `Email: ${form.email}`,
      `Current system: ${form.currentSystem || "Not provided"}`,
      "",
      `What we need: ${form.message || "A general InnFlo walkthrough."}`,
    ].join("\n");
    window.open(getWhatsAppUrl(body), "_blank", "noopener,noreferrer");
  }

  const whatsappUrl = getWhatsAppUrl("Hi InnFlo, I’d like to learn more about the hotel PMS.");

  return (
    <div className="bg-paper text-ink">
      <section className="relative overflow-hidden bg-grid px-6 pb-20 pt-40">
        <div className="absolute left-1/2 top-12 h-[420px] w-[900px] -translate-x-1/2 rounded-full bg-coral/10 blur-3xl" />
        <div className="relative mx-auto max-w-5xl text-center">
          <Reveal><p className="eyebrow mb-6">A useful conversation, first</p></Reveal>
          <h1 className="font-display text-[clamp(44px,7vw,76px)] font-medium leading-[.98]">
            <SplitHeading as="span" className="block">Show us how your</SplitHeading>
            <SplitHeading as="span" delay={0.2} className="block italic text-coral-dark">hotel actually runs.</SplitHeading>
          </h1>
          <Reveal delay={0.4}>
            <p className="mx-auto mt-7 max-w-2xl text-[17px] leading-relaxed text-ink-soft">
              We’ll use your room count and workflow to prepare a focused walkthrough—reservations, housekeeping, billing, direct bookings, food operations, or all of it.
            </p>
          </Reveal>
          <Reveal delay={0.48}>
            <div className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2 text-[12px] font-bold text-ink-soft">
              {["No generic sales deck", "Live product walkthrough", "Honest fit assessment"].map((item) => (
                <span key={item} className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-[#2F7256]" />{item}</span>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      <section className="px-6 pb-28 pt-8">
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[.78fr_1.22fr]">
          <Reveal className="space-y-5">
            <div className="rounded-[28px] bg-ink p-7 text-white sm:p-8">
              <Sparkles className="h-6 w-6 text-coral" />
              <h2 className="mt-7 font-display text-[32px] font-medium">What happens next</h2>
              <div className="mt-7 space-y-6">
                {[
                  ["01", "We read the context", "Room count, departments and your current process shape the demo."],
                  ["02", "We walk your workflow", "You see the live product against real hotel scenarios."],
                  ["03", "You get a practical launch path", "Plan, setup scope and next steps—without pressure."],
                ].map(([number, title, copy]) => (
                  <div key={number} className="flex gap-4">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/10 text-[10px] font-bold text-coral">{number}</span>
                    <div>
                      <p className="text-[13px] font-bold">{title}</p>
                      <p className="mt-1 text-[12px] leading-relaxed text-white/55">{copy}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[26px] border border-line bg-card p-6">
              <p className="text-[10px] font-bold uppercase tracking-[.16em] text-ink-mute">Prefer a direct channel?</p>
              <div className="mt-5 space-y-3">
                <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-2xl bg-[#EAF6EE] p-4 text-[13px] font-bold text-[#215C3A] hover:bg-[#DFF0E5]">
                  <MessageCircle className="h-5 w-5" />
                  <span><span className="block">Start on WhatsApp</span><span className="mt-0.5 block text-[10px] font-semibold opacity-70">{CONTACT_PHONE_DISPLAY}</span></span>
                  <ArrowRight className="ml-auto h-4 w-4" />
                </a>
                <a href={CONTACT_PHONE_HREF} className="flex items-center gap-3 rounded-2xl bg-coral-soft p-4 text-[13px] font-bold text-coral-dark hover:bg-[#F6DDD1]">
                  <PhoneCall className="h-5 w-5" />
                  <span><span className="block">Call InnFlo</span><span className="mt-0.5 block text-[10px] font-semibold opacity-70">{CONTACT_PHONE_NUMERIC}</span></span>
                  <ArrowRight className="ml-auto h-4 w-4" />
                </a>
                <a href={`mailto:${CONTACT_EMAIL}`} className="flex items-center gap-3 rounded-2xl bg-mist p-4 text-[13px] font-bold text-ink hover:bg-line-soft">
                  <Mail className="h-5 w-5 text-coral-dark" />
                  <span><span className="block">Sales & walkthroughs</span><span className="mt-0.5 block text-[10px] font-semibold text-ink-mute">{CONTACT_EMAIL}</span></span>
                </a>
                <a href={`mailto:${SUPPORT_EMAIL}`} className="flex items-center gap-3 rounded-2xl bg-mist p-4 text-[13px] font-bold text-ink hover:bg-line-soft">
                  <LifeBuoy className="h-5 w-5 text-coral-dark" />
                  <span><span className="block">Customer support</span><span className="mt-0.5 block text-[10px] font-semibold text-ink-mute">{SUPPORT_EMAIL}</span></span>
                </a>
              </div>
              <div className="mt-5 flex items-center gap-2 border-t border-line-soft pt-5">
                <span className="mr-2 text-[10px] font-bold uppercase tracking-[.14em] text-ink-mute">Follow</span>
                <a
                  href={INSTAGRAM_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="grid h-9 w-9 place-items-center rounded-full border border-line text-ink-soft transition-colors hover:border-coral/40 hover:bg-coral-soft hover:text-coral-dark"
                  aria-label="InnFlo on Instagram"
                >
                  <Instagram className="h-4 w-4" />
                </a>
                <a
                  href={FACEBOOK_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="grid h-9 w-9 place-items-center rounded-full border border-line text-ink-soft transition-colors hover:border-coral/40 hover:bg-coral-soft hover:text-coral-dark"
                  aria-label="InnFlo on Facebook"
                >
                  <Facebook className="h-4 w-4" />
                </a>
              </div>
            </div>

            <div className="flex items-start gap-3 px-2 text-[12px] leading-relaxed text-ink-mute">
              <PhoneCall className="mt-0.5 h-4 w-4 shrink-0 text-coral-dark" />
              Have a complicated setup? Include it. Groups, restaurant service, multiple room categories and seasonal operations are useful context.
            </div>
          </Reveal>

          <Reveal delay={0.08}>
            <form onSubmit={submit} className="rounded-[30px] border border-line bg-card p-6 shadow-float sm:p-9">
              <div className="mb-8">
                <p className="eyebrow mb-3">Book your walkthrough</p>
                <h2 className="font-display text-[34px] font-medium">A little context goes a long way.</h2>
                <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">Required fields are marked. Submitting opens a WhatsApp conversation with everything already written.</p>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <label className="text-[11px] font-bold uppercase tracking-wider text-ink-mute">
                  Your name *
                  <input required value={form.name} onChange={update("name")} placeholder="Ahmed Raza" className={`${inputCls} mt-2`} />
                </label>
                <label className="text-[11px] font-bold uppercase tracking-wider text-ink-mute">
                  Work email *
                  <input required type="email" value={form.email} onChange={update("email")} placeholder="ahmed@hotel.pk" className={`${inputCls} mt-2`} />
                </label>
                <label className="text-[11px] font-bold uppercase tracking-wider text-ink-mute">
                  Property name
                  <input value={form.property} onChange={update("property")} placeholder="Serena View Lodge" className={`${inputCls} mt-2`} />
                </label>
                <label className="text-[11px] font-bold uppercase tracking-wider text-ink-mute">
                  City / destination
                  <input value={form.city} onChange={update("city")} placeholder="Hunza" className={`${inputCls} mt-2`} />
                </label>
                <label className="text-[11px] font-bold uppercase tracking-wider text-ink-mute">
                  Room count
                  <select value={form.rooms} onChange={update("rooms")} className={`${inputCls} mt-2`}>
                    <option value="">Select range</option>
                    <option>1–10 rooms</option>
                    <option>11–25 rooms</option>
                    <option>26–50 rooms</option>
                    <option>51–100 rooms</option>
                    <option>100+ rooms</option>
                  </select>
                </label>
                <label className="text-[11px] font-bold uppercase tracking-wider text-ink-mute">
                  Phone / WhatsApp
                  <input type="tel" value={form.phone} onChange={update("phone")} placeholder="+92 300 0000000" className={`${inputCls} mt-2`} />
                </label>
              </div>

              <label className="mt-5 block text-[11px] font-bold uppercase tracking-wider text-ink-mute">
                What do you use today?
                <input value={form.currentSystem} onChange={update("currentSystem")} placeholder="Paper register, Excel, another PMS…" className={`${inputCls} mt-2`} />
              </label>
              <label className="mt-5 block text-[11px] font-bold uppercase tracking-wider text-ink-mute">
                What would make this walkthrough useful?
                <textarea rows={4} value={form.message} onChange={update("message")} placeholder="The modules, bottlenecks or questions you want us to focus on." className={`${inputCls} mt-2 resize-none`} />
              </label>

              <button type="submit" className="mt-7 inline-flex h-13 w-full items-center justify-center rounded-full bg-coral px-8 py-3.5 text-[14px] font-bold text-white shadow-pop hover:bg-coral-dark">
                Prepare my walkthrough <Send className="ml-2 h-4 w-4" />
              </button>
              <p className="mt-4 text-center text-[11px] leading-relaxed text-ink-mute">Your details are used only to respond to this enquiry.</p>
            </form>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
