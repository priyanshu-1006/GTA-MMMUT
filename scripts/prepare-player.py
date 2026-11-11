"""Prepare the dressed campus avatar from the supplied MPFB source archives.

Run from the repository root with Python, NumPy, SciPy, and Pillow.
The exporter reads archives in place and writes only browser-ready GLB/WebP files.
"""

from collections import defaultdict
from gzip import decompress
from io import BytesIO
import json
from pathlib import Path, PurePosixPath
from struct import pack
from zipfile import ZipFile

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageOps
from scipy.spatial import cKDTree
from scipy.spatial.transform import Rotation


ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "Assets"
OUTPUT = ROOT / "apps/web/src/assets/player"
WEARABLES = {
    "top": ("shirts01_cc0.zip", "namuhekam_male_polo_shirt", "CC0-1.0"),
    "bottom": ("pants02_ccby (1).zip", "punkduck_male_classic_jeans", "CC-BY-4.0"),
    "shoes": ("shoes02_ccby.zip", "punkduck_running_shoes_01", "CC-BY-3.0"),
    "hair": ("hair01_cc0 (1).zip", "cortu_short_messy_hair", "CC0-1.0"),
}
SKINS = {
    "skin-indian": ("skins01_cc0.zip", "cutoff3d_indian_female_enhanced"),
    "skin-mid-tone": ("skins01_cc0.zip", "callharvey3d_midtoned_female"),
    "skin-eurasian": ("skins01_cc0.zip", "onlytheghosts_young_eurasian_female"),
    "skin-bronze": ("skins02_cc0.zip", "toigo_light_skin_male_bronze"),
    "skin-freckled": ("skins02_cc0.zip", "toigo_light_skin_male_freckles"),
    "skin-deep": ("skins02_cc0.zip", "mindfront_skin_male_african_middleage"),
}
DEFAULT_SKIN = "skin-bronze"


def obj(source):
    """Read positions, UVs, and grouped triangle fans in native MakeHuman axes."""
    vertices, uv = [], []
    faces = defaultdict(list)
    group = "mesh"
    for line in source.decode().splitlines():
        columns = line.split()
        if not columns:
            continue
        key, *values = columns
        if key == "v":
            vertices.append([float(value) for value in values[:3]])
        elif key == "vt":
            uv.append([float(values[0]), 1 - float(values[1])])
        elif key == "g":
            group = values[0]
        elif key == "f":
            corners = []
            for value in values:
                vi, ti, *_ = value.split("/") + [""]
                vertex = int(vi)
                texcoord = int(ti) if ti else 0
                corners.append((vertex - 1 if vertex > 0 else len(vertices) + vertex,
                                texcoord - 1 if texcoord > 0 else len(uv) + texcoord if texcoord else -1))
            for i in range(1, len(corners) - 1):
                faces[group].append((corners[0], corners[i], corners[i + 1]))
    return np.array(vertices, dtype=float), np.array(uv, dtype=float), faces


def asset_member(archive, key, suffix):
    return next(PurePosixPath(member) for member in archive.namelist()
                if f"/{key}/" in member and member.endswith(suffix))


def read_asset_texture(archive, material):
    diffuse = next(line.split(maxsplit=1)[1].strip()
                   for line in archive.read(str(material)).decode().splitlines()
                   if line.startswith("diffuseTexture "))
    return Image.open(BytesIO(archive.read(str(material.parent / diffuse)))).copy()


def credit(archive, key, license_id):
    catalog = next(name for name in archive.namelist() if name.startswith("packs/") and name.endswith(".json"))
    entry = json.loads(archive.read(catalog))[key]
    license_urls = {"CC0-1.0": "https://creativecommons.org/publicdomain/zero/1.0/",
                    "CC-BY-4.0": "https://creativecommons.org/licenses/by/4.0/",
                    "CC-BY-3.0": "https://creativecommons.org/licenses/by/3.0/"}
    return {"author": entry["author"], "source": entry["source"], "license": license_id,
            "licenseUrl": license_urls[license_id]}


def fit_wearable(role, base, body_weights):
    filename, key, license_id = WEARABLES[role]
    with ZipFile(ASSETS / filename) as archive:
        definition = asset_member(archive, key, ".mhclo")
        options, mapping, deleted = {}, [], set()
        section = "header"
        previous = None
        in_range = False
        for line in archive.read(str(definition)).decode().splitlines():
            tokens = line.split("#", 1)[0].split()
            if not tokens:
                continue
            if tokens[0] in ("verts", "delete_verts"):
                section = tokens[0]
                continue
            if section == "header":
                options[tokens[0]] = tokens[1:]
            elif section == "verts":
                mapping.append(tokens)
            else:
                for token in tokens:
                    if token == "-":
                        in_range = True
                    elif token.isdecimal():
                        vertex = int(token)
                        if in_range and previous is not None:
                            deleted.update(range(previous, vertex + 1))
                        else:
                            deleted.add(vertex)
                        previous = vertex
                        in_range = False
        mesh_path = definition.parent / " ".join(options["obj_file"])
        _, uv, faces = obj(archive.read(str(mesh_path)))
        scales = np.ones(3)
        for axis, letter in enumerate("xyz"):
            if letter + "_scale" in options:
                first, second, length = options[letter + "_scale"]
                scales[axis] = abs(base[int(first), axis] - base[int(second), axis]) / float(length)
        vertices = []
        weights = []
        for row in mapping:
            if len(row) == 1:
                vertex = int(row[0])
                vertices.append(base[vertex])
                weights.append(body_weights[vertex])
                continue
            if len(row) != 9:
                raise ValueError(f"Unexpected {role} vertex binding: {row}")
            indices = np.array(row[:3], dtype=int)
            coefficients = np.array(row[3:6], dtype=float)
            offset = np.array(row[6:9], dtype=float) * scales
            vertices.append(coefficients @ base[indices] + offset)
            weights.append(np.maximum(coefficients @ body_weights[indices], 0))
        material = definition.parent / " ".join(options["material"])
        image = read_asset_texture(archive, material)
        source = credit(archive, key, license_id)
        source["title"] = " ".join(options["name"])
    return np.array(vertices), uv, sum(faces.values(), []), np.array(weights), image, deleted, source


def encode(image, format_name, size, **options):
    copy = image.copy()
    copy.thumbnail((size, size), Image.Resampling.LANCZOS)
    buffer = BytesIO()
    copy.save(buffer, format_name, **options)
    return buffer.getvalue()


def visible_skin(image, uv, faces):
    # Omit unrelated atlas regions that the dressed character cannot display.
    image = image.convert("RGB").resize((1024, 1024), Image.Resampling.LANCZOS)
    mask = Image.new("L", image.size)
    paint = ImageDraw.Draw(mask)
    for face in faces:
        paint.polygon([tuple((uv[texcoord] * 1023).tolist()) for _, texcoord in face], fill=255)
    backing = Image.new("RGB", image.size, tuple(image.resize((1, 1)).getpixel((0, 0))))
    return Image.composite(image, backing, mask.filter(ImageFilter.MaxFilter(7)))


class Glb:
    def __init__(self):
        self.document = {"asset": {"version": "2.0", "generator": "GTA MMMUT offline player preparation"},
                         "scene": 0, "scenes": [{"nodes": [0]}], "nodes": [{"name": "campus-player", "children": []}],
                         "buffers": [], "bufferViews": [], "accessors": [], "materials": [],
                         "meshes": [], "textures": [], "images": [], "skins": []}
        self.binary = bytearray()

    def add(self, collection, value):
        self.document[collection].append(value)
        return len(self.document[collection]) - 1

    def bytes(self, data, target=None):
        self.binary.extend(b"\0" * (-len(self.binary) % 4))
        view = {"buffer": 0, "byteOffset": len(self.binary), "byteLength": len(data)}
        if target:
            view["target"] = target
        self.binary.extend(data)
        return self.add("bufferViews", view)

    def accessor(self, data, shape, component_type, dtype, target=None, bounds=False):
        data = np.asarray(data, dtype=dtype)
        accessor = {"bufferView": self.bytes(data.tobytes(), target), "componentType": component_type,
                    "count": len(data), "type": shape}
        if bounds:
            accessor.update(min=data.min(axis=0).tolist(), max=data.max(axis=0).tolist())
        return self.add("accessors", accessor)

    def material(self, name, roughness, texture=None, color=None, alpha=False):
        pbr = {"metallicFactor": 0, "roughnessFactor": roughness}
        if texture:
            data, mime_type = texture
            image = self.add("images", {"name": name, "bufferView": self.bytes(data), "mimeType": mime_type})
            pbr["baseColorTexture"] = {"index": self.add("textures", {"source": image})}
        if color:
            pbr["baseColorFactor"] = color
        material = {"name": name, "pbrMetallicRoughness": pbr}
        if alpha:
            material.update(alphaMode="MASK", alphaCutoff=0.45, doubleSided=True)
        return self.add("materials", material)

    def mesh(self, name, vertices, uv, faces, weights, material):
        # Average normals on geometric vertices before splitting UV seams.
        position_indices = np.array([[corner[0] for corner in face] for face in faces])
        triangles = vertices[position_indices]
        face_normals = np.cross(triangles[:, 1] - triangles[:, 0], triangles[:, 2] - triangles[:, 0])
        normals = np.zeros_like(vertices)
        for column in range(3):
            np.add.at(normals, position_indices[:, column], face_normals)
        normals /= np.maximum(np.linalg.norm(normals, axis=1, keepdims=True), 1e-12)
        corners = dict.fromkeys(corner for face in faces for corner in face)
        remap = {corner: i for i, corner in enumerate(corners)}
        indices = [remap[corner] for face in faces for corner in face]
        vi, ti = np.array(list(corners)).T
        joint_ids = np.argsort(weights[vi], axis=1)[:, -4:][:, ::-1]
        joint_weights = np.take_along_axis(weights[vi], joint_ids, axis=1)
        totals = joint_weights.sum(axis=1)
        if np.any(totals <= 0):
            raise ValueError(f"Unweighted vertices in {name}")
        joint_weights /= totals[:, None]
        attributes = {"POSITION": self.accessor(vertices[vi], "VEC3", 5126, "<f4", 34962, True),
                      "NORMAL": self.accessor(normals[vi], "VEC3", 5126, "<f4", 34962),
                      "JOINTS_0": self.accessor(joint_ids, "VEC4", 5121, "u1", 34962),
                      "WEIGHTS_0": self.accessor(joint_weights, "VEC4", 5126, "<f4", 34962)}
        if len(uv):
            if np.any(ti < 0):
                raise ValueError(f"Missing UV coordinates in {name}")
            attributes["TEXCOORD_0"] = self.accessor(uv[ti], "VEC2", 5126, "<f4", 34962)
        primitive = {"attributes": attributes, "indices": self.accessor(indices, "SCALAR", 5123, "<u2", 34963),
                     "material": material}
        mesh = self.add("meshes", {"name": name, "primitives": [primitive]})
        node = self.add("nodes", {"name": name, "mesh": mesh, "skin": 0})
        self.document["nodes"][0]["children"].append(node)
        print(f"{name}: {len(faces):,} triangles, {len(corners):,} vertices")

    def write(self, path):
        self.binary.extend(b"\0" * (-len(self.binary) % 4))
        self.document["buffers"] = [{"byteLength": len(self.binary)}]
        header = json.dumps(self.document, separators=(",", ":"), allow_nan=False).encode()
        header += b" " * (-len(header) % 4)
        data = (pack("<4sII", b"glTF", 2, 28 + len(header) + len(self.binary))
                + pack("<I4s", len(header), b"JSON") + header
                + pack("<I4s", len(self.binary), b"BIN\0") + self.binary)
        path.write_bytes(data)


def axes(direction, roll):
    # Build Y-aligned local bone frames with the MPFB roll in its Blender-axis basis.
    y_up_to_blender = np.array([[1, 0, 0], [0, 0, -1], [0, 1, 0]])
    direction = y_up_to_blender @ direction
    length = np.linalg.norm(direction)
    if length < 1e-8:
        return np.eye(3)
    y_axis = np.array([0, 1, 0])
    unit = direction / length
    cross = np.cross(y_axis, unit)
    dot = np.clip(y_axis @ unit, -1, 1)
    norm = np.linalg.norm(cross)
    if norm > 1e-9:
        aligned = Rotation.from_rotvec(cross * np.arccos(dot) / norm)
    else:
        aligned = Rotation.from_rotvec([np.pi if dot < 0 else 0, 0, 0])
    return y_up_to_blender.T @ (aligned * Rotation.from_rotvec([0, roll, 0])).as_matrix()


def add_skeleton(model, base, rig, group_indices, ground):
    def coordinate(spec):
        vertices = group_indices[spec["cube_name"]] if spec["strategy"] == "CUBE" else spec["vertex_indices"]
        return base[vertices].mean(axis=0) * 0.1 - ground

    joints, rest = {}, {}
    for name, bone in rig.items():
        world = np.eye(4)
        if bone["parent"]:
            world[:3, 3] = coordinate(bone["head"])
            world[:3, :3] = axes(coordinate(bone["tail"]) - world[:3, 3], bone["roll"])
        rest[name] = world
        joints[name] = model.add("nodes", {"name": name})
    for name, bone in rig.items():
        parent = bone["parent"]
        local = np.linalg.solve(rest[parent], rest[name]) if parent else rest[name]
        node = model.document["nodes"][joints[name]]
        node["translation"] = local[:3, 3].tolist()
        node["rotation"] = Rotation.from_matrix(local[:3, :3]).as_quat().tolist()
        parent_node = joints[parent] if parent else 0
        model.document["nodes"][parent_node].setdefault("children", []).append(joints[name])
    inverses = [np.linalg.inv(matrix).T.flatten() for matrix in rest.values()]
    accessor = model.accessor(inverses, "MAT4", 5126, "<f4")
    model.add("skins", {"name": "MPFB game_engine", "skeleton": joints["Root"],
                        "joints": list(joints.values()), "inverseBindMatrices": accessor})


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    with ZipFile(ASSETS / "add-on-mpfb-v2.0.18.zip") as archive:
        base, body_uv, groups = obj(archive.read("data/3dobjs/base.obj"))
        group_indices = {key: [vertex for first, last in ranges for vertex in range(first, last + 1)]
                         for key, ranges in json.loads(archive.read("data/mesh_metadata/basemesh_vertex_groups.json")).items()}
        rig = json.loads(archive.read("data/rigs/standard/rig.game_engine.json"))
        weights = json.loads(archive.read("data/rigs/standard/weights.game_engine.json"))["weights"]
        # Blend CC0 adult MakeHuman targets without baking a skin texture into the shape.
        for ancestry, amount in [("asian", 0.58), ("caucasian", 0.28), ("african", 0.14)]:
            member = f"data/targets/macrodetails/{ancestry}-male-young.target.gz"
            for row in decompress(archive.read(member)).decode().splitlines():
                columns = row.split()
                if len(columns) == 4 and columns[0].isdigit():
                    vertex, *delta = columns
                    base[int(vertex)] += np.array(delta, dtype=float) * amount
    body_weights = np.zeros((len(base), len(rig)), dtype=float)
    for column, name in enumerate(rig):
        for index, weight in weights[name]:
            body_weights[index, column] = weight
    weighted = body_weights.sum(axis=1) > 0
    neighbors = cKDTree(base[weighted]).query(base[~weighted])[1]
    body_weights[~weighted] = body_weights[weighted][neighbors]
    body_weights /= body_weights.sum(axis=1, keepdims=True)

    outfit = {role: fit_wearable(role, base, body_weights) for role in WEARABLES}
    shirt = outfit["top"][0]
    jeans = outfit["bottom"][0]
    # Ease the lower polo over the jeans waistband so both fitted layers remain visible.
    waist = jeans[:, 1].max()
    waist_depth = np.median(jeans[jeans[:, 1] > waist - 0.5, 2])
    ease = 1 + 0.12 * np.clip((waist + 0.65 - shirt[:, 1]) / 0.65, 0, 1)
    shirt[:, 0] *= ease
    shirt[:, 2] = waist_depth + (shirt[:, 2] - waist_depth) * ease
    covered = set.union(*(part[5] for part in outfit.values()))
    ground = np.array([0, outfit["shoes"][0][:, 1].min() * 0.1, 0])
    shirt_bottom = outfit["top"][0][:, 1].min()
    # The polo has no authored delete group. Remove skin well inside the clothed torso.
    covered.update(np.flatnonzero((abs(base[:, 0]) < 1.45) & (base[:, 1] > shirt_bottom + 0.28) & (base[:, 1] < 4.9)))
    body_faces = [face for face in groups["body"] if not any(corner[0] in covered for corner in face)]
    print("Source body and fitted bounds (dm):", base[group_indices["body"]].min(axis=0),
          base[group_indices["body"]].max(axis=0))
    for role, (vertices, *_rest) in outfit.items():
        print(role, vertices.min(axis=0), vertices.max(axis=0))

    model = Glb()
    add_skeleton(model, base, rig, group_indices, ground)
    sources = {"body": {"author": "MakeHuman Community", "license": "CC0-1.0",
                        "source": "https://www.makehumancommunity.org/about/license.html"}}
    skin_files = {}
    for skin, (filename, key) in SKINS.items():
        with ZipFile(ASSETS / filename) as archive:
            image = visible_skin(read_asset_texture(archive, asset_member(archive, key, ".mhmat")), body_uv, body_faces)
            sources[skin] = credit(archive, key, "CC0-1.0")
        skin_files[skin] = encode(image, "WEBP", 1024, quality=85, method=5)
        if skin == DEFAULT_SKIN:
            material = model.material("body", 0.74, (encode(image, "JPEG", 1024, quality=89, optimize=True), "image/jpeg"))
            model.mesh("body", base * 0.1 - ground, body_uv, body_faces, body_weights, material)

    for role, (vertices, uv, faces, skin_weights, image, _delete, source) in outfit.items():
        sources[role] = {**source, "changes": "Fitted, skinned, texture resized and converted to glTF"}
        if role == "top":
            sources[role]["changes"] += "; hem eased over waistband"
        if role == "hair":
            image = image.convert("RGBA")
            dark = ImageOps.colorize(ImageOps.grayscale(image), "#130f0e", "#513b2e")
            dark.putalpha(image.getchannel("A"))
            texture = encode(dark, "PNG", 512, optimize=True), "image/png"
            sources[role]["changes"] += "; recolored"
        else:
            texture = encode(image.convert("RGB"), "JPEG", 512, quality=87, optimize=True), "image/jpeg"
        material = model.material(role, 0.84, texture, alpha=role == "hair")
        model.mesh(role, vertices * 0.1 - ground, uv, faces, skin_weights, material)

    # Use the included eye helper geometry with opaque sclera, iris and pupil.
    eyes = [([], "eyes-sclera", [0.69, 0.64, 0.58, 1]), ([], "eyes-iris", [0.16, 0.075, 0.039, 1]),
            ([], "eyes-pupil", [0.018, 0.013, 0.011, 1])]
    eye_weights = np.zeros_like(body_weights)
    eye_weights[:, list(rig).index("head")] = 1
    for key in ("helper-l-eye", "helper-r-eye"):
        positions = base[group_indices[key]]
        center = (positions.min(axis=0) + positions.max(axis=0)) / 2
        radius = (positions[:, 2].max() - positions[:, 2].min()) / 2
        for face in groups[key]:
            front = (base[[corner[0] for corner in face]].mean(axis=0)[2] - center[2]) / radius
            layer = 2 if front > 0.92 else 1 if front > 0.70 else 0
            eyes[layer][0].append(face)
    for faces, name, color in eyes:
        if faces:
            model.mesh(name, base * 0.1 - ground, [], faces, eye_weights, model.material(name, 0.4, color=color))
    model.document["asset"]["extras"] = {"sources": sources, "units": "meters", "forward": "+Z"}
    model.write(OUTPUT / "campus-player.glb")
    for skin, data in skin_files.items():
        (OUTPUT / f"{skin}.webp").write_bytes(data)


if __name__ == "__main__":
    main()
