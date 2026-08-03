import { useState } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X, FileText, AlertCircle, Info } from "lucide-react";
import { cn } from "@/lib/cn";
import { companiesService, pkr } from "@/services/companies";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { Button } from "@/components/ui/Button";

const inputCls = "h-10 w-full rounded-xl bg-mist border border-line px-3 text-[13.5px] text-ink outline-none focus:border-coral focus:ring-2 focus:ring-coral/15 transition-all";
const labelCls = "block text-[11px] font-bold uppercase tracking-wider text-ink-faint mb-1.5";

/** First and last day of the month containing `ref`, as YYYY-MM-DD. */
function monthBounds(ref: Date): { start: string; end: string } {
  const start = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), 1));
  const end   = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth() + 1, 0));
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

export interface CreateInvoiceModalProps {
  companyId: string;
  companyName: string;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

/**
 * Consolidated monthly invoice. Defaults to last month, which is when hotels
 * actually bill agencies — the month has to finish before you can invoice it.
 */
export function CreateInvoiceModal({ companyId, companyName, onClose, onSuccess }: CreateInvoiceModalProps) {
  useEscapeKey(onClose);
  const qc = useQueryClient();

  const lastMonth = new Date();
  lastMonth.setUTCMonth(lastMonth.getUTCMonth() - 1);
  const defaults = monthBounds(lastMonth);

  const [periodStart, setStart] = useState(defaults.start);
  const [periodEnd, setEnd]     = useState(defaults.end);
  const [notes, setNotes]       = useState("");
  const [issue, setIssue]       = useState(true);

  const mutation = useMutation({
    mutationFn: () => companiesService.createInvoice(companyId, {
      periodStart, periodEnd,
      ...(notes.trim() ? { notes: notes.trim() } : {}),
      issue,
    }),
    onSuccess: (invoice) => {
      qc.invalidateQueries({ queryKey: ["company-invoices", companyId] });
      qc.invalidateQueries({ queryKey: ["company-ledger", companyId] });
      onSuccess(
        `Invoice ${invoice.invoiceNumber} created for ${pkr(invoice.totalAmount)} across ${invoice.lineCount} stay${invoice.lineCount === 1 ? "" : "s"}.`,
      );
      onClose();
    },
  });

  const errorMessage = mutation.error
    ? ((mutation.error as { response?: { data?: { error?: string } } })?.response?.data?.error
        ?? "Something went wrong. Please try again.")
    : null;

  const validRange = periodStart <= periodEnd;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-ink/40 p-4 backdrop-blur-sm anim-fade-in"
      onMouseDown={onClose}
    >
      <div
        className="flex max-h-[calc(100dvh-2rem)] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-paper shadow-xl anim-scale-in"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center gap-3 border-b border-line px-6 pb-5 pt-6">
          <div className="grid place-items-center h-10 w-10 rounded-xl bg-coral/10 shrink-0">
            <FileText size={18} className="text-coral" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="serif text-[20px] text-ink leading-tight">New invoice</h2>
            <p className="text-[12px] text-ink-mute mt-0.5 truncate">{companyName}</p>
          </div>
          <button
            onClick={onClose}
            className="grid place-items-center h-9 w-9 rounded-full hover:bg-mist text-ink-mute transition-colors -mr-1 -mt-1"
          >
            <X size={18} />
          </button>
        </div>

        <div className="scroll-area min-h-0 overflow-y-auto px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>From</label>
              <input type="date" value={periodStart} onChange={(e) => setStart(e.target.value)} className={cn(inputCls, "cursor-pointer")} />
            </div>
            <div>
              <label className={labelCls}>To</label>
              <input type="date" value={periodEnd} onChange={(e) => setEnd(e.target.value)} className={cn(inputCls, "cursor-pointer")} />
            </div>
          </div>

          <div className="flex items-start gap-2 rounded-xl bg-mist border border-line-soft px-3 py-2.5">
            <Info size={14} className="text-ink-mute shrink-0 mt-0.5" />
            <p className="text-[12.5px] text-ink-soft">
              Every stay billed to this company in that period is added as a line, unless it is
              already on an earlier invoice. Re-running a month will not bill anything twice.
            </p>
          </div>

          <div>
            <label className={labelCls}>Notes on the invoice</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="e.g. Payment by bank transfer to Meezan Bank a/c…"
              className={cn(inputCls, "h-auto py-2 resize-none")}
            />
          </div>

          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={issue}
              onChange={(e) => setIssue(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-coral cursor-pointer"
            />
            <span className="text-[13px] text-ink-soft">
              Issue immediately
              <span className="block text-[12px] text-ink-faint">
                Sets the due date from the company's payment terms. Leave unticked to keep it as a draft.
              </span>
            </span>
          </label>

          {!validRange && (
            <div className="flex items-start gap-2 rounded-xl bg-amber-soft border border-amber/30 px-3 py-2.5">
              <AlertCircle size={14} className="text-amber shrink-0 mt-0.5" />
              <p className="text-[12.5px] text-ink-soft">The start date must be on or before the end date.</p>
            </div>
          )}

          {errorMessage && (
            <div className="flex items-start gap-2 rounded-xl bg-clay/10 border border-clay/30 px-3 py-2.5">
              <AlertCircle size={14} className="text-clay shrink-0 mt-0.5" />
              <p className="text-[12.5px] text-ink-soft">{errorMessage}</p>
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2.5 border-t border-line px-6 py-4">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button disabled={!validRange || mutation.isPending} loading={mutation.isPending} onClick={() => mutation.mutate()}>
            Create invoice
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
