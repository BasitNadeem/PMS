import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Wrench, AlertTriangle, Clock, Plus, Flame, EllipsisVertical, Sparkles, CalendarOff,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/cn";
import { BASE_URL } from "@/lib/api";
import {
  maintenanceService,
  type MaintenanceTicket,
  type MaintenanceStatus,
  type MaintenancePriority,
  type MaintenanceCategory,
} from "@/services/maintenance";
import { CreateTicketModal } from "@/components/maintenance/CreateTicketModal";
import { ResolveTicketModal } from "@/components/maintenance/ResolveTicketModal";
import { MaintenanceAvailabilityModal } from "@/components/maintenance/MaintenanceAvailabilityModal";
import { Card } from "@/components/ui/Card";
import { toneOf, type ToneConfig } from "@/components/ui/StatusBadge";
import { usePermissions } from "@/hooks/usePermissions";
import { useEscapeKey } from "@/hooks/useEscapeKey";

// ── Helpers ───────────────────────────────────────────────────────────────────

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

function priorityLabel(p: MaintenancePriority): string {
  return p === "URGENT" ? "Urgent" : p === "HIGH" ? "High" : p === "MEDIUM" ? "Medium" : "Low";
}

// ── Config ────────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<MaintenanceStatus, string> = {
  OPEN:           "Open",
  IN_PROGRESS:    "In Progress",
  AWAITING_PARTS: "Awaiting Parts",
  RESOLVED:       "Resolved",
  CLOSED:         "Closed",
};

const ALLOWED_TRANSITIONS: Record<MaintenanceStatus, MaintenanceStatus[]> = {
  OPEN:           ["IN_PROGRESS", "RESOLVED", "CLOSED"],
  IN_PROGRESS:    ["AWAITING_PARTS", "RESOLVED", "OPEN"],
  AWAITING_PARTS: ["IN_PROGRESS", "RESOLVED"],
  RESOLVED:       ["CLOSED", "IN_PROGRESS"],
  CLOSED:         [],
};

const CATEGORY_LABEL: Record<MaintenanceCategory, string> = {
  ELECTRICAL:  "Electrical",
  PLUMBING:    "Plumbing",
  HVAC:        "HVAC",
  FURNITURE:   "Furniture",
  ELECTRONICS: "Electronics",
  STRUCTURAL:  "Structural",
  OTHER:       "Other",
};

// ── Summary card ──────────────────────────────────────────────────────────────

function SumCard({ icon: Icon, tone, n, label, delay = 0 }: {
  icon: React.ElementType; tone: ToneConfig; n: number; label: string; delay?: number;
}) {
  return (
    <Card className="anim-fade-up !p-4" style={{ animationDelay: delay + "ms" }}>
      <div className="flex items-start justify-between">
        <span className="grid place-items-center h-10 w-10 rounded-xl" style={{ background: tone.bg, color: tone.fg }}>
          <Icon size={20} />
        </span>
      </div>
      <div className="mt-3 serif text-[30px] text-ink leading-none tnum">{n}</div>
      <div className="text-[13px] font-semibold text-ink-mute mt-1">{label}</div>
    </Card>
  );
}

// ── Ticket card ───────────────────────────────────────────────────────────────

function TicketCard({ ticket, onStatusChange, onResolve, onEditAvailability, canUpdate }: {
  ticket: MaintenanceTicket;
  onStatusChange: (id: string, status: MaintenanceStatus) => void;
  onResolve: (ticket: MaintenanceTicket) => void;
  onEditAvailability: (ticket: MaintenanceTicket) => void;
  canUpdate: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  useEscapeKey(() => setMenuOpen(false), menuOpen);
  const statusLabel  = STATUS_LABEL[ticket.status];
  const statusTone   = toneOf(statusLabel);
  const priorityTone = toneOf(priorityLabel(ticket.priority));
  const transitions  = ALLOWED_TRANSITIONS[ticket.status];

  function handleTransition(next: MaintenanceStatus) {
    setMenuOpen(false);
    if (next === "RESOLVED") onResolve(ticket);
    else onStatusChange(ticket.id, next);
  }

  return (
    <div className="rounded-xl2 border border-line bg-card p-3.5 shadow-pop lift hover:shadow-card relative">
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="grid place-items-center h-10 w-12 rounded-lg bg-ink text-white text-[14px] font-bold tnum shrink-0">
            {ticket.room ? ticket.room.number : <Wrench size={16} />}
          </span>
          <div className="min-w-0">
            <div className="text-[14px] font-semibold text-ink leading-tight truncate">{ticket.title}</div>
            <div className="text-[12px] text-ink-mute">{ticket.ticketNumber} · {timeAgo(ticket.createdAt)}</div>
          </div>
        </div>
        {/* Status menu */}
        {canUpdate && (
        <div className="relative shrink-0">
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
                {ticket.room && ticket.status !== "RESOLVED" && ticket.status !== "CLOSED" && (
                  <button onClick={() => { setMenuOpen(false); onEditAvailability(ticket); }} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium text-ink-mute hover:bg-line-soft hover:text-ink">
                    <CalendarOff size={14} /> Room availability
                  </button>
                )}
                {transitions.length === 0 ? (
                  <div className="px-2.5 py-2 text-[12.5px] text-ink-faint italic">No further actions</div>
                ) : (
                  transitions.map((s) => {
                    const t = toneOf(STATUS_LABEL[s]);
                    return (
                      <button
                        key={s}
                        onClick={() => handleTransition(s)}
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] font-medium text-left hover:bg-line-soft"
                      >
                        <span className="h-2 w-2 rounded-full shrink-0" style={{ background: t.dot }} />
                        <span className="text-ink-mute">{STATUS_LABEL[s]}</span>
                      </button>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>
        )}
      </div>

      {/* Tags */}
      <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold bg-mist text-ink-mute border border-line-soft">
          {CATEGORY_LABEL[ticket.category]}
        </span>
        <span
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold"
          style={{ background: statusTone.bg, color: statusTone.fg }}
        >
          {statusLabel}
        </span>
        {ticket.isOverdue && (
          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold bg-clay-soft text-clay">
            <AlertTriangle size={11} /> Overdue
          </span>
        )}
        {ticket.inventoryBlock && !ticket.inventoryBlock.cancelledAt && (
          <span className="inline-flex items-center gap-1 rounded-full bg-coral-soft px-2 py-0.5 text-[11px] font-bold text-coral">
            <CalendarOff size={11} /> Out of sale until {new Date(ticket.inventoryBlock.endDate).toLocaleDateString("en-PK", { day: "numeric", month: "short", timeZone: "UTC" })}
          </span>
        )}
      </div>

      {/* Description */}
      {ticket.description && (
        <p className="mt-2.5 text-[12.5px] text-ink-mute leading-snug bg-mist rounded-lg px-2.5 py-2 border border-line-soft line-clamp-3">
          {ticket.description}
        </p>
      )}

      {/* Photos */}
      {ticket.photoUrls.length > 0 && (
        <div className="mt-2.5 flex gap-1.5 flex-wrap">
          {ticket.photoUrls.slice(0, 5).map((url, i) => (
            <a
              key={i}
              href={`${BASE_URL}${url}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="h-12 w-12 rounded-lg overflow-hidden border border-line-soft block shrink-0"
            >
              <img src={`${BASE_URL}${url}`} alt="" className="h-full w-full object-cover" />
            </a>
          ))}
          {ticket.photoUrls.length > 5 && (
            <div className="h-12 w-12 rounded-lg bg-mist border border-line-soft flex items-center justify-center text-[11px] font-semibold text-ink-mute shrink-0">
              +{ticket.photoUrls.length - 5}
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {ticket.assignedTo ? (
            <>
              <Avatar name={ticket.assignedTo.name} size={26} />
              <span className="text-[12.5px] text-ink-soft">{ticket.assignedTo.name}</span>
            </>
          ) : (
            <span className="text-[12px] text-ink-faint italic">Unassigned</span>
          )}
        </div>
        <span
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold"
          style={{ background: priorityTone.bg, color: priorityTone.fg }}
        >
          {(ticket.priority === "URGENT" || ticket.priority === "HIGH") && <Flame size={11} />}
          {ticket.priority}
        </span>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

type TabStatus = MaintenanceStatus | "ALL";

const TABS: { value: TabStatus; label: string }[] = [
  { value: "ALL",            label: "All" },
  { value: "OPEN",           label: "Open" },
  { value: "IN_PROGRESS",    label: "In Progress" },
  { value: "AWAITING_PARTS", label: "Awaiting Parts" },
  { value: "RESOLVED",       label: "Resolved" },
  { value: "CLOSED",         label: "Closed" },
];

const BOARD_COLUMNS: MaintenanceStatus[] = ["OPEN", "IN_PROGRESS", "AWAITING_PARTS"];

export default function MaintenanceTicketsPage() {
  const qc = useQueryClient();
  const { has } = usePermissions();
  const canCreate = has("maintenance:create");
  const canUpdate = has("maintenance:update");
  const [activeTab, setActiveTab]             = useState<TabStatus>("ALL");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [resolvingTicket, setResolvingTicket] = useState<MaintenanceTicket | null>(null);
  const [availabilityTicket, setAvailabilityTicket] = useState<MaintenanceTicket | null>(null);

  const { data: summaryData } = useQuery({
    queryKey: ["maintenance-summary"],
    queryFn:  maintenanceService.getSummary,
    staleTime: 30_000,
    refetchInterval: 15_000,
  });

  const { data: ticketsData, isLoading } = useQuery({
    queryKey: ["maintenance", "all"],
    queryFn:  () => maintenanceService.getTickets({ limit: 100 }),
    refetchInterval: 15_000,
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: MaintenanceStatus }) =>
      maintenanceService.updateTicketStatus(id, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["maintenance"] });
      qc.invalidateQueries({ queryKey: ["maintenance-summary"] });
    },
  });

  const tickets = ticketsData?.data ?? [];
  const summary = summaryData;

  const tabCounts: Record<TabStatus, number> = {
    ALL:            tickets.length,
    OPEN:           tickets.filter((t) => t.status === "OPEN").length,
    IN_PROGRESS:    tickets.filter((t) => t.status === "IN_PROGRESS").length,
    AWAITING_PARTS: tickets.filter((t) => t.status === "AWAITING_PARTS").length,
    RESOLVED:       tickets.filter((t) => t.status === "RESOLVED").length,
    CLOSED:         tickets.filter((t) => t.status === "CLOSED").length,
  };

  const filteredTickets = activeTab === "ALL" ? tickets : tickets.filter((t) => t.status === activeTab);
  const inProgressCount = tabCounts.IN_PROGRESS;

  function handleStatusChange(id: string, status: MaintenanceStatus) {
    statusMutation.mutate({ id, status });
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <div className="mb-1.5 text-[12px] font-bold uppercase tracking-[0.14em] text-coral">Operations</div>
          <h1 className="serif text-[34px] leading-[1.05] text-ink">Maintenance</h1>
          <p className="mt-1.5 text-[15px] text-ink-mute">
            {summary?.open ?? 0} open tickets · {summary?.urgent ?? 0} urgent
          </p>
        </div>
        {canCreate && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-full bg-coral text-white text-sm font-semibold hover:bg-coral-dark transition-colors shadow-pop whitespace-nowrap"
          >
            <Plus size={17} /> Report Issue
          </button>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <SumCard icon={Wrench}        tone={toneOf("Open")}           n={summary?.open ?? 0} label="Open tickets" delay={0} />
        <SumCard icon={Clock}         tone={toneOf("In Progress")}    n={inProgressCount}    label="In progress"  delay={50} />
        <SumCard icon={Flame}         tone={toneOf("Urgent")}         n={summary?.urgent ?? 0} label="Urgent"     delay={100} />
        <SumCard icon={AlertTriangle} tone={toneOf("Awaiting Parts")} n={summary?.overdue ?? 0} label="Overdue"   delay={150} />
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
      ) : filteredTickets.length === 0 ? (
        <div className="flex flex-col items-center py-16">
          <div className="grid place-items-center h-14 w-14 rounded-2xl bg-line-soft text-ink-faint mb-4">
            <Sparkles size={26} />
          </div>
          <p className="text-base font-semibold text-ink-soft">No maintenance issues here — all clear</p>
        </div>
      ) : activeTab === "ALL" ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {BOARD_COLUMNS.map((col) => {
            const colTone  = toneOf(STATUS_LABEL[col]);
            const colTasks = filteredTickets.filter((t) => t.status === col);
            return (
              <div key={col} className="rounded-xl2 bg-mist/60 border border-line-soft p-3">
                <div className="flex items-center gap-2 px-2 py-1.5 mb-1">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: colTone.dot }} />
                  <span className="text-[14px] font-bold text-ink">{STATUS_LABEL[col]}</span>
                  <span className="grid place-items-center min-w-[22px] h-5 px-1.5 rounded-full bg-line text-[11px] font-bold text-ink-soft tnum">
                    {colTasks.length}
                  </span>
                </div>
                <div className="flex flex-col gap-2.5">
                  {colTasks.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-line py-6 text-center text-[13px] text-ink-faint">
                      Nothing here
                    </div>
                  ) : (
                    colTasks.map((ticket) => (
                      <TicketCard
                        key={ticket.id}
                        ticket={ticket}
                        onStatusChange={handleStatusChange}
                        onResolve={setResolvingTicket}
                        onEditAvailability={setAvailabilityTicket}
                        canUpdate={canUpdate}
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
          {filteredTickets.map((ticket) => (
            <TicketCard
              key={ticket.id}
              ticket={ticket}
              onStatusChange={handleStatusChange}
              onResolve={setResolvingTicket}
              onEditAvailability={setAvailabilityTicket}
              canUpdate={canUpdate}
            />
          ))}
        </div>
      )}

      {showCreateModal && (
        <CreateTicketModal onClose={() => setShowCreateModal(false)} />
      )}

      {resolvingTicket && (
        <ResolveTicketModal ticket={resolvingTicket} onClose={() => setResolvingTicket(null)} />
      )}

      {availabilityTicket && (
        <MaintenanceAvailabilityModal ticket={availabilityTicket} onClose={() => setAvailabilityTicket(null)} />
      )}
    </div>
  );
}
