import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Sparkles } from "lucide-react";
import { cn } from "@/lib/cn";
import { housekeepingService, type HousekeepingTaskType, type HousekeepingPriority } from "@/services/housekeeping";
import { roomsService } from "@/services/rooms";
import { useEscapeKey } from "@/hooks/useEscapeKey";

const TASK_TYPE_OPTIONS: { value: HousekeepingTaskType; label: string }[] = [
  { value: "CHECKOUT_CLEAN",    label: "Checkout Clean" },
  { value: "ROUTINE_CLEAN",     label: "Routine Clean" },
  { value: "TURNDOWN",          label: "Turndown" },
  { value: "MAINTENANCE_CLEAN", label: "Maintenance Clean" },
  { value: "INSPECTION",        label: "Inspection" },
];

const PRIORITY_OPTIONS: { value: HousekeepingPriority; label: string }[] = [
  { value: "URGENT", label: "Urgent" },
  { value: "HIGH",   label: "High" },
  { value: "NORMAL", label: "Normal" },
  { value: "LOW",    label: "Low" },
];

const inputCls = "w-full rounded-xl border border-line bg-mist px-3.5 py-2.5 text-[14px] text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-coral/20 focus:border-coral/40 transition-colors";
const labelCls = "block text-[12.5px] font-semibold uppercase tracking-wide text-ink-mute mb-1.5";

export interface AssignTaskModalProps { onClose: () => void }

export function AssignTaskModal({ onClose }: AssignTaskModalProps) {
  useEscapeKey(onClose);
  const qc = useQueryClient();
  const [roomId,        setRoomId]        = useState("");
  const [taskType,      setTaskType]      = useState<HousekeepingTaskType>("ROUTINE_CLEAN");
  const [priority,      setPriority]      = useState<HousekeepingPriority>("NORMAL");
  const [scheduledDate, setScheduledDate] = useState("");
  const [notes,         setNotes]         = useState("");
  const [error,         setError]         = useState<string | null>(null);

  const { data: roomsData } = useQuery({ queryKey: ["rooms"], queryFn: () => roomsService.getRooms() });

  const createMutation = useMutation({
    mutationFn: housekeepingService.createTask,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["housekeeping"] });
      qc.invalidateQueries({ queryKey: ["housekeeping-summary"] });
      onClose();
    },
    onError: (err: { response?: { data?: { error?: string } } }) => {
      setError(err.response?.data?.error ?? "Failed to create task");
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!roomId) { setError("Select a room"); return; }
    setError(null);
    createMutation.mutate({
      roomId, taskType, priority,
      ...(scheduledDate && { scheduledDate }),
      ...(notes.trim()  && { notes: notes.trim() }),
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm p-4 anim-fade-in">
      <div className="bg-paper rounded-2xl shadow-xl w-full max-w-md anim-scale-in">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 pt-6 pb-5 border-b border-line">
          <div className="grid place-items-center h-10 w-10 rounded-xl bg-amber-soft shrink-0">
            <Sparkles size={18} className="text-amber" />
          </div>
          <div className="flex-1"><h2 className="serif text-[20px] text-ink leading-tight">Assign Task</h2></div>
          <button onClick={onClose} className="grid place-items-center h-9 w-9 rounded-full hover:bg-mist text-ink-mute transition-colors -mr-1 -mt-1">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {error && (
            <div className="bg-clay-soft border border-clay/20 text-clay text-[13px] rounded-xl px-4 py-3">{error}</div>
          )}

          <div>
            <label className={labelCls}>Room <span className="text-coral normal-case tracking-normal">*</span></label>
            <select value={roomId} onChange={(e) => setRoomId(e.target.value)} className={cn(inputCls, "cursor-pointer")}>
              <option value="">Select room…</option>
              {roomsData?.data.map((room) => (
                <option key={room.id} value={room.id}>Room {room.number} — {room.roomType.typeName}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelCls}>Task Type <span className="text-coral normal-case tracking-normal">*</span></label>
            <select value={taskType} onChange={(e) => setTaskType(e.target.value as HousekeepingTaskType)} className={cn(inputCls, "cursor-pointer")}>
              {TASK_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          <div>
            <label className={labelCls}>Priority</label>
            <select value={priority} onChange={(e) => setPriority(e.target.value as HousekeepingPriority)} className={cn(inputCls, "cursor-pointer")}>
              {PRIORITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          <div>
            <label className={labelCls}>Assign To <span className="normal-case tracking-normal text-ink-faint font-normal">(optional)</span></label>
            <input type="text" placeholder="Staff name (coming soon)" disabled
              className="w-full rounded-xl border border-line bg-mist/50 px-3.5 py-2.5 text-[14px] text-ink-faint cursor-not-allowed" />
          </div>

          <div>
            <label className={labelCls}>Scheduled For <span className="normal-case tracking-normal text-ink-faint font-normal">(optional)</span></label>
            <input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} className={inputCls} />
          </div>

          <div>
            <label className={labelCls}>Notes <span className="normal-case tracking-normal text-ink-faint font-normal">(optional)</span></label>
            <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="Any special instructions…" className={cn(inputCls, "resize-none")} />
          </div>

          <div className="flex justify-end gap-2.5 pt-1">
            <button type="button" onClick={onClose} className="h-10 px-5 rounded-full border border-line text-ink-soft text-[13.5px] font-semibold hover:bg-mist transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={createMutation.isPending} className="h-10 px-5 rounded-full bg-coral text-white text-[13.5px] font-semibold hover:bg-coral-dark shadow-pop transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              {createMutation.isPending ? "Assigning…" : "Assign Task"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
