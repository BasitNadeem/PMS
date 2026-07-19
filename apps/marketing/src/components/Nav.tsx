import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { Building2, RefreshCcw, Wallet, Sparkles, BarChart3, ChevronDown, UtensilsCrossed, Coffee, Palmtree, Tent } from "lucide-react";
import MagneticButton from "./motion/MagneticButton";

// PMS is the core platform — featured on its own above the modules below it.
const PMS_ITEM = {
  to: "/pms",
  label: "Property Management System (PMS)",
  description: "Explore the Operating System your property runs on.",
  icon: Building2,
};

// Extend this list as new platform modules ship — these live inside PMS.
// Revenue-facing modules first (Financials, POS), distribution last (Channel Manager).
const PLATFORM_MODULES = [
  {
    to: "/financials",
    label: "Financials",
    description: "Folios, expenses, and a balance book that logs itself.",
    icon: Wallet,
  },
  {
    to: "/pos",
    label: "Point of Sale",
    description: "QR ordering, kitchen board, and folio posting.",
    icon: UtensilsCrossed,
  },
  {
    to: "/channel-manager",
    label: "Channel Manager",
    description: "Sync every channel into one calendar, in development.",
    icon: RefreshCcw,
  },
];

const PLATFORM_ITEMS = [PMS_ITEM, ...PLATFORM_MODULES];

// Extend this list as new "more" pages ship.
const MORE_ITEMS = [
  {
    to: "/automations",
    label: "Automations",
    description: "The parts of running a property that happen without you.",
    icon: Sparkles,
  },
  {
    to: "/statistics",
    label: "Statistics",
    description: "Every number your accountant expects, already calculated.",
    icon: BarChart3,
  },
];

// Extend this list as new accommodation-type pages ship.
const ACCOMMODATION_ITEMS = [
  {
    to: "/stays/hotels",
    label: "Hotels",
    description: "Boutiques, motels, resorts, and multi-site brands.",
    icon: Building2,
  },
  {
    to: "/stays/guesthouses",
    label: "B&Bs and guesthouses",
    description: "Intimate stays with a personal touch.",
    icon: Coffee,
  },
  {
    to: "/stays/vacation-rentals",
    label: "Vacation rentals",
    description: "Single homes to multi-unit portfolios.",
    icon: Palmtree,
  },
  {
    to: "/stays/glamping",
    label: "Glamping sites",
    description: "Cabins, pods, domes, tents, and yurts.",
    icon: Tent,
  },
];

const DROPDOWN_ITEMS = [...PLATFORM_ITEMS, ...MORE_ITEMS];

const LINKS = [
  { to: "/pricing", label: "Pricing" },
  { to: "/about",   label: "About"   },
  { to: "/contact", label: "Contact" },
];

export default function Nav() {
  const [solid, setSolid] = useState(false);
  const [open, setOpen]   = useState(false);
  const [platformOpen, setPlatformOpen] = useState(false);
  const [mobilePlatformOpen, setMobilePlatformOpen] = useState(false);
  const [accomOpen, setAccomOpen] = useState(false);
  const [mobileAccomOpen, setMobileAccomOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    function onScroll() { setSolid(window.scrollY > 40); }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setOpen(false);
    setMobilePlatformOpen(false);
    setMobileAccomOpen(false);
  }, [location.pathname]);

  const platformActive = DROPDOWN_ITEMS.some(item => location.pathname.startsWith(item.to));
  const accomActive = ACCOMMODATION_ITEMS.some(item => location.pathname.startsWith(item.to));

  return (
    <header
      className="fixed top-0 inset-x-0 z-50 transition-all duration-300"
      style={{
        background: solid || open || platformOpen || accomOpen ? "rgba(246,243,238,0.92)" : "transparent",
        backdropFilter: solid || open || platformOpen || accomOpen ? "blur(14px)" : "none",
        borderBottom: solid || open || platformOpen || accomOpen ? "1px solid #EAE4DB" : "1px solid transparent",
      }}
    >
      <div className="mx-auto max-w-7xl px-6 h-24 flex items-center justify-between">
        <Link to="/" className="font-display italic text-[26px] font-medium text-ink tracking-tight">
          InnFlo
        </Link>

        <nav className="hidden md:flex items-center gap-1.5">
          <div
            className="relative"
            onMouseEnter={() => setPlatformOpen(true)}
            onMouseLeave={() => setPlatformOpen(false)}
          >
            <button
              className={`group relative px-4 py-2 text-[15.5px] font-bold font-body transition-colors flex items-center gap-1 ${
                platformActive ? "text-coral-dark" : "text-ink-soft hover:text-ink"
              }`}
            >
              Platform
              <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${platformOpen ? "rotate-180" : ""}`} />
              <span
                className="absolute left-4 right-4 -bottom-0.5 h-[1.5px] bg-coral origin-left transition-transform duration-300"
                style={{ transform: platformActive ? "scaleX(1)" : "scaleX(0)" }}
              />
            </button>

            {platformOpen && (
              <div className="absolute top-full left-0 pt-3">
                <div className="relative w-[760px] rounded-2xl bg-card border border-line shadow-float p-6 grid grid-cols-2 gap-0 items-start">
                  <div className="absolute top-6 bottom-6 left-1/2 w-px bg-line-soft" />
                  {(() => {
                    const pmsActive = location.pathname.startsWith(PMS_ITEM.to);
                    return (
                      <Link to={PMS_ITEM.to} className="group block pr-6">
                        <div
                          className={`rounded-2xl overflow-hidden transition-all ${
                            pmsActive ? "ring-2 ring-coral" : "ring-1 ring-line group-hover:ring-2 group-hover:ring-coral"
                          }`}
                        >
                          <img src="/images/nav/pms-preview.webp" alt="InnFlo reservation timeline" className="w-full h-auto object-cover" />
                        </div>
                        <div className="pt-3">
                          <p className={`text-[15px] font-bold font-body leading-snug ${pmsActive ? "text-coral-dark" : "text-ink"}`}>{PMS_ITEM.label}</p>
                          <p className="text-[12px] text-ink-soft font-body leading-snug mt-2">{PMS_ITEM.description}</p>
                        </div>
                      </Link>
                    );
                  })()}

                  <div className="flex flex-col pl-6">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-ink-faint mb-2 px-1">Included in PMS</p>
                      <div className="space-y-1">
                        {PLATFORM_MODULES.map(item => {
                          const active = location.pathname.startsWith(item.to);
                          return (
                            <Link
                              key={item.to}
                              to={item.to}
                              className={`flex items-start gap-3 p-3 rounded-xl transition-colors ${active ? "bg-coral-soft" : "hover:bg-mist"}`}
                            >
                              <div className="h-9 w-9 rounded-lg bg-coral-soft grid place-items-center shrink-0">
                                <item.icon className="h-4 w-4 text-coral-dark" strokeWidth={2.25} />
                              </div>
                              <div>
                                <p className={`text-[14px] font-bold font-body ${active ? "text-coral-dark" : "text-ink"}`}>{item.label}</p>
                                <p className="text-[12.5px] text-ink-soft font-body leading-snug">{item.description}</p>
                              </div>
                            </Link>
                          );
                        })}
                      </div>
                    </div>

                    <div className="my-4 border-t border-line-soft" />

                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-ink-faint mb-2 px-1">Insights</p>
                      <div className="space-y-1">
                        {MORE_ITEMS.map(item => {
                          const active = location.pathname.startsWith(item.to);
                          return (
                            <Link
                              key={item.to}
                              to={item.to}
                              className={`flex items-start gap-3 p-3 rounded-xl transition-colors ${active ? "bg-coral-soft" : "hover:bg-mist"}`}
                            >
                              <div className="h-9 w-9 rounded-lg bg-coral-soft grid place-items-center shrink-0">
                                <item.icon className="h-4 w-4 text-coral-dark" strokeWidth={2.25} />
                              </div>
                              <div>
                                <p className={`text-[14px] font-bold font-body ${active ? "text-coral-dark" : "text-ink"}`}>{item.label}</p>
                                <p className="text-[12.5px] text-ink-soft font-body leading-snug">{item.description}</p>
                              </div>
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div
            className="relative"
            onMouseEnter={() => setAccomOpen(true)}
            onMouseLeave={() => setAccomOpen(false)}
          >
            <button
              className={`group relative px-4 py-2 text-[15.5px] font-bold font-body transition-colors flex items-center gap-1 ${
                accomActive ? "text-coral-dark" : "text-ink-soft hover:text-ink"
              }`}
            >
              Accommodation Types
              <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${accomOpen ? "rotate-180" : ""}`} />
              <span
                className="absolute left-4 right-4 -bottom-0.5 h-[1.5px] bg-coral origin-left transition-transform duration-300"
                style={{ transform: accomActive ? "scaleX(1)" : "scaleX(0)" }}
              />
            </button>

            {accomOpen && (
              <div className="absolute top-full left-1/2 -translate-x-1/2 pt-3">
                <div className="w-[300px] rounded-2xl bg-card border border-line shadow-float p-3">
                  {ACCOMMODATION_ITEMS.map(item => {
                    const active = location.pathname.startsWith(item.to);
                    return (
                      <Link
                        key={item.to}
                        to={item.to}
                        className={`flex items-start gap-3 p-3 rounded-xl transition-colors ${active ? "bg-coral-soft" : "hover:bg-mist"}`}
                      >
                        <div className="h-9 w-9 rounded-lg bg-coral-soft grid place-items-center shrink-0">
                          <item.icon className="h-4 w-4 text-coral-dark" strokeWidth={2.25} />
                        </div>
                        <div>
                          <p className={`text-[14px] font-bold font-body ${active ? "text-coral-dark" : "text-ink"}`}>{item.label}</p>
                          <p className="text-[12.5px] text-ink-soft font-body leading-snug">{item.description}</p>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {LINKS.map(l => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) =>
                `group relative px-4 py-2 text-[15.5px] font-bold font-body transition-colors ${
                  isActive ? "text-coral-dark" : "text-ink-soft hover:text-ink"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {l.label}
                  <span
                    className="absolute left-4 right-4 -bottom-0.5 h-[1.5px] bg-coral origin-left transition-transform duration-300"
                    style={{ transform: isActive ? "scaleX(1)" : "scaleX(0)" }}
                  />
                  <span
                    className="absolute left-4 right-4 -bottom-0.5 h-[1.5px] bg-ink-faint origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-300"
                    style={{ opacity: isActive ? 0 : 1 }}
                  />
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-3">
          <a
            href="#"
            className="h-11 px-7 rounded-full border border-ink text-[15px] font-bold font-body text-ink hover:bg-ink hover:text-white transition-colors flex items-center"
          >
            Login
          </a>
          <MagneticButton strength={0.4}>
            <Link
              to="/contact"
              className="h-11 px-7 rounded-full bg-coral text-[15px] font-bold font-body text-white shadow-pop hover:bg-coral-dark transition-colors flex items-center"
            >
              Request access
            </Link>
          </MagneticButton>
        </div>

        <button
          onClick={() => setOpen(v => !v)}
          className="md:hidden flex flex-col gap-1.5 p-2 -mr-2"
          aria-label="Menu"
        >
          <span className={`block w-5 h-[1.5px] bg-ink transition-transform duration-200 ${open ? "translate-y-[7px] rotate-45" : ""}`} />
          <span className={`block w-5 h-[1.5px] bg-ink transition-opacity duration-200 ${open ? "opacity-0" : ""}`} />
          <span className={`block w-5 h-[1.5px] bg-ink transition-transform duration-200 ${open ? "-translate-y-[7px] -rotate-45" : ""}`} />
        </button>
      </div>

      {open && (
        <div className="md:hidden px-6 pb-8 pt-2 flex flex-col gap-1 max-h-[calc(100vh-80px)] overflow-y-auto" style={{ borderTop: "1px solid #EAE4DB" }}>
          <button
            onClick={() => setMobilePlatformOpen(v => !v)}
            className={`py-3 text-[17px] font-bold font-body border-b border-line-soft flex items-center justify-between ${
              platformActive ? "text-coral-dark" : "text-ink-soft"
            }`}
          >
            Platform
            <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${mobilePlatformOpen ? "rotate-180" : ""}`} />
          </button>
          {mobilePlatformOpen && (
            <div className="flex flex-col gap-3 pl-4 border-b border-line-soft pb-4">
              <div>
                <p className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-ink-mute mb-1.5 mt-2">Platform</p>
                {(() => {
                  const pmsActive = location.pathname.startsWith(PMS_ITEM.to);
                  return (
                    <Link
                      to={PMS_ITEM.to}
                      className={`py-2 text-[16.5px] font-bold font-body flex items-center gap-2.5 ${pmsActive ? "text-coral-dark" : "text-ink"}`}
                    >
                      <PMS_ITEM.icon className="h-4.5 w-4.5 text-coral-dark" strokeWidth={2.25} />
                      {PMS_ITEM.label}
                    </Link>
                  );
                })()}
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-ink-faint mb-1 mt-3">Included in PMS</p>
                {PLATFORM_MODULES.map(item => {
                  const active = location.pathname.startsWith(item.to);
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      className={`py-2 text-[15.5px] font-semibold font-body flex items-center gap-2.5 ${active ? "text-coral-dark" : "text-ink-soft"}`}
                    >
                      <item.icon className="h-4 w-4 text-coral-dark" strokeWidth={2.25} />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
              <div>
                <p className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-ink-mute mb-1.5">Insights</p>
                {MORE_ITEMS.map(item => {
                  const active = location.pathname.startsWith(item.to);
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      className={`py-2 text-[15.5px] font-semibold font-body flex items-center gap-2.5 ${active ? "text-coral-dark" : "text-ink-soft"}`}
                    >
                      <item.icon className="h-4 w-4 text-coral-dark" strokeWidth={2.25} />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          <button
            onClick={() => setMobileAccomOpen(v => !v)}
            className={`py-3 text-[17px] font-bold font-body border-b border-line-soft flex items-center justify-between ${
              accomActive ? "text-coral-dark" : "text-ink-soft"
            }`}
          >
            Accommodation Types
            <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${mobileAccomOpen ? "rotate-180" : ""}`} />
          </button>
          {mobileAccomOpen && (
            <div className="flex flex-col gap-2 pl-4 border-b border-line-soft pb-4">
              {ACCOMMODATION_ITEMS.map(item => {
                const active = location.pathname.startsWith(item.to);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`py-2 text-[15.5px] font-semibold font-body flex items-center gap-2.5 ${active ? "text-coral-dark" : "text-ink-soft"}`}
                  >
                    <item.icon className="h-4 w-4 text-coral-dark" strokeWidth={2.25} />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          )}

          {LINKS.map(l => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) =>
                `py-3 text-[17px] font-bold font-body border-b border-line-soft ${isActive ? "text-coral-dark" : "text-ink-soft"}`
              }
            >
              {l.label}
            </NavLink>
          ))}
          <div className="mt-5 flex items-center gap-3">
            <a
              href="#"
              className="h-10 px-6 rounded-full border border-ink text-[13.5px] font-semibold font-body text-ink flex items-center"
            >
              Login
            </a>
            <Link
              to="/contact"
              className="h-10 px-6 rounded-full bg-coral text-[13.5px] font-semibold font-body text-white flex items-center"
            >
              Request access
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
