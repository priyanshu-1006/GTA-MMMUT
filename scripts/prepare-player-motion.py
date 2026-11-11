"""Extract the campus actions from the supplied Quaternius in-place library."""

import json
import struct
import zipfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CLIPS = {
    "Idle_Loop", "Walk_Loop", "Jog_Fwd_Loop", "Sprint_Loop",
    "Crouch_Fwd_Loop", "Crouch_Idle_Loop", "Jump_Start", "Jump_Loop",
    "Jump_Land", "Driving_Loop", "Sitting_Idle_Loop", "Idle_Talking_Loop",
}


def export_motion():
    with zipfile.ZipFile(ROOT / "Assets/Universal Animation Library[Standard].zip") as archive:
        name = next(name for name in archive.namelist() if name.endswith("/UAL1_Standard.glb"))
        source = archive.read(name)

    json_length = struct.unpack_from("<I", source, 12)[0]
    original = json.loads(source[20:20 + json_length])
    binary = source[28 + json_length:]
    nodes = [{key: value for key, value in node.items() if key not in ("mesh", "skin", "weights")}
             for node in original["nodes"]]
    result = {
        "asset": {"version": "2.0", "copyright": "Quaternius Universal Animation Library (CC0)"},
        "scene": original["scene"], "scenes": original["scenes"], "nodes": nodes,
        "animations": [], "accessors": [], "bufferViews": [],
    }
    buffer = bytearray()
    accessors = {}
    views = {}

    def copy_accessor(index):
        if index in accessors:
            return accessors[index]
        accessor = original["accessors"][index].copy()
        view_index = accessor["bufferView"]
        if view_index not in views:
            view = original["bufferViews"][view_index].copy()
            offset = view.get("byteOffset", 0)
            buffer.extend(b"\x00" * (-len(buffer) % 4))
            view["byteOffset"] = len(buffer)
            buffer.extend(binary[offset:offset + view["byteLength"]])
            views[view_index] = len(result["bufferViews"])
            result["bufferViews"].append(view)
        accessor["bufferView"] = views[view_index]
        accessors[index] = len(result["accessors"])
        result["accessors"].append(accessor)
        return accessors[index]

    for clip in original["animations"]:
        if clip["name"] not in CLIPS:
            continue
        channels, samplers = [], []
        for channel in clip["channels"]:
            target = channel["target"]
            name = nodes[target["node"]].get("name", "")
            if name.endswith("_leaf_l") or name.endswith("_leaf_r") or "_leaf" in name:
                continue
            if target["path"] != "rotation" and not (target["path"] == "translation" and name == "pelvis"):
                continue
            sampler = clip["samplers"][channel["sampler"]]
            channels.append({"sampler": len(samplers), "target": target})
            samplers.append({**sampler, "input": copy_accessor(sampler["input"]),
                             "output": copy_accessor(sampler["output"])})
        result["animations"].append({"name": clip["name"], "channels": channels, "samplers": samplers})

    if {clip["name"] for clip in result["animations"]} != CLIPS:
        raise ValueError("The source pack does not contain every required campus action")
    buffer.extend(b"\x00" * (-len(buffer) % 4))
    result["buffers"] = [{"byteLength": len(buffer)}]
    metadata = json.dumps(result, separators=(",", ":")).encode("utf-8")
    metadata += b" " * (-len(metadata) % 4)
    glb = (struct.pack("<4sII", b"glTF", 2, 28 + len(metadata) + len(buffer))
           + struct.pack("<I4s", len(metadata), b"JSON") + metadata
           + struct.pack("<I4s", len(buffer), b"BIN\0") + buffer)
    destination = ROOT / "apps/web/src/assets/player/campus-motion.glb"
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(glb)
    print(f"{len(result['animations'])} campus clips, {len(glb):,} bytes")


if __name__ == "__main__":
    export_motion()
