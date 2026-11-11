import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import { CreateTorus } from "@babylonjs/core/Meshes/Builders/torusBuilder";
import { CreatePlane } from "@babylonjs/core/Meshes/Builders/planeBuilder";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { Scene } from "@babylonjs/core/scene";
import type { WorldGroundPoint } from "@gta-mmmut/world-data";
import type { BuildingDoorway, InteriorId } from "./building-interiors";

export function createBuildingDoors(scene: Scene, definitions: readonly BuildingDoorway[]) {
  function finish(name: string, hex: string, emissive = false) {
    const material = new PBRMaterial(name, scene);
    const color = Color3.FromHexString(hex).toLinearSpace();
    material.albedoColor = color;
    if (emissive) material.emissiveColor = color;
    material.roughness = 0.75;
    material.metallic = 0;
    return material;
  }
  const frame = finish("building-door-frame", "#383e3c");
  const metal = finish("building-door-handle", "#c1a46e");
  const glass = finish("building-door-glass", "#557174");
  const marker = finish("building-entry-marker", "#85edc6", true);

  const doors = definitions.map((definition) => {
    const { id, point: [x, z], outward, width, height } = definition;
    const root = new TransformNode(`building-entry-${id}`, scene);
    root.position.set(x, 0.025, z);
    root.rotation.y = Math.atan2(outward[0], outward[1]);
    const doorFinish = finish(`building-door-${id}`, definition.finish);

    function box(name: string, parent: TransformNode, material: PBRMaterial,
      w: number, h: number, d: number, bx: number, y: number, bz: number) {
      const mesh = CreateBox(name, { width: w, height: h, depth: d }, scene);
      mesh.parent = parent;
      mesh.position.set(bx, y, bz);
      mesh.material = material;
      mesh.metadata = { buildingInterior: id };
      return mesh;
    }
    box(`${id}-threshold`, root, frame, width, 0.035, 0.48, 0, 0.003, 0.07);
    box(`${id}-lintel`, root, frame, width + 0.19, 0.11, 0.16, 0, height + 0.055, -0.015);
    for (const side of [-1, 1]) {
      box(`${id}-jamb`, root, frame, 0.105, height, 0.16, side * (width + 0.095) / 2, height / 2, -0.015);
    }
    const leaves = [-1, 1].map((side) => {
      const hinge = new TransformNode(`${id}-door-hinge`, scene);
      hinge.parent = root;
      hinge.position.x = side * width / 2;
      const leafWidth = width / 2 - 0.025;
      const center = -side * leafWidth / 2;
      const leaf = box(`${id}-door-leaf`, hinge, doorFinish, leafWidth, height - 0.045, 0.075,
        center, height / 2, 0);
      leaf.checkCollisions = true;
      box(`${id}-door-glazing`, hinge, glass, leafWidth * 0.64, height * 0.35, 0.02,
        center, height * 0.7, 0.046);
      box(`${id}-door-pull`, hinge, metal, 0.095, 0.18, 0.085,
        -side * (leafWidth - 0.13), 1.195, 0.067);
      return { hinge, leaf, side };
    });

    const ring = CreateTorus(`${id}-entry-ring`, { diameter: 1.18, thickness: 0.075, tessellation: 32 }, scene);
    ring.parent = root;
    ring.position.set(0, 0.048, 1.64);
    ring.material = marker;
    ring.metadata = { buildingInterior: id };
    const pin = box(`${id}-entry-pin`, root, marker, 0.27, 0.27, 0.047, 0, height + 0.37, 0.18);
    pin.rotation.z = Math.PI / 4;
    if (id === "nalanda") {
      const plaster = finish("nalanda-gate-plaster", "#d8c8b5");
      for (const side of [-1, 1]) box("nalanda-entry-pier", root, plaster, 0.46, 3.08, 0.48,
        side * (width / 2 + 0.29), 1.54, -0.08).checkCollisions = true;
      box("nalanda-entry-canopy", root, plaster, width + 1.26, 0.17, 1.58, 0, 3.15, 0.12);
      const lettering = new DynamicTexture("nalanda-entry-lettering", { width: 1024, height: 128 }, scene, true);
      lettering.drawText("NALANDA LECTURE HALL COMPLEX", null, 82,
        "bold 46px sans-serif", "#fff7e8", "#343f50", true, true);
      const plaqueFinish = finish("nalanda-entry-plaque", "#ffffff");
      plaqueFinish.albedoTexture = lettering;
      const plaque = CreatePlane("nalanda-entry-plaque", { width: width + 0.13, height: 0.43 }, scene);
      plaque.parent = root;
      plaque.position.set(0, 2.88, 0.06);
      plaque.material = plaqueFinish;
      plaqueFinish.backFaceCulling = false;
      plaque.rotation.y = Math.PI;
      plaque.metadata = { buildingInterior: id };
    }

    return {
      definition,
      setOpen(progress: number) {
        for (const { hinge, leaf, side } of leaves) {
          if (side < 0) {
            hinge.rotation.y = Math.PI / 2 * progress;
            leaf.checkCollisions = progress === 0;
          }
        }
        ring.setEnabled(progress === 0);
        pin.setEnabled(progress === 0);
      },
    };
  });

  return {
    get(id: InteriorId) {
      return doors.find(({ definition }) => definition.id === id);
    },
    nearby([x, z]: WorldGroundPoint, y: number) {
      if (y > 0.6) return null;
      return doors.find(({ definition: { point, outward, width } }) => {
        const dx = x - point[0];
        const dz = z - point[1];
        const ahead = dx * outward[0] + dz * outward[1];
        const sideways = dx * outward[1] - dz * outward[0];
        return ahead >= 0.16 && ahead < 3.2 && Math.abs(sideways) < width / 2 + 0.65;
      })?.definition.id ?? null;
    },
  };
}
