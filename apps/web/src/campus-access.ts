import { VertexBuffer } from "@babylonjs/core/Buffers/buffer";
import type { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import type { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { Vector2 } from "@babylonjs/core/Maths/math.vector";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { PolygonMeshBuilder } from "@babylonjs/core/Meshes/polygonMesh";
import type { Scene } from "@babylonjs/core/scene";
import { annotationToWorld } from "@gta-mmmut/world-data";
import { campusAccess, openStage } from "@gta-mmmut/world-data/campus-access";
import earcut from "earcut";

const grade = 0.025;

export function createCampusAccess(
  scene: Scene, asphalt: PBRMaterial, concrete: PBRMaterial, shadows?: ShadowGenerator,
): void {
  for (const { id, outline } of campusAccess.roads) {
    const polygon = outline.map(annotationToWorld).map(([x, z]) => new Vector2(x, z));
    const mesh = new PolygonMeshBuilder(id, polygon, scene, earcut).build(false);
    const positions = mesh.getVerticesData(VertexBuffer.PositionKind);
    if (positions) {
      const uv = [];
      for (let index = 0; index < positions.length; index += 3) {
        uv.push(positions[index] / 5, positions[index + 2] / 5);
      }
      mesh.setVerticesData(VertexBuffer.UVKind, uv);
    }
    mesh.position.y = grade;
    mesh.material = asphalt;
    mesh.isPickable = false;
    mesh.receiveShadows = true;
  }

  const [left, top, right, bottom] = openStage.bounds;
  const [leftX, northZ] = annotationToWorld([left, top]);
  const [rightX, southZ] = annotationToWorld([right, bottom]);
  const { heightMeters, stairs } = openStage;
  const deck = CreateBox(openStage.id, { width: rightX - leftX, height: heightMeters, depth: southZ - northZ }, scene);
  deck.position.set((leftX + rightX) / 2, grade + heightMeters / 2, (northZ + southZ) / 2);
  deck.material = concrete;
  deck.checkCollisions = true;
  deck.receiveShadows = true;
  shadows?.addShadowCaster(deck);

  const [stairLeft, stairTop, stairRight, stairBottom] = stairs.bounds;
  const [stairLeftX, stairTopZ] = annotationToWorld([stairLeft, stairTop]);
  const [stairRightX, stairBottomZ] = annotationToWorld([stairRight, stairBottom]);
  const treadDepth = (stairBottomZ - stairTopZ) / stairs.risers;
  const riserHeight = heightMeters / stairs.risers;
  const stairParts: Mesh[] = [];
  for (let index = 0; index < stairs.risers; index++) {
    const height = heightMeters - riserHeight * index;
    const tread = CreateBox("stage-stair-tread", { width: stairRightX - stairLeftX, height, depth: treadDepth }, scene);
    tread.position.set((stairLeftX + stairRightX) / 2, grade + height / 2, stairTopZ + treadDepth * (index + 0.5));
    stairParts.push(tread);
  }
  const steps = Mesh.MergeMeshes(stairParts, true, true);
  if (steps) {
    steps.name = "civil-open-stage-stairs";
    steps.material = concrete;
    steps.receiveShadows = true;
    shadows?.addShadowCaster(steps);
  }

  // A continuous ramp collider lets the walking controller ascend the steps.
  const ramp = new Mesh("civil-stage-stairs-collider", scene);
  const vertices = new VertexData();
  vertices.positions = [
    stairLeftX, grade, stairBottomZ, stairRightX, grade, stairBottomZ,
    stairRightX, grade + heightMeters, stairTopZ, stairLeftX, grade + heightMeters, stairTopZ,
  ];
  vertices.indices = [0, 1, 2, 0, 2, 3, 2, 1, 0, 3, 2, 0];
  vertices.applyToMesh(ramp);
  ramp.material = concrete;
  ramp.isVisible = false;
  ramp.isPickable = false;
  ramp.checkCollisions = true;
}
