import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import Nav    from "./components/Nav";
import Footer from "./components/Footer";

// Every page is lazy-loaded so the initial bundle only contains the shell
// (Nav/Footer/router) — matches the same convention already used in
// apps/web (see apps/web/src/App.tsx).
const Home              = lazy(() => import("./pages/Home"));
const Features          = lazy(() => import("./pages/Features"));
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
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

function RouteFallback() {
  return (
    <div className="flex items-center justify-center min-h-screen text-[14px] text-ink-soft">
      Loading…
    </div>
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
          </Routes>
        </Suspense>
      </main>
      <Footer />
    </BrowserRouter>
  );
}
