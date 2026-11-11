import React, { type CSSProperties } from "react";
import { AbsoluteFill, Audio, Easing, Img, interpolate, OffthreadVideo, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import "@fontsource/archivo-black/latin-400.css";
import "@fontsource/barlow/latin-500.css";
import "@fontsource/barlow/latin-700.css";
import { timeline } from "./timeline.generated.json";

type Shot = (typeof timeline)[number];

const cream = "#fff4d9";
const amber = "#ffc272";
const dark = "#101a18";
const easing = Easing.bezier(0.25, 0.65, 0.28, 1);
const motion = (frame: number, start: number, end: number, from: number, to: number) =>
  interpolate(frame, [start, end], [from, to], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing });

const labelStyle: CSSProperties = {
  fontFamily: "Barlow, sans-serif",
  textTransform: "uppercase",
  fontWeight: 700,
  fontSize: 26,
  letterSpacing: 5,
  color: amber,
};

function Title({ end }: { end: boolean }) {
  const frame = useCurrentFrame();
  const enter = motion(frame, 7, 25, 0, 1);
  const subtitle = motion(frame, 16, 34, 0, 1);
  return <AbsoluteFill style={{ padding: "0 122px", justifyContent: "center", alignItems: end ? "center" : "flex-start", color: cream }}>
    <div style={{ ...labelStyle, opacity: enter, transform: `translateY(${(1 - enter) * 24}px)` }}>
      {end ? "A campus recreation" : "Gorakhpur, Uttar Pradesh"}
    </div>
    <div style={{
      fontFamily: "Archivo Black, sans-serif", fontSize: 176, lineHeight: 1.05, letterSpacing: -9, margin: "8px 0 8px -6px",
      textShadow: "0 10px 50px #0008", opacity: enter, transform: `translateY(${(1 - enter) * 44}px)`,
    }}>
      GTA <span style={{ color: amber }}>MMMUT</span>
    </div>
    <div style={{
      color: cream, fontFamily: "Barlow, sans-serif", fontSize: 40, fontWeight: 700,
      opacity: subtitle, transform: `translateY(${(1 - subtitle) * 25}px)`, letterSpacing: 0.5,
    }}>Built by Priyanshu Chaurasia</div>
    {end && <div style={{ ...labelStyle, opacity: motion(frame, 31, 48, 0, 1), marginTop: 55, fontSize: 22 }}>
      gta-mmmut.vercel.app
    </div>}
  </AbsoluteFill>;
}

function Location({ shot }: { shot: Shot }) {
  const frame = useCurrentFrame();
  const start = motion(frame, 4, 15, 0, 1);
  const end = motion(frame, shot.frames - 8, shot.frames, 1, 0);
  const chapter = shot.role === "drive" ? "Take the wheel" : shot.role === "inside" ? "Step inside" : undefined;
  return <div style={{
    position: "absolute", left: 116, bottom: 143, paddingLeft: 23, borderLeft: `4px solid ${amber}`,
    color: cream, textShadow: "0 3px 12px #000a", opacity: start * end, transform: `translateY(${(1 - start) * 18}px)`,
  }}>
    {chapter && <div style={{ ...labelStyle, fontSize: 22, marginBottom: 2 }}>{chapter}</div>}
    <div style={{ fontFamily: "Barlow, sans-serif", fontSize: 39, lineHeight: 1.08, fontWeight: 700, letterSpacing: 1 }}>{shot.label}</div>
  </div>;
}

function Footage({ shot }: { shot: Shot }) {
  const frame = useCurrentFrame();
  const still = /\.(png|jpe?g|webp)$/i.test(shot.src);
  const end = shot.role === "end";
  const open = shot.role === "open";
  const duration = shot.frames;
  const zoom = still ? motion(frame, 0, duration, 1.035, 1.14) : end ? 1.035 : 1;
  const cinematicTone = "saturate(0.84) contrast(1.11) brightness(0.87)";
  const mediaStyle: CSSProperties = {
    width: "100%", height: "100%", objectFit: "cover", transform: `scale(${zoom})`, filter: cinematicTone,
  };
  const filmLight = (open || shot.role === "inside" || end) ? motion(frame, 0, 9, 0.28, 0) : 0;
  const fadeIn = open ? motion(frame, 0, 12, 0, 1) : 1;
  const fadeOut = end ? motion(frame, duration - 15, duration, 1, 0) : 1;

  return <AbsoluteFill style={{ backgroundColor: dark }}>
    <AbsoluteFill style={{ opacity: fadeIn * fadeOut }}>
      {still ? <Img src={staticFile(shot.src)} style={mediaStyle} /> : <OffthreadVideo
        src={staticFile(shot.src)} muted playbackRate={shot.rate} style={mediaStyle}
      />}
      <AbsoluteFill style={{ background: end ? "#0d1717ba" : open ? "linear-gradient(90deg,#0a1514ea,#0a151475 60%,#0a15141a)" : "linear-gradient(0deg,#0b1714ae,transparent 40%)" }} />
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at 54% 42%,transparent 30%,#10171855 100%)" }} />
      {(open || end) ? <Title end={end} /> : <Location shot={shot} />}
      <AbsoluteFill style={{ backgroundColor: "#ffc37a", opacity: filmLight }} />
    </AbsoluteFill>
  </AbsoluteFill>;
}

export function CampusTeaser() {
  const { height } = useVideoConfig();
  let start = 0;
  return <AbsoluteFill style={{ backgroundColor: dark }}>
    <Audio src={staticFile("score.wav")} />
    {timeline.map((shot) => {
      const from = start;
      start += shot.frames;
      return <Sequence key={shot.id} from={from} durationInFrames={shot.frames}>
        <Footage shot={shot} />
      </Sequence>;
    })}
    {[0, height - 72].map((top) => <div key={top} style={{ position: "absolute", top, width: "100%", height: 72, background: dark }} />)}
  </AbsoluteFill>;
}
