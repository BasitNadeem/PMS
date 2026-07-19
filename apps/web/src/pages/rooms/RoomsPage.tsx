import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, BedDouble, DoorOpen, Wrench, OctagonX, Sparkles, ImagePlus, Loader2, X, Tag } from "lucide-react";
import { uploadService } from "@/services/upload";
import { cn } from "@/lib/cn";
import { roomsService, type Room, type RoomType, type RoomStatus } from "@/services/rooms";
import { maintenanceService } from "@/services/maintenance";
import { AddRoomModal } from "@/components/rooms/AddRoomModal";
import { EditRoomModal } from "@/components/rooms/EditRoomModal";
import { AddRoomTypeModal } from "@/components/rooms/AddRoomTypeModal";
import { Card } from "@/components/ui/Card";
import { StatusBadge, toneOf } from "@/components/ui/StatusBadge";
import { Segmented } from "@/components/ui/Segmented";
import { usePermissions } from "@/hooks/usePermissions";

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<RoomStatus, string> = {
  VACANT_CLEAN:      "Available",
  VACANT_DIRTY:      "Needs Cleaning",
  OCCUPIED:          "Occupied",
  UNDER_MAINTENANCE: "Maintenance",
  BLOCKED:           "Out of Order",
  OUT_OF_ORDER:      "Out of Order",
};

function formatPkr(paise: number) {
  const r = paise / 100;
  if (r >= 1000) return `PKR ${(r / 1000).toFixed(0)}k`;
  return `PKR ${r.toLocaleString("en-PK")}`;
}

const STATUS_ICONS: Record<string, React.ElementType> = {
  Available:        DoorOpen,
  Occupied:         BedDouble,
  "Needs Cleaning": Sparkles,
  Maintenance:      Wrench,
  "Out of Order":   OctagonX,
};

// ── Room Card ─────────────────────────────────────────────────────────────────

function RoomCard({ room, onEdit, canEdit, delay, hasOpenIssue }: { room: Room; onEdit: () => void; canEdit: boolean; delay: number; hasOpenIssue: boolean }) {
  const statusLabel = STATUS_LABEL[room.status] ?? "Available";
  const t = toneOf(statusLabel);
  return (
    <Card
      className="anim-fade-up group !p-0 overflow-hidden"
      hover
      style={{ animationDelay: delay + "ms" }}
    >
      <div className="flex items-stretch">
        <div className="w-[92px] shrink-0 grid place-items-center relative" style={{ background: t.bg }}>
          <div className="text-center">
            <div className="serif text-[30px] leading-none" style={{ color: t.fg }}>{room.number}</div>
            <div className="text-[10px] font-bold uppercase tracking-wider mt-1" style={{ color: t.fg, opacity: 0.7 }}>
              {room.floor != null ? `Floor ${room.floor}` : "—"}
            </div>
          </div>
          <span className="absolute top-2 left-2 h-2 w-2 rounded-full" style={{ background: t.dot }} />
          {hasOpenIssue && (
            <span
              className="absolute top-2 right-2 grid place-items-center h-5 w-5 rounded-full bg-clay text-white"
              title="Open urgent/high maintenance issue"
            >
              <Wrench size={11} />
            </span>
          )}
        </div>
        <div className="flex-1 p-4 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[15px] font-semibold text-ink truncate">{room.roomType.name}</div>
              <div className="text-[12.5px] text-ink-mute">Max {room.roomType.maxOccupancy} guests</div>
            </div>
            {canEdit && (
              <button
                onClick={onEdit}
                className="opacity-0 group-hover:opacity-100 transition-opacity grid place-items-center h-8 w-8 rounded-lg hover:bg-line-soft text-ink-mute"
              >
                <Pencil size={15} />
              </button>
            )}
          </div>
          <div className="mt-3 flex items-center justify-between">
            <StatusBadge status={statusLabel} size="sm" />
            <div className="serif text-[18px] text-ink tnum">
              {formatPkr(room.roomType.defaultRate)}
              <span className="text-[11px] text-ink-mute font-sans">/night</span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

// ── Room Types ────────────────────────────────────────────────────────────────

const AMENITY_PRESETS = ["WiFi", "AC", "TV", "Minibar", "Balcony", "Attached Bathroom", "Room Service", "Heater"];

function TypeCard({ rt, canEdit, delay }: { rt: RoomType; canEdit: boolean; delay: number }) {
  const [editing, setEditing] = useState(false);
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name:         rt.name,
    description:  rt.description ?? "",
    defaultRate:  String(rt.defaultRate / 100),
    maxOccupancy: String(rt.maxOccupancy),
  });
  const [photoUrls, setPhotoUrls]       = useState<string[]>(rt.photoUrls ?? []);
  const [photoUploading, setPhotoUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [amenities, setAmenities] = useState<string[]>(rt.amenities ?? []);
  const [amenityInput, setAmenityInput] = useState("");

  function addAmenity(value: string) {
    const trimmed = value.trim();
    if (!trimmed || amenities.includes(trimmed)) return;
    setAmenities((prev) => [...prev, trimmed]);
  }
  function removeAmenity(a: string) { setAmenities((prev) => prev.filter((x) => x !== a)); }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    const remaining = 8 - photoUrls.length;
    const toUpload  = files.slice(0, remaining);
    setPhotoUploading(true);
    try {
      const urls = await Promise.all(toUpload.map((f) => uploadService.uploadPhoto(f)));
      setPhotoUrls((prev) => [...prev, ...urls]);
    } catch { /* non-fatal */ }
    finally { setPhotoUploading(false); e.target.value = ""; }
  }

  const mutation = useMutation({
    mutationFn: (dto: { name: string; description?: string; defaultRate: number; maxOccupancy: number; photoUrls: string[]; amenities: string[] }) =>
      roomsService.updateRoomType(rt.id, dto),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["room-types"] }); setEditing(false); },
  });

  if (editing) {
    return (
      <Card className="anim-fade-up border-coral ring-2 ring-coral/10" style={{ animationDelay: delay + "ms" }}>
        <div className="space-y-3">
          <div>
            <label className="mb-1.5 block text-[13px] font-semibold text-ink-soft">Name <span className="text-coral text-[15px] font-bold leading-none">*</span></label>
            <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="h-11 w-full rounded-xl bg-mist border border-line px-3.5 text-sm text-ink outline-none focus:border-coral focus:ring-2 focus:ring-coral/15 transition-all" />
          </div>
          <div>
            <label className="mb-1.5 block text-[13px] font-semibold text-ink-soft">Description</label>
            <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={2} placeholder="Optional description…"
              className="w-full rounded-xl bg-mist border border-line px-3.5 py-2.5 text-sm text-ink outline-none focus:border-coral focus:ring-2 focus:ring-coral/15 transition-all resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-[13px] font-semibold text-ink-soft">Max guests <span className="text-coral text-[15px] font-bold leading-none">*</span></label>
              <input type="number" min={1} value={form.maxOccupancy} onChange={(e) => setForm((f) => ({ ...f, maxOccupancy: e.target.value }))}
                className="h-11 w-full rounded-xl bg-mist border border-line px-3.5 text-sm text-ink outline-none focus:border-coral focus:ring-2 focus:ring-coral/15 transition-all" />
            </div>
            <div>
              <label className="mb-1.5 block text-[13px] font-semibold text-ink-soft">Rate (PKR) <span className="text-coral text-[15px] font-bold leading-none">*</span></label>
              <input type="number" min={0} value={form.defaultRate} onChange={(e) => setForm((f) => ({ ...f, defaultRate: e.target.value }))}
                className="h-11 w-full rounded-xl bg-mist border border-line px-3.5 text-sm text-ink outline-none focus:border-coral focus:ring-2 focus:ring-coral/15 transition-all" />
            </div>
          </div>
          {/* Amenities */}
          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-[13px] font-semibold text-ink-soft"><Tag size={13} /> Amenities</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {AMENITY_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  disabled={amenities.includes(preset)}
                  onClick={() => addAmenity(preset)}
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-[12px] font-medium border transition-colors",
                    amenities.includes(preset)
                      ? "bg-coral/10 border-coral/20 text-coral cursor-default"
                      : "bg-mist border-line text-ink-mute hover:border-coral/30 hover:text-ink"
                  )}
                >
                  {preset}
                </button>
              ))}
            </div>
            {amenities.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {amenities.map((a) => (
                  <span key={a} className="inline-flex items-center gap-1 rounded-full bg-ink text-white text-[12px] px-2.5 py-0.5 font-medium">
                    {a}
                    <button type="button" onClick={() => removeAmenity(a)} className="hover:opacity-70">
                      <X size={9} />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input
                type="text"
                value={amenityInput}
                onChange={(e) => setAmenityInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addAmenity(amenityInput); setAmenityInput(""); } }}
                placeholder="Custom amenity…"
                className="flex-1 h-9 rounded-xl bg-mist border border-line px-3 text-sm text-ink outline-none focus:border-coral focus:ring-2 focus:ring-coral/15 transition-all"
              />
              <button
                type="button"
                onClick={() => { addAmenity(amenityInput); setAmenityInput(""); }}
                className="h-9 px-3 rounded-xl border border-line text-ink-mute hover:text-coral hover:border-coral/30 text-[13px] font-semibold transition-colors"
              >
                Add
              </button>
            </div>
          </div>

          {/* Photos */}
          <div>
            <label className="mb-1.5 block text-[13px] font-semibold text-ink-soft">Photos <span className="text-ink-faint font-normal normal-case">(up to 8)</span></label>
            {photoUrls.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {photoUrls.map((url, i) => (
                  <div key={i} className="relative h-16 w-16 rounded-lg overflow-hidden border border-line">
                    <img src={url} alt="" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setPhotoUrls((prev) => prev.filter((_, idx) => idx !== i))}
                      className="absolute top-0.5 right-0.5 grid place-items-center h-5 w-5 rounded-full bg-ink/70 text-white hover:bg-clay"
                    >
                      <X size={10} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {photoUrls.length < 8 && (
              <>
                <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoUpload} />
                <button
                  type="button"
                  disabled={photoUploading}
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 h-9 px-4 rounded-xl border border-dashed border-line text-ink-mute text-[13px] hover:border-coral/40 hover:text-coral transition-colors disabled:opacity-40"
                >
                  {photoUploading ? <Loader2 size={14} className="animate-spin" /> : <ImagePlus size={14} />}
                  {photoUploading ? "Uploading…" : "Add Photo"}
                </button>
              </>
            )}
          </div>

          {mutation.isError && (
            <p className="text-[13px] text-clay bg-clay-soft border border-clay/20 rounded-xl px-4 py-2.5">
              Something went wrong. Please try again.
            </p>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={() => setEditing(false)} className="h-9 px-4 rounded-full text-[13px] font-semibold text-ink-mute hover:bg-line-soft transition-colors">Cancel</button>
            <button
              onClick={() => mutation.mutate({ name: form.name.trim(), description: form.description.trim() || undefined, defaultRate: Math.round(Number(form.defaultRate) * 100), maxOccupancy: Number(form.maxOccupancy), photoUrls, amenities })}
              disabled={mutation.isPending}
              className="h-9 px-4 rounded-full bg-coral text-white text-[13px] font-semibold hover:bg-coral-dark disabled:opacity-40 transition-colors"
            >
              {mutation.isPending ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="anim-fade-up group" hover style={{ animationDelay: delay + "ms" }}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <span className="grid place-items-center h-12 w-12 rounded-xl2 bg-ink text-white">
            <BedDouble size={22} />
          </span>
          <div>
            <h3 className="serif text-[20px] text-ink leading-tight">{rt.name}</h3>
            <div className="text-[12.5px] text-ink-mute">Max {rt.maxOccupancy} guests</div>
          </div>
        </div>
        {canEdit && (
          <button
            onClick={() => setEditing(true)}
            className="grid place-items-center h-9 w-9 rounded-lg hover:bg-line-soft text-ink-mute opacity-0 group-hover:opacity-100 transition"
          >
            <Pencil size={16} />
          </button>
        )}
      </div>
      {rt.description && (
        <p className="mt-3 text-[13.5px] text-ink-mute leading-relaxed line-clamp-2">{rt.description}</p>
      )}
      {rt.amenities.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {rt.amenities.slice(0, 5).map((a) => (
            <span key={a} className="text-[11.5px] bg-mist border border-line-soft rounded-full px-2.5 py-0.5 text-ink-mute font-medium">{a}</span>
          ))}
          {rt.amenities.length > 5 && (
            <span className="text-[11.5px] text-ink-faint">+{rt.amenities.length - 5} more</span>
          )}
        </div>
      )}
      <div className="mt-4 flex items-center justify-between border-t border-line-soft pt-4">
        <div className="text-[11px] font-bold uppercase text-ink-faint">Base rate from</div>
        <div className="serif text-[22px] text-ink tnum">{formatPkr(rt.defaultRate)}</div>
      </div>
    </Card>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

type Tab = "rooms" | "types";

export default function RoomsPage() {
  const { has } = usePermissions();
  const canCreate = has("rooms:create");
  const canUpdate = has("rooms:update");
  const [tab, setTab]           = useState<Tab>("rooms");
  const [showAddRoom, setShowAddRoom] = useState(false);
  const [showAddType, setShowAddType] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [statusFilter, setStatusFilter] = useState("All");

  const { data: roomsResp, isLoading } = useQuery({
    queryKey: ["rooms"],
    queryFn: () => roomsService.getRooms(),
  });

  const { data: typesResp, isLoading: typesLoading } = useQuery({
    queryKey: ["room-types"],
    queryFn: roomsService.getRoomTypes,
  });

  const { data: ticketsResp } = useQuery({
    queryKey: ["maintenance", "all"],
    queryFn: () => maintenanceService.getTickets({ limit: 100 }),
  });

  const rooms = roomsResp?.data ?? [];
  const types = typesResp?.data ?? [];

  const roomsWithOpenIssues = new Set(
    (ticketsResp?.data ?? [])
      .filter((t) =>
        t.roomId &&
        (t.priority === "URGENT" || t.priority === "HIGH") &&
        (t.status === "OPEN" || t.status === "IN_PROGRESS" || t.status === "AWAITING_PARTS"),
      )
      .map((t) => t.roomId as string),
  );

  const statusLabels = ["Available", "Occupied", "Needs Cleaning", "Maintenance", "Out of Order"];
  const counts = statusLabels.reduce((m, s) => {
    m[s] = rooms.filter((r) => (STATUS_LABEL[r.status] ?? "Available") === s).length;
    return m;
  }, {} as Record<string, number>);

  const filtered = statusFilter === "All"
    ? rooms
    : rooms.filter((r) => (STATUS_LABEL[r.status] ?? "Available") === statusFilter);

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <div className="mb-1.5 text-[12px] font-bold uppercase tracking-[0.14em] text-coral">Inventory</div>
          <h1 className="serif text-[34px] leading-[1.05] text-ink">Rooms</h1>
          <p className="mt-1.5 text-[15px] text-ink-mute">
            {rooms.length} rooms · {counts["Available"] ?? 0} available now
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Segmented
            value={tab}
            onChange={(v) => setTab(v as Tab)}
            options={[
              { value: "rooms", label: "Rooms", icon: BedDouble },
              { value: "types", label: "Room Types" },
            ]}
          />
          {canCreate && (
            <button
              onClick={() => tab === "rooms" ? setShowAddRoom(true) : setShowAddType(true)}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-full bg-coral text-white text-sm font-semibold hover:bg-coral-dark transition-colors shadow-pop whitespace-nowrap"
            >
              <Plus size={17} />
              {tab === "rooms" ? "Add room" : "Add type"}
            </button>
          )}
        </div>
      </div>

      {tab === "rooms" && (
        <>
          {/* Status summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
            {statusLabels.map((s, i) => {
              const t = toneOf(s);
              const Icon = STATUS_ICONS[s] ?? BedDouble;
              const on = statusFilter === s;
              return (
                <Card
                  key={s}
                  className={cn("anim-fade-up !p-4 cursor-pointer", on && "ring-2 ring-coral")}
                  hover
                  style={{ animationDelay: i * 50 + "ms" }}
                  onClick={() => setStatusFilter(statusFilter === s ? "All" : s)}
                >
                  <div className="flex items-center justify-between">
                    <span className="grid place-items-center h-10 w-10 rounded-xl" style={{ background: t.bg, color: t.fg }}>
                      <Icon size={20} />
                    </span>
                    {on && <span className="text-[11px] font-bold text-coral">Filtered</span>}
                  </div>
                  <div className="mt-3 serif text-[32px] text-ink leading-none tnum">{counts[s] ?? 0}</div>
                  <div className="text-[13px] font-semibold text-ink-mute mt-1">{s}</div>
                </Card>
              );
            })}
          </div>

          {/* Status filter pills */}
          <div className="flex flex-wrap items-center gap-1.5 mb-4">
            {["All", ...statusLabels].map((s) => {
              const on = statusFilter === s;
              const t = s !== "All" ? toneOf(s) : null;
              return (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-3 h-9 text-[13px] font-semibold transition-all",
                    on ? "bg-ink text-white" : "bg-white border border-line text-ink-soft hover:border-coral/30 hover:text-ink",
                  )}
                >
                  {t && <span className="h-1.5 w-1.5 rounded-full" style={{ background: on ? "#fff" : t.dot }} />}
                  {s}
                </button>
              );
            })}
          </div>

          {/* Room cards grid */}
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-28 rounded-xl2 bg-line-soft animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-ink-mute text-[14px]">No rooms match the filter.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((room, i) => (
                <RoomCard
                  key={room.id}
                  room={room}
                  onEdit={() => setEditingRoom(room)}
                  canEdit={canUpdate}
                  delay={Math.min(i * 30, 300)}
                  hasOpenIssue={roomsWithOpenIssues.has(room.id)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {tab === "types" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {typesLoading ? (
            [...Array(4)].map((_, i) => <div key={i} className="h-36 rounded-xl2 bg-line-soft animate-pulse" />)
          ) : types.length === 0 ? (
            <div className="lg:col-span-2 flex flex-col items-center py-16 text-ink-mute text-[14px]">
              No room types yet.
            </div>
          ) : (
            types.map((rt, i) => <TypeCard key={rt.id} rt={rt} canEdit={canUpdate} delay={i * 50} />)
          )}
        </div>
      )}

      {showAddRoom && <AddRoomModal onClose={() => setShowAddRoom(false)} />}
      {editingRoom && <EditRoomModal room={editingRoom} onClose={() => setEditingRoom(null)} />}
      {showAddType && <AddRoomTypeModal onClose={() => setShowAddType(false)} />}
    </div>
  );
}
