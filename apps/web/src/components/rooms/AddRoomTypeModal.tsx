import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Building2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { roomsService, type RoomTypeName, type CreateRoomTypeDto } from "@/services/rooms";
import { useEscapeKey } from "@/hooks/useEscapeKey";

const TYPE_OPTIONS: { value: RoomTypeName; label: string }[] = [
  { value: "SINGLE",        label: "Single" },
  { value: "DOUBLE",        label: "Double" },
  { value: "TWIN",          label: "Twin" },
  { value: "TRIPLE",        label: "Triple" },
  { value: "FAMILY",        label: "Family" },
  { value: "SUITE",         label: "Suite" },
  { value: "DORMITORY",     label: "Dormitory" },
  { value: "COTTAGE",       label: "Cottage" },
  { value: "TENT_GLAMPING", label: "Tent / Glamping" },
];

const inputCls = "w-full rounded-xl border border-line bg-mist px-3.5 py-2.5 text-[14px] text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-coral/20 focus:border-coral/40 transition-colors";
const labelCls = "block text-[12.5px] font-semibold uppercase tracking-wide text-ink-mute mb-1.5";

interface AddRoomTypeModalProps { onClose: () => void }

export function AddRoomTypeModal({ onClose }: AddRoomTypeModalProps) {
  useEscapeKey(onClose);
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: "", typeName: "DOUBLE" as RoomTypeName, description: "", maxOccupancy: "", defaultRate: "" });
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});

  const mutation = useMutation({
    mutationFn: roomsService.createRoomType,
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ["room-types"] }); onClose(); },
  });

  function validate(): boolean {
    const errs: typeof errors = {};
    if (!form.name.trim()) errs.name = "Name is required";
    if (!form.maxOccupancy || Number(form.maxOccupancy) < 1) errs.maxOccupancy = "Must be at least 1";
    if (!form.defaultRate  || Number(form.defaultRate)  < 1) errs.defaultRate  = "Must be greater than 0";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    const dto: CreateRoomTypeDto = {
      name:         form.name.trim(),
      typeName:     form.typeName,
      description:  form.description.trim() || undefined,
      maxOccupancy: Number(form.maxOccupancy),
      defaultRate:  Math.round(Number(form.defaultRate) * 100),
    };
    mutation.mutate(dto);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm p-4 anim-fade-in">
      <div className="bg-paper rounded-2xl shadow-xl w-full max-w-md anim-scale-in">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 pt-6 pb-5 border-b border-line">
          <div className="grid place-items-center h-10 w-10 rounded-xl bg-slate-soft shrink-0">
            <Building2 size={18} className="text-slate" />
          </div>
          <div className="flex-1"><h2 className="serif text-[20px] text-ink leading-tight">Add Room Type</h2></div>
          <button onClick={onClose} className="grid place-items-center h-9 w-9 rounded-full hover:bg-mist text-ink-mute transition-colors -mr-1 -mt-1">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className={labelCls}>Name <span className="text-coral text-[15px] font-bold leading-none normal-case tracking-normal">*</span></label>
            <input type="text" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Deluxe Double"
              className={cn(inputCls, errors.name && "border-clay/50")} />
            {errors.name && <p className="text-[12px] text-clay mt-1">{errors.name}</p>}
          </div>

          <div>
            <label className={labelCls}>Bed Type</label>
            <select value={form.typeName} onChange={(e) => setForm((f) => ({ ...f, typeName: e.target.value as RoomTypeName }))}
              className={cn(inputCls, "cursor-pointer")}>
              {TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          <div>
            <label className={labelCls}>Description</label>
            <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={2} placeholder="Optional description…" className={cn(inputCls, "resize-none")} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Max Occupancy <span className="text-coral text-[15px] font-bold leading-none normal-case tracking-normal">*</span></label>
              <input type="number" min={1} value={form.maxOccupancy}
                onChange={(e) => setForm((f) => ({ ...f, maxOccupancy: e.target.value }))}
                placeholder="2" className={cn(inputCls, errors.maxOccupancy && "border-clay/50")} />
              {errors.maxOccupancy && <p className="text-[12px] text-clay mt-1">{errors.maxOccupancy}</p>}
            </div>
            <div>
              <label className={labelCls}>Base Rate (PKR) <span className="text-coral text-[15px] font-bold leading-none normal-case tracking-normal">*</span></label>
              <input type="number" min={1} value={form.defaultRate}
                onChange={(e) => setForm((f) => ({ ...f, defaultRate: e.target.value }))}
                placeholder="5000" className={cn(inputCls, errors.defaultRate && "border-clay/50")} />
              {errors.defaultRate && <p className="text-[12px] text-clay mt-1">{errors.defaultRate}</p>}
            </div>
          </div>

          {mutation.isError && (
            <div className="bg-clay-soft border border-clay/20 text-clay text-[13px] rounded-xl px-4 py-3">
              Something went wrong. Please try again.
            </div>
          )}

          <div className="flex justify-end gap-2.5 pt-1">
            <button type="button" onClick={onClose} className="h-10 px-5 rounded-full border border-line text-ink-soft text-[13.5px] font-semibold hover:bg-mist transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={mutation.isPending} className="h-10 px-5 rounded-full bg-coral text-white text-[13.5px] font-semibold hover:bg-coral-dark shadow-pop transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              {mutation.isPending ? "Saving…" : "Add Room Type"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
