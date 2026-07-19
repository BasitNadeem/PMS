import { Building2, BarChart3, RefreshCcw, LayoutDashboard, Wallet, ShieldCheck } from "lucide-react";
import StayTypeTemplate from "./StayTypeTemplate";

export default function VacationRentals() {
  return (
    <StayTypeTemplate
      eyebrow="Vacation rental management"
      heading={["One dashboard,", "every property you own."]}
      image="/images/vacation_rentals_hero.webp"
      intro="A single home or a portfolio of them — InnFlo keeps every unit's bookings, billing, and performance in one place instead of scattered across spreadsheets."
      ctaLabel="Start a free trial"
      points={[
        { icon: Building2, title: "Multi-unit management", body: "Every property on one calendar, so a booking on one unit never gets confused with another." },
        { icon: BarChart3, title: "Owner-level reporting", body: "Occupancy, revenue, and ADR per unit — the numbers an owner actually checks, already calculated." },
        { icon: RefreshCcw, title: "Channel sync", body: "Direct sync with Booking.com, Airbnb, Expedia, and Agoda is in development — built for portfolios that list across several channels." },
      ]}
      benefits={{
        tagline: "Benefits",
        heading: "Every unit, one clear picture.",
        items: [
          { icon: LayoutDashboard, title: "Every unit, one system", body: "No separate login per property — every unit you manage sits on the same calendar and dashboard.", image: "/images/benefits/vacation_dashboard.png" },
          { icon: ShieldCheck, title: "Never double-booked", body: "Availability updates the instant a unit is booked, so the same dates can't be sold twice by mistake.", image: "/images/benefits/vacation_sync.png" },
          { icon: Wallet, title: "Payments without the chase", body: "Cash, card, bank transfer, JazzCash, EasyPaisa — ten payment methods across every unit's folio.", image: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=600&q=80" },
          { icon: BarChart3, title: "Performance, per property", body: "Occupancy, ADR, and revenue per unit — and rolled up across the whole portfolio when you need the bigger picture.", image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=600&q=80" },
        ],
      }}
      faqs={[
        { q: "Can I manage multiple units from one account?", a: "Yes — every property sits on one calendar, so nothing gets double-booked or mixed up between units." },
        { q: "Does InnFlo report per property or just overall?", a: "Both — see performance for a single unit, or roll everything up into one portfolio-wide view." },
        { q: "Is channel sync available yet?", a: "It's in development. Direct bookings and manual entry work today; Channel Manager is what we're building toward." },
        { q: "What happens if I add a new unit later?", a: "Add it to your account the same way as any other — no separate setup process or extra system to configure." },
        { q: "How is pricing structured across multiple units?", a: "One flat monthly fee scaled to your portfolio size — not a separate subscription per property." },
      ]}
    />
  );
}
