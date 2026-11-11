import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { Engine } from "@babylonjs/core/Engines/engine";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Scene } from "@babylonjs/core/scene";
import { createPlayerAvatar } from "./player-avatar";

export function createWardrobePreview(canvas: HTMLCanvasElement, onError: () => void) {
  const engine = new Engine(canvas, true);
  const scene = new Scene(engine);
  scene.useRightHandedSystem = true;
  scene.clearColor = new Color4(0.13, 0.22, 0.18, 1);
  const camera = new ArcRotateCamera("wardrobe-orbit", 1.29, 1.48, 2.98, new Vector3(0, 0.87, 0), scene);
  camera.lowerRadiusLimit = 2.15;
  camera.upperRadiusLimit = 3.9;
  camera.lowerBetaLimit = 0.92;
  camera.upperBetaLimit = 1.85;
  camera.panningSensibility = 0;
  camera.minZ = 0.05;
  camera.inputs.removeByType("ArcRotateCameraMouseWheelInput");
  camera.attachControl(false);
  scene.activeCamera = camera;
  const light = new HemisphericLight("wardrobe-light", new Vector3(0.25, 1, 0.6), scene);
  light.intensity = 2.2;
  const avatar = createPlayerAvatar(scene, new TransformNode("wardrobe-root", scene), canvas, true);
  void avatar.prepare();
  const resize = new ResizeObserver(() => engine.resize());
  if (canvas.parentElement) resize.observe(canvas.parentElement);
  engine.runRenderLoop(() => {
    try {
      scene.render();
    } catch (error) {
      console.warn("Could not render the wardrobe preview.", error);
      onError();
    }
  });
  return {
    setAppearance: avatar.setAppearance,
    dispose() {
      resize.disconnect();
      engine.stopRenderLoop();
      scene.dispose();
      engine.dispose();
    },
  };
}
