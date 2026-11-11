import type { WorldGroundPoint } from "@gta-mmmut/world-data";

const chantUrl = new URL("./assets/audio/campus-chant.wav", import.meta.url).href;

export function createCampusChant(centers: readonly WorldGroundPoint[]) {
  const audio = new Audio();
  audio.preload = "none";
  audio.loop = true;
  audio.volume = 0;
  let enabled = true;

  return {
    start() {
      if (!enabled || !audio.paused) return;
      if (!audio.hasAttribute("src")) audio.src = chantUrl;
      void audio.play().catch(() => undefined);
    },
    setEnabled(value: boolean) {
      enabled = value;
      if (!value) audio.volume = 0;
    },
    update(player: WorldGroundPoint | null) {
      let distance = Infinity;
      if (player && enabled) {
        for (const [x, z] of centers) distance = Math.min(distance, Math.hypot(player[0] - x, player[1] - z));
      }
      const proximity = enabled ? Math.max(0, 1 - distance / 23) : 0;
      const volume = proximity * proximity * 0.48;
      if (audio.volume !== volume && (Math.abs(audio.volume - volume) > 0.003 || volume === 0)) audio.volume = volume;
    },
    dispose() {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    },
  };
}
