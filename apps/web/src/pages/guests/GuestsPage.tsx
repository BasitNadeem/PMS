import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, ChevronLeft, ChevronRight, UserX, Pencil } from "lucide-react";
import { cn } from "@/lib/cn";
import { guestsService, type GuestSummary } from "@/services/guests";
import { AddGuestModal } from "@/components/guests/AddGuestModal";
import { GuestDrawer } from "@/components/guests/GuestDrawer";
import { VipBadge } from "@/components/guests/VipBadge";
import { UpcomingOccasions } from "@/components/guests/UpcomingOccasions";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { SearchInput } from "@/components/ui/SearchInput";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { usePermissions } from "@/hooks/usePermissions";
import { useToast } from "@/hooks/useToast";
import { ToastContainer } from "@/components/ui/ToastContainer";

function maskId(doc: string | null): string {
  if (!doc) return "—";
  return "•".repeat(Math.max(0, doc.length - 4)) + doc.slice(-4);
}

function GuestRow({ guest, onOpen, onEdit, canEdit }: { guest: GuestSummary; onOpen: (id: string) => void; onEdit: (g: GuestSummary) => void; canEdit: boolean }) {
  return (
    <div
      onClick={() => onOpen(guest.id)}
      className="group grid grid-cols-1 md:grid-cols-[1.8fr_1.2fr_1.4fr_1fr_0.7fr_auto] gap-3 px-5 py-3.5 items-center hover:bg-mist cursor-pointer transition-colors border-b border-line-soft last:border-0"
    >
      <div className="flex items-center gap-3 min-w-0">
        <Avatar name={guest.fullName} size={42} />
        <div className="min-w-0">
          <div className="text-[14.5px] font-semibold text-ink truncate flex items-center gap-1.5">
            {guest.fullName}
            <VipBadge level={guest.vipLevel} size="sm" />
            {guest.isBlacklisted && (
              <StatusBadge status="Blacklisted" size="sm" dot={false} />
            )}
          </div>
          <div className="text-[12px] text-ink-mute md:hidden">{guest.phone ?? "—"}</div>
          {guest.tags.length > 0 && (
            <div className="mt-1 flex items-center gap-1 flex-wrap">
              {guest.tags.slice(0, 3).map((tag) => (
                <span key={tag} className="text-[10.5px] font-semibold text-ink-mute bg-mist border border-line-soft rounded-full px-1.5 py-0.5">
                  {tag}
                </span>
              ))}
              {guest.tags.length > 3 && (
                <span className="text-[10.5px] text-ink-faint">+{guest.tags.length - 3}</span>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="hidden md:block">
        <div className="text-[13px] font-semibold text-ink-soft tnum">{maskId(guest.documentNumber)}</div>
        <div className="text-[11.5px] text-ink-mute">{guest.documentType ?? "—"}</div>
      </div>
      <div className="hidden md:block min-w-0">
        <div className="text-[13px] text-ink-soft tnum truncate">{guest.phone ?? "—"}</div>
        <div className="text-[11.5px] text-ink-mute truncate">{guest.email ?? "—"}</div>
      </div>
      <div className="hidden md:flex items-center gap-1.5 text-[13px] text-ink-soft">
        <span className="h-1.5 w-1.5 rounded-full bg-slate" />
        {guest.nationality ?? "—"}
      </div>
      <div className="hidden md:block">
        <span className="serif text-[20px] text-ink tnum">{guest.totalStays}</span>
      </div>
      <div className="flex items-center justify-end gap-1">
        {canEdit && (
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(guest); }}
            className="grid place-items-center h-8 w-8 rounded-lg hover:bg-line-soft text-ink-mute opacity-0 group-hover:opacity-100 transition"
          >
            <Pencil size={15} />
          </button>
        )}
        <ChevronRight size={18} className="text-ink-faint hidden md:block" />
      </div>
    </div>
  );
}

export default function GuestsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { has } = usePermissions();
  const { toasts, addToast, removeToast } = useToast();
  const canCreate = has("guests:create");
  const canEdit   = has("guests:update");
  const [openDrawerId, setOpenDrawerId] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [onlyBlacklisted, setOnlyBlacklisted] = useState(false);
  const [onlyVip, setOnlyVip] = useState(false);
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: knownTags = [] } = useQuery({
    queryKey: ["guest-tags"],
    queryFn:  guestsService.getTags,
    staleTime: 5 * 60_000,
  });

  function toggleTag(tag: string) {
    setActiveTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
    setPage(1);
  }

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => { setDebouncedSearch(searchInput); setPage(1); }, 400);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [searchInput]);

  const { data, isLoading } = useQuery({
    queryKey: ["guests", { search: debouncedSearch, page, onlyBlacklisted, onlyVip, activeTags }],
    queryFn: () => guestsService.getGuests({
      search:      debouncedSearch || undefined,
      page,
      limit:       20,
      blacklisted: onlyBlacklisted || undefined,
      minVipLevel: onlyVip ? 1 : undefined,
      tags:        activeTags.length > 0 ? activeTags : undefined,
    }),
    refetchInterval: 15_000,
  });

  const guests     = data?.data ?? [];
  const meta       = data?.meta;
  const totalPages = meta?.totalPages ?? 1;

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <div className="mb-1.5 text-[12px] font-bold uppercase tracking-[0.14em] text-coral">Directory</div>
          <h1 className="serif text-[34px] leading-[1.05] text-ink">Guests</h1>
          <p className="mt-1.5 text-[15px] text-ink-mute">
            {meta ? `${meta.total.toLocaleString()} guest profile${meta.total !== 1 ? "s" : ""}` : "—"}
          </p>
        </div>
        {canCreate && (
          <button
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-full bg-coral text-white text-sm font-semibold hover:bg-coral-dark transition-colors shadow-pop whitespace-nowrap"
          >
            <Plus size={17} />
            Add guest
          </button>
        )}
      </div>

      <UpcomingOccasions canIssue={canEdit} onNotify={addToast} className="anim-fade-up mb-5" />

      <Card pad={false} className="anim-fade-up overflow-hidden">
        {/* Search */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-line-soft">
          <div className="flex items-center gap-2 flex-wrap">
            <SearchInput
              value={searchInput}
              onChange={(v) => setSearchInput(v)}
              placeholder="Search by name, email, phone…"
              className="w-full sm:w-80"
            />
            <button
              onClick={() => { setOnlyVip((v) => !v); setPage(1); }}
              className={cn(
                "h-9 px-3.5 rounded-full text-[13px] font-semibold border transition-colors",
                onlyVip
                  ? "border-amber bg-amber-soft text-amber"
                  : "border-line text-ink-mute hover:text-ink hover:border-ink-faint",
              )}
            >
              VIP
            </button>
            <button
              onClick={() => { setOnlyBlacklisted((v) => !v); setPage(1); }}
              className={cn(
                "h-9 px-3.5 rounded-full text-[13px] font-semibold border transition-colors",
                onlyBlacklisted
                  ? "border-clay bg-clay-soft text-clay"
                  : "border-line text-ink-mute hover:text-ink hover:border-ink-faint",
              )}
            >
              Blacklisted
            </button>
          </div>
          <p className="text-[13px] text-ink-mute">
            {meta?.total.toLocaleString() ?? "—"} guests
          </p>
        </div>

        {/* Tag filters — only rendered once the hotel actually uses tags, so the
            bar stays empty rather than showing a dead row on a fresh install. */}
        {knownTags.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap px-4 pb-3 -mt-1">
            {knownTags.slice(0, 12).map(({ tag, count }) => (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                className={cn(
                  "inline-flex items-center gap-1 h-7 px-2.5 rounded-full text-[12px] font-semibold border transition-colors",
                  activeTags.includes(tag)
                    ? "border-coral bg-coral/10 text-coral"
                    : "border-line text-ink-mute hover:text-ink hover:border-ink-faint",
                )}
              >
                {tag}
                <span className="text-ink-faint tnum">{count}</span>
              </button>
            ))}
            {activeTags.length > 0 && (
              <button
                onClick={() => { setActiveTags([]); setPage(1); }}
                className="h-7 px-2.5 text-[12px] font-semibold text-ink-faint hover:text-ink transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        )}

        {/* Column headers */}
        <div className="hidden md:grid grid-cols-[1.8fr_1.2fr_1.4fr_1fr_0.7fr_auto] gap-3 px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-ink-faint border-b border-line-soft">
          <span>Guest</span>
          <span>Identification</span>
          <span>Contact</span>
          <span>Nationality</span>
          <span>Stays</span>
          <span />
        </div>

        {/* Rows */}
        <div>
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-3.5 border-b border-line-soft animate-pulse">
                <div className="w-10 h-10 rounded-full bg-line-soft shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 bg-line-soft rounded w-1/3" />
                  <div className="h-2.5 bg-line-soft rounded w-1/4" />
                </div>
                <div className="h-3 bg-line-soft rounded w-1/5 hidden md:block" />
              </div>
            ))
          ) : guests.length === 0 ? (
            <EmptyState
              icon={UserX}
              title="No guests found"
              subtitle={debouncedSearch ? "Try a different search term." : "Add your first guest to get started."}
              action={
                !debouncedSearch && canCreate ? (
                  <button
                    onClick={() => setShowAdd(true)}
                    className="inline-flex items-center gap-2 h-9 px-4 rounded-full bg-coral text-white text-sm font-semibold hover:bg-coral-dark transition-colors"
                  >
                    <Plus size={15} /> Add guest
                  </button>
                ) : undefined
              }
            />
          ) : (
            guests.map((guest) => (
              <GuestRow
                key={guest.id}
                guest={guest}
                onOpen={setOpenDrawerId}
                onEdit={(g) => navigate(`/guests/${g.id}`)}
                canEdit={canEdit}
              />
            ))
          )}
        </div>
      </Card>

      {/* Pagination */}
      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-[13px] text-ink-mute">Page {meta.page} of {meta.totalPages}</p>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPage((p) => p - 1)}
              disabled={page <= 1}
              className={cn(
                "grid place-items-center h-9 w-9 rounded-full border border-line text-ink-mute transition-colors",
                page <= 1 ? "opacity-40 cursor-not-allowed" : "hover:bg-line-soft",
              )}
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= totalPages}
              className={cn(
                "grid place-items-center h-9 w-9 rounded-full border border-line text-ink-mute transition-colors",
                page >= totalPages ? "opacity-40 cursor-not-allowed" : "hover:bg-line-soft",
              )}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {showAdd && (
        <AddGuestModal onClose={() => setShowAdd(false)} onSuccess={() => {
          qc.invalidateQueries({ queryKey: ["guests"] });
        }} />
      )}

      <GuestDrawer
        guestId={openDrawerId}
        onClose={() => setOpenDrawerId(null)}
        onEdit={canEdit ? (id) => { setOpenDrawerId(null); navigate(`/guests/${id}`); } : undefined}
        canIssueOffer={canEdit}
        onNotify={addToast}
      />

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
