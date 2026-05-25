import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";

interface Hotel {
  id: string;
  name: string;
  slug: string;
  propertyType: string;
  city: string;
}

export default function DashboardPage() {
  const { data: hotel, isLoading } = useQuery<Hotel>({
    queryKey: ["hotel"],
    queryFn: () => api.get("/api/hotels/me").then((r) => r.data),
  });

  function logout() {
    localStorage.removeItem("accessToken");
    window.location.href = "/login";
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">
            {isLoading ? "Loading…" : hotel?.name}
          </h1>
          <p className="text-xs text-gray-500">{hotel?.propertyType} · {hotel?.city}</p>
        </div>
        <button
          onClick={logout}
          className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
        >
          Sign out
        </button>
      </header>

      <main className="p-6">
        <p className="text-gray-600 text-sm">
          Dashboard coming soon — API is connected and DB is live.
        </p>
      </main>
    </div>
  );
}
