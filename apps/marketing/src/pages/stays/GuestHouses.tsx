import { BedDouble, Wallet, UtensilsCrossed, LayoutDashboard, Receipt, Coffee, Users } from "lucide-react";
import StayTypeTemplate from "./StayTypeTemplate";

export default function GuestHouses() {
  return (
    <StayTypeTemplate
      eyebrow="B&B & guesthouse management"
      heading={["Small property,", "big-hotel software."]}
      image="/images/guesthouses_hero.webp"
      intro="A handful of rooms and a lot of personal attention — Innflo keeps the essentials running without turning your guesthouse into a call center."
      ctaLabel="Start a free trial"
      points={[
        { icon: BedDouble, title: "Simple reservations", body: "A clear calendar for a small number of rooms — no bloated setup built for a hundred-room hotel." },
        { icon: Wallet, title: "Guest folios", body: "Every charge and payment on one bill, settled at checkout, without a separate notebook for who owes what." },
        { icon: UtensilsCrossed, title: "QR ordering, if you serve food", body: "Guests scan a code to order breakfast or a snack from their room — no extra staff needed to take the order." },
      ]}
      benefits={{
        tagline: "Benefits",
        heading: "Big-hotel power, without losing the personal touch.",
        items: [
          { icon: LayoutDashboard, title: "One system, not five", body: "Calendar, guest folio, and housekeeping in one place — no more juggling a notebook, a payments app, and a separate checklist.", image: "/images/benefits/dashboard.webp" },
          { icon: Receipt, title: "Skip the notebook", body: "Every charge and payment lands on one guest folio automatically — no separate ledger for who still owes what.", image: "/images/benefits/guesthouse2.webp" },
          { icon: Coffee, title: "Breakfast without the wait", body: "A QR code lets guests order breakfast or a snack straight from their room — no one has to walk over and take the order.", image: "/images/benefits/guesthouse3.webp" },
          { icon: Users, title: "Every guest remembered", body: "Guest profiles track stay history and flag repeat guests automatically, so a returning face feels like a regular, not a stranger.", image: "/images/benefits/guesthouse4.webp" },
        ],
      }}
      faqs={[
        { q: "Is Innflo overkill for just a few rooms?", a: "No — the setup is the same whether it's three rooms or thirty. You only ever see the modules your property actually uses." },
        { q: "Can I run everything myself, without extra staff?", a: "Yes — folio billing, housekeeping, and QR ordering are built so one or two people can run a small property without hiring more hands." },
        { q: "Does Innflo help reduce OTA commission?", a: "Direct bookings settle the same way OTA bookings do, on one calendar — and Channel Manager (in development) aims to make listing everywhere easier without extra manual work." },
        { q: "Can guests order breakfast without me taking the order?", a: "Yes — a QR code opens a simple menu guests order from directly, right from their room." },
        { q: "Is there a minimum contract?", a: "No — a flat monthly fee based on property size, with no long-term lock-in." },
      ]}
    />
  );
}
