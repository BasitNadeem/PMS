import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { ApiError, PortfolioCandidateHotel, PropertyPortfolio, PortfolioSwitchPolicy } from "@/types";
import type { AxiosError } from "axios";

interface AccessDraft {
  userId: string;
  homeHotelId: string;
  canViewPortfolio: boolean;
  canSwitchProperties: boolean;
  canViewFinancials: boolean;
  allProperties: boolean;
  hotelIds: string[];
  isActive: boolean;
}

export default function PortfolioEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [switchPolicy, setSwitchPolicy] = useState<PortfolioSwitchPolicy>("OWNERS_ONLY");
  const [isActive, setIsActive] = useState(true);
  const [hotelIds, setHotelIds] = useState<string[]>([]);
  const [accesses, setAccesses] = useState<AccessDraft[]>([]);
  const [error, setError] = useState("");

  const candidates = useQuery({
    queryKey: ["admin", "portfolio-candidates"],
    queryFn: async () => (await api.get<{ data: PortfolioCandidateHotel[] }>("/api/admin/portfolios/candidates")).data.data,
  });
  const portfolio = useQuery({
    queryKey: ["admin", "portfolio", id],
    enabled: Boolean(id),
    queryFn: async () => (await api.get<{ data: PropertyPortfolio }>(`/api/admin/portfolios/${id}`)).data.data,
  });

  useEffect(() => {
    if (!portfolio.data) return;
    setName(portfolio.data.name);
    setSwitchPolicy(portfolio.data.switchPolicy);
    setIsActive(portfolio.data.isActive);
    setHotelIds(portfolio.data.properties.map((row) => row.hotelId));
    setAccesses(portfolio.data.accesses.map((access) => ({
      userId: access.userId,
      homeHotelId: access.homeHotelId,
      canViewPortfolio: access.canViewPortfolio,
      canSwitchProperties: access.canSwitchProperties,
      canViewFinancials: access.canViewFinancials,
      allProperties: access.allProperties,
      hotelIds: access.propertyGrants?.map((row) => row.hotelId) ?? [],
      isActive: access.isActive,
    })));
  }, [portfolio.data]);

  const accounts = useMemo(() => {
    const byUser = new Map<string, { user: PortfolioCandidateHotel["users"][number]["user"]; memberships: Array<{ hotelId: string; hotelName: string; role: "OWNER" | "MANAGER" }> }>();
    for (const hotel of candidates.data ?? []) {
      if (!hotelIds.includes(hotel.id)) continue;
      for (const membership of hotel.users) {
        const row = byUser.get(membership.user.id) ?? { user: membership.user, memberships: [] };
        row.memberships.push({ hotelId: hotel.id, hotelName: hotel.name, role: membership.role });
        byUser.set(membership.user.id, row);
      }
    }
    return [...byUser.values()];
  }, [candidates.data, hotelIds]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = { name, switchPolicy, isActive, hotelIds, accesses };
      return id ? api.put(`/api/admin/portfolios/${id}`, payload) : api.post("/api/admin/portfolios", payload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "portfolios"] });
      navigate("/portfolios");
    },
    onError: (requestError: AxiosError<ApiError>) => setError(requestError.response?.data.error ?? "Could not save portfolio"),
  });

  function toggleHotel(hotelId: string) {
    setHotelIds((current) => current.includes(hotelId) ? current.filter((value) => value !== hotelId) : [...current, hotelId]);
    setAccesses((current) => current.filter((access) => access.homeHotelId !== hotelId));
  }

  function toggleAccount(userId: string) {
    const existing = accesses.find((access) => access.userId === userId);
    if (existing) return setAccesses((current) => current.filter((access) => access.userId !== userId));
    const account = accounts.find((row) => row.user.id === userId);
    if (!account) return;
    setAccesses((current) => [...current, {
      userId,
      homeHotelId: account.memberships[0].hotelId,
      canViewPortfolio: true,
      canSwitchProperties: true,
      canViewFinancials: true,
      allProperties: true,
      hotelIds: [],
      isActive: true,
    }]);
  }

  function updateAccess(userId: string, patch: Partial<AccessDraft>) {
    setAccesses((current) => current.map((access) => access.userId === userId ? { ...access, ...patch } : access));
  }

  return (
    <div className="mx-auto max-w-5xl">
      <button onClick={() => navigate("/portfolios")} className="text-sm font-medium text-gray-500 hover:text-gray-900">&larr; Back to portfolios</button>
      <div className="mt-4 flex items-start justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900">{id ? "Manage portfolio" : "Link properties"}</h1><p className="mt-1 text-sm text-gray-500">Every hotel and login remains independent. These grants only enable explicitly approved cross-property access.</p></div>
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700"><input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} /> Active</label>
      </div>
      {error && <div className="mt-5 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <section className="mt-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="font-semibold text-gray-900">Portfolio details</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="text-sm font-medium text-gray-700">Name<input value={name} onChange={(event) => setName(event.target.value)} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2" placeholder="Northern Properties" /></label>
          <label className="text-sm font-medium text-gray-700">Switching policy<select value={switchPolicy} onChange={(event) => setSwitchPolicy(event.target.value as PortfolioSwitchPolicy)} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"><option value="OWNERS_ONLY">Owners only</option><option value="OWNERS_AND_MANAGERS">Owners and managers</option><option value="SELECTED_ACCOUNTS">Only selected accounts</option></select></label>
        </div>
      </section>

      <section className="mt-5 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="font-semibold text-gray-900">1. Linked properties</h2><p className="mt-1 text-sm text-gray-500">Choose at least two properties. A property can belong to one portfolio only.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {(candidates.data ?? []).map((hotel) => {
            const unavailable = Boolean(hotel.portfolioProperty && hotel.portfolioProperty.portfolioId !== id);
            return <label key={hotel.id} className={`flex gap-3 rounded-lg border p-4 ${unavailable ? "cursor-not-allowed bg-gray-50 opacity-60" : "cursor-pointer"}`}><input type="checkbox" disabled={unavailable} checked={hotelIds.includes(hotel.id)} onChange={() => toggleHotel(hotel.id)} /><span><span className="block font-medium text-gray-900">{hotel.name}</span><span className="block text-xs text-gray-500">{hotel.slug}{hotel.city ? ` · ${hotel.city}` : ""}</span>{unavailable && <span className="mt-1 block text-xs text-amber-700">Already in {hotel.portfolioProperty?.portfolio.name}</span>}</span></label>;
          })}
        </div>
      </section>

      <section className="mt-5 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="font-semibold text-gray-900">2. Authorized owner and manager accounts</h2><p className="mt-1 text-sm text-gray-500">Select exact accounts. Their existing login continues to open its home property.</p>
        <div className="mt-4 space-y-4">
          {accounts.length === 0 && <p className="rounded-lg bg-gray-50 p-4 text-sm text-gray-500">Select properties above to see their owners and managers.</p>}
          {accounts.map((account) => {
            const access = accesses.find((row) => row.userId === account.user.id);
            return <div key={account.user.id} className="rounded-lg border border-gray-200 p-4">
              <label className="flex cursor-pointer items-start gap-3"><input type="checkbox" checked={Boolean(access)} onChange={() => toggleAccount(account.user.id)} className="mt-1" /><span><span className="block font-semibold text-gray-900">{account.user.name}</span><span className="block text-sm text-gray-500">{account.user.email}</span></span></label>
              {access && <div className="mt-4 border-t border-gray-100 pt-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="text-sm font-medium text-gray-700">Home property<select value={access.homeHotelId} onChange={(event) => updateAccess(access.userId, { homeHotelId: event.target.value })} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2">{account.memberships.map((membership) => <option key={membership.hotelId} value={membership.hotelId}>{membership.hotelName} · {membership.role.toLowerCase()}</option>)}</select></label>
                  <label className="text-sm font-medium text-gray-700">Property scope<select value={access.allProperties ? "ALL" : "SELECTED"} onChange={(event) => updateAccess(access.userId, { allProperties: event.target.value === "ALL", hotelIds: event.target.value === "ALL" ? [] : [access.homeHotelId] })} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"><option value="ALL">All linked properties</option><option value="SELECTED">Selected properties only</option></select></label>
                </div>
                {!access.allProperties && <div className="mt-3 flex flex-wrap gap-3">{(candidates.data ?? []).filter((hotel) => hotelIds.includes(hotel.id)).map((hotel) => <label key={hotel.id} className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={access.hotelIds.includes(hotel.id) || hotel.id === access.homeHotelId} disabled={hotel.id === access.homeHotelId} onChange={() => updateAccess(access.userId, { hotelIds: access.hotelIds.includes(hotel.id) ? access.hotelIds.filter((value) => value !== hotel.id) : [...access.hotelIds, hotel.id] })} />{hotel.name}</label>)}</div>}
                <div className="mt-4 flex flex-wrap gap-5 text-sm text-gray-700"><label className="flex items-center gap-2"><input type="checkbox" checked={access.canViewPortfolio} onChange={(event) => updateAccess(access.userId, { canViewPortfolio: event.target.checked })} />Portfolio overview</label><label className="flex items-center gap-2"><input type="checkbox" checked={access.canSwitchProperties} onChange={(event) => updateAccess(access.userId, { canSwitchProperties: event.target.checked })} />Switch properties</label><label className="flex items-center gap-2"><input type="checkbox" checked={access.canViewFinancials} onChange={(event) => updateAccess(access.userId, { canViewFinancials: event.target.checked })} />Portfolio financials</label></div>
              </div>}
            </div>;
          })}
        </div>
      </section>

      <div className="mt-6 flex justify-end gap-3"><button onClick={() => navigate("/portfolios")} className="rounded-md border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700">Cancel</button><button disabled={save.isPending || hotelIds.length < 2 || accesses.length === 0 || name.trim().length < 2} onClick={() => { setError(""); save.mutate(); }} className="rounded-md bg-blue-600 px-5 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50">{save.isPending ? "Saving…" : "Save portfolio"}</button></div>
    </div>
  );
}
