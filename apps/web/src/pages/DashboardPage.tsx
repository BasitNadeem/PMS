import React, { useRef, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  PlaneLanding, PlaneTakeoff, Banknote, Wallet, Sparkles,
  Calendar, Sun, ArrowRight, LogIn, Plus, Check, X,
  ClipboardList, Package, AlertTriangle, Star,
  Crown, Waves, Moon, BedDouble, Eye, CheckCircle2,
} from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceDot, ResponsiveContainer } from "recharts";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Avatar } from "@/components/ui/Avatar";
import { Trend } from "@/components/ui/Trend";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import {
  dashboardService,
  type DashboardRecentReservation,
  type DashboardDeparturesToCollect,
  type DashboardScheduleEvent,
  type RevenueTrendRange,
} from "@/services/dashboard";
import { notesService, type FrontDeskNote } from "@/services/notes";
import { shiftsService } from "@/services/shifts";
import { roomsService, type Room } from "@/services/rooms";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { getCurrentUserName } from "@/lib/jwt";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatPKR(paisas: number): string {
  const rupees = Math.floor(paisas / 100);
  if (rupees >= 100_000) return `PKR ${(rupees / 1000).toFixed(0)}k`;
  return `PKR ${rupees.toLocaleString("en-PK")}`;
}

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

const STATUS_LABEL: Record<string, string> = {
  ENQUIRY: "Pending", CONFIRMED: "Confirmed", CHECKED_IN: "Checked In",
  CHECKED_OUT: "Checked Out", CANCELLED: "Cancelled",
};

// Day-over-day comparison badges for the KPI row — real deltas, not decorative.
function countDelta(today: number, yesterday: number): { dir: "up" | "down"; value: string } | undefined {
  const diff = today - yesterday;
  if (diff === 0) return undefined;
  return { dir: diff > 0 ? "up" : "down", value: `${diff > 0 ? "+" : ""}${diff}` };
}

function pctDelta(today: number, yesterday: number): { dir: "up" | "down"; value: string } | undefined {
  if (yesterday === 0) return today > 0 ? { dir: "up", value: "New" } : undefined;
  const pct = Math.round(((today - yesterday) / yesterday) * 100);
  if (pct === 0) return undefined;
  return { dir: pct > 0 ? "up" : "down", value: `${pct > 0 ? "+" : ""}${pct}%` };
}

// ── Revenue trend chart — real series from the backend, range-selectable ───────

const REVENUE_RANGE_OPTIONS: { value: RevenueTrendRange; label: string }[] = [
  { value: "14d", label: "14 days" },
  { value: "30d", label: "30 days" },
  { value: "6m",  label: "6 mo" },
];

const REVENUE_RANGE_COPY: Record<RevenueTrendRange, string> = {
  "14d": "Last 14 days",
  "30d": "Last 30 days",
  "6m":  "Last 6 months",
};

function RevenueTrendChart() {
  const [range, setRange] = useState<RevenueTrendRange>("14d");

  const { data: trend = [] } = useQuery({
    queryKey: ["dashboard-revenue-trend", range],
    queryFn: () => dashboardService.getRevenueTrend(range),
    staleTime: 60_000,
  });

  const data = trend.map((p) => ({
    date: p.date,
    label: new Date(p.date + "T00:00:00").toLocaleDateString("en-PK", { day: "numeric", month: "short" }),
    amount: Math.round(p.amount / 100), // paisas → whole rupees for axis/tooltip readability
  }));

  const peakIdx = data.length
    ? data.reduce((best, d, i) => (d.amount > data[best].amount ? i : best), 0)
    : -1;

  // Thin out X-axis labels so they stay legible instead of overlapping.
  const tickInterval = range === "14d" ? 1 : range === "30d" ? 4 : 3;

  return (
    <div className="px-5 pt-5">
      <div className="flex items-center justify-between mb-1">
        <div>
          <h3 className="serif text-[20px] text-ink">Revenue trend</h3>
          <p className="text-[12.5px] text-ink-mute">{REVENUE_RANGE_COPY[range]} · PKR</p>
        </div>
        <div className="inline-flex items-center gap-0.5 rounded-full bg-line-soft p-1">
          {REVENUE_RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setRange(opt.value)}
              className={cn(
                "rounded-full px-3 py-1.5 text-[12.5px] font-semibold transition-colors",
                range === opt.value ? "bg-white text-ink shadow-sm" : "text-ink-mute hover:text-ink-soft",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {data.every((d) => d.amount === 0) ? (
        <div className="h-[160px] grid place-items-center text-[13px] text-ink-faint">
          No revenue posted in this period
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={230}>
          <AreaChart data={data} margin={{ top: 28, right: 20, left: 20, bottom: 4 }}>
            <defs>
              <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgb(var(--color-accent))" stopOpacity={0.3} />
                <stop offset="100%" stopColor="rgb(var(--color-accent))" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#EAE4DB" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              interval={tickInterval}
              tickMargin={10}
              tick={{ fontSize: 11, fontWeight: 600, fill: "#B8B1A6" }}
            />
            <YAxis hide domain={[0, (max: number) => Math.max(max * 1.15, 1)]} />
            <Tooltip
              formatter={(value) => [`PKR ${Number(value ?? 0).toLocaleString("en-PK")}`, "Revenue"]}
              labelFormatter={(label) => label}
              contentStyle={{ borderRadius: 12, border: "1px solid #EAE4DB", fontSize: 12.5 }}
            />
            <Area
              type="monotone"
              dataKey="amount"
              stroke="rgb(var(--color-accent))"
              strokeWidth={2.25}
              fill="url(#revenueFill)"
            />
            {peakIdx >= 0 && (
              <ReferenceDot
                x={data[peakIdx].label}
                y={data[peakIdx].amount}
                r={5.5}
                fill="#fff"
                stroke="rgb(var(--color-accent))"
                strokeWidth={2.5}
                label={{
                  value: `PKR ${data[peakIdx].amount.toLocaleString("en-PK")} peak`,
                  position: "top",
                  fontSize: 11,
                  fontWeight: 700,
                  fill: "rgb(var(--color-ink))",
                }}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

// ── Front Desk Notes panel ────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff  = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(mins / 60);
  if (hours > 0) return `${hours}h ago`;
  if (mins  > 0) return `${mins}m ago`;
  return "just now";
}

function hoursUntilExpiry(completedAt: string): string {
  const expiresAt = new Date(completedAt).getTime() + 24 * 60 * 60 * 1000;
  const remaining = Math.ceil((expiresAt - Date.now()) / 3_600_000);
  if (remaining <= 0) return "expiring";
  return `auto-removes in ${remaining}h`;
}

function FrontDeskNotes() {
  const qc = useQueryClient();
  const [showInput, setShowInput] = useState(false);
  const [inputText, setInputText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: notes = [] } = useQuery({
    queryKey: ["front-desk-notes"],
    queryFn:  notesService.getNotes,
    refetchInterval: 15_000,
  });

  const [noteError, setNoteError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: notesService.createNote,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["front-desk-notes"] });
      setInputText("");
      setShowInput(false);
      setNoteError(null);
    },
    onError: () => setNoteError("Failed to save note. Please try again."),
  });

  const toggleMutation = useMutation({
    mutationFn: notesService.toggleNote,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["front-desk-notes"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: notesService.deleteNote,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["front-desk-notes"] }),
  });

  useEffect(() => {
    if (showInput) inputRef.current?.focus();
  }, [showInput]);

  function openInput() { setShowInput(true); setInputText(""); setNoteError(null); }
  function cancelInput() { setShowInput(false); setInputText(""); setNoteError(null); }

  function submitNote() {
    const text = inputText.trim();
    if (!text) return;
    createMutation.mutate(text);
  }

  const activeNotes    = notes.filter((n) => !n.isCompleted);
  const completedNotes = notes.filter((n) =>  n.isCompleted);

  return (
    <Card className="anim-fade-up h-full flex flex-col min-h-0" style={{ animationDelay: "180ms" }} pad={false}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <div>
          <h3 className="serif text-[20px] text-ink">Front Desk Notes</h3>
          <p className="text-[12px] text-ink-mute">Shared team scratchpad</p>
        </div>
        <button
          onClick={openInput}
          className="grid place-items-center h-8 w-8 rounded-full bg-ink text-white hover:bg-ink/80 transition-colors shadow-pop"
        >
          <Plus size={16} />
        </button>
      </div>

      {/* Inline input */}
      {showInput && (
        <div className="px-5 pb-3 space-y-1.5">
          {noteError && (
            <p className="text-[12px] text-clay font-medium px-1">{noteError}</p>
          )}
          <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter")  submitNote();
              if (e.key === "Escape") cancelInput();
            }}
            placeholder="Add a note…"
            className="flex-1 h-9 rounded-xl border border-line bg-mist px-3 text-[13.5px] text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-coral/20 focus:border-coral/40 transition-colors"
          />
          <button
            onClick={submitNote}
            disabled={!inputText.trim() || createMutation.isPending}
            className="grid place-items-center h-8 w-8 rounded-full bg-coral text-white disabled:opacity-40 hover:bg-coral-dark transition-colors"
          >
            <Check size={14} />
          </button>
          <button
            onClick={cancelInput}
            className="grid place-items-center h-8 w-8 rounded-full text-ink-mute hover:bg-mist transition-colors"
          >
            <X size={14} />
          </button>
        </div>
        </div>
      )}

      {/* Notes list */}
      <div className="flex-1 min-h-0 overflow-y-auto scroll-area">
        {activeNotes.length === 0 && completedNotes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2 text-ink-faint">
            <ClipboardList size={28} className="text-line" />
            <p className="text-[13px] font-semibold text-ink-mute">No notes yet</p>
            <p className="text-[12px] text-ink-faint">Press + to add one</p>
          </div>
        ) : (
          <div className="px-4 pb-4">
            {/* Active notes */}
            {activeNotes.map((note) => (
              <NoteRow
                key={note.id}
                note={note}
                onToggle={() => toggleMutation.mutate(note.id)}
                onDelete={() => deleteMutation.mutate(note.id)}
              />
            ))}

            {/* Completed divider */}
            {completedNotes.length > 0 && (
              <>
                <div className="flex items-center gap-2 py-2">
                  <div className="flex-1 h-px bg-line-soft" />
                  <span className="text-[11px] font-semibold text-ink-faint uppercase tracking-wider">completed</span>
                  <div className="flex-1 h-px bg-line-soft" />
                </div>
                {completedNotes.map((note) => (
                  <NoteRow
                    key={note.id}
                    note={note}
                    onToggle={() => toggleMutation.mutate(note.id)}
                    onDelete={() => deleteMutation.mutate(note.id)}
                    completed
                  />
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

function NoteRow({ note, onToggle, onDelete, completed = false }: {
  note: FrontDeskNote;
  onToggle: () => void;
  onDelete: () => void;
  completed?: boolean;
}) {
  return (
    <div className="group flex items-start gap-3 rounded-xl px-2 py-2 hover:bg-mist transition-colors">
      {/* Checkbox */}
      <button
        onClick={onToggle}
        className={cn(
          "shrink-0 mt-0.5 h-5 w-5 rounded border-2 flex items-center justify-center transition-colors",
          completed
            ? "bg-coral border-coral"
            : "border-line hover:border-coral/50",
        )}
      >
        {completed && <Check size={11} strokeWidth={3} className="text-white" />}
      </button>

      {/* Text + meta */}
      <div className="flex-1 min-w-0">
        <p className={cn(
          "text-[13.5px] leading-snug",
          completed ? "text-ink-faint line-through" : "text-ink",
        )}>
          {note.text}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[11px] text-ink-faint">{timeAgo(note.createdAt)}</span>
          {completed && note.completedAt && (
            <span className="text-[11px] text-ink-faint">{hoursUntilExpiry(note.completedAt)}</span>
          )}
        </div>
      </div>

      {/* Delete (hover only) */}
      <button
        onClick={onDelete}
        className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-ink-faint hover:text-clay mt-0.5"
      >
        <X size={14} />
      </button>
    </div>
  );
}

// ── KPI tile — accent-rail style ────────────────────────────────────────────────

interface KPICardProps {
  icon: React.ElementType;
  toneName: string;
  label: string;
  value: string | number;
  sub?: string;
  trend?: { dir: "up" | "down"; value: string };
  delay?: number;
}

const KPI_RAIL: Record<string, { rail: string; bg: string; fg: string }> = {
  pine:  { rail: "#2F7256", bg: "#E6F0EA", fg: "#1F4D3A" },
  amber: { rail: "#B7791A", bg: "#F8EFDA", fg: "#86600F" },
  coral: { rail: "rgb(var(--color-accent))", bg: "rgb(var(--color-accent-soft))", fg: "rgb(var(--color-accent-deep))" },
  slate: { rail: "#3D5A73", bg: "#E7EEF3", fg: "#2c455c" },
};

function KPICard({ icon: Icon, toneName, label, value, sub, trend, delay = 0 }: KPICardProps) {
  const t = KPI_RAIL[toneName] ?? KPI_RAIL.slate;
  return (
    <Card
      className="anim-fade-up relative overflow-hidden pl-5"
      style={{ animationDelay: delay + "ms" }}
      hover
    >
      <span className="absolute left-0 top-0 bottom-0 w-1.5" style={{ background: t.rail }} />
      <div className="flex items-start justify-between">
        <span className="grid place-items-center h-9 w-9 rounded-xl" style={{ background: t.bg, color: t.fg }}>
          <Icon size={18} />
        </span>
        {trend && <Trend dir={trend.dir} value={trend.value} />}
      </div>
      <div className="mt-3">
        <div className="serif text-[30px] leading-none text-ink tnum">{value}</div>
        <div className="mt-1 text-[13px] font-semibold text-ink-soft">{label}</div>
        {sub && <div className="text-[12px] text-ink-mute">{sub}</div>}
      </div>
    </Card>
  );
}

// ── Money to collect — today's departures with an outstanding folio balance ────

function MoneyToCollectTile({ data }: { data: DashboardDeparturesToCollect | undefined }) {
  const navigate = useNavigate();
  const items = data?.items ?? [];

  return (
    <Card className="anim-fade-up h-full flex flex-col min-h-0" style={{ animationDelay: "180ms" }} pad={false}>
      <div className="flex items-start justify-between px-5 pt-5">
        <div>
          <h3 className="serif text-[20px] text-ink">Money to collect</h3>
          <p className="text-[12.5px] text-ink-mute">{items.length} departing folio{items.length === 1 ? "" : "s"} today</p>
        </div>
        <span className="grid place-items-center h-10 w-10 rounded-xl bg-coral-soft text-coral-deep">
          <Banknote size={19} />
        </span>
      </div>

      <div className="mx-5 mt-3 mb-3 rounded-2xl px-4 py-3 bg-mist border border-line-soft">
        <div className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">Outstanding at checkout</div>
        <div className="serif text-[30px] leading-none text-ink tnum mt-1">{formatPKR(data?.total ?? 0)}</div>
      </div>

      {items.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 px-5 pb-5 text-ink-faint">
          <Check size={28} className="text-line" strokeWidth={1.5} />
          <p className="text-[13px] font-semibold text-ink-mute">All settled</p>
          <p className="text-[12px] text-ink-faint text-center">No departing folios with a balance today</p>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto scroll-area px-5 pb-4 flex flex-col divide-y divide-line-soft">
          {items.map((c) => (
            <button
              key={c.id}
              onClick={() => navigate(`/financials/folio/${c.id}`)}
              className="flex items-center gap-3 py-2.5 text-left hover:bg-mist -mx-2 px-2 rounded-lg transition-colors"
            >
              <div className="min-w-0 flex-1">
                <div className="text-[13.5px] font-semibold text-ink truncate">{c.guestName}</div>
                <div className="text-[11.5px] text-ink-mute">Room {c.roomNumber ?? "—"}</div>
              </div>
              <div className="text-[14px] font-bold text-ink tnum shrink-0">{formatPKR(c.balanceDue)}</div>
            </button>
          ))}
        </div>
      )}
    </Card>
  );
}

// ── Live schedule — today's timeline ─────────────────────────────────────────

function scheduleIcon(e: DashboardScheduleEvent): React.ElementType {
  if (e.type === "checkin")  return e.isVip ? Crown : PlaneLanding;
  if (e.type === "checkout") return PlaneTakeoff;
  // housekeeping — map taskType to icon
  const t = e.taskType ?? "";
  if (t === "TURNDOWN")      return Moon;
  if (t === "DEEP_CLEAN")    return Waves;
  if (t === "CHECKOUT_CLEAN") return BedDouble;
  if (t === "INSPECTION")    return Eye;
  return Sparkles;
}

function timeToPct(hhmm: string, startHour: number, endHour: number): number {
  const [h, m] = hhmm.split(":").map(Number);
  const minutes = h * 60 + m;
  const startMin = startHour * 60;
  const endMin = endHour * 60;
  return Math.min(100, Math.max(0, ((minutes - startMin) / (endMin - startMin)) * 100));
}

function LiveScheduleHero({
  events, arrivalsToday, departuresToday, inHouse,
}: {
  events: DashboardScheduleEvent[];
  arrivalsToday: number;
  departuresToday: number;
  inHouse: number;
}) {
  const now = new Date();
  const nowHour = now.getHours() + now.getMinutes() / 60;

  // Compute window from actual event times + NOW so nothing is ever clipped.
  const eventHours = events.map((e) => {
    const [h, m] = e.time.split(":").map(Number);
    return h + m / 60;
  });
  const allHours = [...eventHours, nowHour];
  const START_HOUR = Math.max(0,  Math.floor(Math.min(...allHours)) - 1);
  const END_HOUR   = Math.min(24, Math.ceil(Math.max(...allHours))  + 1);

  const nowPct = timeToPct(`${now.getHours()}:${now.getMinutes()}`, START_HOUR, END_HOUR);

  // Summary counts derived from events
  const doneCount    = events.filter((e) => e.isDone).length;
  const pendingCount = events.length - doneCount;

  return (
    <div
      className="rounded-3xl p-6 relative overflow-hidden text-white anim-fade-up"
      style={{ background: "linear-gradient(135deg, rgb(var(--color-accent-deep)), rgb(var(--color-accent)))" }}
    >
      <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10" />

      {/* Header */}
      <div className="relative flex flex-wrap items-start justify-between gap-4 mb-8">
        <div>
          <div className="text-[12px] font-bold uppercase tracking-[0.14em] text-white/70">Live schedule</div>
          <h3 className="serif text-[26px] leading-none mt-1">Today&apos;s timeline</h3>
        </div>
        <div className="flex items-center gap-5">
          {([[arrivalsToday, "arrivals"], [departuresToday, "departures"], [inHouse, "in-house"]] as [number, string][]).map(([n, l]) => (
            <div key={l} className="text-center">
              <div className="serif text-[26px] leading-none tnum">{n}</div>
              <div className="text-[11px] text-white/65 font-semibold uppercase tracking-wide">{l}</div>
            </div>
          ))}
          {events.length > 0 && (
            <div className="text-center border-l border-white/20 pl-5">
              <div className="flex items-center gap-2">
                <div className="text-center">
                  <div className="serif text-[26px] leading-none tnum">{doneCount}</div>
                  <div className="text-[11px] text-white/65 font-semibold uppercase tracking-wide">done</div>
                </div>
                <div className="text-center">
                  <div className="serif text-[26px] leading-none tnum">{pendingCount}</div>
                  <div className="text-[11px] text-white/65 font-semibold uppercase tracking-wide">pending</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {events.length === 0 ? (
        <p className="relative text-[13px] text-white/70 py-4">No timed events yet today.</p>
      ) : (
        <div className="relative h-20 mx-1">
          {/* Track */}
          <div className="absolute left-0 right-0 top-7 h-[3px] rounded-full bg-white/15" />
          {/* Progress to NOW */}
          <div className="absolute top-7 h-[3px] rounded-full bg-white/60" style={{ left: 0, width: `${nowPct}%` }} />
          {/* NOW marker */}
          <div className="absolute" style={{ left: `${nowPct}%`, top: 0, bottom: 24 }}>
            <div className="h-full w-0.5 bg-white" />
            <span className="absolute -top-1 left-1.5 text-[10px] font-bold text-white/90 whitespace-nowrap">NOW</span>
          </div>

          {events.map((e) => {
            const Icon = scheduleIcon(e);
            const pos  = timeToPct(e.time, START_HOUR, END_HOUR);
            const done = e.isDone;
            const tooltipParts = [e.label, e.sublabel, e.time, e.isVip ? "VIP" : "", e.balanceDue ? `Balance: PKR ${(e.balanceDue / 100).toLocaleString()}` : ""].filter(Boolean);

            return (
              <div
                key={e.id}
                className="absolute -translate-x-1/2"
                style={{ left: `${pos}%`, top: 8 }}
                title={tooltipParts.join(" · ")}
              >
                {/* Icon bubble */}
                <div className={cn(
                  "relative grid place-items-center h-9 w-9 rounded-full border-2 shadow transition-all",
                  done
                    ? "border-white/40 bg-white/20"
                    : e.isVip
                      ? "border-amber-300 bg-white"
                      : e.type === "housekeeping"
                        ? "border-white/70 bg-white/90"
                        : "border-white/90 bg-white",
                )} style={{ color: done ? "rgba(255,255,255,0.6)" : "rgb(var(--color-accent-deep))" }}>
                  <Icon size={15} />
                  {/* Done checkmark overlay */}
                  {done && (
                    <span className="absolute -bottom-1 -right-1 grid place-items-center h-4 w-4 rounded-full bg-white/90 border border-white/40">
                      <CheckCircle2 size={10} className="text-green-600" />
                    </span>
                  )}
                  {/* Issue dot */}
                  {e.hasIssue && !done && (
                    <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-red-400 border border-white" />
                  )}
                </div>

                {/* Labels below bubble */}
                <div className="absolute top-11 left-1/2 -translate-x-1/2 text-center whitespace-nowrap space-y-0.5">
                  <div className={cn("text-[10.5px] font-bold tnum", done ? "text-white/50" : "text-white")}>{e.time}</div>
                  <div className={cn("text-[10px] leading-tight max-w-[70px] truncate", done ? "text-white/35" : "text-white/70")}>{e.label}</div>
                  <div className={cn("text-[9.5px]", done ? "text-white/30" : "text-white/55")}>{e.sublabel}</div>
                  {/* Balance badge on departures */}
                  {e.type === "checkout" && (e.balanceDue ?? 0) > 0 && (
                    <div className="inline-flex items-center gap-0.5 rounded-full bg-amber-400/90 px-1.5 py-0.5 text-[8.5px] font-bold text-amber-900">
                      <AlertTriangle size={7} />
                      Due
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Arrivals/departures panel ─────────────────────────────────────────────────

function ArrivalsPanel({ reservations }: { reservations: DashboardRecentReservation[] }) {
  const navigate = useNavigate();
  const [tab, setTab] = React.useState<"arrivals" | "inhouse">("arrivals");

  const today = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; })();
  const arrivals = reservations.filter(
    (r) => r.checkInDate?.slice(0, 10) === today && r.status !== "CANCELLED",
  );
  const inHouse = reservations.filter((r) => r.status === "CHECKED_IN");
  const rawList = tab === "arrivals" ? arrivals : inHouse;

  // Arrivals collapses each group into one row (checking in a whole group is one front-desk
  // action). In-house does NOT collapse — staff need to see every room/guest currently staying,
  // and the tab's count badge always reflects individual reservations, not groups.
  const collapseGroups = tab === "arrivals";
  const groupRoomCounts: Record<string, number> = {};
  rawList.forEach((r) => {
    if (r.groupId) groupRoomCounts[r.groupId] = (groupRoomCounts[r.groupId] ?? 0) + 1;
  });
  const list = collapseGroups
    ? rawList.filter((r, _, arr) => !r.groupId || arr.findIndex((x) => x.groupId === r.groupId) === arr.indexOf(r))
    : rawList;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 pb-4">
        <h3 className="serif text-[20px] text-ink">Front desk today</h3>
        <div className="inline-flex items-center gap-0.5 rounded-full bg-line-soft p-1">
          {(["arrivals", "inhouse"] as const).map((v) => {
            const labels = { arrivals: `Arrivals ${arrivals.length}`, inhouse: `In-house ${inHouse.length}` };
            const on = tab === v;
            return (
              <button
                key={v}
                onClick={() => setTab(v)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 h-8 text-[13px] font-semibold transition-all ${on ? "bg-card text-ink shadow-pop" : "text-ink-mute hover:text-ink-soft"}`}
              >
                {labels[v]}
              </button>
            );
          })}
        </div>
      </div>
      <div className="px-2 pb-3">
        {list.length === 0 ? (
          <div className="px-3 py-10 text-center text-sm text-ink-mute">Nothing scheduled.</div>
        ) : (
          list.slice(0, 6).map((r) => {
            const isGroup = !!r.groupId;
            const showAsGroup = isGroup && collapseGroups;
            const roomCount = showAsGroup ? (groupRoomCounts[r.groupId!] ?? 1) : 0;
            const statusLabel = STATUS_LABEL[r.status] ?? r.status;
            const guestName = r.guestName;
            return (
              <div
                key={showAsGroup ? r.groupId : r.id}
                onClick={() => showAsGroup ? navigate(`/groups/${r.groupId}`) : navigate(`/reservations/${r.id}`)}
                className="group flex items-center gap-3.5 rounded-xl px-3 py-3 hover:bg-line-soft cursor-pointer transition-colors"
              >
                <Avatar name={guestName} size={42} />
                <div className="min-w-0 flex-1 leading-tight">
                  <div className="flex items-center gap-2">
                    <span className="text-[14.5px] font-semibold text-ink truncate">{guestName}</span>
                    {r.isVip && (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-soft px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-amber">
                        <Star size={10} className="fill-amber" /> VIP
                      </span>
                    )}
                    {!showAsGroup && (
                      <span className="text-[12px] text-ink-faint tnum">{r.confirmationNumber}</span>
                    )}
                    {isGroup && (
                      <span className="rounded-full bg-dusk-soft px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-dusk">
                        GROUP
                      </span>
                    )}
                  </div>
                  <div className="text-[12.5px] text-ink-mute">
                    {showAsGroup ? `${roomCount} room${roomCount !== 1 ? "s" : ""}` : r.roomNumber ? `Room ${r.roomNumber}` : "—"}
                  </div>
                </div>
                <div className="hidden sm:flex flex-col items-end gap-1">
                  <StatusBadge status={statusLabel} size="sm" />
                </div>
                {!showAsGroup && r.status === "CONFIRMED" ? (
                  <div className="ml-1 flex items-center gap-1 rounded-full bg-pine-soft text-pine-deep px-2.5 h-8 text-[13px] font-semibold">
                    <LogIn size={14} /> Check in
                  </div>
                ) : (
                  <ArrowRight size={18} className="text-ink-faint group-hover:text-ink-mute ml-1" />
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ── Arrivals Readiness ────────────────────────────────────────────────────────

function ArrivalsReadiness({ scheduleEvents }: { scheduleEvents: DashboardScheduleEvent[] }) {
  const { data: roomsData } = useQuery({
    queryKey: ["rooms"],
    queryFn: () => roomsService.getRooms(),
    staleTime: 30_000,
  });

  const roomsByNumber = React.useMemo(() => {
    const map = new Map<string, Room>();
    for (const r of roomsData?.data ?? []) map.set(r.number, r);
    return map;
  }, [roomsData]);

  // Today's pending/confirmed arrivals only (not already checked-in)
  const arrivals = scheduleEvents.filter((e) => e.type === "checkin" && !e.isDone);
  if (arrivals.length === 0) return null;

  const readyCount = arrivals.filter((e) => {
    const roomNum = e.sublabel.replace(/^Room /, "");
    return roomsByNumber.get(roomNum)?.status === "VACANT_CLEAN";
  }).length;

  const pct = arrivals.length > 0 ? (readyCount / arrivals.length) * 100 : 0;
  const allReady = readyCount === arrivals.length;

  return (
    <Card pad={false} className="anim-fade-up" style={{ animationDelay: "280ms" }}>
      <div className="px-5 pt-5 pb-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="serif text-[20px] text-ink leading-tight">Arrivals readiness</h3>
          <span className={cn(
            "shrink-0 text-[13px] font-bold tabular-nums",
            allReady ? "text-pine-deep" : "text-amber",
          )}>
            {readyCount}/{arrivals.length} ready
          </span>
        </div>
        <p className="text-[12.5px] text-ink-mute mb-4">
          Are rooms clean before guests reach the desk?
        </p>

        {/* Progress bar */}
        <div className="h-2 rounded-full bg-line-soft overflow-hidden mb-5">
          <div
            className={cn("h-full rounded-full transition-all duration-500", allReady ? "bg-pine" : "bg-amber")}
            style={{ width: `${pct}%` }}
          />
        </div>

        {/* Guest rows */}
        <div className="space-y-2">
          {arrivals.map((e) => {
            const roomNum    = e.sublabel.replace(/^Room /, "");
            const roomStatus = roomsByNumber.get(roomNum)?.status;
            const isReady    = roomStatus === "VACANT_CLEAN";
            const isLoading  = !roomsData;

            return (
              <div key={e.id} className="flex items-center gap-3">
                {/* Room pill */}
                <div className="grid place-items-center h-9 w-14 rounded-xl bg-ink text-white text-[13px] font-bold shrink-0 tnum">
                  {roomNum !== "—" ? roomNum : "—"}
                </div>

                {/* Guest name + VIP */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-[14px] font-semibold text-ink truncate">{e.label}</span>
                    {e.isVip && <Crown size={13} className="text-amber shrink-0" />}
                  </div>
                </div>

                {/* Expected time */}
                <span className="text-[12.5px] text-ink-faint tnum shrink-0">{e.time}</span>

                {/* Ready / In prep badge */}
                {isLoading ? (
                  <div className="h-6 w-16 rounded-full bg-line-soft animate-pulse" />
                ) : roomNum === "—" ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-line-soft px-2.5 py-1 text-[11.5px] font-semibold text-ink-mute">
                    No room
                  </span>
                ) : isReady ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-pine-soft px-2.5 py-1 text-[11.5px] font-semibold text-pine-deep">
                    <span className="h-1.5 w-1.5 rounded-full bg-pine-deep" />
                    Ready
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-soft px-2.5 py-1 text-[11.5px] font-semibold text-amber">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber" />
                    In prep
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const navigate = useNavigate();

  const { data: dash, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: dashboardService.getDashboard,
    // SSE (useRealtimeDashboard) pushes instant invalidation on real changes —
    // this interval is just a fallback in case the connection drops.
    refetchInterval: 15_000,
  });

  const { data: hotel } = useQuery<{ id: string; name: string; city?: string }>({
    queryKey: ["hotel"],
    queryFn: () => api.get("/api/hotels/me").then((r) => r.data.data),
    staleTime: 5 * 60 * 1000,
  });

  const { data: shiftDiscrepancyCount = 0 } = useQuery({
    queryKey: ["shift-discrepancy-count"],
    queryFn:  shiftsService.getDiscrepancyCount,
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="space-y-5">
        <div className="h-24 rounded-xl2 bg-line-soft animate-pulse" />
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-36 rounded-xl2 bg-line-soft animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const occ = dash?.occupancy;
  const today = dash?.today;
  const revenue = dash?.revenue;
  const hk = dash?.housekeeping;
  const mnt = dash?.maintenance;
  const inv = dash?.inventory;
  const recent = dash?.recentReservations ?? [];

  const totalRooms = occ?.totalRooms ?? 1;
  const collectCount = dash?.departuresToCollect?.items.length ?? 0;
  const hkCounts = [
    { label: "Pending",     count: hk?.pendingTasks ?? 0 },
    { label: "In Progress", count: hk?.inProgressTasks ?? 0 },
    { label: "Checkout",    count: hk?.checkoutCleansPending ?? 0 },
  ];
  const mntCounts = [
    { label: "Open",    count: mnt?.open ?? 0 },
    { label: "Urgent",  count: mnt?.urgent ?? 0 },
    { label: "Overdue", count: mnt?.overdue ?? 0 },
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-7">
        <div>
          <div className="flex items-center gap-2.5 text-[13px] font-semibold text-ink-mute mb-2">
            <span className="inline-flex items-center gap-1.5">
              <Calendar size={15} className="text-coral" />
              {todayLabel()}
            </span>
            <span className="h-1 w-1 rounded-full bg-ink-faint" />
            <span className="inline-flex items-center gap-1.5">
              <Sun size={15} className="text-amber" />
              {hotel?.city ?? "—"}
            </span>
          </div>
          <h1 className="serif text-[38px] leading-[1.02] text-ink">
            {greeting()}, {getCurrentUserName()?.split(" ")[0] ?? "there"}.
          </h1>
          <p className="mt-1.5 text-[15px] text-ink-mute">
            Here&apos;s how {hotel?.name ?? "the property"} is moving today.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <NotificationBell />
          <button
            onClick={() => navigate("/reservations?view=calendar")}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-full bg-white ring-1 ring-ink/20 text-ink text-sm font-semibold hover:bg-gray-50 hover:ring-ink/40 transition-colors shadow-sm"
          >
            <Calendar size={16} />
            Calendar
          </button>
          <button
            onClick={() => navigate("/reservations?new=1")}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-full bg-coral text-white text-sm font-semibold hover:bg-coral-dark transition-colors shadow-pop"
          >
            <Plus size={16} />
            New reservation
          </button>
        </div>
      </div>

      {/* Shift discrepancy alert — shows when ≥1 cash variance in last 3 days */}
      {shiftDiscrepancyCount > 0 && (
        <button
          type="button"
          onClick={() => navigate("/reports/shifts")}
          className="w-full flex items-center gap-3 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-left hover:bg-red-100 transition-colors"
        >
          <AlertTriangle size={16} className="text-red-600 shrink-0" />
          <p className="flex-1 text-[13px] font-semibold text-red-900">
            {shiftDiscrepancyCount} shift cash {shiftDiscrepancyCount === 1 ? "discrepancy" : "discrepancies"} in the last 3 days — review in Shift Reports
          </p>
        </button>
      )}

      {/* Inventory alert banner — only when alerts exist */}
      {inv && (inv.lowStockCount > 0 || inv.outOfStockCount > 0) && (
        <div
          role="button"
          tabIndex={0}
          onClick={() => navigate("/inventory")}
          onKeyDown={(e) => e.key === "Enter" && navigate("/inventory")}
          className="flex items-center gap-4 rounded-2xl bg-amber/10 border border-amber/25 px-5 py-3.5 mb-5 hover:bg-amber/20 transition-colors cursor-pointer"
        >
          <span className="grid place-items-center h-9 w-9 rounded-xl bg-amber/15 text-amber shrink-0">
            <Package size={18} />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-[13.5px] font-bold text-amber-800">Inventory Alerts</p>
            <div className="flex items-center gap-3 mt-0.5 text-[12.5px] text-amber-700">
              {inv.lowStockCount > 0 && (
                <span className="flex items-center gap-1">
                  <AlertTriangle size={12} />
                  {inv.lowStockCount} low on stock
                </span>
              )}
              {inv.outOfStockCount > 0 && (
                <span className="flex items-center gap-1 text-red-600">
                  <AlertTriangle size={12} />
                  {inv.outOfStockCount} out of stock
                </span>
              )}
            </div>
          </div>
          <span className="text-[13px] font-semibold text-amber shrink-0">View →</span>
        </div>
      )}

      {/* Live schedule */}
      <div className="mb-5">
        <LiveScheduleHero
          events={dash?.schedule ?? []}
          arrivalsToday={today?.arrivalsToday ?? 0}
          departuresToday={today?.departuresToday ?? 0}
          inHouse={dash?.reservations?.checkedInCount ?? 0}
        />
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
        <KPICard
          icon={PlaneLanding} toneName="coral"
          label="Arrivals today"
          value={today?.arrivalsToday ?? 0}
          sub="Expected check-ins"
          trend={countDelta(today?.arrivalsToday ?? 0, today?.arrivalsYesterday ?? 0)}
          delay={0}
        />
        <KPICard
          icon={PlaneTakeoff} toneName="amber"
          label="Departures today"
          value={today?.departuresToday ?? 0}
          sub="Folios to settle"
          trend={countDelta(today?.departuresToday ?? 0, today?.departuresYesterday ?? 0)}
          delay={60}
        />
        <KPICard
          icon={Wallet} toneName="slate"
          label="To collect"
          value={formatPKR(dash?.departuresToCollect?.total ?? 0)}
          sub="At checkout today"
          trend={collectCount > 0 ? { dir: "up", value: `${collectCount} folio${collectCount === 1 ? "" : "s"}` } : undefined}
          delay={120}
        />
        <KPICard
          icon={Banknote} toneName="pine"
          label="Revenue today"
          value={formatPKR((revenue?.revenueToday ?? 0))}
          sub="Across all folios"
          trend={pctDelta(revenue?.revenueToday ?? 0, revenue?.revenueYesterday ?? 0)}
          delay={180}
        />
      </div>

      {/* Revenue + money to collect + front desk notes — fixed shared height,
          Revenue sets the reference; the other two scroll internally instead
          of growing the row when their lists get long. */}
      <div className="flex flex-col xl:flex-row gap-5 xl:h-[440px]">
        <Card className="xl:w-[42%] anim-fade-up flex flex-col min-h-0" style={{ animationDelay: "120ms" }} pad={false}>
          <div className="flex-1 min-h-0 flex flex-col">
            <RevenueTrendChart />
          </div>

          {/* Footer stats */}
          <div className="grid grid-cols-2 border-t border-line-soft divide-x divide-line-soft">
            {[
              ["Avg daily rate", formatPKR((revenue?.revenueToday ?? 0) / Math.max(occ?.occupiedRooms ?? 1, 1))],
              ["RevPAR",         formatPKR((revenue?.revenueToday ?? 0) / Math.max(totalRooms, 1))],
            ].map(([k, v]) => (
              <div key={k} className="px-5 py-4">
                <div className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">{k}</div>
                <div className="serif text-[19px] text-ink mt-0.5 tnum">{v}</div>
              </div>
            ))}
          </div>
        </Card>

        <div className="xl:w-[29%] min-h-0">
          <MoneyToCollectTile data={dash?.departuresToCollect} />
        </div>
        <div className="xl:w-[29%] min-h-0">
          <FrontDeskNotes />
        </div>
      </div>

      {/* Front desk arrivals + housekeeping */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 mt-5">
        <Card className="xl:col-span-2 anim-fade-up" style={{ animationDelay: "240ms" }} pad={false}>
          <ArrivalsPanel reservations={recent} />
        </Card>

        <div className="flex flex-col gap-5">
          <ArrivalsReadiness scheduleEvents={dash?.schedule ?? []} />

          <Card className="anim-fade-up" style={{ animationDelay: "300ms" }} pad={false}>
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <h3 className="serif text-[20px] text-ink">Housekeeping</h3>
              <button
                onClick={() => navigate("/housekeeping")}
                className="text-[13px] font-semibold text-coral hover:text-coral-dark inline-flex items-center gap-1"
              >
                All tasks <ArrowRight size={14} />
              </button>
            </div>
            <div className="px-5 grid grid-cols-3 gap-2.5 mb-3">
              {hkCounts.map(({ label, count }) => (
                <div key={label} className="rounded-xl border border-line-soft bg-mist px-3 py-2.5">
                  <div className="serif text-[24px] text-ink tnum">{count}</div>
                  <div className="text-[11px] font-semibold text-ink-mute">{label}</div>
                </div>
              ))}
            </div>
            <div className="px-5 pb-4">
              <p className="text-[13px] text-ink-mute">
                {(hk?.pendingTasks ?? 0) + (hk?.inProgressTasks ?? 0)} tasks open today
              </p>
            </div>
          </Card>

          {/* Maintenance — only shown when there's something open, not a permanent fixture */}
          {(mnt?.open ?? 0) > 0 && (
            <Card className="anim-fade-up" style={{ animationDelay: "340ms" }} pad={false}>
              <div className="flex items-center justify-between px-5 pt-5 pb-3">
                <h3 className="serif text-[20px] text-ink">Maintenance</h3>
                <button
                  onClick={() => navigate("/maintenance")}
                  className="text-[13px] font-semibold text-coral hover:text-coral-dark inline-flex items-center gap-1"
                >
                  All tickets <ArrowRight size={14} />
                </button>
              </div>
              <div className="px-5 grid grid-cols-3 gap-2.5 mb-3">
                {mntCounts.map(({ label, count }) => (
                  <div key={label} className="rounded-xl border border-line-soft bg-mist px-3 py-2.5">
                    <div className="serif text-[24px] text-ink tnum">{count}</div>
                    <div className="text-[11px] font-semibold text-ink-mute">{label}</div>
                  </div>
                ))}
              </div>
              <div className="px-5 pb-4">
                <p className="text-[13px] text-ink-mute">
                  {mnt?.open ?? 0} open ticket{(mnt?.open ?? 0) === 1 ? "" : "s"}
                  {(mnt?.urgent ?? 0) > 0 ? ` · ${mnt?.urgent} urgent` : ""}
                </p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

