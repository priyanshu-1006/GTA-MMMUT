"""Build a compact crowd model from the fitted campus character and its clips."""

from copy import deepcopy
from io import BytesIO
from pathlib import Path
import runpy

import numpy as np
from PIL import Image


motion = runpy.run_path(str(Path(__file__).with_name("bake-player-motion.py")))
ASSETS = motion["ASSETS"]
CLIPS = {"Idle_Loop", "Walk_Loop", "Sitting_Idle_Loop", "Idle_Talking_Loop"}
CELL_SIZE = {"body": 0.013, "bottom": 0.027, "shoes": 0.015, "hair": 0.014}
FORMAT = {5121: "u1", 5123: "<u2", 5126: "<f4"}
COMPONENTS = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}


def build():
    source, raw = motion["read_glb"](ASSETS / "campus-player.glb")
    doc = deepcopy(source)
    doc["bufferViews"] = []
    doc["accessors"] = []
    packed = bytearray()
    copied = {}
    source_triangles = 0
    crowd_triangles = 0

    def append(data, target=None):
        packed.extend(b"\0" * (-len(packed) % 4))
        view = {"buffer": 0, "byteOffset": len(packed), "byteLength": len(data)}
        if target:
            view["target"] = target
        packed.extend(data)
        doc["bufferViews"].append(view)
        return len(doc["bufferViews"]) - 1

    def read(index):
        acc = source["accessors"][index]
        view = source["bufferViews"][acc["bufferView"]]
        count = acc["count"]
        size = COMPONENTS[acc["type"]]
        start = view.get("byteOffset", 0) + acc.get("byteOffset", 0)
        return np.frombuffer(raw, FORMAT[acc["componentType"]], count * size, start).reshape(count, size)

    def copy_accessor(index):
        if index not in copied:
            acc = deepcopy(source["accessors"][index])
            view = source["bufferViews"][acc["bufferView"]]
            start = view.get("byteOffset", 0)
            acc["bufferView"] = append(raw[start:start + view["byteLength"]], view.get("target"))
            copied[index] = len(doc["accessors"])
            doc["accessors"].append(acc)
        return copied[index]

    def write_attribute(values, original):
        acc = deepcopy(source["accessors"][original])
        view = source["bufferViews"][acc["bufferView"]]
        values = values.astype(FORMAT[acc["componentType"]])
        acc["bufferView"] = append(values.tobytes(), view.get("target"))
        acc.pop("byteOffset", None)
        acc["count"] = len(values)
        for name, fn in (("min", np.min), ("max", np.max)):
            if name in acc:
                acc[name] = fn(values, axis=0).reshape(-1).tolist()
        doc["accessors"].append(acc)
        return len(doc["accessors"]) - 1

    for source_mesh, mesh in zip(source["meshes"], doc["meshes"]):
        for original, primitive in zip(source_mesh["primitives"], mesh["primitives"]):
            attributes = original["attributes"]
            positions = read(attributes["POSITION"])
            triangles = read(original["indices"]).reshape(-1, 3)
            source_triangles += len(triangles)
            material = source["materials"][primitive["material"]]["name"]
            cell = CELL_SIZE.get(material)
            if not cell:
                primitive["indices"] = copy_accessor(original["indices"])
                primitive["attributes"] = {name: copy_accessor(index) for name, index in attributes.items()}
                crowd_triangles += len(triangles)
                continue

            # Keep distant UV islands separate when surfaces share the same vertex cell.
            uv = read(attributes["TEXCOORD_0"])
            key = np.column_stack([np.floor(positions / cell), np.floor(uv / 0.24)])
            _, groups = np.unique(key, axis=0, return_inverse=True)
            remapped = groups[triangles]
            valid = ((remapped[:, 0] != remapped[:, 1]) & (remapped[:, 0] != remapped[:, 2]) &
                     (remapped[:, 1] != remapped[:, 2]))
            faces = remapped[valid]
            _, distinct = np.unique(np.sort(faces, axis=1), axis=0, return_index=True)
            faces = faces[np.sort(distinct)]
            active, compact = np.unique(faces, return_inverse=True)
            crowd_triangles += len(faces)
            counts = np.bincount(groups)

            def mean(values):
                return np.column_stack([np.bincount(groups, weights=column) / counts for column in values.T])

            centroids = mean(positions)
            distance = np.sum((positions - centroids[groups]) ** 2, axis=1)
            order = np.lexsort((distance, groups))
            _, starts = np.unique(groups[order], return_index=True)
            representatives = order[starts][active]
            output = {}
            for name, index in attributes.items():
                if name == "POSITION":
                    values = centroids[active]
                elif name in ("NORMAL", "TEXCOORD_0"):
                    values = mean(read(index))[active]
                    if name == "NORMAL":
                        values /= np.maximum(1e-8, np.linalg.norm(values, axis=1, keepdims=True))
                else:
                    values = read(index)[representatives]
                output[name] = write_attribute(values, index)
            primitive["attributes"] = output
            primitive["indices"] = write_attribute(compact.reshape(-1, 1), original["indices"])

    for skin in doc["skins"]:
        skin["inverseBindMatrices"] = copy_accessor(skin["inverseBindMatrices"])
    for original, image in zip(source["images"], doc["images"]):
        view = source["bufferViews"][original["bufferView"]]
        start = view.get("byteOffset", 0)
        buffer = BytesIO()
        with Image.open(BytesIO(raw[start:start + view["byteLength"]])) as texture:
            texture.thumbnail((384, 384), Image.Resampling.LANCZOS)
            if original["mimeType"] == "image/png":
                texture.save(buffer, format="PNG", optimize=True)
            else:
                texture.convert("RGB").save(buffer, format="JPEG", quality=86, optimize=True)
        image["bufferView"] = append(buffer.getvalue())
    doc["animations"] = [clip for clip in doc["animations"] if clip["name"] in CLIPS]
    for clip in doc["animations"]:
        for sampler in clip["samplers"]:
            sampler["input"] = copy_accessor(sampler["input"])
            sampler["output"] = copy_accessor(sampler["output"])
    add_gesture(source, raw, doc, packed, "Sitting_Idle_Loop", "Gate_Register_Loop", register_hand)
    add_gesture(source, raw, doc, packed, "Idle_Talking_Loop", "Campus_Chant_Loop", chant_hand)
    doc["asset"]["generator"] = "GTA MMMUT crowd asset preparation"
    doc["asset"]["extras"]["derivative"] = "Reduced mesh and texture sizes, reused character poses, added register and chant gestures"
    packed.extend(b"\0" * (-len(packed) % 4))
    crowd = ASSETS / "campus-crowd.glb"
    motion["write_glb"](crowd, doc, packed)
    print(f"Crowd model: {crowd_triangles:,}/{source_triangles:,} triangles, {crowd.stat().st_size:,} bytes")


def register_hand(t, side, hand):
    if side == "l":
        return np.array([0.16, 0.79, 0.24])
    return np.array([-0.11 + 0.055 * np.sin(2 * np.pi * t), 0.81, 0.25 + 0.03 * np.sin(4 * np.pi * t)])


def chant_hand(t, side, hand):
    lift = max(0, np.sin(4 * np.pi * t)) ** 1.4
    if side == "r":
        return hand + np.array([-0.015, 0.18 * lift, 0.07 * lift])
    return hand + np.array([0.025, 0.06 * lift, 0.035 * lift])


def add_gesture(source, raw, doc, packed, source_name, new_name, hand_pose):
    clip = next(clip for clip in source["animations"] if clip["name"] == source_name)
    rig = motion["Rig"](source)
    times, rotations, positions = motion["sample_clip"](source, raw, clip)
    unit = motion["unit"]
    rotation_type = motion["Rotation"]
    frames = {index: values.as_quat() for index, values in rotations.items()}

    for frame, time in enumerate(times):
        local = {**rig.rotations, **{index: values[frame] for index, values in rotations.items()}}
        shifts = {**rig.positions, **{index: values[frame] for index, values in positions.items()}}
        world, joints = rig.world_pose(local, shifts)
        for side in ("l", "r"):
            shoulder, elbow, wrist = [rig.names[f"{part}_{side}"] for part in ("upperarm", "lowerarm", "hand")]
            shoulder_at, elbow_at, wrist_at = [joints[joint] for joint in (shoulder, elbow, wrist)]
            desired = hand_pose(float(time / times[-1]), side, wrist_at)
            upper = np.linalg.norm(elbow_at - shoulder_at)
            lower = np.linalg.norm(wrist_at - elbow_at)
            direction = unit(desired - shoulder_at)
            reach = np.clip(np.linalg.norm(desired - shoulder_at), abs(upper - lower) + 0.001, upper + lower - 0.001)
            along = (upper ** 2 - lower ** 2 + reach ** 2) / (2 * reach)
            bend = elbow_at - shoulder_at - direction * np.dot(elbow_at - shoulder_at, direction)
            elbow_new = shoulder_at + direction * along + unit(bend) * np.sqrt(max(0, upper ** 2 - along ** 2))
            wrist_new = shoulder_at + direction * reach
            arm_delta, _ = rotation_type.align_vectors([unit(elbow_new - shoulder_at)], [unit(elbow_at - shoulder_at)])
            hand_delta, _ = rotation_type.align_vectors([unit(wrist_new - elbow_new)], [unit(wrist_at - elbow_at)])
            shoulder_rotation = arm_delta * world[shoulder]
            elbow_rotation = hand_delta * world[elbow]
            wrist_rotation = hand_delta * world[wrist]
            frames[shoulder][frame] = (world[rig.parents[shoulder]].inv() * shoulder_rotation).as_quat()
            frames[elbow][frame] = (shoulder_rotation.inv() * elbow_rotation).as_quat()
            frames[wrist][frame] = (elbow_rotation.inv() * wrist_rotation).as_quat()

    add = motion["add_accessor"]
    timing = add(doc, packed, times, "SCALAR")
    result = {"name": new_name, "samplers": [], "channels": []}
    for path, tracks, shape in (("rotation", frames, "VEC4"), ("translation", positions, "VEC3")):
        for index, values in tracks.items():
            result["channels"].append({"sampler": len(result["samplers"]), "target": {"node": index, "path": path}})
            result["samplers"].append({"input": timing, "output": add(doc, packed, values, shape)})
    doc["animations"].append(result)


if __name__ == "__main__":
    build()
