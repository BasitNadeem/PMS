import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  X, Eye, EyeOff, UserPlus, Crown, Shield, ConciergeBell,
  Sparkles, Utensils, Wrench, Calculator, HelpCircle, Check, ChevronDown, Pencil,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { usersService, type Role } from "@/services/users";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { getPhoneErrorMessage, getEmailErrorMessage } from "@/lib/validation";

// ── Role grid config ──────────────────────────────────────────────────────────

interface RoleCard {
  name: string;
  label: string;
  icon: React.ElementType;
  color: string;
}

const ROLE_CARDS: RoleCard[] = [
  { name: "OWNER",        label: "Owner",        icon: Crown,         color: "#7C3AED" },
  { name: "MANAGER",      label: "Manager",      icon: Shield,        color: "#2563EB" },
  { name: "FRONT_DESK",   label: "Front Desk",   icon: ConciergeBell, color: "#0891B2" },
  { name: "HOUSEKEEPING", label: "Housekeeping", icon: Sparkles,      color: "#16A34A" },
  { name: "KITCHEN",      label: "Kitchen",      icon: Utensils,      color: "#D97706" },
  { name: "MAINTENANCE",  label: "Maintenance",  icon: Wrench,        color: "#DC2626" },
  { name: "ACCOUNTANT",   label: "Accountant",   icon: Calculator,    color: "#0F766E" },
];

// ── Props ─────────────────────────────────────────────────────────────────────

export interface AddStaffModalProps {
  onClose:   () => void;
  onSuccess: (msg: string) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AddStaffModal({ onClose, onSuccess }: AddStaffModalProps) {
  useEscapeKey(onClose);
  const qc = useQueryClient();

  const [name,         setName]         = useState("");
  const [email,        setEmail]        = useState("");
  const [phone,        setPhone]        = useState("");
  const [password,     setPassword]     = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [roleId,       setRoleId]       = useState("");
  const [selectedName, setSelectedName] = useState("");  // role "name" for highlighting
  const [showOther,    setShowOther]    = useState(false);
  const [otherTitle,   setOtherTitle]   = useState("");  // free-text custom role name
  const [isActive,     setIsActive]     = useState(true);
  const [error,        setError]        = useState<string | null>(null);

  const { data: roles = [] } = useQuery<Role[]>({
    queryKey: ["roles"],
    queryFn:  usersService.getRoles,
    staleTime: 5 * 60_000,
  });

  const createMutation = useMutation({
    mutationFn: usersService.createUser,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["team"] });
      onSuccess("Staff member added");
      onClose();
    },
    onError: (err: { response?: { data?: { error?: string } } }) => {
      setError(err.response?.data?.error ?? "Failed to add staff member");
    },
  });

  function selectRole(roleName: string, id: string) {
    setRoleId(id);
    setSelectedName(roleName);
    setShowOther(false);
    setOtherTitle("");
    setError(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim())        { setError("Name is required"); return; }
    if (!email.trim())       { setError("Email is required"); return; }
    const emailErr = getEmailErrorMessage(email);
    if (emailErr)            { setError(emailErr); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters"); return; }
    if (!roleId)             { setError("Please select a role"); return; }
    if (phone.trim()) {
      const phoneErr = getPhoneErrorMessage(phone);
      if (phoneErr) { setError(phoneErr); return; }
    }
    setError(null);
    createMutation.mutate({
      name: name.trim(),
      email: email.trim(),
      password,
      phone: phone.trim() || undefined,
      roleId,
    });
  }

  const inputCls = "h-11 w-full rounded-xl bg-mist border border-line px-3.5 text-sm text-ink placeholder:text-ink-faint outline-none focus:border-coral focus:ring-2 focus:ring-coral/15 transition-all";

  return (
    <div
      className="fixed inset-0 z-50 bg-ink/35 backdrop-blur-[3px] flex items-center justify-center p-4 anim-fade-in"
      onMouseDown={onClose}
    >
      <div
        className="relative w-full max-w-lg max-h-[92vh] flex flex-col bg-card rounded-[1.75rem] shadow-float anim-scale-in"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start gap-4 px-6 pt-6 pb-5 border-b border-line-soft">
          <div className="grid place-items-center h-11 w-11 rounded-xl bg-coral-soft text-coral shrink-0">
            <UserPlus size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="serif text-[22px] leading-tight text-ink">Add staff member</h3>
            <p className="mt-0.5 text-[13px] text-ink-mute">Account details, role and access</p>
          </div>
          <button
            onClick={onClose}
            className="grid place-items-center h-9 w-9 rounded-full hover:bg-line-soft text-ink-mute transition-colors -mt-0.5 -mr-1"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto scroll-area px-6 py-5 space-y-4">
          {error && (
            <div className="rounded-xl bg-coral-tint border border-coral/25 text-coral-deep text-sm px-4 py-3">
              {error}
            </div>
          )}

          {/* Full name */}
          <div>
            <label className="mb-1.5 block text-[13px] font-semibold text-ink-soft">
              Full name <span className="text-coral text-[15px] font-bold leading-none">*</span>
            </label>
            <input
              type="text" value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Faisal Shah"
              className={inputCls}
            />
          </div>

          {/* Email + Phone */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-[13px] font-semibold text-ink-soft">
                Email <span className="text-coral text-[15px] font-bold leading-none">*</span>
              </label>
              <input
                type="email" value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@seraihunza.pk"
                className={inputCls}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[13px] font-semibold text-ink-soft">Phone</label>
              <input
                type="tel" value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="03XX XXXXXXX"
                className={inputCls}
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="mb-1.5 block text-[13px] font-semibold text-ink-soft">
              Password <span className="text-coral text-[15px] font-bold leading-none">*</span>
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 8 characters"
                className={cn(inputCls, "pr-11")}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink-soft transition-colors"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <p className="mt-1 text-[12px] text-ink-mute">Staff member can change this after first login.</p>
          </div>

          {/* Role grid */}
          <div>
            <label className="mb-2 block text-[13px] font-semibold text-ink-soft">
              Role <span className="text-coral text-[15px] font-bold leading-none">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {ROLE_CARDS.map(({ name: roleName, label, icon: Icon, color }) => {
                const match = roles.find((r) => r.name === roleName);
                if (!match) return null;
                const isSelected = selectedName === roleName && !showOther;
                return (
                  <button
                    key={roleName}
                    type="button"
                    onClick={() => selectRole(roleName, match.id)}
                    className={cn(
                      "flex items-center gap-2.5 rounded-xl border px-3.5 py-3 text-[13.5px] font-semibold transition-all text-left",
                      isSelected
                        ? "border-coral bg-coral-tint text-coral-deep shadow-sm"
                        : "border-line bg-mist text-ink-soft hover:border-ink-faint hover:bg-line-soft",
                    )}
                  >
                    <Icon size={16} style={{ color: isSelected ? undefined : color }} className={isSelected ? "text-coral" : ""} />
                    <span className="flex-1">{label}</span>
                    {isSelected && <Check size={14} className="text-coral shrink-0" />}
                  </button>
                );
              })}

              {/* Other */}
              <button
                type="button"
                onClick={() => { setShowOther(true); setSelectedName(""); setRoleId(""); }}
                className={cn(
                  "flex items-center gap-2.5 rounded-xl border px-3.5 py-3 text-[13.5px] font-semibold transition-all text-left",
                  showOther
                    ? "border-coral bg-coral-tint text-coral-deep shadow-sm"
                    : "border-line bg-mist text-ink-soft hover:border-ink-faint hover:bg-line-soft",
                )}
              >
                <HelpCircle size={16} className={showOther ? "text-coral" : "text-ink-faint"} />
                <span className="flex-1">Other</span>
                {showOther && <Check size={14} className="text-coral shrink-0" />}
              </button>
            </div>

            {/* Other — custom title + access level */}
            {showOther && (
              <div className="mt-2 space-y-2">
                <div className="relative">
                  <Pencil size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint pointer-events-none" />
                  <input
                    type="text"
                    value={otherTitle}
                    onChange={(e) => setOtherTitle(e.target.value)}
                    placeholder="e.g. IT Support, Security, Driver…"
                    className={cn(inputCls, "pl-10")}
                  />
                </div>
                <div className="relative">
                  <select
                    value={roleId}
                    onChange={(e) => { setRoleId(e.target.value); setError(null); }}
                    className={cn(inputCls, "appearance-none pr-9 text-ink-soft")}
                  >
                    <option value="">Access level (permissions)…</option>
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>{r.displayName}</option>
                    ))}
                  </select>
                  <ChevronDown size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-faint pointer-events-none" />
                </div>
                <p className="text-[12px] text-ink-mute pl-0.5">
                  The role title is for reference. Access level controls what this account can do.
                </p>
              </div>
            )}
          </div>

          {/* Account active */}
          <button
            type="button"
            onClick={() => setIsActive((v) => !v)}
            className="flex items-center justify-between w-full rounded-xl bg-mist border border-line px-4 py-3.5"
          >
            <span className="text-[13.5px] font-semibold text-ink">Account active</span>
            <span className={cn(
              "relative h-6 w-11 rounded-full transition-colors shrink-0",
              isActive ? "bg-pine" : "bg-line",
            )}>
              <span className={cn(
                "absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-all",
                isActive ? "left-[26px]" : "left-1",
              )} />
            </span>
          </button>
        </div>

        {/* Footer */}
        <div className="border-t border-line-soft px-6 py-4 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="h-10 px-5 rounded-full border border-line text-sm font-semibold text-ink-soft hover:bg-line-soft transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={createMutation.isPending}
            className={cn(
              "inline-flex items-center gap-2 h-10 px-5 rounded-full text-sm font-semibold text-white transition-colors",
              createMutation.isPending
                ? "bg-coral/60 cursor-not-allowed"
                : "bg-coral hover:bg-coral-dark",
            )}
          >
            {createMutation.isPending ? (
              "Adding…"
            ) : (
              <>
                <Check size={15} />
                Add staff
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
