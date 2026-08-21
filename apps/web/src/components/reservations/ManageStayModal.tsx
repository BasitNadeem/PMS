import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, BedDouble, CircleDollarSign, Info, X } from "lucide-react";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { reservationsService, type ManageCheckedInStayDto, type ReservationDetail } from "@/services/reservations";
import { roomsService } from "@/services/rooms";
import { DatePicker } from "@/components/ui/DatePicker";
import { getErrorMessage } from "@/lib/api";

const inputCls = "w-full rounded-xl border border-line bg-mist px-3.5 py-2.5 text-[14px] text-ink outline-none transition-colors focus:border-coral/40 focus:ring-2 focus:ring-coral/15";
const labelCls = "mb-1.5 block text-[11.5px] font-bold uppercase tracking-wider text-ink-mute";

interface Props {
  reservation: ReservationDetail;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export function ManageStayModal({ reservation, onClose, onSuccess }: Props) {
  useEscapeKey(onClose);
  const qc = useQueryClient();
  const current = reservation.rooms[0];
  const [activeTask, setActiveTask] = useState<"ROOM" | "DATES">("ROOM");
  const [newRoomId, setNewRoomId] = useState("");
  const originalCheckOut = reservation.checkOutDate.slice(0, 10);
  const [checkOutDate, setCheckOutDate] = useState(originalCheckOut);
  const [earlyDepartureTreatment, setEarlyDepartureTreatment] = useState<ManageCheckedInStayDto["earlyDepartureTreatment"]>("KEEP_ORIGINAL_CHARGES");
  const [earlyDepartureCredit, setEarlyDepartureCredit] = useState("");
  const [pricingMode, setPricingMode] = useState<ManageCheckedInStayDto["pricingMode"]>("KEEP_RATE");
  const [customRate, setCustomRate] = useState("");
  const [rebate, setRebate] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saveConflict, setSaveConflict] = useState<string | null>(null);

  const { data: roomResult, isLoading } = useQuery({
    queryKey: ["rooms", "manage-stay"],
    queryFn: () => roomsService.getRooms(),
  });
  const availableRooms = useMemo(
    () => (roomResult?.data ?? []).filter((room) => room.id !== current?.roomId),
    [roomResult?.data, current?.roomId],
  );
  const selectedRoom = availableRooms.find((room) => room.id === newRoomId);
  const targetRoomId = newRoomId || current?.roomId || "";
  const todayInPakistan = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const availabilityFrom = reservation.checkInDate.slice(0, 10) > todayInPakistan
    ? reservation.checkInDate.slice(0, 10)
    : todayInPakistan;
  const shouldCheckAvailability = Boolean(targetRoomId)
    && checkOutDate > availabilityFrom
    && (Boolean(newRoomId) || checkOutDate > originalCheckOut);
  const { data: liveAvailability, isFetching: checkingAvailability } = useQuery({
    queryKey: ["room-availability-manage-stay", targetRoomId, availabilityFrom, checkOutDate, reservation.id],
    queryFn: () => roomsService.checkAvailability({
      roomId: targetRoomId,
      checkInDate: availabilityFrom,
      checkOutDate,
      excludeReservationId: reservation.id,
    }),
    enabled: shouldCheckAvailability,
    staleTime: 0,
  });
  const liveConflict = liveAvailability?.conflicts[0] ?? null;
  const availabilityError = liveConflict
    ? liveConflict.conflictType === "INVENTORY_BLOCK"
      ? `Room ${liveConflict.roomNumber} is ${liveConflict.inventoryBlockType === "OUT_OF_ORDER" ? "out of order" : "out of service"} from ${new Date(liveConflict.checkInDate).toLocaleDateString("en-PK", { day: "numeric", month: "short", timeZone: "UTC" })} to ${new Date(liveConflict.checkOutDate).toLocaleDateString("en-PK", { day: "numeric", month: "short", timeZone: "UTC" })}${liveConflict.reason ? ` (${liveConflict.reason})` : ""}. Please choose a different room or date.`
      : `Room ${liveConflict.roomNumber} is already booked for ${liveConflict.guestName} from ${new Date(liveConflict.checkInDate).toLocaleDateString("en-PK", { day: "numeric", month: "short", timeZone: "UTC" })} to ${new Date(liveConflict.checkOutDate).toLocaleDateString("en-PK", { day: "numeric", month: "short", timeZone: "UTC" })} (Res ID ${liveConflict.confirmationNumber}). Please choose a different room or date.`
    : saveConflict;

  const mutation = useMutation({
    mutationFn: () => reservationsService.manageCheckedInStay(reservation.id, {
      newRoomId: newRoomId || undefined,
      checkOutDate: checkOutDate !== originalCheckOut ? checkOutDate : undefined,
      earlyDepartureTreatment: checkOutDate < originalCheckOut ? earlyDepartureTreatment : "KEEP_ORIGINAL_CHARGES",
      earlyDepartureCreditAmount: checkOutDate < originalCheckOut && earlyDepartureTreatment === "CUSTOM_CREDIT" ? Math.round(Number(earlyDepartureCredit) * 100) : undefined,
      pricingMode,
      customRatePerNight: pricingMode === "CUSTOM_RATE" ? Math.round(Number(customRate) * 100) : undefined,
      rebateAmount: rebate ? Math.round(Number(rebate) * 100) : 0,
      reason: reason.trim(),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reservation", reservation.id] });
      qc.invalidateQueries({ queryKey: ["reservations"] });
      qc.invalidateQueries({ queryKey: ["rooms"] });
      qc.invalidateQueries({ queryKey: ["folio", reservation.id] });
      qc.invalidateQueries({ queryKey: ["billing-folios"] });
      qc.invalidateQueries({ queryKey: ["housekeeping-tasks"] });
      onClose();
      onSuccess("Stay updated and recorded on the folio");
    },
    onError: (err: unknown) => {
      const message = getErrorMessage(err, "Failed to update the stay");
      if (message.includes("already booked")) setSaveConflict(message);
      else setError(message);
    },
  });

  const customRateValid = pricingMode !== "CUSTOM_RATE" || Number(customRate) > 0;
  const checkOutValid = Boolean(checkOutDate) && checkOutDate > reservation.checkInDate.slice(0, 10);
  const isEarlyDeparture = checkOutDate < originalCheckOut;
  const earlyDepartureCreditValid = !isEarlyDeparture || earlyDepartureTreatment !== "CUSTOM_CREDIT" || Number(earlyDepartureCredit) > 0;
  const hasChange = Boolean(newRoomId) || checkOutDate !== originalCheckOut || Number(rebate) > 0 || pricingMode !== "KEEP_RATE";
  const canSubmit = hasChange && checkOutValid && customRateValid && earlyDepartureCreditValid
    && reason.trim().length >= 3 && !mutation.isPending && !checkingAvailability && !availabilityError;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/45 p-4 backdrop-blur-sm anim-fade-in" onMouseDown={onClose}>
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-line bg-paper shadow-pop anim-scale-in" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-start gap-3 border-b border-line px-6 py-5">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-coral-soft text-coral"><BedDouble size={20} /></div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-coral">Checked-in stay</div>
            <h2 className="serif text-[25px] leading-tight text-ink">Edit checked-in stay</h2>
            <p className="mt-0.5 text-[12.5px] text-ink-mute">{reservation.guest.fullName} · {reservation.confirmationNumber}</p>
          </div>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full text-ink-mute hover:bg-mist" aria-label="Close"><X size={18} /></button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          {error && <div className="rounded-xl border border-clay/20 bg-clay-soft px-4 py-3 text-[13px] text-clay">{error}</div>}

          <div className="grid grid-cols-2 border-b border-line" role="tablist" aria-label="Stay change type">
            <button
              type="button"
              role="tab"
              aria-selected={activeTask === "ROOM"}
              onClick={() => setActiveTask("ROOM")}
              className={`relative flex h-12 items-center justify-center rounded-t-xl px-1 text-center text-[13.5px] transition-colors ${activeTask === "ROOM" ? "bg-coral-soft/70 font-black text-coral" : "font-semibold text-ink hover:text-coral"}`}
            >
              <span className="inline-flex items-center gap-2">Room & rate {(newRoomId || pricingMode !== "KEEP_RATE" || Number(rebate) > 0) && <span className="h-1.5 w-1.5 rounded-full bg-coral" />}</span>
              {activeTask === "ROOM" && <span className="absolute inset-x-0 -bottom-px h-0.5 bg-coral" />}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTask === "DATES"}
              onClick={() => setActiveTask("DATES")}
              className={`relative flex h-12 items-center justify-center rounded-t-xl px-1 text-center text-[13.5px] transition-colors ${activeTask === "DATES" ? "bg-coral-soft/70 font-black text-coral" : "font-semibold text-ink hover:text-coral"}`}
            >
              <span className="inline-flex items-center gap-2">Dates & charges {checkOutDate !== originalCheckOut && <span className="h-1.5 w-1.5 rounded-full bg-coral" />}</span>
              {activeTask === "DATES" && <span className="absolute inset-x-0 -bottom-px h-0.5 bg-coral" />}
            </button>
          </div>

          {activeTask === "ROOM" && <>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-xl2 border border-line bg-card p-4">
            <div><div className="text-[10.5px] font-bold uppercase tracking-wider text-ink-faint">Current room</div><div className="mt-1 font-semibold text-ink">{current ? `Room ${current.room.number}` : "—"}</div><div className="text-[12px] text-ink-mute">{current?.roomType.name}</div></div>
            <ArrowRight size={18} className="text-ink-faint" />
            <div><div className="text-[10.5px] font-bold uppercase tracking-wider text-ink-faint">New room</div><div className="mt-1 font-semibold text-ink">{selectedRoom ? `Room ${selectedRoom.number}` : "No room move"}</div><div className="text-[12px] text-ink-mute">{selectedRoom?.roomType.name ?? "Rate or rebate only"}</div></div>
          </div>

          <label className="block">
            <span className={labelCls}>Move to room</span>
            <select value={newRoomId} onChange={(event) => { setNewRoomId(event.target.value); setError(null); setSaveConflict(null); }} className={inputCls}>
              <option value="">Keep current room</option>
              {availableRooms.map((room) => (
                <option key={room.id} value={room.id} disabled={room.status !== "VACANT_CLEAN"}>
                  Room {room.number} · {room.roomType.name} · {room.status === "VACANT_CLEAN" ? "Ready" : room.status.replace(/_/g, " ").toLowerCase()}
                </option>
              ))}
            </select>
            {isLoading && <span className="mt-1 block text-[11px] text-ink-faint">Loading ready rooms…</span>}
            {newRoomId && checkingAvailability && <span className="mt-1.5 block text-[11.5px] font-medium text-ink-mute">Checking room availability…</span>}
            {newRoomId && availabilityError && <div role="alert" className="mt-2 rounded-xl border border-clay/20 bg-clay-soft px-3.5 py-2.5 text-[12px] font-medium leading-relaxed text-clay">{availabilityError}</div>}
            {!isLoading && availableRooms.filter((room) => room.status === "VACANT_CLEAN").length === 0 && (
              <span className="mt-1.5 block text-[11.5px] leading-relaxed text-amber">No other room is currently marked vacant and clean. Unavailable rooms are shown above for clarity but cannot receive the guest.</span>
            )}
          </label>

          <div>
            <span className={labelCls}>Rate treatment</span>
            <div className="grid gap-2 sm:grid-cols-3">
              {([
                ["KEEP_RATE", "Keep agreed rate", "No rate difference"],
                ["USE_NEW_ROOM_RATE", "Use standard rate", "Apply destination base rate"],
                ["CUSTOM_RATE", "Approved rate", "Enter a custom rate"],
              ] as const).map(([value, title, sub]) => (
                <button key={value} type="button" onClick={() => setPricingMode(value)} className={`rounded-xl border p-3 text-left transition-colors ${pricingMode === value ? "border-coral bg-coral-soft/55" : "border-line bg-card hover:bg-mist"}`}>
                  <div className="text-[12.5px] font-semibold text-ink">{title}</div><div className="mt-0.5 text-[10.5px] text-ink-mute">{sub}</div>
                </button>
              ))}
            </div>
          </div>

          {pricingMode === "CUSTOM_RATE" && <label className="block"><span className={labelCls}>Approved nightly rate (PKR)</span><input type="number" min="1" value={customRate} onChange={(event) => setCustomRate(event.target.value)} className={inputCls} placeholder="For example: 18,000" /></label>}

          <label className="block">
            <span className={labelCls}>Guest service rebate (PKR) <span className="font-medium normal-case tracking-normal text-ink-faint">— optional</span></span>
            <div className="relative"><CircleDollarSign size={16} className="absolute left-3.5 top-3 text-ink-faint" /><input type="number" min="0" value={rebate} onChange={(event) => setRebate(event.target.value)} className={`${inputCls} pl-10`} placeholder="0" /></div>
            <span className="mt-1.5 flex gap-1.5 text-[11px] leading-relaxed text-ink-mute"><Info size={13} className="mt-0.5 shrink-0" />A rebate is a goodwill credit. The folio shows “Guest service rebate”; the internal reason stays private.</span>
          </label>
          </>}

          {activeTask === "DATES" && <>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-xl2 border border-line bg-card p-4">
              <div><div className="text-[10.5px] font-bold uppercase tracking-wider text-ink-faint">Current check-out</div><div className="mt-1 font-semibold text-ink">{new Date(`${originalCheckOut}T00:00:00Z`).toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}</div></div>
              <ArrowRight size={18} className="text-ink-faint" />
              <div><div className="text-[10.5px] font-bold uppercase tracking-wider text-ink-faint">New check-out</div><div className="mt-1 font-semibold text-ink">{checkOutDate === originalCheckOut ? "No date change" : new Date(`${checkOutDate}T00:00:00Z`).toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}</div></div>
            </div>

            <label className="block">
              <span className={labelCls}>Check-out date</span>
              <DatePicker
                value={checkOutDate}
                min={new Date(new Date(reservation.checkInDate).getTime() + 86_400_000).toISOString().slice(0, 10)}
                onChange={(value) => { setCheckOutDate(value); setError(null); setSaveConflict(null); }}
                placeholder="Select check-out date"
              />
              {checkingAvailability && <div className="mt-2 text-[11.5px] font-medium text-ink-mute">Checking room availability…</div>}
              {availabilityError && <div role="alert" className="mt-2 rounded-xl border border-clay/20 bg-clay-soft px-3.5 py-2.5 text-[12px] font-medium leading-relaxed text-clay">{availabilityError}</div>}
              <span className="mt-1.5 flex gap-1.5 text-[11px] leading-relaxed text-ink-mute"><Info size={13} className="mt-0.5 shrink-0" />Extensions keep the agreed rate and are checked for availability.</span>
            </label>

            {isEarlyDeparture && (
              <div>
                <span className={labelCls}>Early departure charges</span>
                <div className="grid gap-2 sm:grid-cols-3">
                  {([
                    ["KEEP_ORIGINAL_CHARGES", "Keep original charges", "Contracted stay remains payable"],
                    ["CREDIT_UNUSED_NIGHTS", "Credit unused nights", "Remove all unused-night charges"],
                    ["CUSTOM_CREDIT", "Custom credit", "Credit an approved amount"],
                  ] as const).map(([value, title, description]) => (
                    <button key={value} type="button" onClick={() => setEarlyDepartureTreatment(value)} className={`rounded-xl border p-3.5 text-left transition-colors ${earlyDepartureTreatment === value ? "border-coral bg-coral-soft/55" : "border-line bg-card hover:bg-mist"}`}>
                      <div className="text-[12.5px] font-semibold text-ink">{title}</div>
                      <div className="mt-1 text-[10.5px] leading-relaxed text-ink-mute">{description}</div>
                    </button>
                  ))}
                </div>
                {earlyDepartureTreatment === "CUSTOM_CREDIT" && (
                  <label className="mt-3 block">
                    <span className={labelCls}>Approved credit (PKR)</span>
                    <div className="relative"><CircleDollarSign size={16} className="absolute left-3.5 top-3 text-ink-faint" /><input type="number" min="1" value={earlyDepartureCredit} onChange={(event) => setEarlyDepartureCredit(event.target.value)} className={`${inputCls} pl-10`} placeholder="For example: 5,000" /></div>
                    <span className="mt-1.5 block text-[11px] leading-relaxed text-ink-mute">Original charges stay; this exact amount is credited on the folio.</span>
                  </label>
                )}
              </div>
            )}
          </>}

          <label className="block"><span className={labelCls}>Internal reason <span className="text-clay">*</span></span><textarea rows={3} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} className={`${inputCls} resize-none`} placeholder="For example: Guest requested quieter room; manager approved move" /><span className="mt-1 block text-[11px] text-ink-faint">Recorded in stay history and the audit log. Never printed on the guest folio.</span></label>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-line bg-mist/65 px-6 py-4 sm:flex-row sm:justify-end">
          <button onClick={onClose} className="h-10 rounded-full border border-line bg-card px-5 text-sm font-semibold text-ink-soft hover:bg-white">Cancel</button>
          <button onClick={() => mutation.mutate()} disabled={!canSubmit} className="h-10 rounded-full bg-coral px-6 text-sm font-semibold text-white hover:bg-coral-dark disabled:pointer-events-none disabled:opacity-40">{mutation.isPending ? "Saving…" : "Save changes"}</button>
        </div>
      </div>
    </div>
  );
}
