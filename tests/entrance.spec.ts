import { expect, test, type Locator } from "@playwright/test";
import { annotationToWorld, southernEntrance } from "../packages/world-data/src/southern-entrance";

test.afterEach(async ({ page }) => {
  // Unload WebGL before Chromium closes on Windows, including after assertion failures.
  if (!page.isClosed()) await page.goto("about:blank", { waitUntil: "commit" });
});

function walkTo(canvas: Locator, keys: string[], axis: "x" | "z", target: number, direction: -1 | 1, timeout = 10_000) {
  return canvas.evaluate((element, movement) => new Promise<number>((resolve) => {
    const send = (type: string) => {
      for (const code of movement.keys) element.dispatchEvent(new KeyboardEvent(type, { code, bubbles: true }));
    };
    const deadline = performance.now() + movement.timeout;
    function check(time: number) {
      const position = Number(element.getAttribute(`data-player-${movement.axis}`));
      if ((position - movement.target) * movement.direction >= 0 || time >= deadline) {
        send("keyup");
        resolve(position);
      } else {
        requestAnimationFrame(check);
      }
    }
    send("keydown");
    requestAnimationFrame(check);
  }), { keys, axis, target, direction, timeout });
}

test("launches player mode and building tours from the credited homepage", async ({ page }, testInfo) => {
  test.setTimeout(105_000);
  await page.addInitScript(() => {
    if (location.protocol === "http:") localStorage.setItem("gta-mmmut.settings.v1", JSON.stringify({ renderQuality: "low" }));
  });
  await page.goto("/");
  await expect(page.getByText("Built by Priyanshu Chaurasia", { exact: true })).toBeVisible();
  await expect(page.locator("canvas")).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("homepage.png") });
  await page.getByRole("button", { name: "Play as a Player", exact: true }).click();
  await expect(page).toHaveURL(/\?mode=play$/);
  const canvas = page.getByLabel("3D campus entrance preview", { exact: true });
  await expect(page.getByRole("status")).toHaveText("3D preview ready", { timeout: 35_000 });
  await expect(canvas).toHaveAttribute("data-camera-view", "walk");
  await expect(canvas).toBeFocused();
  await page.keyboard.press("m");
  await expect(page.getByRole("img", { name: "Campus reference map" })).toBeVisible();
  await page.keyboard.press("m");
  await expect(canvas).toBeFocused();
  await page.keyboard.press("f");
  await expect(page.getByRole("button", { name: "Exit fullscreen", exact: true })).toBeVisible();
  await expect(canvas).toBeFocused();
  await page.keyboard.press("f");
  await expect(page.getByRole("button", { name: "Fullscreen", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "GTA MMMUT home", exact: true }).click();
  await page.getByRole("button", { name: "Building Tour", exact: true }).click();
  await expect(page).toHaveURL(/\?mode=tour$/);
  await expect(page.getByRole("status")).toHaveText("3D preview ready", { timeout: 35_000 });
  await expect(canvas).toHaveAttribute("data-camera-view", "buildings");
  await expect(page.getByRole("combobox", { name: "Building to inspect" })).toBeVisible();
});

test("renders the southern entrance, walks through the gate, and opens the map", async ({
  page,
}, testInfo) => {
  test.setTimeout(240_000);
  // Keep the static gate checks independent of ambient traffic timing and crowd rendering.
  await page.route((url) => /\/(?:scorpio|campus-crowd)(?:-[\w-]+)?\.glb$/.test(url.pathname), (route) => route.abort());
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/?mode=tour");
  await expect(page.getByRole("heading", { name: "Explore campus", exact: true }))
    .toBeVisible();

  const canvas = page.getByLabel("3D campus entrance preview", { exact: true });
  await expect(canvas).toBeVisible();
  await expect(page.getByRole("status")).toHaveText("3D preview ready", {
    timeout: 20_000,
  });
  async function capturePreview(filename: string) {
    // Switching detail controls can resize the canvas before Babylon redraws it.
    await page.evaluate(() => new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    }));
    await page.screenshot({ path: testInfo.outputPath(filename) });
  }
  const settings = page.getByRole("button", { name: "Settings", exact: true });
  const dialog = page.getByRole("dialog", { name: "Settings", exact: true });
  const quality = dialog.getByLabel("Render quality");
  const sensitivity = dialog.getByRole("slider", { name: "Look sensitivity" });
  const invert = dialog.getByRole("checkbox", { name: "Invert vertical look" });
  const hints = dialog.getByRole("checkbox", { name: "Show control hints" });
  const backingWidth = async () => Number(await canvas.getAttribute("width"));
  async function verticalLookDelta() {
    const bounds = await canvas.boundingBox();
    if (!bounds) throw new Error("The preview canvas is unavailable");
    const pitch = async () => Number(await canvas.getAttribute("data-camera-pitch"));
    const before = await pitch();
    const x = bounds.x + bounds.width / 2;
    const y = bounds.y + bounds.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y + 48, { steps: 5 });
    await page.mouse.up();
    await expect.poll(async () => Math.abs(await pitch() - before), { timeout: 12_000 }).toBeGreaterThan(0.01);
    return await pitch() - before;
  }
  const normalLook = await verticalLookDelta();
  const balancedWidth = await backingWidth();
  await settings.press("Enter");
  await expect(dialog).toBeVisible();
  await quality.selectOption("low");
  await expect(canvas).toHaveAttribute("data-render-quality", "low");
  await expect.poll(backingWidth).toBeLessThan(balancedWidth);
  await sensitivity.press("End");
  await invert.press("Space");
  await hints.press("Space");
  await expect(invert).toBeChecked();
  await expect(hints).not.toBeChecked();
  await page.screenshot({ path: testInfo.outputPath("settings.png") });
  await dialog.getByRole("button", { name: "Done" }).press("Enter");
  await expect(page.getByText("Drag to orbit · Scroll to zoom", { exact: true })).toBeHidden();
  await page.reload();
  await expect(page.getByRole("status")).toHaveText("3D preview ready", { timeout: 20_000 });
  await expect(canvas).toHaveAttribute("data-render-quality", "low");
  expect((await verticalLookDelta()) * normalLook).toBeLessThan(0);
  await settings.press("Enter");
  await expect(quality).toHaveValue("low");
  await expect(sensitivity).toHaveValue("150");
  await expect(invert).toBeChecked();
  await expect(hints).not.toBeChecked();
  await hints.press("Space");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(page.getByText("Drag to orbit · Scroll to zoom", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Main gate", exact: true }).press("Enter");
  await expect(canvas).toHaveAttribute("data-camera-view", "gate");
  await capturePreview("main-gate.png");
  const entranceDetail = page.getByRole("combobox", { name: "Entrance detail" });
  await entranceDetail.selectOption("old-gate");
  await expect(canvas).toHaveAttribute("data-camera-view", "old-gate");
  await capturePreview("old-gate.png");
  await entranceDetail.selectOption("forecourt");
  await expect(canvas).toHaveAttribute("data-camera-view", "forecourt");
  await capturePreview("entrance-forecourt.png");
  await page.getByRole("button", { name: "Covered walkway", exact: true }).press("Enter");
  await expect(canvas).toHaveAttribute("data-camera-view", "walkway");
  await capturePreview("covered-walkway.png");

  await page.getByRole("button", { name: "Walk campus", exact: true }).press("Enter");
  await expect(canvas).toHaveAttribute("data-camera-view", "walk");
  await expect(canvas).toHaveAttribute("data-player-z", /^-?\d+(?:\.\d+)?$/);
  await expect(canvas).toBeFocused();

  const playerCoordinate = async (axis: "x" | "y" | "z") =>
    Number(await canvas.getAttribute(`data-player-${axis}`) ?? NaN);
  const spawnZ = await playerCoordinate("z");
  const spawnX = await playerCoordinate("x");
  const spawnY = await playerCoordinate("y");
  const [postX, gateZ] = annotationToWorld(southernEntrance.gate.span[1]);
  function move(
    keys: string[], axis: "x" | "z", target: number, direction: -1 | 1, timeout = 18_000,
  ) {
    return walkTo(canvas, keys, axis, target, direction, timeout);
  }

  const alignedX = await move(["KeyD"], "x", postX - 0.3, 1);
  expect(alignedX).toBeGreaterThanOrEqual(postX - 0.3);
  expect(alignedX).toBeLessThan(postX + 0.65);
  const blockedZ = await move(["KeyW"], "z", gateZ - 1, -1, 5_000);
  expect(blockedZ).toBeLessThan(spawnZ - 2.4);
  expect(blockedZ).toBeGreaterThan(gateZ);
  expect(await move(["KeyA"], "x", spawnX + 0.3, -1)).toBeLessThanOrEqual(spawnX + 0.3);
  expect(await move(["KeyW"], "z", gateZ - 2, -1)).toBeLessThanOrEqual(gateZ - 2);
  expect(await playerCoordinate("y")).toBeCloseTo(spawnY, 1);
  await page.screenshot({ path: testInfo.outputPath("campus-walk.png") });

  const jump = await canvas.evaluate((element) => new Promise<{ peak: number; end: number }>((resolve) => {
    const position = () => Number(element.getAttribute("data-player-y"));
    const floor = position();
    const deadline = performance.now() + 8_000;
    let peak = floor;
    function sample(time: number) {
      const y = position();
      peak = Math.max(y, peak);
      if ((peak > floor + 0.25 && y <= floor + 0.03) || time >= deadline) resolve({ peak, end: y });
      else requestAnimationFrame(sample);
    }
    element.dispatchEvent(new KeyboardEvent("keydown", { code: "Space", bubbles: true }));
    element.dispatchEvent(new KeyboardEvent("keyup", { code: "Space", bubbles: true }));
    requestAnimationFrame(sample);
  }));
  expect(jump.peak).toBeGreaterThan(spawnY + 0.25);
  expect(jump.end).toBeCloseTo(spawnY, 1);
  expect(await move(["ShiftLeft", "KeyW"], "z", 16, -1, 42_000)).toBeLessThanOrEqual(16);
  expect(await move(["KeyW", "KeyD"], "x", 6, 1)).toBeGreaterThanOrEqual(6);
  expect(await playerCoordinate("z")).toBeLessThan(11);
  expect(await move(["KeyS", "KeyA"], "x", spawnX, -1)).toBeLessThanOrEqual(spawnX);
  expect(await move(["KeyW", "KeyA"], "x", -8, -1)).toBeLessThanOrEqual(-8);
  expect(await playerCoordinate("z")).toBeLessThan(11);
  expect(await playerCoordinate("y")).toBeCloseTo(spawnY, 1);
  await page.screenshot({ path: testInfo.outputPath("campus-junction.png") });
  await page.getByRole("button", { name: "Exit walk", exact: true }).click();
  await expect(canvas).toHaveAttribute("data-camera-view", "entrance");
  await settings.press("Enter");
  await quality.selectOption("balanced");
  await dialog.getByRole("button", { name: "Done" }).press("Enter");

  await page.screenshot({ path: testInfo.outputPath("southern-entrance.png") });

  const azimuthAttribute = "data-camera-azimuth";
  await expect(canvas).toHaveAttribute(azimuthAttribute, /-?\d+(\.\d+)?/);
  const initialAzimuth = await canvas.getAttribute(azimuthAttribute);
  const bounds = await canvas.boundingBox();
  if (!bounds) {
    throw new Error("The entrance canvas has no clickable area");
  }

  const startX = bounds.x + bounds.width * 0.55;
  const startY = bounds.y + bounds.height * 0.65;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + bounds.width * 0.12, startY, { steps: 4 });
  await page.mouse.up();
  await expect.poll(() => canvas.getAttribute(azimuthAttribute))
    .not.toBe(initialAzimuth);

  const overview = page.getByRole("button", { name: "Campus overview", exact: true });
  const radiusAttribute = "data-camera-radius";
  const entranceRadius = Number(await canvas.getAttribute(radiusAttribute));
  expect(entranceRadius).toBeGreaterThan(0);
  await expect(overview).toHaveAttribute("aria-pressed", "false");
  await expect(canvas).toHaveAttribute("data-camera-view", "entrance");
  await overview.click();
  await expect(overview).toHaveAttribute("aria-pressed", "true");
  await expect(canvas).toHaveAttribute("data-camera-view", "network");
  await expect.poll(async () => Number(await canvas.getAttribute(radiusAttribute)))
    .toBeGreaterThan(entranceRadius);
  await page.screenshot({ path: testInfo.outputPath("road-network.png") });
  await overview.click();
  await expect(overview).toHaveAttribute("aria-pressed", "false");
  await expect(canvas).toHaveAttribute("data-camera-view", "entrance");
  await expect.poll(async () => Number(await canvas.getAttribute(radiusAttribute)))
    .toBe(entranceRadius);

  const buildingView = page.getByRole("button", { name: "Building view", exact: true });
  await buildingView.press("Enter");
  await expect(buildingView).toHaveAttribute("aria-pressed", "true");
  await expect(canvas).toHaveAttribute("data-camera-view", "buildings");
  await expect(page.getByText("BUILDING VIEW", { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("administrative-facades.png") });
  const buildingDetail = page.getByRole("combobox", { name: "Building to inspect" });
  await buildingDetail.selectOption("placement");
  await expect(canvas).toHaveAttribute("data-camera-view", "placement");
  await page.screenshot({ path: testInfo.outputPath("placement-facade.png") });
  await buildingDetail.selectOption("atal");
  await expect(canvas).toHaveAttribute("data-camera-view", "atal");
  await page.screenshot({ path: testInfo.outputPath("atal-bhawan.png") });
  for (const [view, screenshot] of [
    ["cse", "cse-facade.png"],
    ["hall", "multipurpose-hall.png"],
    ["library", "central-library.png"],
  ] as const) {
    await buildingDetail.selectOption(view);
    await expect(canvas).toHaveAttribute("data-camera-view", view);
    await capturePreview(screenshot);
  }
  await buildingView.press("Enter");
  await expect(canvas).toHaveAttribute("data-camera-view", "entrance");

  const mapToggle = page.getByRole("button", { name: "Map overlay", exact: true });
  const map = page.getByRole("img", { name: "Campus reference map" });
  await expect(mapToggle).toHaveAttribute("aria-pressed", "false");
  await expect(map).toBeHidden();
  await mapToggle.click();
  await expect(mapToggle).toHaveAttribute("aria-pressed", "true");
  await expect(map).toBeVisible();
  await expect(map.getByText("West spine", { exact: true })).toBeVisible();
  await expect(map.getByText("East paved link", { exact: true })).toBeVisible();
  await expect(map.locator("[data-building-id]")).toHaveCount(48);
  await expect(map.locator("[data-covered-walkway]")).toHaveCount(10);
  await expect(map.locator("[data-boundary-wall]")).toHaveCount(3);
  await expect(map.getByText("Old gate", { exact: true })).toBeVisible();
  await expect(map.getByText("Pushpagiri", { exact: true })).toBeVisible();
  await expect(map.locator("text").filter({ hasText: /^Atal Bhawan$/ })).toBeVisible();
  await expect(map.locator("text").filter({ hasText: /^Administration Building$/ })).toBeVisible();
  await expect(map.locator("text").filter({ hasText: /^Training and Placement Cell$/ })).toBeVisible();
  await expect(map.locator("text").filter({ hasText: /^Library$/ })).toBeVisible();
  await expect(map.getByText("You", { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("southern-entrance-plan.png") });
  await mapToggle.click();
  await expect(mapToggle).toHaveAttribute("aria-pressed", "false");
  await expect(map).toBeHidden();

  expect(pageErrors).toEqual([]);
});

test("applies both skin packs and changes player camera", async ({ page }, testInfo) => {
  test.setTimeout(200_000);
  await page.setViewportSize({ width: 1000, height: 680 });
  await page.addInitScript(() => {
    if (location.protocol === "http:") localStorage.setItem("gta-mmmut.settings.v1", JSON.stringify({ renderQuality: "low" }));
  });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/?mode=tour");
  const canvas = page.getByLabel("3D campus entrance preview", { exact: true });
  await expect(page.getByRole("status")).toHaveText("3D preview ready", { timeout: 35_000 });

  await page.getByRole("button", { name: "Wardrobe", exact: true }).press("Enter");
  const wardrobe = page.getByRole("dialog", { name: "Wardrobe", exact: true });
  const outfitPreview = wardrobe.getByLabel("Rotatable 3D outfit preview");
  await expect(outfitPreview).toHaveAttribute("data-player-model", "ready", { timeout: 30_000 });
  await expect(outfitPreview).toHaveAttribute("data-player-animation", "idle", { timeout: 30_000 });
  const previewSize = await outfitPreview.boundingBox();
  await wardrobe.getByRole("radio", { name: "Indian Enhanced" }).check();
  await expect(canvas).toHaveAttribute("data-player-skin", "skin-indian");
  await expect(outfitPreview).toHaveAttribute("data-player-skin", "skin-indian");
  await wardrobe.getByRole("radio", { name: "Deep warm" }).check();
  await wardrobe.getByRole("button", { name: "Lecture day", exact: true }).click();
  await expect(outfitPreview).toHaveAttribute("data-player-skin", "skin-deep");
  await expect(wardrobe.getByRole("combobox", { name: "Shirt" })).toHaveValue("cream-polo");
  expect(await outfitPreview.boundingBox()).toEqual(previewSize);
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await page.screenshot({ path: testInfo.outputPath("wardrobe-skins.png") });
  await wardrobe.getByRole("button", { name: "Done", exact: true }).press("Enter");
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("gta-mmmut.player-appearance.v1") ?? "{}"));
  expect(saved).toMatchObject({ skin: "skin-deep", shirt: "cream-polo" });

  await page.getByRole("button", { name: "Walk campus", exact: true }).press("Enter");
  await expect(canvas).toHaveAttribute("data-player-model", "ready", { timeout: 30_000 });
  await expect(canvas).toHaveAttribute("data-player-rig", "13", { timeout: 30_000 });
  const camera = page.getByRole("combobox", { name: "Player camera" });
  await camera.selectOption("first");
  await expect(canvas).toHaveAttribute("data-player-camera", "first");
  await camera.selectOption("follow");
  await expect(canvas).toBeFocused();
  await expect(canvas).toHaveAttribute("data-player-animation", "idle");
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await page.screenshot({ path: testInfo.outputPath("player-on-foot.png") });
  await page.keyboard.press("c");
  await expect(canvas).toHaveAttribute("data-player-animation", "crouch");
  await page.keyboard.press("c");
  const marker = page.getByRole("img", { name: "Live campus minimap" }).locator("[data-minimap-marker]");
  await expect(marker).toHaveAttribute("transform", /^translate\(/);
  const startingMarker = await marker.getAttribute("transform");
  const target = Number(await canvas.getAttribute("data-player-z")) - 2;
  expect(await walkTo(canvas, ["KeyW", "KeyZ"], "z", target, -1, 20_000)).toBeLessThanOrEqual(target);
  await expect(marker).not.toHaveAttribute("transform", startingMarker!);
  await camera.selectOption("first");
  await canvas.evaluate((element) => new Promise<void>((resolve) => {
    element.dispatchEvent(new KeyboardEvent("keydown", { code: "ArrowUp", bubbles: true }));
    const until = performance.now() + 750;
    function lookUp(time: number) {
      if (time < until) requestAnimationFrame(lookUp);
      else {
        element.dispatchEvent(new KeyboardEvent("keyup", { code: "ArrowUp", bubbles: true }));
        resolve();
      }
    }
    requestAnimationFrame(lookUp);
  }));
  await page.screenshot({ path: testInfo.outputPath("campus-sky.png") });
  expect(errors).toEqual([]);
});

test("drives and exits the Swift Dzire at the main gate", async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1000, height: 680 });
  await page.addInitScript(() => {
    if (location.protocol === "http:") localStorage.setItem("gta-mmmut.settings.v1", JSON.stringify({ renderQuality: "low" }));
  });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/?mode=tour");
  const canvas = page.getByLabel("3D campus entrance preview", { exact: true });
  await expect(page.getByRole("status")).toHaveText("3D preview ready", { timeout: 35_000 });
  await page.getByRole("button", { name: "Walk campus", exact: true }).press("Enter");
  await page.getByRole("combobox", { name: "Player camera" }).selectOption("first");
  await expect(canvas).toBeFocused();
  await expect(canvas).toHaveAttribute("data-player-z", /^\d+\.\d+$/);
  expect(await walkTo(canvas, ["KeyW"], "z", 82.4, -1, 35_000)).toBeLessThanOrEqual(82.4);
  await expect(page.getByRole("button", { name: /Enter Swift Dzire/ })).toBeVisible({ timeout: 40_000 });
  await page.keyboard.press("e");
  await expect(canvas).toHaveAttribute("data-player-vehicle", "sedan");
  await expect(canvas).toHaveAttribute("data-player-vehicle-model", "ready", { timeout: 30_000 });
  await expect(canvas).toHaveAttribute("data-player-camera", "chase");
  expect(await walkTo(canvas, ["KeyW"], "z", 79.5, -1, 32_000)).toBeLessThanOrEqual(79.5);
  await canvas.focus();
  await page.keyboard.down("Space");
  const exit = page.getByRole("button", { name: /Exit vehicle/ });
  await expect(exit).toBeEnabled({ timeout: 25_000 });
  await page.keyboard.up("Space");
  await page.keyboard.press("e");
  await expect(canvas).not.toHaveAttribute("data-player-vehicle", "sedan");
  expect(errors).toEqual([]);
});

test("loads the Alto 800 and Scorpio in TNP parking", async ({ page }, testInfo) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 1000, height: 680 });
  await page.addInitScript(() => {
    if (location.protocol === "http:") localStorage.setItem("gta-mmmut.settings.v1", JSON.stringify({ renderQuality: "low" }));
  });
  const modelErrors: string[] = [];
  page.on("console", (message) => {
    if (message.text().startsWith("Could not load")) modelErrors.push(message.text());
  });
  await page.goto("/?mode=tour");
  await expect(page.getByRole("status")).toHaveText("3D preview ready", { timeout: 35_000 });
  await page.getByRole("button", { name: "Main gate", exact: true }).press("Enter");

  const models = ["alto-800", "scorpio"].map((name) =>
    page.waitForResponse((response) => new RegExp(`/${name}(?:-[\\w-]+)?\\.glb$`).test(new URL(response.url()).pathname)),
  );
  await page.getByRole("combobox", { name: "Entrance detail" }).selectOption("tnp-parking");
  for (const response of await Promise.all(models)) {
    expect(response.ok()).toBe(true);
    expect(await response.finished()).toBeNull();
  }
  await page.evaluate(() => new Promise<void>((resolve) => {
    let frames = 0;
    function nextFrame() {
      if (++frames === 6) resolve();
      else requestAnimationFrame(nextFrame);
    }
    requestAnimationFrame(nextFrame);
  }));
  await page.screenshot({ path: testInfo.outputPath("tnp-indian-cars.png") });
  expect(modelErrors).toEqual([]);
});

test("opens the marked entrance before crossing into each new interior", async ({ page }, testInfo) => {
  type EntryHistory = Window & { entryHistory?: string[] };
  test.setTimeout(210_000);
  await page.setViewportSize({ width: 960, height: 650 });
  await page.addInitScript(() => {
    if (location.protocol === "http:") localStorage.setItem("gta-mmmut.settings.v1", JSON.stringify({ renderQuality: "low" }));
  });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/?mode=tour");
  await expect(page.getByRole("status")).toHaveText("3D preview ready", { timeout: 35_000 });
  const building = page.getByRole("combobox", { name: "Building to inspect" });
  const outdoor = page.getByLabel("3D campus entrance preview", { exact: true });
  await outdoor.evaluate((canvas) => {
    const history: string[] = [];
    (window as EntryHistory).entryHistory = history;
    new MutationObserver(() => {
      const { buildingEntry, buildingEntryStage, playerAnimation } = canvas.dataset;
      if (!buildingEntry || !buildingEntryStage) return;
      const motion = `${buildingEntry}/${buildingEntryStage}/${playerAnimation}`;
      if (history.at(-1) !== motion) history.push(motion);
    }).observe(canvas, { attributes: true, attributeFilter: ["data-building-entry-stage"] });
  });
  for (const { id, view, name } of [
    { id: "library", view: "library", name: "Central Library" },
    { id: "hall", view: "hall", name: "Multipurpose Hall" },
    { id: "nalanda", view: "nalanda", name: "Nalanda" },
    { id: "pushpagiri", view: "pushpagiri", name: "Pushpagiri" },
    { id: "takshashila", view: "takshashila-entry", name: "Takshashila" },
  ]) {
    await test.step(name, async () => {
      await building.selectOption(view);
      await page.getByRole("button", { name: `Enter ${name}`, exact: true }).click();
      const indoor = page.getByLabel(`3D ${name} interior`, { exact: true });
      await expect(indoor).toHaveAttribute("data-interior-id", id, { timeout: 35_000 });
      await expect(indoor).toHaveAttribute("data-interior-location", /\S/);
      const history = await page.evaluate(() => (window as EntryHistory).entryHistory ?? []);
      const opening = history.indexOf(`${id}/opening/door`);
      expect(opening).toBeGreaterThanOrEqual(0);
      expect(history.indexOf(`${id}/crossing/walk`)).toBeGreaterThan(opening);
      await page.screenshot({ path: testInfo.outputPath(`${id}-arrival.png`) });
      if (id === "nalanda") {
        await indoor.focus();
        expect(await walkTo(indoor, ["KeyW"], "x", -18.8, 1, 18_000)).toBeGreaterThanOrEqual(-18.8);
        await expect(indoor).toHaveAttribute("data-player-y", "-0.585");
        expect(await walkTo(indoor, ["KeyS"], "x", -21.7, -1, 18_000)).toBeLessThanOrEqual(-21.7);
        await expect(indoor).toHaveAttribute("data-player-y", "0.025");
      }
      await page.getByRole("button", { name: /^Exit to campus\b/ }).click({ timeout: 10_000 });
      await expect(outdoor).toHaveAttribute("data-camera-view", view);
    });
  }
  expect(errors).toEqual([]);
});

test("enters CSE, visits both floors and wings, and returns outdoors", async ({ page }, testInfo) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1080, height: 720 });
  await page.addInitScript(() => {
    if (location.protocol === "http:") localStorage.setItem("gta-mmmut.settings.v1", JSON.stringify({ renderQuality: "low" }));
  });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/?mode=tour");
  await expect(page.getByRole("status")).toHaveText("3D preview ready", { timeout: 35_000 });
  const building = page.getByRole("combobox", { name: "Building to inspect" });
  await building.selectOption("cse");
  await page.getByRole("button", { name: "Enter CSE", exact: true }).click();
  const canvas = page.getByLabel("3D CSE interior");
  await expect(canvas).toHaveAttribute("data-cse-floor", "0", { timeout: 30_000 });
  await expect(canvas).toHaveAttribute("data-cse-section", "New CSE");
  const directory = page.getByRole("navigation", { name: "CSE room directory" });
  await directory.getByText("Ground floor directory", { exact: true }).click();
  await expect(directory.getByText("Prof. Rakesh Kumar", { exact: true })).toBeVisible();
  await expect(directory.getByText("Cybersecurity and Blockchain Lab", { exact: true })).toBeVisible();
  await directory.getByText("Ground floor directory", { exact: true }).click();
  await directory.getByText("First floor directory", { exact: true }).click();
  await expect(directory.getByText("Alan Turing Hall", { exact: true })).toBeVisible();
  await expect(directory.getByText("AR/VR Lab", { exact: true })).toBeVisible();
  await directory.getByText("First floor directory", { exact: true }).click();

  await canvas.focus();
  async function reach(axis: "x" | "z", target: number, key: string, direction: -1 | 1) {
    const end = await walkTo(canvas, [key], axis, target, direction, 23_000);
    expect((end - target) * direction).toBeGreaterThanOrEqual(0);
  }
  await reach("z", -3.25, "KeyW", -1);
  await reach("x", -2.5, "KeyA", -1);
  await expect(canvas).toHaveAttribute("data-cse-room", "hod-cabin");
  await page.screenshot({ path: testInfo.outputPath("cse-hod-cabin.png") });
  await reach("x", -0.7, "KeyD", 1);
  await reach("z", -22.1, "KeyW", -1);
  await reach("x", -3.05, "KeyA", -1);
  await reach("z", -30.4, "KeyW", -1);
  await expect(canvas).toHaveAttribute("data-cse-floor", "1");
  await reach("x", -0.7, "KeyD", 1);
  await reach("z", -50.2, "KeyW", -1);
  await expect(canvas).toHaveAttribute("data-cse-section", "Old CSE");
  await reach("x", 2.5, "KeyD", 1);
  await expect(canvas).toHaveAttribute("data-cse-room", "dw-lab");
  await page.screenshot({ path: testInfo.outputPath("old-cse-dw-lab.png") });
  await page.getByRole("button", { name: "Exit to campus" }).click();
  await expect(page.getByLabel("3D campus entrance preview", { exact: true })).toHaveAttribute("data-camera-view", "cse");
  expect(errors).toEqual([]);
});

test("previews the frontage, campus access roads, and landmarks", async ({ page }, testInfo) => {
  test.setTimeout(340_000);
  await page.addInitScript(() => {
    if (location.protocol === "http:") localStorage.setItem("gta-mmmut.settings.v1", JSON.stringify({ renderQuality: "low" }));
  });
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error" && message.text().startsWith("Unable to render")) {
      pageErrors.push(message.text());
      console.error(message.text());
    }
  });
  await page.goto("/?mode=tour");
  const canvas = page.getByLabel("3D campus entrance preview", { exact: true });
  const status = page.getByRole("status");
  await expect(status).toHaveText("3D preview ready", { timeout: 35_000 });
  await page.getByRole("button", { name: "Settings", exact: true }).press("Enter");
  const settings = page.getByRole("dialog", { name: "Settings", exact: true });
  await settings.getByLabel("Render quality").selectOption("low");
  await settings.getByRole("button", { name: "Done" }).press("Enter");

  async function capture(picker: string, view: string, filename: string) {
    await expect(status).toHaveText("3D preview ready");
    await page.getByRole("combobox", { name: picker }).selectOption(view, { timeout: 15_000 });
    await expect(canvas).toHaveAttribute("data-camera-view", view);
    await page.evaluate(() => new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    }));
    await page.screenshot({ path: testInfo.outputPath(filename) });
  }

  await page.getByRole("button", { name: "Main gate", exact: true }).press("Enter");
  for (const view of ["fountain", "atal-garden", "tnp-parking"]) {
    await capture("Entrance detail", view, `${view}.png`);
  }
  await page.getByRole("button", { name: "Building view", exact: true }).press("Enter");
  for (const [view, filename] of [
    ["it", "information-technology.png"],
    ["mechanical-south", "mechanical-south-entry.png"],
    ["cse-complex", "cse-complex.png"],
    ["civil-two", "civil-block-two.png"],
    ["open-stage", "civil-open-stage.png"],
    ["itrc", "it-resource-center.png"],
    ["cafeteria", "university-cafeteria.png"],
    ["nalanda-courtyard", "nalanda-courtyard.png"],
    ["takshashila", "takshashila-courtyard.png"],
  ]) {
    await capture("Building to inspect", view, filename);
  }

  await page.getByRole("button", { name: "Walk campus", exact: true }).press("Enter");
  await expect(canvas).toBeFocused();
  expect(await walkTo(canvas, ["ShiftLeft", "KeyS"], "z", 108, 1, 18_000)).toBeGreaterThanOrEqual(108);
  expect(await walkTo(canvas, ["ShiftLeft", "KeyW"], "z", 53, -1, 30_000)).toBeLessThanOrEqual(53);
  expect(await walkTo(canvas, ["KeyA"], "x", -12, -1, 15_000)).toBeLessThanOrEqual(-12);

  await page.getByRole("button", { name: "Map overlay", exact: true }).click();
  const map = page.getByRole("img", { name: "Campus reference map" });
  await expect(map.locator('[data-deoria-surface="road"]')).toHaveCount(2);
  await expect(map.locator('[data-deoria-surface="median"]')).toHaveCount(1);
  await expect(map.locator("[data-garden-plot]")).toHaveCount(6);
  await expect(map.locator("[data-campus-access]")).toHaveCount(4);
  await expect(map.locator("[data-open-stage]")).toHaveCount(1);
  await expect(map.locator("[data-entrance-fountain]")).toHaveCount(1);
  await expect(map.locator("text").filter({ hasText: /^CSE–IT passage$/ })).toBeVisible();
  await expect(map.getByText("Deoria Road", { exact: true })).toBeVisible();
  await expect(map.getByText("TNP parking", { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("campus-plan.png") });
  expect(pageErrors).toEqual([]);
});
