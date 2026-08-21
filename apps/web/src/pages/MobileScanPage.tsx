// Bare mobile page — opened by scanning the QR code on the inventory screen.
// No login required: the :token in the URL is the credential (short-lived, Redis-backed).
// Uses relative fetch("/api/m/scan/:token") which goes through Vite proxy in dev
// and through the same domain in production.

import { useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Camera, Loader2, CheckCircle2, AlertCircle, RotateCcw } from "lucide-react";
import { cn } from "../lib/cn";
import { compressImage } from "../lib/compressImage";

type Step = "capture" | "uploading" | "done" | "error";

export default function MobileScanPage() {
  const { token } = useParams<{ token: string }>();
  const inputRef  = useRef<HTMLInputElement>(null);
  const [step,    setStep]    = useState<Step>("capture");
  const [preview, setPreview] = useState<string | null>(null);
  const [error,   setError]   = useState<string | null>(null);
  const [count,   setCount]   = useState(0);

  // Pending compressed image
  const pendingRef = useRef<{ base64: string; mimeType: string } | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setPreview(URL.createObjectURL(file));
    try {
      pendingRef.current = await compressImage(file);
    } catch {
      setError("Could not read image. Please try again.");
      setPreview(null);
    }
  }

  async function handleSend() {
    if (!pendingRef.current || !token) return;
    setStep("uploading");
    try {
      const res = await fetch(`/api/m/scan/${token}`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(pendingRef.current),
      });
      const body = await res.json() as { data?: { matchCount?: number }; error?: string };
      if (!res.ok) {
        setError(body.error ?? "Something went wrong.");
        setStep("error");
        return;
      }
      setCount(body.data?.matchCount ?? 0);
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error. Are you on the same WiFi?");
      setStep("error");
    }
  }

  function reset() {
    setStep("capture");
    setPreview(null);
    setError(null);
    pendingRef.current = null;
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="min-h-dvh bg-white flex flex-col">
      {/* Header */}
      <div className="px-5 pt-8 pb-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-coral mb-1">Hotel PMS</p>
        <h1 className="text-[24px] font-bold text-ink leading-tight">Scan Inventory</h1>
        <p className="mt-1 text-[14px] text-ink-mute">
          {step === "capture"   && "Take a photo of your stock items."}
          {step === "uploading" && "Sending to desktop…"}
          {step === "done"      && "Photo received! Check the desktop screen."}
          {step === "error"     && "Something went wrong."}
        </p>
      </div>

      {/* Body */}
      <div className="flex-1 px-5 pb-8 flex flex-col gap-4">

        {/* ── Capture ── */}
        {(step === "capture" || step === "uploading") && (
          <>
            {/* Camera area */}
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={step === "uploading"}
              className={cn(
                "w-full rounded-3xl border-2 border-dashed transition-all overflow-hidden",
                preview ? "border-coral/30" : "border-gray-200 hover:border-coral/40",
              )}
              style={{ minHeight: 260 }}
            >
              {preview ? (
                <img src={preview} alt="Preview" className="w-full object-cover" style={{ maxHeight: 380 }} />
              ) : (
                <div className="flex flex-col items-center justify-center gap-3 py-16">
                  <span className="grid place-items-center h-16 w-16 rounded-2xl bg-coral/10">
                    <Camera size={30} className="text-coral" />
                  </span>
                  <p className="text-[15px] font-semibold text-ink">Tap to open camera</p>
                  <p className="text-[13px] text-gray-400 text-center max-w-xs px-4">
                    Point it at boxes, labels, or shelves. The desktop will get the results.
                  </p>
                </div>
              )}
            </button>

            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleFileChange}
            />

            {preview && (
              <div className="flex gap-3">
                <button
                  onClick={reset}
                  disabled={step === "uploading"}
                  className="flex items-center gap-2 h-12 px-5 rounded-2xl border border-gray-200 text-[14px] font-semibold text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  <RotateCcw size={15} /> Retake
                </button>
                <button
                  onClick={handleSend}
                  disabled={step === "uploading" || !pendingRef.current}
                  className="flex-1 flex items-center justify-center gap-2 h-12 rounded-2xl bg-coral text-white text-[14px] font-semibold hover:bg-coral-dark transition-colors disabled:opacity-60 shadow-lg"
                >
                  {step === "uploading" ? (
                    <><Loader2 size={16} className="animate-spin" /> Sending…</>
                  ) : (
                    "Send to Desktop →"
                  )}
                </button>
              </div>
            )}
          </>
        )}

        {/* ── Done ── */}
        {step === "done" && (
          <div className="flex flex-col items-center gap-4 pt-6 text-center">
            <span className="grid place-items-center h-20 w-20 rounded-full bg-green-50">
              <CheckCircle2 size={40} className="text-green-500" />
            </span>
            <div>
              <p className="text-[18px] font-bold text-ink">
                {count > 0 ? `${count} item${count !== 1 ? "s" : ""} detected` : "Photo sent!"}
              </p>
              <p className="mt-2 text-[14px] text-gray-500">
                Check the inventory screen on your desktop to review and confirm the items.
              </p>
            </div>
            <button
              onClick={reset}
              className="mt-2 flex items-center gap-2 h-12 px-6 rounded-2xl border border-gray-200 text-[14px] font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <Camera size={15} /> Scan another
            </button>
          </div>
        )}

        {/* ── Error ── */}
        {step === "error" && (
          <div className="flex flex-col items-center gap-4 pt-6 text-center">
            <span className="grid place-items-center h-20 w-20 rounded-full bg-red-50">
              <AlertCircle size={40} className="text-red-400" />
            </span>
            <div>
              <p className="text-[17px] font-bold text-ink">Something went wrong</p>
              <p className="mt-2 text-[14px] text-gray-500 max-w-xs">{error}</p>
            </div>
            <button
              onClick={reset}
              className="mt-2 flex items-center gap-2 h-12 px-6 rounded-2xl bg-coral text-white text-[14px] font-semibold hover:bg-coral-dark transition-colors"
            >
              <RotateCcw size={15} /> Try again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
