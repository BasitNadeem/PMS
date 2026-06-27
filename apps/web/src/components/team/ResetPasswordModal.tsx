import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X, KeyRound, Eye, EyeOff, Check } from "lucide-react";
import { cn } from "@/lib/cn";
import { usersService, type StaffUser } from "@/services/users";
import { useEscapeKey } from "@/hooks/useEscapeKey";

export interface ResetPasswordModalProps {
  staffUser: StaffUser;
  onClose:   () => void;
  onSuccess: (msg: string) => void;
}

export function ResetPasswordModal({ staffUser, onClose, onSuccess }: ResetPasswordModalProps) {
  useEscapeKey(onClose);
  const qc = useQueryClient();

  const [newPassword,  setNewPassword]  = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error,        setError]        = useState<string | null>(null);

  const resetMutation = useMutation({
    mutationFn: () => usersService.resetPassword(staffUser.id, newPassword),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["team"] });
      onSuccess(`Password reset for ${staffUser.user.name}`);
      onClose();
    },
    onError: (err: { response?: { data?: { error?: string } } }) => {
      setError(err.response?.data?.error ?? "Failed to reset password");
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (newPassword.length < 8) { setError("Password must be at least 8 characters"); return; }
    resetMutation.mutate();
  }

  const inputCls = "h-11 w-full rounded-xl bg-mist border border-line px-3.5 text-sm text-ink placeholder:text-ink-faint outline-none focus:border-coral focus:ring-2 focus:ring-coral/15 transition-all";

  return (
    <div
      className="fixed inset-0 z-[60] bg-ink/35 backdrop-blur-[3px] flex items-center justify-center p-4 anim-fade-in"
      onMouseDown={onClose}
    >
      <div
        className="relative w-full max-w-sm bg-card rounded-[1.75rem] shadow-float anim-scale-in"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start gap-4 px-6 pt-6 pb-5 border-b border-line-soft">
          <div className="grid place-items-center h-11 w-11 rounded-full bg-coral-tint text-coral-deep shrink-0">
            <KeyRound size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="serif text-[20px] leading-tight text-ink">Reset password</h3>
            <p className="mt-0.5 text-[13px] text-ink-mute truncate">{staffUser.user.name} · {staffUser.user.email}</p>
          </div>
          <button
            onClick={onClose}
            className="grid place-items-center h-9 w-9 rounded-full hover:bg-line-soft text-ink-mute transition-colors -mt-0.5 -mr-1"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-3">
          {error && (
            <div className="rounded-xl bg-coral-tint border border-coral/25 text-coral-deep text-[13px] px-4 py-3">
              {error}
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-[13px] font-semibold text-ink-soft">
              New password <span className="text-coral">*</span>
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => { setNewPassword(e.target.value); setError(null); }}
                placeholder="Min. 8 characters"
                autoComplete="new-password"
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
            <p className="mt-1 text-[12px] text-ink-mute">
              Share this with {staffUser.user.name.split(" ")[0]} directly — they'll be asked to change it after signing in.
            </p>
          </div>
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
            disabled={resetMutation.isPending}
            className={cn(
              "inline-flex items-center gap-2 h-10 px-5 rounded-full text-sm font-semibold text-white transition-colors",
              resetMutation.isPending
                ? "bg-coral/60 cursor-not-allowed"
                : "bg-coral hover:bg-coral-dark",
            )}
          >
            {resetMutation.isPending ? "Resetting…" : (
              <><Check size={15} /> Reset password</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
