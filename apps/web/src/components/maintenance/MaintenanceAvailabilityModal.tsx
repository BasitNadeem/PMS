import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarOff, X } from "lucide-react";
import { DatePicker } from "@/components/ui/DatePicker";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { getErrorMessage } from "@/lib/api";
import { maintenanceService, type MaintenanceTicket } from "@/services/maintenance";

function dateOnly(value: string): string { return value.slice(0, 10); }
function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function MaintenanceAvailabilityModal({ ticket, onClose }: { ticket: MaintenanceTicket; onClose: () => void }) {
  useEscapeKey(onClose);
  const queryClient = useQueryClient();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const existingActive = Boolean(ticket.inventoryBlock && !ticket.inventoryBlock.cancelledAt);
  const [roomUnavailable, setRoomUnavailable] = useState(existingActive);
  const [unavailableFrom, setUnavailableFrom] = useState(ticket.inventoryBlock ? dateOnly(ticket.inventoryBlock.startDate) : today);
  const [sellableFrom, setSellableFrom] = useState(ticket.inventoryBlock ? dateOnly(ticket.inventoryBlock.endDate) : addDays(today, 1));

  const mutation = useMutation({
    mutationFn: () => maintenanceService.updateTicket(ticket.id, {
      roomUnavailable,
      ...(roomUnavailable && { unavailableFrom, sellableFrom }),
    }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["maintenance"] });
      void queryClient.invalidateQueries({ queryKey: ["rooms"] });
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/45 p-4 backdrop-blur-sm anim-fade-in" onMouseDown={onClose}>
      <div className="w-full max-w-[560px] overflow-hidden rounded-[24px] border border-white/50 bg-paper shadow-[0_28px_80px_rgba(31,27,23,0.24)] anim-scale-in" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-center gap-4 border-b border-line px-7 py-6">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-coral-soft text-coral"><CalendarOff size={22} /></span>
          <div className="min-w-0 flex-1"><div className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-coral">Sellable inventory</div><h2 className="serif text-[25px] leading-tight text-ink">Room availability</h2><p className="mt-0.5 truncate text-[12.5px] text-ink-mute">Room {ticket.room?.number} · {ticket.ticketNumber}</p></div>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full text-ink-mute hover:bg-mist hover:text-ink"><X size={18} /></button>
        </div>

        <div className="space-y-5 px-7 py-6">
          {mutation.isError && <div role="alert" className="rounded-xl border border-clay/25 bg-clay-soft px-4 py-3 text-[12.5px] text-clay">{getErrorMessage(mutation.error)}</div>}
          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-line bg-card p-4">
            <input type="checkbox" checked={roomUnavailable} onChange={(event) => setRoomUnavailable(event.target.checked)} className="mt-0.5 h-4 w-4 accent-coral" />
            <span><span className="block text-[13.5px] font-semibold text-ink">Room unavailable for sale</span><span className="mt-0.5 block text-[12px] leading-relaxed text-ink-mute">Turning this off restores the room immediately while keeping the maintenance ticket open.</span></span>
          </label>
          {roomUnavailable && <div className="grid gap-4 sm:grid-cols-2"><div><label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.12em] text-ink-faint">Unavailable from</label><DatePicker value={unavailableFrom} onChange={(value) => { setUnavailableFrom(value); if (sellableFrom <= value) setSellableFrom(addDays(value, 1)); }} min={today} max={sellableFrom} /></div><div><label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.12em] text-ink-faint">Sell again from</label><DatePicker value={sellableFrom} onChange={setSellableFrom} min={addDays(unavailableFrom, 1)} /></div></div>}
          <p className="text-[11.5px] leading-relaxed text-ink-mute">Saving updates the linked inventory block everywhere. The change is refused if an active reservation overlaps the selected nights.</p>
        </div>
        <div className="flex justify-end gap-2.5 border-t border-line px-7 py-5"><button onClick={onClose} className="h-10 rounded-full border border-line px-5 text-[13px] font-semibold text-ink-soft">Cancel</button><button onClick={() => mutation.mutate()} disabled={mutation.isPending || (roomUnavailable && (!unavailableFrom || sellableFrom <= unavailableFrom))} className="h-10 rounded-full bg-coral px-5 text-[13px] font-semibold text-white disabled:opacity-40">{mutation.isPending ? "Saving…" : "Save availability"}</button></div>
      </div>
    </div>
  );
}
