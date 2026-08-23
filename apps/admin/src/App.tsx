import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { isLoggedIn } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/AdminLayout";
import LoginPage from "@/pages/LoginPage";
import HotelsPage from "@/pages/HotelsPage";
import CreateHotelPage from "@/pages/CreateHotelPage";
import HotelDetailPage from "@/pages/HotelDetailPage";
import PlansPage from "@/pages/PlansPage";
import PortfoliosPage from "@/pages/PortfoliosPage";
import PortfolioEditorPage from "@/pages/PortfolioEditorPage";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  if (!isLoggedIn()) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<Navigate to="/hotels" replace />} />
        <Route
          path="/hotels"
          element={
            <ProtectedRoute>
              <HotelsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/hotels/new"
          element={
            <ProtectedRoute>
              <AdminLayout>
                <CreateHotelPage />
              </AdminLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/hotels/:id"
          element={
            <ProtectedRoute>
              <HotelDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/portfolios"
          element={<ProtectedRoute><PortfoliosPage /></ProtectedRoute>}
        />
        <Route
          path="/portfolios/new"
          element={<ProtectedRoute><AdminLayout><PortfolioEditorPage /></AdminLayout></ProtectedRoute>}
        />
        <Route
          path="/portfolios/:id"
          element={<ProtectedRoute><AdminLayout><PortfolioEditorPage /></AdminLayout></ProtectedRoute>}
        />
        <Route
          path="/plans"
          element={
            <ProtectedRoute>
              <PlansPage />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
