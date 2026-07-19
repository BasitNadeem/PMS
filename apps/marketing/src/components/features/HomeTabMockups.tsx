import React from "react";
import { TrendingUp } from "lucide-react";

const TEAM_ACCESS_COLUMNS = ["Reserv.", "Billing", "Reports", "Tasks"];
const TEAM_ACCESS_ROLES = [
  { name: "Owner",       access: "Full access",       modules: [true, true, true, true] },
  { name: "Manager",     access: "Most modules",      modules: [true, true, true, false] },
  { name: "Front Desk",  access: "Reservations only", modules: [true, false, false, false] },
  { name: "Housekeeping",access: "Tasks only",        modules: [false, false, false, true] },
];

function CardShell({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div className="rounded-2xl overflow-hidden font-body bg-card border border-line shadow-float">
      <div className="flex items-center justify-between px-4 py-3 border-b border-line-soft bg-mist">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-red-400 opacity-50" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400 opacity-50" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 opacity-50" />
          <span className="ml-3 text-[11px] text-ink-mute font-body font-semibold tracking-wide">{label}</span>
        </div>
      </div>
      {children}
    </div>
  );
}

// ─── Front Desk ──────────────────────────────────────────────────────────
export function FrontDeskMockup() {
  return (
    <CardShell label="InnFlo — Front Desk Dashboard">
      <div className="p-4 bg-paper space-y-3 font-body">
        {/* Header Stats */}
        <div className="flex items-center justify-between pb-2 border-b border-line-soft">
          <div>
            <h4 className="text-[10px] font-black text-ink">Today's Guest Log</h4>
            <p className="text-[6.5px] text-ink-mute">Saturday, 5 Jul 2026</p>
          </div>
          <span className="text-[7.5px] font-bold text-coral-dark bg-coral-soft px-2 py-0.5 rounded-full">
            4 Arrivals Today
          </span>
        </div>

        {/* Live Guest List & Active Folio */}
        <div className="grid grid-cols-[1.2fr_1fr] gap-3">
          {/* List */}
          <div className="space-y-1.5">
            <div className="p-2 rounded-xl bg-white border border-line flex items-center justify-between shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-emerald-50 text-emerald-800 flex items-center justify-center text-[7.5px] font-bold">101</span>
                <div>
                  <p className="text-[8.5px] font-black text-ink leading-none">Ahmed R.</p>
                  <p className="text-[5.5px] text-[#059669] font-bold mt-0.5">Checked In</p>
                </div>
              </div>
            </div>

            <div className="p-2 rounded-xl bg-white border border-line flex items-center justify-between shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-blue-50 text-blue-800 flex items-center justify-center text-[7.5px] font-bold">104</span>
                <div>
                  <p className="text-[8.5px] font-black text-ink leading-none">Hamza A.</p>
                  <p className="text-[5.5px] text-[#2563EB] font-bold mt-0.5">Arriving 2 PM</p>
                </div>
              </div>
            </div>

            <div className="p-2 rounded-xl bg-white border border-line flex items-center justify-between shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-amber-50 text-amber-800 flex items-center justify-center text-[7.5px] font-bold">108</span>
                <div>
                  <p className="text-[8.5px] font-black text-ink leading-none">Zara K.</p>
                  <p className="text-[5.5px] text-[#D97706] font-bold mt-0.5">Arriving 4 PM</p>
                </div>
              </div>
            </div>
          </div>

          {/* Active Check-In Card */}
          <div className="bg-white p-2 rounded-xl border border-line shadow-md flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-line-soft pb-1 mb-1">
                <span className="text-[6.5px] font-bold text-ink">Check-In Card</span>
                <span className="text-[5.5px] bg-amber-100 text-amber-800 font-bold px-1 rounded">Room 108</span>
              </div>
              <div className="space-y-1">
                <p className="text-[8px] font-black text-ink leading-none">Zara Khan</p>
                <p className="text-[5.5px] text-ink-mute">Deluxe Double · 3 Nights</p>
                
                <div className="space-y-0.5 pt-1">
                  <div className="flex justify-between text-[5.5px] text-ink-soft">
                    <span>ID Verification:</span>
                    <span className="text-emerald-700 font-bold">✓ Verified</span>
                  </div>
                  <div className="flex justify-between text-[5.5px] text-ink-soft">
                    <span>Payment Status:</span>
                    <span className="text-emerald-700 font-bold">✓ Paid</span>
                  </div>
                </div>
              </div>
            </div>

            <button className="w-full py-1 bg-coral hover:bg-coral-dark text-white rounded-md text-[6.5px] font-bold shadow-sm transition-colors mt-2">
              Confirm Check-In
            </button>
          </div>
        </div>
      </div>
    </CardShell>
  );
}

// ─── Housekeeping ────────────────────────────────────────────────────────
export function HousekeepingMockup() {
  return (
    <div className="h-[280px] w-full flex items-center justify-center p-2 relative overflow-hidden select-none">
      {/* Phone frame mock */}
      <div className="w-[190px] h-[260px] bg-white rounded-[26px] border-[5px] border-[#1E2022] shadow-[0_12px_24px_rgba(0,0,0,0.08)] flex flex-col overflow-hidden shrink-0">
        {/* Status Bar */}
        <div className="px-3 py-1 bg-[#1A1C1E] text-white flex justify-between items-center text-[7.5px] font-sans font-medium opacity-90 shrink-0">
          <span>11:00 PM</span>
          <div className="flex items-center gap-1">
            <span className="text-[6.5px] text-amber-400 font-black">● Offline Mode</span>
          </div>
        </div>

        {/* PWA Header */}
        <div className="px-2.5 py-2 bg-ink text-white flex items-center justify-between border-b border-line/20 shrink-0">
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span className="text-[7.5px] font-black uppercase tracking-wider font-sans">Staff Portal</span>
          </div>
          <span className="text-[5.5px] bg-[#059669]/20 text-[#059669] border border-emerald-500/35 px-1 py-0.2 rounded font-black">Auto-Sync</span>
        </div>

        {/* Checklist App */}
        <div className="flex-1 bg-[#F5EBE4] p-2 space-y-2 overflow-hidden flex flex-col justify-start">
          {/* Progress Mini Bar */}
          <div className="bg-white p-1.5 rounded-lg border border-line-soft/80 flex items-center justify-between shrink-0">
            <span className="text-[7px] font-black text-ink">Room 105 Checklist</span>
            <span className="text-[6px] text-emerald-700 bg-emerald-50 px-1 py-0.2 rounded font-bold">2 / 4 Complete</span>
          </div>

          <div className="space-y-1 flex-1 overflow-hidden">
            {/* Checklist Items */}
            <div className="bg-white px-2 py-1.5 rounded-lg border border-line-soft flex items-center gap-2 shadow-sm shrink-0">
              <span className="text-emerald-700 text-[8px] font-bold">✓</span>
              <span className="text-[7.5px] text-ink font-semibold line-through decoration-ink-mute">Change bed linens</span>
            </div>

            <div className="bg-white px-2 py-1.5 rounded-lg border border-line-soft flex items-center gap-2 shadow-sm shrink-0">
              <span className="text-emerald-700 text-[8px] font-bold">✓</span>
              <span className="text-[7.5px] text-ink font-semibold line-through decoration-ink-mute">Replace bathroom towels</span>
            </div>

            <div className="bg-white px-2 py-1.5 rounded-lg border border-line flex items-center gap-2 shadow-sm shrink-0">
              <span className="w-2.5 h-2.5 rounded bg-mist border border-line-soft shrink-0" />
              <span className="text-[7.5px] text-ink font-bold">Dust and sanitise surfaces</span>
            </div>

            <div className="bg-white px-2 py-1.5 rounded-lg border border-line flex items-center gap-2 shadow-sm shrink-0">
              <span className="w-2.5 h-2.5 rounded bg-mist border border-line-soft shrink-0" />
              <span className="text-[7.5px] text-ink font-bold">Restock complimentary tea/water</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Reports ─────────────────────────────────────────────────────────────
export function ReportsSnapshotMockup() {
  return (
    <CardShell label="InnFlo — Operations Report">
      <div className="p-4 bg-paper space-y-3 font-body">
        {/* Metric Header */}
        <div className="flex items-center justify-between pb-1.5 border-b border-line-soft">
          <div>
            <h4 className="text-[10px] font-black text-ink">June 2026 performance</h4>
            <p className="text-[6.5px] text-ink-mute">Compared to previous month</p>
          </div>
          <span className="flex items-center gap-0.5 text-[#059669] bg-[#E2F9F5] px-1.5 py-0.5 rounded-full text-[6.5px] font-bold">
            <TrendingUp className="w-2.5 h-2.5" />
            <span>+12.4% ADR</span>
          </span>
        </div>

        {/* Analytics Grid */}
        <div className="grid grid-cols-2 gap-2">
          {/* Revenue */}
          <div className="bg-white p-2 rounded-xl border border-line-soft shadow-sm">
            <p className="text-[6.5px] font-bold text-ink-mute">Monthly Revenue</p>
            <p className="text-[10px] font-black text-ink mt-0.5">PKR 3.44M</p>
            <div className="flex items-center gap-1 mt-1 text-[#059669] text-[5.5px] font-bold">
              <span>▲ +9.2%</span>
            </div>
          </div>

          {/* Occupancy */}
          <div className="bg-white p-2 rounded-xl border border-line-soft shadow-sm">
            <p className="text-[6.5px] font-bold text-ink-mute">Average Occupancy</p>
            <p className="text-[10px] font-black text-ink mt-0.5">75.8%</p>
            <div className="flex items-center gap-1 mt-1 text-[#059669] text-[5.5px] font-bold">
              <span>▲ +8.1%</span>
            </div>
          </div>
        </div>

        {/* Mini breakdown list */}
        <div className="bg-white p-2 rounded-xl border border-line-soft shadow-sm space-y-1">
          <p className="text-[6.5px] font-black text-ink-mute uppercase tracking-wider mb-1">Revenue Channels</p>
          <div className="flex justify-between items-center text-[7px] border-b border-mist pb-0.5">
            <span className="text-ink-soft">Direct Bookings</span>
            <span className="font-bold text-ink">PKR 2.42M (70%)</span>
          </div>
          <div className="flex justify-between items-center text-[7px]">
            <span className="text-ink-soft">OTAs / Channels</span>
            <span className="font-bold text-ink">PKR 1.02M (30%)</span>
          </div>
        </div>
      </div>
    </CardShell>
  );
}

// ─── Channel Manager — Coming Soon ────────────────────────────────────
export function ChannelManagerComingSoonMockup() {
  return (
    <CardShell label="InnFlo — Channel Sync Engine">
      <div className="p-4 bg-paper space-y-3 font-body">
        {/* Header */}
        <div className="flex items-center justify-between pb-1.5 border-b border-line-soft">
          <div>
            <h4 className="text-[10px] font-black text-ink">OTA Integrations</h4>
            <p className="text-[6.5px] text-ink-mute">Direct API connectivity matrix</p>
          </div>
          <span className="text-[6.5px] font-extrabold text-[#E0532B] bg-[#E0532B]/15 px-2 py-0.5 rounded-full uppercase tracking-wider">
            In Dev
          </span>
        </div>

        {/* Locked Channel List */}
        <div className="space-y-1.5 opacity-65 select-none relative">
          {/* Booking.com */}
          <div className="bg-white px-2 py-1.5 rounded-xl border border-dashed border-line-soft flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 bg-[#003580]/50 rounded-lg flex items-center justify-center text-[7px] text-white font-extrabold font-sans shrink-0">B.</div>
              <div>
                <p className="text-[8px] font-black text-ink-soft leading-tight">Booking.com API</p>
                <p className="text-[5.5px] text-ink-mute">Mapping: Deluxe, Suite</p>
              </div>
            </div>
            <span className="text-[5.5px] text-ink-mute bg-mist px-1.5 py-0.5 rounded-full font-bold">Planned</span>
          </div>

          {/* Airbnb */}
          <div className="bg-white px-2 py-1.5 rounded-xl border border-dashed border-line-soft flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 bg-[#FF5A5F]/50 rounded-lg flex items-center justify-center text-[7px] text-white font-extrabold font-sans shrink-0">A.</div>
              <div>
                <p className="text-[8px] font-black text-ink-soft leading-tight">Airbnb API</p>
                <p className="text-[5.5px] text-ink-mute">Mapping: Entire Villa</p>
              </div>
            </div>
            <span className="text-[5.5px] text-ink-mute bg-mist px-1.5 py-0.5 rounded-full font-bold">Planned</span>
          </div>

          {/* Blur/In Dev watermark */}
          <div className="absolute inset-0 bg-paper/20 backdrop-blur-[1px] flex items-center justify-center">
            <div className="bg-white/95 border border-line px-3 py-2 rounded-xl shadow-float text-center max-w-[85%]">
              <p className="text-[8px] font-black text-ink leading-tight">Beta Sync Engine</p>
              <p className="text-[5.5px] text-ink-soft mt-0.5 leading-relaxed">Direct two-way channel sync is in private beta. Arriving late 2026.</p>
            </div>
          </div>
        </div>
      </div>
    </CardShell>
  );
}

// ─── Team & Access ───────────────────────────────────────────────────────
export function TeamAccessMockup() {
  return (
    <CardShell label="InnFlo — Role Permissions">
      <div className="p-4 bg-paper space-y-3 font-body">
        <div className="flex items-center justify-between pb-2 border-b border-line-soft">
          <div>
            <h4 className="text-[10px] font-black text-ink">Staff & Role Access</h4>
            <p className="text-[6.5px] text-ink-mute">Module-level permissions, per role</p>
          </div>
          <span className="text-[7.5px] font-bold text-coral-dark bg-coral-soft px-2 py-0.5 rounded-full">4 Roles</span>
        </div>

        <div className="space-y-1.5">
          <div className="grid grid-cols-[1fr_repeat(4,1.5rem)] items-center gap-1 px-2.5">
            <span />
            {TEAM_ACCESS_COLUMNS.map((c) => (
              <span key={c} className="text-[5.5px] font-bold text-ink-mute text-center leading-tight">{c}</span>
            ))}
          </div>

          {TEAM_ACCESS_ROLES.map((r) => (
            <div key={r.name} className="grid grid-cols-[1fr_repeat(4,1.5rem)] items-center gap-1 bg-white rounded-xl border border-line-soft px-2.5 py-1.5">
              <div>
                <p className="text-[7.5px] font-black text-ink leading-none">{r.name}</p>
                <p className="text-[5.5px] text-ink-mute mt-0.5">{r.access}</p>
              </div>
              {r.modules.map((on, i) => (
                <span key={i} className="flex justify-center">
                  <span className={`h-2.5 w-2.5 rounded-full ${on ? "bg-emerald-500" : "bg-line"}`} />
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </CardShell>
  );
}
