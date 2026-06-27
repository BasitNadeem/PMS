import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  X, Check, Pencil, KeyRound,
  Crown, Shield, ConciergeBell, Sparkles, Utensils, Wrench, Calculator, HelpCircle, ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { usersService, type StaffUser, type Role } from "@/services/users";
import { Avatar } from "@/components/ui/Avatar";
import { ResetPasswordModal } from "@/components/team/ResetPasswordModal";
import { useEscapeKey } from "@/hooks/useEscapeKey";

// ── Role grid config ──────────────────────────────────────────────────────────

interface RoleCard { name: string; label: string; icon: React.ElementType; color: string; }
const ROLE_CARDS: RoleCard[] = [
  { name: "OWNER",        label: "Owner",        icon: Crown,         color: "#7C3AED" },
  { name: "MANAGER",      label: "Manager",      icon: Shield,        color: "#2563EB" },
  { name: "FRONT_DESK",   label: "Front Desk",   icon: ConciergeBell, color: "#0891B2" },
  { name: "HOUSEKEEPING", label: "Housekeeping", icon: Sparkles,      color: "#16A34A" },
  { name: "KITCHEN",      label: "Kitchen",      icon: Utensils,      color: "#D97706" },
  { name: "MAINTENANCE",  label: "Maintenance",  icon: Wrench,        color: "#DC2626" },
  { name: "ACCOUNTANT",   label: "Accountant",   icon: Calculator,    color: "#0F766E" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function getCurrentUserId(): string | null {
  const token = localStorage.getItem("accessToken");
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split(".")[1] ?? ""));
    return (payload as { userId?: string }).userId ?? null;
  } catch { return null; }
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface EditStaffModalProps {
  staffUser: StaffUser;
  onClose:   () => void;
  onSuccess: (msg: string) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function EditStaffModal({ staffUser, onClose, onSuccess }: EditStaffModalProps) {
  useEscapeKey(onClose);
  const qc    = useQueryClient();
  const isSelf = getCurrentUserId() === staffUser.user.id;

  const [name,         setName]         = useState(staffUser.user.name);
  const [roleId,       setRoleId]       = useState(staffUser.roleId);
  const [selectedName, setSelectedName] = useState(staffUser.assignedRole.name);
  const [showOther,    setShowOther]    = useState(
    !ROLE_CARDS.some((r) => r.name === staffUser.assignedRole.name)
  );
  const [otherTitle,   setOtherTitle]   = useState("");
  const [isActive,     setIsActive]     = useState(staffUser.isActive);
  const [error,        setError]        = useState<string | null>(null);
  const [showResetPassword, setShowResetPassword] = useState(false);

  const { data: roles = [] } = useQuery<Role[]>({
    queryKey: ["roles"],
    queryFn:  usersService.getRoles,
    staleTime: 5 * 60_000,
  });

  const updateMutation = useMutation({
    mutationFn: (dto: { name?: string; roleId?: string; isActive?: boolean }) =>
      usersService.updateUser(staffUser.id, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["team"] });
      onSuccess("Staff member updated");
      onClose();
    },
    onError: (err: { response?: { data?: { error?: string } } }) => {
      setError(err.response?.data?.error ?? "Failed to update staff member");
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
    if (isSelf) return;
    setError(null);
    const dto: { name?: string; roleId?: string; isActive?: boolean } = {};
    if (name.trim() !== staffUser.user.name)  dto.name = name.trim();
    if (roleId !== staffUser.roleId)          dto.roleId = roleId;
    if (isActive !== staffUser.isActive)      dto.isActive = isActive;
    if (Object.keys(dto).length === 0) { onClose(); return; }
    updateMutation.mutate(dto);
  }

  const inputCls = "h-11 w-full rounded-xl bg-mist border border-line px-3.5 text-sm text-ink placeholder:text-ink-faint outline-none focus:border-coral focus:ring-2 focus:ring-coral/15 transition-all";

  return (
    <>
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
          <Avatar name={staffUser.user.name} size={44} />
          <div className="flex-1 min-w-0">
            <h3 className="serif text-[22px] leading-tight text-ink truncate">{staffUser.user.name}</h3>
            <p className="mt-0.5 text-[13px] text-ink-mute">{staffUser.user.email}</p>
          </div>
          <button
            onClick={onClose}
            className="grid place-items-center h-9 w-9 rounded-full hover:bg-line-soft text-ink-mute transition-colors -mt-0.5 -mr-1"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto scroll-area px-6 py-5 space-y-4">
          {isSelf && (
            <div className="rounded-xl bg-slate-soft border border-slate/25 text-slate-deep text-[13px] px-4 py-3">
              You cannot edit your own account from here.
            </div>
          )}
          {error && (
            <div className="rounded-xl bg-coral-tint border border-coral/25 text-coral-deep text-[13px] px-4 py-3">
              {error}
            </div>
          )}

          {/* Full name */}
          <div>
            <label className="mb-1.5 block text-[13px] font-semibold text-ink-soft">Full name</label>
            <input
              type="text" value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isSelf}
              className={cn(inputCls, isSelf && "opacity-50 cursor-not-allowed")}
            />
          </div>

          {/* Role grid */}
          {!isSelf && (
            <div>
              <label className="mb-2 block text-[13px] font-semibold text-ink-soft">Role</label>
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
          )}

          {/* Active toggle */}
          {!isSelf && (
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
          )}

          {!isActive && staffUser.isActive && !isSelf && (
            <div className="rounded-xl bg-amber-soft border border-amber/25 text-amber-deep text-[13px] px-4 py-3">
              This staff member will no longer be able to log in.
            </div>
          )}

          {/* Reset password */}
          {!isSelf && (
            <button
              type="button"
              onClick={() => setShowResetPassword(true)}
              className="flex items-center justify-between w-full rounded-xl bg-mist border border-line px-4 py-3.5 hover:border-ink-faint transition-colors"
            >
              <span className="flex items-center gap-2.5 text-[13.5px] font-semibold text-ink">
                <KeyRound size={16} className="text-ink-mute" />
                Reset password
              </span>
              <span className="text-[12px] text-ink-mute">Set a new password</span>
            </button>
          )}
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
          {!isSelf && (
            <button
              onClick={handleSubmit}
              disabled={updateMutation.isPending}
              className={cn(
                "inline-flex items-center gap-2 h-10 px-5 rounded-full text-sm font-semibold text-white transition-colors",
                updateMutation.isPending
                  ? "bg-coral/60 cursor-not-allowed"
                  : "bg-coral hover:bg-coral-dark",
              )}
            >
              {updateMutation.isPending ? "Saving…" : (
                <><Check size={15} /> Save changes</>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
    {showResetPassword && (
      <ResetPasswordModal
        staffUser={staffUser}
        onClose={() => setShowResetPassword(false)}
        onSuccess={onSuccess}
      />
    )}
    </>
  );
}
