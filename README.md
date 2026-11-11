# GTA MMMUT

**Built by Priyanshu Chaurasia.** [Copyright notice](COPYRIGHT.md)

GTA MMMUT is a browser-based 3D recreation of the Madan Mohan Malaviya University of Technology campus. The preview includes the southern, western and northern roads, the east paved link, a covered pedestrian network and models for all 48 confirmed structure IDs. That is 48 of 61 registry entries outside the excluded category, including entries with unknown identities or under construction in the denominator. Dimensions, the walkway alignment and vehicle access on the east link remain provisional.

## Run the game

Use Node.js 22.12 or newer and pnpm 10.17.1. The browser smoke test uses desktop Google Chrome.

```powershell
pnpm install --frozen-lockfile
pnpm dev --host 127.0.0.1
```

Choose **Building Tour** on the homepage to inspect landmarks or **Play as a Player** to start outside the main gate. Use WASD to move, Z to slow to a walk, Shift to sprint, C to crouch, Space to jump, and R to return to the gate. Drag or use the arrow keys to look. Double-click the canvas to capture the mouse, and press Escape to release it. Use **Player camera** or V to change perspective, and X to swap shoulders in the shoulder view. **M** toggles the map and **F** toggles fullscreen. [Local preview](http://127.0.0.1:5173)

The [teaser project](teaser/README.md) uses scripted in-engine camera moves, Remotion titles and editing, and FFmpeg encoding. Its media and render tools run separately from the game’s Vercel build.

The live minimap shows your position and heading while walking or driving. **Reduce camera motion** also stops the clouds from drifting.

Students walk along the entrance sidewalks and covered path, gather near four benches, and chant in two garden groups. Three guards staff the main gate, including a guard writing at the register desk. The Scorpio and Alto 800 take turns arriving from Deoria Road, yielding to people and vehicles before parking at TNP. **Campus sounds** controls the nearby chant audio.

**Wardrobe** opens a rotatable character preview with six skin textures from both supplied packs, clothing and hair colors, and three outfit presets. The selection is saved in the browser. The Swift Dzire is just inside the main gate. The Alto 800, Scorpio, moped, and bicycle are in TNP parking. Approach a vehicle and use E or the interaction button. W accelerates, A/D steer, Space brakes, and S brakes before reversing a car. Come to a stop before using E to exit.

**Building view** offers close views of Atal Bhawan, Administration, Training and Placement, CSE, Multipurpose Hall, Central Library, Mechanical Engineering, Civil Engineering Block I, and Information Technology. **Main gate** lets you inspect both gates, Deoria Road, the Administration forecourt, Atal Bhawan garden, the right-side entrance garden, and the Training and Placement parking lot. **Covered walkway** opens a view under the canopy near Administration. The gold lines in **Map overlay** show the continuous route linking Administration, Pushpagiri, Civil Engineering, CSE, Electrical Engineering and Physics / Basic Sciences. The modeled corridor is approximately 3 metres clear between posts at the provisional map scale.

Approach a green entrance marker on foot and press **E**, or select a building in **Building view** and use its **Enter** button. Your character opens the door and steps inside. Use **Exit to campus** in the sidebar or press **E** at the interior entrance to return outdoors.

- CSE has connected new and old wings, furnished rooms, and a directory for each floor.
- Central Library has reading tables, book stacks, and split stairs to the upper galleries. The Multipurpose Hall has red seating, aisles, and a raised stage.
- Nalanda has six tiered lecture halls, the Graphics Designing Room, and a washroom. A continuous covered gallery connects the three wings and sits 2 feet above the central garden. **Nalanda courtyard** shows the layout from above.
- Pushpagiri has a continuous roof over both levels. Takshashila has four wings around a paved, open-air courtyard, visible from the upper gallery and from **Takshashila courtyard**. The two lecture hall entrances face each other across the covered walkway.
- Electrical Engineering and ECE have entrances on the sides facing toward Multipurpose Hall, with signs on the entrance and roadside façades.

**Main gate** also offers an entrance fountain view. Campus roads have textured asphalt and white edge and lane markings. The western road by VC House is lined with bushes. The Civil covered path ends in the passage between Old CSE and IT. The plan shows the Atal Bhawan perimeter drive, the Library road from TNP parking, and the separate Civil and Mechanical approaches.

**Settings** pauses walking and lets you change render resolution, mouse sensitivity, vertical look inversion, player field of view, camera motion and control hints. Preferences apply immediately and are saved in the current browser. **Reset defaults** restores the starting values.

```powershell
pnpm typecheck
pnpm test
pnpm build
pnpm test:browser
```

Playwright launches its test server on port 5174. Screenshots of the entrance, campus overview, walkthrough, façades, plan and settings are saved under `test-results/`. Chrome shutdown can take an extra 30 seconds on the development Windows host.

## Deploy on Vercel

1. In Vercel, choose **Add New → Project** and import **priyanshu-1006/GTA-MMMUT** from GitHub. [Vercel Git deployments](https://vercel.com/docs/git)
2. Keep **Root Directory** at the repository root so pnpm can resolve both workspace packages. Use the **Vite** preset and Node.js **24.x**. [Vercel monorepos](https://vercel.com/docs/monorepos)
3. Select **Deploy**. The root `vercel.json` sets `pnpm build` and the `apps/web/dist` output directory. Vercel installs dependencies from the lockfile. The game uses bundled assets and browser storage. [Vercel build settings](https://vercel.com/docs/builds/configure-a-build)

Once the project is connected, Vercel deploys pushes to the production branch. [Vercel Git deployments](https://vercel.com/docs/git)

## Project files

- The entrance and wider road data hold the source-image coordinates, connected centerlines, pavement and provisional world transform. The boundary data hold the southern wall runs and the old gate approach. [Entrance data](packages/world-data/src/southern-entrance.ts) · [Campus roads](packages/world-data/src/campus-roads.ts) · [Campus boundary](packages/world-data/src/campus-boundary.ts)
- The exterior layout adds an uninterrupted frontage sidewalk across two driveway crossings, three highway lanes in each direction, and a central median. The garden and parking data define the four Atal Bhawan plots, the east entrance lawn, and nine marked parking spaces in front of B72. [Deoria Road](packages/world-data/src/deoria-road.ts) · [Gardens and parking](packages/world-data/src/campus-gardens.ts)
- The building models pair aerial roof traces and proxy heights with the verified names and known floor counts. [Campus buildings](packages/world-data/src/campus-buildings.ts) · [Campus registry](packages/world-data/src/registry.ts)
- The entrance scene renders the campus. Separate controllers handle walking, cameras and collisions, the wardrobe’s rigged avatar, and vehicles. [Entrance scene](apps/web/src/entrance-scene.ts) · [Walking controller](apps/web/src/campus-walk.ts) · [Avatar](apps/web/src/player-avatar.ts) · [Vehicles](apps/web/src/campus-vehicles.ts)
- [Implementation status](docs/IMPLEMENTATION_STATUS.md) records the reference audit, evidence and remaining checkpoints.

The road and curb textures use WebP derivatives of the supplied CC0 diffuse maps. [Poly Haven Worn Asphalt](https://polyhaven.com/a/worn_asphalt) · [Poly Haven Concrete Wall 008](https://polyhaven.com/a/concrete_wall_008)

The following photo links refer to the local source collection. The deployment uses the processed assets under `apps/web/src/assets`. [Covered walkway](references/covered-walkway.png) · [Main gate](references/main-gate.png) · [Atal Bhawan](references/atal-bhawan.png) · [Forecourt curbs](references/forecourt-curbs.png) · [Forecourt approach](references/forecourt-approach.png) · [CSE](references/cse-facade.png) · [Multipurpose Hall](references/multipurpose-hall.png) · [Central Library](references/central-library.png)

The latest references show the entrance avenue and the three engineering façades. [Entrance landscaping](references/entrance-landscaping.png) · [Mechanical](references/mechanical-facade.png) · [Civil Block I](references/civil-block-one.png) · [Civil side angle](references/civil-block-one-angle.png) · [IT](references/it-facade.png)

The new references show the TNP-side approach, the Resource Center, and the Cafeteria. [TNP layout](references/tnp-mechanical-layout.png) · [ITRC](references/itrc-facade.png) · [Cafeteria](references/university-cafeteria.png)
