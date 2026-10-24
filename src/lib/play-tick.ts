let ctx: AudioContext | null = null;

function audioContext(): AudioContext | null {
  const AudioCtx =
    window.AudioContext ||
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return null;
  if (!ctx) ctx = new AudioCtx();
  return ctx;
}

function sound(audio: AudioContext) {
  const t = audio.currentTime;
  const osc = audio.createOscillator();
  const filter = audio.createBiquadFilter();
  const gain = audio.createGain();

  osc.type = "square";
  osc.frequency.setValueAtTime(2100, t);
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(2600, t);
  filter.Q.setValueAtTime(1.6, t);

  const peak = 0.2;
  gain.gain.setValueAtTime(peak, t);
  gain.gain.linearRampToValueAtTime(0.0001, t + 0.03);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(audio.destination);
  osc.start(t);
  osc.stop(t + 0.04);
}

/** Short tick. Safari drops notes scheduled while AudioContext is still suspended. */
export function playTick() {
  const audio = audioContext();
  if (!audio) return;

  if (audio.state === "suspended") {
    const buffer = audio.createBuffer(1, 1, audio.sampleRate);
    const src = audio.createBufferSource();
    src.buffer = buffer;
    src.connect(audio.destination);
    src.start(0);
  }

  if (audio.state === "running") {
    sound(audio);
    return;
  }

  void audio.resume().then(() => {
    if (audio.state === "running") sound(audio);
  });
}
