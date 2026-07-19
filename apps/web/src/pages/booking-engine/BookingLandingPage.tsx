import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Users, Calendar, Minus, Plus, X, Check, ChevronLeft, ChevronRight, ZoomIn, Lock, Search, Tag,
  Wifi, Tv, Coffee, Car, Waves, Utensils, Wind, Bath, Mountain, Dumbbell,
  Sparkles, Wine, Shirt, Monitor, Snowflake, Refrigerator, BedDouble, Flame,
  type LucideIcon,
} from "lucide-react";
import { DateRange, type RangeKeyDict } from "react-date-range";
import "react-date-range/dist/styles.css";
import "react-date-range/dist/theme/default.css";
import { format, parseISO } from "date-fns";
import { bookingEngineService, type PublicRoomType, type CartItem } from "@/services/bookingEngine";
import { cn } from "@/lib/cn";

const CART_KEY = (slug: string) => `be_cart_${slug}`;

const fmt = (pkr: number) =>
  new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR", maximumFractionDigits: 0 }).format(pkr);

const fmtShortDate = (iso: string) =>
  iso ? new Intl.DateTimeFormat("en-PK", { day: "numeric", month: "short" }).format(new Date(iso + "T00:00:00")) : "";

function localDateString(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const TAGLINE: Record<string, string> = {
  RESORT:     "Escape the ordinary — your retreat awaits.",
  GUESTHOUSE: "A warm welcome and a home away from home.",
  HOTEL:      "Comfortable stays for every journey.",
};

// ── Amenity icon mapping ────────────────────────────────────────────────────────
// Maps free-text amenity strings to real lucide icons instead of emoji.

const AMENITY_ICONS: { match: string[]; icon: LucideIcon }[] = [
  { match: ["wifi", "wi-fi", "internet"],                   icon: Wifi },
  { match: ["tv", "television", "cable", "netflix"],         icon: Tv },
  { match: ["coffee", "tea", "kettle", "espresso"],          icon: Coffee },
  { match: ["breakfast", "restaurant", "dining", "meal"],    icon: Utensils },
  { match: ["park", "garage", "valet"],                      icon: Car },
  { match: ["pool", "swim"],                                 icon: Waves },
  { match: ["air cond", "conditioning", "cooling", "a/c"],   icon: Wind },
  { match: ["heat", "heater", "fireplace"],                  icon: Flame },
  { match: ["shower", "bath", "toilet", "washroom"],         icon: Bath },
  { match: ["view", "sea", "ocean", "mountain", "balcony", "terrace"], icon: Mountain },
  { match: ["gym", "fitness", "workout"],                    icon: Dumbbell },
  { match: ["spa", "sauna", "massage", "wellness"],          icon: Sparkles },
  { match: ["bar", "minibar", "wine", "lounge"],             icon: Wine },
  { match: ["laundry", "iron", "wardrobe", "closet"],        icon: Shirt },
  { match: ["desk", "workspace", "work"],                    icon: Monitor },
  { match: ["fridge", "refrigerator"],                       icon: Refrigerator },
  { match: ["ac", "climate"],                                icon: Snowflake },
  { match: ["bed", "king", "queen", "twin", "linen"],        icon: BedDouble },
];

function amenityIcon(name: string): LucideIcon {
  const n = name.toLowerCase();
  for (const { match, icon } of AMENITY_ICONS) {
    if (match.some((m) => n.includes(m))) return icon;
  }
  return Check;
}

// ── Lightbox ──────────────────────────────────────────────────────────────────

function Lightbox({ urls, startIdx, onClose }: { urls: string[]; startIdx: number; onClose: () => void }) {
  const [idx, setIdx] = useState(startIdx);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape")     onClose();
      if (e.key === "ArrowLeft")  setIdx((i) => (i - 1 + urls.length) % urls.length);
      if (e.key === "ArrowRight") setIdx((i) => (i + 1) % urls.length);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, urls.length]);

  return (
    <div className="fixed inset-0 z-[200] bg-black/95 flex flex-col" onClick={onClose}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-3 shrink-0" onClick={(e) => e.stopPropagation()}>
        <span className="text-white/50 text-sm font-medium">{idx + 1} / {urls.length}</span>
        <button onClick={onClose} className="h-9 w-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors">
          <X size={18} />
        </button>
      </div>

      {/* Main image */}
      <div className="flex-1 flex items-center justify-center relative px-16 min-h-0" onClick={(e) => e.stopPropagation()}>
        <img src={urls[idx]} alt="" className="max-h-full max-w-full object-contain rounded-xl" />
        {urls.length > 1 && (
          <>
            <button onClick={() => setIdx((i) => (i - 1 + urls.length) % urls.length)}
              className="absolute left-3 h-11 w-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors">
              <ChevronLeft size={22} />
            </button>
            <button onClick={() => setIdx((i) => (i + 1) % urls.length)}
              className="absolute right-3 h-11 w-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors">
              <ChevronRight size={22} />
            </button>
          </>
        )}
      </div>

      {/* Thumbnail strip */}
      {urls.length > 1 && (
        <div className="flex gap-2 px-5 py-4 overflow-x-auto justify-center shrink-0" onClick={(e) => e.stopPropagation()}>
          {urls.map((url, i) => (
            <button key={i} onClick={() => setIdx(i)}
              className={cn("h-14 w-20 rounded-lg overflow-hidden shrink-0 border-2 transition-all",
                i === idx ? "border-white opacity-100 scale-105" : "border-transparent opacity-40 hover:opacity-70")}>
              <img src={url} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Quick Look Modal ──────────────────────────────────────────────────────────

function QuickLookModal({
  room, suggestedRate, cartQty, datesSelected, maxQty, onClose, onChangeQty,
}: {
  room: PublicRoomType;
  suggestedRate: number | null;
  cartQty: number;
  datesSelected: boolean;
  maxQty: number;
  onClose: () => void;
  onChangeQty: (delta: number) => void;
}) {
  const [photoIdx,      setPhotoIdx]      = useState(0);
  const [lightboxOpen,  setLightboxOpen]  = useState(false);
  const photos = room.photoUrls;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [onClose]);

  return (
    <>
      {lightboxOpen && photos.length > 0 && (
        <Lightbox urls={photos} startIdx={photoIdx} onClose={() => setLightboxOpen(false)} />
      )}

      {/* Backdrop */}
      <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Panel — bottom sheet on mobile, centered modal on desktop */}
      <div className="fixed inset-x-0 bottom-0 z-[70] bg-white rounded-t-3xl max-h-[94vh] flex flex-col lg:inset-0 lg:m-auto lg:rounded-2xl lg:max-w-[720px] lg:max-h-[88vh] lg:shadow-2xl">

        {/* Gallery */}
        <div className="relative overflow-hidden rounded-t-3xl lg:rounded-t-2xl shrink-0" style={{ height: "44vh", minHeight: 220 }}>
          {photos.length > 0 ? (
            <>
              <img src={photos[photoIdx]} alt={room.name}
                className="w-full h-full object-cover cursor-zoom-in transition-transform duration-500"
                onClick={() => setLightboxOpen(true)} />
              <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent pointer-events-none" />

              {/* Zoom hint */}
              <button onClick={() => setLightboxOpen(true)}
                className="absolute bottom-3 right-3 flex items-center gap-1.5 bg-black/40 hover:bg-black/60 text-white text-[11px] font-semibold px-3 py-1.5 rounded-full backdrop-blur-sm transition-colors">
                <ZoomIn size={12} /> View full screen
              </button>

              {photos.length > 1 && (
                <>
                  <button onClick={() => setPhotoIdx((i) => (i - 1 + photos.length) % photos.length)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-white/85 hover:bg-white shadow flex items-center justify-center transition-colors">
                    <ChevronLeft size={17} className="text-gray-700" />
                  </button>
                  <button onClick={() => setPhotoIdx((i) => (i + 1) % photos.length)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-white/85 hover:bg-white shadow flex items-center justify-center transition-colors">
                    <ChevronRight size={17} className="text-gray-700" />
                  </button>
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                    {photos.map((_, i) => (
                      <button key={i} onClick={() => setPhotoIdx(i)}
                        className="rounded-full transition-all"
                        style={{ width: i === photoIdx ? 18 : 6, height: 6, background: i === photoIdx ? "#fff" : "rgba(255,255,255,0.5)" }} />
                    ))}
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-6xl bg-gray-100">🛏️</div>
          )}

          {/* Close */}
          <button onClick={onClose}
            className="absolute top-4 right-4 h-9 w-9 rounded-full bg-white shadow flex items-center justify-center hover:bg-gray-50 transition-colors z-10">
            <X size={15} className="text-gray-700" />
          </button>
        </div>

        {/* Thumbnail strip */}
        {photos.length > 1 && (
          <div className="flex gap-2 px-5 py-2.5 border-b border-gray-100 overflow-x-auto shrink-0">
            {photos.map((url, i) => (
              <button key={i} onClick={() => setPhotoIdx(i)}
                className={cn("h-11 w-16 rounded-lg overflow-hidden shrink-0 border-2 transition-all",
                  i === photoIdx ? "border-gray-900 opacity-100" : "border-transparent opacity-50 hover:opacity-75")}>
                <img src={url} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}

        {/* Content */}
        <div className="overflow-y-auto flex-1 px-5 py-5">
          {/* Header */}
          <div className="flex items-start justify-between gap-4 mb-5">
            <div>
              <h2 className="be-serif text-[22px] font-semibold text-gray-900 leading-tight">{room.name}</h2>
              <div className="flex items-center gap-1.5 mt-1.5 text-gray-400 text-sm">
                <Users size={13} />
                <span>Max {room.maxOccupancy} guests</span>
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-[22px] font-bold text-gray-900 leading-none">
                {suggestedRate !== null ? fmt(suggestedRate) : fmt(room.defaultRate)}
              </div>
              <div className="text-xs text-gray-400 mt-0.5">
                {suggestedRate !== null ? "per night" : "from / night"}
              </div>
            </div>
          </div>

          {room.description && (
            <div className="mb-6">
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-gray-400 mb-2.5">About this room</p>
              <p className="text-sm text-gray-600 leading-relaxed border-l-2 pl-3" style={{ borderColor: "rgb(var(--be-accent-soft))" }}>
                {room.description}
              </p>
            </div>
          )}

          {room.amenities.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-gray-400 mb-3">What's included</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                {room.amenities.map((a) => {
                  const Icon = amenityIcon(a);
                  return (
                    <div key={a} className="flex items-center gap-2.5 text-[13px] text-gray-700">
                      <div className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0"
                        style={{ background: "rgb(var(--be-accent-soft))" }}>
                        <Icon size={14} style={{ color: "rgb(var(--be-accent))" }} strokeWidth={2} />
                      </div>
                      {a}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="h-6" />
        </div>

        {/* Sticky footer CTA */}
        <div className="border-t border-gray-100 px-5 py-4 bg-white rounded-b-3xl lg:rounded-b-2xl shrink-0">
          {!datesSelected ? (
            <p className="text-sm text-center text-gray-400 font-medium py-1">
              Pick your dates above to check pricing & availability
            </p>
          ) : cartQty === 0 ? (
            <button onClick={() => { onChangeQty(1); onClose(); }}
              className="w-full py-3.5 rounded-xl text-white font-semibold text-[15px] transition-opacity hover:opacity-90 active:scale-[0.99]"
              style={{ background: "rgb(var(--be-accent))" }}>
              Reserve this room
            </button>
          ) : (
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm font-semibold text-gray-600">{cartQty} room{cartQty !== 1 ? "s" : ""} in selection</span>
              <div className="flex items-center gap-2 rounded-xl border border-gray-200 p-1 bg-gray-50">
                <button onClick={() => onChangeQty(-1)}
                  className="h-8 w-8 rounded-lg bg-white border border-gray-100 flex items-center justify-center hover:bg-gray-100 transition-colors"
                  style={{ color: "rgb(var(--be-accent))" }}>
                  <Minus size={13} strokeWidth={2.5} />
                </button>
                <span className="w-6 text-center text-sm font-bold text-gray-900">{cartQty}</span>
                <button onClick={() => onChangeQty(1)} disabled={cartQty >= maxQty}
                  className="h-8 w-8 rounded-xl flex items-center justify-center text-white disabled:opacity-30 transition-opacity"
                  style={{ background: "rgb(var(--be-accent))" }}>
                  <Plus size={13} strokeWidth={2.5} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function RoomCard({
  room, availableCount, suggestedRate, cartQty, datesSelected, maxQty, onChangeQty, onQuickLook,
}: {
  room: PublicRoomType;
  availableCount: number | null;
  suggestedRate: number | null;
  cartQty: number;
  datesSelected: boolean;
  maxQty: number;
  onChangeQty: (delta: number) => void;
  onQuickLook: () => void;
}) {
  const isUnavailable = datesSelected && availableCount !== null && availableCount === 0;
  const showUrgency   = datesSelected && availableCount !== null && availableCount > 0 && availableCount <= 4;
  const rate = suggestedRate !== null ? suggestedRate : room.defaultRate;

  const shownAmenities = room.amenities.slice(0, 5);
  const extraAmenities = Math.max(0, room.amenities.length - shownAmenities.length);

  return (
    <div className={cn(
      "group bg-white rounded-2xl border border-gray-200/80 shadow-sm hover:shadow-md hover:border-gray-300 transition-all duration-200 overflow-hidden mb-5",
      isUnavailable && "opacity-60",
    )}>
      <div className="flex flex-col sm:flex-row p-4 gap-4">
        {/* Image tile */}
        <div className="w-full sm:w-[300px] xl:w-[340px] shrink-0 flex flex-col gap-2.5">
          <div
            className="relative h-48 rounded-xl border border-gray-100 cursor-pointer overflow-hidden bg-gray-100"
            onClick={onQuickLook}
          >
            {room.photoUrls.length > 0 ? (
              <img src={room.photoUrls[0]} alt={room.name}
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-5xl">🛏️</div>
            )}
            {showUrgency && (
              <span className="absolute top-3 left-3 bg-rose-600 text-white text-[10px] font-semibold px-2.5 py-1 rounded-full shadow-sm">
                Only {availableCount} left
              </span>
            )}
            {room.photoUrls.length > 1 && (
              <span className="absolute bottom-3 right-3 flex items-center gap-1 text-white text-[10.5px] font-medium bg-black/45 backdrop-blur-sm px-2.5 py-1 rounded-full">
                <ZoomIn size={11} /> {room.photoUrls.length} photos
              </span>
            )}
          </div>
          <div className="px-0.5">
            <div className="flex items-center gap-2 text-[12.5px] font-semibold text-gray-800">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-[rgb(var(--be-accent))] shrink-0" /> Bed &amp; breakfast
            </div>
            <div className="text-[11.5px] text-gray-400 mt-0.5">Free cancellation · No prepayment</div>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h3 className="text-[17px] font-bold text-gray-900 leading-snug">{room.name}</h3>
              <div className="flex items-center gap-1.5 mt-1 text-gray-500 text-[12.5px]">
                <Users size={13} /> <span>Sleeps up to {room.maxOccupancy}</span>
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-[19px] font-bold text-gray-900 leading-none">{fmt(rate)}</div>
              <div className="text-[11px] text-gray-400 mt-1">{datesSelected ? "per night" : "from / night"}</div>
            </div>
          </div>

          <div className="flex-1" />

          {/* Amenity chips — pushed down to where the rate-plan text used to sit */}
          {room.amenities.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3.5">
              {shownAmenities.map((a) => {
                const Icon = amenityIcon(a);
                return (
                  <span key={a}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-50 border border-gray-100 text-gray-600 text-[11.5px] font-medium">
                    <Icon size={13} className="text-gray-400 shrink-0" /> {a}
                  </span>
                );
              })}
              {extraAmenities > 0 && (
                <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-gray-400 text-[11.5px] font-medium">
                  +{extraAmenities} more
                </span>
              )}
            </div>
          )}

          <div className="flex items-center justify-between gap-4 pt-3 border-t border-gray-100">
            <button onClick={onQuickLook}
              className="inline-flex items-center gap-1 text-[12.5px] font-semibold hover:underline transition-colors"
              style={{ color: "rgb(var(--be-accent))" }}>
              More details <ChevronRight size={13} strokeWidth={2.5} />
            </button>

            {isUnavailable ? (
              <span className="text-[12px] font-semibold text-rose-500 shrink-0">Sold out</span>
            ) : cartQty === 0 ? (
              <button onClick={() => onChangeQty(1)}
                className="shrink-0 px-5 py-2.5 text-[13px] font-bold text-white rounded-xl bg-[rgb(var(--be-accent))] hover:bg-[rgb(var(--be-accent-dark))] active:scale-[0.98] transition-all shadow-sm">
                Add room
              </button>
            ) : (
              <div className="flex items-center gap-1 rounded-xl border border-gray-200 bg-gray-50 p-1 shrink-0">
                <button onClick={() => onChangeQty(-1)}
                  className="h-8 w-8 rounded-lg bg-white border border-gray-100 flex items-center justify-center text-gray-600 hover:bg-gray-100 transition-colors">
                  <Minus size={14} strokeWidth={2.5} />
                </button>
                <span className="w-7 text-center text-[14px] font-bold text-gray-900 tabular-nums">{cartQty}</span>
                <button onClick={() => onChangeQty(1)} disabled={cartQty >= maxQty}
                  className="h-8 w-8 rounded-lg bg-[rgb(var(--be-accent))] flex items-center justify-center text-white hover:bg-[rgb(var(--be-accent-dark))] disabled:opacity-30 transition-all">
                  <Plus size={14} strokeWidth={2.5} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function BookingLandingPage() {
  const { hotelSlug } = useParams<{ hotelSlug: string }>();
  const navigate      = useNavigate();

  const [checkIn,  setCheckIn]  = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [adults,        setAdults]        = useState(1); // applied — used for filtering, cart, and continue
  const [pendingAdults, setPendingAdults]  = useState(1); // live value inside the guest picker, committed on Search
  const [quickLookRoom, setQuickLookRoom] = useState<PublicRoomType | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showPromoInput, setShowPromoInput] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [showGuestPicker, setShowGuestPicker] = useState(false);
  const datePickerRef  = useRef<HTMLDivElement>(null);
  const guestPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showDatePicker && !showGuestPicker) return;
    const handler = (e: MouseEvent) => {
      if (showDatePicker && datePickerRef.current && !datePickerRef.current.contains(e.target as Node)) {
        setShowDatePicker(false);
      }
      if (showGuestPicker && guestPickerRef.current && !guestPickerRef.current.contains(e.target as Node)) {
        setShowGuestPicker(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showDatePicker, showGuestPicker]);

  const datesSelected = !!(checkIn && checkOut && checkOut > checkIn);
  const nights = datesSelected
    ? Math.ceil((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86_400_000)
    : 0;

  const [cart, setCart] = useState<CartItem[]>(() => {
    if (!hotelSlug) return [];
    try { return JSON.parse(sessionStorage.getItem(CART_KEY(hotelSlug)) ?? "[]") as CartItem[]; }
    catch { return []; }
  });

  useEffect(() => {
    if (!hotelSlug) return;
    sessionStorage.setItem(CART_KEY(hotelSlug), JSON.stringify(cart));
  }, [cart, hotelSlug]);

  useEffect(() => { setCart([]); }, [checkIn, checkOut]);

  const cartTotalRooms   = cart.reduce((s, c) => s + c.quantity, 0);
  const cartNightlyTotal = cart.reduce((s, c) => s + (c.ratePerNight ?? c.defaultRate) * c.quantity, 0);

  const { data: hotel, isLoading, isError } = useQuery({
    queryKey: ["booking-hotel", hotelSlug],
    queryFn:  () => bookingEngineService.getHotel(hotelSlug!),
    enabled:  !!hotelSlug,
  });

  const { data: roomTypes = [] } = useQuery({
    queryKey: ["booking-room-types", hotelSlug],
    queryFn:  () => bookingEngineService.getRoomTypes(hotelSlug!),
    enabled:  !!hotelSlug,
  });

  const { data: availability } = useQuery({
    queryKey: ["booking-availability", hotelSlug, checkIn, checkOut],
    queryFn:  () => bookingEngineService.getAvailability(hotelSlug!, checkIn, checkOut),
    enabled:  !!hotelSlug && datesSelected,
  });

  const [rates, setRates] = useState<Record<string, number | null>>({});
  useEffect(() => {
    if (!datesSelected || !hotelSlug || roomTypes.length === 0) { setRates({}); return; }
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        roomTypes.map(async (rt) => {
          try {
            const r = await bookingEngineService.suggestRate(hotelSlug, rt.id, checkIn, checkOut);
            return [rt.id, r.suggestedRate] as const;
          } catch { return [rt.id, null] as const; }
        })
      );
      if (!cancelled) setRates(Object.fromEntries(entries));
    })();
    return () => { cancelled = true; };
  }, [datesSelected, hotelSlug, checkIn, checkOut, roomTypes]);

  const availabilityMap = Object.fromEntries(
    (availability ?? []).map((a) => [a.roomTypeId, a.availableCount])
  );

  const maxCapacityAcrossRooms = roomTypes.length > 0
    ? Math.max(...roomTypes.map((r) => r.maxOccupancy))
    : 20;

  const visibleRoomTypes = roomTypes.filter((rt) => rt.maxOccupancy >= adults);

  const handleChangeQty = useCallback((room: PublicRoomType, suggestedRate: number | null, delta: number) => {
    if (!datesSelected && delta > 0) {
      setQuickLookRoom(room);
      return;
    }
    setCart((prev) => {
      const existing = prev.find((c) => c.roomTypeId === room.id);
      const newQty   = Math.max(0, (existing?.quantity ?? 0) + delta);
      const maxQty   = availabilityMap[room.id] ?? 10;
      const clamped  = Math.min(newQty, maxQty);
      if (clamped === 0) return prev.filter((c) => c.roomTypeId !== room.id);
      if (existing) return prev.map((c) => c.roomTypeId === room.id ? { ...c, quantity: clamped, ratePerNight: suggestedRate } : c);
      return [...prev, { roomTypeId: room.id, roomTypeName: room.name, quantity: clamped, ratePerNight: suggestedRate, defaultRate: room.defaultRate, maxOccupancy: room.maxOccupancy }];
    });
  }, [datesSelected, availabilityMap]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-[14px] text-gray-400">Loading…</div>
      </div>
    );
  }
  if (isError || !hotel) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-[15px] text-gray-400">This booking page is not available.</p>
      </div>
    );
  }

  const themeKey = hotel.themeKey ?? "WARM_CLAY";
  const tagline  = TAGLINE[hotel.propertyType] ?? TAGLINE["HOTEL"];

  const quickLookCartQty  = quickLookRoom ? (cart.find((c) => c.roomTypeId === quickLookRoom.id)?.quantity ?? 0) : 0;
  const quickLookMaxQty   = quickLookRoom ? (availabilityMap[quickLookRoom.id] ?? 10) : 0;
  const quickLookRate     = quickLookRoom ? (rates[quickLookRoom.id] ?? null) : null;

  return (
    <div className="booking-theme min-h-screen bg-[#F8F9FA]" data-be-theme={themeKey}>
      
      {/* Quick Look Modal */}
      {quickLookRoom && (
        <QuickLookModal
          room={quickLookRoom}
          suggestedRate={quickLookRate}
          cartQty={quickLookCartQty}
          datesSelected={datesSelected}
          maxQty={quickLookMaxQty}
          onClose={() => setQuickLookRoom(null)}
          onChangeQty={(delta) => handleChangeQty(quickLookRoom, quickLookRate, delta)}
        />
      )}

      {/* Header */}
      <header className="bg-white border-b border-gray-100 h-16 flex items-center shrink-0 shadow-sm">
        <div className="max-w-[1600px] w-full mx-auto px-5 sm:px-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
             {hotel.logoUrl ? (
                <img src={hotel.logoUrl} alt={hotel.name} className="h-10 object-contain" />
             ) : (
                <span className="font-bold text-[rgb(var(--be-accent))] text-[15px] uppercase tracking-wide">{hotel.name}</span>
             )}
          </div>
          <div className="flex items-center gap-4">
            <a href="/" className="text-[13px] text-gray-700 hover:text-gray-900 hover:underline">Home</a>
            <a href="/login"
              className="flex items-center px-4 py-2 rounded-lg border-2 border-gray-800 text-[13px] font-bold text-gray-800 hover:bg-gray-800 hover:text-white transition-all whitespace-nowrap shrink-0">
              Property Login
            </a>
          </div>
        </div>
      </header>

      <div className="max-w-[1600px] mx-auto px-5 sm:px-8 py-8">
        
        {/* Search Top */}
        <div className="flex flex-col gap-4 mb-6">
          <div className="flex flex-col lg:flex-row items-end gap-3">
             <div className="flex-1 w-full relative">
               <label className="text-[11px] text-gray-700 font-medium mb-1 block">Check-in and check-out</label>
               <div className="relative" ref={datePickerRef}>
                 <div onClick={() => setShowDatePicker(!showDatePicker)} className="bg-white border border-gray-200 rounded-lg flex px-3.5 items-center text-[13px] hover:border-gray-300 transition-colors focus-within:border-gray-400 cursor-pointer h-11">
                   <span className="flex-1 text-gray-800">
                     {checkIn && checkOut 
                       ? `${format(parseISO(checkIn), "MMM d, yyyy")} - ${format(parseISO(checkOut), "MMM d, yyyy")}` 
                       : "Select dates"}
                   </span>
                   <Calendar size={15} className="text-gray-400 ml-2 pointer-events-none" />
                 </div>
                 
                 {showDatePicker && (
                   <div className="absolute top-full left-0 mt-2 z-50 shadow-xl rounded-lg overflow-hidden border border-gray-200 bg-white">
                     <DateRange
                       ranges={[{
                         startDate: checkIn ? parseISO(checkIn) : new Date(),
                         endDate: checkOut ? parseISO(checkOut) : new Date(),
                         key: 'selection',
                       }]}
                       onChange={(ranges: RangeKeyDict) => {
                         const { selection } = ranges;
                         if (selection.startDate) setCheckIn(localDateString(selection.startDate));
                         if (selection.endDate) setCheckOut(localDateString(selection.endDate));
                       }}
                       months={2}
                       direction="horizontal"
                       showDateDisplay={false}
                       rangeColors={["rgb(var(--be-accent))"]}
                       minDate={new Date()}
                     />
                     <div className="p-3 border-t border-gray-100 flex justify-end bg-gray-50">
                       <button onClick={() => setShowDatePicker(false)} className="text-[13px] font-bold text-[rgb(var(--be-accent))] hover:text-[rgb(var(--be-accent-dark))]">Done</button>
                     </div>
                   </div>
                 )}
               </div>
             </div>
             
             <div className="flex-1 w-full relative" ref={guestPickerRef}>
               <label className="text-[11px] text-gray-700 font-medium mb-1 block">Rooms and guests</label>
               <div onClick={() => { if (!showGuestPicker) setPendingAdults(adults); setShowGuestPicker((v) => !v); }}
                 className="bg-white border border-gray-200 rounded-lg px-3.5 text-[13px] text-gray-800 flex justify-between items-center cursor-pointer hover:border-gray-300 transition-colors h-11">
                 <span>1 room, {adults} adult{adults !== 1 ? "s" : ""}</span>
                 <ChevronRight size={14} className={cn("text-gray-400 transition-transform", showGuestPicker ? "-rotate-90" : "rotate-90")} />
               </div>

               {showGuestPicker && (
                 <div className="absolute top-full left-0 right-0 mt-2 z-50 bg-white rounded-xl border border-gray-200 shadow-xl p-4">
                   <div className="text-[13px] font-semibold text-gray-900 mb-3">Room 1</div>
                   <div className="flex items-center justify-between">
                     <span className="text-[13px] text-gray-700">Adults</span>
                     <div className="flex items-center gap-3">
                       <button onClick={() => setPendingAdults((a) => Math.max(1, a - 1))} disabled={pendingAdults <= 1}
                         className="h-8 w-8 rounded-full border border-gray-200 flex items-center justify-center text-gray-600 hover:border-gray-300 disabled:opacity-30 transition-colors">
                         <Minus size={14} strokeWidth={2.5} />
                       </button>
                       <span className="w-5 text-center text-[14px] font-semibold text-gray-900 tabular-nums">{pendingAdults}</span>
                       <button onClick={() => setPendingAdults((a) => Math.min(maxCapacityAcrossRooms, a + 1))} disabled={pendingAdults >= maxCapacityAcrossRooms}
                         className="h-8 w-8 rounded-full bg-[rgb(var(--be-accent))] flex items-center justify-center text-white hover:bg-[rgb(var(--be-accent-dark))] disabled:opacity-30 transition-colors">
                         <Plus size={14} strokeWidth={2.5} />
                       </button>
                     </div>
                   </div>
                   <p className="text-[11px] text-gray-400 mt-2">Max {maxCapacityAcrossRooms} — largest room's capacity</p>
                   <div className="mt-4 pt-3 border-t border-gray-100 flex justify-end gap-4">
                     <button onClick={() => { setAdults(pendingAdults); setShowGuestPicker(false); }}
                       className="text-[13px] font-bold text-[rgb(var(--be-accent))] hover:text-[rgb(var(--be-accent-dark))]">Done</button>
                   </div>
                 </div>
               )}
             </div>

             <button onClick={() => { setAdults(pendingAdults); setShowGuestPicker(false); setShowDatePicker(false); }}
               className="bg-[rgb(var(--be-accent))] text-white text-[14px] font-semibold h-11 px-8 rounded-lg flex items-center justify-center gap-2 hover:bg-[rgb(var(--be-accent-dark))] transition-colors shrink-0 w-full lg:w-44 shadow-sm">
               <Search size={16} strokeWidth={2.5} />
               Search
             </button>
          </div>

          {/* Tabs */}
          <div className="flex justify-between items-center border-b border-gray-200 mt-2">
             <div className="flex gap-6 overflow-x-auto hide-scrollbar">
                <button className="text-[13px] font-medium text-[rgb(var(--be-accent))] border-b-2 border-[rgb(var(--be-accent))] pb-2.5 px-1 whitespace-nowrap">Reservation</button>
                <button className="text-[13px] font-medium text-gray-600 pb-2.5 px-1 hover:text-gray-900 whitespace-nowrap">Packages & Deals</button>
                <button className="text-[13px] font-medium text-gray-600 pb-2.5 px-1 hover:text-gray-900 whitespace-nowrap">Availability Calendar</button>
             </div>
             <div className="hidden sm:flex text-[11px] text-gray-600 pb-2.5 items-center gap-1 cursor-pointer hover:text-gray-900">
               en-US - (PKR) <ChevronRight size={10} className="rotate-90 mt-0.5" />
             </div>
          </div>
        </div>

        {/* 2-Column Layout */}
        <div className="flex flex-col lg:flex-row gap-6 items-start mt-8">
           
           {/* Left Column (Rooms) */}
           <div className="flex-1 min-w-0 w-full">
             {roomTypes.length === 0 ? (
               <div className="bg-white p-12 text-center border border-gray-200/80 rounded-2xl shadow-sm">
                 <p className="text-[14px] text-gray-500">No rooms listed at this time.</p>
               </div>
             ) : visibleRoomTypes.length === 0 ? (
               <div className="bg-white p-12 text-center border border-gray-200/80 rounded-2xl shadow-sm">
                 <p className="text-[14px] text-gray-500">No rooms sleep {adults} adults. Try reducing the guest count.</p>
               </div>
             ) : (
               visibleRoomTypes.map((rt) => {
                  const cartItem = cart.find((c) => c.roomTypeId === rt.id);
                  return (
                    <RoomCard
                      key={rt.id}
                      room={rt}
                      availableCount={datesSelected ? (availabilityMap[rt.id] ?? null) : null}
                      suggestedRate={datesSelected ? (rates[rt.id] ?? null) : null}
                      cartQty={cartItem?.quantity ?? 0}
                      datesSelected={datesSelected}
                      maxQty={datesSelected ? (availabilityMap[rt.id] ?? 10) : 10}
                      onChangeQty={(delta) => handleChangeQty(rt, rates[rt.id] ?? null, delta)}
                      onQuickLook={() => setQuickLookRoom(rt)}
                    />
                  );
               })
             )}
           </div>

           {/* Right Column (Sidebar) */}
           <div className="w-full lg:w-[360px] shrink-0 flex flex-col gap-6">
             
             {/* Your Reservation Box */}
             <div className="bg-white border border-gray-200/80 rounded-2xl shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100">
                  <h2 className="text-[15px] font-medium text-gray-900">Your reservation</h2>
                </div>
                
                <div className="px-5 py-4 text-[12px] text-gray-800 flex flex-col gap-1.5 border-b border-gray-100">
                   <div>Check-in: <span className="font-medium ml-1">{checkIn ? fmtShortDate(checkIn) : "-"}</span></div>
                   <div>Check-out: <span className="font-medium ml-1">{checkOut ? fmtShortDate(checkOut) : "-"}</span></div>
                </div>

                <div className="px-5 py-4 text-[12px] text-gray-800 border-b border-gray-100 font-medium">
                   {cartTotalRooms > 0 ? `${cartTotalRooms} room, ${adults} adults, ${nights} night` : "No rooms selected"}
                </div>

                <div className="border-b border-gray-100">
                  {!showPromoInput ? (
                    <button onClick={() => setShowPromoInput(true)}
                      className="w-full px-5 py-4 text-[12px] text-gray-800 flex items-center gap-2 hover:bg-gray-50 transition-colors group">
                      <Tag size={14} className="text-gray-400 group-hover:text-gray-600 transition-colors" />
                      <span className="group-hover:underline">{promoCode ? `Code: ${promoCode}` : "Promo / Corporate Code"}</span>
                    </button>
                  ) : (
                    <div className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <input
                          autoFocus
                          type="text"
                          value={promoCode}
                          onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                          onKeyDown={(e) => { if (e.key === "Enter") setShowPromoInput(false); if (e.key === "Escape") setShowPromoInput(false); }}
                          placeholder="Enter code"
                          className="flex-1 h-9 rounded-lg border border-gray-200 px-3 text-[12.5px] text-gray-800 placeholder:text-gray-400 focus:outline-none focus:border-gray-400 transition-colors"
                        />
                        <button onClick={() => setShowPromoInput(false)}
                          className="h-9 px-3.5 rounded-lg bg-gray-900 text-white text-[12px] font-semibold hover:bg-gray-800 transition-colors shrink-0">
                          Apply
                        </button>
                      </div>
                      <p className="text-[11px] text-gray-400 mt-2">Code will be verified at checkout</p>
                    </div>
                  )}
                </div>

                <div className="px-5 py-5 border-b border-gray-100 flex items-center justify-between">
                   <span className="text-[14px] text-gray-900">Total</span>
                   <span className="text-[16px] font-bold text-gray-900">{fmt(cartNightlyTotal * nights)}</span>
                </div>

                <div className="p-4 bg-gray-50/50">
                   <button disabled={cartTotalRooms === 0} onClick={() => { if (hotelSlug) navigate(`/book/${hotelSlug}/reserve?checkIn=${checkIn}&checkOut=${checkOut}&adults=${adults}`); }}
                     className="w-full py-3 bg-[rgb(var(--be-accent))] text-white font-bold text-[13px] rounded-lg hover:bg-[rgb(var(--be-accent-dark))] transition-all disabled:bg-gray-200 disabled:text-gray-500 disabled:cursor-not-allowed shadow-sm">
                     Continue &gt;
                   </button>
                </div>
             </div>

             {/* Hotel Info Box */}
             <div className="bg-white border border-gray-200/80 rounded-2xl shadow-sm overflow-hidden flex flex-col">
                {hotel.logoUrl ? (
                  <div className="relative h-40 w-full bg-gray-100 border-b border-gray-100">
                    <img src={hotel.logoUrl} alt={hotel.name} className="w-full h-full object-contain p-6" />
                  </div>
                ) : (
                  <div className="relative h-40 w-full border-b border-gray-100 flex items-center justify-center"
                    style={{ background: "linear-gradient(135deg, rgb(var(--be-accent-soft)) 0%, #ffffff 100%)" }}>
                    <span className="text-5xl opacity-80">🏨</span>
                  </div>
                )}
                <div className="p-5">
                  <h3 className="text-[14px] font-bold text-gray-900 mb-2 leading-tight">{hotel.name}{hotel.city && `, ${hotel.city}`}</h3>
                  <p className="text-[11px] text-gray-600 leading-relaxed mb-4 line-clamp-3">
                    {hotel.description || tagline}
                  </p>

                  {hotel.amenities.length > 0 && (
                    <div className="flex gap-3 mb-4 flex-wrap text-gray-400">
                      {hotel.amenities.slice(0, 6).map((a) => {
                        const Icon = amenityIcon(a);
                        return <Icon key={a} size={16} className="text-gray-400" aria-label={a} />;
                      })}
                    </div>
                  )}

                  <div className="mt-6 flex flex-col items-center gap-2.5">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-gray-800 tracking-wide border border-gray-200 bg-[rgb(var(--be-accent-soft))] px-3 py-1.5 rounded-sm">
                      <Lock size={12} className="text-[rgb(var(--be-accent))]" /> VERIFIED & SECURED
                    </div>
                    <span className="text-[10px] text-gray-500 font-medium">Powered by InnFlo</span>
                  </div>
                </div>
             </div>

           </div>
        </div>

        {/* Footer */}
        <div className="mt-16 text-center pb-8 border-t border-gray-200 pt-8">
           {hotel.logoUrl ? (
             <img src={hotel.logoUrl} alt={hotel.name} className="h-6 object-contain mx-auto mb-3 opacity-60 grayscale hover:grayscale-0 hover:opacity-100 transition-all cursor-pointer" />
           ) : (
             <div className="text-[12px] font-bold text-[rgb(var(--be-accent))] opacity-60 mb-3">{hotel.name}</div>
           )}
           <p className="text-[10px] text-gray-500 mb-1.5">
             {[hotel.address, hotel.city].filter(Boolean).join(", ")}
             <span className="mx-1">·</span>
             <a href="#" className="underline hover:text-gray-800">Show on map</a>
           </p>
           <div className="flex justify-center gap-3">
             <a href="#" className="text-[10px] text-gray-700 underline hover:text-gray-900">About us</a>
             <a href="#" className="text-[10px] text-gray-700 underline hover:text-gray-900">Contact</a>
           </div>
        </div>
      </div>
    </div>
  );
}
