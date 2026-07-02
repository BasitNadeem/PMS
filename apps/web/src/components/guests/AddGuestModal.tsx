import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X, UserPlus } from "lucide-react";
import { cn } from "@/lib/cn";
import { guestsService, type CreateGuestDto, type DocumentType } from "@/services/guests";
import { useEscapeKey } from "@/hooks/useEscapeKey";

const DOC_TYPES: { value: DocumentType; label: string }[] = [
  { value: "CNIC",            label: "CNIC" },
  { value: "PASSPORT",        label: "Passport" },
  { value: "DRIVING_LICENSE", label: "Driving License" },
  { value: "NRIC",            label: "NRIC" },
  { value: "OTHER",           label: "Other" },
];

const GENDER_OPTIONS = [
  { value: "Male",              label: "Male" },
  { value: "Female",            label: "Female" },
  { value: "Other",             label: "Other" },
  { value: "Prefer not to say", label: "Prefer not to say" },
];

type FormState = {
  firstName: string; lastName: string; dateOfBirth: string; nationality: string;
  gender: string; email: string; phone: string; address: string;
  documentType: DocumentType; documentNumber: string; internalNotes: string;
};

interface AddGuestModalProps { onClose: () => void; onSuccess: (message: string) => void }

const inputCls = "w-full rounded-xl border border-line bg-mist px-3.5 py-2.5 text-[14px] text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-coral/20 focus:border-coral/40 transition-colors";
const labelCls = "block text-[12.5px] font-semibold uppercase tracking-wide text-ink-mute mb-1.5";

export function AddGuestModal({ onClose, onSuccess }: AddGuestModalProps) {
  useEscapeKey(onClose);
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState>({
    firstName: "", lastName: "", dateOfBirth: "", nationality: "Pakistani",
    gender: "", email: "", phone: "", address: "",
    documentType: "CNIC", documentNumber: "", internalNotes: "",
  });
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});

  const mutation = useMutation({
    mutationFn: guestsService.createGuest,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["guests"] });
      onSuccess("Guest added successfully");
      onClose();
    },
  });

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  }

  function validate(): boolean {
    const errs: typeof errors = {};
    if (!form.firstName.trim())      errs.firstName      = "First name is required";
    if (!form.lastName.trim())       errs.lastName       = "Last name is required";
    if (!form.phone.trim())          errs.phone          = "Phone is required";
    if (!form.documentNumber.trim()) errs.documentNumber = "ID number is required";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    mutation.mutate({
      firstName: form.firstName.trim(), lastName: form.lastName.trim(),
      email: form.email.trim() || undefined, phone: form.phone.trim(),
      nationality: form.nationality.trim() || undefined,
      gender: form.gender || undefined, dateOfBirth: form.dateOfBirth || undefined,
      documentType: form.documentType, documentNumber: form.documentNumber.trim(),
      address: form.address.trim() || undefined,
      internalNotes: form.internalNotes.trim() || undefined,
    } as CreateGuestDto);
  }

  const ic = (key: keyof FormState) => cn(inputCls, errors[key] && "border-clay/50");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm p-4 anim-fade-in">
      <div className="bg-paper rounded-2xl shadow-xl w-full max-w-lg max-h-[92vh] flex flex-col anim-scale-in">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 pt-6 pb-5 border-b border-line flex-shrink-0">
          <div className="grid place-items-center h-10 w-10 rounded-xl bg-pine-soft shrink-0">
            <UserPlus size={18} className="text-pine-deep" />
          </div>
          <div className="flex-1"><h2 className="serif text-[20px] text-ink leading-tight">Add Guest</h2></div>
          <button onClick={onClose} className="grid place-items-center h-9 w-9 rounded-full hover:bg-mist text-ink-mute transition-colors -mr-1 -mt-1">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto scroll-area flex-1">
          <div className="px-6 py-5 space-y-5">
            {/* Personal */}
            <div>
              <p className="text-[11px] font-bold text-ink-faint uppercase tracking-[0.14em] mb-3">Personal Information</p>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>First Name <span className="text-coral text-[15px] font-bold leading-none normal-case tracking-normal">*</span></label>
                    <input type="text" value={form.firstName} onChange={(e) => set("firstName", e.target.value)} className={ic("firstName")} />
                    {errors.firstName && <p className="text-[12px] text-clay mt-1">{errors.firstName}</p>}
                  </div>
                  <div>
                    <label className={labelCls}>Last Name <span className="text-coral text-[15px] font-bold leading-none normal-case tracking-normal">*</span></label>
                    <input type="text" value={form.lastName} onChange={(e) => set("lastName", e.target.value)} className={ic("lastName")} />
                    {errors.lastName && <p className="text-[12px] text-clay mt-1">{errors.lastName}</p>}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Date of Birth</label>
                    <input type="date" value={form.dateOfBirth} onChange={(e) => set("dateOfBirth", e.target.value)} className={ic("dateOfBirth")} />
                  </div>
                  <div>
                    <label className={labelCls}>Nationality</label>
                    <input type="text" value={form.nationality} onChange={(e) => set("nationality", e.target.value)} className={ic("nationality")} />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Gender</label>
                  <select value={form.gender} onChange={(e) => set("gender", e.target.value)} className={cn(ic("gender"), "cursor-pointer")}>
                    <option value="">Select…</option>
                    {GENDER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Contact & Identity */}
            <div>
              <p className="text-[11px] font-bold text-ink-faint uppercase tracking-[0.14em] mb-3">Contact &amp; Identity</p>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Email</label>
                    <input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="optional" className={ic("email")} />
                  </div>
                  <div>
                    <label className={labelCls}>Phone <span className="text-coral text-[15px] font-bold leading-none normal-case tracking-normal">*</span></label>
                    <input type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} className={ic("phone")} />
                    {errors.phone && <p className="text-[12px] text-clay mt-1">{errors.phone}</p>}
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Address</label>
                  <textarea value={form.address} onChange={(e) => set("address", e.target.value)} rows={2} className={cn(ic("address"), "resize-none")} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>ID Type</label>
                    <select value={form.documentType} onChange={(e) => set("documentType", e.target.value as DocumentType)} className={cn(ic("documentType"), "cursor-pointer")}>
                      {DOC_TYPES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>ID Number <span className="text-coral text-[15px] font-bold leading-none normal-case tracking-normal">*</span></label>
                    <input type="text" value={form.documentNumber} onChange={(e) => set("documentNumber", e.target.value)} className={ic("documentNumber")} />
                    {errors.documentNumber && <p className="text-[12px] text-clay mt-1">{errors.documentNumber}</p>}
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Notes</label>
                  <textarea value={form.internalNotes} onChange={(e) => set("internalNotes", e.target.value)} rows={2}
                    placeholder="Internal notes (not visible to guest)" className={cn(ic("internalNotes"), "resize-none")} />
                </div>
              </div>
            </div>
          </div>

          {mutation.isError && (
            <div className="mx-6 mb-3 bg-clay-soft border border-clay/20 text-clay text-[13px] rounded-xl px-4 py-3">
              Something went wrong. Please try again.
            </div>
          )}

          <div className="flex justify-end gap-2.5 px-6 pb-6 pt-4 border-t border-line">
            <button type="button" onClick={onClose} className="h-10 px-5 rounded-full border border-line text-ink-soft text-[13.5px] font-semibold hover:bg-mist transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={mutation.isPending} className="h-10 px-5 rounded-full bg-coral text-white text-[13.5px] font-semibold hover:bg-coral-dark shadow-pop transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              {mutation.isPending ? "Saving…" : "Add Guest"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
