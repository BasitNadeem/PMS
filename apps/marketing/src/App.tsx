import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { useEffect } from "react";
import Nav    from "./components/Nav";
import Footer from "./components/Footer";
import Home    from "./pages/Home";
import Features from "./pages/Features";
import ChannelManager from "./pages/ChannelManager";
import Financials from "./pages/Financials";
import PointOfSale from "./pages/PointOfSale";
import Automations from "./pages/Automations";
import Statistics  from "./pages/Statistics";
import Pricing  from "./pages/Pricing";
import About    from "./pages/About";
import Contact  from "./pages/Contact";
import Hotels from "./pages/stays/Hotels";
import GuestHouses from "./pages/stays/GuestHouses";
import VacationRentals from "./pages/stays/VacationRentals";
import Glamping from "./pages/stays/Glamping";

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Nav />
      <main>
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
      </main>
      <Footer />
    </BrowserRouter>
  );
}
