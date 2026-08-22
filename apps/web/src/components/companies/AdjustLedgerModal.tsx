import { useState } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Scale, AlertCircle } from "lucide-react";
import { cn } from "@/lib/cn";
import { companiesService, pkr } from "@/services/companies";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { bannerMessageFor } from "@/lib/formErrors";
import { Button } from "@/components/ui/Button";
import { DatePicker } from "@/components/ui/DatePicker";
import { RequiredMark } from "@/components/ui/RequiredMark";
import { Segmented } from "@/components/ui/Segmented";
import { todayInHotelTime } from "../../lib/hotelTime";

const inputCls = "h-10 w-full rounded-xl bg-mist border border-line px-3 text-[13.5px] text-ink outline-none focus:border-coral focus:ring-2 focus:ring-coral/15 transition-all";
const labelCls = "block text-[11px] font-bold uppercase tracking-wider text-ink-faint mb-1.5";

export interface AdjustLedgerModalProps {
  companyId: string;
  companyName: string;
  /** Paisa. Caps a write-off. */
  outstanding: number;
  /** Hides the write-off option when the user lacks COMPANY_WRITE_OFF. */
  canWriteOff: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export function AdjustLedgerModal({
  companyId, companyName, outstanding, canWriteOff, onClose, onSuccess,
}: AdjustLedgerModalProps) {
  useEscapeKey(onClose);
  const qc = useQueryClient();

  const [type, setType]         = useState<"ADJUSTMENT" | "WRITE_OFF">("ADJUSTMENT");
  const [amount, setAmount]     = useState("");
  const [description, setDesc]  = useState("");
  const [entryDate, setDate]    = useState(todayInHotelTime());

  const numericAmount = Number(amount) || 0;
  const writeOffTooBig = type === "WRITE_OFF" && numericAmount * 100 > outstanding;

  const mutation = useMutation({
    mutationFn: () => companiesService.adjust(companyId, {
      type, amount: numericAmount, description: description.trim(), entryDate,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["company", companyId] });
      qc.invalidateQueries({ queryKey: ["company-ledger", companyId] });
      qc.invalidateQueries({ queryKey: ["companies"] });
      qc.invalidateQueries({ queryKey: ["companies-aging-summary"] });
      onSuccess(
        type === "WRITE_OFF"
          ? `${pkr(numericAmount * 100)} written off.`
          : `Charge of ${pkr(numericAmount * 100)} added to the account.`,
      );
      onClose();
    },
  });

  const errorMessage = bannerMessageFor(mutation.error);

  const canSubmit = numericAmount > 0 && description.trim().length >= 3 && !writeOffTooBig && !mutation.isPending;

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
            <Scale size={18} className="text-coral" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="serif text-[20px] text-ink leading-tight">Adjust account</h2>
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
          {canWriteOff && (
            <Segmented
              options={[
                { value: "ADJUSTMENT", label: "Add charge" },
                { value: "WRITE_OFF",  label: "Write off"  },
              ]}
              value={type}
              onChange={(v) => setType(v as "ADJUSTMENT" | "WRITE_OFF")}
              size="sm"
            />
          )}

          <p className="text-[12.5px] text-ink-mute">
            {type === "ADJUSTMENT"
              ? "Increases what this company owes — a late fee, a missed charge, a correction."
              : "Reduces what this company owes without money changing hands. Use for bad debt or a goodwill discount."}
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Amount (Rs)<RequiredMark /></label>
              <input
                autoFocus type="number" min={0} step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className={cn(inputCls, "tnum")}
              />
            </div>
            <div>
              <label className={labelCls}>Date</label>
              <DatePicker value={entryDate} onChange={setDate} max={todayInHotelTime()} />
            </div>
          </div>

          <div>
            <label className={labelCls}>Reason<RequiredMark /></label>
            <input
              value={description}
              onChange={(e) => setDesc(e.target.value)}
              placeholder={type === "WRITE_OFF" ? "e.g. Agency closed, debt uncollectable" : "e.g. Late payment fee for July"}
              className={inputCls}
            />
            <p className="mt-1.5 text-[12px] text-ink-faint">
              Appears on the company's statement and in the audit log.
            </p>
          </div>

          {writeOffTooBig && (
            <div className="flex items-start gap-2 rounded-xl bg-amber-soft border border-amber/30 px-3 py-2.5">
              <AlertCircle size={14} className="text-amber shrink-0 mt-0.5" />
              <p className="text-[12.5px] text-ink-soft">
                You cannot write off more than the {pkr(outstanding)} this company owes.
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
          <Button
            variant={type === "WRITE_OFF" ? "danger" : "primary"}
            disabled={!canSubmit}
            loading={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {type === "WRITE_OFF" ? "Write off" : "Add charge"}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
