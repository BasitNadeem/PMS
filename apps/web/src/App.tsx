import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AppLayout } from "./components/layout/AppLayout";
import { getCurrentUserRole } from "./lib/jwt";
import { isMobileDevice } from "./lib/device";
import LoginPage from "./pages/LoginPage";
import OnboardingPage from "./pages/onboarding/OnboardingPage";
import DashboardPage from "./pages/DashboardPage";
import HousekeepingMobilePage from "./pages/housekeeping/HousekeepingMobilePage";
import RoomsPage from "./pages/rooms/RoomsPage";
import GuestsPage from "./pages/guests/GuestsPage";
import GuestDetailPage from "./pages/guests/GuestDetailPage";
import ReservationsPage from "./pages/reservations/ReservationsPage";
import ReservationDetailPage from "./pages/reservations/ReservationDetailPage";
import GroupsPage from "./pages/groups/GroupsPage";
import GroupDetailPage from "./pages/groups/GroupDetailPage";
import BillingPage from "./pages/billing/BillingPage";
import FolioPage from "./pages/folio/FolioPage";
import ExpensesPage from "./pages/expenses/ExpensesPage";
import CashBookPage from "./pages/cashbook/CashBookPage";
import HousekeepingPage from "./pages/housekeeping/HousekeepingPage";
import MaintenanceTicketsPage from "./pages/maintenance/MaintenanceTicketsPage";
import TeamPage from "./pages/team/TeamPage";
import PosPage from "./pages/pos/PosPage";
import ReportsPage from "./pages/reports/ReportsPage";
import DailyReportPage from "./pages/reports/DailyReportPage";
import MonthlyReportPage from "./pages/reports/MonthlyReportPage";
import NotificationsPage from "./pages/notifications/NotificationsPage";
import SettingsPage from "./pages/settings/SettingsPage";
import ShiftHandoverPage from "./pages/shifts/ShiftHandoverPage";
import AuditLogPage from "./pages/audit/AuditLogPage";
import GuestMenuPage from "./pages/menu/GuestMenuPage";
import KitchenDisplayPage from "./pages/kitchen/KitchenDisplayPage";
import KitchenDisplayOnlyPage from "./pages/kitchen/KitchenDisplayOnlyPage";
import KitchenDashboardPage from "./pages/kitchen/KitchenDashboardPage";
import { KitchenLayout } from "./components/layout/KitchenLayout";
import QrOrdersPage from "./pages/qr-orders/QrOrdersPage";
import InventoryPage from "./pages/inventory/InventoryPage";
import MobileScanPage from "./pages/MobileScanPage";

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

export default function App() {
  return (
    <BrowserRouter>
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
        <Route
          path="/"
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
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
