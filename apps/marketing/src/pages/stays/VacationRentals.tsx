import { Building2, BarChart3, RefreshCcw, LayoutDashboard, Wallet, ShieldCheck } from "lucide-react";
import StayTypeTemplate from "./StayTypeTemplate";

export default function VacationRentals() {
  return (
    <StayTypeTemplate
      eyebrow="Vacation rental management"
      heading={["One calendar,", "every rentable unit."]}
      image="/images/vacation_rentals_hero.webp"
      intro="For a home, villa, cabin, or a set of rentable units at one property, Innflo keeps bookings, billing, guests and performance out of scattered spreadsheets."
      ctaLabel="Start a free trial"
      points={[
        { icon: Building2, title: "Unit management", body: "Every rentable unit on one calendar, so dates and guests do not get confused between spaces." },
        { icon: BarChart3, title: "Owner-ready reporting", body: "Occupancy, revenue, and ADR — the numbers an owner actually checks, already calculated." },
        { icon: RefreshCcw, title: "Channel roadmap", body: "Direct sync with Booking.com, Airbnb, Expedia, and Agoda is in development and not presented as live." },
      ]}
      benefits={{
        tagline: "Benefits",
        heading: "Every unit, one clear picture.",
        items: [
          { icon: LayoutDashboard, title: "Every unit, one system", body: "Rooms and rentable spaces at the property sit on the same calendar and dashboard.", image: "/images/benefits/vacation_dashboard.webp" },
          { icon: ShieldCheck, title: "Never double-booked", body: "Availability updates the instant a unit is booked, so the same dates can't be sold twice by mistake.", image: "/images/benefits/vacation_sync.webp" },
          { icon: Wallet, title: "Payments without the chase", body: "Cash, card, bank transfer, JazzCash, EasyPaisa — ten payment methods across every unit's folio.", image: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=600&q=80" },
          { icon: BarChart3, title: "Performance in context", body: "Occupancy, ADR and revenue sit beside the reservations and payments that produced them.", image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=600&q=80" },
        ],
      }}
      faqs={[
        { q: "Can I manage multiple units from one account?", a: "Yes — units at the same property sit on one calendar and share the hotel’s operating account." },
        { q: "Does Innflo support a multi-property owner dashboard?", a: "Not yet. Each hotel is intentionally isolated today; a group-level rollup is roadmap work for when real hotel-group demand warrants it." },
        { q: "Is channel sync available yet?", a: "It's in development. Direct bookings and manual entry work today; Channel Manager is what we're building toward." },
        { q: "What happens if I add a new unit later?", a: "Add another room or rentable unit to the property and give it the appropriate type, rate and availability." },
        { q: "How is pricing structured?", a: "Innflo uses flat monthly hotel plans with no percentage commission on direct bookings." },
      ]}
    />
  );
}
