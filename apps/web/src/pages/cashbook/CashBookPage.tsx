import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BookOpen, ArrowDownLeft, ArrowUpRight, TrendingUp, TrendingDown,
  Plus, ChevronLeft, ChevronRight, Wallet,
} from "lucide-react";
import { cn } from "@/lib/cn";
import {
  cashbookService,
  SOURCE_LABELS,
  type LedgerEntry,
  type EntryType,
  type SourceType,
} from "@/services/cashbook";
import { RecordEntryModal } from "@/components/cashbook/RecordEntryModal";
import { BalancesDrawer } from "@/components/cashbook/BalancesDrawer";
import { useToast } from "@/hooks/useToast";
import { ToastContainer } from "@/components/ui/ToastContainer";
import { usePermissions } from "@/hooks/usePermissions";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatPKR(paisas: number) {
  return `PKR ${Math.floor(Math.abs(paisas) / 100).toLocaleString("en-PK")}`;
}

// Always uses local (browser) date parts — never toISOString() which returns UTC.
// Pakistan is UTC+5, so before 5 AM local time toISOString() still returns yesterday.
function localIso(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function todayIso() { return localIso(); }

function firstOfMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

type DatePreset = "today" | "this_week" | "this_month" | "last_month" | "last_3_months" | "custom";

function getDateRange(preset: Exclude<DatePreset, "custom">): { startDate: string; endDate: string } {
  const today = new Date();
  const y = today.getFullYear();
  const m = today.getMonth();
  const d = today.getDate();

  switch (preset) {
    case "today":
      return { startDate: todayIso(), endDate: todayIso() };
    case "this_week": {
      const day  = today.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      return { startDate: localIso(new Date(y, m, d + diff)), endDate: todayIso() };
    }
    case "this_month":
      return { startDate: `${y}-${String(m + 1).padStart(2, "0")}-01`, endDate: todayIso() };
    case "last_month": {
      return {
        startDate: localIso(new Date(y, m - 1, 1)),
        endDate:   localIso(new Date(y, m, 0)),
      };
    }
    case "last_3_months":
      return { startDate: localIso(new Date(y, m - 3, 1)), endDate: todayIso() };
  }
}

function fmtGroupDate(iso: string) {
  return new Intl.DateTimeFormat("en-PK", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  }).format(new Date(iso.slice(0, 10) + "T00:00:00"));
}

function fmtShortDate(iso: string) {
  return new Intl.DateTimeFormat("en-PK", {
    day: "2-digit", month: "short",
  }).format(new Date(iso.slice(0, 10) + "T00:00:00"));
}

function getSubText(entry: LedgerEntry): string {
  switch (entry.source_type) {
    case "FOLIO_PAYMENT":   return "Room payment";
    case "EXPENSE":         return "Expense";
    case "BANK_DEPOSIT":    return "Bank deposit";
    case "CASH_WITHDRAWAL": return "Cash withdrawal";
    case "OPENING_BALANCE": return "Opening balance";
    case "ADJUSTMENT":      return "Manual adjustment";
    default:                return "Manual entry";
  }
}

const SOURCE_BADGE: Record<SourceType, { bg: string; text: string }> = {
  FOLIO_PAYMENT:   { bg: "bg-slate-soft",  text: "text-slate" },
  EXPENSE:         { bg: "bg-clay-soft",   text: "text-clay" },
  BANK_DEPOSIT:    { bg: "bg-dusk-soft",   text: "text-dusk" },
  CASH_WITHDRAWAL: { bg: "bg-amber-soft",  text: "text-amber" },
  OPENING_BALANCE: { bg: "bg-line-soft",   text: "text-ink-mute" },
  ADJUSTMENT:      { bg: "bg-amber-soft",  text: "text-amber" },
  OTHER:           { bg: "bg-line-soft",   text: "text-ink-mute" },
};

const METHOD_LABELS: Record<string, string> = {
  CASH:          "Cash",
  JAZZCASH:      "JazzCash",
  EASYPAISA:     "Easypaisa",
  CREDIT_CARD:   "Card",
  DEBIT_CARD:    "Card",
  BANK_TRANSFER: "Bank",
  OTHER:         "Other",
};

const PRESETS: { value: DatePreset; label: string }[] = [
  { value: "today",         label: "Today" },
  { value: "this_week",     label: "This Week" },
  { value: "this_month",    label: "This Month" },
  { value: "last_month",    label: "Last Month" },
  { value: "last_3_months", label: "Last 3 Months" },
  { value: "custom",        label: "Custom Range" },
];

const PAGE_SIZE = 25;

const inputCls = "h-9 rounded-xl border border-line bg-mist px-3 text-[13px] text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-coral/20 transition-colors";

// ── Main page ─────────────────────────────────────────────────────────────────

export default function CashBookPage() {
  const { has } = usePermissions();
  const canCreate = has("cashbook:create");
  const { toasts, addToast, removeToast } = useToast();

  const [preset,        setPreset]        = useState<DatePreset>("this_month");
  const [customStart,   setCustomStart]   = useState(firstOfMonth());
  const [customEnd,     setCustomEnd]     = useState(todayIso());
  const [entryType,     setEntryType]     = useState<EntryType | "">("");
  const [page,          setPage]          = useState(1);
  const [showRecord,    setShowRecord]    = useState(false);
  const [showBalances,  setShowBalances]  = useState(false);

  const { startDate, endDate } = useMemo(() => {
    if (preset === "custom") return { startDate: customStart, endDate: customEnd };
    return getDateRange(preset as Exclude<DatePreset, "custom">);
  }, [preset, customStart, customEnd]);

  const { data: summary } = useQuery({
    queryKey: ["cashbook", "summary", { startDate, endDate }],
    queryFn:  () => cashbookService.getSummary({ startDate, endDate }),
    staleTime: 30_000,
  });

  const { data: ledgerData, isLoading } = useQuery({
    queryKey: ["cashbook", "ledger", { startDate, endDate, entryType, page }],
    queryFn:  () => cashbookService.getLedger({
      startDate,
      endDate,
      entryType: entryType || undefined,
      page,
      limit: PAGE_SIZE,
    }),
  });

  const entries = ledgerData?.data ?? [];
  const meta    = ledgerData?.meta;

  const groups = useMemo(() => {
    const map = new Map<string, LedgerEntry[]>();
    for (const entry of entries) {
      const d   = entry.entry_date.slice(0, 10);
      const arr = map.get(d) ?? [];
      arr.push(entry);
      map.set(d, arr);
    }
    return Array.from(map.entries()).map(([date, items]) => ({ date, items }));
  }, [entries]);

  function handleReset() {
    setPreset("this_month");
    setCustomStart(firstOfMonth());
    setCustomEnd(todayIso());
    setEntryType("");
    setPage(1);
  }

  const netPositive = (summary?.netFlow ?? 0) >= 0;
  const startIdx    = (page - 1) * PAGE_SIZE + 1;
  const endIdx      = Math.min(page * PAGE_SIZE, meta?.total ?? 0);

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <div className="mb-1.5 text-[12px] font-bold uppercase tracking-[0.14em] text-coral">Finance</div>
          <h1 className="serif text-[34px] leading-[1.05] text-ink">Balance Book</h1>
          <p className="mt-1.5 text-[15px] text-ink-mute">All money in and out</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowBalances(true)}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-full border border-line bg-card text-ink-soft text-sm font-semibold hover:bg-mist transition-colors"
          >
            <Wallet size={14} /> Balances
          </button>
          {canCreate && (
            <button
              onClick={() => setShowRecord(true)}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-full bg-coral text-white text-sm font-semibold hover:bg-coral/90 transition-colors shadow-pop"
            >
              <Plus size={15} /> Record Entry
            </button>
          )}
        </div>
      </div>

      {/* Filter row */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        {/* Date preset dropdown */}
        <select
          value={preset}
          onChange={(e) => { setPreset(e.target.value as DatePreset); setPage(1); }}
          className={cn(inputCls, "cursor-pointer min-w-[140px]")}
        >
          {PRESETS.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>

        {/* Custom range inputs */}
        {preset === "custom" && (
          <>
            <input type="date" value={customStart}
              onChange={(e) => { setCustomStart(e.target.value); setPage(1); }}
              className={inputCls} />
            <span className="text-ink-faint text-sm select-none">–</span>
            <input type="date" value={customEnd}
              onChange={(e) => { setCustomEnd(e.target.value); setPage(1); }}
              className={inputCls} />
          </>
        )}

        {/* Direction pills */}
        <div className="flex items-center rounded-full border border-line overflow-hidden">
          {(["", "INCOMING", "OUTGOING"] as const).map((t) => (
            <button
              key={t}
              onClick={() => { setEntryType(t); setPage(1); }}
              className={cn(
                "h-9 px-4 text-[12.5px] font-semibold transition-colors whitespace-nowrap",
                entryType === t
                  ? t === "INCOMING" ? "bg-pine text-white"
                    : t === "OUTGOING" ? "bg-clay text-white"
                    : "bg-ink text-white"
                  : "text-ink-mute hover:bg-mist",
              )}
            >
              {t === ""         ? "All"
               : t === "INCOMING" ? "Incoming ↓"
               : "Outgoing ↑"}
            </button>
          ))}
        </div>

        {/* Reset */}
        <button
          onClick={handleReset}
          className="text-[12.5px] text-ink-faint hover:text-ink-soft underline underline-offset-2 transition-colors"
        >
          Reset
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-5">
        {/* Total In */}
        <div className="rounded-xl2 border border-line bg-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="grid place-items-center h-9 w-9 rounded-lg bg-pine-soft">
              <ArrowDownLeft size={17} className="text-pine-deep" />
            </div>
            <span className="text-[11px] font-bold uppercase tracking-wide text-ink-faint">Total In</span>
          </div>
          <div className="serif text-[24px] text-pine-deep tnum leading-none mb-1">
            {summary ? formatPKR(summary.totalIncoming) : "—"}
          </div>
          <div className="text-[12px] text-ink-mute">Money received</div>
        </div>

        {/* Total Out */}
        <div className="rounded-xl2 border border-line bg-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="grid place-items-center h-9 w-9 rounded-lg bg-clay-soft">
              <ArrowUpRight size={17} className="text-clay" />
            </div>
            <span className="text-[11px] font-bold uppercase tracking-wide text-ink-faint">Total Out</span>
          </div>
          <div className="serif text-[24px] text-clay tnum leading-none mb-1">
            {summary ? formatPKR(summary.totalOutgoing) : "—"}
          </div>
          <div className="text-[12px] text-ink-mute">Money paid out</div>
        </div>

        {/* Net Flow */}
        <div className="rounded-xl2 border border-line bg-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className={cn("grid place-items-center h-9 w-9 rounded-lg",
              netPositive ? "bg-pine-soft" : "bg-clay-soft")}>
              {netPositive
                ? <TrendingUp   size={17} className="text-pine-deep" />
                : <TrendingDown size={17} className="text-clay" />}
            </div>
            <span className="text-[11px] font-bold uppercase tracking-wide text-ink-faint">Net Flow</span>
          </div>
          <div className={cn("serif text-[24px] tnum leading-none mb-1",
            netPositive ? "text-pine-deep" : "text-clay")}>
            {summary
              ? (summary.netFlow < 0 ? "−" : "") + formatPKR(summary.netFlow)
              : "—"}
          </div>
          <div className="text-[12px] text-ink-mute">Net position</div>
        </div>
      </div>

      {/* Ledger table */}
      <div className="rounded-xl2 border border-line bg-card overflow-hidden">
        {/* Column headers */}
        <div className="hidden md:grid grid-cols-[72px_minmax(0,2fr)_100px_80px_120px_120px] gap-3 px-5 py-3 border-b border-line-soft bg-mist/50 text-[11px] font-bold uppercase tracking-wider text-ink-faint">
          <span>Date</span>
          <span>Description</span>
          <span>Source</span>
          <span>Method</span>
          <span className="text-right text-pine">In</span>
          <span className="text-right text-clay">Out</span>
        </div>

        {isLoading ? (
          Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-3.5 border-b border-line-soft animate-pulse">
              <div className="h-3 bg-line-soft rounded w-14" />
              <div className="flex-1 h-3 bg-line-soft rounded" />
              <div className="h-5 bg-line-soft rounded-full w-16 ml-auto" />
              <div className="h-3 bg-line-soft rounded w-16" />
            </div>
          ))
        ) : groups.length === 0 ? (
          <div className="flex flex-col items-center py-16 gap-3">
            <div className="grid place-items-center h-14 w-14 rounded-2xl bg-mist text-ink-faint mb-1">
              <BookOpen size={26} />
            </div>
            <p className="text-base font-semibold text-ink-soft">No transactions yet</p>
            <p className="text-[13px] text-ink-mute max-w-xs text-center">
              Folio payments and expenses appear here automatically.
              Use '+ Record Entry' for manual entries.
            </p>
          </div>
        ) : (
          groups.map(({ date, items }) => (
            <div key={date}>
              {/* Date separator */}
              <div className="px-5 py-2 bg-mist/60 border-b border-line-soft">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
                  {fmtGroupDate(date)}
                </span>
              </div>

              {/* Entries */}
              {items.map((entry, idx) => {
                const isIn   = entry.entry_type === "INCOMING";
                const src    = entry.source_type as SourceType;
                const badge  = SOURCE_BADGE[src] ?? SOURCE_BADGE.OTHER;
                const method = entry.payment_method ? (METHOD_LABELS[entry.payment_method] ?? null) : null;

                return (
                  <div
                    key={entry.id}
                    className={cn(
                      "grid grid-cols-2 md:grid-cols-[72px_minmax(0,2fr)_100px_80px_120px_120px] gap-3 px-5 py-3 items-center border-l-2 transition-colors",
                      idx < items.length - 1 ? "border-b border-line-soft" : "",
                      isIn
                        ? "border-l-pine hover:bg-green-50/30 bg-green-50/10"
                        : "border-l-clay hover:bg-red-50/30 bg-red-50/10",
                    )}
                  >
                    {/* Date (short) */}
                    <span className="text-[12px] text-ink-faint tnum hidden md:block">
                      {fmtShortDate(entry.entry_date)}
                    </span>

                    {/* Description */}
                    <div className="min-w-0">
                      <p className="text-[13.5px] font-semibold text-ink truncate">{entry.description}</p>
                      <p className="text-[11.5px] text-ink-faint mt-0.5">{getSubText(entry)}</p>
                    </div>

                    {/* Source badge */}
                    <span className={cn(
                      "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold w-fit",
                      badge.bg, badge.text,
                    )}>
                      {SOURCE_LABELS[src] ?? src}
                    </span>

                    {/* Method badge */}
                    {method ? (
                      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold bg-line-soft text-ink-mute w-fit">
                        {method}
                      </span>
                    ) : (
                      <span className="hidden md:block" />
                    )}

                    {/* IN */}
                    <span className={cn(
                      "text-right text-[13.5px] font-semibold tnum hidden md:block",
                      isIn ? "text-pine-deep" : "text-transparent select-none",
                    )}>
                      {isIn ? formatPKR(entry.amount) : "·"}
                    </span>

                    {/* OUT */}
                    <span className={cn(
                      "text-right text-[13.5px] font-semibold tnum hidden md:block",
                      !isIn ? "text-clay" : "text-transparent select-none",
                    )}>
                      {!isIn ? formatPKR(entry.amount) : "·"}
                    </span>
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {meta && meta.total > 0 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-[13px] text-ink-mute">
            Showing {startIdx}–{endIdx} of {meta.total} transactions
          </p>
          {meta.totalPages > 1 && (
            <div className="flex items-center gap-1.5">
              <button onClick={() => setPage((p) => p - 1)} disabled={page <= 1}
                className={cn("grid place-items-center h-9 w-9 rounded-full border border-line text-ink-mute transition-colors",
                  page <= 1 ? "opacity-40 cursor-not-allowed" : "hover:bg-line-soft")}>
                <ChevronLeft size={16} />
              </button>
              <button onClick={() => setPage((p) => p + 1)} disabled={page >= meta.totalPages}
                className={cn("grid place-items-center h-9 w-9 rounded-full border border-line text-ink-mute transition-colors",
                  page >= meta.totalPages ? "opacity-40 cursor-not-allowed" : "hover:bg-line-soft")}>
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>
      )}

      {showRecord && (
        <RecordEntryModal
          onClose={() => setShowRecord(false)}
          onSuccess={(msg) => addToast(msg)}
        />
      )}
      {showBalances && (
        <BalancesDrawer onClose={() => setShowBalances(false)} />
      )}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
