import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { api } from "@/lib/api";
import type { Hotel } from "@/types";

function useHotels() {
  return useQuery({
    queryKey: ["admin", "hotels"],
    queryFn: async () => {
      const res = await api.get<{ data: Hotel[] }>("/api/admin/hotels");
      return res.data.data;
    },
  });
}

function useToggleHotelActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await api.patch<{ data: Hotel }>(`/api/admin/hotels/${id}`, { isActive });
      return res.data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "hotels"] }),
  });
}

export default function HotelsPage() {
  const { data: hotels, isLoading } = useHotels();
  const toggleActive = useToggleHotelActive();

  const total = hotels?.length ?? 0;
  const active = hotels?.filter((h) => h.isActive).length ?? 0;
  const pendingOnboarding = hotels?.filter((h) => !h.onboardingCompleted).length ?? 0;

  return (
    <AdminLayout>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Hotels</h1>
        <Link
          to="/hotels/new"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          + Create Hotel
        </Link>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-500">Total Hotels</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{total}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-500">Active</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{active}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-500">Pending Onboarding</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{pendingOnboarding}</p>
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3">Hotel</th>
              <th className="px-4 py-3">Subdomain</th>
              <th className="px-4 py-3">City</th>
              <th className="px-4 py-3">Rooms</th>
              <th className="px-4 py-3">Reservations</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading && (
              Array.from({ length: 3 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 7 }).map((__, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 w-full animate-pulse rounded bg-gray-100" />
                    </td>
                  ))}
                </tr>
              ))
            )}

            {!isLoading && hotels?.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                  No hotels yet. Create your first hotel.
                </td>
              </tr>
            )}

            {!isLoading && hotels?.map((hotel) => (
              <tr key={hotel.id}>
                <td className="px-4 py-3 font-medium text-gray-900">{hotel.name}</td>
                <td className="px-4 py-3 text-gray-600">{hotel.subdomain ?? "—"}</td>
                <td className="px-4 py-3 text-gray-600">{hotel.city ?? "—"}</td>
                <td className="px-4 py-3 text-gray-600">{hotel._count.rooms}</td>
                <td className="px-4 py-3 text-gray-600">{hotel._count.reservations}</td>
                <td className="px-4 py-3">
                  {hotel.isActive ? (
                    <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700">
                      Active
                    </span>
                  ) : (
                    <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-700">
                      Inactive
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <Link
                      to={`/hotels/${hotel.id}`}
                      className="rounded-md border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                    >
                      View
                    </Link>
                    <button
                      onClick={() => toggleActive.mutate({ id: hotel.id, isActive: !hotel.isActive })}
                      className="rounded-md border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                    >
                      {hotel.isActive ? "Deactivate" : "Activate"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminLayout>
  );
}
