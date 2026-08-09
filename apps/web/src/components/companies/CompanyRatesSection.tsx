import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarRange, Check, Copy, Pencil, Plus, Power, PowerOff, Tag, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { getErrorMessage } from "@/lib/api";
import { companiesService, type CompanyDetail } from "@/services/companies";
import {
  ratePlansService,
  type CreateRatePlanDto,
  type RatePlan,
  type RatePlanType,
} from "@/services/ratePlans";
import { roomsService } from "@/services/rooms";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { DatePicker } from "@/components/ui/DatePicker";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const inputCls = "h-10 w-full rounded-xl border border-line bg-white px-3.5 text-[13.5px] text-ink outline-none transition-all focus:border-coral focus:ring-2 focus:ring-coral/15";

function pkr(paisa: number): string {
  return `PKR ${Math.round(paisa / 100).toLocaleString("en-PK")}`;
}

function dateLabel(value: string | null): string {
  if (!value) return "Open";
  return new Intl.DateTimeFormat("en-PK", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
}

function companyRateType(company: CompanyDetail): RatePlanType {
  return company.type === "TOUR_AGENCY" ? "TRAVEL_AGENT" : "CORPORATE";
}

function ContractModal({ company, plan, duplicate, onClose }: {
  company: CompanyDetail;
  plan?: RatePlan;
  duplicate?: boolean;
  onClose: () => void;
}) {
  useEscapeKey(onClose);
  const qc = useQueryClient();
  const { data: roomTypeData } = useQuery({ queryKey: ["room-types"], queryFn: roomsService.getRoomTypes });
  const roomTypes = roomTypeData?.data ?? [];

  const [name, setName] = useState(plan ? `${plan.name}${duplicate ? " copy" : ""}` : "");
  const [validFrom, setValidFrom] = useState(plan?.validFrom?.slice(0, 10) ?? "");
  const [validTo, setValidTo] = useState(plan?.validTo?.slice(0, 10) ?? "");
  const [days, setDays] = useState<number[]>(plan?.daysOfWeek ?? []);
  const [minLos, setMinLos] = useState(plan?.minLos ?? 1);
  const [priority, setPriority] = useState(plan?.priority ?? 0);
  const [items, setItems] = useState<Array<{ roomTypeId: string; rate: number }>>(
    plan?.items.map((item) => ({ roomTypeId: item.roomTypeId, rate: Math.round(item.rate / 100) })) ?? [],
  );
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: (dto: CreateRatePlanDto) => plan && !duplicate
      ? ratePlansService.update(plan.id, dto)
      : ratePlansService.create(dto),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["company-rate-plans", company.id] }),
        qc.invalidateQueries({ queryKey: ["rate-plans"] }),
      ]);
      onClose();
    },
    onError: (err) => setError(getErrorMessage(err)),
  });

  function addRoomType() {
    const roomType = roomTypes.find((candidate) => !items.some((item) => item.roomTypeId === candidate.id));
    if (!roomType) return;
    setItems((current) => [...current, { roomTypeId: roomType.id, rate: Math.round(roomType.defaultRate / 100) }]);
  }

  function save() {
    if (!name.trim()) return setError("Agreement name is required.");
    if (validFrom && validTo && validTo < validFrom) return setError("End date must be on or after the start date.");
    if (items.length === 0) return setError("Add at least one room type rate.");
    if (items.some((item) => !item.roomTypeId || item.rate <= 0)) return setError("Every room type needs a rate greater than zero.");

    mutation.mutate({
      companyId: company.id,
      name: name.trim(),
      type: companyRateType(company),
      description: `Negotiated contract for ${company.name}`,
      validFrom: validFrom || undefined,
      validTo: validTo || undefined,
      daysOfWeek: days,
      minLos,
      priority,
      codeRequired: false,
      items: items.map((item) => ({ ...item, rate: item.rate * 100 })),
    });
  }

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center overflow-y-auto bg-ink/40 p-4 backdrop-blur-sm" onMouseDown={onClose}>
      <div className="flex max-h-[calc(100dvh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-[1.75rem] bg-card shadow-float" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-line-soft px-6 py-5">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-coral-soft text-coral"><CalendarRange size={20} /></div>
          <div className="min-w-0 flex-1">
            <h2 className="serif text-[22px] text-ink">{plan && !duplicate ? "Edit agreement" : "New negotiated agreement"}</h2>
            <p className="truncate text-[12.5px] text-ink-mute">{company.name}</p>
          </div>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full text-ink-mute hover:bg-mist"><X size={18} /></button>
        </div>

        <div className="scroll-area min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <div>
            <label className="mb-1.5 block text-[13px] font-semibold text-ink-soft">Agreement name</label>
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Summer 2026 contract" className={inputCls} autoFocus />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-[13px] font-semibold text-ink-soft">Contracted room rates</label>
              <button onClick={addRoomType} disabled={items.length >= roomTypes.length} className="inline-flex items-center gap-1 text-[12px] font-semibold text-coral disabled:opacity-40"><Plus size={13} /> Add room type</button>
            </div>
            <div className="space-y-2">
              {items.length === 0 && <div className="rounded-xl border border-dashed border-line py-6 text-center text-[13px] text-ink-mute">Choose the rooms covered by this agreement.</div>}
              {items.map((item, index) => (
                <div key={`${item.roomTypeId}-${index}`} className="flex gap-2">
                  <select
                    value={item.roomTypeId}
                    onChange={(event) => setItems((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, roomTypeId: event.target.value } : row))}
                    className={cn(inputCls, "flex-1")}
                  >
                    {roomTypes.map((roomType) => <option key={roomType.id} value={roomType.id} disabled={items.some((row, rowIndex) => rowIndex !== index && row.roomTypeId === roomType.id)}>{roomType.name}</option>)}
                  </select>
                  <div className="relative w-40">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] text-ink-mute">PKR</span>
                    <input type="number" min={1} value={item.rate} onChange={(event) => setItems((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, rate: Math.max(0, Number(event.target.value)) } : row))} className={cn(inputCls, "pl-11 tabular-nums")} />
                  </div>
                  <button onClick={() => setItems((current) => current.filter((_, rowIndex) => rowIndex !== index))} className="grid h-10 w-10 place-items-center rounded-xl text-ink-faint hover:bg-clay-soft hover:text-clay"><X size={15} /></button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-[13px] font-semibold text-ink-soft">Eligible stay dates</label>
            <div className="grid gap-3 sm:grid-cols-2">
              <DatePicker value={validFrom} max={validTo || undefined} onChange={setValidFrom} placeholder="Stay from" className="w-full" />
              <DatePicker value={validTo} min={validFrom || undefined} onChange={setValidTo} placeholder="Stay until" className="w-full" />
            </div>
            <p className="mt-1.5 text-[11.5px] text-ink-faint">Leave both blank for an ongoing agreement.</p>
          </div>

          <div>
            <label className="mb-2 block text-[13px] font-semibold text-ink-soft">Applicable days</label>
            <div className="flex flex-wrap gap-1.5">
              {DAYS.map((label, day) => <button key={label} onClick={() => setDays((current) => current.includes(day) ? current.filter((value) => value !== day) : [...current, day])} className={cn("h-9 w-12 rounded-xl border text-[12px] font-semibold", days.includes(day) ? "border-coral bg-coral-soft text-coral-deep" : "border-line bg-white text-ink-mute")}>{label}</button>)}
            </div>
            <p className="mt-1.5 text-[11.5px] text-ink-faint">No selection means every day.</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className="mb-1.5 block text-[13px] font-semibold text-ink-soft">Minimum stay</label><input type="number" min={1} value={minLos} onChange={(event) => setMinLos(Math.max(1, Number(event.target.value)))} className={inputCls} /></div>
            <div><label className="mb-1.5 block text-[13px] font-semibold text-ink-soft">Priority</label><input type="number" value={priority} onChange={(event) => setPriority(Number(event.target.value))} className={inputCls} /><p className="mt-1 text-[11px] text-ink-faint">Higher wins when agreements overlap.</p></div>
          </div>

          {error && <div className="rounded-xl border border-clay/25 bg-clay-soft px-4 py-3 text-[13px] font-medium text-clay">{error}</div>}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-line-soft px-6 py-4">
          <button onClick={onClose} className="text-[13px] font-semibold text-ink-mute">Cancel</button>
          <Button leftIcon={Check} onClick={save} disabled={mutation.isPending}>{mutation.isPending ? "Saving…" : "Save agreement"}</Button>
        </div>
      </div>
    </div>
  );
}

export function CompanyRatesSection({
  company,
  canCreate,
  canUpdate,
  canEditFallback,
}: {
  company: CompanyDetail;
  canCreate: boolean;
  canUpdate: boolean;
  canEditFallback: boolean;
}) {
  const qc = useQueryClient();
  const [modal, setModal] = useState<{ plan?: RatePlan; duplicate?: boolean } | null>(null);
  const [discountInput, setDiscountInput] = useState(company.discountPercent?.toString() ?? "");
  const [message, setMessage] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["company-rate-plans", company.id],
    queryFn: () => ratePlansService.list({ companyId: company.id, limit: 100 }),
  });
  const plans = data?.data ?? [];

  const fallbackMutation = useMutation({
    mutationFn: () => companiesService.update(company.id, { discountPercent: discountInput === "" ? null : Number(discountInput) }),
    onSuccess: async () => {
      setMessage("Fallback pricing saved.");
      await Promise.all([qc.invalidateQueries({ queryKey: ["company", company.id] }), qc.invalidateQueries({ queryKey: ["companies"] })]);
    },
    onError: (error) => setMessage(getErrorMessage(error)),
  });
  const activationMutation = useMutation({
    mutationFn: ({ plan, active }: { plan: RatePlan; active: boolean }) => active ? ratePlansService.activate(plan.id) : ratePlansService.deactivate(plan.id),
    onSuccess: async () => Promise.all([qc.invalidateQueries({ queryKey: ["company-rate-plans", company.id] }), qc.invalidateQueries({ queryKey: ["rate-plans"] })]),
    onError: (error) => setMessage(getErrorMessage(error)),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h2 className="serif text-[24px] text-ink">Negotiated rates</h2><p className="mt-1 max-w-2xl text-[13px] text-ink-mute">Fixed agreements apply first. Outside their dates, Innflo uses this company’s discount or the hotel’s general {company.type === "CORPORATE" ? "corporate" : "travel-agent"} rate.</p></div>
        {canCreate && <Button leftIcon={Plus} onClick={() => setModal({})}>New agreement</Button>}
      </div>

      <Card className="p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div><div className="text-[12px] font-bold uppercase tracking-wide text-ink-mute">Outside contract dates</div><div className="mt-1 text-[13px] text-ink-soft">Leave blank to use the general business rate, or set a discount from the applicable public rate.</div></div>
          <div className="flex items-end gap-2">
            <div><label className="mb-1 block text-[11px] font-semibold text-ink-mute">Public-rate discount</label><div className="relative w-36"><input type="number" min={0} max={90} step={1} value={discountInput} onChange={(event) => setDiscountInput(event.target.value)} disabled={!canEditFallback} placeholder="None" className={cn(inputCls, "pr-8 tabular-nums")} /><span className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-mute">%</span></div></div>
            {canEditFallback && <Button variant="outline" onClick={() => {
              const discount = discountInput === "" ? null : Number(discountInput);
              if (discount !== null && (!Number.isInteger(discount) || discount < 0 || discount > 90)) {
                setMessage("Enter a whole-number discount from 0 to 90%.");
                return;
              }
              fallbackMutation.mutate();
            }} disabled={fallbackMutation.isPending}>Save</Button>}
          </div>
        </div>
        {message && <p className="mt-3 text-[12px] font-medium text-ink-mute">{message}</p>}
      </Card>

      {isLoading ? <div className="py-8 text-center text-[13px] text-ink-mute">Loading agreements…</div> : plans.length === 0 ? (
        <Card className="border-dashed py-10 text-center"><Tag className="mx-auto text-ink-faint" size={24} /><div className="mt-3 text-[14px] font-semibold text-ink">No fixed agreements yet</div><p className="mt-1 text-[12.5px] text-ink-mute">The general business rate or fallback discount will be used.</p></Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {plans.map((plan) => (
            <Card key={plan.id} className={cn("p-5", !plan.isActive && "opacity-65")}>
              <div className="flex items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><h3 className="text-[15px] font-semibold text-ink">{plan.name}</h3><span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide", plan.isActive ? "bg-pine/10 text-pine" : "bg-line text-ink-mute")}>{plan.isActive ? "Active" : "Inactive"}</span></div><div className="mt-1 text-[12px] text-ink-mute">{dateLabel(plan.validFrom)} – {dateLabel(plan.validTo)} · {plan.daysOfWeek.length ? plan.daysOfWeek.map((day) => DAYS[day]).join(", ") : "Every day"} · {plan.minLos} night minimum</div></div>{(canCreate || canUpdate) && <div className="flex shrink-0">{canUpdate && <button onClick={() => setModal({ plan })} title="Edit" className="grid h-8 w-8 place-items-center rounded-lg text-ink-mute hover:bg-mist"><Pencil size={14} /></button>}{canCreate && <button onClick={() => setModal({ plan, duplicate: true })} title="Duplicate" className="grid h-8 w-8 place-items-center rounded-lg text-ink-mute hover:bg-mist"><Copy size={14} /></button>}{canUpdate && <button onClick={() => activationMutation.mutate({ plan, active: !plan.isActive })} title={plan.isActive ? "Deactivate" : "Activate"} className="grid h-8 w-8 place-items-center rounded-lg text-ink-mute hover:bg-mist">{plan.isActive ? <PowerOff size={14} /> : <Power size={14} />}</button>}</div>}</div>
              <div className="mt-4 grid gap-2 border-t border-line-soft pt-3 sm:grid-cols-2">{plan.items.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 text-[12.5px]"><span className="truncate text-ink-mute">{item.roomType.name}</span><span className="shrink-0 font-semibold tabular-nums text-ink">{pkr(item.rate)}</span></div>)}</div>
            </Card>
          ))}
        </div>
      )}

      {modal && <ContractModal company={company} plan={modal.plan} duplicate={modal.duplicate} onClose={() => setModal(null)} />}
    </div>
  );
}
