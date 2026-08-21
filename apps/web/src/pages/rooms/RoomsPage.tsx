import { useEffect, useMemo, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, BedDouble, DoorOpen, Wrench, OctagonX, Sparkles, ImagePlus, Loader2, X, Tag, CalendarOff, LayoutGrid, List, Layers3, Search, ChevronDown, ChevronRight, CheckSquare, Square } from "lucide-react";
import { uploadService } from "@/services/upload";
import { cn } from "@/lib/cn";
import { roomsService, type Room, type RoomType, type RoomStatus } from "@/services/rooms";
import { maintenanceService } from "@/services/maintenance";
import { AddRoomModal } from "@/components/rooms/AddRoomModal";
import { EditRoomModal } from "@/components/rooms/EditRoomModal";
import { RoomInventoryModal } from "@/components/rooms/RoomInventoryModal";
import { AddRoomTypeModal } from "@/components/rooms/AddRoomTypeModal";
import { Card } from "@/components/ui/Card";
import { StatusBadge, toneOf } from "@/components/ui/StatusBadge";
import { Segmented } from "@/components/ui/Segmented";
import { usePermissions } from "@/hooks/usePermissions";
import { ReservationIdLink } from "@/components/reservations/ReservationIdLink";
import { decodeToken } from "@/lib/jwt";

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

function RoomCard({ room, onEdit, onManageInventory, canEdit, canReadGuests, delay, hasOpenIssue }: { room: Room; onEdit: () => void; onManageInventory: () => void; canEdit: boolean; canReadGuests: boolean; delay: number; hasOpenIssue: boolean }) {
  const statusLabel = STATUS_LABEL[room.status] ?? "Available";
  const t = toneOf(statusLabel);
  return (
    <Card
      className="anim-fade-up group !p-0 overflow-hidden h-full"
      hover
      style={{ animationDelay: delay + "ms" }}
    >
      <div className="flex items-stretch h-full min-h-[160px]">
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
            {canEdit && <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100"><button onClick={onManageInventory} title="Manage sellable inventory" className="grid h-8 w-8 place-items-center rounded-lg text-ink-mute hover:bg-line-soft hover:text-coral"><CalendarOff size={15} /></button><button onClick={onEdit} title="Edit room" className="grid h-8 w-8 place-items-center rounded-lg text-ink-mute hover:bg-line-soft"><Pencil size={15} /></button></div>}
          </div>
          <div className="mt-3 flex items-center justify-between">
            <StatusBadge status={statusLabel} size="sm" />
            <div className="serif text-[18px] text-ink tnum">
              {formatPkr(room.roomType.defaultRate)}
              <span className="text-[11px] text-ink-mute font-sans">/night</span>
            </div>
          </div>
          {room.status === "OCCUPIED" && room.currentReservation && (
            <div className="mt-3 flex items-center justify-between gap-3 border-t border-line-soft pt-3">
              {canReadGuests ? (
                <Link to={`/guests/${room.currentReservation.guest.id}`} className="min-w-0 truncate text-[12.5px] font-semibold text-ink hover:text-coral transition-colors">
                  {room.currentReservation.guest.fullName}
                </Link>
              ) : (
                <span className="min-w-0 truncate text-[12.5px] font-semibold text-ink">{room.currentReservation.guest.fullName}</span>
              )}
              <ReservationIdLink
                id={room.currentReservation.id}
                confirmationNumber={room.currentReservation.confirmationNumber}
                className="shrink-0"
              />
            </div>
          )}
          {room.inventoryBlocks?.[0] && (
            <button onClick={onManageInventory} className="mt-3 flex w-full items-center gap-2 border-t border-line-soft pt-3 text-left text-[11.5px] font-semibold text-amber hover:text-coral">
              <CalendarOff size={13} />
              {room.inventoryBlocks[0].type === "OUT_OF_ORDER" ? "Out of order" : "Out of service"} · {new Date(room.inventoryBlocks[0].startDate).toLocaleDateString("en-PK", { day: "numeric", month: "short", timeZone: "UTC" })}
            </button>
          )}
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
type RoomView = "cards" | "compact" | "floor";
const ROOM_VIEW_KEY = "innflo:rooms:view";

function RoomContext({ room, canReadGuests }: { room: Room; canReadGuests: boolean }) {
  if (room.status !== "OCCUPIED" || !room.currentReservation) return <span className="text-ink-faint">—</span>;
  return <div className="min-w-0"><div className="flex min-w-0 items-center gap-2">{canReadGuests ? <Link to={`/guests/${room.currentReservation.guest.id}`} className="truncate font-semibold text-ink hover:text-coral">{room.currentReservation.guest.fullName}</Link> : <span className="truncate font-semibold text-ink">{room.currentReservation.guest.fullName}</span>}<ReservationIdLink id={room.currentReservation.id} confirmationNumber={room.currentReservation.confirmationNumber} className="shrink-0" /></div><p className="mt-0.5 text-[10.5px] text-ink-mute">Due out {new Date(room.currentReservation.checkOutDate).toLocaleDateString("en-PK", { day: "numeric", month: "short", timeZone: "UTC" })}</p></div>;
}

function CompactRooms({ rooms, selected, setSelected, canUpdate, canReadGuests, roomsWithOpenIssues, onEdit, onInventory }: { rooms: Room[]; selected: Set<string>; setSelected: (next: Set<string>) => void; canUpdate: boolean; canReadGuests: boolean; roomsWithOpenIssues: Set<string>; onEdit: (room: Room) => void; onInventory: (room: Room) => void }) {
  const eligible = rooms.filter((room) => (room.status === "VACANT_CLEAN" || room.status === "VACANT_DIRTY") && !room.inventoryBlocks?.[0]);
  const allSelected = eligible.length > 0 && eligible.every((room) => selected.has(room.id));
  return <div className="overflow-x-auto rounded-2xl border border-line bg-card shadow-card"><div className="grid min-w-[850px] grid-cols-[42px_100px_1.2fr_100px_150px_1.5fr_100px] items-center border-b border-line bg-mist/45 px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-ink-faint"><button disabled={!canUpdate || eligible.length === 0} onClick={() => setSelected(allSelected ? new Set([...selected].filter((id) => !eligible.some((room) => room.id === id))) : new Set([...selected, ...eligible.map((room) => room.id)]))}>{allSelected ? <CheckSquare size={16} /> : <Square size={16} />}</button><span>Room</span><span>Type</span><span>Floor</span><span>Status</span><span>Current stay</span><span className="text-right">Actions</span></div><div className="min-w-[850px] divide-y divide-line-soft">{rooms.map((room) => { const eligibleRoom = (room.status === "VACANT_CLEAN" || room.status === "VACANT_DIRTY") && !room.inventoryBlocks?.[0]; return <div key={room.id} className="grid grid-cols-[42px_100px_1.2fr_100px_150px_1.5fr_100px] items-center px-4 py-3 text-[12.5px] hover:bg-mist/30"><button disabled={!canUpdate || !eligibleRoom} className="text-ink-mute disabled:opacity-20" onClick={() => { const next = new Set(selected); next.has(room.id) ? next.delete(room.id) : next.add(room.id); setSelected(next); }}>{selected.has(room.id) ? <CheckSquare size={16} className="text-coral" /> : <Square size={16} />}</button><strong className="serif text-[18px] text-ink">{room.number}</strong><span className="truncate font-semibold text-ink-soft">{room.roomType.name}</span><span className="text-ink-mute">{room.floor ?? "—"}</span><StatusBadge status={STATUS_LABEL[room.status]} size="sm" /><RoomContext room={room} canReadGuests={canReadGuests} /><div className="flex justify-end gap-1">{(roomsWithOpenIssues.has(room.id) || room.inventoryBlocks?.[0]) && <Wrench size={14} className="mr-1 text-clay" />}{canUpdate && <><button onClick={() => onInventory(room)} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-line-soft" title="Manage inventory"><CalendarOff size={14} /></button><button onClick={() => onEdit(room)} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-line-soft" title="Edit room"><Pencil size={14} /></button></>}</div></div>; })}</div></div>;
}

export default function RoomsPage() {
  const { has } = usePermissions();
  const canCreate = has("rooms:create");
  const canUpdate = has("rooms:update");
  const canReadGuests = has("guests:read");
  const [tab, setTab]           = useState<Tab>("rooms");
  const [showAddRoom, setShowAddRoom] = useState(false);
  const [showAddType, setShowAddType] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [inventoryRoom, setInventoryRoom] = useState<Room | null>(null);
  const [statusFilter, setStatusFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [floorFilter, setFloorFilter] = useState("All");
  const [typeFilter, setTypeFilter] = useState("All");
  const [attentionFilter, setAttentionFilter] = useState("All");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [collapsedFloors, setCollapsedFloors] = useState<Set<string>>(new Set());
  const [bulkMessage, setBulkMessage] = useState<string | null>(null);
  const preferenceKey = `${ROOM_VIEW_KEY}:${decodeToken()?.hotelId ?? "hotel"}:${decodeToken()?.userId ?? "user"}`;
  const [view, setView] = useState<RoomView>(() => {
    const stored = localStorage.getItem(preferenceKey);
    return stored === "cards" || stored === "compact" || stored === "floor" ? stored : "cards";
  });
  const queryClient = useQueryClient();

  useEffect(() => { localStorage.setItem(preferenceKey, view); }, [preferenceKey, view]);

  const { data: roomsResp, isLoading } = useQuery({
    queryKey: ["rooms"],
    queryFn: roomsService.getAllRooms,
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

  const roomsWithOpenIssues = useMemo(() => new Set(
    (ticketsResp?.data ?? [])
      .filter((t) =>
        t.roomId &&
        (t.priority === "URGENT" || t.priority === "HIGH") &&
        (t.status === "OPEN" || t.status === "IN_PROGRESS" || t.status === "AWAITING_PARTS"),
      )
      .map((t) => t.roomId as string),
  ), [ticketsResp?.data]);

  const statusLabels = ["Available", "Occupied", "Needs Cleaning", "Maintenance", "Out of Order"];
  const counts = statusLabels.reduce((m, s) => {
    m[s] = rooms.filter((r) => (STATUS_LABEL[r.status] ?? "Available") === s).length;
    return m;
  }, {} as Record<string, number>);

  const floors = useMemo(() => [...new Set(rooms.map((room) => room.floor == null ? "Unassigned" : String(room.floor)))].sort((a, b) => a === "Unassigned" ? 1 : b === "Unassigned" ? -1 : Number(a) - Number(b)), [rooms]);
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rooms.filter((room) => {
      const reservation = room.currentReservation;
      const matchesSearch = !term || [room.number, room.roomType.name, reservation?.guest.fullName, reservation?.confirmationNumber].some((value) => value?.toLowerCase().includes(term));
      const matchesStatus = statusFilter === "All" || STATUS_LABEL[room.status] === statusFilter;
      const floor = room.floor == null ? "Unassigned" : String(room.floor);
      const matchesFloor = floorFilter === "All" || floor === floorFilter;
      const matchesType = typeFilter === "All" || room.roomTypeId === typeFilter;
      const matchesAttention = attentionFilter === "All" || (attentionFilter === "maintenance" && roomsWithOpenIssues.has(room.id)) || (attentionFilter === "inventory" && Boolean(room.inventoryBlocks?.[0]));
      return matchesSearch && matchesStatus && matchesFloor && matchesType && matchesAttention;
    });
  }, [attentionFilter, floorFilter, rooms, roomsWithOpenIssues, search, statusFilter, typeFilter]);

  const floorGroups = useMemo(() => floors.map((floor) => ({ floor, rooms: filtered.filter((room) => (room.floor == null ? "Unassigned" : String(room.floor)) === floor) })).filter((group) => group.rooms.length > 0), [filtered, floors]);
  const hasFilters = search || statusFilter !== "All" || floorFilter !== "All" || typeFilter !== "All" || attentionFilter !== "All";
  const clearFilters = () => { setSearch(""); setStatusFilter("All"); setFloorFilter("All"); setTypeFilter("All"); setAttentionFilter("All"); };

  const bulkMutation = useMutation({
    mutationFn: (status: "VACANT_CLEAN" | "VACANT_DIRTY") => roomsService.bulkUpdateReadiness([...selected], status),
    onSuccess: (result) => {
      setBulkMessage(`${result.updated} room${result.updated === 1 ? "" : "s"} marked ${result.status === "VACANT_CLEAN" ? "clean" : "dirty"}.`);
      setSelected(new Set());
      void queryClient.invalidateQueries({ queryKey: ["rooms"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["housekeeping"] });
    },
    onError: (error) => setBulkMessage(error instanceof Error ? error.message : "Room readiness could not be updated."),
  });

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

          <Card className="!p-3 mb-4">
            <div className="flex flex-wrap items-center gap-2">
              <label className="relative min-w-[220px] flex-1">
                <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search room, guest or Res ID" className="h-10 w-full rounded-xl border border-line bg-mist pl-9 pr-3 text-[13px] text-ink outline-none focus:border-coral" />
              </label>
              <select value={floorFilter} onChange={(event) => setFloorFilter(event.target.value)} className="h-10 rounded-xl border border-line bg-card px-3 text-[13px] font-semibold text-ink-soft outline-none focus:border-coral"><option value="All">All floors</option>{floors.map((floor) => <option key={floor} value={floor}>{floor === "Unassigned" ? floor : `Floor ${floor}`}</option>)}</select>
              <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className="h-10 rounded-xl border border-line bg-card px-3 text-[13px] font-semibold text-ink-soft outline-none focus:border-coral"><option value="All">All room types</option>{types.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}</select>
              <select value={attentionFilter} onChange={(event) => setAttentionFilter(event.target.value)} className="h-10 rounded-xl border border-line bg-card px-3 text-[13px] font-semibold text-ink-soft outline-none focus:border-coral"><option value="All">All attention</option><option value="maintenance">Open maintenance</option><option value="inventory">Inventory blocked</option></select>
              {hasFilters && <button onClick={clearFilters} className="h-10 px-3 text-[12px] font-semibold text-coral hover:underline">Clear</button>}
              <div className="ml-auto inline-flex items-center gap-1 rounded-full border border-line bg-mist p-1" aria-label="Room view">
                {([{ value: "cards", label: "Card view", icon: LayoutGrid }, { value: "compact", label: "Compact view", icon: List }, { value: "floor", label: "Group by floor", icon: Layers3 }] as const).map((option) => {
                  const Icon = option.icon;
                  const active = view === option.value;
                  return <button key={option.value} type="button" title={option.label} aria-label={option.label} aria-pressed={active} onClick={() => setView(option.value)} className={cn("grid h-9 w-9 place-items-center rounded-full transition-all", active ? "bg-card text-ink shadow-pop ring-1 ring-ink/30" : "text-ink-mute hover:bg-card/70 hover:text-ink")}><Icon size={17} /></button>;
                })}
              </div>
            </div>
            {hasFilters && <div className="mt-2 px-1 text-[11.5px] text-ink-mute">Showing {filtered.length} of {rooms.length} rooms</div>}
          </Card>

          {selected.size > 0 && (
            <div className="sticky top-3 z-20 mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ink/10 bg-ink px-4 py-3 text-white shadow-pop">
              <div><strong>{selected.size} room{selected.size === 1 ? "" : "s"} selected</strong><span className="ml-2 text-[12px] text-white/60">Occupied and inventory-blocked states cannot be changed here.</span></div>
              <div className="flex gap-2"><button disabled={bulkMutation.isPending} onClick={() => bulkMutation.mutate("VACANT_CLEAN")} className="h-9 rounded-full bg-mint px-4 text-[12px] font-bold text-ink disabled:opacity-50">Mark clean</button><button disabled={bulkMutation.isPending} onClick={() => bulkMutation.mutate("VACANT_DIRTY")} className="h-9 rounded-full bg-amber px-4 text-[12px] font-bold text-white disabled:opacity-50">Mark dirty</button><button onClick={() => setSelected(new Set())} className="h-9 px-3 text-[12px] font-semibold text-white/70">Clear</button></div>
            </div>
          )}
          {bulkMessage && <div className="mb-4 flex items-center justify-between rounded-xl border border-line bg-card px-4 py-3 text-[13px] text-ink-soft"><span>{bulkMessage}</span><button onClick={() => setBulkMessage(null)}><X size={15} /></button></div>}

          {/* Room cards grid */}
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-28 rounded-xl2 bg-line-soft animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-ink-mute text-[14px]">No rooms match the filter.</div>
          ) : view === "cards" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((room, i) => (
                <RoomCard
                  key={room.id}
                  room={room}
                  onEdit={() => setEditingRoom(room)}
                  onManageInventory={() => setInventoryRoom(room)}
                  canEdit={canUpdate}
                  canReadGuests={canReadGuests}
                  delay={Math.min(i * 30, 300)}
                  hasOpenIssue={roomsWithOpenIssues.has(room.id)}
                />
              ))}
            </div>
          ) : view === "compact" ? (
            <CompactRooms rooms={filtered} selected={selected} setSelected={setSelected} canUpdate={canUpdate} canReadGuests={canReadGuests} roomsWithOpenIssues={roomsWithOpenIssues} onEdit={setEditingRoom} onInventory={setInventoryRoom} />
          ) : (
            <div className="space-y-4">
              {floorGroups.map((group) => {
                const collapsed = collapsedFloors.has(group.floor);
                const occupied = group.rooms.filter((room) => room.status === "OCCUPIED").length;
                const ready = group.rooms.filter((room) => room.status === "VACANT_CLEAN").length;
                return <section key={group.floor} className="rounded-2xl border border-line bg-card shadow-card"><button onClick={() => { const next = new Set(collapsedFloors); collapsed ? next.delete(group.floor) : next.add(group.floor); setCollapsedFloors(next); }} className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"><div className="flex items-center gap-3">{collapsed ? <ChevronRight size={17} /> : <ChevronDown size={17} />}<div><h2 className="serif text-[22px] text-ink">{group.floor === "Unassigned" ? group.floor : `Floor ${group.floor}`}</h2><p className="text-[11px] text-ink-mute">{group.rooms.length} rooms · {occupied} occupied · {ready} ready</p></div></div><div className="flex gap-2 text-[11px] font-semibold"><span className="rounded-full bg-mint-soft px-2.5 py-1 text-mint">{ready} ready</span><span className="rounded-full bg-blue-soft px-2.5 py-1 text-blue">{occupied} occupied</span></div></button>{!collapsed && <div className="border-t border-line-soft p-3"><CompactRooms rooms={group.rooms} selected={selected} setSelected={setSelected} canUpdate={canUpdate} canReadGuests={canReadGuests} roomsWithOpenIssues={roomsWithOpenIssues} onEdit={setEditingRoom} onInventory={setInventoryRoom} /></div>}</section>;
              })}
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
      {inventoryRoom && <RoomInventoryModal room={inventoryRoom} onClose={() => setInventoryRoom(null)} />}
      {showAddType && <AddRoomTypeModal onClose={() => setShowAddType(false)} />}
    </div>
  );
}
