import { useState } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Building2, AlertCircle, Info } from "lucide-react";
import { cn } from "@/lib/cn";
import { companiesService, pkr, PAYMENT_TERMS_LABEL, type CompanyPickerOption } from "@/services/companies";
import { CompanyPicker } from "./CompanyPicker";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { bannerMessageFor } from "@/lib/formErrors";
import { Button } from "@/components/ui/Button";
import { RequiredMark } from "@/components/ui/RequiredMark";

const inputCls = "h-10 w-full rounded-xl bg-mist border border-line px-3 text-[13.5px] text-ink outline-none focus:border-coral focus:ring-2 focus:ring-coral/15 transition-all";
const labelCls = "block text-[11px] font-bold uppercase tracking-wider text-ink-faint mb-1.5";

export interface BillToCompanyModalProps {
  reservationId: string;
  /** Paisa. */
  balanceDue: number;
  /** Pre-selects the company already linked to the booking, if any. */
  defaultCompanyId?: string | null;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

/**
 * Moves an unpaid folio balance onto a company's credit account so the guest
 * can leave. This is the manual equivalent of what checkout does automatically
 * for a booking already marked "bill to company".
 */
export function BillToCompanyModal({
  reservationId, balanceDue, defaultCompanyId, onClose, onSuccess,
}: BillToCompanyModalProps) {
  useEscapeKey(onClose);
  const qc = useQueryClient();

  const [company, setCompany] = useState<CompanyPickerOption | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(defaultCompanyId ?? null);
  const [note, setNote] = useState("");
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  const availableCredit = company ? Math.max(0, company.creditLimit - company.balance) : 0;
  const noCredit  = company !== null && company.creditLimit === 0;
  const overLimit = company !== null && company.creditLimit > 0 && balanceDue > availableCredit;

  const mutation = useMutation({
    mutationFn: () => companiesService.transferFolio(reservationId, {
      companyId: companyId!,
      ...(note.trim() ? { note: note.trim() } : {}),
      idempotencyKey,
    }),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["folio", reservationId] });
      qc.invalidateQueries({ queryKey: ["reservation", reservationId] });
      qc.invalidateQueries({ queryKey: ["companies"] });
      onSuccess(
        `${pkr(result.entry.amount)} billed to ${company?.name ?? "the company"}. They now owe ${pkr(result.companyBalance)}.`,
      );
      onClose();
    },
  });

  const errorMessage = bannerMessageFor(mutation.error);

  const canSubmit = companyId !== null && !noCredit && !overLimit && !mutation.isPending;

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
            <Building2 size={18} className="text-coral" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="serif text-[20px] text-ink leading-tight">Bill to a company</h2>
            <p className="text-[12px] text-ink-mute mt-0.5">The guest can then check out unsettled</p>
          </div>
          <button
            onClick={onClose}
            className="grid place-items-center h-9 w-9 rounded-full hover:bg-mist text-ink-mute transition-colors -mr-1 -mt-1"
          >
            <X size={18} />
          </button>
        </div>

        <div className="scroll-area min-h-0 overflow-y-auto px-6 py-5 space-y-4">
          <div className="flex items-center justify-between rounded-xl bg-mist px-3.5 py-3">
            <span className="text-[13px] text-ink-mute">Amount to transfer</span>
            <span className="text-[15px] font-semibold text-ink tabular-nums">{pkr(balanceDue)}</span>
          </div>

          <div>
            <label className={labelCls}>Company<RequiredMark /></label>
            <CompanyPicker
              value={companyId}
              onChange={(c) => { setCompany(c); setCompanyId(c?.id ?? null); }}
            />
          </div>

          <div>
            <label className={labelCls}>Note</label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional — shown on their statement"
              className={inputCls}
            />
          </div>

          {company && !noCredit && !overLimit && (
            <div className="flex items-start gap-2 rounded-xl bg-mist border border-line-soft px-3 py-2.5">
              <Info size={14} className="text-ink-mute shrink-0 mt-0.5" />
              <p className="text-[12.5px] text-ink-soft">
                Due in {PAYMENT_TERMS_LABEL[company.paymentTerms].toLowerCase()}.
                They will have {pkr(availableCredit - balanceDue)} of credit left afterwards.
              </p>
            </div>
          )}

          {noCredit && (
            <div className="flex items-start gap-2 rounded-xl bg-amber-soft border border-amber/30 px-3 py-2.5">
              <AlertCircle size={14} className="text-amber shrink-0 mt-0.5" />
              <p className="text-[12.5px] text-ink-soft">
                {company!.name} has no credit limit set, so nothing can be billed to them.
                A manager needs to set a limit on the company's page first.
              </p>
            </div>
          )}

          {overLimit && (
            <div className="flex items-start gap-2 rounded-xl bg-clay/10 border border-clay/30 px-3 py-2.5">
              <AlertCircle size={14} className="text-clay shrink-0 mt-0.5" />
              <p className="text-[12.5px] text-ink-soft">
                This is {pkr(balanceDue - availableCredit)} more than {company!.name} has credit for.
                Take a part payment from the guest, or ask a manager to raise their limit.
              </p>
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
          <Button disabled={!canSubmit} loading={mutation.isPending} onClick={() => mutation.mutate()}>
            Bill {pkr(balanceDue)}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
