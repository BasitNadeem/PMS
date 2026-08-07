import type { ReactNode } from "react";
import {
  BellRing,
  Check,
  ChevronRight,
  CloudOff,
  Download,
  KeyRound,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  UserPlus,
  Wifi,
} from "lucide-react";

function BrowserShell({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="w-full min-w-0 max-w-full overflow-hidden rounded-[22px] border border-line bg-card font-body shadow-[0_24px_65px_rgba(74,45,31,0.15)]">
      <div className="flex h-11 items-center justify-between border-b border-line-soft bg-[#FBF8F4] px-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex shrink-0 gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#F5A6A0]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#F5D183]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#9EDDC7]" />
          </div>
          <span className="truncate text-[10px] font-bold tracking-wide text-ink-mute">{title}</span>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function Metric({
  label,
  value,
  meta,
  tone = "ink",
}: {
  label: string;
  value: string;
  meta: string;
  tone?: "ink" | "green" | "coral";
}) {
  const valueClass = tone === "green" ? "text-emerald-700" : tone === "coral" ? "text-coral-dark" : "text-ink";
  return (
    <div className="rounded-xl border border-line-soft bg-white p-3 shadow-[0_4px_14px_rgba(49,35,26,0.035)]">
      <p className="text-[7px] font-black uppercase tracking-[0.14em] text-ink-mute">{label}</p>
      <p className={`mt-1.5 text-[17px] font-black leading-none ${valueClass}`}>{value}</p>
      <p className="mt-1 text-[7px] font-semibold text-ink-mute">{meta}</p>
    </div>
  );
}

export function FrontDeskMockup() {
  const arrivals = [
    { room: "104", guest: "Hamza Ahmed", stay: "Deluxe · 3 nights", state: "Ready", color: "emerald" },
    { room: "108", guest: "Zara Khan", stay: "Mountain Suite · 2 nights", state: "Due 2:00", color: "amber" },
    { room: "203", guest: "Awais Shah", stay: "Twin · 1 night", state: "ID needed", color: "blue" },
  ];

  return (
    <BrowserShell
      title="Innflo / Front desk / Today"
      action={
        <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-1 text-[7px] font-black text-emerald-700">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
          LIVE
        </span>
      }
    >
      <div className="bg-[#F8F4EF] p-3 sm:p-4">
        <div className="mb-3 grid grid-cols-3 gap-2">
          <Metric label="Arrivals" value="8" meta="3 checked in" tone="green" />
          <Metric label="Departures" value="5" meta="2 remaining" />
          <Metric label="Rooms ready" value="18/22" meta="82% prepared" tone="coral" />
        </div>

        <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1.15fr)_minmax(0,.85fr)]">
          <div className="overflow-hidden rounded-2xl border border-line-soft bg-white">
            <div className="flex items-center justify-between border-b border-line-soft px-3 py-2.5">
              <div>
                <p className="text-[10px] font-black text-ink">Today&apos;s arrivals</p>
                <p className="text-[7px] text-ink-mute">Saturday, 5 July</p>
              </div>
              <span className="rounded-full bg-mist px-2 py-1 text-[7px] font-bold text-ink-soft">8 guests</span>
            </div>
            <div className="divide-y divide-line-soft">
              {arrivals.map((arrival, index) => (
                <div
                  key={arrival.room}
                  className={`flex items-center gap-2.5 px-3 py-2.5 ${index === 1 ? "bg-[#FFF9F2]" : ""}`}
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-ink text-[8px] font-black text-white">
                    {arrival.room}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[9px] font-black text-ink">{arrival.guest}</p>
                    <p className="truncate text-[7px] text-ink-mute">{arrival.stay}</p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-1 text-[6.5px] font-black ${
                      arrival.color === "emerald"
                        ? "bg-emerald-50 text-emerald-700"
                        : arrival.color === "amber"
                          ? "bg-amber-50 text-amber-700"
                          : "bg-blue-50 text-blue-700"
                    }`}
                  >
                    {arrival.state}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="relative overflow-hidden rounded-2xl bg-ink p-3.5 text-white shadow-pop">
            <div className="absolute -right-7 -top-7 h-24 w-24 rounded-full bg-coral/20 blur-2xl" />
            <div className="relative">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[7px] font-black uppercase tracking-[0.14em] text-coral">Ready to check in</p>
                  <p className="mt-1 text-[13px] font-black">Zara Khan</p>
                </div>
                <span className="rounded-lg bg-white/10 px-2 py-1 text-[7px] font-bold">Room 108</span>
              </div>
              <div className="mt-4 space-y-2">
                {["Room inspected", "Guest details verified", "Advance recorded"].map((item) => (
                  <div key={item} className="flex items-center gap-2 rounded-lg bg-white/[0.06] px-2.5 py-2">
                    <span className="grid h-4 w-4 place-items-center rounded-full bg-emerald-400/15 text-emerald-300">
                      <Check className="h-2.5 w-2.5" strokeWidth={3} />
                    </span>
                    <span className="text-[7.5px] font-semibold text-white/75">{item}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex h-9 items-center justify-center rounded-xl bg-coral text-[8px] font-black shadow-pop">
                Confirm check-in
              </div>
            </div>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2 rounded-xl border border-coral/20 bg-coral-soft/70 px-3 py-2">
          <BellRing className="h-3.5 w-3.5 text-coral-dark" />
          <p className="text-[7.5px] font-bold text-coral-dark">New direct booking · Mountain Suite · 12–14 Jul</p>
          <ChevronRight className="ml-auto h-3 w-3 text-coral-dark" />
        </div>
      </div>
    </BrowserShell>
  );
}

export function HousekeepingMockup() {
  const rooms = [
    { room: "105", detail: "Checkout clean", state: "In progress", tone: "coral" },
    { room: "108", detail: "Arrival priority", state: "Ready", tone: "green" },
    { room: "204", detail: "Stayover service", state: "Assigned", tone: "blue" },
  ];

  return (
    <div className="relative min-h-[350px] w-full">
      <div className="absolute bottom-3 left-0 right-12 top-0">
        <BrowserShell
          title="Innflo / Housekeeping board"
          action={<span className="text-[7px] font-bold text-ink-mute">6 of 9 ready</span>}
        >
          <div className="bg-[#F8F4EF] p-3.5 pr-20 sm:pr-28">
            <div className="flex items-end justify-between border-b border-line-soft pb-3">
              <div>
                <p className="text-[12px] font-black text-ink">Room turnaround</p>
                <p className="text-[7px] text-ink-mute">Live task board · Today</p>
              </div>
              <div className="text-right">
                <p className="text-[18px] font-black leading-none text-emerald-700">67%</p>
                <p className="text-[6.5px] font-bold text-ink-mute">READY</p>
              </div>
            </div>
            <div className="mt-3 space-y-2">
              {rooms.map((item) => (
                <div key={item.room} className="flex items-center gap-2 rounded-xl border border-line-soft bg-white p-2.5">
                  <span className="grid h-8 w-8 place-items-center rounded-xl bg-ink text-[8px] font-black text-white">{item.room}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[8.5px] font-black text-ink">{item.detail}</p>
                    <p className="text-[6.5px] text-ink-mute">Assigned to Housekeeping</p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-1 text-[6px] font-black ${
                      item.tone === "green"
                        ? "bg-emerald-50 text-emerald-700"
                        : item.tone === "coral"
                          ? "bg-coral-soft text-coral-dark"
                          : "bg-blue-50 text-blue-700"
                    }`}
                  >
                    {item.state}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-ink p-3 text-white">
                <p className="text-[6.5px] font-bold text-white/45">NEXT ARRIVAL</p>
                <p className="mt-1 text-[10px] font-black">Room 108 · 1:30 PM</p>
              </div>
              <div className="rounded-xl border border-line-soft bg-white p-3">
                <p className="text-[6.5px] font-bold text-ink-mute">PUSH DELIVERY</p>
                <p className="mt-1 flex items-center gap-1 text-[9px] font-black text-emerald-700">
                  <Wifi className="h-3 w-3" /> 3 staff online
                </p>
              </div>
            </div>
          </div>
        </BrowserShell>
      </div>

      <div className="absolute bottom-0 right-0 w-[155px] overflow-hidden rounded-[27px] border-[5px] border-ink bg-white shadow-[0_24px_55px_rgba(37,28,23,0.28)]">
        <div className="flex items-center justify-between bg-ink px-3 py-2 text-white">
          <span className="text-[6.5px] font-black">11:42</span>
          <span className="flex items-center gap-1 text-[6px] font-bold text-amber-300">
            <CloudOff className="h-2.5 w-2.5" /> Offline
          </span>
        </div>
        <div className="bg-[#F5EBE4] p-2.5">
          <div className="rounded-xl bg-coral p-2.5 text-white shadow-pop">
            <p className="text-[6px] font-black uppercase tracking-wider text-white/65">Priority clean</p>
            <p className="mt-1 text-[11px] font-black">Room 105</p>
            <p className="text-[6.5px] text-white/70">Arrival at 1:30 PM</p>
          </div>
          <div className="mt-2 space-y-1.5">
            {["Linen changed", "Bathroom", "Amenities", "Final check"].map((item, index) => (
              <div key={item} className="flex items-center gap-1.5 rounded-lg bg-white px-2 py-2">
                <span
                  className={`grid h-3.5 w-3.5 place-items-center rounded ${
                    index < 2 ? "bg-emerald-600 text-white" : "border border-line text-transparent"
                  }`}
                >
                  <Check className="h-2 w-2" />
                </span>
                <span className="text-[6.5px] font-bold text-ink">{item}</span>
              </div>
            ))}
          </div>
          <div className="mt-2 flex items-center gap-1 rounded-lg bg-amber-50 px-2 py-1.5 text-[5.5px] font-bold text-amber-700">
            <RefreshCw className="h-2.5 w-2.5" />
            2 updates queued to sync
          </div>
        </div>
      </div>
    </div>
  );
}

export function ReportsSnapshotMockup() {
  const bars = [36, 52, 47, 71, 64, 83, 76, 91, 82, 96, 88, 100];

  return (
    <BrowserShell
      title="Innflo / Reports / Performance"
      action={
        <span className="flex items-center gap-1 rounded-lg border border-line px-2 py-1 text-[7px] font-bold text-ink-soft">
          <Download className="h-2.5 w-2.5" /> Export
        </span>
      }
    >
      <div className="bg-[#F8F4EF] p-3 sm:p-4">
        <div className="grid grid-cols-3 gap-2">
          <Metric label="Revenue" value="3.44M" meta="+9.2% vs June" tone="green" />
          <Metric label="Occupancy" value="75.8%" meta="+8.1% vs June" />
          <Metric label="ADR" value="12.4K" meta="+12.4% vs June" tone="coral" />
        </div>

        <div className="mt-3 grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1.35fr)_minmax(0,.65fr)]">
          <div className="rounded-2xl border border-line-soft bg-white p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black text-ink">Revenue trend</p>
                <p className="text-[7px] text-ink-mute">Last 12 months</p>
              </div>
              <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[6.5px] font-black text-emerald-700">
                <TrendingUp className="h-2.5 w-2.5" /> +18.6%
              </span>
            </div>
            <div className="mt-5 flex h-28 items-end gap-1.5 border-b border-line-soft px-1">
              {bars.map((height, index) => (
                <div key={height + index} className="flex h-full flex-1 items-end">
                  <div
                    className={`w-full rounded-t-sm ${index === bars.length - 1 ? "bg-coral" : "bg-ink/15"}`}
                    style={{ height: `${height}%` }}
                  />
                </div>
              ))}
            </div>
            <div className="mt-2 flex justify-between text-[6px] font-bold text-ink-mute">
              <span>AUG</span><span>NOV</span><span>FEB</span><span>MAY</span><span>JUL</span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="rounded-2xl bg-ink p-3 text-white">
              <p className="text-[7px] font-black uppercase tracking-wider text-white/45">Best channel</p>
              <p className="mt-2 text-[13px] font-black">Direct bookings</p>
              <p className="mt-0.5 text-[7px] text-white/55">70% of room revenue</p>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div className="h-full w-[70%] rounded-full bg-coral" />
              </div>
            </div>
            <div className="rounded-2xl border border-line-soft bg-white p-3">
              <p className="text-[7px] font-black uppercase tracking-wider text-ink-mute">Payment mix</p>
              <div className="mt-3 flex h-2 overflow-hidden rounded-full">
                <span className="w-[52%] bg-coral" />
                <span className="w-[31%] bg-ink" />
                <span className="w-[17%] bg-emerald-500" />
              </div>
              <div className="mt-3 space-y-1.5 text-[6.5px] font-bold text-ink-soft">
                <p className="flex justify-between"><span>Bank</span><span>52%</span></p>
                <p className="flex justify-between"><span>Cash</span><span>31%</span></p>
                <p className="flex justify-between"><span>Card</span><span>17%</span></p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </BrowserShell>
  );
}

export function TeamAccessMockup() {
  const permissions = [
    { role: "Owner", initials: "BN", modules: ["Full access", "Reports", "Settings"], active: true },
    { role: "Front desk", initials: "AK", modules: ["Reservations", "Guests", "Billing"], active: true },
    { role: "Housekeeping", initials: "SK", modules: ["Rooms", "Tasks"], active: true },
    { role: "Accountant", initials: "RM", modules: ["Financials", "Reports"], active: false },
  ];

  return (
    <div className="w-full min-w-0 max-w-full overflow-hidden">
      <BrowserShell
        title="Innflo / Settings / Team & access"
        action={
          <span className="flex items-center gap-1 rounded-lg bg-ink px-2 py-1 text-[7px] font-bold text-white">
            <UserPlus className="h-2.5 w-2.5" /> Invite staff
          </span>
        }
      >
        <div className="min-w-0 bg-[#F8F4EF] p-3 sm:p-4">
        <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,.72fr)]">
          <div className="overflow-hidden rounded-2xl border border-line-soft bg-white">
            <div className="flex items-center justify-between border-b border-line-soft px-3 py-2.5">
              <div>
                <p className="text-[10px] font-black text-ink">Your team</p>
                <p className="text-[7px] text-ink-mute">7 active staff · 4 roles</p>
              </div>
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="divide-y divide-line-soft">
              {permissions.map((row) => (
                <div key={row.role} className="flex items-center gap-2 px-3 py-2.5">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-coral-soft text-[7px] font-black text-coral-dark">
                    {row.initials}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[8.5px] font-black text-ink">{row.role}</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {row.modules.map((module) => (
                        <span key={module} className="rounded bg-mist px-1.5 py-0.5 text-[5.5px] font-bold text-ink-mute">
                          {module}
                        </span>
                      ))}
                    </div>
                  </div>
                  <span className={`h-2 w-2 rounded-full ${row.active ? "bg-emerald-500" : "bg-line"}`} />
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <div className="relative overflow-hidden rounded-2xl bg-ink p-4 text-white">
              <div className="absolute -right-5 -top-5 h-20 w-20 rounded-full bg-coral/20 blur-xl" />
              <LockKeyhole className="h-6 w-6 text-coral" />
              <p className="mt-4 text-[12px] font-black">Role-based access</p>
              <p className="mt-1 text-[7px] leading-relaxed text-white/55">Each staff member sees only the work their role requires.</p>
              <div className="mt-4 flex items-center gap-2 rounded-xl bg-white/[.07] px-2.5 py-2">
                <KeyRound className="h-3 w-3 text-emerald-300" />
                <span className="text-[6.5px] font-bold text-white/70">28 permission rules active</span>
              </div>
            </div>
            <div className="rounded-2xl border border-line-soft bg-white p-3">
              <p className="text-[7px] font-black uppercase tracking-wider text-ink-mute">Latest activity</p>
              <div className="mt-2 flex gap-2">
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-coral" />
                <div>
                  <p className="text-[7px] font-bold text-ink">Manager updated a rate plan</p>
                  <p className="text-[6px] text-ink-mute">Logged in the audit trail · 4m</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        </div>
      </BrowserShell>
    </div>
  );
}

export function ChannelManagerComingSoonMockup() {
  const channels = [
    { name: "Innflo Booking Engine", mark: "IF", tone: "bg-coral text-white", state: "Live", live: true },
    { name: "Booking.com", mark: "B.", tone: "bg-[#063B89] text-white", state: "Planned", live: false },
    { name: "Airbnb", mark: "A.", tone: "bg-[#FF5A5F] text-white", state: "Planned", live: false },
    { name: "Expedia", mark: "E.", tone: "bg-[#17174B] text-[#F6C344]", state: "Planned", live: false },
  ];

  return (
    <div className="w-full min-w-0 max-w-full overflow-hidden">
      <BrowserShell
        title="Innflo / Distribution hub"
        action={<span className="rounded-full bg-coral-soft px-2 py-1 text-[7px] font-black text-coral-dark">IN DEVELOPMENT</span>}
      >
        <div className="relative min-w-0 overflow-hidden bg-[#F8F4EF] p-3 sm:p-4">
        <div className="absolute left-[43%] top-1/2 h-48 w-48 -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-coral/20" />
        <div className="relative grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,.72fr)]">
          <div className="rounded-2xl border border-line-soft bg-white p-3">
            <div className="flex items-center justify-between border-b border-line-soft pb-3">
              <div>
                <p className="text-[10px] font-black text-ink">Connected channels</p>
                <p className="text-[7px] text-ink-mute">One inventory, every source</p>
              </div>
              <RefreshCw className="h-4 w-4 text-coral-dark" />
            </div>
            <div className="mt-3 space-y-2">
              {channels.map((channel) => (
                <div key={channel.name} className="flex items-center gap-2.5 rounded-xl border border-line-soft bg-[#FCFAF7] p-2.5">
                  <span className={`grid h-8 w-8 place-items-center rounded-xl text-[8px] font-black ${channel.tone}`}>{channel.mark}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[8px] font-black text-ink">{channel.name}</p>
                    <p className="text-[6px] text-ink-mute">{channel.live ? "Direct bookings active" : "Two-way inventory sync"}</p>
                  </div>
                  <span className={`rounded-full px-2 py-1 text-[6px] font-black ${channel.live ? "bg-emerald-50 text-emerald-700" : "bg-mist text-ink-mute"}`}>
                    {channel.state}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col justify-between gap-3">
            <div className="rounded-2xl bg-ink p-4 text-white">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-coral" />
                <span className="text-[7px] font-black uppercase tracking-wider text-coral">Roadmap preview</span>
              </div>
              <p className="mt-4 text-[15px] font-black leading-tight">Change once.<br />Sync everywhere.</p>
              <p className="mt-2 text-[7px] leading-relaxed text-white/55">Rates, availability and reservations flowing through one controlled hub.</p>
            </div>
            <div className="rounded-2xl border border-line-soft bg-white p-3">
              <p className="text-[7px] font-black uppercase tracking-wider text-ink-mute">Planned sync flow</p>
              <div className="mt-3 space-y-2">
                {["Rate & availability", "New reservations", "Room mapping"].map((item, index) => (
                  <div key={item} className="flex items-center gap-2">
                    <span className="grid h-5 w-5 place-items-center rounded-full bg-coral-soft text-[6px] font-black text-coral-dark">0{index + 1}</span>
                    <span className="text-[7px] font-bold text-ink-soft">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        </div>
      </BrowserShell>
    </div>
  );
}
