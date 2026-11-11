# GTA MMMUT teaser

The Remotion project assembles in-engine shots with an original synthesized score. FFmpeg normalizes the soundtrack and prepares the H.264 MP4 for streaming.

Install the editor packages, then run the camera capture from the repository root. Capture needs Chrome and the game's pnpm dependencies. You can also put your own recordings in `public/footage` under the names in `shot-list.json`.

```powershell
npm --prefix teaser ci
node scripts/capture-teaser.mjs
```

Run the following from the `teaser` directory to edit or export.

```powershell
npm run prepare-media
npm run studio
npm run render
```

Use `npm run render -- --still` to inspect the title treatment without rendering the full timeline. The final MP4 is written to `output/GTA MMMUT - Teaser - Priyanshu Chaurasia.mp4`.

## Publishing credits

GTA MMMUT · Built by Priyanshu Chaurasia. A playable 3D recreation of the MMMUT campus in Gorakhpur. [Play GTA MMMUT](https://gta-mmmut.vercel.app/)

- Swift Dzire and Alto 800 by BHP3D, adapted for the game with simplified geometry, resized textures, and normalized scale. [Swift Dzire](https://sketchfab.com/3d-models/2022-maruti-suzuki-swift-dzire-95451c00cb2d48778f67d798167e7237) · [Alto 800](https://sketchfab.com/3d-models/2020-maruti-suzuki-alto-800-dad66ee4a05a4f51bd0b9bf64ba6d4ef) · [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)
- Scorpio by Gouravsuthar, adapted with adjusted scale, simplified tires, and wheel pivots. [Scorpio](https://sketchfab.com/3d-models/indian-car-scorpio-3d-model-for-free-4905188a9985423db9c9b67ec97a7c29) · [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)
- Male Classic Jeans and Running Shoes by punkduck, fitted, skinned, and exported with resized textures. [Jeans](https://www.makehumancommunity.org/node/1655) · [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) · [Shoes](https://www.makehumancommunity.org/node/570) · [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/)
