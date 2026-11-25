import { AnimationGroup } from "@babylonjs/core/Animations/animationGroup";
import type { AssetContainer, InstantiatedEntries } from "@babylonjs/core/assetContainer";
import { LoadAssetContainerAsync } from "@babylonjs/core/Loading/sceneLoader";
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { Scene } from "@babylonjs/core/scene";
import "@babylonjs/loaders/glTF";

const crowdUrl = new URL("./assets/player/campus-crowd.glb", import.meta.url).href;
const clips = {
  idle: "Idle_Loop",
  walk: "Walk_Loop",
  sit: "Sitting_Idle_Loop",
  talk: "Idle_Talking_Loop",
} as const;

export interface CampusActorPose {
  readonly position: readonly [x: number, y: number, z: number];
  readonly yaw: number;
  readonly action: keyof typeof clips;
  readonly roll?: number;
}

interface CampusActor {
  readonly root: TransformNode;
  readonly shirt: string;
  pose: CampusActorPose;
  entries?: InstantiatedEntries;
  current?: AnimationGroup;
  visible: boolean;
}

export function createCampusActors(scene: Scene) {
  const actors: CampusActor[] = [];
  const shirts = new Map<string, PBRMaterial>();
  let container: AssetContainer | undefined;
  let loading = false;
  let disposed = false;

  function applyPose(actor: CampusActor) {
    const { pose, root, visible } = actor;
    root.setEnabled(visible);
    root.position.set(...pose.position);
    root.rotation.set(0, pose.yaw, pose.roll ?? 0);
    const groups = actor.entries?.animationGroups;
    const group = visible ? groups?.find(({ name }) => name === root.name + "/" + clips[pose.action]) : undefined;
    if (group === actor.current) return;
    actor.current?.stop();
    actor.current = group;
    if (!group) return;
    group.enableBlending = pose.action !== "sit";
    group.blendingSpeed = 0.15;
    group.start(true);
  }

  function mount(actor: CampusActor, source: AssetContainer) {
    if (actor.entries) return;
    actor.entries = source.instantiateModelsToScene((name) => actor.root.name + "/" + name, false, {
      predicate: (item) => !(item instanceof AnimationGroup) || Object.values(clips).some((clip) => item.name === clip),
    });
    for (const node of actor.entries.rootNodes) node.parent = actor.root;
    for (const mesh of actor.root.getChildMeshes()) {
      mesh.isPickable = false;
      mesh.receiveShadows = true;
      if (!(mesh.material instanceof PBRMaterial) || mesh.material.name !== "top") continue;
      let shirt = shirts.get(actor.shirt);
      if (!shirt) {
        shirt = mesh.material.clone("campus-actor-shirt-" + actor.shirt);
        shirt.albedoColor = Color3.FromHexString(actor.shirt).toLinearSpace();
        shirts.set(actor.shirt, shirt);
      }
      mesh.material = shirt;
    }
    applyPose(actor);
  }

  function prepare(actor: CampusActor) {
    if (container) {
      mount(actor, container);
      return;
    }
    if (loading || disposed) return;
    loading = true;
    void LoadAssetContainerAsync(crowdUrl, scene, { pluginOptions: { gltf: { animationStartMode: 0 } } })
      .then((source) => {
        if (disposed || scene.isDisposed) {
          source.dispose();
          return;
        }
        container = source;
        for (const member of actors) {
          if (member.visible) mount(member, source);
        }
      })
      .catch((error: unknown) => {
        if (!disposed && !scene.isDisposed) console.warn("Campus actors could not be loaded.", error);
      })
      .finally(() => { loading = false; });
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    for (const actor of actors) {
      actor.entries?.dispose();
      actor.root.dispose();
    }
    for (const shirt of shirts.values()) shirt.dispose();
    container?.dispose();
  }

  scene.onDisposeObservable.addOnce(dispose);
  return {
    add(id: string, pose: CampusActorPose, shirt: string, visible = true) {
      const actor: CampusActor = { root: new TransformNode(id, scene), pose, shirt, visible };
      actors.push(actor);
      applyPose(actor);
      if (visible) prepare(actor);
      return {
        setPose(next: CampusActorPose) {
          actor.pose = next;
          applyPose(actor);
        },
        setVisible(next: boolean) {
          if (actor.visible === next) return;
          actor.visible = next;
          if (next) prepare(actor);
          applyPose(actor);
        },
      };
    },
    dispose,
  };
}
