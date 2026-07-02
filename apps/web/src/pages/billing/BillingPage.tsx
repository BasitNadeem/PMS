import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Receipt, TrendingUp, Banknote, AlertCircle, LogOut, ChevronsUpDown, ChevronUp, ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";
import { folioService, type BillingFolio } from "@/services/folio";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Avatar } from "@/components/ui/Avatar";
import { toneOf } from "@/components/ui/StatusBadge";

function formatPkr(paise: number): string {
  const r = paise / 100;
  return `PKR ${r.toLocaleString("en-PK")}`;
}
function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-PK", { dateStyle: "medium" }).format(new Date(iso));
}

function SummaryCard({ icon: Icon, tone, label, value, sub, delay = 0 }: {
  icon: React.ElementType; tone: string; label: string; value: string; sub?: string; delay?: number;
}) {
  const t = toneOf(tone === "pine" ? "Available" : tone === "coral" ? "Occupied" : tone === "slate" ? "Confirmed" : "Maintenance");
  const bg = tone === "pine" ? "#E6F0EA" : tone === "coral" ? "#FBEAE1" : tone === "slate" ? "#E7EEF3" : "#F8EFDA";
  const fg = tone === "pine" ? "#1F4D3A" : tone === "coral" ? "#9E3417" : tone === "slate" ? "#2c455c" : "#86600F";
  return (
    <Card className="anim-fade-up !p-4" hover style={{ animationDelay: delay + "ms" }}>
      <div className="flex items-start justify-between">
        <span className="grid place-items-center h-10 w-10 rounded-xl" style={{ background: bg, color: fg }}>
          <Icon size={20} />
        </span>
      </div>
      <div className="mt-4">
        <div className="serif text-[28px] leading-none text-ink tnum">{value}</div>
        <div className="mt-1.5 text-[13px] font-semibold text-ink-soft">{label}</div>
        {sub && <div className="text-[12px] text-ink-mute">{sub}</div>}
      </div>
    </Card>
  );
}

function FolioRow({ folio }: { folio: BillingFolio }) {
  const navigate = useNavigate();
  const totalCharged = folio.chargesTotal + folio.taxTotal - folio.discountsTotal;
  const room         = folio.reservation.rooms[0]?.room.number ?? "—";
  const statusLabel  = folio.isOpen ? "Open" : "Settled";
  const isGroup      = !!folio.reservation.groupId;

  return (
    <div
      onClick={() => navigate(`/financials/folio/${folio.reservation.id}`)}
      className={cn(
        "group grid grid-cols-2 md:grid-cols-[1.8fr_0.8fr_1fr_1fr_0.9fr_1.4fr_auto] gap-3 px-5 py-3.5 items-center cursor-pointer transition-all border-b border-line-soft last:border-0",
        // Group folios: purple inset stripe + dusk-tinted hover (same language as reservations page)
        isGroup
          ? "shadow-[inset_3px_0_0_#5B4B82] hover:bg-[#EDE9F4]"
          : "hover:bg-line-soft",
      )}
    >
      {/* Guest */}
      <div className="flex items-center gap-3 min-w-0 col-span-2 md:col-span-1">
        <Avatar name={folio.reservation.guest.fullName} size={40} />
        <div className="min-w-0">
          <div className="text-[14.5px] font-semibold text-ink truncate">{folio.reservation.guest.fullName}</div>
          <div className="flex items-center gap-1.5 text-[12px] text-ink-faint tnum">
            <span>{folio.reservation.confirmationNumber || "—"}</span>
            {isGroup && (
              <span
                onClick={(e) => { e.stopPropagation(); navigate(`/groups/${folio.reservation.groupId}`); }}
                className="rounded-full bg-dusk px-2 py-0.5 text-[10px] font-bold tracking-wide text-white hover:bg-dusk/80 transition-colors"
              >
                GROUP
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Room */}
      <div className="hidden md:block text-[13px] font-semibold text-ink">Room {room}</div>

      {/* Dates */}
      <div className="hidden md:block text-[13px] text-ink-soft tnum">{formatDate(folio.reservation.checkInDate)}</div>
      <div className="hidden md:block text-[13px] text-ink-soft tnum">{formatDate(folio.reservation.checkOutDate)}</div>

      {/* Charged / Paid */}
      <div className="hidden md:block">
        <div className="serif text-[17px] text-ink tnum">{formatPkr(totalCharged)}</div>
        <div className="text-[11px] text-ink-mute">Paid: {formatPkr(folio.paymentsTotal)}</div>
      </div>

      {/* Balance + status */}
      <div className="flex items-center gap-2 justify-end">
        {folio.balanceDue > 0 ? (
          <span className="hidden md:inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold bg-clay-soft text-clay">
            {formatPkr(folio.balanceDue)} due
          </span>
        ) : (
          <span className="hidden md:inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold bg-pine-soft text-pine-deep">
            Settled
          </span>
        )}
        <StatusBadge status={statusLabel} size="sm" />
        <ChevronRight size={18} className="text-ink-faint group-hover:text-ink-mute hidden md:block" />
      </div>
    </div>
  );
}

export default function BillingPage() {
  const navigate        = useNavigate();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<"open" | "settled" | "all">("open");
  const [sortBy, setSortBy]             = useState<"checkOut" | "balance" | "guestName">("checkOut");
  const [sortDir, setSortDir]           = useState<"asc" | "desc">("asc");

  const { data: summaryData } = useQuery({
    queryKey: ["billing-summary"],
    queryFn: folioService.getSummary,
    staleTime: 60_000,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["billing-folios", { page, statusFilter, sortBy, sortDir }],
    queryFn: () => folioService.listFolios({ page, limit: 25, statusFilter, sortBy, sortDir }),
  });

  const folios     = data?.data ?? [];
  const meta       = data?.meta;
  const totalPages = meta?.totalPages ?? 1;
  const summary    = summaryData;

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <div className="mb-1.5 text-[12px] font-bold uppercase tracking-[0.14em] text-coral">Finance</div>
          <h1 className="serif text-[34px] leading-[1.05] text-ink">Billing</h1>
          <p className="mt-1.5 text-[15px] text-ink-mute">
            {meta ? `${meta.total.toLocaleString()} folio${meta.total !== 1 ? "s" : ""}` : "Guest billing overview"}
          </p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <SummaryCard icon={TrendingUp} tone="slate"  label="Billed today"        value={formatPkr(summary?.billedToday ?? 0)} sub="New charges posted" delay={0} />
        <SummaryCard icon={Banknote}   tone="pine"   label="Collected today"     value={formatPkr(summary?.collectedToday ?? 0)} sub="Payments received" delay={60} />
        <SummaryCard icon={AlertCircle} tone="coral" label="Outstanding balance" value={formatPkr(summary?.outstandingBalance ?? 0)} sub="Across open folios" delay={120} />
        <SummaryCard icon={LogOut}     tone="amber"  label="Checked-out unpaid"  value={String(summary?.checkedOutUnpaid ?? 0)} sub="Departed with balance" delay={180} />
      </div>

      {/* Status filter pills */}
      <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-mist border border-line mb-3">
        {(["open", "settled", "all"] as const).map((s) => {
          const active = statusFilter === s;
          const activeClass =
            s === "open"    ? "bg-amber/15 text-amber border-amber/30" :
            s === "settled" ? "bg-pine/15 text-pine border-pine/30" :
                              "bg-card text-ink border-line shadow-sm";
          return (
            <button
              key={s}
              onClick={() => {
                setStatusFilter(s);
                setPage(1);
                if (s === "open")    { setSortBy("checkOut"); setSortDir("asc"); }
                if (s === "settled") { setSortBy("checkOut"); setSortDir("desc"); }
              }}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3.5 h-8 text-[13px] font-semibold transition-all border",
                active ? activeClass : "text-ink-mute border-transparent hover:text-ink hover:bg-line-soft",
              )}
            >
              <span className={cn(
                "h-1.5 w-1.5 rounded-full shrink-0 transition-colors",
                active
                  ? s === "open" ? "bg-amber" : s === "settled" ? "bg-pine" : "bg-ink"
                  : "bg-ink-faint",
              )} />
              {s === "open" ? "Open" : s === "settled" ? "Settled" : "All"}
            </button>
          );
        })}
      </div>

      {/* Folios list */}
      <Card pad={false} className="anim-fade-up overflow-hidden">
        {/* Column headers — sortable columns are clickable */}
        {(() => {
          function SortHeader({ col, label }: { col: typeof sortBy; label: string }) {
            const active = sortBy === col;
            const Icon = active ? (sortDir === "asc" ? ChevronUp : ChevronDown) : ChevronsUpDown;
            return (
              <button
                onClick={() => {
                  if (active) {
                    setSortDir((d) => d === "asc" ? "desc" : "asc");
                  } else {
                    setSortBy(col);
                    setSortDir("asc");
                  }
                  setPage(1);
                }}
                className={cn(
                  "flex items-center gap-1 group transition-colors",
                  active ? "text-ink" : "text-ink-faint hover:text-ink-mute",
                )}
              >
                {label}
                <Icon size={12} className={cn("transition-colors", active ? "text-coral" : "text-ink-faint group-hover:text-ink-mute")} />
              </button>
            );
          }
          return (
            <div className="hidden md:grid grid-cols-[1.8fr_0.8fr_1fr_1fr_0.9fr_1.4fr_auto] gap-3 px-5 py-3 text-[11px] font-bold uppercase tracking-wider border-b border-line-soft">
              <SortHeader col="guestName" label="Guest" />
              <span className="text-ink-faint">Room</span>
              <span className="text-ink-faint">Check-in</span>
              <SortHeader col="checkOut" label="Check-out" />
              <span className="text-ink-faint">Total</span>
              <SortHeader col="balance" label="Balance" />
              <span />
            </div>
          );
        })()}

        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-3.5 border-b border-line-soft animate-pulse">
              <div className="w-10 h-10 rounded-full bg-line-soft shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 bg-line-soft rounded w-1/3" />
                <div className="h-2.5 bg-line-soft rounded w-1/4" />
              </div>
              <div className="h-5 bg-line-soft rounded-full w-20 hidden md:block" />
            </div>
          ))
        ) : folios.length === 0 ? (
          <div className="flex flex-col items-center py-16">
            <div className="grid place-items-center h-14 w-14 rounded-2xl bg-line-soft text-ink-faint mb-4">
              <Receipt size={26} />
            </div>
            <p className="text-base font-semibold text-ink-soft">No folios found</p>
          </div>
        ) : (
          folios.map((f) => <FolioRow key={f.id} folio={f} />)
        )}
      </Card>

      {/* Pagination */}
      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-[13px] text-ink-mute">Page {meta.page} of {meta.totalPages}</p>
          <div className="flex items-center gap-1.5">
            <button onClick={() => setPage((p) => p - 1)} disabled={page <= 1}
              className={cn("grid place-items-center h-9 w-9 rounded-full border border-line text-ink-mute transition-colors", page <= 1 ? "opacity-40 cursor-not-allowed" : "hover:bg-line-soft")}>
              <ChevronLeft size={16} />
            </button>
            <button onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages}
              className={cn("grid place-items-center h-9 w-9 rounded-full border border-line text-ink-mute transition-colors", page >= totalPages ? "opacity-40 cursor-not-allowed" : "hover:bg-line-soft")}>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
