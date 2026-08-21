import { useState } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Building2, UserRound, X, AlertCircle, Check, ArrowRight } from "lucide-react";
import { folioService, type FolioLineItem } from "@/services/folio";
import { CompanyPicker } from "@/components/companies/CompanyPicker";
import type { CompanyPickerOption } from "@/services/companies";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { bannerMessageFor } from "@/lib/formErrors";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";
import { RequiredMark } from "@/components/ui/RequiredMark";

interface AllocatePayerModalProps {
  reservationId: string;
  items: FolioLineItem[];
  defaultCompanyId?: string | null;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

function signedAmount(item: FolioLineItem): number {
  return item.type === "DISCOUNT" ? -item.amount : item.amount;
}

function pkr(paise: number): string {
  const prefix = paise < 0 ? "−" : "";
  return `${prefix}PKR ${(Math.abs(paise) / 100).toLocaleString("en-PK")}`;
}

export function AllocatePayerModal({
  reservationId,
  items,
  defaultCompanyId,
  onClose,
  onSuccess,
}: AllocatePayerModalProps) {
  useEscapeKey(onClose);
  const qc = useQueryClient();
  const existingCompany = items.find((item) => item.payerType === "COMPANY");
  const allCompany = items.every((item) => item.payerType === "COMPANY");
  const [payerType, setPayerType] = useState<"GUEST" | "COMPANY">(allCompany ? "COMPANY" : "GUEST");
  const [companyId, setCompanyId] = useState<string | null>(
    existingCompany?.payerCompanyId ?? defaultCompanyId ?? null,
  );
  const [company, setCompany] = useState<CompanyPickerOption | null>(null);
  const [reason, setReason] = useState("");
  const total = items.reduce((sum, item) => sum + signedAmount(item), 0);

  const mutation = useMutation({
    mutationFn: () => folioService.allocatePayer(reservationId, {
      itemIds: items.map((item) => item.id),
      payerType,
      ...(payerType === "COMPANY" ? { companyId } : {}),
      reason: reason.trim(),
    }),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["folio", reservationId] });
      qc.invalidateQueries({ queryKey: ["billing-folios"] });
      qc.invalidateQueries({ queryKey: ["billing-summary"] });
      const payer = result.payerType === "GUEST"
        ? "Guest"
        : `Bill to company (BTC) · ${result.companyName ?? company?.name ?? "Company"}`;
      onSuccess(`${result.updatedCount} charge${result.updatedCount === 1 ? "" : "s"} assigned to ${payer}.`);
      onClose();
    },
  });

  const trimmedReason = reason.trim();
  const hasValidReason = trimmedReason.length >= 3;
  const canSubmit = hasValidReason
    && (payerType === "GUEST" || companyId !== null)
    && !mutation.isPending;
  const errorMessage = bannerMessageFor(mutation.error);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-ink/45 p-4 backdrop-blur-sm anim-fade-in"
      onMouseDown={onClose}
    >
      <div
        className="flex max-h-[calc(100dvh-2rem)] w-full max-w-[680px] flex-col overflow-hidden rounded-[24px] border border-white/50 bg-paper shadow-[0_28px_80px_rgba(31,27,23,0.24)] sm:min-h-[650px] sm:overflow-visible anim-scale-in"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex shrink-0 items-start gap-4 px-8 pb-6 pt-7">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-coral text-white shadow-sm">
            <Building2 size={21} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-coral-dark">Payment responsibility</div>
            <h2 className="serif text-[26px] leading-tight text-ink">Who pays these charges?</h2>
            <p className="mt-1 text-[12.5px] text-ink-mute">
              {items.length} selected charge{items.length === 1 ? "" : "s"} · {pkr(total)}
            </p>
          </div>
          <button onClick={onClose} className="-mr-1 -mt-1 grid h-9 w-9 place-items-center rounded-full text-ink-mute transition-colors hover:bg-mist hover:text-ink">
            <X size={18} />
          </button>
        </div>

        <div className="relative z-20 min-h-0 flex-1 space-y-6 overflow-y-auto border-t border-line-soft px-8 py-6 sm:overflow-visible">
          <div>
            <div className="mb-2.5 text-[11px] font-bold uppercase tracking-wider text-ink-faint">Who pays these charges?</div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setPayerType("GUEST")}
                className={cn(
                  "relative min-h-[116px] rounded-2xl border p-5 text-left transition-all",
                  payerType === "GUEST" ? "border-dusk bg-dusk-soft/70 shadow-sm ring-1 ring-dusk/10" : "border-line bg-card hover:border-ink-faint",
                )}
              >
                <UserRound size={18} className={payerType === "GUEST" ? "text-dusk" : "text-ink-mute"} />
                <div className="mt-3 text-[15px] font-bold text-ink">Guest</div>
                <div className="mt-1 text-[12px] leading-snug text-ink-mute">Guest settles these charges on the folio.</div>
                {payerType === "GUEST" && <Check size={15} className="absolute right-3 top-3 text-dusk" />}
              </button>
              <button
                type="button"
                onClick={() => setPayerType("COMPANY")}
                className={cn(
                  "relative min-h-[116px] rounded-2xl border p-5 text-left transition-all",
                  payerType === "COMPANY" ? "border-coral bg-coral-soft/60 shadow-sm ring-1 ring-coral/10" : "border-line bg-card hover:border-ink-faint",
                )}
              >
                <Building2 size={18} className={payerType === "COMPANY" ? "text-coral" : "text-ink-mute"} />
                <div className="mt-3 text-[15px] font-bold text-ink">Company (BTC)</div>
                <div className="mt-1 text-[12px] leading-snug text-ink-mute">Move these charges to a company account.</div>
                {payerType === "COMPANY" && <Check size={15} className="absolute right-3 top-3 text-coral" />}
              </button>
            </div>
          </div>

          {payerType === "COMPANY" && (
            <div>
              <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-ink-faint">
                Company<RequiredMark />
              </label>
              <CompanyPicker
                value={companyId}
                onChange={(selected) => {
                  setCompany(selected);
                  setCompanyId(selected?.id ?? null);
                }}
                placeholder="Choose the company taking these charges"
                allowNullOption={false}
              />
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-ink-faint">
              Internal reason<RequiredMark />
            </label>
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
              placeholder="For example: Room and tax covered under company agreement"
              className="w-full resize-none rounded-xl border border-line bg-card px-3.5 py-3 text-[13.5px] text-ink outline-none transition-all focus:border-coral focus:ring-2 focus:ring-coral/15"
            />
            <div className="mt-1.5 flex items-start justify-between gap-3 text-[11.5px]">
              <p className={cn(
                "leading-snug",
                reason.length > 0 && !hasValidReason ? "font-semibold text-clay" : "text-ink-faint",
              )}>
                {reason.length > 0 && !hasValidReason
                  ? "Enter at least 3 characters."
                  : "Kept in the audit trail; not printed as a guest-facing note."}
              </p>
              <span className={cn(
                "shrink-0 tabular-nums",
                reason.length > 0 && !hasValidReason ? "text-clay" : "text-ink-faint",
              )}>
                {trimmedReason.length}/3 minimum
              </span>
            </div>
          </div>

          {errorMessage && (
            <div className="flex items-start gap-2 rounded-xl border border-clay/30 bg-clay/10 px-3 py-2.5">
              <AlertCircle size={14} className="mt-0.5 shrink-0 text-clay" />
              <p className="text-[12.5px] text-ink-soft">{errorMessage}</p>
            </div>
          )}
        </div>

        <div className="relative z-10 flex shrink-0 items-center gap-3 rounded-b-[24px] border-t border-line bg-mist/45 px-8 py-5">
          <Button variant="ghost" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button className="flex-[1.7]" disabled={!canSubmit} loading={mutation.isPending} onClick={() => mutation.mutate()}>
            Save as {payerType === "GUEST" ? "Guest" : "Company (BTC)"}
            <ArrowRight size={15} />
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
