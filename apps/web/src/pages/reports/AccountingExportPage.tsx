import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Download, AlertTriangle, CheckCircle2, RotateCcw, Save, FileSpreadsheet } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  accountingService, SCOPE_LABEL, FORMAT_LABEL,
  type AccountMapping, type AccountScope, type ExportFormat, type Granularity,
} from "@/services/accounting";
import { Card } from "@/components/ui/Card";
import { DatePicker } from "@/components/ui/DatePicker";
import { ToastContainer } from "@/components/ui/ToastContainer";
import { useToast } from "@/hooks/useToast";
import { usePermissions } from "@/hooks/usePermissions";

function fmtMoney(paise: number): string {
  return (paise / 100).toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDate(iso: string): string {
  return new Intl.DateTimeFormat("en-PK", { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));
}
/** First and last day of the previous month — the period usually being closed. */
function lastMonthRange(): { from: string; to: string } {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const end   = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0));
  return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) };
}

const inputCls = "h-10 rounded-xl bg-mist border border-line px-3 text-[13.5px] text-ink outline-none focus:border-coral focus:ring-2 focus:ring-coral/15 transition-all";

const SCOPE_ORDER: AccountScope[] = ["SYSTEM", "FOLIO_ITEM_TYPE", "TAX_TYPE", "PAYMENT_METHOD", "EXPENSE_CATEGORY"];

export default function AccountingExportPage() {
  const qc = useQueryClient();
  const { toasts, addToast, removeToast } = useToast();
  const { has } = usePermissions();
  const canEditMappings = has("settings:update");

  const defaults = lastMonthRange();
  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);
  const [format, setFormat] = useState<ExportFormat>("GENERIC_CSV");
  const [granularity, setGranularity] = useState<Granularity>("DAILY_SUMMARY");
  const [showMappings, setShowMappings] = useState(false);
  const [draftMappings, setDraftMappings] = useState<AccountMapping[] | null>(null);

  const params = { from, to, format, granularity };

  const { data: preview, isFetching, isError, error } = useQuery({
    queryKey: ["accounting-preview", params],
    queryFn:  () => accountingService.preview(params),
    enabled:  Boolean(from && to && to >= from),
  });

  const { data: mappings = [] } = useQuery({
    queryKey: ["accounting-mappings"],
    queryFn:  accountingService.getMappings,
  });

  const { data: history = [] } = useQuery({
    queryKey: ["accounting-exports"],
    queryFn:  accountingService.listExports,
  });

  const downloadMutation = useMutation({
    mutationFn: () => accountingService.download(params),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["accounting-exports"] });
      qc.invalidateQueries({ queryKey: ["accounting-preview"] });
      addToast("Export downloaded and recorded.");
    },
    onError: () => addToast("Export failed. Check the preview for a balance problem."),
  });

  const saveMappings = useMutation({
    mutationFn: (rows: AccountMapping[]) =>
      accountingService.updateMappings(rows.map(({ scope, key, accountCode, accountName }) =>
        ({ scope, key, accountCode, accountName }))),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["accounting-mappings"] });
      qc.invalidateQueries({ queryKey: ["accounting-preview"] });
      setDraftMappings(null);
      addToast("Account mappings saved.");
    },
  });

  const resetMappings = useMutation({
    mutationFn: accountingService.resetMappings,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["accounting-mappings"] });
      qc.invalidateQueries({ queryKey: ["accounting-preview"] });
      setDraftMappings(null);
      addToast("Mappings reset to defaults.");
    },
  });

  const rows = draftMappings ?? mappings;
  const meta = preview?.meta;
  const alreadyExported = (meta?.priorExports.length ?? 0) > 0;

  function editMapping(id: string, patch: Partial<AccountMapping>) {
    setDraftMappings((rows ?? []).map((m) => (m.id === id ? { ...m, ...patch } : m)));
  }

  return (
    <div>
      <div className="mb-6">
        <div className="mb-1.5 text-[12px] font-bold uppercase tracking-[0.14em] text-coral">Reports</div>
        <h1 className="serif text-[34px] leading-[1.05] text-ink">Accounting Export</h1>
        <p className="mt-1.5 text-[15px] text-ink-mute">
          A double-entry journal for your accountant, on an accrual basis.
        </p>
      </div>

      {/* Controls */}
      <Card className="mb-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-ink-faint mb-1.5">From</label>
            <DatePicker value={from} onChange={setFrom} className="w-full" />
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-ink-faint mb-1.5">To</label>
            <DatePicker value={to} onChange={setTo} className="w-full" />
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-ink-faint mb-1.5">Format</label>
            <select value={format} onChange={(e) => setFormat(e.target.value as ExportFormat)} className={cn(inputCls, "w-full cursor-pointer")}>
              {(Object.keys(FORMAT_LABEL) as ExportFormat[]).map((f) => (
                <option key={f} value={f}>{FORMAT_LABEL[f]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-ink-faint mb-1.5">Detail</label>
            <select value={granularity} onChange={(e) => setGranularity(e.target.value as Granularity)} className={cn(inputCls, "w-full cursor-pointer")}>
              <option value="DAILY_SUMMARY">One line per account per day</option>
              <option value="TRANSACTION">Every transaction</option>
            </select>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            onClick={() => downloadMutation.mutate()}
            disabled={!meta?.balanced || meta.lineCount === 0 || downloadMutation.isPending}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-full bg-coral text-white text-[13.5px] font-semibold hover:bg-coral-dark shadow-pop transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download size={16} />
            {downloadMutation.isPending ? "Preparing…" : "Download"}
          </button>
          <button
            onClick={() => setShowMappings((v) => !v)}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-full border border-line text-ink-soft text-[13.5px] font-semibold hover:bg-mist transition-colors"
          >
            <FileSpreadsheet size={16} />
            {showMappings ? "Hide" : "Account mappings"}
          </button>
        </div>
      </Card>

      {/* Warnings and status */}
      {isError && (
        <div className="mb-5 rounded-xl2 border border-clay/30 bg-clay-soft px-4 py-3 text-[13.5px] text-clay">
          {(error as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Could not build the preview."}
        </div>
      )}

      {meta && !meta.balanced && (
        <div className="mb-5 rounded-xl2 border border-clay/30 bg-clay-soft px-4 py-3.5 flex items-start gap-3">
          <AlertTriangle size={18} className="text-clay shrink-0 mt-0.5" />
          <div>
            <p className="text-[13.5px] font-bold text-clay">This journal does not balance — download is blocked.</p>
            <p className="mt-0.5 text-[12.5px] text-ink-soft tnum">
              Debits {fmtMoney(meta.totalDebit)} vs credits {fmtMoney(meta.totalCredit)}. Check your account mappings.
            </p>
          </div>
        </div>
      )}

      {alreadyExported && (
        <div className="mb-5 rounded-xl2 border border-amber/30 bg-amber-soft px-4 py-3.5 flex items-start gap-3">
          <AlertTriangle size={18} className="text-amber shrink-0 mt-0.5" />
          <div>
            <p className="text-[13.5px] font-bold text-ink">This period has been exported before.</p>
            <p className="mt-0.5 text-[12.5px] text-ink-soft">
              Importing the same journal twice will double the revenue in your books. Only download
              again if the first file was not imported.
            </p>
            <ul className="mt-1.5 space-y-0.5">
              {meta!.priorExports.map((e) => (
                <li key={e.id} className="text-[12px] text-ink-mute tnum">
                  {e.format} · {fmtDate(e.periodStart)} → {fmtDate(e.periodEnd)} · {e.lineCount} lines · {fmtDate(e.createdAt)}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Preview */}
      <Card pad={false} className="mb-5 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-line-soft">
          <div>
            <h2 className="serif text-[19px] text-ink">Preview</h2>
            {meta && (
              <p className="mt-0.5 text-[12px] text-ink-mute">
                {meta.lineCount} journal line{meta.lineCount === 1 ? "" : "s"} · accrual basis
              </p>
            )}
          </div>
          {meta && (
            <span className={cn(
              "inline-flex items-center gap-1.5 text-[12.5px] font-bold",
              meta.balanced ? "text-pine-deep" : "text-clay",
            )}>
              {meta.balanced ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
              {meta.balanced ? "Balanced" : "Not balanced"}
            </span>
          )}
        </div>

        {isFetching ? (
          <div className="px-5 py-6 space-y-2.5">
            {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-6 bg-line-soft rounded animate-pulse" />)}
          </div>
        ) : !preview || preview.data.length === 0 ? (
          <div className="px-5 py-10 text-center text-[13.5px] text-ink-mute">
            No accounting activity in this period.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-[11px] font-bold uppercase tracking-wider text-ink-faint border-b border-line-soft">
                  <th className="text-left px-5 py-2.5">Code</th>
                  <th className="text-left px-3 py-2.5">Account</th>
                  <th className="text-right px-3 py-2.5">Debit</th>
                  <th className="text-right px-5 py-2.5">Credit</th>
                </tr>
              </thead>
              <tbody>
                {preview.data.map((row) => (
                  <tr key={row.accountCode} className="border-b border-line-soft last:border-0">
                    <td className="px-5 py-2.5 tnum text-ink-soft">{row.accountCode}</td>
                    <td className="px-3 py-2.5 text-ink">{row.accountName}</td>
                    <td className="px-3 py-2.5 text-right tnum text-ink-soft">{row.debit ? fmtMoney(row.debit) : "—"}</td>
                    <td className="px-5 py-2.5 text-right tnum text-ink-soft">{row.credit ? fmtMoney(row.credit) : "—"}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-mist font-bold text-ink">
                  <td className="px-5 py-3" colSpan={2}>Total</td>
                  <td className="px-3 py-3 text-right tnum">{fmtMoney(meta?.totalDebit ?? 0)}</td>
                  <td className="px-5 py-3 text-right tnum">{fmtMoney(meta?.totalCredit ?? 0)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>

      {/* Mappings */}
      {showMappings && (
        <Card className="mb-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="serif text-[19px] text-ink">Account mappings</h2>
              <p className="mt-0.5 text-[12.5px] text-ink-mute">
                Match each PMS concept to a code in your own chart of accounts.
              </p>
            </div>
            {canEditMappings && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => resetMappings.mutate()}
                  disabled={resetMappings.isPending}
                  className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full border border-line text-ink-mute text-[13px] font-semibold hover:bg-mist transition-colors disabled:opacity-40"
                >
                  <RotateCcw size={14} /> Reset
                </button>
                <button
                  onClick={() => draftMappings && saveMappings.mutate(draftMappings)}
                  disabled={!draftMappings || saveMappings.isPending}
                  className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full bg-ink text-white text-[13px] font-semibold hover:bg-ink/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Save size={14} /> {saveMappings.isPending ? "Saving…" : "Save"}
                </button>
              </div>
            )}
          </div>

          <div className="space-y-5">
            {SCOPE_ORDER.map((scope) => {
              const scoped = rows.filter((m) => m.scope === scope);
              if (scoped.length === 0) return null;
              return (
                <div key={scope}>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-ink-faint mb-2">{SCOPE_LABEL[scope]}</p>
                  <div className="space-y-1.5">
                    {scoped.map((m) => (
                      <div key={m.id} className="grid grid-cols-[1fr_100px_1.4fr] gap-2 items-center">
                        <span className="text-[12.5px] text-ink-soft truncate" title={m.key}>
                          {m.key.replace(/_/g, " ").toLowerCase()}
                        </span>
                        <input
                          value={m.accountCode}
                          onChange={(e) => editMapping(m.id, { accountCode: e.target.value })}
                          disabled={!canEditMappings}
                          className={cn(inputCls, "w-full h-9 tnum disabled:opacity-60")}
                        />
                        <input
                          value={m.accountName}
                          onChange={(e) => editMapping(m.id, { accountName: e.target.value })}
                          disabled={!canEditMappings}
                          className={cn(inputCls, "w-full h-9 disabled:opacity-60")}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <p className="mt-4 text-[12px] text-ink-faint">
            For Tally, the account name must match the ledger name in your company exactly, or the
            import will create a new ledger.
          </p>
        </Card>
      )}

      {/* History */}
      {history.length > 0 && (
        <Card pad={false} className="overflow-hidden">
          <div className="px-5 py-4 border-b border-line-soft">
            <h2 className="serif text-[19px] text-ink">Previous exports</h2>
          </div>
          <div className="divide-y divide-line-soft">
            {history.slice(0, 10).map((e) => (
              <div key={e.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-[13px]">
                <span className="font-semibold text-ink tnum">
                  {fmtDate(e.periodStart)} → {fmtDate(e.periodEnd)}
                </span>
                <span className="text-ink-mute">{e.format === "TALLY_XML" ? "Tally XML" : "Journal CSV"}</span>
                <span className="text-ink-faint tnum">{e.lineCount} lines</span>
                <span className="ml-auto text-ink-mute tnum">{fmtMoney(e.totalDebit)}</span>
                <span className="text-ink-faint tnum">{fmtDate(e.createdAt)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
