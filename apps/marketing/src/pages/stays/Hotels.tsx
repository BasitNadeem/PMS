import { CalendarClock, Wallet, Sparkles, LayoutDashboard, RefreshCcw, BarChart3 } from "lucide-react";
import StayTypeTemplate from "./StayTypeTemplate";

export default function Hotels() {
  return (
    <StayTypeTemplate
      eyebrow="Hotel management"
      heading={["Run a hotel,", "not a spreadsheet."]}
      image="/images/hotels_hero.webp"
      intro="Boutique, motel, resort, or independent city hotel — InnFlo runs reservations, billing, and housekeeping from a single dashboard."
      ctaLabel="Start a free trial"
      points={[
        { icon: CalendarClock, title: "Reservations & timeline", body: "A visual calendar across every room, with group bookings and multi-night stays handled without a spreadsheet on the side." },
        { icon: Wallet, title: "Folios & billing", body: "Room, F&B, spa, and tax land on one live guest folio, across ten payment methods, settled at checkout in one step." },
        { icon: Sparkles, title: "Housekeeping, automated", body: "A checkout closes and the cleaning task appears on its own — staff mark rooms done from their phone." },
      ]}
      benefits={{
        tagline: "BENEFITS",
        heading: "Run a tighter ship, one dashboard at a time.",
        items: [
          { icon: LayoutDashboard, title: "Simple management", body: "One dashboard for reservations, billing, and housekeeping — stop logging into three different systems to run one property.", image: "/images/benefits/dashboard.webp" },
          { icon: RefreshCcw, title: "Win more direct bookings", body: "Give guests a branded public Booking Engine with live room availability, rate plans, promo codes, and a multi-room cart.", image: "/images/benefits/channel.webp" },
          { icon: Wallet, title: "Take payments your way", body: "Cash, card, bank transfer, JazzCash, EasyPaisa — ten payment methods on one guest folio.", image: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=600&q=80" },
          { icon: BarChart3, title: "Understand the numbers", body: "Occupancy, ADR, RevPAR, and profit margin — already calculated on the daily and monthly report.", image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=600&q=80" },
        ],
      }}
      faqs={[
        { q: "Is InnFlo built for large chains or independent hotels?", a: "Independent hotels — InnFlo is priced and built for properties that do not fit the enterprise template, not hundred-hotel chains." },
        { q: "Can InnFlo handle group bookings?", a: "Yes — a group spanning several rooms settles as one combined bill or splits by room, and every room still rolls into the same folio automatically." },
        { q: "Does InnFlo work across multiple floors or buildings?", a: "Yes — rooms are organized by floor and type, so a multi-building property is represented the same way a single building is." },
        { q: "Can staff use InnFlo from their phones?", a: "Yes — housekeeping in particular is built phone-first and works offline, syncing the moment a signal returns." },
        { q: "How is InnFlo priced?", a: "A single flat monthly fee based on property size — no commission per booking, no hidden per-guest fees." },
      ]}
    />
  );
}
