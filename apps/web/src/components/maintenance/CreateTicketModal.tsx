import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Wrench, Camera, Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { BASE_URL } from "@/lib/api";
import { maintenanceService, type MaintenanceCategory, type MaintenancePriority } from "@/services/maintenance";
import { uploadService } from "@/services/upload";
import { roomsService } from "@/services/rooms";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { DatePicker } from "@/components/ui/DatePicker";

const CATEGORY_OPTIONS: { value: MaintenanceCategory; label: string }[] = [
  { value: "ELECTRICAL",   label: "Electrical" },
  { value: "PLUMBING",     label: "Plumbing" },
  { value: "HVAC",         label: "HVAC" },
  { value: "FURNITURE",    label: "Furniture" },
  { value: "ELECTRONICS",  label: "Electronics" },
  { value: "STRUCTURAL",   label: "Structural" },
  { value: "OTHER",        label: "Other" },
];

const PRIORITY_OPTIONS: { value: MaintenancePriority; label: string }[] = [
  { value: "URGENT", label: "Urgent" },
  { value: "HIGH",   label: "High" },
  { value: "MEDIUM", label: "Medium" },
  { value: "LOW",    label: "Low" },
];

const inputCls = "w-full rounded-xl border border-line bg-mist px-3.5 py-2.5 text-[14px] text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-coral/20 focus:border-coral/40 transition-colors";
const labelCls = "block text-[12.5px] font-semibold uppercase tracking-wide text-ink-mute mb-1.5";

export interface CreateTicketModalProps {
  onClose: () => void;
  initialRoomId?: string;
  initialRoomNumber?: string;
}

export function CreateTicketModal({ onClose, initialRoomId, initialRoomNumber }: CreateTicketModalProps) {
  useEscapeKey(onClose);
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [roomId,           setRoomId]           = useState(initialRoomId ?? "");
  const [title,            setTitle]            = useState("");
  const [description,      setDescription]      = useState("");
  const [category,         setCategory]         = useState<MaintenanceCategory>("OTHER");
  const [priority,         setPriority]         = useState<MaintenancePriority>("MEDIUM");
  const [scheduledEndDate, setScheduledEndDate] = useState("");
  const [photoUrls,        setPhotoUrls]        = useState<string[]>([]);
  const [uploadingCount,   setUploadingCount]   = useState(0);
  const [error,            setError]            = useState<string | null>(null);

  const { data: roomsData } = useQuery({
    queryKey: ["rooms"],
    queryFn:  () => roomsService.getRooms(),
    enabled:  !initialRoomId,
  });

  const createMutation = useMutation({
    mutationFn: maintenanceService.createTicket,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["maintenance"] });
      qc.invalidateQueries({ queryKey: ["maintenance-summary"] });
      onClose();
    },
    onError: (err: { response?: { data?: { error?: string } } }) => {
      setError(err.response?.data?.error ?? "Failed to create ticket");
    },
  });

  async function handleFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    e.target.value = "";

    setUploadingCount((n) => n + files.length);
    const results = await Promise.allSettled(files.map((f) => uploadService.uploadPhoto(f)));
    setUploadingCount((n) => n - files.length);

    const uploaded: string[] = [];
    const failed: string[] = [];
    for (const r of results) {
      if (r.status === "fulfilled") uploaded.push(r.value);
      else failed.push((r.reason as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Upload failed");
    }
    if (uploaded.length) setPhotoUrls((prev) => [...prev, ...uploaded]);
    if (failed.length)   setError(failed[0]);
  }

  function removePhoto(url: string) {
    setPhotoUrls((prev) => prev.filter((u) => u !== url));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setError("Title is required"); return; }
    setError(null);
    createMutation.mutate({
      title: title.trim(),
      category,
      priority,
      ...(roomId              && { roomId }),
      ...(description.trim()  && { description: description.trim() }),
      ...(scheduledEndDate    && { scheduledEndDate }),
      ...(photoUrls.length    && { photoUrls }),
    });
  }

  const isSubmitting = createMutation.isPending;
  const isUploading  = uploadingCount > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm p-4 anim-fade-in">
      <div className="bg-paper rounded-2xl shadow-xl w-full max-w-md anim-scale-in max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 pt-6 pb-5 border-b border-line shrink-0">
          <div className="grid place-items-center h-10 w-10 rounded-xl bg-clay-soft shrink-0">
            <Wrench size={18} className="text-clay" />
          </div>
          <div className="flex-1"><h2 className="serif text-[20px] text-ink leading-tight">Report Issue</h2></div>
          <button onClick={onClose} className="grid place-items-center h-9 w-9 rounded-full hover:bg-mist text-ink-mute transition-colors -mr-1 -mt-1">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4 overflow-y-auto">
          {error && (
            <div className="bg-clay-soft border border-clay/20 text-clay text-[13px] rounded-xl px-4 py-3">{error}</div>
          )}

          <div>
            <label className={labelCls}>Title <span className="text-coral text-[15px] font-bold leading-none normal-case tracking-normal">*</span></label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. AC not cooling" className={inputCls} />
          </div>

          <div>
            <label className={labelCls}>Room <span className="normal-case tracking-normal text-ink-faint font-normal">(optional)</span></label>
            {initialRoomId ? (
              <div className={cn(inputCls, "bg-mist/50 text-ink-mute")}>Room {initialRoomNumber}</div>
            ) : (
              <select value={roomId} onChange={(e) => setRoomId(e.target.value)} className={cn(inputCls, "cursor-pointer")}>
                <option value="">No specific room</option>
                {roomsData?.data.map((room) => (
                  <option key={room.id} value={room.id}>Room {room.number} — {room.roomType.typeName}</option>
                ))}
              </select>
            )}
          </div>

          {(roomId || initialRoomId) && (
            <div>
              <label className={labelCls}>
                Room available from <span className="normal-case tracking-normal text-ink-faint font-normal">(optional)</span>
              </label>
              <DatePicker
                value={scheduledEndDate}
                onChange={setScheduledEndDate}
                className="w-full"
              />
              {scheduledEndDate && (
                <p className="mt-1.5 text-[12px] text-amber-600">
                  Room will be blocked for new reservations until {scheduledEndDate}. Choose carefully.
                </p>
              )}
            </div>
          )}

          <div>
            <label className={labelCls}>Category <span className="text-coral text-[15px] font-bold leading-none normal-case tracking-normal">*</span></label>
            <select value={category} onChange={(e) => setCategory(e.target.value as MaintenanceCategory)} className={cn(inputCls, "cursor-pointer")}>
              {CATEGORY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          <div>
            <label className={labelCls}>Priority</label>
            <select value={priority} onChange={(e) => setPriority(e.target.value as MaintenancePriority)} className={cn(inputCls, "cursor-pointer")}>
              {PRIORITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          <div>
            <label className={labelCls}>Description <span className="normal-case tracking-normal text-ink-faint font-normal">(optional)</span></label>
            <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the issue…" className={cn(inputCls, "resize-none")} />
          </div>

          {/* Photo upload */}
          <div>
            <label className={labelCls}>Photos <span className="normal-case tracking-normal text-ink-faint font-normal">(optional)</span></label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              className="hidden"
              onChange={handleFilesSelected}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className={cn(
                "flex items-center gap-2 h-9 px-3.5 rounded-xl border border-dashed border-line text-[13px] font-medium text-ink-mute transition-colors",
                isUploading ? "opacity-60 cursor-not-allowed" : "hover:border-coral/40 hover:text-ink hover:bg-mist/60",
              )}
            >
              {isUploading ? (
                <><Loader2 size={15} className="animate-spin" /> Uploading {uploadingCount} photo{uploadingCount !== 1 ? "s" : ""}…</>
              ) : (
                <><Camera size={15} /> Add Photos</>
              )}
            </button>

            {photoUrls.length > 0 && (
              <div className="mt-2.5 flex flex-wrap gap-2">
                {photoUrls.map((url) => (
                  <div key={url} className="relative h-16 w-16 rounded-lg overflow-hidden border border-line-soft group">
                    <img src={`${BASE_URL}${url}`} alt="" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removePhoto(url)}
                      className="absolute inset-0 flex items-center justify-center bg-ink/50 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X size={16} className="text-white" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2.5 pt-1">
            <button type="button" onClick={onClose} className="h-10 px-5 rounded-full border border-line text-ink-soft text-[13.5px] font-semibold hover:bg-mist transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting || isUploading} className="h-10 px-5 rounded-full bg-coral text-white text-[13.5px] font-semibold hover:bg-coral-dark shadow-pop transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              {isSubmitting ? "Submitting…" : "Submit Ticket"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
