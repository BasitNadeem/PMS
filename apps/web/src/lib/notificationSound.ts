// Generates a short two-tone chime via the Web Audio API instead of shipping
// an audio asset — avoids bundling/loading a file for a two-second sound.
let ctx: AudioContext | null = null;

export function playNotificationSound(): void {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();

    const now = ctx.currentTime;
    [880, 1175].forEach((freq, i) => {
      const osc  = ctx!.createOscillator();
      const gain = ctx!.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const start = now + i * 0.12;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.2, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.25);
      osc.connect(gain).connect(ctx!.destination);
      osc.start(start);
      osc.stop(start + 0.26);
    });
  } catch {
    /* Web Audio unsupported or blocked — silent, popup still shows */
  }
}
