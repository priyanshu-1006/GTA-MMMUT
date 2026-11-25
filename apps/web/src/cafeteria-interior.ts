import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { Space } from "@babylonjs/core/Maths/math.axis";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { CreateCylinder } from "@babylonjs/core/Meshes/Builders/cylinderBuilder";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { Scene } from "@babylonjs/core/scene";
import { createCampusActors } from "./campus-actors";
import { createInteriorFurnishing, type FurnishedInterior } from "./interior-furnishing";

const extent = [-8.5, -14.4, 8.5, 2.35] as const;
const diningTables = [
  [-4.55, -0.95], [4.55, -0.95],
  [-4.55, -4.25], [4.55, -4.25],
  [-4.55, -7.55], [4.55, -7.55], [4.55, -10.85],
] as const;

function alignArmJoint(joint: TransformNode, current: Vector3, desired: Vector3) {
  current.normalize();
  desired.normalize();
  const axis = Vector3.Cross(current, desired);
  const sine = axis.length();
  if (sine > 0.0001) joint.rotate(axis.scale(1 / sine), Math.atan2(sine, Vector3.Dot(current, desired)), Space.WORLD);
}

function reachForCup(shoulder: TransformNode, elbow: TransformNode, wrist: TransformNode, cup: Vector3, blend: number) {
  const origin = shoulder.getAbsolutePosition().clone();
  const naturalElbow = elbow.getAbsolutePosition().subtract(origin);
  const naturalWrist = wrist.getAbsolutePosition().clone();
  const upperLength = naturalElbow.length();
  const forearmLength = Vector3.Distance(naturalWrist, origin.add(naturalElbow));
  const grip = cup.add(new Vector3(-0.08, 0.048, 0.002));
  const goal = Vector3.Lerp(naturalWrist, grip, blend).subtractInPlace(origin);
  const distance = Math.max(Math.abs(upperLength - forearmLength) + 0.001,
    Math.min(upperLength + forearmLength - 0.001, goal.length()));
  const direction = goal.normalize();
  const bend = naturalElbow.subtract(direction.scale(Vector3.Dot(naturalElbow, direction))).normalize();
  const along = (upperLength ** 2 - forearmLength ** 2 + distance ** 2) / (2 * distance);
  const elbowGoal = direction.scale(along).addInPlace(bend.scale(Math.sqrt(Math.max(0, upperLength ** 2 - along ** 2))));
  alignArmJoint(shoulder, naturalElbow, elbowGoal);
  shoulder.computeWorldMatrix(true);
  elbow.computeWorldMatrix(true);
  wrist.computeWorldMatrix(true);
  const movedElbow = elbow.getAbsolutePosition();
  alignArmJoint(elbow, wrist.getAbsolutePosition().subtract(movedElbow), origin.add(direction.scale(distance)).subtractInPlace(movedElbow));
}

export function buildCafeteriaInterior(scene: Scene, friendShirt?: string): FurnishedInterior & { shareChai?(): Promise<boolean> } {
  const { material, patterned, box, floor, sign, finish } = createInteriorFurnishing(scene, "cafeteria");
  const plaster = material("warm-plaster", "#eee1ce");
  const tile = patterned("wall-tiles", "#5b827b", "#3f625e");
  const terrazzo = patterned("terrazzo-floor", "#b8ac9b", "#8b8071");
  const ceiling = material("ceiling", "#e9e5d9");
  const trim = material("orange-trim", "#b46c46");
  const oak = patterned("oak-tabletops", "#ae8050", "#7b5839", true);
  const wood = material("dark-wood", "#5d4536");
  const steel = material("stainless-steel", "#a7aeac");
  steel.metallic = 0.52;
  steel.roughness = 0.53;
  const frame = material("painted-steel", "#3d4944");
  const red = material("brick-red-seating", "#9c5445");
  const teal = material("jade-seating", "#416b62");
  const stone = material("countertop", "#e0d8c7");
  const paper = material("cream-paper", "#ede3c7");
  const clay = material("terracotta-cups", "#b46b4c");
  const chai = material("chai", "#98693f");
  const glass = material("daylit-glazing", "#aac6b7", true);
  const light = material("tube-lights", "#fff5df", true);
  const [left, rear, right, front] = extent;
  const width = right - left;
  const depth = front - rear;
  const middle = (front + rear) / 2;
  const height = 3.65;

  floor(terrazzo, extent, 0, 0.56);
  box(ceiling, [0, height + 0.09, middle], [width, 0.18, depth], true);
  box(plaster, [0, height / 2, rear], [width, height, 0.22], true);
  box(tile, [0, 0.62, rear + 0.115], [width, 1.24, 0.024]);

  const doorHalfWidth = 1.22;
  for (const side of [-1, 1]) {
    const x = side * right;
    box(plaster, [x, height / 2, middle], [0.24, height, depth], true);
    box(tile, [x - side * 0.13, 0.59, middle], [0.026, 1.18, depth]);
    box(trim, [x - side * 0.151, 1.2, middle], [0.061, 0.073, depth]);
    box(plaster, [side * (right + doorHalfWidth) / 2, height / 2, front],
      [right - doorHalfWidth, height, 0.22], true);
    box(wood, [side * (doorHalfWidth + 0.03), 1.2, front - 0.08], [0.14, 2.4, 0.19]);
    for (const z of [-2.35, -6.3, -10.25]) {
      box(wood, [x - side * 0.15, 2.1, z], [0.085, 1.5, 2.25]);
      box(glass, [x - side * 0.197, 2.1, z], [0.021, 1.28, 2.01]);
      box(frame, [x - side * 0.218, 2.1, z], [0.034, 1.31, 0.051]);
      box(frame, [x - side * 0.218, 2.1, z], [0.034, 0.058, 2.02]);
      box(stone, [x - side * 0.19, 1.35, z], [0.25, 0.08, 2.35]);
    }
  }
  box(plaster, [0, (height + 2.4) / 2, front], [doorHalfWidth * 2, height - 2.4, 0.22], true);
  box(wood, [0, 2.43, front - 0.08], [doorHalfWidth * 2 + 0.15, 0.13, 0.19]);
  sign("exit-sign", [0, 2.72, front - 0.135], 1.14, 0.28, "EXIT", undefined, Math.PI);

  for (const z of [-1.2, -4.8, -8.4, -12]) {
    for (const x of [-4.7, 4.7]) {
      box(frame, [x, height - 0.064, z], [1.74, 0.14, 0.22]);
      box(light, [x, height - 0.14, z], [1.6, 0.039, 0.13]);
    }
  }
  for (const z of [-2.5, -7.25]) {
    box(frame, [0, height - 0.16, z], [0.052, 0.32, 0.052]);
    box(wood, [0, height - 0.32, z], [0.22, 0.16, 0.22]);
    for (let blade = 0; blade < 3; blade++) {
      const angle = blade * 2 * Math.PI / 3;
      const piece = box(wood, [Math.sin(angle) * 0.39, height - 0.34, z + Math.cos(angle) * 0.39],
        [0.13, 0.031, 0.72]);
      piece.rotation.y = angle;
    }
  }

  const counterZ = -11.48;
  box(tile, [-3.92, 0.5, counterZ], [8.18, 1, 0.96], true);
  box(wood, [-3.92, 0.105, counterZ + 0.486], [8.19, 0.21, 0.035]);
  box(stone, [-3.92, 1.03, counterZ], [8.35, 0.085, 1.05]);
  box(steel, [-3.95, 0.49, -13.75], [8.1, 0.98, 0.82], true);
  box(stone, [-3.95, 1.013, -13.75], [8.2, 0.07, 0.92]);
  box(steel, [-6.95, 1.29, counterZ], [0.56, 0.43, 0.53]);
  box(frame, [-6.95, 1.32, counterZ + 0.27], [0.44, 0.13, 0.025]);
  box(steel, [-7.62, 1.36, -13.73], [0.67, 0.64, 0.68]);
  box(frame, [-7.62, 1.43, -13.372], [0.44, 0.28, 0.036]);
  box(wood, [-3.62, 2.12, -14.02], [6.12, 0.12, 0.57]);
  for (const x of [-6.4, -5.6, -4.8, -3.9, -3.1, -2.3, -1.3]) {
    box(steel, [x, 2.34, -13.98], [0.32, 0.32, 0.31]);
    box(frame, [x, 2.516, -13.98], [0.35, 0.045, 0.33]);
  }
  box(steel, [1.48, 0.96, -13.79], [0.91, 1.92, 0.82], true);
  box(frame, [1.25, 1.16, -13.37], [0.058, 0.48, 0.077]);
  sign("chai-sign", [-3.92, 2.94, rear + 0.137], 4.45, 0.69, "CHAI COUNTER", "Tea · Samosa · Maggi");

  function cup(x: number, z: number, surfaceY: number) {
    const root = new TransformNode("cafeteria-cup", scene);
    root.position.set(x, surfaceY, z);
    const shell = CreateCylinder("cafeteria-chai-cup", {
      height: 0.1, diameterTop: 0.094, diameterBottom: 0.058, tessellation: 10,
    }, scene);
    shell.parent = root;
    shell.position.y = 0.05;
    shell.material = clay;
    shell.isPickable = false;
    const tea = CreateCylinder("cafeteria-chai", { height: 0.004, diameter: 0.081, tessellation: 10 }, scene);
    tea.parent = root;
    tea.position.y = 0.101;
    tea.material = chai;
    tea.isPickable = false;
    return root;
  }

  box(frame, [-1.27, 1.084, counterZ + 0.22], [0.61, 0.022, 0.31]);
  for (const x of [-1.47, -1.29, -1.11]) cup(x, counterZ + 0.23, 1.095);
  const actors = createCampusActors(scene);
  actors.add("cafeteria-attendant", { position: [-2.65, 0, -12.48], yaw: 0, action: "idle" }, "#b3815c");
  const seated = [
    { table: 0, side: -1, seat: -1, shirt: "#426d74" },
    { table: 0, side: 1, seat: 1, shirt: "#a86e57" },
    { table: 3, side: -1, seat: 1, shirt: "#6a7952" },
    { table: 3, side: 1, seat: -1, shirt: "#7b587a" },
  ];

  diningTables.forEach(([x, z], index) => {
    box(oak, [x, 0.754, z], [2.02, 0.089, 1.04], true);
    box(wood, [x, 0.687, z], [1.87, 0.11, 0.88]);
    for (const dx of [-0.82, 0.82]) {
      for (const dz of [-0.35, 0.35]) box(frame, [x + dx, 0.36, z + dz], [0.066, 0.72, 0.066]);
    }
    for (const side of [-1, 1]) {
      for (const seat of [-1, 1]) {
        const chairX = x + seat * 0.53;
        const chairZ = z + side * 0.88;
        const upholstery = (index + seat + side) % 2 === 0 ? teal : red;
        box(upholstery, [chairX, 0.443, chairZ], [0.48, 0.077, 0.48], true);
        box(upholstery, [chairX, 0.72, chairZ + side * 0.22], [0.46, 0.46, 0.06], true);
        for (const dx of [-0.19, 0.19]) {
          for (const dz of [-0.19, 0.19]) box(frame, [chairX + dx, 0.222, chairZ + dz], [0.035, 0.444, 0.035]);
        }
        const student = seated.find((person) => person.table === index && person.side === side && person.seat === seat);
        if (student) {
          actors.add(`cafeteria-student-${index}-${side}`, {
            position: [chairX, 0.018, chairZ - side * 0.25], yaw: side < 0 ? 0 : Math.PI, action: "sit",
          }, student.shirt);
          cup(chairX + 0.16, z + side * 0.32, 0.799);
        }
      }
    }
    if (index === 2 || index === 5) {
      box(paper, [x - 0.21, 0.806, z - 0.13], [0.29, 0.014, 0.21]);
      box(frame, [x + 0.15, 0.818, z + 0.15], [0.13, 0.035, 0.077]);
    }
  });

  actors.add("cafeteria-student-chat-a", { position: [6.98, 0, -6.06], yaw: Math.PI * 0.9, action: "talk" }, "#b89b64");
  actors.add("cafeteria-student-chat-b", { position: [7.23, 0, -7.16], yaw: -0.25, action: "idle" }, "#505f85");
  let chaiCups: readonly [TransformNode, TransformNode] | undefined;
  if (friendShirt) {
    const [x, z] = diningTables[6];
    actors.add("cafeteria-mission-friend", { position: [x - 0.53, 0.018, z - 0.63], yaw: 0, action: "sit" }, friendShirt);
    chaiCups = [cup(x - 0.5, z - 0.31, 0.799), cup(x + 0.5, z - 0.13, 0.799)];
  }
  finish();

  async function shareChai() {
    if (!chaiCups || scene.isDisposed || !scene.activeCamera) return false;
    const [friendCup, playerCup] = chaiCups;
    const previousCamera = scene.activeCamera;
    const camera = new FreeCamera("cafeteria-chai-closeup", new Vector3(2.48, 1.53, -9.18), scene);
    camera.setTarget(new Vector3(4.42, 1.02, -11.02));
    camera.fov = 0.8;
    camera.minZ = 0.035;
    scene.activeCamera = camera;
    const friendStart = friendCup.position.clone();
    const playerStart = playerCup.position.clone();
    const [head, shoulder, elbow, wrist] = ["head", "upperarm_r", "lowerarm_r", "hand_r"]
      .map((joint) => scene.getTransformNodeByName(`cafeteria-mission-friend/${joint}`));
    const friendRaised = head?.getAbsolutePosition().add(new Vector3(-0.025, -0.068, 0.198)) ?? new Vector3(4.04, 1.14, -11.26);
    const playerRaised = new Vector3(3.3, 1.15, -9.73);
    let elapsed = 0;
    const smooth = (t: number) => t * t * (3 - 2 * t);

    return new Promise<boolean>((resolve) => {
      const disposed = scene.onDisposeObservable.addOnce(() => resolve(false));
      const animation = scene.onBeforeRenderObservable.add(() => {
        elapsed += Math.min(scene.getEngine().getDeltaTime() / 1000, 0.1);
        const lift = smooth(Math.max(0, Math.min(1, (elapsed - 0.32) / 0.45, (1.68 - elapsed) / 0.53)));
        const reach = smooth(Math.max(0, Math.min(1, elapsed / 0.32, (1.9 - elapsed) / 0.22)));
        Vector3.LerpToRef(friendStart, friendRaised, lift, friendCup.position);
        Vector3.LerpToRef(playerStart, playerRaised, lift, playerCup.position);
        friendCup.rotation.x = -0.28 * lift;
        playerCup.rotation.z = 0.26 * lift;
        if (shoulder && elbow && wrist && reach > 0) reachForCup(shoulder, elbow, wrist, friendCup.position, reach);
        if (elapsed < 1.9) return;
        animation.remove();
        disposed.remove();
        scene.activeCamera = previousCamera;
        camera.dispose();
        resolve(true);
      });
    });
  }

  return {
    spawn: [0, 0, 0.72],
    extent,
    floorAt: () => 0,
    location(x, _y, z) {
      if (x >= -5.65 && x <= 2.52 && z >= -11.02 && z <= -8.4) {
        return { section: "Chai Counter", floor: 0, roomId: "cafeteria-counter" };
      }
      if (friendShirt && x > 2.52 && x <= 6.85 && z >= -12.45 && z <= -9.15) {
        return { section: "Chai Table", floor: 0, roomId: "cafeteria-chai" };
      }
      return { section: z > -0.32 ? "Cafeteria Entrance" : "Dining Hall", floor: 0 };
    },
    exitNear: (x, y, z) => Math.abs(x) < 1.32 && y < 0.4 && z > 0.9,
    shareChai: chaiCups ? shareChai : undefined,
  };
}
