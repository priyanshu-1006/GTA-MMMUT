import { ShaderMaterial } from "@babylonjs/core/Materials/shaderMaterial";
import { RawTexture } from "@babylonjs/core/Materials/Textures/rawTexture";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { CreateSphere } from "@babylonjs/core/Meshes/Builders/sphereBuilder";
import type { Scene } from "@babylonjs/core/scene";

function smooth(from: number, to: number, value: number) {
  const t = Math.min(1, Math.max(0, (value - from) / (to - from)));
  return t * t * (3 - 2 * t);
}

const mix = (a: number, b: number, t: number) => a + (b - a) * t;

function sampleClouds(u: number, v: number, columns: number, rows: number) {
  const x = u * columns;
  const y = v * rows;
  const column = Math.floor(x);
  const row = Math.floor(y);
  const tx = smooth(0, 1, x - column);
  const ty = smooth(0, 1, y - row);
  const hash = (cx: number, cy: number) => {
    const value = Math.sin((cx % columns) * 127.1 + cy * 311.7 + 17.1) * 43758.5453;
    return value - Math.floor(value);
  };
  return mix(
    mix(hash(column, row), hash(column + 1, row), tx),
    mix(hash(column, row + 1), hash(column + 1, row + 1), tx),
    ty,
  );
}

export function createCampusSky(scene: Scene) {
  const width = 512;
  const height = 256;
  const pixels = new Uint8Array(width * height * 4);
  const horizon = [178, 201, 214];
  const zenith = [58, 132, 204];
  for (let y = 0; y < height; y++) {
    const v = (y + 0.5) / height;
    const elevation = Math.cos(v * Math.PI);
    const blue = smooth(0, 0.95, elevation);
    const cloudBand = smooth(0.025, 0.2, elevation) * (1 - smooth(0.75, 0.99, elevation));
    for (let x = 0; x < width; x++) {
      const u = (x + 0.5) / width;
      const broad = sampleClouds(u, v, 10, 12);
      const detail = sampleClouds(u, v, 25, 28);
      const fringe = sampleClouds(u, v, 57, 60);
      const cover = smooth(0.47, 0.71, broad * 0.64 + detail * 0.25 + fringe * 0.11) * cloudBand;
      const brightness = mix(215, 254, smooth(0.24, 0.78, broad + elevation * 0.18));
      const offset = (y * width + x) * 4;
      for (let channel = 0; channel < 3; channel++) {
        pixels[offset + channel] = Math.round(mix(mix(horizon[channel], zenith[channel], blue), brightness, cover));
      }
      pixels[offset + 3] = 255;
    }
  }

  const texture = RawTexture.CreateRGBATexture(pixels, width, height, scene, true, false, Texture.TRILINEAR_SAMPLINGMODE);
  texture.wrapU = Texture.WRAP_ADDRESSMODE;
  texture.wrapV = Texture.CLAMP_ADDRESSMODE;
  const sky = CreateSphere("campus-sky", { diameter: 3800, segments: 20 }, scene);
  sky.infiniteDistance = true;
  sky.isPickable = false;
  sky.applyFog = false;

  const material = new ShaderMaterial("campus-sky", scene, {
    vertexSource: `
      precision highp float;
      attribute vec3 position;
      attribute vec2 uv;
      uniform mat4 worldViewProjection;
      varying vec2 skyUV;
      void main() {
        skyUV = uv;
        gl_Position = worldViewProjection * vec4(position, 1.0);
        gl_Position.z = gl_Position.w * 0.9999;
      }`,
    fragmentSource: `
      precision mediump float;
      varying vec2 skyUV;
      uniform sampler2D skyTexture;
      void main() {
        gl_FragColor = texture2D(skyTexture, skyUV);
      }`,
  }, { attributes: ["position", "uv"], uniforms: ["worldViewProjection"], samplers: ["skyTexture"] });
  material.setTexture("skyTexture", texture);
  material.backFaceCulling = false;
  material.disableDepthWrite = true;
  sky.material = material;

  let reducedMotion = false;
  scene.onBeforeRenderObservable.add(() => {
    if (!reducedMotion) sky.rotation.y += Math.min(100, scene.getEngine().getDeltaTime()) * 0.0000016;
  });
  return (value: boolean) => { reducedMotion = value; };
}
