import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarDays, CalendarRange, BarChart3, ClipboardList,
  TrendingUp, ShoppingCart, ReceiptText, CreditCard,
  AlertCircle, RotateCcw, Scale, FileSpreadsheet,
  BedDouble, Users, Wrench, Package, Utensils,
  ChevronDown, ChevronRight, Search,
  Banknote, LogIn, LogOut, Sparkles, Moon,
  Lock, Sunrise,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { TONE } from "@/components/ui/StatusBadge";
import { cn } from "@/lib/cn";
import { reportsService } from "@/services/reports";

// ── helpers ───────────────────────────────────────────────────────────────────

function localIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatPKR(paisas: number): string {
  const r = Math.floor(paisas / 100);
  if (r >= 1_000_000) return `PKR ${(r / 1_000_000).toFixed(1)}M`;
  if (r >= 100_000)   return `PKR ${(r / 1_000).toFixed(0)}k`;
  return `PKR ${r.toLocaleString("en-PK")}`;
}

const TODAY = localIso();

// ── Report card definitions ───────────────────────────────────────────────────

type ReportCard = {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  route: string;
  comingSoon?: false;
} | {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  route: string;
  comingSoon: true;
};

interface Category {
  id: string;
  name: string;
  icon: React.ElementType;
  reports: ReportCard[];
}

const CATEGORIES: Category[] = [
  {
    id: "financial",
    name: "Financial",
    icon: Banknote,
    reports: [
      {
        id: "daily",
        name: "Daily Operations Report",
        description: "Full operations summary for any single day",
        icon: CalendarDays,
        route: `/reports/daily?date=${TODAY}`,
      },
      {
        id: "monthly",
        name: "Monthly Summary Report",
        description: "Trends, KPIs and insights for any month",
        icon: BarChart3,
        route: "/reports/monthly",
      },
      {
        id: "revenue-source",
        name: "Revenue by Source",
        description: "Room, POS and other revenue breakdown by date range",
        icon: TrendingUp,
        route: "/reports/revenue-source",
      },
      {
        id: "payment-methods",
        name: "Payment Method Breakdown",
        description: "Collections grouped by payment method with donut chart",
        icon: CreditCard,
        route: "/reports/payment-methods",
      },
      {
        id: "outstanding-balances",
        name: "Outstanding Balances",
        description: "Open folios with balance due, aged by days",
        icon: AlertCircle,
        route: "/reports/outstanding-balances",
      },
      {
        id: "void-refund",
        name: "Void & Refund Log",
        description: "Audit trail of all voided charges and refunds",
        icon: RotateCcw,
        route: "/reports/void-refund-log",
      },
      {
        id: "cash-reconciliation",
        name: "Cash / Bank Reconciliation",
        description: "Balance Book account flows and net positions",
        icon: Scale,
        route: "/reports/cash-reconciliation",
      },
      {
        id: "accounting-export",
        name: "Accounting Export",
        description: "Journal file for Tally, Excel or any accounting package",
        icon: FileSpreadsheet,
        route: "/reports/accounting-export",
      },
    ],
  },
  {
    id: "operations",
    name: "Operations",
    icon: ClipboardList,
    reports: [
      {
        id: "early-bird",
        name: "Early Bird Report",
        description: "Manager morning brief: closed day, today's movement, exceptions and forward outlook",
        icon: Sunrise,
        route: "/operations/early-bird",
      },
      {
        id: "shift-history",
        name: "Shift Reports",
        description: "Review submitted handovers, cash counts, variances and approvals",
        icon: ClipboardList,
        route: "/operations/shift-handover?tab=reports",
      },
      {
        id: "night-audit-history",
        name: "Night Audit History",
        description: "Review frozen daily closures, exceptions and operating snapshots",
        icon: Moon,
        route: "/operations/night-audit#history",
      },
    ],
  },
  {
    id: "occupancy",
    name: "Occupancy & Performance",
    icon: BedDouble,
    reports: [
      { id: "occ-daily", name: "Occupancy Trend", description: "Daily occupancy rate over a date range", icon: BarChart3, route: "/reports/occupancy-trend" },
      { id: "adr", name: "ADR / RevPAR Analysis", description: "Average daily rate and revenue per available room", icon: TrendingUp, route: "/reports/adr-revpar" },
      { id: "historical-comparison", name: "Historical Comparison", description: "Compare occupancy, ADR, RevPAR and production with earlier periods", icon: Scale, route: "/reports/historical-comparison" },
      { id: "pickup-pace", name: "Pickup & Pace", description: "See how many room-nights and how much revenue have been added since an earlier snapshot", icon: TrendingUp, route: "/reports/pickup-pace" },
      { id: "forecast", name: "Hotel Forecast", description: "Next 7–30 days of occupancy, room availability and expected revenue", icon: CalendarRange, route: "/reports/forecast" },
      { id: "room-type-perf", name: "Room Type Performance", description: "Occupancy and revenue split by room type", icon: BedDouble, route: "/reports/room-type-performance" },
      { id: "length-of-stay", name: "Length of Stay Report", description: "Average stay duration and distribution", icon: CalendarDays, route: "/reports/length-of-stay" },
      { id: "source-of-business", name: "Source of Business", description: "Booking source breakdown with revenue per channel", icon: ShoppingCart, route: "/reports/source-of-business" },
    ],
  },
  {
    id: "guests",
    name: "Guests",
    icon: Users,
    reports: [
      { id: "guest-directory", name: "Guest Directory", description: "Searchable, paginated export of all guests on file", icon: Users, route: "/reports/guest-directory" },
      { id: "repeat-guests", name: "Repeat Guests / VIP Report", description: "Highest-value repeat guests ranked by total spend", icon: TrendingUp, route: "/reports/repeat-guests" },
      { id: "guest-blacklist", name: "Guest Blacklist Report", description: "Current blacklist snapshot with severity breakdown", icon: ReceiptText, route: "/reports/guest-blacklist-report" },
      { id: "guest-demographics", name: "Nationality / Guest Type Mix", description: "Guest origin and type breakdown for compliance and marketing", icon: Users, route: "/reports/guest-demographics" },
    ],
  },
  {
    id: "operational-performance",
    name: "Operational Performance",
    icon: Wrench,
    reports: [
      { id: "hk-performance", name: "Housekeeping Performance", description: "Per-staff task counts, avg completion time, by-type breakdown", icon: Sparkles, route: "/reports/housekeeping-performance" },
      { id: "maintenance-summary", name: "Maintenance Summary", description: "Tickets by status, priority, category and cost variance", icon: Wrench, route: "/reports/maintenance-summary" },
      { id: "staff-activity", name: "Staff Activity", description: "Audit log grouped by staff member with action breakdown", icon: Users, route: "/reports/staff-activity" },
      { id: "group-bookings-summary", name: "Group Bookings Summary", description: "Group revenue, room-nights and operator breakdown", icon: Users, route: "/reports/group-bookings-summary" },
    ],
  },
  {
    id: "inventory",
    name: "Inventory",
    icon: Package,
    reports: [
      { id: "stock-consumption", name: "Stock Consumption", description: "Items consumed by period, grouped by category", icon: Package, route: "/reports/stock-consumption" },
      { id: "waste-loss", name: "Waste & Loss", description: "Waste quantities, cost lost and waste percentage per item", icon: Package, route: "/reports/waste-loss" },
      { id: "low-stock-reorder", name: "Low Stock / Reorder", description: "Items at or below reorder level with estimated reorder cost", icon: Package, route: "/reports/low-stock-reorder" },
    ],
  },
  {
    id: "pos-dining",
    name: "POS & Dining",
    icon: Utensils,
    reports: [
      { id: "pos-sales", name: "POS Sales", description: "Top items by revenue, category breakdown, order count", icon: ShoppingCart, route: "/reports/pos-sales" },
      { id: "qr-orders", name: "QR Orders", description: "QR menu order volume by delivery type, status and payment preference", icon: Utensils, route: "/reports/qr-orders" },
    ],
  },
];

// ── Today snapshot tile ───────────────────────────────────────────────────────

function SnapTile({
  icon: Icon, label, value, sub, color,
}: {
  icon: React.ElementType; label: string; value: string; sub?: string; color: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-line bg-white px-4 py-3.5">
      <span className="grid place-items-center h-9 w-9 rounded-xl shrink-0" style={{ background: `${color}18`, color }}>
        <Icon size={17} />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">{label}</p>
        <p className="text-[22px] font-bold text-ink tnum leading-tight">{value}</p>
        {sub && <p className="text-[12px] text-ink-mute">{sub}</p>}
      </div>
    </div>
  );
}

// ── Report card ───────────────────────────────────────────────────────────────

function ReportCardItem({ report }: { report: ReportCard }) {
  const navigate = useNavigate();
  const Icon = report.icon;

  if (report.comingSoon) {
    return (
      <div className="group relative flex flex-col gap-3 rounded-2xl border border-line bg-white p-5 opacity-55 cursor-default select-none">
        <div className="flex items-start justify-between">
          <span className="grid place-items-center h-11 w-11 rounded-xl bg-line-soft text-ink-faint shrink-0">
            <Icon size={20} />
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wider text-ink-faint border border-line rounded-full px-2 py-0.5">
            Coming soon
          </span>
        </div>
        <div>
          <div className="text-[14px] font-bold text-ink-soft">{report.name}</div>
          <div className="text-[12px] text-ink-faint mt-0.5 leading-snug">{report.description}</div>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => navigate(report.route)}
      className="group flex flex-col gap-3 rounded-2xl border border-line bg-white p-5 text-left transition-all hover:border-coral/60 hover:shadow-pop active:scale-[0.98]"
    >
      <div className="flex items-start justify-between">
        <span className="grid place-items-center h-11 w-11 rounded-xl bg-coral-soft text-coral-deep group-hover:bg-coral group-hover:text-white transition-colors shrink-0">
          <Icon size={20} />
        </span>
        <ChevronRight size={15} className="text-ink-faint group-hover:text-coral transition-colors mt-0.5" />
      </div>
      <div>
        <div className="text-[14px] font-bold text-ink">{report.name}</div>
        <div className="text-[12px] text-ink-mute mt-0.5 leading-snug">{report.description}</div>
      </div>
    </button>
  );
}

// ── Category section ──────────────────────────────────────────────────────────

function CategorySection({ category, query }: { category: Category; query: string }) {
  const [open, setOpen] = useState(false);
  const CatIcon = category.icon;

  const filtered = useMemo(() => {
    if (!query) return category.reports;
    const q = query.toLowerCase();
    return category.reports.filter(
      (r) => r.name.toLowerCase().includes(q) || r.description.toLowerCase().includes(q),
    );
  }, [category.reports, query]);

  if (query && filtered.length === 0) return null;

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2.5 w-full text-left mb-4 group"
      >
        <span className="grid place-items-center h-8 w-8 rounded-xl bg-mist text-ink-soft group-hover:bg-line-soft transition-colors">
          <CatIcon size={16} />
        </span>
        <span className="text-[15px] font-bold text-ink">{category.name}</span>
        <span className="text-[12px] font-semibold text-ink-faint">({filtered.length})</span>
        <ChevronDown
          size={15}
          className={cn("text-ink-faint ml-auto transition-transform", !open && "-rotate-90")}
        />
      </button>

      {open && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((r) => (
            <ReportCardItem key={r.id} report={r} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const [search, setSearch] = useState("");

  const { data: todaySnap, isLoading: snapLoading } = useQuery({
    queryKey: ["report-daily-snap", TODAY],
    queryFn: () => reportsService.getDailyReport(TODAY),
    staleTime: 2 * 60_000,
    retry: 1,
  });

  const filteredCategories = useMemo(() => {
    if (!search) return CATEGORIES;
    const q = search.toLowerCase();
    return CATEGORIES.filter((cat) =>
      cat.reports.some(
        (r) => r.name.toLowerCase().includes(q) || r.description.toLowerCase().includes(q),
      ),
    );
  }, [search]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="mb-1.5 text-[12px] font-bold uppercase tracking-[0.14em] text-coral">Analytics</div>
        <h1 className="serif text-[34px] leading-[1.05] text-ink">Reports</h1>
        <p className="mt-1.5 text-[15px] text-ink-mute">Generate insights across your property</p>
      </div>

      {/* Today at a Glance */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="serif text-[18px] text-ink leading-tight">Today at a Glance</h2>
            <p className="text-[12.5px] text-ink-mute mt-0.5">
              {new Date().toLocaleDateString("en-PK", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </p>
          </div>
        </div>

        {snapLoading || !todaySnap ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-20 rounded-xl bg-mist animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
              <SnapTile icon={BedDouble}  label="Occupancy"       value={`${todaySnap.occupancy.occupancyRate}%`}     sub={`${todaySnap.occupancy.occupied}/${todaySnap.occupancy.totalRooms} rooms`} color="#2F7256" />
              <SnapTile icon={Banknote}   label="Collected Today" value={formatPKR(todaySnap.revenue.totalCollected)} sub="Payments received"             color="#e04b22" />
              <SnapTile icon={LogIn}      label="Arrivals"        value={String(todaySnap.arrivals.length)}            sub={`${todaySnap.occupancy.checkIns} checked in`}   color="#2c455c" />
              <SnapTile icon={LogOut}     label="Departures"      value={String(todaySnap.departures.length)}          sub={`${todaySnap.occupancy.checkOuts} checked out`} color="#86600F" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <SnapTile icon={TrendingUp}  label="Room Revenue" value={formatPKR(todaySnap.revenue.roomRevenue)}       sub="Room charges"          color="#5B4B82" />
              <SnapTile icon={ShoppingCart} label="POS Revenue" value={formatPKR(todaySnap.revenue.posRevenue)}        sub={`${todaySnap.operations.pos.totalOrders} orders`} color="#2F7256" />
              <SnapTile icon={Sparkles}    label="HK Tasks"     value={`${todaySnap.operations.housekeeping.completed}/${todaySnap.operations.housekeeping.totalTasks}`} sub="Completed today" color="#e04b22" />
              <SnapTile icon={Wrench}      label="Open Tickets" value={String(todaySnap.operations.maintenance.openTickets)} sub={todaySnap.operations.maintenance.urgentOpen > 0 ? `${todaySnap.operations.maintenance.urgentOpen} urgent` : "No urgent"} color={todaySnap.operations.maintenance.urgentOpen > 0 ? "#aa4432" : "#2F7256"} />
            </div>
            {todaySnap.revenue.outstanding > 0 && (
              <div className="mt-3 flex items-center gap-2 rounded-xl bg-amber-soft border border-amber/30 px-4 py-2.5">
                <AlertCircle size={14} className="text-amber shrink-0" />
                <p className="text-[12.5px] font-semibold text-amber">
                  {formatPKR(todaySnap.revenue.outstanding)} outstanding across all open folios
                </p>
              </div>
            )}
          </>
        )}
      </Card>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-faint pointer-events-none" />
        <input
          type="text"
          placeholder="Search reports…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full h-12 pl-10 pr-4 rounded-2xl border border-line bg-white text-[14px] text-ink placeholder:text-ink-faint outline-none focus:border-coral focus:ring-2 focus:ring-coral/15 transition-all shadow-sm"
        />
      </div>

      {/* Category sections */}
      {filteredCategories.length === 0 ? (
        <div className="py-16 text-center">
          <div className="text-[14px] font-semibold text-ink-mute">No reports match "{search}"</div>
        </div>
      ) : (
        <div className="space-y-10">
          {filteredCategories.map((cat) => (
            <CategorySection key={cat.id} category={cat} query={search} />
          ))}
        </div>
      )}
    </div>
  );
}
