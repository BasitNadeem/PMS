import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check, ChevronLeft, Copy, Calendar, CreditCard, Smartphone,
  Package, Sparkles, Bed, Users, Building2, type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { hotelsService } from "@/services/hotels";
import { authService } from "@/services/auth";
import { settingsService, type UpdateSettingsDto, type ThemeKey } from "@/services/settings";
import { roomsService, type RoomType, type RoomTypeName, type RoomStatus } from "@/services/rooms";
import { usersService, type Role } from "@/services/users";
import { applyTheme } from "@/lib/theme";
import { ThemePicker } from "@/components/settings/ThemePicker";

// ── Constants ─────────────────────────────────────────────────────────────────

const STEP_LABELS = ["Welcome", "Hotel Profile", "Add Rooms", "Your Team", "Appearance"];

const STEP_DESCRIPTIONS = [
  "Let's get you familiar with what's waiting for you.",
  "Basic details help your team and your reports look professional.",
  "Rooms are the foundation. Add at least one to get started.",
  "Your staff need access. Add them now or later.",
  "Pick a color palette for the app. You can change this anytime in Settings.",
];

const PROPERTY_TYPES = [
  "HOTEL", "GUESTHOUSE", "RESORT", "LODGE",
  "HOSTEL", "SERVICED_APARTMENT", "CAMPSITE",
];
const PROPERTY_LABELS: Record<string, string> = {
  HOTEL: "Hotel", GUESTHOUSE: "Guesthouse", RESORT: "Resort", LODGE: "Lodge",
  HOSTEL: "Hostel", SERVICED_APARTMENT: "Serviced Apartment", CAMPSITE: "Campsite",
};

// Must mirror AddRoomTypeModal.tsx's TYPE_OPTIONS exactly — the Rooms page and
// onboarding wizard need identical room type wording.
const BED_TYPES: { label: string; value: RoomTypeName }[] = [
  { label: "Single",        value: "SINGLE" },
  { label: "Double",        value: "DOUBLE" },
  { label: "Twin",          value: "TWIN" },
  { label: "Triple",        value: "TRIPLE" },
  { label: "Family",        value: "FAMILY" },
  { label: "Suite",         value: "SUITE" },
  { label: "Dormitory",     value: "DORMITORY" },
  { label: "Cottage",       value: "COTTAGE" },
  { label: "Tent / Glamping", value: "TENT_GLAMPING" },
];

const TEAM_ROLES: { name: string; label: string }[] = [
  { name: "MANAGER",      label: "Manager" },
  { name: "FRONT_DESK",   label: "Front Desk" },
  { name: "HOUSEKEEPING", label: "Housekeeping" },
  { name: "KITCHEN",      label: "Kitchen" },
  { name: "MAINTENANCE",  label: "Maintenance" },
  { name: "ACCOUNTANT",   label: "Accountant" },
];

const FEATURES: { icon: LucideIcon; title: string; subtitle: string }[] = [
  { icon: Calendar,    title: "Real-time reservations",   subtitle: "Manage bookings from any source in one place" },
  { icon: CreditCard,  title: "Automatic billing",        subtitle: "Every payment tracked and reconciled instantly" },
  { icon: Smartphone,  title: "Nightly WhatsApp briefing", subtitle: "Get a daily summary on your phone at 11 PM" },
];

// ── Completion celebration ───────────────────────────────────────────────────

const CELEBRATION_LINES = [
  "Packing up your hotel empire... \u{1F4E6}",
  "Sprinkling a little magic ✨",
  "Tidying the last few pixels...",
  "You're all set. Let's go! \u{1F680}",
];

const CONVERGE_ICONS: LucideIcon[] = [Building2, Bed, Users, CreditCard, Sparkles];

const CONFETTI_COLORS = ["bg-coral", "bg-pine", "bg-amber", "bg-slate", "bg-dusk"];

// ── Helpers ───────────────────────────────────────────────────────────────────

function getCurrentUserId(): string | null {
  const token = localStorage.getItem("accessToken");
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split(".")[1] ?? ""));
    return (payload as { userId?: string }).userId ?? null;
  } catch { return null; }
}

function generateTempPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  let pwd = "";
  for (let i = 0; i < 10; i++) pwd += chars[Math.floor(Math.random() * chars.length)];
  return pwd;
}

const inputCls = "w-full rounded-xl border border-line bg-mist px-3.5 py-2.5 text-[14px] text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-coral/20 focus:border-coral/40 transition-colors";
const labelCls = "block text-[13px] font-semibold text-ink-soft mb-1.5";

const stepVariants = {
  initial: (direction: number) => ({ opacity: 0, x: direction > 0 ? 56 : -56, scale: 0.96, rotateY: direction > 0 ? 8 : -8 }),
  animate: { opacity: 1, x: 0, scale: 1, rotateY: 0 },
  exit:    (direction: number) => ({ opacity: 0, x: direction > 0 ? -56 : 56, scale: 0.96, rotateY: direction > 0 ? -8 : 8 }),
};

const stepTransition = { duration: 0.35, ease: [0.22, 1, 0.36, 1] as const };

// Diagonal color wipe that sweeps across the content area on every step change.
const sweepVariants = {
  initial: (direction: number) => ({ x: direction > 0 ? "-100%" : "100%", opacity: 0.35 }),
  animate: (direction: number) => ({ x: direction > 0 ? "100%" : "-100%", opacity: 0 }),
};

// ── Left panel ────────────────────────────────────────────────────────────────

function LeftPanel({ hotelName, currentStep, onSkip }: { hotelName?: string; currentStep: number; onSkip: () => void }) {
  return (
    <div className="w-[28%] shrink-0 h-screen bg-coral-soft flex flex-col relative">
      {/* Top section */}
      <div className="pt-10 px-8">
        <div className="text-xs font-medium tracking-widest uppercase text-ink opacity-70 truncate">
          {hotelName ?? "Your Hotel"}
        </div>

        <div className="mt-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, y: 14, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -14, scale: 0.92 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
              <div className="text-6xl font-bold text-ink opacity-10 leading-none">
                {String(currentStep).padStart(2, "0")}
              </div>
              <h2 className="text-xl font-semibold text-ink mt-2">{STEP_LABELS[currentStep - 1]}</h2>
              <p className="text-sm text-ink opacity-70 mt-2 leading-relaxed">{STEP_DESCRIPTIONS[currentStep - 1]}</p>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Middle section — vertical stepper */}
      <div className="mt-10 px-8 flex flex-col gap-y-5">
        {STEP_LABELS.map((label, idx) => {
          const stepNumber = idx + 1;
          const isCompleted = stepNumber < currentStep;
          const isCurrent   = stepNumber === currentStep;
          return (
            <div key={label} className="flex items-center gap-3 relative">
              {idx < STEP_LABELS.length - 1 && (
                <span
                  className={cn(
                    "absolute left-[13px] top-7 w-px h-5 transition-colors duration-300",
                    isCompleted ? "bg-coral" : "bg-coral/20",
                  )}
                />
              )}
              <motion.span
                className={cn(
                  "relative z-10 grid place-items-center h-7 w-7 rounded-full text-[12px] font-bold shrink-0",
                  isCompleted || isCurrent
                    ? "bg-coral text-white"
                    : "border-2 border-ink/20 text-ink/40",
                )}
                animate={isCurrent ? { scale: [1, 1.12, 1] } : { scale: 1 }}
                transition={isCurrent ? { duration: 1.8, repeat: Infinity, ease: "easeInOut" } : { duration: 0.2 }}
              >
                {isCompleted ? (
                  <motion.span
                    initial={{ scale: 0, rotate: -45 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", stiffness: 500, damping: 15 }}
                  >
                    <Check size={14} />
                  </motion.span>
                ) : stepNumber}
              </motion.span>
              <span className={cn("text-sm transition-colors duration-300", isCurrent ? "font-medium text-ink" : "text-ink/50")}>
                {label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Bottom section */}
      <button
        onClick={onSkip}
        className="absolute bottom-8 left-8 text-xs text-ink opacity-50 hover:opacity-80 transition-opacity cursor-pointer underline-offset-2 hover:underline"
      >
        Skip setup
      </button>
    </div>
  );
}

// ── Shared step header ───────────────────────────────────────────────────────

function StepHeader({ title, subtitle, onBack }: { title: string; subtitle: string; onBack: () => void }) {
  return (
    <>
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 cursor-pointer transition-colors mb-6"
      >
        <ChevronLeft size={16} />
        Back
      </button>
      <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
      <p className="text-sm text-gray-500 mt-1.5 mb-8">{subtitle}</p>
    </>
  );
}

// ── Step 1 — Welcome ─────────────────────────────────────────────────────────

function StepWelcome({ ownerName, onNext }: { ownerName: string; onNext: () => void }) {
  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900">Welcome, {ownerName}</h1>
      <p className="text-base text-gray-500 mt-2">
        Your property management system is ready.
        <br />
        Let&apos;s complete setup in under 5 minutes.
      </p>

      <div className="mt-8 flex flex-col gap-3">
        {FEATURES.map((f) => {
          const Icon = f.icon;
          return (
            <div key={f.title} className="border border-gray-200 rounded-xl p-4 flex gap-4 items-start shadow-sm">
              <div className="grid place-items-center h-10 w-10 rounded-lg bg-coral text-white shrink-0">
                <Icon size={18} />
              </div>
              <div>
                <div className="text-sm font-semibold text-gray-900">{f.title}</div>
                <div className="text-sm text-gray-500 mt-0.5">{f.subtitle}</div>
              </div>
            </div>
          );
        })}
      </div>

      <button
        onClick={onNext}
        className="mt-10 w-full bg-coral hover:bg-coral-dark text-white font-medium rounded-xl py-3.5 text-base transition-colors"
      >
        Get Started →
      </button>
    </div>
  );
}

// ── Step 2 — Hotel Profile ───────────────────────────────────────────────────

function StepHotelProfile({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const { data: settings, isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: settingsService.getSettings,
    staleTime: 30_000,
  });

  const [form, setForm] = useState({
    name: "", propertyType: "HOTEL", city: "", phone: "",
    checkInTime: "14:00", checkOutTime: "12:00", description: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!settings) return;
    const s = (settings.settings ?? {}) as Record<string, unknown>;
    setForm({
      name:         settings.name ?? "",
      propertyType: settings.propertyType ?? "HOTEL",
      city:         settings.city ?? "",
      phone:        settings.phone ?? "",
      checkInTime:  String(s.checkInTime ?? "14:00"),
      checkOutTime: String(s.checkOutTime ?? "12:00"),
      description:  String(s.description ?? ""),
    });
  }, [settings]);

  async function handleSave() {
    if (!form.name.trim() || !form.city.trim()) {
      setError("Hotel name and city are required");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const dto: UpdateSettingsDto = {
        name: form.name,
        propertyType: form.propertyType,
        city: form.city,
        phone: form.phone,
        checkInTime: form.checkInTime,
        checkOutTime: form.checkOutTime,
        description: form.description,
        onboardingStep: 2,
      };
      await settingsService.updateSettings(dto);
      onNext();
    } catch {
      setError("Failed to save hotel profile");
    } finally {
      setSaving(false);
    }
  }

  if (isLoading) {
    return <div className="h-64 bg-line-soft rounded-xl2 animate-pulse" />;
  }

  return (
    <div>
      <StepHeader
        title="Tell us about your property"
        subtitle="This information appears on receipts and reports"
        onBack={onBack}
      />

      {error && (
        <div className="mb-4 p-3 bg-clay-soft border border-clay/20 rounded-lg text-sm text-clay">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className={labelCls}>Hotel name <span className="text-coral">*</span></label>
          <input
            className={inputCls} value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Property type</label>
            <select
              className={cn(inputCls, "cursor-pointer")}
              value={form.propertyType}
              onChange={(e) => setForm((f) => ({ ...f, propertyType: e.target.value }))}
            >
              {PROPERTY_TYPES.map((t) => (
                <option key={t} value={t}>{PROPERTY_LABELS[t] ?? t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>City <span className="text-coral">*</span></label>
            <input
              className={inputCls} value={form.city}
              onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
            />
          </div>
        </div>
        <div>
          <label className={labelCls}>Phone number</label>
          <input
            className={inputCls} value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            placeholder="+92 5812 000000"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Check-in time</label>
            <input
              type="time" className={inputCls} value={form.checkInTime}
              onChange={(e) => setForm((f) => ({ ...f, checkInTime: e.target.value }))}
            />
          </div>
          <div>
            <label className={labelCls}>Check-out time</label>
            <input
              type="time" className={inputCls} value={form.checkOutTime}
              onChange={(e) => setForm((f) => ({ ...f, checkOutTime: e.target.value }))}
            />
          </div>
        </div>
        <div>
          <label className={labelCls}>Brief description</label>
          <textarea
            className={cn(inputCls, "resize-none h-20")}
            rows={3}
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="A short description of the property…"
          />
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="mt-8 w-full bg-coral hover:bg-coral-dark disabled:opacity-60 text-white font-semibold rounded-xl py-4 text-[15px] transition-colors"
      >
        {saving ? "Saving…" : "Save & Continue →"}
      </button>
    </div>
  );
}

// ── Step 3 — Add Rooms ───────────────────────────────────────────────────────

function StepRooms({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const { data: roomTypesRes, isLoading, refetch } = useQuery({
    queryKey: ["onboarding-room-types"],
    queryFn: roomsService.getRoomTypes,
  });

  const [createdRoomType, setCreatedRoomType] = useState<RoomType | null>(null);
  const [roomTypeForm, setRoomTypeForm] = useState({ name: "", baseRate: "", maxOccupancy: "2", bedType: "DOUBLE" as RoomTypeName });
  const [roomForm, setRoomForm] = useState({ number: "", floor: "" });
  const [lastAddedRoom, setLastAddedRoom] = useState<string | null>(null);
  const [roomsAdded, setRoomsAdded] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (roomTypesRes?.data?.length && !createdRoomType) {
      setCreatedRoomType(roomTypesRes.data[0]);
    }
  }, [roomTypesRes, createdRoomType]);

  async function handleAddRoomType() {
    if (!roomTypeForm.name.trim() || !roomTypeForm.baseRate || !roomTypeForm.maxOccupancy) {
      setError("Please fill in all room type fields");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const roomType = await roomsService.createRoomType({
        name: roomTypeForm.name,
        typeName: roomTypeForm.bedType,
        maxOccupancy: parseInt(roomTypeForm.maxOccupancy, 10),
        defaultRate: parseInt(roomTypeForm.baseRate, 10),
      });
      setCreatedRoomType(roomType);
      await refetch();
    } catch {
      setError("Failed to create room type");
    } finally {
      setSaving(false);
    }
  }

  async function handleAddRoom() {
    if (!roomForm.number.trim() || !createdRoomType) {
      setError("Room number is required");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const room = await roomsService.createRoom({
        number: roomForm.number,
        floor: roomForm.floor ? parseInt(roomForm.floor, 10) : undefined,
        roomTypeId: createdRoomType.id,
        status: "VACANT_CLEAN" as RoomStatus,
      });
      setLastAddedRoom(room.number);
      setRoomsAdded((n) => n + 1);
      setRoomForm({ number: "", floor: "" });
    } catch {
      setError("Failed to add room");
    } finally {
      setSaving(false);
    }
  }

  if (isLoading) {
    return <div className="h-64 bg-line-soft rounded-xl2 animate-pulse" />;
  }

  return (
    <div>
      <StepHeader
        title="Set up your rooms"
        subtitle="Add at least one room to start taking reservations"
        onBack={onBack}
      />

      {error && (
        <div className="mb-4 p-3 bg-clay-soft border border-clay/20 rounded-lg text-sm text-clay">
          {error}
        </div>
      )}

      {!createdRoomType ? (
        <div className="space-y-4">
          <div>
            <label className={labelCls}>Room type name</label>
            <input
              className={inputCls} value={roomTypeForm.name}
              onChange={(e) => setRoomTypeForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Deluxe Room"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Base rate per night (PKR)</label>
              <input
                type="number" min="0" className={inputCls} value={roomTypeForm.baseRate}
                onChange={(e) => setRoomTypeForm((f) => ({ ...f, baseRate: e.target.value }))}
                placeholder="8000"
              />
            </div>
            <div>
              <label className={labelCls}>Max occupancy</label>
              <input
                type="number" min="1" className={inputCls} value={roomTypeForm.maxOccupancy}
                onChange={(e) => setRoomTypeForm((f) => ({ ...f, maxOccupancy: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <label className={labelCls}>Bed type</label>
            <select
              className={cn(inputCls, "cursor-pointer")}
              value={roomTypeForm.bedType}
              onChange={(e) => setRoomTypeForm((f) => ({ ...f, bedType: e.target.value as RoomTypeName }))}
            >
              {BED_TYPES.map((b) => (
                <option key={b.label} value={b.value}>{b.label}</option>
              ))}
            </select>
          </div>
          <button
            onClick={handleAddRoomType}
            disabled={saving}
            className="w-full bg-coral hover:bg-coral-dark disabled:opacity-60 text-white font-semibold rounded-xl py-4 text-[15px] transition-colors"
          >
            {saving ? "Adding…" : "Add Room Type"}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-pine font-semibold text-[14px]">
            <Check size={16} />
            Room type &apos;{createdRoomType.name}&apos; created
          </div>

          {lastAddedRoom && (
            <div className="flex items-center gap-2 text-pine font-semibold text-[14px]">
              <Check size={16} />
              Room {lastAddedRoom} added
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Room number</label>
              <input
                className={inputCls} value={roomForm.number}
                onChange={(e) => setRoomForm((f) => ({ ...f, number: e.target.value }))}
                placeholder="101"
              />
            </div>
            <div>
              <label className={labelCls}>Floor</label>
              <input
                type="number" className={inputCls} value={roomForm.floor}
                onChange={(e) => setRoomForm((f) => ({ ...f, floor: e.target.value }))}
                placeholder="1"
              />
            </div>
          </div>
          <div>
            <label className={labelCls}>Room type</label>
            <input className={cn(inputCls, "opacity-60 cursor-not-allowed")} value={createdRoomType.name} readOnly />
          </div>

          <button
            onClick={handleAddRoom}
            disabled={saving}
            className="w-full border-2 border-coral text-coral hover:bg-coral-soft disabled:opacity-60 font-semibold rounded-xl py-3 text-[14px] transition-colors"
          >
            {saving ? "Adding…" : roomsAdded > 0 ? "Add Another Room" : "Add Room"}
          </button>

          {roomsAdded > 0 && (
            <button
              onClick={onNext}
              className="w-full bg-coral hover:bg-coral-dark text-white font-semibold rounded-xl py-4 text-[15px] transition-colors"
            >
              Continue →
            </button>
          )}
        </div>
      )}

      <button
        onClick={onNext}
        className="mt-4 w-full text-center text-[13px] font-semibold text-ink-mute hover:text-ink-soft transition-colors"
      >
        Skip for now →
      </button>
    </div>
  );
}

// ── Step 4 — Your Team ───────────────────────────────────────────────────────

interface AddedMember {
  name: string;
  roleLabel: string;
  tempPassword: string;
}

function StepTeam({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const { data: roles = [] } = useQuery<Role[]>({
    queryKey: ["roles"],
    queryFn: usersService.getRoles,
    staleTime: 5 * 60_000,
  });

  const teamRoleOptions = TEAM_ROLES
    .map((tr) => {
      const role = roles.find((r) => r.name === tr.name);
      return role ? { roleId: role.id, name: tr.name, label: tr.label } : null;
    })
    .filter((r): r is { roleId: string; name: string; label: string } => r !== null);

  const [form, setForm] = useState({ name: "", email: "", roleId: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [members, setMembers] = useState<AddedMember[]>([]);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  async function handleAdd() {
    if (!form.name.trim() || !form.email.trim() || !form.roleId) {
      setError("Name, email and role are required");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const tempPassword = generateTempPassword();
      await usersService.createUser({
        name: form.name,
        email: form.email,
        password: tempPassword,
        roleId: form.roleId,
      });
      const roleLabel = teamRoleOptions.find((r) => r.roleId === form.roleId)?.label ?? "Staff";
      setMembers((m) => [...m, { name: form.name, roleLabel, tempPassword }]);
      setForm({ name: "", email: "", roleId: "" });
    } catch {
      setError("Failed to add team member");
    } finally {
      setSaving(false);
    }
  }

  function copyCredentials(member: AddedMember, idx: number) {
    void navigator.clipboard.writeText(`Temporary password: ${member.tempPassword}`);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 1500);
  }

  return (
    <div>
      <StepHeader
        title="Invite your team"
        subtitle="Add staff members so they can log in and help manage the hotel"
        onBack={onBack}
      />

      {error && (
        <div className="mb-4 p-3 bg-clay-soft border border-clay/20 rounded-lg text-sm text-clay">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className={labelCls}>Full name <span className="text-coral">*</span></label>
          <input
            className={inputCls} value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
        </div>
        <div>
          <label className={labelCls}>Email <span className="text-coral">*</span></label>
          <input
            type="email" className={inputCls} value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          />
        </div>
        <div>
          <label className={labelCls}>Role <span className="text-coral">*</span></label>
          <select
            className={cn(inputCls, "cursor-pointer")}
            value={form.roleId}
            onChange={(e) => setForm((f) => ({ ...f, roleId: e.target.value }))}
          >
            <option value="">Select a role…</option>
            {teamRoleOptions.map((r) => (
              <option key={r.roleId} value={r.roleId}>{r.label}</option>
            ))}
          </select>
        </div>

        <button
          onClick={handleAdd}
          disabled={saving}
          className="w-full border-2 border-coral text-coral hover:bg-coral-soft disabled:opacity-60 font-semibold rounded-xl py-3 text-[14px] transition-colors"
        >
          {saving ? "Adding…" : "Add Team Member"}
        </button>
      </div>

      {members.length > 0 && (
        <div className="mt-6 space-y-3">
          {members.map((m, idx) => (
            <div key={idx} className="bg-green-50 border border-green-200 rounded-xl p-4">
              <div className="text-[14px] font-semibold text-ink">✓ {m.name} added as {m.roleLabel}</div>
              <div className="text-[13px] text-ink-mute mt-1">Temporary password: <span className="font-mono font-semibold text-ink">{m.tempPassword}</span></div>
              <button
                onClick={() => copyCredentials(m, idx)}
                className="mt-2 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-pine-deep hover:text-pine transition-colors"
              >
                <Copy size={13} />
                {copiedIdx === idx ? "Copied!" : "Copy credentials"}
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={onNext}
        className="mt-8 w-full bg-coral hover:bg-coral-dark text-white font-semibold rounded-xl py-4 text-[15px] transition-colors"
      >
        Continue →
      </button>
    </div>
  );
}

// ── Step 5 — Appearance ──────────────────────────────────────────────────────

function StepTheme({ onBack, onFinish }: { onBack: () => void; onFinish: () => void }) {
  const [themeKey, setThemeKey] = useState<ThemeKey>("WARM_CLAY");
  const [saving, setSaving] = useState(false);

  function pick(key: ThemeKey) {
    setThemeKey(key);
    applyTheme(key); // live preview
  }

  async function finish() {
    setSaving(true);
    try {
      await settingsService.updateSettings({ themeKey });
    } catch {
      // Non-critical — owner can change it later in Settings.
    } finally {
      setSaving(false);
      onFinish();
    }
  }

  return (
    <div>
      <StepHeader
        title="Make it yours"
        subtitle="Choose a color palette for the app. Default is Warm Clay — change anytime in Settings."
        onBack={onBack}
      />

      <ThemePicker value={themeKey} onChange={pick} />

      <button
        onClick={finish}
        disabled={saving}
        className="mt-8 w-full bg-coral hover:bg-coral-dark disabled:opacity-60 text-white font-semibold rounded-xl py-4 text-[15px] transition-colors"
      >
        {saving ? "Saving…" : "Go to Dashboard →"}
      </button>
      <button
        onClick={() => { applyTheme("WARM_CLAY"); onFinish(); }}
        className="mt-3 w-full text-center text-[13px] font-semibold text-ink-mute hover:text-ink-soft transition-colors"
      >
        Skip — keep Warm Clay
      </button>
    </div>
  );
}

// ── Completion overlay ───────────────────────────────────────────────────────

function CompletionOverlay({ onDone }: { onDone: () => void }) {
  const [lineIdx, setLineIdx] = useState(0);

  const [confetti] = useState(() =>
    Array.from({ length: 28 }, (_, i) => ({
      left: Math.random() * 100,
      size: 6 + Math.random() * 6,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      rounded: i % 2 === 0,
      duration: 2 + Math.random() * 1.5,
      delay: Math.random() * 0.8,
    })),
  );

  useEffect(() => {
    const lineDuration = 5000 / CELEBRATION_LINES.length;
    const lineTimer = setInterval(() => {
      setLineIdx((i) => (i < CELEBRATION_LINES.length - 1 ? i + 1 : i));
    }, lineDuration);
    const doneTimer = setTimeout(onDone, lineDuration * CELEBRATION_LINES.length);
    return () => { clearInterval(lineTimer); clearTimeout(doneTimer); };
  }, [onDone]);

  return (
    <motion.div
      className="fixed inset-0 z-50 bg-ink overflow-hidden flex flex-col items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
    >
      {confetti.map((c, i) => (
        <motion.span
          key={i}
          className={cn("absolute top-0", c.rounded ? "rounded-full" : "rounded-sm", c.color)}
          style={{ left: `${c.left}%`, width: c.size, height: c.size }}
          initial={{ y: -20, opacity: 0, rotate: 0 }}
          animate={{ y: "110vh", opacity: [0, 1, 1, 0.6], rotate: 360 }}
          transition={{ duration: c.duration, delay: c.delay, ease: "linear" }}
        />
      ))}

      <div className="relative h-28 w-28 mb-8">
        {CONVERGE_ICONS.map((Icon, i) => {
          const angle = (i / CONVERGE_ICONS.length) * 2 * Math.PI;
          const radius = 90;
          return (
            <motion.div
              key={i}
              className="absolute inset-0 grid place-items-center text-coral"
              initial={{ x: Math.cos(angle) * radius, y: Math.sin(angle) * radius, opacity: 1, scale: 1 }}
              animate={{ x: 0, y: 0, opacity: 0, scale: 0.2 }}
              transition={{ duration: 0.7, delay: 0.3 + i * 0.12, ease: "easeIn" }}
            >
              <Icon size={26} />
            </motion.div>
          );
        })}
        <motion.div
          className="absolute inset-0 grid place-items-center text-coral"
          initial={{ scale: 0, rotate: -15 }}
          animate={{ scale: [0, 1.25, 1], rotate: 0 }}
          transition={{ delay: 1.1, duration: 0.5, ease: "easeOut" }}
        >
          <Package size={60} />
        </motion.div>
      </div>

      <AnimatePresence mode="wait">
        <motion.p
          key={lineIdx}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.3 }}
          className="text-white text-lg font-semibold tracking-wide"
        >
          {CELEBRATION_LINES[lineIdx]}
        </motion.p>
      </AnimatePresence>
    </motion.div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [direction, setDirection] = useState(1);
  const [completing, setCompleting] = useState(false);

  const { data: hotel } = useQuery({
    queryKey: ["onboarding-hotel-me"],
    queryFn: hotelsService.getMe,
  });

  const { data: staff = [] } = useQuery({
    queryKey: ["onboarding-users"],
    queryFn: usersService.getUsers,
  });

  const currentUserId = getCurrentUserId();
  const ownerName = staff.find((s) => s.user.id === currentUserId)?.user.name ?? "there";

  function goTo(step: number) {
    setDirection(step > currentStep ? 1 : -1);
    setCurrentStep(step);
  }

  async function finishNow() {
    await authService.completeOnboarding();
    localStorage.setItem("isFirstLogin", "false");
    localStorage.setItem("onboardingCompleted", "true");
    navigate("/");
  }

  return (
    <div className="h-screen flex overflow-hidden">
      <LeftPanel hotelName={hotel?.name} currentStep={currentStep} onSkip={finishNow} />

      <div className="relative w-[72%] bg-white overflow-y-auto" style={{ perspective: 1200 }}>
        {/* Progress bar */}
        <div className="sticky top-0 left-0 right-0 h-1 bg-coral-soft z-20">
          <motion.div
            className="h-full bg-coral"
            animate={{ width: `${(currentStep / STEP_LABELS.length) * 100}%` }}
            transition={stepTransition}
          />
        </div>

        {/* Diagonal wipe — fires on every step change */}
        <AnimatePresence>
          <motion.div
            key={`sweep-${currentStep}`}
            className="absolute inset-0 z-10 pointer-events-none bg-coral"
            style={{ clipPath: "polygon(0 0, 100% 0, 85% 100%, -15% 100%)" }}
            custom={direction}
            variants={sweepVariants}
            initial="initial"
            animate="animate"
            transition={{ duration: 0.5, ease: "easeInOut" }}
          />
        </AnimatePresence>

        <div className="p-12">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={currentStep}
              custom={direction}
              initial="initial"
              animate="animate"
              exit="exit"
              variants={stepVariants}
              transition={stepTransition}
            >
              {currentStep === 1 && (
                <StepWelcome ownerName={ownerName} onNext={() => goTo(2)} />
              )}
              {currentStep === 2 && (
                <StepHotelProfile onBack={() => goTo(1)} onNext={() => goTo(3)} />
              )}
              {currentStep === 3 && (
                <StepRooms onBack={() => goTo(2)} onNext={() => goTo(4)} />
              )}
              {currentStep === 4 && (
                <StepTeam onBack={() => goTo(3)} onNext={() => goTo(5)} />
              )}
              {currentStep === 5 && (
                <StepTheme onBack={() => goTo(4)} onFinish={() => setCompleting(true)} />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <AnimatePresence>
        {completing && <CompletionOverlay onDone={finishNow} />}
      </AnimatePresence>
    </div>
  );
}
