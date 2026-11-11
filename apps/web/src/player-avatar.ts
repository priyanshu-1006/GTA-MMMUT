import type { AnimationGroup } from "@babylonjs/core/Animations/animationGroup";
import { ImportMeshAsync } from "@babylonjs/core/Loading/sceneLoader";
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import { CreateSphere } from "@babylonjs/core/Meshes/Builders/sphereBuilder";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { Scene } from "@babylonjs/core/scene";
import "@babylonjs/loaders/glTF";
import { defaultPlayerAppearance, getPlayerAppearanceColors, type PlayerAppearance } from "./player-appearance";

const modelUrl = new URL("./assets/player/campus-player.glb", import.meta.url).href;
const textureUrls: Record<PlayerAppearance["skin"], string> = {
  "skin-bronze": new URL("./assets/player/skin-bronze.webp", import.meta.url).href,
  "skin-indian": new URL("./assets/player/skin-indian.webp", import.meta.url).href,
  "skin-mid-tone": new URL("./assets/player/skin-mid-tone.webp", import.meta.url).href,
  "skin-eurasian": new URL("./assets/player/skin-eurasian.webp", import.meta.url).href,
  "skin-freckled": new URL("./assets/player/skin-freckled.webp", import.meta.url).href,
  "skin-deep": new URL("./assets/player/skin-deep.webp", import.meta.url).href,
};
const parts = { skin: "body", shirt: "top", pants: "bottom", shoes: "shoes", hair: "hair" } as const;
const clips = {
  idle: "Idle_Loop", walk: "Walk_Loop", jog: "Jog_Fwd_Loop", sprint: "Sprint_Loop",
  crouch: "Crouch_Idle_Loop", sneak: "Crouch_Fwd_Loop", takeoff: "Jump_Start",
  air: "Jump_Loop", land: "Jump_Land", ride: "Driving_Loop",
  sit: "Sitting_Idle_Loop", talk: "Idle_Talking_Loop", door: "Interact",
} as const;
export type PlayerAction = keyof typeof clips;

export function createPlayerAvatar(scene: Scene, parent: TransformNode, canvas: HTMLCanvasElement, preview = false) {
  const visual = new TransformNode("player-visual", scene);
  visual.parent = parent;
  const proxy = new TransformNode("player-loading-body", scene);
  proxy.parent = visual;
  const fallback = {} as Record<keyof PlayerAppearance, PBRMaterial>;
  for (const [category, name] of Object.entries(parts) as [keyof PlayerAppearance, string][]) {
    const material = new PBRMaterial(`player-loading-${name}`, scene);
    material.metallic = 0;
    material.roughness = 0.88;
    fallback[category] = material;
  }
  function place(mesh: Mesh, x: number, y: number, category: keyof PlayerAppearance) {
    mesh.parent = proxy;
    mesh.position.set(x, y, 0);
    mesh.material = fallback[category];
    mesh.isPickable = false;
  }
  place(CreateBox("loading-torso", { width: 0.46, height: 0.56, depth: 0.26 }, scene), 0, 1.08, "shirt");
  place(CreateSphere("loading-head", { diameter: 0.26, segments: 7 }, scene), 0, 1.51, "skin");
  for (const side of [-1, 1]) {
    place(CreateBox("loading-leg", { width: 0.17, height: 0.72, depth: 0.2 }, scene), side * 0.12, 0.43, "pants");
    place(CreateBox("loading-shoe", { width: 0.18, height: 0.1, depth: 0.25 }, scene), side * 0.12, 0.06, "shoes");
    place(CreateBox("loading-arm", { width: 0.13, height: 0.51, depth: 0.16 }, scene), side * 0.29, 1.02, "shirt");
  }

  let appearance = { ...defaultPlayerAppearance };
  const materials = new Map<string, PBRMaterial>();
  const textures = new Map<PlayerAppearance["skin"], Texture>();
  const animation = new Map<PlayerAction, AnimationGroup>();
  let current: AnimationGroup | undefined;
  let loading: Promise<void> | undefined;

  function setAppearance(next: PlayerAppearance) {
    appearance = next;
    const colors = getPlayerAppearanceColors(next);
    for (const category of Object.keys(parts) as (keyof PlayerAppearance)[]) {
      const color = Color3.FromHexString(colors[category]).toLinearSpace();
      fallback[category].albedoColor = color;
      const material = materials.get(parts[category]);
      if (!material) continue;
      if (category !== "skin") {
        material.albedoColor = color;
        continue;
      }
      const url = textureUrls[next.skin];
      let texture = textures.get(next.skin);
      if (!texture) {
        texture = new Texture(url, scene, false, false);
        textures.set(next.skin, texture);
      }
      material.albedoColor = Color3.White();
      material.albedoTexture = texture;
    }
    canvas.dataset.playerSkin = next.skin;
  }

  async function load() {
    canvas.dataset.playerModel = "loading";
    const options = { pluginOptions: { gltf: { animationStartMode: 0 } } } as const;
    try {
      const result = await ImportMeshAsync(modelUrl, scene, options);
      if (scene.isDisposed) return;
      const modelRoot = result.meshes[0];
      for (const mesh of result.meshes) {
        mesh.isPickable = false;
        if (mesh.material instanceof PBRMaterial) materials.set(mesh.material.name, mesh.material);
      }
      for (const [action, name] of Object.entries(clips) as [PlayerAction, string][]) {
        const group = result.animationGroups.find((clip) => clip.name === name);
        if (!group?.targetedAnimations.length) continue;
        group.enableBlending = !preview;
        group.blendingSpeed = 0.2;
        animation.set(action, group);
      }
      if (!animation.has("idle")) throw new Error("The player model has no idle animation");
      modelRoot.parent = visual;
      setAppearance(appearance);
      if (preview) {
        const idle = animation.get("idle")!;
        idle.start(false);
        idle.goToFrame(idle.from + (idle.to - idle.from) * 0.25);
        idle.pause();
        canvas.dataset.playerAnimation = "idle";
      } else {
        animate("idle");
      }
      proxy.setEnabled(false);
      canvas.dataset.playerRig = String(animation.size);
      canvas.dataset.playerModel = "ready";
    } catch (error) {
      if (scene.isDisposed) return;
      if (canvas.dataset.playerModel === "loading") canvas.dataset.playerModel = "fallback";
      console.warn("The campus avatar or its motion clips could not be loaded.", error);
    }
  }

  function animate(action: PlayerAction, rate = 1) {
    const group = animation.get(action);
    if (!group) return;
    if (group !== current) {
      current?.stop();
      current = group;
      group.start(action !== "takeoff" && action !== "land" && action !== "door", rate);
      canvas.dataset.playerAnimation = action;
    }
    group.speedRatio = rate;
  }

  function poseDoor(seconds: number) {
    const group = animation.get("door");
    if (!group) return;
    if (group !== current) {
      current?.stop();
      current = group;
      group.enableBlending = false;
      group.start(false);
      group.pause();
      canvas.dataset.playerAnimation = "door";
    }
    const fps = group.targetedAnimations[0].animation.framePerSecond;
    group.goToFrame(Math.min(group.to, group.from + seconds * fps));
  }

  setAppearance(appearance);
  return { visual, animate, poseDoor, setAppearance, prepare: () => loading ??= load() };
}
