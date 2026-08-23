import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { api } from "@/lib/api";
import type { PropertyPortfolio } from "@/types";

export default function PortfoliosPage() {
  const { data = [], isLoading } = useQuery({
    queryKey: ["admin", "portfolios"],
    queryFn: async () => (await api.get<{ data: PropertyPortfolio[] }>("/api/admin/portfolios")).data.data,
  });

  return (
    <AdminLayout>
      <div className="flex items-start justify-between gap-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Property portfolios</h1>
          <p className="mt-1 text-sm text-gray-500">Support-managed links between independent hotel accounts.</p>
        </div>
        <Link to="/portfolios/new" className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          + Link properties
        </Link>
      </div>

      <div className="mt-6 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr><th className="px-4 py-3">Portfolio</th><th className="px-4 py-3">Properties</th><th className="px-4 py-3">Authorized accounts</th><th className="px-4 py-3">Policy</th><th className="px-4 py-3">Status</th><th className="px-4 py-3" /></tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading && <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-500">Loading portfolios…</td></tr>}
            {!isLoading && data.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-500">No properties are linked yet.</td></tr>}
            {data.map((portfolio) => (
              <tr key={portfolio.id}>
                <td className="px-4 py-4 font-semibold text-gray-900">{portfolio.name}</td>
                <td className="px-4 py-4 text-gray-600">{portfolio.properties.length}</td>
                <td className="px-4 py-4 text-gray-600">{portfolio.accesses.filter((access) => access.isActive).length}</td>
                <td className="px-4 py-4 text-gray-600">{portfolio.switchPolicy.replace(/_/g, " ").toLowerCase()}</td>
                <td className="px-4 py-4"><span className={`rounded-full px-2 py-1 text-xs font-medium ${portfolio.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>{portfolio.isActive ? "Active" : "Paused"}</span></td>
                <td className="px-4 py-4 text-right"><Link to={`/portfolios/${portfolio.id}`} className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">Manage</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminLayout>
  );
}
