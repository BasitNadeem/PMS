import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Tag, Plus, Pencil, PowerOff, Power, X, Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";
import { getErrorMessage } from "@/lib/api";
import { ratePlansService, type RatePlan, type RatePlanType, type CreateRatePlanDto } from "@/services/ratePlans";
import { roomsService } from "@/services/rooms";
import { usePermissions } from "@/hooks/usePermissions";
import { Card } from "@/components/ui/Card";
import { DatePicker } from "@/components/ui/DatePicker";
import { useEscapeKey } from "@/hooks/useEscapeKey";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtPkr(paisas: number): string {
  return `Rs ${Math.round(paisas / 100).toLocaleString("en-PK")}`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" });
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const TYPE_LABEL: Record<RatePlanType, string> = {
  STANDARD:     "Standard",
  SEASONAL:     "Seasonal",
  PROMOTIONAL:  "Promotional",
  CORPORATE:    "Corporate",
  TRAVEL_AGENT: "Travel Agent",
  OTA_NET:      "OTA Net",
  COMPLEMENTARY:"Complementary",
};

const inputCls = "h-10 w-full rounded-xl bg-white border border-line px-3.5 text-sm text-ink placeholder:text-ink-faint outline-none focus:border-coral focus:ring-2 focus:ring-coral/15 transition-all";

// ── RatePlanModal ─────────────────────────────────────────────────────────────

interface RatePlanModalProps {
  plan?: RatePlan;
  onClose: () => void;
  onSuccess: () => void;
}

function RatePlanModal({ plan, onClose, onSuccess }: RatePlanModalProps) {
  useEscapeKey(onClose);

  const isEdit = !!plan;

  const { data: roomTypesData } = useQuery({
    queryKey: ["room-types"],
    queryFn:  roomsService.getRoomTypes,
    staleTime: 60_000,
  });
  const roomTypes = roomTypesData?.data ?? [];

  const [name, setName]         = useState(plan?.name ?? "");
  const [type, setType]         = useState<RatePlanType>(plan?.type ?? "STANDARD");
  const [description, setDesc]  = useState(plan?.description ?? "");
  const [validFrom, setFrom]    = useState(plan?.validFrom ? plan.validFrom.slice(0, 10) : "");
  const [validTo, setTo]        = useState(plan?.validTo   ? plan.validTo.slice(0, 10)   : "");
  const [daysOfWeek, setDays]   = useState<number[]>(plan?.daysOfWeek ?? []);
  const [minLos, setMinLos]     = useState(plan?.minLos ?? 1);
  const [priority, setPriority] = useState(plan?.priority ?? 0);
  const [items, setItems]       = useState<{ roomTypeId: string; rate: number }[]>(
    plan?.items.map((i) => ({ roomTypeId: i.roomTypeId, rate: Math.round(i.rate / 100) })) ?? []
  );
  const [formError, setFormError] = useState("");

  const qc = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (dto: CreateRatePlanDto) => ratePlansService.create(dto),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["rate-plans"] }); onSuccess(); },
  });
  const updateMutation = useMutation({
    mutationFn: (dto: CreateRatePlanDto) => ratePlansService.update(plan!.id, dto),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["rate-plans"] }); onSuccess(); },
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  function toggleDay(d: number) {
    setDays((prev) => prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]);
  }

  function addItem() {
    const unused = roomTypes.find((rt) => !items.some((i) => i.roomTypeId === rt.id));
    if (!unused) return;
    setItems((prev) => [...prev, { roomTypeId: unused.id, rate: Math.round(unused.defaultRate / 100) }]);
  }

  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  function setItemRoomType(idx: number, roomTypeId: string) {
    const rt = roomTypes.find((r) => r.id === roomTypeId);
    setItems((prev) => prev.map((item, i) =>
      i === idx ? { roomTypeId, rate: rt ? Math.round(rt.defaultRate / 100) : item.rate } : item
    ));
  }

  function setItemRate(idx: number, rate: number) {
    setItems((prev) => prev.map((item, i) => i === idx ? { ...item, rate } : item));
  }

  async function handleSubmit() {
    if (!name.trim()) { setFormError("Name is required"); return; }
    if (items.length === 0) { setFormError("Add at least one room type rate"); return; }
    for (const item of items) {
      if (!item.roomTypeId) { setFormError("All rows must have a room type selected"); return; }
    }
    setFormError("");

    const dto: CreateRatePlanDto = {
      name: name.trim(),
      type,
      description: description.trim() || undefined,
      validFrom:   validFrom || undefined,
      validTo:     validTo   || undefined,
      daysOfWeek,
      minLos,
      priority,
      items: items.map((i) => ({ roomTypeId: i.roomTypeId, rate: i.rate * 100 })),
    };

    try {
      if (isEdit) await updateMutation.mutateAsync(dto);
      else        await createMutation.mutateAsync(dto);
    } catch (err) {
      setFormError(getErrorMessage(err));
    }
  }

  return (
    <div
      className="fixed inset-0 bg-ink/35 backdrop-blur-[3px] z-50 grid place-items-center p-4 sm:p-6 anim-fade-in"
      onMouseDown={onClose}
    >
      <div
        className="relative w-full max-w-2xl max-h-[92vh] flex flex-col bg-card rounded-[1.75rem] shadow-float anim-scale-in"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3.5 px-6 pt-6 pb-4 border-b border-line-soft">
          <div className="grid place-items-center h-11 w-11 rounded-xl bg-coral-soft text-coral-deep shrink-0">
            <Tag size={20} />
          </div>
          <div className="flex-1">
            <h3 className="serif text-[22px] leading-tight text-ink">{isEdit ? "Edit rate plan" : "New rate plan"}</h3>
          </div>
          <button onClick={onClose} className="grid place-items-center h-9 w-9 rounded-full hover:bg-line-soft text-ink-mute transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto scroll-area px-6 py-5 space-y-5">

          {/* Name + Type */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="mb-1.5 block text-[13px] font-semibold text-ink-soft">Name <span className="text-coral text-[15px] font-bold leading-none">*</span></label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Summer Seasonal Rate" className={inputCls} />
            </div>
            <div>
              <label className="mb-1.5 block text-[13px] font-semibold text-ink-soft">Type</label>
              <div className="relative">
                <select value={type} onChange={(e) => setType(e.target.value as RatePlanType)} className={cn(inputCls, "appearance-none pr-9 cursor-pointer")}>
                  {(Object.keys(TYPE_LABEL) as RatePlanType[]).map((t) => (
                    <option key={t} value={t}>{TYPE_LABEL[t]}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-mute pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-[13px] font-semibold text-ink-soft">Priority</label>
              <input type="number" value={priority} onChange={(e) => setPriority(parseInt(e.target.value, 10) || 0)} className={inputCls} />
            </div>
            <div className="col-span-2">
              <label className="mb-1.5 block text-[13px] font-semibold text-ink-soft">Description <span className="text-ink-faint font-normal">(optional)</span></label>
              <input type="text" value={description} onChange={(e) => setDesc(e.target.value)} placeholder="Internal notes about this rate…" className={inputCls} />
            </div>
          </div>

          {/* Room type rates */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[13px] font-semibold text-ink-soft">Room type rates <span className="text-coral text-[15px] font-bold leading-none">*</span></label>
              <button
                type="button"
                onClick={addItem}
                disabled={items.length >= roomTypes.length}
                className="inline-flex items-center gap-1 text-[12px] font-semibold text-coral hover:underline disabled:opacity-40 disabled:no-underline"
              >
                <Plus size={13} /> Add room type
              </button>
            </div>
            <div className="space-y-2">
              {items.length === 0 && (
                <div className="rounded-xl border border-dashed border-line py-6 text-center text-[13px] text-ink-mute">
                  No room types added yet
                </div>
              )}
              {items.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <select
                      value={item.roomTypeId}
                      onChange={(e) => setItemRoomType(idx, e.target.value)}
                      className={cn(inputCls, "appearance-none pr-9 cursor-pointer")}
                    >
                      <option value="">Select room type…</option>
                      {roomTypes.map((rt) => (
                        <option
                          key={rt.id}
                          value={rt.id}
                          disabled={items.some((i, j) => j !== idx && i.roomTypeId === rt.id)}
                        >
                          {rt.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-mute pointer-events-none" />
                  </div>
                  <div className="relative w-36">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-ink-mute pointer-events-none">Rs</span>
                    <input
                      type="number" min={0} value={item.rate}
                      onChange={(e) => setItemRate(idx, Math.max(0, parseInt(e.target.value, 10) || 0))}
                      className={cn(inputCls, "pl-8")}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeItem(idx)}
                    className="grid place-items-center h-10 w-10 rounded-xl text-ink-faint hover:bg-line-soft hover:text-clay transition-colors shrink-0"
                  >
                    <X size={15} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Date range */}
          <div>
            <label className="mb-1.5 block text-[13px] font-semibold text-ink-soft">Date range <span className="text-ink-faint font-normal">(optional — leave blank for always active)</span></label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-[11px] text-ink-faint mb-1 block">From</span>
                <DatePicker value={validFrom} onChange={setFrom} className="w-full" />
              </div>
              <div>
                <span className="text-[11px] text-ink-faint mb-1 block">To</span>
                <DatePicker value={validTo} min={validFrom || undefined} onChange={setTo} className="w-full" />
              </div>
            </div>
          </div>

          {/* Days of week */}
          <div>
            <label className="mb-2 block text-[13px] font-semibold text-ink-soft">Days of week <span className="text-ink-faint font-normal">(leave all unselected = every day)</span></label>
            <div className="flex gap-1.5 flex-wrap">
              {DAY_LABELS.map((label, d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => toggleDay(d)}
                  className={cn(
                    "h-9 w-12 rounded-xl text-[12px] font-semibold border transition-colors",
                    daysOfWeek.includes(d)
                      ? "border-coral bg-coral-soft text-coral-deep"
                      : "border-line bg-white text-ink-mute hover:border-ink-faint",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Min LOS */}
          <div className="w-40">
            <label className="mb-1.5 block text-[13px] font-semibold text-ink-soft">Minimum stay (nights)</label>
            <input
              type="number" min={1} value={minLos}
              onChange={(e) => setMinLos(Math.max(1, parseInt(e.target.value, 10) || 1))}
              className={inputCls}
            />
          </div>

          {formError && <p className="text-[13px] text-clay font-medium">{formError}</p>}
        </div>

        {/* Footer */}
        <div className="border-t border-line-soft px-6 py-4 flex items-center justify-end gap-3 bg-card rounded-b-[1.75rem]">
          <button onClick={onClose} className="text-[13px] font-semibold text-ink-mute hover:text-ink transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isPending}
            className="inline-flex items-center gap-2 h-10 px-5 rounded-full bg-coral text-white text-[14px] font-semibold hover:bg-coral-dark transition-colors shadow-pop disabled:opacity-40 disabled:pointer-events-none"
          >
            <Check size={16} strokeWidth={2.4} />
            {isPending ? "Saving…" : isEdit ? "Save changes" : "Create plan"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── RatePlansPage ─────────────────────────────────────────────────────────────

export default function RatePlansPage() {
  const { has } = usePermissions();
  const canCreate = has("rates:create");
  const canUpdate = has("rates:update");
  const canDelete = has("rates:delete");

  const qc = useQueryClient();
  const [showActive, setShowActive] = useState<boolean | undefined>(true);
  const [modalPlan, setModalPlan]   = useState<RatePlan | undefined>(undefined);
  const [showModal, setShowModal]   = useState(false);
  const [actionError, setActionError] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["rate-plans", showActive],
    queryFn: () => ratePlansService.list({ isActive: showActive }),
    staleTime: 30_000,
    refetchInterval: 15_000,
  });
  const plans = data?.data ?? [];

  const activateMutation = useMutation({
    mutationFn: (id: string) => ratePlansService.activate(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ["rate-plans"] }),
    onError:    (err) => setActionError(getErrorMessage(err)),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => ratePlansService.deactivate(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ["rate-plans"] }),
    onError:    (err) => setActionError(getErrorMessage(err)),
  });

  function openCreate() { setModalPlan(undefined); setShowModal(true); }
  function openEdit(plan: RatePlan) { setModalPlan(plan); setShowModal(true); }
  function closeModal() { setShowModal(false); setModalPlan(undefined); }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="grid place-items-center h-11 w-11 rounded-xl bg-coral-soft text-coral-deep shrink-0">
            <Tag size={20} />
          </div>
          <div>
            <h1 className="serif text-[28px] text-ink leading-tight">Rate Plans</h1>
            <p className="text-[13px] text-ink-mute">Manage rates by room type, season, and dates</p>
          </div>
        </div>
        {canCreate && (
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-full bg-coral text-white text-[13px] font-semibold hover:bg-coral-dark transition-colors shadow-pop shrink-0"
          >
            <Plus size={15} /> New Rate Plan
          </button>
        )}
      </div>

      {actionError && (
        <div className="rounded-xl border border-clay/25 bg-clay-soft px-4 py-3 text-[13px] text-clay font-medium">
          {actionError}
        </div>
      )}

      {/* Filter */}
      <div className="inline-flex items-center gap-0.5 rounded-full bg-line-soft p-1">
        {([
          { label: "Active",   value: true       },
          { label: "All",      value: undefined  },
          { label: "Inactive", value: false      },
        ] as { label: string; value: boolean | undefined }[]).map((opt) => (
          <button
            key={String(opt.value)}
            onClick={() => setShowActive(opt.value)}
            className={cn(
              "rounded-full px-4 h-9 text-[13px] font-semibold transition-all",
              showActive === opt.value ? "bg-card text-ink shadow-pop" : "text-ink-mute hover:text-ink-soft",
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <Card className="!p-0 overflow-hidden">
        {isLoading ? (
          <div className="py-16 text-center text-[13px] text-ink-mute">Loading…</div>
        ) : plans.length === 0 ? (
          <div className="py-16 text-center text-[13px] text-ink-mute">No rate plans found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-line-soft bg-mist">
                  <th className="px-4 py-3 text-left font-semibold text-ink-mute">Name</th>
                  <th className="px-4 py-3 text-left font-semibold text-ink-mute">Type</th>
                  <th className="px-4 py-3 text-left font-semibold text-ink-mute">Room Types</th>
                  <th className="px-4 py-3 text-left font-semibold text-ink-mute">Date Range</th>
                  <th className="px-4 py-3 text-left font-semibold text-ink-mute">Days</th>
                  <th className="px-4 py-3 text-left font-semibold text-ink-mute">Min Stay</th>
                  <th className="px-4 py-3 text-left font-semibold text-ink-mute">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft">
                {plans.map((plan) => (
                  <tr key={plan.id} className="hover:bg-mist/50 transition-colors">
                    <td className="px-4 py-3.5">
                      <div className="font-semibold text-ink">{plan.name}</div>
                      {plan.priority !== 0 && (
                        <div className="text-[11px] text-ink-faint">Priority {plan.priority}</div>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-ink-soft">{TYPE_LABEL[plan.type]}</td>
                    <td className="px-4 py-3.5">
                      <div className="space-y-0.5">
                        {plan.items.map((item) => (
                          <div key={item.id} className="flex items-center gap-1.5">
                            <span className="text-ink-soft">{item.roomType.name}</span>
                            <span className="text-ink-faint">·</span>
                            <span className="font-semibold text-ink tnum">{fmtPkr(item.rate)}</span>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-ink-soft">
                      {plan.validFrom || plan.validTo
                        ? `${fmtDate(plan.validFrom)} – ${fmtDate(plan.validTo)}`
                        : <span className="text-ink-faint">Always</span>}
                    </td>
                    <td className="px-4 py-3.5">
                      {plan.daysOfWeek.length === 0 ? (
                        <span className="text-ink-faint">All days</span>
                      ) : (
                        <div className="flex flex-wrap gap-0.5">
                          {plan.daysOfWeek.sort().map((d) => (
                            <span key={d} className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-line text-ink-soft">
                              {DAY_LABELS[d]}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-ink-soft tnum">{plan.minLos}n</td>
                    <td className="px-4 py-3.5">
                      <span className={cn(
                        "inline-flex items-center h-6 px-2.5 rounded-full text-[11px] font-bold uppercase tracking-wide",
                        plan.isActive
                          ? "bg-pine/10 text-pine"
                          : "bg-line text-ink-mute",
                      )}>
                        {plan.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        {canUpdate && (
                          <button
                            onClick={() => openEdit(plan)}
                            className="grid place-items-center h-8 w-8 rounded-lg text-ink-faint hover:bg-line-soft hover:text-ink transition-colors"
                            title="Edit"
                          >
                            <Pencil size={14} />
                          </button>
                        )}
                        {canDelete && plan.isActive && (
                          <button
                            onClick={() => {
                              setActionError("");
                              deactivateMutation.mutate(plan.id);
                            }}
                            disabled={deactivateMutation.isPending}
                            className="grid place-items-center h-8 w-8 rounded-lg text-ink-faint hover:bg-clay-soft hover:text-clay transition-colors disabled:opacity-40"
                            title="Deactivate"
                          >
                            <PowerOff size={14} />
                          </button>
                        )}
                        {canUpdate && !plan.isActive && (
                          <button
                            onClick={() => {
                              setActionError("");
                              activateMutation.mutate(plan.id);
                            }}
                            disabled={activateMutation.isPending}
                            className="grid place-items-center h-8 w-8 rounded-lg text-ink-faint hover:bg-emerald-soft hover:text-emerald transition-colors disabled:opacity-40"
                            title="Activate"
                          >
                            <Power size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Modal */}
      {showModal && (
        <RatePlanModal
          plan={modalPlan}
          onClose={closeModal}
          onSuccess={closeModal}
        />
      )}
    </div>
  );
}
