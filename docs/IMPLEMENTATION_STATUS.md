# GTA MMMUT implementation status

**11 November 2026 · Playable character, wardrobe, and vehicles**

The preview uses a fitted MPFB student avatar with six real skin textures from both supplied packs. The wardrobe includes colors for the polo, jeans, shoes and hair, a rotatable 3D preview and saved presets. Twelve Quaternius clips are retargeted and baked into the player GLB. The Swift Dzire loads on approach inside the main gate. The Alto 800, Scorpio, bicycle, and moped load on approach in TNP parking. The live minimap follows the player on foot and in vehicles. [Avatar preparation](../scripts/prepare-player.py) · [Motion preparation](../scripts/prepare-player-motion.py) · [Animation baking](../scripts/bake-player-motion.py) · [Vehicle credits](../apps/web/src/assets/vehicles/LICENSES.md)

Four internal roads join the existing network. The Atal Bhawan drive branches left from the entrance avenue and follows the outside of its garden. The parking drive reaches the south edge of the Library grounds, and the other approaches reach Civil Block I and the Mechanical south wing beside Training and Placement. The Mechanical wing uses the existing cream and maroon palette and a bilingual entry board. The open stage west of Civil has a 7-foot concrete deck and stairs, and the circular fountain sits inside the entrance splitter island. Road alignments, wing extents, and stage placement remain provisional. [Access and stage data](../packages/world-data/src/campus-access.ts)

A covered link joins the new and old CSE blocks. The Civil-side covered route stops between Old CSE and IT. Civil Block II uses Block I’s brick and cream palette across B28–B29. The university identifies ITCA and ITRC separately. The modeled B24 site gives each its own frontage, with a provisional division across the aerial trace. [IT and Computer Application](https://www.mmmut.ac.in/ITCA_About) · [IT Resource Centre](https://www.mmmut.ac.in/ITRC)

The Cafeteria uses the supplied photo’s orange trim and terracotta hipped roofs. Takshashila uses its aerial footprint, confirmed two-floor count, and the owner’s four-wing courtyard description. The courtyard detailing and the south walk-through are provisional. [Cafeteria photo](../references/university-cafeteria.png) · [ITRC photo](../references/itrc-facade.png)

Deoria Road now runs beyond the southern wall, with a raised median, three marked lanes per direction, an exterior sidewalk, and paved ties to the main and old gates. The lane widths and the section south of the aerial crop are provisional. The inner approach uses textured asphalt, raised interlocking paving, striped curbs, green railings, planters and flags. Openings in the railings tie into the garden paths. [Deoria Road](../packages/world-data/src/deoria-road.ts) · [Entrance photo](../references/entrance-landscaping.png)

Four planted quarters flank the cross paths in front of Atal Bhawan. The right-hand entrance garden connects to the new sidewalk, and the nine-space parking lot in front of B72 connects to the east paved link by a driveway and to the building by a footpath. Flowerbed geometry and parking dimensions are provisional. [Garden layout](../packages/world-data/src/campus-gardens.ts)

Mechanical Engineering uses paired blue glass strips, cream walls and a maroon-trimmed porch. Civil Block I uses the two views of its red brick tower and open cream stair landings. The IT façade beside CSE has peach walls, a white colonnaded porch, red steps and blue signage. The photos are assigned to B48, B73–B74, and B24’s north frontage as provisional matches to the traced footprints. [Mechanical](../references/mechanical-facade.png) · [Civil Block I](../references/civil-block-one.png) · [Civil side angle](../references/civil-block-one-angle.png) · [IT](../references/it-facade.png)

The covered corridor now provides approximately 3 metres clear between posts at the provisional scale. Ten modeled links connect Administration, Pushpagiri, Civil Engineering, CSE, Electrical Engineering, and Physics / Basic Sciences. The Electrical–Physics connection uses the shared courtyard route, following the aerial where it passes the central lawn. The exact doors and shed turns remain provisional. Geometry checks verified connectivity and clearance from the building footprints and traced road surfaces. The shed uses a continuous flat slab, grey pavement and paired cream posts with color patterns. [Covered path data](../packages/world-data/src/covered-walkways.ts) · [Photo](../references/covered-walkway.png)

Masonry walls extend from both sides of the main gate. The black steel old gate sits at the south end of the west spine with an approximately 4.1 metre clear opening and a paved approach that shares the spine's southern edge. Its leaf is posed open. The main entrance road has pale sidewalks, yellow and black curbs, white edge markings, and low railings at the splitter island and Administration garden. The forecourt includes a domed garden pavilion. The positions and dimensions of the boundary and forecourt details remain provisional. [Campus boundary](../packages/world-data/src/campus-boundary.ts) · [Forecourt curbs](../references/forecourt-curbs.png) · [Forecourt approach](../references/forecourt-approach.png)

The main gate uses the photo's gold banded towers, lantern tops, blue truss canopy, bilingual plaque and dark lattice. The leaves are posed open for the walkthrough. The gate position and dimensions remain provisional. Atal Bhawan keeps its traced B70 outline and now has a brick-and-cream exterior with arched glazing, a curved blue-glass entry above an open colonnade and pale roof domes. The east-facing frontage and model heights are inferred from the aerial and photograph. [Main gate photo](../references/main-gate.png) · [Atal Bhawan photo](../references/atal-bhawan.png)

The first detailed exteriors are B71 Administration Building and B72 Training and Placement Cell. Both use their confirmed two-floor counts and their existing traced roof outlines. B71 has pale wings, repeated pilasters and divided windows, a raised university sign band and a maroon portico. B72 uses the visible blue entry glazing, pale surround and dark trim. The source photo's signage and map layout support this association. The exact entrance positions, dimensions and obscured bays remain provisional. [Local photo](../GTA_MMMUT_Preproduction_Master_Pack_v01/references/campus_facade_user_photo_unassigned.png) · [B71](../apps/web/src/building-b71.ts) · [B72](../apps/web/src/building-b72.ts)

The photographed CSE exterior is assigned provisionally to B22 and uses its tall blue glazing, maroon surround and white entry porch. Multipurpose Hall spans B16–B17 and has a cream façade with a rust-colored canopy and tall window bands. B75 Central Library has a cream parapet, shaded colonnade and red entry path. All three keep their aerial roof outlines and model the visible exteriors from the supplied photos. [CSE](../references/cse-facade.png) · [Multipurpose Hall](../references/multipurpose-hall.png) · [Central Library](../references/central-library.png)

The blockout represents all 48 confirmed structure IDs, or 48 of 61 entries that are not marked outside campus. The other 13 entries have unknown identities or are under construction. Nine models use only the visible portion of their roof trace. The footprints, heights and façades remain provisional. Geometry checks found no positive-area overlaps between the 48 building footprints or with the 11 pavement surfaces. [Building traces](../packages/world-data/src/campus-buildings.ts)

The road trace now includes the western and northern spines, their visible access branches, and the eastern paved link. The 36 centerline links are all connected to the south gate. Three shared pavement edges join the additions to the previous trace. The public perimeter and obscured interior connections are outside the trace. No surveyed road inventory is available to calculate a completion percentage. [Wider roads](../packages/world-data/src/campus-roads.ts)

The settings dialog applies render resolution and mouse look preferences to both cameras, toggles control hints and saves preferences locally. Opening settings pauses walking. [Settings panel](../apps/web/src/game-settings.tsx)

**Walk campus** starts a third-person walkthrough at the south gate with WASD, sprint, jump and mouse orbit. The temporary player uses a collision ellipsoid and a level ground plane. Gateposts, palm trunks, the splitter curb and building volumes are solid. The map pauses the walk and shows the player's position. [Walking controller](../apps/web/src/campus-walk.ts)

Atal Bhawan, Administration, Training and Placement, and the Library have editable roof outlines traced from the supplied aerial. All four polygons contain their registry anchors and sit clear of the road polygons and each other. The scene uses provisional exterior heights and window bands. Only B71 and B72 have confirmed floor counts in this group. [Building data](../packages/world-data/src/admin-core.ts)

The southern approach now connects through the splitter island to the west asphalt spine and its T-junction. The west crossing follows markings visible in the aerial. To the east, the preview continues along the lighter paved link and its short side connections. The [editable trace](../packages/world-data/src/southern-entrance.ts) drives the [Babylon scene](../apps/web/src/entrance-scene.ts), its new road overview and the labelled plan overlay. [Run and test instructions](../README.md) are at the workspace root.

The trace uses the original aerial on the 1623 × 928 annotation canvas. Geometry checks verified that the asphalt and lighter pavement share a full edge, that the island cutout is preserved and that all 15 centerlines are connected and on the pavement. The west spine preview stops at annotation rows 535 and 755. The east trace ends at column 1280 and its vehicle access remains unverified. The gate pin and gateway design are illustrative, and the prototype uses 0.5 world meters per annotation pixel pending calibration.

## Campus sources

- Use the [Preproduction Master Pack](../GTA_MMMUT_Preproduction_Master_Pack_v01/README.md) as the documentation baseline. All 35 files in the extracted Documentation and Maps pack match files in the Master Pack byte for byte. The older Mapping Pack has matching pins but lacks the confirmed names. Read the Master's [world contract](../GTA_MMMUT_Preproduction_Master_Pack_v01/docs/02_WORLD_MAP_CONTRACT.md), [architecture](../GTA_MMMUT_Preproduction_Master_Pack_v01/docs/03_TECHNICAL_ARCHITECTURE.md) and [execution tickets](../GTA_MMMUT_Preproduction_Master_Pack_v01/docs/08_CODEX_IMPLEMENTATION_PLAN.md) before implementation. Use the latest owner brief for phase names and scope.
- The [registry CSV](../GTA_MMMUT_Preproduction_Master_Pack_v01/map/data/building_registry.csv) and [JSON](../GTA_MMMUT_Preproduction_Master_Pack_v01/map/data/building_registry.json) agree on all 77 IDs, names, statuses and pins. The owner brief agrees on the 48 confirmed, 16 outside-campus and three under-construction IDs. Ten remain unidentified. Preserve the source labels and individual pins, including the 29 complex groups. Translate legacy statuses at ingestion: `UNIDENTIFIED` to `UNKNOWN`, `OUTSIDE` to `OUTSIDE_CAMPUS` and `UNDER_CONSTRUCTION` to `CONSTRUCTION`. Exclude the 16 outside-campus IDs from playable building generation.
- The registry uses a **1623 × 928** annotation canvas. The [original aerial](../GTA_MMMUT_Preproduction_Master_Pack_v01/map/reference/campus_reference_original.png) is 2048 × 1171 and the [numbered export](../mmmut_numbered_master_map.png) is 2048 × 1338. Overlay pins in annotation coordinates. Keep an explicit, reversible origin, scale and rotation transform to the right-handed Babylon scene, with Y up, +X map-right and +Z map-down before rotation. Leave metric calibration unset. A developer override can support a prototype with a visible provisional-scale label.
- The [road draft](../GTA_MMMUT_Preproduction_Master_Pack_v01/map/data/road_centerlines_draft.json) declares 2048 × 1171, but its points visually align with the annotation canvas. For example, RD01 at x=530 maps to about x=669 on the native aerial, where the west road is visible. RD02 extends seven pixels past the nominal annotation edge and several junction endpoints miss each other. The southern preview uses the original aerial and a new trace with explicit junction nodes. Validate future road segments against the aerial before deriving colliders or navigation.

| Administrative core | Annotation pin | Source detail |
| --- | --- | --- |
| B70 Atal Bhawan | (675, 746) | West of the entrance approach |
| B71 Administration Building | (901, 564) | Two floors confirmed |
| B72 Training and Placement Cell | (1044, 565) | Two floors confirmed |
| B75 Library | (1043, 506) | Immediately above B72 on the map |

B73/B74 can provide Civil Engineering Block 1 context. The ground photo shows palms, fencing, black-and-yellow curbs, flags and a separate forecourt pavilion. Its signage points to B71 with B72 at the right, while the owner brief tentatively associates the scene with B70. The façade pass follows the visible signage as a provisional attribution. Dedicated labelled ground views can establish the remaining elevations. [Local facade photograph](../GTA_MMMUT_Preproduction_Master_Pack_v01/references/campus_facade_user_photo_unassigned.png)

## New asset intake

`Assets/` contains seven ZIPs and one standalone GLB, 328.3 MB on disk. The [source catalog](../GTA_MMMUT_Preproduction_Master_Pack_v01/assets/catalog/source_catalog.csv) and supplied manifest predate this intake. The table records local availability and evidence. Babylon import and visual QA are pending.

| Local source | Contents and evidence | First use |
| --- | --- | --- |
| `kenney_city-kit-roads.zip` | 95 GLBs and bundled Kenney CC0 license. [Kenney Roads](https://kenney.nl/assets/city-kit-roads) | Select road markings, lamps and props. Trace campus roads from the map. |
| `kenney_car-kit.zip` | 50 GLBs and bundled Kenney CC0 license. [Kenney Car Kit](https://kenney.nl/assets/car-kit) | Later driving sandbox. |
| `Ultimate Nature Pack - Jun 2019-20261109T170615Z-1-001.zip` | 150 models in FBX, OBJ and Blend, including four palm variants. Bundled Quaternius CC0 license. [Ultimate Nature Pack](https://quaternius.com/packs/ultimatenature.html) | Convert selected palms to GLB for the detailed sector. Use the supplied palm proxy for the first import. |
| `Universal Base Characters[Standard].zip` | Two full-body glTF avatars among 18 glTF models. Their 65 joint names and hierarchy match the animation pack, with different rest transforms. Bundled Quaternius CC0 license. [Universal Base Characters](https://quaternius.com/packs/universalbasecharacters.html) | Fix the missing texture URIs in a derived copy before bundling one avatar. |
| `Universal Animation Library[Standard].zip` | In-place and root-motion GLBs with 43 clips each, including idle, walk, sprint and jump. Bundled Quaternius CC0 license. [Universal Animation Library](https://quaternius.com/packs/universalanimationlibrary.html) | Preview the in-place clips after basic movement works. Verify retargeting in Babylon. |
| `worn_asphalt_4k.blend.zip` and `concrete_wall_008_4k.blend.zip` | Each has separate albedo, normal, roughness and displacement files. Publisher identifies both as CC0. [Worn Asphalt](https://polyhaven.com/a/worn_asphalt) · [Concrete Wall 008](https://polyhaven.com/a/concrete_wall_008) | The asphalt and island curb use 512 px WebP derivatives of the diffuse maps. |
| `low_poly_autorickshaw_aka_tuktuk.glb` | Local GLB v2, 2.15 MB, 4,798 triangles, embedded PNG and no animations. Embedded metadata names Nirmal.Justin and CC BY 4.0. The matching listing returned HTTP 403 during review. [Model listing](https://sketchfab.com/3d-models/low-poly-autorickshaw-aka-tuktuk-c7c87455ad014b3f9fc8c9fb2d164a61) · [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | Later vehicle milestone. Credit the creator, link the source and license, and identify any modifications. Verify model scale and wheel pivots. |
| [Project prototype GLBs](../GTA_MMMUT_Preproduction_Master_Pack_v01/assets/prototype_glb/) | Seven generated models duplicated across the Master and Starter packs, 46,052 bytes per set. Palm, lamp, fence, curb, planter, flagpole and bench. | Import one small prop in the first smoke test. Use the remaining props as temporary streetscape assets. |

- Preserve or embed the correct `Textures/colormap.png` when moving a selected Kenney GLB. Each pack uses a different palette at the same relative path.
- Map `T_Eye_Normal_png.png` to `T_Eye_Normal.png` for both avatars. The male avatar also needs `T_Hair_1_Normal_png.png` mapped to `T_Hair_1_Normal.png`.
- Keep archives and license evidence as source inputs. Copy only selected, validated runtime derivatives into the web app's asset directory.

## Checkpoints and acceptance

- [x] P0 audit of source packs, campus IDs, map imagery and local assets.
- [x] Registry CSV/JSON agreement and 77 in-bounds, unique pins verified. All 11 ZIPs passed CRC checks.
- [x] Local tools present. Node 24.19.0, pnpm 10.17.1, Python 3.13.9, Chrome and Edge.
- [x] Web scaffold with pinned pnpm dependencies, React, Vite, Tailwind and a right-handed Babylon scene. Dependency installation, TypeScript, ten unit tests and production build passed.
- [x] Southern road trace and provisional gate. Verified coordinate round trips, connected branch topology, and alignment against the aerial.
- [x] West spine and east paved link. Verified connectivity from the gate, the seam between surface types and alignment against the aerial.
- [x] Playwright smoke passed in Chrome and the final run exited cleanly. It verified rendering, mouse orbit, the overview camera and both labelled connections in the plan.
- [ ] Complete GLB import and missing-asset checks when the first model is integrated. The roads and island curb already use optimized textures from the supplied material packs.
- [x] Typed registry loads the 77 pins directly from the supplied source. Verified that all 16 exclusions keep their original status and none become administrative building proxies.
- [x] Administrative-core blockout adds four named building volumes and map footprints at provisional scale.
- [x] Chrome walkthrough verified that the gatepost blocks movement, the gate opening is passable, the player can sprint to the junction and reach both sides of the island, and jumping returns to ground height. The map shows the four building names and the player's position.
- [x] Extended the road blockout and rendered all 48 confirmed structure IDs. Verified shared junction coordinates and connectivity from the south gate.
- [x] Chrome verified the expanded map, walking regression checks, render resolution changes, vertical look inversion, control hint toggling and settings persistence after a reload.
- [ ] Confirm canopy-obscured connections, road widths and pedestrian or vehicle access.
- [x] **C005 · First façades.** Added photo-informed frontages for B71 and B72 using the supplied evidence and their confirmed two-storey counts.
- [x] Added the owner-confirmed covered walkway connections, photographed gate design, and photo-informed B70 exterior.
- [x] Chrome verified the three new landmark views, the covered route in the plan, and the passable gate opening and solid posts.
- [x] Added the southern walls, west road gate, forecourt sidewalks and railings, wider covered links to Electrical and Physics, and three photo-based academic exteriors.
- [x] Verified the new close views and plan markers in Chrome and reran the main-gate walking and settings checks.
- [x] Added Deoria Road, landscaped entrance paving, both garden layouts, nine parking bays and three engineering exteriors. TypeScript, 12 unit tests and the production build passed.
- [ ] Confirm the exact gate placement, shed turns and doors, and review the side and rear building elevations.

For the calibrated pass, collect two known distances and confirm the gate pin, campus boundary and north orientation. Facade identification and per-building views can be resolved alongside the prototype.

The current build emits a Vite size warning for the Babylon scene chunk, about 250 kB compressed. Hardware performance measurements are pending.
