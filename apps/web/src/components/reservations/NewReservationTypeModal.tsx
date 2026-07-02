import { X, User, Users } from "lucide-react";
import { useEscapeKey } from "@/hooks/useEscapeKey";

export type NewReservationType = "SINGLE" | "GROUP";

export interface NewReservationTypeModalProps {
  onClose:       () => void;
  onSelect:      (type: NewReservationType) => void;
  canCreateGroup?: boolean;
}

export function NewReservationTypeModal({ onClose, onSelect, canCreateGroup = true }: NewReservationTypeModalProps) {
  useEscapeKey(onClose);

  return (
    <div
      className="fixed inset-0 bg-ink/35 backdrop-blur-[3px] z-50 grid place-items-center p-4 sm:p-6 anim-fade-in"
      onMouseDown={onClose}
    >
      <div
        className="relative w-full max-w-2xl bg-card rounded-[1.75rem] shadow-float anim-scale-in"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-7 pt-7 pb-5">
          <div>
            <h3 className="serif text-[24px] leading-tight text-ink">New reservation</h3>
            <p className="text-[13.5px] text-ink-mute mt-1">What kind of booking is this?</p>
          </div>
          <button
            onClick={onClose}
            className="grid place-items-center h-9 w-9 rounded-full hover:bg-line-soft text-ink-mute transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Options */}
        <div className="grid grid-cols-2 gap-4 px-7 pb-7">
          {/* Single */}
          <button
            onClick={() => onSelect("SINGLE")}
            className="group flex flex-col items-start gap-5 rounded-2xl border border-line bg-white p-6 text-left transition-all hover:border-coral/60 hover:shadow-pop active:scale-[0.98]"
          >
            <span className="grid place-items-center h-14 w-14 rounded-2xl bg-coral-soft text-coral-deep group-hover:bg-coral group-hover:text-white transition-colors">
              <User size={24} />
            </span>
            <span>
              <div className="text-[18px] font-bold text-ink">Single</div>
              <div className="text-[13px] text-ink-mute mt-1 leading-snug">One guest, one room</div>
            </span>
          </button>

          {/* Group / Agent / Corporate */}
          {canCreateGroup && (
            <button
              onClick={() => onSelect("GROUP")}
              className="group flex flex-col items-start gap-5 rounded-2xl border border-line bg-white p-6 text-left transition-all hover:border-coral/60 hover:shadow-pop active:scale-[0.98]"
            >
              <span className="grid place-items-center h-14 w-14 rounded-2xl bg-coral-soft text-coral-deep group-hover:bg-coral group-hover:text-white transition-colors">
                <Users size={24} />
              </span>
              <span>
                <div className="text-[18px] font-bold text-ink whitespace-nowrap">Group / Agent / Corporate</div>
                <div className="text-[13px] text-ink-mute mt-1 leading-snug">Multiple rooms, tour agency, or company</div>
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
