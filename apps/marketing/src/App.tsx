import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter, Link, Routes, Route, useLocation } from "react-router-dom";
import Nav    from "./components/Nav";
import Footer from "./components/Footer";

// Every page is lazy-loaded so the initial bundle only contains the shell
// (Nav/Footer/router) — matches the same convention already used in
// apps/web (see apps/web/src/App.tsx).
const Home              = lazy(() => import("./pages/Home"));
const Features          = lazy(() => import("./pages/Features"));
const BookingEngine     = lazy(() => import("./pages/BookingEngine"));
const ChannelManager     = lazy(() => import("./pages/ChannelManager"));
const Financials         = lazy(() => import("./pages/Financials"));
const PointOfSale        = lazy(() => import("./pages/PointOfSale"));
const Automations        = lazy(() => import("./pages/Automations"));
const Statistics         = lazy(() => import("./pages/Statistics"));
const Pricing            = lazy(() => import("./pages/Pricing"));
const About              = lazy(() => import("./pages/About"));
const Contact            = lazy(() => import("./pages/Contact"));
const Hotels             = lazy(() => import("./pages/stays/Hotels"));
const GuestHouses        = lazy(() => import("./pages/stays/GuestHouses"));
const VacationRentals    = lazy(() => import("./pages/stays/VacationRentals"));
const Glamping           = lazy(() => import("./pages/stays/Glamping"));

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    const routeMeta: Record<string, { title: string; description: string }> = {
      "/": {
        title: "InnFlo — Hotel operations, finally in flow",
        description: "A manager-first hotel PMS for reservations, billing, housekeeping, direct bookings, POS, inventory and reporting.",
      },
      "/pms": { title: "Hotel PMS | InnFlo", description: "Run reservations, rooms, guests, folios, housekeeping and daily hotel operations in one place." },
      "/booking-engine": { title: "Direct Hotel Booking Engine | InnFlo", description: "A branded, commission-free hotel Booking Engine with live availability, multi-room carts, promo rates and connected PMS alerts." },
      "/financials": { title: "Hotel Financial Control | InnFlo", description: "Connected folios, payments, expenses, cash control and night audit for independent hotels." },
      "/pos": { title: "Hotel POS & QR Ordering | InnFlo", description: "Restaurant POS, QR ordering, kitchen display and guest folio posting connected to your hotel PMS." },
      "/automations": { title: "Hotel Operations Automation | InnFlo", description: "Reduce repetitive hotel work with connected reservation, housekeeping, billing and inventory workflows." },
      "/statistics": { title: "Hotel Reports & Insights | InnFlo", description: "Operational and financial hotel reporting built for the manager’s daily decisions." },
      "/pricing": { title: "Pricing | InnFlo Hotel PMS", description: "Straightforward monthly hotel PMS pricing with no commission on direct bookings." },
      "/about": { title: "About InnFlo", description: "Why InnFlo is building manager-first hotel software for independent properties in Pakistan." },
      "/contact": { title: "Book an InnFlo Walkthrough", description: "Show us how your property runs and get a focused walkthrough of the live InnFlo hotel PMS." },
      "/channel-manager": { title: "Channel Manager Roadmap | InnFlo", description: "Follow InnFlo’s clearly labeled roadmap for direct OTA channel synchronization." },
    };
    const meta = routeMeta[pathname] ?? {
      title: "InnFlo — Hotel PMS",
      description: "Manager-first hotel operations software for independent properties.",
    };
    document.title = meta.title;
    let description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (!description) {
      description = document.createElement("meta");
      description.name = "description";
      document.head.appendChild(description);
    }
    description.content = meta.description;
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function RouteFallback() {
  return (
    <div className="flex items-center justify-center min-h-screen text-[14px] text-ink-soft">
      Loading…
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
    <BrowserRouter>
      <ScrollToTop />
      <Nav />
      <main>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/"         element={<Home />}     />
            <Route path="/pms"              element={<Features />}       />
            <Route path="/booking-engine"   element={<BookingEngine />}  />
            <Route path="/channel-manager"  element={<ChannelManager />} />
            <Route path="/financials"       element={<Financials />}     />
            <Route path="/pos"              element={<PointOfSale />}    />
            <Route path="/automations"      element={<Automations />}    />
            <Route path="/statistics"   element={<Statistics />}  />
            <Route path="/stays/hotels"            element={<Hotels />}          />
            <Route path="/stays/guesthouses"       element={<GuestHouses />}     />
            <Route path="/stays/vacation-rentals"  element={<VacationRentals />} />
            <Route path="/stays/glamping"          element={<Glamping />}        />
            <Route path="/pricing"  element={<Pricing />}  />
            <Route path="/about"    element={<About />}    />
            <Route path="/contact"  element={<Contact />}  />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>
      <Footer />
    </BrowserRouter>
  );
}
