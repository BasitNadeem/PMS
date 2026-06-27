import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Search, X, Users, CalendarCheck, BedDouble, Users2, Receipt, UserCog, Loader2,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { searchService, type SearchResultItem, type SearchResultType } from "@/services/search";
import { useEscapeKey } from "@/hooks/useEscapeKey";

const TYPE_META: Record<SearchResultType, { label: string; icon: React.ElementType }> = {
  guest:       { label: "Guests",       icon: Users },
  reservation: { label: "Reservations", icon: CalendarCheck },
  room:        { label: "Rooms",        icon: BedDouble },
  group:       { label: "Groups",       icon: Users2 },
  folio:       { label: "Folios",       icon: Receipt },
  staff:       { label: "Staff",        icon: UserCog },
};
const TYPE_ORDER: SearchResultType[] = ["guest", "reservation", "group", "room", "folio", "staff"];

export function GlobalSearchBar() {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [input, setInput] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);

  function expand() {
    setExpanded(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function collapse() {
    if (input) return; // keep expanded while there's text to review
    setExpanded(false);
    setOpen(false);
  }

  useEffect(() => {
    const id = setTimeout(() => setDebounced(input.trim()), 250);
    return () => clearTimeout(id);
  }, [input]);

  const { data: results = [], isFetching } = useQuery({
    queryKey: ["global-search", debounced],
    queryFn: () => searchService.search(debounced),
    enabled: debounced.length >= 2,
    staleTime: 30_000,
  });

  useEscapeKey(() => {
    setOpen(false);
    setInput("");
    setExpanded(false);
    inputRef.current?.blur();
  }, expanded);

  // Collapse back to icon on outside click (unless there's text to keep reviewing)
  useEffect(() => {
    if (!expanded) return;
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        if (!input) setExpanded(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [expanded, input]);

  useEffect(() => { setActiveIdx(0); }, [results]);

  function goTo(item: SearchResultItem) {
    navigate(item.route);
    setOpen(false);
    setInput("");
    inputRef.current?.blur();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); const item = results[activeIdx]; if (item) goTo(item); }
  }

  const showDropdown = open && debounced.length >= 2;
  const grouped = TYPE_ORDER
    .map((type) => ({ type, items: results.filter((r) => r.type === type) }))
    .filter((g) => g.items.length > 0);

  let flatIdx = -1;

  return (
    <div
      ref={containerRef}
      className={cn("relative", expanded ? "w-full max-w-md" : "w-9")}
      onMouseEnter={() => !expanded && expand()}
    >
      {expanded ? (
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => { setInput(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onBlur={collapse}
            onKeyDown={handleKeyDown}
            placeholder="Search guests, reservations, rooms, groups…"
            className="w-full h-9 rounded-full border border-line bg-white pl-10 pr-9 text-[13.5px] text-ink placeholder:text-ink-faint focus:outline-none focus:border-coral focus:ring-2 focus:ring-coral/15 transition-all"
          />
          {isFetching ? (
            <Loader2 size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-faint animate-spin" />
          ) : input && (
            <button
              onClick={() => { setInput(""); setOpen(false); setExpanded(false); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink-soft transition-colors"
            >
              <X size={15} />
            </button>
          )}
        </div>
      ) : (
        <button
          onClick={expand}
          title="Search (guests, reservations, rooms, groups…)"
          className="grid place-items-center h-9 w-9 rounded-full text-ink-mute hover:bg-line-soft hover:text-ink-soft transition-colors"
        >
          <Search size={17} />
        </button>
      )}

      {showDropdown && (
        <div className="absolute left-0 right-0 mt-2 max-h-[70vh] overflow-y-auto scroll-area rounded-2xl border border-line bg-card shadow-float z-50 anim-fade-in">
          {debounced.length < 2 ? (
            <p className="px-4 py-6 text-center text-[13px] text-ink-mute">Keep typing…</p>
          ) : grouped.length === 0 ? (
            <p className="px-4 py-6 text-center text-[13px] text-ink-mute">
              {isFetching ? "Searching…" : `No results for "${debounced}"`}
            </p>
          ) : (
            grouped.map(({ type, items }) => {
              const meta = TYPE_META[type];
              return (
                <div key={type} className="py-1.5">
                  <div className="px-4 pb-1 text-[11px] font-bold uppercase tracking-wider text-ink-faint">
                    {meta.label}
                  </div>
                  {items.map((item) => {
                    flatIdx += 1;
                    const isActive = flatIdx === activeIdx;
                    return (
                      <button
                        key={`${item.type}-${item.id}`}
                        onMouseEnter={() => setActiveIdx(flatIdx)}
                        onClick={() => goTo(item)}
                        className={cn(
                          "flex w-full items-center gap-3 px-4 py-2 text-left transition-colors",
                          isActive ? "bg-mist" : "hover:bg-mist",
                        )}
                      >
                        <span className="grid place-items-center h-8 w-8 rounded-lg bg-line-soft text-ink-mute shrink-0">
                          <meta.icon size={15} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="text-[13.5px] font-semibold text-ink truncate">{item.title}</div>
                          {item.subtitle && (
                            <div className="text-[12px] text-ink-mute truncate">{item.subtitle}</div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
