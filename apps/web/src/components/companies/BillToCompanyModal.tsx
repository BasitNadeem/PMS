import { useState } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { X, Building2, AlertCircle, Info, ArrowRight, Landmark } from "lucide-react";
import { cn } from "@/lib/cn";
import { companiesService, pkr, PAYMENT_TERMS_LABEL, type CompanyPickerOption } from "@/services/companies";
import { CompanyPicker } from "./CompanyPicker";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { bannerMessageFor } from "@/lib/formErrors";
import { Button } from "@/components/ui/Button";
import { RequiredMark } from "@/components/ui/RequiredMark";

const inputCls = "h-12 w-full rounded-xl bg-card border border-line px-4 text-[14px] text-ink outline-none focus:border-coral focus:ring-2 focus:ring-coral/15 transition-all";
const labelCls = "block text-[11px] font-bold uppercase tracking-wider text-ink-faint mb-1.5";

export interface BillToCompanyModalProps {
  reservationId: string;
  /** Paisa. */
  balanceDue: number;
  /** Pre-selects the company already linked to the booking, if any. */
  defaultCompanyId?: string | null;
  /** Item-level BTC is already assigned to this company and cannot be changed here. */
  assignedCompanyId?: string | null;
  mode?: "FULL_FOLIO" | "BTC";
  onClose: () => void;
  onSuccess: (message: string) => void;
}

/**
 * Moves an unpaid folio balance onto a company's credit account so the guest
 * can leave. This is the manual equivalent of what checkout does automatically
 * for a booking already marked "bill to company".
 */
export function BillToCompanyModal({
  reservationId, balanceDue, defaultCompanyId, assignedCompanyId, mode = "FULL_FOLIO", onClose, onSuccess,
}: BillToCompanyModalProps) {
  useEscapeKey(onClose);
  const qc = useQueryClient();

  const [company, setCompany] = useState<CompanyPickerOption | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(assignedCompanyId ?? defaultCompanyId ?? null);
  const [note, setNote] = useState("");
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  const companyToLoadId = assignedCompanyId ?? (company ? null : defaultCompanyId);
  const { data: assignedCompany } = useQuery({
    queryKey: ["company", companyToLoadId],
    queryFn: () => companiesService.get(companyToLoadId!),
    enabled: Boolean(companyToLoadId),
  });
  const effectiveCompany = company ?? assignedCompany ?? null;
  const availableCredit = effectiveCompany ? Math.max(0, effectiveCompany.creditLimit - effectiveCompany.balance) : 0;
  const noCredit  = effectiveCompany !== null && effectiveCompany.creditLimit === 0;
  const overLimit = effectiveCompany !== null && effectiveCompany.creditLimit > 0 && balanceDue > availableCredit;

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
        `${pkr(result.entry.amount)} billed to ${effectiveCompany?.name ?? "the company"}. They now owe ${pkr(result.companyBalance)}.`,
      );
      onClose();
    },
  });

  const errorMessage = bannerMessageFor(mutation.error);

  const canSubmit = companyId !== null && !noCredit && !overLimit && !mutation.isPending;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-ink/45 p-4 backdrop-blur-sm anim-fade-in"
      onMouseDown={onClose}
    >
      <div
        className="flex max-h-[calc(100dvh-2rem)] w-full max-w-[650px] flex-col overflow-visible rounded-[24px] border border-white/50 bg-paper shadow-[0_28px_80px_rgba(31,27,23,0.24)] sm:min-h-[620px] anim-scale-in"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start gap-4 px-8 pb-6 pt-7">
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-coral text-white shadow-sm">
            <Building2 size={23} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-coral-dark">Company credit</div>
            <h2 className="serif text-[28px] text-ink leading-tight">
              {mode === "BTC" ? "Transfer BTC balance" : "Bill to a company (BTC)"}
            </h2>
            <p className="mt-1.5 text-[13px] leading-snug text-ink-mute">
              {mode === "BTC" ? "Moves only company-assigned charges to its ledger" : "Moves the unpaid folio to company credit"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="-mr-1 -mt-1 grid h-9 w-9 place-items-center rounded-full text-ink-mute transition-colors hover:bg-mist hover:text-ink"
          >
            <X size={18} />
          </button>
        </div>

        <div className="relative z-20 min-h-0 flex-1 space-y-6 overflow-y-visible border-t border-line-soft px-8 py-7">
          <div className="flex items-center justify-between rounded-2xl border border-coral/15 bg-gradient-to-br from-coral-soft/75 to-paper px-5 py-5">
            <div>
              <div className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-coral-dark">BTC amount</div>
              <div className="mt-1 text-[12.5px] text-ink-mute">Moves from this folio to company ledger</div>
            </div>
            <div className="serif text-[31px] leading-none text-ink tabular-nums">{pkr(balanceDue)}</div>
          </div>

          <div>
            <label className={labelCls}>Company<RequiredMark /></label>
            {assignedCompanyId ? (
              <div className="flex h-12 items-center gap-2 rounded-xl border border-line bg-mist px-4 text-[14px] font-semibold text-ink">
                <Building2 size={15} className="shrink-0 text-ink-mute" />
                {effectiveCompany?.name ?? "Loading assigned company…"}
              </div>
            ) : (
              <CompanyPicker
                value={companyId}
                onChange={(c) => { setCompany(c); setCompanyId(c?.id ?? null); }}
                placeholder="Choose the company taking this balance"
                allowNullOption={false}
              />
            )}
          </div>

          <div>
            <label className={labelCls}>Statement note <span className="normal-case tracking-normal text-ink-faint">— optional</span></label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="For example: Room and breakfast charges"
              className={inputCls}
            />
          </div>

          {effectiveCompany && !noCredit && !overLimit && (
            <div className="flex items-start gap-2 rounded-xl bg-mist border border-line-soft px-3 py-2.5">
              <Info size={14} className="text-ink-mute shrink-0 mt-0.5" />
              <p className="text-[12.5px] text-ink-soft">
                Due in {PAYMENT_TERMS_LABEL[effectiveCompany.paymentTerms].toLowerCase()}.
                They will have {pkr(availableCredit - balanceDue)} of credit left afterwards.
              </p>
            </div>
          )}

          {noCredit && (
            <div className="flex items-start gap-2 rounded-xl bg-amber-soft border border-amber/30 px-3 py-2.5">
              <AlertCircle size={14} className="text-amber shrink-0 mt-0.5" />
              <p className="text-[12.5px] text-ink-soft">
                {effectiveCompany!.name} has no credit limit set, so nothing can be billed to them.
                A manager needs to set a limit on the company's page first.
              </p>
            </div>
          )}

          {overLimit && (
            <div className="flex items-start gap-2 rounded-xl bg-clay/10 border border-clay/30 px-3 py-2.5">
              <AlertCircle size={14} className="text-clay shrink-0 mt-0.5" />
              <p className="text-[12.5px] text-ink-soft">
                This is {pkr(balanceDue - availableCredit)} more than {effectiveCompany!.name} has credit for.
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

        <div className="relative z-10 flex shrink-0 items-center gap-3 rounded-b-[24px] border-t border-line bg-mist/45 px-8 py-5">
          <Button variant="ghost" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button className="flex-[1.7]" disabled={!canSubmit} loading={mutation.isPending} onClick={() => mutation.mutate()}>
            <Landmark size={15} />
            {mode === "BTC" ? "Transfer BTC" : "Bill company"}
            <ArrowRight size={15} />
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
