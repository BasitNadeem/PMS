import { useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import Reveal from "../components/motion/Reveal";
import SplitHeading from "../components/motion/SplitHeading";
import TabbedFeatureBlock from "../components/features/TabbedFeatureBlock";
import {
  ArrowRight,
  BedDouble,
  BellRing,
  Calculator,
  CalendarCheck2,
  CalendarRange,
  ChefHat,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock,
  Crown,
  DoorOpen,
  EyeOff,
  Globe,
  KeyRound,
  LayoutDashboard,
  Lock,
  Plus,
  ReceiptText,
  RefreshCw,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Tag,
  UserCog,
  Users,
  Utensils,
  Wallet,
  Wifi,
  Wrench,
} from "lucide-react";

import {
  LiveScheduleMockup, PosTerminalMockup, QrMenuMockup,
  InventoryControlMockup, LiveFolioMockup,
} from "../components/features/TabModuleMockups";
import PmsHeroMockup from "../components/features/PmsHeroMockup";
import RatePlanMockup from "../components/features/RatePlanMockup";
import ReservationTimelineMockup from "../components/features/ReservationTimelineMockup";

function RoleWorkspaceShowcase() {
  const roles = [
    {
      id: "owner",
      label: "Owner",
      initials: "BN",
      person: "Basit Nadeem",
      access: "Full property view",
      modules: [
        { label: "Dashboard", icon: LayoutDashboard },
        { label: "Reservations", icon: CalendarCheck2 },
        { label: "Rooms", icon: BedDouble },
        { label: "Financials", icon: Wallet },
        { label: "Team", icon: Users },
        { label: "Reports", icon: Calculator },
        { label: "Settings", icon: Settings },
      ],
      eyebrow: "Owner overview",
      heading: "The whole property, without chasing departments.",
      metrics: [["Occupancy", "86%"], ["Revenue today", "PKR 78.5K"], ["Arrivals", "8"], ["Open follow-ups", "3"]],
      items: [["Front desk handover", "Ready · 3 notes"], ["Housekeeping", "12 of 15 rooms done"], ["Cash variance", "Balanced"]],
      guardrail: "All hotel controls available",
    },
    {
      id: "manager",
      label: "Manager",
      initials: "MR",
      person: "Mariam Raza",
      access: "Operations access",
      modules: [
        { label: "Dashboard", icon: LayoutDashboard },
        { label: "Reservations", icon: CalendarCheck2 },
        { label: "Rooms", icon: BedDouble },
        { label: "Housekeeping", icon: Sparkles },
        { label: "POS", icon: Utensils },
        { label: "Reports", icon: Calculator },
        { label: "Team", icon: Users },
      ],
      eyebrow: "Manager workspace",
      heading: "Today’s operation, already brought together.",
      metrics: [["Occupancy", "86%"], ["Due in", "8"], ["To clean", "3"], ["Open issues", "2"]],
      items: [["Room 204", "Late arrival · 8:30 PM"], ["Room 108", "Cleaning in progress"], ["Kitchen", "2 orders awaiting prep"]],
      guardrail: "Ownership settings stay protected",
    },
    {
      id: "front-desk",
      label: "Front desk",
      initials: "AK",
      person: "Ayesha Khan",
      access: "Guest operations",
      modules: [
        { label: "Dashboard", icon: LayoutDashboard },
        { label: "Reservations", icon: CalendarCheck2 },
        { label: "Rooms", icon: BedDouble },
        { label: "Guests", icon: Users },
        { label: "Billing", icon: ReceiptText },
        { label: "Housekeeping", icon: Sparkles },
        { label: "POS", icon: Utensils },
      ],
      eyebrow: "Front desk workspace",
      heading: "Every arrival, stay and folio within reach.",
      metrics: [["Arrivals", "8"], ["Departures", "5"], ["Rooms ready", "6"], ["Open folios", "11"]],
      items: [["Zara Khan", "Room 108 · Arriving 2 PM"], ["Hamza Ahmed", "Room 104 · Checked in"], ["Rao Family", "3 rooms · Balance due"]],
      guardrail: "Refund controls stay out of view",
    },
    {
      id: "housekeeping",
      label: "Housekeeping",
      initials: "SK",
      person: "Sana Karim",
      access: "Rooms and assigned tasks",
      modules: [
        { label: "Dashboard", icon: LayoutDashboard },
        { label: "Rooms", icon: BedDouble },
        { label: "Housekeeping", icon: Sparkles },
        { label: "Maintenance", icon: Wrench },
      ],
      eyebrow: "Housekeeping workspace",
      heading: "A clean task list—without guest or money screens.",
      metrics: [["Assigned", "6"], ["Completed", "4"], ["In progress", "1"], ["Priority", "1"]],
      items: [["Room 101", "Checkout clean · Priority"], ["Room 204", "Stayover refresh · In progress"], ["Room 305", "Linen change · Next"]],
      guardrail: "Guest and financial data stay out of view",
    },
    {
      id: "kitchen",
      label: "Kitchen",
      initials: "UR",
      person: "Usman Rafiq",
      access: "Orders and stock",
      modules: [
        { label: "Kitchen dashboard", icon: ChefHat },
        { label: "Display mode", icon: ClipboardCheck },
        { label: "POS", icon: Utensils },
        { label: "Inventory", icon: Calculator },
      ],
      eyebrow: "Kitchen workspace",
      heading: "Tickets, prep and stock. Nothing else in the way.",
      metrics: [["New tickets", "3"], ["Preparing", "4"], ["Ready", "2"], ["Low stock", "1"]],
      items: [["Order #412", "Room 204 · 6 min"], ["Order #413", "Dine in · 4 min"], ["Order #414", "Pickup · New"]],
      guardrail: "Guest records stay out of view",
    },
    {
      id: "maintenance",
      label: "Maintenance",
      initials: "FA",
      person: "Fahad Ali",
      access: "Rooms and issues",
      modules: [
        { label: "Dashboard", icon: LayoutDashboard },
        { label: "Rooms", icon: BedDouble },
        { label: "Housekeeping", icon: Sparkles },
        { label: "Maintenance", icon: Wrench },
      ],
      eyebrow: "Maintenance workspace",
      heading: "Every fault, room and priority in one queue.",
      metrics: [["Open", "5"], ["Urgent", "1"], ["In progress", "2"], ["Closed today", "4"]],
      items: [["Room 208", "Water heater · Urgent"], ["Room 114", "Door lock · In progress"], ["Lobby", "Light fitting · Scheduled"]],
      guardrail: "Guest and financial data stay out of view",
    },
    {
      id: "accountant",
      label: "Accountant",
      initials: "RM",
      person: "Rida Malik",
      access: "Money and reporting",
      modules: [
        { label: "Dashboard", icon: LayoutDashboard },
        { label: "Billing", icon: ReceiptText },
        { label: "Expenses", icon: Wallet },
        { label: "Balance book", icon: Calculator },
        { label: "Reports", icon: ClipboardCheck },
      ],
      eyebrow: "Accountant workspace",
      heading: "The financial picture, without operational clutter.",
      metrics: [["Revenue", "PKR 78.5K"], ["Expenses", "PKR 18.2K"], ["Receivables", "PKR 31K"], ["Variance", "PKR 0"]],
      items: [["Cash shift", "Balanced · 6:00 PM"], ["Bank transfer", "PKR 24,000 · Recorded"], ["Monthly report", "Ready to export"]],
      guardrail: "Room-operation controls stay out of view",
    },
  ];

  const [activeRoleId, setActiveRoleId] = useState("front-desk");
  const activeRole = roles.find((role) => role.id === activeRoleId) ?? roles[2];

  return (
    <div className="relative">
      <div className="mb-5 flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {roles.map((role) => (
          <button
            key={role.id}
            type="button"
            onClick={() => setActiveRoleId(role.id)}
            aria-pressed={activeRole.id === role.id}
            className={`shrink-0 rounded-full border px-4 py-2.5 font-body text-[12px] font-black transition-all ${
              activeRole.id === role.id
                ? "border-coral bg-coral text-white shadow-[0_10px_30px_rgba(224,83,43,.28)]"
                : "border-white/10 bg-white/[.055] text-white/55 hover:border-white/25 hover:text-white"
            }`}
          >
            {role.label}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-[28px] border border-white/10 bg-[#F7F3EE] shadow-[0_38px_100px_rgba(0,0,0,.38)]">
        <div className="flex h-12 items-center justify-between border-b border-line bg-white px-4 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex shrink-0 gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#F5A6A0]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#F5D183]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#9EDDC7]" />
            </div>
            <span className="truncate text-[9px] font-black text-ink-mute">Innflo · Central Inn</span>
          </div>
          <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[7px] font-black text-emerald-700">
            <ShieldCheck className="h-3 w-3" />
            ACCESS VERIFIED
          </span>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeRole.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22 }}
            className="grid min-h-[510px] grid-cols-1 sm:grid-cols-[205px_minmax(0,1fr)]"
          >
            <aside className="bg-[#211E1A] p-4 text-white sm:p-5">
              <div className="flex items-center gap-3 border-b border-white/10 pb-5">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-coral text-[10px] font-black">
                  {activeRole.initials}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[10px] font-black">{activeRole.person}</p>
                  <p className="mt-1 text-[7px] font-bold uppercase tracking-[.13em] text-white/35">{activeRole.label}</p>
                </div>
              </div>

              <p className="mt-5 text-[7px] font-black uppercase tracking-[.16em] text-white/30">Your workspace</p>
              <nav className="mt-2.5 grid grid-cols-2 gap-1 sm:grid-cols-1">
                {activeRole.modules.map((module, index) => {
                  const ModuleIcon = module.icon;
                  return (
                    <div
                      key={module.label}
                      className={`flex min-w-0 items-center gap-2 rounded-xl px-2.5 py-2 text-[8px] font-bold ${
                        index === 0 ? "bg-white text-ink" : "text-white/55"
                      }`}
                    >
                      <ModuleIcon className={`h-3 w-3 shrink-0 ${index === 0 ? "text-coral" : "text-white/35"}`} />
                      <span className="truncate">{module.label}</span>
                    </div>
                  );
                })}
              </nav>

              <div className="mt-5 rounded-2xl border border-white/10 bg-white/[.055] p-3">
                <div className="flex items-center gap-2">
                  <EyeOff className="h-3.5 w-3.5 text-coral" />
                  <p className="text-[8px] font-black">No disabled clutter</p>
                </div>
                <p className="mt-1.5 text-[7px] leading-relaxed text-white/35">{activeRole.guardrail}</p>
              </div>
            </aside>

            <main className="min-w-0 p-4 sm:p-6 lg:p-7">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-[7px] font-black uppercase tracking-[.16em] text-coral-dark">{activeRole.eyebrow}</p>
                  <h3 className="mt-2 max-w-xl font-display text-[clamp(22px,3vw,34px)] font-medium leading-tight text-ink">
                    {activeRole.heading}
                  </h3>
                </div>
                <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-line bg-white px-3 py-2 text-[7px] font-black text-ink-soft">
                  <KeyRound className="h-3 w-3 text-emerald-600" />
                  {activeRole.access}
                </span>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-2 lg:grid-cols-4">
                {activeRole.metrics.map(([label, value]) => (
                  <div key={label} className="rounded-2xl border border-line bg-white p-3 shadow-card">
                    <p className="text-[6.5px] font-black uppercase tracking-wider text-ink-mute">{label}</p>
                    <p className="mt-2 text-[15px] font-black text-ink">{value}</p>
                  </div>
                ))}
              </div>

              <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_190px]">
                <div className="overflow-hidden rounded-2xl border border-line bg-white">
                  <div className="flex items-center justify-between border-b border-line-soft px-4 py-3">
                    <div>
                      <p className="text-[9px] font-black text-ink">Work that needs attention</p>
                      <p className="mt-0.5 text-[6.5px] text-ink-mute">Only this role’s relevant queue appears</p>
                    </div>
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  </div>
                  <div className="divide-y divide-line-soft">
                    {activeRole.items.map(([title, detail], index) => (
                      <div key={title} className="flex items-center gap-3 px-4 py-3">
                        <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-xl text-[7px] font-black ${
                          index === 0 ? "bg-coral-soft text-coral-dark" : "bg-mist text-ink-mute"
                        }`}>
                          {index + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-[8px] font-black text-ink">{title}</p>
                          <p className="mt-0.5 truncate text-[6.5px] font-semibold text-ink-mute">{detail}</p>
                        </div>
                        <ChevronRight className="ml-auto h-3 w-3 shrink-0 text-ink-faint" />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl bg-coral p-4 text-white shadow-[0_18px_45px_rgba(224,83,43,.22)]">
                  <UserCog className="h-5 w-5" />
                  <p className="mt-5 text-[11px] font-black">Owner-controlled access</p>
                  <p className="mt-2 text-[7px] leading-relaxed text-white/65">
                    Choose who can view, create, update or manage each area.
                  </p>
                  <div className="mt-5 rounded-xl bg-white/15 px-3 py-2.5">
                    <p className="text-[7px] font-black">Enforced beyond the menu</p>
                    <p className="mt-1 text-[6.5px] leading-relaxed text-white/60">Protected actions remain protected even outside the screen.</p>
                  </div>
                </div>
              </div>
            </main>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}



// ─── Booking Engine Mockup ──────────────────────────────────────────────────
function BookingEngineMockup() {
  return (
    <div className="w-full max-w-lg mx-auto rounded-[24px] bg-white border border-line shadow-float overflow-hidden font-body flex flex-col">
      {/* Browser Window Header */}
      <div className="h-10 bg-[#f4f4f4] border-b border-line-soft flex items-center px-4 gap-2">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-400"></div>
          <div className="w-2.5 h-2.5 rounded-full bg-amber-400"></div>
          <div className="w-2.5 h-2.5 rounded-full bg-green-400"></div>
        </div>
        <div className="mx-auto bg-white text-[10px] text-ink-mute font-medium px-6 py-1 rounded-md border border-line-soft shadow-sm">
          yourhotel.com/book
        </div>
        <div className="w-10"></div>
      </div>

      {/* Widget Header - Hotel Info */}
      <div className="bg-ink p-6 text-white flex justify-between items-center relative overflow-hidden">
        <div className="absolute right-0 top-0 w-32 h-32 bg-coral/20 rounded-full blur-3xl pointer-events-none"></div>
        <div className="relative z-10">
          <h3 className="font-display text-[22px] font-medium">The Grand Hotel</h3>
          <p className="text-[12px] text-white/60 mt-1">Select your dates of stay</p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white border-b border-line-soft p-4">
        <div className="flex bg-mist rounded-[14px] p-1.5 gap-1 border border-line-soft">
          <div className="flex-1 bg-white rounded-[10px] shadow-sm px-3 py-2 border border-line-soft">
             <p className="text-[9px] font-bold uppercase tracking-wider text-ink-mute">Check-in</p>
             <p className="text-[13px] font-semibold text-ink mt-0.5">Aug 14</p>
          </div>
          <div className="flex-1 px-3 py-2 flex flex-col justify-center">
             <p className="text-[9px] font-bold uppercase tracking-wider text-ink-mute">Check-out</p>
             <p className="text-[13px] font-semibold text-ink mt-0.5">Aug 17</p>
          </div>
          <div className="flex-1 px-3 py-2 flex flex-col justify-center border-l border-line-soft">
             <p className="text-[9px] font-bold uppercase tracking-wider text-ink-mute">Guests</p>
             <p className="text-[13px] font-semibold text-ink mt-0.5">2 Adults</p>
          </div>
        </div>
      </div>

      {/* Room Results List */}
      <div className="p-4 bg-[#F9F8F4] space-y-3 flex-1 max-h-[320px] overflow-hidden relative">
        {/* Room Card 1 */}
        <div className="bg-white p-3 rounded-2xl flex gap-4 border border-line shadow-sm hover:border-coral/40 transition-colors">
          <div className="w-24 h-24 rounded-xl overflow-hidden shrink-0">
             <img src="https://images.unsplash.com/photo-1578683010236-d716f9a3f461?q=80&w=300&auto=format&fit=crop" alt="Deluxe King" className="w-full h-full object-cover" />
          </div>
          <div className="flex-1 flex flex-col justify-between py-1">
             <div>
               <p className="font-display text-[16px] font-medium text-ink">Deluxe King</p>
               <p className="text-[11px] text-ink-soft mt-0.5 line-clamp-1">Spacious 35sqm room with city views.</p>
             </div>
             <div className="flex justify-between items-end">
                <div>
                  <p className="text-[14px] font-bold text-ink">PKR 20,000<span className="text-[9px] text-ink-mute font-normal"> / night</span></p>
                </div>
                <button className="bg-coral text-white text-[12px] font-bold px-4 py-2 rounded-[10px] shadow-pop hover:bg-coral-dark transition-transform hover:scale-105">Select</button>
             </div>
          </div>
        </div>

        {/* Room Card 2 */}
        <div className="bg-white p-3 rounded-2xl flex gap-4 border border-line shadow-sm opacity-60 grayscale-[30%]">
          <div className="w-24 h-24 rounded-xl overflow-hidden shrink-0">
             <img src="https://images.unsplash.com/photo-1566665797739-1674de7a421a?q=80&w=300&auto=format&fit=crop" alt="Executive Suite" className="w-full h-full object-cover" />
          </div>
          <div className="flex-1 flex flex-col justify-between py-1">
             <div>
               <p className="font-display text-[16px] font-medium text-ink">Executive Suite</p>
               <p className="text-[10px] text-coral mt-1 font-bold">Sold out for these dates</p>
             </div>
             <div className="flex justify-between items-end">
                <div>
                  <p className="text-[14px] font-bold text-ink-mute">PKR 45,000<span className="text-[9px] font-normal"> / night</span></p>
                </div>
                <button className="bg-mist text-ink-mute text-[12px] font-bold px-4 py-2 rounded-[10px] border border-line-soft" disabled>Sold out</button>
             </div>
          </div>
        </div>
        
        {/* Fade Out Gradient */}
        <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-[#F9F8F4] to-transparent pointer-events-none" />
      </div>
    </div>
  );
}

// ─── Report mockup ──────────────────────────────────────────────────────────
function ReportMockup() {
  const rows = [
    { label: "Occupancy",            value: "75%",        delta: "+8%"  },
    { label: "ADR (Avg Daily Rate)", value: "PKR 12,400",  delta: "+12%" },
    { label: "RevPAR",               value: "PKR 9,300",   delta: "+5%"  },
    { label: "Total Revenue",        value: "PKR 3.44M",   delta: "+9%"  },
    { label: "Total Expenses",       value: "PKR 1.12M",   delta: "−3%"  },
    { label: "Net Profit",           value: "PKR 2.32M",   delta: "+18%" },
    { label: "Avg Length of Stay",   value: "2.4 nights",  delta: "+0.3" },
    { label: "Total Guests",         value: "284",         delta: "+22"  },
  ];

  return (
    <div className="rounded-2xl overflow-hidden font-body bg-card border border-line shadow-float">
      <div className="px-5 py-4 border-b border-line-soft">
        <p className="text-[13px] font-semibold text-ink">Monthly Report — June 2026</p>
        <p className="text-[11px] text-ink-soft">vs. May 2026</p>
      </div>
      <div className="divide-y divide-line-soft">
        {rows.map(r => (
          <div key={r.label} className="flex items-center justify-between px-5 py-3">
            <p className="text-[12.5px] text-ink-soft">{r.label}</p>
            <div className="flex items-center gap-3">
              <p className="text-[13px] font-semibold text-ink">{r.value}</p>
              <span
                className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                style={{
                  background: r.delta.startsWith("+") ? "rgba(5,150,105,0.10)" : "rgba(225,29,72,0.10)",
                  color:      r.delta.startsWith("+") ? "#059669" : "#E11D48",
                }}
              >
                {r.delta}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Background Jobs Mockups ───────────────────────────────────────────────
function BriefingMockup() {
  return (
    <div className="h-[320px] w-full overflow-hidden border-b border-line-soft bg-ink p-5 text-white">
      <div className="flex items-center justify-between">
        <div><p className="text-[8px] font-bold uppercase tracking-wider text-coral">Today at a glance</p><p className="mt-1 font-display text-[18px] font-medium">Manager dashboard</p></div>
        <span className="rounded-full bg-white/10 px-2 py-1 text-[7px] font-bold text-white/50">LIVE</span>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-2">
        {[
          ["Occupancy", "86%"],
          ["Revenue", "PKR 78.5K"],
          ["Arrivals", "8 rooms"],
          ["To clean", "3 rooms"],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-white/10 bg-white/[.055] p-3">
            <p className="text-[7px] font-bold uppercase tracking-wider text-white/35">{label}</p>
            <p className="mt-2 text-[13px] font-black">{value}</p>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2 rounded-xl bg-coral px-3 py-2.5">
        <CheckCircle2 className="h-3.5 w-3.5" />
        <p className="text-[8px] font-bold">Shift handover ready · 3 notes</p>
      </div>
    </div>
  );
}

function LiveAlertsMockup() {
  return (
    <div className="relative h-[320px] w-full overflow-hidden border-b border-line-soft bg-ink p-5 text-white">
      <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-coral/20 blur-3xl" />
      <div className="relative flex items-center justify-between">
        <div>
          <p className="text-[8px] font-black uppercase tracking-[.17em] text-coral">Live alerts</p>
          <p className="mt-1 font-display text-[18px] font-medium">Nothing slips by.</p>
        </div>
        <span className="flex items-center gap-1.5 rounded-full bg-emerald-400/10 px-2.5 py-1 text-[7px] font-black text-emerald-300">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
          CONNECTED
        </span>
      </div>

      <div className="relative mt-5 space-y-2.5">
        {[
          {
            title: "New Booking Engine request",
            detail: "Zara Khan · Deluxe Room · 3 nights",
            meta: "Front desk · just now",
            tone: "bg-coral text-white",
            icon: BellRing,
          },
          {
            title: "Checkout cleaning created",
            detail: "Room 204 · assigned to Housekeeping",
            meta: "Automated · 2m ago",
            tone: "bg-emerald-400/15 text-emerald-300",
            icon: CheckCircle2,
          },
          {
            title: "Shift handover updated",
            detail: "3 notes ready for the evening team",
            meta: "Operations · 6m ago",
            tone: "bg-white/10 text-white/70",
            icon: RefreshCw,
          },
        ].map((alert) => {
          const Icon = alert.icon;
          return (
            <div key={alert.title} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[.055] p-3 backdrop-blur-sm">
              <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${alert.tone}`}>
                <Icon className="h-3.5 w-3.5" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-[9px] font-black text-white">{alert.title}</p>
                <p className="mt-1 truncate text-[7px] font-semibold text-white/50">{alert.detail}</p>
                <p className="mt-1.5 text-[6px] font-black uppercase tracking-wider text-coral">{alert.meta}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="relative mt-3 flex items-center gap-2 text-[7px] font-bold text-white/50">
        <BellRing className="h-3 w-3 text-coral" />
        Persistent on-screen alerts stay until staff dismiss them.
      </div>
    </div>
  );
}

function HousekeepingPwaMockup() {
  return (
    <div className="h-[320px] w-full bg-[#FAFAF8] border-b border-line-soft flex items-center justify-center p-4 relative overflow-hidden select-none">
      <div className="absolute top-0 right-0 w-48 h-48 rounded-full bg-coral/5 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full bg-blue-500/5 blur-3xl pointer-events-none" />

      <div className="w-[230px] h-[480px] bg-white rounded-[40px] border-[10px] border-black shadow-[0_24px_60px_rgba(0,0,0,0.12)] flex flex-col overflow-hidden transform hover:-translate-y-2 transition-transform duration-500 shrink-0 mt-20">
        <div className="absolute top-0 inset-x-0 h-6 flex justify-center z-30">
          <div className="w-24 h-5 bg-black rounded-b-2xl" />
        </div>

        <div className="px-5 pt-1.5 pb-2 bg-ink text-white flex justify-between items-center text-[10px] font-sans font-medium z-20">
          <span>9:41</span>
          <div className="flex items-center gap-1">
            <Wifi className="w-3 h-3" />
            <div className="w-4 h-2.5 border border-white/60 rounded-[3px] p-[1px] flex items-center">
              <div className="w-[80%] h-full bg-white rounded-[1.5px]" />
            </div>
          </div>
        </div>

        <div className="px-4 py-4 bg-ink text-white shrink-0 z-20 relative shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[9px] text-white/60 font-bold uppercase tracking-wider mb-1">Housekeeping</p>
              <h3 className="text-[16px] font-black">My Tasks</h3>
            </div>
            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center backdrop-blur-sm">
              <span className="text-[12px]">🧹</span>
            </div>
          </div>
          <div className="mt-4">
            <div className="flex justify-between text-[10px] font-bold mb-2">
              <span>Progress</span>
              <span className="text-emerald-400">12/15</span>
            </div>
            <div className="h-1.5 w-full bg-white/20 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-400 rounded-full w-[80%]" />
            </div>
          </div>
        </div>

        <div className="no-scrollbar flex-1 bg-[#F9F9FB] p-3 space-y-3 overflow-y-auto pb-10">
          {[
            { room: "101", type: "Checkout Clean", time: "ASAP", status: "done" },
            { room: "102", type: "Stayover Refresh", time: "Morning", status: "done" },
            { room: "204", type: "Deep Clean", time: "Before 2 PM", status: "active" },
            { room: "205", type: "Touch up", time: "Afternoon", status: "pending" },
          ].map((task, idx) => (
            <div key={idx} className={`p-3 rounded-2xl border flex items-center justify-between transition-all ${
              task.status === "done" ? "bg-white opacity-60 border-line-soft" :
              task.status === "active" ? "bg-white border-coral/30 shadow-[0_4px_20px_rgba(224,83,43,0.08)]" :
              "bg-white border-line-soft"
            }`}>
              <div className="flex gap-3 items-center">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-[12px] ${
                  task.status === "done" ? "bg-emerald-50 text-emerald-600" :
                  task.status === "active" ? "bg-coral text-white" :
                  "bg-mist text-ink-mute"
                }`}>
                  {task.room}
                </div>
                <div>
                  <p className={`text-[12px] font-bold ${task.status === "done" ? "text-ink-soft line-through" : "text-ink"}`}>{task.type}</p>
                  <p className="text-[9px] text-ink-mute mt-1 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {task.time}
                  </p>
                </div>
              </div>
              <div>
                {task.status === "done" ? (
                  <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                ) : task.status === "active" ? (
                  <button type="button" className="bg-coral text-white px-3 py-1.5 rounded-full text-[9px] font-bold shadow-sm">Start</button>
                ) : (
                  <div className="w-6 h-6 rounded-full border-2 border-line-soft" />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function GuestCrmMockup() {
  return (
    <div className="h-[320px] w-full bg-[#FAFAF8] border-b border-line-soft flex items-center justify-center p-4 relative overflow-hidden select-none">
      <div className="absolute top-[-25px] left-[-25px] w-48 h-48 rounded-full bg-blue-500/5 blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-25px] right-[-25px] w-48 h-48 rounded-full bg-purple-500/5 blur-3xl pointer-events-none" />

      <div className="w-full max-w-[300px] rounded-[24px] bg-white border border-line shadow-[0_20px_60px_rgba(0,0,0,0.08)] flex flex-col hover:-translate-y-1 transition-transform duration-500">
        <div className="p-5 flex items-center gap-4 border-b border-line-soft relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-full bg-gradient-to-l from-blue-50 to-transparent" />
          <div className="w-14 h-14 shrink-0 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-[20px] font-black shadow-lg relative z-10">
            AL
            <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-white rounded-full flex items-center justify-center">
              <span className="w-3.5 h-3.5 bg-emerald-500 rounded-full flex items-center justify-center">
                <CheckCircle2 className="w-2.5 h-2.5 text-white" />
              </span>
            </div>
          </div>
          <div className="relative z-10 min-w-0 flex-1">
            <h3 className="truncate text-[16px] font-black text-ink tracking-tight">Alison Larsen</h3>
            <p className="truncate text-[11px] text-ink-mute font-medium mt-1">alison.larsen@example.com</p>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className="text-[9px] font-bold text-blue-700 bg-blue-50 border border-blue-200/50 px-2 py-0.5 rounded-full">VIP Guest</span>
              <span className="text-[9px] font-bold text-ink-mute bg-mist px-2 py-0.5 rounded-full">4 Stays</span>
            </div>
          </div>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#F8F9FA] rounded-xl p-3 border border-line-soft">
              <p className="text-[9px] font-bold text-ink-mute uppercase tracking-wider">Lifetime Spend</p>
              <p className="text-[16px] font-black text-ink mt-1">PKR 366,722</p>
            </div>
            <div className="bg-[#F8F9FA] rounded-xl p-3 border border-line-soft">
              <p className="text-[9px] font-bold text-ink-mute uppercase tracking-wider">Last Stay</p>
              <p className="text-[14px] font-bold text-ink mt-1">Mar 2026</p>
              <p className="text-[9px] text-emerald-600 font-bold mt-0.5">Room 402</p>
            </div>
          </div>
          <div>
            <p className="text-[9px] font-bold text-ink-mute uppercase tracking-wider mb-2">Saved Preferences</p>
            <div className="flex flex-wrap gap-1.5">
              {[
                { icon: "☕️", text: "Extra Coffee Pods" },
                { icon: "🤫", text: "Quiet Floor" },
                { icon: "🛏", text: "King Bed Required" },
                { icon: "🚗", text: "Parking Space" },
              ].map((pref) => (
                <div key={pref.text} className="flex items-center gap-1.5 bg-white border border-line px-2.5 py-1.5 rounded-lg shadow-sm">
                  <span className="text-[10px]">{pref.icon}</span>
                  <span className="text-[10px] font-bold text-ink">{pref.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── QR & Kitchen Dual Mockup ────────────────────────────────────────────────
function QrKitchenDualMockup() {
  return (
    <div className="relative flex flex-col xl:flex-row items-center xl:items-end gap-6 justify-center select-none w-full max-w-4xl mx-auto">

      {/* ── PHONE — QR menu app ── */}
      <div
        className="relative z-10 rounded-[36px] overflow-hidden shadow-[0_32px_80px_rgba(0,0,0,0.18)] flex-shrink-0 border-black"
        style={{ width: 220, background: "#0F0F0F", borderWidth: "6px" }}
      >
        {/* Status bar */}
        <div className="flex items-center justify-between px-5 pt-3 pb-2 bg-black">
          <span className="text-[9px] font-bold text-white/70">9:41</span>
          <div className="flex items-center gap-1.5">
            <Wifi className="w-2.5 h-2.5 text-white/70" />
            <div className="flex gap-0.5 items-end h-2.5">
              {[2,3,4,4].map((h,i) => <span key={i} className="w-0.5 rounded-sm bg-white/70" style={{ height: h * 2.5 }} />)}
            </div>
          </div>
        </div>

        {/* App header */}
        <div className="px-4 py-3 flex items-center justify-between" style={{ background: "#18181B" }}>
          <div>
            <p className="text-white text-[11.5px] font-black tracking-tight leading-none">Innflo Menu</p>
            <p className="text-white/50 text-[8.5px] mt-1">Room 201 · Sea View Suite</p>
          </div>
          <div className="w-6 h-6 rounded-full bg-coral/20 flex items-center justify-center">
            <Utensils className="w-2.5 h-2.5 text-coral" />
          </div>
        </div>

        {/* QR scan animation strip */}
        <div className="relative overflow-hidden mx-4 my-3 rounded-2xl" style={{ background: "#27272A", height: 110 }}>
          {/* QR grid */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative w-16 h-16 opacity-70">
              {/* Corner markers */}
              {[["top-0 left-0","border-t-2 border-l-2"],["top-0 right-0","border-t-2 border-r-2"],["bottom-0 left-0","border-b-2 border-l-2"],["bottom-0 right-0","border-b-2 border-r-2"]].map(([pos, bdr]) => (
                <span key={pos} className={`absolute w-3.5 h-3.5 ${pos} ${bdr} border-coral rounded-sm`} />
              ))}
              {/* QR dot grid */}
              <div className="absolute inset-2 grid grid-cols-7 gap-0.5 opacity-60">
                {Array.from({ length: 49 }, (_, i) => (
                  <span key={i} className="rounded-[1px]" style={{ background: (i * 17 + 11) % 10 > 3 ? "#fff" : "transparent", aspectRatio: "1" }} />
                ))}
              </div>
            </div>
          </div>
          {/* Scan line */}
          <div
            className="absolute left-3 right-3 h-0.5 rounded-full"
            style={{ background: "linear-gradient(90deg, transparent, #E0532B, transparent)", top: "40%", boxShadow: "0 0 10px 2px rgba(224,83,43,0.4)", animation: "scanline 2.2s ease-in-out infinite" }}
          />
          {/* Label */}
          <p className="absolute bottom-2 left-0 right-0 text-center text-[8px] text-white/40 font-medium">
            Scan to Order
          </p>
        </div>

        {/* Delivery type selector */}
        <div className="px-4 pb-2">
          <p className="text-white/40 text-[7.5px] uppercase tracking-wider font-bold mb-1.5">Delivery</p>
          <div className="flex gap-1">
            {[
              { label: "Room", icon: <DoorOpen className="w-2.5 h-2.5" />, active: true },
              { label: "Dine In", icon: <Utensils className="w-2.5 h-2.5" />, active: false },
              { label: "Pick-up", icon: <ShoppingBag className="w-2.5 h-2.5" />, active: false },
            ].map(o => (
              <button
                key={o.label}
                className={`flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded-xl text-[7.5px] font-bold transition-colors ${
                  o.active ? "bg-coral text-white" : "bg-white/10 text-white/50"
                }`}
              >
                {o.icon}
                {o.label}
              </button>
            ))}
          </div>
        </div>

        {/* Menu items */}
        <div className="px-4 pb-2 space-y-1.5">
          <p className="text-white/40 text-[7.5px] uppercase tracking-wider font-bold mb-1">Popular Items</p>
          {[
            { name: "Club Sandwich", price: "PKR 950", added: true },
            { name: "Grilled Chicken", price: "PKR 1,200", added: false },
          ].map(item => (
            <div key={item.name} className="flex items-center justify-between px-2 py-1.5 rounded-xl" style={{ background: "#18181B" }}>
              <div>
                <p className="text-white text-[8.5px] font-semibold leading-none">{item.name}</p>
                <p className="text-white/40 text-[7px] mt-0.5">{item.price}</p>
              </div>
              <div
                className={`w-4.5 h-4.5 rounded-lg flex items-center justify-center ${item.added ? "bg-coral" : "bg-white/10"}`}
              >
                {item.added
                  ? <CheckCircle2 className="w-2.5 h-2.5 text-white" />
                  : <ChevronRight className="w-2.5 h-2.5 text-white/40" />
                }
              </div>
            </div>
          ))}
        </div>

        {/* Pay selector */}
        <div className="px-4 pb-3 pt-1">
          <div className="flex gap-1 mb-2">
            {[
              { label: "Room Folio", active: true },
              { label: "Pay at spot", active: false },
            ].map(o => (
              <button
                key={o.label}
                className={`flex-1 py-1 rounded-lg text-[7.5px] font-bold ${
                  o.active ? "bg-emerald-500 text-white" : "bg-white/10 text-white/50"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
          <div className="w-full py-2 rounded-xl bg-coral flex items-center justify-center gap-1">
            <span className="text-white text-[9.5px] font-black">Place Order</span>
            <ChevronRight className="w-2.5 h-2.5 text-white" />
          </div>
        </div>
      </div>

      {/* ── ARROW between phone and KDS ── */}
      <div className="hidden xl:flex flex-col items-center gap-1 mb-20 z-20 shrink-0">
        <div className="flex flex-col items-center">
          {[0,1,2].map(i => (
            <ChevronRight key={i} className="w-4 h-4 text-coral/60" style={{ marginTop: i === 0 ? 0 : -6 }} />
          ))}
        </div>
        <span className="text-[8px] font-bold text-coral/60 text-center leading-tight whitespace-nowrap mt-0.5">
          in seconds
        </span>
      </div>

      {/* ── KDS — Wide Computer Monitor Screen ── */}
      <div className="relative flex-1 min-w-0 flex flex-col items-center group">
        {/* Computer Monitor Body */}
        <div
          className="w-full rounded-2xl overflow-hidden shadow-[0_30px_70px_rgba(0,0,0,0.12)] flex flex-col border bg-[#111315]"
          style={{ height: 290, borderColor: "#27272A" }}
        >
          {/* Browser Chrome Header */}
          <div className="px-4 py-2.5 bg-[#181A1C] border-b flex items-center justify-between" style={{ borderColor: "#222528" }}>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-white/20" />
              <span className="w-2 h-2 rounded-full bg-white/20" />
              <span className="w-2 h-2 rounded-full bg-white/20" />
              <span className="ml-3 text-[10px] font-bold text-white/70 uppercase tracking-widest flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Kitchen Display Screen (KDS)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[8.5px] font-bold text-white/30 bg-white/5 border border-white/10 px-2 py-0.5 rounded">Station: Main Hot Kitchen</span>
              <span className="text-[9px] text-white/50 font-medium">09:41 AM</span>
            </div>
          </div>

          {/* Monitor Display Grid (3 ticket columns) */}
          <div className="flex-1 p-3 grid grid-cols-3 gap-3 overflow-hidden bg-[#0D0E10]">
            
            {/* Column 1: NEW TICKET (Highlighted Room 201 Order) */}
            <div className="rounded-xl overflow-hidden border flex flex-col bg-[#161D26] border-coral/40 shadow-[0_4px_16px_rgba(224,83,43,0.15)]">
              {/* Header */}
              <div className="flex items-center justify-between px-2.5 py-1.5 bg-coral/10 border-b border-coral/20">
                <span className="text-[8.5px] font-black text-coral uppercase tracking-widest">New</span>
                <span className="text-[9px] font-bold text-white">#082</span>
              </div>
              <div className="px-2.5 py-2 flex-1 space-y-1">
                <div className="flex justify-between items-center text-[7.5px] text-white/40 font-bold mb-1.5">
                  <span>ROOM 201</span>
                  <span>ROOM SERVICE</span>
                </div>
                <div className="flex items-start gap-1">
                  <span className="text-[9px] font-black text-coral w-3 shrink-0">1×</span>
                  <span className="text-[9px] font-bold text-white leading-tight">Club Sandwich</span>
                </div>
                <p className="text-[7.5px] pl-4 italic text-white/35 font-medium">No onions, extra mayo</p>
              </div>
              {/* Footer */}
              <div className="px-2.5 py-1.5 bg-[#1C232E] border-t border-coral/10 flex items-center justify-between text-[8px]">
                <span className="font-semibold text-coral">Preparing</span>
                <span className="text-white/40 font-mono">0:42</span>
              </div>
            </div>

            {/* Column 2: IN-PROGRESS TICKET */}
            <div className="rounded-xl overflow-hidden border border-line-soft/10 flex flex-col bg-[#131517] text-white/60">
              <div className="flex items-center justify-between px-2.5 py-1.5 bg-[#181A1C] border-b border-line-soft/15">
                <span className="text-[8px] font-bold text-white/40">PREP</span>
                <span className="text-[9px] font-bold text-white/80">#080</span>
              </div>
              <div className="px-2.5 py-2 flex-1 space-y-1.5">
                <div className="flex justify-between items-center text-[7.5px] text-white/40 font-bold">
                  <span>TABLE 4</span>
                  <span>DINE IN</span>
                </div>
                <div className="space-y-1">
                  <div className="flex items-start gap-1">
                    <span className="text-[9px] font-black text-white/60 w-3 shrink-0">2×</span>
                    <span className="text-[9.5px] font-bold text-white/80 leading-tight">Grilled Chicken</span>
                  </div>
                  <div className="flex items-start gap-1">
                    <span className="text-[9px] font-black text-white/60 w-3 shrink-0">2×</span>
                    <span className="text-[9.5px] font-bold text-white/80 leading-tight">French Fries</span>
                  </div>
                </div>
              </div>
              <div className="px-2.5 py-1.5 bg-[#181A1C] border-t border-line-soft/10 flex items-center justify-between text-[8px]">
                <span className="font-semibold text-amber-400">Preparing</span>
                <span className="text-white/30 font-mono">4:10</span>
              </div>
            </div>

            {/* Column 3: READY / COMPLETED TICKET */}
            <div className="rounded-xl overflow-hidden border border-line-soft/10 flex flex-col bg-[#131517] opacity-60">
              <div className="flex items-center justify-between px-2.5 py-1.5 bg-[#181A1C] border-b border-line-soft/15">
                <span className="text-[8px] font-bold text-white/40">READY</span>
                <span className="text-[9px] font-bold text-white/80">#079</span>
              </div>
              <div className="px-2.5 py-2 flex-1 space-y-1.5">
                <div className="flex justify-between items-center text-[7.5px] text-white/40 font-bold">
                  <span>TABLE 2</span>
                  <span>DINE IN</span>
                </div>
                <div className="space-y-1">
                  <div className="flex items-start gap-1">
                    <span className="text-[9px] font-black text-white/60 w-3 shrink-0">1×</span>
                    <span className="text-[9.5px] font-bold text-white/80 leading-tight">Mango Smoothie</span>
                  </div>
                </div>
              </div>
              <div className="px-2.5 py-1.5 bg-[#181A1C] border-t border-line-soft/10 flex items-center justify-between text-[8px]">
                <span className="font-semibold text-emerald-400">Ready</span>
                <span className="text-white/30 font-mono">7:28</span>
              </div>
            </div>

          </div>

          {/* Browser footer */}
          <div className="px-4 py-2 bg-[#181A1C] border-t flex items-center justify-between text-[8.5px] text-white/30" style={{ borderColor: "#222528" }}>
            <span className="flex items-center gap-1"><RefreshCw className="w-2.5 h-2.5" /> Auto-syncing live</span>
            <span className="font-bold text-white/40">3 Active Tickets</span>
          </div>
        </div>

        {/* Monitor Neck & Base */}
        <div className="w-14 h-4 bg-[#1F2224] border-x border-[#1C1F21]" />
        <div className="w-36 h-2 rounded-t-lg bg-[#2D3135] shadow-[0_4px_12px_rgba(0,0,0,0.15)]" />

        {/* Folio update toast — floats above base */}
        <div
          className="absolute z-30 flex items-start gap-2.5 px-3 py-2 rounded-2xl shadow-[0_12px_32px_rgba(0,0,0,0.08)] bg-white border border-emerald-200/80"
          style={{ bottom: 46, right: 30, maxWidth: 210 }}
        >
          <div className="w-5 h-5 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
          </div>
          <div>
            <p className="text-[9.5px] font-black text-emerald-800 leading-none">Live Folio Sync</p>
            <p className="text-[8px] mt-1 text-emerald-600 font-semibold">
              Room 201: Club Sandwich (+PKR 950)
            </p>
          </div>
        </div>
      </div>

    </div>
  );
}

// ─── Channel Manager — channels → Innflo → calendar flow diagram ───────────
function ChannelManagerFlowMockup() {
  const channels = [
    { name: "Booking.com", color: "#003580", text: "B.", accent: "bg-blue-500", rooms: "3 Rooms" },
    { name: "Airbnb",      color: "#FF5A5F", text: "A.", accent: "bg-rose-500", rooms: "2 Rooms" },
    { name: "Expedia",     color: "#FFC000", text: "E.", accent: "bg-amber-500", textDark: true, rooms: "3 Rooms" },
    { name: "Agoda",       color: "#5B1E96", text: "Ag", accent: "bg-purple-500", rooms: "4 Rooms" },
  ];

  const days = ["Mon 7", "Tue 8", "Wed 9", "Thu 10", "Fri 11", "Sat 12", "Sun 13"];
  const calendarRows = [
    { room: "101 Deluxe", source: "Booking.com", span: 3, start: 0, color: "bg-blue-600" },
    { room: "102 Double", source: "Airbnb", span: 2, start: 4, color: "bg-rose-500" },
    { room: "103 Suite", source: "Expedia", span: 4, start: 1, color: "bg-amber-500" },
  ];

  return (
    <div className="rounded-2xl overflow-hidden font-body bg-white border border-line shadow-[0_8px_40px_rgba(0,0,0,0.07)] select-none">
      {/* Browser chrome header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-mist border-b border-line-soft">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="w-2.5 h-2.5 shrink-0 rounded-full bg-red-400 opacity-60" />
          <span className="w-2.5 h-2.5 shrink-0 rounded-full bg-amber-400 opacity-60" />
          <span className="w-2.5 h-2.5 shrink-0 rounded-full bg-emerald-400 opacity-60" />
          <div className="ml-3 flex min-w-0 items-center gap-1 rounded border border-line-soft/80 bg-white px-2 py-0.5 text-[11px] text-ink-mute">
            <Globe className="w-2.5 h-2.5 shrink-0" />
            <span className="truncate">innflo.com/channel-manager</span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-[10px] text-coral-dark bg-coral-soft/50 font-bold px-2 py-0.5 rounded-full">Roadmap preview</span>
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
        </div>
      </div>

      {/* Main Flow Layout */}
      <div className="p-5 bg-paper grid grid-cols-1 md:grid-cols-[1.3fr_0.4fr_2fr] gap-4 items-center relative min-h-[300px]">

        {/* ── LEFT: Channel Sources List ── */}
        <div className="space-y-2.5">
          <p className="text-[8.5px] font-black text-ink-mute uppercase tracking-wider mb-2">Attached OTAs</p>
          {channels.map((c) => (
            <div
              key={c.name}
              className="flex items-center justify-between px-2.5 py-2 rounded-xl bg-white border border-line-soft shadow-[0_2px_8px_rgba(0,0,0,0.02)] hover:border-line transition-all duration-200"
            >
              <div className="flex items-center gap-2">
                {/* Simulated Channel Logo Brand Badge */}
                <div
                  className="w-6 h-6 rounded-lg flex items-center justify-center text-[9.5px] font-black shrink-0 shadow-inner"
                  style={{ background: c.color, color: c.textDark ? "#1C1917" : "#FFFFFF" }}
                >
                  {c.text}
                </div>
                <div>
                  <p className="text-[10px] font-bold text-ink leading-none">{c.name}</p>
                  <p className="text-[7.5px] mt-0.5 text-ink-mute font-medium">{c.rooms} active</p>
                </div>
              </div>
              {/* Sync status */}
              <div className="flex items-center gap-1.5">
                <span className="text-[7.5px] font-bold text-amber-700 bg-amber-50 border border-amber-100 px-1.5 py-0.5 rounded-full">Planned</span>
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              </div>
            </div>
          ))}
        </div>

        {/* ── CENTER: Innflo Sync Hub Icon & Flows ── */}
        <div className="flex flex-col items-center justify-center py-4 md:py-0">
          <div className="relative flex items-center justify-center">
            {/* Pulsing Sync Ring */}
            <div className="absolute w-14 h-14 rounded-full border border-coral/30 animate-ping opacity-40" />
            <div className="absolute w-11 h-11 rounded-full border-2 border-dashed border-coral/20 animate-spin" style={{ animationDuration: "12s" }} />
            
            {/* Core Hub Badge */}
            <div className="relative z-10 w-9 h-9 rounded-xl bg-ink text-paper flex items-center justify-center shadow-lg border border-line-soft/30">
              <RefreshCw className="w-4 h-4 text-coral animate-spin" style={{ animationDuration: "6s" }} />
            </div>
          </div>
          <span className="text-[8px] font-black text-ink-mute uppercase tracking-widest mt-2 whitespace-nowrap text-center">
            Innflo Sync
          </span>
          <span className="text-[6.5px] text-coral font-bold uppercase tracking-widest mt-0.5">
            Realtime
          </span>
        </div>

        {/* ── RIGHT: Master Reservation Calendar Mockup ── */}
        <div className="rounded-xl border border-line-soft bg-white shadow-[0_4px_16px_rgba(0,0,0,0.03)] overflow-hidden">
          {/* Calendar top toolbar */}
          <div className="px-3 py-2 bg-mist border-b border-line-soft flex items-center justify-between text-[8px] font-bold text-ink-mute">
            <span>Innflo Master Calendar</span>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-blue-600" />Booking.com</span>
              <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-rose-500" />Airbnb</span>
            </div>
          </div>

          {/* Calendar grid */}
          <div className="overflow-x-auto">
            <div className="min-w-[280px]">
              {/* Day headers */}
              <div className="flex border-b border-line-soft bg-mist/60 text-[7.5px] font-bold text-ink-mute text-center">
                <div className="w-16 py-1 border-r border-line-soft/50 text-left px-2">Room</div>
                {days.map((d) => (
                  <div key={d} className="flex-1 py-1 border-r border-line-soft/30 last:border-r-0">{d.split(" ")[1]}</div>
                ))}
              </div>

              {/* Room rows with syncing bars */}
              {calendarRows.map((r, rowIdx) => (
                <div key={rowIdx} className="flex border-b border-line-soft/50 last:border-b-0 relative h-9 items-center">
                  {/* Room Label */}
                  <div className="w-16 px-2 text-[8px] font-bold text-ink border-r border-line-soft/50 h-full flex items-center bg-white shrink-0 z-10">
                    {r.room}
                  </div>

                  {/* Day background cells */}
                  <div className="flex flex-1 h-full relative items-center">
                    {Array.from({ length: 7 }).map((_, cellIdx) => (
                      <div key={cellIdx} className="flex-1 border-r border-line-soft/20 last:border-r-0 h-full" />
                    ))}

                    {/* Channel reservation bar */}
                    <div
                      className="absolute h-5 rounded-md flex items-center px-1.5 gap-1 overflow-hidden"
                      style={{
                        left: `${(r.start / 7) * 100}%`,
                        width: `${(r.span / 7) * 100}%`,
                        marginLeft: "2px",
                        marginRight: "2px"
                      }}
                    >
                      <div className={`w-full h-full rounded ${r.color} flex items-center px-1.5 gap-1 text-[7.5px] font-bold text-white shadow-sm`}>
                        <span className="truncate">{r.source} Stay</span>
                        <span className="ml-auto w-1 h-1 rounded-full bg-white/70 animate-ping" />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Calendar status bar */}
          <div className="px-3 py-1.5 bg-mist border-t border-line-soft flex items-center justify-between text-[7px] text-ink-mute font-medium">
            <span className="flex items-center gap-1"><Lock className="w-2.5 h-2.5 text-coral" /> Closed on other channels</span>
            <span className="font-bold text-amber-700 flex items-center gap-1"><span className="w-1 h-1 rounded-full bg-amber-500" /> Planned rates sync</span>
          </div>
        </div>

      </div>
    </div>
  );
}

// ─── FAQ ────────────────────────────────────────────────────────────────────
const FEATURE_FAQS = [
  {
    q: "Does the POS and QR Dining charge straight to the guest's room?",
    a: "Yes. Every order — whether rung up at the register or placed by a guest scanning a QR code — posts directly to that guest's live folio. Nothing gets tracked on a separate notepad and reconciled later.",
  },
  {
    q: "How does inventory stay up to date?",
    a: "Staff record stock movements and adjustments, while POS sales can deduct ingredients through linked recipes. Reorder levels surface low-stock items before they become a service problem. Camera-assisted counting remains roadmap work.",
  },
  {
    q: "What happens to Housekeeping if the Wi-Fi drops mid-shift?",
    a: "Nothing stops. Staff keep marking rooms clean from their phone with no connection at all, and every update syncs to the front desk the moment a signal comes back.",
  },
  {
    q: "Can I see a live demo before deciding anything?",
    a: "Yes — reach out and we'll walk you through the actual product on a call, not a slide deck. You'll see real screens, ask real questions, and decide from there.",
  },
  {
    q: "Is there a free trial?",
    a: "Not a fixed self-serve trial today — instead you get a live demo and an honest conversation about whether Innflo fits your property, with no pressure either way.",
  },
  {
    q: "How long does it take to get set up?",
    a: "Most properties are up and running within a few days — rooms, rates, and staff accounts loaded in, with onboarding support included rather than a self-service manual to figure out alone.",
  },
  {
    q: "When is Channel Manager launching?",
    a: "It's actively in development, with no fixed date yet. Get in touch and we'll notify you the moment direct OTA sync goes live.",
  },
];

function FeatureFaqRow({
  q,
  a,
  isOpen,
  isLast,
  onClick,
}: {
  q: string;
  a: string;
  isOpen: boolean;
  isLast: boolean;
  onClick: () => void;
}) {
  return (
    <div className={isLast ? "" : "border-b border-line-soft"}>
      <button
        type="button"
        onClick={onClick}
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between gap-6 px-6 py-5 text-left sm:px-8"
      >
        <span className="text-[18px] sm:text-[19px] font-bold font-body text-ink">{q}</span>
        <span
          className={`shrink-0 h-5 w-5 rounded-md bg-coral shadow-pop grid place-items-center transition-transform duration-300 ${isOpen ? "rotate-45" : ""}`}
        >
          <Plus className="h-2.5 w-2.5 text-white" strokeWidth={3} />
        </span>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <p className="px-6 pb-6 pr-14 font-body text-[15.5px] leading-relaxed text-ink-soft sm:px-8">
              {a}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────
export default function Features() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <div className="bg-paper text-ink">

      {/* ── HERO ───────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-grid px-4 pb-24 pt-32 sm:px-6 sm:pt-36 xl:min-h-[88vh] xl:pt-40">
        <div
          className="absolute pointer-events-none"
          style={{ top: "-15%", right: "-10%", width: "55%", height: "70%", background: "radial-gradient(ellipse, rgba(224,83,43,0.09), transparent 65%)" }}
        />
        <div className="absolute -left-24 bottom-0 h-[420px] w-[520px] rounded-full bg-[#0A8272]/[.055] blur-3xl" />

        <div className="relative mx-auto grid max-w-7xl items-center gap-12 xl:grid-cols-[.82fr_1.18fr] xl:gap-16 2xl:gap-20">
          <div className="min-w-0">
            <Reveal variant="fade">
              <p className="eyebrow mb-6">Hotel Property Management System · Live</p>
            </Reveal>
            <h1 className="font-display text-[clamp(50px,6.7vw,86px)] font-medium leading-[.95] tracking-[-.035em] text-ink">
              <SplitHeading as="span" className="block">Run the hotel.</SplitHeading>
              <SplitHeading as="span" delay={0.22} className="block italic text-ink-soft">Lose the daily</SplitHeading>
              <SplitHeading as="span" delay={0.44} className="block text-coral-dark">scramble.</SplitHeading>
            </h1>
            <Reveal delay={0.55}>
              <p className="mt-7 max-w-xl text-[18px] font-medium leading-relaxed text-ink-soft">
                Reservations, rooms, rates, guests, folios, housekeeping, dining, inventory and reporting—one connected operating system built for independent hotel teams.
              </p>
            </Reveal>
            <Reveal delay={0.65}>
              <div className="mt-9 flex flex-wrap items-center gap-4">
                <Link
                  to="/contact"
                  className="group flex h-12 items-center gap-2 rounded-full bg-coral px-7 text-[14px] font-black text-white shadow-pop transition-all hover:-translate-y-0.5 hover:bg-coral-dark"
                >
                  Book a walkthrough
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
                <a
                  href="#operations"
                  className="flex h-12 items-center rounded-full border border-ink px-7 text-[14px] font-black text-ink transition-colors hover:bg-ink hover:text-white"
                >
                  Explore the PMS
                </a>
              </div>
              <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-[11px] font-bold text-ink-mute">
                <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-700" /> Built for independent hotels</span>
                <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-700" /> Works across phones and desktops</span>
                <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-700" /> Tenant-isolated hotel data</span>
              </div>
            </Reveal>
          </div>

          <Reveal variant="scale" delay={0.14} className="min-w-0">
            <PmsHeroMockup />
          </Reveal>
        </div>
      </section>

      {/* ── OPERATIONS — one block, five features, five tabs ────────────────── */}
      <TabbedFeatureBlock
        id="operations"
        eyebrow="Operations"
        headline="Your property, one screen at a time."
        mockupSide="left"
        mockupMinHeight="460px"
        tabs={[
          {
            label: "Dashboard",
            heading: "Walk in. Glance up. Know everything.",
            copy: "Arrivals, departures, revenue, and shift notes — the whole day on one screen, updating live, with a marker showing exactly where you are right now.",
            mockup: <LiveScheduleMockup />,
            learnMoreTo: "/pms",
          },
          {
            label: "POS",
            heading: "Ring it up. Room it up.",
            copy: "Ring up a coffee, a spa treatment, a late checkout fee — charged straight to the room, no separate register to reconcile.",
            mockup: <PosTerminalMockup />,
            learnMoreTo: "/pos",
          },
          {
            label: "QR Dining & Kitchen",
            heading: "Guests order. Kitchen knows. Nothing's missed.",
            copy: "A QR code on the table — guests browse and order with no app, no call to the front desk — and every ticket lands on the kitchen screen the instant it's placed.",
            mockup: <QrMenuMockup />,
            learnMoreTo: "/pos",
          },
          {
            label: "Inventory",
            heading: "Know what moved, and what is running low.",
            copy: "Record stock in, stock out and adjustments, set reorder levels, and let linked POS recipes deduct ingredients as orders are sold.",
            mockup: <InventoryControlMockup />,
            learnMoreTo: "/automations",
          },
          {
            label: "Financials",
            heading: "The books that balance themselves.",
            copy: "Room, F&B, laundry, tax, discount — every charge lands on one live folio. Every payment and expense, auto-logged and reconciled.",
            mockup: <LiveFolioMockup />,
            learnMoreTo: "/financials",
          },
        ]}
      />

      {/* ── THE SMALL JOBS — BACKGROUND TASKS ─────────────────────────────── */}
      <section className="py-24 bg-mist border-y border-line overflow-hidden">
        <div className="mx-auto max-w-[92rem] px-6">
          <Reveal variant="fade" className="text-center mb-16">
            <p className="eyebrow text-[#0A5C53] mb-4">Day to day</p>
            <h2 className="font-body text-[clamp(28px,3.8vw,42px)] font-bold text-ink leading-tight">
              The small jobs, handled<br />in the background
            </h2>
          </Reveal>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
            {/* Daily control */}
            <Reveal variant="rise" delay={0.0}>
              <div className="rounded-3xl bg-card border border-line overflow-hidden shadow-card hover:shadow-float transition-all duration-300 h-full flex flex-col">
                <BriefingMockup />
                <div className="p-6 flex-1 flex flex-col">
                  <h3 className="font-body text-[17px] font-bold text-ink mb-2.5">
                    Daily manager dashboard
                  </h3>
                  <p className="text-[14px] text-ink-soft leading-relaxed font-body">
                    Arrivals, departures, occupancy, room status and revenue—one quick view, with deeper reports when needed.
                  </p>
                </div>
              </div>
            </Reveal>

            {/* Persistent live alerts */}
            <Reveal variant="rise" delay={0.06}>
              <div className="rounded-3xl bg-card border border-line overflow-hidden shadow-card hover:shadow-float transition-all duration-300 h-full flex flex-col">
                <LiveAlertsMockup />
                <div className="p-6 flex-1 flex flex-col">
                  <h3 className="font-body text-[17px] font-bold text-ink mb-2.5">
                    Alerts staff cannot miss
                  </h3>
                  <p className="text-[14px] text-ink-soft leading-relaxed font-body">
                    Direct bookings stay visible until dismissed. Cleaning tasks and shift updates reach the right team automatically.
                  </p>
                </div>
              </div>
            </Reveal>

            {/* Guest CRM */}
            <Reveal variant="rise" delay={0.12}>
              <div className="rounded-3xl bg-card border border-line overflow-hidden shadow-card hover:shadow-float transition-all duration-300 h-full flex flex-col">
                <GuestCrmMockup />
                <div className="p-6 flex-1 flex flex-col">
                  <h3 className="font-body text-[17px] font-bold text-ink mb-2.5">
                    Guest CRM
                  </h3>
                  <p className="text-[14px] text-ink-soft leading-relaxed font-body">
                    Past stays, spend and preferences stay attached to every guest for better service and timely follow-up.
                  </p>
                </div>
              </div>
            </Reveal>

            {/* Housekeeping, automated */}
            <Reveal variant="rise" delay={0.18}>
              <div className="rounded-3xl bg-card border border-line overflow-hidden shadow-card hover:shadow-float transition-all duration-300 h-full flex flex-col">
                <HousekeepingPwaMockup />
                <div className="p-6 flex-1 flex flex-col">
                  <h3 className="font-body text-[17px] font-bold text-ink mb-2.5">
                    Housekeeping, automated
                  </h3>
                  <p className="text-[14px] text-ink-soft leading-relaxed font-body">
                    Checkout creates the cleaning task. Staff update rooms from their phones; front desk sees every change live.
                  </p>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── RESERVATIONS ───────────────────────────────────────────────────── */}
      <section id="reservations" className="scroll-mt-24 py-28 overflow-hidden">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid grid-cols-1 items-center gap-14 [&>*]:min-w-0 lg:grid-cols-[64fr_36fr] lg:gap-16">
            {/* Left — Calendar Mockup */}
            <Reveal delay={0.1} variant="rise" className="order-2 lg:order-1">
              <ReservationTimelineMockup />
            </Reveal>

            {/* Right — Copy */}
            <Reveal className="order-1 lg:order-2">
              <p className="eyebrow mb-5">Reservations</p>
              <h2 className="font-display text-[clamp(34px,4.5vw,52px)] font-medium leading-tight text-ink mb-6">
                One calendar.<br />All bookings.
              </h2>
              <p className="text-[17px] text-ink-soft font-body leading-relaxed mb-8">
                Walk-ins, calls, WhatsApp and direct Booking Engine requests live in the same calendar. Record an OTA booking with its source today; automatic two-way Booking.com, Agoda, Expedia and Airbnb synchronization is clearly marked as Channel Manager roadmap work.
              </p>
              <ul className="space-y-4 font-body text-[15.5px] text-ink-soft">
                {[
                  { icon: <Crown className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />, text: "VIP guest tagging with crown badge, advance payments & special requests" },
                  { icon: <Lock className="w-4 h-4 text-coral shrink-0 mt-0.5" />, text: "Hard double-booking prevention — a room cannot be booked twice, ever" },
                  { icon: <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />, text: "Group bookings with split or single-folio billing across rooms" },
                  { icon: <span className="text-ink-soft font-bold text-[16px] leading-none shrink-0 mt-0.5">—</span>, text: "Waitlist, No-Show, and Cancellation tracking with reasons" },
                  { icon: <span className="text-ink-soft font-bold text-[16px] leading-none shrink-0 mt-0.5">—</span>, text: "Estimated arrival time and transport mode per guest" },
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    {item.icon}
                    <span>{item.text}</span>
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── RATE PLANS ─────────────────────────────────────────────────────── */}
      <section id="rates" className="scroll-mt-24 border-t border-line bg-paper py-28 overflow-hidden">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid grid-cols-1 items-center gap-14 [&>*]:min-w-0 lg:grid-cols-[38fr_62fr] lg:gap-16">
            <Reveal>
              <p className="eyebrow mb-5">Rate plans &amp; pricing</p>
              <h2 className="font-display text-[clamp(34px,4.5vw,52px)] font-medium leading-tight text-ink mb-6">
                Stop pricing<br />rooms from memory.
              </h2>
              <p className="text-[17px] text-ink-soft font-body leading-relaxed mb-8">
                Set a standard rate, a seasonal one, a corporate one and a code-only promo — each with its own date window, minimum stay and priority. When a stay gets quoted, Innflo works out which plan applies and shows you why that one won.
              </p>
              <ul className="space-y-4 font-body text-[15.5px] text-ink-soft">
                {[
                  { icon: <CalendarRange className="w-4 h-4 text-coral shrink-0 mt-0.5" />, text: "Seasonal plans with start and end dates, day-of-week targeting and a minimum length of stay" },
                  { icon: <Users className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />, text: "Corporate and travel-agent rates linked to a company account, with a flat contracted discount" },
                  { icon: <Tag className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />, text: "Promo and access codes with their own validity window and usage limit — including single-use codes" },
                  { icon: <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />, text: "Every quote reports which plan it came from, so a rate is never a mystery on the folio" },
                  { icon: <span className="text-ink-soft font-bold text-[16px] leading-none shrink-0 mt-0.5">—</span>, text: "The same plans price the public Booking Engine, so your site and your desk never disagree" },
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    {item.icon}
                    <span>{item.text}</span>
                  </li>
                ))}
              </ul>
            </Reveal>

            <Reveal delay={0.1} variant="rise">
              <RatePlanMockup />
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── MANAGER SUMMARY ────────────────────────────────────────────────── */}
      <section className="bg-ink py-28">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <Reveal>
            <span className="rule-coral block w-12 mx-auto mb-10" />
            <p className="font-display italic text-[clamp(26px,5vw,44px)] font-medium text-paper mb-6 leading-tight">
              "A daily operating picture<br />that takes seconds to read."
            </p>
            <p className="text-[17px] font-body leading-relaxed max-w-xl mx-auto mb-10" style={{ color: "rgba(246,243,238,0.62)" }}>
              Open the manager dashboard for arrivals, departures, occupancy, revenue and operational follow-ups. Innflo keeps the underlying records connected so the summary is useful, not decorative.
            </p>
            <div className="inline-flex items-center gap-3 px-5 py-3 rounded-full font-body text-[14.5px]" style={{ background: "rgba(224,83,43,0.14)", border: "1px solid rgba(224,83,43,0.3)" }}>
              <span className="h-2 w-2 rounded-full bg-coral animate-pulse" />
              <span className="text-coral" style={{ color: "#F5A183" }}>Live hotel data, ready when the manager opens Innflo</span>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── QR & KITCHEN ───────────────────────────────────────────────────── */}
      <section className="py-28 bg-paper overflow-hidden border-t border-line">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid grid-cols-1 lg:grid-cols-[40fr_60fr] [&>*]:min-w-0 gap-16 items-center">

            {/* ── LEFT: Copy ── */}
            <Reveal>
              <p className="eyebrow text-coral mb-5">QR &amp; Kitchen</p>
              <h2 className="font-display text-[clamp(36px,4.5vw,54px)] font-medium leading-[0.98] text-ink mb-6">
                Every menu<br />is a QR menu now.
              </h2>
              <p className="text-[17px] leading-relaxed mb-10 font-body text-ink-soft">
                Guests scan, browse, and order from their phone — no app, no waiter required. The kitchen sees the ticket in seconds. The folio updates automatically. Zero manual input, end to end.
              </p>

              {/* Flow steps */}
              <ol className="space-y-5 font-body">
                {[
                  {
                    icon: <span className="text-[17px] leading-none">📱</span>,
                    title: "Guest scans the QR",
                    sub: "In-room, on the table, or at the pickup counter",
                  },
                  {
                    icon: <DoorOpen className="w-4 h-4 text-coral" />,
                    title: "Picks delivery type",
                    sub: "Room delivery · Dine in · Pick-up",
                  },
                  {
                    icon: <ShoppingBag className="w-4 h-4 text-coral" />,
                    title: "Picks how to pay",
                    sub: "Pay at spot · Charge to room folio",
                  },
                  {
                    icon: <Utensils className="w-4 h-4 text-coral" />,
                    title: "Kitchen gets it instantly",
                    sub: "KDS screen, with time, table, and room number",
                  },
                  {
                    icon: <CheckCircle2 className="w-4 h-4 text-emerald-600" />,
                    title: "Folio updated automatically",
                    sub: "No one types anything. No rounding errors.",
                  },
                ].map((step, i) => (
                  <li key={i} className="flex items-start gap-4">
                    <div className="mt-0.5 w-8 h-8 rounded-xl bg-mist border border-line-soft flex items-center justify-center shrink-0">
                      {step.icon}
                    </div>
                    <div>
                      <p className="text-ink text-[15px] font-bold leading-snug">{step.title}</p>
                      <p className="text-[13px] text-ink-mute mt-0.5">{step.sub}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </Reveal>

            {/* ── RIGHT: Dual mockup — phone + KDS ── */}
            <Reveal delay={0.12} variant="rise">
              <QrKitchenDualMockup />
            </Reveal>

          </div>
        </div>
      </section>

      {/* ── TEAM & ACCESS ──────────────────────────────────────────────────── */}
      <section id="team-access" className="relative scroll-mt-24 overflow-hidden bg-ink py-28">
        <div className="pointer-events-none absolute -left-40 top-16 h-[420px] w-[420px] rounded-full bg-coral/15 blur-3xl" />
        <div className="pointer-events-none absolute -right-48 bottom-0 h-[520px] w-[520px] rounded-full bg-[#0A8272]/10 blur-3xl" />

        <div className="relative mx-auto max-w-7xl px-6">
          <div className="grid items-end gap-8 lg:grid-cols-[1.12fr_.88fr]">
            <Reveal>
              <p className="eyebrow mb-5 text-coral">Team &amp; access</p>
              <h2 className="max-w-3xl font-display text-[clamp(38px,4.5vw,52px)] font-medium leading-[1.02] text-paper">
                The app changes<br />
                <span className="italic text-coral">with the person using it.</span>
              </h2>
            </Reveal>
            <Reveal delay={0.08}>
              <div className="max-w-xl lg:pb-2">
                <p className="font-body text-[17px] leading-relaxed text-white/60">
                  No maze of disabled pages. Front desk opens guest operations. Housekeeping opens rooms and tasks. Accounting opens the books. Irrelevant modules simply do not appear.
                </p>
                <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 font-body text-[10px] font-black uppercase tracking-[.12em] text-white/35">
                  <span>Focused by role</span>
                  <span>Owner controlled</span>
                  <span>Protected everywhere</span>
                </div>
              </div>
            </Reveal>
          </div>

          <Reveal delay={0.12} variant="rise" className="mt-14">
            <RoleWorkspaceShowcase />
          </Reveal>
        </div>
      </section>

      {/* ── BOOKING ENGINE ─────────────────────────────────────────────────── */}
      <section className="py-24 bg-[#f9f8f4]">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid grid-cols-1 items-center gap-14 lg:grid-cols-2 lg:gap-16">
            <Reveal>
              <p className="eyebrow mb-4">Direct Bookings</p>
              <h2 className="font-display text-[clamp(30px,4vw,46px)] font-medium leading-tight text-ink mb-6">
                Turn lookers into<br /><span className="text-coral italic">guaranteed arrivals.</span>
              </h2>
              <p className="text-[17px] text-ink-soft font-body leading-relaxed mb-6">
                Stop paying 15-20% OTA commissions on guests who would have booked directly. Our booking engine integrates right into your website, creating a seamless mobile-optimized experience that syncs live with your PMS inventory.
              </p>
              <ul className="space-y-3 font-body">
                {[
                  "Zero commission on direct bookings",
                  "Live inventory sync — no overbooking",
                  "Mobile-first, conversion-optimized checkout",
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-coral shrink-0 mt-0.5" />
                    <span className="text-ink text-[15px]">{item}</span>
                  </li>
                ))}
              </ul>
            </Reveal>
            <Reveal delay={0.1} variant="rise">
              <BookingEngineMockup />
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── REPORTS ────────────────────────────────────────────────────────── */}
      <section className="py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid grid-cols-1 items-center gap-14 [&>*]:min-w-0 lg:grid-cols-[55fr_45fr] lg:gap-16">
            <Reveal delay={0.1} variant="rise" className="order-2 lg:order-1">
              <ReportMockup />
            </Reveal>
            <Reveal className="order-1 lg:order-2">
              <p className="eyebrow mb-4">Reports</p>
              <h2 className="font-display text-[clamp(30px,4vw,46px)] font-medium leading-tight text-ink mb-6">
                Every number<br />your accountant<br /><span className="text-ink-soft italic">actually expects.</span>
              </h2>
              <p className="text-[17px] text-ink-soft font-body leading-relaxed mb-6">
                Daily reports break down occupancy, revenue by payment method, guest arrivals and departures, shift cash variance, and expenses by category. Monthly reports add ADR, RevPAR, profit margin, top guests, and housekeeping/maintenance summaries.
              </p>
              <p className="text-[14.5px] text-ink-mute font-body">
                Hotel-specific GST/PST configuration, tax-inclusive pricing, and exportable records for your accountant. Direct FBR submission is roadmap work.
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── CHANNEL MANAGER — in development, full section ──────────────────── */}
      <section id="channels" className="py-24 bg-mist border-y border-line">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid grid-cols-1 lg:grid-cols-[42fr_58fr] [&>*]:min-w-0 gap-14 items-center">
            <Reveal>
              <div className="flex items-center gap-3 mb-4">
                <p className="eyebrow">Channel Manager</p>
                <span className="text-[10px] font-bold font-body text-coral-dark bg-coral-soft px-2.5 py-1 rounded-full uppercase tracking-wider">
                  In development
                </span>
              </div>
              <h2 className="font-display text-[clamp(28px,3.4vw,40px)] font-medium leading-tight text-ink mb-5">
                Every channel.<br /><span className="text-coral-dark italic">One calendar.</span>
              </h2>
              <p className="text-[15.5px] text-ink-soft font-body leading-relaxed mb-6 max-w-lg">
                Booking.com, Airbnb, Expedia, and Agoda all sync into a single Innflo calendar — a booking on one channel closes the room everywhere else, automatically. This is what we're building toward: no manual rate updates, no double-booked rooms, no spreadsheet reconciling five different extranets.
              </p>
              <div className="grid grid-cols-2 gap-x-8 gap-y-2.5 font-body text-[13.5px] text-ink-soft mb-8">
                {["Booking.com", "Airbnb", "Expedia", "Agoda", "Bookme.pk", "Sastaticket.pk"].map(f => (
                  <p key={f} className="flex items-center gap-2"><span className="text-coral">—</span>{f}</p>
                ))}
              </div>
              <Link
                to="/channel-manager"
                className="inline-flex h-11 px-7 rounded-full text-[14.5px] font-semibold font-body border border-coral text-coral-dark hover:bg-coral-soft transition-colors items-center"
              >
                Explore the roadmap
              </Link>
            </Reveal>

            <Reveal delay={0.1}>
              <ChannelManagerFlowMockup />
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── FAQ — got a question ─────────────────────────────────────────────── */}
      <section className="bg-paper py-24">
        <div className="mx-auto max-w-4xl px-6">
          <Reveal variant="fade" className="text-center mb-14">
            <h2 className="font-display text-[clamp(30px,4vw,44px)] font-medium leading-tight text-ink">
              Got a question?
            </h2>
          </Reveal>

          <Reveal variant="rise">
            <div className="overflow-hidden rounded-3xl bg-card shadow-float">
              {FEATURE_FAQS.map((item, i) => (
                <FeatureFaqRow
                  key={item.q}
                  q={item.q}
                  a={item.a}
                  isLast={i === FEATURE_FAQS.length - 1}
                  isOpen={openFaq === i}
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                />
              ))}
            </div>
          </Reveal>
        </div>
      </section>

    </div>
  );
}
