import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { X, BedDouble } from "lucide-react";
import { cn } from "../../lib/cn";
import { roomsService, type Room, type UpdateRoomDto } from "../../services/rooms";
import { useEscapeKey } from "@/hooks/useEscapeKey";

const inputCls = "h-11 w-full rounded-xl bg-mist border border-line px-3.5 text-sm text-ink placeholder:text-ink-faint outline-none focus:border-coral focus:ring-2 focus:ring-coral/15 transition-all";
const labelCls = "block text-[12.5px] font-semibold uppercase tracking-wide text-ink-mute mb-1.5";

interface EditRoomModalProps {
  room: Room;
  onClose: () => void;
}

export function EditRoomModal({ room, onClose }: EditRoomModalProps) {
  useEscapeKey(onClose);
  const qc = useQueryClient();
  const [form, setForm] = useState<UpdateRoomDto>({
    number:     room.number,
    floor:      room.floor ?? undefined,
    roomTypeId: room.roomTypeId,
    notes:      room.notes ?? "",
  });

  const { data: roomTypesResp } = useQuery({
    queryKey: ["room-types"],
    queryFn: roomsService.getRoomTypes,
  });
  const roomTypes = roomTypesResp?.data ?? [];

  const mutation = useMutation({
    mutationFn: (dto: UpdateRoomDto) => roomsService.updateRoom(room.id, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rooms"] });
      onClose();
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    mutation.mutate({
      ...form,
      notes: form.notes?.trim() || undefined,
      floor: form.floor ?? undefined,
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm p-4 anim-fade-in"
      onMouseDown={onClose}
    >
      <div
        className="bg-paper rounded-2xl shadow-xl w-full max-w-md anim-scale-in"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-6 pt-6 pb-5 border-b border-line">
          <div className="grid place-items-center h-10 w-10 rounded-xl bg-mist shrink-0">
            <BedDouble size={18} className="text-ink-soft" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="serif text-[20px] text-ink leading-tight">Edit Room</h2>
            <p className="text-[12px] text-ink-mute mt-0.5">Room {room.number}</p>
          </div>
          <button
            onClick={onClose}
            className="grid place-items-center h-9 w-9 rounded-full hover:bg-mist text-ink-mute transition-colors -mr-1 -mt-1"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {mutation.isError && (
            <div className="bg-clay-soft border border-clay/20 text-clay text-[13px] rounded-xl px-4 py-3">
              Something went wrong. Please try again.
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Room number <span className="text-coral text-[15px] font-bold leading-none normal-case tracking-normal">*</span></label>
              <input
                type="text"
                value={form.number ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, number: e.target.value }))}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Floor</label>
              <input
                type="number"
                min={0}
                value={form.floor ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, floor: e.target.value === "" ? undefined : Number(e.target.value) }))}
                className={inputCls}
                placeholder="—"
              />
            </div>
          </div>

          <div>
            <label className={labelCls}>Room type</label>
            <select
              value={form.roomTypeId ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, roomTypeId: e.target.value }))}
              className={cn(inputCls, "cursor-pointer")}
            >
              {roomTypes.map((rt) => (
                <option key={rt.id} value={rt.id}>{rt.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelCls}>Current room state</label>
            <div className="flex h-11 items-center rounded-xl border border-line bg-mist/60 px-3.5 text-sm font-medium text-ink-mute">
              {room.status === "VACANT_CLEAN" ? "Available · Clean" : room.status === "VACANT_DIRTY" ? "Available · Needs cleaning" : room.status === "OCCUPIED" ? "Occupied" : room.status === "UNDER_MAINTENANCE" ? "Under maintenance" : room.status === "OUT_OF_ORDER" ? "Out of order" : "Blocked"}
            </div>
            <p className="mt-1.5 text-[11.5px] text-ink-faint">Updated by reservations, housekeeping, maintenance, and inventory controls.</p>
          </div>

          <div>
            <label className={labelCls}>Notes <span className="normal-case tracking-normal text-ink-faint font-normal">(optional)</span></label>
            <textarea
              value={form.notes ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={2}
              placeholder="Any notes about this room…"
              className={cn(inputCls, "h-auto py-2.5 resize-none")}
            />
          </div>

          <div className="flex justify-end gap-2.5 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="h-10 px-5 rounded-full border border-line text-ink-soft text-[13.5px] font-semibold hover:bg-mist transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="h-10 px-5 rounded-full bg-ink text-white text-[13.5px] font-semibold hover:bg-ink/90 shadow-pop transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {mutation.isPending ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
