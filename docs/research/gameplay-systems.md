# GTA MMMUT gameplay systems research

Design proposal for review. The production baseline is commit `4f10ff3`. The references, algorithms, interfaces, and acceptance criteria below are design inputs for a future implementation.

## Proposed vertical slice

Use the parking area and adjacent footpath in front of **B72, Training and Placement Cell**. The authored lot spans annotation coordinates `[1011, 605, 1082, 633]`, roughly **35.5 × 14 m in the current prototype**. Reuse its relative placement and provide visible test boundaries before the east road. Add a short wall, curb, low overhang, marked turn, and a parking bay as test fixtures. Their dimensions and arrangement are design choices. [Campus parking layout](../../packages/world-data/src/campus-gardens.ts) · [World transform](../../packages/world-data/src/southern-entrance.ts)

1. Spawn one fictional avatar on the footpath. Walk, run, jump a low curb, and orbit a single follow camera. The wall and overhang let a reviewer check camera clearance and the character capsule.
2. Walk to the driver door of one unbranded hatchback and press **E**. The avatar moves to the seat, the camera follows the car, and the HUD shows speed. Use the existing **W/A/S/D** and **Space** bindings to turn, brake, and reverse into the bay. A rejected exit leaves the player in control of the car and explains the obstruction.
3. Stop, exit on clear ground, and walk back to the footpath. A small SVG map follows the same controlled actor through both handoffs. Save from the footpath or parking checkpoint, reload, and resume on foot at that checkpoint. One authored pedestrian route and crossing are exercised with test inputs so the playable slice contains exactly one character.

Build this as a standalone local demo entry with its own scene fixture, asset list, and reset. Load Babylon, the selected player and the test car without importing the full campus scene. Reuse the map transform, input conventions, and independently cleared animation assets. One follow camera, one car, one lot, one map, and one save slot are enough to evaluate the loop. Expand NPCs, building portals, car families, network play, and other camera modes in later tickets.

**Review gate.** A reviewer completes `walk → enter → turn → brake → reverse park → exit → save → reload` twice without a reset. Verify left/right steering visually, safe exit with both sides obstructed, camera clearance around the corner and overhang, stable map heading, and save recovery. Capture the loop and record cold load and frame time on a named desktop device before proposing production integration.

## Project constraints and evidence

- The [Preproduction Master Pack](../../GTA_MMMUT_Preproduction_Master_Pack_v01/README.md) is the local baseline. Reviewed its [AGENTS.md](../../GTA_MMMUT_Preproduction_Master_Pack_v01/AGENTS.md), [PRD](../../GTA_MMMUT_Preproduction_Master_Pack_v01/docs/01_PRODUCT_REQUIREMENTS.md), [map contract](../../GTA_MMMUT_Preproduction_Master_Pack_v01/docs/02_WORLD_MAP_CONTRACT.md), [architecture](../../GTA_MMMUT_Preproduction_Master_Pack_v01/docs/03_TECHNICAL_ARCHITECTURE.md), [gameplay spec](../../GTA_MMMUT_Preproduction_Master_Pack_v01/docs/04_GAMEPLAY_SYSTEMS.md), [phase gates](../../GTA_MMMUT_Preproduction_Master_Pack_v01/docs/07_PREPRODUCTION_CHECKLIST.md), and [quality targets](../../GTA_MMMUT_Preproduction_Master_Pack_v01/docs/09_QUALITY_AND_ACCEPTANCE.md). The broad showcase area is B70/B71/B72/B75. The slice is a small technical test within that area.
- The [status map](../../GTA_MMMUT_Preproduction_Master_Pack_v01/map/annotated/building_status_map_v02.png), [admin core map](../../GTA_MMMUT_Preproduction_Master_Pack_v01/map/annotated/phase1_admin_core_highlight.png), and [registry CSV](../../GTA_MMMUT_Preproduction_Master_Pack_v01/map/data/building_registry.csv) place B72 beside B71 and below B75 in image coordinates. Confirmed IDs establish identity and relative placement. Physical widths, elevations, exact doors, access and north alignment require separate evidence. Preserve the 1623 × 928 annotation space and right-handed world with Y up, +X image-right and +Z image-down. Use the **runtime** origin `[900, 700]` and `0.5 m/px` for this fixture, rather than the conceptual pack origin. Keep the transform revisioned and reversible. [Implementation audit](../IMPLEMENTATION_STATUS.md)
- The [asset manifest](../../GTA_MMMUT_Preproduction_Master_Pack_v01/assets/catalog/asset_manifest.csv) and [source catalog](../../GTA_MMMUT_Preproduction_Master_Pack_v01/assets/catalog/source_catalog.csv) are preproduction records. Compare them with the later intake audit and current credits. The runtime player is a MakeHuman-derived body with individually credited wearables and retargeted Quaternius clips. The local Kenney car archive is available as an optional source after per-file QA. An original procedural hatchback is the slice default. [Player preparation](../../scripts/prepare-player.py) · [Motion bake](../../scripts/bake-player-motion.py) · [Vehicle notices](../../apps/web/src/assets/vehicles/LICENSES.md)
- The current app has Babylon.js 9.32.1, a collision ellipsoid and hand-tuned ground surfaces, camera modes, rigged animation, kinematic vehicles, authored pedestrian and vehicle routes, and an SVG map. Settings and wardrobe use browser storage. Havok, world checkpoint saves, and a Colyseus server are proposed additions. The existing player and driving browser smoke tests give regression cases to retain. [Dependencies](../../apps/web/package.json) · [Walk controller](../../apps/web/src/campus-walk.ts) · [Avatar](../../apps/web/src/player-avatar.ts) · [Vehicles](../../apps/web/src/campus-vehicles.ts) · [Pedestrians](../../apps/web/src/campus-pedestrians.ts) · [Traffic](../../apps/web/src/campus-traffic.ts) · [Map UI](../../apps/web/src/app.tsx) · [Browser tests](../../tests/entrance.spec.ts)

| System | Public evidence | MMMUT proposal and inference |
| --- | --- | --- |
| Follow camera | Rockstar's *San Andreas* PS3 manual lists separate look and movement controls and camera switching. Godot documents a spring arm that shortens when a swept shape hits scenery. [Rockstar controls, printed pp. 3–4][sa] · [Godot spring arm][godot] | The ability to look around independently is a useful reference. A collision-aware orbit with easing and optional recentering is our implementation. The manual gives no basis for claiming Rockstar uses those algorithms or parameters. |
| Locomotion | The same controls document walk/move, sprint, jump and crouch actions. [Rockstar controls][sa] | Camera-relative velocity, a capsule, an explicit grounded/airborne state, and in-place clips suit our browser game. Clip blending, speeds, jump timing and slope limits are tuning choices. |
| Entry and driving | Rockstar documents contextual enter/exit, steering, accelerator, brake/reverse, handbrake, and in-vehicle camera input. [Rockstar vehicle controls][sa-car] | Use an authored door/seat sequence, explicit stop-to-exit rules, and low-speed bicycle steering. The controls do not establish occupancy, suspension, or exit clearance internals. |
| NPCs | Rockstar describes ambient traffic and pedestrian density as user-facing features in *GTA V* on PC. [Rockstar PC announcement][gtav-pc] | Author walkable links and campus activities, then schedule routing and local avoidance within budget. The public evidence does not reveal its routing or crowd solver. |
| Minimap | The *San Andreas* manual shows placing a map waypoint that appears on the radar. [Rockstar map/radar instructions][sa-map] | Use the campus SVG, a simulation-driven pose marker, and graph wayfinding. HUD layout, symbols, orientation and routes are original. |
| Save/load | Rockstar's *GTA V* notes refer to loading saved Story Mode progress. [Rockstar update notes][gtav-notes] | Restore stable campus checkpoint IDs using a versioned local record. This is a recovery design for the browser, with no claim about GTA's storage format or save boundaries. |

These observations come from public documentation. No hands-on Rockstar timing or geometry measurements were collected. All values and algorithms below are initial design choices or standard methods used independently.

## Simulation and TypeScript boundaries

Keep gameplay inputs, state and math in TypeScript without scene types. The Babylon adapter owns bodies, casts, animation, and view interpolation. At each logical tick resolve input once, reserve or release the seat, resolve motion and collisions, then publish one coherent pose. Start at **60 simulation Hz**. Use a single step owner and verify engine tick count with Babylon 9.32.1. With Babylon-owned stepping, integrate the character and issue body commands in the before-physics callback and publish after physics. Cap catch-up to four steps per render; pause and discard elapsed backlog and held input on tab hide, blur, and blocking menus. Accumulate look and queue edge actions until consumed by one step. Rendering interpolates poses and owns the camera. Reset interpolation after discontinuities.

```ts
type Vec3 = readonly [x: number, y: number, z: number]
type Id = string
type Pose = Readonly<{ position: Vec3; yawRad: number }>

interface InputFrame {
  readonly tick: number
  readonly move: readonly [right: number, forward: number] // each in [-1, 1]
  readonly look: readonly [yawRad: number, pitchRad: number]
  readonly jumpPressed: boolean
  readonly interactPressed: boolean
  readonly walkHeld: boolean
  readonly sprintHeld: boolean
  readonly crouchHeld: boolean
  readonly brakeHeld: boolean
}

interface CharacterPose {
  readonly feet: Pose
  readonly velocityMps: Vec3
  readonly motion: 'grounded' | 'rising' | 'falling' | 'landing'
  readonly posture: 'standing' | 'crouched'
}

interface CameraTarget {
  readonly pivot: Vec3
  readonly headingRad: number
  readonly owner: 'character' | 'vehicle'
}

interface CameraCollision {
  sweepSphere(from: Vec3, to: Vec3, radiusM: number): number | null // hit fraction
}

interface SeatAnchors {
  readonly seat: Pose       // all poses local to the chassis
  readonly approach: Pose
  readonly exits: readonly Pose[]
}

type RideState =
  | { phase: 'onFoot' }
  | { phase: 'entering' | 'exiting'; vehicleId: Id; seatId: Id; endTick: number }
  | { phase: 'driving'; vehicleId: Id; seatId: Id }

interface VehiclePose {
  readonly chassis: Pose
  readonly speedMps: number // signed
  readonly wheelSteerRad: number
}
```

### Third-person follow camera

Keep orbit yaw and clamped pitch separate from character heading. Use a head/shoulder pivot on foot and a higher vehicle pivot when driving. Smooth pivot and desired distance with `alpha = 1 - exp(-dt / tau)`, using shortest-arc yaw interpolation. After a short quiet window, optionally ease toward travel heading only while moving. Direct look input takes precedence. Keep FOV stable, preserve look direction through seat handoffs where possible, and support the existing reduced camera motion setting.

Sweep a reusable sphere from the safe pivot toward the desired eye against static walls and canopy colliders, excluding triggers and the controlled actor. Pull in immediately to `hitDistance - clearance`, ease out when the view clears, and clamp again against the live hit each render. If the pivot starts overlapped, test a nearby safe pivot or hold a validated short view until clear. Reset on spawn, load, and portals. In Babylon, use a programmatically positioned camera with one input path, Havok `shapeCast`/`shapeProximity` with preallocated results, and masks for the world and actors. Avoid a second engine camera collision system. [Babylon shape casts][cast] · [Godot spring arm][godot]

### Character locomotion

Flatten the view heading onto XZ and normalize. If its length is near zero use the previous planar heading. Compute driver/player right as `cross(forward, up)` in the right-handed world. Clamp the 2D input length to one. Accelerate toward the chosen walk/run/sprint or crouch speed, with separate deceleration and air control. Project ground travel onto a walkable support plane. Jump only on a fresh press with valid support, and apply vertical acceleration once per tick. Block standing under the overhang until the standing capsule fits. Turn toward resolved travel, with facing retained at rest. Keep the same controls and accessibility settings used by the game.

Use `PhysicsCharacterController` with an authored capsule, `maxSlopeCosine`, `maxStepHeight`, and `setShapeOptions` with foot position preserved. Convert between capsule center and the feet pose at the adapter. Drive `checkSupportToRef → setVelocity → integrate` from the fixed tick. Supply gravity to Havok for contact resolution and verify the vertical velocity path in the pinned version to avoid double gravity. Separate ground, wall and trigger colliders from decorative meshes. Animate from resolved horizontal displacement and the jump/landing phase. Blend in-place idle, walk and run groups with speed hysteresis and calibrated playback rates, retaining clip phase during blends. Wall pushes should settle to idle. [Babylon character controller][character] · [Quaternius Universal Animation Library][quaternius]

### Entry and exit

On an **E** press, find the closest eligible driver-door approach within an initial **2.5 m**. Require a stationary, available seat and a reachable approach on the correct ground level. Filter out occupied seats and paths through walls or across a height break. Reserve the seat immediately, suppress driving input through the transition, and move the avatar through tested approach and seat anchors. Commit seat ownership, character visibility/occupancy and camera target together. Failed or interrupted entry clears the reservation and returns the avatar to the last safe on-foot pose. Repeated presses cannot restart the transition or create a second owner.

To exit, require speed below an initial **0.7 m/s**, hold the brake, and test authored driver, passenger, then rear exits. Validate support, slope, capsule headroom, the path out and separation from the chassis. Check again at commit. If all candidates are blocked, remain seated and show an explanation. Use a validated swept capsule path for on-foot movement and an explicit authored transition at the door/seat boundary. Keep wall collision active and exclude the controlled chassis only for the part of the sequence intentionally occupying the seat. Prefer existing cleared sit clips and a procedural blend for the slice. [Existing vehicle thresholds](../../apps/web/src/campus-vehicles.ts) · [Babylon shape casts][cast]

### Driving

Start with one kinematic hatchback, a simple convex chassis proxy, a fixed wheelbase `L`, and static blockers. W accelerates forward, S brakes to zero before reversing, and Space brakes in either direction. Use a small signed speed dead zone, coast drag, speed limits, a steering rate limit, and a maximum steering angle that decreases with speed. Use a midpoint heading to move along the arc and cap translation and rotation per query. For forward `(sin(yaw), 0, cos(yaw))`, a positive right input gives a **negative** wheel steer angle, so `yawNext = yaw + (speed / L) * tan(steer) * dt` turns right in forward travel. Reverse flips yaw response through signed speed. Rotate visual wheels from committed travel distance divided by wheel radius.

Use a reusable Havok shape cast for translation. A single cast uses a fixed orientation. Divide large turns into bounded angular substeps and include a conservative rotation allowance on the swept footprint. Verify the initial and final poses with proximity queries. On contact, clamp translation to the last safe pose and reduce speed; keep support and slope probes separate from obstacle casts. Update the kinematic proxy and render pose from one accepted result. One option is `PhysicsMotionType.ANIMATED` and `PhysicsBody.setTargetTransform` at the physics tick, checked for transform synchronization with the pinned engine. Profile collision seams and near-wall maneuvers first. Consider a dynamic chassis and four ground probes for spring/damper and traction only if a later track requires uneven terrain or physical vehicle contacts. [Babylon shape casts][cast] · [Babylon raycasts][raycast] · [Bullet vehicle reference][bullet-example]

## Campus systems

### NPC navigation

Reuse authored paths, doors, bench, gathering and wait anchors. Give walk and drive separate graphs with explicit crossing links and yield rules. Snap an agent to a reachable node on its own level, then route with A* using edge length plus nonnegative congestion and crossing penalties. Freeze costs during a search and break ties by stable node ID. Euclidean distance is an admissible heuristic on edges whose costs are at least their spatial length. If an edge is blocked, probe ahead and stop or offset within the walkable width. Replan after a bounded delay. Stable yield order or a crossing reservation prevents head-on deadlocks. Schedule fictional travel/wait/yield/interact states with a spatial grid for nearby agent queries. Use Babylon visual instances or shared assets and lightweight collision probes instead of a rigid body for every pedestrian. Profile existing routes before expanding density.

For irregular public spaces, consider revision-keyed offline navmesh bakes from simplified walkable proxies and explicit level/door links. Load them per sector behind the same planning interface. Babylon's NavigationPlugin V2 is an async add-on using recast-navigation-js. Budget its WASM startup and query queue separately. [Hart, Nilsson and Raphael on A*][astar] · [Babylon navigation V2][nav] · [Recast and Detour][recast]

### Minimap and wayfinding

Project a single committed control pose into the existing SVG viewBox. For heading, project the current position and a short step along its forward vector, then rotate an up-pointing glyph by `atan2(du, -dv)`. This gives the same map convention for player and car regardless of model import axes. Cache static geometry by map revision and update the marker by ref at 15–30 Hz. Keep image-up fixed for the first pass. Zoom/resize the layers and marker using the same transform. Use the pedestrian or vehicle graph for wayfinding to allowed public anchors, and keep the destination separate from the live marker. Use an explicit interior floor projection when available and hide the outdoor pose marker inside unsupported interiors. Provide an accessible destination list, distinguish walking and driving visually, and retain the existing **M** shortcut. [Current map UI](../../apps/web/src/app.tsx) · [Current coordinate transform](../../packages/world-data/src/southern-entrance.ts)

### Save/load and eventual multiplayer

Save validated, versioned checkpoint IDs, an optional parking anchor, and small progress flags. Write only when the player is safely on foot and the vehicle is parked if its position will be saved. A manual save or safe checkpoint completion can request a write. IndexedDB stores the current and previous valid snapshots in one readwrite transaction with revision comparison inside that transaction. Report success on transaction completion. A newer write from another tab takes priority over stale state. Parse unknown data, migrate supported versions through pure functions, and resolve checkpoint and parking IDs against the current world revision. Restore on foot to a safe spawn and reset the camera and input history. Use the prior compatible save or the start checkpoint when data is invalid. Preserve unsupported newer data for recovery. A denied or full storage backend leaves the session playable with clear save status. Saves stay separate from preferences and analytics. [IndexedDB transactions][idb] · [Browser storage persistence][storage]

Eventually a Colyseus room owns pose authority, input validation, seat ownership, progression, and saves. Client messages carry sequence numbers and bounded input intents. Publish acknowledged input sequence, server tick, quantized poses and gameplay state. Interpolate other players and reconcile the local prediction against the server. Treat simulation and state publication as separate clocks. Collision outcomes need reconciliation across runtimes rather than an assumption of bit-identical Havok. Keep map rendering and camera local. Validate the PRD's 4–8 player target with seat contention, delayed input and reconnect before expanding room size. [Colyseus state][colyseus-state] · [Colyseus rooms][colyseus-room]

```ts
type TravelKind = 'foot' | 'vehicle'

interface NavigationQuery {
  readonly from: Id
  readonly to: Id
  readonly kind: TravelKind
  readonly worldRevision: string
}

interface NavigationPlanner {
  findPath(query: NavigationQuery): readonly Id[] | null
}

interface MapPose {
  readonly regionId: Id
  readonly floorId?: Id
  readonly position: Vec3
  readonly forward: Vec3
  readonly kind: TravelKind
}

interface SaveV1 {
  readonly schemaVersion: 1
  readonly worldRevision: string
  readonly revision: number
  readonly checkpointId: Id
  readonly vehicleParkingId?: Id
  readonly visitedIds: readonly Id[]
  readonly savedAt: string
}

interface CheckpointStore {
  readCandidates(): Promise<readonly unknown[]> // current, then previous
  write(snapshot: SaveV1, expectedRevision: number | null): Promise<'saved' | 'conflict'>
}
```

## Verification and performance

| Area | Tests and acceptance |
| --- | --- |
| Input and locomotion | At four cardinal view headings, W goes view-forward and A/D go view-left/right. Diagonal speed equals straight speed at full input. Run an identical tick tape under 30/60/120 Hz render schedules on the same device and compare at equal tick counts. Start with a 2 cm position and 0.5° yaw tolerance. Held jump produces one jump. Verify landing, wall push, slope, curb, blocked stand, pause and blur. |
| Camera | Sweep into a wall, around a corner and under an overhang. Assert clearance within the chosen skin, immediate pull-in, smooth recovery, no yaw wrap jump, stable handoff, and safe reset after reload. Check reduced motion and keyboard look. |
| Entry and driving | Verify closest reachable door, repeat E, cancellation, no exit at speed, and alternate exit when the primary is blocked. Test both sides blocked, motion interruption, sign at four headings, braking through zero, coast, tight reverse, high-speed wall contact, and rotation near a curb. |
| Nav and map | Verify disjoint lane/foot graphs, explicit crossing, blocked/unreachable routes, level links, stable reroutes and bottleneck yielding. Test pixel/world round trips, projected cardinal headings, letterboxing, and marker continuity on enter/exit. |
| Save/load | Check round trip after reload, transaction abort, invalid data, old and future versions, changed map revision, stale tab, storage denial and safe fallback. Verify file-level and selected-clip asset provenance, model orientation, scale and seat/wheel anchors. |
| End to end | Vitest for pure state, geometry and migrations. Playwright in desktop Chrome for the full loop and focus handling. Capture start, behind-wall view, driving, alternate exit and resumed checkpoint. Retain current browser coverage for the existing campus entry point before integration. |

The PRD target is 1080p medium at 60 FPS on a named mid-tier discrete GPU, with a low preset trial on integrated graphics. Record 60 seconds of the same loop at each setting, frame-time p50/p95, tick cost and missed steps, physics query counts, draw calls, texture memory estimate, heap trend, WASM and asset transfer, and cold time to first controllable frame. Use 16.7 ms as the 60 Hz frame target and the pack's 100 MB cold-load stretch as an upper comparison point. These are test targets, with no benchmark results yet. [Architecture budgets](../../GTA_MMMUT_Preproduction_Master_Pack_v01/docs/03_TECHNICAL_ARCHITECTURE.md) · [Quality gates](../../GTA_MMMUT_Preproduction_Master_Pack_v01/docs/09_QUALITY_AND_ACCEPTANCE.md)

| Risk | Mitigation and check |
| --- | --- |
| Havok WASM/SIMD boot, bundle and collision cost | Lazy-load a pinned package in the demo, serve its WASM with the build, surface initialization failure, and time boot. Use simplified static proxies, one capsule and one car. Reuse casts and scratch results. |
| Low render rate, camera sweeps and collision edge cases | Bound catch-up, sweep from the current safe pose, cap car substeps, and track missed ticks and worst corners. Reprofile at 30 Hz and after background tab resume. |
| Skinning, material and model transfer | Start with one avatar and material set, use independent collision proxies, size textures and count skeleton/mesh work. Keep the rest of the campus assets out of the demo entry. |
| NPC path spikes and crowd growth | Budget a shared query queue and broadphase, spread route jobs across ticks, lower distant update frequency, and benchmark 1, 10 and 20 NPCs only in the follow-up. |
| Storage stalls and partial saves | Keep saves small, debounce automatic saves, use asynchronous transactions, and verify failure and recovery through a browser reload. |

## IP and source handling

| Material | Finding and treatment |
| --- | --- |
| `gta-reversed` | Shallow checkout `49638dfd82ad82971e3d9621cb07b6b9d133e402`. The README describes a GTA:SA reverse-engineering/reimplementation project. The checked commit has no repository-level `LICENSE` or `COPYING` file. Public access does not establish rights to reuse its code or Rockstar material. Used repository metadata for this assessment. No gameplay findings or implementation designs in this memo derive from that code. [Pinned repository](https://github.com/gta-reversed/gta-reversed/tree/49638dfd82ad82971e3d9621cb07b6b9d133e402) |
| REA | Shallow checkout `653c49419e65515d5567ebf13c0e6dd2ac794f7e` from the requested repository. Its license is MIT for REA-authored work, with separate third-party notices and target authorization obligations. Reviewed checkout documentation only. Future toolkit use, if justified, can inspect our own built demo or a specifically authorized independent fixture. Keep the target, permission and analysis scope documented. No binary analysis, injection, DRM or anti-cheat work took place. [Requested checkout](https://github.com/priyanshu-1006/rea/tree/653c49419e65515d5567ebf13c0e6dd2ac794f7e) · [Upstream REA](https://github.com/morluto/rea) |
| Public game references | Use manuals and release notes for observable controls, map behavior and save conventions. Create original UI, code, models, clips and audio or use individually cleared substitutes. Review branding and affiliation separately before a wider release. |
| Engine and examples | Babylon.js is Apache-2.0. The Babylon Havok web package is MIT. Colyseus is MIT. Recast/Detour uses the zlib license and its JS wrapper is MIT. Bullet's vehicle example is an independent reference under Bullet's zlib terms. Record the exact version and applicable notices for any dependency actually shipped. [Babylon license][babylon-license] · [Havok license][havok-license] · [Colyseus license][colyseus-license] · [Recast license][recast-license] · [Wrapper license][recast-js-license] · [Bullet license][bullet-license] |
| Campus art | Use procedural fixture geometry and one unbranded car. CC0 alternatives include the Kenney Car Kit and Quaternius motion library. Keep exact asset source, license, author, derivative record and QA. Existing CC BY vehicle credits document model rights. Manufacturer marks and vehicle designs require their own review. User-supplied photos inform layout and shape; copying identifiable faces or photo textures requires separate rights. Use fictional people and authored activities in public campus areas. [Kenney Car Kit][kenney] · [Quaternius][quaternius] · [Project copyright](../../COPYRIGHT.md) |

Both research repositories are in ignored local checkouts under `references/gameplay-systems/`. They are outside the dependency graph and deployment. The design uses no GTA source, decompiled pseudocode, models, animations, maps, or music.

## Implementation priorities after review

1. **Fixture and timing.** Add the isolated B72 demo entry, scale label, safe spawn/reset, revisioned data, low-poly collision proxies, tick diagnostics and a single compatibility-checked Havok adapter.
2. **Walking and camera.** Land the fixed-tick motor, in-place animation, camera clearance and focus handling. Validate the curb, wall and overhang with scripted input. Validate a minimal authored walkway graph and crossing in the fixture before the vehicle pass.
3. **One-car loop.** Add anchors and occupancy transitions, forward/reverse steering, braking and swept clearance. Measure both the initial approach and blocked exits.
4. **Finish the local slice.** Connect the map and checkpoint, run the full acceptance loop, capture evidence and record performance. Use the results to decide which changes are ready for the production campus.
5. **Wider systems.** Apply the tested adapter and map contracts to a campus sector, then expand public NPC routes and vehicle types in measured increments. Introduce the authoritative Colyseus room once the local simulation and seat rules are stable.

[sa]: https://media.rockstargames.com/rockstargames-newsite/img/manuals/en_us/GTA_SA_PS3_MANUAL_ENG.pdf
[sa-car]: https://media.rockstargames.com/rockstargames-newsite/img/manuals/en_us/GTA_SA_PS3_MANUAL_ENG.pdf#page=5
[sa-map]: https://media.rockstargames.com/rockstargames-newsite/img/manuals/en_us/GTA_SA_PS3_MANUAL_ENG.pdf#page=6
[gtav-pc]: https://media.rockstargames.com/broadcast/20150413/en_US_web.html
[gtav-notes]: https://support.rockstargames.com/articles/6vPbQm32DGFtOrL04DxHsd/gtav-title-update-1-28-notes-ps4-xbox-one-ps3-xbox-360-pc
[godot]: https://docs.godotengine.org/en/stable/tutorials/3d/spring_arm.html
[character]: https://doc.babylonjs.com/features/featuresDeepDive/physics/characterController/
[cast]: https://doc.babylonjs.com/features/featuresDeepDive/physics/shapeCast/
[raycast]: https://doc.babylonjs.com/features/featuresDeepDive/physics/raycast/
[nav]: https://doc.babylonjs.com/features/featuresDeepDive/crowdNavigation/v2Intro/
[recast]: https://recastnav.com/
[astar]: https://ai.stanford.edu/~nilsson/OnlinePubs-Nils/PublishedPapers/astar.pdf
[bullet-example]: https://github.com/bulletphysics/bullet3/blob/master/src/BulletDynamics/Vehicle/btRaycastVehicle.cpp
[idb]: https://www.w3.org/TR/IndexedDB/#transaction-construct
[storage]: https://storage.spec.whatwg.org/#dom-storagemanager-persist
[colyseus-state]: https://docs.colyseus.io/state
[colyseus-room]: https://docs.colyseus.io/room
[babylon-license]: https://github.com/BabylonJS/Babylon.js/blob/master/license.md
[havok-license]: https://github.com/BabylonJS/havok/blob/main/packages/havok/LICENSE
[colyseus-license]: https://github.com/colyseus/colyseus/blob/master/LICENSE
[recast-license]: https://github.com/recastnavigation/recastnavigation/blob/main/License.txt
[recast-js-license]: https://github.com/isaac-mason/recast-navigation-js/blob/main/LICENSE
[bullet-license]: https://github.com/bulletphysics/bullet3/blob/master/LICENSE.txt
[kenney]: https://kenney.nl/assets/car-kit
[quaternius]: https://quaternius.com/packs/universalanimationlibrary.html
