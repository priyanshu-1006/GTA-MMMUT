import type { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { CreateCylinder } from "@babylonjs/core/Meshes/Builders/cylinderBuilder";
import { CreateTorus } from "@babylonjs/core/Meshes/Builders/torusBuilder";
import { CreateTube } from "@babylonjs/core/Meshes/Builders/tubeBuilder";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { Scene } from "@babylonjs/core/scene";
import { annotationToWorld, splitterFountainCenter } from "@gta-mmmut/world-data";

export function createEntranceFountain(scene: Scene, shadows: ShadowGenerator) {
  const [x, z] = annotationToWorld(splitterFountainCenter);
  function material(name: string, hex: string, roughness: number) {
    const finish = new PBRMaterial(name, scene);
    finish.albedoColor = Color3.FromHexString(hex).toLinearSpace();
    finish.metallic = 0;
    finish.roughness = roughness;
    return finish;
  }
  const stone = material("fountain-warm-concrete", "#c5b697", 0.86);
  const base = material("fountain-basin-tile", "#426d76", 0.67);
  const water = material("fountain-water", "#328aab", 0.23);
  const streams = material("fountain-jet-water", "#c4e9ef", 0.25);
  function disk(name: string, diameter: number, height: number, y: number, finish: PBRMaterial) {
    const mesh = CreateCylinder(name, { diameter, height, tessellation: 48 }, scene);
    mesh.position.set(x, y, z);
    mesh.material = finish;
    mesh.receiveShadows = true;
    return mesh;
  }
  const foundation = disk("fountain-plinth", 7.35, 0.16, 0.31, stone);
  const basin = disk("fountain-basin", 7, 0.54, 0.64, base);
  basin.checkCollisions = true;
  const coping = CreateTorus("fountain-stone-coping", { diameter: 6.79, thickness: 0.32, tessellation: 56 }, scene);
  coping.position.set(x, 0.91, z);
  coping.material = stone;
  coping.receiveShadows = true;
  for (const mesh of [foundation, basin, coping]) shadows.addShadowCaster(mesh);
  disk("fountain-water-surface", 6.5, 0.012, 0.919, water);
  disk("fountain-centre-nozzle", 0.52, 0.25, 1.0, stone);

  const jets: Mesh[] = [];
  for (let index = 0; index < 9; index++) {
    const angle = index * 2 * Math.PI / 9;
    const path = Array.from({ length: 17 }, (_, sample) => {
      const t = sample / 16;
      const distance = 0.22 + 2.56 * t;
      return new Vector3(x + Math.cos(angle) * distance, 0.934 + 1.52 * 4 * t * (1 - t),
        z + Math.sin(angle) * distance);
    });
    jets.push(CreateTube("fountain-water-arc", { path, radius: 0.029, tessellation: 5 }, scene));
  }
  jets.push(CreateCylinder("fountain-centre-jet", { diameterTop: 0.038, diameterBottom: 0.073, height: 2.16 }, scene));
  jets[jets.length - 1].position.set(x, 2.1, z);
  const flow = Mesh.MergeMeshes(jets, true, true);
  if (flow) {
    flow.name = "fountain-jets";
    flow.material = streams;
    flow.isPickable = false;
  }
}
