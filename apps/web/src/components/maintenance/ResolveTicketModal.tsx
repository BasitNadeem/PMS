import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { maintenanceService, type MaintenanceTicket } from "@/services/maintenance";
import { useEscapeKey } from "@/hooks/useEscapeKey";

const inputCls = "w-full rounded-xl border border-line bg-mist px-3.5 py-2.5 text-[14px] text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-coral/20 focus:border-coral/40 transition-colors";
const labelCls = "block text-[12.5px] font-semibold uppercase tracking-wide text-ink-mute mb-1.5";

export interface ResolveTicketModalProps {
  ticket: MaintenanceTicket;
  onClose: () => void;
}

export function ResolveTicketModal({ ticket, onClose }: ResolveTicketModalProps) {
  useEscapeKey(onClose);
  const qc = useQueryClient();
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => maintenanceService.updateTicketStatus(ticket.id, { status: "RESOLVED", resolutionNotes: notes.trim() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["maintenance"] });
      qc.invalidateQueries({ queryKey: ["maintenance-summary"] });
      onClose();
    },
    onError: (err: { response?: { data?: { error?: string } } }) => {
      setError(err.response?.data?.error ?? "Failed to resolve ticket");
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!notes.trim()) { setError("Resolution notes are required"); return; }
    setError(null);
    mutation.mutate();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm p-4 anim-fade-in">
      <div className="bg-paper rounded-2xl shadow-xl w-full max-w-md anim-scale-in">
        <div className="flex items-center gap-3 px-6 pt-6 pb-5 border-b border-line">
          <div className="grid place-items-center h-10 w-10 rounded-xl bg-pine-soft shrink-0">
            <CheckCircle2 size={18} className="text-pine" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="serif text-[20px] text-ink leading-tight">Resolve Ticket</h2>
            <p className="text-[12.5px] text-ink-mute truncate">{ticket.ticketNumber} — {ticket.title}</p>
          </div>
          <button onClick={onClose} className="grid place-items-center h-9 w-9 rounded-full hover:bg-mist text-ink-mute transition-colors -mr-1 -mt-1 shrink-0">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {error && (
            <div className="bg-clay-soft border border-clay/20 text-clay text-[13px] rounded-xl px-4 py-3">{error}</div>
          )}

          <div>
            <label className={labelCls}>Resolution Notes <span className="text-coral normal-case tracking-normal">*</span></label>
            <textarea
              rows={4}
              autoFocus
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What was done to fix this?"
              className={cn(inputCls, "resize-none")}
            />
          </div>

          <div className="flex justify-end gap-2.5 pt-1">
            <button type="button" onClick={onClose} className="h-10 px-5 rounded-full border border-line text-ink-soft text-[13.5px] font-semibold hover:bg-mist transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={mutation.isPending} className="h-10 px-5 rounded-full bg-pine text-white text-[13.5px] font-semibold hover:bg-pine-deep shadow-pop transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              {mutation.isPending ? "Saving…" : "Mark Resolved"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
