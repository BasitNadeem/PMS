import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Building2, Clock, Receipt, AlertTriangle, ChevronLeft, Check,
  MessageSquare, Info, ShieldCheck, KeyRound, Eye, EyeOff, History, QrCode, Copy, Download, CreditCard, Lock, Loader2, ImagePlus,
} from "lucide-react";
import QRCode from "qrcode";
import { cn } from "@/lib/cn";
import { settingsService, type UpdateSettingsDto, type RolePermissions, type ThemeKey } from "@/services/settings";
import { getPhoneErrorMessage, getEmailErrorMessage } from "@/lib/validation";
import { exportAllDataToExcel } from "@/lib/exportExcel";
import { getCurrentUserRole } from "@/lib/jwt";
import { authService } from "@/services/auth";
import { useToast } from "@/hooks/useToast";
import { ToastContainer } from "@/components/ui/ToastContainer";
import { usePermissions } from "@/hooks/usePermissions";
import { ThemePicker } from "@/components/settings/ThemePicker";
import { applyTheme, isThemeKey } from "@/lib/theme";
import { uploadService } from "@/services/upload";

// ── Helpers ───────────────────────────────────────────────────────────────────

const inputCls = "w-full rounded-xl border border-line bg-mist px-3.5 py-2.5 text-[14px] text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-coral/20 focus:border-coral/40 transition-colors";
const labelCls = "block text-[13px] font-semibold text-ink-soft mb-1.5";
const sectionCardCls = "rounded-xl2 border border-line bg-card p-6 mb-5";

function Toggle({
  checked, onChange, label, subtext,
}: { checked: boolean; onChange: (v: boolean) => void; label: string; subtext?: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <div>
        <div className="text-[13.5px] font-semibold text-ink">{label}</div>
        {subtext && <div className="text-[12px] text-ink-mute mt-0.5">{subtext}</div>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={cn(
          "shrink-0 w-11 h-6 rounded-full transition-colors duration-200 flex items-center mt-0.5",
          checked ? "bg-pine" : "bg-line-soft",
        )}
      >
        <span className={cn(
          "w-5 h-5 bg-white rounded-full shadow transition-transform duration-200",
          checked ? "translate-x-5" : "translate-x-0.5",
        )} />
      </button>
    </div>
  );
}

function SaveButton({ saving, saved, onClick }: { saving: boolean; saved: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={saving}
      className={cn(
        "inline-flex items-center gap-2 h-10 px-5 rounded-full text-[13.5px] font-semibold transition-all shadow-pop disabled:opacity-50",
        saved
          ? "bg-pine text-white"
          : "bg-ink text-white hover:bg-ink/90",
      )}
    >
      {saved ? <><Check size={15} />Saved</> : saving ? "Saving…" : "Save changes"}
    </button>
  );
}

// ── Section types ─────────────────────────────────────────────────────────────

type Section = "plan" | "profile" | "operations" | "permissions" | "tax" | "notifications" | "security" | "danger";
const ALL_SECTIONS: { key: Section; label: string; icon: React.ElementType; ownerOnly?: boolean }[] = [
  { key: "plan",          label: "Current Plan",         icon: CreditCard },
  { key: "profile",       label: "Hotel Profile",        icon: Building2 },
  { key: "operations",    label: "Operations",           icon: Clock },
  { key: "permissions",   label: "Permissions",          icon: ShieldCheck, ownerOnly: true },
  { key: "tax",           label: "Tax & Billing",        icon: Receipt },
  { key: "notifications", label: "Notifications",        icon: MessageSquare, ownerOnly: true },
  { key: "security",      label: "Security",             icon: KeyRound },
  { key: "danger",        label: "Danger Zone",          icon: AlertTriangle },
];

// ── Security section helpers ────────────────────────────────────────────────

type PasswordStrength = "weak" | "fair" | "strong";

function getPasswordStrength(password: string): PasswordStrength | null {
  if (!password) return null;
  if (password.length < 8) return "weak";
  const hasNumber = /\d/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);
  return hasNumber && hasSpecial ? "strong" : "fair";
}

const STRENGTH_STYLES: Record<PasswordStrength, { bar: string; text: string; width: string }> = {
  weak:   { bar: "bg-clay",  text: "text-clay",  width: "w-1/3" },
  fair:   { bar: "bg-amber", text: "text-amber", width: "w-2/3" },
  strong: { bar: "bg-pine",  text: "text-pine",  width: "w-full" },
};

function PasswordField({
  label, value, onChange, show, onToggleShow, placeholder, error,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggleShow: () => void;
  placeholder?: string;
  error?: string | null;
}) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          className={cn(inputCls, "pr-10", error && "border-clay/50")}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete="new-password"
        />
        <button
          type="button"
          onClick={onToggleShow}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink-mute"
        >
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      {error && <p className="mt-1 text-[12px] text-clay">{error}</p>}
    </div>
  );
}

// ── Permissions section helpers ─────────────────────────────────────────────

const ACTION_ORDER = [
  "read", "create", "update", "delete", "manage",
  "submit", "signoff", "acknowledge", "run", "markNoShow",
  "checkin", "checkout", "cancel", "refund", "settings",
];

// Modules to exclude entirely from the permissions UI.
const HIDDEN_MODULES = new Set(["audit"]);

// Which actions are meaningful per module — anything else is hidden rather
// than shown disabled. Keys match the `module` field on Permission records
// (see packages/db/src/seed.ts permission catalogue).
const MODULE_ACTIONS: Record<string, string[]> = {
  hotel:        ["read", "update", "settings"],
  room:         ["read", "create", "update", "delete"],
  room_type:    ["read", "create", "update", "delete"],
  rate:         ["read", "create", "update", "delete"],
  guest:        ["read", "create", "update", "delete"],
  reservation:  ["read", "create", "update", "cancel", "checkin", "checkout"],
  housekeeping: ["read", "create", "update"],
  maintenance:  ["read", "create", "update"],
  pos:          ["read", "create", "update"],
  inventory:    ["read", "update"],
  invoice:      ["read", "create", "update"],
  payment:      ["read", "create", "refund"],
  folio:        ["read", "update"],
  channel:      ["read", "update"],
  staff:        ["read", "create", "update", "delete"],
  user:         ["read", "create", "update", "delete"],
  report:       ["read"],
  app_access:   ["read", "create", "update"],
};

function formatLabel(s: string): string {
  return s
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function PermissionToggle({ label, enabled, justSaved, onToggle }: { label: string; enabled: boolean; justSaved: boolean; onToggle: () => void }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative">
        <button
          type="button"
          onClick={onToggle}
          className={cn(
            "relative w-9 h-5 rounded-full transition-colors duration-200",
            enabled ? "bg-pine" : "bg-line-soft",
          )}
        >
          <span className={cn(
            "absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200",
            enabled ? "translate-x-4" : "translate-x-0",
          )} />
        </button>
        {justSaved && <Check size={12} className="absolute -right-3.5 top-0.5 text-pine" />}
      </div>
      <span className="text-xs text-gray-500 capitalize">{label}</span>
    </div>
  );
}

const PROPERTY_TYPES = [
  "HOTEL", "GUESTHOUSE", "RESORT", "LODGE",
  "HOSTEL", "SERVICED_APARTMENT", "CAMPSITE",
];
const PROPERTY_LABELS: Record<string, string> = {
  HOTEL: "Hotel", GUESTHOUSE: "Guesthouse", RESORT: "Resort", LODGE: "Lodge",
  HOSTEL: "Hostel", SERVICED_APARTMENT: "Serviced Apartment", CAMPSITE: "Campsite",
};
const TIMEZONES = [
  "Asia/Karachi", "Asia/Dubai", "Asia/Kolkata", "UTC",
  "Europe/London", "America/New_York",
];
const SOURCES = [
  { value: "WALK_IN",     label: "Walk-in" },
  { value: "PHONE",       label: "Phone" },
  { value: "WHATSAPP",    label: "WhatsApp" },
  { value: "BOOKING_COM", label: "Booking.com" },
  { value: "AGODA",       label: "Agoda" },
  { value: "EXPEDIA",     label: "Expedia" },
];

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const qc = useQueryClient();
  const { toasts, addToast, removeToast } = useToast();
  const [activeSection, setActiveSection] = useState<Section>("profile");

  const userRole = getCurrentUserRole();
  const isOwner  = userRole === "OWNER";
  const SECTIONS = ALL_SECTIONS.filter((s) => !s.ownerOnly || isOwner);
  const { has } = usePermissions();
  const canUpdateSettings = has("settings:update");
  const canReadSettings = has("settings:read");

  useEffect(() => {
    if (location.hash === "#security") setActiveSection("security");
  }, [location.hash]);

  const { data: settings, isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: settingsService.getSettings,
    staleTime: 30_000,
  });

  const { data: plan } = useQuery({
    queryKey: ["settings", "plan"],
    queryFn: async () => {
      const { api } = await import("@/lib/api");
      const res = await api.get<{ data: {
        planName: string; planSlug: string | null; priceMonthly: number;
        isTrialAccount: boolean; trialEndsAt: string | null;
        maxRooms: number; maxUsers: number; currentRooms: number; currentUsers: number;
        features: Record<string, boolean>;
      } }>("/api/settings/plan");
      return res.data.data;
    },
    staleTime: 60_000,
  });

  // ── Profile form ────────────────────────────────────────────────────────────
  const [profile, setProfile] = useState({
    name: "", propertyType: "HOTEL", starRating: "" as string,
    description: "", amenities: [] as string[], phone: "", email: "", website: "",
    address: "", city: "", country: "PK", timezone: "Asia/Karachi",
  });
  const [newAmenity, setNewAmenity] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved,  setProfileSaved]  = useState(false);

  // ── Operations form ─────────────────────────────────────────────────────────
  const [ops, setOps] = useState({
    checkInTime: "14:00", checkOutTime: "12:00",
    shiftMorningStart: "06:00", shiftEveningStart: "14:00", shiftNightStart: "22:00",
    requireIndependentShiftSignoff: false,
    lateCheckoutFee: "", earlyCheckinFee: "",
    defaultSource: "WALK_IN",
    autoConfirm: false, maxAdvanceDays: "365",
  });
  const [opsSaving, setOpsSaving] = useState(false);
  const [opsSaved,  setOpsSaved]  = useState(false);

  // ── Tax form ────────────────────────────────────────────────────────────────
  const [tax, setTax] = useState({
    gstEnabled: false, gstRate: "0",
    pstEnabled: false, pstRate: "0",
    taxInclusive: false, fbrEnabled: false,
    invoicePrefix: "INV",
    posTaxRate: "0",
  });
  const [taxSaving, setTaxSaving] = useState(false);
  const [taxSaved,  setTaxSaved]  = useState(false);

  // ── Notifications form ──────────────────────────────────────────────────────
  const [whatsappNumber,  setWhatsappNumber]  = useState("");
  const [notifSaving,     setNotifSaving]     = useState(false);
  const [notifSaved,      setNotifSaved]      = useState(false);
  const [testSending,     setTestSending]     = useState(false);
  const [whatsappError,   setWhatsappError]   = useState<string | null>(null);
  const [profilePhoneError, setProfilePhoneError] = useState<string | null>(null);
  const [profileEmailError, setProfileEmailError] = useState<string | null>(null);

  // ── Logo upload ─────────────────────────────────────────────────────────────
  const [logoUploading, setLogoUploading] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoUploading(true);
    try {
      const url = await uploadService.uploadPhoto(file);
      await updateMutation.mutateAsync({ logoUrl: url } as UpdateSettingsDto);
      addToast("Logo updated");
    } catch { addToast("Failed to upload logo", "error"); }
    finally { setLogoUploading(false); e.target.value = ""; }
  }

  async function removeLogo() {
    try {
      await updateMutation.mutateAsync({ logoUrl: null } as UpdateSettingsDto);
      addToast("Logo removed");
    } catch { addToast("Failed to remove logo", "error"); }
  }

  // ── Security / change password ──────────────────────────────────────────────
  const isFirstLogin = localStorage.getItem("isFirstLogin") === "true";
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword,     setNewPassword]     = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew,     setShowNew]     = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // ── Danger zone ─────────────────────────────────────────────────────────────
  const [exportingData,       setExportingData]       = useState(false);
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  const [deactivateInput,     setDeactivateInput]     = useState("");
  const [deactivating,        setDeactivating]        = useState(false);

  async function handleExportData() {
    setExportingData(true);
    try {
      const data = await settingsService.exportData();
      exportAllDataToExcel(data);
      addToast("Export downloaded successfully");
    } catch {
      addToast("Failed to export data — please try again", "error");
    } finally {
      setExportingData(false);
    }
  }

  async function handleDeactivate() {
    setDeactivating(true);
    try {
      await settingsService.deactivateHotel();
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      navigate("/login");
    } catch {
      setDeactivating(false);
      setShowDeactivateModal(false);
      addToast("Failed to deactivate hotel — please try again", "error");
    }
  }

  const passwordStrength = getPasswordStrength(newPassword);
  const passwordsMismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;
  const canSubmitPassword =
    !!currentPassword && !!newPassword && !!confirmPassword && !passwordsMismatch && !passwordSaving;

  async function changePassword() {
    setPasswordError(null);
    setPasswordSaving(true);
    try {
      await authService.changePassword(currentPassword, newPassword);
      setPasswordSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      localStorage.setItem("isFirstLogin", "false");
      setTimeout(() => setPasswordSuccess(false), 3000);
    } catch (e) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setPasswordError(msg ?? "Failed to update password");
    } finally {
      setPasswordSaving(false);
    }
  }

  // ── Permissions ──────────────────────────────────────────────────────────────
  const { data: permissionsData, isLoading: permissionsLoading } = useQuery({
    queryKey: ["permissions"],
    queryFn: settingsService.getPermissions,
    enabled: isOwner,
    staleTime: 30_000,
  });
  const [permissionsState, setPermissionsState] = useState<RolePermissions[]>([]);
  const [selectedRoleId,   setSelectedRoleId]   = useState<string | null>(null);
  const [justSavedKey,     setJustSavedKey]     = useState<string | null>(null);

  useEffect(() => {
    if (!permissionsData) return;
    setPermissionsState(permissionsData);
    if (!selectedRoleId && permissionsData.length > 0) {
      setSelectedRoleId(permissionsData[0].roleId);
    }
  }, [permissionsData, selectedRoleId]);

  const togglePermissionMutation = useMutation({
    mutationFn: ({ roleId, key, enabled }: { roleId: string; key: string; enabled: boolean }) =>
      settingsService.updateRolePermission(roleId, [{ key, enabled }]),
  });

  function togglePermission(roleId: string, key: string, currentEnabled: boolean) {
    const nextEnabled = !currentEnabled;
    setPermissionsState((prev) => prev.map((role) => (
      role.roleId !== roleId ? role : {
        ...role,
        permissions: role.permissions.map((p) => p.key === key ? { ...p, enabled: nextEnabled } : p),
      }
    )));
    setJustSavedKey(key);
    setTimeout(() => setJustSavedKey((k) => (k === key ? null : k)), 1200);

    togglePermissionMutation.mutate({ roleId, key, enabled: nextEnabled }, {
      onError: () => {
        setPermissionsState((prev) => prev.map((role) => (
          role.roleId !== roleId ? role : {
            ...role,
            permissions: role.permissions.map((p) => p.key === key ? { ...p, enabled: currentEnabled } : p),
          }
        )));
        addToast("Failed to update permission", "error");
      },
    });
  }

  // Populate forms when data loads
  useEffect(() => {
    if (!settings) return;
    const s = (settings.settings ?? {}) as Record<string, unknown>;
    setProfile({
      name:         settings.name ?? "",
      propertyType: settings.propertyType ?? "HOTEL",
      starRating:   String(s.starRating ?? ""),
      description:  settings.description ?? "",
      amenities:    (settings as unknown as { amenities?: string[] }).amenities ?? [],
      phone:        settings.phone ?? "",
      email:        settings.email ?? "",
      website:      settings.website ?? "",
      address:      settings.address ?? "",
      city:         settings.city ?? "",
      country:      settings.country ?? "PK",
      timezone:     String(s.timezone ?? "Asia/Karachi"),
    });
    setOps({
      checkInTime:     String(s.checkInTime   ?? "14:00"),
      checkOutTime:    String(s.checkOutTime  ?? "12:00"),
      shiftMorningStart: String(s.shiftMorningStart ?? "06:00"),
      shiftEveningStart: String(s.shiftEveningStart ?? "14:00"),
      shiftNightStart: String(s.shiftNightStart ?? "22:00"),
      requireIndependentShiftSignoff: Boolean(s.requireIndependentShiftSignoff),
      lateCheckoutFee: String(s.lateCheckoutFee ?? ""),
      earlyCheckinFee: String(s.earlyCheckinFee ?? ""),
      defaultSource:   String(s.defaultSource   ?? "WALK_IN"),
      autoConfirm:     Boolean(s.autoConfirm),
      maxAdvanceDays:  String(s.maxAdvanceDays  ?? "365"),
    });
    setTax({
      gstEnabled:   Boolean(s.gstEnabled),
      gstRate:      String(s.gstRate    ?? "0"),
      pstEnabled:   Boolean(s.pstEnabled),
      pstRate:      String(s.pstRate    ?? "0"),
      taxInclusive: Boolean(s.taxInclusive),
      fbrEnabled:   false,
      invoicePrefix: String(s.invoicePrefix ?? "INV"),
      posTaxRate:   String(s.posTaxRate  ?? "0"),
    });
    setWhatsappNumber(String(s.ownerWhatsappNumber ?? ""));
  }, [settings]);

  const updateMutation = useMutation({
    mutationFn: settingsService.updateSettings,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings"] });
      // AppLayout/DashboardPage/ReceiptView all cache the hotel independently
      // under this key — without this, a theme (or any settings) change stays
      // stale there until the 5-minute staleTime lapses or a hard refresh.
      qc.invalidateQueries({ queryKey: ["hotel"] });
    },
  });

  async function saveProfile() {
    const pErr = profile.phone.trim() ? getPhoneErrorMessage(profile.phone) : null;
    const eErr = profile.email.trim() ? getEmailErrorMessage(profile.email) : null;
    setProfilePhoneError(pErr);
    setProfileEmailError(eErr);
    if (pErr || eErr) return;
    setProfileSaving(true);
    try {
      const dto: UpdateSettingsDto = {
        name: profile.name, propertyType: profile.propertyType,
        description: profile.description, amenities: profile.amenities,
        phone: profile.phone, email: profile.email, website: profile.website,
        address: profile.address, city: profile.city, country: profile.country,
        timezone: profile.timezone,
        starRating: profile.starRating ? parseInt(profile.starRating, 10) : null,
      };
      await updateMutation.mutateAsync(dto);
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 2000);
    } catch { addToast("Failed to save profile", "error"); }
    finally  { setProfileSaving(false); }
  }

  const currentThemeKey: ThemeKey = isThemeKey(settings?.settings?.themeKey)
    ? (settings!.settings!.themeKey as ThemeKey)
    : "WARM_CLAY";

  async function changeTheme(key: ThemeKey) {
    applyTheme(key); // instant feedback, even before the save round-trips
    try {
      await updateMutation.mutateAsync({ themeKey: key });
    } catch {
      applyTheme(currentThemeKey); // revert visual on failure
      addToast("Failed to save theme", "error");
    }
  }

  async function saveOps() {
    const toMinutes = (value: string) => {
      const [hour, minute] = value.split(":").map(Number);
      return hour * 60 + minute;
    };
    if (!(
      toMinutes(ops.shiftMorningStart) < toMinutes(ops.shiftEveningStart)
      && toMinutes(ops.shiftEveningStart) < toMinutes(ops.shiftNightStart)
    )) {
      addToast("Shift starts must be ordered Morning, Evening, then Night", "error");
      return;
    }
    setOpsSaving(true);
    try {
      const dto: UpdateSettingsDto = {
        checkInTime: ops.checkInTime, checkOutTime: ops.checkOutTime,
        shiftMorningStart: ops.shiftMorningStart,
        shiftEveningStart: ops.shiftEveningStart,
        shiftNightStart: ops.shiftNightStart,
        requireIndependentShiftSignoff: ops.requireIndependentShiftSignoff,
        defaultSource: ops.defaultSource, autoConfirm: ops.autoConfirm,
        maxAdvanceDays: parseInt(ops.maxAdvanceDays, 10) || 365,
        lateCheckoutFee: ops.lateCheckoutFee ? parseInt(ops.lateCheckoutFee, 10) : 0,
        earlyCheckinFee: ops.earlyCheckinFee ? parseInt(ops.earlyCheckinFee, 10) : 0,
      };
      await updateMutation.mutateAsync(dto);
      setOpsSaved(true);
      setTimeout(() => setOpsSaved(false), 2000);
    } catch { addToast("Failed to save operations", "error"); }
    finally  { setOpsSaving(false); }
  }

  async function saveTax() {
    setTaxSaving(true);
    try {
      const dto: UpdateSettingsDto = {
        gstEnabled: tax.gstEnabled, gstRate: parseFloat(tax.gstRate) || 0,
        pstEnabled: tax.pstEnabled, pstRate: parseFloat(tax.pstRate) || 0,
        taxInclusive: tax.taxInclusive, invoicePrefix: tax.invoicePrefix,
        posTaxRate: parseFloat(tax.posTaxRate) || 0,
      };
      await updateMutation.mutateAsync(dto);
      setTaxSaved(true);
      setTimeout(() => setTaxSaved(false), 2000);
    } catch { addToast("Failed to save tax settings", "error"); }
    finally  { setTaxSaving(false); }
  }

  async function saveNotifications() {
    setWhatsappError(null);
    if (whatsappNumber) {
      const err = getPhoneErrorMessage(whatsappNumber);
      if (err) { setWhatsappError(err); return; }
    }
    setNotifSaving(true);
    try {
      await updateMutation.mutateAsync({ ownerWhatsappNumber: whatsappNumber || null } as UpdateSettingsDto);
      if (whatsappNumber) await settingsService.scheduleBriefing();
      setNotifSaved(true);
      setTimeout(() => setNotifSaved(false), 2000);
    } catch { addToast("Failed to save notification settings", "error"); }
    finally  { setNotifSaving(false); }
  }

  async function sendTestBriefing() {
    setTestSending(true);
    try {
      const result = await settingsService.testBriefing();
      if (result.stubMode) {
        addToast("Stub mode — briefing logged to console. Add Meta credentials to send real messages.", "error");
      } else {
        addToast(`Test briefing sent! Check your WhatsApp (${result.sentTo})`);
      }
    } catch (e) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      addToast(msg ?? "Failed to send test briefing", "error");
    } finally {
      setTestSending(false);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-line-soft rounded-xl w-48 animate-pulse" />
        <div className="h-64 bg-line-soft rounded-xl2 animate-pulse" />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="grid place-items-center h-9 w-9 rounded-full border border-line hover:bg-mist text-ink-mute transition-colors"
        >
          <ChevronLeft size={18} />
        </button>
        <div>
          <div className="mb-0.5 text-[12px] font-bold uppercase tracking-[0.14em] text-coral">Property</div>
          <h1 className="serif text-[28px] leading-none text-ink">Settings</h1>
        </div>
      </div>

      <div className="flex gap-6 items-start">
        {/* Secondary nav */}
        <nav className="w-52 shrink-0 flex flex-col gap-1 sticky top-8">
          {SECTIONS.map(({ key, label, icon: Icon }) => (  // filtered to user's role above
            <button
              key={key}
              onClick={() => setActiveSection(key)}
              className={cn(
                "flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13.5px] font-semibold text-left transition-colors",
                activeSection === key
                  ? "bg-coral-soft text-coral"
                  : "text-ink-soft hover:bg-mist hover:text-ink",
              )}
            >
              <Icon size={17} />
              {label}
            </button>
          ))}
          {canReadSettings && (
            <button
              onClick={() => navigate("/settings/audit")}
              className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13.5px] font-semibold text-left text-ink-soft hover:bg-mist hover:text-ink transition-colors"
            >
              <History size={17} />
              Audit Log
            </button>
          )}
        </nav>

        {/* Content */}
        <div className="flex-1 min-w-0">

          {/* ── Current Plan ──────────────────────────────────────────────── */}
          {activeSection === "plan" && (
            <div className={sectionCardCls}>
              <h2 className="serif text-[22px] text-ink mb-5">Current Plan</h2>
              {plan ? (
                <div className="space-y-5">
                  <div className="rounded-xl border border-line-soft bg-mist p-4 flex items-start justify-between gap-4">
                    <div>
                      <div className="text-[15px] font-bold text-ink">{plan.planName}</div>
                      {plan.isTrialAccount && (
                        <div className="text-[13px] text-coral font-semibold mt-0.5">
                          Trial Account
                          {plan.trialEndsAt && (
                            <span className="text-ink-mute font-normal ml-1">
                              — expires {new Date(plan.trialEndsAt).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      )}
                      {plan.priceMonthly > 0 && (
                        <div className="text-[13px] text-ink-mute mt-0.5">
                          PKR {Math.round(plan.priceMonthly / 100).toLocaleString()} / month
                        </div>
                      )}
                    </div>
                    <span className="rounded-full bg-pine/10 text-pine text-[12px] font-bold px-3 py-1">
                      {plan.isTrialAccount ? "Trial" : "Active"}
                    </span>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-[13px] font-semibold text-ink-soft mb-1">
                        <span>Rooms</span>
                        <span>{plan.currentRooms} / {plan.maxRooms === 999 ? "Unlimited" : plan.maxRooms}</span>
                      </div>
                      <div className="h-2 rounded-full bg-line-soft overflow-hidden">
                        <div
                          className="h-full rounded-full bg-coral transition-all duration-700"
                          style={{ width: plan.maxRooms === 999 ? "4%" : `${Math.min(100, Math.round((plan.currentRooms / plan.maxRooms) * 100))}%` }}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-[13px] font-semibold text-ink-soft mb-1">
                        <span>Users</span>
                        <span>{plan.currentUsers} / {plan.maxUsers === 999 ? "Unlimited" : plan.maxUsers}</span>
                      </div>
                      <div className="h-2 rounded-full bg-line-soft overflow-hidden">
                        <div
                          className="h-full rounded-full bg-coral transition-all duration-700"
                          style={{ width: plan.maxUsers === 999 ? "4%" : `${Math.min(100, Math.round((plan.currentUsers / plan.maxUsers) * 100))}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {(() => {
                    const lockedFeatures = Object.entries(plan.features)
                      .filter(([, enabled]) => !enabled)
                      .map(([key]) => key);
                    if (lockedFeatures.length === 0) return null;
                    return (
                      <div>
                        <div className="text-[12px] font-bold uppercase tracking-[0.12em] text-ink-mute mb-2">Locked Features</div>
                        <div className="flex flex-wrap gap-2">
                          {lockedFeatures.map((key) => (
                            <span key={key} className="flex items-center gap-1 rounded-full bg-line-soft px-3 py-1 text-[12px] font-semibold text-ink-mute">
                              <Lock size={11} />
                              {key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase())}
                            </span>
                          ))}
                        </div>
                        <p className="mt-2 text-[12px] text-ink-mute">Contact support to enable additional features on your plan.</p>
                      </div>
                    );
                  })()}
                </div>
              ) : (
                <div className="h-24 flex items-center justify-center text-ink-mute text-[14px]">Loading plan...</div>
              )}
            </div>
          )}

          {/* ── Hotel Profile ─────────────────────────────────────────────── */}
          {activeSection === "profile" && (
            <div className={sectionCardCls}>
              <h2 className="serif text-[22px] text-ink mb-5">Hotel Profile</h2>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Hotel name <span className="text-coral text-[15px] font-bold leading-none">*</span></label>
                    <input
                      className={inputCls} value={profile.name}
                      onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))}
                      placeholder="Serai Hunza Mountain Resort"
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Slug (read-only)</label>
                    <input
                      className={cn(inputCls, "opacity-50 cursor-not-allowed")}
                      value={settings?.slug ?? ""}
                      readOnly
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Property type</label>
                    <select
                      className={cn(inputCls, "cursor-pointer")}
                      value={profile.propertyType}
                      onChange={(e) => setProfile((p) => ({ ...p, propertyType: e.target.value }))}
                    >
                      {PROPERTY_TYPES.map((t) => (
                        <option key={t} value={t}>{PROPERTY_LABELS[t] ?? t}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Star rating</label>
                    <select
                      className={cn(inputCls, "cursor-pointer")}
                      value={profile.starRating}
                      onChange={(e) => setProfile((p) => ({ ...p, starRating: e.target.value }))}
                    >
                      <option value="">Unrated</option>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <option key={n} value={n}>{"★".repeat(n)} {n} Star</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Description</label>
                  <textarea
                    className={cn(inputCls, "resize-none h-24")}
                    value={profile.description}
                    onChange={(e) => setProfile((p) => ({ ...p, description: e.target.value }))}
                    placeholder="A short description of the property…"
                  />
                </div>
                <div>
                  <label className={labelCls}>Hotel Amenities</label>
                  {profile.amenities.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {profile.amenities.map((a, i) => (
                        <span key={i} className="flex items-center gap-1 rounded-full bg-mist border border-line px-2.5 py-1 text-[12.5px] text-ink-soft">
                          {a}
                          <button
                            type="button"
                            onClick={() => setProfile((p) => ({ ...p, amenities: p.amenities.filter((_, idx) => idx !== i) }))}
                            className="text-ink-faint hover:text-clay transition-colors"
                          >
                            <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor"><path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newAmenity}
                      onChange={(e) => setNewAmenity(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          const val = newAmenity.trim();
                          if (val && !profile.amenities.includes(val)) {
                            setProfile((p) => ({ ...p, amenities: [...p.amenities, val] }));
                          }
                          setNewAmenity("");
                        }
                      }}
                      placeholder="e.g. Swimming Pool"
                      className={cn(inputCls, "flex-1")}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const val = newAmenity.trim();
                        if (val && !profile.amenities.includes(val)) {
                          setProfile((p) => ({ ...p, amenities: [...p.amenities, val] }));
                        }
                        setNewAmenity("");
                      }}
                      className="h-11 px-4 rounded-xl border border-line text-ink-soft text-[13px] font-medium hover:bg-mist transition-colors shrink-0"
                    >
                      Add
                    </button>
                  </div>
                  <p className="text-[11.5px] text-ink-faint mt-1">Press Enter or click Add. These appear on your public booking page.</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Phone number</label>
                    <input
                      className={cn(inputCls, profilePhoneError && "border-clay focus:border-clay")}
                      value={profile.phone}
                      onChange={(e) => { setProfile((p) => ({ ...p, phone: e.target.value })); setProfilePhoneError(null); }}
                      onBlur={() => setProfilePhoneError(profile.phone.trim() ? getPhoneErrorMessage(profile.phone) : null)}
                      placeholder="03XX XXXXXXX"
                    />
                    {profilePhoneError && <p className="mt-1 text-[12px] text-clay">{profilePhoneError}</p>}
                  </div>
                  <div>
                    <label className={labelCls}>Email address</label>
                    <input
                      type="email"
                      className={cn(inputCls, profileEmailError && "border-clay focus:border-clay")}
                      value={profile.email}
                      onChange={(e) => { setProfile((p) => ({ ...p, email: e.target.value })); setProfileEmailError(null); }}
                      onBlur={() => setProfileEmailError(profile.email.trim() ? getEmailErrorMessage(profile.email) : null)}
                      placeholder="info@seraihunza.com"
                    />
                    {profileEmailError && <p className="mt-1 text-[12px] text-clay">{profileEmailError}</p>}
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Website URL</label>
                  <input
                    className={inputCls} value={profile.website}
                    onChange={(e) => setProfile((p) => ({ ...p, website: e.target.value }))}
                    placeholder="https://seraihunza.com"
                  />
                </div>
                <div>
                  <label className={labelCls}>Address</label>
                  <input
                    className={inputCls} value={profile.address}
                    onChange={(e) => setProfile((p) => ({ ...p, address: e.target.value }))}
                    placeholder="Karimabad, Hunza"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>City <span className="text-coral text-[15px] font-bold leading-none normal-case tracking-normal">*</span></label>
                    <input
                      className={inputCls} value={profile.city}
                      onChange={(e) => setProfile((p) => ({ ...p, city: e.target.value }))}
                      placeholder="Hunza"
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Country</label>
                    <input
                      className={inputCls} value={profile.country}
                      onChange={(e) => setProfile((p) => ({ ...p, country: e.target.value }))}
                      placeholder="PK"
                    />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Timezone</label>
                  <select
                    className={cn(inputCls, "cursor-pointer")}
                    value={profile.timezone}
                    onChange={(e) => setProfile((p) => ({ ...p, timezone: e.target.value }))}
                  >
                    {TIMEZONES.map((tz) => (
                      <option key={tz} value={tz}>{tz}</option>
                    ))}
                  </select>
                </div>
              </div>
              {canUpdateSettings && (
                <div className="mt-6 flex justify-end">
                  <SaveButton saving={profileSaving} saved={profileSaved} onClick={saveProfile} />
                </div>
              )}
            </div>
          )}

          {/* ── Appearance ────────────────────────────────────────────────── */}
          {activeSection === "profile" && (
            <div className={sectionCardCls}>
              <h2 className="serif text-[22px] text-ink mb-1">Appearance</h2>
              <p className="text-[13px] text-ink-mute mb-4">
                Pick a color palette for the whole app. Applies instantly across every page.
              </p>
              {canUpdateSettings ? (
                <ThemePicker value={currentThemeKey} onChange={changeTheme} />
              ) : (
                <ThemePicker value={currentThemeKey} onChange={() => {}} className="opacity-60 pointer-events-none" />
              )}

              {/* Hotel Logo */}
              <div className="mt-6 pt-6 border-t border-line-soft">
                <div className="text-[13.5px] font-semibold text-ink mb-0.5">Hotel Logo</div>
                <p className="text-[12.5px] text-ink-mute mb-4">
                  Displayed on your public booking page. Square image recommended (e.g. 512×512 px).
                </p>
                <div className="flex items-center gap-4">
                  {(() => {
                    const logoUrl = (settings?.settings?.logoUrl as string | undefined) ?? null;
                    return logoUrl ? (
                      <img
                        src={logoUrl}
                        alt="Hotel logo"
                        className="h-16 w-16 rounded-2xl object-cover border border-line bg-mist shrink-0"
                      />
                    ) : (
                      <div className="h-16 w-16 rounded-2xl border-2 border-dashed border-line bg-mist flex items-center justify-center shrink-0">
                        <ImagePlus size={22} className="text-ink-faint" />
                      </div>
                    );
                  })()}
                  {canUpdateSettings && (
                    <div className="flex flex-col gap-2">
                      <input
                        ref={logoInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleLogoUpload}
                      />
                      <button
                        type="button"
                        disabled={logoUploading}
                        onClick={() => logoInputRef.current?.click()}
                        className="flex items-center gap-2 h-9 px-4 rounded-full border border-line text-ink-soft text-[13px] font-semibold hover:bg-mist transition-colors disabled:opacity-40"
                      >
                        {logoUploading ? <Loader2 size={14} className="animate-spin" /> : <ImagePlus size={14} />}
                        {logoUploading ? "Uploading…" : "Upload Logo"}
                      </button>
                      {(settings?.settings?.logoUrl as string | undefined) && (
                        <button
                          type="button"
                          onClick={removeLogo}
                          className="text-[12px] text-clay hover:underline text-left"
                        >
                          Remove logo
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── QR Menu Code ──────────────────────────────────────────────── */}
          {activeSection === "profile" && isOwner && settings?.slug && (
            <QrMenuCard slug={settings.slug} />
          )}

          {/* ── Operations ────────────────────────────────────────────────── */}
          {activeSection === "operations" && (
            <div className={sectionCardCls}>
              <h2 className="serif text-[22px] text-ink mb-5">Operations</h2>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Check-in time <span className="text-coral text-[15px] font-bold leading-none normal-case tracking-normal">*</span></label>
                    <input
                      type="time" className={inputCls} value={ops.checkInTime}
                      onChange={(e) => setOps((o) => ({ ...o, checkInTime: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Check-out time <span className="text-coral text-[15px] font-bold leading-none normal-case tracking-normal">*</span></label>
                    <input
                      type="time" className={inputCls} value={ops.checkOutTime}
                      onChange={(e) => setOps((o) => ({ ...o, checkOutTime: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Late check-out fee (PKR)</label>
                    <input
                      type="number" min="0" className={inputCls} value={ops.lateCheckoutFee}
                      onChange={(e) => setOps((o) => ({ ...o, lateCheckoutFee: e.target.value }))}
                      placeholder="0"
                    />
                    <p className="mt-1 text-[12px] text-ink-faint">Automatically added to the open folio when check-out happens after the configured time. Set to 0 to disable.</p>
                  </div>
                  <div>
                    <label className={labelCls}>Early check-in fee (PKR)</label>
                    <input
                      type="number" min="0" className={inputCls} value={ops.earlyCheckinFee}
                      onChange={(e) => setOps((o) => ({ ...o, earlyCheckinFee: e.target.value }))}
                      placeholder="0"
                    />
                    <p className="mt-1 text-[12px] text-ink-faint">Automatically added to the folio when check-in happens before the configured time. Set to 0 to disable.</p>
                  </div>
                </div>
                <div className="rounded-xl border border-line-soft bg-mist p-4">
                  <div className="mb-1 text-[13.5px] font-semibold text-ink">Shift schedule</div>
                  <p className="mb-4 text-[12px] leading-relaxed text-ink-faint">
                    InnFlo uses these tenant-specific boundaries for handover counts, cash reconciliation, and the earliest time Night Audit can close the day.
                  </p>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {([
                      ["Morning starts", "shiftMorningStart"],
                      ["Evening starts", "shiftEveningStart"],
                      ["Night starts", "shiftNightStart"],
                    ] as const).map(([label, key]) => (
                      <div key={key}>
                        <label className={labelCls}>{label}</label>
                        <input
                          type="time"
                          className={inputCls}
                          value={ops[key]}
                          onChange={(event) => setOps((current) => ({ ...current, [key]: event.target.value }))}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 border-t border-line-soft pt-3">
                    <Toggle
                      checked={ops.requireIndependentShiftSignoff}
                      onChange={(value) => setOps((current) => ({ ...current, requireIndependentShiftSignoff: value }))}
                      label="Require a different person to sign off"
                      subtext="When enabled, the staff member who submits a handover cannot approve their own cash count"
                    />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Default reservation source</label>
                  <select
                    className={cn(inputCls, "cursor-pointer")}
                    value={ops.defaultSource}
                    onChange={(e) => setOps((o) => ({ ...o, defaultSource: e.target.value }))}
                  >
                    {SOURCES.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Max advance booking days</label>
                  <input
                    type="number" min="1" className={inputCls} value={ops.maxAdvanceDays}
                    onChange={(e) => setOps((o) => ({ ...o, maxAdvanceDays: e.target.value }))}
                    placeholder="365"
                  />
                </div>
                <div className="rounded-xl border border-line-soft bg-mist p-4 space-y-1 divide-y divide-line-soft">
                  <Toggle
                    checked={ops.autoConfirm}
                    onChange={(v) => setOps((o) => ({ ...o, autoConfirm: v }))}
                    label="Auto-confirm reservations"
                    subtext="When off, all new reservations start as Pending"
                  />
                </div>
              </div>
              {canUpdateSettings && (
                <div className="mt-6 flex justify-end">
                  <SaveButton saving={opsSaving} saved={opsSaved} onClick={saveOps} />
                </div>
              )}
            </div>
          )}

          {/* ── Permissions ───────────────────────────────────────────────── */}
          {activeSection === "permissions" && isOwner && (
            <div className={sectionCardCls}>
              <h2 className="serif text-[22px] text-ink mb-1">Role Permissions</h2>
              <p className="text-[13px] text-ink-mute mb-5">
                Customize what each role can access. Changes take effect immediately.
              </p>

              {permissionsLoading ? (
                <div className="flex gap-6">
                  <div className="w-[200px] shrink-0 space-y-2">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="h-9 bg-line-soft rounded-lg animate-pulse" />
                    ))}
                  </div>
                  <div className="flex-1 space-y-3">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="h-16 bg-line-soft rounded-lg animate-pulse" />
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex gap-6">
                  {/* Role selector */}
                  <div className="w-[200px] shrink-0 space-y-1">
                    {permissionsState.map((role) => (
                      <button
                        key={role.roleId}
                        onClick={() => setSelectedRoleId(role.roleId)}
                        className={cn(
                          "w-full text-left px-4 py-2.5 rounded-lg text-sm transition-colors",
                          selectedRoleId === role.roleId
                            ? "bg-coral/10 text-coral font-medium border-l-2 border-coral"
                            : "font-semibold text-ink-mute hover:bg-mist hover:text-ink-soft",
                        )}
                      >
                        {role.roleName}
                      </button>
                    ))}
                  </div>

                  {/* Permission toggles */}
                  <div className="flex-1 min-w-0">
                    {(() => {
                      const role = permissionsState.find((r) => r.roleId === selectedRoleId);
                      if (!role) return null;

                      const moduleGroups = new Map<string, typeof role.permissions>();
                      for (const perm of role.permissions) {
                        if (HIDDEN_MODULES.has(perm.module)) continue;
                        const group = moduleGroups.get(perm.module) ?? [];
                        group.push(perm);
                        moduleGroups.set(perm.module, group);
                      }

                      return (
                        <>
                          <h3 className="text-[16px] font-semibold text-ink mb-2">{role.roleName}</h3>
                          {Array.from(moduleGroups.entries()).map(([module, perms]) => {
                            const applicable = MODULE_ACTIONS[module];
                            const visible = applicable
                              ? perms.filter((p) => applicable.includes(p.action))
                              : perms;
                            if (visible.length === 0) return null;
                            const sorted = [...visible].sort(
                              (a, b) => ACTION_ORDER.indexOf(a.action) - ACTION_ORDER.indexOf(b.action),
                            );
                            return (
                              <div key={module} className="mb-6">
                                <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 pb-2 border-b border-gray-100 mb-3">
                                  {formatLabel(module)}
                                </div>
                                <div className="flex flex-wrap gap-6">
                                  {sorted.map((perm) => (
                                    <PermissionToggle
                                      key={perm.key}
                                      label={formatLabel(perm.action)}
                                      enabled={perm.enabled}
                                      justSaved={justSavedKey === perm.key}
                                      onToggle={() => togglePermission(role.roleId, perm.key, perm.enabled)}
                                    />
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </>
                      );
                    })()}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Tax & Billing ─────────────────────────────────────────────── */}
          {activeSection === "tax" && (
            <div className={sectionCardCls}>
              <h2 className="serif text-[22px] text-ink mb-5">Tax &amp; Billing</h2>
              <div className="space-y-4">
                <div>
                  <label className={labelCls}>Currency display</label>
                  <input
                    className={cn(inputCls, "opacity-50 cursor-not-allowed")}
                    value="PKR — Pakistani Rupee"
                    readOnly
                  />
                </div>
                <div className="rounded-xl border border-line-soft bg-mist p-4 space-y-3 divide-y divide-line-soft">
                  <Toggle
                    checked={tax.gstEnabled}
                    onChange={(v) => setTax((t) => ({ ...t, gstEnabled: v }))}
                    label="GST"
                    subtext="Applied to room reservations, Booking Engine totals, and room folios"
                  />
                  {tax.gstEnabled && (
                    <div className="pt-3">
                      <label className={labelCls}>GST rate (%)</label>
                      <input
                        type="number" min="0" max="100" step="0.5" className={inputCls}
                        value={tax.gstRate}
                        onChange={(e) => setTax((t) => ({ ...t, gstRate: e.target.value }))}
                        placeholder="0"
                      />
                    </div>
                  )}
                  <Toggle
                    checked={tax.pstEnabled}
                    onChange={(v) => setTax((t) => ({ ...t, pstEnabled: v }))}
                    label="PST / PRA"
                    subtext="Applied to room reservations, Booking Engine totals, and room folios"
                  />
                  {tax.pstEnabled && (
                    <div className="pt-3">
                      <label className={labelCls}>PST rate (%)</label>
                      <input
                        type="number" min="0" max="100" step="0.5" className={inputCls}
                        value={tax.pstRate}
                        onChange={(e) => setTax((t) => ({ ...t, pstRate: e.target.value }))}
                        placeholder="0"
                      />
                    </div>
                  )}
                  <Toggle
                    checked={tax.taxInclusive}
                    onChange={(v) => setTax((t) => ({ ...t, taxInclusive: v }))}
                    label="Prices include tax"
                    subtext="Room rates are treated as tax-inclusive; when off, enabled accommodation taxes are added on top"
                  />
                  <div className="pt-2 flex items-center justify-between">
                    <div>
                      <div className="text-[13.5px] font-semibold text-ink-mute">FBR Integration</div>
                      <div className="text-[12px] text-ink-faint">Federal Board of Revenue</div>
                    </div>
                    <span className="text-[11px] font-semibold bg-amber-soft text-amber rounded-full px-2.5 py-1">
                      Coming Soon
                    </span>
                  </div>
                </div>
                <div className="rounded-xl border border-line-soft bg-mist p-4">
                  <div className="text-[13.5px] font-semibold text-ink mb-0.5">POS &amp; F&amp;B Tax Rate</div>
                  <div className="text-[12px] text-ink-faint mb-3">Applied to the total of every POS and QR order. Set to 0 to disable.</div>
                  <div className="relative">
                    <input
                      type="number" min="0" max="100" step="0.5" className={inputCls}
                      value={tax.posTaxRate}
                      onChange={(e) => setTax((t) => ({ ...t, posTaxRate: e.target.value }))}
                      placeholder="0"
                    />
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[13px] text-ink-faint font-semibold">%</span>
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Invoice prefix</label>
                  <input
                    className={inputCls} value={tax.invoicePrefix}
                    onChange={(e) => setTax((t) => ({ ...t, invoicePrefix: e.target.value }))}
                    placeholder="INV"
                  />
                  <p className="mt-1 text-[12px] text-ink-faint">
                    Reserved for generated invoice numbering e.g. {tax.invoicePrefix || "INV"}-0001
                  </p>
                </div>
              </div>
              {canUpdateSettings && (
                <div className="mt-6 flex justify-end">
                  <SaveButton saving={taxSaving} saved={taxSaved} onClick={saveTax} />
                </div>
              )}
            </div>
          )}

          {/* ── Notifications & Alerts ───────────────────────────────────── */}
          {activeSection === "notifications" && isOwner && (
            <div className={sectionCardCls}>
              <h2 className="serif text-[22px] text-ink mb-1">WhatsApp Nightly Briefing</h2>
              <p className="text-[13px] text-ink-mute mb-5">
                Receive a daily operations summary at 11:00 PM every night via WhatsApp.
              </p>

              <div className="space-y-4">
                {/* Status indicator */}
                <div className="flex items-center gap-2.5 py-2">
                  {whatsappNumber ? (
                    <>
                      <span className="h-2 w-2 rounded-full bg-pine shrink-0" />
                      <span className="text-[13px] text-pine-deep font-medium">
                        Briefings scheduled — next send at 11:00 PM PKT
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="h-2 w-2 rounded-full bg-line shrink-0" />
                      <span className="text-[13px] text-ink-mute">
                        Enter your number to enable nightly briefings
                      </span>
                    </>
                  )}
                </div>

                {/* Number input */}
                <div>
                  <label className={labelCls}>Owner WhatsApp Number</label>
                  <input
                    type="tel"
                    className={cn(inputCls, whatsappError && "border-clay/50")}
                    value={whatsappNumber}
                    onChange={(e) => { setWhatsappNumber(e.target.value); setWhatsappError(null); }}
                    placeholder="+923001234567"
                  />
                  <p className="mt-1 text-[12px] text-ink-faint">
                    Include country code e.g. +923001234567
                  </p>
                  {whatsappError && (
                    <p className="mt-1 text-[12px] text-clay">{whatsappError}</p>
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-3 pt-1">
                  {canUpdateSettings && (
                    <SaveButton saving={notifSaving} saved={notifSaved} onClick={saveNotifications} />
                  )}
                  {whatsappNumber && (
                    <button
                      onClick={sendTestBriefing}
                      disabled={testSending}
                      className="h-10 px-5 rounded-full border border-line text-ink-soft text-[13.5px] font-semibold hover:bg-mist transition-colors disabled:opacity-50"
                    >
                      {testSending ? "Sending…" : "Send Test Briefing Now"}
                    </button>
                  )}
                </div>

                {/* Stub mode info card */}
                <div className="rounded-xl bg-amber-soft border border-amber/20 p-4 flex items-start gap-3 mt-2">
                  <Info size={16} className="text-amber shrink-0 mt-0.5" />
                  <p className="text-[13px] text-ink-soft leading-relaxed">
                    WhatsApp sending is currently in <strong>stub mode</strong>. The briefing will be
                    logged to the server console instead of sent via WhatsApp. To enable real sending,
                    add your Meta Cloud API credentials to the server environment variables.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ── Security ──────────────────────────────────────────────────── */}
          {activeSection === "security" && (
            <div className={sectionCardCls}>
              <h2 className="serif text-[22px] text-ink mb-1">Change Password</h2>
              <p className="text-[13px] text-ink-mute mb-5">Update your login password</p>

              {isFirstLogin && (
                <div className="mb-5 flex items-start gap-3 rounded-xl border border-amber/20 bg-amber-soft p-4">
                  <AlertTriangle size={16} className="text-amber shrink-0 mt-0.5" />
                  <p className="text-[13px] text-ink-soft leading-relaxed">
                    You are using a temporary password. Please set a permanent password now.
                  </p>
                </div>
              )}

              <div className="space-y-4 max-w-md">
                <PasswordField
                  label="Current Password"
                  value={currentPassword}
                  onChange={setCurrentPassword}
                  show={showCurrent}
                  onToggleShow={() => setShowCurrent((v) => !v)}
                  placeholder="Enter your current password"
                />
                <div>
                  <PasswordField
                    label="New Password"
                    value={newPassword}
                    onChange={setNewPassword}
                    show={showNew}
                    onToggleShow={() => setShowNew((v) => !v)}
                    placeholder="At least 8 characters"
                  />
                  {passwordStrength && (
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="flex-1 h-1 rounded-full bg-line-soft overflow-hidden">
                        <div className={cn("h-full rounded-full transition-all", STRENGTH_STYLES[passwordStrength].bar, STRENGTH_STYLES[passwordStrength].width)} />
                      </div>
                      <span className={cn("text-[11px] font-semibold capitalize", STRENGTH_STYLES[passwordStrength].text)}>
                        {passwordStrength}
                      </span>
                    </div>
                  )}
                </div>
                <PasswordField
                  label="Confirm New Password"
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                  show={showConfirm}
                  onToggleShow={() => setShowConfirm((v) => !v)}
                  placeholder="Re-enter new password"
                  error={passwordsMismatch ? "Passwords don't match" : null}
                />
              </div>

              {passwordError && <p className="mt-4 text-[13px] text-clay">{passwordError}</p>}
              {passwordSuccess && (
                <p className="mt-4 text-[13px] font-semibold text-pine">✓ Password updated successfully</p>
              )}

              <div className="mt-6 flex justify-end">
                <button
                  onClick={changePassword}
                  disabled={!canSubmitPassword}
                  className="inline-flex items-center gap-2 h-10 px-5 rounded-full text-[13.5px] font-semibold transition-all shadow-pop bg-ink text-white hover:bg-ink/90 disabled:opacity-50"
                >
                  {passwordSaving ? "Updating…" : "Update Password"}
                </button>
              </div>
            </div>
          )}

          {/* ── Danger Zone ───────────────────────────────────────────────── */}
          {activeSection === "danger" && (
            <div className={cn(sectionCardCls, "border-clay/40")}>
              <h2 className="serif text-[22px] text-clay mb-1">Danger Zone</h2>
              <p className="text-[13px] text-ink-mute mb-5">Irreversible or high-impact actions for this hotel account.</p>
              <div className="space-y-4">

                {/* Export */}
                <div className="rounded-xl border border-line-soft bg-mist p-4 flex items-start justify-between gap-4">
                  <div>
                    <div className="text-[14px] font-semibold text-ink">Export All Data</div>
                    <div className="text-[12.5px] text-ink-mute mt-0.5">
                      Download a full Excel workbook — guests, reservations, rooms, expenses and cash book.
                    </div>
                  </div>
                  <button
                    onClick={handleExportData}
                    disabled={exportingData}
                    className="shrink-0 inline-flex items-center gap-1.5 h-9 px-4 rounded-full border border-line text-ink-soft text-[13px] font-semibold hover:bg-card hover:text-ink transition-colors disabled:opacity-50"
                  >
                    {exportingData
                      ? <><Loader2 size={13} className="animate-spin" />Exporting…</>
                      : <><Download size={13} />Export</>}
                  </button>
                </div>

                {/* Deactivate — owner only */}
                {isOwner && (
                  <div className="rounded-xl border border-clay/30 bg-clay-soft/40 p-4 flex items-start justify-between gap-4">
                    <div>
                      <div className="text-[14px] font-semibold text-clay">Deactivate Hotel</div>
                      <div className="text-[12.5px] text-ink-mute mt-0.5">
                        Immediately blocks all staff logins. Data is preserved and can be reactivated by support.
                      </div>
                    </div>
                    <button
                      onClick={() => setShowDeactivateModal(true)}
                      className="shrink-0 h-9 px-4 rounded-full bg-clay text-white text-[13px] font-semibold hover:bg-clay/90 transition-colors"
                    >
                      Deactivate
                    </button>
                  </div>
                )}

              </div>
            </div>
          )}

          {/* ── Deactivate confirmation modal ─────────────────────────────── */}
          {showDeactivateModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 backdrop-blur-sm p-4 anim-fade-in">
              <div className="bg-paper rounded-2xl shadow-xl w-full max-w-md p-6 anim-scale-in">
                <div className="flex items-center gap-3 mb-4">
                  <div className="grid place-items-center h-10 w-10 rounded-xl bg-clay-soft shrink-0">
                    <AlertTriangle size={18} className="text-clay" />
                  </div>
                  <h3 className="serif text-[20px] text-ink">Deactivate Hotel?</h3>
                </div>

                <div className="space-y-3 mb-5">
                  <p className="text-[13px] text-ink-soft leading-relaxed">
                    This will deactivate <strong className="text-ink">{settings?.name}</strong>.
                    All staff will be immediately locked out. Your data is not deleted.
                  </p>
                  <div className="rounded-xl border border-clay/20 bg-clay-soft/60 px-4 py-3 text-[12.5px] text-clay font-medium leading-relaxed">
                    This cannot be self-reversed. You will be logged out immediately.
                  </div>
                  <div>
                    <label className={labelCls}>
                      Type <span className="font-bold text-ink normal-case tracking-normal">{settings?.name}</span> to confirm
                    </label>
                    <input
                      type="text"
                      className={inputCls}
                      value={deactivateInput}
                      onChange={(e) => setDeactivateInput(e.target.value)}
                      placeholder={settings?.name ?? "Hotel name"}
                      // eslint-disable-next-line jsx-a11y/no-autofocus
                      autoFocus
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => { setShowDeactivateModal(false); setDeactivateInput(""); }}
                    disabled={deactivating}
                    className="h-10 px-5 rounded-full border border-line text-ink-soft text-[13.5px] font-semibold hover:bg-mist transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleDeactivate}
                    disabled={deactivateInput !== settings?.name || deactivating}
                    className="inline-flex items-center gap-2 h-10 px-5 rounded-full bg-clay text-white text-[13.5px] font-semibold hover:bg-clay/90 transition-colors disabled:opacity-50"
                  >
                    {deactivating
                      ? <><Loader2 size={14} className="animate-spin" />Deactivating…</>
                      : "Deactivate Hotel"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}

// ── QR Menu Card ─────────────────────────────────────────────────────────────

function QrMenuCard({ slug }: { slug: string }) {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const menuUrl    = `${window.location.origin}/menu/${slug}`;
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, menuUrl, {
        width:  200,
        margin: 2,
        color: { dark: "#1A1F2E", light: "#FFFFFF" },
      }).catch(console.error);
    }
  }, [menuUrl]);

  function copyUrl() {
    void navigator.clipboard.writeText(menuUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function downloadQr() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `${slug}-qr-menu.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  return (
    <div className="rounded-xl2 border border-line bg-card p-6 mb-5">
      <div className="flex items-center gap-2 mb-4">
        <QrCode className="w-5 h-5 text-coral" />
        <h2 className="text-[18px] font-bold text-ink">QR Menu Code</h2>
      </div>
      <p className="text-sm text-dusk mb-5">
        Print or display this QR code in guest rooms. Scanning it opens your in-room dining menu directly — no app required.
      </p>
      <div className="flex flex-col sm:flex-row items-center gap-6">
        <canvas ref={canvasRef} className="rounded-xl border border-line" />
        <div className="space-y-3 flex-1 min-w-0">
          <div>
            <p className="text-xs font-semibold text-dusk mb-1">Menu URL</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs bg-mist rounded-lg px-3 py-2 text-ink break-all">
                {menuUrl}
              </code>
              <button
                onClick={copyUrl}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-line text-sm text-dusk hover:text-ink hover:bg-mist flex-shrink-0"
              >
                {copied ? <Check className="w-4 h-4 text-pine-600" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <button
            onClick={downloadQr}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-ink text-white text-sm font-semibold hover:bg-ink/90"
          >
            <Download className="w-4 h-4" /> Download QR Code
          </button>
          <p className="text-xs text-dusk">
            Download a high-resolution PNG to print on welcome cards, tent cards, or room info sheets.
          </p>
        </div>
      </div>
    </div>
  );
}
