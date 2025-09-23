import base64
import json
import math
import struct
from pathlib import Path


class BufferBuilder:
    def __init__(self):
        self.data = bytearray()
        self.buffer_views = []
        self.accessors = []

    def _align(self, alignment: int = 4):
        remainder = len(self.data) % alignment
        if remainder:
            self.data.extend(b"\x00" * (alignment - remainder))

    def add_floats(self, values, target=None):
        self._align(4)
        offset = len(self.data)
        self.data.extend(struct.pack("<%sf" % len(values), *values))
        view = {
            "buffer": 0,
            "byteOffset": offset,
            "byteLength": len(values) * 4,
        }
        if target is not None:
            view["target"] = target
        self.buffer_views.append(view)
        return len(self.buffer_views) - 1

    def add_indices(self, values, target=34963):
        self._align(4)
        offset = len(self.data)
        self.data.extend(struct.pack("<%sH" % len(values), *values))
        view = {
            "buffer": 0,
            "byteOffset": offset,
            "byteLength": len(values) * 2,
            "target": target,
        }
        self.buffer_views.append(view)
        return len(self.buffer_views) - 1

    def add_accessor(self, buffer_view, component_type, count, type_, *, min_vals=None, max_vals=None):
        accessor = {
            "bufferView": buffer_view,
            "componentType": component_type,
            "count": count,
            "type": type_,
        }
        if min_vals is not None:
            accessor["min"] = min_vals
        if max_vals is not None:
            accessor["max"] = max_vals
        self.accessors.append(accessor)
        return len(self.accessors) - 1


def generate_uv_sphere(radius=0.5, lat_segments=22, lon_segments=32):
    positions = []
    normals = []
    indices = []
    for i in range(lat_segments + 1):
        v = i / lat_segments
        theta = v * math.pi
        sin_theta = math.sin(theta)
        cos_theta = math.cos(theta)
        for j in range(lon_segments + 1):
            u = j / lon_segments
            phi = u * 2 * math.pi
            sin_phi = math.sin(phi)
            cos_phi = math.cos(phi)
            x = cos_phi * sin_theta
            y = cos_theta
            z = sin_phi * sin_theta
            positions.extend([radius * x, radius * y, radius * z])
            normals.extend([x, y, z])
    stride = lon_segments + 1
    for i in range(lat_segments):
        for j in range(lon_segments):
            first = i * stride + j
            second = first + stride
            indices.extend([
                first,
                second,
                first + 1,
                second,
                second + 1,
                first + 1,
            ])
    return positions, normals, indices


def generate_cylinder(radius_top=0.5, radius_bottom=0.5, height=1.0, segments=32):
    positions = []
    normals = []
    indices = []
    half_height = height / 2.0
    slope = radius_bottom - radius_top
    for seg in range(segments + 1):
        angle = 2 * math.pi * seg / segments
        cos_a = math.cos(angle)
        sin_a = math.sin(angle)
        # bottom ring
        positions.extend([radius_bottom * cos_a, -half_height, radius_bottom * sin_a])
        nx = cos_a * height
        ny = slope
        nz = sin_a * height
        length = math.sqrt(nx * nx + ny * ny + nz * nz)
        normals.extend([nx / length, ny / length, nz / length])
        # top ring
        positions.extend([radius_top * cos_a, half_height, radius_top * sin_a])
        normals.extend([nx / length, ny / length, nz / length])
    for seg in range(segments):
        base = seg * 2
        next_base = base + 2
        indices.extend([
            base,
            next_base,
            base + 1,
            base + 1,
            next_base,
            next_base + 1,
        ])
    # top cap
    top_center_index = len(positions) // 3
    positions.extend([0.0, half_height, 0.0])
    normals.extend([0.0, 1.0, 0.0])
    for seg in range(segments):
        angle = 2 * math.pi * seg / segments
        cos_a = math.cos(angle)
        sin_a = math.sin(angle)
        positions.extend([radius_top * cos_a, half_height, radius_top * sin_a])
        normals.extend([0.0, 1.0, 0.0])
    for seg in range(segments):
        current = top_center_index + 1 + seg
        nxt = top_center_index + 1 + ((seg + 1) % segments)
        indices.extend([top_center_index, current, nxt])
    # bottom cap
    bottom_center_index = len(positions) // 3
    positions.extend([0.0, -half_height, 0.0])
    normals.extend([0.0, -1.0, 0.0])
    for seg in range(segments):
        angle = 2 * math.pi * seg / segments
        cos_a = math.cos(angle)
        sin_a = math.sin(angle)
        positions.extend([radius_bottom * cos_a, -half_height, radius_bottom * sin_a])
        normals.extend([0.0, -1.0, 0.0])
    for seg in range(segments):
        current = bottom_center_index + 1 + seg
        nxt = bottom_center_index + 1 + ((seg + 1) % segments)
        indices.extend([bottom_center_index, nxt, current])
    return positions, normals, indices


def generate_disk(radius=1.0, segments=48):
    positions = [0.0, 0.0, 0.0]
    normals = [0.0, 1.0, 0.0]
    indices = []
    for seg in range(segments):
        angle = 2 * math.pi * seg / segments
        cos_a = math.cos(angle)
        sin_a = math.sin(angle)
        positions.extend([radius * cos_a, 0.0, radius * sin_a])
        normals.extend([0.0, 1.0, 0.0])
    for seg in range(segments):
        first = 1 + seg
        second = 1 + ((seg + 1) % segments)
        indices.extend([0, first, second])
    return positions, normals, indices


def generate_plane(width=1.0, height=1.0):
    half_w = width / 2.0
    half_h = height / 2.0
    positions = [
        -half_w,  half_h, 0.0,
         half_w,  half_h, 0.0,
        -half_w, -half_h, 0.0,
         half_w, -half_h, 0.0,
    ]
    normals = [
        0.0, 0.0, 1.0,
        0.0, 0.0, 1.0,
        0.0, 0.0, 1.0,
        0.0, 0.0, 1.0,
    ]
    indices = [0, 2, 1, 1, 2, 3]
    return positions, normals, indices


def build_avatar(output_path: Path):
    builder = BufferBuilder()
    geometries = {}

    def register_geometry(key, generator):
        positions, normals, indices = generator
        pos_view = builder.add_floats(positions, target=34962)
        norm_view = builder.add_floats(normals, target=34962)
        idx_view = builder.add_indices(indices)
        count = len(positions) // 3
        pos_min = [min(positions[i::3]) for i in range(3)]
        pos_max = [max(positions[i::3]) for i in range(3)]
        pos_accessor = builder.add_accessor(
            pos_view,
            component_type=5126,
            count=count,
            type_="VEC3",
            min_vals=pos_min,
            max_vals=pos_max,
        )
        norm_accessor = builder.add_accessor(
            norm_view,
            component_type=5126,
            count=len(normals) // 3,
            type_="VEC3",
        )
        idx_accessor = builder.add_accessor(
            idx_view,
            component_type=5123,
            count=len(indices),
            type_="SCALAR",
            min_vals=[int(min(indices))],
            max_vals=[int(max(indices))],
        )
        geometries[key] = {
            "POSITION": pos_accessor,
            "NORMAL": norm_accessor,
            "INDICES": idx_accessor,
        }

    register_geometry("sphere", generate_uv_sphere(radius=0.5, lat_segments=30, lon_segments=42))
    register_geometry("cylinder", generate_cylinder(radius_top=0.5, radius_bottom=0.5, height=1.0, segments=42))
    register_geometry("tapered", generate_cylinder(radius_top=0.38, radius_bottom=0.62, height=1.0, segments=42))
    register_geometry("disk", generate_disk(radius=1.0, segments=64))
    register_geometry("plane", generate_plane(width=1.0, height=1.0))

    materials = [
        {
            "name": "GroundBase",
            "pbrMetallicRoughness": {
                "baseColorFactor": [0.92, 0.88, 0.82, 1.0],
                "metallicFactor": 0.0,
                "roughnessFactor": 0.96,
            },
        },
        {
            "name": "GroundGlow",
            "pbrMetallicRoughness": {
                "baseColorFactor": [0.97, 0.84, 0.64, 0.85],
                "metallicFactor": 0.0,
                "roughnessFactor": 0.9,
            },
        },
        {
            "name": "Leather",
            "pbrMetallicRoughness": {
                "baseColorFactor": [0.36, 0.24, 0.18, 1.0],
    register_geometry("sphere", generate_uv_sphere(radius=0.5, lat_segments=28, lon_segments=40))
    register_geometry("cylinder", generate_cylinder(radius_top=0.5, radius_bottom=0.5, height=1.0, segments=40))
    register_geometry("tapered", generate_cylinder(radius_top=0.4, radius_bottom=0.6, height=1.0, segments=40))
    register_geometry("disk", generate_disk(radius=1.0, segments=60))

    materials = [
        {
            "name": "Ground",
            "pbrMetallicRoughness": {
                "baseColorFactor": [0.92, 0.88, 0.82, 1.0],
                "metallicFactor": 0.0,
                "roughnessFactor": 0.95,
            },
        },
        {
            "name": "Boots",
            "pbrMetallicRoughness": {
                "baseColorFactor": [0.24, 0.29, 0.36, 1.0],
                "metallicFactor": 0.0,
                "roughnessFactor": 0.6,
            },
        },
        {
            "name": "Copper",
            "pbrMetallicRoughness": {
                "baseColorFactor": [0.84, 0.49, 0.27, 1.0],
                "metallicFactor": 0.1,
                "roughnessFactor": 0.4,
            },
        },
        {
            "name": "MidnightCloth",
            "pbrMetallicRoughness": {
                "baseColorFactor": [0.21, 0.35, 0.56, 1.0],
                "metallicFactor": 0.0,
                "roughnessFactor": 0.72,
            "name": "Pants",
            "pbrMetallicRoughness": {
                "baseColorFactor": [0.26, 0.43, 0.62, 1.0],
                "metallicFactor": 0.0,
                "roughnessFactor": 0.7,
            },
        },
        {
            "name": "Tunic",
            "pbrMetallicRoughness": {
                "baseColorFactor": [0.32, 0.64, 0.62, 1.0],
                "metallicFactor": 0.0,
                "roughnessFactor": 0.5,
            },
        },
        {
            "name": "GildedTrim",
            "pbrMetallicRoughness": {
                "baseColorFactor": [0.95, 0.82, 0.48, 1.0],
                "metallicFactor": 0.15,
                "roughnessFactor": 0.35,
                "baseColorFactor": [0.93, 0.74, 0.52, 1.0],
                "metallicFactor": 0.0,
                "roughnessFactor": 0.45,
            },
        },
        {
            "name": "Skin",
            "pbrMetallicRoughness": {
                "baseColorFactor": [0.98, 0.82, 0.69, 1.0],
                "baseColorFactor": [0.98, 0.84, 0.72, 1.0],
                "metallicFactor": 0.0,
                "roughnessFactor": 0.55,
            },
        },
        {
            "name": "Hair",
            "pbrMetallicRoughness": {
                "baseColorFactor": [0.21, 0.16, 0.12, 1.0],
                "metallicFactor": 0.0,
                "roughnessFactor": 0.72,
            },
        },
        {
            "name": "Cape",
            "doubleSided": True,
            "pbrMetallicRoughness": {
                "baseColorFactor": [0.52, 0.17, 0.3, 1.0],
                "metallicFactor": 0.0,
                "roughnessFactor": 0.82,
            },
        },
        {
            "name": "Bracer",
            "pbrMetallicRoughness": {
                "baseColorFactor": [0.26, 0.42, 0.6, 1.0],
                "metallicFactor": 0.05,
                "roughnessFactor": 0.48,
                "baseColorFactor": [0.22, 0.17, 0.12, 1.0],
                "metallicFactor": 0.0,
                "roughnessFactor": 0.7,
            },
        },
        {
            "name": "Accent",
            "pbrMetallicRoughness": {
                "baseColorFactor": [0.85, 0.42, 0.34, 1.0],
                "metallicFactor": 0.0,
                "roughnessFactor": 0.5,
            },
        },
    ]

    def make_mesh(name, geom_key, material_index):
        geom = geometries[geom_key]
        mesh = {
            "name": name,
            "primitives": [
                {
                    "attributes": {
                        "POSITION": geom["POSITION"],
                        "NORMAL": geom["NORMAL"],
                    },
                    "indices": geom["INDICES"],
                    "material": material_index,
                }
            ],
        }
        return mesh

    meshes = [
        make_mesh("GroundBaseMesh", "disk", 0),
        make_mesh("GroundGlowMesh", "disk", 1),
        make_mesh("BootShellMesh", "sphere", 2),
        make_mesh("BootGuardMesh", "tapered", 3),
        make_mesh("LowerLegMesh", "cylinder", 4),
        make_mesh("UpperLegMesh", "tapered", 4),
        make_mesh("PelvisMesh", "tapered", 5),
        make_mesh("BeltMesh", "cylinder", 6),
        make_mesh("LowerTorsoMesh", "tapered", 5),
        make_mesh("UpperTorsoMesh", "sphere", 5),
        make_mesh("ChestTrimMesh", "cylinder", 6),
        make_mesh("CollarMesh", "cylinder", 6),
        make_mesh("NeckMesh", "cylinder", 7),
        make_mesh("HeadMesh", "sphere", 7),
        make_mesh("HairCrownMesh", "sphere", 8),
        make_mesh("HairBackMesh", "sphere", 8),
        make_mesh("HairSideMesh", "sphere", 8),
        make_mesh("CapeMesh", "plane", 9),
        make_mesh("ShoulderMesh", "sphere", 6),
        make_mesh("UpperArmMesh", "cylinder", 7),
        make_mesh("ForearmMesh", "cylinder", 10),
        make_mesh("GloveMesh", "sphere", 2),
        make_mesh("HandMesh", "sphere", 7),
        make_mesh("GroundMesh", "disk", 0),
        make_mesh("BootMesh", "sphere", 1),
        make_mesh("PantMesh", "cylinder", 2),
        make_mesh("TunicMesh", "tapered", 3),
        make_mesh("SkinCylinderMesh", "cylinder", 4),
        make_mesh("SkinSphereMesh", "sphere", 4),
        make_mesh("HairMesh", "sphere", 5),
        make_mesh("AccentMesh", "cylinder", 6),
    ]

    # Helper to compute quaternion for axis-angle rotations
    def quat_from_axis_angle(axis, angle_deg):
        angle = math.radians(angle_deg)
        sin_half = math.sin(angle / 2.0)
        x, y, z = axis
        return [
            x * sin_half,
            y * sin_half,
            z * sin_half,
            math.cos(angle / 2.0),
        ]

    def multiply_quats(a, b):
        ax, ay, az, aw = a
        bx, by, bz, bw = b
        return [
            aw * bx + ax * bw + ay * bz - az * by,
            aw * by - ax * bz + ay * bw + az * bx,
            aw * bz + ax * by - ay * bx + az * bw,
            aw * bw - ax * bx - ay * by - az * bz,
        ]

    def combine_quats(*quats):
        result = [0.0, 0.0, 0.0, 1.0]
        for quat in quats:
            if quat is None:
                continue
            result = multiply_quats(result, quat)
        length = math.sqrt(result[0] ** 2 + result[1] ** 2 + result[2] ** 2 + result[3] ** 2)
        if length > 0:
            result = [component / length for component in result]
        return result

    nodes = [
        {
            "name": "CodexAvatarRoot",
            "children": list(range(1, 36)),
        },
        {
            "name": "GroundBase",
            "mesh": 0,
            "translation": [0.0, -1.6, 0.0],
            "scale": [1.6, 0.05, 1.6],
        },
        {
            "name": "GroundGlow",
            "mesh": 1,
            "translation": [0.0, -1.58, 0.0],
            "scale": [1.2, 0.02, 1.2],
        },
        {
            "name": "Cape",
            "mesh": 17,
            "translation": [0.0, 1.08, -0.52],
            "rotation": combine_quats(
                quat_from_axis_angle([1, 0, 0], -8),
                quat_from_axis_angle([0, 1, 0], 4),
            ),
            "scale": [2.1, 2.2, 1.0],
        },
        {
            "name": "BootLeft",
            "mesh": 2,
            "translation": [-0.34, -1.58, 0.34],
            "scale": [0.24, 0.16, 0.36],
        },
        {
            "name": "BootRight",
            "mesh": 2,
            "translation": [0.34, -1.58, 0.34],
            "scale": [0.24, 0.16, 0.36],
        },
        {
            "name": "BootGuardLeft",
            "mesh": 3,
            "translation": [-0.34, -1.34, 0.06],
            "scale": [0.26, 0.26, 0.26],
        },
        {
            "name": "BootGuardRight",
            "mesh": 3,
            "translation": [0.34, -1.34, 0.06],
            "scale": [0.26, 0.26, 0.26],
        },
        {
            "name": "LowerLegLeft",
            "mesh": 4,
            "translation": [-0.32, -0.98, 0.12],
            "scale": [0.2, 0.82, 0.24],
        },
        {
            "name": "LowerLegRight",
            "mesh": 4,
            "translation": [0.32, -0.98, 0.12],
            "scale": [0.2, 0.82, 0.24],
        },
        {
            "name": "KneeGuardLeft",
            "mesh": 3,
            "translation": [-0.32, -0.52, 0.18],
            "scale": [0.24, 0.2, 0.24],
        },
        {
            "name": "KneeGuardRight",
            "mesh": 3,
            "translation": [0.32, -0.52, 0.18],
            "scale": [0.24, 0.2, 0.24],
        },
        {
            "name": "UpperLegLeft",
            "mesh": 5,
            "translation": [-0.28, -0.16, 0.06],
            "scale": [0.26, 0.94, 0.3],
        },
        {
            "name": "UpperLegRight",
            "mesh": 5,
            "translation": [0.28, -0.16, 0.06],
            "scale": [0.26, 0.94, 0.3],
        },
        {
            "name": "Pelvis",
            "mesh": 6,
            "translation": [0.0, 0.48, 0.12],
            "scale": [0.78, 0.5, 0.62],
        },
        {
            "name": "Belt",
            "mesh": 7,
            "translation": [0.0, 0.88, 0.08],
            "scale": [0.92, 0.16, 0.92],
        },
        {
            "name": "LowerTorso",
            "mesh": 8,
            "translation": [0.0, 1.2, 0.16],
            "scale": [0.72, 0.82, 0.54],
        },
        {
            "name": "UpperTorso",
            "mesh": 9,
            "translation": [0.0, 1.86, 0.22],
            "scale": [0.78, 0.68, 0.56],
        },
        {
            "name": "ChestTrim",
            "mesh": 10,
            "translation": [0.0, 1.74, 0.24],
            "scale": [0.88, 0.2, 0.88],
        },
        {
            "name": "Collar",
            "mesh": 11,
            "translation": [0.0, 2.04, 0.16],
            "scale": [0.6, 0.22, 0.6],
        },
        {
            "name": "Neck",
            "mesh": 12,
            "translation": [0.0, 2.28, 0.2],
            "scale": [0.24, 0.28, 0.24],
        },
        {
            "name": "Head",
            "mesh": 13,
            "translation": [0.0, 2.64, 0.32],
            "scale": [0.54, 0.64, 0.52],
        },
        {
            "name": "HairCrown",
            "mesh": 14,
            "translation": [0.0, 2.92, 0.08],
            "scale": [0.6, 0.42, 0.6],
        },
        {
            "name": "HairBack",
            "mesh": 15,
            "translation": [0.0, 2.56, -0.34],
            "scale": [0.62, 0.7, 0.36],
        },
        {
            "name": "HairSideLeft",
            "mesh": 16,
            "translation": [-0.4, 2.62, 0.32],
            "scale": [0.28, 0.36, 0.26],
        },
        {
            "name": "HairSideRight",
            "mesh": 16,
            "translation": [0.4, 2.62, 0.32],
            "scale": [0.28, 0.36, 0.26],
        },
        {
            "name": "ShoulderLeft",
            "mesh": 18,
            "translation": [-0.96, 1.92, 0.2],
            "scale": [0.28, 0.3, 0.28],
        },
        {
            "name": "ShoulderRight",
            "mesh": 18,
            "translation": [0.96, 1.92, 0.2],
            "scale": [0.28, 0.3, 0.28],
        },
        {
            "name": "UpperArmLeft",
            "mesh": 19,
            "translation": [-1.12, 1.54, 0.04],
            "rotation": combine_quats(
                quat_from_axis_angle([0, 0, 1], -22),
                quat_from_axis_angle([1, 0, 0], -10),
            ),
            "scale": [0.18, 0.7, 0.22],
        },
        {
            "name": "UpperArmRight",
            "mesh": 19,
            "translation": [1.12, 1.54, 0.04],
            "rotation": combine_quats(
                quat_from_axis_angle([0, 0, 1], 22),
                quat_from_axis_angle([1, 0, 0], -10),
            ),
            "scale": [0.18, 0.7, 0.22],
        },
        {
            "name": "ForearmLeft",
            "mesh": 20,
            "translation": [-1.24, 0.96, 0.06],
            "rotation": combine_quats(
                quat_from_axis_angle([0, 0, 1], -18),
                quat_from_axis_angle([1, 0, 0], -12),
            ),
            "scale": [0.16, 0.62, 0.2],
        },
        {
            "name": "ForearmRight",
            "mesh": 20,
            "translation": [1.24, 0.96, 0.06],
            "rotation": combine_quats(
                quat_from_axis_angle([0, 0, 1], 18),
                quat_from_axis_angle([1, 0, 0], -12),
            ),
            "scale": [0.16, 0.62, 0.2],
        },
        {
            "name": "GloveLeft",
            "mesh": 21,
            "translation": [-1.2, 0.6, 0.18],
            "rotation": combine_quats(
                quat_from_axis_angle([0, 0, 1], -12),
                quat_from_axis_angle([1, 0, 0], -6),
            ),
            "scale": [0.2, 0.2, 0.26],
        },
        {
            "name": "GloveRight",
            "mesh": 21,
            "translation": [1.2, 0.6, 0.18],
            "rotation": combine_quats(
                quat_from_axis_angle([0, 0, 1], 12),
                quat_from_axis_angle([1, 0, 0], -6),
            ),
            "scale": [0.2, 0.2, 0.26],
        },
        {
            "name": "HandLeft",
            "mesh": 22,
            "translation": [-1.18, 0.42, 0.18],
            "rotation": combine_quats(
                quat_from_axis_angle([0, 0, 1], -12),
                quat_from_axis_angle([1, 0, 0], -4),
            ),
            "scale": [0.16, 0.14, 0.2],
        },
        {
            "name": "HandRight",
            "mesh": 22,
            "translation": [1.18, 0.42, 0.18],
            "rotation": combine_quats(
                quat_from_axis_angle([0, 0, 1], 12),
                quat_from_axis_angle([1, 0, 0], -4),
            ),
            "scale": [0.16, 0.14, 0.2],
    nodes = [
        {
            "name": "CodexAvatarRoot",
            "children": list(range(1, 27)),
        },
        {
            "name": "Ground",
            "mesh": 0,
            "translation": [0.0, -1.26, 0.0],
            "scale": [2.6, 0.05, 2.0],
        },
        {
            "name": "Pelvis",
            "mesh": 3,
            "translation": [0.0, -0.05, 0.02],
            "scale": [0.6, 0.38, 0.46],
        },
        {
            "name": "LowerTorso",
            "mesh": 3,
            "translation": [0.0, 0.42, 0.02],
            "scale": [0.55, 0.65, 0.4],
        },
        {
            "name": "UpperTorso",
            "mesh": 3,
            "translation": [0.0, 0.98, 0.02],
            "scale": [0.6, 0.55, 0.42],
        },
        {
            "name": "ChestBand",
            "mesh": 7,
            "translation": [0.0, 1.04, 0.02],
            "scale": [0.65, 0.18, 0.45],
        },
        {
            "name": "Neck",
            "mesh": 4,
            "translation": [0.0, 1.36, 0.02],
            "scale": [0.18, 0.22, 0.18],
        },
        {
            "name": "Head",
            "mesh": 5,
            "translation": [0.0, 1.62, 0.06],
            "scale": [0.38, 0.46, 0.38],
        },
        {
            "name": "HairCrown",
            "mesh": 6,
            "translation": [0.0, 1.82, 0.0],
            "scale": [0.42, 0.24, 0.42],
        },
        {
            "name": "HairBack",
            "mesh": 6,
            "translation": [0.0, 1.6, -0.28],
            "scale": [0.36, 0.4, 0.24],
        },
        {
            "name": "Fringe",
            "mesh": 6,
            "translation": [0.0, 1.75, 0.24],
            "scale": [0.34, 0.18, 0.18],
        },
        {
            "name": "ShoulderLeft",
            "mesh": 5,
            "translation": [-0.54, 1.16, 0.04],
            "scale": [0.18, 0.2, 0.18],
        },
        {
            "name": "ShoulderRight",
            "mesh": 5,
            "translation": [0.54, 1.16, 0.04],
            "scale": [0.18, 0.2, 0.18],
        },
        {
            "name": "UpperArmLeft",
            "mesh": 4,
            "translation": [-0.66, 0.88, 0.04],
            "rotation": quat_from_axis_angle([0, 0, 1], -12),
            "scale": [0.14, 0.54, 0.14],
        },
        {
            "name": "UpperArmRight",
            "mesh": 4,
            "translation": [0.66, 0.88, 0.04],
            "rotation": quat_from_axis_angle([0, 0, 1], 12),
            "scale": [0.14, 0.54, 0.14],
        },
        {
            "name": "ForearmLeft",
            "mesh": 4,
            "translation": [-0.68, 0.38, 0.02],
            "rotation": quat_from_axis_angle([0, 0, 1], -6),
            "scale": [0.12, 0.48, 0.12],
        },
        {
            "name": "ForearmRight",
            "mesh": 4,
            "translation": [0.68, 0.38, 0.02],
            "rotation": quat_from_axis_angle([0, 0, 1], 6),
            "scale": [0.12, 0.48, 0.12],
        },
        {
            "name": "PalmLeft",
            "mesh": 1,
            "translation": [-0.68, -0.02, 0.02],
            "scale": [0.12, 0.12, 0.14],
        },
        {
            "name": "PalmRight",
            "mesh": 1,
            "translation": [0.68, -0.02, 0.02],
            "scale": [0.12, 0.12, 0.14],
        },
        {
            "name": "UpperLegLeft",
            "mesh": 2,
            "translation": [-0.22, -0.38, 0.02],
            "scale": [0.18, 0.62, 0.22],
        },
        {
            "name": "UpperLegRight",
            "mesh": 2,
            "translation": [0.22, -0.38, 0.02],
            "scale": [0.18, 0.62, 0.22],
        },
        {
            "name": "LowerLegLeft",
            "mesh": 2,
            "translation": [-0.22, -0.96, 0.04],
            "scale": [0.16, 0.58, 0.2],
        },
        {
            "name": "LowerLegRight",
            "mesh": 2,
            "translation": [0.22, -0.96, 0.04],
            "scale": [0.16, 0.58, 0.2],
        },
        {
            "name": "BootLeft",
            "mesh": 1,
            "translation": [-0.22, -1.36, 0.26],
            "scale": [0.18, 0.12, 0.3],
        },
        {
            "name": "BootRight",
            "mesh": 1,
            "translation": [0.22, -1.36, 0.26],
            "scale": [0.18, 0.12, 0.3],
        },
        {
            "name": "BootRiseLeft",
            "mesh": 1,
            "translation": [-0.22, -1.2, -0.02],
            "scale": [0.16, 0.18, 0.2],
        },
        {
            "name": "BootRiseRight",
            "mesh": 1,
            "translation": [0.22, -1.2, -0.02],
            "scale": [0.16, 0.18, 0.2],
        },
    ]

    gltf = {
        "asset": {"version": "2.0", "generator": "Codex Vitae Avatar Generator"},
        "scene": 0,
        "scenes": [{"nodes": [0]}],
        "nodes": nodes,
        "meshes": meshes,
        "materials": materials,
        "bufferViews": builder.buffer_views,
        "accessors": builder.accessors,
        "buffers": [
            {
                "byteLength": len(builder.data),
                "uri": "data:application/octet-stream;base64," + base64.b64encode(builder.data).decode("ascii"),
            }
        ],
    }

    output_path.write_text(json.dumps(gltf, indent=2))
    print(f"Wrote {output_path.relative_to(Path.cwd())} ({len(builder.data)} bytes of buffer data)")


if __name__ == "__main__":
    output_file = Path(__file__).resolve().parents[1] / "assets" / "avatars" / "codex-vitae-avatar.gltf"
    build_avatar(output_file)
