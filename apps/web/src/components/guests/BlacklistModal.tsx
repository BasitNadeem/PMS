import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X, ShieldAlert, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/cn";
import { guestsService, type BlacklistSeverity } from "@/services/guests";
import { TONE } from "@/components/ui/StatusBadge";
import { useEscapeKey } from "@/hooks/useEscapeKey";

const SEVERITIES: { value: BlacklistSeverity; label: string; tone: keyof typeof TONE }[] = [
  { value: "LOW",    label: "Low",    tone: "slate" },
  { value: "MEDIUM", label: "Medium", tone: "amber" },
  { value: "HIGH",   label: "High",   tone: "clay" },
];

export interface BlacklistModalProps {
  guestId: string;
  guestName: string;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export function BlacklistModal({ guestId, guestName, onClose, onSuccess }: BlacklistModalProps) {
  useEscapeKey(onClose);
  const qc = useQueryClient();
  const [reason, setReason] = useState("");
  const [severity, setSeverity] = useState<BlacklistSeverity>("MEDIUM");
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: () => guestsService.blacklistGuest(guestId, { reason: reason.trim(), severity }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["guests"] });
      qc.invalidateQueries({ queryKey: ["guest", guestId] });
      onSuccess("Guest flagged as blacklisted");
      onClose();
    },
  });

  function handleSubmit() {
    if (!reason.trim()) {
      setError("A reason is required");
      return;
    }
    setError("");
    mutation.mutate();
  }

  return (
    <div
      className="fixed inset-0 bg-ink/35 backdrop-blur-[3px] z-50 grid place-items-center p-4 anim-fade-in"
      onMouseDown={onClose}
    >
      <div
        className="relative w-full max-w-md flex flex-col bg-card rounded-[1.5rem] shadow-float anim-scale-in"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3.5 px-6 pt-6 pb-4 border-b border-line-soft">
          <div
            className="grid place-items-center h-11 w-11 rounded-xl shrink-0"
            style={{ background: TONE.clay.bg, color: TONE.clay.fg }}
          >
            <ShieldAlert size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="serif text-[21px] leading-tight text-ink">Flag as blacklisted</h3>
            <p className="text-[13px] text-ink-mute truncate">{guestName}</p>
          </div>
          <button
            onClick={onClose}
            className="grid place-items-center h-9 w-9 rounded-full hover:bg-line-soft text-ink-mute transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div
            className="flex items-start gap-2.5 rounded-xl px-3.5 py-3 text-[13px]"
            style={{ background: TONE.amber.bg, color: TONE.amber.fg }}
          >
            <AlertTriangle size={16} className="shrink-0 mt-0.5" />
            <span>
              Blacklisting a guest will warn staff during future reservations. This action is recorded in the audit log.
            </span>
          </div>

          <div>
            <label className="block text-[12.5px] font-semibold uppercase tracking-wide text-ink-mute mb-1.5">
              Reason
            </label>
            <textarea
              value={reason}
              onChange={(e) => { setReason(e.target.value); if (error) setError(""); }}
              rows={3}
              placeholder="Describe why this guest is being blacklisted…"
              className="w-full rounded-xl border border-line bg-mist px-3.5 py-2.5 text-[14px] text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-coral/20 focus:border-coral/40 transition-colors resize-none"
            />
          </div>

          <div>
            <label className="block text-[12.5px] font-semibold uppercase tracking-wide text-ink-mute mb-1.5">
              Severity
            </label>
            <div className="flex gap-2">
              {SEVERITIES.map((s) => {
                const active = severity === s.value;
                const tone = TONE[s.tone];
                return (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => setSeverity(s.value)}
                    className={cn(
                      "flex-1 rounded-full py-2 text-[13px] font-semibold transition-all border",
                      active ? "border-transparent" : "border-line bg-card text-ink-mute hover:text-ink",
                    )}
                    style={active ? { background: tone.bg, color: tone.fg } : undefined}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>

          {(error || mutation.isError) && (
            <p className="text-[13px] font-medium" style={{ color: TONE.clay.fg }}>
              {error || "Something went wrong. Please try again."}
            </p>
          )}
        </div>

        <div className="border-t border-line-soft px-6 py-4 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="text-[13px] font-semibold text-ink-mute hover:text-ink transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={mutation.isPending}
            className="inline-flex items-center gap-2 h-10 px-5 rounded-full text-white text-[14px] font-semibold transition-all shadow-pop disabled:opacity-40 disabled:pointer-events-none"
            style={{ background: TONE.clay.dot }}
          >
            <ShieldAlert size={16} />
            {mutation.isPending ? "Flagging…" : "Confirm blacklist"}
          </button>
        </div>
      </div>
    </div>
  );
}
