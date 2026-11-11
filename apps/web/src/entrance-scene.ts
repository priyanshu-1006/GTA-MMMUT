import { VertexBuffer } from '@babylonjs/core/Buffers/buffer';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import type { Engine } from '@babylonjs/core/Engines/engine';
import { PointerEventTypes } from '@babylonjs/core/Events/pointerEvents';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { RenderTargetTexture } from '@babylonjs/core/Materials/Textures/renderTargetTexture';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector2, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder';
import { CreateGround } from '@babylonjs/core/Meshes/Builders/groundBuilder';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { PolygonMeshBuilder } from '@babylonjs/core/Meshes/polygonMesh';
import { Scene } from '@babylonjs/core/scene';
import { annotationToWorld, southernEntrance, splitterFountainCenter } from '@gta-mmmut/world-data';
import { adminCoreBuildings } from '@gta-mmmut/world-data/admin-core';
import { campusAccess, openStage } from '@gta-mmmut/world-data/campus-access';
import { campusBoundary } from '@gta-mmmut/world-data/campus-boundary';
import { campusBuildings } from '@gta-mmmut/world-data/campus-buildings';
import { campusGardens } from '@gta-mmmut/world-data/campus-gardens';
import { campusRoads } from '@gta-mmmut/world-data/campus-roads';
import { coveredWalkways } from '@gta-mmmut/world-data/covered-walkways';
import { deoriaRoad } from '@gta-mmmut/world-data/deoria-road';
import earcut from 'earcut';
import { createCampusBuildings } from './admin-buildings';
import { createAcademicFacades } from './building-academics';
import { createCampusLandmarks } from './building-campus-landmarks';
import { createEngineeringFacades } from './building-engineering';
import { createB70Facade } from './building-b70';
import { createB71Facade } from './building-b71';
import { createB72Facade } from './building-b72';
import { createCampusGate } from './campus-gate';
import { createCampusAccess } from './campus-access';
import { createCampusBoundary } from './campus-boundary';
import { createCampusGardens } from './campus-gardens';
import { createCampusSky } from './campus-sky';
import { createCampusWalk } from './campus-walk';
import { createCampusVehicles } from './campus-vehicles';
import { createCampusPedestrians } from './campus-pedestrians';
import { createCampusTraffic, type TrafficObstacle } from './campus-traffic';
import { createCampusChant } from './campus-chant';
import { createCoveredWalkways } from './campus-walkways';
import { createDeoriaRoad } from './deoria-road';
import { createEntranceFinishing, entranceSidewalkHeight } from './entrance-finishing';
import { createEntranceFountain } from './entrance-fountain';
import type { GameSettings } from './game-settings';
import type { PlayerStatus } from './player-controls';

type Point = readonly [x: number, z: number];
export type EntranceView = 'entrance' | 'network' | 'buildings' | 'placement' | 'atal'
  | 'cse' | 'cse-complex' | 'hall' | 'library' | 'mechanical' | 'mechanical-south' | 'civil' | 'civil-two' | 'it'
  | 'itrc' | 'cafeteria' | 'takshashila' | 'open-stage' | 'fountain'
  | 'gate' | 'old-gate' | 'deoria' | 'forecourt' | 'atal-garden' | 'entrance-garden' | 'tnp-parking' | 'walkway' | 'walk';

const renderScale = { low: 1.6, balanced: 1.2, high: 1 };
const walkFogDensity = 0.00061;
const asphaltUrl = new URL('./assets/materials/worn-asphalt.webp', import.meta.url).href;
const concreteUrl = new URL('./assets/materials/concrete-wall.webp', import.meta.url).href;

function matte(scene: Scene, name: string, hex: string) {
  const material = new PBRMaterial(name, scene);
  material.albedoColor = Color3.FromHexString(hex).toLinearSpace();
  material.metallic = 0;
  material.roughness = 0.94;
  return material;
}

function addGrain(material: PBRMaterial, scene: Scene, rgb: readonly [number, number, number], variation: number) {
  const size = 128;
  const texture = new DynamicTexture(`${material.name}-grain`, size, scene, true);
  texture.wrapU = DynamicTexture.WRAP_ADDRESSMODE;
  texture.wrapV = DynamicTexture.WRAP_ADDRESSMODE;
  const context = texture.getContext();
  const image = new ImageData(size, size);
  let seed = 17;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const grain = (seed / 0xffffffff - 0.5) * variation;
      const offset = (y * size + x) * 4;
      image.data[offset] = rgb[0] + grain;
      image.data[offset + 1] = rgb[1] + grain;
      image.data[offset + 2] = rgb[2] + grain;
      image.data[offset + 3] = 255;
    }
  }

  context.putImageData(image, 0, 0);
  texture.update();
  material.albedoColor = Color3.White();
  material.albedoTexture = texture;
  return texture;
}

function pavedPolygon(
  scene: Scene,
  name: string,
  outline: readonly Point[],
  material: PBRMaterial,
  elevation: number,
  options: { hole?: readonly Point[]; depth?: number } = {},
) {
  const toVector2 = ([x, z]: Point) => new Vector2(x, z);
  const builder = new PolygonMeshBuilder(name, outline.map(toVector2), scene, earcut);
  if (options.hole) builder.addHole(options.hole.map(toVector2));

  const mesh = builder.build(false, options.depth);
  const positions = mesh.getVerticesData(VertexBuffer.PositionKind);
  if (material.albedoTexture && positions) {
    // Tile in world units so the same grain density carries across polygons.
    const uv = [];
    for (let i = 0; i < positions.length; i += 3) uv.push(positions[i] / 5, positions[i + 2] / 5);
    mesh.setVerticesData(VertexBuffer.UVKind, uv);
  }
  mesh.position.y = elevation;
  mesh.material = material;
  mesh.receiveShadows = true;
  return mesh;
}

function containsPoint(outline: readonly Point[], [x, z]: Point) {
  let inside = false;
  for (let i = 0, previous = outline.length - 1; i < outline.length; previous = i++) {
    const [ax, az] = outline[previous];
    const [bx, bz] = outline[i];
    if ((az > z) !== (bz > z) && x < ax + ((bx - ax) * (z - az)) / (bz - az)) inside = !inside;
  }
  return inside;
}

function pathSamples(points: readonly Point[], first: number, interval: number, endMargin: number) {
  const samples = [];
  const segments = points.slice(1).map(([x, z], index) => {
    const start = points[index];
    return { start, dx: x - start[0], dz: z - start[1], length: Math.hypot(x - start[0], z - start[1]) };
  });
  const limit = segments.reduce((sum, segment) => sum + segment.length, 0) - endMargin;
  let travelled = 0;
  let next = first;

  for (const { start, dx, dz, length } of segments) {
    if (length === 0) continue;
    const tx = dx / length;
    const tz = dz / length;
    for (; next <= Math.min(limit, travelled + length); next += interval) {
      const distance = next - travelled;
      samples.push({ x: start[0] + tx * distance, z: start[1] + tz * distance, tx, tz });
    }
    travelled += length;
  }
  return samples;
}

function plantPalm(scene: Scene, shadows: ShadowGenerator, trunkMaterial: PBRMaterial, leafMaterial: PBRMaterial,
  [x, z]: Point, ground: number, height: number, angle: number) {
  const trunk = CreateCylinder('palm-trunk', {
    height,
    diameterBottom: height * 0.055,
    diameterTop: height * 0.03,
    tessellation: 8,
  }, scene);
  trunk.position.set(x, ground + height / 2, z);
  trunk.material = trunkMaterial;
  trunk.checkCollisions = true;

  const crown = new Mesh('palm-crown', scene);
  const positions: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i < 12; i++) {
    const direction = angle + (i * 2 * Math.PI) / 12;
    const dx = Math.cos(direction);
    const dz = Math.sin(direction);
    const size = height * (0.29 + (i % 3) * 0.048);
    const rise = (t: number) => (0.78 - 0.11 * (i % 3)) * t - 0.99 * t * t;
    function point(length: number, width: number, droop = 0) {
      positions.push(
        size * (dx * length - dz * width), size * (rise(length) - droop), size * (dz * length + dx * width),
      );
    }
    for (let leaflet = 0; leaflet < 15; leaflet++) {
      const t = leaflet / 15;
      const width = 0.2 * Math.sin(Math.PI * (0.18 + t * 0.8));
      for (const side of [-1, 1]) {
        const start = positions.length / 3;
        point(t, 0);
        point(t + 0.095, side * width, 0.09);
        point(t + 0.057, -0.006 * side);
        indices.push(start, start + 1, start + 2);
      }
    }
  }

  const normals: number[] = [];
  VertexData.ComputeNormals(positions, indices, normals, { useRightHandedSystem: true });
  const data = new VertexData();
  data.positions = positions;
  data.indices = indices;
  data.normals = normals;
  data.applyToMesh(crown);
  crown.position.set(x, ground + height, z);
  crown.material = leafMaterial;
  shadows.addShadowCaster(trunk);
  shadows.addShadowCaster(crown);
}

function createCamera(
  scene: Scene, canvas: HTMLCanvasElement, worldPoints: readonly Point[], gate: Point, island: Point,
) {
  const entranceTarget = new Vector3((gate[0] + island[0]) / 2 - 6, 0, (gate[1] + island[1]) / 2);
  const entranceLength = Math.hypot(gate[0] - island[0], gate[1] - island[1]);
  const xs = worldPoints.map(([x]) => x);
  const zs = worldPoints.map(([, z]) => z);
  const networkTarget = new Vector3((Math.min(...xs) + Math.max(...xs)) / 2, 0, (Math.min(...zs) + Math.max(...zs)) / 2);
  const halfWidth = Math.max(...xs) - networkTarget.x;
  const halfDepth = Math.max(...zs) - networkTarget.z;
  const networkBeta = 0.43;
  function facadeFrame(id: 'B71' | 'B72', halfWidthScale: number) {
    const footprint = adminCoreBuildings.find((building) => building.id === id)!.footprint.map(annotationToWorld);
    const xs = footprint.map(([x]) => x);
    const left = Math.min(...xs);
    const right = Math.max(...xs);
    const southEdge = Math.max(...footprint.map(([, z]) => z));
    return {
      target: new Vector3((left + right) / 2, 3.8, southEdge),
      halfWidth: (right - left) * halfWidthScale,
    };
  }
  const administration = facadeFrame('B71', 0.31);
  const placement = facadeFrame('B72', 0.57);
  const atal = adminCoreBuildings.find(({ id }) => id === 'B70')!.footprint.map(annotationToWorld);
  const atalEast = Math.max(...atal.map(([x]) => x));
  const atalSouth = Math.max(...atal.map(([, z]) => z));
  const atalNorth = Math.min(...atal.map(([, z]) => z));
  const [walkStart, walkEnd] = coveredWalkways.segments[0].points.map(annotationToWorld);
  const walkDx = walkEnd[0] - walkStart[0];
  const walkDz = walkEnd[1] - walkStart[1];
  const walkLength = Math.hypot(walkDx, walkDz);
  const [oldGateX, oldGateZ] = annotationToWorld(campusBoundary.oldGate.position);
  const [atalGardenX, atalGardenZ] = annotationToWorld(campusGardens.atal.center);
  const [entranceGardenX, entranceGardenZ] = annotationToWorld(campusGardens.east.center);
  const [parkingX, parkingZ] = annotationToWorld(campusGardens.placementParking.center);
  const [, deoriaZ] = annotationToWorld([0, deoriaRoad.carriageways[0].outline[0][1] + 4]);
  const [fountainX, fountainZ] = annotationToWorld(splitterFountainCenter);
  const [stageLeft, stageTop, stageRight, stageBottom] = openStage.bounds;
  const [stageX, stageZ] = annotationToWorld([(stageLeft + stageRight) / 2, (stageTop + stageBottom) / 2]);
  const closeViews = {
    buildings: { ...administration, alpha: Math.PI / 2 + 0.14, beta: 1.55, minRadius: 7 },
    placement: { ...placement, alpha: Math.PI / 2, beta: 1.55, minRadius: 7 },
    atal: {
      target: new Vector3(atalEast - 8.5, 7.4, (atalNorth + atalSouth) / 2),
      halfWidth: (atalSouth - atalNorth) * 0.55,
      alpha: 0.09, beta: 1.54, minRadius: 10,
    },
    gate: {
      target: new Vector3(gate[0], 4.7, gate[1]),
      halfWidth: 10.8, alpha: Math.PI / 2, beta: 1.55, minRadius: 6,
    },
    'old-gate': {
      target: new Vector3(oldGateX, 1.6, oldGateZ),
      halfWidth: 6.4, alpha: 1.16, beta: 1.49, minRadius: 4,
    },
    deoria: {
      target: new Vector3(gate[0], 2.15, deoriaZ),
      halfWidth: 32, alpha: 1.74, beta: 1.14, minRadius: 19,
    },
    forecourt: {
      target: new Vector3(-1, 2.35, -18),
      halfWidth: 30, alpha: Math.PI / 2 + 0.018, beta: 1.56, minRadius: 8,
    },
    fountain: {
      target: new Vector3(fountainX, 1.4, fountainZ),
      halfWidth: 9, alpha: 1.53, beta: 1.26, minRadius: 7,
    },
    'atal-garden': {
      target: new Vector3(atalGardenX - 5, 1.4, atalGardenZ),
      halfWidth: 46, alpha: 0.23, beta: 0.87, minRadius: 22,
    },
    'entrance-garden': {
      target: new Vector3(entranceGardenX - 9, 1, entranceGardenZ),
      halfWidth: 30, alpha: 2.38, beta: 0.97, minRadius: 18,
    },
    'tnp-parking': {
      target: new Vector3(parkingX - 2.6, 1.4, parkingZ - 5),
      halfWidth: 22, alpha: 1.56, beta: 1.08, minRadius: 13,
    },
    cse: {
      target: new Vector3(-88, 4.6, -247),
      halfWidth: 19.2, alpha: -1.04, beta: 1.54, minRadius: 6,
    },
    'cse-complex': {
      target: new Vector3(-63, 3.5, -242),
      halfWidth: 44, alpha: -1.55, beta: 1.29, minRadius: 18,
    },
    hall: {
      target: new Vector3(-36, 4.6, -327),
      halfWidth: 20, alpha: 0.98, beta: 1.54, minRadius: 6,
    },
    library: {
      target: new Vector3(42, 3.25, -98),
      halfWidth: 18.5, alpha: 2.65, beta: 1.557, minRadius: 6,
    },
    mechanical: {
      target: new Vector3(121.75, 3.75, -184.8),
      halfWidth: 13.2, alpha: -1.38, beta: 1.62, minRadius: 6,
    },
    'mechanical-south': {
      target: new Vector3(124.75, 3.75, -73.6),
      halfWidth: 18.5, alpha: 1.58, beta: 1.51, minRadius: 8,
    },
    civil: {
      target: new Vector3(-74.3, 5.1, -86),
      halfWidth: 14.5, alpha: 1.74, beta: 1.55, minRadius: 6,
    },
    'civil-two': {
      target: new Vector3(-96, 3.7, -125.9),
      halfWidth: 8.25, alpha: 1.57, beta: 1.53, minRadius: 6,
    },
    'open-stage': {
      target: new Vector3(stageX + 1.6, 1.5, stageZ + 1.75),
      halfWidth: 11, alpha: 1.25, beta: 1.3, minRadius: 7,
    },
    it: {
      target: new Vector3(10, 3.7, -248.4),
      halfWidth: 17.4, alpha: -1.47, beta: 1.55, minRadius: 6,
    },
    itrc: {
      target: new Vector3(-12.2, 1.95, -202.8),
      halfWidth: 13.5, alpha: 2.33, beta: 1.586, minRadius: 7,
    },
    cafeteria: {
      target: new Vector3(-112.5, 2.4, -290.5),
      halfWidth: 26, alpha: 1.48, beta: 1.47, minRadius: 8,
    },
    takshashila: {
      target: new Vector3(180, 2, -163.75),
      halfWidth: 38, alpha: 1.1, beta: 0.62, minRadius: 14,
    },
    walkway: {
      target: new Vector3(walkStart[0] + walkDx * 10 / walkLength, 1.6, walkStart[1] + walkDz * 10 / walkLength),
      halfWidth: 0,
      alpha: Math.atan2(-walkDz, -walkDx), beta: 1.565, minRadius: 1.2,
    },
  };

  const camera = new ArcRotateCamera('entrance-orbit', 1.27, 1, entranceLength * 1.88, entranceTarget, scene);
  camera.lowerRadiusLimit = 18;
  camera.lowerBetaLimit = 0.08;
  camera.upperBetaLimit = 1.48;
  camera.wheelDeltaPercentage = 0.05;
  camera.minZ = 0.3;
  camera.maxZ = 2600;
  camera.attachControl(false);
  scene.activeCamera = camera;

  function applyView(view: Exclude<EntranceView, 'walk'>) {
    const aspect = Math.max(0.65, canvas.clientWidth / Math.max(1, canvas.clientHeight));
    const verticalTangent = Math.tan(camera.fov / 2);
    // The nearest edge projects larger than the map center in the overview.
    const networkRadius = Math.max(
      halfWidth / (verticalTangent * aspect),
      halfDepth * Math.cos(networkBeta) / verticalTangent,
    ) * 1.13 + halfDepth * Math.sin(networkBeta);
    const entranceRadius = entranceLength * 1.88 * Math.max(1, 1.05 / aspect);
    const overview = view === 'network';
    const close = view === 'entrance' || view === 'network' ? null : closeViews[view];
    camera.movement.resetRotationVelocity();
    camera.movement.resetPanVelocity();
    camera.movement.resetZoomVelocity();
    camera.setTarget((overview ? networkTarget : close?.target ?? entranceTarget).clone());
    camera.alpha = overview ? Math.PI / 2 : close?.alpha ?? 1.27;
    camera.beta = overview ? networkBeta : close?.beta ?? 1;
    camera.radius = overview ? networkRadius : close
      ? Math.max(view === 'walkway' ? 8 : 17, close.halfWidth / (verticalTangent * aspect))
      : entranceRadius;
    camera.lowerRadiusLimit = close?.minRadius ?? 18;
    camera.upperBetaLimit = close ? Math.max(1.568, close.beta) : 1.48;
    // The overview has no nearby objects, so a farther near plane keeps the
    // thin pavement and markings separate from the ground at campus scale.
    camera.minZ = overview ? networkRadius * 0.012 : 0.3;
    scene.fogDensity = overview ? 0.00018 : walkFogDensity;
    camera.upperRadiusLimit = Math.max(entranceRadius * 2.65, networkRadius * 1.35);
    canvas.dataset.cameraView = view;
  }

  applyView('entrance');
  scene.onAfterRenderObservable.add(() => {
    const current = scene.activeCamera;
    if (!(current instanceof ArcRotateCamera)) return;
    const azimuth = current.alpha.toFixed(4);
    const pitch = current.beta.toFixed(4);
    const radius = current.radius.toFixed(2);
    if (canvas.dataset.cameraAzimuth !== azimuth) canvas.dataset.cameraAzimuth = azimuth;
    if (canvas.dataset.cameraPitch !== pitch) canvas.dataset.cameraPitch = pitch;
    if (canvas.dataset.cameraRadius !== radius) canvas.dataset.cameraRadius = radius;
  });
  return { camera, applyView };
}

export function createEntranceScene(
  engine: Engine,
  canvas: HTMLCanvasElement,
  onPlayerStatus: (status: PlayerStatus) => void,
  onEnterCse: () => void,
  onSelectCse: () => void,
) {
  const scene = new Scene(engine);
  scene.useRightHandedSystem = true;
  scene.collisionsEnabled = true;
  scene.clearColor = new Color4(0.7, 0.79, 0.83, 1);
  scene.fogMode = Scene.FOGMODE_EXP2;
  scene.fogColor = new Color3(0.7, 0.79, 0.83);
  scene.fogDensity = walkFogDensity;
  const setSkyReducedMotion = createCampusSky(scene);

  const surfaces = [...southernEntrance.pavedSurfaces, ...campusRoads.pavedSurfaces, campusBoundary.oldGate.approach];
  const roadOutlines = surfaces.map(({ outline }) => outline.map(annotationToWorld));
  const accessOutlines = campusAccess.roads.map(({ outline }) => outline.map(annotationToWorld));
  const island = southernEntrance.splitterIsland.outline.map(annotationToWorld);
  const islandCenter: Point = [
    island.reduce((sum, [x]) => sum + x, 0) / island.length,
    island.reduce((sum, [, z]) => sum + z, 0) / island.length,
  ];
  const worldPoints = [
    ...roadOutlines.flat(),
    ...accessOutlines.flat(),
    ...deoriaRoad.surfaces.flatMap(({ outline }) => outline.map(annotationToWorld)),
    ...campusBuildings.flatMap(({ footprint }) => footprint.map(annotationToWorld)),
  ];
  const gate = annotationToWorld(southernEntrance.gate.position);
  const preview = createCamera(scene, canvas, worldPoints, gate, islandCenter);

  const ambient = new HemisphericLight('sky-fill', Vector3.Up(), scene);
  ambient.intensity = 0.8;
  ambient.groundColor = new Color3(0.31, 0.35, 0.24);
  const sun = new DirectionalLight('sunlight', new Vector3(-0.58, -1, -0.44).normalize(), scene);
  sun.position.set(75, 100, 90);
  sun.intensity = 2.1;
  const shadows = new ShadowGenerator(1024, sun);
  shadows.usePercentageCloserFiltering = true;
  shadows.filteringQuality = ShadowGenerator.QUALITY_MEDIUM;
  shadows.bias = 0.0005;
  shadows.normalBias = 0.02;

  const groundMaterial = matte(scene, 'grass', '#78834b');
  const grassTexture = addGrain(groundMaterial, scene, [100, 119, 75], 23);
  grassTexture.uScale = 480;
  grassTexture.vScale = 480;
  const ground = CreateGround('terrain', { width: 2400, height: 2400 }, scene);
  ground.position.y = -0.025;
  ground.material = groundMaterial;
  ground.receiveShadows = true;

  const asphalt = matte(scene, 'asphalt', '#f4f5f5');
  asphalt.albedoTexture = new Texture(asphaltUrl, scene);
  asphalt.albedoTexture.anisotropicFilteringLevel = 8;
  const pavedAccess = matte(scene, 'paved-access', '#8e9188');
  addGrain(pavedAccess, scene, [142, 145, 136], 13);
  for (const [index, outline] of roadOutlines.entries()) {
    const surface = surfaces[index];
    const material = surface.kind === 'paved-connection' ? pavedAccess : asphalt;
    const hole = containsPoint(outline, island[0]) ? island : undefined;
    pavedPolygon(scene, surface.id, outline, material, 0.025, { hole, depth: 0.06 });
  }

  const insetIsland = island.map(([x, z]): Point => [
    islandCenter[0] + (x - islandCenter[0]) * 0.9,
    islandCenter[1] + (z - islandCenter[1]) * 0.9,
  ]);
  const concrete = matte(scene, 'curb', '#ede2c8');
  concrete.albedoTexture = new Texture(concreteUrl, scene);
  const curb = pavedPolygon(scene, 'splitter-island-curb', island, concrete, 0.22, { depth: 0.22 });
  curb.checkCollisions = true;
  pavedPolygon(scene, 'splitter-island-verge', insetIsland, matte(scene, 'island-grass', '#667e41'), 0.23);

  const approach = southernEntrance.centerlines.find(({ id }) => id === 'entrance-approach')?.points.map(annotationToWorld) ?? [];
  const paint = matte(scene, 'road-paint', '#e0dcc5');
  paint.zOffset = -1;
  paint.zOffsetUnits = -2;
  const paintStrip = (name: string, width: number, height: number, [x, z]: Point, yaw: number) => {
    const marking = CreateGround(name, { width, height }, scene);
    marking.position.set(x, 0.04, z);
    marking.rotation.y = yaw;
    marking.material = paint;
    marking.receiveShadows = true;
  };
  for (const { x, z, tx, tz } of pathSamples(approach, 6, 7.5, 5)) {
    paintStrip('approach-centre-dash', 0.17, 3.3, [x, z], Math.atan2(tx, tz));
  }
  for (const { id, span } of southernEntrance.crosswalks) {
    const [[ax, az], [bx, bz]] = span.map(annotationToWorld);
    const width = Math.hypot(bx - ax, bz - az);
    const stripes = Math.max(1, Math.round(width / 1.15));
    const yaw = -Math.atan2(bz - az, bx - ax);
    for (let i = 0; i < stripes; i++) {
      const t = (i + 0.5) / stripes;
      paintStrip(`${id}-stripe`, width / stripes * 0.54, 4.1, [ax + (bx - ax) * t, az + (bz - az) * t], yaw);
    }
  }

  const trunk = matte(scene, 'palm-bark', '#82755d');
  const leaves = matte(scene, 'palm-leaves', '#4e6c3e');
  leaves.backFaceCulling = false;
  for (const [index, { x, z, tx, tz }] of pathSamples(approach, 12, 17, 12).entries()) {
    for (const side of [-1, 1]) {
      const verge: Point = [x - side * tz * 10.5, z + side * tx * 10.5];
      if ([...roadOutlines, ...accessOutlines].some((outline) => containsPoint(outline, verge))) continue;
      plantPalm(scene, shadows, trunk, leaves, verge, 0, 5.8 + (index % 3) * 0.47, index + side);
    }
  }
  const gardenPalms = [[862, 650], [878, 654], [881, 632], [918, 634], [918, 659], [932, 651]] as const;
  for (const [index, pin] of gardenPalms.entries()) {
    plantPalm(scene, shadows, trunk, leaves, annotationToWorld(pin), 0, 8.5 + (index % 3) * 0.72, index * 0.76);
  }

  createCampusGate(scene, shadows);
  createCampusBoundary(scene, shadows);
  createDeoriaRoad(scene, asphalt, pavedAccess);
  createCampusAccess(scene, asphalt, concrete, shadows);
  const sidewalks = createEntranceFinishing(scene, shadows);
  createEntranceFountain(scene, shadows);
  createCampusGardens(scene, shadows);
  createCampusBuildings(scene, shadows);
  createAcademicFacades(scene, shadows);
  createEngineeringFacades(scene, shadows);
  createCampusLandmarks(scene, shadows);
  createB70Facade(scene, shadows);
  createB71Facade(scene, shadows);
  createB72Facade(scene, shadows);
  createCoveredWalkways(scene, shadows);
  const vehicles = createCampusVehicles(scene, shadows, worldPoints);
  const cse = campusBuildings.find(({ id }) => id === 'B22')!;
  const porchNorth = Math.min(...cse.footprint.map(([, y]) => y));
  const porchEdges = cse.footprint.filter(([, y]) => y === porchNorth);
  const [entryX, entryZ] = annotationToWorld([(porchEdges[0][0] + porchEdges[1][0]) / 2, porchNorth]);
  const shadowMap = shadows.getShadowMap();
  if (shadowMap) shadowMap.refreshRate = RenderTargetTexture.REFRESHRATE_RENDER_ONCE;
  const walk = createCampusWalk(scene, canvas, gate, worldPoints, (x, z) => {
    if (sidewalks.some((outline) => containsPoint(outline, [x, z]))) return entranceSidewalkHeight;
  }, vehicles, onPlayerStatus, {
    portal: {
      contains: ([x, z]) => Math.abs(x - entryX) < 3.3 && z > entryZ - 3 && z < entryZ + 0.7,
      interact: onEnterCse,
    },
  });
  function vehicleAndPlayerObstacles() {
    const obstacles = vehicles.states().map((vehicle) => ({
      position: vehicle.position, radius: vehicle.kind === 'car' ? 1.75 : 0.75,
    }));
    const player = walk.worldPosition();
    if (player && !vehicles.active()) obstacles.push({ position: [player.x, player.z], radius: 0.55 });
    return obstacles;
  }
  const traffic = createCampusTraffic(scene);
  const people = createCampusPedestrians(scene, shadows, () => {
    const obstacles = vehicleAndPlayerObstacles();
    const car = traffic.obstacle();
    if (car) obstacles.push({ position: car.position, radius: 2.45 });
    return obstacles;
  });
  const chant = createCampusChant(people.chantCenters);
  let view: EntranceView = 'entrance';
  let paused = false;
  function setWalkPaused(value: boolean) {
    paused = value;
    walk.setPaused(value);
    people.setPaused(value);
    if (value) chant.update(null);
  }
  scene.onBeforeRenderObservable.add(() => {
    if (paused) return;
    const player = walk.worldPosition();
    const blockers: TrafficObstacle[] = [...people.blockers(), ...vehicles.states()];
    if (player && !vehicles.active()) blockers.push({ position: [player.x, player.z], radius: 0.55 });
    traffic.update(Math.min(engine.getDeltaTime() / 1000, 0.1), blockers);
    chant.update(player ? [player.x, player.z] : null);
  });
  scene.onPointerObservable.add(({ type, pickInfo }) => {
    if (type !== PointerEventTypes.POINTERPICK || view === 'walk' || paused) return;
    const name = pickInfo?.pickedMesh?.name;
    if (name === 'B22' || name === 'B22-roof-cap' || name === 'B22-nameplate') onSelectCse();
  });
  scene.onDisposeObservable.addOnce(chant.dispose);
  return {
    scene,
    suspend() {
      setWalkPaused(true);
      walk.setActive(false);
      preview.camera.detachControl();
    },
    setView(nextView: EntranceView) {
      view = nextView;
      if (view === 'walk') {
        preview.camera.detachControl();
        scene.fogDensity = walkFogDensity;
        walk.setActive(true);
        chant.start();
      } else {
        walk.setActive(false);
        scene.activeCamera = preview.camera;
        preview.camera.attachControl(false);
        preview.applyView(view);
        if (view === 'tnp-parking') vehicles.prefetchNearby(...annotationToWorld(campusGardens.placementParking.center), 'car');
      }
    },
    setWalkPaused,
    setPlayerCamera: walk.setCamera,
    setPlayerAppearance: walk.setAppearance,
    interactWithVehicle: walk.interact,
    mapPose: walk.mapPose,
    setSettings({ renderQuality, lookSensitivity, invertY, reducedMotion, fieldOfView, campusSounds }: GameSettings) {
      const scale = renderScale[renderQuality];
      if (engine.getHardwareScalingLevel() !== scale) engine.setHardwareScalingLevel(scale);
      canvas.dataset.renderQuality = renderQuality;
      walk.setReducedMotion(reducedMotion);
      setSkyReducedMotion(reducedMotion);
      people.setReducedMotion(reducedMotion);
      chant.setEnabled(campusSounds);
      if (view === 'walk') chant.start();
      walk.camera.fov = fieldOfView * Math.PI / 180;
      for (const camera of [preview.camera, walk.camera]) {
        const rotations = camera.movement.input.getEntries('pointer', 'rotate');
        for (const rotation of rotations) {
          rotation.sensitivityX = lookSensitivity / 1000;
          rotation.sensitivityY = (invertY ? -lookSensitivity : lookSensitivity) / 1000;
        }
      }
    },
  };
}
