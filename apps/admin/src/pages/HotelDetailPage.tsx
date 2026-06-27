import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { api } from "@/lib/api";
import type { ResetOwnerPasswordResult } from "@/types";

interface HotelDetail {
  id: string;
  name: string;
  slug: string;
  subdomain: string | null;
  city: string | null;
  isActive: boolean;
  onboardingCompleted: boolean;
  createdAt: string;
  _count: { rooms: number; reservations: number; users: number };
  users: { role: string; user: { id: string; name: string; email: string; isFirstLogin: boolean } }[];
}

export default function HotelDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [result, setResult] = useState<ResetOwnerPasswordResult["owner"] | null>(null);
  const [copied, setCopied] = useState<"email" | "password" | null>(null);

  const { data: hotel, isLoading } = useQuery({
    queryKey: ["admin", "hotels", id],
    queryFn: async () => {
      const res = await api.get<{ data: HotelDetail }>(`/api/admin/hotels/${id}`);
      return res.data.data;
    },
  });

  const resetPassword = useMutation({
    mutationFn: async () => {
      const res = await api.post<{ data: ResetOwnerPasswordResult }>(`/api/admin/hotels/${id}/reset-owner-password`);
      return res.data.data;
    },
    onSuccess: (data) => {
      setResult(data.owner);
      setCopied(null);
    },
  });

  function copy(value: string, field: "email" | "password") {
    void navigator.clipboard.writeText(value);
    setCopied(field);
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <AdminLayout>
      <Link to="/hotels" className="text-sm text-gray-500 hover:text-gray-700">
        ← Back to Hotels
      </Link>

      {isLoading && <p className="mt-4 text-sm text-gray-500">Loading…</p>}

      {hotel && (
        <>
          <h1 className="mt-2 text-2xl font-bold text-gray-900">{hotel.name}</h1>

          <div className="mt-6 grid grid-cols-2 gap-6">
            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-900">Details</h2>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between"><dt className="text-gray-500">Subdomain</dt><dd className="text-gray-900">{hotel.subdomain ?? "—"}</dd></div>
                <div className="flex justify-between"><dt className="text-gray-500">City</dt><dd className="text-gray-900">{hotel.city ?? "—"}</dd></div>
                <div className="flex justify-between"><dt className="text-gray-500">Status</dt><dd className="text-gray-900">{hotel.isActive ? "Active" : "Inactive"}</dd></div>
                <div className="flex justify-between"><dt className="text-gray-500">Onboarding</dt><dd className="text-gray-900">{hotel.onboardingCompleted ? "Completed" : "Pending"}</dd></div>
                <div className="flex justify-between"><dt className="text-gray-500">Rooms</dt><dd className="text-gray-900">{hotel._count.rooms}</dd></div>
                <div className="flex justify-between"><dt className="text-gray-500">Reservations</dt><dd className="text-gray-900">{hotel._count.reservations}</dd></div>
              </dl>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-900">Users</h2>
              <ul className="mt-3 space-y-2 text-sm">
                {hotel.users.map(({ user, role }) => (
                  <li key={user.id} className="flex justify-between">
                    <span className="text-gray-900">
                      {user.name}
                      {role === "OWNER" && (
                        <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                          Owner
                        </span>
                      )}
                    </span>
                    <span className="text-gray-500">{user.email}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-4 border-t border-gray-100 pt-4">
                <button
                  onClick={() => resetPassword.mutate()}
                  disabled={resetPassword.isPending}
                  className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                >
                  {resetPassword.isPending ? "Generating…" : "Generate New One-Time Password"}
                </button>
                {resetPassword.isError && (
                  <p className="mt-2 text-xs text-red-600">Failed to generate a new password.</p>
                )}

                {result && (
                  <div className="mt-3 rounded-md bg-gray-50 p-4">
                    <p className="text-xs font-semibold uppercase text-gray-500">Owner Credentials</p>

                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-sm text-gray-900">{result.email}</span>
                      <button
                        onClick={() => copy(result.email, "email")}
                        className="rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100"
                      >
                        {copied === "email" ? "Copied!" : "Copy"}
                      </button>
                    </div>

                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-sm text-gray-900">{result.tempPassword}</span>
                      <button
                        onClick={() => copy(result.tempPassword, "password")}
                        className="rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100"
                      >
                        {copied === "password" ? "Copied!" : "Copy"}
                      </button>
                    </div>

                    <p className="mt-3 text-xs text-amber-700">
                      ⚠️ Share these with the owner. Password is shown once only.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </AdminLayout>
  );
}
