import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ClipboardList, Loader, CheckCircle2, Sparkles, Plus, Flame,
  EllipsisVertical, Check, Play, Wrench,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/cn";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import {
  housekeepingService,
  type HousekeepingTask,
  type HousekeepingStatus,
  type HousekeepingTaskType,
  type HousekeepingPriority,
} from "@/services/housekeeping";
import { AssignTaskModal } from "@/components/housekeeping/AssignTaskModal";
import { CreateTicketModal } from "@/components/maintenance/CreateTicketModal";
import { Card } from "@/components/ui/Card";
import { toneOf } from "@/components/ui/StatusBadge";
import { usePermissions } from "@/hooks/usePermissions";

// ── Helpers ───────────────────────────────────────────────────────────────────

const COMPLETED_VISIBLE_MS = 48 * 60 * 60 * 1000;

function isRecentlyCompleted(task: HousekeepingTask): boolean {
  if (task.status !== "COMPLETED") return true;
  if (!task.completedAt) return true;
  return Date.now() - new Date(task.completedAt).getTime() < COMPLETED_VISIBLE_MS;
}

function timeAgo(iso: string): string {
  const diff  = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(mins / 60);
  const days  = Math.floor(hours / 24);
  if (days > 0)  return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (mins > 0)  return `${mins}m ago`;
  return "just now";
}

// ── Config ────────────────────────────────────────────────────────────────────

const TASK_TYPE_LABEL: Record<HousekeepingTaskType, string> = {
  CHECKOUT_CLEAN:    "Checkout",
  ROUTINE_CLEAN:     "Routine",
  TURNDOWN:          "Turndown",
  MAINTENANCE_CLEAN: "Maintenance",
  INSPECTION:        "Inspection",
};

const ALL_STATUSES: { value: HousekeepingStatus; label: string }[] = [
  { value: "PENDING",   label: "Pending" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "COMPLETED", label: "Done" },
];

// ── Summary card ──────────────────────────────────────────────────────────────

function SumCard({ icon: Icon, toneName, n, label, delay = 0 }: {
  icon: React.ElementType; toneName: string; n: number; label: string; delay?: number;
}) {
  const bg = toneName === "amber" ? "#F8EFDA" : toneName === "slate" ? "#E7EEF3" : toneName === "pine" ? "#E6F0EA" : "#F8E7E1";
  const fg = toneName === "amber" ? "#86600F" : toneName === "slate" ? "#2c455c" : toneName === "pine" ? "#1F4D3A" : "#8d3322";
  return (
    <Card className="anim-fade-up !p-4" style={{ animationDelay: delay + "ms" }}>
      <div className="flex items-start justify-between">
        <span className="grid place-items-center h-10 w-10 rounded-xl" style={{ background: bg, color: fg }}>
          <Icon size={20} />
        </span>
      </div>
      <div className="mt-3 serif text-[30px] text-ink leading-none tnum">{n}</div>
      <div className="text-[13px] font-semibold text-ink-mute mt-1">{label}</div>
    </Card>
  );
}

// ── Task card ─────────────────────────────────────────────────────────────────

function TaskCard({ task, onStatusChange, onReportIssue, canUpdate, canReportIssue }: {
  task: HousekeepingTask;
  onStatusChange: (id: string, status: HousekeepingStatus) => void;
  onReportIssue: (roomId: string, roomNumber: string) => void;
  canUpdate: boolean;
  canReportIssue: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  useEscapeKey(() => setMenuOpen(false), menuOpen);
  const typeLabel    = TASK_TYPE_LABEL[task.taskType] ?? task.taskType;
  const priorityTone = toneOf(task.priority === "URGENT" || task.priority === "HIGH" ? "High" : task.priority === "NORMAL" ? "Medium" : "Low");
  const statusLabel  = task.status === "PENDING" ? "Pending" : task.status === "IN_PROGRESS" ? "In Progress" : "Done";
  const statusTone   = toneOf(statusLabel);
  const nextStatus: HousekeepingStatus | null = task.status === "PENDING" ? "IN_PROGRESS" : task.status === "IN_PROGRESS" ? "COMPLETED" : null;

  return (
    <div className="rounded-xl2 border border-line bg-card p-3.5 shadow-pop lift hover:shadow-card relative">
      {/* Header row */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <span className="grid place-items-center h-10 w-12 rounded-lg bg-ink text-white text-[14px] font-bold tnum">
            {task.room.number}
          </span>
          <div>
            <div className="text-[14px] font-semibold text-ink leading-tight">{typeLabel}</div>
            <div className="text-[12px] text-ink-mute">ETA — · {timeAgo(task.createdAt)}</div>
          </div>
        </div>
        {/* Status menu */}
        {(canUpdate || canReportIssue) && (
          <div className="relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="grid place-items-center h-7 w-7 rounded-lg hover:bg-line-soft text-ink-mute transition-colors"
            >
              <EllipsisVertical size={16} />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-8 z-20 w-44 rounded-xl border border-line bg-card shadow-float p-1.5 anim-scale-in">
                  {canUpdate && ALL_STATUSES.map((s) => {
                    const t = toneOf(s.label);
                    return (
                      <button
                        key={s.value}
                        onClick={() => { onStatusChange(task.id, s.value); setMenuOpen(false); }}
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] font-medium text-left hover:bg-line-soft"
                      >
                        <span className="h-2 w-2 rounded-full shrink-0" style={{ background: t.dot }} />
                        <span className={task.status === s.value ? "text-ink font-semibold" : "text-ink-mute"}>{s.label}</span>
                        {task.status === s.value && <Check size={13} className="ml-auto text-coral" />}
                      </button>
                    );
                  })}
                  {canUpdate && canReportIssue && <div className="my-1 border-t border-line-soft" />}
                  {canReportIssue && (
                    <button
                      onClick={() => { onReportIssue(task.roomId, task.room.number); setMenuOpen(false); }}
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] font-medium text-left hover:bg-line-soft text-clay"
                    >
                      <Wrench size={13} className="shrink-0" />
                      Report issue
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Notes */}
      {task.notes && (
        <p className="mt-2.5 text-[12.5px] text-ink-mute leading-snug bg-mist rounded-lg px-2.5 py-2 border border-line-soft">
          {task.notes}
        </p>
      )}

      {/* Footer */}
      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {task.assignedTo ? (
            <>
              <Avatar name={task.assignedTo.name} size={26} />
              <span className="text-[12.5px] text-ink-soft">{task.assignedTo.name}</span>
            </>
          ) : (
            <span className="text-[12px] text-ink-faint italic">Unassigned</span>
          )}
        </div>
        <span
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold"
          style={{ background: priorityTone.bg, color: priorityTone.fg }}
        >
          {(task.priority === "URGENT" || task.priority === "HIGH") && <Flame size={11} />}
          {task.priority}
        </span>
      </div>

      {/* Advance button */}
      {canUpdate && nextStatus && (
        <button
          onClick={() => onStatusChange(task.id, nextStatus)}
          className="mt-3 w-full rounded-lg bg-line-soft hover:bg-coral-soft hover:text-coral-deep text-ink-soft text-[12.5px] font-bold py-2 transition-colors inline-flex items-center justify-center gap-1.5"
        >
          {nextStatus === "IN_PROGRESS" ? <Play size={14} /> : <Check size={14} />}
          {nextStatus === "IN_PROGRESS" ? "Start task" : "Mark done"}
        </button>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

type TabStatus = HousekeepingStatus | "ALL";

const TABS: { value: TabStatus; label: string }[] = [
  { value: "ALL",         label: "All" },
  { value: "PENDING",     label: "Pending" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "COMPLETED",   label: "Done" },
];

export default function HousekeepingPage() {
  const qc = useQueryClient();
  const { has } = usePermissions();
  const canCreate = has("housekeeping:create");
  const canUpdate = has("housekeeping:update");
  const canReportIssue = has("maintenance:create");
  const [activeTab, setActiveTab]       = useState<TabStatus>("ALL");
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [issueRoom, setIssueRoom] = useState<{ id: string; number: string } | null>(null);

  const { data: summaryData } = useQuery({
    queryKey: ["housekeeping-summary"],
    queryFn:  housekeepingService.getSummary,
    staleTime: 30_000,
  });

  const { data: tasksData, isLoading } = useQuery({
    queryKey: ["housekeeping", { status: activeTab === "ALL" ? undefined : activeTab }],
    queryFn: () => housekeepingService.getTasks({ status: activeTab === "ALL" ? undefined : activeTab, limit: 100 }),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: HousekeepingStatus }) =>
      housekeepingService.updateTaskStatus(id, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["housekeeping"] });
      qc.invalidateQueries({ queryKey: ["housekeeping-summary"] });
      qc.invalidateQueries({ queryKey: ["rooms"] });
    },
  });

  const tasks   = (tasksData?.data ?? []).filter(isRecentlyCompleted);
  const summary = summaryData;

  const tabCounts: Record<TabStatus, number> = {
    ALL:         (summary?.pending ?? 0) + (summary?.inProgress ?? 0),
    PENDING:     summary?.pending     ?? 0,
    IN_PROGRESS: summary?.inProgress  ?? 0,
    COMPLETED:   summary?.completedToday ?? 0,
  };

  const highPriority = tasks.filter((t) => (t.priority === "URGENT" || t.priority === "HIGH") && t.status !== "COMPLETED").length;

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <div className="mb-1.5 text-[12px] font-bold uppercase tracking-[0.14em] text-coral">Operations</div>
          <h1 className="serif text-[34px] leading-[1.05] text-ink">Housekeeping</h1>
          <p className="mt-1.5 text-[15px] text-ink-mute">
            {tabCounts.ALL} open tasks · {highPriority} high priority
          </p>
        </div>
        {canCreate && (
          <button
            onClick={() => setShowAssignModal(true)}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-full bg-ink text-white text-sm font-semibold hover:bg-ink-soft transition-colors shadow-pop whitespace-nowrap"
          >
            <Plus size={17} /> Assign task
          </button>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <SumCard icon={ClipboardList} toneName="amber" n={summary?.pending ?? 0}       label="Pending"     delay={0} />
        <SumCard icon={Loader}        toneName="slate" n={summary?.inProgress ?? 0}    label="In progress" delay={50} />
        <SumCard icon={CheckCircle2}  toneName="pine"  n={summary?.completedToday ?? 0} label="Done today"  delay={100} />
        <SumCard icon={Flame}         toneName="clay"  n={highPriority}                 label="High priority" delay={150} />
      </div>

      {/* Status filter */}
      <div className="flex flex-wrap items-center gap-1.5 mb-5">
        {TABS.map((tab) => {
          const on = activeTab === tab.value;
          return (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 h-9 text-[13px] font-semibold transition-all",
                on ? "bg-ink text-white" : "bg-white border border-line text-ink-soft hover:border-coral/30 hover:text-ink",
              )}
            >
              {tab.label}
              <span className={cn("tnum text-[11px]", on ? "text-white/60" : "text-ink-faint")}>
                {tabCounts[tab.value]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Board — 3 columns on large, single list on mobile */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <div key={i} className="h-20 rounded-xl2 bg-line-soft animate-pulse" />)}
        </div>
      ) : tasks.length === 0 ? (
        <div className="flex flex-col items-center py-16">
          <div className="grid place-items-center h-14 w-14 rounded-2xl bg-line-soft text-ink-faint mb-4">
            <Sparkles size={26} />
          </div>
          <p className="text-base font-semibold text-ink-soft">All rooms clean — nothing pending</p>
        </div>
      ) : activeTab === "ALL" ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {(["PENDING", "IN_PROGRESS", "COMPLETED"] as HousekeepingStatus[]).map((col) => {
            const colLabel = col === "PENDING" ? "Pending" : col === "IN_PROGRESS" ? "In Progress" : "Done";
            const colTone = toneOf(col === "PENDING" ? "Pending" : col === "IN_PROGRESS" ? "In Progress" : "Done");
            const colTasks = tasks.filter((t) => t.status === col);
            return (
              <div key={col} className="rounded-xl2 bg-mist/60 border border-line-soft p-3">
                <div className="flex items-center gap-2 px-2 py-1.5 mb-1">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: colTone.dot }} />
                  <span className="text-[14px] font-bold text-ink">{colLabel}</span>
                  <span className="grid place-items-center min-w-[22px] h-5 px-1.5 rounded-full bg-line text-[11px] font-bold text-ink-soft tnum">
                    {colTasks.length}
                  </span>
                  {col === "COMPLETED" && (
                    <span className="text-[11px] text-ink-faint">last 48h</span>
                  )}
                </div>
                <div className="flex flex-col gap-2.5">
                  {colTasks.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-line py-6 text-center text-[13px] text-ink-faint">
                      Nothing here
                    </div>
                  ) : (
                    colTasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        onStatusChange={(id, status) => statusMutation.mutate({ id, status })}
                        onReportIssue={(roomId, roomNumber) => setIssueRoom({ id: roomId, number: roomNumber })}
                        canUpdate={canUpdate}
                        canReportIssue={canReportIssue}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onStatusChange={(id, status) => statusMutation.mutate({ id, status })}
              onReportIssue={(roomId, roomNumber) => setIssueRoom({ id: roomId, number: roomNumber })}
              canUpdate={canUpdate}
              canReportIssue={canReportIssue}
            />
          ))}
        </div>
      )}

      {showAssignModal && (
        <AssignTaskModal onClose={() => setShowAssignModal(false)} />
      )}

      {issueRoom && (
        <CreateTicketModal
          onClose={() => setIssueRoom(null)}
          initialRoomId={issueRoom.id}
          initialRoomNumber={issueRoom.number}
        />
      )}
    </div>
  );
}
