import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { cn } from "../../lib/cn";
import { roomsService, type Room, type RoomStatus, type UpdateRoomDto } from "../../services/rooms";
import { useEscapeKey } from "@/hooks/useEscapeKey";

const STATUS_OPTIONS: { value: RoomStatus; label: string }[] = [
  { value: "VACANT_CLEAN",      label: "Available (Clean)" },
  { value: "VACANT_DIRTY",      label: "Available (Dirty)" },
  { value: "OCCUPIED",          label: "Occupied" },
  { value: "UNDER_MAINTENANCE", label: "Maintenance" },
  { value: "BLOCKED",           label: "Blocked" },
  { value: "OUT_OF_ORDER",      label: "Out of Order" },
];

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
    status:     room.status,
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
    const dto: UpdateRoomDto = {
      ...form,
      notes: form.notes?.trim() || undefined,
      floor: form.floor ?? undefined,
    };
    mutation.mutate(dto);
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-gray-900">Edit Room {room.number}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Room Number <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.number ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, number: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Floor</label>
            <input
              type="number"
              min={0}
              value={form.floor ?? ""}
              onChange={(e) =>
                setForm((f) => ({ ...f, floor: e.target.value === "" ? undefined : Number(e.target.value) }))
              }
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Room Type</label>
            <select
              value={form.roomTypeId ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, roomTypeId: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {roomTypes.map((rt) => (
                <option key={rt.id} value={rt.id}>{rt.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={form.status ?? "VACANT_CLEAN"}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as RoomStatus }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={form.notes ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          {mutation.isError && (
            <p className="text-sm text-red-600">Something went wrong. Please try again.</p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg px-4 py-2 text-sm transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-60"
            >
              {mutation.isPending ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
