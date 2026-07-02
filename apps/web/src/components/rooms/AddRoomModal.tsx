import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { X, BedDouble } from "lucide-react";
import { cn } from "@/lib/cn";
import { roomsService, type RoomStatus, type CreateRoomDto } from "@/services/rooms";
import { useEscapeKey } from "@/hooks/useEscapeKey";

const STATUS_OPTIONS: { value: RoomStatus; label: string }[] = [
  { value: "VACANT_CLEAN",      label: "Available (Clean)" },
  { value: "UNDER_MAINTENANCE", label: "Maintenance" },
  { value: "OUT_OF_ORDER",      label: "Out of Order" },
];

const inputCls = "w-full rounded-xl border border-line bg-mist px-3.5 py-2.5 text-[14px] text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-coral/20 focus:border-coral/40 transition-colors";
const labelCls = "block text-[12.5px] font-semibold uppercase tracking-wide text-ink-mute mb-1.5";

interface AddRoomModalProps { onClose: () => void }

export function AddRoomModal({ onClose }: AddRoomModalProps) {
  useEscapeKey(onClose);
  const qc = useQueryClient();
  const [form, setForm] = useState<CreateRoomDto>({ number: "", floor: undefined, roomTypeId: "", status: "VACANT_CLEAN", notes: "" });
  const [errors, setErrors] = useState<Partial<Record<keyof CreateRoomDto, string>>>({});

  const { data: roomTypesResp } = useQuery({ queryKey: ["room-types"], queryFn: roomsService.getRoomTypes });
  const roomTypes = roomTypesResp?.data ?? [];

  const mutation = useMutation({
    mutationFn: roomsService.createRoom,
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ["rooms"] }); onClose(); },
  });

  function validate(): boolean {
    const errs: typeof errors = {};
    if (!form.number.trim()) errs.number = "Room number is required";
    if (!form.roomTypeId)    errs.roomTypeId = "Room type is required";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    mutation.mutate({ ...form, notes: form.notes?.trim() || undefined, floor: form.floor ?? undefined });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm p-4 anim-fade-in">
      <div className="bg-paper rounded-2xl shadow-xl w-full max-w-md anim-scale-in">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 pt-6 pb-5 border-b border-line">
          <div className="grid place-items-center h-10 w-10 rounded-xl bg-coral-soft shrink-0">
            <BedDouble size={18} className="text-coral" />
          </div>
          <div className="flex-1"><h2 className="serif text-[20px] text-ink leading-tight">Add Room</h2></div>
          <button onClick={onClose} className="grid place-items-center h-9 w-9 rounded-full hover:bg-mist text-ink-mute transition-colors -mr-1 -mt-1">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className={labelCls}>Room Number <span className="text-coral text-[15px] font-bold leading-none normal-case tracking-normal">*</span></label>
            <input type="text" value={form.number} onChange={(e) => setForm((f) => ({ ...f, number: e.target.value }))}
              placeholder="e.g. 101"
              className={cn(inputCls, errors.number && "border-clay/50")} />
            {errors.number && <p className="text-[12px] text-clay mt-1">{errors.number}</p>}
          </div>

          <div>
            <label className={labelCls}>Floor</label>
            <input type="number" min={0} value={form.floor ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, floor: e.target.value === "" ? undefined : Number(e.target.value) }))}
              placeholder="e.g. 1" className={inputCls} />
          </div>

          <div>
            <label className={labelCls}>Room Type <span className="text-coral text-[15px] font-bold leading-none normal-case tracking-normal">*</span></label>
            <select value={form.roomTypeId} onChange={(e) => setForm((f) => ({ ...f, roomTypeId: e.target.value }))}
              className={cn(inputCls, "cursor-pointer", errors.roomTypeId && "border-clay/50")}>
              <option value="">Select room type…</option>
              {roomTypes.map((rt) => <option key={rt.id} value={rt.id}>{rt.name}</option>)}
            </select>
            {errors.roomTypeId && <p className="text-[12px] text-clay mt-1">{errors.roomTypeId}</p>}
          </div>

          <div>
            <label className={labelCls}>Status</label>
            <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as RoomStatus }))}
              className={cn(inputCls, "cursor-pointer")}>
              {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          <div>
            <label className={labelCls}>Notes</label>
            <textarea value={form.notes ?? ""} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={2} placeholder="Optional notes…" className={cn(inputCls, "resize-none")} />
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
              {mutation.isPending ? "Saving…" : "Add Room"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
