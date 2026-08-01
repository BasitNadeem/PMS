import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Star, Users, Mail } from "lucide-react";
import { cn } from "../../lib/cn";
import { guestsService, vipLabel, type GuestDetail, type UpdateGuestDto, type DocumentType } from "../../services/guests";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { getPhoneErrorMessage, getEmailErrorMessage } from "@/lib/validation";
import { DatePicker } from "@/components/ui/DatePicker";
import { TagEditor } from "./TagEditor";
import { SpecialDatesEditor } from "./SpecialDatesEditor";

const VIP_LEVELS = [0, 1, 2, 3] as const;

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

const inputCls = "h-11 w-full rounded-xl bg-mist border border-line px-3.5 text-sm text-ink placeholder:text-ink-faint outline-none focus:border-coral focus:ring-2 focus:ring-coral/15 transition-all";
const labelCls = "block text-[12.5px] font-semibold uppercase tracking-wide text-ink-mute mb-1.5";
const sectionCls = "text-[11px] font-bold uppercase tracking-[0.14em] text-ink-faint mb-3";

interface EditGuestModalProps {
  guest: GuestDetail;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export function EditGuestModal({ guest, onClose, onSuccess }: EditGuestModalProps) {
  useEscapeKey(onClose);
  const qc = useQueryClient();
  const [form, setForm] = useState({
    firstName:      guest.firstName,
    lastName:       guest.lastName,
    dateOfBirth:    guest.dateOfBirth ? guest.dateOfBirth.split("T")[0] : "",
    nationality:    guest.nationality ?? "",
    gender:         guest.gender ?? "",
    email:          guest.email ?? "",
    phone:          guest.phone ?? "",
    address:        guest.address ?? "",
    documentType:   guest.documentType,
    documentNumber: guest.documentNumber ?? "",
    documentExpiry: guest.documentExpiry ? guest.documentExpiry.split("T")[0] : "",
    internalNotes:  guest.internalNotes ?? "",
    vipLevel:       guest.vipLevel,
    tags:           guest.tags ?? [],
    specialDates:   guest.specialDates ?? [],
    specialDatesDeclined: Boolean(guest.specialDatesDeclinedAt),
    marketingOptIn: guest.marketingOptIn ?? false,
  });

  const [errors, setErrors] = useState<{ phone?: string; email?: string }>({});

  const mutation = useMutation({
    mutationFn: (dto: UpdateGuestDto) => guestsService.updateGuest(guest.id, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["guests"] });
      qc.invalidateQueries({ queryKey: ["guest", guest.id] });
      qc.invalidateQueries({ queryKey: ["guest-tags"] });
      onSuccess("Guest updated successfully");
      onClose();
    },
  });

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs: typeof errors = {};
    if (form.phone.trim()) errs.phone = getPhoneErrorMessage(form.phone) ?? undefined;
    if (form.email.trim()) errs.email = getEmailErrorMessage(form.email) ?? undefined;
    (Object.keys(errs) as (keyof typeof errs)[]).forEach((k) => { if (!errs[k]) delete errs[k]; });
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    mutation.mutate({
      firstName:      form.firstName.trim() || undefined,
      lastName:       form.lastName.trim() || undefined,
      email:          form.email.trim() || undefined,
      phone:          form.phone.trim() || undefined,
      nationality:    form.nationality.trim() || undefined,
      gender:         form.gender || undefined,
      dateOfBirth:    form.dateOfBirth || undefined,
      documentType:   form.documentType,
      documentNumber: form.documentNumber.trim() || undefined,
      documentExpiry: form.documentExpiry || undefined,
      address:        form.address.trim() || undefined,
      internalNotes:  form.internalNotes.trim() || undefined,
      vipLevel:       form.vipLevel,
      tags:           form.tags,
      specialDates:   form.specialDates,
      specialDatesDeclined: form.specialDatesDeclined,
      marketingOptIn: form.marketingOptIn,
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm p-4 anim-fade-in"
      onMouseDown={onClose}
    >
      <div
        className="bg-paper rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col anim-scale-in"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-6 pt-6 pb-5 border-b border-line flex-shrink-0">
          <div className="grid place-items-center h-10 w-10 rounded-xl bg-mist shrink-0">
            <Users size={18} className="text-ink-soft" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="serif text-[20px] text-ink leading-tight">Edit Guest</h2>
            <p className="text-[12px] text-ink-mute mt-0.5 truncate">{guest.firstName} {guest.lastName}</p>
          </div>
          <button
            onClick={onClose}
            className="grid place-items-center h-9 w-9 rounded-full hover:bg-mist text-ink-mute transition-colors -mr-1 -mt-1"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable body */}
        <form id="edit-guest-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto scroll-area px-6 py-5 space-y-5">

          {/* Recognition tier. A plain on/off toggle used to live here, but it
              wrote level 1 on save — which silently demoted a Gold or Platinum
              guest every time someone edited an unrelated field. */}
          <div className={cn(
            "rounded-xl border px-3.5 py-3 transition-colors",
            form.vipLevel > 0 ? "border-amber/40 bg-amber-soft" : "border-line bg-mist",
          )}>
            <div className="flex items-center gap-2 mb-2.5">
              <Star size={15} className={form.vipLevel > 0 ? "text-amber fill-amber" : "text-ink-faint"} />
              <span className="text-[13.5px] font-semibold text-ink-soft">Recognition tier</span>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {VIP_LEVELS.map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => set("vipLevel", level)}
                  className={cn(
                    "h-9 rounded-lg text-[12.5px] font-semibold border transition-colors",
                    form.vipLevel === level
                      ? "border-amber bg-amber text-white"
                      : "border-line bg-paper text-ink-mute hover:text-ink hover:border-ink-faint",
                  )}
                >
                  {vipLabel(level) ?? "None"}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[11.5px] text-ink-mute">
              Earned automatically from completed stays. Set it higher by hand to
              recognise a guest early — stay counts will never lower it again.
            </p>
          </div>

          {/* Tags */}
          <div>
            <p className={sectionCls}>Tags</p>
            <TagEditor value={form.tags} onChange={(tags) => set("tags", tags)} />
          </div>

          {/* Special dates */}
          <div>
            <p className={sectionCls}>Special Dates</p>
            <SpecialDatesEditor
              value={form.specialDates}
              onChange={(dates) => set("specialDates", dates)}
              declined={form.specialDatesDeclined}
              onDeclinedChange={(v) => set("specialDatesDeclined", v)}
            />
          </div>

          {/* Marketing consent. Holding a birthday is not the same as being
              allowed to email about it, so consent is captured separately. */}
          <div>
            <p className={sectionCls}>Keeping in Touch</p>
            <button
              type="button"
              onClick={() => set("marketingOptIn", !form.marketingOptIn)}
              className={cn(
                "flex items-center justify-between w-full rounded-xl border px-3.5 py-2.5 transition-colors text-left",
                form.marketingOptIn ? "border-pine/40 bg-pine-soft" : "border-line bg-mist hover:border-line-soft",
              )}
            >
              <span className="flex items-start gap-2 pr-3">
                <Mail size={15} className={cn("mt-0.5 shrink-0", form.marketingOptIn ? "text-pine-deep" : "text-ink-faint")} />
                <span>
                  <span className="block text-[13.5px] font-semibold text-ink-soft">
                    Guest agreed to receive offers
                  </span>
                  <span className="block text-[11.5px] text-ink-mute">
                    Required before any greeting or promo code email is sent.
                  </span>
                </span>
              </span>
              <span className={cn(
                "w-11 h-6 rounded-full transition-colors duration-200 flex items-center flex-shrink-0",
                form.marketingOptIn ? "bg-pine" : "bg-line-soft",
              )}>
                <span className={cn(
                  "w-5 h-5 bg-white rounded-full shadow transition-transform duration-200",
                  form.marketingOptIn ? "translate-x-5" : "translate-x-0.5",
                )} />
              </span>
            </button>
          </div>

          {/* Personal Information */}
          <div>
            <p className={sectionCls}>Personal Information</p>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>First name</label>
                  <input type="text" value={form.firstName}
                    onChange={(e) => set("firstName", e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Last name</label>
                  <input type="text" value={form.lastName}
                    onChange={(e) => set("lastName", e.target.value)} className={inputCls} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Date of birth</label>
                  <DatePicker value={form.dateOfBirth}
                    onChange={(v) => set("dateOfBirth", v)} className="w-full" />
                </div>
                <div>
                  <label className={labelCls}>Nationality</label>
                  <input type="text" value={form.nationality} placeholder="Pakistani"
                    onChange={(e) => set("nationality", e.target.value)} className={inputCls} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Gender</label>
                <select value={form.gender} onChange={(e) => set("gender", e.target.value)}
                  className={cn(inputCls, "cursor-pointer")}>
                  <option value="">Select…</option>
                  {GENDER_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Contact & Identity */}
          <div>
            <p className={sectionCls}>Contact &amp; Identity</p>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Email</label>
                  <input
                    type="email" value={form.email} placeholder="name@email.com"
                    onChange={(e) => set("email", e.target.value)}
                    onBlur={() => { if (form.email.trim()) setErrors((e) => ({ ...e, email: getEmailErrorMessage(form.email) ?? undefined })); }}
                    className={cn(inputCls, errors.email && "border-clay/50")}
                  />
                  {errors.email && <p className="text-[12px] text-clay mt-1">{errors.email}</p>}
                </div>
                <div>
                  <label className={labelCls}>Phone <span className="text-coral text-[15px] font-bold leading-none normal-case tracking-normal">*</span></label>
                  <input
                    type="tel" value={form.phone} placeholder="03XX XXXXXXX"
                    onChange={(e) => set("phone", e.target.value)}
                    onBlur={() => { if (form.phone.trim()) setErrors((e) => ({ ...e, phone: getPhoneErrorMessage(form.phone) ?? undefined })); }}
                    className={cn(inputCls, errors.phone && "border-clay/50")}
                  />
                  {errors.phone && <p className="text-[12px] text-clay mt-1">{errors.phone}</p>}
                </div>
              </div>
              <div>
                <label className={labelCls}>Address</label>
                <textarea value={form.address} onChange={(e) => set("address", e.target.value)}
                  rows={2} placeholder="Street, City"
                  className={cn(inputCls, "h-auto py-2.5 resize-none")} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>ID type</label>
                  <select value={form.documentType}
                    onChange={(e) => set("documentType", e.target.value as DocumentType)}
                    className={cn(inputCls, "cursor-pointer")}>
                    {DOC_TYPES.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>ID number</label>
                  <input type="text" value={form.documentNumber} placeholder="35202-•••••••-7"
                    onChange={(e) => set("documentNumber", e.target.value)} className={inputCls} />
                </div>
              </div>
              <div>
                <label className={labelCls}>ID expiry <span className="normal-case tracking-normal text-ink-faint font-normal">(optional)</span></label>
                <DatePicker value={form.documentExpiry}
                  onChange={(v) => set("documentExpiry", v)} className="w-full" />
              </div>
              <div>
                <label className={labelCls}>Internal notes <span className="normal-case tracking-normal text-ink-faint font-normal">(not visible to guest)</span></label>
                <textarea value={form.internalNotes}
                  onChange={(e) => set("internalNotes", e.target.value)}
                  rows={2} placeholder="Staff-only notes…"
                  className={cn(inputCls, "h-auto py-2.5 resize-none")} />
              </div>
            </div>
          </div>

          {mutation.isError && (
            <div className="bg-clay-soft border border-clay/20 text-clay text-[13px] rounded-xl px-4 py-3">
              Something went wrong. Please try again.
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="flex justify-end gap-2.5 px-6 py-4 border-t border-line flex-shrink-0">
          <button type="button" onClick={onClose}
            className="h-10 px-5 rounded-full border border-line text-ink-soft text-[13.5px] font-semibold hover:bg-mist transition-colors">
            Cancel
          </button>
          <button
            type="submit"
            form="edit-guest-form"
            disabled={mutation.isPending}
            className="h-10 px-5 rounded-full bg-ink text-white text-[13.5px] font-semibold hover:bg-ink/90 shadow-pop transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {mutation.isPending ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
