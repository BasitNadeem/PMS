import { useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, RefreshCw, AlertTriangle, MailCheck, Send, CalendarDays,
  MapPin, ShieldCheck, Wifi, Coffee, Phone, Images,
  Users, CheckCircle2, ArrowRight, Plus, BedDouble, Wrench, TrendingUp,
} from "lucide-react";
import Reveal from "../components/motion/Reveal";
import SplitHeading from "../components/motion/SplitHeading";
import MagneticButton from "../components/motion/MagneticButton";

const EASE = [0.16, 1, 0.3, 1] as const;

// ─── Flagship — the live manager overview ─────────────────────────────────
function ManagerOverviewMockup() {
  const metrics = [
    { icon: BedDouble, label: "Occupancy", value: "84%", note: "21 of 25 rooms" },
    { icon: TrendingUp, label: "Revenue today", value: "PKR 186K", note: "Room + F&B" },
    { icon: Users, label: "Tomorrow", value: "7 arrivals", note: "2 early requests" },
    { icon: Wrench, label: "Follow-ups", value: "2 open", note: "Maintenance" },
  ];
  return (
    <div className="relative overflow-hidden rounded-[28px] border border-line bg-ink p-5 shadow-hero sm:p-7">
      <div className="absolute -right-20 -top-20 h-52 w-52 rounded-full bg-coral/20 blur-3xl" />
      <div className="relative">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[.16em] text-coral">Manager overview</p>
            <p className="mt-2 font-display text-[25px] font-medium text-white">Tuesday, 28 July</p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[.07] px-3 py-1.5 text-[9px] font-bold text-white/55">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" /> Live hotel data
          </span>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3">
          {metrics.map(({ icon: Icon, label, value, note }, index) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.08, duration: 0.35 }}
              className="rounded-2xl border border-white/10 bg-white/[.055] p-4"
            >
              <div className="flex items-center justify-between">
                <Icon className="h-4 w-4 text-coral" />
                <span className="text-[8px] font-semibold text-white/30">{label}</span>
              </div>
              <p className="mt-4 text-[17px] font-black text-white">{value}</p>
              <p className="mt-1 text-[9px] text-white/40">{note}</p>
            </motion.div>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-3 rounded-2xl bg-coral px-4 py-3">
          <CheckCircle2 className="h-4 w-4 text-white" />
          <div><p className="text-[10px] font-bold text-white">Front desk handover is ready</p><p className="text-[8px] text-white/65">3 notes · 1 priority follow-up</p></div>
          <ArrowRight className="ml-auto h-4 w-4 text-white" />
        </div>
      </div>
    </div>
  );
}

type EmailLifecycleKind = "request" | "confirmed" | "cancelled";

function ReservationEmailAutomationMockup() {
  const lifecycle = [
    {
      id: "request" as EmailLifecycleKind,
      label: "Request received",
      trigger: "Booking Engine submitted",
      subject: "Booking request received — Central Inn (IF-2048)",
      eyebrow: "Booking request received",
      heading: "Your stay is one step closer.",
      intro: "We’ve received your booking request. Our team will review it and contact you shortly with confirmation.",
      status: "Awaiting confirmation",
      statusClass: "bg-amber-50 text-amber-700",
    },
    {
      id: "confirmed" as EmailLifecycleKind,
      label: "Confirmed",
      trigger: "Created or approved by staff",
      subject: "Reservation confirmed — Central Inn (IF-2048)",
      eyebrow: "Reservation confirmed",
      heading: "Your room is ready when you are.",
      intro: "Your reservation is confirmed. Keep this email handy—it has everything you need for your upcoming stay.",
      status: "Confirmed",
      statusClass: "bg-emerald-50 text-emerald-700",
    },
    {
      id: "cancelled" as EmailLifecycleKind,
      label: "Cancelled",
      trigger: "Reservation or group cancelled",
      subject: "Reservation cancelled — Central Inn (IF-2048)",
      eyebrow: "Reservation cancelled",
      heading: "Your reservation has been cancelled.",
      intro: "This confirms that your reservation at Central Inn has been cancelled. If this was unexpected, please contact the hotel.",
      status: "Cancelled",
      statusClass: "bg-rose-50 text-rose-700",
    },
  ];

  const [activeKind, setActiveKind] = useState<EmailLifecycleKind>("confirmed");
  const active = lifecycle.find((item) => item.id === activeKind) ?? lifecycle[1];
  const isCancelled = active.id === "cancelled";

  return (
    <div className="relative">
      <div className="mb-5 flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {lifecycle.map((item, index) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={active.id === item.id}
            onClick={() => setActiveKind(item.id)}
            className={`group flex min-w-[190px] flex-1 items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-all ${
              active.id === item.id
                ? "border-coral bg-coral text-white shadow-[0_14px_35px_rgba(224,83,43,.28)]"
                : "border-white/10 bg-white/[.055] text-white/55 hover:border-white/25 hover:text-white"
            }`}
          >
            <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl text-[9px] font-black ${
              active.id === item.id ? "bg-white/15 text-white" : "bg-white/[.06] text-white/35"
            }`}>
              0{index + 1}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[10px] font-black">{item.label}</span>
              <span className={`mt-0.5 block truncate text-[7px] font-semibold ${
                active.id === item.id ? "text-white/60" : "text-white/30"
              }`}>
                {item.trigger}
              </span>
            </span>
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-[30px] border border-white/10 bg-[#EAE4DC] shadow-[0_40px_110px_rgba(0,0,0,.42)]">
        <div className="flex h-12 items-center justify-between border-b border-[#DCD4C9] bg-[#F8F5F1] px-4 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex shrink-0 gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#F5A6A0]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#F5D183]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#9EDDC7]" />
            </div>
            <span className="truncate text-[9px] font-black text-ink-mute">Innflo · Guest communication</span>
          </div>
          <span className="flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1.5 text-[7px] font-black text-emerald-700 shadow-card">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            LIVE AUTOMATION
          </span>
        </div>

        <div className="grid lg:grid-cols-[270px_minmax(0,1fr)]">
          <aside className="relative overflow-hidden bg-[#211E1A] p-5 text-white sm:p-6">
            <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-coral/20 blur-3xl" />
            <div className="relative">
              <p className="text-[8px] font-black uppercase tracking-[.18em] text-coral">Lifecycle detected</p>
              <h3 className="mt-3 font-display text-[28px] font-medium leading-tight">
                The booking changes.<br />
                <span className="italic text-coral">The guest already knows.</span>
              </h3>

              <div className="mt-7">
                <div className="relative pl-6">
                  <span className="absolute bottom-3 left-[7px] top-3 w-px bg-white/10" />
                  {[
                    { icon: CalendarDays, title: active.trigger, meta: "Reservation event captured" },
                    { icon: MailCheck, title: `${active.label} email prepared`, meta: "Hotel branding and booking data added" },
                    { icon: Send, title: "Sent in the background", meta: "The reservation never waits on email" },
                  ].map((step, index) => {
                    const Icon = step.icon;
                    return (
                      <div key={step.title} className="relative mb-5 last:mb-0">
                        <span className={`absolute -left-6 top-0 grid h-4 w-4 place-items-center rounded-full border ${
                          index === 2 ? "border-emerald-400 bg-emerald-400" : "border-coral bg-coral"
                        }`}>
                          <Icon className="h-2.5 w-2.5 text-white" />
                        </span>
                        <p className="text-[9px] font-black">{step.title}</p>
                        <p className="mt-1 text-[7px] leading-relaxed text-white/35">{step.meta}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="mt-7 grid gap-2">
                {[
                  { icon: Images, text: isCancelled ? "Cancellation-specific layout" : "Room photos and amenities included" },
                  { icon: ShieldCheck, text: "Duplicate sends protected" },
                  { icon: Users, text: "Multi-room stays grouped into one email" },
                ].map(({ icon: Icon, text }) => (
                  <div key={text} className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[.055] px-3 py-2.5">
                    <Icon className="h-3.5 w-3.5 shrink-0 text-coral" />
                    <span className="text-[7px] font-bold leading-relaxed text-white/55">{text}</span>
                  </div>
                ))}
              </div>

              <p className="mt-6 text-[7px] leading-relaxed text-white/30">
                Sent automatically when a valid guest email is attached to the reservation.
              </p>
            </div>
          </aside>

          <div className="min-w-0 p-3 sm:p-6 lg:p-8">
            <div className="mx-auto max-w-[720px] overflow-hidden rounded-[24px] border border-[#DDD6CD] bg-white shadow-[0_24px_70px_rgba(58,43,32,.16)]">
              <div className="flex items-center gap-3 border-b border-line-soft bg-[#FBF9F6] px-4 py-3 sm:px-5">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-coral-soft text-coral-dark">
                  <MailCheck className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[8px] font-black text-ink">{active.subject}</p>
                  <p className="mt-0.5 truncate text-[6.5px] font-semibold text-ink-mute">To Zara Khan · zara@example.com</p>
                </div>
                <span className="ml-auto hidden items-center gap-1.5 text-[6.5px] font-bold text-emerald-700 sm:flex">
                  <CheckCircle2 className="h-3 w-3" />
                  Delivered
                </span>
              </div>

              <AnimatePresence mode="wait">
                <motion.div
                  key={active.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.22 }}
                  className="min-h-[650px]"
                >
                  <div className="flex items-center justify-between border-b border-line-soft px-5 py-4 sm:px-7">
                    <div className="flex items-center gap-2.5">
                      <span className="grid h-9 w-9 place-items-center rounded-full bg-[#183B38] font-display text-[14px] font-bold italic text-white">CI</span>
                      <div>
                        <p className="font-display text-[15px] font-semibold text-[#183B38]">Central Inn</p>
                        <p className="text-[6.5px] font-bold uppercase tracking-[.16em] text-ink-mute">Hunza · Pakistan</p>
                      </div>
                    </div>
                    <span className={`rounded-full px-2.5 py-1.5 text-[7px] font-black ${active.statusClass}`}>{active.status}</span>
                  </div>

                  <div className="px-5 pb-5 pt-7 sm:px-7">
                    <p className="text-[7px] font-black uppercase tracking-[.18em] text-coral-dark">{active.eyebrow}</p>
                    <h4 className="mt-2 max-w-[520px] font-display text-[clamp(27px,4vw,42px)] font-medium leading-[1.02] text-[#183B38]">
                      {active.heading}
                    </h4>
                    <p className="mt-4 max-w-[560px] text-[9px] leading-relaxed text-[#59615E]">
                      Hello Zara,<br />{active.intro}
                    </p>
                    <div className="mt-4 border-t border-[#D9D5CE] pt-3 text-[7px] font-semibold text-[#59615E]">
                      Reference <strong className="ml-1.5 text-[11px] text-coral-dark">IF-2048</strong>
                    </div>
                  </div>

                  {isCancelled ? (
                    <div className="px-5 pb-7 sm:px-7">
                      <div className="rounded-2xl bg-[#F4F2EE] p-4">
                        <p className="text-[8px] font-black text-[#183B38]">Cancellation policy</p>
                        <p className="mt-1.5 text-[7px] leading-relaxed text-[#626967]">
                          Free cancellation up to 72 hours before arrival. Applicable refunds are processed according to the hotel’s policy.
                        </p>
                      </div>
                      <div className="mt-5 border-t border-[#D9D5CE] pt-5 text-center">
                        <p className="font-display text-[20px] font-medium text-[#183B38]">We’re always ready to help.</p>
                        <p className="mx-auto mt-2 max-w-md text-[7px] leading-relaxed text-[#626967]">
                          Reply to this email or contact the hotel directly if the cancellation was unexpected.
                        </p>
                        <span className="mt-4 inline-flex items-center gap-2 rounded-full border border-[#183B38] px-4 py-2 text-[8px] font-black text-[#183B38]">
                          <Phone className="h-3 w-3" />
                          +92 300 1234567
                        </span>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="px-5 sm:px-7">
                        <img
                          src="/images/hotels.webp"
                          alt="Mountain-view room at Central Inn"
                          loading="lazy"
                          decoding="async"
                          className="h-[180px] w-full rounded-2xl object-cover sm:h-[230px]"
                        />
                      </div>

                      <div className="mx-5 mt-3 grid grid-cols-2 overflow-hidden rounded-2xl bg-[#183B38] text-white sm:mx-7">
                        <div className="border-r border-white/10 p-4">
                          <p className="text-[6px] font-black uppercase tracking-[.16em] text-[#91AAA5]">Check-in</p>
                          <p className="mt-1.5 font-display text-[13px]">Fri, 7 August</p>
                        </div>
                        <div className="p-4 text-right">
                          <p className="text-[6px] font-black uppercase tracking-[.16em] text-[#91AAA5]">Check-out</p>
                          <p className="mt-1.5 font-display text-[13px]">Mon, 10 August</p>
                        </div>
                      </div>

                      <div className="px-5 pb-6 pt-5 sm:px-7">
                        <div className="flex items-end justify-between gap-4 border-b border-line-soft pb-3">
                          <div>
                            <p className="text-[6px] font-black uppercase tracking-[.16em] text-coral-dark">Stay details</p>
                            <p className="mt-1 font-display text-[18px] text-[#183B38]">3 rooms · 3 nights</p>
                          </div>
                          <p className="text-right text-[7px] text-ink-mute">Estimated total<br /><strong className="text-[13px] text-ink">PKR 84,600</strong></p>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {[
                            { icon: Wifi, label: "Wi-Fi" },
                            { icon: Coffee, label: "Breakfast" },
                            { icon: MapPin, label: "Get directions" },
                          ].map(({ icon: Icon, label }) => (
                            <span key={label} className="flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1.5 text-[6.5px] font-bold text-ink-soft">
                              <Icon className="h-3 w-3 text-coral-dark" />
                              {label}
                            </span>
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  <div className="bg-[#183B38] px-5 py-5 text-center text-white sm:px-7">
                    <p className="font-display text-[16px] italic">
                      {isCancelled ? "Plans change. Our welcome will still be here." : "Rest well. Explore more. We’ll see you soon."}
                    </p>
                    <p className="mt-2 text-[6.5px] text-[#B8CBC7]">Central Inn · Hunza, Gilgit-Baltistan</p>
                    <p className="mt-3 text-[6px] text-[#8FB4AE]">Hotel phone · WhatsApp · Email · Directions · Powered by Innflo</p>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Housekeeping — task appears the moment a room checks out ─────────────
function HousekeepingAutoMockup() {
  const [triggered, setTriggered] = useState(false);
  return (
    <motion.div
      onViewportEnter={() => setTriggered(true)}
      viewport={{ once: true }}
      className="rounded-2xl overflow-hidden font-body bg-card border border-line shadow-float p-5"
    >
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-line-soft">
        <p className="text-[12.5px] font-bold text-ink">Room 214 — checked out</p>
        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
      </div>
      <AnimatePresence>
        {triggered && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.4, ease: EASE }}
            className="flex items-center gap-3 rounded-xl bg-coral-soft/60 border border-coral/20 p-3"
          >
            <div className="h-9 w-9 rounded-lg bg-coral-soft grid place-items-center shrink-0">
              <Sparkles className="h-4 w-4 text-coral-dark" strokeWidth={2.25} />
            </div>
            <div>
              <p className="text-[11.5px] font-bold text-ink">Cleaning task created — auto</p>
              <p className="text-[10.5px] text-ink-mute">Visible to the housekeeping team</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Folio — charges land automatically, tied to POS ───────────────────────
const FOLIO_AUTO_ITEMS = [
  { label: "Room Service — Dinner", src: "POS order #4021", amt: 2300 },
  { label: "Spa — Hot Stone Massage", src: "Manual entry", amt: 6500 },
];

function FolioAutoMockup() {
  return (
    <div className="rounded-2xl overflow-hidden font-body bg-card border border-line shadow-float p-5">
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-line-soft">
        <p className="text-[12.5px] font-bold text-ink">Room 214 — live folio</p>
        <span className="flex items-center gap-1.5 text-[9.5px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/50">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live
        </span>
      </div>
      <div className="space-y-2">
        {FOLIO_AUTO_ITEMS.map((it, i) => (
          <motion.div
            key={it.label}
            initial={{ opacity: 0, x: -8 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.15, duration: 0.4, ease: EASE }}
            className="flex items-center justify-between rounded-lg bg-mist/60 px-3 py-2.5"
          >
            <div className="min-w-0">
              <p className="text-[11.5px] font-bold text-ink truncate">{it.label}</p>
              <p className="text-[10px] text-ink-mute">{it.src}</p>
            </div>
            <span className="text-[11.5px] font-bold text-ink shrink-0">PKR {it.amt.toLocaleString()}</span>
          </motion.div>
        ))}
      </div>
      <p className="text-[10.5px] text-ink-mute mt-3 pt-3 border-t border-line-soft">
        POS orders post here the moment they're placed — no re-typing at the front desk.
      </p>
    </div>
  );
}

// ─── Inventory — linked movements and low levels ──────────────────────────
function InventoryAutoMockup() {
  const [deducted, setDeducted] = useState(false);
  return (
    <motion.div
      onViewportEnter={() => setDeducted(true)}
      viewport={{ once: true }}
      className="rounded-2xl overflow-hidden font-body bg-card border border-line shadow-float p-5"
    >
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-line-soft">
        <p className="text-[12.5px] font-bold text-ink">Inventory — Linens</p>
        <motion.div
          animate={{ opacity: deducted ? [1, 0.4, 1] : 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="flex items-center gap-1.5 text-[9.5px] font-bold text-ink-mute"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Recipe-linked sale
        </motion.div>
      </div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10.5px] font-semibold text-ink-mute">Bath Towels</span>
        <span className="text-[10.5px] font-bold text-ink">18 pcs</span>
      </div>
      <div className="h-2 rounded-full bg-mist overflow-hidden mb-3">
        <motion.div
          className="h-full rounded-full bg-amber-500"
          initial={{ width: "60%" }}
          animate={{ width: deducted ? "22%" : "60%" }}
          transition={{ duration: 0.9, delay: 0.4, ease: EASE }}
        />
      </div>
      <AnimatePresence>
        {deducted && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.1, duration: 0.4 }}
            className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2"
          >
            <AlertTriangle className="h-3.5 w-3.5 text-amber-700 shrink-0" />
            <p className="text-[10.5px] font-semibold text-amber-800">Below reorder level — flagged automatically</p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Group checkout — every room in the block settles at once ─────────────
const GROUP_ROOMS = ["Room 108", "Room 110", "Room 112", "Room 114"];

function GroupCheckoutMockup() {
  const [settled, setSettled] = useState(false);
  return (
    <motion.div
      onViewportEnter={() => setSettled(true)}
      viewport={{ once: true }}
      className="rounded-2xl overflow-hidden font-body bg-card border border-line shadow-float p-5"
    >
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-line-soft">
        <p className="text-[12.5px] font-bold text-ink">Rao Family — group booking</p>
        <Users className="h-4 w-4 text-ink-mute" />
      </div>
      <div className="space-y-2">
        {GROUP_ROOMS.map((room, i) => (
          <motion.div
            key={room}
            animate={{
              backgroundColor: settled ? "rgba(16,185,129,0.08)" : "#F6F3EE",
              borderColor: settled ? "rgba(16,185,129,0.3)" : "#EFE4D6",
            }}
            transition={{ delay: 0.3 + i * 0.15, duration: 0.4 }}
            className="flex items-center justify-between rounded-lg border px-3 py-2"
          >
            <span className="text-[11px] font-semibold text-ink">{room}</span>
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: settled ? 1 : 0 }}
              transition={{ delay: 0.4 + i * 0.15, duration: 0.3 }}
              className="flex items-center gap-1 text-[10px] font-bold text-emerald-700"
            >
              <CheckCircle2 className="h-3 w-3" /> Settled
            </motion.span>
          </motion.div>
        ))}
      </div>
      <p className="text-[10.5px] text-ink-mute mt-3 pt-3 border-t border-line-soft">
        One checkout on the group closes every room's folio together — no chasing four separate bills.
      </p>
    </motion.div>
  );
}

// ─── Channel sync — compact hub, same visual language as Channel Manager ──
function ChannelSyncMockup() {
  return (
    <div className="rounded-2xl overflow-hidden font-body bg-card border border-line shadow-float p-6">
      <div className="flex items-center justify-center gap-4 flex-wrap mb-5">
        {[
          { name: "Booking.com", color: "#003580", bg: "#E8EFF9" },
          { name: "Airbnb",      color: "#FF5A5F", bg: "#FFF0F0" },
          { name: "Expedia",     color: "#B8860B", bg: "#FFF8E0" },
          { name: "Agoda",       color: "#5B1E96", bg: "#F1EBFB" },
        ].map((ch, i) => (
          <motion.div
            key={ch.name}
            initial={{ opacity: 0, y: -8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1, duration: 0.4, ease: EASE }}
            className="h-11 w-11 rounded-xl grid place-items-center shrink-0"
            style={{ background: ch.bg }}
          >
            <RefreshCw className="h-4.5 w-4.5" style={{ color: ch.color }} strokeWidth={2.25} />
          </motion.div>
        ))}
      </div>
      <div className="flex items-center justify-center gap-2">
        <div className="h-9 w-9 rounded-lg bg-ink grid place-items-center">
          <span className="font-display italic text-[11px] text-paper">IF</span>
        </div>
        <div className="h-px w-16 bg-line-soft" />
        <span className="text-[10.5px] font-bold text-ink-mute uppercase tracking-wide">Your calendar</span>
      </div>
    </div>
  );
}

const AUTO_FAQS = [
  {
    q: "Which reservation emails are sent automatically?",
    a: "Booking Engine submissions receive a request acknowledgement, while staff-created or approved reservations receive a confirmation. Confirmed reservations and group bookings also receive a focused cancellation email when cancelled. Delivery requires a valid guest email on the booking.",
  },
  {
    q: "Do I have to set any of these up manually?",
    a: "Core events are connected once Innflo is configured: reservation changes can send the matching guest email, checkout can create a cleaning task, eligible POS and room-service sales can post to a folio, and recipe-linked sales can deduct inventory. Your team remains in control of exceptions.",
  },
  {
    q: "Does Innflo automatically message the owner on WhatsApp?",
    a: "Not as a production promise today. The manager dashboard and report library are live; proactive WhatsApp briefing delivery remains roadmap work.",
  },
  {
    q: "What happens if I edit something an automation already touched?",
    a: "It's flagged, not silently overwritten — an order edited after posting to a folio, for instance, shows a review warning at front desk instead of quietly drifting.",
  },
  {
    q: "Is Channel Manager sync live yet?",
    a: "It's in development — the channel automation described here is what we're building toward and is clearly separated from the live workflows.",
  },
];

function AutoFaqRow({ q, a, isOpen, isLast, onClick }: { q: string; a: string; isOpen: boolean; isLast: boolean; onClick: () => void }) {
  return (
    <div className={isLast ? "" : "border-b border-line-soft"}>
      <button
        onClick={onClick}
        aria-expanded={isOpen}
        className="w-full flex items-center justify-between gap-6 px-6 sm:px-8 py-5 text-left"
      >
        <span className="text-[16px] sm:text-[17px] font-bold font-body text-ink">{q}</span>
        <span className={`shrink-0 h-5 w-5 rounded-md bg-coral shadow-pop grid place-items-center transition-transform duration-300 ${isOpen ? "rotate-45" : ""}`}>
          <Plus className="h-2.5 w-2.5 text-white" strokeWidth={3} />
        </span>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: EASE }}
            className="overflow-hidden"
          >
            <p className="text-[14.5px] text-ink-soft font-body leading-relaxed text-justify px-6 sm:px-8 pb-6 pr-14">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function Automations() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <div className="bg-paper text-ink">

      {/* ── Opener ─────────────────────────────────────────────────────────── */}
      <section className="pt-40 pb-16 px-6 bg-grid relative overflow-hidden text-center">
        <div
          className="absolute pointer-events-none left-1/2 -translate-x-1/2"
          style={{ top: "-15%", width: "70%", height: "60%", background: "radial-gradient(ellipse, rgba(224,83,43,0.09), transparent 65%)" }}
        />
        <div className="relative mx-auto max-w-2xl">
          <Reveal variant="fade"><p className="eyebrow mb-6">Automations</p></Reveal>
          <h1 className="font-display text-[clamp(38px,6vw,64px)] font-medium leading-[1.05] text-ink">
            <SplitHeading as="span" className="block">Things that happen</SplitHeading>
            <SplitHeading as="span" delay={0.25} className="block italic text-coral-dark">without you.</SplitHeading>
          </h1>
          <Reveal delay={0.5}>
            <p className="text-[17px] text-ink-soft font-body leading-relaxed max-w-lg mx-auto mt-6">
              The parts of running a property that shouldn't need a person watching them — Innflo handles them in the background, so your team's attention goes to the guest in front of them.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ── Flagship: manager overview ──────────────────────────────────────── */}
      <section className="py-20 px-6">
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-1 lg:grid-cols-[55%_45%] gap-14 items-center">
            <Reveal>
              <p className="eyebrow mb-4">Manager overview</p>
              <h2 className="font-display text-[clamp(28px,3.4vw,40px)] font-medium leading-tight text-ink mb-5">
                Your day, connected before you ask.
              </h2>
              <p className="text-[15.5px] text-ink-soft font-body leading-relaxed mb-6 max-w-lg">
                The dashboard brings occupancy, revenue, tomorrow’s arrivals, housekeeping backlog and open maintenance work into one operating picture.
              </p>
              <div className="grid grid-cols-1 gap-2.5 font-body text-[13.5px] text-ink-soft">
                {[
                  "Occupancy, revenue and tomorrow’s arrivals in one view",
                  "Housekeeping and maintenance follow-ups stay visible",
                  "Reports preserve the detail behind every headline number",
                  "WhatsApp briefing delivery remains clearly labeled roadmap work",
                ].map(f => (
                  <p key={f} className="flex items-start gap-2.5"><span className="text-coral mt-0.5">—</span>{f}</p>
                ))}
              </div>
            </Reveal>
            <Reveal delay={0.1}><ManagerOverviewMockup /></Reveal>
          </div>
        </div>
      </section>

      {/* ── Reservation email lifecycle ──────────────────────────────────────── */}
      <section id="guest-emails" className="relative overflow-hidden bg-ink px-6 py-28">
        <div className="pointer-events-none absolute -left-44 top-4 h-[460px] w-[460px] rounded-full bg-coral/15 blur-3xl" />
        <div className="pointer-events-none absolute -right-52 bottom-0 h-[540px] w-[540px] rounded-full bg-[#0A8272]/10 blur-3xl" />

        <div className="relative mx-auto max-w-7xl">
          <div className="grid items-end gap-8 lg:grid-cols-[1.08fr_.92fr]">
            <Reveal>
              <p className="eyebrow mb-5 text-coral">Guest emails</p>
              <h2 className="max-w-3xl font-display text-[clamp(42px,6vw,70px)] font-medium leading-[.98] text-paper">
                The reservation changes.<br />
                <span className="italic text-coral">The guest already knows.</span>
              </h2>
            </Reveal>
            <Reveal delay={0.08}>
              <div className="max-w-xl lg:pb-2">
                <p className="font-body text-[17px] leading-relaxed text-white/60">
                  Request received, confirmed or cancelled—Innflo prepares the right hotel-branded message and sends it in the background, with the guest’s actual stay details already inside.
                </p>
                <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 font-body text-[10px] font-black uppercase tracking-[.12em] text-white/35">
                  <span>Booking Engine + staff reservations</span>
                  <span>Multi-room ready</span>
                  <span>Failure-safe delivery</span>
                </div>
              </div>
            </Reveal>
          </div>

          <Reveal delay={0.12} variant="rise" className="mt-14">
            <ReservationEmailAutomationMockup />
          </Reveal>
        </div>
      </section>

      {/* ── Housekeeping ──────────────────────────────────────────────────────── */}
      <section className="py-20 px-6 bg-mist border-y border-line">
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-1 lg:grid-cols-[45%_55%] gap-14 items-center">
            <Reveal className="order-2 lg:order-1">
              <p className="eyebrow mb-4">Housekeeping</p>
              <h2 className="font-display text-[clamp(28px,3.4vw,40px)] font-medium leading-tight text-ink mb-5">
                Checkout closes, the task appears.
              </h2>
              <p className="text-[15.5px] text-ink-soft font-body leading-relaxed mb-6 max-w-lg">
                No one has to notice a room went vacant, remember to write it down, or radio housekeeping. The cleaning task creates itself, and staff mark rooms done from their phone.
              </p>
              <div className="grid grid-cols-1 gap-2.5 font-body text-[13.5px] text-ink-soft">
                {[
                  "Task created the moment a room checks out",
                  "Housekeeping staff receive the new work in their task flow",
                  "Marked done from a phone — no paper checklist",
                ].map(f => (
                  <p key={f} className="flex items-start gap-2.5"><span className="text-coral mt-0.5">—</span>{f}</p>
                ))}
              </div>
            </Reveal>
            <Reveal delay={0.1} className="order-1 lg:order-2"><HousekeepingAutoMockup /></Reveal>
          </div>
        </div>
      </section>

      {/* ── Folio automation — routes to Point of Sale ───────────────────────── */}
      <section className="py-20 px-6">
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-1 lg:grid-cols-[55%_45%] gap-14 items-center">
            <Reveal>
              <p className="eyebrow mb-4">Folio</p>
              <h2 className="font-display text-[clamp(28px,3.4vw,40px)] font-medium leading-tight text-ink mb-5">
                Every charge finds its folio on its own.
              </h2>
              <p className="text-[15.5px] text-ink-soft font-body leading-relaxed mb-6 max-w-lg">
                Room, F&B, spa, laundry, tax — every charge lands on the right guest folio the moment it happens. A room-service order placed at the Point of Sale terminal posts itself; nothing gets re-typed at the front desk.
              </p>
              <div className="grid grid-cols-1 gap-2.5 font-body text-[13.5px] text-ink-soft mb-7">
                {[
                  "POS orders post to a verified guest's folio automatically",
                  "Manual charges still work for anything that didn't come from POS",
                  "An order edited after posting is flagged, never silently wrong",
                ].map(f => (
                  <p key={f} className="flex items-start gap-2.5"><span className="text-coral mt-0.5">—</span>{f}</p>
                ))}
              </div>
              <MagneticButton>
                <Link to="/pos" className="inline-flex items-center gap-1.5 text-[14px] font-bold text-coral-dark hover:underline">
                  See it in Point of Sale <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </MagneticButton>
            </Reveal>
            <Reveal delay={0.1}><FolioAutoMockup /></Reveal>
          </div>
        </div>
      </section>

      {/* ── Inventory — movement + low stock ────────────────────────────────── */}
      <section className="py-20 px-6 bg-mist border-y border-line">
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-1 lg:grid-cols-[45%_55%] gap-14 items-center">
            <Reveal className="order-2 lg:order-1">
              <p className="eyebrow mb-4">Inventory</p>
              <h2 className="font-display text-[clamp(28px,3.4vw,40px)] font-medium leading-tight text-ink mb-5">
                Sales move stock. Low levels flag themselves.
              </h2>
              <p className="text-[15.5px] text-ink-soft font-body leading-relaxed mb-6 max-w-lg">
                Linked recipes deduct ingredients as POS orders are sold, while stock movements and reorder levels keep the manager aware of what changed and what needs attention.
              </p>
              <div className="grid grid-cols-1 gap-2.5 font-body text-[13.5px] text-ink-soft">
                {[
                  "Stock-in, stock-out and adjustments keep a traceable movement history",
                  "Every POS sale deducts linked ingredients automatically",
                  "Items at or below reorder level flag themselves as low stock",
                ].map(f => (
                  <p key={f} className="flex items-start gap-2.5"><span className="text-coral mt-0.5">—</span>{f}</p>
                ))}
              </div>
            </Reveal>
            <Reveal delay={0.1} className="order-1 lg:order-2"><InventoryAutoMockup /></Reveal>
          </div>
        </div>
      </section>

      {/* ── Group checkout ────────────────────────────────────────────────────── */}
      <section className="py-20 px-6">
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-1 lg:grid-cols-[55%_45%] gap-14 items-center">
            <Reveal>
              <p className="eyebrow mb-4">Group bookings</p>
              <h2 className="font-display text-[clamp(28px,3.4vw,40px)] font-medium leading-tight text-ink mb-5">
                One checkout, every room settled.
              </h2>
              <p className="text-[15.5px] text-ink-soft font-body leading-relaxed mb-6 max-w-lg">
                A family or group booking spanning four rooms shouldn't mean four separate checkouts. Close the group's folio once, and every room in it settles together, automatically.
              </p>
              <div className="grid grid-cols-1 gap-2.5 font-body text-[13.5px] text-ink-soft">
                {[
                  "One checkout closes every room in the group",
                  "Settle as one combined bill, or split by room",
                  "No chasing individual folios room by room",
                ].map(f => (
                  <p key={f} className="flex items-start gap-2.5"><span className="text-coral mt-0.5">—</span>{f}</p>
                ))}
              </div>
            </Reveal>
            <Reveal delay={0.1}><GroupCheckoutMockup /></Reveal>
          </div>
        </div>
      </section>

      {/* ── Channel sync — routes to Channel Manager ─────────────────────────── */}
      <section className="py-20 px-6 bg-mist border-y border-line">
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-1 lg:grid-cols-[45%_55%] gap-14 items-center">
            <Reveal className="order-2 lg:order-1">
              <div className="flex items-center gap-3 mb-4">
                <p className="eyebrow">Channel sync</p>
                <span className="text-[10px] font-bold font-body text-coral-dark bg-coral-soft px-2.5 py-1 rounded-full uppercase tracking-wider">
                  In development
                </span>
              </div>
              <h2 className="font-display text-[clamp(28px,3.4vw,40px)] font-medium leading-tight text-ink mb-5">
                No more five extranets, five tabs.
              </h2>
              <p className="text-[15.5px] text-ink-soft font-body leading-relaxed mb-6 max-w-lg">
                Rates and availability update across Booking.com, Airbnb, Expedia, and Agoda the moment something changes in Innflo — this is what we're building toward, no manual publishing, no double bookings.
              </p>
              <MagneticButton>
                <Link to="/channel-manager" className="inline-flex items-center gap-1.5 text-[14px] font-bold text-coral-dark hover:underline">
                  See Channel Manager <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </MagneticButton>
            </Reveal>
            <Reveal delay={0.1} className="order-1 lg:order-2"><ChannelSyncMockup /></Reveal>
          </div>
        </div>
      </section>

      {/* ── Trial CTA — footer background ───────────────────────────────────── */}
      <section className="py-24 px-6 bg-ink">
        <div className="mx-auto max-w-2xl text-center">
          <Reveal>
            <p className="eyebrow mb-5" style={{ color: "#E0532B" }}>Get in early</p>
            <h2 className="font-display italic text-[clamp(30px,4vw,46px)] font-medium text-paper leading-tight mb-6">
              Start with a guided Innflo trial.
            </h2>
            <p className="text-[16px] font-body leading-relaxed max-w-lg mx-auto mb-9" style={{ color: "rgba(245,235,228,0.68)" }}>
              No card required, no obligation to continue — see if Innflo fits your property first.
            </p>
            <MagneticButton>
              <Link
                to="/contact"
                className="inline-flex items-center h-12 px-9 rounded-full text-[16px] font-bold font-body bg-coral hover:bg-coral-dark text-white transition-colors shadow-pop"
              >
                Book a guided trial →
              </Link>
            </MagneticButton>
          </Reveal>
        </div>
      </section>

      {/* ── FAQ ────────────────────────────────────────────────────────────── */}
      <section className="py-24 px-6">
        <div className="mx-auto max-w-4xl">
          <Reveal variant="fade" className="text-center mb-14">
            <h2 className="font-display text-[clamp(30px,4vw,44px)] font-medium leading-tight text-ink">
              Got a question?
            </h2>
          </Reveal>
          <Reveal variant="rise">
            <div className="rounded-3xl bg-card shadow-float overflow-hidden">
              {AUTO_FAQS.map((item, i) => (
                <AutoFaqRow
                  key={item.q}
                  q={item.q}
                  a={item.a}
                  isLast={i === AUTO_FAQS.length - 1}
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
