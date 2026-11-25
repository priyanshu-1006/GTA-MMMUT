function exhaustPulse(time: number) {
  const pressure = Math.min(1, time * 275) * Math.exp(-time * 48);
  const rumble = 0.72 * Math.sin(2 * Math.PI * 61 * time) + 0.26 * Math.sin(2 * Math.PI * 132 * time);
  const rasp = 0.18 * Math.sin(2 * Math.PI * 289 * time) + 0.08 * Math.sin(2 * Math.PI * 601 * time);
  return pressure * (rumble + rasp * Math.exp(-time * 17));
}

function createIdleLoop(context: AudioContext) {
  const sampleRate = context.sampleRate;
  const cycle = Math.round(sampleRate * 120 / 900);
  const secondCylinder = Math.round(cycle * 315 / 720);
  const buffer = context.createBuffer(1, cycle, sampleRate);
  const samples = buffer.getChannelData(0);
  let sum = 0;
  for (let index = 0; index < cycle; index++) {
    const first = index / sampleRate;
    const second = ((index + cycle - secondCylinder) % cycle) / sampleRate;
    samples[index] = (exhaustPulse(first) + 0.81 * exhaustPulse(second)) * 0.84;
    sum += samples[index];
  }
  const dc = sum / samples.length;
  for (let index = 0; index < samples.length; index++) samples[index] -= dc;
  return buffer;
}

export function createBulletEngineAudio() {
  let context: AudioContext | undefined;
  let engine: AudioBufferSourceNode | undefined;
  let filter: BiquadFilterNode | undefined;
  let gain: GainNode | undefined;
  let enabled = true;
  let paused = false;
  let mounted = false;
  let lastRate = 1;
  let lastCutoff = 520;
  let lastVolume = 0;

  function start() {
    if (!enabled || paused || !mounted || typeof AudioContext === "undefined") return;
    if (!context) {
      try {
        context = new AudioContext();
      } catch {
        return;
      }
      filter = context.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 520;
      gain = context.createGain();
      gain.gain.value = 0;
      engine = context.createBufferSource();
      engine.buffer = createIdleLoop(context);
      engine.loop = true;
      engine.connect(filter).connect(gain).connect(context.destination);
      engine.start();
    }
    if (context.state === "suspended") void context.resume().catch(() => undefined);
  }

  function setLoad(speed: number, throttle: number) {
    if (!context || !engine || !gain || !filter) return;
    const now = context.currentTime;
    const motion = Math.min(1, Math.abs(speed) / 15);
    const load = Math.max(0, Math.min(1, throttle));
    const volume = mounted && enabled && !paused ? 0.11 + 0.15 * load + 0.06 * motion : 0;
    if (Math.abs(volume - lastVolume) > 0.004) {
      gain.gain.setTargetAtTime(volume, now, 0.055);
      lastVolume = volume;
    }
    if (volume === 0) return;
    const rate = 1 + 1.18 * motion + 0.46 * load;
    const cutoff = 480 + 360 * motion + 660 * load;
    if (Math.abs(rate - lastRate) > 0.018) {
      engine.playbackRate.setTargetAtTime(rate, now, 0.12);
      lastRate = rate;
    }
    if (Math.abs(cutoff - lastCutoff) > 20) {
      filter.frequency.setTargetAtTime(cutoff, now, 0.13);
      lastCutoff = cutoff;
    }
  }

  function sync() {
    start();
    setLoad(0, 0);
  }

  return {
    setMounted(value: boolean) {
      mounted = value;
      sync();
    },
    setEnabled(value: boolean) {
      if (enabled === value) return;
      enabled = value;
      sync();
    },
    setPaused(value: boolean) {
      if (paused === value) return;
      paused = value;
      sync();
    },
    setLoad,
    dispose() {
      if (context && context.state !== "closed") void context.close().catch(() => undefined);
      context = undefined;
      engine = undefined;
      filter = undefined;
      gain = undefined;
    },
  };
}
