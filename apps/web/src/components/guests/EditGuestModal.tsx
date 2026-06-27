import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Star } from "lucide-react";
import { cn } from "../../lib/cn";
import { guestsService, type GuestDetail, type UpdateGuestDto, type DocumentType } from "../../services/guests";
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
    internalNotes:  guest.internalNotes ?? "",
    isVip:          guest.vipLevel > 0,
  });

  const mutation = useMutation({
    mutationFn: (dto: UpdateGuestDto) => guestsService.updateGuest(guest.id, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["guests"] });
      qc.invalidateQueries({ queryKey: ["guest", guest.id] });
      onSuccess("Guest updated successfully");
      onClose();
    },
  });

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const dto: UpdateGuestDto = {
      firstName:      form.firstName.trim() || undefined,
      lastName:       form.lastName.trim() || undefined,
      email:          form.email.trim() || undefined,
      phone:          form.phone.trim() || undefined,
      nationality:    form.nationality.trim() || undefined,
      gender:         form.gender || undefined,
      dateOfBirth:    form.dateOfBirth || undefined,
      documentType:   form.documentType,
      documentNumber: form.documentNumber.trim() || undefined,
      address:        form.address.trim() || undefined,
      internalNotes:  form.internalNotes.trim() || undefined,
      vipLevel:       form.isVip ? 1 : 0,
    };
    mutation.mutate(dto);
  }

  const inputClass = cn(
    "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
  );

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Edit Guest</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1">
          <div className="px-6 py-5 space-y-5">
            <button
              type="button"
              onClick={() => set("isVip", !form.isVip)}
              className={cn(
                "flex items-center justify-between w-full rounded-xl border px-3.5 py-2.5 transition-colors",
                form.isVip ? "border-amber-400 bg-amber-50" : "border-gray-200 bg-white hover:border-gray-300",
              )}
            >
              <span className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                <Star size={15} className={form.isVip ? "text-amber-500 fill-amber-500" : "text-gray-400"} />
                Mark this guest as VIP
              </span>
              <span className={cn(
                "w-11 h-6 rounded-full transition-colors duration-200 flex items-center flex-shrink-0",
                form.isVip ? "bg-amber-500" : "bg-gray-300",
              )}>
                <span className={cn(
                  "w-5 h-5 bg-white rounded-full shadow transition-transform duration-200",
                  form.isVip ? "translate-x-5" : "translate-x-0.5",
                )} />
              </span>
            </button>

            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Personal Information
              </p>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                    <input type="text" value={form.firstName}
                      onChange={(e) => set("firstName", e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                    <input type="text" value={form.lastName}
                      onChange={(e) => set("lastName", e.target.value)} className={inputClass} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
                    <input type="date" value={form.dateOfBirth}
                      onChange={(e) => set("dateOfBirth", e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nationality</label>
                    <input type="text" value={form.nationality}
                      onChange={(e) => set("nationality", e.target.value)} className={inputClass} />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                  <select value={form.gender} onChange={(e) => set("gender", e.target.value)} className={inputClass}>
                    <option value="">Select…</option>
                    {GENDER_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Contact &amp; Identity
              </p>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input type="email" value={form.email}
                      onChange={(e) => set("email", e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                    <input type="tel" value={form.phone}
                      onChange={(e) => set("phone", e.target.value)} className={inputClass} />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                  <textarea value={form.address} onChange={(e) => set("address", e.target.value)}
                    rows={2} className={cn(inputClass, "resize-none")} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">ID Type</label>
                    <select value={form.documentType}
                      onChange={(e) => set("documentType", e.target.value as DocumentType)}
                      className={inputClass}>
                      {DOC_TYPES.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">ID Number</label>
                    <input type="text" value={form.documentNumber}
                      onChange={(e) => set("documentNumber", e.target.value)} className={inputClass} />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <textarea value={form.internalNotes}
                    onChange={(e) => set("internalNotes", e.target.value)}
                    rows={2} placeholder="Internal notes (not visible to guest)"
                    className={cn(inputClass, "resize-none")} />
                </div>
              </div>
            </div>
          </div>

          {mutation.isError && (
            <p className="px-6 pb-2 text-sm text-red-600">Something went wrong. Please try again.</p>
          )}

          <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
            <button type="button" onClick={onClose}
              className="border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg px-4 py-2 text-sm transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={mutation.isPending}
              className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-60">
              {mutation.isPending ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
