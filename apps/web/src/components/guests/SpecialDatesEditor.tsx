import { Cake, Heart, Star, X, Plus } from "lucide-react";
import { cn } from "@/lib/cn";
import type { GuestSpecialDate, SpecialDateKind } from "@/services/guests";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// February allows 29 so a leap-day birthday can be recorded. Which day it is
// actually celebrated on in a non-leap year is decided when greetings go out,
// not by refusing to store a real date.
const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

const KIND_META: Record<SpecialDateKind, { label: string; icon: typeof Cake }> = {
  BIRTHDAY:    { label: "Birthday",    icon: Cake },
  ANNIVERSARY: { label: "Anniversary", icon: Heart },
  CUSTOM:      { label: "Occasion",    icon: Star },
};

const selectCls = "h-9 rounded-xl bg-mist border border-line px-2.5 text-[13px] text-ink outline-none focus:border-coral focus:ring-2 focus:ring-coral/15 transition-all cursor-pointer";

export interface SpecialDatesEditorProps {
  value: GuestSpecialDate[];
  onChange: (dates: GuestSpecialDate[]) => void;
  declined: boolean;
  onDeclinedChange: (declined: boolean) => void;
  className?: string;
}

/**
 * Editor for birthdays and anniversaries.
 *
 * Two details drive the design:
 *  - The year is optional. Many guests give a day and month but not the year,
 *    and a control that demands one would push staff into inventing a value
 *    that an age could later be computed from.
 *  - "Declined" is a distinct state from "empty". Without it the front desk
 *    cannot tell "never asked" from "asked, guest said no", so they ask the
 *    same guest on every visit.
 */
export function SpecialDatesEditor({
  value, onChange, declined, onDeclinedChange, className,
}: SpecialDatesEditorProps) {
  function add(kind: SpecialDateKind) {
    const today = new Date();
    onChange([
      ...value,
      { kind, month: today.getMonth() + 1, day: today.getDate(), year: null, source: "FRONT_DESK" },
    ]);
    // Adding a date contradicts a previous refusal, so clear the marker.
    if (declined) onDeclinedChange(false);
  }

  function update(index: number, patch: Partial<GuestSpecialDate>) {
    onChange(value.map((d, i) => (i === index ? { ...d, ...patch } : d)));
  }

  function remove(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  const currentYear = new Date().getFullYear();
  const usedKinds = new Set(value.filter((d) => d.kind !== "CUSTOM").map((d) => d.kind));

  return (
    <div className={className}>
      {value.length === 0 && !declined && (
        <p className="text-[12.5px] text-ink-faint mb-2.5">
          Nothing on file. Ask only when it comes up naturally — a stay booked for an
          anniversary, for instance.
        </p>
      )}

      <div className="space-y-2 mb-3">
        {value.map((date, index) => {
          const Icon = KIND_META[date.kind].icon;
          const maxDay = DAYS_IN_MONTH[date.month - 1] ?? 31;
          return (
            <div key={index} className="flex items-center gap-2 flex-wrap rounded-xl border border-line bg-mist px-3 py-2.5">
              <Icon size={15} className="text-coral shrink-0" />
              <select
                value={date.kind}
                onChange={(e) => update(index, { kind: e.target.value as SpecialDateKind })}
                className={cn(selectCls, "w-[112px]")}
              >
                {(Object.keys(KIND_META) as SpecialDateKind[]).map((k) => (
                  <option key={k} value={k}>{KIND_META[k].label}</option>
                ))}
              </select>

              <select
                value={date.day}
                onChange={(e) => update(index, { day: Number(e.target.value) })}
                className={cn(selectCls, "w-[68px] tnum")}
              >
                {Array.from({ length: maxDay }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>

              <select
                value={date.month}
                onChange={(e) => {
                  const month = Number(e.target.value);
                  // Clamp the day so switching to a shorter month cannot leave
                  // an impossible date like 31 February in the form.
                  const max = DAYS_IN_MONTH[month - 1] ?? 31;
                  update(index, { month, day: Math.min(date.day, max) });
                }}
                className={cn(selectCls, "w-[124px]")}
              >
                {MONTHS.map((m, i) => (
                  <option key={m} value={i + 1}>{m}</option>
                ))}
              </select>

              <select
                value={date.year ?? ""}
                onChange={(e) => update(index, { year: e.target.value ? Number(e.target.value) : null })}
                className={cn(selectCls, "w-[104px] tnum")}
                title="Optional — leave as “Year not given” if the guest did not share it"
              >
                <option value="">Year not given</option>
                {Array.from({ length: 100 }, (_, i) => currentYear - i).map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>

              {date.kind === "CUSTOM" && (
                <input
                  type="text"
                  value={date.label ?? ""}
                  onChange={(e) => update(index, { label: e.target.value })}
                  placeholder="What is the occasion?"
                  maxLength={60}
                  className="h-9 flex-1 min-w-[140px] rounded-xl bg-paper border border-line px-3 text-[13px] text-ink placeholder:text-ink-faint outline-none focus:border-coral focus:ring-2 focus:ring-coral/15 transition-all"
                />
              )}

              <button
                type="button"
                onClick={() => remove(index)}
                className="ml-auto grid place-items-center h-8 w-8 rounded-lg text-ink-faint hover:text-clay hover:bg-line-soft transition-colors"
                aria-label="Remove this date"
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        {(Object.keys(KIND_META) as SpecialDateKind[]).map((kind) => (
          <button
            key={kind}
            type="button"
            onClick={() => add(kind)}
            disabled={kind !== "CUSTOM" && usedKinds.has(kind)}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full border border-line text-[12.5px] font-semibold text-ink-mute hover:text-ink hover:border-ink-faint transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus size={13} /> {KIND_META[kind].label}
          </button>
        ))}
      </div>

      <label className="mt-3 flex items-start gap-2.5 cursor-pointer">
        <input
          type="checkbox"
          checked={declined}
          onChange={(e) => onDeclinedChange(e.target.checked)}
          disabled={value.length > 0}
          className="mt-0.5 h-4 w-4 rounded border-line accent-coral disabled:opacity-40"
        />
        <span className="text-[12.5px] text-ink-mute leading-snug">
          Guest preferred not to share
          <span className="block text-[11.5px] text-ink-faint">
            Records that we asked, so nobody asks again on their next stay.
          </span>
        </span>
      </label>
    </div>
  );
}
