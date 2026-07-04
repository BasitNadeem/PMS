import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import {
  Camera, X, Loader2, CheckCircle2, AlertCircle,
  RotateCcw, ScanLine, Smartphone, Upload,
} from "lucide-react";
import { cn } from "../../lib/cn";
import { inventoryService, type ScanMatch, type CreateTransactionDto } from "../../services/inventory";
import { BASE_URL } from "../../lib/api";

// ── Types ──────────────────────────────────────────────────────────────────────

type Mode = "choose" | "qr" | "upload";
type Step = Mode | "analyzing" | "review" | "confirming" | "done";

interface ConfirmedItem {
  match:   ScanMatch;
  qty:     number;
  txnType: "PURCHASE" | "ADJUSTMENT";
  include: boolean;
}

export interface ScanStockModalProps {
  onClose:    () => void;
  onComplete: () => void;
}

// ── Image compression ─────────────────────────────────────────────────────────

async function compressImage(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const maxPx  = 1280;
      const scale  = Math.min(1, maxPx / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width  = Math.round(img.width  * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          if (!blob) { reject(new Error("toBlob failed")); return; }
          const reader = new FileReader();
          reader.onload = () => resolve({ base64: (reader.result as string).split(",")[1], mimeType: "image/jpeg" });
          reader.readAsDataURL(blob);
        },
        "image/jpeg",
        0.82,
      );
    };
    img.onerror = reject;
    img.src = url;
  });
}

// ── Confidence badge ──────────────────────────────────────────────────────────

function ConfidencePill({ score }: { score: number }) {
  const high = score >= 0.8;
  const mid  = score >= 0.6;
  return (
    <span className={cn(
      "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
      high ? "bg-pine/10 text-pine" : mid ? "bg-amber/10 text-amber" : "bg-ink/5 text-ink-faint",
    )}>
      {high ? "Strong" : mid ? "Good" : "Weak"} match
    </span>
  );
}

// ── Review items list (shared by both modes) ──────────────────────────────────

function ReviewItems({
  items, setItems,
}: { items: ConfirmedItem[]; setItems: React.Dispatch<React.SetStateAction<ConfirmedItem[]>> }) {
  if (items.length === 0) return (
    <div className="flex flex-col items-center gap-3 py-10 text-center">
      <AlertCircle size={32} className="text-ink-faint" />
      <p className="text-[14px] font-semibold text-ink">No inventory items recognised</p>
      <p className="text-[13px] text-ink-faint max-w-xs">
        Try a clearer photo with labels facing the camera, or better lighting.
      </p>
    </div>
  );

  return (
    <div className="space-y-3">
      {items.map((ci, idx) => (
        <div
          key={ci.match.item.id}
          className={cn(
            "rounded-2xl border p-4 transition-colors",
            ci.include ? "border-coral/20 bg-white" : "border-line bg-mist opacity-60",
          )}
        >
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={ci.include}
              onChange={(e) => setItems((p) => p.map((it, i) => i === idx ? { ...it, include: e.target.checked } : it))}
              className="mt-0.5 h-4 w-4 accent-coral"
            />
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                <span className="text-[14px] font-bold text-ink">{ci.match.item.name}</span>
                <ConfidencePill score={ci.match.confidence} />
              </div>
              <p className="text-[12px] text-ink-faint mb-0.5">{ci.match.item.category}</p>
              <p className="text-[11px] text-ink-faint">
                Matched: <span className="font-medium text-ink-mute">"{ci.match.matchedText}"</span>
                {" · "}Current: <span className="font-medium text-ink">{ci.match.item.currentStock} {ci.match.item.unit}</span>
              </p>
            </div>
          </div>
          {ci.include && (
            <div className="mt-3 flex gap-2">
              <div className="flex-1">
                <label className="block text-[11px] font-semibold text-ink-faint mb-1 uppercase tracking-wide">Qty to add</label>
                <input
                  type="number" min="0.01" step="0.01" value={ci.qty}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    setItems((p) => p.map((it, i) => i === idx ? { ...it, qty: isNaN(v) ? 0 : v } : it));
                  }}
                  className="w-full h-9 rounded-xl border border-line bg-mist px-3 text-[13px] text-ink focus:outline-none focus:ring-2 focus:ring-coral/20 focus:border-coral/40 transition-colors"
                />
              </div>
              <div className="flex-1">
                <label className="block text-[11px] font-semibold text-ink-faint mb-1 uppercase tracking-wide">Type</label>
                <select
                  value={ci.txnType}
                  onChange={(e) => {
                    const v = e.target.value as "PURCHASE" | "ADJUSTMENT";
                    setItems((p) => p.map((it, i) => i === idx ? { ...it, txnType: v } : it));
                  }}
                  className="w-full h-9 rounded-xl border border-line bg-mist px-3 text-[13px] text-ink focus:outline-none focus:ring-2 focus:ring-coral/20 focus:border-coral/40 transition-colors"
                >
                  <option value="PURCHASE">Purchase</option>
                  <option value="ADJUSTMENT">Adjustment</option>
                </select>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function ScanStockModal({ onClose, onComplete }: ScanStockModalProps) {
  const inputRef    = useRef<HTMLInputElement>(null);
  const esRef       = useRef<EventSource | null>(null);
  const qrReadyRef  = useRef(false);
  const [step,      setStep]     = useState<Step>("choose");
  const [preview,   setPreview]  = useState<string | null>(null);
  const [error,     setError]    = useState<string | null>(null);
  const [items,     setItems]    = useState<ConfirmedItem[]>([]);
  const [doneCount, setDoneCount]= useState(0);
  const [qrDataUrl, setQrDataUrl]= useState<string | null>(null);
  const [dragging,  setDragging] = useState(false);
  const pendingRef  = useRef<{ base64: string; mimeType: string } | null>(null);

  // Cleanup SSE on unmount
  useEffect(() => () => { esRef.current?.close(); }, []);

  // ── QR mode ─────────────────────────────────────────────────────────────────

  async function startQrMode() {
    setStep("qr");
    setError(null);
    try {
      const { token } = await inventoryService.createScanSession();

      // Build the mobile URL using the current origin so it works on the same network
      const mobileUrl = `${window.location.origin}/scan/${token}`;
      const dataUrl   = await QRCode.toDataURL(mobileUrl, { margin: 1, width: 220, color: { dark: "#1a1a2e", light: "#ffffff" } });
      setQrDataUrl(dataUrl);
      qrReadyRef.current = true;

      // SSE — EventSource doesn't support headers, pass JWT via query param
      const jwt = localStorage.getItem("accessToken") ?? "";
      const es  = new EventSource(
        `${BASE_URL}/api/inventory/scan-sessions/${token}/events?auth=${encodeURIComponent(jwt)}`,
      );
      esRef.current = es;

      es.addEventListener("scan_result", (e) => {
        es.close();
        const result = JSON.parse(e.data) as { matches: ScanMatch[]; imageUrl: string; detectedTexts: string[] };
        openReview(result.matches);
      });

      es.addEventListener("scan_error", (e) => {
        es.close();
        const { error: msg } = JSON.parse(e.data) as { error: string };
        setError(msg);
      });

      es.onerror = () => {
        // Only surface errors after the QR is shown — not on the initial SSE connect
        if (qrReadyRef.current) setError("Connection lost. Please refresh the QR code.");
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to create session";
      setError(msg);
    }
  }

  // ── Upload mode ─────────────────────────────────────────────────────────────

  async function handleFile(file: File) {
    setError(null);
    setPreview(URL.createObjectURL(file));
    try {
      pendingRef.current = await compressImage(file);
    } catch {
      setError("Could not read the image. Please try again.");
      setPreview(null);
    }
  }

  async function handleAnalyze() {
    if (!pendingRef.current) return;
    setStep("analyzing");
    setError(null);
    try {
      const result = await inventoryService.scan(pendingRef.current.base64, pendingRef.current.mimeType);
      openReview(result.matches);
    } catch (err: unknown) {
      const apiMsg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(apiMsg ?? (err instanceof Error ? err.message : "Analysis failed"));
      setStep("upload");
    }
  }

  // ── Shared review / confirm ──────────────────────────────────────────────────

  function openReview(matches: ScanMatch[]) {
    const confirmed: ConfirmedItem[] = matches.map((m) => ({
      match: m, qty: m.suggestedQty ?? 1, txnType: "PURCHASE", include: true,
    }));
    setItems(confirmed);
    setStep("review");
  }

  async function handleConfirm() {
    const selected = items.filter((i) => i.include && i.qty > 0);
    if (!selected.length) return;
    setStep("confirming");
    let count = 0;
    for (const ci of selected) {
      try {
        const dto: CreateTransactionDto = {
          type: ci.txnType, quantity: ci.qty,
          notes: "Added via camera scan", referenceType: "CAMERA_SCAN",
        };
        await inventoryService.recordTransaction(ci.match.item.id, dto);
        count++;
      } catch { /* continue with remaining */ }
    }
    setDoneCount(count);
    setStep("done");
    onComplete();
  }

  function reset() {
    esRef.current?.close();
    esRef.current = null;
    qrReadyRef.current = false;
    setStep("choose");
    setPreview(null);
    setError(null);
    setItems([]);
    setQrDataUrl(null);
    pendingRef.current = null;
    if (inputRef.current) inputRef.current.value = "";
  }

  const selectedCount = items.filter((i) => i.include && i.qty > 0).length;

  // ── Subtitle text ─────────────────────────────────────────────────────────

  const subtitle = {
    choose:     "How do you want to scan?",
    qr:         "Scan the QR code with your phone",
    upload:     "Drop a photo or tap to choose",
    analyzing:  "Reading your image…",
    review:     `${items.length} item${items.length !== 1 ? "s" : ""} detected — review before confirming`,
    confirming: "Saving transactions…",
    done:       `${doneCount} transaction${doneCount !== 1 ? "s" : ""} recorded`,
  }[step];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full sm:max-w-lg bg-white sm:rounded-2xl shadow-2xl flex flex-col max-h-[92dvh] overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-line shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="grid place-items-center h-8 w-8 rounded-lg bg-coral/10">
              <ScanLine size={16} className="text-coral" />
            </span>
            <div>
              <h2 className="text-[15px] font-bold text-ink">Scan Stock</h2>
              <p className="text-[12px] text-ink-faint">{subtitle}</p>
            </div>
          </div>
          <button onClick={onClose} className="grid place-items-center h-8 w-8 rounded-lg hover:bg-mist text-ink-faint transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">

          {/* ── Choose mode ── */}
          {step === "choose" && (
            <div className="p-5 space-y-3">
              <button
                onClick={() => void startQrMode()}
                className="w-full flex items-start gap-4 p-5 rounded-2xl border-2 border-line hover:border-coral/40 hover:bg-coral/3 transition-all text-left group"
              >
                <span className="grid place-items-center h-12 w-12 rounded-xl bg-coral/10 shrink-0 group-hover:bg-coral/15 transition-colors">
                  <Smartphone size={22} className="text-coral" />
                </span>
                <div>
                  <p className="text-[14px] font-bold text-ink">Scan with phone</p>
                  <p className="mt-0.5 text-[13px] text-ink-faint">
                    A QR code appears here. Scan it on your phone — the camera opens instantly, no login needed.
                    Results come back to this screen in real time.
                  </p>
                </div>
              </button>

              <button
                onClick={() => setStep("upload")}
                className="w-full flex items-start gap-4 p-5 rounded-2xl border-2 border-line hover:border-coral/40 hover:bg-coral/3 transition-all text-left group"
              >
                <span className="grid place-items-center h-12 w-12 rounded-xl bg-ink/5 shrink-0 group-hover:bg-ink/8 transition-colors">
                  <Upload size={22} className="text-ink-soft" />
                </span>
                <div>
                  <p className="text-[14px] font-bold text-ink">Upload or drag a photo</p>
                  <p className="mt-0.5 text-[13px] text-ink-faint">
                    Drop an image onto this window, or click to choose a file from your computer.
                    Great for photos already saved to your device.
                  </p>
                </div>
              </button>
            </div>
          )}

          {/* ── QR mode ── */}
          {step === "qr" && (
            <div className="p-5 flex flex-col items-center gap-4">
              {qrDataUrl ? (
                <>
                  <div className="p-3 rounded-2xl border-2 border-line bg-white shadow-sm">
                    <img src={qrDataUrl} alt="QR code" className="w-52 h-52" />
                  </div>
                  <div className="text-center">
                    <p className="text-[13px] font-semibold text-ink">Scan with your phone camera</p>
                    <p className="mt-1 text-[12px] text-ink-faint max-w-xs">
                      No app needed — just the camera. The inventory screen here updates automatically when you take the photo.
                    </p>
                    <p className="mt-2 text-[11px] text-ink-faint bg-mist rounded-lg px-3 py-2">
                      Local dev: phone and computer must be on the same WiFi.<br />
                      Start Vite with <code className="font-mono text-coral">--host</code> if QR doesn't load on mobile.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <Loader2 size={14} className="text-coral animate-spin" />
                    <span className="text-[13px] text-ink-faint">Waiting for photo from your phone…</span>
                  </div>
                  {error && (
                    <div className="w-full flex items-start gap-2.5 rounded-xl border border-clay/20 bg-clay-soft px-4 py-3">
                      <AlertCircle size={15} className="text-clay shrink-0 mt-0.5" />
                      <p className="text-[13px] text-clay">{error}</p>
                    </div>
                  )}
                  <button onClick={reset} className="flex items-center gap-1.5 h-9 px-4 rounded-full border border-line text-[13px] font-semibold text-ink-soft hover:bg-mist transition-colors">
                    <RotateCcw size={13} /> Cancel
                  </button>
                </>
              ) : (
                <div className="flex flex-col items-center gap-3 py-10">
                  <Loader2 size={28} className="text-coral animate-spin" />
                  <p className="text-[13px] text-ink-faint">Generating QR code…</p>
                  {error && (
                    <div className="flex items-start gap-2.5 rounded-xl border border-clay/20 bg-clay-soft px-4 py-3 max-w-xs">
                      <AlertCircle size={15} className="text-clay shrink-0 mt-0.5" />
                      <p className="text-[13px] text-clay">{error}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Upload mode ── */}
          {(step === "upload" || step === "analyzing") && (
            <div className="p-5 space-y-4">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault(); setDragging(false);
                  const file = e.dataTransfer.files[0];
                  if (file) void handleFile(file);
                }}
                className={cn(
                  "w-full rounded-2xl border-2 border-dashed transition-all overflow-hidden",
                  dragging ? "border-coral bg-coral/5 scale-[0.99]" :
                  preview  ? "border-coral/30" : "border-line hover:border-coral/40",
                )}
                style={{ minHeight: 220 }}
              >
                {preview ? (
                  <img src={preview} alt="Preview" className="w-full object-cover" style={{ maxHeight: 320 }} />
                ) : (
                  <div className="flex flex-col items-center justify-center gap-3 py-14 px-6">
                    <span className="grid place-items-center h-14 w-14 rounded-2xl bg-ink/5">
                      <Upload size={24} className="text-ink-soft" />
                    </span>
                    <div className="text-center">
                      <p className="text-[14px] font-semibold text-ink">Drop a photo here</p>
                      <p className="mt-1 text-[12px] text-ink-faint">
                        or click to browse · JPG, PNG, WEBP<br />
                        On mobile, opens your camera directly.
                      </p>
                    </div>
                  </div>
                )}
              </button>

              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); }}
              />

              {error && (
                <div className="flex items-start gap-2.5 rounded-xl border border-clay/20 bg-clay-soft px-4 py-3">
                  <AlertCircle size={15} className="text-clay shrink-0 mt-0.5" />
                  <p className="text-[13px] text-clay">{error}</p>
                </div>
              )}

              {preview && (
                <div className="flex gap-2">
                  <button onClick={reset} className="flex items-center gap-1.5 h-10 px-4 rounded-full border border-line text-sm font-semibold text-ink-soft hover:bg-mist transition-colors">
                    <RotateCcw size={13} /> Clear
                  </button>
                  <button
                    onClick={() => void handleAnalyze()}
                    disabled={step === "analyzing"}
                    className="flex-1 flex items-center justify-center gap-2 h-10 rounded-full bg-coral text-white text-sm font-semibold hover:bg-coral-dark transition-colors shadow-pop disabled:opacity-60"
                  >
                    {step === "analyzing" ? (
                      <><Loader2 size={15} className="animate-spin" /> Analyzing…</>
                    ) : (
                      <><ScanLine size={15} /> Analyze Image</>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── Review ── */}
          {step === "review" && (
            <div className="p-5">
              <ReviewItems items={items} setItems={setItems} />
            </div>
          )}

          {/* ── Confirming / Done ── */}
          {(step === "confirming" || step === "done") && (
            <div className="flex flex-col items-center gap-4 py-14 px-6 text-center">
              {step === "confirming" ? (
                <>
                  <Loader2 size={36} className="text-coral animate-spin" />
                  <p className="text-[15px] font-semibold text-ink">Saving transactions…</p>
                </>
              ) : (
                <>
                  <span className="grid place-items-center h-16 w-16 rounded-full bg-pine/10">
                    <CheckCircle2 size={36} className="text-pine" />
                  </span>
                  <div>
                    <p className="text-[16px] font-bold text-ink">Done!</p>
                    <p className="mt-1 text-[13px] text-ink-faint">
                      {doneCount} transaction{doneCount !== 1 ? "s" : ""} recorded. Inventory updated.
                    </p>
                  </div>
                  <div className="flex gap-2 mt-2">
                    <button onClick={reset} className="flex items-center gap-1.5 h-10 px-4 rounded-full border border-line text-sm font-semibold text-ink-soft hover:bg-mist transition-colors">
                      <Camera size={13} /> Scan more
                    </button>
                    <button onClick={onClose} className="h-10 px-5 rounded-full bg-coral text-white text-sm font-semibold hover:bg-coral-dark transition-colors shadow-pop">
                      Done
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer — review step only */}
        {step === "review" && (
          <div className="border-t border-line px-5 py-4 shrink-0">
            {items.length === 0 ? (
              <button onClick={reset} className="w-full flex items-center justify-center gap-1.5 h-10 rounded-full border border-line text-sm font-semibold text-ink-soft hover:bg-mist transition-colors">
                <RotateCcw size={13} /> Try again
              </button>
            ) : (
              <div className="flex gap-2">
                <button onClick={reset} className="flex items-center gap-1.5 h-10 px-4 rounded-full border border-line text-sm font-semibold text-ink-soft hover:bg-mist transition-colors">
                  <RotateCcw size={13} /> New scan
                </button>
                <button
                  onClick={() => void handleConfirm()}
                  disabled={selectedCount === 0}
                  className="flex-1 h-10 rounded-full bg-coral text-white text-sm font-semibold hover:bg-coral-dark transition-colors shadow-pop disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Confirm {selectedCount} item{selectedCount !== 1 ? "s" : ""}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
