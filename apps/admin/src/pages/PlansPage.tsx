import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { api } from "@/lib/api";
import type { PlanMetadata, SubscriptionPlan } from "@/types";

type Plan = SubscriptionPlan;

type PlanForm = {
  name: string;
  slug: string;
  priceMonthly: string;
  limits: Record<string, string>;
  features: Record<string, boolean>;
  isActive: boolean;
  displayOrder: string;
};

function defaultForm(metadata: PlanMetadata, plan?: Plan): PlanForm {
  const features = Object.fromEntries(metadata.features.map(({ key }) => [key, plan?.features?.[key] ?? false]));
  const limits = Object.fromEntries(metadata.limits.map(({ key }) => [
    key,
    plan?.limits?.[key] == null ? "" : String(plan.limits[key]),
  ]));
  return {
    name:         plan?.name         ?? "",
    slug:         plan?.slug         ?? "",
    priceMonthly: plan ? String(Math.round(plan.priceMonthly / 100)) : "",
    limits,
    features,
    isActive:     plan?.isActive     ?? true,
    displayOrder: plan ? String(plan.displayOrder) : "0",
  };
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function PlanFormModal({
  plan,
  metadata,
  onClose,
  onSaved,
}: {
  plan?: Plan;
  metadata: PlanMetadata;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<PlanForm>(() => defaultForm(metadata, plan));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function setField<K extends keyof PlanForm>(key: K, value: PlanForm[K]) {
    setForm((f) => ({
      ...f,
      [key]: value,
      ...(key === "name" && !plan ? { slug: slugify(value as string) } : {}),
    }));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name:         form.name,
        slug:         form.slug,
        priceMonthly: Math.round(Number(form.priceMonthly) * 100),
        limits: Object.fromEntries(Object.entries(form.limits).map(([key, value]) => [
          key,
          value.trim() === "" ? null : Number(value),
        ])),
        features:     form.features,
        isActive:     form.isActive,
        displayOrder: Number(form.displayOrder),
      };
      if (plan) {
        await api.patch(`/api/admin/plans/${plan.id}`, payload);
      } else {
        await api.post("/api/admin/plans", payload);
      }
      onSaved();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg ?? "Failed to save plan");
    } finally {
      setSaving(false);
    }
  }

  const builtFeatures = metadata.features.filter((f) => f.built);
  const comingSoon = metadata.features.filter((f) => !f.built);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-lg font-bold text-gray-900">{plan ? "Edit Plan" : "Create Plan"}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">&#x2715;</button>
        </div>

        <div className="p-6 space-y-4">
          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Plan Name</label>
              <input value={form.name} onChange={(e) => setField("name", e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Slug</label>
              <input value={form.slug} onChange={(e) => setField("slug", e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Price (PKR/month)</label>
              <input type="number" min="0" value={form.priceMonthly} onChange={(e) => setField("priceMonthly", e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Display Order</label>
              <input type="number" min="0" value={form.displayOrder} onChange={(e) => setField("displayOrder", e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            {metadata.limits.map(({ key, label, minimum }) => (
              <div key={key}>
                <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
                <input type="number" min={minimum} value={form.limits[key] ?? ""}
                  onChange={(e) => setField("limits", { ...form.limits, [key]: e.target.value })}
                  placeholder="Unlimited"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <p className="mt-1 text-[11px] text-gray-400">Leave blank for unlimited.</p>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <input type="checkbox" id="isActive" checked={form.isActive} onChange={(e) => setField("isActive", e.target.checked)} />
            <label htmlFor="isActive" className="text-sm text-gray-700">Active (visible for assignment)</label>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">Built Features</h3>
            <div className="grid grid-cols-2 gap-2">
              {builtFeatures.map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input type="checkbox" checked={form.features[key] ?? false}
                    onChange={(e) => setField("features", { ...form.features, [key]: e.target.checked })} />
                  {label}
                </label>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Coming Soon</h3>
            <div className="grid grid-cols-2 gap-2">
              {comingSoon.map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 text-sm text-gray-500 cursor-pointer">
                  <input type="checkbox" checked={form.features[key] ?? false}
                    onChange={(e) => setField("features", { ...form.features, [key]: e.target.checked })} />
                  {label}
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 pb-6">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-60">
            {saving ? "Saving..." : "Save Plan"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PlansPage() {
  const qc = useQueryClient();
  const [modal, setModal] = useState<{ open: boolean; plan?: Plan }>({ open: false });

  const { data: plans = [], isLoading } = useQuery<Plan[]>({
    queryKey: ["admin", "plans"],
    queryFn: async () => {
      const res = await api.get<{ data: Plan[] }>("/api/admin/plans");
      return res.data.data;
    },
  });
  const { data: metadata } = useQuery<PlanMetadata>({
    queryKey: ["admin", "plans", "meta"],
    queryFn: async () => {
      const res = await api.get<{ data: PlanMetadata }>("/api/admin/plans/meta");
      return res.data.data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/api/admin/plans/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "plans"] }),
  });

  function onSaved() {
    setModal({ open: false });
    void qc.invalidateQueries({ queryKey: ["admin", "plans"] });
  }

  return (
    <AdminLayout>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Subscription Plans</h1>
        <button
          onClick={() => setModal({ open: true })}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          + Create Plan
        </button>
      </div>

      <div className="mt-6 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Price</th>
              <th className="px-4 py-3">Rooms</th>
              <th className="px-4 py-3">Users</th>
              <th className="px-4 py-3">Hotels Using</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Loading...</td></tr>
            )}
            {plans.map((plan) => (
              <tr key={plan.id}>
                <td className="px-4 py-3 font-medium text-gray-900">{plan.name} <span className="text-gray-400 text-xs">/{plan.slug}</span></td>
                <td className="px-4 py-3 text-gray-600">PKR {Math.round(plan.priceMonthly / 100).toLocaleString()}/mo</td>
                <td className="px-4 py-3 text-gray-600">{plan.limits.maxRooms ?? "Unlimited"}</td>
                <td className="px-4 py-3 text-gray-600">{plan.limits.maxUsers ?? "Unlimited"}</td>
                <td className="px-4 py-3 text-gray-600">{plan._count.hotels}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-1 text-xs font-medium ${plan.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                    {plan.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button onClick={() => setModal({ open: true, plan })}
                      className="rounded-md border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50">
                      Edit
                    </button>
                    <button
                      onClick={() => { if (confirm(`Delete plan "${plan.name}"?`)) deleteMutation.mutate(plan.id); }}
                      disabled={plan._count.hotels > 0}
                      className="rounded-md border border-red-200 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed"
                      title={plan._count.hotels > 0 ? `${plan._count.hotels} hotel(s) assigned` : ""}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal.open && metadata && (
        <PlanFormModal
          plan={modal.plan}
          metadata={metadata}
          onClose={() => setModal({ open: false })}
          onSaved={onSaved}
        />
      )}
    </AdminLayout>
  );
}
