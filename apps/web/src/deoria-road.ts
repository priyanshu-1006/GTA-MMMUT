import { VertexBuffer } from "@babylonjs/core/Buffers/buffer";
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector2 } from "@babylonjs/core/Maths/math.vector";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import { CreateGround } from "@babylonjs/core/Meshes/Builders/groundBuilder";
import { CreatePlane } from "@babylonjs/core/Meshes/Builders/planeBuilder";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { PolygonMeshBuilder } from "@babylonjs/core/Meshes/polygonMesh";
import type { Scene } from "@babylonjs/core/scene";
import { annotationToWorld, southernEntrance, type WorldGroundPoint } from "@gta-mmmut/world-data";
import { campusBoundary } from "@gta-mmmut/world-data/campus-boundary";
import { deoriaRoad } from "@gta-mmmut/world-data/deoria-road";
import earcut from "earcut";

const roadElevation = 0.025;
const sidewalkElevation = 0.052;
const medianElevation = 0.16;

export function createDeoriaRoad(scene: Scene, asphalt: PBRMaterial, sidewalk: PBRMaterial): void {
  function material(name: string, color: string) {
    const result = new PBRMaterial(name, scene);
    result.albedoColor = Color3.FromHexString(color).toLinearSpace();
    result.metallic = 0;
    result.roughness = 0.96;
    return result;
  }

  const median = material("deoria-median-finish", "#92927a");
  const curb = material("deoria-concrete-curb", "#c0bba8");
  const paint = material("deoria-white-marking", "#efebd9");
  const signMetal = material("deoria-sign-posts", "#707878");

  function polygon(
    name: string, outline: readonly WorldGroundPoint[], elevation: number, finish: PBRMaterial, depth?: number,
  ) {
    const builder = new PolygonMeshBuilder(name, outline.map(([x, z]) => new Vector2(x, z)), scene, earcut);
    const mesh = builder.build(false, depth);
    const positions = mesh.getVerticesData(VertexBuffer.PositionKind);
    if (finish.albedoTexture && positions) {
      const uv = [];
      for (let index = 0; index < positions.length; index += 3) {
        uv.push(positions[index] / 5, positions[index + 2] / 5);
      }
      mesh.setVerticesData(VertexBuffer.UVKind, uv);
    }
    mesh.position.y = elevation;
    mesh.material = finish;
    mesh.isPickable = false;
    mesh.receiveShadows = true;
    return mesh;
  }

  function edgeCurb([startX, z]: WorldGroundPoint, [endX]: WorldGroundPoint, height: number) {
    const mesh = CreateBox("deoria-curb", { width: Math.abs(endX - startX), height, depth: 0.17 }, scene);
    mesh.position.set((startX + endX) / 2, roadElevation + height / 2, z);
    return mesh;
  }

  const curbParts: Mesh[] = [];
  const sidewalkEdge = deoriaRoad.carriageways[0].outline[0][1];
  for (const { id, kind, outline } of deoriaRoad.surfaces) {
    const worldOutline = outline.map(annotationToWorld);
    if (kind === "median") {
      polygon(id, worldOutline, medianElevation, median, medianElevation - roadElevation);
      curbParts.push(edgeCurb(worldOutline[0], worldOutline[1], 0.148));
      curbParts.push(edgeCurb(worldOutline[2], worldOutline[3], 0.148));
    } else if (kind === "sidewalk") {
      polygon(id, worldOutline, sidewalkElevation, sidewalk, sidewalkElevation - roadElevation);
      const curbEdge = outline.filter(([, y]) => y === sidewalkEdge).map(annotationToWorld);
      curbParts.push(edgeCurb(curbEdge[0], curbEdge[1], 0.066));
    } else {
      polygon(id, worldOutline, roadElevation, asphalt);
    }
  }
  const curbs = Mesh.MergeMeshes(curbParts, true, true);
  if (curbs) {
    curbs.name = "deoria-frontage-and-median-curbs";
    curbs.material = curb;
    curbs.isPickable = false;
    curbs.receiveShadows = true;
  }

  const markings: Mesh[] = [];
  const lineElevation = roadElevation + 0.011;
  function line(x: number, z: number, length: number, width: number) {
    const mesh = CreateGround("deoria-marking", { width: length, height: width }, scene);
    mesh.position.set(x, lineElevation, z);
    markings.push(mesh);
  }

  const { left, right } = deoriaRoad.annotationBounds;
  const [minX] = annotationToWorld([left, 0]);
  const [maxX] = annotationToWorld([right, 0]);
  const gateXs = [southernEntrance.gate.position, campusBoundary.oldGate.position]
    .map((point) => annotationToWorld(point)[0]);
  const arrow: readonly WorldGroundPoint[] = [
    [-1.7, -0.12], [0.22, -0.12], [0.22, -0.42], [1.65, 0],
    [0.22, 0.42], [0.22, 0.12], [-1.7, 0.12],
  ];

  for (const { direction, edgeLines, laneSeparators, laneCenters } of deoriaRoad.carriageways) {
    for (const y of edgeLines) {
      const [, z] = annotationToWorld([left, y]);
      line((minX + maxX) / 2, z, maxX - minX, 0.135);
    }
    for (const y of laneSeparators) {
      const [, z] = annotationToWorld([left, y]);
      for (let x = minX + 3; x < maxX - 1.6; x += 8.5) line(x, z, 3.2, 0.145);
    }

    const travel = direction === "eastbound" ? 1 : -1;
    for (const gateX of gateXs) {
      for (const laneY of laneCenters) {
        const [, z] = annotationToWorld([left, laneY]);
        const arrowX = gateX - travel * 25;
        const outline = arrow.map(([dx, dz]): WorldGroundPoint => [arrowX + travel * dx, z + travel * dz]);
        markings.push(polygon("deoria-lane-direction", outline, lineElevation, paint));
      }
    }
  }
  for (const { span } of deoriaRoad.sidewalkCrossings) {
    const [[startX, z], [endX]] = span.map(annotationToWorld);
    for (let x = startX + 0.45; x < endX - 0.35; x += 0.86) line(x, z, 0.39, 0.77);
  }
  const roadPaint = Mesh.MergeMeshes(markings, true, true);
  if (roadPaint) {
    roadPaint.name = "deoria-six-lane-markings";
    roadPaint.material = paint;
    roadPaint.isPickable = false;
    roadPaint.receiveShadows = true;
  }

  for (const { id, position, gate } of deoriaRoad.signs) {
    const [x, z] = annotationToWorld(position);
    const post = CreateBox(`${id}-post`, { width: 0.085, height: 2.32, depth: 0.085 }, scene);
    post.position.set(x, 1.16 + sidewalkElevation, z);
    post.material = signMetal;
    post.isPickable = false;
    const backing = CreateBox(`${id}-panel`, { width: 2.56, height: 1.1, depth: 0.075 }, scene);
    backing.position.set(x, 2.5, z);
    backing.material = signMetal;
    backing.isPickable = false;

    const texture = new DynamicTexture(`${id}-texture`, { width: 768, height: 320 }, scene, true);
    const context = texture.getContext();
    context.fillStyle = "#28594e";
    context.fillRect(0, 0, 768, 320);
    context.fillStyle = "#f3f0de";
    context.fillRect(12, 12, 744, 296);
    context.fillStyle = "#28594e";
    context.fillRect(21, 21, 726, 278);
    context.fillStyle = "#f3f0de";
    for (const { text, font, y } of [
      { text: "देवरिया रोड", font: 'bold 79px "Nirmala UI", sans-serif', y: 115 },
      { text: "DEORIA ROAD", font: 'bold 69px "Segoe UI", sans-serif', y: 201 },
      { text: `←  ${gate}`, font: 'bold 41px "Segoe UI", sans-serif', y: 268 },
    ]) {
      context.font = font;
      const textWidth = Math.min(context.measureText(text).width, 690);
      context.fillText(text, (768 - textWidth) / 2, y, 690);
    }
    texture.update();

    const lettering = material(`${id}-lettering`, "#ffffff");
    lettering.albedoTexture = texture;
    lettering.unlit = true;
    const face = CreatePlane(id, { width: 2.48, height: 1.03, sideOrientation: Mesh.DOUBLESIDE }, scene);
    face.position.set(x, 2.5, z + 0.041);
    face.material = lettering;
    face.isPickable = false;
  }
}
