// Bare mobile page — opened by scanning the QR code on a reservation.
// No login required: the :token in the URL is the credential (short-lived,
// Redis-backed, single-use, and bound to one reservation server-side).
//
// The upload goes to BASE_URL, NOT a relative /api path. The phone loads this
// page from app.innflo.co, which does not proxy /api — nginx answers a POST
// there with 405 text/html, which surfaces as "upload failed" after the guest
// has already photographed both sides. BASE_URL is "" in dev, where Vite's
// proxy does forward /api, so the same code works in both.
//
// Front and back are captured separately and uploaded together, because a
// half-captured ID is not evidence of anything and would otherwise leave a
// FRONT row with no matching BACK.

import { useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Camera, Loader2, CheckCircle2, AlertCircle, RotateCcw, ArrowRight } from "lucide-react";
import { cn } from "../lib/cn";
import { BASE_URL } from "../lib/api";
import { compressImage } from "../lib/compressImage";

type Shot = { base64: string; mimeType: string; preview: string };
type Step = "front" | "back" | "uploading" | "done" | "error";

const COPY: Record<"front" | "back", { title: string; hint: string }> = {
  front: { title: "Front of the ID",  hint: "Photo side up. Fill the frame and keep it flat." },
  back:  { title: "Back of the ID",   hint: "Turn the card over. Same again." },
};

export default function MobileIdCapturePage() {
  const { token } = useParams<{ token: string }>();
  const inputRef  = useRef<HTMLInputElement>(null);

  const [step,  setStep]  = useState<Step>("front");
  const [front, setFront] = useState<Shot | null>(null);
  const [back,  setBack]  = useState<Shot | null>(null);
  const [error, setError] = useState("");

  // Which side the file picker is currently collecting. Held separately from
  // `step` because `step` also carries upload/terminal states.
  const side: "front" | "back" = step === "back" ? "back" : "front";
  const current = side === "front" ? front : back;

  async function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const { base64, mimeType } = await compressImage(file);
      const shot: Shot = { base64, mimeType, preview: `data:${mimeType};base64,${base64}` };
      if (side === "front") setFront(shot); else setBack(shot);
    } catch {
      setError("That photo could not be read. Try again.");
      setStep("error");
    } finally {
      // Same file twice in a row fires no change event unless the input is reset.
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function upload(frontShot: Shot, backShot: Shot) {
    setStep("uploading");
    try {
      const response = await fetch(`${BASE_URL}/api/m/id/${token}`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          front: { imageBase64: frontShot.base64, mimeType: frontShot.mimeType },
          back:  { imageBase64: backShot.base64,  mimeType: backShot.mimeType  },
        }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Upload failed");
      }
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setStep("error");
    }
  }

  function restart() {
    setFront(null); setBack(null); setError(""); setStep("front");
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="min-h-screen bg-slate-950 px-5 py-8 text-white">
      <div className="mx-auto w-full max-w-sm">
        <p className="text-[11px] font-bold uppercase tracking-[.16em] text-slate-500">Guest ID</p>

        {(step === "front" || step === "back") && (
          <>
            <h1 className="mt-2 text-2xl font-bold">{COPY[side].title}</h1>
            <p className="mt-1 text-sm leading-relaxed text-slate-400">{COPY[side].hint}</p>

            <div className="mt-2 flex gap-1.5">
              {(["front", "back"] as const).map((s) => (
                <span
                  key={s}
                  className={cn(
                    "h-1 flex-1 rounded-full transition-colors",
                    (s === "front" ? front : back) ? "bg-emerald-400" : s === side ? "bg-white/60" : "bg-white/15",
                  )}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="mt-6 flex aspect-[1.586/1] w-full flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border-2 border-dashed border-slate-700 bg-slate-900 active:border-slate-500"
            >
              {current ? (
                <img src={current.preview} alt="" className="h-full w-full object-cover" />
              ) : (
                <>
                  <Camera className="h-9 w-9 text-slate-500" />
                  <span className="text-sm font-semibold text-slate-400">Tap to open camera</span>
                </>
              )}
            </button>

            {current && (
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-700 text-sm font-bold text-slate-300"
                >
                  <RotateCcw className="h-4 w-4" /> Retake
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (side === "front") { setStep("back"); return; }
                    if (front && back) void upload(front, back);
                  }}
                  className="flex h-12 flex-[1.4] items-center justify-center gap-2 rounded-xl bg-white text-sm font-bold text-slate-900"
                >
                  {side === "front" ? <>Next: back <ArrowRight className="h-4 w-4" /></> : <>Send to front desk</>}
                </button>
              </div>
            )}
          </>
        )}

        {step === "uploading" && (
          <div className="mt-24 flex flex-col items-center gap-4 text-center">
            <Loader2 className="h-10 w-10 animate-spin text-slate-400" />
            <p className="text-sm font-semibold text-slate-300">Sending both sides…</p>
          </div>
        )}

        {step === "done" && (
          <div className="mt-24 flex flex-col items-center gap-4 text-center">
            <CheckCircle2 className="h-12 w-12 text-emerald-400" />
            <p className="text-lg font-bold">Sent</p>
            <p className="text-sm leading-relaxed text-slate-400">
              The front desk has both sides. You can put your phone away.
            </p>
          </div>
        )}

        {step === "error" && (
          <div className="mt-24 flex flex-col items-center gap-4 text-center">
            <AlertCircle className="h-12 w-12 text-rose-400" />
            <p className="text-sm leading-relaxed text-slate-300">{error}</p>
            <button
              type="button"
              onClick={restart}
              className="mt-2 flex h-12 items-center justify-center gap-2 rounded-xl bg-white px-6 text-sm font-bold text-slate-900"
            >
              <RotateCcw className="h-4 w-4" /> Start over
            </button>
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={onFile}
          className="hidden"
        />
      </div>
    </div>
  );
}
