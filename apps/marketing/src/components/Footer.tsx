import { Link } from "react-router-dom";
import { ArrowRight, Facebook, Instagram, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import MagneticButton from "./motion/MagneticButton";
import {
  CONTACT_EMAIL,
  CONTACT_PHONE_DISPLAY,
  CONTACT_PHONE_HREF,
  FACEBOOK_URL,
  getWhatsAppUrl,
  INSTAGRAM_URL,
  SUPPORT_EMAIL,
} from "../lib/contact";

const SOFT = "rgba(245,235,228,0.68)";
const FAINT = "rgba(245,235,228,0.42)";

const PRODUCT_LINKS = [
  ["PMS", "/pms"],
  ["Booking Engine", "/booking-engine"],
  ["Financials", "/financials"],
  ["POS & QR ordering", "/pos"],
  ["Reporting", "/statistics"],
  ["Pricing", "/pricing"],
];

const COMPANY_LINKS = [
  ["About", "/about"],
  ["Contact", "/contact"],
  ["Channel Manager roadmap", "/channel-manager"],
];

export default function Footer() {
  const whatsappUrl = getWhatsAppUrl("Hi InnFlo, I’d like to learn more about the hotel PMS.");

  return (
    <div className="bg-paper px-3 sm:px-8 lg:px-[50px]">
      <footer className="relative overflow-hidden rounded-t-[2rem] bg-ink text-white sm:rounded-t-[3rem]">
        <div className="relative z-10 mx-auto max-w-7xl px-6 py-10 sm:px-10 sm:py-12">
          <div className="flex flex-col items-start justify-between gap-7 border-b border-white/10 pb-10 md:flex-row md:items-center">
            <div>
              <p className="mb-3 text-[10px] font-bold uppercase tracking-[.18em] text-coral">Ready when you are</p>
              <h3 className="max-w-2xl font-display text-[clamp(27px,3.8vw,44px)] font-medium leading-tight text-paper">
                Bring your real hotel workflow. We’ll bring the live product.
              </h3>
            </div>
            <MagneticButton>
              <Link to="/contact" className="flex h-12 shrink-0 items-center rounded-full bg-coral px-7 text-[14px] font-bold text-white shadow-pop hover:bg-coral-dark">
                Book a walkthrough <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </MagneticButton>
          </div>

          <div className="grid gap-10 py-11 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1.15fr]">
            <div>
              <Link to="/" className="font-display text-[30px] font-medium italic text-paper">InnFlo</Link>
              <p className="mt-4 max-w-[300px] text-[14px] leading-relaxed" style={{ color: SOFT }}>
                A manager-first hotel operating system for independent properties—starting in Pakistan.
              </p>
              <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-2 text-[11px] font-semibold" style={{ color: SOFT }}>
                <MapPin className="h-3.5 w-3.5 text-coral" /> Built for hospitality on the ground
              </div>
              <div className="mt-4 flex items-center gap-2">
                <a
                  href={INSTAGRAM_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="InnFlo on Instagram"
                  className="grid h-9 w-9 place-items-center rounded-full border border-white/10 text-white/60 transition-colors hover:border-coral/50 hover:bg-white/10 hover:text-coral"
                >
                  <Instagram className="h-4 w-4" />
                </a>
                <a
                  href={FACEBOOK_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="InnFlo on Facebook"
                  className="grid h-9 w-9 place-items-center rounded-full border border-white/10 text-white/60 transition-colors hover:border-coral/50 hover:bg-white/10 hover:text-coral"
                >
                  <Facebook className="h-4 w-4" />
                </a>
              </div>
            </div>

            <div>
              <p className="mb-4 text-[10px] font-bold uppercase tracking-[.18em] text-coral">Product</p>
              <ul className="space-y-2.5">
                {PRODUCT_LINKS.map(([label, href]) => (
                  <li key={href}><Link to={href} className="text-[13px] hover:text-white" style={{ color: SOFT }}>{label}</Link></li>
                ))}
              </ul>
            </div>

            <div>
              <p className="mb-4 text-[10px] font-bold uppercase tracking-[.18em] text-coral">Company</p>
              <ul className="space-y-2.5">
                {COMPANY_LINKS.map(([label, href]) => (
                  <li key={href}><Link to={href} className="text-[13px] hover:text-white" style={{ color: SOFT }}>{label}</Link></li>
                ))}
              </ul>
            </div>

            <div>
              <p className="mb-4 text-[10px] font-bold uppercase tracking-[.18em] text-coral">Start a conversation</p>
              <a href={`mailto:${CONTACT_EMAIL}`} className="flex items-center gap-3 rounded-xl bg-white/[.06] p-3 text-[13px] font-semibold hover:bg-white/10" style={{ color: SOFT }}>
                <Mail className="h-4 w-4 text-coral" /> {CONTACT_EMAIL}
              </a>
              <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="mt-2 flex items-center gap-3 rounded-xl bg-white/[.06] p-3 text-[13px] font-semibold hover:bg-white/10" style={{ color: SOFT }}>
                <MessageCircle className="h-4 w-4 text-coral" /> {CONTACT_PHONE_DISPLAY}
              </a>
              <a href={CONTACT_PHONE_HREF} className="mt-2 flex items-center gap-3 px-3 py-1 text-[11px] font-semibold hover:text-white" style={{ color: FAINT }}>
                <Phone className="h-3.5 w-3.5 text-coral" /> Call InnFlo
              </a>
              <a href={`mailto:${SUPPORT_EMAIL}`} className="mt-1 flex items-center gap-3 px-3 py-1 text-[11px] font-semibold hover:text-white" style={{ color: FAINT }}>
                <Mail className="h-3.5 w-3.5 text-coral" /> {SUPPORT_EMAIL}
              </a>
              <p className="mt-4 text-[11px] leading-relaxed" style={{ color: FAINT }}>No commission on direct bookings. No long contract. No feature theatre.</p>
            </div>
          </div>

          <div className="flex flex-col gap-2 border-t border-white/10 pt-5 text-[11px] sm:flex-row sm:items-center sm:justify-between" style={{ color: FAINT }}>
            <p>© {new Date().getFullYear()} InnFlo. All rights reserved.</p>
            <p>Built for real hotels, not demo workflows.</p>
          </div>
        </div>

        <p aria-hidden="true" className="pointer-events-none select-none -mb-[4vw] text-center font-display text-[clamp(110px,23vw,340px)] font-medium italic leading-[.75] text-white/[.035]">
          InnFlo
        </p>
      </footer>
    </div>
  );
}
