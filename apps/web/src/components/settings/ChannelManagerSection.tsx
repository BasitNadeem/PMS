/**
 * Channel Manager (Channex) settings panel — OWNER only.
 *
 * Rendered by SettingsPage behind the same `ownerOnly` filter plus inline
 * `isOwner` guard every other privileged section uses.
 *
 * Two things this deliberately does NOT hide:
 *   - Rate plans excluded from distribution, each with its reason. An owner who
 *     cannot see "4 excluded (corporate)" would conclude the integration is
 *     broken when it is in fact protecting their negotiated rates.
 *   - Overbooking alerts, kept visually distinct from ordinary failures. An OTA
 *     selling a room the property does not have needs a human, not a retry.
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle, CheckCircle2, RefreshCw, Link2, XCircle, Info,
} from "lucide-react";
import { cn } from "@/lib/cn";
import {
  settingsService,
  type ChannelManagerStatus,
  type ChannexIngestionAlert,
  type ProvisionResult,
} from "@/services/settings";

export interface ChannelManagerSectionProps {
  /** Shared with the rest of SettingsPage so styling stays identical. */
  labelCls: string;
  onToast: (message: string, tone: "success" | "error") => void;
  className?: string;
}

const CHANNEL_MANAGER_KEY = ["settings", "channel-manager"] as const;

function StatusPill({ tone, children }: { tone: "ok" | "warn" | "bad" | "idle"; children: React.ReactNode }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12.5px] font-semibold",
      tone === "ok"   && "bg-emerald-50 text-emerald-700",
      tone === "warn" && "bg-amber-50 text-amber-700",
      tone === "bad"  && "bg-red-50 text-red-700",
      tone === "idle" && "bg-gray-100 text-gray-600",
    )}>
      {children}
    </span>
  );
}

function AlertRow({
  alert, onAcknowledge, acknowledging,
}: {
  alert: ChannexIngestionAlert;
  onAcknowledge: (id: string) => void;
  acknowledging: boolean;
}) {
  const isOverbooking = alert.kind === "OVERBOOKING";
  return (
    <li className={cn(
      "flex items-start gap-3 rounded-xl border p-3",
      isOverbooking ? "border-red-200 bg-red-50/60" : "border-gray-200 bg-gray-50/60",
    )}>
      {isOverbooking
        ? <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-red-600" />
        : <XCircle className="h-4 w-4 shrink-0 mt-0.5 text-gray-500" />}
      <div className="min-w-0 flex-1">
        <p className={cn("text-[13.5px] font-semibold", isOverbooking ? "text-red-800" : "text-ink")}>
          {isOverbooking ? "Overbooking — needs action" : "Booking could not be imported"}
        </p>
        <p className="text-[13px] text-ink/70 break-words">{alert.message}</p>
        <p className="mt-1 text-[11.5px] text-ink/45">
          {alert.eventType} · via {alert.origin.toLowerCase()} · {alert.attempts} attempt
          {alert.attempts === 1 ? "" : "s"} · {new Date(alert.receivedAt).toLocaleString()}
        </p>
      </div>
      <button
        type="button"
        disabled={acknowledging}
        onClick={() => onAcknowledge(alert.id)}
        className="shrink-0 rounded-full border border-gray-300 px-3 py-1 text-[12px] font-semibold text-ink/70 hover:bg-white disabled:opacity-50"
      >
        Dismiss
      </button>
    </li>
  );
}

export function ChannelManagerSection({ labelCls, onToast, className }: ChannelManagerSectionProps) {
  const qc = useQueryClient();
  const [selectedPlanIds, setSelectedPlanIds] = useState<string[]>([]);
  const [lastProvision, setLastProvision] = useState<ProvisionResult | null>(null);

  const { data: status, isLoading } = useQuery<ChannelManagerStatus>({
    queryKey: CHANNEL_MANAGER_KEY,
    queryFn:  settingsService.getChannelManager,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: CHANNEL_MANAGER_KEY });

  const provisionMutation = useMutation({
    mutationFn: () => settingsService.provisionChannelManager(selectedPlanIds),
    onSuccess: (result) => {
      setLastProvision(result);
      invalidate();
      if (result.success) onToast("Property synced to the channel manager", "success");
      else if (!result.missingFields) onToast(result.error ?? "Provisioning failed", "error");
    },
    onError: () => onToast("Provisioning failed", "error"),
  });

  const toggleMutation = useMutation({
    mutationFn: settingsService.updateChannelManager,
    onSuccess: () => { invalidate(); onToast("Channel settings updated", "success"); },
    onError:   () => onToast("Could not update channel settings", "error"),
  });

  const syncMutation = useMutation({
    mutationFn: settingsService.syncChannelManagerNow,
    onSuccess: () => { invalidate(); onToast("Sync queued", "success"); },
    onError:   () => onToast("Could not queue a sync", "error"),
  });

  const ackMutation = useMutation({
    mutationFn: settingsService.acknowledgeChannelAlert,
    onSuccess: () => invalidate(),
    onError:   () => onToast("Could not dismiss the alert", "error"),
  });

  if (isLoading || !status) {
    return <div className={cn("text-[13.5px] text-ink/50", className)}>Loading channel manager…</div>;
  }

  const { validation, summary, ingestionAlerts } = status;
  const eligiblePlans = status.ratePlans.filter((p) => p.eligible);
  const excludedPlans = status.ratePlans.filter((p) => !p.eligible);

  return (
    <div className={cn("space-y-6", className)}>
      {/* ── Overbooking first: the only thing here that can cost a guest ───── */}
      {ingestionAlerts.overbookingCount > 0 && (
        <div className="rounded-2xl border border-red-300 bg-red-50 p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <h3 className="text-[15px] font-bold text-red-800">
              {ingestionAlerts.overbookingCount} overbooking
              {ingestionAlerts.overbookingCount === 1 ? "" : "s"} need attention
            </h3>
          </div>
          <p className="mt-1 text-[13px] text-red-700">
            A channel sold a room that is not available. The guest holds a confirmed
            booking — move a guest or open inventory, then dismiss.
          </p>
          <ul className="mt-3 space-y-2">
            {ingestionAlerts.overbookings.map((alert) => (
              <AlertRow
                key={alert.id} alert={alert}
                onAcknowledge={(id) => ackMutation.mutate(id)}
                acknowledging={ackMutation.isPending}
              />
            ))}
          </ul>
        </div>
      )}

      {/* ── Connection ──────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-gray-200 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-[15px] font-bold text-ink">Connection</h3>
            <p className="text-[13px] text-ink/60">
              Distributes availability and rates to Booking.com, Airbnb, Expedia and
              others, and imports their bookings.
            </p>
          </div>
          {status.provisioned
            ? status.isActive
              ? <StatusPill tone="ok"><CheckCircle2 className="h-3.5 w-3.5" /> Connected</StatusPill>
              : <StatusPill tone="warn">Provisioned · paused</StatusPill>
            : <StatusPill tone="idle">Not connected</StatusPill>}
        </div>

        {/* ── Missing-field checklist: never a bare refusal ─────────────────── */}
        {!validation.valid && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
            <p className="flex items-center gap-2 text-[13.5px] font-semibold text-amber-900">
              <Info className="h-4 w-4" />
              Add these before connecting
            </p>
            <ul className="mt-2 space-y-1">
              {validation.missing.map((field) => (
                <li key={field} className="flex items-baseline justify-between gap-3 text-[13px]">
                  <span className="font-medium text-amber-900">{field}</span>
                  <span className="text-[12px] text-amber-700">
                    {status.fieldLocations[field] ?? "Hotel Profile"}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[12px] text-amber-700">
              Channex will not connect a property to any OTA until all of these are set.
            </p>
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={provisionMutation.isPending || !validation.valid}
            onClick={() => provisionMutation.mutate()}
            className="inline-flex items-center gap-2 rounded-full bg-ink px-5 h-10 text-[13.5px] font-semibold text-white disabled:opacity-40"
          >
            <Link2 className="h-4 w-4" />
            {status.provisioned ? "Re-sync structure" : "Connect / Provision"}
          </button>
          <button
            type="button"
            disabled={!status.provisioned || !status.isActive || syncMutation.isPending}
            onClick={() => syncMutation.mutate()}
            className="inline-flex items-center gap-2 rounded-full border border-gray-300 px-5 h-10 text-[13.5px] font-semibold text-ink disabled:opacity-40"
          >
            <RefreshCw className={cn("h-4 w-4", syncMutation.isPending && "animate-spin")} />
            Sync now
          </button>
        </div>

        {lastProvision?.missingFields && (
          <p className="mt-3 text-[13px] text-amber-800">
            Provisioning stopped — {lastProvision.missingFields.length} field
            {lastProvision.missingFields.length === 1 ? "" : "s"} still missing.
          </p>
        )}
      </div>

      {/* ── Sync direction toggles ──────────────────────────────────────────── */}
      {status.provisioned && (
        <div className="rounded-2xl border border-gray-200 p-4 space-y-3">
          <h3 className="text-[15px] font-bold text-ink">What gets sent</h3>
          {([
            ["isActive", "Channel manager active", "Master switch. When off, nothing is sent or imported.", status.isActive],
            ["syncInventory", "Send availability", "Room counts per date, after subtracting existing bookings.", status.syncInventory],
            ["syncRates", "Send rates", "Nightly prices for rate plans you have selected for distribution.", status.syncRates],
          ] as const).map(([key, title, help, value]) => (
            <label key={key} className="flex items-start justify-between gap-4 cursor-pointer">
              <span>
                <span className="block text-[13.5px] font-semibold text-ink">{title}</span>
                <span className="block text-[12.5px] text-ink/55">{help}</span>
              </span>
              <input
                type="checkbox"
                checked={value}
                disabled={toggleMutation.isPending}
                onChange={(e) => toggleMutation.mutate({ [key]: e.target.checked })}
                className="mt-1 h-5 w-5 shrink-0 accent-ink cursor-pointer"
              />
            </label>
          ))}
        </div>
      )}

      {/* ── Mapping ─────────────────────────────────────────────────────────── */}
      {status.provisioned && (
        <div className="rounded-2xl border border-gray-200 p-4">
          <h3 className="text-[15px] font-bold text-ink">What is being distributed</h3>
          <p className="mt-1 text-[13px] text-ink/60">
            {summary.roomTypesSynced} of {summary.roomTypesTotal} room types ·{" "}
            {summary.ratePlansSynced} of {summary.ratePlansEligible} eligible rate plans synced
            {summary.ratePlansExcluded > 0 && `, ${summary.ratePlansExcluded} excluded`}
          </p>

          <div className="mt-3">
            <label className={labelCls}>Room types</label>
            <ul className="mt-1 space-y-1">
              {status.roomTypes.map((rt) => (
                <li key={rt.id} className="flex items-center justify-between text-[13px]">
                  <span className="text-ink">{rt.name}</span>
                  {rt.synced
                    ? <StatusPill tone="ok">Synced</StatusPill>
                    : <StatusPill tone="idle">Not synced</StatusPill>}
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-4">
            <label className={labelCls}>Rate plans available for OTAs</label>
            {eligiblePlans.length === 0 && (
              <p className="text-[13px] text-ink/55">No rate plans are eligible for distribution.</p>
            )}
            <ul className="mt-1 space-y-1">
              {eligiblePlans.map((plan) => (
                <li key={plan.id} className="flex items-center justify-between gap-3 text-[13px]">
                  <label className="flex items-center gap-2 cursor-pointer min-w-0">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-ink"
                      checked={plan.synced || selectedPlanIds.includes(plan.id)}
                      disabled={plan.synced}
                      onChange={(e) => setSelectedPlanIds((prev) => (
                        e.target.checked ? [...prev, plan.id] : prev.filter((id) => id !== plan.id)
                      ))}
                    />
                    <span className="truncate text-ink">{plan.name}</span>
                    <span className="text-[11.5px] text-ink/40">
                      {plan.pairs.length} room type{plan.pairs.length === 1 ? "" : "s"}
                    </span>
                  </label>
                  {plan.synced
                    ? <StatusPill tone="ok">Synced</StatusPill>
                    : plan.partiallySynced
                      ? <StatusPill tone="warn">Partial</StatusPill>
                      : <StatusPill tone="idle">Select to distribute</StatusPill>}
                </li>
              ))}
            </ul>
          </div>

          {/* Excluded plans are shown, with the reason — never silently dropped. */}
          {excludedPlans.length > 0 && (
            <div className="mt-4">
              <label className={labelCls}>Excluded from OTAs ({excludedPlans.length})</label>
              <ul className="mt-1 space-y-1">
                {excludedPlans.map((plan) => (
                  <li key={plan.id} className="flex items-baseline justify-between gap-3 text-[13px]">
                    <span className="truncate text-ink/70">{plan.name}</span>
                    <span className="shrink-0 text-[12px] text-ink/45">{plan.exclusionLabel}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[12px] text-ink/50">
                Private company contracts and code-restricted rates are never published
                to public channels.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Last sync ───────────────────────────────────────────────────────── */}
      {status.provisioned && (
        <div className="rounded-2xl border border-gray-200 p-4">
          <h3 className="text-[15px] font-bold text-ink">Last sync</h3>
          <dl className="mt-2 space-y-1 text-[13px]">
            <div className="flex justify-between gap-3">
              <dt className="text-ink/55">When</dt>
              <dd className="text-ink">
                {status.lastSyncAt ? new Date(status.lastSyncAt).toLocaleString() : "Never"}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-ink/55">Result</dt>
              <dd>
                {status.lastSyncStatus === "OK"      && <StatusPill tone="ok">OK</StatusPill>}
                {status.lastSyncStatus === "PARTIAL" && <StatusPill tone="warn">Accepted with warnings</StatusPill>}
                {status.lastSyncStatus === "FAILED"  && <StatusPill tone="bad">Failed</StatusPill>}
                {status.lastSyncStatus === "RATE_LIMITED" && <StatusPill tone="warn">Rate limited</StatusPill>}
                {!status.lastSyncStatus && <StatusPill tone="idle">—</StatusPill>}
              </dd>
            </div>
          </dl>
          {status.lastSyncError && (
            <p className="mt-2 rounded-xl bg-amber-50 p-2 text-[12.5px] text-amber-800 break-words">
              {status.lastSyncError}
            </p>
          )}
        </div>
      )}

      {/* ── Non-overbooking import failures ─────────────────────────────────── */}
      {ingestionAlerts.failureCount > 0 && (
        <div className="rounded-2xl border border-gray-200 p-4">
          <h3 className="text-[15px] font-bold text-ink">
            Import problems ({ingestionAlerts.failureCount})
          </h3>
          <p className="mt-1 text-[13px] text-ink/60">
            Bookings the channel sent that could not be saved. These are technical
            failures, not overbookings.
          </p>
          <ul className="mt-3 space-y-2">
            {ingestionAlerts.failures.map((alert) => (
              <AlertRow
                key={alert.id} alert={alert}
                onAcknowledge={(id) => ackMutation.mutate(id)}
                acknowledging={ackMutation.isPending}
              />
            ))}
          </ul>
        </div>
      )}

      <p className="text-[12.5px] text-ink/45">
        Connecting individual OTAs is done in the Channex dashboard once this
        property is provisioned.
      </p>
    </div>
  );
}
