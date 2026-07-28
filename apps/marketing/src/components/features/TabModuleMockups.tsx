import type { ReactNode } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Check,
  ChefHat,
  CircleDollarSign,
  Clock3,
  Coffee,
  CreditCard,
  PackageCheck,
  Plus,
  Receipt,
  ShoppingBag,
  Sparkles,
  Utensils,
  WalletCards,
} from "lucide-react";

function ProductWindow({
  title,
  status = "Live",
  children,
}: {
  title: string;
  status?: string;
  children: ReactNode;
}) {
  return (
    <div className="w-full min-w-0 max-w-full overflow-hidden rounded-[22px] border border-line bg-card font-body shadow-[0_24px_65px_rgba(74,45,31,0.16)]">
      <div className="flex h-11 items-center justify-between border-b border-line-soft bg-[#FBF8F4] px-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex shrink-0 gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#F5A6A0]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#F5D183]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#9EDDC7]" />
          </div>
          <span className="truncate text-[10px] font-bold tracking-wide text-ink-mute">{title}</span>
        </div>
        <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-1 text-[6.5px] font-black text-emerald-700">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
          {status.toUpperCase()}
        </span>
      </div>
      {children}
    </div>
  );
}

function TinyMetric({ label, value, detail, accent }: { label: string; value: string; detail: string; accent?: boolean }) {
  return (
    <div className={`rounded-xl border p-2.5 ${accent ? "border-coral/15 bg-coral-soft/60" : "border-line-soft bg-white"}`}>
      <p className="text-[6px] font-black uppercase tracking-[0.13em] text-ink-mute">{label}</p>
      <p className={`mt-1.5 text-[14px] font-black leading-none ${accent ? "text-coral-dark" : "text-ink"}`}>{value}</p>
      <p className="mt-1 text-[6px] font-semibold text-ink-mute">{detail}</p>
    </div>
  );
}

export function LiveScheduleMockup() {
  const days = ["MON 5", "TUE 6", "WED 7", "THU 8", "FRI 9", "SAT 10", "SUN 11"];
  const rows = [
    { room: "101", blocks: [{ left: "3%", width: "40%", name: "Ahmed R.", color: "bg-emerald-600" }, { left: "66%", width: "31%", name: "Awais S.", color: "bg-blue-600" }] },
    { room: "102", blocks: [{ left: "19%", width: "50%", name: "Rao Family", color: "bg-[#0A8272]" }] },
    { room: "103", blocks: [{ left: "2%", width: "76%", name: "Malik Group · 3 rooms", color: "bg-coral-dark" }] },
    { room: "104", blocks: [{ left: "50%", width: "31%", name: "Hamza A.", color: "bg-amber-600" }] },
  ];

  return (
    <ProductWindow title="InnFlo / Live schedule">
      <div className="grid min-w-0 bg-[#F8F4EF] sm:grid-cols-[minmax(0,1fr)_180px]">
        <div className="min-w-0 border-b border-line-soft p-3 sm:border-b-0 sm:border-r">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black text-ink">Reservations timeline</p>
              <p className="text-[7px] text-ink-mute">5–11 July · 12 rooms</p>
            </div>
            <span className="rounded-lg border border-line-soft bg-white px-2 py-1 text-[7px] font-bold text-ink-soft">Week view</span>
          </div>
          <div className="overflow-hidden rounded-2xl border border-line-soft bg-white p-2.5">
            <div className="grid grid-cols-[38px_repeat(7,minmax(0,1fr))] border-b border-line-soft pb-2">
              <span className="text-[5.5px] font-black text-ink-mute">ROOM</span>
              {days.map((day, index) => (
                <span key={day} className={`text-center text-[5.5px] font-black ${index === 2 ? "text-coral-dark" : "text-ink-mute"}`}>{day}</span>
              ))}
            </div>
            <div className="relative mt-1">
              <div className="absolute bottom-0 left-[34%] top-0 z-20 w-px bg-coral">
                <span className="absolute -left-1 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-coral" />
              </div>
              {rows.map((row) => (
                <div key={row.room} className="grid h-10 grid-cols-[38px_minmax(0,1fr)] items-center border-b border-line-soft last:border-0">
                  <span className="text-[7px] font-black text-ink">{row.room}</span>
                  <div className="relative h-full bg-[linear-gradient(to_right,transparent_calc(14.28%-1px),rgba(233,226,217,.7)_14.28%)] bg-[length:14.28%_100%]">
                    {row.blocks.map((block) => (
                      <div
                        key={block.name}
                        className={`absolute top-2 flex h-6 items-center overflow-hidden rounded-full px-2 text-[6px] font-black text-white shadow-sm ${block.color}`}
                        style={{ left: block.left, width: block.width }}
                      >
                        <span className="truncate">{block.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-ink px-3 py-2 text-white">
            <span className="h-2 w-2 animate-pulse rounded-full bg-coral" />
            <p className="text-[6.5px] font-bold text-white/70">Now · 2 arrivals due before 3 PM</p>
            <span className="ml-auto text-[6px] font-black text-emerald-300">SYNCED</span>
          </div>
        </div>

        <div className="p-3">
          <p className="mb-2 text-[6.5px] font-black uppercase tracking-[0.13em] text-ink-mute">Live property</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-1">
            <TinyMetric label="Occupancy" value="75%" detail="9 of 12 rooms" />
            <TinyMetric label="Revenue today" value="54K" detail="+12% vs average" accent />
            <TinyMetric label="To clean" value="2" detail="Both assigned" />
          </div>
          <div className="mt-2 rounded-xl border border-line-soft bg-white p-2.5">
            <p className="text-[6px] font-black text-ink-mute">SHIFT NOTE</p>
            <p className="mt-1.5 text-[7px] font-bold leading-relaxed text-ink">Room 204 requested a late checkout.</p>
            <p className="mt-1 text-[5.5px] text-ink-mute">Front desk · 6m ago</p>
          </div>
        </div>
      </div>
    </ProductWindow>
  );
}

export function PosTerminalMockup() {
  const items = [
    { name: "Cappuccino", price: "450", icon: Coffee, tone: "bg-[#F8E7DC] text-coral-dark" },
    { name: "Club sandwich", price: "1,200", icon: Utensils, tone: "bg-emerald-50 text-emerald-700" },
    { name: "Airport pickup", price: "5,000", icon: ShoppingBag, tone: "bg-blue-50 text-blue-700" },
    { name: "Spa treatment", price: "6,500", icon: Sparkles, tone: "bg-violet-50 text-violet-700" },
  ];

  return (
    <ProductWindow title="InnFlo / Point of sale">
      <div className="grid min-w-0 bg-[#F8F4EF] sm:grid-cols-[minmax(0,1.12fr)_minmax(0,.88fr)]">
        <div className="border-b border-line-soft p-3 sm:border-b-0 sm:border-r">
          <div className="flex gap-1.5 overflow-hidden border-b border-line-soft pb-3">
            {["All items", "Food", "Beverages", "Services"].map((item, index) => (
              <span key={item} className={`shrink-0 rounded-full px-2.5 py-1.5 text-[6.5px] font-black ${index === 0 ? "bg-ink text-white" : "bg-white text-ink-mute"}`}>
                {item}
              </span>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {items.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.name} className="group rounded-2xl border border-line-soft bg-white p-3 shadow-[0_3px_12px_rgba(49,35,26,.03)]">
                  <div className="flex items-start justify-between">
                    <span className={`grid h-8 w-8 place-items-center rounded-xl ${item.tone}`}>
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <span className="grid h-6 w-6 place-items-center rounded-full border border-line-soft text-ink-soft">
                      <Plus className="h-3 w-3" />
                    </span>
                  </div>
                  <p className="mt-3 text-[8px] font-black text-ink">{item.name}</p>
                  <p className="mt-0.5 text-[7px] font-bold text-ink-mute">PKR {item.price}</p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col justify-between bg-white p-3">
          <div>
            <div className="flex items-center justify-between border-b border-line-soft pb-3">
              <div>
                <p className="text-[10px] font-black text-ink">Room 104</p>
                <p className="text-[7px] text-ink-mute">Hamza Ahmed · Checked in</p>
              </div>
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
                <PackageCheck className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-3 space-y-2">
              {[
                ["1 × Cappuccino", "450"],
                ["1 × Club sandwich", "1,200"],
                ["Service tax", "80"],
              ].map(([label, price], index) => (
                <div key={label} className="flex items-center justify-between text-[7.5px]">
                  <span className={index === 2 ? "text-ink-mute" : "font-bold text-ink"}>{label}</span>
                  <span className="font-black text-ink">PKR {price}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-5">
            <div className="flex items-end justify-between border-t border-line-soft pt-3">
              <span className="text-[8px] font-black text-ink">Total</span>
              <span className="text-[16px] font-black text-ink">PKR 1,730</span>
            </div>
            <div className="mt-3 flex h-10 items-center justify-center gap-2 rounded-xl bg-coral text-[8px] font-black text-white shadow-pop">
              <Receipt className="h-3.5 w-3.5" /> Charge to room folio
            </div>
            <p className="mt-2 text-center text-[5.5px] font-bold text-emerald-700">Guest stay verified automatically</p>
          </div>
        </div>
      </div>
    </ProductWindow>
  );
}

export function QrMenuMockup() {
  return (
    <div className="relative min-h-[380px] w-full">
      <div className="absolute bottom-2 right-0 top-2 w-[78%]">
        <ProductWindow title="InnFlo / Kitchen display">
          <div className="bg-[#F8F4EF] p-3 pl-16 sm:pl-20">
            <div className="flex items-center justify-between border-b border-line-soft pb-3">
              <div>
                <p className="text-[10px] font-black text-ink">Kitchen queue</p>
                <p className="text-[7px] text-ink-mute">3 active orders · auto-updating</p>
              </div>
              <ChefHat className="h-5 w-5 text-coral-dark" />
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <div className="rounded-2xl border-2 border-coral bg-white p-3 shadow-pop">
                <div className="flex items-center justify-between">
                  <span className="rounded-lg bg-ink px-2 py-1 text-[7px] font-black text-white">ROOM 104</span>
                  <span className="flex items-center gap-1 text-[6px] font-bold text-coral-dark"><Clock3 className="h-2.5 w-2.5" /> 03:12</span>
                </div>
                <p className="mt-3 text-[8px] font-black text-ink">1 × Chicken Karahi</p>
                <p className="mt-1 text-[7px] font-bold text-ink-soft">2 × Fresh lime</p>
                <p className="mt-1 text-[6px] text-ink-mute">Less spicy · Room delivery</p>
                <div className="mt-4 rounded-lg bg-coral py-2 text-center text-[6.5px] font-black text-white">START COOKING</div>
              </div>
              <div className="rounded-2xl border border-line-soft bg-white p-3">
                <div className="flex items-center justify-between">
                  <span className="rounded-lg bg-emerald-50 px-2 py-1 text-[7px] font-black text-emerald-700">PICKUP</span>
                  <span className="text-[6px] font-bold text-ink-mute">01:08</span>
                </div>
                <p className="mt-3 text-[8px] font-black text-ink">2 × Club sandwich</p>
                <p className="mt-1 text-[7px] font-bold text-ink-soft">1 × Mineral water</p>
                <div className="mt-4 flex items-center gap-1 text-[6.5px] font-black text-emerald-700">
                  <Check className="h-3 w-3" /> PAY AT SPOT
                </div>
              </div>
            </div>
            <div className="mt-2 flex items-center rounded-xl border border-line-soft bg-white px-3 py-2 text-[6.5px] font-bold text-ink-soft">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
              <span className="ml-2">New orders appear here automatically</span>
              <span className="ml-auto text-coral-dark">1 just arrived</span>
            </div>
          </div>
        </ProductWindow>
      </div>

      <div className="absolute bottom-0 left-0 top-0 w-[172px] overflow-hidden rounded-[29px] border-[5px] border-ink bg-white shadow-[0_28px_60px_rgba(37,28,23,.28)]">
        <div className="flex items-center justify-between bg-ink px-3 py-2 text-[6px] font-black text-white">
          <span>9:41</span><span>● ● ●</span>
        </div>
        <div className="bg-[#F5EBE4] px-2.5 pb-2.5 pt-3">
          <p className="text-[6px] font-black uppercase tracking-wider text-coral-dark">Eagle&apos;s Nest Hotel</p>
          <p className="mt-1 font-display text-[14px] font-semibold text-ink">Order your favourites</p>
          <div className="mt-3 flex gap-1 overflow-hidden">
            {["Popular", "Pakistani", "Drinks"].map((item, index) => (
              <span key={item} className={`shrink-0 rounded-full px-2 py-1 text-[5.5px] font-black ${index === 0 ? "bg-ink text-white" : "bg-white text-ink-mute"}`}>{item}</span>
            ))}
          </div>
          <div className="mt-3 space-y-2">
            {[
              ["Chicken Karahi", "PKR 1,650"],
              ["Fresh Lime", "PKR 350"],
            ].map(([name, price], index) => (
              <div key={name} className="rounded-xl bg-white p-2.5 shadow-sm">
                <div className={`h-12 rounded-lg ${index === 0 ? "bg-[linear-gradient(135deg,#C65D39,#F0B074)]" : "bg-[linear-gradient(135deg,#A5C98D,#E7D272)]"}`} />
                <div className="mt-2 flex items-start justify-between">
                  <div>
                    <p className="text-[7px] font-black text-ink">{name}</p>
                    <p className="text-[6px] font-bold text-ink-mute">{price}</p>
                  </div>
                  <span className="grid h-5 w-5 place-items-center rounded-full bg-coral text-white"><Plus className="h-2.5 w-2.5" /></span>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2 rounded-xl bg-coral py-2.5 text-center text-[7px] font-black text-white">View order · PKR 2,350</div>
        </div>
      </div>
    </div>
  );
}

export function InventoryControlMockup() {
  const rows = [
    { item: "Chicken breast", area: "Kitchen", stock: "8.5 kg", level: 28, tone: "bg-rose-500", note: "POS recipe linked" },
    { item: "Mineral water", area: "Restaurant", stock: "12 cases", level: 38, tone: "bg-amber-500", note: "Reorder at 20" },
    { item: "Bath towels", area: "Housekeeping", stock: "46 pcs", level: 76, tone: "bg-emerald-500", note: "Healthy stock" },
  ];

  return (
    <ProductWindow title="InnFlo / Inventory control">
      <div className="bg-[#F8F4EF] p-3 sm:p-4">
        <div className="grid grid-cols-3 gap-2">
          <TinyMetric label="Stock value" value="428K" detail="Across 3 locations" />
          <TinyMetric label="Low stock" value="2" detail="Needs attention" accent />
          <TinyMetric label="Movements" value="18" detail="Recorded today" />
        </div>

        <div className="mt-3 grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_180px]">
          <div className="overflow-hidden rounded-2xl border border-line-soft bg-white">
            <div className="flex items-center justify-between border-b border-line-soft px-3 py-2.5">
              <div>
                <p className="text-[10px] font-black text-ink">Current stock</p>
                <p className="text-[7px] text-ink-mute">Quantities and reorder levels</p>
              </div>
              <span className="rounded-lg bg-ink px-2 py-1 text-[6.5px] font-black text-white">+ Record movement</span>
            </div>
            <div className="divide-y divide-line-soft">
              {rows.map((row) => (
                <div key={row.item} className="px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[8px] font-black text-ink">{row.item}</p>
                      <p className="text-[6px] text-ink-mute">{row.area} · {row.note}</p>
                    </div>
                    <span className="text-[7px] font-black text-ink">{row.stock}</span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-mist">
                    <div className={`h-full rounded-full ${row.tone}`} style={{ width: `${row.level}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="rounded-2xl bg-ink p-3.5 text-white">
              <p className="flex items-center gap-1.5 text-[6.5px] font-black uppercase tracking-wider text-coral">
                <PackageCheck className="h-3 w-3" /> Recipe deduction
              </p>
              <p className="mt-3 text-[12px] font-black">QR order #4082</p>
              <div className="mt-3 space-y-2 text-[6.5px] font-bold text-white/65">
                <p className="flex justify-between"><span>Chicken breast</span><span>− 0.7 kg</span></p>
                <p className="flex justify-between"><span>Cooking oil</span><span>− 0.2 L</span></p>
                <p className="flex justify-between"><span>Spices</span><span>− 0.1 kg</span></p>
              </div>
              <p className="mt-3 flex items-center gap-1 text-[6px] font-black text-emerald-300"><Check className="h-2.5 w-2.5" /> Posted automatically</p>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3">
              <p className="text-[6px] font-black uppercase tracking-wider text-amber-700">Reorder alert</p>
              <p className="mt-1.5 text-[8px] font-black text-amber-950">Mineral water is below par.</p>
            </div>
          </div>
        </div>
      </div>
    </ProductWindow>
  );
}

export function LiveFolioMockup() {
  const lines = [
    { label: "Room · Deluxe Suite", meta: "3 nights", value: "36,000", kind: "charge" },
    { label: "QR dining · Order #4082", meta: "Room service", value: "1,650", kind: "charge" },
    { label: "Spa · Hot stone", meta: "POS terminal", value: "6,500", kind: "charge" },
    { label: "Advance deposit", meta: "Bank transfer", value: "15,000", kind: "payment" },
  ];

  return (
    <ProductWindow title="InnFlo / Guest folio">
      <div className="bg-[#F8F4EF] p-3 sm:p-4">
        <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1.15fr)_minmax(0,.85fr)]">
          <div className="overflow-hidden rounded-2xl border border-line-soft bg-white">
            <div className="flex items-center justify-between border-b border-line-soft p-3">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-[11px] font-black text-ink">Hamza Ahmed</p>
                  <span className="rounded-full bg-amber-50 px-2 py-1 text-[6px] font-black text-amber-700">OPEN</span>
                </div>
                <p className="mt-0.5 text-[7px] text-ink-mute">Room 108 · HPM-00214</p>
              </div>
              <WalletCards className="h-5 w-5 text-coral-dark" />
            </div>
            <div className="divide-y divide-line-soft">
              {lines.map((line) => (
                <div key={line.label} className="flex items-center gap-2.5 px-3 py-2.5">
                  <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ${line.kind === "payment" ? "bg-emerald-50 text-emerald-700" : "bg-mist text-ink-soft"}`}>
                    {line.kind === "payment" ? <ArrowDownRight className="h-3.5 w-3.5" /> : <ArrowUpRight className="h-3.5 w-3.5" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[7.5px] font-black text-ink">{line.label}</p>
                    <p className="text-[6px] text-ink-mute">{line.meta}</p>
                  </div>
                  <span className={`text-[7.5px] font-black ${line.kind === "payment" ? "text-emerald-700" : "text-ink"}`}>
                    {line.kind === "payment" ? "−" : "+"} PKR {line.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col justify-between rounded-2xl bg-ink p-4 text-white shadow-pop">
            <div>
              <p className="text-[6.5px] font-black uppercase tracking-[0.14em] text-white/45">Outstanding balance</p>
              <p className="mt-2 text-[25px] font-black tracking-tight">PKR 32,682</p>
              <div className="mt-4 space-y-2 border-t border-white/10 pt-3 text-[7px] font-bold">
                <p className="flex justify-between text-white/55"><span>Total charges</span><span className="text-white">47,682</span></p>
                <p className="flex justify-between text-white/55"><span>Payments</span><span className="text-emerald-300">−15,000</span></p>
                <p className="flex justify-between text-white/55"><span>Tax included</span><span className="text-white">3,532</span></p>
              </div>
            </div>
            <div className="mt-5">
              <div className="flex h-10 items-center justify-center gap-2 rounded-xl bg-coral text-[8px] font-black text-white">
                <CreditCard className="h-3.5 w-3.5" /> Settle & check out
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <span className="rounded-lg border border-white/10 py-2 text-center text-[6px] font-bold text-white/60">Print folio</span>
                <span className="rounded-lg border border-white/10 py-2 text-center text-[6px] font-bold text-white/60">Add charge</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-3 flex items-center rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[6.5px] font-bold text-emerald-800">
          <CircleDollarSign className="mr-2 h-3.5 w-3.5" />
          Every room, POS and QR charge is already reconciled here.
          <span className="ml-auto">Just now</span>
        </div>
      </div>
    </ProductWindow>
  );
}
