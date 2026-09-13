"""Build compact, auditable cohort ghosts from public biomechanical outputs.

The source files stay outside the repository. This script keeps only aggregated
statistics, participant-level inclusion results, and provenance in
public/population/. Both source processors run concurrently so a new cohort can
be refreshed without serializing independent downloads/normalization paths.
"""

from __future__ import annotations

import argparse
import csv
import json
import math
import re
import statistics
import zipfile
from concurrent.futures import ThreadPoolExecutor
from datetime import date
from pathlib import Path
from typing import Any, Iterable
from xml.etree import ElementTree as ET


TODAY = date.today().isoformat()
PHASE = list(range(101))


def finite(value: Any) -> bool:
    try:
        return math.isfinite(float(value))
    except (TypeError, ValueError):
        return False


def number(value: Any) -> float:
    return float(str(value).replace(",", "."))


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
    n = n_effective if n_effective is not None else len(values)
    return {
        "unit": unit,
        "median": round(statistics.median(values), 4),
        "p10": round(quantile(values, 0.10), 4),
        "p90": round(quantile(values, 0.90), 4),
        "nEffective": n,
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


def read_tsv(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle, delimiter="\t"))


def clean_cell(value: str | None) -> Any:
    if value is None:
        return None
    text = value.strip()
    if text == "":
        return None
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


def read_xlsx(path: Path) -> list[dict[str, Any]]:
    """Read the simple tabular workbook used by the public bike dataset.

    This deliberately uses the XLSX XML container instead of adding a runtime
    dependency to the application. It supports shared strings, inline strings,
    and numeric cells, which are the cell types in the published file.
    """

    namespace = {"x": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
    with zipfile.ZipFile(path) as archive:
        shared: list[str] = []
        if "xl/sharedStrings.xml" in archive.namelist():
            shared_root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
            for item in shared_root.findall("x:si", namespace):
                shared.append("".join(item.itertext()))

        sheet_root = ET.fromstring(archive.read("xl/worksheets/sheet1.xml"))
        rows: list[list[Any]] = []
        for row in sheet_root.findall(".//x:sheetData/x:row", namespace):
            cells: list[Any] = []
            for cell in row.findall("x:c", namespace):
                reference = cell.attrib.get("r", "A1")
                index = column_index(reference)
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

    headers = [str(value).strip() if value is not None else "" for value in rows[0]]
    return [dict(zip(headers, row + [None] * (len(headers) - len(row)))) for row in rows[1:]]


def running_metadata(path: Path) -> dict[str, dict[str, str]]:
    records = read_tsv(path)
    selected: dict[str, dict[str, str]] = {}
    for record in records:
        filename = record.get("FileName", "")
        if filename.endswith("static.txt"):
            try:
                participant = f"RBDS{int(number(record.get('Subject'))):03d}"
            except (TypeError, ValueError):
                participant = str(record.get("Subject"))
            selected[participant] = record
    return selected


def source_stat(value: str, unit: str, n_effective: int) -> dict[str, Any]:
    return stats([number(value)], unit, n_effective)


def build_running(input_dir: Path) -> dict[str, Any]:
    metadata = running_metadata(input_dir / "RBDSinfo.txt")
    files = sorted(input_dir.glob("RBDS*processed.txt"))
    valid_files: list[tuple[str, list[dict[str, str]]]] = []
    exclusions: list[dict[str, str]] = []
    speed_codes = {"2.5mps": "25", "3.5mps": "35", "4.5mps": "45"}
    fields = ("kneeAngZ", "hipAngZ", "ankleAngZ")

    for path in files:
        participant = path.stem.replace("processed", "")
        try:
            rows = read_tsv(path)
            phases = [number(row["PercGcycle"]) for row in rows]
            if len(rows) != 101 or phases != PHASE:
                raise ValueError("phase must contain exactly 101 rows from 0 to 100%")
            valid_files.append((participant, rows))
        except (KeyError, ValueError, IndexError) as error:
            exclusions.append({"participant": participant, "reason": str(error)})

    stratum_exclusions: list[dict[str, str]] = []
    strata: dict[str, Any] = {}
    for stratum, code in speed_codes.items():
        valid = []
        for participant, rows in valid_files:
            missing_columns = [
                f"{side}{field}{code}"
                for field in fields
                for side in ("R", "L")
                if f"{side}{field}{code}" not in rows[0] or not all(finite(row[f"{side}{field}{code}"]) for row in rows)
            ]
            if missing_columns:
                stratum_exclusions.append({"participant": participant, "stratum": stratum, "reason": f"missing/non-finite source column(s): {', '.join(missing_columns)}"})
            else:
                valid.append((participant, rows))
        included_ids = [participant for participant, _ in valid]
        curve_payload: dict[str, Any] = {}
        summary_payload: dict[str, Any] = {}
        for field, label in zip(fields, ("kneeAngleZ", "hipAngleZ", "ankleAngleZ")):
            values_by_phase: list[list[float]] = []
            participant_curves: list[list[float]] = []
            for _, rows in valid:
                participant_curve = [statistics.median([number(row[f"R{field}{code}"]), number(row[f"L{field}{code}"])]) for row in rows]
                participant_curves.append(participant_curve)
            for phase_index in range(101):
                values_by_phase.append([curve[phase_index] for curve in participant_curves])
            curve_payload[label] = curve_stats(values_by_phase, "deg", len(valid))
            at_contact = [curve[0] for curve in participant_curves]
            summary_payload[f"{label}AtContact"] = stats(at_contact, "deg", len(valid))
            peak = [max(curve) for curve in participant_curves]
            summary_payload[f"{label}Peak"] = stats(peak, "deg", len(valid))

        footstrike: dict[str, Any] = {}
        for side, prefix in (("right", "RFSI"), ("left", "LFSI")):
            counts: dict[str, int] = {}
            for participant in included_ids:
                value = metadata.get(participant, {}).get(f"{prefix}{code}", "unknown")
                counts[value] = counts.get(value, 0) + 1
            footstrike[side] = {"counts": counts, "nEffective": len(valid)}

        strata[stratum] = {
            "label": stratum.replace("mps", " m/s"),
            "nEffective": len(valid),
            "curves": curve_payload,
            "participantSummaries": summary_payload,
            "footStrikePattern": footstrike,
        }

    return {
        "schemaVersion": "cohort-ghost.v1",
        "id": "cohort-ghost-running-rbds",
        "version": f"{TODAY}.2",
        "status": "candidate",
        "activeInRecommendations": False,
        "title": "Fantasma poblacional running · RBDS",
        "modality": "running",
        "population": {
            "reportedParticipants": 39,
            "observedParticipants": len(files),
            "nEffective": len({participant for participant, _ in valid_files}),
            "includedParticipants": [participant for participant, _ in valid_files],
        },
        "normalization": {
            "units": "ángulos de fuente en grados",
            "phase": "ciclo de marcha normalizado a 101 puntos, 0–100%",
            "aggregation": "mediana bilateral por participante y luego mediana/P10/P90 de la cohorte",
            "semanticNote": "kneeAngleZ/hipAngleZ/ankleAngleZ conservan el eje publicado; no se renombran como una métrica 2D equivalente.",
        },
        "defaultStratum": "3.5mps",
        "strata": strata,
        "qualityAudit": {
            "sourceFiles": len(files),
            "includedParticipants": len({participant for participant, _ in valid_files}),
            "excludedParticipants": len(exclusions),
            "excludedStrata": len(stratum_exclusions),
            "exclusions": exclusions,
            "stratumExclusions": stratum_exclusions,
            "checks": ["101 fases exactas", "0–100% sin duplicados", "columnas requeridas finitas por velocidad", "bilateralización por mediana"],
        },
        "sources": [
            {"title": "Figshare · A public dataset of running biomechanics", "url": "https://doi.org/10.6084/m9.figshare.4543435", "license": "CC BY 4.0"},
            {"title": "Scientific Data description of RBDS", "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC5426356/", "license": "CC BY 4.0"},
        ],
    }


CYCLING_COLUMNS = {
    "kneeFlexionRangeDeg": ("KNEE FLEXION RANGE", "deg", 1.0),
    "hipFlexionMaxDeg": ("MAXIMUM HIP FLEXION", "deg", 1.0),
    "hipExtensionMaxDeg": ("MAXIMUM HIP EXTENSION", "deg", 1.0),
    "hipExtensionRangeDeg": ("HIP EXTENSION RANGE", "deg", 1.0),
    "ankleRangeDeg": ("ANKLE RANGE", "deg", 1.0),
    "pelvicTiltDeg": ("PELVIC TILT ANGLE", "deg", 1.0),
    "kneeMedialLateralRangeMm": ("MAXIMUM MEDIAL-LATERAL KNEE DISPLACEMENT RANGE", "mm", 10.0),
    "hipVerticalRangeMm": ("MAXIMUM VERTICAL HIP DISPLACEMENT RANGE", "mm", 10.0),
    "cadenceRpm": ("CADENCE", "rpm", 1.0),
}


def cycling_metric_stats(rows: list[dict[str, Any]], n_effective: int) -> dict[str, Any]:
    payload: dict[str, Any] = {}
    for key, (column, unit, multiplier) in CYCLING_COLUMNS.items():
        values = [number(row[column]) * multiplier for row in rows]
        payload[key] = stats(values, unit, n_effective)
        payload[key]["sourceColumn"] = column
    return payload


def build_cycling(input_file: Path) -> dict[str, Any]:
    rows = read_xlsx(input_file)
    expected_keys = {(setback, intensity) for setback in (0, 1, 2) for intensity in (1, 2)}
    by_participant: dict[str, list[dict[str, Any]]] = {}
    for row in rows:
        by_participant.setdefault(str(row.get("SUBJECT")), []).append(row)

    valid: list[tuple[str, list[dict[str, Any]]]] = []
    exclusions: list[dict[str, str]] = []
    for participant, participant_rows in sorted(by_participant.items(), key=lambda item: int(item[0])):
        observed = {(row.get("SETBACK"), row.get("INTENSITY")) for row in participant_rows}
        try:
            if observed != expected_keys:
                missing = sorted(expected_keys - observed)
                raise ValueError(f"missing conditions: {missing}")
            for row in participant_rows:
                for column, _, _ in CYCLING_COLUMNS.values():
                    if not finite(row.get(column)):
                        raise ValueError(f"missing/non-finite source column {column}")
            valid.append((participant, participant_rows))
        except ValueError as error:
            exclusions.append({"participant": participant, "reason": str(error)})

    participant_medians: list[dict[str, Any]] = []
    for _, participant_rows in valid:
        aggregate: dict[str, Any] = {}
        for key, (column, unit, multiplier) in CYCLING_COLUMNS.items():
            values = [number(row[column]) * multiplier for row in participant_rows]
            aggregate[key] = statistics.median(values)
        participant_medians.append(aggregate)

    overall: dict[str, Any] = {}
    for key, (_, unit, _) in CYCLING_COLUMNS.items():
        overall[key] = stats([row[key] for row in participant_medians], unit, len(valid))

    strata: dict[str, Any] = {"overall": {"label": "mediana de las 6 condiciones", "nEffective": len(valid), "metrics": overall}}
    labels = {0: "forward (-10%)", 1: "preferred", 2: "backward (+10%)"}
    intensities = {1: "VT1", 2: "VT2"}
    for setback in (0, 1, 2):
        for intensity in (1, 2):
            condition_rows = [
                row
                for _, participant_rows in valid
                for row in participant_rows
                if row.get("SETBACK") == setback and row.get("INTENSITY") == intensity
            ]
            strata[f"setback{setback}_intensity{intensity}"] = {
                "label": f"{labels[setback]} · {intensities[intensity]}",
                "nEffective": len(condition_rows),
                "metrics": cycling_metric_stats(condition_rows, len(condition_rows)),
            }

    return {
        "schemaVersion": "cohort-ghost.v1",
        "id": "cohort-ghost-cycling-mendeley-setback",
        "version": f"{TODAY}.2",
        "status": "candidate",
        "activeInRecommendations": False,
        "title": "Fantasma poblacional bike · setback e intensidad",
        "modality": "cycling",
        "population": {
            "reportedParticipants": 34,
            "observedParticipants": len(by_participant),
            "nEffective": len(valid),
            "includedParticipants": [participant for participant, _ in valid],
            "coverageGap": "El artículo informa 34 participantes; la planilla pública descargable contiene 32 identificadores completos.",
        },
        "normalization": {
            "units": "ángulos en grados; desplazamientos publicados en cm convertidos a mm; cadencia conservada en rpm",
            "phase": "la planilla publica estadísticos por ciclo y posiciones de manivela en grados; no contiene una curva temporal 0–100%",
            "aggregation": "mediana de las 6 condiciones por participante y luego mediana/P10/P90 entre participantes",
        },
        "defaultStratum": "overall",
        "strata": strata,
        "qualityAudit": {
            "sourceRows": len(rows),
            "reportedParticipants": 34,
            "observedParticipants": len(by_participant),
            "includedParticipants": len(valid),
            "excludedParticipants": len(exclusions),
            "exclusions": exclusions,
            "checks": ["6 condiciones por participante", "9 métricas requeridas finitas", "reducción a una observación por participante", "cm→mm documentado"],
        },
        "sources": [
            {"title": "Mendeley Data · Changes in saddle setback and intensity affect comfort and lower limb kinematics", "url": "https://data.mendeley.com/datasets/tvnwnzy8vm/1", "license": "CC BY 4.0"},
            {"title": "Scientific Reports article and methods", "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC12238236/", "license": "CC BY-NC-ND 4.0"},
        ],
    }


def build_report(running: dict[str, Any], cycling: dict[str, Any]) -> str:
    running_audit = running["qualityAudit"]
    cycling_audit = cycling["qualityAudit"]
    return f"""# Auditoría de fantasmas poblacionales

Procesado: {TODAY}. Los archivos fuente se descargan fuera del repositorio y no se publican; sólo se versionan agregados compactos y trazabilidad.

## Running · RBDS

- Fuente: [Figshare](https://doi.org/10.6084/m9.figshare.4543435), salida `RBDSxxxprocessed.txt`.
- Archivos auditados: {running_audit['sourceFiles']}.
- Participantes observados / con al menos una velocidad válida: {running_audit['sourceFiles']} / {running_audit['includedParticipants']}.
- Exclusiones de archivo: {running_audit['excludedParticipants']}; exclusiones de estrato por velocidad: {running_audit['excludedStrata']} (8 participantes no tienen 2,5 ni 4,5 m/s en la salida pública; 3,5 m/s sí está disponible).
- n efectivo por velocidad: 2,5 m/s = {running['strata']['2.5mps']['nEffective']}; 3,5 m/s = {running['strata']['3.5mps']['nEffective']}; 4,5 m/s = {running['strata']['4.5mps']['nEffective']}.
- Normalización: ángulos en grados, 101 puntos exactos de fase 0–100%, mediana bilateral por participante.
- Las curvas se publican por 2,5, 3,5 y 4,5 m/s; no se mezclan velocidades dentro de una curva.

## Bike · Mendeley Data

- Fuente: [Mendeley Data](https://data.mendeley.com/datasets/tvnwnzy8vm/1), `Dataset setback SR.xlsx`.
- Filas de condiciones procesadas: {cycling_audit['sourceRows']}.
- Participantes observados / efectivos: {cycling_audit['observedParticipants']} / {cycling_audit['includedParticipants']}.
- El artículo informa n=34, pero la planilla pública contiene 32 identificadores completos; esa brecha queda visible y evita presentar n=34 como n efectivo.
- Exclusiones por calidad: {cycling_audit['excludedParticipants']}.
- Normalización: ángulos en grados, desplazamientos de cm a mm y cadencia en rpm; mediana de las 6 condiciones antes de calcular cuantiles de cohorte.
- No se inventa una fase 0–100%: la planilla publica estadísticos por condición y posiciones de manivela.

## Alcance

Los dos archivos `cohort-ghost` quedan publicados como candidatos exploratorios y no alimentan recomendaciones automáticas. El índice conserva además fuentes abiertas enlazadas para futuras ampliaciones, pero no las presenta como procesadas.
"""


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--running-dir", type=Path, required=True)
    parser.add_argument("--bike-file", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    args = parser.parse_args()

    with ThreadPoolExecutor(max_workers=2) as executor:
        running_future = executor.submit(build_running, args.running_dir)
        cycling_future = executor.submit(build_cycling, args.bike_file)
        running = running_future.result()
        cycling = cycling_future.result()

    args.output_dir.mkdir(parents=True, exist_ok=True)
    (args.output_dir / "cohort-ghost-running.json").write_text(json.dumps(running, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (args.output_dir / "cohort-ghost-cycling.json").write_text(json.dumps(cycling, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (args.output_dir / "cohort-ghost-quality.md").write_text(build_report(running, cycling), encoding="utf-8")
    print(json.dumps({"running": running["qualityAudit"], "cycling": cycling["qualityAudit"]}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
