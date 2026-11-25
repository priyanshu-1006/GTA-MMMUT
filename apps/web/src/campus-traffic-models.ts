import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import { CreateCylinder } from "@babylonjs/core/Meshes/Builders/cylinderBuilder";
import { CreateSphere } from "@babylonjs/core/Meshes/Builders/sphereBuilder";
import "@babylonjs/core/Meshes/instancedMesh";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { Scene } from "@babylonjs/core/scene";

export function createTrafficModels(scene: Scene) {
  const templates = new Map<string, Mesh>();
  const rubber = finish("tires", "#2e3030");
  const glass = finish("glass", "#586f78");
  const lamp = finish("headlights", "#dfdcaa");
  const rearLamp = finish("tail-lights", "#ae4241");

  function finish(name: string, color: string) {
    const material = new PBRMaterial("traffic-" + name, scene);
    material.albedoColor = Color3.FromHexString(color).toLinearSpace();
    material.roughness = 0.74;
    material.metallic = 0;
    return material;
  }

  function box(name: string, width: number, height: number, depth: number,
    x: number, y: number, z: number, material: PBRMaterial) {
    const mesh = CreateBox(name, { width, height, depth }, scene);
    mesh.position.set(x, y, z);
    mesh.material = material;
    return mesh;
  }

  function wheel(x: number, z: number, radius: number, width: number) {
    const mesh = CreateCylinder("traffic-wheel", { diameter: radius * 2, height: width, tessellation: 10 }, scene);
    mesh.position.set(x, radius, z);
    mesh.rotation.z = Math.PI / 2;
    mesh.material = rubber;
    return mesh;
  }

  function prototype(kind: "car" | "bike", color: string) {
    const key = kind + color;
    const cached = templates.get(key);
    if (cached) return cached;
    const paint = finish(kind + "-paint", color);
    const pieces: Mesh[] = [];
    if (kind === "car") {
      pieces.push(box("traffic-car-shell", 1.67, 0.56, 3.64, 0, 0.58, 0, paint),
        box("traffic-car-windows", 1.32, 0.46, 1.78, 0, 1.06, -0.18, glass),
        box("traffic-car-roof", 1.37, 0.09, 1.76, 0, 1.34, -0.18, paint));
      for (const side of [-1, 1]) {
        for (const z of [-1.14, 1.14]) pieces.push(wheel(side * 0.74, z, 0.31, 0.19));
        pieces.push(box("traffic-headlight", 0.31, 0.13, 0.032, side * 0.57, 0.62, 1.828, lamp),
          box("traffic-tail-light", 0.25, 0.13, 0.032, side * 0.58, 0.63, -1.828, rearLamp));
      }
    } else {
      pieces.push(wheel(0, -0.64, 0.27, 0.10), wheel(0, 0.64, 0.27, 0.10),
        box("traffic-bike-frame", 0.27, 0.31, 1.24, 0, 0.46, 0, paint),
        box("traffic-bike-seat", 0.25, 0.09, 0.62, 0, 0.68, -0.25, rubber),
        box("traffic-bike-fork", 0.14, 0.55, 0.16, 0, 0.62, 0.52, paint),
        box("traffic-bike-bars", 0.57, 0.07, 0.10, 0, 0.90, 0.48, rubber),
        box("traffic-bike-light", 0.17, 0.15, 0.11, 0, 0.81, 0.61, lamp),
        box("traffic-bike-rider", 0.39, 0.48, 0.29, 0, 1.04, -0.12, paint));
      for (const side of [-1, 1]) {
        const arm = box("traffic-bike-rider-arm", 0.10, 0.10, 0.49, side * 0.20, 0.98, 0.21, paint);
        arm.rotation.x = 0.27;
        const leg = box("traffic-bike-rider-leg", 0.11, 0.41, 0.23, side * 0.16, 0.57, -0.08, rubber);
        leg.rotation.x = -0.38;
        pieces.push(arm, leg);
      }
      const helmet = CreateSphere("traffic-bike-helmet", { diameter: 0.26, segments: 7 }, scene);
      helmet.position.set(0, 1.4, -0.045);
      helmet.material = rubber;
      pieces.push(helmet);
    }

    const mesh = Mesh.MergeMeshes(pieces, true, false, undefined, false, true);
    if (!mesh) throw new Error("Could not create traffic model");
    mesh.name = "traffic-" + kind + "-template";
    mesh.isVisible = false;
    mesh.isPickable = false;
    templates.set(key, mesh);
    return mesh;
  }

  return function createTrafficModel(kind: "car" | "bike", color: string, id: string, root: TransformNode) {
    const visual = prototype(kind, color).createInstance(id + "-visual");
    visual.parent = root;
    visual.isPickable = false;
    return visual;
  };
}
