import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  BarChart3,
  Building2,
  ChevronDown,
  Coffee,
  Globe2,
  Menu,
  Palmtree,
  RefreshCcw,
  Sparkles,
  Tent,
  UtensilsCrossed,
  Wallet,
  X,
} from "lucide-react";
import { preloadRoute, preloadRoutes } from "../lib/routePreload";

const PRODUCT_LINKS = [
  {
    to: "/pms",
    label: "Property Management System",
    short: "Front desk, reservations, rooms, housekeeping and guests.",
    icon: Building2,
  },
  {
    to: "/booking-engine",
    label: "Booking Engine",
    short: "Your own branded booking site. Direct reservations, zero commission.",
    icon: Globe2,
  },
  {
    to: "/channel-manager",
    label: "Channel Manager",
    short: "Booking.com, Airbnb and Agoda on one calendar. In development.",
    icon: RefreshCcw,
  },
];

// Deeper reading on what sits inside the products above.
const MODULE_LINKS = [
  { to: "/financials", label: "Financials", icon: Wallet },
  { to: "/pos", label: "POS & QR dining", icon: UtensilsCrossed },
  { to: "/automations", label: "Automations", icon: Sparkles },
  { to: "/statistics", label: "Reports", icon: BarChart3 },
];

const STAY_LINKS = [
  { to: "/stays/hotels", label: "Hotels", copy: "Boutiques, resorts and independent hotels.", icon: Building2 },
  { to: "/stays/guesthouses", label: "B&Bs & guesthouses", copy: "Personal stays with lean teams.", icon: Coffee },
  { to: "/stays/vacation-rentals", label: "Vacation rentals", copy: "Serviced homes and independent units.", icon: Palmtree },
  { to: "/stays/glamping", label: "Glamping sites", copy: "Cabins, pods, domes and camps.", icon: Tent },
];

type DesktopMenu = "product" | "stays" | null;

const EASE = [0.16, 1, 0.3, 1] as const;

export default function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopMenu, setDesktopMenu] = useState<DesktopMenu>(null);
  const scrolledRef = useRef(false);
  const location = useLocation();

  useEffect(() => {
    function onScroll() {
      const nextScrolled = window.scrollY > 36;
      if (nextScrolled === scrolledRef.current) return;
      scrolledRef.current = nextScrolled;
      setScrolled(nextScrolled);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setDesktopMenu(null);
  }, [location.pathname]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMobileOpen(false);
        setDesktopMenu(null);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const productActive = [...PRODUCT_LINKS, ...MODULE_LINKS].some((item) => location.pathname.startsWith(item.to));
  const staysActive = STAY_LINKS.some((item) => location.pathname.startsWith(item.to));
  const darkMode = scrolled && !mobileOpen;

  const desktopLinkClass = (active: boolean) =>
    `relative rounded-full font-bold transition-all ${
      darkMode
        ? `px-3.5 py-2 text-[13px] xl:px-4 ${
            active
          ? "bg-white text-ink shadow-[0_2px_10px_rgba(0,0,0,.18)]"
          : "text-white/80 hover:bg-white/10 hover:text-white"
          }`
        : `px-4 py-2 text-[14px] xl:px-[18px] ${
            active ? "text-coral-dark" : "text-ink-soft hover:bg-white/60 hover:text-ink"
          }`
    }`;

  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-50 px-3 sm:px-5">
      <div
        className={`pointer-events-auto relative mx-auto transform-gpu transition-[max-width,margin,background-color,border-color,border-radius] duration-[400ms] ease-[cubic-bezier(.16,1,.3,1)] ${
          mobileOpen
            ? "mt-2 max-w-7xl rounded-[28px] border-line bg-[#fffaf5] shadow-float"
            : scrolled
              ? "mt-3 max-w-[980px] rounded-full border-white/10 bg-[#1c1916] shadow-[0_14px_36px_rgba(33,30,26,.2)]"
              : "mt-0 max-w-7xl rounded-none border-transparent bg-transparent shadow-none"
        } border`}
      >
        <div className={`relative flex items-center transition-[height,padding] duration-500 ${scrolled ? "h-[66px] px-3.5 sm:px-4" : "h-24 px-1 sm:px-2"}`}>
          <Link to="/" onPointerEnter={() => void preloadRoute("/")} onFocus={() => void preloadRoute("/")} className="group flex shrink-0 items-center" aria-label="Innflo home">
            <span className="grid h-[46px] w-[46px] shrink-0 place-items-center transition-transform duration-300 group-hover:scale-[1.04] sm:h-12 sm:w-12">
              <img
                src="/brand/mark-clay-tight.svg"
                alt=""
                aria-hidden="true"
                className="h-full w-full"
              />
            </span>
          </Link>

          <nav
            className={`absolute left-1/2 hidden -translate-x-1/2 items-center rounded-full border transition-[gap,padding,background-color,border-color,box-shadow] duration-500 lg:flex ${
              darkMode
                ? "gap-0.5 border-white/15 bg-white/[.06] p-1.5"
                : "gap-1 border-transparent bg-transparent p-0 xl:gap-3"
            }`}
            aria-label="Primary navigation"
          >
            <div
              className="relative"
              onMouseEnter={() => {
                setDesktopMenu("product");
                preloadRoutes([...PRODUCT_LINKS, ...MODULE_LINKS].map((item) => item.to));
              }}
              onMouseLeave={() => setDesktopMenu(null)}
            >
              <button
                type="button"
                onClick={() => setDesktopMenu((current) => current === "product" ? null : "product")}
                className={`${desktopLinkClass(productActive)} flex items-center gap-1.5`}
                aria-expanded={desktopMenu === "product"}
              >
                Product
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${desktopMenu === "product" ? "rotate-180" : ""}`} />
              </button>

              <AnimatePresence>
                {desktopMenu === "product" && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.985 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 5, scale: 0.99 }}
                    transition={{ duration: 0.22, ease: EASE }}
                    className="absolute left-1/2 top-full -ml-[260px] pt-4"
                  >
                    <div className="w-[520px] rounded-[24px] border border-line bg-[#fffdfa] p-3 shadow-[0_28px_80px_rgba(42,30,23,.2)]">
                      <p className="px-2 pb-2 pt-1 text-[9.5px] font-black uppercase tracking-[.15em] text-ink-faint">Core products</p>
                      <div className="grid gap-1">
                        {PRODUCT_LINKS.map((item) => {
                          const active = location.pathname.startsWith(item.to);
                          return (
                            <Link
                              key={item.to}
                              to={item.to}
                              onPointerEnter={() => void preloadRoute(item.to)}
                              onFocus={() => void preloadRoute(item.to)}
                              className={`flex items-start gap-3 rounded-2xl p-3.5 transition-colors ${active ? "bg-coral-soft" : "hover:bg-mist"}`}
                            >
                              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-coral-soft text-coral-dark">
                                <item.icon className="h-[18px] w-[18px]" />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className={`block text-[13.5px] font-black ${active ? "text-coral-dark" : "text-ink"}`}>{item.label}</span>
                                <span className="mt-1 block text-[11px] leading-relaxed text-ink-mute">{item.short}</span>
                              </span>
                            </Link>
                          );
                        })}
                      </div>

                      <div className="mt-2 border-t border-line-soft px-2 pt-3">
                        <p className="text-[9.5px] font-black uppercase tracking-[.15em] text-ink-faint">Explore the modules</p>
                        <div className="mt-1.5 grid grid-cols-2 gap-0.5">
                          {MODULE_LINKS.map((item) => {
                            const active = location.pathname.startsWith(item.to);
                            return (
                              <Link
                                key={item.to}
                                to={item.to}
                                onPointerEnter={() => void preloadRoute(item.to)}
                                onFocus={() => void preloadRoute(item.to)}
                                className={`flex items-center gap-2 rounded-xl px-2 py-2 text-[11.5px] font-bold transition-colors ${
                                  active ? "text-coral-dark" : "text-ink-soft hover:bg-mist hover:text-ink"
                                }`}
                              >
                                <item.icon className="h-3.5 w-3.5 shrink-0 text-coral-dark" />
                                {item.label}
                              </Link>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div
              className="relative"
              onMouseEnter={() => {
                setDesktopMenu("stays");
                preloadRoutes(STAY_LINKS.map((item) => item.to));
              }}
              onMouseLeave={() => setDesktopMenu(null)}
            >
              <button
                type="button"
                onClick={() => setDesktopMenu((current) => current === "stays" ? null : "stays")}
                className={`${desktopLinkClass(staysActive)} flex items-center gap-1.5`}
                aria-expanded={desktopMenu === "stays"}
              >
                Who it&apos;s for
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${desktopMenu === "stays" ? "rotate-180" : ""}`} />
              </button>

              <AnimatePresence>
                {desktopMenu === "stays" && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.985 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 5, scale: 0.99 }}
                    transition={{ duration: 0.22, ease: EASE }}
                    className="absolute left-1/2 top-full -ml-[250px] pt-4"
                  >
                    <div className="w-[500px] rounded-[24px] border border-line bg-[#fffdfa] p-3 shadow-[0_28px_80px_rgba(42,30,23,.2)]">
                      <div className="grid grid-cols-2 gap-1.5">
                        {STAY_LINKS.map((item) => {
                          const active = location.pathname.startsWith(item.to);
                          return (
                            <Link
                              key={item.to}
                              to={item.to}
                              onPointerEnter={() => void preloadRoute(item.to)}
                              onFocus={() => void preloadRoute(item.to)}
                              className={`flex items-start gap-3 rounded-2xl p-3.5 transition-colors ${active ? "bg-coral-soft" : "hover:bg-mist"}`}
                            >
                              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-coral-soft text-coral-dark">
                                <item.icon className="h-4 w-4" />
                              </span>
                              <span>
                                <span className={`block text-[12px] font-black ${active ? "text-coral-dark" : "text-ink"}`}>{item.label}</span>
                                <span className="mt-1 block text-[10px] leading-relaxed text-ink-mute">{item.copy}</span>
                              </span>
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <NavLink to="/pricing" onPointerEnter={() => void preloadRoute("/pricing")} onFocus={() => void preloadRoute("/pricing")} className={({ isActive }) => desktopLinkClass(isActive)}>Pricing</NavLink>
            <NavLink to="/about" onPointerEnter={() => void preloadRoute("/about")} onFocus={() => void preloadRoute("/about")} className={({ isActive }) => desktopLinkClass(isActive)}>About</NavLink>
          </nav>

          <div className="ml-auto hidden shrink-0 items-center gap-2 lg:flex">
            <a
              href="https://app.innflo.co/login"
              className={`flex h-10 items-center rounded-full px-4 text-[12px] font-bold transition-colors ${
                darkMode ? "text-white/80 hover:bg-white/10 hover:text-white" : "text-ink-soft hover:bg-white/70 hover:text-ink"
              }`}
            >
              Log in
            </a>
            <Link to="/contact" className="group flex h-10 items-center gap-2 rounded-full bg-coral px-5 text-[12px] font-black text-white shadow-pop transition-all hover:-translate-y-0.5 hover:bg-coral-dark">
              Book a walkthrough
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>

          <button
            type="button"
            onClick={() => setMobileOpen((current) => !current)}
            className={`ml-auto grid h-10 w-10 place-items-center rounded-full transition-colors lg:hidden ${
              darkMode ? "bg-white/10 text-white" : "bg-ink text-white"
            }`}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.28, ease: EASE }}
              className="overflow-hidden lg:hidden"
            >
              <div className="mx-3 max-h-[calc(100vh-100px)] overflow-y-auto border-t border-line-soft px-1 pb-6 pt-4 sm:mx-5">
                <p className="mb-2 px-2 text-[9px] font-black uppercase tracking-[.18em] text-ink-faint">Core products</p>
                <div className="grid gap-1">
                  {PRODUCT_LINKS.map((item) => (
                    <Link key={item.to} to={item.to} className="flex items-start gap-3 rounded-2xl p-3">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-coral-soft text-coral-dark">
                        <item.icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[12.5px] font-black text-ink">{item.label}</span>
                        <span className="mt-0.5 block text-[10.5px] leading-relaxed text-ink-mute">{item.short}</span>
                      </span>
                    </Link>
                  ))}
                </div>

                <div className="mt-2 border-t border-line-soft px-2 pt-3">
                  <p className="text-[9px] font-black uppercase tracking-[.18em] text-ink-faint">Explore the modules</p>
                  <div className="mt-1.5 grid grid-cols-2 gap-0.5">
                    {MODULE_LINKS.map((item) => (
                      <Link key={item.to} to={item.to} className="flex items-center gap-2 rounded-xl px-2 py-2 text-[11px] font-bold text-ink-soft">
                        <item.icon className="h-3.5 w-3.5 shrink-0 text-coral-dark" />
                        {item.label}
                      </Link>
                    ))}
                  </div>
                </div>

                <p className="mb-2 mt-5 px-2 text-[9px] font-black uppercase tracking-[.18em] text-ink-faint">Who it&apos;s for</p>
                <div className="grid grid-cols-2 gap-1">
                  {STAY_LINKS.map((item) => (
                    <Link key={item.to} to={item.to} className="flex items-center gap-2 rounded-xl px-2 py-2.5 text-[11px] font-bold text-ink-soft hover:bg-mist">
                      <item.icon className="h-3.5 w-3.5 text-coral-dark" /> {item.label}
                    </Link>
                  ))}
                </div>

                <div className="mt-5 grid grid-cols-3 border-y border-line-soft py-3">
                  {[["Pricing", "/pricing"], ["About", "/about"], ["Contact", "/contact"]].map(([label, to]) => (
                    <Link key={to} to={to} className="text-center text-[12px] font-black text-ink-soft">{label}</Link>
                  ))}
                </div>

                <div className="mt-5 flex gap-2">
                  <a href="https://app.innflo.co/login" className="flex h-11 flex-1 items-center justify-center rounded-full border border-ink text-[12px] font-black text-ink">Log in</a>
                  <Link to="/contact" className="flex h-11 flex-[1.35] items-center justify-center rounded-full bg-coral text-[12px] font-black text-white">Book walkthrough</Link>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </header>
  );
}
