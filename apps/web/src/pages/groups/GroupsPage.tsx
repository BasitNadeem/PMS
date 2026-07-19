import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Plus, Users, Building2, Landmark, HeartHandshake, Briefcase, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { groupsService, type Group, type GroupStatus, type PayerType } from "@/services/groups";
import { Card } from "@/components/ui/Card";
import { StatusBadge, toneOf, TONE } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { NewGroupModal } from "@/components/groups/NewGroupModal";
import { usePermissions } from "@/hooks/usePermissions";

function formatPkr(paisas: number): string {
  return `PKR ${Math.round(paisas / 100).toLocaleString("en-PK")}`;
}

function fmtDate(iso: string): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-PK", { day: "numeric", month: "short" }).format(new Date(iso + "T00:00:00"));
}

const STATUS_LABEL: Record<GroupStatus, string> = {
  ENQUIRY:     "Pending",
  CONFIRMED:   "Confirmed",
  CHECKED_IN:  "Checked In",
  CHECKED_OUT: "Checked Out",
  CANCELLED:   "Cancelled",
};

type TabKey = "ALL" | GroupStatus;

const TABS: { key: TabKey; label: string }[] = [
  { key: "ALL",         label: "All" },
  { key: "ENQUIRY",     label: "Enquiry" },
  { key: "CONFIRMED",   label: "Confirmed" },
  { key: "CHECKED_IN",  label: "Checked In" },
  { key: "CHECKED_OUT", label: "Checked Out" },
  { key: "CANCELLED",   label: "Cancelled" },
];

const PAYER_TYPE_META: Record<PayerType, { label: string; tone: string; icon: React.ElementType }> = {
  TOUR_AGENCY: { label: "Tour",      tone: "slate", icon: Briefcase },
  CORPORATE:   { label: "Corporate", tone: "dusk",  icon: Building2 },
  GOVERNMENT:  { label: "Govt",      tone: "ink",   icon: Landmark },
  NGO:         { label: "NGO",       tone: "pine",  icon: HeartHandshake },
  INDIVIDUAL:  { label: "Individual / Family", tone: "amber", icon: Users },
};

function PayerTypeBadge({ type }: { type: PayerType }) {
  const meta = PAYER_TYPE_META[type] ?? PAYER_TYPE_META.INDIVIDUAL;
  const tone = TONE[meta.tone] ?? TONE.ink;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold"
      style={{ background: tone.bg, color: tone.fg }}
    >
      <meta.icon size={12} />
      {meta.label}
    </span>
  );
}

interface SummaryCardProps {
  label: string;
  value: number;
  tone: string;
  delay?: number;
}

function SummaryCard({ label, value, tone, delay = 0 }: SummaryCardProps) {
  const t = toneOf(tone);
  return (
    <Card className="anim-fade-up !p-4" hover style={{ animationDelay: delay + "ms" }}>
      <div className="flex items-center justify-between">
        <span className="grid place-items-center h-9 w-9 rounded-xl" style={{ background: t.bg, color: t.fg }}>
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: t.dot }} />
        </span>
      </div>
      <div className="mt-3.5">
        <div className="serif text-[28px] leading-none text-ink tnum">{value}</div>
        <div className="mt-1.5 text-[13px] font-semibold text-ink-soft">{label}</div>
      </div>
    </Card>
  );
}

export default function GroupsPage() {
  const navigate = useNavigate();
  const { has } = usePermissions();
  const canCreate = has("groups:create");
  const [activeTab, setActiveTab] = useState<TabKey>("ALL");
  const [showNew, setShowNew] = useState(false);

  const status = activeTab === "ALL" ? undefined : activeTab;

  const { data, isLoading } = useQuery({
    queryKey: ["groups", { status }],
    queryFn: () => groupsService.getGroups({ status, limit: 50 }),
  });

  const { data: summary } = useQuery({
    queryKey: ["groups-summary"],
    queryFn: groupsService.getSummary,
    staleTime: 30_000,
  });

  const groups = data?.data ?? [];

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <div className="mb-1.5 text-[12px] font-bold uppercase tracking-[0.14em] text-coral">Front Office</div>
          <h1 className="serif text-[34px] leading-[1.05] text-ink">Groups & Corporate</h1>
          <p className="mt-1.5 text-[15px] text-ink-mute">
            {summary ? `${summary.total.toLocaleString()} group${summary.total !== 1 ? "s" : ""}` : "—"}
          </p>
        </div>
        {canCreate && (
          <button
            onClick={() => setShowNew(true)}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-full bg-coral text-white text-sm font-semibold hover:bg-coral-dark transition-colors shadow-pop whitespace-nowrap"
          >
            <Plus size={17} /> New Group Booking
          </button>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <SummaryCard label="Total Groups" value={summary?.total ?? 0} tone="ink" delay={0} />
        <SummaryCard label="Checked In"   value={summary?.CHECKED_IN ?? 0} tone="pine" delay={60} />
        <SummaryCard label="Upcoming"     value={summary?.CONFIRMED ?? 0} tone="slate" delay={120} />
        <SummaryCard label="Pending"      value={summary?.ENQUIRY ?? 0} tone="amber" delay={180} />
      </div>

      {/* Table */}
      <Card pad={false} className="anim-fade-up overflow-hidden">
        {/* Status filter tabs */}
        <div className="flex flex-wrap items-center gap-1.5 p-4 border-b border-line-soft">
          {TABS.map((tab) => {
            const on = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 h-9 text-[13px] font-semibold transition-all",
                  on ? "bg-ink text-white" : "bg-white border border-line text-ink-soft hover:border-coral/30 hover:text-ink",
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Column header */}
        <div className="hidden md:grid grid-cols-[1.2fr_1.6fr_0.9fr_0.8fr_1.2fr_1.2fr_0.9fr_auto] gap-3 px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-ink-faint border-b border-line-soft">
          <span>Ref</span><span>Group Name</span><span>Type</span><span>Rooms</span><span>Dates</span><span>Payer</span><span>Status</span><span />
        </div>

        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-3.5 border-b border-line-soft animate-pulse">
              <div className="flex-1 space-y-1.5">
                <div className="h-3 bg-line-soft rounded w-1/3" />
                <div className="h-2.5 bg-line-soft rounded w-1/4" />
              </div>
              <div className="h-6 bg-line-soft rounded-full w-20 hidden md:block" />
            </div>
          ))
        ) : groups.length === 0 ? (
          <EmptyState icon={Users} title="No group bookings yet" subtitle="Create a group or corporate booking to get started." />
        ) : (
          groups.map((g) => <GroupRow key={g.id} group={g} onOpen={() => navigate(`/groups/${g.id}`)} />)
        )}
      </Card>

      {showNew && (
        <NewGroupModal
          onClose={() => setShowNew(false)}
          onSuccess={(id) => {
            setShowNew(false);
            navigate(`/groups/${id}`);
          }}
        />
      )}
    </div>
  );
}

function GroupRow({ group, onOpen }: { group: Group; onOpen: () => void }) {
  return (
    <div
      onClick={onOpen}
      className="group grid grid-cols-2 md:grid-cols-[1.2fr_1.6fr_0.9fr_0.8fr_1.2fr_1.2fr_0.9fr_auto] gap-3 px-5 py-3.5 items-center hover:bg-mist cursor-pointer transition-colors border-b border-line-soft last:border-0"
    >
      <div className="text-[13px] font-semibold text-ink tnum">{group.groupRef ?? "—"}</div>
      <div className="text-[14.5px] font-bold text-ink truncate col-span-2 md:col-span-1">{group.name}</div>
      <div className="hidden md:block"><PayerTypeBadge type={group.payerType} /></div>
      <div className="hidden md:block text-[13px] text-ink-soft">{group.totalRooms} room{group.totalRooms !== 1 ? "s" : ""}</div>
      <div className="hidden md:block text-[13px] text-ink-soft tnum">
        {fmtDate(group.checkInDate)} <span className="text-ink-faint mx-1">→</span> {fmtDate(group.checkOutDate)}
      </div>
      <div className="hidden md:block text-[13px] font-semibold text-ink truncate">{group.payerName ?? "—"}</div>
      <div><StatusBadge status={STATUS_LABEL[group.status]} size="sm" /></div>
      <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onOpen}
          className="rounded-full h-8 px-3 text-[12px] font-semibold bg-white border border-line text-ink-soft hover:border-coral/30 hover:text-ink transition-all whitespace-nowrap"
        >
          View
        </button>
        <ChevronRight size={18} className="text-ink-faint group-hover:text-ink-mute hidden md:block" />
      </div>
    </div>
  );
}
