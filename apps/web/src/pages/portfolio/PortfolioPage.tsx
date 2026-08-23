import { useMutation, useQuery } from "@tanstack/react-query";
import { Navigate } from "react-router-dom";
import {
  ArrowRight, BedDouble, Building2, CalendarArrowDown, CalendarArrowUp,
  CircleDollarSign, Loader2, Sparkles, Wrench,
} from "lucide-react";
import { authService, persistAuthSession } from "@/services/auth";
import { getCurrentUserRole } from "@/lib/jwt";
import { getErrorMessage } from "@/lib/api";

function formatMoney(paisa: number): string {
  return `PKR ${Math.round(paisa / 100).toLocaleString("en-PK")}`;
}

export default function PortfolioPage() {
  const role = getCurrentUserRole();
  const allowed = role === "OWNER" || role === "MANAGER";
  const { data, isPending, error } = useQuery({
    queryKey: ["portfolio"],
    queryFn: authService.getPortfolio,
    enabled: allowed,
    staleTime: 30_000,
  });
  const switchMutation = useMutation({
    mutationFn: authService.switchProperty,
    onSuccess: (session) => {
      persistAuthSession(session);
      window.location.assign("/dashboard");
    },
  });

  if (!allowed) return <Navigate to="/dashboard" replace />;

  if (isPending) {
    return (
      <div className="grid min-h-[60vh] place-items-center text-ink-mute">
        <Loader2 size={28} className="animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-xl2 border border-coral/25 bg-coral-tint p-5 text-[14px] text-coral-deep">
        {getErrorMessage(error, "Could not load your properties.")}
      </div>
    );
  }

  const summaryCards = [
    { label: "Portfolio occupancy", value: `${data.occupancyPercent.toFixed(1)}%`, note: `${data.totals.occupiedRooms} of ${data.totals.sellableRooms} sellable rooms`, icon: BedDouble },
    { label: "Arrivals today", value: data.totals.arrivals.toLocaleString(), note: `${data.totals.departures} departures`, icon: CalendarArrowDown },
    ...(data.financialsVisible ? [{ label: "Collected today", value: formatMoney(data.totals.collected), note: "Across linked properties", icon: CircleDollarSign }] : []),
    { label: "Needs attention", value: (data.totals.dirtyRooms + data.totals.openMaintenance).toLocaleString(), note: `${data.totals.dirtyRooms} dirty · ${data.totals.openMaintenance} maintenance`, icon: Wrench },
  ];

  return (
    <div className="space-y-7">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.17em] text-coral">Owner & manager view</div>
          <h1 className="serif text-[40px] leading-none text-ink">{data.name}</h1>
          <p className="mt-3 text-[14px] text-ink-mute">
            A live operating glance across {data.propertyCount} linked {data.propertyCount === 1 ? "property" : "properties"}.
          </p>
        </div>
        <div className="rounded-full border border-line bg-card px-4 py-2 text-[12px] font-semibold text-ink-mute">
          {new Date(`${data.date}T12:00:00`).toLocaleDateString("en-PK", { day: "numeric", month: "long", year: "numeric" })}
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map(({ label, value, note, icon: Icon }) => (
          <article key={label} className="rounded-xl2 border border-line bg-card p-5 shadow-pop">
            <div className="mb-5 grid h-10 w-10 place-items-center rounded-xl bg-coral-soft text-coral">
              <Icon size={19} />
            </div>
            <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-faint">{label}</div>
            <div className="serif mt-1 text-[29px] leading-tight text-ink">{value}</div>
            <div className="mt-1 text-[12px] text-ink-mute">{note}</div>
          </article>
        ))}
      </section>

      <section>
        <div className="mb-3 flex items-center gap-2">
          <Building2 size={18} className="text-coral" />
          <h2 className="text-[16px] font-bold text-ink">Property performance</h2>
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          {data.properties.map((property) => (
            <article key={property.id} className="rounded-xl2 border border-line bg-card p-5 shadow-pop">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="serif truncate text-[25px] text-ink">{property.name}</h3>
                    {property.isCurrent && (
                      <span className="rounded-full bg-pine-soft px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-pine">Current</span>
                    )}
                  </div>
                  <div className="mt-1 text-[12px] text-ink-mute">
                    {[property.city, property.propertyType.replace(/_/g, " ")].filter(Boolean).join(" · ")} · {property.role === "OWNER" ? "Owner" : "Manager"}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={property.isCurrent || !property.canSwitch || switchMutation.isPending}
                  onClick={() => { if (property.canSwitch) switchMutation.mutate(property.id); }}
                  className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full border border-line px-4 text-[12px] font-bold text-ink transition-colors hover:border-coral/35 hover:text-coral disabled:cursor-default disabled:opacity-45"
                >
                  {switchMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : null}
                  {property.isCurrent ? "Open now" : property.canSwitch ? "Open property" : "View only"}<ArrowRight size={14} />
                </button>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {data.financialsVisible && <div className="rounded-xl border border-line-soft bg-mist p-3">
                  <div className="text-[10px] font-bold uppercase tracking-wide text-ink-faint">Occupancy</div>
                  <div className="mt-1 text-[18px] font-bold text-ink">{property.occupancyPercent.toFixed(1)}%</div>
                </div>}
                <div className="rounded-xl border border-line-soft bg-mist p-3">
                  <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-ink-faint"><CalendarArrowUp size={11} /> Movement</div>
                  <div className="mt-1 text-[18px] font-bold text-ink">{property.arrivals} / {property.departures}</div>
                </div>
                <div className="rounded-xl border border-line-soft bg-mist p-3">
                  <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-ink-faint"><Sparkles size={11} /> Dirty</div>
                  <div className="mt-1 text-[18px] font-bold text-ink">{property.rooms.dirty}</div>
                </div>
                <div className="rounded-xl border border-line-soft bg-mist p-3">
                  <div className="text-[10px] font-bold uppercase tracking-wide text-ink-faint">Collected</div>
                  <div className="mt-1 truncate text-[15px] font-bold text-ink">{formatMoney(property.collected)}</div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {switchMutation.error && (
        <div className="rounded-xl border border-coral/25 bg-coral-tint px-4 py-3 text-[13px] text-coral-deep">
          {getErrorMessage(switchMutation.error, "Could not switch property.")}
        </div>
      )}
    </div>
  );
}
