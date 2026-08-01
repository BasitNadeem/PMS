import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { X, Plus } from "lucide-react";
import { cn } from "@/lib/cn";
import { guestsService } from "@/services/guests";

export interface TagEditorProps {
  value: string[];
  onChange: (tags: string[]) => void;
  className?: string;
}

/**
 * Chip editor for guest tags, with suggestions drawn from tags the hotel is
 * already using. Suggesting existing tags matters more than it looks: without
 * it every receptionist invents their own spelling and the tags stop being
 * usable as a filter.
 */
export function TagEditor({ value, onChange, className }: TagEditorProps) {
  const [draft, setDraft] = useState("");

  const { data: known = [] } = useQuery({
    queryKey: ["guest-tags"],
    queryFn:  guestsService.getTags,
    staleTime: 5 * 60_000,
  });

  function add(raw: string) {
    const tag = raw.trim();
    if (!tag) return;
    // Case-insensitive de-dupe keeps "Corporate" and "corporate" as one tag,
    // matching how the API normalises them on save.
    if (value.some((t) => t.toLowerCase() === tag.toLowerCase())) {
      setDraft("");
      return;
    }
    onChange([...value, tag]);
    setDraft("");
  }

  function remove(tag: string) {
    onChange(value.filter((t) => t !== tag));
  }

  const suggestions = known
    .filter((k) => !value.some((t) => t.toLowerCase() === k.tag.toLowerCase()))
    .filter((k) => (draft ? k.tag.toLowerCase().includes(draft.toLowerCase()) : true))
    .slice(0, 6);

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-1.5 mb-2">
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full bg-mist border border-line px-2.5 py-1 text-[12.5px] font-semibold text-ink-soft"
          >
            {tag}
            <button
              type="button"
              onClick={() => remove(tag)}
              className="text-ink-faint hover:text-clay transition-colors"
              aria-label={`Remove tag ${tag}`}
            >
              <X size={12} />
            </button>
          </span>
        ))}
        {value.length === 0 && (
          <span className="text-[12.5px] text-ink-faint">No tags yet</span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              // This editor lives inside a form; Enter must add a tag rather
              // than submit the whole guest record.
              e.preventDefault();
              add(draft);
            }
          }}
          placeholder="Add a tag…"
          maxLength={40}
          className="h-9 flex-1 rounded-xl bg-mist border border-line px-3 text-[13px] text-ink placeholder:text-ink-faint outline-none focus:border-coral focus:ring-2 focus:ring-coral/15 transition-all"
        />
        <button
          type="button"
          onClick={() => add(draft)}
          disabled={!draft.trim()}
          className="grid place-items-center h-9 w-9 rounded-xl border border-line text-ink-mute hover:bg-mist transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label="Add tag"
        >
          <Plus size={15} />
        </button>
      </div>

      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {suggestions.map((s) => (
            <button
              key={s.tag}
              type="button"
              onClick={() => add(s.tag)}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border border-dashed border-line px-2.5 py-1",
                "text-[12px] text-ink-mute hover:text-ink hover:border-ink-faint transition-colors",
              )}
            >
              {s.tag}
              <span className="text-ink-faint tnum">{s.count}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
