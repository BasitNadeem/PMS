import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { X, Pencil, ChevronDown, Tag, ShieldAlert, Star, Minus, Plus, Loader2, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { api, getErrorMessage } from "@/lib/api";
import { roomsService, type Room } from "@/services/rooms";
import { reservationsService, type ReservationDetail } from "@/services/reservations";
import { DateRangePicker } from "@/components/ui/DateRangePicker";
import { useEscapeKey } from "@/hooks/useEscapeKey";

interface SuggestResult {
  suggestedRate: number;
  matchedPlan: { id: string; name: string; type: string } | null;
}

function fmtPkr(paise: number): string {
  return `Rs ${(paise / 100).toLocaleString("en-PK")}`;
}
function nightsBetween(a: string, b: string): number {
  if (!a || !b) return 0;
  return Math.max(0, Math.ceil((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000));
}
function toDateInput(iso: string): string {
  return iso.slice(0, 10);
}

const inputCls = "h-11 w-full rounded-xl bg-white border border-line px-3.5 text-sm text-ink placeholder:text-ink-faint outline-none focus:border-coral focus:ring-2 focus:ring-coral/15 transition-all";

export interface EditReservationModalProps {
  reservation: ReservationDetail;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

// Dates/room/rate can only be edited before check-in has actually happened —
// once a guest is in the room, a date/room change is a transfer, not a correction.
export const STAY_EDITABLE_STATUSES = ["ENQUIRY", "CONFIRMED", "WAITLISTED"];

export function EditReservationModal({ reservation, onClose, onSuccess }: EditReservationModalProps) {
  useEscapeKey(onClose);
  const qc = useQueryClient();
  const room0 = reservation.rooms[0];
  const canEditStay = STAY_EDITABLE_STATUSES.includes(reservation.status);

  const [checkIn, setCheckIn] = useState(toDateInput(reservation.checkInDate));
  const [checkOut, setCheckOut] = useState(toDateInput(reservation.checkOutDate));
  const [roomId, setRoomId] = useState(room0?.roomId ?? "");
  const [roomTypeFilter, setRoomTypeFilter] = useState(room0?.roomTypeId ?? "");
  const [ratePerNight, setRatePerNight] = useState(room0?.ratePerNight ?? 0);
  const [rateTouched, setRateTouched] = useState(false);
  const [adults, setAdults] = useState(reservation.adults);
  const [children, setChildren] = useState(reservation.children);
  const [specialRequests, setSpecialRequests] = useState(reservation.specialRequests ?? "");
  const [isVip, setIsVip] = useState(reservation.isVip);
  const [error, setError] = useState("");

  const datesReady = !!checkIn && !!checkOut && checkOut > checkIn;
  const nights = nightsBetween(checkIn, checkOut);
  const stayChanged =
    checkIn !== toDateInput(reservation.checkInDate) ||
    checkOut !== toDateInput(reservation.checkOutDate) ||
    roomId !== room0?.roomId;

  const { data: roomsData } = useQuery({
    queryKey: ["rooms", "all"],
    queryFn: () => roomsService.getRooms(),
    enabled: canEditStay,
  });
  const allRooms: Room[] = (roomsData?.data ?? []).filter(
    (r) => r.status !== "OUT_OF_ORDER" && r.status !== "BLOCKED",
  );
  const { data: roomTypesData } = useQuery({
    queryKey: ["room-types"],
    queryFn: roomsService.getRoomTypes,
    enabled: canEditStay,
  });
  const roomTypes = roomTypesData?.data ?? [];

  const { data: bulkAvailability } = useQuery({
    queryKey: ["rooms-bulk-availability-edit", checkIn, checkOut, reservation.id],
    queryFn: () => roomsService.checkAvailability({
      checkInDate: checkIn, checkOutDate: checkOut, excludeReservationId: reservation.id,
    }),
    enabled: canEditStay && datesReady,
    staleTime: 15_000,
  });
  const availableRoomIds = new Set(bulkAvailability?.availableRoomIds ?? []);
  const byType = roomTypeFilter ? allRooms.filter((r) => r.roomTypeId === roomTypeFilter) : allRooms;
  const vacantRooms = datesReady ? byType.filter((r) => availableRoomIds.has(r.id) || r.id === room0?.roomId) : [];
  const selectedRoom = allRooms.find((r) => r.id === roomId) ?? null;

  const { data: availability, isFetching: checkingAvailability } = useQuery({
    queryKey: ["room-availability-edit", roomId, checkIn, checkOut, reservation.id],
    queryFn: () => roomsService.checkAvailability({
      roomId, checkInDate: checkIn, checkOutDate: checkOut, excludeReservationId: reservation.id,
    }),
    enabled: canEditStay && !!roomId && datesReady,
    staleTime: 10_000,
  });
  const roomConflict = availability?.conflicts[0] ?? null;

  // Only worth asking for a fresh rate when the stay actually changed — the
  // reservation's own current rate is a perfectly good default otherwise.
  const suggestEnabled = canEditStay && stayChanged && !!selectedRoom && datesReady;
  const { data: suggestData } = useQuery({
    queryKey: ["rate-suggest-edit", selectedRoom?.roomTypeId, checkIn, checkOut],
    queryFn: async (): Promise<SuggestResult> => {
      const res = await api.get("/api/rate-plans/suggest", {
        params: { roomTypeId: selectedRoom!.roomTypeId, checkIn, checkOut, bookingContext: "SINGLE" },
      });
      return res.data.data as SuggestResult;
    },
    enabled: suggestEnabled,
    staleTime: 60_000,
  });

  const maxOccupancy = selectedRoom?.roomType.maxOccupancy ?? room0?.roomType.maxOccupancy ?? 10;
  const currentAmount = room0 ? room0.ratePerNight * nightsBetween(toDateInput(reservation.checkInDate), toDateInput(reservation.checkOutDate)) : 0;
  const newAmount = ratePerNight * nights;

  const showRateSuggestion = suggestData && !rateTouched && suggestData.suggestedRate !== ratePerNight;

  const mutation = useMutation({
    mutationFn: () => {
      const dto: Parameters<typeof reservationsService.updateReservation>[1] = {
        adults, children,
        specialRequests: specialRequests.trim() || undefined,
        isVip,
      };
      if (canEditStay && stayChanged) {
        dto.checkInDate = checkIn;
        dto.checkOutDate = checkOut;
        if (roomId !== room0?.roomId) {
          dto.roomId = roomId;
          dto.roomTypeId = selectedRoom?.roomTypeId;
        }
        dto.ratePerNight = ratePerNight;
      } else if (canEditStay && ratePerNight !== room0?.ratePerNight) {
        dto.ratePerNight = ratePerNight;
      }
      return reservationsService.updateReservation(reservation.id, dto);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reservation", reservation.id] });
      qc.invalidateQueries({ queryKey: ["reservations"] });
      qc.invalidateQueries({ queryKey: ["rooms"] });
      onSuccess("Reservation updated");
      onClose();
    },
    onError: (err) => setError(getErrorMessage(err)),
  });

  function handleSave() {
    setError("");
    if (canEditStay) {
      if (!datesReady) { setError("Check-out must be after check-in"); return; }
      if (!roomId) { setError("Please select a room"); return; }
      if (roomConflict) { setError("This room is already booked for the selected dates"); return; }
      if (checkingAvailability) { setError("Still checking room availability…"); return; }
    }
    if (adults + children > maxOccupancy) {
      setError(`Total guests (${adults + children}) exceeds this room's capacity of ${maxOccupancy}`);
      return;
    }
    mutation.mutate();
  }

  return (
    <div
      className="fixed inset-0 bg-ink/35 backdrop-blur-[3px] z-50 grid place-items-center p-4 sm:p-6 anim-fade-in"
      onMouseDown={onClose}
    >
      <div
        className="relative w-full max-w-2xl max-h-[95vh] flex flex-col bg-card rounded-[1.75rem] shadow-float anim-scale-in"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3.5 px-6 pt-6 pb-4 border-b border-line-soft">
          <div className="grid place-items-center h-11 w-11 rounded-xl bg-coral-soft text-coral-deep shrink-0">
            <Pencil size={19} />
          </div>
          <div className="flex-1">
            <h3 className="serif text-[22px] leading-tight text-ink">Edit reservation</h3>
            <p className="text-[13px] text-ink-mute">
              {reservation.confirmationNumber}
              {reservation.groupId && " · part of a group booking"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="grid place-items-center h-9 w-9 rounded-full hover:bg-line-soft text-ink-mute transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto scroll-area px-6 py-5 space-y-5">
          {!canEditStay && (
            <div className="rounded-xl border border-amber/30 bg-amber-soft px-3.5 py-3 flex items-start gap-2.5">
              <ShieldAlert size={16} className="text-amber shrink-0 mt-0.5" />
              <p className="text-[13px] text-ink-soft">
                Dates and room can&apos;t be changed once a reservation is {reservation.status.toLowerCase().replace(/_/g, " ")}.
                You can still update guest count, notes and VIP status below.
              </p>
            </div>
          )}

          {canEditStay && (
            <>
              {/* Dates */}
              <div>
                <div className="grid grid-cols-2 gap-4 mb-1.5">
                  <label className="text-[13px] font-semibold text-ink-soft">Check-in</label>
                  <label className="text-[13px] font-semibold text-ink-soft">Check-out</label>
                </div>
                <DateRangePicker
                  checkIn={checkIn}
                  checkOut={checkOut}
                  onChange={(ci, co) => { setCheckIn(ci); setCheckOut(co); }}
                  className="w-full"
                />
              </div>

              {/* Room */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[13px] text-ink-mute">
                    <span className="font-bold text-ink tnum">{nights}</span> night{nights !== 1 ? "s" : ""}
                    {datesReady && <> · <span className="font-bold text-ink tnum">{vacantRooms.length}</span> room{vacantRooms.length !== 1 ? "s" : ""} available</>}
                  </p>
                  <div className="relative">
                    <select
                      value={roomTypeFilter}
                      onChange={(e) => setRoomTypeFilter(e.target.value)}
                      className="h-9 rounded-full border border-line bg-card pl-3.5 pr-8 text-[13px] text-ink font-semibold cursor-pointer appearance-none outline-none focus:border-coral transition-colors hover:border-ink-faint"
                    >
                      <option value="">All room types</option>
                      {roomTypes.map((rt) => <option key={rt.id} value={rt.id}>{rt.name}</option>)}
                    </select>
                    <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-mute pointer-events-none" />
                  </div>
                </div>

                {!datesReady ? (
                  <div className="rounded-xl border border-dashed border-line py-6 text-center text-[13px] text-ink-mute">
                    Select check-in and check-out dates to see available rooms
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 max-h-[38vh] overflow-y-auto scroll-area pr-0.5">
                    {vacantRooms.map((r) => {
                      const on = roomId === r.id;
                      const conflicted = on && !!roomConflict;
                      return (
                        <button
                          key={r.id}
                          onClick={() => {
                            setRoomId(r.id);
                            setRateTouched(false);
                          }}
                          className={cn(
                            "text-left rounded-[1.25rem] border p-3.5 transition-all",
                            conflicted ? "border-clay ring-2 ring-clay/15 bg-white"
                              : on ? "border-coral ring-2 ring-coral/15 bg-white"
                              : "border-line bg-white hover:border-ink-faint",
                          )}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <span className="grid place-items-center min-w-[48px] h-8 rounded-xl bg-ink text-white text-[13px] font-bold tnum px-2">
                              {r.number}
                            </span>
                            {on && (conflicted
                              ? <span className="text-[10px] font-bold uppercase tracking-wide text-clay bg-clay-soft px-2 py-1 rounded-full">Booked</span>
                              : checkingAvailability ? <Loader2 size={16} className="text-ink-faint animate-spin" />
                              : <CheckCircle2 size={18} className="text-coral" />)}
                          </div>
                          <div className="text-[14px] font-semibold text-ink">{r.roomType.name}</div>
                          <div className="text-[12px] text-ink-mute mt-0.5">max {r.roomType.maxOccupancy}{r.floor != null ? ` · Floor ${r.floor}` : ""}</div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {roomConflict && (
                <div className="rounded-xl border border-clay/25 bg-clay-soft px-4 py-3 flex items-start gap-2.5">
                  <ShieldAlert size={16} className="text-clay shrink-0 mt-0.5" />
                  <p className="text-[13px] text-ink-soft">
                    <span className="font-semibold text-clay">Room {roomConflict.roomNumber} is already booked</span> for{" "}
                    {roomConflict.guestName} from{" "}
                    {new Date(roomConflict.checkInDate).toLocaleDateString("en-PK", { day: "numeric", month: "short" })} to{" "}
                    {new Date(roomConflict.checkOutDate).toLocaleDateString("en-PK", { day: "numeric", month: "short" })}
                    {roomConflict.confirmationNumber ? ` (Res ID ${roomConflict.confirmationNumber})` : ""}. Please pick a different room or date.
                  </p>
                </div>
              )}

              {/* Rate — proposed vs current, staff explicitly accepts */}
              <div className="rounded-[1.25rem] border border-line bg-white p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[13px] font-semibold text-ink-soft">Rate per night</label>
                  {suggestData?.matchedPlan && (
                    <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-pine bg-pine/20 border border-pine/40 px-2.5 py-1 rounded-lg">
                      <Tag size={11} strokeWidth={2.5} />{suggestData.matchedPlan.name}
                    </span>
                  )}
                </div>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[13px] text-ink-mute pointer-events-none">Rs</span>
                  <input
                    type="number" min={0} step="1"
                    value={Math.round(ratePerNight / 100)}
                    onChange={(e) => { setRatePerNight(Math.max(0, Math.round((Number(e.target.value) || 0) * 100))); setRateTouched(true); }}
                    className={cn(inputCls, "pl-9")}
                  />
                </div>
                {showRateSuggestion && (
                  <button
                    type="button"
                    onClick={() => { setRatePerNight(suggestData!.suggestedRate); setRateTouched(true); }}
                    className="text-[12px] font-semibold text-coral hover:underline"
                  >
                    New dates suggest {fmtPkr(suggestData!.suggestedRate)}/night — use this rate
                  </button>
                )}
                {stayChanged && (
                  <div className="flex items-center justify-between text-[13px] pt-2 border-t border-line-soft">
                    <span className="text-ink-mute">{fmtPkr(currentAmount)} → <span className="font-semibold text-ink">{fmtPkr(newAmount)}</span></span>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Guests */}
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="mb-1.5 block text-[13px] font-semibold text-ink-soft">Adults</label>
              <div className="flex items-center justify-between rounded-xl border border-line bg-white h-12 px-2">
                <button onClick={() => setAdults((a) => Math.max(1, a - 1))} className="grid place-items-center h-8 w-8 rounded-lg hover:bg-line-soft text-ink-soft disabled:opacity-30" disabled={adults <= 1}>
                  <Minus size={16} />
                </button>
                <span className="text-[18px] font-bold text-ink tnum">{adults}</span>
                <button onClick={() => setAdults((a) => Math.min(maxOccupancy - children, a + 1))} className="grid place-items-center h-8 w-8 rounded-lg hover:bg-line-soft text-ink-soft disabled:opacity-30" disabled={adults >= maxOccupancy - children}>
                  <Plus size={16} />
                </button>
              </div>
            </div>
            <div className="flex-1">
              <label className="mb-1.5 block text-[13px] font-semibold text-ink-soft">Children</label>
              <div className="flex items-center justify-between rounded-xl border border-line bg-white h-12 px-2">
                <button onClick={() => setChildren((c) => Math.max(0, c - 1))} className="grid place-items-center h-8 w-8 rounded-lg hover:bg-line-soft text-ink-soft disabled:opacity-30" disabled={children <= 0}>
                  <Minus size={16} />
                </button>
                <span className="text-[18px] font-bold text-ink tnum">{children}</span>
                <button onClick={() => setChildren((c) => Math.min(maxOccupancy - adults, c + 1))} className="grid place-items-center h-8 w-8 rounded-lg hover:bg-line-soft text-ink-soft disabled:opacity-30" disabled={children >= maxOccupancy - adults}>
                  <Plus size={16} />
                </button>
              </div>
            </div>
          </div>

          {/* Special requests */}
          <div>
            <label className="mb-1.5 block text-[13px] font-semibold text-ink-soft">Special requests</label>
            <textarea
              value={specialRequests}
              onChange={(e) => setSpecialRequests(e.target.value)}
              rows={3}
              className="w-full rounded-xl bg-white border border-line px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-faint outline-none focus:border-coral focus:ring-2 focus:ring-coral/15 transition-all resize-none"
            />
          </div>

          {/* VIP */}
          <button
            type="button"
            onClick={() => setIsVip((v) => !v)}
            className={cn(
              "flex items-center justify-between w-full rounded-xl border px-3.5 py-2.5 transition-colors",
              isVip ? "border-amber bg-amber-soft" : "border-line bg-white hover:border-ink-faint",
            )}
          >
            <span className="flex items-center gap-2 text-[13.5px] font-semibold text-ink-soft">
              <Star size={15} className={isVip ? "text-amber fill-amber" : "text-ink-faint"} />
              Mark this booking as VIP
            </span>
            <span className={cn("w-11 h-6 rounded-full transition-colors duration-200 flex items-center flex-shrink-0", isVip ? "bg-amber" : "bg-line-soft")}>
              <span className={cn("w-5 h-5 bg-white rounded-full shadow transition-transform duration-200", isVip ? "translate-x-5" : "translate-x-0.5")} />
            </span>
          </button>

          {error && <p className="text-[13px] text-clay font-medium">{error}</p>}
        </div>

        {/* Footer */}
        <div className="border-t border-line-soft px-6 py-4 flex items-center justify-between bg-card rounded-b-[1.75rem]">
          <button onClick={onClose} className="text-[13px] font-semibold text-ink-mute hover:text-ink transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={mutation.isPending || (canEditStay && (!!roomConflict || checkingAvailability))}
            className="inline-flex items-center gap-2 h-10 px-5 rounded-full bg-coral text-white text-[14px] font-semibold hover:bg-coral-dark transition-colors shadow-pop disabled:opacity-40 disabled:pointer-events-none"
          >
            {mutation.isPending ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
