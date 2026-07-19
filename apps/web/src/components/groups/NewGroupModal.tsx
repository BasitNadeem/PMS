import { useState, useEffect, useRef } from "react";
import { getPhoneErrorMessage } from "@/lib/validation";
import { useMutation, useQuery, useQueries, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  X, ChevronLeft, ChevronDown, ArrowRight, Check, CheckCircle2,
  Users2, Plus, Trash2, Search, Tag, AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { getErrorMessage, getErrorDetails } from "@/lib/api";
import { roomsService } from "@/services/rooms";
import { guestsService, type GuestSummary } from "@/services/guests";
import {
  groupsService,
  type CreateGroupDto,
  type PayerType,
  type BillingType,
  type PaymentTerms,
} from "@/services/groups";
import { Avatar } from "@/components/ui/Avatar";
import { DateRangePicker } from "@/components/ui/DateRangePicker";
import { useEscapeKey } from "@/hooks/useEscapeKey";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtPkr(paisas: number): string {
  return `PKR ${Math.round(paisas / 100).toLocaleString("en-PK")}`;
}
function nightsBetween(from: string, to: string): number {
  if (!from || !to) return 0;
  return Math.max(0, Math.ceil((new Date(to).getTime() - new Date(from).getTime()) / 86_400_000));
}
const inputCls = "h-11 w-full rounded-xl bg-white border border-line px-3.5 text-sm text-ink placeholder:text-ink-faint outline-none focus:border-coral focus:ring-2 focus:ring-coral/15 transition-all";

const STEPS = ["Group Details", "Rooms", "Group Leader"] as const;

const PAYER_TYPE_OPTIONS: { value: PayerType; label: string }[] = [
  { value: "TOUR_AGENCY", label: "Tour Agency" },
  { value: "CORPORATE",   label: "Corporate" },
  { value: "GOVERNMENT",  label: "Government" },
  { value: "NGO",         label: "NGO" },
  { value: "INDIVIDUAL",  label: "Individual / Family" },
];

const PAYMENT_TERMS_OPTIONS: { value: PaymentTerms; label: string }[] = [
  { value: "CASH",           label: "Cash on Arrival" },
  { value: "ADVANCE_50",     label: "50% Advance" },
  { value: "ADVANCE_100",    label: "100% Advance" },
  { value: "ADVANCE_CUSTOM", label: "Custom % Advance" },
  { value: "CREDIT_30",      label: "30-Day Credit" },
  { value: "CREDIT_60",      label: "60-Day Credit" },
];

// ── Stepper ───────────────────────────────────────────────────────────────────

function Stepper({ current }: { current: number }) {
  return (
    <div className="flex items-center px-6 py-4 bg-mist border-b border-line-soft">
      {STEPS.map((label, i) => (
        <div key={label} className={cn("flex items-center", i < STEPS.length - 1 && "flex-1")}>
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
          {i < STEPS.length - 1 && (
            <div className={cn("flex-1 h-px mx-3", i < current ? "bg-pine" : "bg-line")} />
          )}
        </div>
      ))}
    </div>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface RoomLine {
  key: string;
  roomTypeId: string;
  roomTypeName: string;
  quantity: number;
  ratePerNight: number; // paisas
}

interface AdditionalGuest {
  id: string;
  fullName: string;
}

interface WizardState {
  name: string;
  payerType: PayerType;
  payerName: string;
  payerContact: string;
  checkIn: string;
  checkOut: string;
  billingType: BillingType;
  paymentTerms: PaymentTerms;
  advancePercent: string; // %, as input string (ADVANCE_CUSTOM only)
  advancePaid: string; // PKR, as input string
  notes: string;

  rooms: RoomLine[];

  useNewGuest: boolean;
  guestId: string;
  guestName: string;
  newFirstName: string;
  newLastName: string;
  newPhone: string;
  newDocType: string;
  newDocNumber: string;

  additionalGuests: AdditionalGuest[];
}

export interface NewGroupModalProps {
  onClose: () => void;
  onSuccess: (groupId: string) => void;
  initialPayerType?: PayerType;
  initialCheckIn?: string;
  initialCheckOut?: string;
}

// ── Main component ────────────────────────────────────────────────────────────

export function NewGroupModal({ onClose, onSuccess, initialPayerType, initialCheckIn, initialCheckOut }: NewGroupModalProps) {
  useEscapeKey(onClose);
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [stepError, setStepError] = useState("");
  const [duplicateGuestWarning, setDuplicateGuestWarning] = useState("");
  const [newPhoneError, setNewPhoneError] = useState("");

  const [form, setForm] = useState<WizardState>({
    name: "", payerType: initialPayerType ?? "TOUR_AGENCY", payerName: "", payerContact: "",
    checkIn: initialCheckIn ?? "", checkOut: initialCheckOut ?? "",
    billingType: "SINGLE", paymentTerms: "CASH", advancePercent: "", advancePaid: "0", notes: "",
    rooms: [],
    useNewGuest: true,
    guestId: "", guestName: "",
    newFirstName: "", newLastName: "", newPhone: "", newDocType: "CNIC", newDocNumber: "",
    additionalGuests: [],
  });

  function set<K extends keyof WizardState>(key: K, value: WizardState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setStepError("");
  }

  // ── Room types & rooms (for availability) ────────────────────────────────
  const { data: roomTypesData } = useQuery({
    queryKey: ["room-types"],
    queryFn: roomsService.getRoomTypes,
  });
  const roomTypes = roomTypesData?.data ?? [];

  // Date-aware availability per room type — NOT just "how many rooms of this
  // type exist", but "how many are actually free for these dates". Without
  // this, the picker would let you add more rooms than are really available
  // and the booking silently lands some rooms in "pending assignment".
  const availabilityQueries = useQueries({
    queries: roomTypes.map((rt) => ({
      queryKey: ["room-type-availability", rt.id, form.checkIn, form.checkOut],
      queryFn: () => roomsService.checkAvailability({
        roomTypeId: rt.id, checkInDate: form.checkIn, checkOutDate: form.checkOut,
      }),
      enabled: !!form.checkIn && !!form.checkOut && form.checkOut > form.checkIn,
      staleTime: 10_000,
    })),
  });

  const availableCountByType: Record<string, number> = {};
  const conflictsByType: Record<string, { roomNumber: string; guestName: string }[]> = {};
  roomTypes.forEach((rt, i) => {
    const result = availabilityQueries[i]?.data;
    if (result) {
      availableCountByType[rt.id] = result.availableRoomIds.length;
      conflictsByType[rt.id] = result.conflicts;
    }
  });
  const checkingAvailability = availabilityQueries.some((q) => q.isFetching);

  // ── Add-room row state ────────────────────────────────────────────────────
  const [showAddRoom, setShowAddRoom]   = useState(false);
  const [addRoomTypeId, setAddRoomTypeId] = useState("");
  const [addQuantity, setAddQuantity]   = useState(1);
  const [addRate, setAddRate]           = useState(0); // PKR

  // Reset quantity when room type changes
  useEffect(() => {
    setAddQuantity(1);
  }, [addRoomTypeId]);

  function payerTypeToBookingContext(pt: string): "TOUR_AGENCY" | "CORPORATE" | "OTHER" {
    if (pt === "TOUR_AGENCY") return "TOUR_AGENCY";
    if (pt === "CORPORATE")   return "CORPORATE";
    return "OTHER";
  }

  // Suggest rate for the selected room type + dates; falls back to defaultRate
  const suggestAddEnabled = !!addRoomTypeId && !!form.checkIn && !!form.checkOut && form.checkOut > form.checkIn;
  const { data: addSuggestData } = useQuery({
    queryKey: ["rate-suggest-group", addRoomTypeId, form.checkIn, form.checkOut, form.payerType],
    queryFn: async () => {
      const res = await api.get("/api/rate-plans/suggest", {
        params: {
          roomTypeId:     addRoomTypeId,
          checkIn:        form.checkIn,
          checkOut:       form.checkOut,
          bookingContext: payerTypeToBookingContext(form.payerType),
        },
      });
      return res.data.data as {
        suggestedRate:       number;
        matchedPlan:         { id: string; name: string } | null;
        noDedicatedRateHint: string | null;
      };
    },
    enabled: suggestAddEnabled,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (addSuggestData) {
      setAddRate(Math.round(addSuggestData.suggestedRate / 100));
    } else if (!suggestAddEnabled) {
      // Fall back to room type defaultRate when dates aren't set yet
      const rt = roomTypes.find((t) => t.id === addRoomTypeId);
      if (rt) setAddRate(Math.round(rt.defaultRate / 100));
    }
  }, [addSuggestData, addRoomTypeId, roomTypes, suggestAddEnabled]);

  function addRoomLine() {
    const rt = roomTypes.find((t) => t.id === addRoomTypeId);
    if (!rt || addQuantity < 1 || availableForAddType < 1) return;
    setForm((f) => ({
      ...f,
      rooms: [
        ...f.rooms,
        { key: `${rt.id}-${Date.now()}`, roomTypeId: rt.id, roomTypeName: rt.name, quantity: addQuantity, ratePerNight: addRate * 100 },
      ],
    }));
    setShowAddRoom(false);
    setAddRoomTypeId("");
    setAddQuantity(1);
    setAddRate(0);
  }

  function removeRoomLine(key: string) {
    setForm((f) => ({ ...f, rooms: f.rooms.filter((r) => r.key !== key) }));
  }

  // ── Guest search (leader) ─────────────────────────────────────────────────
  const [guestSearchInput, setGuestSearchInput] = useState("");
  const [guestSearch, setGuestSearch] = useState("");
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => setGuestSearch(guestSearchInput.trim()), 350);
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, [guestSearchInput]);

  const { data: guestsData, isFetching: guestsFetching } = useQuery({
    queryKey: ["guests-modal", guestSearch],
    queryFn: () => guestsService.getGuests({ limit: 30, search: guestSearch || undefined }),
    staleTime: 30_000,
    enabled: !form.useNewGuest,
  });
  const allGuests: GuestSummary[] = guestsData?.data ?? [];

  // ── Additional guests search ─────────────────────────────────────────────
  const [extraSearchInput, setExtraSearchInput] = useState("");
  const [extraSearch, setExtraSearch] = useState("");
  const extraTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (extraTimerRef.current) clearTimeout(extraTimerRef.current);
    extraTimerRef.current = setTimeout(() => setExtraSearch(extraSearchInput.trim()), 350);
    return () => { if (extraTimerRef.current) clearTimeout(extraTimerRef.current); };
  }, [extraSearchInput]);

  const { data: extraGuestsData, isFetching: extraGuestsFetching } = useQuery({
    queryKey: ["guests-modal-extra", extraSearch],
    queryFn: () => guestsService.getGuests({ limit: 20, search: extraSearch || undefined }),
    staleTime: 30_000,
    enabled: extraSearch.length > 0,
  });
  const extraGuestResults: GuestSummary[] = extraGuestsData?.data ?? [];

  function addExtraGuest(g: GuestSummary) {
    if (form.additionalGuests.some((a) => a.id === g.id)) return;
    if (g.id === form.guestId) return;
    set("additionalGuests", [...form.additionalGuests, { id: g.id, fullName: g.fullName }]);
  }
  function removeExtraGuest(id: string) {
    set("additionalGuests", form.additionalGuests.filter((a) => a.id !== id));
  }

  // ── Mutations ──────────────────────────────────────────────────────────────
  const createGroupMutation = useMutation({
    mutationFn: (dto: CreateGroupDto) => groupsService.createGroup(dto),
  });

  const addMemberMutation = useMutation({
    mutationFn: ({ groupId, guestId }: { groupId: string; guestId: string }) =>
      groupsService.addMember(groupId, { guestId, isLeader: false }),
  });

  const isPending = createGroupMutation.isPending || addMemberMutation.isPending;

  // ── Derived values ─────────────────────────────────────────────────────────
  const nights      = nightsBetween(form.checkIn, form.checkOut);
  const totalRooms  = form.rooms.reduce((sum, r) => sum + r.quantity, 0);
  const estTotal    = form.rooms.reduce((sum, r) => sum + r.ratePerNight * r.quantity * nights, 0);
  const today       = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; })();
  const showAdvance = form.paymentTerms === "ADVANCE_50" || form.paymentTerms === "ADVANCE_100" || form.paymentTerms === "ADVANCE_CUSTOM";
  const showAdvancePercent = form.paymentTerms === "ADVANCE_CUSTOM";

  // ── Available rooms per type (accounting for rooms already added to this group) ──
  const allocatedByType: Record<string, number> = {};
  for (const r of form.rooms) {
    allocatedByType[r.roomTypeId] = (allocatedByType[r.roomTypeId] ?? 0) + r.quantity;
  }
  const availableForAddType = addRoomTypeId
    ? Math.max(0, (availableCountByType[addRoomTypeId] ?? 0) - (allocatedByType[addRoomTypeId] ?? 0))
    : 0;

  // Auto-calculate the advance PKR amount from the percentage once room totals are known.
  useEffect(() => {
    if (form.paymentTerms !== "ADVANCE_CUSTOM" || !form.advancePercent || estTotal <= 0) return;
    const pct = Number(form.advancePercent);
    if (isNaN(pct) || pct < 0) return;
    const pkr = Math.round((estTotal / 100) * (pct / 100));
    setForm((f) => ({ ...f, advancePaid: String(pkr) }));
  }, [form.advancePercent, form.paymentTerms, estTotal]);

  // ── Validation ──────────────────────────────────────────────────────────────
  function validateStep0(): string {
    if (!form.name.trim()) return "Group / tour name is required";
    if (!form.payerName.trim()) return "Payer name is required";
    if (!form.checkIn) return "Check-in date is required";
    if (!form.checkOut) return "Check-out date is required";
    if (form.checkOut <= form.checkIn) return "Check-out must be after check-in";
    return "";
  }
  function validateStep1(): string {
    if (form.rooms.length === 0) return "Add at least one room type";
    return "";
  }
  function validateStep2(): string {
    if (form.useNewGuest) {
      if (!form.newFirstName.trim()) return "First name is required";
      if (!form.newLastName.trim())  return "Last name is required";
      if (!form.newPhone.trim())     return "Phone is required";
      const phoneErr = getPhoneErrorMessage(form.newPhone);
      if (phoneErr) { setNewPhoneError(phoneErr); return phoneErr; }
    } else {
      if (!form.guestId) return "Please select the group leader";
    }
    return "";
  }

  function goNext() {
    const err = step === 0 ? validateStep0() : step === 1 ? validateStep1() : "";
    if (err) { setStepError(err); return; }
    setStepError("");
    setStep((s) => s + 1);
  }

  // The leader guest is created server-side inside GroupService.createGroup
  // from leaderGuest.newGuest — creating it again here would leave two guest
  // records for the same person, so this only builds the DTO, never calls
  // guestsService.createGuest directly for the leader.
  function buildGroupDto(allowDuplicateLeader?: boolean): CreateGroupDto {
    return {
      name: form.name.trim(),
      payerType: form.payerType,
      payerName: form.payerName.trim(),
      payerContact: form.payerContact.trim() || undefined,
      billingType: form.billingType,
      paymentTerms: form.paymentTerms,
      advancePaid: showAdvance ? Number(form.advancePaid) || 0 : 0,
      negotiatedRate: 0,
      checkInDate: form.checkIn,
      checkOutDate: form.checkOut,
      totalRooms,
      notes: form.notes.trim() || undefined,
      rooms: form.rooms.map((r) => ({ roomTypeId: r.roomTypeId, quantity: r.quantity, ratePerNight: r.ratePerNight })),
      leaderGuest: form.useNewGuest
        ? {
            newGuest: {
              firstName: form.newFirstName.trim(), lastName: form.newLastName.trim(),
              phone: form.newPhone.trim(), documentType: form.newDocType as "CNIC" | "PASSPORT" | "DRIVING_LICENSE" | "NRIC" | "OTHER",
              documentNumber: form.newDocNumber.trim(),
              ...(allowDuplicateLeader && { allowDuplicate: true }),
            },
          }
        : { existingGuestId: form.guestId },
    };
  }

  async function submitGroup(dto: CreateGroupDto) {
    const group = await createGroupMutation.mutateAsync(dto);

    for (const extra of form.additionalGuests) {
      await addMemberMutation.mutateAsync({ groupId: group.id, guestId: extra.id });
    }

    qc.invalidateQueries({ queryKey: ["groups"] });
    qc.invalidateQueries({ queryKey: ["groups-summary"] });
    onSuccess(group.id);
  }

  async function handleConfirm() {
    const err = validateStep2();
    if (err) { setStepError(err); return; }
    setStepError("");
    setDuplicateGuestWarning("");

    try {
      await submitGroup(buildGroupDto());
    } catch (apiErr) {
      const details = getErrorDetails(apiErr) as { existingGuestId?: string } | undefined;
      if (details?.existingGuestId) {
        setDuplicateGuestWarning(getErrorMessage(apiErr));
      } else {
        setStepError(getErrorMessage(apiErr));
      }
    }
  }

  async function createGroupAnyway() {
    setDuplicateGuestWarning("");
    try {
      await submitGroup(buildGroupDto(true));
    } catch (apiErr) {
      setStepError(getErrorMessage(apiErr));
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 bg-ink/35 backdrop-blur-[3px] z-50 grid place-items-center p-4 sm:p-6 anim-fade-in"
      onMouseDown={onClose}
    >
      <div
        className="relative w-full max-w-2xl max-h-[92vh] flex flex-col bg-card rounded-[1.75rem] shadow-float anim-scale-in"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3.5 px-6 pt-6 pb-4 border-b border-line-soft">
          <div className="grid place-items-center h-11 w-11 rounded-xl bg-coral-soft text-coral-deep shrink-0">
            <Users2 size={20} />
          </div>
          <div className="flex-1">
            <h3 className="serif text-[22px] leading-tight text-ink">New group booking</h3>
            <p className="text-[13px] text-ink-mute">Step {step + 1} of 3 · {STEPS[step]}</p>
          </div>
          <button
            onClick={onClose}
            className="grid place-items-center h-9 w-9 rounded-full hover:bg-line-soft text-ink-mute transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <Stepper current={step} />

        {/* Body */}
        <div className="flex-1 overflow-y-auto scroll-area px-6 py-5">

          {/* ── Step 0: Group Details ─────────────────────────────────────── */}
          {step === 0 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="mb-1.5 block text-[13px] font-semibold text-ink-soft">Group / Tour name <span className="text-coral text-[15px] font-bold leading-none">*</span></label>
                  <input type="text" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Sunrise Tours — Hunza Trip" className={inputCls} />
                </div>
                <div>
                  <label className="mb-1.5 block text-[13px] font-semibold text-ink-soft">Group type</label>
                  <div className="relative">
                    <select value={form.payerType} onChange={(e) => set("payerType", e.target.value as PayerType)} className={cn(inputCls, "appearance-none pr-9 cursor-pointer")}>
                      {PAYER_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                    <ChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-mute pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-[13px] font-semibold text-ink-soft">Payer name <span className="text-coral text-[15px] font-bold leading-none">*</span></label>
                  <input type="text" value={form.payerName} onChange={(e) => set("payerName", e.target.value)} placeholder="Company / agency name" className={inputCls} />
                </div>
                <div className="col-span-2">
                  <label className="mb-1.5 block text-[13px] font-semibold text-ink-soft">Payer contact</label>
                  <input type="text" value={form.payerContact} onChange={(e) => set("payerContact", e.target.value)} placeholder="Phone or email" className={inputCls} />
                </div>
              </div>

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

              {nights > 0 && (
                <div className="rounded-xl bg-mist border border-line px-4 py-2.5 flex items-center justify-between">
                  <span className="text-[13px] text-ink-mute">Length of stay</span>
                  <span className="text-[14px] font-bold text-ink tnum">{nights} night{nights !== 1 ? "s" : ""}</span>
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-[13px] font-semibold text-ink-soft">Billing</label>
                <div className="inline-flex items-center gap-0.5 rounded-full bg-line-soft p-1">
                  <button
                    onClick={() => set("billingType", "SINGLE")}
                    className={cn("rounded-full px-4 h-9 text-[13px] font-semibold transition-all", form.billingType === "SINGLE" ? "bg-card text-ink shadow-pop" : "text-ink-mute hover:text-ink-soft")}
                  >
                    Single Bill
                  </button>
                  <button
                    onClick={() => set("billingType", "SPLIT")}
                    className={cn("rounded-full px-4 h-9 text-[13px] font-semibold transition-all", form.billingType === "SPLIT" ? "bg-card text-ink shadow-pop" : "text-ink-mute hover:text-ink-soft")}
                  >
                    Split by Room
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-[13px] font-semibold text-ink-soft">Payment terms</label>
                  <div className="relative">
                    <select value={form.paymentTerms} onChange={(e) => set("paymentTerms", e.target.value as PaymentTerms)} className={cn(inputCls, "appearance-none pr-9 cursor-pointer")}>
                      {PAYMENT_TERMS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                    <ChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-mute pointer-events-none" />
                  </div>
                </div>
                {showAdvancePercent && (
                  <div>
                    <label className="mb-1.5 block text-[13px] font-semibold text-ink-soft">Advance %</label>
                    <input type="number" min={0} max={100} value={form.advancePercent} onChange={(e) => set("advancePercent", e.target.value)} placeholder="e.g. 35" className={inputCls} />
                  </div>
                )}
                {showAdvance && (
                  <div>
                    <label className="mb-1.5 block text-[13px] font-semibold text-ink-soft">Advance paid (PKR)</label>
                    <input type="number" min={0} value={form.advancePaid} onChange={(e) => set("advancePaid", e.target.value)} className={inputCls} />
                    {showAdvancePercent && estTotal === 0 && (
                      <p className="mt-1 text-[11px] text-ink-faint">Add rooms to auto-calculate from %, or enter manually.</p>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="mb-1.5 block text-[13px] font-semibold text-ink-soft">Notes (optional)</label>
                <textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={3} placeholder="Internal notes about this group…" className={cn(inputCls, "h-auto py-2.5 resize-none")} />
              </div>
            </div>
          )}

          {/* ── Step 1: Rooms ─────────────────────────────────────────────── */}
          {step === 1 && (
            <div className="space-y-4">
              {/* Added room lines */}
              {form.rooms.length > 0 && (
                <div className="space-y-2">
                  {form.rooms.map((r) => {
                    const available = availableCountByType[r.roomTypeId] ?? 0;
                    const requested = allocatedByType[r.roomTypeId] ?? r.quantity;
                    const shortfall = Math.max(0, requested - available);
                    const conflicts = conflictsByType[r.roomTypeId] ?? [];
                    return (
                      <div key={r.key}>
                        <div className="flex items-center gap-3 rounded-xl border border-line bg-white p-3.5">
                          <div className="flex-1 min-w-0">
                            <div className="text-[14px] font-semibold text-ink truncate">{r.roomTypeName}</div>
                            <div className="text-[12px] text-ink-mute">{r.quantity} room{r.quantity !== 1 ? "s" : ""} · {fmtPkr(r.ratePerNight)}/night</div>
                          </div>
                          <button onClick={() => removeRoomLine(r.key)} className="grid place-items-center h-8 w-8 rounded-lg text-ink-faint hover:bg-line-soft hover:text-clay transition-colors">
                            <Trash2 size={15} />
                          </button>
                        </div>
                        {shortfall > 0 && (
                          <div className="mt-1.5 rounded-xl border border-clay/25 bg-clay-soft px-3.5 py-2.5">
                            <p className="text-[12.5px] text-ink-soft">
                              <span className="font-semibold text-clay">
                                Only {available} of {requested} requested {r.roomTypeName} room{requested !== 1 ? "s" : ""} {available === 1 ? "is" : "are"} available
                              </span>{" "}
                              for these dates
                              {conflicts.length > 0 && (
                                <> — booked by {conflicts.slice(0, 2).map((c) => c.guestName).join(", ")}{conflicts.length > 2 ? ` +${conflicts.length - 2} more` : ""}</>
                              )}
                              . The remaining {shortfall} will be created as &quot;needs room assignment&quot; and can be assigned manually later.
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Add room row */}
              {showAddRoom ? (
                <div className="rounded-xl border border-line bg-mist p-4 space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-3 sm:col-span-1">
                      <label className="mb-1.5 block text-[12px] font-semibold text-ink-soft">Room type</label>
                      <div className="relative">
                        <select value={addRoomTypeId} onChange={(e) => setAddRoomTypeId(e.target.value)} className={cn(inputCls, "appearance-none pr-9 cursor-pointer h-10 text-[13px]")}>
                          <option value="">Select…</option>
                          {roomTypes.map((rt) => <option key={rt.id} value={rt.id}>{rt.name}</option>)}
                        </select>
                        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-mute pointer-events-none" />
                      </div>
                      {addRoomTypeId && (
                        <p className={cn("mt-1 text-[11px]", availableForAddType > 0 ? "text-ink-faint" : "text-clay font-semibold")}>
                          {checkingAvailability
                            ? "Checking availability…"
                            : `${availableForAddType} room${availableForAddType !== 1 ? "s" : ""} available for these dates`}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="mb-1.5 block text-[12px] font-semibold text-ink-soft">Quantity</label>
                      <input
                        type="number" min={1} max={Math.max(availableForAddType, 1)}
                        value={addQuantity}
                        onChange={(e) => {
                          const raw = Math.max(1, parseInt(e.target.value, 10) || 1);
                          setAddQuantity(availableForAddType > 0 ? Math.min(raw, availableForAddType) : raw);
                        }}
                        className={cn(inputCls, "h-10 text-[13px]")}
                      />
                    </div>
                    <div>
                      <label className="block text-[12px] font-semibold text-ink-soft mb-1.5">Rate/night (PKR)</label>
                      <input type="number" min={0} value={addRate} onChange={(e) => setAddRate(Math.max(0, parseInt(e.target.value, 10) || 0))} className={cn(inputCls, "h-10 text-[13px]")} />
                      {addSuggestData?.matchedPlan && (
                        <span className="mt-1.5 inline-flex items-center gap-1 text-[12px] font-semibold text-pine bg-pine/20 border border-pine/40 px-2.5 py-1 rounded-lg">
                          <Tag size={11} strokeWidth={2.5} />
                          {addSuggestData.matchedPlan.name}
                        </span>
                      )}
                      {addSuggestData?.noDedicatedRateHint && (
                        <div className="mt-2 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                          <AlertTriangle size={13} className="text-amber-500 shrink-0 mt-px" />
                          <p className="text-[12px] leading-snug text-amber-700">{addSuggestData.noDedicatedRateHint}</p>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <button onClick={() => setShowAddRoom(false)} className="h-9 px-3.5 rounded-lg text-[13px] font-semibold text-ink-mute hover:text-ink transition-colors">Cancel</button>
                    <button onClick={addRoomLine} disabled={!addRoomTypeId || availableForAddType < 1} className="h-9 px-4 rounded-lg bg-coral text-white text-[13px] font-semibold hover:bg-coral-dark transition-colors disabled:opacity-40">Add</button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowAddRoom(true)}
                  className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-line py-3 text-[13px] font-semibold text-ink-mute hover:border-ink-faint hover:text-ink-soft transition-colors"
                >
                  <Plus size={15} /> Add Room Type
                </button>
              )}

              {/* Summary */}
              {form.rooms.length > 0 && (
                <div className="rounded-[1.25rem] border border-line bg-mist p-5 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <div className="text-[11px] font-bold uppercase text-ink-faint tracking-wider">Total rooms</div>
                    <div className="serif text-[22px] text-ink mt-0.5 tnum">{totalRooms}</div>
                  </div>
                  <div className="border-x border-line-soft">
                    <div className="text-[11px] font-bold uppercase text-ink-faint tracking-wider">Total nights</div>
                    <div className="serif text-[22px] text-ink mt-0.5 tnum">{nights}</div>
                  </div>
                  <div>
                    <div className="text-[11px] font-bold uppercase text-ink-faint tracking-wider">Est. total</div>
                    <div className="serif text-[22px] text-coral mt-0.5 tnum">{fmtPkr(estTotal)}</div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Step 2: Group Leader ──────────────────────────────────────── */}
          {step === 2 && (
            <div className="space-y-5">
              <div>
                <p className="mb-2 text-[13px] font-semibold text-ink-soft">Group leader</p>
                <div className="inline-flex items-center gap-0.5 rounded-full bg-line-soft p-1 mb-3">
                  <button
                    onClick={() => { set("useNewGuest", true); setGuestSearchInput(""); setGuestSearch(""); }}
                    className={cn("rounded-full px-4 h-9 text-[13px] font-semibold transition-all", form.useNewGuest ? "bg-card text-ink shadow-pop" : "text-ink-mute hover:text-ink-soft")}
                  >
                    New guest
                  </button>
                  <button
                    onClick={() => set("useNewGuest", false)}
                    className={cn("rounded-full px-4 h-9 text-[13px] font-semibold transition-all", !form.useNewGuest ? "bg-card text-ink shadow-pop" : "text-ink-mute hover:text-ink-soft")}
                  >
                    Existing guest
                  </button>
                </div>

                {!form.useNewGuest ? (
                  <div className="space-y-2.5">
                    <div className="relative">
                      <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint pointer-events-none" />
                      <input
                        type="text" value={guestSearchInput} onChange={(e) => setGuestSearchInput(e.target.value)}
                        placeholder="Search by name or phone…"
                        className="w-full h-10 rounded-xl border border-line bg-white pl-9 pr-3.5 text-[13.5px] text-ink placeholder:text-ink-faint focus:outline-none focus:border-coral focus:ring-2 focus:ring-coral/15 transition-all"
                      />
                      {guestsFetching && <div className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 rounded-full border-2 border-coral/30 border-t-coral animate-spin" />}
                    </div>
                    <div className="grid grid-cols-2 gap-2.5 max-h-[28vh] overflow-y-auto scroll-area pr-0.5">
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
                              onClick={() => { set("guestId", g.id); set("guestName", g.fullName); }}
                              className={cn("flex items-center gap-3 rounded-[1.25rem] border p-3.5 text-left transition-all", on ? "border-coral ring-2 ring-coral/15 bg-white" : "border-line bg-white hover:border-ink-faint")}
                            >
                              <Avatar name={g.fullName} size={40} vip={g.totalStays >= 5} />
                              <div className="min-w-0 flex-1">
                                <div className="text-[14px] font-semibold text-ink truncate">{g.fullName}</div>
                                <div className="text-[12px] text-ink-mute truncate">{g.phone ?? "—"}</div>
                              </div>
                              {on && <CheckCircle2 size={18} className="text-coral shrink-0" />}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                ) : (
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
                      <label className="mb-1.5 block text-[13px] font-semibold text-ink-soft">ID type</label>
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
                      <label className="mb-1.5 block text-[13px] font-semibold text-ink-soft">ID number</label>
                      <input type="text" value={form.newDocNumber} onChange={(e) => set("newDocNumber", e.target.value)} placeholder="35202-•••••••-7" className={inputCls} />
                    </div>
                  </div>
                )}
              </div>

              {/* Additional guests */}
              <div>
                <p className="mb-2 text-[13px] font-semibold text-ink-soft">Add another guest (optional)</p>
                <div className="relative mb-2.5">
                  <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint pointer-events-none" />
                  <input
                    type="text" value={extraSearchInput} onChange={(e) => setExtraSearchInput(e.target.value)}
                    placeholder="Search guests to add…"
                    className="w-full h-10 rounded-xl border border-line bg-white pl-9 pr-3.5 text-[13.5px] text-ink placeholder:text-ink-faint focus:outline-none focus:border-coral focus:ring-2 focus:ring-coral/15 transition-all"
                  />
                  {extraGuestsFetching && <div className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 rounded-full border-2 border-coral/30 border-t-coral animate-spin" />}
                </div>

                {extraSearch && extraGuestResults.length > 0 && (
                  <div className="grid grid-cols-2 gap-2 mb-2.5 max-h-[18vh] overflow-y-auto scroll-area pr-0.5">
                    {extraGuestResults.map((g) => (
                      <button
                        key={g.id}
                        onClick={() => addExtraGuest(g)}
                        className="flex items-center gap-2.5 rounded-xl border border-line bg-white p-2.5 text-left hover:border-ink-faint transition-all"
                      >
                        <Avatar name={g.fullName} size={32} />
                        <div className="min-w-0 flex-1">
                          <div className="text-[13px] font-semibold text-ink truncate">{g.fullName}</div>
                          <div className="text-[11px] text-ink-mute truncate">{g.phone ?? "—"}</div>
                        </div>
                        <Plus size={14} className="text-ink-faint shrink-0" />
                      </button>
                    ))}
                  </div>
                )}

                {form.additionalGuests.length > 0 && (
                  <div className="space-y-1.5">
                    {form.additionalGuests.map((g) => (
                      <div key={g.id} className="flex items-center gap-2.5 rounded-xl border border-line bg-mist px-3 py-2">
                        <Avatar name={g.fullName} size={28} />
                        <span className="flex-1 text-[13px] font-semibold text-ink truncate">{g.fullName}</span>
                        <button onClick={() => removeExtraGuest(g.id)} className="grid place-items-center h-7 w-7 rounded-lg text-ink-faint hover:bg-line-soft hover:text-clay transition-colors">
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <p className="mt-2.5 text-[12px] text-ink-faint">You can add more guests later from the booking detail.</p>
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
                  onClick={createGroupAnyway}
                  className="text-[13px] font-semibold text-coral hover:underline"
                >
                  This is a different person — create anyway
                </button>
              </div>
            </div>
          )}

          {stepError && <p className="mt-3 text-[13px] text-clay font-medium">{stepError}</p>}
        </div>

        {/* Footer */}
        <div className="border-t border-line-soft px-6 py-4 flex items-center justify-between bg-card rounded-b-[1.75rem]">
          {step > 0 ? (
            <button onClick={() => { setStep((s) => s - 1); setStepError(""); }} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink-mute hover:text-ink transition-colors">
              <ChevronLeft size={16} /> Back
            </button>
          ) : (
            <button onClick={onClose} className="text-[13px] font-semibold text-ink-mute hover:text-ink transition-colors">Cancel</button>
          )}

          {step < 2 ? (
            <button onClick={goNext} className="inline-flex items-center gap-2 h-10 px-5 rounded-full bg-coral text-white text-[14px] font-semibold hover:bg-coral-dark transition-colors shadow-pop">
              Continue <ArrowRight size={16} />
            </button>
          ) : (
            <button
              onClick={handleConfirm}
              disabled={isPending}
              className="inline-flex items-center gap-2 h-10 px-5 rounded-full bg-coral text-white text-[14px] font-semibold hover:bg-coral-dark transition-all shadow-pop disabled:opacity-40 disabled:pointer-events-none"
            >
              <Check size={16} strokeWidth={2.4} />
              {isPending ? "Creating…" : "Create group booking"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
