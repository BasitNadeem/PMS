import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Wrench } from "lucide-react";
import { cn } from "@/lib/cn";
import { maintenanceService, type MaintenanceCategory, type MaintenancePriority } from "@/services/maintenance";
import { roomsService } from "@/services/rooms";
import { useEscapeKey } from "@/hooks/useEscapeKey";

const CATEGORY_OPTIONS: { value: MaintenanceCategory; label: string }[] = [
  { value: "ELECTRICAL",   label: "Electrical" },
  { value: "PLUMBING",     label: "Plumbing" },
  { value: "HVAC",         label: "HVAC" },
  { value: "FURNITURE",    label: "Furniture" },
  { value: "ELECTRONICS",  label: "Electronics" },
  { value: "STRUCTURAL",   label: "Structural" },
  { value: "OTHER",        label: "Other" },
];

const PRIORITY_OPTIONS: { value: MaintenancePriority; label: string }[] = [
  { value: "URGENT", label: "Urgent" },
  { value: "HIGH",   label: "High" },
  { value: "MEDIUM", label: "Medium" },
  { value: "LOW",    label: "Low" },
];

const inputCls = "w-full rounded-xl border border-line bg-mist px-3.5 py-2.5 text-[14px] text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-coral/20 focus:border-coral/40 transition-colors";
const labelCls = "block text-[12.5px] font-semibold uppercase tracking-wide text-ink-mute mb-1.5";

export interface CreateTicketModalProps {
  onClose: () => void;
  initialRoomId?: string;
  initialRoomNumber?: string;
}

export function CreateTicketModal({ onClose, initialRoomId, initialRoomNumber }: CreateTicketModalProps) {
  useEscapeKey(onClose);
  const qc = useQueryClient();
  const [roomId,      setRoomId]      = useState(initialRoomId ?? "");
  const [title,       setTitle]       = useState("");
  const [description, setDescription] = useState("");
  const [category,    setCategory]    = useState<MaintenanceCategory>("OTHER");
  const [priority,    setPriority]    = useState<MaintenancePriority>("MEDIUM");
  const [error,       setError]       = useState<string | null>(null);

  const { data: roomsData } = useQuery({
    queryKey: ["rooms"],
    queryFn:  () => roomsService.getRooms(),
    enabled:  !initialRoomId,
  });

  const createMutation = useMutation({
    mutationFn: maintenanceService.createTicket,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["maintenance"] });
      qc.invalidateQueries({ queryKey: ["maintenance-summary"] });
      onClose();
    },
    onError: (err: { response?: { data?: { error?: string } } }) => {
      setError(err.response?.data?.error ?? "Failed to create ticket");
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setError("Title is required"); return; }
    setError(null);
    createMutation.mutate({
      title: title.trim(),
      category,
      priority,
      ...(roomId && { roomId }),
      ...(description.trim() && { description: description.trim() }),
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm p-4 anim-fade-in">
      <div className="bg-paper rounded-2xl shadow-xl w-full max-w-md anim-scale-in">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 pt-6 pb-5 border-b border-line">
          <div className="grid place-items-center h-10 w-10 rounded-xl bg-clay-soft shrink-0">
            <Wrench size={18} className="text-clay" />
          </div>
          <div className="flex-1"><h2 className="serif text-[20px] text-ink leading-tight">Report Issue</h2></div>
          <button onClick={onClose} className="grid place-items-center h-9 w-9 rounded-full hover:bg-mist text-ink-mute transition-colors -mr-1 -mt-1">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {error && (
            <div className="bg-clay-soft border border-clay/20 text-clay text-[13px] rounded-xl px-4 py-3">{error}</div>
          )}

          <div>
            <label className={labelCls}>Title <span className="text-coral normal-case tracking-normal">*</span></label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. AC not cooling" className={inputCls} />
          </div>

          <div>
            <label className={labelCls}>Room <span className="normal-case tracking-normal text-ink-faint font-normal">(optional)</span></label>
            {initialRoomId ? (
              <div className={cn(inputCls, "bg-mist/50 text-ink-mute")}>Room {initialRoomNumber}</div>
            ) : (
              <select value={roomId} onChange={(e) => setRoomId(e.target.value)} className={cn(inputCls, "cursor-pointer")}>
                <option value="">No specific room</option>
                {roomsData?.data.map((room) => (
                  <option key={room.id} value={room.id}>Room {room.number} — {room.roomType.typeName}</option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className={labelCls}>Category <span className="text-coral normal-case tracking-normal">*</span></label>
            <select value={category} onChange={(e) => setCategory(e.target.value as MaintenanceCategory)} className={cn(inputCls, "cursor-pointer")}>
              {CATEGORY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          <div>
            <label className={labelCls}>Priority</label>
            <select value={priority} onChange={(e) => setPriority(e.target.value as MaintenancePriority)} className={cn(inputCls, "cursor-pointer")}>
              {PRIORITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          <div>
            <label className={labelCls}>Description <span className="normal-case tracking-normal text-ink-faint font-normal">(optional)</span></label>
            <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the issue…" className={cn(inputCls, "resize-none")} />
          </div>

          <div className="flex justify-end gap-2.5 pt-1">
            <button type="button" onClick={onClose} className="h-10 px-5 rounded-full border border-line text-ink-soft text-[13.5px] font-semibold hover:bg-mist transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={createMutation.isPending} className="h-10 px-5 rounded-full bg-coral text-white text-[13.5px] font-semibold hover:bg-coral-dark shadow-pop transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              {createMutation.isPending ? "Submitting…" : "Submit Ticket"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
