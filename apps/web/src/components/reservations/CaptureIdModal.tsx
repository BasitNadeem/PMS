/**
 * Front-desk side of guest ID capture.
 *
 * Shows a QR code, then waits on an SSE stream for the phone to finish. The
 * desk never handles the image itself — the phone uploads straight to the API,
 * and this modal only learns that it happened.
 */

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { AlertCircle, CheckCircle2, Loader2, RotateCcw, Smartphone, X } from "lucide-react";
import { BASE_URL, getErrorMessage } from "../../lib/api";
import { guestDocumentsService } from "../../services/guestDocuments";

interface CaptureIdModalProps {
  reservationId: string;
  guestName:     string;
  onClose:       () => void;
  /** Fired once the phone has uploaded, so the caller can refetch. */
  onCaptured:    () => void;
}

type Step = "starting" | "waiting" | "done" | "error";

export function CaptureIdModal({ reservationId, guestName, onClose, onCaptured }: CaptureIdModalProps) {
  const esRef = useRef<EventSource | null>(null);
  const [step,      setStep]      = useState<Step>("starting");
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [error,     setError]     = useState("");

  useEffect(() => {
    let cancelled = false;

    async function start() {
      try {
        const { token } = await guestDocumentsService.createCaptureSession(reservationId);
        if (cancelled) return;

        // Current origin, so the QR resolves on whatever host the desk is
        // actually using — localhost in dev, the hotel's subdomain in production.
        const mobileUrl = `${window.location.origin}/capture-id/${token}`;
        const dataUrl   = await QRCode.toDataURL(mobileUrl, {
          margin: 1, width: 232, color: { dark: "#111827", light: "#ffffff" },
        });
        if (cancelled) return;

        setQrDataUrl(dataUrl);
        setStep("waiting");

        // EventSource cannot set headers, so the JWT rides in the query string.
        // The server verifies it by hand for exactly this reason.
        const jwt = localStorage.getItem("accessToken") ?? "";
        const es  = new EventSource(
          `${BASE_URL}/api/reservations/id-capture/${token}/events?auth=${encodeURIComponent(jwt)}`,
        );
        esRef.current = es;

        es.addEventListener("scan_result", () => {
          es.close();
          setStep("done");
          onCaptured();
        });

        es.addEventListener("scan_error", (event) => {
          es.close();
          const { error: msg } = JSON.parse((event as MessageEvent<string>).data) as { error: string };
          setError(msg);
          setStep("error");
        });
      } catch (err) {
        if (cancelled) return;
        setError(getErrorMessage(err, "Could not start a capture session."));
        setStep("error");
      }
    }

    void start();
    return () => { cancelled = true; esRef.current?.close(); };
    // Restarting is done by remounting the modal, so this runs once per open.
  }, [reservationId, onCaptured]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Capture guest ID</h2>
            <p className="mt-0.5 text-sm text-slate-500">{guestName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {step === "starting" && (
          <div className="flex flex-col items-center gap-3 py-14">
            <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            <p className="text-sm text-slate-500">Preparing a secure link…</p>
          </div>
        )}

        {step === "waiting" && qrDataUrl && (
          <>
            <div className="mt-6 flex justify-center">
              <img src={qrDataUrl} alt="QR code to open the camera" className="rounded-xl border border-slate-200" />
            </div>
            <div className="mt-5 flex items-start gap-2.5 rounded-xl bg-slate-50 p-4">
              <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
              <p className="text-[13px] leading-relaxed text-slate-600">
                Scan with any phone camera, then photograph the <strong>front</strong> and{" "}
                <strong>back</strong> of the ID. Both sides upload together.
              </p>
            </div>
            <p className="mt-4 flex items-center justify-center gap-2 text-[12px] font-semibold text-slate-400">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Waiting for the phone… link expires in 10 minutes
            </p>
          </>
        )}

        {step === "done" && (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <CheckCircle2 className="h-12 w-12 text-emerald-500" />
            <p className="font-bold text-slate-900">Both sides received</p>
            <p className="text-sm text-slate-500">This stay is now marked ID-verified.</p>
            <button
              type="button"
              onClick={onClose}
              className="mt-3 h-11 rounded-xl bg-slate-900 px-6 text-sm font-bold text-white"
            >
              Done
            </button>
          </div>
        )}

        {step === "error" && (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <AlertCircle className="h-12 w-12 text-rose-500" />
            <p className="text-sm leading-relaxed text-slate-600">{error}</p>
            <button
              type="button"
              onClick={onClose}
              className="mt-3 flex h-11 items-center gap-2 rounded-xl bg-slate-900 px-6 text-sm font-bold text-white"
            >
              <RotateCcw className="h-4 w-4" /> Close and retry
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
