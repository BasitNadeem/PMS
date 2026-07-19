import { useState, useEffect, useRef, useMemo } from "react";
import { getPhoneErrorMessage } from "@/lib/validation";
import { useMutation, useQuery, useQueries, useQueryClient } from "@tanstack/react-query";
import { X, ChevronLeft, Check, CalendarPlus, CheckCircle2, ArrowRight, Minus, Plus, ChevronDown, Search, ShieldAlert, Star, Loader2, Tag } from "lucide-react";
import { cn } from "@/lib/cn";
import { api, getErrorMessage, getErrorDetails } from "@/lib/api";
import { roomsService, type Room } from "@/services/rooms";
import { guestsService, type GuestSummary } from "@/services/guests";
import {
  reservationsService,
  type CreateReservationDto,
  type BookingSource,
} from "@/services/reservations";
import type { PaymentMethod } from "@/services/folio";
import { Avatar } from "@/components/ui/Avatar";
import { TONE } from "@/components/ui/StatusBadge";
import { DateRangePicker } from "@/components/ui/DateRangePicker";
import { useEscapeKey } from "@/hooks/useEscapeKey";

interface SuggestResult {
  suggestedRate: number;
  matchedPlan: { id: string; name: string; type: string } | null;
  allMatchingPlans: { id: string; name: string; rate: number }[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtPkr(paise: number): string {
  const r = paise / 100;
  return `Rs ${r.toLocaleString("en-PK")}`;
}
function fmtPkrK(paise: number): string {
  const r = paise / 100;
  if (r >= 100_000) return `Rs ${(r / 100_000).toFixed(1)}L`;
  if (r >= 1_000)   return `Rs ${(r / 1_000).toFixed(0)}k`;
  return `Rs ${r.toLocaleString("en-PK")}`;
}
function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-PK", { day: "2-digit", month: "short" });
}
function nightsBetween(from: string, to: string): number {
  if (!from || !to) return 0;
  return Math.max(0, Math.ceil((new Date(to).getTime() - new Date(from).getTime()) / 86_400_000));
}

const inputCls = "h-11 w-full rounded-xl bg-white border border-line px-3.5 text-sm text-ink placeholder:text-ink-faint outline-none focus:border-coral focus:ring-2 focus:ring-coral/15 transition-all";

const STEPS = ["Dates & Room", "Guest", "Review"] as const;

const SOURCES: { value: BookingSource; label: string }[] = [
  { value: "WALK_IN",        label: "Walk-in" },
  { value: "PHONE",          label: "Phone" },
  { value: "WHATSAPP",       label: "WhatsApp" },
  { value: "TRAVEL_AGENT",   label: "Travel Agent" },
  { value: "BOOKING_COM",    label: "Booking.com" },
  { value: "AGODA",          label: "Agoda" },
  { value: "EXPEDIA",        label: "Expedia" },
  { value: "DIRECT_WEBSITE", label: "Direct Website" },
];

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "CASH",          label: "Cash" },
  { value: "JAZZCASH",      label: "JazzCash" },
  { value: "EASYPAISA",     label: "EasyPaisa" },
  { value: "BANK_TRANSFER", label: "Bank Transfer" },
  { value: "CREDIT_CARD",   label: "Credit Card" },
  { value: "DEBIT_CARD",    label: "Debit Card" },
  { value: "CHEQUE",        label: "Cheque" },
];

// ── Stepper ───────────────────────────────────────────────────────────────────

function Stepper({ current }: { current: number }) {
  return (
    <div className="flex items-center px-6 py-4 bg-mist border-b border-line-soft">
      {STEPS.map((label, i) => (
        <div key={label} className={cn("flex items-center", i < STEPS.length - 1 && "flex-1")}>
          {/* Circle + label */}
          <div className="flex items-center gap-2">
            <span className={cn(
              "grid place-items-center h-6 w-6 rounded-full text-[12px] font-bold shrink-0 transition-all",
              i < current  ? "bg-pine text-white"   :
              i === current? "bg-ink text-white"     :
                             "bg-line text-ink-mute",
            )}>
              {i < current ? <Check size={13} strokeWidth={2.8} /> : i + 1}
            </span>
            <span className={cn(
              "text-[13px] font-semibold whitespace-nowrap",
              i < current ? "text-ink-mute" : i === current ? "text-ink" : "text-ink-faint",
            )}>
              {label}
            </span>
          </div>
          {/* Connector line */}
          {i < STEPS.length - 1 && (
            <div className={cn("flex-1 h-px mx-3", i < current ? "bg-pine" : "bg-line")} />
          )}
        </div>
      ))}
    </div>
  );
}

// ── Stepper number ────────────────────────────────────────────────────────────

function NumStepper({ label, value, onInc, onDec, min = 0, max = 10 }: {
  label: string; value: number; onInc: () => void; onDec: () => void; min?: number; max?: number;
}) {
  return (
    <div className="flex-1">
      <label className="mb-1.5 block text-[13px] font-semibold text-ink-soft">{label}</label>
      <div className="flex items-center justify-between rounded-xl border border-line bg-white h-12 px-2">
        <button
          onClick={onDec}
          disabled={value <= min}
          className="grid place-items-center h-8 w-8 rounded-lg hover:bg-line-soft text-ink-soft disabled:opacity-30 transition-colors"
        >
          <Minus size={16} />
        </button>
        <span className="text-[18px] font-bold text-ink tnum">{value}</span>
        <button
          onClick={onInc}
          disabled={value >= max}
          className="grid place-items-center h-8 w-8 rounded-lg hover:bg-line-soft text-ink-soft disabled:opacity-30 transition-colors"
        >
          <Plus size={16} />
        </button>
      </div>
    </div>
  );
}

function VipToggleRow({ checked, onToggle }: { checked: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "flex items-center justify-between w-full rounded-xl border px-3.5 py-2.5 transition-colors",
        checked ? "border-amber bg-amber-soft" : "border-line bg-white hover:border-ink-faint",
      )}
    >
      <span className="flex items-center gap-2 text-[13.5px] font-semibold text-ink-soft">
        <Star size={15} className={checked ? "text-amber fill-amber" : "text-ink-faint"} />
        Mark this booking as VIP
      </span>
      <span className={cn(
        "w-11 h-6 rounded-full transition-colors duration-200 flex items-center flex-shrink-0",
        checked ? "bg-amber" : "bg-line-soft",
      )}>
        <span className={cn(
          "w-5 h-5 bg-white rounded-full shadow transition-transform duration-200",
          checked ? "translate-x-5" : "translate-x-0.5",
        )} />
      </span>
    </button>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface WizardState {
  checkIn: string; checkOut: string; roomId: string; roomTypeFilter: string;
  ratePerNight: number; // paisas; editable, seeded from suggest endpoint
  guestId: string; guestName: string; guestCity: string; guestStays: number; guestBlacklisted: boolean;
  newFirstName: string; newLastName: string; newPhone: string;
  newDocType: string; newDocNumber: string;
  useNewGuest: boolean;
  adults: number; children: number; source: BookingSource; specialRequests: string;
  advancePayment: string; advancePaymentMethod: PaymentMethod;
  isVip: boolean;
}

export interface NewReservationModalProps {
  onClose: () => void;
  onSuccess: (message: string) => void;
  initialCheckInDate?: string;
  initialCheckOutDate?: string;
  initialSource?: BookingSource;
}

// ── Main component ────────────────────────────────────────────────────────────

function addOneDay(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(y, m - 1, d + 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function NewReservationModal({ onClose, onSuccess, initialCheckInDate, initialCheckOutDate, initialSource }: NewReservationModalProps) {
  useEscapeKey(onClose);
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [stepError, setStepError] = useState("");
  const [duplicateGuestWarning, setDuplicateGuestWarning] = useState("");
  const [newPhoneError, setNewPhoneError] = useState("");

  const [form, setForm] = useState<WizardState>({
    checkIn:  initialCheckInDate  ?? "",
    checkOut: initialCheckOutDate ?? (initialCheckInDate ? addOneDay(initialCheckInDate) : ""),
    roomId: "", roomTypeFilter: "",
    ratePerNight: 0,
    guestId: "", guestName: "", guestCity: "", guestStays: 0, guestBlacklisted: false,
    useNewGuest: true,
    newFirstName: "", newLastName: "", newPhone: "", newDocType: "CNIC", newDocNumber: "",
    adults: 2, children: 0, source: initialSource ?? "WALK_IN", specialRequests: "",
    advancePayment: "", advancePaymentMethod: "CASH",
    isVip: false,
  });

  function set<K extends keyof WizardState>(key: K, value: WizardState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setStepError("");
  }

  // All bookable rooms — excludes OUT_OF_ORDER and BLOCKED (permanent unavailability),
  // but includes OCCUPIED rooms that may be free for the requested future dates.
  const { data: roomsData } = useQuery({
    queryKey: ["rooms", "all"],
    queryFn: () => roomsService.getRooms(),
  });
  const allRooms: Room[] = (roomsData?.data ?? []).filter(
    (r) => r.status !== "OUT_OF_ORDER" && r.status !== "BLOCKED",
  );

  // Room types for filter
  const { data: roomTypesData } = useQuery({
    queryKey: ["room-types"],
    queryFn: roomsService.getRoomTypes,
  });
  const roomTypes = roomTypesData?.data ?? [];

  // Bulk date-range availability — fires when both dates are set, checks ALL rooms
  // at once. This is what actually determines which rooms can be offered for the
  // requested stay — not the room's current physical status.
  const datesReady = !!form.checkIn && !!form.checkOut && form.checkOut > form.checkIn;
  const { data: bulkAvailability } = useQuery({
    queryKey: ["rooms-bulk-availability", form.checkIn, form.checkOut],
    queryFn:  () => roomsService.checkAvailability({
      checkInDate: form.checkIn, checkOutDate: form.checkOut,
    }),
    enabled:   datesReady,
    staleTime: 30_000,
  });
  const availableRoomIds = new Set(bulkAvailability?.availableRoomIds ?? []);

  // Apply room type filter, then availability filter based on the selected dates.
  const byType = form.roomTypeFilter
    ? allRooms.filter((r) => r.roomTypeId === form.roomTypeFilter)
    : allRooms;

  const vacantRooms = datesReady
    ? byType.filter((r) => availableRoomIds.has(r.id))
    : [];

  const selectedRoom = allRooms.find((r) => r.id === form.roomId) ?? null;

  // Fetch suggested rates for every visible room type so Step 1 cards show the
  // correct rate-plan price. Uses the same query keys as the per-room suggest
  // query below, so TanStack Query de-dupes the requests.
  const uniqueRoomTypeIds = useMemo(
    () => [...new Set(vacantRooms.map((r) => r.roomTypeId))],
    [vacantRooms],
  );
  const roomTypeSuggestResults = useQueries({
    queries: uniqueRoomTypeIds.map((rtId) => ({
      queryKey: ["rate-suggest", rtId, form.checkIn, form.checkOut, "SINGLE"],
      queryFn: async (): Promise<SuggestResult> => {
        const res = await api.get("/api/rate-plans/suggest", {
          params: { roomTypeId: rtId, checkIn: form.checkIn, checkOut: form.checkOut, bookingContext: "SINGLE" },
        });
        return res.data.data as SuggestResult;
      },
      enabled: datesReady,
      staleTime: 60_000,
    })),
  });
  const roomTypeRateMap = useMemo(() => {
    const map = new Map<string, SuggestResult>();
    uniqueRoomTypeIds.forEach((rtId, i) => {
      const result = roomTypeSuggestResults[i]?.data;
      if (result) map.set(rtId, result);
    });
    return map;
  }, [uniqueRoomTypeIds, roomTypeSuggestResults]);

  // Proactive conflict check — fires the moment a room + both dates are picked,
  // so the user finds out immediately instead of after filling the whole form.
  const { data: availability, isFetching: checkingAvailability } = useQuery({
    queryKey: ["room-availability", form.roomId, form.checkIn, form.checkOut],
    queryFn: () => roomsService.checkAvailability({
      roomId: form.roomId, checkInDate: form.checkIn, checkOutDate: form.checkOut,
    }),
    enabled: !!form.roomId && !!form.checkIn && !!form.checkOut && form.checkOut > form.checkIn,
    staleTime: 10_000,
  });
  const roomConflict = availability?.conflicts[0] ?? null;

  // Rate suggestion — fires when room + dates are ready; staff can always override
  const suggestEnabled = !!selectedRoom && datesReady;
  const { data: suggestData } = useQuery({
    queryKey: ["rate-suggest", selectedRoom?.roomTypeId, form.checkIn, form.checkOut, "SINGLE"],
    queryFn: async (): Promise<SuggestResult> => {
      const res = await api.get("/api/rate-plans/suggest", {
        params: { roomTypeId: selectedRoom!.roomTypeId, checkIn: form.checkIn, checkOut: form.checkOut, bookingContext: "SINGLE" },
      });
      return res.data.data as SuggestResult;
    },
    enabled: suggestEnabled,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (suggestData) {
      setForm((f) => ({ ...f, ratePerNight: suggestData.suggestedRate }));
    }
  }, [suggestData]);

  // Guest search
  const [guestSearchInput, setGuestSearchInput] = useState("");
  const [guestSearch,      setGuestSearch]      = useState("");
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => setGuestSearch(guestSearchInput.trim()), 350);
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, [guestSearchInput]);

  const { data: guestsData, isFetching: guestsFetching } = useQuery({
    queryKey: ["guests-modal", guestSearch],
    queryFn: () => guestsService.getGuests({ limit: 60, search: guestSearch || undefined }),
    staleTime: 30_000,
    enabled: !form.useNewGuest,
  });
  const allGuests: GuestSummary[] = guestsData?.data ?? [];

  // Layer 2 — blacklist check for new guest by document/phone
  const newGuestDoc   = form.newDocNumber.trim();
  const newGuestPhone = form.newPhone.trim();
  const [blacklistKey, setBlacklistKey] = useState("");
  useEffect(() => {
    if (!form.useNewGuest) { setBlacklistKey(""); return; }
    const t = setTimeout(() => setBlacklistKey(`${newGuestDoc}|${newGuestPhone}`), 500);
    return () => clearTimeout(t);
  }, [form.useNewGuest, newGuestDoc, newGuestPhone]);

  const { data: blacklistResult } = useQuery({
    queryKey: ["blacklist-check", blacklistKey],
    queryFn: () => guestsService.checkBlacklist({
      documentNumber: newGuestDoc || undefined,
      phone:          newGuestPhone || undefined,
    }),
    enabled: form.useNewGuest && (newGuestDoc.length >= 3 || newGuestPhone.length >= 4),
    staleTime: 30_000,
  });


  const createGuestMutation = useMutation({ mutationFn: guestsService.createGuest });

  const createReservationMutation = useMutation({
    mutationFn: (dto: CreateReservationDto) => reservationsService.createReservation(dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reservations"] });
      qc.invalidateQueries({ queryKey: ["rooms"] });
      onSuccess("Reservation created successfully");
      onClose();
    },
  });

  const nights   = nightsBetween(form.checkIn, form.checkOut);
  const subtotal = form.ratePerNight * nights;
  const tax          = Math.round(subtotal * 0.05);
  const totalAmount  = subtotal + tax;
  const maxOccupancy = selectedRoom?.roomType.maxOccupancy ?? 10;
  const today        = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; })();
  const isPending    = createGuestMutation.isPending || createReservationMutation.isPending;

  // ── Validation ──────────────────────────────────────────────────────────────

  function validateStep0(): string {
    if (!form.checkIn)  return "Check-in date is required";
    if (!form.checkOut) return "Check-out date is required";
    if (form.checkOut <= form.checkIn) return "Check-out must be after check-in";
    if (!form.roomId) return "Please select a room";
    if (roomConflict) return "This room is already booked for the selected dates — please choose another room or date";
    if (checkingAvailability) return "Still checking room availability…";
    return "";
  }
  function validateStep1(): string {
    if (form.adults + form.children > maxOccupancy) {
      return `Total guests (${form.adults + form.children}) exceeds this room's capacity of ${maxOccupancy}`;
    }
    if (form.useNewGuest) {
      if (!form.newFirstName.trim()) return "First name is required";
      if (!form.newLastName.trim())  return "Last name is required";
      if (!form.newPhone.trim())     return "Phone is required";
      const phoneErr = getPhoneErrorMessage(form.newPhone);
      if (phoneErr) { setNewPhoneError(phoneErr); return phoneErr; }
      if (!form.newDocNumber.trim()) return `${form.newDocType === "CNIC" ? "CNIC number" : "ID number"} is required`;
    } else {
      if (!form.guestId) return "Please select a guest";
    }
    return "";
  }
  function goNext() {
    const err = step === 0 ? validateStep0() : step === 1 ? validateStep1() : "";
    if (err) { setStepError(err); return; }
    setStepError("");
    setStep((s) => s + 1);
  }
  function reservationDto(guestId: string) {
    const advancePaymentPaise = Math.round((Number(form.advancePayment) || 0) * 100);
    return {
      guestId, checkInDate: form.checkIn, checkOutDate: form.checkOut,
      roomId: form.roomId, roomTypeId: selectedRoom!.roomTypeId,
      ratePerNight: form.ratePerNight, adults: form.adults, children: form.children,
      source: form.source, specialRequests: form.specialRequests.trim() || undefined,
      isVip: form.isVip,
      ...(advancePaymentPaise > 0 && {
        advancePayment: advancePaymentPaise,
        advancePaymentMethod: form.advancePaymentMethod,
      }),
    };
  }

  function newGuestDto(allowDuplicate?: boolean) {
    return {
      firstName: form.newFirstName.trim(), lastName: form.newLastName.trim(),
      phone: form.newPhone.trim(),
      documentType: form.newDocType as "CNIC" | "PASSPORT" | "DRIVING_LICENSE" | "NRIC" | "OTHER",
      documentNumber: form.newDocNumber.trim(),
      ...(allowDuplicate && { allowDuplicate: true }),
    };
  }

  async function handleConfirm() {
    const advancePaymentPaise = Math.round((Number(form.advancePayment) || 0) * 100);
    if (advancePaymentPaise > totalAmount) {
      setStepError("Advance payment cannot exceed the total due");
      return;
    }
    setStepError("");
    setDuplicateGuestWarning("");

    let guestId = form.guestId;
    if (form.useNewGuest) {
      try {
        const newGuest = await createGuestMutation.mutateAsync(newGuestDto());
        guestId = newGuest.id;
      } catch (err) {
        const details = getErrorDetails(err) as { existingGuestId?: string } | undefined;
        if (details?.existingGuestId) {
          setDuplicateGuestWarning(getErrorMessage(err));
        } else {
          setStepError(getErrorMessage(err));
        }
        return;
      }
    }

    createReservationMutation.mutate(reservationDto(guestId), {
      onError: (err) => setStepError(getErrorMessage(err)),
    });
  }

  async function createNewGuestAnyway() {
    setDuplicateGuestWarning("");
    try {
      const newGuest = await createGuestMutation.mutateAsync(newGuestDto(true));
      createReservationMutation.mutate(reservationDto(newGuest.id), {
        onError: (err) => setStepError(getErrorMessage(err)),
      });
    } catch (err) {
      setStepError(getErrorMessage(err));
    }
  }


  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 bg-ink/35 backdrop-blur-[3px] z-50 grid place-items-center p-4 sm:p-6 anim-fade-in"
      onMouseDown={onClose}
    >
      <div
        className="relative w-full max-w-2xl max-h-[95vh] min-h-[560px] flex flex-col bg-card rounded-[1.75rem] shadow-float anim-scale-in"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3.5 px-6 pt-6 pb-4 border-b border-line-soft">
          <div className="grid place-items-center h-11 w-11 rounded-xl bg-coral-soft text-coral-deep shrink-0">
            <CalendarPlus size={20} />
          </div>
          <div className="flex-1">
            <h3 className="serif text-[22px] leading-tight text-ink">New reservation</h3>
            <p className="text-[13px] text-ink-mute">Step {step + 1} of 3 · {STEPS[step]}</p>
          </div>
          <button
            onClick={onClose}
            className="grid place-items-center h-9 w-9 rounded-full hover:bg-line-soft text-ink-mute transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Stepper */}
        <Stepper current={step} />

        {/* Body */}
        <div className="flex-1 overflow-y-auto scroll-area px-6 py-5">

          {/* ── Step 0: Dates & Room ──────────────────────────────────────── */}
          {step === 0 && (
            <div className="space-y-4">
              {/* Date row */}
              <div>
                <div className="grid grid-cols-2 gap-4 mb-1.5">
                  <label className="text-[13px] font-semibold text-ink-soft">Check-in <span className="text-coral text-[15px] font-bold leading-none">*</span></label>
                  <label className="text-[13px] font-semibold text-ink-soft">Check-out <span className="text-coral text-[15px] font-bold leading-none">*</span></label>
                </div>
                <DateRangePicker
                  min={today}
                  checkIn={form.checkIn}
                  checkOut={form.checkOut}
                  onChange={(checkIn, checkOut) => { set("checkIn", checkIn); set("checkOut", checkOut); }}
                  className="w-full"
                />
              </div>

              {/* Info row */}
              <div className="flex items-center justify-between gap-3">
                <p className="text-[13px] text-ink-mute">
                  {nights > 0 && (
                    <><span className="font-bold text-ink tnum">{nights}</span> night{nights !== 1 ? "s" : ""}{datesReady ? " · " : ""}</>
                  )}
                  {datesReady && (
                    <><span className="font-bold text-ink tnum">{vacantRooms.length}</span> room{vacantRooms.length !== 1 ? "s" : ""} available</>
                  )}
                </p>
                {/* Room type filter */}
                <div className="relative">
                  <select
                    value={form.roomTypeFilter}
                    onChange={(e) => { set("roomTypeFilter", e.target.value); set("roomId", ""); }}
                    className="h-9 rounded-full border border-line bg-card pl-3.5 pr-8 text-[13px] text-ink font-semibold cursor-pointer appearance-none outline-none focus:border-coral transition-colors hover:border-ink-faint"
                  >
                    <option value="">All room types</option>
                    {roomTypes.map((rt) => (
                      <option key={rt.id} value={rt.id}>{rt.name}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-mute pointer-events-none" />
                </div>
              </div>

              {/* Room cards grid */}
              {!datesReady ? (
                <div className="rounded-xl border border-dashed border-line py-8 text-center text-[13px] text-ink-mute">
                  Select check-in and check-out dates to see available rooms
                </div>
              ) : vacantRooms.length === 0 ? (
                <div className="rounded-xl border border-dashed border-line py-8 text-center text-[13px] text-ink-mute">
                  No rooms available for these dates
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 max-h-[50vh] overflow-y-auto scroll-area pr-0.5">
                  {vacantRooms.map((r) => {
                    const on = form.roomId === r.id;
                    const conflicted = on && !!roomConflict;
                    return (
                      <button
                        key={r.id}
                        onClick={() => {
                          const cap = r.roomType.maxOccupancy;
                          setForm((f) => {
                            const adults   = Math.max(1, Math.min(f.adults, cap));
                            const children = Math.max(0, Math.min(f.children, cap - adults));
                            return { ...f, roomId: r.id, adults, children };
                          });
                          setStepError("");
                        }}
                        className={cn(
                          "text-left rounded-[1.25rem] border p-4 transition-all",
                          conflicted
                            ? "border-clay ring-2 ring-clay/15 bg-white"
                            : on
                            ? "border-coral ring-2 ring-coral/15 bg-white"
                            : "border-line bg-white hover:border-ink-faint",
                        )}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <span className="grid place-items-center min-w-[52px] h-9 rounded-xl bg-ink text-white text-[14px] font-bold tnum px-2">
                            {r.number}
                          </span>
                          {on && (conflicted ? (
                            <span className="text-[10px] font-bold uppercase tracking-wide text-clay bg-clay-soft px-2 py-1 rounded-full">Booked</span>
                          ) : checkingAvailability ? (
                            <Loader2 size={18} className="text-ink-faint animate-spin" />
                          ) : (
                            <CheckCircle2 size={20} className="text-coral" />
                          ))}
                        </div>
                        <div className="text-[15px] font-semibold text-ink">{r.roomType.name}</div>
                        <div className="text-[12.5px] text-ink-mute mt-0.5">
                          {r.roomType.typeName.replace(/_/g, " ")} · max {r.roomType.maxOccupancy}{r.floor != null ? ` · Floor ${r.floor}` : ""}
                        </div>
                        <div className="mt-3">
                          <div className="flex items-baseline gap-1">
                            <span className="serif text-[20px] text-ink tnum">
                              {fmtPkrK(roomTypeRateMap.get(r.roomTypeId)?.suggestedRate ?? r.roomType.defaultRate)}
                            </span>
                            <span className="text-[12px] text-ink-mute">/night</span>
                          </div>
                          {roomTypeRateMap.get(r.roomTypeId)?.matchedPlan && (
                            <span className="mt-1.5 inline-flex items-center gap-1 text-[12px] font-semibold text-pine bg-pine/20 border border-pine/40 px-2.5 py-1 rounded-lg">
                              <Tag size={11} strokeWidth={2.5} />
                              {roomTypeRateMap.get(r.roomTypeId)!.matchedPlan!.name}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Proactive conflict warning — shown the instant a booked room is picked */}
              {roomConflict && (
                <div className="rounded-xl border border-clay/25 bg-clay-soft px-4 py-3 flex items-start gap-2.5">
                  <ShieldAlert size={16} className="text-clay shrink-0 mt-0.5" />
                  <p className="text-[13px] text-ink-soft">
                    <span className="font-semibold text-clay">Room {roomConflict.roomNumber} is already booked</span> for{" "}
                    {roomConflict.guestName} from{" "}
                    {new Date(roomConflict.checkInDate).toLocaleDateString("en-PK", { day: "numeric", month: "short" })} to{" "}
                    {new Date(roomConflict.checkOutDate).toLocaleDateString("en-PK", { day: "numeric", month: "short" })}
                    {roomConflict.confirmationNumber ? ` (#${roomConflict.confirmationNumber})` : ""}.
                    Please pick a different room or date.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ── Step 1: Guest ─────────────────────────────────────────────── */}
          {step === 1 && (
            <div className="space-y-4">
              {/* Segmented toggle */}
              <div className="inline-flex items-center gap-0.5 rounded-full bg-line-soft p-1">
                <button
                  onClick={() => { set("useNewGuest", true); setGuestSearchInput(""); setGuestSearch(""); }}
                  className={cn(
                    "rounded-full px-4 h-9 text-[13px] font-semibold transition-all",
                    form.useNewGuest ? "bg-card text-ink shadow-pop" : "text-ink-mute hover:text-ink-soft",
                  )}
                >
                  New guest
                </button>
                <button
                  onClick={() => set("useNewGuest", false)}
                  className={cn(
                    "rounded-full px-4 h-9 text-[13px] font-semibold transition-all",
                    !form.useNewGuest ? "bg-card text-ink shadow-pop" : "text-ink-mute hover:text-ink-soft",
                  )}
                >
                  Existing guest
                </button>
              </div>

              {!form.useNewGuest ? (
                <>
                  {/* Search bar */}
                  <div className="relative">
                    <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint pointer-events-none" />
                    <input
                      type="text"
                      value={guestSearchInput}
                      onChange={(e) => setGuestSearchInput(e.target.value)}
                      placeholder="Search by name or phone…"
                      className="w-full h-10 rounded-xl border border-line bg-white pl-9 pr-3.5 text-[13.5px] text-ink placeholder:text-ink-faint focus:outline-none focus:border-coral focus:ring-2 focus:ring-coral/15 transition-all"
                    />
                    {guestsFetching && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 rounded-full border-2 border-coral/30 border-t-coral animate-spin" />
                    )}
                  </div>

                  {/* Guest cards grid */}
                  <div className="grid grid-cols-2 gap-2.5 max-h-[40vh] overflow-y-auto scroll-area pr-0.5">
                    {allGuests.length === 0 ? (
                      <div className="col-span-2 rounded-xl border border-dashed border-line py-6 text-center text-[13px] text-ink-mute">
                        {guestSearch ? `No guests matching "${guestSearch}"` : "No guests found"}
                      </div>
                    ) : (
                      allGuests.map((g) => {
                        const on = form.guestId === g.id;
                        return (
                          <button
                            key={g.id}
                            onClick={() => {
                              set("guestId", g.id);
                              set("guestName", g.fullName);
                              set("guestCity", g.city ?? "");
                              set("guestStays", g.totalStays);
                              set("guestBlacklisted", g.isBlacklisted);
                              set("isVip", g.vipLevel > 0);
                            }}
                            className={cn(
                              "flex items-center gap-3 rounded-[1.25rem] border p-3.5 text-left transition-all",
                              on ? "border-coral ring-2 ring-coral/15 bg-white" : "border-line bg-white hover:border-ink-faint",
                            )}
                          >
                            <Avatar name={g.fullName} size={42} vip={g.vipLevel > 0 || g.totalStays >= 5} />
                            <div className="min-w-0 flex-1">
                              <div className="text-[14px] font-semibold text-ink truncate">{g.fullName}</div>
                              <div className="text-[12px] text-ink-mute truncate">
                                {[g.city, `${g.totalStays} stay${g.totalStays !== 1 ? "s" : ""}`].filter(Boolean).join(" · ")}
                              </div>
                            </div>
                            {on && <CheckCircle2 size={18} className="text-coral shrink-0" />}
                          </button>
                        );
                      })
                    )}
                  </div>

                  {form.guestId && form.guestBlacklisted && (
                    <div
                      className="flex items-start gap-2.5 rounded-xl px-3.5 py-3 text-[13px]"
                      style={{ background: TONE.clay.bg, color: TONE.clay.fg }}
                    >
                      <ShieldAlert size={16} className="shrink-0 mt-0.5" />
                      <span>This guest is blacklisted. You can still proceed, but please review with management.</span>
                    </div>
                  )}

                  {/* Adults/Children — total capped at room's maxOccupancy */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-4">
                      <NumStepper
                        label="Adults" value={form.adults}
                        onInc={() => set("adults", Math.min(maxOccupancy - form.children, form.adults + 1))}
                        onDec={() => set("adults", Math.max(1, form.adults - 1))}
                        min={1} max={maxOccupancy - form.children}
                      />
                      <NumStepper
                        label="Children" value={form.children}
                        onInc={() => set("children", Math.min(maxOccupancy - form.adults, form.children + 1))}
                        onDec={() => set("children", Math.max(0, form.children - 1))}
                        min={0} max={maxOccupancy - form.adults}
                      />
                    </div>
                    <p className={cn("text-[13px]", form.adults + form.children >= maxOccupancy ? "text-amber font-semibold" : "text-ink-soft")}>
                      {form.adults + form.children >= maxOccupancy
                        ? `Max occupancy reached (${maxOccupancy} guest${maxOccupancy !== 1 ? "s" : ""})`
                        : `${form.adults + form.children} of ${maxOccupancy} guest${maxOccupancy !== 1 ? "s" : ""} · ${maxOccupancy - form.adults - form.children} remaining`}
                    </p>
                  </div>

                  <VipToggleRow checked={form.isVip} onToggle={() => set("isVip", !form.isVip)} />
                </>
              ) : (
                <>
                  {/* New guest form */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="mb-1.5 block text-[13px] font-semibold text-ink-soft">First name <span className="text-coral text-[15px] font-bold leading-none">*</span></label>
                      <input type="text" value={form.newFirstName} onChange={(e) => set("newFirstName", e.target.value)} placeholder="Ahmed" className={inputCls} />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-[13px] font-semibold text-ink-soft">Last name <span className="text-coral text-[15px] font-bold leading-none">*</span></label>
                      <input type="text" value={form.newLastName} onChange={(e) => set("newLastName", e.target.value)} placeholder="Raza" className={inputCls} />
                    </div>
                    <div className="col-span-2">
                      <label className="mb-1.5 block text-[13px] font-semibold text-ink-soft">Phone <span className="text-coral text-[15px] font-bold leading-none">*</span></label>
                      <input
                        type="tel" value={form.newPhone}
                        onChange={(e) => { set("newPhone", e.target.value); setNewPhoneError(""); }}
                        onBlur={() => { if (form.newPhone.trim()) setNewPhoneError(getPhoneErrorMessage(form.newPhone) ?? ""); }}
                        placeholder="03XX XXXXXXX"
                        className={cn(inputCls, newPhoneError && "border-clay/50")}
                      />
                      {newPhoneError && <p className="mt-1 text-[12px] text-clay">{newPhoneError}</p>}
                    </div>
                    <div>
                      <label className="mb-1.5 block text-[13px] font-semibold text-ink-soft">ID type <span className="text-coral text-[15px] font-bold leading-none">*</span></label>
                      <div className="relative">
                        <select value={form.newDocType} onChange={(e) => set("newDocType", e.target.value)} className={cn(inputCls, "appearance-none pr-9 cursor-pointer")}>
                          <option value="CNIC">CNIC</option>
                          <option value="PASSPORT">Passport</option>
                          <option value="DRIVING_LICENSE">Driving License</option>
                          <option value="NRIC">NRIC</option>
                          <option value="OTHER">Other</option>
                        </select>
                        <ChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-mute pointer-events-none" />
                      </div>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-[13px] font-semibold text-ink-soft">
                        ID number <span className="text-clay text-[15px] font-bold leading-none">*</span>
                      </label>
                      <input type="text" value={form.newDocNumber} onChange={(e) => set("newDocNumber", e.target.value)} placeholder="35202-•••••••-7" className={inputCls} />
                    </div>
                  </div>
                  {blacklistResult?.matched && (
                    <div
                      className="flex items-start gap-2.5 rounded-xl px-3.5 py-3 text-[13px]"
                      style={{ background: TONE.clay.bg, color: TONE.clay.fg }}
                    >
                      <ShieldAlert size={16} className="shrink-0 mt-0.5" />
                      <span>
                        A blacklisted guest matches these details
                        {blacklistResult.matches[0] ? ` (${blacklistResult.matches[0].guestName})` : ""}.
                        Reason: {blacklistResult.matches[0]?.reason || "—"}.
                      </span>
                    </div>
                  )}

                  {/* Adults/Children — total capped at room's maxOccupancy */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-4">
                      <NumStepper label="Adults"   value={form.adults}   onInc={() => set("adults",   Math.min(maxOccupancy - form.children, form.adults + 1))}   onDec={() => set("adults",   Math.max(1, form.adults - 1))}   min={1} max={maxOccupancy - form.children} />
                      <NumStepper label="Children" value={form.children} onInc={() => set("children", Math.min(maxOccupancy - form.adults, form.children + 1))} onDec={() => set("children", Math.max(0, form.children - 1))} min={0} max={maxOccupancy - form.adults} />
                    </div>
                    <p className={cn("text-[13px]", form.adults + form.children >= maxOccupancy ? "text-amber font-semibold" : "text-ink-soft")}>
                      {form.adults + form.children >= maxOccupancy
                        ? `Max occupancy reached (${maxOccupancy} guest${maxOccupancy !== 1 ? "s" : ""})`
                        : `${form.adults + form.children} of ${maxOccupancy} guest${maxOccupancy !== 1 ? "s" : ""} · ${maxOccupancy - form.adults - form.children} remaining`}
                    </p>
                  </div>

                  <VipToggleRow checked={form.isVip} onToggle={() => set("isVip", !form.isVip)} />
                </>
              )}
            </div>
          )}

          {/* ── Step 2: Review ────────────────────────────────────────────── */}
          {step === 2 && selectedRoom && (
            <div className="space-y-4">
              {/* Summary card */}
              <div className="rounded-[1.25rem] border border-line bg-mist p-5">
                {/* Guest + room row */}
                <div className="flex items-center gap-3.5 mb-4">
                  <Avatar
                    name={form.useNewGuest ? `${form.newFirstName} ${form.newLastName}` : form.guestName}
                    size={48}
                    vip={form.isVip || (!form.useNewGuest && form.guestStays >= 5)}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="serif text-[20px] text-ink leading-tight">
                      {form.useNewGuest ? `${form.newFirstName} ${form.newLastName}` : form.guestName}
                    </div>
                    <div className="text-[13px] text-ink-mute">
                      {form.adults} adult{form.adults !== 1 ? "s" : ""}
                      {form.children > 0 ? ` · ${form.children} children` : ""}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[12px] text-ink-mute">Room {selectedRoom.number}</div>
                    <div className="text-[15px] font-semibold text-ink">{selectedRoom.roomType.name}</div>
                  </div>
                </div>

                {/* Dates grid */}
                <div className="grid grid-cols-3 gap-2 text-center border-t border-line pt-4">
                  <div>
                    <div className="text-[11px] font-bold uppercase text-ink-faint tracking-wider">Check-in</div>
                    <div className="serif text-[18px] text-ink mt-0.5">{fmtDate(form.checkIn)}</div>
                  </div>
                  <div className="border-x border-line-soft">
                    <div className="text-[11px] font-bold uppercase text-ink-faint tracking-wider">Nights</div>
                    <div className="serif text-[28px] text-coral leading-none mt-0.5 tnum">{nights}</div>
                  </div>
                  <div>
                    <div className="text-[11px] font-bold uppercase text-ink-faint tracking-wider">Check-out</div>
                    <div className="serif text-[18px] text-ink mt-0.5">{fmtDate(form.checkOut)}</div>
                  </div>
                </div>
              </div>

              {/* Charges */}
              <div className="rounded-[1.25rem] border border-line bg-white p-5 space-y-3">
                {/* Editable rate — seeded from suggest endpoint, staff can override */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[13px] font-semibold text-ink-soft">Rate per night</label>
                    {suggestData?.matchedPlan && (
                      <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-pine bg-pine/20 border border-pine/40 px-2.5 py-1 rounded-lg">
                        <Tag size={11} strokeWidth={2.5} />
                        {suggestData.matchedPlan.name}
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[13px] text-ink-mute pointer-events-none">Rs</span>
                    <input
                      type="number" min={0} step="1"
                      value={Math.round(form.ratePerNight / 100)}
                      onChange={(e) => set("ratePerNight", Math.max(0, Math.round((Number(e.target.value) || 0) * 100)))}
                      className={cn(inputCls, "pl-9")}
                    />
                  </div>
                  {suggestData && suggestData.allMatchingPlans.length > 1 && (
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {suggestData.allMatchingPlans.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => set("ratePerNight", p.rate)}
                          className={cn(
                            "text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-colors",
                            form.ratePerNight === p.rate
                              ? "border-coral bg-coral-soft text-coral-deep"
                              : "border-line bg-white text-ink-mute hover:border-ink-faint",
                          )}
                        >
                          {p.name} · Rs {Math.round(p.rate / 100).toLocaleString("en-PK")}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between text-[14px] border-t border-line-soft pt-3">
                  <span className="text-ink-mute">{fmtPkr(form.ratePerNight)} × {nights} nights</span>
                  <span className="font-semibold text-ink tnum">{fmtPkr(subtotal)}</span>
                </div>
                <div className="flex items-center justify-between text-[14px]">
                  <span className="text-ink-mute">Service tax (5%)</span>
                  <span className="font-semibold text-ink tnum">{fmtPkr(tax)}</span>
                </div>
                <div className="border-t border-line-soft pt-3 flex items-center justify-between">
                  <span className="text-[15px] font-bold text-ink">Total due</span>
                  <span className="serif text-[26px] text-ink tnum">{fmtPkr(totalAmount)}</span>
                </div>
              </div>

              {/* Advance payment */}
              <div className="rounded-[1.25rem] border border-line bg-white p-5 space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1.5 block text-[13px] font-semibold text-ink-soft">
                      Advance payment received <span className="text-ink-faint font-normal">(optional)</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[13px] text-ink-mute pointer-events-none">Rs</span>
                      <input
                        type="number" min={0} step="1" placeholder="0"
                        value={form.advancePayment}
                        onChange={(e) => set("advancePayment", e.target.value)}
                        className={cn(inputCls, "pl-9")}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[13px] font-semibold text-ink-soft">Payment method</label>
                    <div className="relative">
                      <select
                        value={form.advancePaymentMethod}
                        onChange={(e) => set("advancePaymentMethod", e.target.value as PaymentMethod)}
                        disabled={!form.advancePayment || Number(form.advancePayment) <= 0}
                        className={cn(inputCls, "appearance-none pr-9 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed")}
                      >
                        {PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                      </select>
                      <ChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-mute pointer-events-none" />
                    </div>
                  </div>
                </div>
                {Number(form.advancePayment) > 0 && (
                  <div className="flex items-center justify-between text-[13px] pt-1 border-t border-line-soft">
                    <span className="text-ink-mute">Balance due at check-in</span>
                    <span className="font-semibold text-ink tnum">
                      {fmtPkr(Math.max(0, totalAmount - Math.round(Number(form.advancePayment) * 100)))}
                    </span>
                  </div>
                )}
              </div>

              {/* Source */}
              <div>
                <label className="mb-1.5 block text-[13px] font-semibold text-ink-soft">Booking source</label>
                <div className="relative">
                  <select value={form.source} onChange={(e) => set("source", e.target.value as BookingSource)} className={cn(inputCls, "appearance-none pr-9 cursor-pointer")}>
                    {SOURCES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                  <ChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-mute pointer-events-none" />
                </div>
              </div>

            </div>
          )}

          {duplicateGuestWarning && (
            <div className="mt-3 rounded-xl border border-amber/30 bg-amber-soft px-3.5 py-3">
              <p className="text-[13px] text-ink-soft font-medium">{duplicateGuestWarning}</p>
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => setDuplicateGuestWarning("")}
                  className="text-[13px] font-semibold text-ink-mute hover:text-ink"
                >
                  Go back
                </button>
                <button
                  onClick={createNewGuestAnyway}
                  className="text-[13px] font-semibold text-coral hover:underline"
                >
                  This is a different person — create anyway
                </button>
              </div>
            </div>
          )}

          {stepError && (
            <p className="mt-3 text-[13px] text-clay font-medium">{stepError}</p>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-line-soft px-6 py-4 flex items-center justify-between bg-card rounded-b-[1.75rem]">
          {step > 0 ? (
            <button
              onClick={() => { setStep((s) => s - 1); setStepError(""); }}
              className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink-mute hover:text-ink transition-colors"
            >
              <ChevronLeft size={16} /> Back
            </button>
          ) : (
            <button onClick={onClose} className="text-[13px] font-semibold text-ink-mute hover:text-ink transition-colors">
              Cancel
            </button>
          )}

          {step < 2 ? (
            <button
              onClick={goNext}
              disabled={step === 0 && (!!roomConflict || checkingAvailability)}
              className="inline-flex items-center gap-2 h-10 px-5 rounded-full bg-coral text-white text-[14px] font-semibold hover:bg-coral-dark transition-colors shadow-pop disabled:opacity-40 disabled:pointer-events-none"
            >
              Continue <ArrowRight size={16} />
            </button>
          ) : (
            <button
              onClick={handleConfirm}
              disabled={isPending}
              className="inline-flex items-center gap-2 h-10 px-5 rounded-full bg-coral text-white text-[14px] font-semibold hover:bg-coral-dark transition-all shadow-pop disabled:opacity-40 disabled:pointer-events-none"
            >
              <Check size={16} strokeWidth={2.4} />
              {isPending ? "Confirming…" : "Confirm reservation"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
