import { useState } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Building2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  companiesService, COMPANY_TYPE_LABEL, PAYMENT_TERMS_LABEL,
  type Company, type CompanyType, type CompanyPaymentTerms,
} from "@/services/companies";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { Button } from "@/components/ui/Button";

const inputCls = "h-10 w-full rounded-xl bg-mist border border-line px-3 text-[13.5px] text-ink outline-none focus:border-coral focus:ring-2 focus:ring-coral/15 transition-all";
const labelCls = "block text-[11px] font-bold uppercase tracking-wider text-ink-faint mb-1.5";

const TYPES: CompanyType[] = ["TOUR_AGENCY", "CORPORATE", "GOVERNMENT", "NGO", "OTHER"];
const TERMS: CompanyPaymentTerms[] = ["IMMEDIATE", "NET_7", "NET_15", "NET_30", "NET_45", "NET_60", "NET_90"];

export interface CompanyFormModalProps {
  /** Omit to create. */
  company?: Company;
  onClose: () => void;
  onSaved: (company: Company) => void;
}

export function CompanyFormModal({ company, onClose, onSaved }: CompanyFormModalProps) {
  useEscapeKey(onClose);
  const qc = useQueryClient();
  const isEdit = Boolean(company);

  const [form, setForm] = useState({
    name:            company?.name ?? "",
    type:            company?.type ?? ("TOUR_AGENCY" as CompanyType),
    contactName:     company?.contactName ?? "",
    contactPhone:    company?.contactPhone ?? "",
    contactEmail:    company?.contactEmail ?? "",
    city:            company?.city ?? "",
    address:         company?.address ?? "",
    ntn:             company?.ntn ?? "",
    strn:            company?.strn ?? "",
    paymentTerms:    company?.paymentTerms ?? ("NET_30" as CompanyPaymentTerms),
    discountPercent: company?.discountPercent != null ? String(company.discountPercent) : "",
    notes:           company?.notes ?? "",
  });

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const mutation = useMutation({
    mutationFn: () => {
      const dto = {
        name:         form.name.trim(),
        type:         form.type,
        paymentTerms: form.paymentTerms,
        // Empty strings are dropped rather than sent — the API treats "" as
        // "clear this field", which is not what leaving a box blank means on a
        // create form.
        ...(form.contactName.trim()  ? { contactName:  form.contactName.trim() }  : {}),
        ...(form.contactPhone.trim() ? { contactPhone: form.contactPhone.trim() } : {}),
        ...(form.contactEmail.trim() ? { contactEmail: form.contactEmail.trim() } : {}),
        ...(form.city.trim()    ? { city:    form.city.trim() }    : {}),
        ...(form.address.trim() ? { address: form.address.trim() } : {}),
        ...(form.ntn.trim()     ? { ntn:     form.ntn.trim() }     : {}),
        ...(form.strn.trim()    ? { strn:    form.strn.trim() }    : {}),
        ...(form.notes.trim()   ? { notes:   form.notes.trim() }   : {}),
        discountPercent: form.discountPercent ? Number(form.discountPercent) : null,
      };
      return isEdit
        ? companiesService.update(company!.id, dto)
        : companiesService.create(dto);
    },
    onSuccess: (saved) => {
      qc.invalidateQueries({ queryKey: ["companies"] });
      qc.invalidateQueries({ queryKey: ["company", saved.id] });
      onSaved(saved);
    },
  });

  const canSubmit = form.name.trim().length > 0 && !mutation.isPending;
  const errorMessage = mutation.error
    ? ((mutation.error as { response?: { data?: { error?: string } } })?.response?.data?.error
        ?? "Something went wrong. Please try again.")
    : null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-ink/40 p-4 backdrop-blur-sm anim-fade-in"
      onMouseDown={onClose}
    >
      <div
        className="flex max-h-[calc(100dvh-2rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-paper shadow-xl anim-scale-in"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center gap-3 border-b border-line px-6 pb-5 pt-6">
          <div className="grid place-items-center h-10 w-10 rounded-xl bg-coral/10 shrink-0">
            <Building2 size={18} className="text-coral" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="serif text-[20px] text-ink leading-tight">
              {isEdit ? "Edit company" : "New company"}
            </h2>
            <p className="text-[12px] text-ink-mute mt-0.5">
              {isEdit ? company!.name : "A tour agency or corporate client you bill directly"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="grid place-items-center h-9 w-9 rounded-full hover:bg-mist text-ink-mute transition-colors -mr-1 -mt-1"
          >
            <X size={18} />
          </button>
        </div>

        <div className="scroll-area min-h-0 overflow-y-auto px-6 py-5 space-y-4">
          <div>
            <label className={labelCls}>Company name *</label>
            <input
              autoFocus
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="e.g. Al-Habib Travels"
              className={inputCls}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Type</label>
              <select
                value={form.type}
                onChange={(e) => set("type", e.target.value as CompanyType)}
                className={cn(inputCls, "cursor-pointer")}
              >
                {TYPES.map((t) => <option key={t} value={t}>{COMPANY_TYPE_LABEL[t]}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Payment terms</label>
              <select
                value={form.paymentTerms}
                onChange={(e) => set("paymentTerms", e.target.value as CompanyPaymentTerms)}
                className={cn(inputCls, "cursor-pointer")}
              >
                {TERMS.map((t) => <option key={t} value={t}>{PAYMENT_TERMS_LABEL[t]}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Contact person</label>
              <input value={form.contactName} onChange={(e) => set("contactName", e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Phone</label>
              <input value={form.contactPhone} onChange={(e) => set("contactPhone", e.target.value)} placeholder="03001234567" className={inputCls} />
            </div>
          </div>

          <div>
            <label className={labelCls}>Email</label>
            <input type="email" value={form.contactEmail} onChange={(e) => set("contactEmail", e.target.value)} className={inputCls} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>City</label>
              <input value={form.city} onChange={(e) => set("city", e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Negotiated discount</label>
              <div className="relative">
                <input
                  type="number" min={0} max={90}
                  value={form.discountPercent}
                  onChange={(e) => set("discountPercent", e.target.value)}
                  placeholder="0"
                  className={cn(inputCls, "pr-9 tnum")}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[13px] font-semibold text-ink-mute">%</span>
              </div>
            </div>
          </div>

          <div>
            <label className={labelCls}>Address</label>
            <textarea
              value={form.address}
              onChange={(e) => set("address", e.target.value)}
              rows={2}
              className={cn(inputCls, "h-auto py-2 resize-none")}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>NTN</label>
              <input value={form.ntn} onChange={(e) => set("ntn", e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>STRN</label>
              <input value={form.strn} onChange={(e) => set("strn", e.target.value)} className={inputCls} />
            </div>
          </div>
          <p className="-mt-2 text-[12px] text-ink-faint">
            Tax numbers are optional and print on the company's invoice. Most small agencies are not registered.
          </p>

          <div>
            <label className={labelCls}>Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              rows={2}
              className={cn(inputCls, "h-auto py-2 resize-none")}
            />
          </div>

          {!isEdit && (
            <div className="flex items-start gap-2 rounded-xl bg-amber-soft border border-amber/30 px-3 py-2.5">
              <AlertCircle size={14} className="text-amber shrink-0 mt-0.5" />
              <p className="text-[12.5px] text-ink-soft">
                New companies start with no credit limit, so their guests still settle at checkout.
                Set a credit limit on the company's page once you decide how much to extend.
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
            {isEdit ? "Save changes" : "Create company"}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
