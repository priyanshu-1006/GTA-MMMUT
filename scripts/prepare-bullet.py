"""Build the runtime Bullet from the supplied CC BY 4.0 GLB.

Asset preparation uses numpy and fast-simplification==0.1.13. Run from the repo root.
"""

import json
import struct
from pathlib import Path

import fast_simplification
import numpy as np


SOURCE = Path("Assets/royal_enfield.glb")
OUTPUT = Path("apps/web/src/assets/vehicles/royal-enfield-bullet.glb")
FRONT_AXLE = np.array([0, -7.843, 3.339])
REAR_AXLE = np.array([0, 6.651, 3.738])
SCALE = 1.385 / (REAR_AXLE[1] - FRONT_AXLE[1])
MIDPOINT = (FRONT_AXLE[1] + REAR_AXLE[1]) / 2
MATERIALS = (
    ("Paint", "#692627", 0.34, 0.40),
    ("Chrome", "#bac0bd", 0.74, 0.31),
    ("Engine and frame", "#41454a", 0.52, 0.45),
    ("Tire rubber", "#242527", 0.05, 0.88),
    ("Seat leather", "#302926", 0.04, 0.70),
    ("Headlamp", "#eadcb0", 0.25, 0.28),
    ("Tail light", "#a42622", 0.12, 0.42),
    ("Tank trim", "#bd9052", 0.44, 0.50),
)


def read_accessor(document, binary, index):
    accessor = document["accessors"][index]
    view = document["bufferViews"][accessor["bufferView"]]
    offset = view.get("byteOffset", 0) + accessor.get("byteOffset", 0)
    dtype = {5123: "<u2", 5125: "<u4", 5126: "<f4"}[accessor["componentType"]]
    width = {"SCALAR": 1, "VEC3": 3}[accessor["type"]]
    assert view.get("byteStride", width * np.dtype(dtype).itemsize) == width * np.dtype(dtype).itemsize
    return np.frombuffer(binary, dtype, accessor["count"] * width, offset).reshape(-1, width)


def wheel_mask(triangles, axle, radius):
    radial = np.linalg.norm(triangles[:, :, 1:] - axle[1:], axis=2)
    return (radial.max(axis=1) < radius) & (np.abs(triangles[:, :, 0]).max(axis=1) < 0.88)


def body_triangles(document, binary):
    chunks = []
    for index, mesh in enumerate(document["meshes"]):
        for primitive in mesh["primitives"]:
            positions = read_accessor(document, binary, primitive["attributes"]["POSITION"])
            triangles = positions[read_accessor(document, binary, primitive["indices"]).reshape(-1, 3)]
            front = wheel_mask(triangles, FRONT_AXLE, 3.42)
            rear = wheel_mask(triangles, REAR_AXLE, 3.59)
            # The two front forks overlap the wheel's side projection.
            if index in (131, 132):
                front[:] = False
            centers = triangles.mean(axis=1)
            # Remove the deployed stand beneath the frame of the parked source model.
            stand = (centers[:, 1] > -0.03) & (centers[:, 1] < 1.8) & (centers[:, 2] < 1.6)
            chunks.append(triangles[~(front | rear | stand)])
    return np.concatenate(chunks)


def simplify(triangles, ratio):
    points, inverse = np.unique(np.round(triangles.reshape(-1, 3), 4), axis=0, return_inverse=True)
    faces = inverse.reshape(-1, 3)
    faces = faces[(faces[:, 0] != faces[:, 1]) & (faces[:, 1] != faces[:, 2]) & (faces[:, 2] != faces[:, 0])]
    return fast_simplification.simplify(points, faces, target_count=round(len(faces) * ratio), agg=6)


def body_materials(positions, faces):
    triangles = positions[faces]
    x, y, z = triangles.mean(axis=1).T
    ids = np.full(len(faces), 2)
    ids[(np.abs(x) > 0.66) & (z < 7.7)] = 1
    ids[(y < -3.2) & (z > 4.1)] = 1
    ids[(z > 9.8) & (y < -1.0)] = 1
    tank = (y > -3.85) & (y < 1.45) & (z > 7.6) & (z < 10.08)
    front_fender = (y < -4.9) & (z > 4.55) & (z < 7.3) & (np.abs(x) < 0.83)
    rear_fender = (y > 3.0) & (z > 5.8) & (z < 8.1) & (np.abs(x) < 0.9)
    side_cover = (y > 2.05) & (y < 4.9) & (z > 4.2) & (z < 7.15) & (np.abs(x) > 0.79)
    ids[tank | front_fender | rear_fender | side_cover] = 0
    ids[(y > 0.82) & (y < 5.65) & (z > 8.0) & (z < 9.08)] = 4
    ids[(y < -5.04) & (z > 9.3) & (z < 10.92)] = 5
    ids[(y > 10.62) & (z > 5.7) & (z < 7.1)] = 6
    ids[tank & (np.abs(x) > 1.39) & (y > -0.86) & (y < 0.8) & (z > 8.35) & (z < 9.3)] = 7
    return ids


def wheel(axle, radius):
    """Build a rim and spoke assembly around the measured source axle."""
    positions, indices, materials = [], [], []

    def part(points, faces, material):
        indices.extend(tuple(len(positions) + index for index in face) for face in faces)
        positions.extend(np.asarray(points) + axle)
        materials.extend([material] * len(faces))

    def torus(center, major, tube, half_width, material):
        radial_steps, section_steps = 52, 10
        points, faces = [], []
        for major_angle in np.linspace(0, 2 * np.pi, radial_steps, endpoint=False):
            for angle in np.linspace(0, 2 * np.pi, section_steps, endpoint=False):
                ring = major + tube * np.cos(angle)
                points.append((center + half_width * np.sin(angle), ring * np.cos(major_angle), ring * np.sin(major_angle)))
        for radial in range(radial_steps):
            for section in range(section_steps):
                a = radial * section_steps + section
                b = ((radial + 1) % radial_steps) * section_steps + section
                c = ((radial + 1) % radial_steps) * section_steps + (section + 1) % section_steps
                d = radial * section_steps + (section + 1) % section_steps
                faces.extend(((a, b, c), (a, c, d)))
        part(points, faces, material)

    def tube(start, end, radius, material, segments):
        direction = np.asarray(end) - start
        direction /= np.linalg.norm(direction)
        axis = np.array([0, 1, 0]) if abs(direction[0]) > 0.9 else np.array([1, 0, 0])
        tangent = np.cross(direction, axis)
        tangent /= np.linalg.norm(tangent)
        bitangent = np.cross(direction, tangent)
        ring = [radius * (tangent * np.cos(angle) + bitangent * np.sin(angle))
                for angle in np.linspace(0, 2 * np.pi, segments, endpoint=False)]
        points = [np.asarray(center) + offset for center in (start, end) for offset in ring] + [start, end]
        faces = []
        for index in range(segments):
            next_index = (index + 1) % segments
            faces.extend(((index, next_index, next_index + segments), (index, next_index + segments, index + segments),
                          (2 * segments, next_index, index), (2 * segments + 1, index + segments, next_index + segments)))
        part(points, faces, material)

    torus(0, radius - 0.37, 0.37, 0.56, 3)
    for side in (-1, 1):
        torus(side * 0.29, radius - 0.68, 0.12, 0.08, 1)
    tube((-0.54, 0., 0.), (0.54, 0., 0.), 0.72, 2, 26)
    for side in (-1, 1):
        for index, angle in enumerate(np.linspace(0, 2 * np.pi, 18, endpoint=False)):
            start_angle = angle + (0.23 if index % 2 else -0.23)
            rim = radius - 0.68
            tube((side * 0.45, 0.64 * np.cos(start_angle), 0.64 * np.sin(start_angle)),
                 (-side * 0.23, rim * np.cos(angle), rim * np.sin(angle)), 0.033, 1, 6)
    return np.asarray(positions), np.asarray(indices), np.asarray(materials)


def world_positions(source):
    return np.column_stack((source[:, 0], source[:, 2], MIDPOINT - source[:, 1])) * SCALE


def normals_for(points, faces):
    vertices = points[faces]
    normals = np.cross(vertices[:, 1] - vertices[:, 0], vertices[:, 2] - vertices[:, 0])
    result = np.zeros_like(points)
    for corner in range(3):
        np.add.at(result, faces[:, corner], normals)
    length = np.linalg.norm(result, axis=1, keepdims=True)
    return result / np.maximum(length, 1e-8)


def srgb_to_linear(hex_color):
    values = [int(hex_color[start:start + 2], 16) / 255 for start in (1, 3, 5)]
    return [value / 12.92 if value < 0.04045 else ((value + 0.055) / 1.055) ** 2.4 for value in values]


def build(source, binary):
    output = {
        "asset": {"version": "2.0", "generator": "GTA MMMUT Bullet preparation", "extras": source["asset"]["extras"]},
        "scene": 0,
        "scenes": [{"nodes": [0, 1, 2]}],
        "nodes": [], "meshes": [], "bufferViews": [], "accessors": [], "buffers": [],
        "materials": [{"name": name, "doubleSided": True, "pbrMetallicRoughness": {
            "baseColorFactor": [*srgb_to_linear(color), 1], "metallicFactor": metal, "roughnessFactor": rough,
        }} for name, color, metal, rough in MATERIALS],
    }
    packed = bytearray()

    def accessor(data, dtype, component, target, kind, bounds=False):
        packed.extend(bytes((-len(packed)) % 4))
        offset = len(packed)
        encoded = np.asarray(data, dtype=dtype).tobytes()
        packed.extend(encoded)
        view = len(output["bufferViews"])
        output["bufferViews"].append({"buffer": 0, "byteOffset": offset, "byteLength": len(encoded), "target": target})
        index = len(output["accessors"])
        result = {"bufferView": view, "componentType": component, "count": len(data), "type": kind}
        if bounds:
            result.update(min=data.min(axis=0).tolist(), max=data.max(axis=0).tolist())
        output["accessors"].append(result)
        return index

    points, faces = simplify(body_triangles(source, binary), 0.23)
    parts = {
        "body": (points, faces, body_materials(points, faces), None),
        "wheel-front": (*wheel(FRONT_AXLE, 3.34), FRONT_AXLE),
        "wheel-rear": (*wheel(REAR_AXLE, 3.50), REAR_AXLE),
    }
    count = 0
    for name, (points, faces, ids, axle) in parts.items():
        index = len(output["nodes"])
        local = world_positions(points)
        pivot = world_positions(axle[None])[0] if axle is not None else np.zeros(3)
        local -= pivot
        count += len(faces)
        indices = ("<u2", 5123) if len(points) <= 65536 else ("<u4", 5125)
        attrs = {"POSITION": accessor(local, "<f4", 5126, 34962, "VEC3", True),
                 "NORMAL": accessor(normals_for(local, faces), "<f4", 5126, 34962, "VEC3")}
        primitives = [{"attributes": attrs, "indices": accessor(faces[ids == mat].reshape(-1), *indices, 34963, "SCALAR"),
                       "material": int(mat)} for mat in np.unique(ids)]
        output["nodes"].append({"name": name, "mesh": index, "translation": pivot.tolist()})
        output["meshes"].append({"name": name, "primitives": primitives})

    packed.extend(bytes((-len(packed)) % 4))
    output["buffers"].append({"byteLength": len(packed)})
    text = json.dumps(output, separators=(",", ":")).encode()
    text += b" " * ((-len(text)) % 4)
    header = struct.pack("<4sIIII", b"glTF", 2, 28 + len(text) + len(packed), len(text), 0x4E4F534A)
    OUTPUT.write_bytes(header + text + struct.pack("<II", len(packed), 0x004E4942) + packed)
    print(f"{OUTPUT}: {count:,} triangles, {OUTPUT.stat().st_size:,} bytes")


if __name__ == "__main__":
    data = SOURCE.read_bytes()
    json_length = struct.unpack_from("<I", data, 12)[0]
    build(json.loads(data[20:20 + json_length]), data[28 + json_length:])
