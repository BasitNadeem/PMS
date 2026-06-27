import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { History, ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";
import { Card } from "@/components/ui/Card";
import { TONE, type ToneConfig } from "@/components/ui/StatusBadge";
import { auditService, type AuditLogParams, type AuditLogEntry } from "@/services/audit";
import { useEscapeKey } from "@/hooks/useEscapeKey";

const ACTION_LABELS: Record<string, string> = {
  GUEST_CREATE: "Guest Created",
  GUEST_UPDATE: "Guest Updated",
  GUEST_BLACKLISTED: "Guest Blacklisted",
  GUEST_UNBLACKLISTED: "Guest Removed from Blacklist",
  RESERVATION_CREATE: "Reservation Created",
  RESERVATION_UPDATE: "Reservation Updated",
  RESERVATION_CHECKIN: "Guest Checked In",
  RESERVATION_CHECKOUT: "Guest Checked Out",
  RESERVATION_CANCEL: "Reservation Cancelled",
  RESERVATION_STATUS_UPDATE: "Status Changed",
  FOLIO_PAYMENT: "Payment Recorded",
  FOLIO_CHARGE: "Charge Added",
  FOLIO_VOID: "Charge Voided",
  ROOM_CREATE: "Room Created",
  ROOM_UPDATE: "Room Updated",
  ROOM_STATUS_CHANGE: "Room Status Changed",
  EXPENSE_CREATE: "Expense Added",
  EXPENSE_DELETE: "Expense Deleted",
  SHIFT_REPORT_CREATE: "Shift Report Submitted",
  SHIFT_REPORT_SIGNED_OFF: "Shift Report Signed Off",
};

function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

type ActionCategory = "create" | "update" | "delete" | "status";

function actionCategory(action: string): ActionCategory {
  if (action.endsWith("_CREATE") || action.endsWith("_CHECKIN")) return "create";
  if (action.endsWith("_DELETE") || action.includes("BLACKLIST") || action.includes("VOID") || action.endsWith("_CANCEL")) return "delete";
  if (action.includes("STATUS") || action.endsWith("_CHECKOUT") || action.endsWith("_SIGNED_OFF")) return "status";
  return "update";
}

const CATEGORY_TONE: Record<ActionCategory, ToneConfig> = {
  create: TONE.pine,
  update: TONE.slate,
  delete: TONE.clay,
  status: TONE.amber,
};

// Fields to skip — system internals the owner doesn't need to see
const SKIP_FIELDS = new Set(["id", "hotelId", "createdAt", "updatedAt", "passwordHash", "refreshTokenHash"]);

// Human-readable labels for common field names
const FIELD_LABELS: Record<string, string> = {
  status: "Status",
  reason: "Reason",
  severity: "Severity",
  taskType: "Task type",
  roomId: "Room",
  guestId: "Guest",
  staffId: "Staff",
  userId: "User",
  checkInDate: "Check-in date",
  checkOutDate: "Check-out date",
  actualCheckIn: "Actual check-in",
  actualCheckOut: "Actual check-out",
  amount: "Amount",
  totalAmount: "Total amount",
  ratePerNight: "Rate per night",
  source: "Booking source",
  notes: "Notes",
  variance: "Cash variance",
  cashCollected: "Cash collected",
  openingBalance: "Opening balance",
  closingBalance: "Closing balance",
  isBlacklisted: "Blacklisted",
  blacklistReason: "Blacklist reason",
  name: "Name",
  phone: "Phone",
  email: "Email",
  documentNumber: "Document number",
  documentType: "Document type",
  adults: "Adults",
  children: "Children",
  priority: "Priority",
  isVoided: "Voided",
  isRefund: "Refund",
  method: "Payment method",
  shiftType: "Shift type",
  shiftDate: "Shift date",
  signedOffAt: "Signed off at",
  actualCashCount: "Actual cash count",
  description: "Description",
  category: "Category",
  type: "Type",
  roomNumber: "Room number",
  floor: "Floor",
  isActive: "Active",
};

const PAISAS_FIELDS = new Set(["amount", "totalAmount", "ratePerNight", "variance", "cashCollected", "openingBalance", "closingBalance", "actualCashCount", "estimatedCost", "actualCost"]);
const BOOL_LABELS: Record<string, string> = { true: "Yes", false: "No" };

function formatValue(key: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return BOOL_LABELS[String(value)];
  if (typeof value === "number") {
    if (PAISAS_FIELDS.has(key)) return `PKR ${Math.floor(value / 100).toLocaleString("en-PK")}`;
    return String(value);
  }
  if (typeof value === "string") {
    // ISO date strings
    if (/^\d{4}-\d{2}-\d{2}T/.test(value)) {
      return new Intl.DateTimeFormat("en-PK", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return new Intl.DateTimeFormat("en-PK", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value + "T00:00:00"));
    }
    // Enum-style SCREAMING_SNAKE → Title Case
    if (/^[A-Z][A-Z0-9_]+$/.test(value)) return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    return value;
  }
  return JSON.stringify(value);
}

function fieldLabel(key: string): string {
  return FIELD_LABELS[key] ?? key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()).trim();
}

function renderReadableChanges(before: unknown, after: unknown) {
  const b = (before && typeof before === "object" && !Array.isArray(before)) ? before as Record<string, unknown> : null;
  const a = (after  && typeof after  === "object" && !Array.isArray(after))  ? after  as Record<string, unknown> : null;

  if (!b && !a) return null;

  // UPDATE: show only fields that actually changed
  if (b && a) {
    const changed = Object.keys({ ...b, ...a }).filter((k) => {
      if (SKIP_FIELDS.has(k)) return false;
      return JSON.stringify(b[k]) !== JSON.stringify(a[k]);
    });
    if (changed.length === 0) return <p className="text-[12.5px] text-ink-mute italic">No field changes recorded.</p>;
    return (
      <div className="space-y-1.5">
        {changed.map((k) => (
          <div key={k} className="text-[12.5px]">
            <span className="font-semibold text-ink-soft">{fieldLabel(k)}:</span>{" "}
            <span className="text-clay line-through mr-1">{formatValue(k, b[k])}</span>
            <span className="text-pine font-medium">{formatValue(k, a[k])}</span>
          </div>
        ))}
      </div>
    );
  }

  // CREATE / one-sided entry
  const data = a ?? b ?? {};
  const entries = Object.entries(data as Record<string, unknown>).filter(([k]) => !SKIP_FIELDS.has(k));
  if (entries.length === 0) return null;
  return (
    <div className="space-y-1.5">
      {entries.map(([k, v]) => (
        <div key={k} className="text-[12.5px]">
          <span className="font-semibold text-ink-soft">{fieldLabel(k)}:</span>{" "}
          <span className="text-ink">{formatValue(k, v)}</span>
        </div>
      ))}
    </div>
  );
}

const ENTITY_OPTIONS = [
  "guest", "reservation", "room", "folio", "expense", "shiftReport",
];

function fmtDateTime(iso: string): string {
  return new Intl.DateTimeFormat("en-PK", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(new Date(iso));
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

const inputCls = "h-10 rounded-xl bg-mist border border-line px-3 text-[13.5px] text-ink outline-none focus:border-coral focus:ring-2 focus:ring-coral/15 transition-all";

function ChangesCell({ entry }: { entry: AuditLogEntry }) {
  const [open, setOpen] = useState(false);
  useEscapeKey(() => setOpen(false), open);
  const hasChanges = entry.before != null || entry.after != null;
  if (!hasChanges) return <span className="text-ink-faint">—</span>;
  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-coral hover:text-coral-dark transition-colors"
      >
        View Details <ChevronDown size={13} className={cn("transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="mt-2 rounded-lg border border-line bg-mist p-3">
          {renderReadableChanges(entry.before, entry.after)}
        </div>
      )}
    </div>
  );
}

export default function AuditLogPage() {
  const navigate = useNavigate();
  const today = new Date();
  const weekAgo = new Date(today.getTime() - 6 * 86_400_000);

  const [filters, setFilters] = useState<AuditLogParams>({
    startDate: weekAgo.toISOString().slice(0, 10),
    endDate:   today.toISOString().slice(0, 10),
    page: 1,
    limit: 50,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["audit", filters],
    queryFn: () => auditService.getAuditLogs(filters),
  });

  const logs = data?.data ?? [];
  const users = data?.users ?? [];
  const meta = data?.meta;

  function setFilter<K extends keyof AuditLogParams>(key: K, value: AuditLogParams[K]) {
    setFilters((f) => ({ ...f, [key]: value, page: 1 }));
  }

  function clearFilters() {
    setFilters({
      startDate: weekAgo.toISOString().slice(0, 10),
      endDate:   today.toISOString().slice(0, 10),
      page: 1,
      limit: 50,
    });
  }

  const startIdx = meta ? (meta.page - 1) * meta.limit + 1 : 0;
  const endIdx = meta ? Math.min(meta.page * meta.limit, meta.total) : 0;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate("/settings")}
          className="grid place-items-center h-9 w-9 rounded-full border border-line hover:bg-mist text-ink-mute transition-colors"
        >
          <ChevronLeft size={18} />
        </button>
        <div>
          <div className="mb-0.5 text-[12px] font-bold uppercase tracking-[0.14em] text-coral">Property</div>
          <h1 className="serif text-[28px] leading-none text-ink">Audit Log</h1>
          <p className="mt-1.5 text-[14px] text-ink-mute">Complete record of all actions taken in this system</p>
        </div>
      </div>

      {/* Filters */}
      <Card className="mb-5">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[12px] font-semibold text-ink-mute">Entity</label>
            <select
              value={filters.entity ?? ""}
              onChange={(e) => setFilter("entity", e.target.value || undefined)}
              className={cn(inputCls, "appearance-none pr-8 cursor-pointer")}
            >
              <option value="">All entities</option>
              {ENTITY_OPTIONS.map((e) => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[12px] font-semibold text-ink-mute">Staff member</label>
            <select
              value={filters.userId ?? ""}
              onChange={(e) => setFilter("userId", e.target.value || undefined)}
              className={cn(inputCls, "appearance-none pr-8 cursor-pointer")}
            >
              <option value="">All staff</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[12px] font-semibold text-ink-mute">From</label>
            <input type="date" value={filters.startDate ?? ""} onChange={(e) => setFilter("startDate", e.target.value || undefined)} className={inputCls} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[12px] font-semibold text-ink-mute">To</label>
            <input type="date" value={filters.endDate ?? ""} onChange={(e) => setFilter("endDate", e.target.value || undefined)} className={inputCls} />
          </div>
          <div className="flex flex-col gap-1 flex-1 min-w-[160px]">
            <label className="text-[12px] font-semibold text-ink-mute">Action</label>
            <input
              type="text"
              value={filters.action ?? ""}
              onChange={(e) => setFilter("action", e.target.value || undefined)}
              placeholder="Search action…"
              className={cn(inputCls, "w-full")}
            />
          </div>
          <button
            onClick={clearFilters}
            className="h-10 text-[13px] font-semibold text-ink-mute hover:text-ink transition-colors"
          >
            Clear filters
          </button>
        </div>
      </Card>

      {/* Table */}
      <Card pad={false} className="overflow-hidden">
        <div className="hidden md:grid grid-cols-[1.2fr_1.2fr_1.2fr_1fr_1.6fr] gap-3 px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-ink-faint border-b border-line-soft">
          <span>Time</span><span>Action</span><span>Entity</span><span>Staff</span><span>Changes</span>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-ink-mute text-sm">Loading…</div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center">
            <History size={32} className="mx-auto text-ink-faint mb-3" />
            <p className="text-[14px] font-semibold text-ink-soft">No audit entries found</p>
            <p className="text-[13px] text-ink-mute mt-1">Try adjusting your filters.</p>
          </div>
        ) : (
          logs.map((l) => {
            const cat = actionCategory(l.action);
            const tone = CATEGORY_TONE[cat];
            const rowTint = cat === "delete" ? "bg-clay/5" : cat === "create" ? "bg-pine/5" : "";
            return (
              <div
                key={l.id}
                className={cn(
                  "grid grid-cols-1 md:grid-cols-[1.2fr_1.2fr_1.2fr_1fr_1.6fr] gap-3 px-5 py-3.5 items-start border-b border-line-soft last:border-0",
                  rowTint,
                )}
              >
                <span className="text-[13px] text-ink-soft tnum" title={relativeTime(l.createdAt)}>
                  {fmtDateTime(l.createdAt)}
                </span>
                <span>
                  <span
                    className="inline-flex items-center rounded-full px-2.5 py-1 text-[11.5px] font-semibold"
                    style={{ background: tone.bg, color: tone.fg }}
                  >
                    {actionLabel(l.action)}
                  </span>
                </span>
                <span className="text-[13px] text-ink-soft">
                  <span className="capitalize">{l.entity}</span>
                  {l.entityId && <span className="text-ink-faint tnum"> · {l.entityId.slice(0, 8)}</span>}
                </span>
                <span className="text-[13px] text-ink-soft truncate">{l.user?.name ?? "System"}</span>
                <ChangesCell entry={l} />
              </div>
            );
          })
        )}
      </Card>

      {/* Pagination */}
      {meta && meta.total > 0 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-[13px] text-ink-mute">
            Showing {startIdx}–{endIdx} of {meta.total} entries
          </p>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) - 1 }))}
              disabled={(meta.page ?? 1) <= 1}
              className={cn(
                "grid place-items-center h-9 w-9 rounded-full border border-line text-ink-mute transition-colors",
                (meta.page ?? 1) <= 1 ? "opacity-40 cursor-not-allowed" : "hover:bg-line-soft",
              )}
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) + 1 }))}
              disabled={meta.page >= meta.totalPages}
              className={cn(
                "grid place-items-center h-9 w-9 rounded-full border border-line text-ink-mute transition-colors",
                meta.page >= meta.totalPages ? "opacity-40 cursor-not-allowed" : "hover:bg-line-soft",
              )}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
