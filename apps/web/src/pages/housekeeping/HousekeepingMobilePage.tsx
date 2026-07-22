import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Menu, X, Bell, ChevronDown, RefreshCw, CloudOff, LogOut,
  Wrench, Check, ArrowRight, Sparkles,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { applyTheme } from "@/lib/theme";
import { decodeToken, getCurrentUserName, formatRoleLabel, getInitials } from "@/lib/jwt";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import {
  housekeepingService,
  type HousekeepingTask,
  type HousekeepingStatus,
  type HousekeepingPriority,
} from "@/services/housekeeping";
import { maintenanceService } from "@/services/maintenance";
import { notificationsService } from "@/services/notifications";
import { api } from "@/lib/api";

// ── localStorage keys ─────────────────────────────────────────────────────────

const QUEUE_KEY = "hk_offline_queue";
const CACHE_KEY = "hk_tasks_cache";

interface QueuedUpdate {
  taskId: string;
  newStatus: HousekeepingStatus;
  timestamp: number;
}

function readQueue(): QueuedUpdate[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function writeQueue(queue: QueuedUpdate[]): void {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

function readCache(): HousekeepingTask[] {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function writeCache(tasks: HousekeepingTask[]): void {
  localStorage.setItem(CACHE_KEY, JSON.stringify(tasks));
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function todayLabel(): string {
  return new Date().toLocaleDateString("en-PK", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const diff  = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(mins / 60);
  if (hours > 0) return `${hours}h ago`;
  if (mins > 0)  return `${mins}m ago`;
  return "just now";
}

const TASK_TYPE_LABEL: Record<string, string> = {
  CHECKOUT_CLEAN:    "Checkout Clean",
  ROUTINE_CLEAN:     "Routine Clean",
  TURNDOWN:          "Turndown",
  MAINTENANCE_CLEAN: "Post-Maintenance Clean",
  INSPECTION:        "Inspection",
};

const PRIORITY_TONE: Record<HousekeepingPriority, { border: string; bg: string; fg: string; label: string }> = {
  URGENT: { border: "#BB4A33", bg: "#F8E7E1", fg: "#8d3322", label: "URGENT" },
  HIGH:   { border: "#B7791A", bg: "#F8EFDA", fg: "#86600F", label: "HIGH" },
  NORMAL: { border: "#3D5A73", bg: "#E7EEF3", fg: "#2c455c", label: "NORMAL" },
  LOW:    { border: "#938C81", bg: "#F1ECE4", fg: "#4A453E", label: "LOW" },
};

type FilterKey = "active" | "all" | HousekeepingStatus;

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "active",      label: "Active" },
  { key: "all",         label: "All" },
  { key: "PENDING",     label: "Pending" },
  { key: "IN_PROGRESS", label: "In Progress" },
  { key: "COMPLETED",   label: "Done" },
];

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// ── Toast ─────────────────────────────────────────────────────────────────────

function useToast() {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function show(msg: string) {
    setMessage(msg);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(null), 2600);
  }

  return { message, show };
}

// ── Maintenance report form (inline expand) ──────────────────────────────────

function ReportIssueForm({ roomId, onDone, onCancel }: {
  roomId: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!title.trim()) return;
    setSubmitting(true);
    try {
      await maintenanceService.createTicket({
        roomId,
        title: title.trim(),
        description: description.trim() || undefined,
        category: "OTHER",
        priority: "MEDIUM",
      });
      onDone();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-3 rounded-xl border border-line bg-mist p-3 space-y-2">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="What's wrong? (e.g. AC not cooling)"
        className="w-full h-11 rounded-lg border border-line bg-white px-3 text-[14px] focus:outline-none focus:border-coral"
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Details (optional)"
        rows={2}
        className="w-full rounded-lg border border-line bg-white px-3 py-2 text-[14px] focus:outline-none focus:border-coral resize-none"
      />
      <div className="flex gap-2">
        <button
          onClick={onCancel}
          className="flex-1 h-10 rounded-lg border border-line text-[13.5px] font-semibold text-ink-mute"
        >
          Cancel
        </button>
        <button
          onClick={submit}
          disabled={!title.trim() || submitting}
          className="flex-1 h-10 rounded-lg bg-coral text-white text-[13.5px] font-semibold hover:bg-coral-dark transition-colors disabled:opacity-50"
        >
          {submitting ? "Sending…" : "Submit"}
        </button>
      </div>
    </div>
  );
}

// ── Task card ─────────────────────────────────────────────────────────────────

function TaskCard({
  task, expanded, onToggleExpand, onAdvance, busy,
}: {
  task: HousekeepingTask;
  expanded: boolean;
  onToggleExpand: () => void;
  onAdvance: (task: HousekeepingTask) => void;
  busy: boolean;
}) {
  const [reporting, setReporting] = useState(false);
  const tone = PRIORITY_TONE[task.priority];

  const actionConfig: Record<HousekeepingStatus, { label: string; bg: string; fg: string; disabled?: boolean; icon: React.ElementType }> = {
    PENDING:     { label: "Start Cleaning",     bg: "rgb(var(--color-accent))", fg: "#fff", icon: ArrowRight },
    IN_PROGRESS: { label: "Mark as Complete",   bg: "#2F7256",                  fg: "#fff", icon: Check },
    COMPLETED:   { label: "Completed",          bg: "#E7E3DA",                  fg: "#938C81", disabled: true, icon: Check },
  };
  const action = actionConfig[task.status];

  return (
    <div
      className="rounded-2xl bg-white border border-line shadow-card overflow-hidden"
      style={{ borderLeft: `4px solid ${tone.border}` }}
    >
      <button onClick={onToggleExpand} className="w-full text-left p-4 min-h-[80px]">
        <div className="flex items-center justify-between gap-2">
          <span
            className="text-[11px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full"
            style={{ background: tone.bg, color: tone.fg }}
          >
            {tone.label}
          </span>
          <span className="text-[15px] font-bold text-ink">Room {task.room.number}</span>
          <ChevronDown
            size={18}
            className={cn("text-ink-faint transition-transform shrink-0", expanded && "rotate-180")}
          />
        </div>
        <div className="mt-1.5 text-[14px] font-semibold text-ink-soft">
          {TASK_TYPE_LABEL[task.taskType] ?? task.taskType}
        </div>
        <div className="text-[12.5px] text-ink-mute mt-0.5">
          {task.status === "COMPLETED" && task.completedAt
            ? `Completed ${timeAgo(task.completedAt)}`
            : task.status === "IN_PROGRESS" && task.startedAt
            ? `Started ${timeAgo(task.startedAt)}`
            : `Scheduled for ${new Date(task.scheduledDate).toLocaleDateString("en-PK", { day: "numeric", month: "short" })}`}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-3 -mt-1 border-t border-line-soft pt-3 text-[13.5px] text-ink-soft space-y-1.5">
          {task.room.roomType && <div>Room type: <span className="font-semibold">{task.room.roomType.name}</span></div>}
          {task.room.floor != null && <div>Floor: <span className="font-semibold">{task.room.floor}</span></div>}
          {task.assignedTo && <div>Assigned to: <span className="font-semibold">{task.assignedTo.name}</span></div>}
          {task.notes && (
            <div className="rounded-lg bg-mist px-3 py-2 text-ink-soft">📝 {task.notes}</div>
          )}

          {!reporting ? (
            <button
              onClick={(e) => { e.stopPropagation(); setReporting(true); }}
              className="flex items-center gap-1.5 text-coral font-semibold pt-1"
            >
              <Wrench size={14} /> Report Maintenance Issue →
            </button>
          ) : (
            <ReportIssueForm
              roomId={task.roomId}
              onCancel={() => setReporting(false)}
              onDone={() => setReporting(false)}
            />
          )}
        </div>
      )}

      <div className="px-4 pb-4">
        <button
          onClick={(e) => { e.stopPropagation(); if (!action.disabled) onAdvance(task); }}
          disabled={action.disabled || busy}
          className="w-full h-12 rounded-xl font-bold text-[14.5px] flex items-center justify-center gap-2 disabled:opacity-70 transition-opacity"
          style={{ background: action.bg, color: action.fg }}
        >
          {busy ? "Updating…" : action.label}
          {!action.disabled && !busy && <action.icon size={16} />}
        </button>
      </div>
    </div>
  );
}

// ── Slide-out menu ────────────────────────────────────────────────────────────

function SlideOutMenu({
  open, onClose, viewMode, onChangeView, canViewAll, onSignOut,
}: {
  open: boolean;
  onClose: () => void;
  viewMode: "mine" | "all";
  onChangeView: (v: "mine" | "all") => void;
  canViewAll: boolean;
  onSignOut: () => void;
}) {
  const { permission, subscribed, subscribe, unsubscribe } = usePushNotifications();
  const userName = getCurrentUserName();
  const userRole = formatRoleLabel(decodeToken()?.role ?? null);

  useEscapeKey(onClose, open);

  async function togglePush() {
    if (subscribed) await unsubscribe();
    else await subscribe();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      <div className="absolute inset-0 bg-ink/30 backdrop-blur-sm anim-fade-in" />
      <div
        className="absolute left-0 top-0 h-full w-[280px] bg-white anim-slide-in flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-line">
          <div className="flex items-center gap-3">
            <div
              className="grid place-items-center rounded-full font-bold text-[13px] shrink-0"
              style={{ width: 40, height: 40, background: "rgb(var(--color-accent-soft))", color: "rgb(var(--color-accent-deep))" }}
            >
              {getInitials(userName) || "?"}
            </div>
            <div className="min-w-0">
              <div className="text-[14.5px] font-bold text-ink truncate">{userName ?? "Staff"}</div>
              <div className="text-[12px] text-ink-mute">{userRole}</div>
            </div>
          </div>
        </div>

        <div className="p-3 flex flex-col gap-1">
          <button
            onClick={() => { onChangeView("mine"); onClose(); }}
            className={cn(
              "text-left px-3 py-2.5 rounded-xl text-[14px] font-semibold",
              viewMode === "mine" ? "bg-ink text-white" : "text-ink-soft",
            )}
          >
            My Tasks
          </button>
          {canViewAll && (
            <button
              onClick={() => { onChangeView("all"); onClose(); }}
              className={cn(
                "text-left px-3 py-2.5 rounded-xl text-[14px] font-semibold",
                viewMode === "all" ? "bg-ink text-white" : "text-ink-soft",
              )}
            >
              All Tasks
            </button>
          )}
        </div>

        <div className="border-t border-line p-3">
          <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-ink-faint">
            Notification settings
          </div>
          <div className="flex items-center justify-between px-3 py-2">
            <div>
              <div className="text-[14px] font-semibold text-ink">Push Notifications</div>
              <div className="text-[12px] text-ink-mute">
                {permission === "denied" ? "Blocked in browser" : subscribed ? "On" : "Off"}
              </div>
            </div>
            <button
              onClick={togglePush}
              disabled={permission === "denied"}
              className={cn(
                "w-12 h-7 rounded-full transition-colors relative shrink-0 disabled:opacity-40",
                subscribed ? "bg-coral" : "bg-line",
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow-card transition-transform",
                  subscribed && "translate-x-5",
                )}
              />
            </button>
          </div>
        </div>

        <div className="mt-auto border-t border-line p-3">
          <button
            onClick={onSignOut}
            className="w-full flex items-center gap-2.5 px-3 py-3 rounded-xl text-[14px] font-semibold text-[#8d3322]"
          >
            <LogOut size={17} /> Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function HousekeepingMobilePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  useRealtimeSync();

  const payload = decodeToken();
  const userId = payload?.userId ?? null;
  const role = payload?.role ?? null;
  const canViewAll = role === "MANAGER" || role === "OWNER";

  const [menuOpen, setMenuOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"mine" | "all">("mine");
  const [filter, setFilter] = useState<FilterKey>("active");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [refreshing, setRefreshing] = useState(false);

  useEscapeKey(() => setMenuOpen(false), menuOpen);

  useEffect(() => { applyTheme(undefined); }, []);

  useEffect(() => {
    api.get<{ data: { settings?: { themeKey?: string } } }>("/api/hotels/me")
      .then((r) => applyTheme(r.data.data?.settings?.themeKey))
      .catch(() => { /* fall back to default theme */ });
  }, []);

  // ── Online/offline detection + queue sync ──────────────────────────────────

  useEffect(() => {
    function goOnline() { setIsOnline(true); }
    function goOffline() { setIsOnline(false); }
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  useEffect(() => {
    function handler(e: Event) {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    }
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  useEffect(() => {
    if (!isOnline) return;
    const queue = readQueue();
    if (queue.length === 0) return;

    (async () => {
      let synced = 0;
      const remaining: QueuedUpdate[] = [];
      for (const item of queue) {
        try {
          await housekeepingService.updateTaskStatus(item.taskId, { status: item.newStatus });
          synced += 1;
        } catch {
          remaining.push(item);
        }
      }
      writeQueue(remaining);
      if (synced > 0) {
        toast.show(`Synced ${synced} update${synced > 1 ? "s" : ""}`);
        qc.invalidateQueries({ queryKey: ["housekeeping-mobile"] });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline]);

  // ── Tasks query — stale-while-revalidate via localStorage cache ───────────
  // Always fetches every task for the hotel — housekeeping tasks are mostly
  // unassigned in practice, so filtering by assignedToId at the API level
  // left "My Tasks" permanently empty. The mine/all toggle below is purely
  // a client-side view over the same full list.

  const queryKey = ["housekeeping-mobile"];
  const { data: tasksResult, isLoading, refetch } = useQuery({
    queryKey,
    queryFn: () => housekeepingService.getTasks({ limit: 100 }),
    initialData: () => {
      const cached = readCache();
      return cached.length > 0 ? { data: cached, meta: { total: cached.length, page: 1, limit: 100, totalPages: 1 } } : undefined;
    },
    refetchInterval: 60_000,
  });

  const allTasks = tasksResult?.data ?? [];
  const tasks = viewMode === "mine"
    ? allTasks.filter((t) => t.assignedToId === userId || t.assignedToId === null)
    : allTasks;

  useEffect(() => {
    if (tasksResult?.data && tasksResult.data.length > 0) writeCache(tasksResult.data);
  }, [tasksResult]);

  const { data: unreadCount } = useQuery({
    queryKey: ["notifications-count"],
    queryFn: notificationsService.getUnreadCount,
    refetchInterval: 60_000,
  });

  const counts = useMemo(() => ({
    active:      tasks.filter((t) => t.status === "PENDING" || t.status === "IN_PROGRESS").length,
    all:         tasks.length,
    PENDING:     tasks.filter((t) => t.status === "PENDING").length,
    IN_PROGRESS: tasks.filter((t) => t.status === "IN_PROGRESS").length,
    COMPLETED:   tasks.filter((t) => t.status === "COMPLETED").length,
  }), [tasks]);

  const filtered = filter === "all"
    ? tasks
    : filter === "active"
    ? tasks.filter((t) => t.status === "PENDING" || t.status === "IN_PROGRESS")
    : tasks.filter((t) => t.status === filter);

  const NEXT_STATUS: Record<HousekeepingStatus, HousekeepingStatus> = {
    PENDING:     "IN_PROGRESS",
    IN_PROGRESS: "COMPLETED",
    COMPLETED:   "PENDING",
  };

  async function advance(task: HousekeepingTask) {
    const newStatus = NEXT_STATUS[task.status];
    setBusyId(task.id);

    // Optimistic update
    qc.setQueryData(queryKey, (prev: typeof tasksResult) => {
      if (!prev) return prev;
      return { ...prev, data: prev.data.map((t) => (t.id === task.id ? { ...t, status: newStatus } : t)) };
    });

    if (!navigator.onLine) {
      const queue = readQueue();
      queue.push({ taskId: task.id, newStatus, timestamp: Date.now() });
      writeQueue(queue);
      toast.show("Saved offline");
      setBusyId(null);
      return;
    }

    try {
      await housekeepingService.updateTaskStatus(task.id, { status: newStatus });
      toast.show(
        newStatus === "COMPLETED"
          ? `Room ${task.room.number} marked complete ✓`
          : `Room ${task.room.number} updated`,
      );
      qc.invalidateQueries({ queryKey: ["housekeeping-mobile"] });
    } catch {
      // Revert optimistic update on failure
      qc.setQueryData(queryKey, (prev: typeof tasksResult) => {
        if (!prev) return prev;
        return { ...prev, data: prev.data.map((t) => (t.id === task.id ? { ...t, status: task.status } : t)) };
      });
      toast.show("Couldn't update — try again");
    } finally {
      setBusyId(null);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }

  function signOut() {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("userName");
    navigate("/login");
  }

  // ── Pull-to-refresh (touch tracking) ────────────────────────────────────────

  const touchStartY = useRef<number | null>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  function onTouchStart(e: React.TouchEvent) {
    if (scrollRef.current && scrollRef.current.scrollTop <= 0) {
      touchStartY.current = e.touches[0].clientY;
    }
  }
  function onTouchMove(e: React.TouchEvent) {
    if (touchStartY.current === null) return;
    const delta = e.touches[0].clientY - touchStartY.current;
    if (delta > 0) setPullDistance(Math.min(delta, 120));
  }
  async function onTouchEnd() {
    if (pullDistance > 80) await handleRefresh();
    setPullDistance(0);
    touchStartY.current = null;
  }

  const firstName = getCurrentUserName()?.split(" ")[0] ?? "there";
  const pendingCount = counts.PENDING + counts.IN_PROGRESS;

  return (
    <div className="fixed inset-0 flex flex-col bg-paper" style={{ fontFamily: "inherit" }}>
      {/* Top bar */}
      <div className="h-14 shrink-0 flex items-center justify-between px-3 bg-white border-b border-line">
        <button onClick={() => setMenuOpen(true)} className="grid place-items-center h-10 w-10 rounded-lg text-ink-soft active:bg-line-soft">
          <Menu size={22} />
        </button>
        <span className="text-[16px] font-bold text-ink">Housekeeping</span>
        <button onClick={() => navigate("/notifications")} className="relative grid place-items-center h-10 w-10 rounded-lg text-ink-soft active:bg-line-soft">
          <Bell size={20} />
          {!!unreadCount?.count && (
            <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-coral text-white text-[10px] font-bold grid place-items-center">
              {unreadCount.count > 9 ? "9+" : unreadCount.count}
            </span>
          )}
        </button>
      </div>

      {/* Offline banner */}
      {!isOnline && (
        <div className="shrink-0 bg-amber-soft border-b border-amber/20 px-4 py-2 flex items-center gap-2 text-[12.5px] text-ink-soft">
          <CloudOff size={15} className="text-amber shrink-0" />
          Offline — showing cached tasks. Updates will sync when reconnected.
        </div>
      )}

      {/* Install banner (Android Chrome only — fires beforeinstallprompt) */}
      {installPrompt && (
        <div className="shrink-0 flex items-center justify-between gap-3 px-4 py-2.5 border-b border-line bg-white">
          <div className="text-[13px] text-ink-soft leading-snug">
            <span className="font-semibold text-ink">Add to Home Screen</span> for quick access — works offline too.
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setInstallPrompt(null)}
              className="text-[12px] text-ink-faint px-2 py-1"
            >
              Later
            </button>
            <button
              onClick={async () => {
                await installPrompt.prompt();
                const { outcome } = await installPrompt.userChoice;
                if (outcome === "accepted") setInstallPrompt(null);
              }}
              className="h-8 px-3 rounded-lg bg-coral text-white text-[12.5px] font-semibold hover:bg-coral-dark transition-colors"
            >
              Install
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto scroll-area"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{ transform: pullDistance ? `translateY(${pullDistance * 0.4}px)` : undefined }}
      >
        {(pullDistance > 0 || refreshing) && (
          <div className="flex justify-center py-2">
            <RefreshCw size={18} className={cn("text-ink-faint", refreshing && "animate-spin")} />
          </div>
        )}

        <div className="p-4 space-y-4 pb-10">
          {/* Greeting card */}
          <div className="rounded-2xl p-4 text-white" style={{ background: "rgb(var(--color-accent))" }}>
            <div className="text-[17px] font-bold">{greeting()}, {firstName} 👋</div>
            <div className="text-[13.5px] opacity-90 mt-0.5">
              {tasks.length} task{tasks.length === 1 ? "" : "s"} today · {pendingCount} pending
            </div>
            <div className="text-[12px] opacity-75 mt-1.5">{todayLabel()}</div>
          </div>

          {/* Filter tabs */}
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1" style={{ scrollbarWidth: "none" }}>
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={cn(
                  "shrink-0 px-3.5 h-9 rounded-full text-[13px] font-semibold border whitespace-nowrap transition-colors",
                  filter === f.key
                    ? "bg-ink text-white border-ink"
                    : "bg-white text-ink-mute border-line",
                )}
              >
                {f.label} ({counts[f.key]})
              </button>
            ))}
          </div>

          {/* Task list */}
          {isLoading && tasks.length === 0 ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-28 rounded-2xl bg-line-soft animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-14">
              <div className="text-[34px]">{filter === "PENDING" || filter === "active" ? "✅" : "🎉"}</div>
              <div className="mt-2 text-[14.5px] font-semibold text-ink-soft">
                {filter === "active" ? "All caught up! No active tasks." : filter === "PENDING" ? "No pending tasks." : "Great work today!"}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  expanded={expandedId === task.id}
                  onToggleExpand={() => setExpandedId((id) => (id === task.id ? null : task.id))}
                  onAdvance={advance}
                  busy={busyId === task.id}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Toast */}
      {toast.message && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 bg-ink text-white text-[13.5px] font-semibold px-4 py-2.5 rounded-full shadow-float anim-fade-in flex items-center gap-2">
          <Sparkles size={14} className="text-coral" />
          {toast.message}
        </div>
      )}

      <SlideOutMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        viewMode={viewMode}
        onChangeView={setViewMode}
        canViewAll={canViewAll}
        onSignOut={signOut}
      />
    </div>
  );
}
