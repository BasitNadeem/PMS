import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { api } from "@/lib/api";
import type { ResetOwnerPasswordResult, SubscriptionPlan } from "@/types";

const FEATURE_KEYS = [
  { key: "whatsappBriefing",    label: "WhatsApp Briefing" },
  { key: "reportsExport",       label: "Reports Export" },
  { key: "inventoryManagement", label: "Inventory Management" },
  { key: "groupBookings",       label: "Group Bookings" },
  { key: "maintenanceTickets",  label: "Maintenance Tickets" },
  { key: "housekeepingPWA",     label: "Housekeeping PWA" },
  { key: "posModule",           label: "POS Module" },
  { key: "qrOrdering",          label: "QR Ordering" },
  { key: "kitchenDisplay",      label: "Kitchen Display" },
  { key: "nightAudit",          label: "Night Audit" },
  { key: "auditLog",            label: "Audit Log" },
  { key: "ratePlans",           label: "Rate Plans" },
  { key: "bookingEngine",       label: "Booking Engine" },
  { key: "channelManager",      label: "Channel Manager" },
  { key: "customDomain",        label: "Custom Domain" },
  { key: "corporateBilling",    label: "Corporate Billing" },
] as const;

interface HotelDetail {
  id: string;
  name: string;
  slug: string;
  subdomain: string | null;
  city: string | null;
  isActive: boolean;
  onboardingCompleted: boolean;
  createdAt: string;
  subscriptionPlanId: string | null;
  subscriptionPlan: {
    id: string; name: string; slug: string;
    priceMonthly: number; maxRooms: number; maxUsers: number;
    features: Record<string, boolean>;
  } | null;
  roomLimitOverride: number | null;
  featureOverrides: Record<string, boolean> | null;
  _count: { rooms: number; reservations: number; users: number };
  users: { role: string; user: { id: string; name: string; email: string; isFirstLogin: boolean } }[];
}

export default function HotelDetailPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [result, setResult] = useState<ResetOwnerPasswordResult["owner"] | null>(null);
  const [copied, setCopied] = useState<"email" | "password" | null>(null);

  // Subscription edit state
  const [subPlanId, setSubPlanId] = useState<string>("");
  const [roomOverride, setRoomOverride] = useState<string>("");
  const [featureOverrides, setFeatureOverrides] = useState<Record<string, boolean>>({});
  const [subSaving, setSubSaving] = useState(false);
  const [subError, setSubError] = useState<string | null>(null);
  const [subSaved, setSubSaved] = useState(false);

  const { data: hotel, isLoading } = useQuery({
    queryKey: ["admin", "hotels", id],
    queryFn: async () => {
      const res = await api.get<{ data: HotelDetail }>(`/api/admin/hotels/${id}`);
      const h = res.data.data;
      // Initialize subscription edit state from fetched data
      setSubPlanId(h.subscriptionPlanId ?? "");
      setRoomOverride(h.roomLimitOverride != null ? String(h.roomLimitOverride) : "");
      setFeatureOverrides(h.featureOverrides ?? {});
      return h;
    },
  });

  const { data: plans = [] } = useQuery<SubscriptionPlan[]>({
    queryKey: ["admin", "plans"],
    queryFn: async () => {
      const res = await api.get<{ data: SubscriptionPlan[] }>("/api/admin/plans");
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

  async function saveSubscription() {
    setSubSaving(true);
    setSubError(null);
    setSubSaved(false);
    try {
      await api.patch(`/api/admin/hotels/${id}`, {
        subscriptionPlanId: subPlanId || null,
        roomLimitOverride: roomOverride ? Number(roomOverride) : null,
        featureOverrides: Object.keys(featureOverrides).length > 0 ? featureOverrides : null,
      });
      setSubSaved(true);
      void qc.invalidateQueries({ queryKey: ["admin", "hotels", id] });
      setTimeout(() => setSubSaved(false), 2000);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setSubError(msg ?? "Failed to save subscription");
    } finally {
      setSubSaving(false);
    }
  }

  const effectiveFeatures = hotel
    ? Object.fromEntries(
        FEATURE_KEYS.map(({ key }) => [
          key,
          key in featureOverrides
            ? featureOverrides[key]
            : (hotel.subscriptionPlan?.features?.[key] ?? false),
        ])
      )
    : {};

  return (
    <AdminLayout>
      <Link to="/hotels" className="text-sm text-gray-500 hover:text-gray-700">
        &larr; Back to Hotels
      </Link>

      {isLoading && <p className="mt-4 text-sm text-gray-500">Loading...</p>}

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
                  {resetPassword.isPending ? "Generating..." : "Generate New One-Time Password"}
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
                      Share these with the owner. Password is shown once only.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Subscription Card */}
            <div className="col-span-2 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-900">Subscription</h2>
              {subError && <p className="mt-2 text-xs text-red-600">{subError}</p>}

              <div className="mt-4 grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Plan</label>
                  <select
                    value={subPlanId}
                    onChange={(e) => setSubPlanId(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">No Plan</option>
                    {plans.map((p) => (
                      <option key={p.id} value={p.id}>{p.name} ({p.slug})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Room Limit Override <span className="text-gray-400">(leave blank to use plan default)</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={roomOverride}
                    onChange={(e) => setRoomOverride(e.target.value)}
                    placeholder="e.g. 20"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="mt-4">
                <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">
                  Feature Overrides <span className="text-gray-400 normal-case">(checked = enabled regardless of plan)</span>
                </h3>
                <div className="grid grid-cols-3 gap-2">
                  {FEATURE_KEYS.map(({ key, label }) => {
                    const planDefault = hotel.subscriptionPlan?.features?.[key] ?? false;
                    const isOverridden = key in featureOverrides;
                    const effectiveValue = effectiveFeatures[key] ?? false;
                    return (
                      <label key={key} className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={effectiveValue}
                          onChange={(e) => {
                            const newOverrides = { ...featureOverrides };
                            if (e.target.checked === planDefault && !isOverridden) {
                              // No change from plan default, remove override
                              delete newOverrides[key];
                            } else {
                              newOverrides[key] = e.target.checked;
                            }
                            setFeatureOverrides(newOverrides);
                          }}
                        />
                        <span className={isOverridden ? "font-semibold text-blue-700" : ""}>{label}</span>
                        {isOverridden && <span className="text-blue-400 text-[10px]">override</span>}
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="mt-4 flex items-center gap-3">
                <button
                  onClick={saveSubscription}
                  disabled={subSaving}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-60"
                >
                  {subSaving ? "Saving..." : subSaved ? "Saved!" : "Save Subscription"}
                </button>
                {Object.keys(featureOverrides).length > 0 && (
                  <button
                    onClick={() => setFeatureOverrides({})}
                    className="px-4 py-2 text-sm border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
                  >
                    Clear All Overrides
                  </button>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </AdminLayout>
  );
}
