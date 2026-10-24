let ctx: AudioContext | null = null;

/** Short tick matched to Beautiful UI's "tick" interaction sound. */
export function playTick() {
  const AudioCtx =
    window.AudioContext ||
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return;
  if (!ctx) ctx = new AudioCtx();
  if (ctx.state === "suspended") void ctx.resume();

  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();

  osc.type = "square";
  osc.frequency.value = 2100;
  filter.type = "bandpass";
  filter.frequency.value = 2600;
  filter.Q.value = 1.6;

  const peak = 0.24 * 0.32;
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(peak, t + 0.0004);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.0284);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  osc.start(t);
  osc.stop(t + 0.05);
}
