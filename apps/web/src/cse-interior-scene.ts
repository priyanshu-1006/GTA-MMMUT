import type { Engine } from "@babylonjs/core/Engines/engine";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Scene } from "@babylonjs/core/scene";
import { createCampusWalk } from "./campus-walk";
import { createCseInteriorGeometry } from "./cse-interior-geometry";
import { cseInteriorLayout, cseStairHeightAt, type CseFloor, type CseRoom } from "./cse-interior-layout";
import type { GameSettings } from "./game-settings";
import type { PlayerStatus } from "./player-controls";

export interface CseLocation {
  readonly floor: CseFloor;
  readonly section: "New CSE" | "Connecting passage" | "Old CSE";
  readonly room: CseRoom | undefined;
}

export function createCseInteriorScene(
  engine: Engine,
  canvas: HTMLCanvasElement,
  onPlayerStatus: (status: PlayerStatus) => void,
  onLocation: (location: CseLocation) => void,
  onExit: () => void,
) {
  const scene = new Scene(engine);
  scene.useRightHandedSystem = true;
  scene.collisionsEnabled = true;
  scene.clearColor = new Color4(0.1, 0.14, 0.15, 1);
  const ambient = new HemisphericLight("cse-ceiling-light", Vector3.Up(), scene);
  ambient.intensity = 1.05;
  ambient.groundColor = new Color3(0.49, 0.51, 0.47);
  const corridorLight = new DirectionalLight("cse-corridor-fill", new Vector3(-0.5, -1, -0.65), scene);
  corridorLight.intensity = 0.35;

  const { rooms, spawn, extent, floorHeights, wings } = cseInteriorLayout;
  const [minX, minZ, maxX, maxZ] = extent;
  const floorOf = (y: number): CseFloor => y >= (floorHeights[0] + floorHeights[1]) / 2 ? 1 : 0;
  try {
    createCseInteriorGeometry(scene);
  } catch (error) {
    scene.dispose();
    throw error;
  }
  const walk = createCampusWalk(scene, canvas, [0, 0], [[minX, minZ], [maxX, maxZ]],
    (x, z, y) => (cseStairHeightAt(x, z) ?? floorHeights[floorOf(y)]) + 0.025,
    null, onPlayerStatus, {
      indoor: true,
      spawn: [spawn[0], spawn[1] + 0.025, spawn[2]],
      portal: { contains: ([x, z], y) => floorOf(y) === 0 && Math.abs(x) < 1.6 && z > -0.1, interact: onExit },
    });
  walk.camera.maxZ = 120;
  let lastLocation = "";
  scene.onAfterRenderObservable.add(() => {
    const player = walk.worldPosition();
    if (!player) return;
    const { x, y, z } = player;
    const floor = floorOf(y);
    const section = z <= wings.old.front ? "Old CSE" : z < wings.new.rear ? "Connecting passage" : "New CSE";
    const room = rooms.find(({ bounds: [left, rear, right, front], floor: roomFloor, suite }) =>
      suite && roomFloor === floor && x >= left && x <= right && z >= rear && z <= front)
      ?? rooms.find(({ bounds: [left, rear, right, front], floor: roomFloor }) =>
        roomFloor === floor && x >= left && x <= right && z >= rear && z <= front);
    const nextLocation = `${floor}/${section}/${room?.id ?? ""}`;
    if (lastLocation === nextLocation) return;
    lastLocation = nextLocation;
    canvas.dataset.cseFloor = String(floor);
    canvas.dataset.cseSection = section;
    canvas.dataset.cseRoom = room?.id ?? "";
    onLocation({ floor, section, room });
  });
  scene.onDisposeObservable.addOnce(() => {
    delete canvas.dataset.cseFloor;
    delete canvas.dataset.cseSection;
    delete canvas.dataset.cseRoom;
  });

  return {
    scene, rooms,
    activate() {
      walk.setActive(true);
      canvas.dataset.cameraView = "cse-interior";
    },
    setPaused: walk.setPaused,
    setAppearance: walk.setAppearance,
    setCamera: walk.setCamera,
    setSettings({ lookSensitivity, invertY, reducedMotion, fieldOfView }: GameSettings) {
      walk.setReducedMotion(reducedMotion);
      walk.camera.fov = fieldOfView * Math.PI / 180;
      for (const rotation of walk.camera.movement.input.getEntries("pointer", "rotate")) {
        rotation.sensitivityX = lookSensitivity / 1000;
        rotation.sensitivityY = (invertY ? -lookSensitivity : lookSensitivity) / 1000;
      }
    },
  };
}
