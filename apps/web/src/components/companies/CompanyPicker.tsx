import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Building2, ChevronDown, Check, AlertTriangle, Plus } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  companiesService, pkr, COMPANY_TYPE_LABEL, PAYMENT_TERMS_LABEL,
  type CompanyPickerOption,
} from "@/services/companies";
import { CompanyFormModal } from "./CompanyFormModal";
import { usePermissions } from "@/hooks/usePermissions";
import { useDebounce } from "@/hooks/useDebounce";

export interface CompanyPickerProps {
  value: string | null;
  onChange: (company: CompanyPickerOption | null) => void;
  /** Shown as a hint above the list, e.g. "Tour agencies you deal with". */
  placeholder?: string;
  className?: string;
}

/**
 * Searchable company selector for booking screens.
 *
 * Shows each company's remaining credit inline, because the decision the front
 * desk is actually making — "can I put this booking on their account?" — is
 * unanswerable from the name alone.
 */
export function CompanyPicker({ value, onChange, placeholder, className }: CompanyPickerProps) {
  const { has } = usePermissions();
  const [open, setOpen]     = useState(false);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const debounced = useDebounce(search, 250);

  const { data: companies = [], refetch } = useQuery({
    queryKey: ["companies-picker", debounced],
    queryFn:  () => companiesService.picker(debounced || undefined),
  });

  const selected = companies.find((c) => c.id === value) ?? null;

  return (
    <div className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="h-11 w-full rounded-xl bg-mist border border-line px-3 text-left text-[13.5px] text-ink outline-none focus:border-coral focus:ring-2 focus:ring-coral/15 transition-all flex items-center gap-2"
      >
        <Building2 size={15} className="text-ink-mute shrink-0" />
        <span className={cn("flex-1 truncate", !selected && "text-ink-faint")}>
          {selected ? selected.name : (placeholder ?? "Select a company…")}
        </span>
        <ChevronDown size={15} className="text-ink-mute shrink-0" />
      </button>

      {selected && (
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-ink-mute">
          <span>{COMPANY_TYPE_LABEL[selected.type]}</span>
          <span>·</span>
          <span>{PAYMENT_TERMS_LABEL[selected.paymentTerms]}</span>
          <span>·</span>
          {selected.creditLimit > 0 ? (
            <span className={cn(
              "font-semibold",
              selected.balance >= selected.creditLimit ? "text-clay" : "text-sage-deep",
            )}>
              {pkr(Math.max(0, selected.creditLimit - selected.balance))} credit left
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-amber font-semibold">
              <AlertTriangle size={11} /> No credit — guests settle at checkout
            </span>
          )}
        </div>
      )}

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 mt-1.5 w-full rounded-xl border border-line bg-paper shadow-xl overflow-hidden">
            <div className="p-2 border-b border-line-soft">
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search companies…"
                className="h-9 w-full rounded-lg bg-mist border border-line px-3 text-[13px] text-ink outline-none focus:border-coral"
              />
            </div>

            <div className="max-h-64 overflow-y-auto scroll-area">
              <button
                type="button"
                onClick={() => { onChange(null); setOpen(false); }}
                className="w-full px-3 py-2.5 text-left text-[13px] text-ink-mute hover:bg-mist transition-colors flex items-center gap-2"
              >
                <span className="flex-1">No company — guest pays directly</span>
                {value === null && <Check size={14} className="text-coral" />}
              </button>

              {companies.length === 0 ? (
                <div className="px-3 py-6 text-center text-[13px] text-ink-mute">
                  {search ? "No companies match that search." : "No companies yet."}
                </div>
              ) : (
                companies.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => { onChange(c); setOpen(false); }}
                    className="w-full px-3 py-2.5 text-left hover:bg-mist transition-colors border-t border-line-soft"
                  >
                    <div className="flex items-center gap-2">
                      <span className="flex-1 text-[13.5px] font-semibold text-ink truncate">{c.name}</span>
                      {c.id === value && <Check size={14} className="text-coral shrink-0" />}
                    </div>
                    <div className="text-[11.5px] text-ink-mute mt-0.5">
                      {COMPANY_TYPE_LABEL[c.type]}
                      {" · "}
                      {c.creditLimit > 0
                        ? `${pkr(Math.max(0, c.creditLimit - c.balance))} credit left`
                        : "No credit"}
                    </div>
                  </button>
                ))
              )}
            </div>

            {has("companies:create") && (
              <button
                type="button"
                onClick={() => { setOpen(false); setShowCreate(true); }}
                className="w-full px-3 py-2.5 text-left text-[13px] font-semibold text-coral hover:bg-mist transition-colors border-t border-line flex items-center gap-2"
              >
                <Plus size={14} /> Add a new company
              </button>
            )}
          </div>
        </>
      )}

      {showCreate && (
        <CompanyFormModal
          onClose={() => setShowCreate(false)}
          onSaved={(company) => {
            setShowCreate(false);
            refetch();
            // The create form has no credit-limit field, so a brand-new company
            // always has zero credit. Selecting it here is still right — it
            // links the booking — and the badge above says guests must settle.
            onChange({
              id: company.id, name: company.name, type: company.type,
              creditLimit: company.creditLimit, balance: company.balance,
              paymentTerms: company.paymentTerms, ratePlanId: company.ratePlanId,
              discountPercent: company.discountPercent,
            });
          }}
        />
      )}
    </div>
  );
}
