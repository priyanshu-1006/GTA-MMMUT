"""Retarget the Quaternius clips to the fitted MPFB rig and embed them in the player GLB."""

import json
import struct
from pathlib import Path

import numpy as np
from scipy.spatial.transform import Rotation, Slerp


ASSETS = Path(__file__).resolve().parents[1] / "apps/web/src/assets/player"
NAME_MAP = {"Root": "root", "head": "Head"}
PELVIS = "pelvis"
GROUNDED = {
    "Idle_Loop", "Walk_Loop", "Jog_Fwd_Loop", "Sprint_Loop",
    "Crouch_Fwd_Loop", "Crouch_Idle_Loop", "Idle_Talking_Loop",
    "Interact",
}
LIMB_CHILD = {
    f"{parent}_{side}": f"{child}_{side}"
    for side in ("l", "r")
    for parent, child in (
        ("upperarm", "lowerarm"), ("lowerarm", "hand"),
        ("thigh", "calf"), ("calf", "foot"), ("foot", "ball"),
    )
}
FINGERS = ("index", "middle", "ring", "pinky", "thumb")


def read_glb(path):
    data = path.read_bytes()
    length = struct.unpack_from("<I", data, 12)[0]
    return json.loads(data[20:20 + length]), bytearray(data[28 + length:])


def write_glb(path, document, binary):
    document["buffers"][0]["byteLength"] = len(binary)
    metadata = json.dumps(document, separators=(",", ":"), allow_nan=False).encode()
    metadata += b" " * (-len(metadata) % 4)
    data = (struct.pack("<4sII", b"glTF", 2, 28 + len(metadata) + len(binary))
            + struct.pack("<I4s", len(metadata), b"JSON") + metadata
            + struct.pack("<I4s", len(binary), b"BIN\0") + binary)
    path.write_bytes(data)


def strip_baked_motion(document, binary):
    # The baker appends its accessors and buffer views after the base model.
    animations = document.pop("animations", [])
    if animations:
        first_accessor = min(sampler[key] for clip in animations
                             for sampler in clip["samplers"] for key in ("input", "output"))
        first_view = document["accessors"][first_accessor]["bufferView"]
        del binary[document["bufferViews"][first_view]["byteOffset"]:]
        del document["accessors"][first_accessor:]
        del document["bufferViews"][first_view:]


def read_accessor(document, binary, index):
    accessor = document["accessors"][index]
    view = document["bufferViews"][accessor["bufferView"]]
    offset = view.get("byteOffset", 0) + accessor.get("byteOffset", 0)
    components = {"SCALAR": 1, "VEC3": 3, "VEC4": 4}[accessor["type"]]
    values = np.frombuffer(binary, "<f4", accessor["count"] * components, offset).copy()
    return values if components == 1 else values.reshape(-1, components)


def add_accessor(document, binary, values, kind):
    values = np.asarray(values, dtype="<f4")
    encoded = values.tobytes()
    view = len(document["bufferViews"])
    document["bufferViews"].append({"buffer": 0, "byteOffset": len(binary), "byteLength": len(encoded)})
    binary.extend(encoded)
    accessor = {"bufferView": view, "componentType": 5126, "type": kind, "count": len(values)}
    if kind == "SCALAR":
        accessor.update(min=[float(values[0])], max=[float(values[-1])])
    document["accessors"].append(accessor)
    return len(document["accessors"]) - 1


class Rig:
    def __init__(self, document):
        self.nodes = document["nodes"]
        self.parents = {}
        self.order = []

        def visit(index, parent):
            self.order.append(index)
            self.parents[index] = parent
            for child in self.nodes[index].get("children", []):
                visit(child, index)

        for root in document["scenes"][document["scene"]]["nodes"]:
            visit(root, None)
        self.names = {node["name"]: index for index, node in enumerate(self.nodes)}
        self.rotations = {
            index: Rotation.from_quat(node.get("rotation", [0, 0, 0, 1]))
            for index, node in enumerate(self.nodes)
        }
        self.positions = {
            index: np.array(node.get("translation", [0, 0, 0]), dtype=float)
            for index, node in enumerate(self.nodes)
        }
        self.rest_rotations, self.rest_positions = self.world_pose(self.rotations, self.positions)

    def world_pose(self, rotations, positions):
        world_rotations = {}
        world_positions = {}
        for index in self.order:
            parent = self.parents[index]
            if parent is None:
                world_rotations[index] = rotations[index]
                world_positions[index] = positions[index]
            else:
                world_rotations[index] = world_rotations[parent] * rotations[index]
                world_positions[index] = world_positions[parent] + world_rotations[parent].apply(positions[index])
        return world_rotations, world_positions

    def joint(self, name):
        return self.rest_positions[self.names[name]]


def unit(vector):
    return vector / np.linalg.norm(vector)


def palm_basis(rig, side):
    forward = unit(rig.joint(f"middle_01_{side}") - rig.joint(f"hand_{side}"))
    across = rig.joint(f"index_01_{side}") - rig.joint(f"pinky_01_{side}")
    normal = unit(np.cross(forward, across))
    return np.column_stack((forward, np.cross(normal, forward), normal))


def align_rest_frames(source, target):
    alignment = {}
    transfer = {}
    for index in target.order:
        name = target.nodes[index]["name"]
        source_index = source.names.get(NAME_MAP.get(name, name))
        if source_index is None:
            continue
        correction = Rotation.identity()
        child = LIMB_CHILD.get(name)
        if name.startswith("hand_"):
            side = name[-1]
            correction = Rotation.from_matrix(palm_basis(source, side) @ palm_basis(target, side).T)
        elif name.startswith(FINGERS):
            correction = alignment.get(target.parents[index], correction)
            child = next((target.nodes[node]["name"] for node in target.nodes[index].get("children", [])), None)
        if child in source.names and child in target.names:
            source_direction = unit(source.joint(child) - source.rest_positions[source_index])
            target_direction = unit(target.joint(child) - target.rest_positions[index])
            swing, _ = Rotation.align_vectors([source_direction], [correction.apply(target_direction)])
            correction = swing * correction
        alignment[index] = correction
        # Compare the limbs in the same anatomical pose before transferring their motion.
        transfer[index] = (source_index, source.rest_rotations[source_index].inv()
                           * correction * target.rest_rotations[index])
    return transfer


def sample_clip(document, binary, clip):
    tracks = {}
    for channel in clip["channels"]:
        sampler = clip["samplers"][channel["sampler"]]
        if sampler.get("interpolation", "LINEAR") != "LINEAR":
            raise ValueError(f"Unsupported interpolation in {clip['name']}")
        times = read_accessor(document, binary, sampler["input"])
        keys = read_accessor(document, binary, sampler["output"])
        tracks[(channel["target"]["node"], channel["target"]["path"])] = (times, keys)
    timeline = np.unique(np.concatenate([times for times, _ in tracks.values()]))
    rotations = {}
    positions = {}
    for (node, path), (times, keys) in tracks.items():
        if path == "rotation":
            values = Rotation.from_quat(keys)
            rotations[node] = (Slerp(times, values)(np.clip(timeline, times[0], times[-1]))
                               if len(times) > 1 else values[np.zeros(len(timeline), dtype=int)])
        elif path == "translation":
            positions[node] = np.column_stack([np.interp(timeline, times, component) for component in keys.T])
    return timeline, rotations, positions


def bake_clip(source, target, transfer, source_doc, source_binary, target_doc, target_binary, clip):
    timeline, rotation_tracks, position_tracks = sample_clip(source_doc, source_binary, clip)
    target_hips = target.names[PELVIS]
    source_hips = source.names[PELVIS]
    source_floor = min(source.joint("ball_l")[1], source.joint("ball_r")[1])
    target_floor = min(target.joint("ball_l")[1], target.joint("ball_r")[1])
    source_balls = [source.names[name] for name in ("ball_l", "ball_r")]
    target_balls = [target.names[name] for name in ("ball_l", "ball_r")]
    animation = {index: [] for index in transfer}
    translations = []

    for frame in range(len(timeline)):
        source_local = {**source.rotations, **{index: values[frame] for index, values in rotation_tracks.items()}}
        source_offsets = {**source.positions, **{index: values[frame] for index, values in position_tracks.items()}}
        source_rotations, source_positions = source.world_pose(source_local, source_offsets)
        target_rotations = {}
        target_positions = {}

        for index in target.order:
            parent = target.parents[index]
            parent_rotation = target_rotations.get(parent, Rotation.identity())
            parent_position = target_positions.get(parent, np.zeros(3))
            if index in transfer:
                source_index, rest_frame = transfer[index]
                rotation = source_rotations[source_index] * rest_frame
                local = (parent_rotation.inv() * rotation).as_quat()
                if animation[index] and np.dot(local, animation[index][-1]) < 0:
                    local = -local
                animation[index].append(local)
            else:
                rotation = parent_rotation * target.rotations[index]
            position = parent_position + parent_rotation.apply(target.positions[index])
            if index == target_hips:
                position += source_positions[source_hips] - source.rest_positions[source_hips]
            target_rotations[index] = rotation
            target_positions[index] = position

        hips = target_positions[target_hips]
        if clip["name"] in GROUNDED:
            source_height = min(source_positions[index][1] for index in source_balls)
            target_height = min(target_positions[index][1] for index in target_balls)
            hips[1] += np.clip(target_floor + max(0, source_height - source_floor) - target_height, -0.13, 0.13)
        parent = target.parents[target_hips]
        translations.append(target_rotations[parent].inv().apply(hips - target_positions[parent]))

    result = {"name": clip["name"], "channels": [], "samplers": []}
    input_index = add_accessor(target_doc, target_binary, timeline, "SCALAR")
    for index, path, values in [(node, "rotation", keys) for node, keys in animation.items()] + [
        (target_hips, "translation", translations),
    ]:
        output = add_accessor(target_doc, target_binary, values, "VEC4" if path == "rotation" else "VEC3")
        result["channels"].append({"sampler": len(result["samplers"]), "target": {"node": index, "path": path}})
        result["samplers"].append({"input": input_index, "output": output})
    return result


def main():
    player = ASSETS / "campus-player.glb"
    target_doc, target_binary = read_glb(player)
    strip_baked_motion(target_doc, target_binary)
    source_doc, source_binary = read_glb(ASSETS / "campus-motion.glb")
    source = Rig(source_doc)
    target = Rig(target_doc)
    transfer = align_rest_frames(source, target)
    target_doc["animations"] = [
        bake_clip(source, target, transfer, source_doc, source_binary, target_doc, target_binary, clip)
        for clip in source_doc["animations"]
    ]
    target_doc["asset"]["extras"]["motionSource"] = "Quaternius Universal Animation Library (CC0)"
    write_glb(player, target_doc, target_binary)
    print(f"Baked {len(target_doc['animations'])} clips onto {len(transfer)} MPFB joints.")


if __name__ == "__main__":
    main()
