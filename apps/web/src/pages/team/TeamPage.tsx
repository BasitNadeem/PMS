import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Plus, UserX, Pencil, Mail, Phone,
  Crown, Shield, ConciergeBell, Sparkles, Utensils, Wrench, Calculator,
  UserPlus, List, LayoutGrid,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { usersService, type StaffUser } from "@/services/users";
import { AddStaffModal } from "@/components/team/AddStaffModal";
import { EditStaffModal } from "@/components/team/EditStaffModal";
import { ToastContainer } from "@/components/ui/ToastContainer";
import { useToast } from "@/hooks/useToast";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { SearchInput } from "@/components/ui/SearchInput";
import { TONE } from "@/components/ui/StatusBadge";
import { usePermissions } from "@/hooks/usePermissions";

// ── Role config ───────────────────────────────────────────────────────────────

const ROLE_TONE: Record<string, string> = {
  OWNER:        "dusk",
  MANAGER:      "coral",
  FRONT_DESK:   "slate",
  HOUSEKEEPING: "pine",
  KITCHEN:      "amber",
  MAINTENANCE:  "clay",
  ACCOUNTANT:   "ink",
};

const ROLE_ICON: Record<string, React.ElementType> = {
  OWNER:        Crown,
  MANAGER:      Shield,
  FRONT_DESK:   ConciergeBell,
  HOUSEKEEPING: Sparkles,
  KITCHEN:      Utensils,
  MAINTENANCE:  Wrench,
  ACCOUNTANT:   Calculator,
};

function joinedYear(iso: string): string {
  return new Date(iso).getFullYear().toString();
}

// ── Status toggle ─────────────────────────────────────────────────────────────

function StatusToggle({ staff, onEdit }: { staff: StaffUser; onEdit?: (s: StaffUser) => void }) {
  const content = (
    <>
      <span className={cn("text-[12px] font-semibold", staff.isActive ? "text-pine" : "text-ink-mute")}>
        {staff.isActive ? "Active" : "Inactive"}
      </span>
      <span className={cn(
        "relative h-5 w-9 rounded-full transition-colors",
        staff.isActive ? "bg-pine" : "bg-line",
      )}>
        <span className={cn(
          "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-all",
          staff.isActive ? "left-[18px]" : "left-0.5",
        )} />
      </span>
    </>
  );

  if (!onEdit) {
    return <div className="inline-flex items-center gap-2">{content}</div>;
  }

  return (
    <button onClick={() => onEdit(staff)} className="inline-flex items-center gap-2 group/t">
      {content}
    </button>
  );
}

// ── Staff card ────────────────────────────────────────────────────────────────

function StaffCard({ staff, onEdit, canEdit, delay }: { staff: StaffUser; onEdit: (s: StaffUser) => void; canEdit: boolean; delay: number }) {
  const roleToneName = ROLE_TONE[staff.assignedRole.name] ?? "ink";
  const t    = TONE[roleToneName];
  const Icon = ROLE_ICON[staff.assignedRole.name] ?? Pencil;

  return (
    <Card
      className={cn("anim-fade-up group", !staff.isActive && "opacity-70")}
      hover
      pad={false}
      style={{ animationDelay: delay + "ms" }}
    >
      {/* Top section */}
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative shrink-0">
              <Avatar name={staff.user.name} size={48} />
              <span className={cn(
                "absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-card",
                staff.isActive ? "bg-pine" : "bg-ink-faint",
              )} />
            </div>
            <div className="min-w-0">
              <div className="text-[15px] font-semibold text-ink leading-tight truncate">
                {staff.user.name}
              </div>
              <span
                className="mt-1 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11.5px] font-bold"
                style={{ background: t.bg, color: t.fg }}
              >
                <Icon size={11} />
                {staff.assignedRole.displayName}
              </span>
            </div>
          </div>
          {canEdit && (
            <button
              onClick={() => onEdit(staff)}
              className="opacity-0 group-hover:opacity-100 transition-opacity grid place-items-center h-8 w-8 rounded-lg hover:bg-line-soft text-ink-mute shrink-0 -mt-0.5 -mr-1"
            >
              <Pencil size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Contact rows */}
      <div className="border-t border-line-soft mx-4" />
      <div className="px-5 py-3.5 space-y-2.5">
        <div className="flex items-center gap-2.5">
          <Mail size={14} className="text-ink-faint shrink-0" />
          <span className="text-[13px] text-ink-soft tnum truncate">{staff.user.email}</span>
        </div>
        {staff.user.phone ? (
          <div className="flex items-center gap-2.5">
            <Phone size={14} className="text-ink-faint shrink-0" />
            <span className="text-[13px] text-ink-soft tnum">{staff.user.phone}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2.5">
            <Phone size={14} className="text-ink-faint shrink-0" />
            <span className="text-[13px] text-ink-faint italic">No phone</span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-line-soft mx-4" />
      <div className="px-5 py-3.5 flex items-center justify-between">
        <span className="text-[12.5px] text-ink-mute">Since {joinedYear(staff.createdAt)}</span>
        <StatusToggle staff={staff} onEdit={canEdit ? onEdit : undefined} />
      </div>
    </Card>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TeamPage() {
  const { toasts, addToast, removeToast } = useToast();
  const { has } = usePermissions();
  const canCreate = has("team:create");
  const canEdit   = has("team:update");
  const [showAdd, setShowAdd]       = useState(false);
  const [editTarget, setEditTarget] = useState<StaffUser | null>(null);
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [search, setSearch]         = useState("");
  const [view, setView]             = useState<"grid" | "table">("grid");

  const { data: staff = [], isLoading } = useQuery<StaffUser[]>({
    queryKey: ["team"],
    queryFn: usersService.getUsers,
  });

  const activeCount = staff.filter((s) => s.isActive).length;

  // Unique roles present in the list (preserve order from ROLE_TONE)
  const roleOrder = Object.keys(ROLE_TONE);
  const presentRoles = roleOrder.filter((r) => staff.some((s) => s.assignedRole.name === r));

  const roleCounts = staff.reduce<Record<string, number>>((acc, s) => {
    const r = s.assignedRole.name;
    acc[r] = (acc[r] ?? 0) + 1;
    return acc;
  }, {});

  // Role display name lookup from data
  const roleDisplayName = Object.fromEntries(
    staff.map((s) => [s.assignedRole.name, s.assignedRole.displayName]),
  );

  // Client-side filter
  const filtered = staff.filter((s) => {
    if (roleFilter !== "ALL" && s.assignedRole.name !== roleFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        s.user.name.toLowerCase().includes(q) ||
        s.user.email.toLowerCase().includes(q) ||
        (s.user.phone?.toLowerCase().includes(q) ?? false)
      );
    }
    return true;
  });

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <div className="mb-1.5 text-[12px] font-bold uppercase tracking-[0.14em] text-coral">People</div>
          <h1 className="serif text-[34px] leading-[1.05] text-ink">Team</h1>
          <p className="mt-1.5 text-[15px] text-ink-mute">
            {staff.length} staff accounts · {activeCount} active
          </p>
        </div>
        {canCreate && (
          <button
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-full bg-ink text-white text-sm font-semibold hover:bg-ink-soft transition-colors shadow-pop whitespace-nowrap"
          >
            <UserPlus size={17} />
            Add staff
          </button>
        )}
      </div>

      {/* Search + role filter row */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex flex-wrap items-center gap-3">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search by name or email…"
            className="w-64"
          />

          <div className="flex flex-wrap items-center gap-1.5">
            {/* All */}
            <button
              onClick={() => setRoleFilter("ALL")}
              className={cn(
                "h-8 px-3.5 rounded-full text-[13px] font-semibold transition-all",
                roleFilter === "ALL"
                  ? "bg-ink text-white shadow-pop"
                  : "bg-white border border-line text-ink-soft hover:border-coral/30 hover:text-ink",
              )}
            >
              All
            </button>

            {/* Per-role tabs */}
            {presentRoles.map((role) => {
              const toneName = ROLE_TONE[role] ?? "ink";
              const t = TONE[toneName];
              const isActive = roleFilter === role;
              return (
                <button
                  key={role}
                  onClick={() => setRoleFilter(isActive ? "ALL" : role)}
                  className={cn(
                    "h-8 px-3.5 rounded-full text-[13px] font-semibold transition-all inline-flex items-center gap-1.5",
                    isActive
                      ? "bg-ink text-white shadow-pop"
                      : "bg-white border border-line text-ink-soft hover:border-coral/30 hover:text-ink",
                  )}
                >
                  <span
                    className="h-2 w-2 rounded-full shrink-0"
                    style={{ background: isActive ? "white" : t.dot }}
                  />
                  {roleDisplayName[role] ?? role}
                  <span className={cn("text-[11px]", isActive ? "text-white/70" : "text-ink-faint")}>
                    {roleCounts[role] ?? 0}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* View toggle */}
        <div className="flex items-center gap-1 rounded-xl border border-line bg-mist p-1">
          <button
            onClick={() => setView("table")}
            className={cn("grid place-items-center h-7 w-7 rounded-lg transition-colors", view === "table" ? "bg-card text-ink shadow-sm" : "text-ink-faint")}
          >
            <List size={14} />
          </button>
          <button
            onClick={() => setView("grid")}
            className={cn("grid place-items-center h-7 w-7 rounded-lg transition-colors", view === "grid" ? "bg-card text-ink shadow-sm" : "text-ink-faint")}
          >
            <LayoutGrid size={14} />
          </button>
        </div>
      </div>

      {/* Loading skeleton */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-52 rounded-xl2 bg-line-soft animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center py-20">
          <div className="grid place-items-center h-14 w-14 rounded-2xl bg-line-soft text-ink-faint mb-4">
            <UserX size={26} />
          </div>
          <p className="text-base font-semibold text-ink-soft">
            {search || roleFilter !== "ALL" ? "No matching staff found" : "No team members yet"}
          </p>
          {!search && roleFilter === "ALL" && canCreate && (
            <button
              onClick={() => setShowAdd(true)}
              className="mt-4 inline-flex items-center gap-2 h-9 px-4 rounded-full bg-coral text-white text-sm font-semibold hover:bg-coral-dark transition-colors"
            >
              <Plus size={15} /> Add your first staff member
            </button>
          )}
        </div>
      ) : view === "grid" ? (
        /* Grid view */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((s, i) => (
            <StaffCard key={s.id} staff={s} onEdit={setEditTarget} canEdit={canEdit} delay={Math.min(i * 40, 320)} />
          ))}
        </div>
      ) : (
        /* Table view */
        <div className="rounded-2xl border border-line bg-card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-line-soft">
                <th className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-ink-faint">Name</th>
                <th className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-ink-faint">Role</th>
                <th className="hidden md:table-cell px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-ink-faint">Email / Phone</th>
                <th className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-ink-faint">Status</th>
                {canEdit && <th className="px-5 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-ink-faint">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => {
                const toneName = ROLE_TONE[s.assignedRole.name] ?? "ink";
                const t = TONE[toneName];
                const Icon = ROLE_ICON[s.assignedRole.name] ?? Pencil;
                return (
                  <tr
                    key={s.id}
                    onClick={() => canEdit && setEditTarget(s)}
                    className={cn(
                      "border-b border-line-soft last:border-0 transition-colors",
                      canEdit ? "cursor-pointer hover:bg-mist" : "",
                      !s.isActive && "opacity-60",
                    )}
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative shrink-0">
                          <Avatar name={s.user.name} size={38} />
                          <span className={cn("absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card", s.isActive ? "bg-pine" : "bg-ink-faint")} />
                        </div>
                        <span className="text-[14px] font-semibold text-ink truncate">{s.user.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11.5px] font-bold"
                        style={{ background: t.bg, color: t.fg }}
                      >
                        <Icon size={11} />
                        {s.assignedRole.displayName}
                      </span>
                    </td>
                    <td className="hidden md:table-cell px-5 py-3.5">
                      <div className="flex items-center gap-1.5 text-[13px] text-ink-soft truncate">
                        <Mail size={13} className="text-ink-faint shrink-0" />
                        <span className="truncate">{s.user.email}</span>
                      </div>
                      {s.user.phone && (
                        <div className="flex items-center gap-1.5 text-[12px] text-ink-mute mt-0.5">
                          <Phone size={12} className="text-ink-faint shrink-0" />
                          <span>{s.user.phone}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={cn("text-[13px] font-semibold", s.isActive ? "text-pine" : "text-ink-mute")}>
                        {s.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    {canEdit && (
                      <td className="px-5 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => setEditTarget(s)}
                          className="grid place-items-center h-8 w-8 rounded-lg hover:bg-line-soft text-ink-mute transition-colors ml-auto"
                        >
                          <Pencil size={14} />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showAdd && (
        <AddStaffModal onClose={() => setShowAdd(false)} onSuccess={addToast} />
      )}
      {editTarget && (
        <EditStaffModal staffUser={editTarget} onClose={() => setEditTarget(null)} onSuccess={addToast} />
      )}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
