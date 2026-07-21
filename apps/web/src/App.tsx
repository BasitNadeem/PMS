import { lazy, Suspense, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AppLayout } from "./components/layout/AppLayout";
import { getCurrentUserRole } from "./lib/jwt";
import { isMobileDevice } from "./lib/device";
import { resolveAppMode } from "./lib/hostname";

// Every page is lazy-loaded so a given user's initial bundle only contains the
// pages they actually visit (e.g. housekeeping staff never pull in the 20+
// report pages or admin settings) — see apps/web/CLAUDE.md's documented
// "Pages are lazy-loaded" convention.
const LoginPage                    = lazy(() => import("./pages/LoginPage"));
const OnboardingPage               = lazy(() => import("./pages/onboarding/OnboardingPage"));
const DashboardPage                = lazy(() => import("./pages/DashboardPage"));
const HousekeepingMobilePage       = lazy(() => import("./pages/housekeeping/HousekeepingMobilePage"));
const RoomsPage                    = lazy(() => import("./pages/rooms/RoomsPage"));
const GuestsPage                   = lazy(() => import("./pages/guests/GuestsPage"));
const GuestDetailPage              = lazy(() => import("./pages/guests/GuestDetailPage"));
const ReservationsPage             = lazy(() => import("./pages/reservations/ReservationsPage"));
const ReservationDetailPage        = lazy(() => import("./pages/reservations/ReservationDetailPage"));
const GroupsPage                   = lazy(() => import("./pages/groups/GroupsPage"));
const GroupDetailPage              = lazy(() => import("./pages/groups/GroupDetailPage"));
const BillingPage                  = lazy(() => import("./pages/billing/BillingPage"));
const FolioPage                    = lazy(() => import("./pages/folio/FolioPage"));
const ExpensesPage                 = lazy(() => import("./pages/expenses/ExpensesPage"));
const CashBookPage                 = lazy(() => import("./pages/cashbook/CashBookPage"));
const HousekeepingPage             = lazy(() => import("./pages/housekeeping/HousekeepingPage"));
const MaintenanceTicketsPage       = lazy(() => import("./pages/maintenance/MaintenanceTicketsPage"));
const TeamPage                     = lazy(() => import("./pages/team/TeamPage"));
const PosPage                      = lazy(() => import("./pages/pos/PosPage"));
const ReportsPage                  = lazy(() => import("./pages/reports/ReportsPage"));
const DailyReportPage              = lazy(() => import("./pages/reports/DailyReportPage"));
const MonthlyReportPage            = lazy(() => import("./pages/reports/MonthlyReportPage"));
const RevenueSourcePage            = lazy(() => import("./pages/reports/RevenueSourcePage"));
const PaymentMethodsPage           = lazy(() => import("./pages/reports/PaymentMethodsPage"));
const OutstandingBalancesPage      = lazy(() => import("./pages/reports/OutstandingBalancesPage"));
const VoidRefundLogPage            = lazy(() => import("./pages/reports/VoidRefundLogPage"));
const CashReconciliationPage       = lazy(() => import("./pages/reports/CashReconciliationPage"));
const OccupancyTrendPage           = lazy(() => import("./pages/reports/OccupancyTrendPage"));
const ADRRevPARPage                = lazy(() => import("./pages/reports/ADRRevPARPage"));
const RoomTypePerformancePage      = lazy(() => import("./pages/reports/RoomTypePerformancePage"));
const SourceOfBusinessPage         = lazy(() => import("./pages/reports/SourceOfBusinessPage"));
const LengthOfStayPage             = lazy(() => import("./pages/reports/LengthOfStayPage"));
const GuestDirectoryPage           = lazy(() => import("./pages/reports/GuestDirectoryPage"));
const RepeatGuestsPage             = lazy(() => import("./pages/reports/RepeatGuestsPage"));
const GuestBlacklistPage           = lazy(() => import("./pages/reports/GuestBlacklistPage"));
const GuestDemographicsPage        = lazy(() => import("./pages/reports/GuestDemographicsPage"));
const HousekeepingPerformancePage  = lazy(() => import("./pages/reports/HousekeepingPerformancePage"));
const MaintenanceSummaryPage       = lazy(() => import("./pages/reports/MaintenanceSummaryPage"));
const StaffActivityPage            = lazy(() => import("./pages/reports/StaffActivityPage"));
const GroupBookingsSummaryPage     = lazy(() => import("./pages/reports/GroupBookingsSummaryPage"));
const StockConsumptionPage         = lazy(() => import("./pages/reports/StockConsumptionPage"));
const WasteLossPage                = lazy(() => import("./pages/reports/WasteLossPage"));
const LowStockReorderPage          = lazy(() => import("./pages/reports/LowStockReorderPage"));
const POSSalesPage                 = lazy(() => import("./pages/reports/POSSalesPage"));
const QROrdersReportPage           = lazy(() => import("./pages/reports/QROrdersPage"));
const NotificationsPage            = lazy(() => import("./pages/notifications/NotificationsPage"));
const SettingsPage                 = lazy(() => import("./pages/settings/SettingsPage"));
const ShiftHandoverPage            = lazy(() => import("./pages/shifts/ShiftHandoverPage"));
const AuditLogPage                 = lazy(() => import("./pages/audit/AuditLogPage"));
const GuestMenuPage                = lazy(() => import("./pages/menu/GuestMenuPage"));
const KitchenDisplayOnlyPage       = lazy(() => import("./pages/kitchen/KitchenDisplayOnlyPage"));
const KitchenDashboardPage         = lazy(() => import("./pages/kitchen/KitchenDashboardPage"));
const QrOrdersPage                 = lazy(() => import("./pages/qr-orders/QrOrdersPage"));
const InventoryPage                = lazy(() => import("./pages/inventory/InventoryPage"));
const ChannelManagerPage           = lazy(() => import("./pages/channel-manager/ChannelManagerPage"));
const RatePlansPage                = lazy(() => import("./pages/rates/RatePlansPage"));
const BookingEngineHubPage         = lazy(() => import("./pages/booking-engine-hub/BookingEngineHubPage"));
const MobileScanPage               = lazy(() => import("./pages/MobileScanPage"));
const NightAuditPage               = lazy(() => import("./pages/nightaudit/NightAuditPage"));
const BookingLandingPage           = lazy(() => import("./pages/booking-engine/BookingLandingPage"));
const BookingFormPage              = lazy(() => import("./pages/booking-engine/BookingFormPage"));

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem("accessToken");
  const location = useLocation();

  if (!token) return <Navigate to="/login" replace />;

  // The setup wizard is only for the hotel owner completing initial property
  // setup — not for staff signing in for the first time (they just get the
  // "first login" password-change banner in AppLayout).
  const isOwner = getCurrentUserRole() === "OWNER";
  const onboardingCompleted = localStorage.getItem("onboardingCompleted") !== "false";

  if (isOwner && !onboardingCompleted && location.pathname !== "/onboarding") {
    return <Navigate to="/onboarding" replace />;
  }

  // Housekeeping staff on a phone land on the mobile PWA instead of the
  // desktop layout — everywhere except the mobile route itself (which has
  // its own role/device guard below).
  const role = getCurrentUserRole();
  if (role === "HOUSEKEEPING" && isMobileDevice() && location.pathname !== "/housekeeping/mobile") {
    return <Navigate to="/housekeeping/mobile" replace />;
  }

  return <>{children}</>;
}

function HousekeepingMobileRoute() {
  const role = getCurrentUserRole();
  const canUseMobile = role === "HOUSEKEEPING" || role === "MANAGER" || role === "OWNER";

  if (!canUseMobile) return <Navigate to="/housekeeping" replace />;

  // Managers/owners get the richer desktop view when they're actually on a
  // desktop — the mobile PWA is for HOUSEKEEPING staff and for managers
  // genuinely on a phone.
  if ((role === "MANAGER" || role === "OWNER") && !isMobileDevice()) {
    return <Navigate to="/housekeeping" replace />;
  }

  return <HousekeepingMobilePage />;
}

function RouteFallback() {
  return (
    <div className="flex items-center justify-center min-h-screen text-[14px] text-ink-mute">
      Loading…
    </div>
  );
}

// PMS mode: app.innflo.co, localhost, or 127.0.0.1 (see lib/hostname.ts).
// Unchanged from before the hostname split — same routes, same PrivateRoute,
// just extracted into its own component instead of being mixed with the
// Booking Engine's /book/:hotelSlug routes in one tree.
function PmsRoutes() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        {/* Fully public — no auth, no AppLayout */}
        <Route path="/menu/:hotelSlug" element={<GuestMenuPage />} />
        {/* Mobile camera scan — token in URL is the credential, no login required */}
        <Route path="/scan/:token" element={<MobileScanPage />} />
        {/* Kitchen dashboard — auth required, uses main AppLayout */}
        <Route
          path="/kitchen/dashboard"
          element={
            <PrivateRoute>
              <AppLayout>
                <KitchenDashboardPage />
              </AppLayout>
            </PrivateRoute>
          }
        />
        {/* /kitchen → redirect to dashboard (backward compat) */}
        <Route path="/kitchen" element={<Navigate to="/kitchen/dashboard" replace />} />
        {/* Kitchen display-only TV mode — no layout */}
        <Route
          path="/kitchen/display"
          element={
            <PrivateRoute>
              <KitchenDisplayOnlyPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/onboarding"
          element={
            <PrivateRoute>
              <OnboardingPage />
            </PrivateRoute>
          }
        />
        {/* "/" is only ever reached in PMS mode (Booking Engine mode never
            renders PmsRoutes at all) — authenticated users land on the real
            dashboard at /dashboard; PrivateRoute already sends unauthenticated
            hits to /login before this element ever renders. */}
        <Route
          path="/"
          element={
            <PrivateRoute>
              <Navigate to="/dashboard" replace />
            </PrivateRoute>
          }
        />
        <Route
          path="/dashboard"
          element={
            <PrivateRoute>
              <AppLayout>
                <DashboardPage />
              </AppLayout>
            </PrivateRoute>
          }
        />
        <Route
          path="/rooms"
          element={
            <PrivateRoute>
              <AppLayout>
                <RoomsPage />
              </AppLayout>
            </PrivateRoute>
          }
        />
        <Route
          path="/guests"
          element={
            <PrivateRoute>
              <AppLayout>
                <GuestsPage />
              </AppLayout>
            </PrivateRoute>
          }
        />
        <Route
          path="/guests/:id"
          element={
            <PrivateRoute>
              <AppLayout>
                <GuestDetailPage />
              </AppLayout>
            </PrivateRoute>
          }
        />
        <Route
          path="/reservations"
          element={
            <PrivateRoute>
              <AppLayout>
                <ReservationsPage />
              </AppLayout>
            </PrivateRoute>
          }
        />
        <Route
          path="/reservations/:id"
          element={
            <PrivateRoute>
              <AppLayout>
                <ReservationDetailPage />
              </AppLayout>
            </PrivateRoute>
          }
        />
        <Route
          path="/groups"
          element={
            <PrivateRoute>
              <AppLayout>
                <GroupsPage />
              </AppLayout>
            </PrivateRoute>
          }
        />
        <Route
          path="/groups/:id"
          element={
            <PrivateRoute>
              <AppLayout>
                <GroupDetailPage />
              </AppLayout>
            </PrivateRoute>
          }
        />
        <Route
          path="/financials"
          element={
            <PrivateRoute>
              <AppLayout>
                <BillingPage />
              </AppLayout>
            </PrivateRoute>
          }
        />
        <Route
          path="/financials/expenses"
          element={
            <PrivateRoute>
              <AppLayout>
                <ExpensesPage />
              </AppLayout>
            </PrivateRoute>
          }
        />
        <Route
          path="/financials/cashbook"
          element={
            <PrivateRoute>
              <AppLayout>
                <CashBookPage />
              </AppLayout>
            </PrivateRoute>
          }
        />
        {/* Folio opened from Financials — sidebar shows Financials as active */}
        <Route
          path="/financials/folio/:reservationId"
          element={
            <PrivateRoute>
              <AppLayout>
                <FolioPage />
              </AppLayout>
            </PrivateRoute>
          }
        />
        <Route
          path="/housekeeping"
          element={
            <PrivateRoute>
              <AppLayout>
                <HousekeepingPage />
              </AppLayout>
            </PrivateRoute>
          }
        />
        {/* Standalone PWA — no AppLayout, no sidebar */}
        <Route
          path="/housekeeping/mobile"
          element={
            <PrivateRoute>
              <HousekeepingMobileRoute />
            </PrivateRoute>
          }
        />
        <Route
          path="/maintenance"
          element={
            <PrivateRoute>
              <AppLayout>
                <MaintenanceTicketsPage />
              </AppLayout>
            </PrivateRoute>
          }
        />
        <Route
          path="/team"
          element={
            <PrivateRoute>
              <AppLayout>
                <TeamPage />
              </AppLayout>
            </PrivateRoute>
          }
        />
        <Route
          path="/pos"
          element={
            <PrivateRoute>
              <AppLayout>
                <PosPage />
              </AppLayout>
            </PrivateRoute>
          }
        />
        <Route
          path="/reports"
          element={
            <PrivateRoute>
              <AppLayout>
                <ReportsPage />
              </AppLayout>
            </PrivateRoute>
          }
        />
        <Route
          path="/reports/daily"
          element={
            <PrivateRoute>
              <AppLayout>
                <DailyReportPage />
              </AppLayout>
            </PrivateRoute>
          }
        />
        <Route
          path="/reports/monthly"
          element={
            <PrivateRoute>
              <AppLayout>
                <MonthlyReportPage />
              </AppLayout>
            </PrivateRoute>
          }
        />
        <Route
          path="/reports/shifts"
          element={
            <PrivateRoute>
              <AppLayout>
                <ShiftHandoverPage />
              </AppLayout>
            </PrivateRoute>
          }
        />
        <Route
          path="/reports/revenue-source"
          element={
            <PrivateRoute>
              <AppLayout>
                <RevenueSourcePage />
              </AppLayout>
            </PrivateRoute>
          }
        />
        <Route
          path="/reports/payment-methods"
          element={
            <PrivateRoute>
              <AppLayout>
                <PaymentMethodsPage />
              </AppLayout>
            </PrivateRoute>
          }
        />
        <Route
          path="/reports/outstanding-balances"
          element={
            <PrivateRoute>
              <AppLayout>
                <OutstandingBalancesPage />
              </AppLayout>
            </PrivateRoute>
          }
        />
        <Route
          path="/reports/void-refund-log"
          element={
            <PrivateRoute>
              <AppLayout>
                <VoidRefundLogPage />
              </AppLayout>
            </PrivateRoute>
          }
        />
        <Route
          path="/reports/cash-reconciliation"
          element={
            <PrivateRoute>
              <AppLayout>
                <CashReconciliationPage />
              </AppLayout>
            </PrivateRoute>
          }
        />
        <Route
          path="/reports/occupancy-trend"
          element={
            <PrivateRoute>
              <AppLayout>
                <OccupancyTrendPage />
              </AppLayout>
            </PrivateRoute>
          }
        />
        <Route
          path="/reports/adr-revpar"
          element={
            <PrivateRoute>
              <AppLayout>
                <ADRRevPARPage />
              </AppLayout>
            </PrivateRoute>
          }
        />
        <Route
          path="/reports/room-type-performance"
          element={
            <PrivateRoute>
              <AppLayout>
                <RoomTypePerformancePage />
              </AppLayout>
            </PrivateRoute>
          }
        />
        <Route
          path="/reports/source-of-business"
          element={
            <PrivateRoute>
              <AppLayout>
                <SourceOfBusinessPage />
              </AppLayout>
            </PrivateRoute>
          }
        />
        <Route
          path="/reports/length-of-stay"
          element={
            <PrivateRoute>
              <AppLayout>
                <LengthOfStayPage />
              </AppLayout>
            </PrivateRoute>
          }
        />
        <Route
          path="/reports/guest-directory"
          element={
            <PrivateRoute>
              <AppLayout>
                <GuestDirectoryPage />
              </AppLayout>
            </PrivateRoute>
          }
        />
        <Route
          path="/reports/repeat-guests"
          element={
            <PrivateRoute>
              <AppLayout>
                <RepeatGuestsPage />
              </AppLayout>
            </PrivateRoute>
          }
        />
        <Route
          path="/reports/guest-blacklist-report"
          element={
            <PrivateRoute>
              <AppLayout>
                <GuestBlacklistPage />
              </AppLayout>
            </PrivateRoute>
          }
        />
        <Route
          path="/reports/guest-demographics"
          element={
            <PrivateRoute>
              <AppLayout>
                <GuestDemographicsPage />
              </AppLayout>
            </PrivateRoute>
          }
        />
        <Route path="/reports/housekeeping-performance" element={<PrivateRoute><AppLayout><HousekeepingPerformancePage /></AppLayout></PrivateRoute>} />
        <Route path="/reports/maintenance-summary" element={<PrivateRoute><AppLayout><MaintenanceSummaryPage /></AppLayout></PrivateRoute>} />
        <Route path="/reports/staff-activity" element={<PrivateRoute><AppLayout><StaffActivityPage /></AppLayout></PrivateRoute>} />
        <Route path="/reports/group-bookings-summary" element={<PrivateRoute><AppLayout><GroupBookingsSummaryPage /></AppLayout></PrivateRoute>} />
        <Route path="/reports/stock-consumption" element={<PrivateRoute><AppLayout><StockConsumptionPage /></AppLayout></PrivateRoute>} />
        <Route path="/reports/waste-loss" element={<PrivateRoute><AppLayout><WasteLossPage /></AppLayout></PrivateRoute>} />
        <Route path="/reports/low-stock-reorder" element={<PrivateRoute><AppLayout><LowStockReorderPage /></AppLayout></PrivateRoute>} />
        <Route path="/reports/pos-sales" element={<PrivateRoute><AppLayout><POSSalesPage /></AppLayout></PrivateRoute>} />
        <Route path="/reports/qr-orders" element={<PrivateRoute><AppLayout><QROrdersReportPage /></AppLayout></PrivateRoute>} />
        <Route path="/reports/night-audit" element={<PrivateRoute><AppLayout><NightAuditPage /></AppLayout></PrivateRoute>} />
        <Route
          path="/notifications"
          element={
            <PrivateRoute>
              <AppLayout>
                <NotificationsPage />
              </AppLayout>
            </PrivateRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <PrivateRoute>
              <AppLayout>
                <SettingsPage />
              </AppLayout>
            </PrivateRoute>
          }
        />
        <Route
          path="/settings/audit"
          element={
            <PrivateRoute>
              <AppLayout>
                <AuditLogPage />
              </AppLayout>
            </PrivateRoute>
          }
        />
        <Route
          path="/qr-orders"
          element={
            <PrivateRoute>
              <AppLayout>
                <QrOrdersPage />
              </AppLayout>
            </PrivateRoute>
          }
        />
        <Route
          path="/inventory"
          element={
            <PrivateRoute>
              <AppLayout>
                <InventoryPage />
              </AppLayout>
            </PrivateRoute>
          }
        />
        <Route
          path="/channel-manager"
          element={
            <PrivateRoute>
              <AppLayout>
                <ChannelManagerPage />
              </AppLayout>
            </PrivateRoute>
          }
        />
        <Route
          path="/rate-plans"
          element={
            <PrivateRoute>
              <AppLayout>
                <RatePlansPage />
              </AppLayout>
            </PrivateRoute>
          }
        />
        <Route
          path="/booking-engine"
          element={
            <PrivateRoute>
              <AppLayout>
                <BookingEngineHubPage />
              </AppLayout>
            </PrivateRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

// Hotel subdomains (any *.innflo.co host other than app.innflo.co) render
// ONLY these two routes — no /login, no PrivateRoute, no PMS routes exist
// on this branch at all. hotelSlug comes from the hostname (see
// lib/hostname.ts), never from the URL path.
function BookingEngineRoutes({ hotelSlug }: { hotelSlug: string }) {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/" element={<BookingLandingPage hotelSlug={hotelSlug} />} />
        <Route path="/reserve" element={<BookingFormPage hotelSlug={hotelSlug} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  // Computed once per page load, not re-evaluated on every render — the
  // hostname can't change without a full navigation anyway.
  const [appMode] = useState(() => resolveAppMode());

  return (
    <BrowserRouter>
      {appMode.type === "booking-engine"
        ? <BookingEngineRoutes hotelSlug={appMode.hotelSlug} />
        : <PmsRoutes />}
    </BrowserRouter>
  );
}
