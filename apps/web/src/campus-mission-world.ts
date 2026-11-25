import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { CreateGround } from "@babylonjs/core/Meshes/Builders/groundBuilder";
import { CreatePlane } from "@babylonjs/core/Meshes/Builders/planeBuilder";
import { CreateTorus } from "@babylonjs/core/Meshes/Builders/torusBuilder";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { Scene } from "@babylonjs/core/scene";
import { annotationToWorld, type WorldGroundPoint } from "@gta-mmmut/world-data";
import { createCampusActors, type CampusActorPose } from "./campus-actors";
import { campusMissionLocations, type CampusMissionLocationId } from "./campus-mission-locations";
import { missionFriendShirt } from "./campus-missions";

export type CampusMissionActorPose = CampusActorPose;

function standing(point: WorldGroundPoint, y: number, yaw: number): CampusActorPose {
  return { position: [point[0], y, point[1]], yaw, action: "idle" };
}

export function createCampusMissionWorld(scene: Scene) {
  const roots = new TransformNode("campus-mission-world", scene);
  const materials: PBRMaterial[] = [];
  const crowd = createCampusActors(scene);
  const friendAtGarden = standing(campusMissionLocations.gardenFriend.point, 0.035, -Math.PI / 2);
  const friend = crowd.add("mission-friend", friendAtGarden, missionFriendShirt, false);
  const faculty = crowd.add("mission-faculty-representative",
    standing(campusMissionLocations.cseHandoff.point, 0.05, Math.PI), "#d4b68e", false);
  let target: CampusMissionLocationId | null = null;
  let friendPose: CampusActorPose | null = null;
  let disposed = false;

  function material(name: string, color: string, unlit = false) {
    const finish = new PBRMaterial("mission-" + name, scene);
    finish.albedoColor = Color3.FromHexString(color).toLinearSpace();
    finish.roughness = 0.92;
    finish.metallic = 0;
    finish.unlit = unlit;
    materials.push(finish);
    return finish;
  }

  const asphalt = material("parking-asphalt", "#66685e");
  const paint = material("parking-paint", "#fff1c8");

  function slab(name: string, [x, z]: WorldGroundPoint, width: number, depth: number, y: number, finish: PBRMaterial) {
    const mesh = CreateGround(name, { width, height: depth }, scene);
    mesh.parent = roots;
    mesh.position.set(x, y, z);
    mesh.material = finish;
    mesh.isPickable = false;
    mesh.receiveShadows = true;
  }

  function parkingBay(name: string, point: WorldGroundPoint, width: number, depth: number, withAsphalt: boolean) {
    const [x, z] = point;
    if (withAsphalt) slab(name + "-surface", point, width + 0.45, depth + 0.5, 0.033, asphalt);
    const lineWidth = 0.12;
    for (const side of [-1, 1]) {
      slab(name + "-side-line", [x + side * width / 2, z], lineWidth, depth, 0.048, paint);
    }
    slab(name + "-end-line", [x, z - depth / 2], width + lineWidth, lineWidth, 0.048, paint);
  }

  parkingBay("cse-mission-car-bay", campusMissionLocations.cseParking.point, 3.4, 5.6, true);
  parkingBay("cafeteria-mission-bike-bay", campusMissionLocations.cafeteriaParking.point, 1.9, 2.9, true);
  parkingBay("garden-mission-bike-bay", campusMissionLocations.gardenBike.point, 1.35, 2.8, false);
  slab("cse-mission-bay-access", annotationToWorld([718, 179.3]), 3.85, 2.5, 0.032, asphalt);
  slab("cafeteria-mission-bike-approach", annotationToWorld([678, 170]), 2.7, 17.7, 0.032, asphalt);

  const marker = new TransformNode("campus-mission-marker", scene);
  marker.parent = roots;
  marker.setEnabled(false);
  const ring = CreateTorus("mission-waypoint-ring", { diameter: 2, thickness: 0.085, tessellation: 40 }, scene);
  ring.parent = marker;
  ring.position.y = 0.07;
  ring.material = material("marker-ring", "#edc36c", true);
  ring.isPickable = false;

  const labelTexture = new DynamicTexture("mission-waypoint-text", { width: 512, height: 96 }, scene, false);
  labelTexture.update();
  const labelFinish = material("waypoint-label", "#ffffff", true);
  labelFinish.albedoTexture = labelTexture;
  labelFinish.backFaceCulling = false;
  const label = CreatePlane("mission-waypoint-label", { width: 3.35, height: 0.63 }, scene);
  label.parent = marker;
  label.position.y = 2.45;
  label.billboardMode = Mesh.BILLBOARDMODE_ALL;
  label.material = labelFinish;
  label.isPickable = false;

  function updateFriend() {
    friend.setPose(friendPose ?? friendAtGarden);
    friend.setVisible(friendPose !== null || target === "gardenFriend");
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    roots.dispose();
    crowd.dispose();
    labelTexture.dispose();
    for (const finish of materials) finish.dispose();
  }

  scene.onDisposeObservable.addOnce(dispose);
  return {
    setTarget(next: CampusMissionLocationId | null) {
      if (next === target) return;
      target = next;
      marker.setEnabled(next !== null);
      if (next) {
        const { point: [x, z], label: title, radius } = campusMissionLocations[next];
        marker.position.set(x, 0.02, z);
        ring.scaling.set(Math.min(radius, 2), 1, Math.min(radius, 2));
        labelTexture.drawText(title, null, 61, "700 33px sans-serif", "#fff4d5", "#344239", true, true);
      }
      updateFriend();
      faculty.setVisible(next === "cseHandoff");
    },
    setFriendPose(pose: CampusMissionActorPose | null) {
      if (friendPose === null && pose === null) return;
      friendPose = pose;
      updateFriend();
    },
    dispose,
  };
}
