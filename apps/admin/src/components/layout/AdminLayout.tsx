import { Link, useNavigate } from "react-router-dom";
import { Building2, LogOut, CreditCard } from "lucide-react";
import { clearToken, decodeToken } from "@/lib/auth";

export interface AdminLayoutProps {
  children: React.ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const navigate = useNavigate();
  const admin = decodeToken();

  function handleLogout() {
    clearToken();
    navigate("/login");
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside className="fixed inset-y-0 left-0 flex w-60 flex-col bg-gray-900 text-gray-300">
        <div className="px-5 py-6">
          <Link to="/hotels" className="flex items-center gap-3">
            <img src="/brand/mark-clay-tight.svg" alt="" aria-hidden="true" className="h-9 w-9" />
            <span>
              <span className="block text-lg font-bold leading-tight text-white">Innflo</span>
              <span className="block text-[10px] font-semibold uppercase tracking-[0.15em] text-gray-500">Super admin</span>
            </span>
          </Link>
        </div>

        <nav className="flex-1 px-3 space-y-1">
          <Link
            to="/hotels"
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-gray-300 hover:bg-gray-700 hover:text-white"
          >
            <Building2 size={18} />
            Hotels
          </Link>
          <Link
            to="/plans"
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-gray-300 hover:bg-gray-700 hover:text-white"
          >
            <CreditCard size={18} />
            Plans
          </Link>
        </nav>

        <div className="border-t border-gray-800 px-3 py-4">
          <p className="truncate px-3 text-xs text-gray-400">{admin?.email}</p>
          <button
            onClick={handleLogout}
            className="mt-2 flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-gray-300 hover:bg-gray-700 hover:text-white"
          >
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </aside>

      <main className="ml-60 flex-1 p-8">{children}</main>
    </div>
  );
}
