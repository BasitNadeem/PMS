import { Tent, Sparkles, UtensilsCrossed, LayoutDashboard, Wallet } from "lucide-react";
import StayTypeTemplate from "./StayTypeTemplate";

export default function Glamping() {
  return (
    <StayTypeTemplate
      eyebrow="Glamping site management"
      heading={["Rustic stays,", "modern backend."]}
      image="/images/glamping_hero.webp"
      intro="Cabins, pods, domes, or tents — Innflo treats every unit like a room, so the rustic experience out front runs on a proper system behind it."
      ctaLabel="Start a free trial"
      points={[
        { icon: Tent, title: "Unit inventory & timeline", body: "Every cabin or pod on one calendar, booked and tracked the same way a hotel room would be." },
        { icon: Sparkles, title: "Housekeeping tasks", body: "Turnover between guests creates its own cleaning task — nothing relies on someone remembering." },
        { icon: UtensilsCrossed, title: "On-site dining, if you offer it", body: "A QR code at each site lets guests order food straight from where they're staying." },
      ]}
      benefits={{
        tagline: "Benefits",
        heading: "Wild outside. Effortless behind the scenes.",
        items: [
          { icon: LayoutDashboard, title: "One system for every dome", body: "Cabins, pods, domes, and tents all booked, tracked, and billed on the same calendar — nothing needs its own separate setup.", image: "/images/benefits/glamping_dashboard.webp" },
          { icon: Sparkles, title: "Ready between guests", body: "Turnover creates its own cleaning task the moment a stay ends — no relying on someone to remember a remote unit.", image: "/images/benefits/glamping_ready.webp" },
          { icon: UtensilsCrossed, title: "Extras without extra staff", body: "A QR code at the site lets guests order food or add-ons directly — no one has to walk out to take the order.", image: "/images/benefits/glamping_extras.webp" },
          { icon: Wallet, title: "Runs without steady Wi-Fi", body: "Housekeeping works offline-first, syncing the moment a signal returns — built for sites where connectivity isn't guaranteed.", image: "/images/benefits/glamping_wifi.webp" },
        ],
      }}
      faqs={[
        { q: "Does Innflo work for cabins, domes, and tents the same way?", a: "Yes — each unit is set up like a room, with its own calendar, folio, and housekeeping status, regardless of what it physically is." },
        { q: "Can guests order food without walking to a front desk?", a: "Yes — a QR code at the site opens a menu guests order from directly, and the order can post straight to their bill." },
        { q: "Do I need reliable internet for Innflo to work?", a: "Housekeeping runs offline-first, so staff can keep working with no signal — everything syncs once connection returns." },
        { q: "Is there a minimum number of units required?", a: "No — the same setup works whether it's three domes or thirty." },
        { q: "How is Innflo priced for a small site?", a: "A single flat monthly fee based on size — no per-booking commission or hidden fees." },
      ]}
    />
  );
}
