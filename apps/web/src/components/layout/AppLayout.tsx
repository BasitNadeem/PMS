import { useState, useEffect, useRef, useCallback, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { NavLink, Link, useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard, BedDouble, Users, Users2, Building2, CalendarCheck, CalendarDays,
  Sparkles, ShoppingCart, FileBarChart, LogOut,
  ChevronsUpDown, ChevronDown, PanelLeftClose, PanelLeftOpen, TrendingUp, Menu, X, Settings,
  Receipt, TrendingDown, BookOpen, Wrench, ClipboardList, ChefHat, Monitor, Package, Network, Moon, Tag, Globe, CalendarRange, Sunrise,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { GlobalSearchBar } from "@/components/layout/GlobalSearchBar";
import { dashboardService } from "@/services/dashboard";
import { usePermissions } from "@/hooks/usePermissions";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { getCurrentUserName, getCurrentUserRole, formatRoleLabel, getInitials } from "@/lib/jwt";
import { applyTheme } from "@/lib/theme";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { useOperationalAlerts } from "@/hooks/useOperationalAlerts";
import { useOperationalNotificationAlerts } from "@/hooks/useOperationalNotificationAlerts";
import { OperationalAlertStack } from "@/components/ui/OperationalAlertStack";
import { playNotificationSound, unlockNotificationSound } from "@/lib/notificationSound";

function useOnlineStatus() {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener("online", cb);
      window.addEventListener("offline", cb);
      return () => {
        window.removeEventListener("online", cb);
        window.removeEventListener("offline", cb);
      };
    },
    () => navigator.onLine,
    () => true,
  );
}

function OfflineBanner() {
  const isOnline = useOnlineStatus();
  const [wasOffline, setWasOffline] = useState(false);
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    if (!isOnline) {
      setWasOffline(true);
      setShowReconnected(false);
    } else if (wasOffline) {
      setShowReconnected(true);
      const t = setTimeout(() => setShowReconnected(false), 3000);
      return () => clearTimeout(t);
    }
  }, [isOnline, wasOffline]);

  if (isOnline && !showReconnected) return null;

  return (
    <div
      className={cn(
        "flex items-center justify-center gap-2 px-4 py-2 text-[13px] font-semibold transition-colors",
        isOnline
          ? "bg-emerald-50 text-emerald-700 border-b border-emerald-100"
          : "bg-amber-50 text-amber-800 border-b border-amber-200",
      )}
    >
      <span className={cn("h-2 w-2 rounded-full shrink-0", isOnline ? "bg-emerald-500" : "bg-amber-500")} />
      {isOnline ? "Back online — data is syncing" : "You're offline — showing cached data"}
    </div>
  );
}

interface Hotel {
  id: string;
  name: string;
  propertyType: string;
  logoUrl?: string;
  settings?: { themeKey?: string };
}

function formatPropertyType(type?: string): string {
  if (!type) return "Property";
  return type.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function PropertyLogo({ hotel, size = 38 }: { hotel?: Hotel | null; size?: number }) {
  if (hotel?.logoUrl) {
    return (
      <img
        src={hotel.logoUrl}
        alt={hotel.name}
        className="rounded-2xl object-cover shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }
  return <Logo size={size} />;
}

interface NavSubItem {
  to: string;
  label: string;
  icon: React.ElementType;
  permission: string;
  featureGate?: string;
}

interface NavItem {
  to: string;
  label: string;
  icon: React.ElementType;
  end?: boolean;
  permission: string;
  roleOnly?: string;
  newTab?: boolean;
  featureGate?: string;
  children?: NavSubItem[];
  /** Which sidebar group this belongs to. Defaults to "main" (ungrouped, pinned top). */
  section?: NavSectionId;
}

type NavSectionId = "main" | "frontDesk" | "property" | "fnb" | "finance" | "distribution" | "management";

/**
 * Sidebar groups, in the order a hotel actually works: take the booking, ready
 * the room, serve the guest, count the money, run the business.
 *
 * A null label means the group renders without a header and cannot be
 * collapsed — Dashboard should never be one click away behind a toggle.
 *
 * "Finance" holds accounting bookkeeping (expenses, balance book); it is
 * deliberately not called "Revenue" since neither item is revenue.
 * "Distribution" holds commercial/pricing tools (rate plans, booking engine,
 * channels) — these shape what gets sold, not what's already been billed.
 */
const NAV_SECTIONS: { id: NavSectionId; label: string | null }[] = [
  { id: "main",         label: null },
  { id: "frontDesk",    label: "Front Desk" },
  { id: "property",     label: "Property" },
  { id: "fnb",          label: "Food & Beverage" },
  { id: "finance",      label: "Finance" },
  { id: "distribution", label: "Distribution" },
  { id: "management",   label: "Management" },
];

const NAV_ITEMS: NavItem[] = [
  { to: "/kitchen/dashboard", label: "Kitchen Dashboard", icon: ChefHat, permission: "pos:read", roleOnly: "KITCHEN", featureGate: "posModule", section: "main" },
  { to: "/kitchen/display", label: "Display Mode", icon: Monitor, permission: "pos:read", roleOnly: "KITCHEN", newTab: true, featureGate: "kitchenDisplay", section: "main" },
  { to: "/",             label: "Dashboard",    icon: LayoutDashboard, end: true, permission: "dashboard:read", section: "main" },
  { to: "/reservations", label: "Reservations", icon: CalendarCheck, permission: "reservations:read", section: "frontDesk" },
  { to: "/rooms",        label: "Rooms",        icon: BedDouble, permission: "rooms:read", section: "frontDesk" },
  { to: "/guests",       label: "Guests",       icon: Users, permission: "guests:read", section: "frontDesk" },
  { to: "/companies",    label: "Companies",    icon: Building2, permission: "companies:read", section: "frontDesk" },
  // Guest billing/folios are settled as part of check-in and checkout, so
  // Billing lives with the rest of the guest-facing flow. Expenses and Balance
  // Book are back-office bookkeeping — an owner/accountant concern — and live
  // in Finance instead.
  { to: "/financials",   label: "Billing",      icon: Receipt, permission: "billing:read", section: "frontDesk" },
  { to: "/financials/expenses", label: "Expenses", icon: TrendingDown, permission: "expenses:read", section: "finance" },
  { to: "/financials/cashbook", label: "Balance Book", icon: BookOpen, permission: "cashbook:read", section: "finance" },
  { to: "/housekeeping", label: "Housekeeping", icon: Sparkles, permission: "housekeeping:read", section: "property" },
  { to: "/maintenance", label: "Maintenance", icon: Wrench, permission: "maintenance:read", featureGate: "maintenanceTickets", section: "property" },
  {
    to: "/operations", label: "Operations", icon: ClipboardList, permission: "shiftHandover:read", section: "management",
    children: [
      { to: "/operations/early-bird", label: "Early Bird Report", icon: Sunrise, permission: "reports:read" },
      { to: "/reports/forecast", label: "Forecast", icon: CalendarRange, permission: "reports:read" },
      { to: "/operations/shift-handover", label: "Shift Handover", icon: ClipboardList, permission: "shiftHandover:read" },
      { to: "/operations/night-audit", label: "Night Audit", icon: Moon, permission: "nightAudit:read", featureGate: "nightAudit" },
    ],
  },
  { to: "/team",         label: "Team",         icon: Users2, permission: "team:read", section: "management" },
  { to: "/pos", label: "POS", icon: ShoppingCart, permission: "pos:read", featureGate: "posModule", section: "fnb" },
  { to: "/qr-orders", label: "QR Orders", icon: ClipboardList, permission: "pos:read", featureGate: "qrOrdering", section: "fnb" },
  { to: "/inventory", label: "Inventory", icon: Package, permission: "pos:read", featureGate: "inventoryManagement", section: "fnb" },
  {
    to: "/reports", label: "Reports", icon: FileBarChart, permission: "reports:read", section: "management",
    children: [
      { to: "/reports",             label: "All Reports", icon: FileBarChart, permission: "reports:read" },
    ],
  },
  { to: "/rate-plans",      label: "Rate Plans", icon: Tag,     permission: "rates:read",      featureGate: "ratePlans", section: "distribution" },
  { to: "/booking-engine",  label: "Booking Engine", icon: Globe, permission: "bookingEngine:read", featureGate: "bookingEngine", section: "distribution" },
  { to: "/channel-manager", label: "Channels",  icon: Network, permission: "dashboard:read",  featureGate: "channelManager", section: "distribution" },
];

function Logo({ size = 38 }: { size?: number }) {
  return (
    <img
      src="/brand/mark-ink-tight.svg"
      alt=""
      aria-hidden="true"
      className="shrink-0"
      style={{ width: size, height: size }}
    />
  );
}

function OccupancyMini() {
  const { data: dash } = useQuery({
    queryKey:       ["dashboard"],
    queryFn:        dashboardService.getDashboard,
    refetchInterval: 15_000,
    staleTime:       30_000,
  });

  const occ   = dash?.occupancy;
  const pct   = occ ? Math.round((occ.occupiedRooms / Math.max(occ.totalRooms, 1)) * 100) : 0;
  const rooms = occ?.occupiedRooms ?? 0;
  const total = occ?.totalRooms   ?? 0;

  const barColor = pct < 30 ? "#BB4A33" : pct < 70 ? "#B7791A" : "#2F7256";

  return (
    <div className="sidebar-occupancy rounded-2xl bg-ink px-3.5 py-3 text-white">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <TrendingUp size={13} className="text-coral shrink-0" />
          <span className="text-[11px] font-semibold uppercase tracking-widest text-white/45 shrink-0">Occupancy</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[15px] font-bold leading-none tnum">{pct}%</span>
          <span className="text-[11px] text-white/40">{rooms}/{total}</span>
        </div>
      </div>
      <div className="mt-2.5 h-1 rounded-full bg-white/10 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: pct + "%", background: barColor }} />
      </div>
    </div>
  );
}

function SidebarTooltip({ label, children }: { label: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  return (
    <div
      ref={ref}
      className="inline-flex"
      onMouseEnter={() => {
        if (ref.current) {
          const r = ref.current.getBoundingClientRect();
          setPos({ top: r.top + r.height / 2, left: r.right + 8 });
        }
      }}
      onMouseLeave={() => setPos(null)}
    >
      {children}
      {pos && createPortal(
        <div
          className="fixed z-[300] -translate-y-1/2 whitespace-nowrap rounded-lg bg-ink px-2.5 py-1.5 text-[12px] font-semibold text-white pointer-events-none shadow-lg"
          style={{ top: pos.top, left: pos.left }}
        >
          {label}
        </div>,
        document.body,
      )}
    </div>
  );
}

/**
 * Whether a nav item owns the current path.
 *
 *  - Dashboard is "/" so it has to match exactly — startsWith would make it
 *    own every route in the app.
 *  - Billing ("/financials") also owns the folio detail page, which lives at
 *    "/financials/folio/:id" rather than under its own top-level item.
 *  - Expenses and Balance Book now sit at "/financials/expenses" and
 *    "/financials/cashbook" as their own items, sharing the "/financials"
 *    prefix with Billing — so a plain startsWith would make Billing light up
 *    on their pages too. Excluded explicitly rather than trying to keep a
 *    generic prefix rule correct as more routes are added under /financials.
 */
function itemMatchesPath(item: NavItem, pathname: string): boolean {
  if (item.to === "/") return pathname === "/";
  if (item.to === "/financials") {
    return pathname === "/financials" || pathname.startsWith("/financials/folio");
  }
  return pathname.startsWith(item.to);
}

function SidebarContent({
  onNavigate,
  collapsed = false,
  pinned = true,
  onTogglePin,
}: {
  onNavigate?: () => void;
  collapsed?: boolean;
  pinned?: boolean;
  onTogglePin?: () => void;
}) {
  const navigate       = useNavigate();
  const { pathname }   = useLocation();
  const { has, hasAny } = usePermissions();
  const { data: hotel } = useQuery<Hotel>({
    queryKey: ["hotel"],
    queryFn: () => api.get("/api/hotels/me").then((r) => r.data.data),
    staleTime: 5 * 60 * 1000,
  });

  const { data: planFeatures } = useQuery<Record<string, boolean>>({
    queryKey: ["settings", "plan", "features"],
    queryFn: () =>
      api
        .get<{ data: { features: Record<string, boolean> } }>("/api/settings/plan")
        .then((r) => r.data.data.features),
    staleTime: 5 * 60 * 1000,
  });

  function logout() {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("userName");
    localStorage.removeItem("pms-query-cache");
    applyTheme(undefined);
    navigate("/login");
  }

  const userName = getCurrentUserName();
  const userRole = getCurrentUserRole();

  const [activeSubmenu, setActiveSubmenu] = useState<string | null>(null);
  const [submenuPos, setSubmenuPos] = useState({ top: 0, left: 0 });
  const hideTimer = useRef<ReturnType<typeof setTimeout>>();

  const openSubmenuFor = useCallback((to: string, rect: DOMRect) => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setSubmenuPos({ top: rect.top, left: rect.right + 8 });
    setActiveSubmenu(to);
  }, []);

  const scheduleClose = useCallback(() => {
    hideTimer.current = setTimeout(() => setActiveSubmenu(null), 150);
  }, []);

  const cancelClose = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
  }, []);

  // Which groups the user has collapsed. Remembered across sessions like the
  // rail toggle, so a hotel that never touches F&B can fold it away for good.
  const [closedSections, setClosedSections] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem("sidebarClosedSections");
      return saved ? (JSON.parse(saved) as Record<string, boolean>) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    localStorage.setItem("sidebarClosedSections", JSON.stringify(closedSections));
  }, [closedSections]);

  const toggleSection = useCallback((id: NavSectionId) => {
    setClosedSections((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const navItems = NAV_ITEMS
    .filter((item) => {
      if (item.roleOnly && item.roleOnly !== userRole) return false;
      if (item.featureGate && planFeatures?.[item.featureGate] !== true) return false;
      return item.children
        ? hasAny(item.children.map((c) => c.permission))
        : has(item.permission);
    })
    .map((item) => item.children
      ? {
          ...item,
          children: item.children.filter((child) =>
            has(child.permission)
            && (!child.featureGate || planFeatures?.[child.featureGate] === true),
          ),
        }
      : item)
    .filter((item) => !item.children || item.children.length > 0);

  return (
    <div className="flex flex-col h-full">
      {/* Brand / Property block — toggle lives in the same row to save vertical space */}
      {collapsed ? (
        <>
          {onTogglePin && (
            <div className="flex justify-center pt-3 pb-1">
              <SidebarTooltip label="Expand sidebar">
                <button
                  onClick={onTogglePin}
                  className="grid place-items-center h-8 w-8 rounded-lg text-ink-mute hover:bg-line-soft hover:text-ink transition-colors"
                >
                  <PanelLeftOpen size={19} />
                </button>
              </SidebarTooltip>
            </div>
          )}
          <div className="flex justify-center pb-2">
            <PropertyLogo hotel={hotel} size={34} />
          </div>
        </>
      ) : (
        <div className="sidebar-brand-wrap px-3 pt-3 pb-2 flex items-center gap-1.5">
          <div className="flex-1 min-w-0">
            {(userRole === "OWNER" || userRole === "ADMIN") ? (
              <button
                onClick={() => navigate("/settings")}
                className="sidebar-property group flex w-full items-center gap-3 rounded-2xl p-2.5 text-left cursor-pointer transition-all duration-200"
              >
                <PropertyLogo hotel={hotel} />
                <div className="min-w-0 flex-1 leading-tight">
                  <div className="serif text-[18px] text-ink truncate">{hotel?.name ?? "Loading…"}</div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-mute">
                    {formatPropertyType(hotel?.propertyType)}
                  </div>
                </div>
                <ChevronsUpDown size={14} className="text-ink-faint group-hover:text-ink-mute shrink-0" />
              </button>
            ) : (
              <div className="sidebar-property flex items-center gap-3 rounded-2xl px-2.5 py-2">
                <PropertyLogo hotel={hotel} />
                <div className="min-w-0 flex-1 leading-tight">
                  <div className="serif text-[18px] text-ink truncate">{hotel?.name ?? "Loading…"}</div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-mute">
                    {formatPropertyType(hotel?.propertyType)}
                  </div>
                </div>
              </div>
            )}
          </div>
          {onTogglePin && (
            <SidebarTooltip label="Collapse sidebar">
              <button
                onClick={onTogglePin}
                className="sidebar-collapse grid place-items-center h-8 w-8 rounded-xl text-ink-mute hover:text-ink transition-colors"
              >
                <PanelLeftClose size={19} />
              </button>
            </SidebarTooltip>
          )}
        </div>
      )}

      {/* Nav */}
      <nav className="sidebar-nav flex-1 overflow-y-auto px-3 pt-1 pb-2">
        {NAV_SECTIONS.map((section) => {
          const items = navItems.filter((i) => (i.section ?? "main") === section.id);
          if (items.length === 0) return null;

          // The toggle always does what it says — forcing the active group open
          // would make clicking its header look broken. Instead a closed group
          // holding the current page gets a dot, so you keep your bearings.
          // Headers are dropped entirely in the icon rail, where there is no
          // room for them.
          const holdsActive = items.some((i) => itemMatchesPath(i, pathname));
          const open = collapsed || !section.label || !closedSections[section.id];

          return (
            <div key={section.id} className={cn("sidebar-section", section.label && !collapsed ? "mt-2.5 first:mt-0" : "")}>
              {section.label && !collapsed && (
                <button
                  type="button"
                  onClick={() => toggleSection(section.id)}
                  aria-expanded={open}
                  className="sidebar-section-label group flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-ink-faint transition-colors hover:text-ink"
                >
                  <span className="flex-1 text-left">{section.label}</span>
                  {!open && holdsActive && (
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-coral" title="You are on a page in this group" />
                  )}
                  <ChevronDown
                    size={13}
                    className={cn("shrink-0 transition-transform duration-200", !open && "-rotate-90")}
                  />
                </button>
              )}
              {open && (
              <div className="flex flex-col gap-0.5">
                {items.map((item) => {
                  const hasChildren = !!item.children?.length;
                  // Parent is active if path starts with its route (ignoring sub-routes).
                  // For items without children, itemMatchesPath still supplies
                  // the extra matches NavLink's own end/startsWith can't express
                  // (Billing owning the folio detail page, see itemMatchesPath).
                  const parentActive = hasChildren
                    ? pathname.startsWith(item.to)
                    : itemMatchesPath(item, pathname) && pathname !== item.to;

                  return (
                    <div
                      key={item.to}
                      onMouseEnter={collapsed && hasChildren ? (e) => openSubmenuFor(item.to, e.currentTarget.getBoundingClientRect()) : undefined}
                      onMouseLeave={collapsed && hasChildren ? scheduleClose : undefined}
                    >
                      {item.newTab ? (
                        <button
                          onClick={() => { window.open(item.to, "_blank"); onNavigate?.(); }}
                          title={collapsed ? item.label : undefined}
                          className={cn(
                            "sidebar-nav-item group relative flex w-full items-center gap-3 rounded-[10px] py-2 text-[13px] font-semibold transition-all duration-200 text-ink-soft",
                            collapsed ? "justify-center px-0" : "px-3",
                          )}
                        >
                          <item.icon size={18} strokeWidth={1.9} className="text-ink-mute group-hover:text-ink-soft shrink-0" />
                          {!collapsed && (
                            <>
                              <span className="flex-1 text-left">{item.label}</span>
                              <span className="text-[10px] font-bold uppercase tracking-wide text-ink-faint bg-line-soft px-1.5 py-0.5 rounded">TV</span>
                            </>
                          )}
                        </button>
                      ) : (
                      <NavLink
                        to={item.to}
                        end={item.end ?? (!hasChildren)}
                        onClick={onNavigate}
                        title={collapsed ? item.label : undefined}
                        className={({ isActive }) =>
                          cn(
                            "sidebar-nav-item group relative flex items-center gap-3 rounded-[10px] py-2 text-[13px] font-semibold transition-all duration-200",
                            "outline-none focus-visible:ring-2 focus-visible:ring-coral/40 focus-visible:ring-offset-0",
                            collapsed ? "justify-center px-0" : "px-3",
                            (isActive || parentActive)
                              ? "sidebar-nav-item-active text-ink"
                              : "text-ink-soft",
                          )
                        }
                      >
                        {({ isActive }) => {
                          const on = isActive || parentActive;
                          return (
                            <>
                              {on && !collapsed && (
                                <span className="sidebar-active-marker absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-full bg-coral" />
                              )}
                              <item.icon
                                size={18}
                                strokeWidth={on ? 2.1 : 1.9}
                                className={cn("sidebar-nav-icon shrink-0", on ? "text-coral" : "text-ink-mute group-hover:text-ink-soft")}
                              />
                              {!collapsed && <span className="flex-1 text-left">{item.label}</span>}
                            </>
                          );
                        }}
                      </NavLink>
                      )}

                      {/* Sub-items — visible when parent route is active and sidebar is not collapsed */}
                      {hasChildren && parentActive && !collapsed && (
                        <div className="mt-0.5 mb-1 ml-3 pl-3 border-l border-line-soft flex flex-col gap-0.5">
                          {item.children!.map((sub) => {
                            // Billing is active on /financials and /financials/folio/*
                            // Expenses is active on /financials/expenses
                            const subActive = sub.to === "/financials"
                              ? !pathname.startsWith("/financials/expenses") && !pathname.startsWith("/financials/cashbook")
                              : pathname.startsWith(sub.to);
                            return (
                              <button
                                key={sub.to}
                                onClick={() => { navigate(sub.to); onNavigate?.(); }}
                                className={cn(
                                  "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-semibold transition-all w-full text-left",
                                  subActive
                                    ? "text-coral bg-coral/8"
                                    : "text-ink-mute hover:text-ink-soft hover:bg-line-soft",
                                )}
                              >
                                <sub.icon
                                  size={15}
                                  strokeWidth={subActive ? 2.2 : 1.8}
                                  className={subActive ? "text-coral" : "text-ink-faint"}
                                />
                                {sub.label}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Collapsed sidebar hover submenu — rendered in a portal to escape overflow:hidden */}
      {collapsed && (() => {
        const activeItem = activeSubmenu ? navItems.find((i) => i.to === activeSubmenu) : null;
        if (!activeItem?.children?.length) return null;
        return createPortal(
          <div
            style={{ top: submenuPos.top, left: submenuPos.left }}
            className="fixed z-[200] bg-white rounded-xl shadow-float py-1.5 min-w-[180px] border border-line"
            onMouseEnter={cancelClose}
            onMouseLeave={scheduleClose}
          >
            <div className="px-3 pb-1 pt-0.5 text-[11px] font-bold uppercase tracking-[0.12em] text-ink-faint">
              {activeItem.label}
            </div>
            {activeItem.children.map((sub) => {
              const subActive = sub.to === "/financials"
                ? !pathname.startsWith("/financials/expenses") && !pathname.startsWith("/financials/cashbook")
                : pathname.startsWith(sub.to);
              return (
                <button
                  key={sub.to}
                  onClick={() => { navigate(sub.to); setActiveSubmenu(null); onNavigate?.(); }}
                  className={cn(
                    "flex items-center gap-2.5 w-full px-3 py-2 text-[13px] font-semibold text-left transition-colors",
                    subActive
                      ? "text-coral bg-coral/8"
                      : "text-ink-soft hover:bg-line-soft",
                  )}
                >
                  <sub.icon
                    size={15}
                    strokeWidth={subActive ? 2.2 : 1.8}
                    className={subActive ? "text-coral" : "text-ink-faint"}
                  />
                  {sub.label}
                </button>
              );
            })}
          </div>,
          document.body,
        );
      })()}

      {/* Occupancy mini widget */}
      {!collapsed && (
        <div className="px-3 pb-2">
          <OccupancyMini />
        </div>
      )}


      {/* User footer */}
      <div className="sidebar-footer border-t border-line/60 p-3">
        {collapsed ? (
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={logout}
              title="Sign out"
              className="grid place-items-center rounded-full font-bold text-[12px] hover:opacity-80 transition-opacity"
              style={{ width: 32, height: 32, background: "rgb(var(--color-accent-soft))", color: "rgb(var(--color-accent-deep))" }}
            >
              {getInitials(userName) || "?"}
            </button>
            {has("settings:read") && (
              <button
                onClick={() => navigate("/settings")}
                className="grid place-items-center h-8 w-8 rounded-xl text-ink-mute hover:bg-line-soft transition-colors"
                title="Settings"
              >
                <Settings size={16} />
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={logout}
              className="flex flex-1 items-center gap-3 rounded-xl px-2 py-2 hover:bg-line-soft transition-colors text-left"
            >
              <div
                className="grid place-items-center rounded-full font-bold text-[13px] shrink-0"
                style={{ width: 36, height: 36, background: "rgb(var(--color-accent-soft))", color: "rgb(var(--color-accent-deep))" }}
              >
                {getInitials(userName) || "?"}
              </div>
              <div className="min-w-0 flex-1 leading-tight">
                <div className="text-[13px] font-semibold text-ink truncate">{userName ?? "User"}</div>
                <div className="text-[11px] text-ink-mute">{formatRoleLabel(userRole)}</div>
              </div>
            </button>
            <button
              onClick={logout}
              className="grid place-items-center h-9 w-9 rounded-xl text-ink-mute hover:bg-line-soft transition-colors"
              title="Sign out"
            >
              <LogOut size={16} />
            </button>
            {has("settings:read") && (
              <button
                onClick={() => navigate("/settings")}
                className="grid place-items-center h-9 w-9 rounded-xl text-ink-mute hover:bg-line-soft transition-colors"
                title="Settings"
              >
                <Settings size={16} />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function TempPasswordBanner() {
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(
    () => sessionStorage.getItem("tempPasswordBannerDismissed") === "true",
  );
  const isFirstLogin = localStorage.getItem("isFirstLogin") === "true";

  if (!isFirstLogin || dismissed) return null;

  function dismiss() {
    sessionStorage.setItem("tempPasswordBannerDismissed", "true");
    setDismissed(true);
  }

  return (
    <div className="flex items-center justify-between gap-3 bg-amber-soft border-b border-amber/20 px-5 sm:px-7 lg:px-8 py-2.5">
      <span className="text-[13px] text-ink-soft">
        🔐 You&apos;re using a temporary password. Update it now in Settings → Security
      </span>
      <div className="flex items-center gap-3 shrink-0">
        <button
          onClick={() => navigate("/settings#security")}
          className="text-[13px] font-semibold text-coral hover:underline whitespace-nowrap"
        >
          Go to Security Settings →
        </button>
        <button
          onClick={dismiss}
          className="grid place-items-center h-6 w-6 rounded-full text-ink-faint hover:bg-amber/10 hover:text-ink-mute"
          title="Dismiss"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

export interface AppLayoutProps {
  children: React.ReactNode;
}

const SIDEBAR_RAIL = 80;
const SIDEBAR_FULL = 252;

export function AppLayout({ children }: AppLayoutProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { has } = usePermissions();
  useEscapeKey(() => setMobileNavOpen(false), mobileNavOpen);
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem("sidebarCollapsed") === "true",
  );

  // Mounted once here (not per-page) so role-targeted operational alerts can
  // chime and remain visible regardless of the staff member's current page.
  const { alerts, addAlert, removeAlert } = useOperationalAlerts();
  useRealtimeSync();
  useOperationalNotificationAlerts(
    (notification) => {
      playNotificationSound();
      addAlert(notification);
    },
    removeAlert,
  );

  useEffect(() => {
    // Covers restored sessions and page reloads where the login-button gesture
    // did not occur during this AppLayout mount.
    const unlock = () => {
      unlockNotificationSound();
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  const { data: hotel } = useQuery<Hotel>({
    queryKey: ["hotel"],
    queryFn: () => api.get("/api/hotels/me").then((r) => r.data.data),
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    localStorage.setItem("sidebarCollapsed", String(collapsed));
  }, [collapsed]);

  useEffect(() => {
    applyTheme(hotel?.settings?.themeKey);
  }, [hotel?.settings?.themeKey]);

  return (
    <div className="flex h-screen overflow-hidden bg-paper">
      {/* Desktop sidebar */}
      <aside
        className="sidebar-surface hidden lg:flex flex-col border-r border-line shrink-0 h-full overflow-hidden transition-[width] duration-200 ease-out"
        style={{ width: collapsed ? SIDEBAR_RAIL : SIDEBAR_FULL }}
      >
        <SidebarContent
          collapsed={collapsed}
          pinned={!collapsed}
          onTogglePin={() => setCollapsed((c) => !c)}
        />
      </aside>

      {/* Mobile nav overlay */}
      {mobileNavOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40"
          onClick={() => setMobileNavOpen(false)}
        >
          <div className="absolute inset-0 bg-ink/30 backdrop-blur-sm anim-fade-in" />
          <div
            className="sidebar-surface absolute left-0 top-0 h-full w-[270px] anim-slide-in"
            onClick={(e) => e.stopPropagation()}
          >
            <SidebarContent onNavigate={() => setMobileNavOpen(false)} />
          </div>
        </div>
      )}

      {/* Main area */}
      <div className="flex-1 min-w-0 min-h-0 h-full flex flex-col">
        {/* Mobile topbar */}
        <div className="lg:hidden sticky top-0 z-30 flex items-center justify-between gap-3 bg-mist/90 backdrop-blur border-b border-line px-4 h-14">
          <div className="flex items-center gap-2.5">
            <PropertyLogo hotel={hotel} size={32} />
            <span className="serif text-[17px] whitespace-nowrap truncate max-w-[160px]">{hotel?.name ?? ""}</span>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <button
              onClick={() => setMobileNavOpen(!mobileNavOpen)}
              className="grid place-items-center h-9 w-9 rounded-lg text-ink-soft hover:bg-line-soft"
            >
              {mobileNavOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Desktop search — shares the same row as the page top padding, saving vertical space */}
        <div className="hidden lg:flex sticky top-0 z-30 items-center justify-end gap-1 bg-paper/95 backdrop-blur-sm px-7 h-8 border-b border-line/40">
          {/* Sits left of the search field so it keeps its position when the
              search input expands. */}
          {has("reservations:read") && (
            <Link
              to="/reservations?view=calendar"
              title="Reservation calendar"
              aria-label="Reservation calendar"
              className="grid place-items-center h-9 w-9 rounded-full text-ink-mute hover:bg-line-soft hover:text-ink-soft transition-colors"
            >
              <CalendarDays size={17} />
            </Link>
          )}
          <GlobalSearchBar />
        </div>

        {/* Page content */}
        <main className="flex-1 min-h-0 overflow-y-auto scroll-area">
          <OfflineBanner />
          <TempPasswordBanner />
          <div className="px-5 sm:px-7 lg:px-8 py-5 lg:py-6">
            {children}
          </div>
        </main>
      </div>
      <OperationalAlertStack alerts={alerts} onDismiss={removeAlert} />
    </div>
  );
}
