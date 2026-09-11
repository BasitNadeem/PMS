import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowUpRight,
  BedDouble,
  CalendarDays,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  ClipboardCheck,
  Clock3,
  ExternalLink,
  FileText,
  Package,
  Receipt,
  ShieldCheck,
  Users,
  Wrench,
  XCircle,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/Card";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { attendanceService } from "@/services/attendance";
import { dashboardService } from "@/services/dashboard";
import { expensesService } from "@/services/expenses";
import { leaveService } from "@/services/leaves";
import { notesService, type FrontDeskNote } from "@/services/notes";
import { usersService, type StaffUser } from "@/services/users";

interface HotelSummary {
  name: string;
  city: string | null;
}

interface AttentionItem {
  label: string;
  detail: string;
  href: string;
  icon: typeof AlertTriangle;
  tone: "coral" | "amber" | "pine";
}

function todayInPakistan(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi" }).format(new Date());
}

function dateLabel(value: string): string {
  return new Intl.DateTimeFormat("en-PK", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Asia/Karachi",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function shortDateLabel(value: string): string {
  return new Intl.DateTimeFormat("en-PK", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function dateAfter(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function timeLabel(value: string | null): string {
  return value
    ? new Intl.DateTimeFormat("en-PK", {
        hour: "numeric",
        minute: "2-digit",
        timeZone: "Asia/Karachi",
      }).format(new Date(value))
    : "Not yet";
}

function formatPkr(paisa: number): string {
  const rupees = Math.floor(paisa / 100);
  if (rupees >= 100_000) return `PKR ${(rupees / 1000).toFixed(0)}k`;
  return `PKR ${rupees.toLocaleString("en-PK")}`;
}

function dailyPmsUrl(path: string): string {
  const isLocal = window.location.hostname.endsWith(".localhost");
  return `${isLocal ? "http://localhost:5173" : "https://app.innflo.co"}${path}`;
}

function toneClasses(tone: AttentionItem["tone"]): string {
  if (tone === "coral") return "bg-coral-soft text-coral";
  if (tone === "amber") return "bg-amber-soft text-amber";
  return "bg-pine-soft text-pine";
}

function getAttentionItems(
  dashboard: Awaited<ReturnType<typeof dashboardService.getDashboard>> | undefined,
  openNotes: FrontDeskNote[],
): AttentionItem[] {
  if (!dashboard) return [];

  const items: AttentionItem[] = [];
  for (const reminder of dashboard.operationalReminders.slice(0, 2)) {
    const isShift = reminder.kind === "SHIFT_HANDOVER";
    items.push({
      label: isShift
        ? `${reminder.shiftType.charAt(0) + reminder.shiftType.slice(1).toLowerCase()} shift handover ${reminder.status === "OVERDUE" ? "is overdue" : "is due soon"}`
        : `Night audit ${reminder.status === "OVERDUE" ? "is overdue" : "is due soon"}`,
      detail: isShift ? "Review the shift’s activity and leave a clean handover." : "Close the operating day after reviewing exceptions.",
      href: dailyPmsUrl(reminder.url),
      icon: isShift ? Clock3 : ShieldCheck,
      tone: reminder.status === "OVERDUE" ? "coral" : "amber",
    });
  }
  if (dashboard.maintenance.urgent > 0) {
    items.push({
      label: `${dashboard.maintenance.urgent} urgent maintenance ${dashboard.maintenance.urgent === 1 ? "issue" : "issues"}`,
      detail: "Needs a decision before it affects a guest or room.",
      href: dailyPmsUrl("/maintenance"),
      icon: AlertTriangle,
      tone: "coral",
    });
  }
  if (dashboard.maintenance.overdue > 0) {
    items.push({
      label: `${dashboard.maintenance.overdue} overdue maintenance ${dashboard.maintenance.overdue === 1 ? "ticket" : "tickets"}`,
      detail: "Open tickets have been waiting longer than expected.",
      href: dailyPmsUrl("/maintenance"),
      icon: Wrench,
      tone: "amber",
    });
  }
  if (dashboard.housekeeping.checkoutCleansPending > 0) {
    items.push({
      label: `${dashboard.housekeeping.checkoutCleansPending} checkout ${dashboard.housekeeping.checkoutCleansPending === 1 ? "room" : "rooms"} to clean`,
      detail: "Housekeeping needs to release these rooms for arrivals.",
      href: dailyPmsUrl("/housekeeping"),
      icon: BedDouble,
      tone: "amber",
    });
  }
  if (dashboard.inventory.lowStockCount > 0) {
    items.push({
      label: `${dashboard.inventory.lowStockCount} low-stock ${dashboard.inventory.lowStockCount === 1 ? "item" : "items"}`,
      detail: "Review reorder levels before the next busy period.",
      href: dailyPmsUrl("/inventory"),
      icon: Package,
      tone: "amber",
    });
  }
  if (dashboard.departuresToCollect.total > 0) {
    items.push({
      label: `${formatPkr(dashboard.departuresToCollect.total)} to collect on departures`,
      detail: "Outstanding balances are attached to today’s departing stays.",
      href: dailyPmsUrl("/reservations"),
      icon: CircleDollarSign,
      tone: "coral",
    });
  }
  if (openNotes.length > 0) {
    items.push({
      label: `${openNotes.length} open front desk ${openNotes.length === 1 ? "note" : "notes"}`,
      detail: "Unresolved notes should be cleared or handed over.",
      href: dailyPmsUrl("/dashboard"),
      icon: FileText,
      tone: "pine",
    });
  }
  return items.slice(0, 5);
}

function SectionHeading({ eyebrow, title, action }: { eyebrow: string; title: string; action?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        <div className="text-[10px] font-bold uppercase tracking-[0.17em] text-ink-faint">{eyebrow}</div>
        <h2 className="mt-1 serif text-[25px] leading-none tracking-[-0.025em] text-ink">{title}</h2>
      </div>
      {action}
    </div>
  );
}

function ExternalPmsLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[12px] font-bold text-coral hover:text-coral-dark">
      {children}
      <ExternalLink size={13} />
    </a>
  );
}

function BriefMetric({ label, value, detail, icon: Icon }: { label: string; value: string; detail: string; icon: typeof BedDouble }) {
  return (
    <div className="border-t border-white/10 pt-3">
      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-white/45"><Icon size={13} /> {label}</div>
      <div className="mt-2 text-[22px] font-semibold tracking-[-0.03em] text-white">{value}</div>
      <div className="mt-0.5 text-[11px] text-white/45">{detail}</div>
    </div>
  );
}

export default function BackOfficeOverviewPage() {
  const today = todayInPakistan();
  const hotelQuery = useQuery<HotelSummary>({
    queryKey: ["backoffice", "hotel"],
    queryFn: () => api.get("/api/hotels/me").then((response) => response.data.data as HotelSummary),
    staleTime: 5 * 60_000,
  });
  const dashboardQuery = useQuery({
    queryKey: ["backoffice", "dashboard"],
    queryFn: dashboardService.getDashboard,
    refetchInterval: 60_000,
  });
  const staffQuery = useQuery({
    queryKey: ["backoffice", "staff"],
    queryFn: usersService.getUsers,
    staleTime: 60_000,
  });
  const attendanceQuery = useQuery({
    queryKey: ["backoffice", "attendance", today],
    queryFn: () => attendanceService.getRecords({ startDate: today, endDate: today, limit: 100 }),
    refetchInterval: 30_000,
  });
  const notesQuery = useQuery({
    queryKey: ["backoffice", "notes"],
    queryFn: notesService.getNotes,
    staleTime: 30_000,
  });
  const expenseQuery = useQuery({
    queryKey: ["backoffice", "expenses", today],
    queryFn: () => expensesService.getExpenseSummary(`${today.slice(0, 8)}01`, today),
    staleTime: 60_000,
  });
  const upcomingLeaveQuery = useQuery({
    queryKey: ["backoffice", "leaves", "upcoming", today],
    queryFn: () => leaveService.getRecords({ startDate: today, endDate: dateAfter(today, 7), limit: 100 }),
    staleTime: 60_000,
  });

  const dashboard = dashboardQuery.data;
  const staff = staffQuery.data ?? [];
  const activeStaff = staff.filter((member) => member.isActive && member.role !== "OWNER");
  const attendance = attendanceQuery.data?.data ?? [];
  const openNotes = (notesQuery.data ?? []).filter((note) => !note.isCompleted);
  const signedInIds = new Set(attendance.filter((record) => record.source === "APP_LOGIN").map((record) => record.userId));
  const notSeenStaff = activeStaff.filter((member) => !signedInIds.has(member.userId));
  const attentionItems = getAttentionItems(dashboard, openNotes);
  const nextArrivals = dashboard?.upcomingReservations.slice(0, 4) ?? [];
  const upcomingLeaveDays = upcomingLeaveQuery.data?.data ?? [];

  return (
    <div className="space-y-7">
      <section className="overflow-hidden rounded-[26px] bg-ink text-white shadow-[0_18px_45px_rgba(39,34,32,0.12)]">
        <div className="grid gap-8 px-6 py-7 sm:px-8 sm:py-8 lg:grid-cols-[1.15fr_1fr] lg:items-end lg:px-10">
          <div>
            <div className="mb-4 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#F4A184]"><span className="h-1.5 w-1.5 rounded-full bg-coral" /> Manager’s brief</div>
            <h1 className="serif max-w-[520px] text-[38px] font-medium leading-[0.98] tracking-[-0.04em] sm:text-[48px]">Keep the stay moving.</h1>
            <p className="mt-4 max-w-[480px] text-[14px] leading-6 text-white/55">A short, decision-first view of what needs your attention at {hotelQuery.data?.name ?? "your property"}.</p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <span className="rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-semibold text-white/70">{dateLabel(today)}</span>
              <ExternalPmsLink href={dailyPmsUrl("/dashboard")}><span className="text-[#F4A184]">Open daily PMS</span></ExternalPmsLink>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-x-5 gap-y-5 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
            <BriefMetric label="Occupancy" value={dashboard ? `${Math.round(dashboard.occupancy.occupancyRate)}%` : "—"} detail={dashboard ? `${dashboard.occupancy.occupiedRooms}/${dashboard.occupancy.totalRooms} rooms` : "Loading"} icon={BedDouble} />
            <BriefMetric label="Arrivals" value={dashboard ? String(dashboard.today.arrivalsToday) : "—"} detail="today" icon={CalendarClock} />
            <BriefMetric label="Departures" value={dashboard ? String(dashboard.today.departuresToday) : "—"} detail="today" icon={ArrowUpRight} />
            <BriefMetric label="People in" value={`${attendance.filter((record) => record.status === "PRESENT" || record.status === "HALF_DAY").length}/${activeStaff.length}`} detail="on attendance sheet" icon={Users} />
          </div>
        </div>
      </section>

      <section>
        <SectionHeading eyebrow="Manager’s queue" title="Needs your attention" action={<span className="text-[12px] text-ink-faint">Live from the PMS</span>} />
        {attentionItems.length === 0 ? (
          <div className="flex items-center gap-3 rounded-2xl border border-pine/20 bg-pine-soft/65 px-5 py-4 text-[13px] text-pine-deep"><CheckCircle2 size={18} className="shrink-0" /><span><strong>Nothing urgent right now.</strong> Keep an eye on this list as the day moves.</span></div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {attentionItems.map(({ label, detail, href, icon: Icon, tone }) => (
              <a key={label} href={href} target="_blank" rel="noreferrer" className="group flex items-start gap-3 rounded-2xl border border-line bg-card px-4 py-4 shadow-card transition-all hover:-translate-y-0.5 hover:border-coral/25 hover:shadow-float">
                <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl", toneClasses(tone))}><Icon size={17} /></span>
                <span className="min-w-0 flex-1"><span className="block text-[13px] font-bold text-ink">{label}</span><span className="mt-1 block text-[12px] leading-5 text-ink-mute">{detail}</span></span>
                <ChevronRight size={16} className="mt-1 shrink-0 text-ink-faint transition-transform group-hover:translate-x-0.5 group-hover:text-coral" />
              </a>
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-7 xl:grid-cols-[1.15fr_0.85fr]">
        <section>
          <SectionHeading eyebrow="People check-in" title="Who has been seen today?" action={<Link to="/attendance" className="inline-flex items-center gap-1 text-[12px] font-bold text-coral hover:text-coral-dark">Open sheet <ChevronRight size={14} /></Link>} />
          <Card pad={false}>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-soft px-5 py-4">
              <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-pine-soft text-pine"><ClipboardCheck size={19} /></span><div><div className="text-[14px] font-bold text-ink">{attendance.length} attendance records</div><div className="mt-0.5 text-[12px] text-ink-mute">Automatic app logins plus manual entries</div></div></div>
              <span className="rounded-full bg-pine-soft px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-pine">{signedInIds.size} app sign-ins</span>
            </div>
            <div className="divide-y divide-line-soft">
              {notSeenStaff.length > 0 ? notSeenStaff.slice(0, 4).map((member: StaffUser) => (
                <div key={member.userId} className="flex items-center gap-3 px-5 py-3.5"><span className="grid h-8 w-8 place-items-center rounded-full bg-amber-soft text-[11px] font-bold text-amber">{member.user.name.slice(0, 1).toUpperCase()}</span><div className="min-w-0 flex-1"><div className="truncate text-[13px] font-semibold text-ink">{member.user.name}</div><div className="text-[11px] text-ink-mute">{member.assignedRole.displayName}</div></div><span className="text-[11px] font-semibold text-amber">Not seen yet</span></div>
              )) : (
                <div className="flex items-center gap-3 px-5 py-6 text-[13px] text-ink-mute"><ShieldCheck size={18} className="text-pine" /> Everyone with a staff account has been seen or manually marked today.</div>
              )}
              {notSeenStaff.length > 4 && <Link to="/attendance" className="block px-5 py-3 text-[12px] font-bold text-coral hover:bg-mist">View {notSeenStaff.length - 4} more staff follow-ups</Link>}
            </div>
            <div className="flex items-center gap-3 border-t border-line-soft bg-mist/55 px-5 py-3"><CalendarDays size={16} className="text-amber" /><div className="min-w-0 flex-1 text-[12px] text-ink-mute">{upcomingLeaveDays.length > 0 ? <><span className="font-bold text-ink-soft">{upcomingLeaveDays.length} leave {upcomingLeaveDays.length === 1 ? "day" : "days"}</span> scheduled over the next 7 days.</> : "No leave scheduled over the next 7 days."}</div><Link to="/leave" className="shrink-0 text-[12px] font-bold text-coral hover:text-coral-dark">Planner</Link></div>
          </Card>
        </section>

        <section>
          <SectionHeading eyebrow="Cash & control" title="Today in numbers" action={<Link to="/finance" className="inline-flex items-center gap-1 text-[12px] font-bold text-coral hover:text-coral-dark">Open finance <ChevronRight size={14} /></Link>} />
          <Card className="space-y-4">
            <div className="flex items-center justify-between"><span className="flex items-center gap-2 text-[12px] font-semibold text-ink-mute"><CircleDollarSign size={16} className="text-coral" /> Revenue today</span><span className="text-[16px] font-bold text-ink">{dashboard ? formatPkr(dashboard.revenue.revenueToday) : "—"}</span></div>
            <div className="flex items-center justify-between"><span className="flex items-center gap-2 text-[12px] font-semibold text-ink-mute"><Receipt size={16} className="text-pine" /> Payments received</span><span className="text-[16px] font-bold text-ink">{dashboard ? formatPkr(dashboard.revenue.paymentsToday) : "—"}</span></div>
            <div className="flex items-center justify-between"><span className="flex items-center gap-2 text-[12px] font-semibold text-ink-mute"><XCircle size={16} className="text-amber" /> Outstanding guest balance</span><span className="text-[16px] font-bold text-ink">{dashboard ? formatPkr(dashboard.revenue.outstandingBalance) : "—"}</span></div>
            <div className="border-t border-line-soft pt-4"><div className="flex items-center justify-between"><span className="text-[12px] font-semibold text-ink-mute">Expenses this month</span><span className="text-[16px] font-bold text-ink">{formatPkr(expenseQuery.data?.totalAmount ?? 0)}</span></div><div className="mt-1 text-[11px] text-ink-faint">From the existing expense register</div></div>
          </Card>
        </section>
      </div>

      <div className="grid gap-7 xl:grid-cols-[0.9fr_1.1fr]">
        <section>
          <SectionHeading eyebrow="Guest flow" title="Next arrivals" action={<ExternalPmsLink href={dailyPmsUrl("/reservations")}>View reservations</ExternalPmsLink>} />
          <Card pad={false}>
            {nextArrivals.length === 0 ? <div className="px-5 py-8 text-center text-[13px] text-ink-mute">No upcoming arrivals in the next 7 days.</div> : <div className="divide-y divide-line-soft">{nextArrivals.map((reservation) => <a key={reservation.id} href={dailyPmsUrl(`/reservations/${reservation.id}`)} target="_blank" rel="noreferrer" className="group flex items-center gap-3 px-5 py-3.5 hover:bg-mist"><span className="grid h-9 w-9 place-items-center rounded-xl bg-dusk-soft text-dusk"><CalendarClock size={17} /></span><div className="min-w-0 flex-1"><div className="truncate text-[13px] font-bold text-ink">{reservation.guestName}</div><div className="mt-0.5 text-[11px] text-ink-mute">{shortDateLabel(reservation.checkInDate)} · Room {reservation.roomNumber ?? "unassigned"}</div></div><ChevronRight size={16} className="text-ink-faint transition-transform group-hover:translate-x-0.5 group-hover:text-coral" /></a>)}</div>}
          </Card>
        </section>

        <section>
          <SectionHeading eyebrow="Handover" title="Open notes" action={<ExternalPmsLink href={dailyPmsUrl("/dashboard")}>Review in PMS</ExternalPmsLink>} />
          <Card pad={false}>
            {openNotes.length === 0 ? <div className="flex items-center gap-3 px-5 py-8 text-[13px] text-ink-mute"><CheckCircle2 size={18} className="text-pine" /> No unresolved front desk notes.</div> : <div className="divide-y divide-line-soft">{openNotes.slice(0, 4).map((note) => <a key={note.id} href={dailyPmsUrl("/dashboard")} target="_blank" rel="noreferrer" className="group flex items-start gap-3 px-5 py-3.5 hover:bg-mist"><span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-amber-soft text-amber"><FileText size={15} /></span><div className="min-w-0 flex-1"><div className="text-[13px] leading-5 text-ink">{note.text}</div><div className="mt-1 flex items-center gap-2 text-[11px] text-ink-mute"><span>{note.createdBy.name}</span><span>·</span><span>{timeLabel(note.createdAt)}</span></div></div><ChevronRight size={15} className="mt-1 shrink-0 text-ink-faint transition-transform group-hover:translate-x-0.5 group-hover:text-coral" /></a>)}</div>}
          </Card>
        </section>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-line bg-card px-5 py-4 shadow-card sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-3"><Clock3 size={17} className="mt-0.5 shrink-0 text-coral" /><div><div className="text-[13px] font-bold text-ink">Keep the desk light.</div><div className="mt-0.5 text-[12px] leading-5 text-ink-mute">Use Back Office for people, exceptions and control. Send room-by-room work back to the daily PMS.</div></div></div><Link to="/staff" className="inline-flex shrink-0 items-center gap-1 text-[12px] font-bold text-coral hover:text-coral-dark">Manage staff <ArrowUpRight size={14} /></Link></div>
    </div>
  );
}
