import { memo, useEffect, useId, useRef, useState, type Ref } from "react";
import type { Engine } from "@babylonjs/core/Engines/engine";
import type { Scene } from "@babylonjs/core/scene";
import { southernEntrance, splitterFountainCenter, type AnnotationPoint } from "@gta-mmmut/world-data";
import { adminCoreBuildings } from "@gta-mmmut/world-data/admin-core";
import { campusAccess, openStage } from "@gta-mmmut/world-data/campus-access";
import { campusBoundary } from "@gta-mmmut/world-data/campus-boundary";
import { campusBuildings } from "@gta-mmmut/world-data/campus-buildings";
import { campusGardens } from "@gta-mmmut/world-data/campus-gardens";
import { campusRoads } from "@gta-mmmut/world-data/campus-roads";
import { coveredWalkways } from "@gta-mmmut/world-data/covered-walkways";
import { deoriaRoad } from "@gta-mmmut/world-data/deoria-road";
import { campusRegistry } from "@gta-mmmut/world-data/registry";
import type { createEntranceScene, EntranceView } from "./entrance-scene";
import type { createBuildingInteriorScene, InteriorLocation } from "./building-interior-scene";
import { buildingInteriors, interiorForView, type InteriorId } from "./building-interiors";
import type { CseRoom } from "./cse-interior-layout";
import { GameSettingsPanel, loadGameSettings, saveGameSettings, type GameSettings } from "./game-settings";
import { loadPlayerAppearance, savePlayerAppearance, type PlayerAppearance } from "./player-appearance";
import { playerCameras, type PlayerCamera, type PlayerStatus } from "./player-controls";
import { PlayerWardrobe } from "./player-wardrobe";
import type { createWardrobePreview } from "./wardrobe-preview";

const points = (outline: readonly AnnotationPoint[]) =>
  outline.map(([x, y]) => `${x},${y}`).join(" ");

const pavedSurfaces = [...southernEntrance.pavedSurfaces, ...campusRoads.pavedSurfaces, campusBoundary.oldGate.approach];
const deoriaColors = { road: "#5c7770", apron: "#5c7770", sidewalk: "#ab9b83", median: "#9b9679" };
const gardenPlots = [...campusGardens.atal.quarters, ...campusGardens.east.lawns];
const centerlines = [...southernEntrance.centerlines, ...campusRoads.centerlines];
const confirmedBuildings = campusRegistry.filter(({ status }) => status === "CONFIRMED").length;

const EntranceMap = memo(function EntranceMap({ playerPoint = null, markerRef }: {
  playerPoint?: AnnotationPoint | null;
  markerRef?: Ref<SVGGElement>;
}) {
  const gridId = useId();
  const { splitterIsland, gate, connections } = southernEntrance;
  const [gateX, gateY] = gate.position;
  const [oldGateX, oldGateY] = campusBoundary.oldGate.position;
  const { lot: [parkingLeft, parkingTop, parkingRight, parkingBottom], center: [parkingX] } = campusGardens.placementParking;
  const mapPoints = [
    ...pavedSurfaces.flatMap(({ outline }) => outline),
    ...campusAccess.roads.flatMap(({ outline }) => outline),
    ...deoriaRoad.surfaces.flatMap(({ outline }) => outline),
    ...campusBuildings.flatMap(({ footprint }) => footprint),
    ...campusBoundary.wallRuns.flatMap<AnnotationPoint>(({ points }) => points),
    ...(playerPoint ? [playerPoint] : []),
  ];
  const xs = mapPoints.map(([x]) => x);
  const ys = mapPoints.map(([, y]) => y);
  const left = Math.min(...xs) - 74;
  const top = Math.min(...ys) - 40;
  const width = Math.max(...xs) - left + 74;
  const height = Math.max(...ys) - top + 35;

  return (
    <svg
      className={markerRef ? "campus-minimap" : "entrance-map"}
      role="img"
      aria-label={markerRef ? "Live campus minimap" : "Campus reference map"}
      aria-description="Campus roads, Deoria Road, building footprints, gardens, parking, and the provisional covered walkway alignment."
      viewBox={`${left} ${top} ${width} ${height}`}
    >
      <defs>
        <pattern id={gridId} width="24" height="24" patternUnits="userSpaceOnUse">
          <path d="M 24 0 H 0 V 24" fill="none" stroke="#567268" strokeWidth="0.6" />
        </pattern>
      </defs>
      <rect x={left} y={top} width={width} height={height} fill={`url(#${gridId})`} />
      {deoriaRoad.surfaces.map(({ id, kind, outline }) => (
        <polygon key={id} data-deoria-surface={kind} points={points(outline)} fill={deoriaColors[kind]} />
      ))}
      {deoriaRoad.carriageways.flatMap(({ id, laneSeparators }) => laneSeparators.map((y) => (
        <line key={`${id}-${y}`} x1={deoriaRoad.annotationBounds.left} x2={deoriaRoad.annotationBounds.right}
          y1={y} y2={y} stroke="#f0e7cd" strokeWidth="0.9" strokeDasharray="6 6" />
      )))}
      <text x={1078} y={deoriaRoad.annotationBounds.bottom + 19}>{deoriaRoad.label}</text>
      {gardenPlots.map(([x, y, right, bottom]) => (
        <rect key={`${x}-${y}`} data-garden-plot="true" x={x} y={y} width={right - x} height={bottom - y}
          fill="#4c7652" stroke="#a5be80" strokeWidth="1" />
      ))}
      <polygon points={points(campusGardens.placementParking.driveway)} fill="#8e836b" />
      <g className="connection-label">
        <rect data-tnp-parking="true" x={parkingLeft} y={parkingTop} width={parkingRight - parkingLeft}
          height={parkingBottom - parkingTop} fill="#5c7770" stroke="#b6c7bc" />
        <text x={parkingX} y={parkingBottom - 4} textAnchor="middle">TNP parking</text>
      </g>
      {pavedSurfaces.map(({ id, kind, outline }) => (
        <polygon
          key={id}
          points={points(outline)}
          fill={kind === "paved-connection" ? "#8e836b" : "#5c7770"}
          stroke="#b6c7bc"
          strokeWidth="2"
        />
      ))}
      {campusAccess.roads.map(({ id, label, outline, centerline }) => (
        <g key={id} data-campus-access={id}>
          <title>{label}</title>
          <polygon points={points(outline)} fill="#5c7770" stroke="#b6c7bc" strokeWidth="1.4" />
          <polyline points={points(centerline)} fill="none" stroke="#f0e7cd" strokeDasharray="4 4" strokeWidth="1" />
        </g>
      ))}
      <g className="connection-label">
        <polygon data-open-stage={openStage.id} points={points(openStage.footprint)} fill="#b9a98c" stroke="#e1d2b7" />
        <text x={openStage.bounds[0] - 6} y={openStage.bounds[1] - 5}>{openStage.label}</text>
      </g>
      <polygon points={points(splitterIsland.outline)} fill="#19392c" stroke="#e8bd70" strokeWidth="2" />
      <circle data-entrance-fountain="true" cx={splitterFountainCenter[0]} cy={splitterFountainCenter[1]} r="6"
        fill="#79c4cd" stroke="#e4d9b8" strokeWidth="1.2"><title>Entrance fountain</title></circle>
      {centerlines.map(({ id, points: trace }) => (
        <polyline
          key={id}
          points={points(trace)}
          fill="none"
          stroke="#f0e7cd"
          strokeDasharray="5 5"
          strokeWidth="1.5"
        />
      ))}
      <polyline points={points(gate.span)} stroke="#e8bd70" strokeWidth="4" />
      <circle cx={gateX} cy={gateY} r="5" fill="#e8bd70" />
      <text x={gateX + 25} y={gateY + 6}>Main gate</text>
      {campusBoundary.wallRuns.map(({ id, points: wall }) => (
        <polyline key={id} data-boundary-wall={id} points={points(wall)} fill="none" stroke="#ccb594" strokeWidth="3.2" />
      ))}
      <polyline points={points(campusBoundary.oldGate.span)} stroke="#e8bd70" strokeWidth="3.6" />
      <circle cx={oldGateX} cy={oldGateY} r="4.5" fill="#e8bd70" />
      <text x={oldGateX + 16} y={oldGateY + 17}>Old gate</text>
      {connections.map(({ id, label, point: [x, y] }) => (
        <g key={id} className="connection-label">
          <circle cx={x} cy={y} r="4" fill="#f0e7cd" stroke="#19392c" strokeWidth="1.5" />
          <text x={x} y={y - 12} textAnchor="middle">{label}</text>
        </g>
      ))}
      {campusBuildings.map(({ id, name, footprint, holes = [] }) => (
        <path
          key={id}
          data-building-id={id}
          d={[footprint, ...holes].map((outline) => `M${points(outline)} Z`).join(" ")}
          fill="#5e6b7c"
          fillRule="evenodd"
          stroke="#b6c5d7"
          strokeWidth="1.5"
        >
          <title>{name}</title>
        </path>
      ))}
      <polygon points={points(campusAccess.cseLink)} fill="#5e6b7c" stroke="#b6c5d7" strokeWidth="1.5" >
        <title>Covered link between New and Old CSE</title>
      </polygon>
      <g className="connection-label">
        <path d={`M${points(campusAccess.mechanicalEntrance.outline)} Z M${points(campusAccess.mechanicalEntrance.link)} Z`}
          fill="#5e6b7c" stroke="#b6c5d7" strokeWidth="1.5" />
        <text x={campusAccess.mechanicalEntrance.position[0]} y={campusAccess.mechanicalEntrance.position[1] + 16}
          textAnchor="middle">Mechanical south entry</text>
      </g>
      {adminCoreBuildings.map(({ id, name, anchor: [x], footprint }) => (
        <g key={id} className="connection-label">
          <text x={x} y={Math.min(...footprint.map(([, y]) => y)) - (id === "B71" ? 24 : 8)} textAnchor="middle">
            {name}
          </text>
        </g>
      ))}
      {coveredWalkways.segments.map(({ id, points: trace }) => (
        <polyline
          key={id}
          data-covered-walkway={id}
          points={points(trace)}
          fill="none"
          stroke="#f1c675"
          strokeWidth={coveredWalkways.widthPixels}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
      {coveredWalkways.destinations.map(({ id, label, point: [x, y] }) => (
        <g key={id} className="connection-label">
          <circle cx={x} cy={y} r="5.5" fill="#f1c675" stroke="#352819" strokeWidth="2">
            <title>{label}</title>
          </circle>
          {id !== "administration" && (
            <text x={x + 10} y={y - 8}>{id === "pushpagiri" ? "Pushpagiri" : label}</text>
          )}
        </g>
      ))}
      {playerPoint && (
        <g className="connection-label">
          <circle cx={playerPoint[0]} cy={playerPoint[1]} r="6" fill="#96dfd7" stroke="#19392c" strokeWidth="2" />
          <text x={playerPoint[0] + 10} y={playerPoint[1] - 8}>You</text>
        </g>
      )}
      {markerRef && (
        <g ref={markerRef} data-minimap-marker="" visibility="hidden">
          <circle r="23" fill="#172b25" stroke="#edfff4" strokeWidth="3" />
          <path d="M0 -27 16 15 0 8 -16 15Z" fill="#99f3d9" stroke="#142922" strokeWidth="3" strokeLinejoin="round" />
        </g>
      )}
    </svg>
  );
});

type PreviewState = "loading" | "ready" | "unavailable";
const cameraLabels: Record<EntranceView, string> = {
  entrance: "ENTRANCE VIEW",
  network: "CAMPUS OVERVIEW",
  buildings: "BUILDING VIEW",
  placement: "BUILDING VIEW",
  atal: "ATAL BHAWAN",
  cse: "CSE DEPARTMENT",
  "cse-complex": "CSE COMPLEX",
  hall: "MULTIPURPOSE HALL",
  library: "CENTRAL LIBRARY",
  mechanical: "MECHANICAL ENGINEERING",
  "mechanical-south": "MECHANICAL ENGINEERING · SOUTH ENTRY",
  civil: "CIVIL ENGINEERING BLOCK I",
  "civil-two": "CIVIL ENGINEERING BLOCK II",
  "open-stage": "OPEN STAGE",
  it: "INFORMATION TECHNOLOGY",
  itrc: "I.T. RESOURCE CENTER",
  cafeteria: "UNIVERSITY CAFETERIA",
  takshashila: "TAKSHASHILA COURTYARD",
  "takshashila-entry": "TAKSHASHILA ENTRANCE",
  pushpagiri: "PUSHPAGIRI ENTRANCE",
  ece: "ELECTRONICS & COMMUNICATION ENGINEERING",
  electrical: "ELECTRICAL ENGINEERING",
  nalanda: "NALANDA LECTURE HALL COMPLEX",
  gate: "MAIN GATE",
  "old-gate": "OLD GATE",
  deoria: "DEORIA ROAD",
  forecourt: "ENTRANCE FORECOURT",
  fountain: "ENTRANCE FOUNTAIN",
  "atal-garden": "ATAL BHAWAN GARDEN",
  "entrance-garden": "ENTRANCE GARDEN",
  "tnp-parking": "TRAINING AND PLACEMENT PARKING",
  walkway: "COVERED WALKWAY",
  walk: "CAMPUS WALK",
};

const buildingViews = [
  { view: "buildings", label: "B71 Administration" },
  { view: "atal", label: "B70 Atal Bhawan" },
  { view: "placement", label: "B72 Training and Placement" },
  { view: "cse", label: "B22 CSE Department" },
  { view: "cse-complex", label: "B22–B23 CSE Complex" },
  { view: "hall", label: "B16–B17 Multipurpose Hall" },
  { view: "library", label: "B75 Central Library" },
  { view: "mechanical", label: "B48 Mechanical Engineering" },
  { view: "mechanical-south", label: "Mechanical south entry by TNP" },
  { view: "civil", label: "B73–B74 Civil Engineering Block I" },
  { view: "civil-two", label: "B28–B29 Civil Engineering Block II" },
  { view: "open-stage", label: "Open stage by Civil" },
  { view: "it", label: "IT Department (B24 north)" },
  { view: "itrc", label: "I.T. Resource Center (B24 south)" },
  { view: "cafeteria", label: "B21 University Cafeteria" },
  { view: "nalanda", label: "B33–B35 Nalanda Lecture Hall Complex" },
  { view: "pushpagiri", label: "B45 Pushpagiri entrance" },
  { view: "takshashila-entry", label: "B47 Takshashila entrance" },
  { view: "takshashila", label: "B47 Takshashila courtyard" },
  { view: "ece", label: "B46 Electronics & Communication Engineering" },
  { view: "electrical", label: "B32 Electrical Engineering" },
] as const;

const entranceDetails = [
  { view: "gate", label: "Main gate" },
  { view: "old-gate", label: "Old gate" },
  { view: "deoria", label: "Deoria Road" },
  { view: "forecourt", label: "Entrance forecourt" },
  { view: "fountain", label: "Entrance fountain" },
  { view: "atal-garden", label: "Atal Bhawan garden" },
  { view: "entrance-garden", label: "Entrance garden" },
  { view: "tnp-parking", label: "TNP parking" },
] as const;

function WardrobeCharacterPreview({ appearance }: { appearance: PlayerAppearance }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const preview = useRef<ReturnType<typeof createWardrobePreview> | null>(null);
  const selection = useRef(appearance);
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => {
    selection.current = appearance;
    preview.current?.setAppearance(appearance);
  }, [appearance]);
  useEffect(() => {
    let disposed = false;
    function reportFailure() {
      if (disposed) return;
      preview.current?.dispose();
      preview.current = null;
      setUnavailable(true);
    }
    void import("./wardrobe-preview").then(({ createWardrobePreview }) => {
      if (disposed || !canvas.current) return;
      preview.current = createWardrobePreview(canvas.current, reportFailure);
      preview.current.setAppearance(selection.current);
    }).catch(reportFailure);
    return () => {
      disposed = true;
      preview.current?.dispose();
      preview.current = null;
    };
  }, []);
  return unavailable ? <p>3D outfit preview unavailable.</p>
    : <canvas ref={canvas} tabIndex={0} aria-label="Rotatable 3D outfit preview" />;
}

function CseDirectory({ rooms }: { rooms: readonly CseRoom[] }) {
  return (
    <nav className="cse-directory" aria-label="CSE room directory">
      {([0, 1] as const).map((floor) => (
        <details key={floor}>
          <summary>{floor === 0 ? "Ground floor" : "First floor"} directory</summary>
          {(["new", "old"] as const).map((wing) => (
            <section key={wing}>
              <h2>{wing === "new" ? "New CSE" : "Old CSE"}</h2>
              <ul>
                {rooms.filter((room) => room.wing === wing && room.floor === floor).map((room) => (
                  <li key={room.id}><span>{room.label}</span>{room.subtitle && <small>{room.subtitle}</small>}</li>
                ))}
              </ul>
            </section>
          ))}
        </details>
      ))}
    </nav>
  );
}

const initialPlayerStatus: PlayerStatus = {
  camera: "follow", vehicle: null, vehicleKind: null, nearby: null, portalNearby: null, speed: 0,
};

export function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mapMarkerRef = useRef<SVGGElement>(null);
  const sessionRef = useRef<ReturnType<typeof createEntranceScene> | null>(null);
  const engineRef = useRef<Engine | null>(null);
  const interiorRef = useRef<Awaited<ReturnType<typeof createBuildingInteriorScene>> | null>(null);
  const interiorLoadingRef = useRef(false);
  const enterBuildingRef = useRef<(id: InteriorId) => void>(() => {});
  const exitBuildingRef = useRef<() => void>(() => {});
  const [state, setState] = useState<PreviewState>("loading");
  const [mapOpen, setMapOpen] = useState(false);
  const [cameraView, setCameraView] = useState<EntranceView>("entrance");
  const [mapPlayerPoint, setMapPlayerPoint] = useState<AnnotationPoint | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState(loadGameSettings);
  const settingsRef = useRef(settings);
  const [appearance, setAppearance] = useState(loadPlayerAppearance);
  const appearanceRef = useRef(appearance);
  const [wardrobeOpen, setWardrobeOpen] = useState(false);
  const wardrobeRef = useRef(false);
  const [playerStatus, setPlayerStatus] = useState(initialPlayerStatus);
  const [interiorPlayerStatus, setInteriorPlayerStatus] = useState<PlayerStatus>({ ...initialPlayerStatus, camera: "first" });
  const [interiorLocation, setInteriorLocation] = useState<InteriorLocation>();
  const [insideBuilding, setInsideBuilding] = useState<InteriorId | null>(null);
  const [loadingInterior, setLoadingInterior] = useState<InteriorId | null>(null);
  const [interiorError, setInteriorError] = useState(false);
  const showMap = mapOpen || state === "unavailable";
  const overviewActive = !showMap && cameraView === "network";
  const buildingsActive = !showMap && buildingViews.some(({ view }) => view === cameraView);
  const gateActive = !showMap && entranceDetails.some(({ view }) => view === cameraView);
  const walking = cameraView === "walk";
  const showMinimap = walking && !insideBuilding && !showMap && state === "ready";
  const nearbyBuilding = walking && playerStatus.portalNearby !== "exit" ? playerStatus.portalNearby : null;
  const entryTarget = loadingInterior ?? (!showMap ? nearbyBuilding ?? interiorForView(cameraView) : null);
  const currentInterior = insideBuilding ? buildingInteriors[insideBuilding] : null;

  function changeView(view: EntranceView) {
    if (interiorLoadingRef.current) return;
    sessionRef.current?.setWalkPaused(false);
    sessionRef.current?.setView(view);
    setCameraView(view);
    setMapOpen(false);
  }

  async function enterBuilding(id: InteriorId) {
    const renderer = engineRef.current;
    const outdoor = sessionRef.current;
    const canvas = canvasRef.current;
    if (!renderer || !outdoor || !canvas || interiorRef.current || interiorLoadingRef.current || playerStatus.vehicle || showMap) return;
    interiorLoadingRef.current = true;
    setLoadingInterior(id);
    setInteriorError(false);
    outdoor.setWalkPaused(true);
    let interior: Awaited<ReturnType<typeof createBuildingInteriorScene>> | undefined;
    try {
      const { createBuildingInteriorScene } = await import("./building-interior-scene");
      if (engineRef.current !== renderer) return;
      interior = await createBuildingInteriorScene(id, renderer, canvas, setInteriorPlayerStatus, setInteriorLocation,
        () => exitBuildingRef.current());
      if (engineRef.current !== renderer) {
        interior.scene.dispose();
        return;
      }
      const crossed = await outdoor.playBuildingEntry(id);
      if (engineRef.current !== renderer) {
        interior.scene.dispose();
        return;
      }
      if (!crossed) throw new Error("The building doorway was unavailable.");
      interiorRef.current = interior;
      interior.setSettings(settingsRef.current);
      interior.setAppearance(appearanceRef.current);
      outdoor.suspend();
      interior.activate();
      setInsideBuilding(id);
    } catch (error) {
      interior?.scene.dispose();
      if (engineRef.current !== renderer) return;
      console.error("Unable to open the building interior.", error);
      interiorRef.current = null;
      outdoor.setView(cameraView);
      outdoor.setWalkPaused(false);
      setInteriorError(true);
    } finally {
      interiorLoadingRef.current = false;
      if (engineRef.current === renderer) setLoadingInterior(null);
    }
  }

  function exitBuilding() {
    const interior = interiorRef.current;
    if (!interior) return;
    interiorRef.current = null;
    interior.scene.dispose();
    sessionRef.current?.setView(cameraView);
    sessionRef.current?.setWalkPaused(false);
    setInsideBuilding(null);
    setInteriorLocation(undefined);
  }

  function setPlayPaused(value: boolean) {
    if (interiorRef.current) interiorRef.current.setPaused(value);
    else sessionRef.current?.setWalkPaused(value);
  }

  function toggleMap() {
    if (interiorLoadingRef.current) return;
    if (!mapOpen) setMapPlayerPoint(sessionRef.current?.mapPose()?.point ?? null);
    sessionRef.current?.setWalkPaused(!mapOpen);
    setMapOpen(!mapOpen);
  }

  function toggleSettings(open: boolean) {
    setPlayPaused(open || mapOpen || wardrobeOpen);
    setSettingsOpen(open);
  }

  function toggleWardrobe(open: boolean) {
    wardrobeRef.current = open;
    setPlayPaused(open || mapOpen || settingsOpen);
    setWardrobeOpen(open);
  }

  function updateAppearance(value: PlayerAppearance) {
    appearanceRef.current = value;
    setAppearance(value);
    savePlayerAppearance(value);
    sessionRef.current?.setPlayerAppearance(value);
    interiorRef.current?.setAppearance(value);
  }

  function updateSettings(value: GameSettings) {
    settingsRef.current = value;
    setSettings(value);
    saveGameSettings(value);
    sessionRef.current?.setSettings(value);
    interiorRef.current?.setSettings(value);
  }

  useEffect(() => {
    enterBuildingRef.current = (id) => { void enterBuilding(id); };
    exitBuildingRef.current = exitBuilding;
  });

  useEffect(() => {
    if ((walking || insideBuilding) && !showMap && !settingsOpen && !wardrobeOpen) canvasRef.current?.focus({ preventScroll: true });
  }, [walking, insideBuilding, showMap, settingsOpen, wardrobeOpen]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let disposed = false;
    let engine: Engine | undefined;
    let scene: Scene | undefined;
    let resizeObserver: ResizeObserver | undefined;

    async function start(target: HTMLCanvasElement) {
      try {
        const [{ Engine }, { createEntranceScene }] = await Promise.all([
          import("@babylonjs/core/Engines/engine"),
          import("./entrance-scene"),
        ]);
        if (disposed) return;

        const renderer = new Engine(target, true, undefined, true);
        engine = renderer;
        engineRef.current = renderer;
        const session = createEntranceScene(renderer, target, setPlayerStatus,
          (id) => enterBuildingRef.current(id), (id) => changeView(buildingInteriors[id].view));
        const entrance = session.scene;
        scene = entrance;
        sessionRef.current = session;
        session.setSettings(settingsRef.current);
        session.setPlayerAppearance(appearanceRef.current);
        resizeObserver = new ResizeObserver(() => renderer.resize());
        resizeObserver.observe(target);
        entrance.executeWhenReady(() => {
          if (disposed) return;
          renderer.runRenderLoop(() => {
            try {
              if (wardrobeRef.current) return;
              if (interiorRef.current) {
                interiorRef.current.scene.render();
                return;
              }
              entrance.render();
              const marker = mapMarkerRef.current;
              const pose = marker && session.mapPose();
              if (marker && pose) {
                const [x, y] = pose.point;
                const transform = `translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${pose.heading.toFixed(1)})`;
                if (marker.getAttribute("transform") !== transform) {
                  marker.setAttribute("transform", transform);
                  marker.removeAttribute("visibility");
                }
              }
            } catch (error) {
              if (interiorRef.current) {
                console.error("Unable to render the building interior.", error);
                exitBuildingRef.current();
                setInteriorError(true);
                return;
              }
              renderer.stopRenderLoop();
              reportFailure(error);
            }
          });
          entrance.onAfterRenderObservable.addOnce(() => setState("ready"));
        });
      } catch (error) {
        if (!disposed) reportFailure(error);
      }
    }

    function reportFailure(error: unknown) {
      console.error("Unable to render the entrance preview.", error);
      setState("unavailable");
    }

    void start(canvas);
    return () => {
      disposed = true;
      engineRef.current = null;
      sessionRef.current = null;
      resizeObserver?.disconnect();
      engine?.stopRenderLoop();
      interiorRef.current?.scene.dispose();
      interiorRef.current = null;
      scene?.dispose();
      engine?.dispose();
    };
  }, []);

  return (
    <main className="shell">
      <header className="site-header">
        <div className="wordmark">GTA <span>MMMUT</span></div>
        <div className="header-actions">
          <div className="header-label">CAMPUS PREVIEW <span> / </span> 10</div>
          <button type="button" className="view-toggle settings-toggle" disabled={state !== "ready" || Boolean(loadingInterior)}
            onClick={() => toggleWardrobe(true)}>Wardrobe</button>
          <button type="button" className="view-toggle settings-toggle" disabled={Boolean(loadingInterior)} onClick={() => toggleSettings(true)}>
            Settings
          </button>
        </div>
      </header>
      <div className="workspace">
        {currentInterior ? (
          <section className="panel">
            <h1>{currentInterior.title}</h1>
            {interiorLocation && <p>{interiorLocation.section}{interiorLocation.floor !== undefined &&
              (interiorLocation.floor === 1 ? " · First floor" : " · Ground floor")}</p>}
            {interiorLocation?.room && <p className="cse-current-room">{interiorLocation.room}</p>}
            <div className="view-options">
              <button className="view-toggle walk-toggle" type="button" onClick={exitBuilding}>
                Exit to campus {interiorPlayerStatus.portalNearby && <kbd>E</kbd>}
              </button>
            </div>
            <select className="detail-picker" aria-label="Interior camera" value={interiorPlayerStatus.camera}
              onChange={(event) => {
                interiorRef.current?.setCamera(event.currentTarget.value as PlayerCamera);
                canvasRef.current?.focus({ preventScroll: true });
              }}>
              {Object.entries(playerCameras).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </select>
            <p className="cse-directions">{currentInterior.directions}</p>
            {interiorRef.current?.rooms && <CseDirectory rooms={interiorRef.current.rooms} />}
          </section>
        ) : (
        <section className="panel">
          <div className="eyebrow"><span className="index">10</span> CAMPUS PLAY</div>
          <h1>Explore campus</h1>
          <p>Enter through the main gate, follow the covered paths, and inspect the campus façades.</p>
          <div className="view-options" role="group" aria-label="Preview views">
            <button
              type="button"
              className="view-toggle walk-toggle"
              disabled={state !== "ready"}
              onClick={() => changeView(walking ? "entrance" : "walk")}
            >
              {walking ? "Exit walk" : "Walk campus"}
            </button>
            <button
              type="button"
              className="view-toggle"
              aria-pressed={overviewActive}
              disabled={state !== "ready"}
              onClick={() => changeView(overviewActive ? "entrance" : "network")}
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M3 9V3h6m6 0h6v6m0 6v6h-6m-6 0H3v-6m3-3h12" />
              </svg>
              Campus overview
            </button>
            <button
              type="button"
              className="view-toggle"
              aria-pressed={buildingsActive}
              disabled={state !== "ready"}
              onClick={() => changeView(buildingsActive ? "entrance" : "buildings")}
            >
              Building view
            </button>
            <button
              type="button"
              className="view-toggle"
              aria-pressed={gateActive}
              disabled={state !== "ready"}
              onClick={() => changeView(gateActive ? "entrance" : "gate")}
            >
              Main gate
            </button>
            <button
              type="button"
              className="view-toggle"
              aria-pressed={!showMap && cameraView === "walkway"}
              disabled={state !== "ready"}
              onClick={() => changeView(!showMap && cameraView === "walkway" ? "entrance" : "walkway")}
            >
              Covered walkway
            </button>
            <button
              type="button"
              className="view-toggle"
              aria-pressed={showMap}
              disabled={state === "unavailable"}
              onClick={toggleMap}
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="m3 6 6-2 6 2 6-2v14l-6 2-6-2-6 2zm6-2v14m6-12v14" />
              </svg>
              Map overlay
            </button>
          </div>
          {buildingsActive && (
            <select
              className="detail-picker"
              aria-label="Building to inspect"
              value={cameraView}
              onChange={(event) => {
                const selected = buildingViews.find(({ view }) => view === event.currentTarget.value);
                if (selected) changeView(selected.view);
              }}
            >
              {buildingViews.map(({ view, label }) => <option key={view} value={view}>{label}</option>)}
            </select>
          )}
          {gateActive && (
            <select
              className="detail-picker"
              aria-label="Entrance detail"
              value={cameraView}
              onChange={(event) => {
                const selected = entranceDetails.find(({ view }) => view === event.currentTarget.value);
                if (selected) changeView(selected.view);
              }}
            >
              {entranceDetails.map(({ view, label }) => <option key={view} value={view}>{label}</option>)}
            </select>
          )}
          {walking && !showMap && !playerStatus.vehicle && (
            <select className="detail-picker" aria-label="Player camera" value={playerStatus.camera}
              onChange={(event) => {
                sessionRef.current?.setPlayerCamera(event.currentTarget.value as PlayerCamera);
                canvasRef.current?.focus({ preventScroll: true });
              }}>
              {Object.entries(playerCameras).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </select>
          )}
          {walking && !showMap && (playerStatus.vehicle || playerStatus.nearby) && (
            <div className="vehicle-panel">
              {playerStatus.vehicle && <p>{playerStatus.vehicle} · {playerStatus.speed} km/h</p>}
              <button className="view-toggle" type="button" disabled={Boolean(playerStatus.vehicle && playerStatus.speed > 2)}
                onClick={() => {
                  sessionRef.current?.interactWithVehicle();
                  canvasRef.current?.focus({ preventScroll: true });
                }}>
                {playerStatus.vehicle ? "Exit vehicle" : `Enter ${playerStatus.nearby}`} <kbd>E</kbd>
              </button>
            </div>
          )}
          {entryTarget && (
            <div className="vehicle-panel">
              <button className="view-toggle walk-toggle" type="button" disabled={Boolean(loadingInterior)} onClick={() => void enterBuilding(entryTarget)}>
                {loadingInterior ? "Opening entrance…" : `Enter ${buildingInteriors[entryTarget].entryName}`} {walking && <kbd>E</kbd>}
              </button>
            </div>
          )}
          {interiorError && <p role="alert">Unable to open the building. Try again from Building view.</p>}
          <p className="coverage-note">
            <strong>{campusBuildings.length} of {confirmedBuildings}</strong> confirmed structure IDs mapped
          </p>
          <p className="scale-note">Route alignment, building dimensions, and map scale are provisional.</p>
        </section>
        )}
        <section className={showMinimap ? "viewport viewport-tracking" : insideBuilding ? "viewport viewport-interior" : "viewport"} aria-label="Entrance viewer">
          <canvas
            ref={canvasRef}
            aria-label={currentInterior ? `3D ${currentInterior.entryName} interior` : "3D campus entrance preview"}
            aria-hidden={showMap}
            className={showMap ? "canvas-hidden" : undefined}
            tabIndex={showMap ? -1 : 0}
          />
          {showMap && <EntranceMap playerPoint={mapPlayerPoint} />}
          {showMinimap && <EntranceMap markerRef={mapMarkerRef} />}
          <div className="viewer-label">
            {currentInterior ? `${currentInterior.entryName.toUpperCase()} INTERIOR` : showMap ? "PLAN VIEW" : walking && playerStatus.vehicle ? "VEHICLE CHASE" : cameraLabels[cameraView]}
          </div>
          {!showMap && state === "ready" && settings.showControlHints && (
            <div className="controls">
              {insideBuilding
                ? "WASD move · Arrows look · Shift sprint · V camera · R return to lobby"
                : walking
                ? playerStatus.vehicle ? playerStatus.vehicleKind === "car"
                  ? "W/S accelerate and reverse · A/D steer · Space brake · E exit"
                  : "W accelerate · S or Space brake · A/D steer · E exit"
                  : "WASD move · Arrows look · Z walk · Shift sprint · Space jump · C crouch · V camera · R reset"
                : "Drag to orbit · Scroll to zoom"}
            </div>
          )}
          <div className="viewer-status" role="status" data-state={state}>
            {state === "ready" && (loadingInterior ? "Opening entrance…" : currentInterior ? `${currentInterior.entryName} interior ready` : "3D preview ready")}
            {state === "loading" && "Loading 3D preview…"}
            {state === "unavailable" && "3D preview unavailable. Showing plan view."}
          </div>
        </section>
      </div>
      {settingsOpen && (
        <GameSettingsPanel value={settings} onChange={updateSettings} onClose={() => toggleSettings(false)} />
      )}
      {wardrobeOpen && <PlayerWardrobe value={appearance} onChange={updateAppearance} onClose={() => toggleWardrobe(false)}
        preview={<WardrobeCharacterPreview appearance={appearance} />} />}
    </main>
  );
}
