import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  TrendingDown, Plus, Pencil, Trash2, ChevronLeft, ChevronRight, Paperclip,
} from "lucide-react";
import { cn } from "@/lib/cn";
import {
  expensesService,
  EXPENSE_CATEGORIES,
  CATEGORY_LABELS,
  CATEGORY_STYLE,
  PAYMENT_METHOD_LABELS,
  type Expense,
  type ExpenseCategory,
} from "@/services/expenses";
import { ExpenseModal } from "@/components/expenses/ExpenseModal";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/hooks/useToast";
import { ToastContainer } from "@/components/ui/ToastContainer";
import { usePermissions } from "@/hooks/usePermissions";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { DatePicker } from "@/components/ui/DatePicker";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatPKR(paisas: number): string {
  const r = Math.floor(paisas / 100);
  return `PKR ${r.toLocaleString("en-PK")}`;
}

function fmtDate(iso: string): string {
  return new Intl.DateTimeFormat("en-PK", { day: "2-digit", month: "short", year: "numeric" })
    .format(new Date(iso));
}

function firstOfMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function lastOfMonth(): string {
  const d = new Date();
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, "0")}-${String(last.getDate()).padStart(2, "0")}`;
}


// ── Category bar chart ────────────────────────────────────────────────────────

function CategoryBars({ data }: { data: { category: string; total: number }[] }) {
  if (data.length === 0) return null;
  const max = Math.max(...data.map((d) => d.total), 1);
  const top = data.slice(0, 5);

  return (
    <div className="space-y-3">
      {top.map((item, i) => {
        const cat    = item.category as ExpenseCategory;
        const style  = CATEGORY_STYLE[cat] ?? { bg: "bg-line-soft", text: "text-ink-mute" };
        const pct    = Math.max(4, Math.round((item.total / max) * 100));
        const opacities = ["opacity-100", "opacity-85", "opacity-70", "opacity-55", "opacity-40"];
        return (
          <div key={cat} className="flex items-center gap-3">
            <span className="text-[12px] font-semibold text-ink-soft w-28 shrink-0 truncate">
              {CATEGORY_LABELS[cat] ?? cat}
            </span>
            <div className="flex-1 h-5 rounded-full bg-line-soft overflow-hidden">
              <div
                className={cn("h-full rounded-full bg-coral transition-all duration-700", opacities[i])}
                style={{ width: pct + "%" }}
              />
            </div>
            <span className="text-[12px] font-semibold text-ink-soft w-28 text-right shrink-0 tnum">
              {formatPKR(item.total)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Summary card ──────────────────────────────────────────────────────────────

function SummaryCard({ icon: Icon, bg, fg, label, value, sub }: {
  icon: React.ElementType; bg: string; fg: string;
  label: string; value: string; sub?: string;
}) {
  return (
    <Card className="anim-fade-up !p-4" hover>
      <div className="grid place-items-center h-10 w-10 rounded-xl mb-4" style={{ background: bg, color: fg }}>
        <Icon size={20} />
      </div>
      <div className="serif text-[28px] leading-none text-ink tnum">{value}</div>
      <div className="mt-1.5 text-[13px] font-semibold text-ink-soft">{label}</div>
      {sub && <div className="text-[12px] text-ink-mute">{sub}</div>}
    </Card>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ExpensesPage() {
  const qc = useQueryClient();
  useRealtimeSync();
  const { toasts, addToast, removeToast } = useToast();
  const { has } = usePermissions();

  // Filters
  const [startDate,   setStartDate]   = useState(firstOfMonth());
  const [endDate,     setEndDate]     = useState(lastOfMonth());
  const [filterCat,   setFilterCat]   = useState("");
  const [appliedStart, setAppliedStart] = useState(firstOfMonth());
  const [appliedEnd,   setAppliedEnd]   = useState(lastOfMonth());
  const [appliedCat,   setAppliedCat]   = useState("");
  const [page,        setPage]        = useState(1);

  // Modals
  const [showAdd,     setShowAdd]     = useState(false);
  const [editExpense, setEditExpense] = useState<Expense | null>(null);
  const [deleteId,    setDeleteId]    = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["expenses", { category: appliedCat, startDate: appliedStart, endDate: appliedEnd, page }],
    queryFn: () => expensesService.getExpenses({
      category:  appliedCat  || undefined,
      startDate: appliedStart,
      endDate:   appliedEnd,
      page,
      limit: 20,
    }),
    refetchInterval: 60_000,
  });

  const { data: summary } = useQuery({
    queryKey: ["expenses-summary", appliedStart, appliedEnd],
    queryFn: () => expensesService.getExpenseSummary(appliedStart, appliedEnd),
    staleTime: 60_000,
    refetchInterval: 60_000,
  });

  const deleteMutation = useMutation({
    mutationFn: expensesService.deleteExpense,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["expenses-summary"] });
      setDeleteId(null);
      addToast("Expense deleted");
    },
    onError: () => addToast("Failed to delete expense", "error"),
  });

  function applyFilters() {
    setAppliedStart(startDate);
    setAppliedEnd(endDate);
    setAppliedCat(filterCat);
    setPage(1);
  }

  function resetFilters() {
    const s = firstOfMonth();
    const e = lastOfMonth();
    setStartDate(s); setEndDate(e); setFilterCat("");
    setAppliedStart(s); setAppliedEnd(e); setAppliedCat("");
    setPage(1);
  }

  const expenses    = data?.data ?? [];
  const meta        = data?.meta;
  const totalPages  = meta?.totalPages ?? 1;
  const totalAmount = summary?.totalAmount ?? 0;
  const byCategory  = summary?.byCategory ?? [];
  const topCat      = byCategory[0];
  const txCount     = meta?.total ?? 0;

  const inputCls = "h-9 rounded-xl border border-line bg-mist px-3 text-[13px] text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-coral/20 focus:border-coral/40 transition-colors";

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <div className="mb-1.5 text-[12px] font-bold uppercase tracking-[0.14em] text-coral">Finance</div>
          <h1 className="serif text-[34px] leading-[1.05] text-ink">Expenses</h1>
          <p className="mt-1.5 text-[15px] text-ink-mute">Track operational costs</p>
        </div>
        {has("expenses:create") && (
          <button
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-full bg-coral text-white text-sm font-semibold hover:bg-coral-dark transition-colors shadow-pop"
          >
            <Plus size={16} /> Add Expense
          </button>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <SummaryCard
          icon={TrendingDown} bg="#F8E7E1" fg="#BB4A33"
          label="Total Expenses" value={formatPKR(totalAmount)}
          sub={`${appliedStart} – ${appliedEnd}`}
        />
        <SummaryCard
          icon={TrendingDown} bg="#F1ECE4" fg="#938C81"
          label="Transactions" value={String(txCount)}
          sub="expense records"
        />
        <SummaryCard
          icon={TrendingDown} bg="#F8EFDA" fg="#86600F"
          label="Largest Category"
          value={topCat ? (CATEGORY_LABELS[topCat.category as ExpenseCategory] ?? topCat.category) : "—"}
          sub={topCat ? formatPKR(topCat.total) : "No data"}
        />
        <SummaryCard
          icon={TrendingDown} bg="#E7EEF3" fg="#2c455c"
          label="Avg per Expense"
          value={txCount > 0 ? formatPKR(Math.round(totalAmount / txCount)) : "—"}
          sub="this period"
        />
      </div>

      {/* Filters */}
      <Card className="mb-5 anim-fade-up" pad={false}>
        <div className="flex flex-wrap items-end gap-3 px-5 py-4">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wide text-ink-faint mb-1">From</label>
            <DatePicker value={startDate} onChange={setStartDate} className="h-9" />
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wide text-ink-faint mb-1">To</label>
            <DatePicker value={endDate} onChange={setEndDate} className="h-9" />
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wide text-ink-faint mb-1">Category</label>
            <select value={filterCat} onChange={(e) => setFilterCat(e.target.value)} className={cn(inputCls, "cursor-pointer pr-2 min-w-[140px]")}>
              <option value="">All Categories</option>
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
              ))}
            </select>
          </div>
          <button
            onClick={applyFilters}
            className="h-9 px-4 rounded-full bg-coral text-white text-[13px] font-semibold hover:bg-coral-dark transition-colors shadow-pop"
          >
            Apply
          </button>
          <button
            onClick={resetFilters}
            className="h-9 px-4 rounded-full border border-line text-ink-soft text-[13px] font-semibold hover:bg-mist transition-colors"
          >
            Reset
          </button>
        </div>
      </Card>

      {/* Category breakdown bars */}
      {byCategory.length > 0 && (
        <Card className="mb-5 anim-fade-up">
          <h3 className="text-[13px] font-bold uppercase tracking-wider text-ink-faint mb-4">Breakdown by Category</h3>
          <CategoryBars data={byCategory} />
        </Card>
      )}

      {/* Expenses table */}
      <Card pad={false} className="anim-fade-up overflow-hidden">
        {/* Headers */}
        <div className="hidden md:grid grid-cols-[1fr_1fr_2fr_1fr_1fr_1fr_auto] gap-3 px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-ink-faint border-b border-line-soft">
          <span>Date</span>
          <span>Category</span>
          <span>Description</span>
          <span>Paid To</span>
          <span>Method</span>
          <span className="text-right">Amount</span>
          <span />
        </div>

        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-3.5 border-b border-line-soft animate-pulse">
              <div className="h-3 bg-line-soft rounded w-20" />
              <div className="h-5 bg-line-soft rounded-full w-24" />
              <div className="flex-1 h-3 bg-line-soft rounded" />
              <div className="h-3 bg-line-soft rounded w-16" />
              <div className="h-3 bg-line-soft rounded w-14 ml-auto" />
            </div>
          ))
        ) : expenses.length === 0 ? (
          <div className="flex flex-col items-center py-16 gap-3">
            <div className="grid place-items-center h-14 w-14 rounded-2xl bg-coral-soft text-coral mb-1">
              <TrendingDown size={26} />
            </div>
            <p className="text-base font-semibold text-ink-soft">No expenses recorded</p>
            <p className="text-[13px] text-ink-mute">Track your hotel's operational costs</p>
            {has("expenses:create") && (
              <button
                onClick={() => setShowAdd(true)}
                className="mt-1 inline-flex items-center gap-2 h-9 px-4 rounded-full bg-coral text-white text-[13px] font-semibold hover:bg-coral-dark transition-colors shadow-pop"
              >
                <Plus size={14} /> Add Expense
              </button>
            )}
          </div>
        ) : (
          <>
            {expenses.map((exp) => {
              const cat   = exp.category as ExpenseCategory;
              const style = CATEGORY_STYLE[cat] ?? { bg: "bg-line-soft", text: "text-ink-mute" };
              const isDeleting = deleteId === exp.id;
              return (
                <div
                  key={exp.id}
                  className="grid grid-cols-2 md:grid-cols-[1fr_1fr_2fr_1fr_1fr_1fr_auto] gap-3 px-5 py-3 items-center border-b border-line-soft last:border-0 hover:bg-mist transition-colors"
                >
                  <span className="text-[13px] text-ink-soft tnum">{fmtDate(exp.date)}</span>
                  <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold w-fit", style.bg, style.text)}>
                    {CATEGORY_LABELS[cat] ?? cat}
                  </span>
                  <div className="hidden md:block min-w-0">
                    <p className="text-[13.5px] font-medium text-ink truncate">{exp.description}</p>
                  </div>
                  <span className="text-[13px] text-ink-soft truncate hidden md:block">{exp.paid_to}</span>
                  <span className="text-[12px] text-ink-faint hidden md:block">
                    {PAYMENT_METHOD_LABELS[exp.payment_method] ?? exp.payment_method}
                  </span>
                  <span className="text-[14px] font-semibold text-clay text-right tnum hidden md:block">
                    {formatPKR(exp.amount)}
                  </span>
                  <div className="flex items-center justify-end gap-1.5">
                    {isDeleting ? (
                      <div className="flex items-center gap-2 text-[12px]">
                        <span className="text-ink-mute">Delete?</span>
                        <button
                          onClick={() => deleteMutation.mutate(exp.id)}
                          disabled={deleteMutation.isPending}
                          className="font-semibold text-clay hover:text-clay-deep transition-colors disabled:opacity-40"
                        >
                          Yes
                        </button>
                        <button onClick={() => setDeleteId(null)} className="font-semibold text-ink-mute hover:text-ink-soft transition-colors">
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <>
                        {exp.attachment_url && (
                          <a
                            href={exp.attachment_url}
                            target="_blank"
                            rel="noreferrer"
                            title="View receipt"
                            className="grid place-items-center h-7 w-7 rounded-lg text-ink-faint hover:text-pine hover:bg-pine/10 transition-colors"
                          >
                            <Paperclip size={14} />
                          </a>
                        )}
                        {has("expenses:update") && (
                          <button
                            onClick={() => setEditExpense(exp)}
                            className="grid place-items-center h-7 w-7 rounded-lg text-ink-faint hover:text-ink-soft hover:bg-mist transition-colors"
                          >
                            <Pencil size={14} />
                          </button>
                        )}
                        {has("expenses:delete") && (
                          <button
                            onClick={() => setDeleteId(exp.id)}
                            className="grid place-items-center h-7 w-7 rounded-lg text-ink-faint hover:text-clay hover:bg-clay-soft transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Total row */}
            {expenses.length > 0 && (
              <div className="grid grid-cols-[1fr_1fr_2fr_1fr_1fr_1fr_auto] gap-3 px-5 py-3 border-t border-line bg-mist">
                <span className="text-[12px] font-bold uppercase tracking-wider text-ink-mute col-span-5">
                  Total ({meta?.total ?? 0} expenses)
                </span>
                <span className="text-[14px] font-bold text-clay text-right tnum">
                  {formatPKR(totalAmount)}
                </span>
                <span />
              </div>
            )}
          </>
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

      {/* Modals */}
      {showAdd && (
        <ExpenseModal
          mode="add"
          onClose={() => setShowAdd(false)}
          onSuccess={(msg) => addToast(msg)}
        />
      )}
      {editExpense && (
        <ExpenseModal
          mode="edit"
          expense={editExpense}
          onClose={() => setEditExpense(null)}
          onSuccess={(msg) => addToast(msg)}
        />
      )}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
