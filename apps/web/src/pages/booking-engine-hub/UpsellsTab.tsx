import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, PackagePlus } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import { usePermissions } from "@/hooks/usePermissions";
import {
  upsellsService,
  type UpsellItem,
  type UpsellCategory,
  type UpsellPriceType,
} from "@/services/upsells";

const CATEGORY_OPTIONS: { value: UpsellCategory; label: string }[] = [
  { value: "FOOD_BEVERAGE", label: "Food & Beverage" },
  { value: "TRANSPORT",     label: "Transport" },
  { value: "SPA",           label: "Spa" },
  { value: "ACTIVITY",      label: "Activity" },
  { value: "LAUNDRY",       label: "Laundry" },
  { value: "MINIBAR",       label: "Minibar" },
  { value: "INTERNET",      label: "Internet" },
  { value: "MISCELLANEOUS", label: "Other" },
];

const PRICE_TYPE_OPTIONS: { value: UpsellPriceType; label: string; hint: string }[] = [
  { value: "FLAT",      label: "Flat",      hint: "Charged once per booking" },
  { value: "PER_NIGHT", label: "Per night", hint: "Multiplied by nights stayed" },
  { value: "PER_GUEST", label: "Per guest", hint: "Multiplied by number of guests" },
];

function fmtPkr(paisas: number): string {
  return `PKR ${Math.round(paisas / 100).toLocaleString("en-PK")}`;
}

interface UpsellFormState {
  name: string;
  description: string;
  category: UpsellCategory;
  priceType: UpsellPriceType;
  rupees: string;
}

const EMPTY_FORM: UpsellFormState = {
  name: "",
  description: "",
  category: "MISCELLANEOUS",
  priceType: "FLAT",
  rupees: "",
};

export function UpsellsTab() {
  const queryClient = useQueryClient();
  const { has } = usePermissions();
  const canManage = has("bookingEngine:manage");

  const [editing, setEditing] = useState<UpsellItem | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<UpsellFormState>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);

  const { data: response, isLoading } = useQuery({
    queryKey: ["upsells"],
    queryFn: () => upsellsService.list(),
  });
  const items = response?.data ?? [];

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["upsells"] });
  }

  const saveMutation = useMutation({
    mutationFn: () => {
      const amount = Math.round(Number(form.rupees) * 100);
      const dto = {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        category: form.category,
        priceType: form.priceType,
        amount,
      };
      return editing
        ? upsellsService.update(editing.id, dto)
        : upsellsService.create(dto);
    },
    onSuccess: () => {
      invalidate();
      closeForm();
    },
    onError: () => setError("Could not save this extra. Please try again."),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: (item: UpsellItem) =>
      upsellsService.update(item.id, { isActive: !item.isActive }),
    onSuccess: invalidate,
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => upsellsService.remove(id),
    onSuccess: invalidate,
  });

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setError(null);
    setShowForm(true);
  }

  function openEdit(item: UpsellItem) {
    setEditing(item);
    setForm({
      name: item.name,
      description: item.description ?? "",
      category: item.category,
      priceType: item.priceType,
      rupees: String(Math.round(item.amount / 100)),
    });
    setError(null);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditing(null);
    setForm(EMPTY_FORM);
    setError(null);
  }

  function handleSave() {
    if (!form.name.trim()) { setError("Give this extra a name guests will recognise."); return; }
    const rupees = Number(form.rupees);
    if (!Number.isFinite(rupees) || rupees <= 0) { setError("Enter a price greater than zero."); return; }
    setError(null);
    saveMutation.mutate();
  }

  return (
    <div className="space-y-6">
      <Card className="anim-fade-up">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-[16px] font-bold text-ink">Extras &amp; add-ons</h2>
            <p className="mt-1 text-[13.5px] leading-relaxed text-ink-mute">
              Anything guests can add to a booking — breakfast, late checkout, airport pickup, a spa slot.
              These appear under <span className="font-semibold text-ink-soft">Packages &amp; Deals</span> on your booking page
              and post to the folio when the guest checks in.
            </p>
          </div>
          {canManage && (
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full bg-coral px-4 text-[13px] font-bold text-white shadow-pop transition-colors hover:bg-coral-dark"
            >
              <Plus size={15} /> Add extra
            </button>
          )}
        </div>
      </Card>

      <Card className="anim-fade-up">
        {isLoading ? (
          <div className="h-28 animate-pulse rounded-xl bg-line-soft" />
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-xl bg-coral-tint text-coral">
              <PackagePlus size={22} />
            </span>
            <div>
              <p className="text-[15px] font-bold text-ink">No extras yet</p>
              <p className="mt-1 text-[13.5px] text-ink-mute">
                Add your first one and it shows up on the booking page straight away.
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left">
              <thead>
                <tr className="border-b border-line-soft text-[11.5px] font-bold uppercase tracking-[0.1em] text-ink-faint">
                  <th className="pb-3 pr-4">Extra</th>
                  <th className="pb-3 pr-4">Category</th>
                  <th className="pb-3 pr-4">Price</th>
                  <th className="pb-3 pr-4">Status</th>
                  <th className="pb-3" />
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b border-line-soft last:border-0">
                    <td className="py-3.5 pr-4">
                      <div className="text-[14px] font-semibold text-ink">{item.name}</div>
                      {item.description && (
                        <div className="mt-0.5 text-[12.5px] text-ink-mute line-clamp-1">{item.description}</div>
                      )}
                    </td>
                    <td className="py-3.5 pr-4 text-[13px] text-ink-soft">
                      {CATEGORY_OPTIONS.find((c) => c.value === item.category)?.label ?? item.category}
                    </td>
                    <td className="py-3.5 pr-4">
                      <div className="text-[13.5px] font-semibold text-ink">{fmtPkr(item.amount)}</div>
                      <div className="text-[12px] text-ink-mute">
                        {PRICE_TYPE_OPTIONS.find((p) => p.value === item.priceType)?.label}
                      </div>
                    </td>
                    <td className="py-3.5 pr-4">
                      <button
                        type="button"
                        disabled={!canManage || toggleActiveMutation.isPending}
                        onClick={() => toggleActiveMutation.mutate(item)}
                        className={cn(
                          "rounded-full px-2.5 py-1 text-[12px] font-bold transition-colors",
                          item.isActive ? "bg-pine-soft text-pine" : "bg-line-soft text-ink-mute",
                          canManage && "hover:opacity-80",
                        )}
                      >
                        {item.isActive ? "Live" : "Hidden"}
                      </button>
                    </td>
                    <td className="py-3.5">
                      {canManage && (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEdit(item)}
                            className="grid h-8 w-8 place-items-center rounded-full text-ink-mute transition-colors hover:bg-line-soft hover:text-ink"
                            aria-label={`Edit ${item.name}`}
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeMutation.mutate(item.id)}
                            className="grid h-8 w-8 place-items-center rounded-full text-ink-mute transition-colors hover:bg-clay-soft hover:text-clay"
                            aria-label={`Remove ${item.name}`}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {showForm && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-lg rounded-xl2 bg-card p-6 shadow-float">
            <h3 className="serif text-[22px] text-ink">{editing ? "Edit extra" : "Add an extra"}</h3>

            <div className="mt-5 space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-[12.5px] font-bold text-ink-soft">Name</span>
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Airport pickup"
                  className="h-11 w-full rounded-full border border-line bg-paper px-4 text-[14px] text-ink outline-none focus:border-coral"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-[12.5px] font-bold text-ink-soft">Description <span className="font-medium text-ink-faint">(optional)</span></span>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  rows={2}
                  placeholder="Met at arrivals, one sedan, up to 3 bags."
                  className="w-full resize-none rounded-xl2 border border-line bg-paper px-4 py-3 text-[14px] text-ink outline-none focus:border-coral"
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-[12.5px] font-bold text-ink-soft">Category</span>
                  <select
                    value={form.category}
                    onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as UpsellCategory }))}
                    className="h-11 w-full rounded-full border border-line bg-paper px-4 text-[14px] text-ink outline-none focus:border-coral"
                  >
                    {CATEGORY_OPTIONS.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-[12.5px] font-bold text-ink-soft">Price (PKR)</span>
                  <input
                    type="number"
                    min={1}
                    value={form.rupees}
                    onChange={(e) => setForm((f) => ({ ...f, rupees: e.target.value }))}
                    placeholder="2500"
                    className="h-11 w-full rounded-full border border-line bg-paper px-4 text-[14px] text-ink outline-none focus:border-coral"
                  />
                </label>
              </div>

              <div>
                <span className="mb-1.5 block text-[12.5px] font-bold text-ink-soft">How it's charged</span>
                <div className="grid gap-2 sm:grid-cols-3">
                  {PRICE_TYPE_OPTIONS.map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, priceType: p.value }))}
                      className={cn(
                        "rounded-xl2 border px-3 py-2.5 text-left transition-colors",
                        form.priceType === p.value
                          ? "border-coral bg-coral-tint"
                          : "border-line hover:border-ink-faint",
                      )}
                    >
                      <span className="block text-[13px] font-bold text-ink">{p.label}</span>
                      <span className="mt-0.5 block text-[11.5px] leading-tight text-ink-mute">{p.hint}</span>
                    </button>
                  ))}
                </div>
              </div>

              {error && <p className="text-[13px] font-semibold text-clay">{error}</p>}
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeForm}
                className="h-10 rounded-full border border-line px-4 text-[13px] font-semibold text-ink-soft transition-colors hover:bg-line-soft"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saveMutation.isPending}
                className="h-10 rounded-full bg-coral px-5 text-[13px] font-bold text-white shadow-pop transition-colors hover:bg-coral-dark disabled:opacity-60"
              >
                {saveMutation.isPending ? "Saving…" : editing ? "Save changes" : "Add extra"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
