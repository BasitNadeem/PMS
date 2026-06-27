import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Search, BedDouble } from "lucide-react";
import { cn } from "@/lib/cn";
import { posService, type CartItem } from "@/services/pos";
import { reservationsService, type ReservationSummary } from "@/services/reservations";
import { useEscapeKey } from "@/hooks/useEscapeKey";

function formatPKR(paisas: number) {
  return `PKR ${Math.floor(paisas / 100).toLocaleString("en-PK")}`;
}

export interface PostToRoomModalProps {
  cart: CartItem[];
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

export function PostToRoomModal({ cart, onClose, onSuccess }: PostToRoomModalProps) {
  useEscapeKey(onClose);
  const qc = useQueryClient();
  const [search,   setSearch]   = useState("");
  const [selected, setSelected] = useState<ReservationSummary | null>(null);
  const [error,    setError]    = useState<string | null>(null);

  // Fetch ALL checked-in guests upfront — client-side filter covers room number
  // which the backend search param does not match against.
  const { data: checkedInData } = useQuery({
    queryKey: ["reservations-checkedin-all"],
    queryFn:  () => reservationsService.getReservations({ status: "CHECKED_IN", limit: 100 }),
    staleTime: 30_000,
  });

  const allCheckedIn = checkedInData?.data ?? [];

  // Filter by guest name OR room number (case-insensitive)
  const q = search.trim().toLowerCase();
  const results = q.length >= 1
    ? allCheckedIn.filter((r) => {
        const nameMatch = r.guest.fullName.toLowerCase().includes(q);
        const roomMatch = r.rooms.some((rr) => rr.room.number.toLowerCase().includes(q));
        return nameMatch || roomMatch;
      })
    : [];

  const total = cart.reduce((s, i) => s + i.price * i.quantity, 0);

  const createMutation = useMutation({
    mutationFn: () =>
      posService.createOrder({
        items:          cart.map((i) => ({ posItemId: i.posItemId, quantity: i.quantity })),
        settlementType: "FOLIO",
        reservationId:  selected!.id,
      }),
    onSuccess: (order) => {
      qc.invalidateQueries({ queryKey: ["pos-orders"] });
      const roomNum = order.roomNumber ?? selected?.rooms[0]?.room.number ?? "?";
      onSuccess(`Posted to Room ${roomNum}`);
      onClose();
    },
    onError: (err: { response?: { data?: { error?: string } } }) => {
      setError(err.response?.data?.error ?? "Failed to post order");
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm p-4 anim-fade-in">
      <div className="bg-paper rounded-2xl shadow-xl w-full max-w-lg flex flex-col max-h-[90vh] anim-scale-in">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 pt-6 pb-5 border-b border-line flex-shrink-0">
          <div className="grid place-items-center h-10 w-10 rounded-xl bg-[#E7EEF3] shrink-0">
            <BedDouble size={18} className="text-[#2c455c]" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="serif text-[20px] text-ink leading-tight">Post to Room</h2>
            <p className="text-[12px] text-ink-mute mt-0.5">Charge to a checked-in guest's folio</p>
          </div>
          <button
            onClick={onClose}
            className="grid place-items-center h-9 w-9 rounded-full hover:bg-mist text-ink-mute transition-colors -mr-1 -mt-1"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto scroll-area px-6 py-5 space-y-4">
          {error && (
            <div className="bg-clay-soft border border-clay/20 text-clay text-[13px] rounded-xl px-4 py-3">
              {error}
            </div>
          )}

          {/* Guest search */}
          <div>
            <label className="block text-[12.5px] font-semibold uppercase tracking-wide text-ink-mute mb-1.5">
              Checked-in guest
            </label>
            <div className="relative">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Room number or guest name…"
                className="w-full rounded-xl border border-line bg-mist pl-10 pr-3.5 py-2.5 text-[14px] text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-coral/20 focus:border-coral/40 transition-colors"
              />
            </div>
          </div>

          {/* Search results */}
          {results.length > 0 && !selected && (
            <div className="space-y-2">
              {results.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setSelected(r)}
                  className="w-full text-left rounded-xl border border-line bg-card hover:border-coral/40 hover:bg-mist px-4 py-3 transition-colors"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold text-[13.5px] text-ink">{r.guest.fullName}</span>
                    <span className="font-mono text-[11px] text-ink-faint flex-shrink-0">{r.confirmationNumber}</span>
                  </div>
                  <div className="text-[12px] text-ink-mute mt-0.5">
                    {r.rooms.length > 0 ? `Room ${r.rooms[0].room.number}` : "No room assigned"}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Selected guest */}
          {selected && (
            <div className="rounded-xl border border-pine/30 bg-[#E6F0EA] px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-[13.5px] text-ink">{selected.guest.fullName}</p>
                  <p className="text-[12px] text-ink-soft mt-0.5">
                    {selected.rooms.length > 0 ? `Room ${selected.rooms[0].room.number}` : ""}{" "}
                    · {selected.confirmationNumber}
                  </p>
                  <p className="text-[12px] text-[#1F4D3A] mt-1.5 font-medium">
                    Charges will be posted to this guest's folio
                  </p>
                </div>
                <button
                  onClick={() => setSelected(null)}
                  className="text-ink-mute hover:text-ink-soft transition-colors flex-shrink-0 mt-0.5"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          )}

          {/* Order summary */}
          <div className="rounded-xl border border-line overflow-hidden">
            <div className="px-4 py-2.5 border-b border-line-soft bg-mist">
              <span className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">Order Summary</span>
            </div>
            <div className="divide-y divide-line-soft bg-card">
              {cart.map((item) => (
                <div key={item.posItemId} className="px-4 py-2.5 flex items-center justify-between text-[13.5px]">
                  <span className="text-ink-soft">{item.name} × {item.quantity}</span>
                  <span className="font-semibold text-ink tnum">{formatPKR(item.price * item.quantity)}</span>
                </div>
              ))}
            </div>
            <div className="px-4 py-3 bg-mist flex items-center justify-between border-t border-line-soft">
              <span className="text-[14px] font-semibold text-ink-soft">Total</span>
              <span className="serif text-[20px] text-ink tnum">{formatPKR(total)}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 pt-3 flex-shrink-0 border-t border-line">
          <button
            onClick={() => createMutation.mutate()}
            disabled={!selected || createMutation.isPending}
            className={cn(
              "w-full h-11 rounded-xl text-[13.5px] font-semibold transition-colors shadow-pop",
              selected && !createMutation.isPending
                ? "bg-ink hover:bg-ink/90 text-white"
                : "bg-line-soft text-ink-faint cursor-not-allowed",
            )}
          >
            {createMutation.isPending ? "Posting…" : "Post to Folio"}
          </button>
        </div>
      </div>
    </div>
  );
}
