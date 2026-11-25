import React from "react";
import { AbsoluteFill, Audio, Composition, Easing, interpolate, OffthreadVideo, registerRoot, Sequence,
  spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import "@fontsource/archivo-black/400.css";
import "@fontsource/barlow/600.css";
import "@fontsource/barlow/700.css";

const fps = 24;
const cream = "#fff4d8";
const lime = "#d7fa91";
const smooth = { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) } as const;

const cuts = [
  { id: "short-hook", frames: 60, rate: 1, label: "hook", transition: "hit" },
  { id: "short-meet", frames: 60, rate: 1, label: "garden" },
  { id: "short-ignition", frames: 60, rate: 1.07, label: "bullet", transition: "hit" },
  { id: "short-side", frames: 60, rate: 0.64, label: "ride", transition: "hit" },
  { id: "short-side", frames: 60, rate: 0.72, trim: 38, label: "" },
  { id: "short-chase", frames: 120, rate: 0.68, label: "ride" },
  { id: "short-west", frames: 60, rate: 1.13, label: "", transition: "hit" },
  { id: "short-arrive", frames: 90, rate: 0.9, label: "cafeteria" },
  { id: "short-door", frames: 90, rate: 0.9, label: "" },
  { id: "short-cafe", frames: 90, rate: 0.9, label: "", transition: "door" },
  { id: "short-chai", frames: 90, rate: 0.9, label: "chai" },
  { id: "short-table", frames: 120, rate: 0.68, label: "after" },
  { id: "short-hook", frames: 120, rate: 0.68, label: "end" },
] as const;

type Cut = (typeof cuts)[number];
let cursor = 0;
const timeline = cuts.map((cut) => {
  const from = cursor;
  cursor += cut.frames;
  return { ...cut, from };
});

function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const frame = useCurrentFrame() - delay;
  const { fps: framerate } = useVideoConfig();
  const rise = spring({ fps: framerate, frame: Math.max(0, frame), config: { damping: 20, stiffness: 165, mass: 0.65 } });
  return <div style={{ opacity: interpolate(frame, [0, 7], [0, 1], smooth),
    transform: `translateY(${22 * (1 - rise)}px)` }}>{children}</div>;
}

function Location({ place, detail }: { place: string; detail?: string }) {
  return <div style={{ position: "absolute", left: 68, bottom: 305, color: cream }}>
    <Reveal>
      <div style={{ display: "flex", alignItems: "center", gap: 15 }}>
        <div style={{ width: 31, height: 5, borderRadius: 8, background: lime }} />
        <span style={{ fontFamily: "Barlow", fontWeight: 700, fontSize: 31, letterSpacing: 5 }}>{place}</span>
      </div>
      {detail && <div style={{ paddingLeft: 46, fontFamily: "Barlow", fontSize: 32, fontWeight: 600, marginTop: 3,
        opacity: 0.88 }}>{detail}</div>}
    </Reveal>
  </div>;
}

function Hook() {
  const frame = useCurrentFrame();
  return <div style={{ position: "absolute", left: 72, top: 218, fontFamily: "Archivo Black", fontSize: 113,
    letterSpacing: -8, lineHeight: 0.89, color: cream, textShadow: "0 5px 20px #08130b85",
    opacity: interpolate(frame, [51, 59], [1, 0], smooth) }}>
    <Reveal>ONE RIDE.</Reveal>
    <Reveal delay={7}><span style={{ color: lime }}>TWO CHAIS.</span></Reveal>
  </div>;
}

function EndCard() {
  const frame = useCurrentFrame();
  const line = interpolate(frame, [10, 49], [0, 226], smooth);
  return <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", color: cream,
    background: "linear-gradient(175deg,#0a2418b8,#081a12f0 73%)", paddingBottom: 52, textAlign: "center" }}>
    <Reveal delay={4}>
      <div style={{ fontFamily: "Archivo Black", fontSize: 202, letterSpacing: -17, lineHeight: 0.82 }}>GTA</div>
      <div style={{ fontFamily: "Archivo Black", fontSize: 152, letterSpacing: -13, lineHeight: 0.99, color: lime }}>MMMUT</div>
    </Reveal>
    <div style={{ width: line, height: 4, background: lime, borderRadius: 4, marginTop: 37, opacity: 0.78 }} />
    <Reveal delay={19}>
      <div style={{ fontFamily: "Barlow", fontWeight: 600, fontSize: 40, marginTop: 26 }}>Built by Priyanshu Chaurasia</div>
    </Reveal>
    <Reveal delay={26}>
      <div style={{ fontFamily: "Barlow", fontWeight: 700, fontSize: 43, letterSpacing: 1, color: lime, marginTop: 23 }}>gta.mmmut.app</div>
    </Reveal>
  </AbsoluteFill>;
}

function Shot({ cut }: { cut: Cut }) {
  const frame = useCurrentFrame();
  const end = cut.label === "end";
  const transition = "transition" in cut ? cut.transition : null;
  const impact = transition ? interpolate(frame, [0, transition === "door" ? 9 : 6], [1, 0], smooth) : 0;
  const zoom = 1.014 + impact * 0.09 + interpolate(frame, [0, cut.frames], [0, end ? 0.055 : 0.032], smooth);
  return <AbsoluteFill style={{ overflow: "hidden", background: "#0e2218" }}>
    <OffthreadVideo src={staticFile(`footage/${cut.id}.mp4`)} playbackRate={cut.rate}
      trimBefore={"trim" in cut ? cut.trim : undefined} muted
      style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${zoom})`,
        filter: end ? "blur(12px) brightness(0.63) saturate(0.8)" :
          `contrast(1.075) saturate(1.12) sepia(0.10) blur(${(impact * 2.8).toFixed(1)}px)` }} />
    <AbsoluteFill style={{ background: "linear-gradient(180deg,#0a191c63 0%,transparent 32%,transparent 64%,#0817119e 100%)" }} />
    {impact > 0 && <AbsoluteFill style={{ background: transition === "door" ? "#091712" : "#f9e4af",
      opacity: impact * (transition === "door" ? 0.83 : 0.25) }} />}
    {cut.label === "hook" && <Hook />}
    {cut.label === "garden" && <Location place="ENTRANCE GARDEN" detail="Meet me here." />}
    {cut.label === "bullet" && <Location place="ROYAL ENFIELD BULLET" />}
    {cut.label === "ride" && <Location place="CAMPUS RIDE" />}
    {cut.label === "cafeteria" && <Location place="B21" detail="University Cafeteria" />}
    {cut.label === "chai" && <Location place="CHAI TIME" />}
    {cut.label === "after" && <Location place="WORTH THE RIDE." />}
    {end && <EndCard />}
  </AbsoluteFill>;
}

function BulletShort() {
  return <AbsoluteFill style={{ background: "#0b1e14" }}>
    {timeline.map((cut) => <Sequence key={cut.from} from={cut.from} durationInFrames={cut.frames} premountFor={12}>
      <Shot cut={cut} />
    </Sequence>)}
    <Audio src={staticFile("footage/short-mix.wav")} />
  </AbsoluteFill>;
}

registerRoot(() => <Composition id="BulletChaiShort" component={BulletShort} fps={fps} width={1080}
  height={1920} durationInFrames={cursor} />);
