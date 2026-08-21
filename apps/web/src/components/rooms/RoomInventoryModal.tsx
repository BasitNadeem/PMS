import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CalendarOff, RotateCcw, X } from "lucide-react";
import { DatePicker } from "@/components/ui/DatePicker";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { getErrorMessage } from "@/lib/api";
import {
  roomsService,
  type Room,
  type RoomInventoryBlockType,
} from "@/services/rooms";

const labelClass = "mb-1.5 block text-[11px] font-bold uppercase tracking-[0.12em] text-ink-faint";
const inputClass = "h-11 w-full rounded-xl border border-line bg-card px-3.5 text-[13.5px] text-ink outline-none transition focus:border-coral focus:ring-2 focus:ring-coral/15";

function dateOnly(value: string): string {
  return value.slice(0, 10);
}

function displayDate(value: string): string {
  return new Intl.DateTimeFormat("en-PK", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(value));
}

export function RoomInventoryModal({ room, onClose }: { room: Room; onClose: () => void }) {
  useEscapeKey(onClose);
  const queryClient = useQueryClient();
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
  const tomorrow = new Date(`${today}T00:00:00Z`);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const [type, setType] = useState<RoomInventoryBlockType>("OUT_OF_ORDER");
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(tomorrow.toISOString().slice(0, 10));
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  const blocksQuery = useQuery({
    queryKey: ["room-inventory-blocks", room.id],
    queryFn: () => roomsService.getInventoryBlocks(room.id),
  });
  const activeBlocks = (blocksQuery.data ?? []).filter(
    (block) => !block.cancelledAt && dateOnly(block.endDate) > today,
  );
  const history = (blocksQuery.data ?? []).filter(
    (block) => Boolean(block.cancelledAt) || dateOnly(block.endDate) <= today,
  );

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["room-inventory-blocks", room.id] });
    void queryClient.invalidateQueries({ queryKey: ["rooms"] });
  }

  const createMutation = useMutation({
    mutationFn: () => roomsService.createInventoryBlock(room.id, {
      type, startDate, endDate, reason: reason.trim(), notes: notes.trim() || undefined,
    }),
    onSuccess: () => {
      refresh();
      setReason("");
      setNotes("");
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => roomsService.cancelInventoryBlock(room.id, cancelId!, cancelReason.trim()),
    onSuccess: () => {
      refresh();
      setCancelId(null);
      setCancelReason("");
    },
  });

  const error = createMutation.error ?? cancelMutation.error;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/45 p-4 backdrop-blur-sm anim-fade-in" onMouseDown={onClose}>
      <div className="flex max-h-[calc(100dvh-2rem)] w-full max-w-[720px] flex-col overflow-hidden rounded-[24px] border border-white/50 bg-paper shadow-[0_28px_80px_rgba(31,27,23,0.24)] anim-scale-in" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-center gap-4 border-b border-line px-7 py-6">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-coral-soft text-coral"><CalendarOff size={22} /></span>
          <div className="min-w-0 flex-1">
            <div className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-coral">Sellable inventory</div>
            <h2 className="serif text-[25px] leading-tight text-ink">Room {room.number}</h2>
            <p className="mt-0.5 text-[12.5px] text-ink-mute">Remove this room from sale for specific nights.</p>
          </div>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full text-ink-mute transition hover:bg-mist hover:text-ink"><X size={18} /></button>
        </div>

        <div className="overflow-y-auto px-7 py-6">
          {error && <div role="alert" className="mb-5 flex gap-2.5 rounded-xl border border-clay/25 bg-clay-soft px-4 py-3 text-[12.5px] leading-relaxed text-clay"><AlertTriangle size={16} className="mt-0.5 shrink-0" />{getErrorMessage(error)}</div>}

          <section className="rounded-2xl border border-line bg-card p-5">
            <h3 className="text-[14px] font-semibold text-ink">Add inventory block</h3>
            <p className="mt-1 text-[12px] text-ink-mute">The end date is the first night the room becomes sellable again.</p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div><label className={labelClass}>Block type</label><select value={type} onChange={(event) => setType(event.target.value as RoomInventoryBlockType)} className={inputClass}><option value="OUT_OF_ORDER">Out of order</option><option value="OUT_OF_SERVICE">Out of service</option></select></div>
              <div><label className={labelClass}>Reason</label><input value={reason} onChange={(event) => setReason(event.target.value)} className={inputClass} placeholder="For example: Private event hold" /></div>
              <div><label className={labelClass}>From</label><DatePicker value={startDate} onChange={setStartDate} min={today} max={endDate || undefined} /></div>
              <div><label className={labelClass}>Sell again from</label><DatePicker value={endDate} onChange={setEndDate} min={startDate || today} /></div>
            </div>
            <div className="mt-4"><label className={labelClass}>Internal notes <span className="normal-case tracking-normal font-normal">(optional)</span></label><textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={2} className={`${inputClass} h-auto resize-none py-3`} placeholder="Details for maintenance or front desk…" /></div>
            <div className="mt-5 flex justify-end"><button onClick={() => createMutation.mutate()} disabled={reason.trim().length < 3 || !startDate || endDate <= startDate || createMutation.isPending} className="h-10 rounded-full bg-coral px-5 text-[13px] font-semibold text-white transition hover:bg-coral-dark disabled:cursor-not-allowed disabled:opacity-40">{createMutation.isPending ? "Saving…" : "Remove from inventory"}</button></div>
          </section>

          <section className="mt-5">
            <div className="mb-3 flex items-end justify-between"><div><h3 className="text-[14px] font-semibold text-ink">Scheduled blocks</h3><p className="text-[12px] text-ink-mute">Current and upcoming inventory removals.</p></div><span className="text-[11px] font-bold text-ink-faint">{activeBlocks.length}</span></div>
            {blocksQuery.isLoading ? <div className="h-24 animate-pulse rounded-2xl bg-line-soft" /> : activeBlocks.length === 0 ? <div className="rounded-2xl border border-dashed border-line px-5 py-8 text-center text-[13px] text-ink-mute">No scheduled inventory blocks.</div> : <div className="space-y-2.5">{activeBlocks.map((block) => <div key={block.id} className="rounded-2xl border border-line bg-card px-4 py-3.5"><div className="flex items-start justify-between gap-4"><div><div className="flex flex-wrap items-center gap-2"><span className="text-[13px] font-semibold text-ink">{block.type === "OUT_OF_ORDER" ? "Out of order" : "Out of service"}</span><span className="rounded-full bg-amber-soft px-2 py-0.5 text-[10px] font-bold text-amber">{displayDate(block.startDate)} – {displayDate(block.endDate)}</span>{block.maintenanceTicketId && <span className="rounded-full bg-coral-soft px-2 py-0.5 text-[10px] font-bold text-coral">Managed by maintenance</span>}</div><p className="mt-1 text-[12.5px] text-ink-soft">{block.reason}</p>{block.notes && <p className="mt-1 text-[11.5px] text-ink-mute">{block.notes}</p>}</div>{block.maintenanceTicketId ? <span className="shrink-0 text-[11.5px] font-semibold text-ink-faint">Resolve or edit ticket</span> : <button onClick={() => setCancelId(block.id)} className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-[11.5px] font-semibold text-ink-mute hover:border-coral/30 hover:text-coral"><RotateCcw size={13} />Restore</button>}</div>{!block.maintenanceTicketId && cancelId === block.id && <div className="mt-3 flex gap-2 border-t border-line-soft pt-3"><input autoFocus value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} className={`${inputClass} h-9`} placeholder="Why is the room being restored?" /><button onClick={() => cancelMutation.mutate()} disabled={cancelReason.trim().length < 3 || cancelMutation.isPending} className="shrink-0 rounded-full bg-ink px-4 text-[12px] font-semibold text-white disabled:opacity-40">Confirm</button></div>}</div>)}</div>}
          </section>

          {history.length > 0 && <details className="mt-5 rounded-2xl border border-line bg-card"><summary className="cursor-pointer px-4 py-3 text-[12.5px] font-semibold text-ink">Inventory history ({history.length})</summary><div className="border-t border-line-soft px-4 py-3 space-y-2">{history.map((block) => <div key={block.id} className="text-[11.5px] text-ink-mute"><span className="font-semibold text-ink-soft">{dateOnly(block.startDate)} – {dateOnly(block.endDate)}</span> · {block.reason}{block.cancelReason ? ` · Restored: ${block.cancelReason}` : " · Completed"}</div>)}</div></details>}
        </div>
      </div>
    </div>
  );
}
