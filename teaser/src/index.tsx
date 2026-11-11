import React from "react";
import { Composition, registerRoot } from "remotion";
import { CampusTeaser } from "./teaser";
import { timeline, fps } from "./timeline.generated.json";

function RemotionRoot() {
  return <Composition
    id="GtaMmmutTeaser"
    component={CampusTeaser}
    fps={fps}
    width={1920}
    height={1080}
    durationInFrames={timeline.reduce((total, shot) => total + shot.frames, 0)}
  />;
}

registerRoot(RemotionRoot);
