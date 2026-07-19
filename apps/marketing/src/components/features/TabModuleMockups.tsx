import { 
  Coffee, Utensils, CheckCircle, AlertTriangle, Clock, Receipt 
} from "lucide-react";

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
        <span className="h-1.5 w-1.5 rounded-full bg-[#059669]" />
      </div>
      {children}
    </div>
  );
}

// ─── ① Dashboard — Live Schedule (Timeline & Metrics Sidebar) ──────────────────
export function LiveScheduleMockup() {
  const rooms = ["101", "102", "103", "104"];
  const days = ["Mon 5", "Tue 6", "Wed 7", "Thu 8", "Fri 9", "Sat 10", "Sun 11"];
  const bookings = [
    { roomIdx: 0, start: 0, span: 3, label: "Ahmed R.", color: "#059669" },
    { roomIdx: 0, start: 4, span: 3, label: "Awais S.", color: "#2563EB" },
    { roomIdx: 1, start: 1, span: 4, label: "Rao F.", color: "#059669" },
    { roomIdx: 2, start: 0, span: 7, label: "Malik Group (3 Rooms)", color: "#9E3417" },
    { roomIdx: 3, start: 3, span: 2, label: "Hamza A.", color: "#D97706" },
  ];

  return (
    <CardShell label="InnFlo — Live Schedule & Timeline">
      <div className="grid grid-cols-1 md:grid-cols-[1fr_260px] divide-y md:divide-y-0 md:divide-x divide-line-soft bg-card">
        {/* Left Panel: Schedulers Grid */}
        <div className="p-4 overflow-x-auto no-scrollbar">
          <div className="min-w-[480px]">
            {/* Header Dates */}
            <div className="flex border-b border-line-soft pb-2 mb-2">
              <div className="w-14 shrink-0 text-[10px] font-bold text-ink-mute uppercase tracking-wider">Room</div>
              <div className="flex-1 grid grid-cols-7 gap-1 text-center">
                {days.map((d, i) => (
                  <div key={d} className="text-[10px] font-bold" style={{ color: i === 2 ? "#E0532B" : "#938C81" }}>
                    {d}
                  </div>
                ))}
              </div>
            </div>

            {/* Room Rows with timeline blocks */}
            <div className="space-y-2 relative">
              {/* Timeline Indicator Line */}
              <div className="absolute top-0 bottom-0 w-[2px] bg-[#E0532B]/85 z-10" style={{ left: "calc(54px + 35.7% - 1px)" }}>
                <span className="absolute -top-1.5 -left-1 w-2.5 h-2.5 rounded-full bg-[#E0532B]" />
              </div>

              {rooms.map((room, rIdx) => (
                <div key={room} className="flex items-center h-10 border-b border-line-soft/40 relative">
                  {/* Room Label */}
                  <div className="w-14 shrink-0">
                    <span className="text-[11px] font-bold text-ink bg-mist border border-line-soft px-1.5 py-0.5 rounded-md">
                      {room}
                    </span>
                  </div>
                  {/* Grid cells */}
                  <div className="flex-1 grid grid-cols-7 h-full relative">
                    {Array.from({ length: 7 }).map((_, colIdx) => (
                      <div key={colIdx} className="border-r border-line-soft/30 h-full" />
                    ))}
                    {/* Render Bookings */}
                    {bookings
                      .filter((b) => b.roomIdx === rIdx)
                      .map((b, bIdx) => (
                        <div
                          key={bIdx}
                          className="absolute h-7 top-1.5 rounded-full flex items-center px-3 shadow-md z-0 transition-transform hover:scale-[1.02] cursor-pointer"
                          style={{
                            left: `calc(${(b.start / 7) * 100}% + 2px)`,
                            width: `calc(${(b.span / 7) * 100}% - 4px)`,
                            backgroundColor: b.color,
                          }}
                        >
                          <span className="text-[9.5px] font-semibold text-white truncate">{b.label}</span>
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Panel: Live Stats Summary */}
        <div className="p-4 bg-mist flex flex-col justify-between">
          <div>
            <p className="text-[10px] font-bold text-ink-mute uppercase tracking-wider mb-3">Live Status</p>
            <div className="space-y-2.5">
              <div className="bg-card p-2.5 rounded-xl border border-line-soft">
                <p className="text-[10px] text-ink-mute font-body uppercase">Occupancy</p>
                <div className="flex items-end justify-between mt-0.5">
                  <p className="text-[16px] font-bold text-ink leading-none">75.0%</p>
                  <p className="text-[10px] font-semibold text-ink-soft">9 / 12 Rooms</p>
                </div>
              </div>
              <div className="bg-card p-2.5 rounded-xl border border-line-soft">
                <p className="text-[10px] text-ink-mute font-body uppercase">Today's Revenue</p>
                <div className="flex items-end justify-between mt-0.5">
                  <p className="text-[16px] font-bold text-emerald-700 leading-none">PKR 54,000</p>
                  <p className="text-[10px] font-semibold text-emerald-600">+12% vs avg</p>
                </div>
              </div>
              <div className="bg-card p-2.5 rounded-xl border border-line-soft">
                <p className="text-[10px] text-ink-mute font-body uppercase">Pending Clean</p>
                <div className="flex items-end justify-between mt-0.5">
                  <p className="text-[16px] font-bold text-amber-700 leading-none">2 Rooms</p>
                  <p className="text-[10px] font-semibold text-amber-600">Checkout cleanup</p>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-line-soft flex items-center justify-between text-[10px] text-ink-soft font-semibold">
            <span>Last sync: Just now</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          </div>
        </div>
      </div>
    </CardShell>
  );
}

// ─── ② POS — In-House POS Billing Terminal ────────────────────────────────────
export function PosTerminalMockup() {
  const categories = ["All Items", "Beverages", "Food Menu", "Spa Services", "Transport"];
  const items = [
    { name: "Cappuccino", price: 450, icon: <Coffee className="h-3.5 w-3.5" /> },
    { name: "Club Sandwich", price: 1200, icon: <Utensils className="h-3.5 w-3.5" /> },
    { name: "Mineral Water", price: 150, icon: <Coffee className="h-3.5 w-3.5" /> },
    { name: "Stone Massage", price: 6500, icon: <SparklesIcon className="h-3.5 w-3.5" /> },
  ];

  return (
    <CardShell label="InnFlo — In-House POS Billing Terminal">
      <div className="grid grid-cols-1 md:grid-cols-[1.3fr_1fr] divide-y md:divide-y-0 md:divide-x divide-line-soft bg-card">
        {/* Left Side: Items & Grid selection */}
        <div className="p-4">
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-3 mb-3 border-b border-line-soft">
            {categories.map((c, i) => (
              <span
                key={c}
                className="text-[10px] px-3 py-1.5 rounded-full font-bold cursor-pointer shrink-0 transition-colors"
                style={
                  i === 0
                    ? { background: "#E0532B", color: "white" }
                    : { background: "#FAF8F4", color: "#4A453E", border: "1px solid #EAE4DB" }
                }
              >
                {c}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {items.map((it) => (
              <div
                key={it.name}
                className="rounded-xl border border-line-soft bg-mist p-3 transition-all hover:bg-line-soft cursor-pointer flex justify-between items-start"
              >
                <div>
                  <div className="text-coral-dark mb-1">{it.icon}</div>
                  <p className="text-[11.5px] font-bold text-ink leading-tight">{it.name}</p>
                  <p className="text-[10px] text-ink-mute mt-0.5">PKR {it.price.toLocaleString()}</p>
                </div>
                <span className="bg-card w-5 h-5 rounded-full grid place-items-center text-[10px] text-ink-soft border border-line shadow-pop">+</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right Side: Active Ticket Cart & Folio Charging */}
        <div className="p-4 bg-mist flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-line-soft mb-3">
              <div>
                <p className="text-[11.5px] font-bold text-ink">Active Ticket</p>
                <p className="text-[9.5px] text-ink-mute">Room 104 · Hamza A.</p>
              </div>
              <span className="text-[9px] font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">Checked In</span>
            </div>

            <div className="space-y-2 max-h-[140px] overflow-y-auto no-scrollbar">
              <div className="flex justify-between items-center text-[11px] bg-card p-2 rounded-lg border border-line-soft">
                <div>
                  <p className="font-semibold text-ink">Cappuccino</p>
                  <p className="text-[9.5px] text-ink-mute">PKR 450 × 1</p>
                </div>
                <p className="font-bold text-ink">PKR 450</p>
              </div>
              <div className="flex justify-between items-center text-[11px] bg-card p-2 rounded-lg border border-line-soft">
                <div>
                  <p className="font-semibold text-ink">Club Sandwich</p>
                  <p className="text-[9.5px] text-ink-mute">PKR 1,200 × 1</p>
                </div>
                <p className="font-bold text-ink">PKR 1,200</p>
              </div>
            </div>
          </div>

          <div className="mt-4">
            <div className="flex justify-between items-center text-[11.5px] font-bold text-ink border-t border-line-soft pt-3 mb-3">
              <span>Total Bill</span>
              <span>PKR 1,650</span>
            </div>
            <button className="w-full h-9 rounded-xl bg-ink hover:bg-ink-soft text-white text-[11.5px] font-bold flex items-center justify-center gap-1.5 shadow-pop transition-colors">
              <Receipt className="h-3.5 w-3.5" />
              Charge to Guest Folio
            </button>
          </div>
        </div>
      </div>
    </CardShell>
  );
}

// ─── ③ QR Dining & Kitchen — Phone App & Kitchen KDS Tablet dual setup ──────
export function QrMenuMockup() {
  const items = [
    { name: "Chicken Karahi", price: "1,650", tag: "CHEF'S SPECIAL", qty: 1 },
    { name: "Fresh Lime", price: "350", tag: null, qty: 2 },
  ];

  return (
    <div className="flex flex-col sm:flex-row items-center justify-center gap-6 p-4 bg-mist rounded-2xl border border-line-soft">
      {/* Smartphone Frame (Guest Ordering App) */}
      <div className="phone-frame w-[190px] shrink-0" style={{ aspectRatio: "9/18.5" }}>
        <div className="px-3.5 pt-3 pb-2.5 bg-card border-b border-line-soft flex items-center justify-between">
          <div>
            <p className="text-[8.5px] text-ink-mute font-bold uppercase tracking-wider">Room 104</p>
            <p className="font-display text-[13px] font-medium text-ink">Eagle's Nest Menu</p>
          </div>
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        </div>
        <div className="p-2 space-y-2 bg-[#F5EBE4] overflow-y-auto" style={{ minHeight: 200 }}>
          {items.map((it) => (
            <div key={it.name} className="rounded-lg bg-card border border-line-soft p-2.5 shadow-pop">
              {it.tag && (
                <span className="text-[7px] font-bold bg-coral-soft text-coral-dark px-1 py-0.5 rounded block w-max mb-1">
                  {it.tag}
                </span>
              )}
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[10px] font-bold text-ink leading-tight">{it.name}</p>
                  <p className="text-[9px] text-ink-mute mt-0.5">PKR {it.price}</p>
                </div>
                <div className="flex items-center gap-1.5 border border-line-soft px-1.5 py-0.5 rounded-full bg-mist">
                  <span className="text-[9px] text-ink-soft cursor-pointer font-bold">-</span>
                  <span className="text-[9.5px] font-bold text-ink">{it.qty}</span>
                  <span className="text-[9px] text-ink-soft cursor-pointer font-bold">+</span>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="p-2 border-t border-line-soft bg-card">
          <button className="w-full h-8 rounded-full bg-coral hover:bg-coral-dark text-white text-[10px] font-bold shadow-pop transition-colors">
            Send Order · PKR 2,350
          </button>
        </div>
      </div>

      {/* Browser KDS Display (Kitchen Display System) */}
      <div className="rounded-xl overflow-hidden bg-card border border-line-soft shadow-hero flex-1 min-w-[240px] max-w-[360px] self-stretch flex flex-col">
        <div className="px-3.5 py-2.5 border-b border-line-soft bg-mist flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <p className="text-[10.5px] font-bold text-ink">Kitchen Screen (KDS)</p>
          </div>
          <span className="text-[8.5px] text-ink-mute font-bold">2 active tickets</span>
        </div>

        <div className="p-3 bg-card space-y-2.5 flex-1 overflow-y-auto">
          {/* Active Ticket Card */}
          <div className="rounded-xl border border-line bg-mist p-3">
            <div className="flex items-center justify-between border-b border-line-soft pb-1.5 mb-2">
              <span className="text-[10.5px] font-bold text-white bg-ink px-2 py-0.5 rounded">Room 104</span>
              <div className="flex items-center gap-1 text-ink-mute text-[9.5px]">
                <Clock className="h-3 w-3" />
                <span>2 min ago</span>
              </div>
            </div>
            <div className="space-y-1 text-[10.5px] font-medium text-ink mb-3">
              <p className="flex justify-between"><span>1x Chicken Karahi</span> <span className="font-bold">Pending</span></p>
              <p className="flex justify-between"><span>2x Fresh Lime</span> <span className="font-bold">Pending</span></p>
            </div>
            <button className="w-full h-7 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[9.5px] font-bold shadow-pop transition-colors">
              Accept & Start cooking
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── ④ Inventory — Phone camera stock count & par alerts ────────────────────
export function ScanToCountMockup() {
  return (
    <div className="flex flex-col sm:flex-row items-center justify-center gap-6 p-4 bg-mist rounded-2xl border border-line-soft">
      {/* Smartphone scanner viewfinder */}
      <div className="phone-frame w-[190px] shrink-0" style={{ aspectRatio: "9/18.5" }}>
        <div className="relative flex-1 bg-ink flex flex-col justify-between" style={{ minHeight: 220 }}>
          <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/70 z-0" />
          
          <div className="relative p-3 z-10 flex justify-between items-center">
            <span className="text-[8px] bg-red-600 text-white px-2 py-0.5 rounded font-bold">● SCANNING</span>
            <span className="text-[8.5px] text-white/80">Shelf: Row C</span>
          </div>

          {/* Graphical crosshair viewfinder and overlays */}
          <div className="relative w-full h-[140px] z-10 flex items-center justify-center">
            {/* Corner Bracket Overlays */}
            <div className="absolute top-4 left-4 w-4 h-4 border-t-2 border-l-2 border-coral" />
            <div className="absolute top-4 right-4 w-4 h-4 border-t-2 border-r-2 border-coral" />
            <div className="absolute bottom-4 left-4 w-4 h-4 border-b-2 border-l-2 border-coral" />
            <div className="absolute bottom-4 right-4 w-4 h-4 border-b-2 border-r-2 border-coral" />

            {/* Simulated Bounding Boxes */}
            <div className="absolute w-[60px] h-[50px] border border-emerald-500 rounded bg-emerald-500/10 flex flex-col items-center justify-center shadow-lg" style={{ left: "15%", top: "25%" }}>
              <span className="text-[6.5px] font-bold text-white bg-emerald-500 px-1 py-0.2 rounded-sm mb-0.5">Water 24ct</span>
              <span className="text-[7.5px] font-bold text-white">Qty: 12</span>
            </div>
            
            <div className="absolute w-[70px] h-[40px] border border-emerald-500 rounded bg-emerald-500/10 flex flex-col items-center justify-center shadow-lg" style={{ right: "12%", bottom: "20%" }}>
              <span className="text-[6.5px] font-bold text-white bg-emerald-500 px-1 py-0.2 rounded-sm mb-0.5">Towel Sets</span>
              <span className="text-[7.5px] font-bold text-white">Qty: 25</span>
            </div>
          </div>

          <div className="relative p-2.5 z-10 bg-black/60 border-t border-white/10 flex items-center gap-2">
            <CheckCircle className="h-4.5 w-4.5 text-emerald-400 shrink-0" />
            <p className="text-[8.5px] text-white font-medium leading-tight">Image processed. 2 items identified.</p>
          </div>
        </div>
      </div>

      {/* Stock Par Level alerts panel */}
      <div className="rounded-xl border border-line bg-card p-4 shadow-card flex-1 min-w-[240px] self-stretch flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between border-b border-line-soft pb-2 mb-3">
            <h4 className="text-[11px] font-bold text-ink uppercase tracking-wider">Par Stock Alerts</h4>
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between p-2 rounded-lg bg-red-50 border border-red-100">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
                <div>
                  <p className="text-[11px] font-bold text-red-950">Mineral Water (24ct)</p>
                  <p className="text-[9px] text-red-800">Par: 20 · Actual: 12</p>
                </div>
              </div>
              <span className="text-[9px] font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded">Low stock</span>
            </div>

            <div className="flex items-center justify-between p-2 rounded-lg bg-[#FAF8F4] border border-line-soft">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
                <div>
                  <p className="text-[11px] font-bold text-ink-soft">Bath Towels (Sets)</p>
                  <p className="text-[9px] text-ink-mute">Par: 15 · Actual: 25</p>
                </div>
              </div>
              <span className="text-[9px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">Normal</span>
            </div>
          </div>
        </div>

        <button className="w-full h-8 rounded-lg border border-coral text-coral-dark hover:bg-coral-soft text-[10.5px] font-bold mt-4 transition-colors">
          Draft Purchase Order
        </button>
      </div>
    </div>
  );
}

// ─── ⑤ Financials — Detailed guest folio ledger sheet ─────────────────────────
export function LiveFolioMockup() {
  const transactions = [
    { date: "04 Jul", desc: "Room Charge (Deluxe Suite - 3 Nights)", type: "Room", amt: 36000, debit: true },
    { date: "05 Jul", desc: "QR Dining Order (Room Service Karahi)", type: "F&B", amt: 1650, debit: true },
    { date: "05 Jul", desc: "POS Terminal Charge (Hot Stone Massage)", type: "Spa", amt: 6500, debit: true },
    { date: "05 Jul", desc: "GST Sales Tax (8%)", type: "Tax", amt: 3532, debit: true },
    { date: "05 Jul", desc: "Advance Deposit Paid (Bank Transfer)", type: "Payment", amt: 15000, debit: false },
  ];

  return (
    <CardShell label="InnFlo — Guest Folio Ledger Screen">
      <div className="p-4 bg-card font-body">
        {/* Folio Info header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 pb-3 border-b border-line-soft mb-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-[13px] font-bold text-ink">Folio: Hamza A.</h3>
              <span className="text-[9.5px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-medium">Payment Pending</span>
            </div>
            <p className="text-[10px] text-ink-soft mt-0.5">Booking Ref: HPM-2026-00214 · Room 108</p>
          </div>
          <div className="text-left sm:text-right bg-mist border border-line-soft rounded-lg px-3 py-1.5">
            <p className="text-[9px] text-ink-mute uppercase">Outstanding Balance</p>
            <p className="text-[14px] font-bold text-ink leading-tight">PKR 32,682</p>
          </div>
        </div>

        {/* Ledger Table */}
        <div className="overflow-x-auto no-scrollbar mb-3">
          <table className="w-full min-w-[420px] text-[10.5px]">
            <thead>
              <tr className="text-ink-mute uppercase border-b border-line-soft text-left">
                <th className="py-2 font-bold w-12">Date</th>
                <th className="py-2 font-bold">Description</th>
                <th className="py-2 font-bold w-12 text-center">Type</th>
                <th className="py-2 font-bold w-20 text-right">Debit</th>
                <th className="py-2 font-bold w-20 text-right">Credit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft/40">
              {transactions.map((t, idx) => (
                <tr key={idx} className="text-ink-soft">
                  <td className="py-2 font-medium">{t.date}</td>
                  <td className="py-2 truncate max-w-[200px]">{t.desc}</td>
                  <td className="py-2 text-center">
                    <span className="bg-mist px-1.5 py-0.5 rounded text-[8.5px] font-bold text-ink-mute">
                      {t.type}
                    </span>
                  </td>
                  <td className="py-2 text-right font-bold">
                    {t.debit ? `PKR ${t.amt.toLocaleString()}` : "—"}
                  </td>
                  <td className="py-2 text-right font-bold text-emerald-700">
                    {!t.debit ? `PKR ${t.amt.toLocaleString()}` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Folio Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line-soft pt-3 text-[10px]">
          <p className="text-ink-mute font-medium">Total Charges: PKR 47,682 · Total Payments: PKR 15,000</p>
          <div className="flex gap-2">
            <button className="h-7 px-3.5 rounded-lg border border-line text-ink hover:bg-mist font-bold transition-colors">
              Print Folio
            </button>
            <button className="h-7 px-3.5 rounded-lg bg-coral text-white hover:bg-coral-dark font-bold shadow-pop transition-colors">
              Checkout & Settle
            </button>
          </div>
        </div>
      </div>
    </CardShell>
  );
}

// Sparkles placeholder to prevent compilation issues
function SparklesIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
      <path d="m5 3 1 2.5L8.5 6 6 7 5 9.5 4 7 1.5 6 4 5.5z" />
      <path d="m19 17 1 2.5 2.5.5-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1z" />
    </svg>
  );
}
