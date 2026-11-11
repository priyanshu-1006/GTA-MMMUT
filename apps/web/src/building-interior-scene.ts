import type { Engine } from "@babylonjs/core/Engines/engine";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Scene } from "@babylonjs/core/scene";
import { createCampusWalk } from "./campus-walk";
import type { InteriorId } from "./building-interiors";
import { cseInteriorLayout, cseStairHeightAt, type CseFloor, type CseRoom } from "./cse-interior-layout";
import type { GameSettings } from "./game-settings";
import type { PlayerStatus } from "./player-controls";

export interface InteriorLocation {
  readonly section: string;
  readonly floor?: number;
  readonly room?: string;
  readonly roomId?: string;
}

interface InteriorLayout {
  readonly spawn: readonly [number, number, number];
  readonly spawnYaw?: number;
  readonly extent: readonly [number, number, number, number];
  readonly rooms?: readonly CseRoom[];
  floorAt(x: number, z: number, currentY: number): number;
  location(x: number, y: number, z: number): string | InteriorLocation;
  exitNear(x: number, y: number, z: number): boolean;
}

async function loadLayout(id: InteriorId): Promise<(scene: Scene) => InteriorLayout> {
  if (id === "library") return (await import("./library-interior")).buildLibraryInterior;
  if (id === "hall") return (await import("./mph-interior")).buildMphInterior;
  if (id === "nalanda") return (await import("./nalanda-interior")).buildNalandaInterior;
  if (id === "pushpagiri") return (await import("./pushpagiri-interior")).buildPushpagiriInterior;
  if (id === "takshashila") return (await import("./takshashila-interior")).buildTakshashilaInterior;

  const { createCseInteriorGeometry } = await import("./cse-interior-geometry");
  return (scene) => {
    createCseInteriorGeometry(scene);
    const { rooms, spawn, extent, floorHeights, wings } = cseInteriorLayout;
    const floorOf = (y: number): CseFloor => y >= (floorHeights[0] + floorHeights[1]) / 2 ? 1 : 0;
    return {
      rooms, spawn, extent,
      floorAt: (x, z, y) => cseStairHeightAt(x, z) ?? floorHeights[floorOf(y)],
      exitNear: (x, y, z) => floorOf(y) === 0 && Math.abs(x) < 1.6 && z > -0.1,
      location(x, y, z) {
        const floor = floorOf(y);
        const section = z <= wings.old.front ? "Old CSE" : z < wings.new.rear ? "Connecting passage" : "New CSE";
        const contains = ({ bounds: [left, rear, right, front], floor: roomFloor }: CseRoom) =>
          roomFloor === floor && x >= left && x <= right && z >= rear && z <= front;
        const room = rooms.find((candidate) => candidate.suite && contains(candidate)) ?? rooms.find(contains);
        return { floor, section, room: room?.label, roomId: room?.id };
      },
    };
  };
}

export async function createBuildingInteriorScene(
  id: InteriorId,
  engine: Engine,
  canvas: HTMLCanvasElement,
  onPlayerStatus: (status: PlayerStatus) => void,
  onLocation: (location: InteriorLocation) => void,
  onExit: () => void,
) {
  const build = await loadLayout(id);
  const scene = new Scene(engine);
  scene.useRightHandedSystem = true;
  scene.collisionsEnabled = true;
  scene.clearColor = new Color4(0.1, 0.14, 0.15, 1);
  const ambient = new HemisphericLight("interior-ceiling-light", Vector3.Up(), scene);
  ambient.intensity = 1.05;
  ambient.groundColor = new Color3(0.49, 0.51, 0.47);
  const corridorLight = new DirectionalLight("interior-fill", new Vector3(-0.5, -1, -0.65), scene);
  corridorLight.intensity = 0.35;

  let layout: InteriorLayout;
  try {
    layout = build(scene);
  } catch (error) {
    scene.dispose();
    throw error;
  }
  const { spawn, extent } = layout;
  const [minX, minZ, maxX, maxZ] = extent;
  const walk = createCampusWalk(scene, canvas, [0, 0], [[minX, minZ], [maxX, maxZ]],
    (x, z, y) => layout.floorAt(x, z, y) + 0.025, null, onPlayerStatus, {
      indoor: true,
      spawn: [spawn[0], spawn[1] + 0.025, spawn[2]],
      spawnYaw: layout.spawnYaw,
      portal: { at: ([x, z], y) => layout.exitNear(x, y, z) ? "exit" : null, interact: onExit },
    });
  walk.camera.maxZ = 140;
  let lastLocation = "";
  scene.onAfterRenderObservable.add(() => {
    const player = walk.worldPosition();
    if (!player) return;
    const { x, y, z } = player;
    const area = layout.location(x, y, z);
    const location: InteriorLocation = typeof area === "string" ? { section: area } : area;
    const nextLocation = `${location.section}/${location.floor ?? ""}/${location.roomId ?? ""}`;
    if (lastLocation === nextLocation) return;
    lastLocation = nextLocation;
    canvas.dataset.interiorLocation = location.section;
    if (id === "cse") {
      canvas.dataset.cseFloor = String(location.floor);
      canvas.dataset.cseSection = location.section;
      canvas.dataset.cseRoom = location.roomId ?? "";
    }
    onLocation(location);
  });
  scene.onDisposeObservable.addOnce(() => {
    delete canvas.dataset.interiorId;
    delete canvas.dataset.interiorLocation;
    delete canvas.dataset.cseFloor;
    delete canvas.dataset.cseSection;
    delete canvas.dataset.cseRoom;
  });

  return {
    scene, rooms: layout.rooms,
    activate() {
      walk.setActive(true);
      canvas.dataset.cameraView = `${id}-interior`;
      canvas.dataset.interiorId = id;
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
