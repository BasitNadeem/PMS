import { Link } from "react-router-dom";
import { Facebook, Instagram, Linkedin, Twitter } from "lucide-react";
import MagneticButton from "./motion/MagneticButton";

const SOFT  = "rgba(245,235,228,0.68)";
const FAINT = "rgba(245,235,228,0.42)";

const SOCIALS = [
  { icon: Facebook,  href: "https://facebook.com" },
  { icon: Instagram, href: "https://instagram.com" },
  { icon: Linkedin,  href: "https://linkedin.com" },
  { icon: Twitter,   href: "https://twitter.com" },
];

export default function Footer() {
  return (
    <div className="bg-paper px-4 sm:px-[50px]">
      <footer
        className="relative overflow-hidden rounded-t-[2rem] sm:rounded-t-[3rem] bg-ink flex flex-col"
        style={{ height: "75vh" }}
      >
        <div className="relative z-10 shrink-0">
          {/* CTA strip */}
          <div className="mx-auto max-w-7xl w-full px-6 sm:px-10 pt-10 pb-6 border-b flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] mb-3" style={{ color: "#E0532B" }}>Ready when you are</p>
              <h3 className="font-display italic text-[clamp(22px,2.6vw,32px)] font-medium text-paper max-w-lg leading-tight">
                Let's see if InnFlo actually fits your property.
              </h3>
            </div>
            <MagneticButton>
              <Link
                to="/contact"
                className="h-11 px-7 rounded-full bg-coral hover:bg-coral-dark text-white text-[14px] font-bold font-body shadow-pop transition-colors flex items-center shrink-0"
              >
                Get in touch →
              </Link>
            </MagneticButton>
          </div>

          {/* Link columns */}
          <div className="mx-auto max-w-7xl w-full px-6 sm:px-10 py-8 grid grid-cols-1 md:grid-cols-[1.3fr_auto_auto_auto_auto] gap-8 md:gap-12">
            <div>
              <p className="font-display italic text-[24px] font-medium text-paper mb-2.5">InnFlo</p>
              <p className="text-[14.5px] leading-relaxed max-w-[260px] font-body" style={{ color: SOFT }}>
                Hotel property management built for how hospitality actually runs in the mountains.
              </p>
            </div>

            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] mb-3" style={{ color: "#E0532B" }}>Product</p>
              <ul className="space-y-2">
                {[
                  ["PMS", "/pms"],
                  ["Pricing", "/pricing"],
                  ["Channel Manager", "/pms#channels"],
                ].map(([label, href]) => (
                  <li key={href}>
                    <Link to={href} className="text-[14.5px] font-body transition-colors hover:text-white" style={{ color: SOFT }}>
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] mb-3" style={{ color: "#E0532B" }}>Company</p>
              <ul className="space-y-2">
                {[
                  ["About", "/about"],
                  ["Contact", "/contact"],
                ].map(([label, href]) => (
                  <li key={href}>
                    <Link to={href} className="text-[14.5px] font-body transition-colors hover:text-white" style={{ color: SOFT }}>
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] mb-3" style={{ color: "#E0532B" }}>Get in touch</p>
              <ul className="space-y-2">
                <li>
                  <a href="https://wa.me/+923001234567" className="text-[14.5px] font-body transition-colors hover:text-white" style={{ color: SOFT }}>
                    WhatsApp
                  </a>
                </li>
                <li>
                  <a href="mailto:hello@innflo.app" className="text-[14.5px] font-body transition-colors hover:text-white" style={{ color: SOFT }}>
                    hello@innflo.app
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] mb-3" style={{ color: "#E0532B" }}>Follow us</p>
              <div className="flex items-center gap-2">
                {SOCIALS.map(({ icon: Icon, href }) => (
                  <a
                    key={href}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="h-9 w-9 rounded-full grid place-items-center transition-colors bg-white/[0.08] hover:bg-white/[0.16]"
                  >
                    <Icon className="h-3.5 w-3.5 text-paper" strokeWidth={2} />
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-10 shrink-0 border-t" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
          <div className="mx-auto max-w-7xl px-6 sm:px-10 py-4 flex flex-col sm:flex-row gap-2 items-center justify-between">
            <p className="text-[13px] font-body" style={{ color: FAINT }}>
              © {new Date().getFullYear()} InnFlo. All rights reserved.
            </p>
            <p className="text-[13px] font-body" style={{ color: FAINT }}>
              Built for real hotels, not demo hotels.
            </p>
          </div>
        </div>

        {/* Wordmark zone — takes the remaining ~60% of the footer's fixed 75vh height */}
        <div className="relative flex-1 min-h-0">
          <p
            aria-hidden="true"
            className="pointer-events-none select-none absolute left-1/2 bottom-0 z-0 font-display italic font-medium leading-none whitespace-nowrap text-paper"
            style={{
              fontSize: "clamp(160px, 32vh, 460px)",
              transform: "translate(-50%, 14%)",
            }}
          >
            InnFlo
          </p>
        </div>
      </footer>
    </div>
  );
}
