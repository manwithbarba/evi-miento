"""Process discipline-specific population ghosts from open biomechanical data.

The raw archives are intentionally kept outside the repository.  This script
publishes compact aggregates only: participant-balanced curves, robust
quantiles, effective n, exclusions, and provenance.  Running uses OpenSim
time-normalized outputs plus event workbooks from OSF; cycling uses the
published BVH motion-capture files from Zenodo and keeps road and time-trial
participants separate.
"""

from __future__ import annotations

import argparse
import bisect
import copy
import io
import json
import math
import re
import statistics
import zipfile
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path
from typing import Any, Iterable
from xml.etree import ElementTree as ET


TODAY = date.today().isoformat()
PHASE = list(range(101))
CONDITIONS = {
    "3deg_up": ("trail_uphill_3deg", "Trail / subida · 3°"),
    "6deg_up": ("trail_uphill_6deg", "Trail / subida · 6°"),
    "3deg_down": ("trail_downhill_3deg", "Trail / bajada · 3°"),
    "6deg_down": ("trail_downhill_6deg", "Trail / bajada · 6°"),
}


def finite(value: Any) -> bool:
    try:
        return math.isfinite(float(value))
    except (TypeError, ValueError):
        return False


def quantile(values: Iterable[float], probability: float) -> float:
    ordered = sorted(float(value) for value in values)
    if not ordered:
        raise ValueError("cannot calculate a quantile from an empty collection")
    if len(ordered) == 1:
        return ordered[0]
    position = (len(ordered) - 1) * probability
    lower = math.floor(position)
    upper = math.ceil(position)
    if lower == upper:
        return ordered[lower]
    fraction = position - lower
    return ordered[lower] + (ordered[upper] - ordered[lower]) * fraction


def stats(values: Iterable[float], unit: str, n_effective: int | None = None) -> dict[str, Any]:
    values = [float(value) for value in values]
    return {
        "unit": unit,
        "median": round(statistics.median(values), 4),
        "p10": round(quantile(values, 0.10), 4),
        "p90": round(quantile(values, 0.90), 4),
        "nEffective": n_effective if n_effective is not None else len(values),
    }


def curve_stats(values_by_phase: list[list[float]], unit: str, n_effective: int) -> dict[str, Any]:
    return {
        "unit": unit,
        "phasePercent": PHASE,
        "median": [round(statistics.median(values), 4) for values in values_by_phase],
        "p10": [round(quantile(values, 0.10), 4) for values in values_by_phase],
        "p90": [round(quantile(values, 0.90), 4) for values in values_by_phase],
        "nEffective": n_effective,
    }


def clean_cell(value: str | None) -> Any:
    if value is None or value.strip() == "":
        return None
    text = value.strip()
    try:
        parsed = float(text)
        return int(parsed) if parsed.is_integer() else parsed
    except ValueError:
        return text


def column_index(reference: str) -> int:
    letters = re.match(r"[A-Z]+", reference.upper())
    if not letters:
        raise ValueError(f"invalid xlsx cell reference: {reference}")
    index = 0
    for char in letters.group(0):
        index = index * 26 + ord(char) - ord("A") + 1
    return index - 1


def read_xlsx_sheet(path: Path, sheet_name: str = "xl/worksheets/sheet2.xml") -> list[list[Any]]:
    namespace = {"x": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
    with zipfile.ZipFile(path) as archive:
        shared: list[str] = []
        if "xl/sharedStrings.xml" in archive.namelist():
            root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
            for item in root.findall("x:si", namespace):
                shared.append("".join(item.itertext()))
        if sheet_name not in archive.namelist():
            raise ValueError(f"missing {sheet_name}")
        sheet_root = ET.fromstring(archive.read(sheet_name))
        rows: list[list[Any]] = []
        for row in sheet_root.findall(".//x:sheetData/x:row", namespace):
            cells: list[Any] = []
            for cell in row.findall("x:c", namespace):
                index = column_index(cell.attrib.get("r", "A1"))
                while len(cells) <= index:
                    cells.append(None)
                kind = cell.attrib.get("t")
                value_node = cell.find("x:v", namespace)
                inline_node = cell.find("x:is", namespace)
                if kind == "inlineStr" and inline_node is not None:
                    value: Any = "".join(inline_node.itertext())
                elif value_node is None:
                    value = None
                elif kind == "s":
                    value = shared[int(value_node.text or "0")]
                else:
                    value = clean_cell(value_node.text)
                cells[index] = value
            rows.append(cells)
        return rows


def read_running_events(path: Path) -> list[float]:
    rows = read_xlsx_sheet(path)
    for row in rows:
        if row and str(row[0]).strip().upper() == "IC R":
            return [float(value) for value in row[1:] if finite(value)]
    raise ValueError("event workbook has no IC R row")


def resample(times: list[float], values: list[float], start: float, end: float) -> list[float]:
    if not times or start < times[0] or end > times[-1] or end <= start:
        raise ValueError("cycle is outside the source time range")
    output: list[float] = []
    for phase in PHASE:
        target = start + (end - start) * phase / 100
        right = bisect.bisect_left(times, target)
        if right == 0:
            output.append(values[0])
        elif right >= len(times):
            output.append(values[-1])
        elif times[right] == target:
            output.append(values[right])
        else:
            left = right - 1
            fraction = (target - times[left]) / (times[right] - times[left])
            output.append(values[left] + (values[right] - values[left]) * fraction)
    return output


def bilateral(values_right: list[float], values_left: list[float]) -> list[float]:
    output: list[float] = []
    for right, left in zip(values_right, values_left):
        if not finite(right) or not finite(left):
            raise ValueError("non-finite bilateral value")
        output.append(statistics.median([float(right), float(left)]))
    return output


def read_mot(path: Path) -> tuple[list[float], dict[str, list[float]]]:
    lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
    try:
        header_end = next(index for index, line in enumerate(lines) if line.strip().lower() == "endheader")
    except StopIteration as error:
        raise ValueError("missing endheader") from error
    if header_end + 1 >= len(lines):
        raise ValueError("missing MOT column header")
    columns = lines[header_end + 1].split()
    series = {column: [] for column in columns}
    for line in lines[header_end + 2 :]:
        parts = line.split()
        if len(parts) != len(columns):
            continue
        try:
            values = [float(value.replace("D", "E")) for value in parts]
        except ValueError:
            continue
        if not all(finite(value) for value in values):
            continue
        for column, value in zip(columns, values):
            series[column].append(value)
    if not series.get("time"):
        raise ValueError("MOT contains no time series")
    return series["time"], series


RUNNING_METRICS = {
    "kneeFlexion": ("knee_angle_r", "knee_angle_l"),
    "hipFlexion": ("hip_flexion_r", "hip_flexion_l"),
    "ankleFlexion": ("ankle_angle_r", "ankle_angle_l"),
}


def process_running_condition(mot_path: Path, event_dir: Path) -> tuple[str, str, dict[str, Any]]:
    match = re.match(r"^(Sub_\d+)_(3deg_up|6deg_up|3deg_down|6deg_down)_IK\.mot$", mot_path.name)
    if not match:
        raise ValueError("unexpected MOT filename")
    participant, condition = match.groups()
    event_path = event_dir / f"{participant}_{condition}_events.xlsx"
    if not event_path.exists():
        raise ValueError(f"missing event workbook {event_path.name}")
    times, series = read_mot(mot_path)
    events = sorted(read_running_events(event_path))
    missing = [column for pair in RUNNING_METRICS.values() for column in pair if column not in series]
    if missing:
        raise ValueError(f"missing MOT columns: {', '.join(missing)}")
    cycles: dict[str, list[list[float]]] = {key: [] for key in RUNNING_METRICS}
    for start, end in zip(events, events[1:]):
        if end - start < 0.2 or end - start > 3.0:
            continue
        if start < times[0] or end > times[-1]:
            continue
        for key, (right_column, left_column) in RUNNING_METRICS.items():
            right = resample(times, series[right_column], start, end)
            left = resample(times, series[left_column], start, end)
            cycles[key].append(bilateral(right, left))
    cycle_count = len(cycles["kneeFlexion"])
    if cycle_count < 3:
        raise ValueError(f"only {cycle_count} complete cycles")
    participant_curves = {
        key: [statistics.median([cycle[phase] for cycle in values]) for phase in range(101)]
        for key, values in cycles.items()
    }
    return participant, condition, {"curves": participant_curves, "cycles": cycle_count}


def build_running_specialized(mot_dir: Path, event_dir: Path, base_file: Path) -> dict[str, Any]:
    exclusions: list[dict[str, str]] = []
    by_condition: dict[str, list[tuple[str, dict[str, Any]]]] = {condition: [] for condition in CONDITIONS}
    for mot_path in sorted(mot_dir.glob("Sub_*_IK.mot")):
        match = re.match(r"^Sub_\d+_(3deg_up|6deg_up|3deg_down|6deg_down)_IK\.mot$", mot_path.name)
        if not match:
            continue
        condition = match.group(1)
        try:
            participant, condition, result = process_running_condition(mot_path, event_dir)
            by_condition[condition].append((participant, result))
        except (OSError, ValueError, KeyError) as error:
            exclusions.append({"file": mot_path.name, "reason": str(error)})

    base = json.loads(base_file.read_text(encoding="utf-8"))
    strata: dict[str, Any] = {}
    flat = copy.deepcopy(base["strata"]["3.5mps"])
    flat["label"] = "Calle / plano · proxy de laboratorio · 3,5 m/s"
    flat["profileId"] = "running_street_flat"
    flat["evidenceLevel"] = "moderate"
    flat["sourceNote"] = "RBDS: cinta, no equivale automáticamente a carrera de calle."
    strata["street_flat"] = flat

    for condition, (profile_id, label) in CONDITIONS.items():
        included = sorted(by_condition[condition], key=lambda item: item[0])
        n_effective = len(included)
        if n_effective == 0:
            continue
        curves: dict[str, Any] = {}
        summaries: dict[str, Any] = {}
        for key in RUNNING_METRICS:
            participant_curves = [result["curves"][key] for _, result in included]
            values_by_phase = [[curve[phase] for curve in participant_curves] for phase in range(101)]
            curves[key] = curve_stats(values_by_phase, "deg", n_effective)
            at_contact = [curve[0] for curve in participant_curves]
            peak = [max(curve) for curve in participant_curves]
            summaries[f"{key}AtContact"] = stats(at_contact, "deg", n_effective)
            summaries[f"{key}Peak"] = stats(peak, "deg", n_effective)
        strata[profile_id] = {
            "label": label,
            "profileId": profile_id,
            "nEffective": n_effective,
            "curves": curves,
            "participantSummaries": summaries,
            "cycleAudit": {
                "participants": [participant for participant, _ in included],
                "medianCyclesPerParticipant": round(statistics.median([result["cycles"] for _, result in included]), 2),
            },
            "evidenceLevel": "moderate",
            "sourceNote": "OSF/OpenSim: pendiente normalizada; se conserva cada gradiente como estrato independiente.",
        }

    observed = sorted({participant for values in by_condition.values() for participant, _ in values})
    return {
        "schemaVersion": "cohort-ghost.v2",
        "id": "cohort-ghost-running-specialized",
        "version": f"{TODAY}.1",
        "status": "candidate",
        "activeInRecommendations": False,
        "title": "Fantasmas poblacionales running · calle, subida y bajada",
        "modality": "running",
        "population": {
            "reportedParticipants": 19,
            "observedParticipants": len(observed),
            "nEffective": len(observed),
            "includedParticipants": observed,
            "nEffectiveByStratum": {key: value["nEffective"] for key, value in strata.items()},
        },
        "normalization": {
            "units": "ángulos en grados, conservando el eje publicado",
            "phase": "ciclos delimitados por IC derecho y remuestreados a 101 puntos 0–100%",
            "aggregation": "mediana bilateral y de ciclos por participante; luego mediana/P10/P90 entre participantes",
            "profilePolicy": "calle/plano, subida y bajada no se mezclan; cada gradiente queda separado",
        },
        "defaultStratum": "street_flat",
        "strata": strata,
        "qualityAudit": {
            "sourceFiles": sum(len(values) for values in by_condition.values()),
            "includedParticipants": len(observed),
            "excludedFiles": len(exclusions),
            "exclusions": exclusions,
            "checks": [
                "eventos IC R auditados por archivo",
                "ciclos completos con duración plausible",
                "mínimo de 3 ciclos por participante-condición",
                "unidades en grados y fase 0–100%",
                "cuantiles calculados entre participantes, no entre frames",
            ],
        },
        "sources": [
            {"title": "OSF · Dataset of running kinematics, kinetics and muscle activation", "url": "https://osf.io/7qbxc", "license": "CC BY 4.0"},
            {"title": "Scientific Data · Van Hooren et al. dataset", "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC11737525/", "license": "CC BY 4.0"},
            {"title": "RBDS baseline · Figshare", "url": "https://doi.org/10.6084/m9.figshare.4543435", "license": "CC BY 4.0"},
        ],
    }


@dataclass
class BvhNode:
    name: str
    offset: tuple[float, float, float] = (0.0, 0.0, 0.0)
    channels: list[str] = field(default_factory=list)
    children: list["BvhNode"] = field(default_factory=list)
    parent: "BvhNode | None" = None
    channel_start: int = 0


def parse_bvh_node(lines: list[str], index: int, parent: BvhNode | None = None) -> tuple[BvhNode, int]:
    tokens = lines[index].strip().split()
    if len(tokens) < 2 or tokens[0] not in {"ROOT", "JOINT"}:
        raise ValueError("invalid BVH joint")
    node = BvhNode(tokens[1], parent=parent)
    index += 2  # joint line and opening brace
    while index < len(lines):
        tokens = lines[index].strip().split()
        if not tokens:
            index += 1
            continue
        if tokens[0] == "OFFSET":
            node.offset = tuple(float(value) for value in tokens[1:4])  # type: ignore[assignment]
        elif tokens[0] == "CHANNELS":
            node.channels = tokens[2:]
        elif tokens[0] in {"ROOT", "JOINT"}:
            child, index = parse_bvh_node(lines, index, node)
            node.children.append(child)
            continue
        elif tokens[0] == "End":
            index += 2
            while index < len(lines) and lines[index].strip() != "}":
                index += 1
        elif tokens[0] == "}":
            return node, index + 1
        index += 1
    raise ValueError(f"unterminated BVH node {node.name}")


def walk_nodes(node: BvhNode, channel_index: int = 0) -> int:
    node.channel_start = channel_index
    channel_index += len(node.channels)
    for child in node.children:
        channel_index = walk_nodes(child, channel_index)
    return channel_index


def find_node(root: BvhNode, name: str) -> BvhNode:
    if root.name == name:
        return root
    for child in root.children:
        try:
            return find_node(child, name)
        except ValueError:
            pass
    raise ValueError(f"BVH joint not found: {name}")


def node_path(node: BvhNode) -> list[BvhNode]:
    path: list[BvhNode] = []
    current: BvhNode | None = node
    while current is not None:
        path.append(current)
        current = current.parent
    return list(reversed(path))


def mat_vec(matrix: tuple[tuple[float, float, float], ...], vector: tuple[float, float, float]) -> tuple[float, float, float]:
    return tuple(sum(matrix[row][column] * vector[column] for column in range(3)) for row in range(3))  # type: ignore[return-value]


def mat_mul(left: tuple[tuple[float, float, float], ...], right: tuple[tuple[float, float, float], ...]) -> tuple[tuple[float, float, float], ...]:
    return tuple(tuple(sum(left[row][k] * right[k][column] for k in range(3)) for column in range(3)) for row in range(3))  # type: ignore[return-value]


IDENTITY = ((1.0, 0.0, 0.0), (0.0, 1.0, 0.0), (0.0, 0.0, 1.0))


def axis_rotation(axis: str, angle: float) -> tuple[tuple[float, float, float], ...]:
    radians = math.radians(angle)
    cosine, sine = math.cos(radians), math.sin(radians)
    if axis == "X":
        return ((1.0, 0.0, 0.0), (0.0, cosine, -sine), (0.0, sine, cosine))
    if axis == "Y":
        return ((cosine, 0.0, sine), (0.0, 1.0, 0.0), (-sine, 0.0, cosine))
    return ((cosine, -sine, 0.0), (sine, cosine, 0.0), (0.0, 0.0, 1.0))


def local_transform(node: BvhNode, frame: list[float]) -> tuple[tuple[float, float, float], tuple[tuple[float, float, float], ...]]:
    translation = [0.0, 0.0, 0.0]
    rotation = IDENTITY
    for offset, channel in enumerate(node.channels):
        value = frame[node.channel_start + offset]
        if channel.endswith("position"):
            translation["XYZ".index(channel[0])] = value
        elif channel.endswith("rotation"):
            rotation = mat_mul(rotation, axis_rotation(channel[0], value))
    return (tuple(translation), rotation)  # type: ignore[return-value]


def joint_positions(paths: dict[str, list[BvhNode]], frame: list[float]) -> dict[str, tuple[float, float, float]]:
    positions: dict[str, tuple[float, float, float]] = {}
    for name, path in paths.items():
        root = path[0]
        root_translation, root_rotation = local_transform(root, frame)
        position = tuple(root.offset[index] + root_translation[index] for index in range(3))
        rotation = root_rotation
        for node in path[1:]:
            translation, local_rotation = local_transform(node, frame)
            delta = tuple(node.offset[index] + translation[index] for index in range(3))
            rotated = mat_vec(rotation, delta)
            position = tuple(position[index] + rotated[index] for index in range(3))
            rotation = mat_mul(rotation, local_rotation)
        positions[name] = position
    return positions


def angle_at(vertex: tuple[float, float, float], first: tuple[float, float, float], second: tuple[float, float, float]) -> float:
    a = tuple(first[index] - vertex[index] for index in range(3))
    b = tuple(second[index] - vertex[index] for index in range(3))
    norm_a = math.sqrt(sum(value * value for value in a))
    norm_b = math.sqrt(sum(value * value for value in b))
    if norm_a == 0 or norm_b == 0:
        raise ValueError("zero-length segment")
    cosine = max(-1.0, min(1.0, sum(a[index] * b[index] for index in range(3)) / (norm_a * norm_b)))
    return math.degrees(math.acos(cosine))


def find_peaks(values: list[float], minimum_distance: int = 12) -> list[int]:
    candidates = [index for index in range(1, len(values) - 1) if values[index] >= values[index - 1] and values[index] > values[index + 1]]
    selected: list[int] = []
    for index in sorted(candidates, key=lambda item: values[item], reverse=True):
        if all(abs(index - other) >= minimum_distance for other in selected):
            selected.append(index)
    return sorted(selected)


def process_bvh_bytes(data: io.TextIOBase) -> tuple[dict[str, list[float]], int]:
    header: list[str] = []
    for line in data:
        stripped = line.strip()
        header.append(line.rstrip("\n"))
        if stripped == "MOTION":
            break
    if not header or header[0].strip() != "HIERARCHY":
        raise ValueError("invalid BVH header")
    root, index = parse_bvh_node(header, 1)
    total_channels = walk_nodes(root)
    header_end = next((position for position, line in enumerate(header) if line.strip() == "MOTION"), None)
    if header_end is None:
        raise ValueError("missing MOTION section")
    frame_time = 1 / 24
    for line in header[header_end + 1 :]:
        if line.startswith("Frames:"):
            continue
        if line.startswith("Frame Time:"):
            frame_time = float(line.split(":", 1)[1].strip())
    names = ["Hips", "Spine2", "RightUpLeg", "RightLeg", "RightFoot", "RightToeBase", "LeftUpLeg", "LeftLeg", "LeftFoot", "LeftToeBase"]
    paths = {name: node_path(find_node(root, name)) for name in names}
    curves = {"kneeFlexion": [], "hipAngle": [], "ankleAngle": [], "trunkTilt": []}
    for line in data:
        parts = line.split()
        if len(parts) != total_channels:
            continue
        try:
            frame = [float(value.replace("D", "E")) for value in parts]
        except ValueError:
            continue
        points = joint_positions(paths, frame)
        right_knee = angle_at(points["RightLeg"], points["RightUpLeg"], points["RightFoot"])
        left_knee = angle_at(points["LeftLeg"], points["LeftUpLeg"], points["LeftFoot"])
        right_hip = angle_at(points["RightUpLeg"], points["Hips"], points["RightLeg"])
        left_hip = angle_at(points["LeftUpLeg"], points["Hips"], points["LeftLeg"])
        right_ankle = angle_at(points["RightFoot"], points["RightLeg"], points["RightToeBase"])
        left_ankle = angle_at(points["LeftFoot"], points["LeftLeg"], points["LeftToeBase"])
        trunk = tuple(points["Spine2"][index] - points["Hips"][index] for index in range(3))
        trunk_tilt = math.degrees(math.atan2(math.sqrt(trunk[0] ** 2 + trunk[2] ** 2), abs(trunk[1])))
        curves["kneeFlexion"].append(180 - statistics.median([right_knee, left_knee]))
        curves["hipAngle"].append(statistics.median([right_hip, left_hip]))
        curves["ankleAngle"].append(statistics.median([right_ankle, left_ankle]))
        curves["trunkTilt"].append(trunk_tilt)
    if len(curves["kneeFlexion"]) < 100:
        raise ValueError("BVH has too few valid frames")
    peaks = find_peaks(curves["kneeFlexion"])
    cycles: dict[str, list[list[float]]] = {key: [] for key in curves}
    for start, end in zip(peaks, peaks[1:]):
        if end - start < 8 or end - start > 100:
            continue
        for key, values in curves.items():
            cycles[key].append([values[start + round((end - start) * phase / 100)] for phase in PHASE])
    if len(cycles["kneeFlexion"]) < 3:
        raise ValueError(f"only {len(cycles['kneeFlexion'])} cycling cycles")
    participant_curves = {key: [statistics.median([cycle[phase] for cycle in values]) for phase in range(101)] for key, values in cycles.items()}
    return participant_curves, len(cycles["kneeFlexion"])


def build_cycling_specialized(zip_path: Path) -> dict[str, Any]:
    exclusions: list[dict[str, str]] = []
    by_group: dict[str, list[tuple[str, dict[str, list[float]], int]]] = {"RB": [], "TT": []}
    with zipfile.ZipFile(zip_path) as archive:
        for entry in sorted(archive.infolist(), key=lambda item: item.filename):
            match = re.search(r"/(\d+)_(RB|TT)_", "/" + entry.filename)
            if not match or not entry.filename.lower().endswith(".bvh"):
                continue
            participant, group = match.groups()
            try:
                with archive.open(entry) as binary:
                    curves, cycle_count = process_bvh_bytes(io.TextIOWrapper(binary, encoding="utf-8", errors="replace"))
                by_group[group].append((participant, curves, cycle_count))
            except (OSError, ValueError, KeyError) as error:
                exclusions.append({"file": entry.filename, "reason": str(error)})

    strata: dict[str, Any] = {}
    group_labels = {"RB": ("road", "Ruta · posición registrada"), "TT": ("time_trial", "Contrarreloj · posición registrada")}
    for group, (profile_id, label) in group_labels.items():
        included = sorted(by_group[group], key=lambda item: item[0])
        if not included:
            continue
        n_effective = len(included)
        curves: dict[str, Any] = {}
        summaries: dict[str, Any] = {}
        for key in ("kneeFlexion", "hipAngle", "ankleAngle", "trunkTilt"):
            participant_curves = [item[1][key] for item in included]
            values_by_phase = [[curve[phase] for curve in participant_curves] for phase in range(101)]
            curves[key] = curve_stats(values_by_phase, "deg", n_effective)
            summaries[f"{key}AtContact"] = stats([curve[0] for curve in participant_curves], "deg", n_effective)
            summaries[f"{key}Peak"] = stats([max(curve) for curve in participant_curves], "deg", n_effective)
        strata[profile_id] = {
            "label": label,
            "profileId": f"cycling_{profile_id}",
            "nEffective": n_effective,
            "curves": curves,
            "participantSummaries": summaries,
            "cycleAudit": {
                "participants": [item[0] for item in included],
                "medianCyclesPerParticipant": round(statistics.median([item[2] for item in included]), 2),
            },
            "evidenceLevel": "low",
            "sourceNote": "Zenodo BVH; la cohorte separa ruta y contrarreloj, pero no contiene triatlón ni MTB.",
        }

    observed = sorted({item[0] for values in by_group.values() for item in values})
    return {
        "schemaVersion": "cohort-ghost.v2",
        "id": "cohort-ghost-cycling-specialized",
        "version": f"{TODAY}.1",
        "status": "candidate",
        "activeInRecommendations": False,
        "title": "Fantasmas poblacionales bike · ruta y contrarreloj",
        "modality": "cycling",
        "population": {
            "reportedParticipants": 11,
            "observedParticipants": len(observed),
            "nEffective": len(observed),
            "includedParticipants": observed,
            "nEffectiveByStratum": {key: value["nEffective"] for key, value in strata.items()},
        },
        "normalization": {
            "units": "ángulos derivados de BVH en grados",
            "phase": "ciclos detectados por máximos de flexión de rodilla y remuestreados a 101 puntos 0–100%",
            "aggregation": "mediana bilateral y de ciclos por participante; luego mediana/P10/P90 entre participantes",
            "profilePolicy": "ruta y contrarreloj quedan separadas; no se infieren triatlón, MTB ni trail técnico",
        },
        "defaultStratum": "road",
        "strata": strata,
        "qualityAudit": {
            "sourceFiles": len(by_group["RB"]) + len(by_group["TT"]),
            "includedParticipants": len(observed),
            "excludedFiles": len(exclusions),
            "exclusions": exclusions,
            "checks": [
                "BVH legible y con cadena bilateral completa",
                "mínimo de 3 ciclos por participante",
                "ángulos y fase normalizados antes de agregar",
                "cuantiles calculados entre participantes",
                "ruta y contrarreloj no se mezclan",
            ],
        },
        "sources": [
            {"title": "Zenodo · Dataset of Motion Capture of Cyclists", "url": "https://zenodo.org/records/10668611", "license": "dataset abierto · verificar términos"},
            {"title": "PubMed · Cycling position optimisation systematic review", "url": "https://pubmed.ncbi.nlm.nih.gov/39285616/", "license": "revisión sistemática"},
        ],
    }


def build_report(running: dict[str, Any], cycling: dict[str, Any]) -> str:
    lines = [
        "# Auditoría de fantasmas poblacionales específicos",
        "",
        f"Procesado: {TODAY}. Sólo se versionan agregados compactos; los archivos brutos permanecen fuera del repositorio.",
        "",
        "## Running · OSF/OpenSim",
        "",
        f"- Participantes observados con al menos una condición válida: {running['population']['observedParticipants']}.",
        f"- Archivos de condición incluidos: {running['qualityAudit']['sourceFiles']}; archivos excluidos: {running['qualityAudit']['excludedFiles']}.",
        f"- n efectivo por estrato: " + ", ".join(f"{key} = {value}" for key, value in running["population"]["nEffectiveByStratum"].items()) + ".",
        "- Cada ciclo se delimitó con IC derecho, se remuestreó a 101 puntos y se resumió por participante antes de calcular P10–P90.",
        "- Calle/plano es un proxy de cinta del RBDS y queda separado de subida/bajada; no se presenta como trail técnico.",
        "",
        "## Bike · Zenodo BVH",
        "",
        f"- Participantes observados con ciclos válidos: {cycling['population']['observedParticipants']}.",
        f"- Archivos BVH incluidos: {cycling['qualityAudit']['sourceFiles']}; archivos excluidos: {cycling['qualityAudit']['excludedFiles']}.",
        f"- n efectivo por estrato: " + ", ".join(f"{key} = {value}" for key, value in cycling["population"]["nEffectiveByStratum"].items()) + ".",
        "- Ruta y contrarreloj se procesan por separado; el archivo no aporta una cohorte específica de triatlón o MTB.",
        "- Las métricas son ángulos derivados del esqueleto BVH; no sustituyen marcadores, fuerzas ni un ajuste biomecánico clínico.",
        "",
        "## Exclusiones y alcance",
        "",
        f"- Running: {len(running['qualityAudit']['exclusions'])} exclusiones registradas.",
        f"- Bike: {len(cycling['qualityAudit']['exclusions'])} exclusiones registradas.",
        "- Todos los fantasmas quedan como candidatos exploratorios y no alimentan recomendaciones automáticas.",
        "- Trail técnico, triatlón y MTB quedan indexados como fuentes futuras hasta contar con datos comparables y procesamiento auditado.",
    ]
    return "\n".join(lines) + "\n"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--running-mot-dir", type=Path, required=True)
    parser.add_argument("--running-events-dir", type=Path, required=True)
    parser.add_argument("--cycling-zip", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    args = parser.parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)
    baseline = args.output_dir / "cohort-ghost-running.json"
    running = build_running_specialized(args.running_mot_dir, args.running_events_dir, baseline)
    cycling = build_cycling_specialized(args.cycling_zip)
    (args.output_dir / "cohort-ghost-running-specialized.json").write_text(json.dumps(running, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (args.output_dir / "cohort-ghost-cycling-specialized.json").write_text(json.dumps(cycling, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (args.output_dir / "specialized-ghost-quality.md").write_text(build_report(running, cycling), encoding="utf-8")
    print(json.dumps({"running": running["qualityAudit"], "cycling": cycling["qualityAudit"]}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
