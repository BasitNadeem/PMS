import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { ApiError, CreateHotelDto, CreateHotelResult, SubscriptionPlan } from "@/types";
import { getEmailErrorMessage } from "@/lib/validation";

const PROPERTY_TYPES: { value: CreateHotelDto["propertyType"]; label: string }[] = [
  { value: "HOTEL", label: "Hotel" },
  { value: "GUESTHOUSE", label: "Guesthouse" },
  { value: "RESORT", label: "Resort" },
  { value: "LODGE", label: "Lodge" },
];

export default function CreateHotelPage() {
  const [hotelName, setHotelName] = useState("");
  const [subdomain, setSubdomain] = useState("");
  const [propertyType, setPropertyType] = useState<CreateHotelDto["propertyType"]>("HOTEL");
  const [city, setCity] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [subscriptionPlanId, setSubscriptionPlanId] = useState<string>("");

  const [error, setError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<CreateHotelResult | null>(null);
  const [copied, setCopied] = useState<"email" | "password" | null>(null);

  const { data: plans = [] } = useQuery<SubscriptionPlan[]>({
    queryKey: ["admin", "plans"],
    queryFn: async () => {
      const res = await api.get<{ data: SubscriptionPlan[] }>("/api/admin/plans");
      const allPlans = res.data.data;
      // Default to trial plan
      const trial = allPlans.find((p) => p.slug === "trial");
      if (trial && !subscriptionPlanId) {
        setSubscriptionPlanId(trial.id);
      }
      return allPlans;
    },
  });

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const eErr = getEmailErrorMessage(ownerEmail);
    if (eErr) { setEmailError(eErr); return; }
    setEmailError(null);
    setIsSubmitting(true);

    try {
      const res = await api.post<{ data: CreateHotelResult }>("/api/admin/hotels", {
        hotelName,
        subdomain,
        propertyType,
        city: city || undefined,
        ownerName,
        ownerEmail,
        subscriptionPlanId: subscriptionPlanId || undefined,
      });
      setResult(res.data.data);
    } catch (err) {
      if (axios.isAxiosError<ApiError>(err) && err.response?.data?.error) {
        setError(err.response.data.error);
      } else {
        setError("Failed to create hotel");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  function resetForm() {
    setHotelName("");
    setSubdomain("");
    setPropertyType("HOTEL");
    setCity("");
    setOwnerName("");
    setOwnerEmail("");
    setSubscriptionPlanId("");
    setResult(null);
    setError(null);
  }

  function copy(value: string, field: "email" | "password") {
    void navigator.clipboard.writeText(value);
    setCopied(field);
    setTimeout(() => setCopied(null), 1500);
  }

  if (result) {
    return (
      <div className="flex justify-center">
        <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900">Hotel Created Successfully</h2>

          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">Hotel</dt>
              <dd className="font-medium text-gray-900">{result.hotel.name}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">URL</dt>
              <dd className="font-medium text-gray-900">{result.hotel.subdomain}.yourpms.com</dd>
            </div>
          </dl>

          <div className="mt-4 rounded-md bg-gray-50 p-4">
            <p className="text-xs font-semibold uppercase text-gray-500">Owner Credentials</p>

            <div className="mt-2 flex items-center justify-between">
              <span className="text-sm text-gray-900">{result.owner.email}</span>
              <button
                onClick={() => copy(result.owner.email, "email")}
                className="rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100"
              >
                {copied === "email" ? "Copied!" : "Copy"}
              </button>
            </div>

            <div className="mt-2 flex items-center justify-between">
              <span className="text-sm text-gray-900">{result.owner.tempPassword}</span>
              <button
                onClick={() => copy(result.owner.tempPassword, "password")}
                className="rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100"
              >
                {copied === "password" ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>

          <p className="mt-4 text-xs text-amber-700">
            Share these with the owner. Password is shown once only.
          </p>

          <div className="mt-6 flex flex-col gap-2">
            <button
              onClick={resetForm}
              className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Create Another Hotel
            </button>
            <Link
              to="/hotels"
              className="w-full rounded-md border border-gray-300 px-4 py-2 text-center text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Back to Hotels List
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Link to="/hotels" className="text-sm text-gray-500 hover:text-gray-700">
        &larr; Back to Hotels
      </Link>
      <h1 className="mt-2 text-2xl font-bold text-gray-900">Create New Hotel</h1>

      <form onSubmit={handleSubmit} className="mt-6 grid grid-cols-2 gap-8">
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900">Hotel Details</h2>

          <div className="mt-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Hotel name</label>
              <input
                required
                value={hotelName}
                onChange={(e) => setHotelName(e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Subdomain</label>
              <input
                required
                value={subdomain}
                onChange={(e) => setSubdomain(e.target.value.toLowerCase())}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="mt-1 text-xs text-gray-500">
                → {subdomain || "subdomain"}.yourpms.com
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Property type</label>
              <select
                value={propertyType}
                onChange={(e) => setPropertyType(e.target.value as CreateHotelDto["propertyType"])}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {PROPERTY_TYPES.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">City</label>
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Subscription Plan</label>
              <select
                value={subscriptionPlanId}
                onChange={(e) => setSubscriptionPlanId(e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Default (Trial)</option>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900">Owner Account</h2>

          <div className="mt-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Owner full name</label>
              <input
                required
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Owner email</label>
              <input
                type="email"
                required
                value={ownerEmail}
                onChange={(e) => { setOwnerEmail(e.target.value); setEmailError(null); }}
                onBlur={() => setEmailError(ownerEmail.trim() ? getEmailErrorMessage(ownerEmail) : null)}
                className={`mt-1 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${emailError ? "border-red-400" : "border-gray-300"}`}
              />
              {emailError && <p className="mt-1 text-xs text-red-600">{emailError}</p>}
            </div>

            <p className="text-xs text-gray-500">
              A temporary password will be generated automatically.
            </p>
          </div>
        </div>

        <div className="col-span-2">
          {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {isSubmitting ? "Creating..." : "Create Hotel & Generate Credentials"}
          </button>
        </div>
      </form>
    </div>
  );
}
