// Generates a short two-tone chime via the Web Audio API instead of shipping
// an audio asset. Browsers generally require audio to be unlocked by a user
// gesture before a background SSE event is allowed to make sound.
let ctx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx || ctx.state === "closed") ctx = new AudioContext();
  return ctx;
}

function ring(audioContext: AudioContext): void {
  const now = audioContext.currentTime;
  [880, 1175].forEach((freq, i) => {
    const osc  = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    const start = now + i * 0.12;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.2, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.25);
    osc.connect(gain).connect(audioContext.destination);
    osc.start(start);
    osc.stop(start + 0.26);
  });
}

// Call synchronously from a click/key/pointer handler. The one-sample silent
// source handles Safari/iOS as well as Chromium's AudioContext policy.
export function unlockNotificationSound(): void {
  try {
    const audioContext = getAudioContext();
    if (!audioContext) return;
    if (audioContext.state === "suspended") {
      void audioContext.resume().catch(() => { /* popup remains the fallback */ });
    }

    const silentBuffer = audioContext.createBuffer(1, 1, audioContext.sampleRate);
    const silentSource = audioContext.createBufferSource();
    silentSource.buffer = silentBuffer;
    silentSource.connect(audioContext.destination);
    silentSource.start();
  } catch {
    /* Web Audio unsupported or blocked — the visual alert still works. */
  }
}

export function playNotificationSound(): void {
  try {
    const audioContext = getAudioContext();
    if (!audioContext) return;

    if (audioContext.state === "running") {
      ring(audioContext);
      return;
    }

    // A resumed context must be running before tones are scheduled. Scheduling
    // first can make the chime disappear silently in Chromium/Safari.
    void audioContext.resume()
      .then(() => {
        if (audioContext.state === "running") ring(audioContext);
      })
      .catch(() => { /* popup remains the fallback */ });
  } catch {
    /* Web Audio unsupported or blocked — the visual alert still works. */
  }
}
