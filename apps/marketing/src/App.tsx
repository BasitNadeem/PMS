import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter, Link, Routes, Route, useLocation } from "react-router-dom";
import Nav from "./components/Nav";
import Footer from "./components/Footer";
import {
  loadAbout,
  loadAutomations,
  loadBookingEngine,
  loadChannelManager,
  loadContact,
  loadFeatures,
  loadFinancials,
  loadGlamping,
  loadGuestHouses,
  loadHome,
  loadHotels,
  loadPointOfSale,
  loadPricing,
  loadStatistics,
  loadVacationRentals,
  preloadRoute,
  ROUTE_PREFETCH_ORDER,
} from "./lib/routePreload";

const Home = lazy(loadHome);
const Features = lazy(loadFeatures);
const BookingEngine = lazy(loadBookingEngine);
const ChannelManager = lazy(loadChannelManager);
const Financials = lazy(loadFinancials);
const PointOfSale = lazy(loadPointOfSale);
const Automations = lazy(loadAutomations);
const Statistics = lazy(loadStatistics);
const Pricing = lazy(loadPricing);
const About = lazy(loadAbout);
const Contact = lazy(loadContact);
const Hotels = lazy(loadHotels);
const GuestHouses = lazy(loadGuestHouses);
const VacationRentals = lazy(loadVacationRentals);
const Glamping = lazy(loadGlamping);

function RoutePreloader() {
  useEffect(() => {
    const timers: number[] = [];

    function beginPrefetch() {
      ROUTE_PREFETCH_ORDER.forEach((path, index) => {
        timers.push(window.setTimeout(() => {
          void preloadRoute(path);
        }, 350 + index * 180));
      });
    }

    if (document.readyState === "complete") {
      beginPrefetch();
    } else {
      window.addEventListener("load", beginPrefetch, { once: true });
    }

    return () => {
      window.removeEventListener("load", beginPrefetch);
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  return null;
}

const SITE_ORIGIN = "https://innflo.co";

const ROUTE_META: Record<string, { title: string; description: string }> = {
  "/": {
    title: "Innflo — Hotel operations, finally in flow",
    description: "A manager-first hotel PMS for reservations, billing, housekeeping, direct bookings, POS, inventory and reporting.",
  },
  "/pms": { title: "Hotel PMS | Innflo", description: "Run reservations, rooms, guests, folios, housekeeping and daily hotel operations in one place." },
  "/booking-engine": { title: "Direct Hotel Booking Engine | Innflo", description: "A branded, commission-free hotel Booking Engine with live availability, multi-room carts, promo rates and connected PMS alerts." },
  "/financials": { title: "Hotel Financial Control | Innflo", description: "Connected folios, payments, expenses, cash control and night audit for independent hotels." },
  "/pos": { title: "Hotel POS & QR Ordering | Innflo", description: "Restaurant POS, QR ordering, kitchen display and guest folio posting connected to your hotel PMS." },
  "/automations": { title: "Hotel Operations Automation | Innflo", description: "Reduce repetitive hotel work with connected reservation, housekeeping, billing and inventory workflows." },
  "/statistics": { title: "Hotel Reports & Insights | Innflo", description: "Operational and financial hotel reporting built for the manager’s daily decisions." },
  "/pricing": { title: "Pricing | Innflo Hotel PMS", description: "Hotel PMS plans quoted to your property, with no commission on direct bookings. Book a walkthrough for a quote." },
  "/about": { title: "About Innflo", description: "Why Innflo is building manager-first hotel software for independent properties in Pakistan." },
  "/contact": { title: "Book an Innflo Walkthrough", description: "Show us how your property runs and get a focused walkthrough of the live Innflo hotel PMS." },
  "/channel-manager": { title: "Channel Manager Roadmap | Innflo", description: "Follow Innflo’s clearly labeled roadmap for direct OTA channel synchronization." },
  "/stays/hotels": { title: "Hotel Management Software for Independent Hotels | Innflo", description: "Reservations, housekeeping, billing and direct bookings for independent hotels, boutiques and resorts in Pakistan." },
  "/stays/guesthouses": { title: "Guesthouse & B&B Management Software | Innflo", description: "Simple property management for guesthouses and B&Bs — bookings, guest records, billing and housekeeping in one place." },
  "/stays/vacation-rentals": { title: "Vacation Rental Management Software | Innflo", description: "Manage serviced apartments and independent rental units — reservations, guests, billing and direct bookings." },
  "/stays/glamping": { title: "Glamping & Campsite Management Software | Innflo", description: "Run cabins, pods, domes and tented camps — bookings, availability, guest billing and housekeeping." },
};

const FALLBACK_META = {
  title: "Innflo — Hotel PMS",
  description: "Manager-first hotel operations software for independent properties.",
};

/** Create the tag if it is missing, then set its value. */
function setMetaContent(attribute: "name" | "property", key: string, value: string) {
  let tag = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute(attribute, key);
    document.head.appendChild(tag);
  }
  tag.setAttribute("content", value);
}

function setCanonical(href: string) {
  let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!link) {
    link = document.createElement("link");
    link.rel = "canonical";
    document.head.appendChild(link);
  }
  link.href = href;
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    const meta = ROUTE_META[pathname] ?? FALLBACK_META;
    // Prerendering writes each route as dist/<route>/index.html, and nginx's
    // `try_files $uri $uri/` redirects /pricing to /pricing/ to reach it. The
    // trailing-slash form is therefore the URL that actually serves a 200, so
    // it is the one canonical and og:url must advertise — pointing them at a
    // URL that immediately redirects is a contradictory signal.
    const canonicalPath = pathname.endsWith("/") ? pathname : `${pathname}/`;
    const url = `${SITE_ORIGIN}${canonicalPath}`;

    // Prerendering runs this in a real browser and snapshots the result, so
    // whatever is set here is what crawlers and link-preview bots ultimately
    // read out of the static HTML for each route.
    document.title = meta.title;
    setMetaContent("name", "description", meta.description);
    setMetaContent("property", "og:title", meta.title);
    setMetaContent("property", "og:description", meta.description);
    setMetaContent("property", "og:url", url);
    setCanonical(url);

    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function RouteFallback() {
  return (
    <div className="min-h-[72vh] bg-grid px-6 pt-32" aria-busy="true" aria-label="Loading page">
      <div className="mx-auto max-w-7xl animate-pulse">
        <div className="h-3 w-24 rounded-full bg-coral/15" />
        <div className="mt-6 h-12 max-w-xl rounded-2xl bg-ink/[.055]" />
        <div className="mt-4 h-4 max-w-md rounded-full bg-ink/[.045]" />
      </div>
    </div>
  );
}

function NotFound() {
  return (
    <section className="grid min-h-[75vh] place-items-center bg-grid px-6 pt-24 text-center">
      <div>
        <p className="eyebrow mb-4">404 · Room not found</p>
        <h1 className="font-display text-[clamp(44px,7vw,76px)] font-medium">This page has checked out.</h1>
        <p className="mx-auto mt-5 max-w-md text-[15px] leading-relaxed text-ink-soft">The link may have moved. The product, pricing and walkthrough are still right where they should be.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link to="/" className="inline-flex h-11 items-center rounded-full bg-coral px-7 text-[13px] font-bold text-white">Return home</Link>
          <Link to="/contact" className="inline-flex h-11 items-center rounded-full border border-ink px-7 text-[13px] font-bold text-ink">Book a walkthrough</Link>
        </div>
      </div>
    </section>
  );
}

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true }}>
      <ScrollToTop />
      <RoutePreloader />
      <Nav />
      <main>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/pms" element={<Features />} />
            <Route path="/booking-engine" element={<BookingEngine />} />
            <Route path="/channel-manager" element={<ChannelManager />} />
            <Route path="/financials" element={<Financials />} />
            <Route path="/pos" element={<PointOfSale />} />
            <Route path="/automations" element={<Automations />} />
            <Route path="/statistics" element={<Statistics />} />
            <Route path="/stays/hotels" element={<Hotels />} />
            <Route path="/stays/guesthouses" element={<GuestHouses />} />
            <Route path="/stays/vacation-rentals" element={<VacationRentals />} />
            <Route path="/stays/glamping" element={<Glamping />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/about" element={<About />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>
      <Footer />
    </BrowserRouter>
  );
}
