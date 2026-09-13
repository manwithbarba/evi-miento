import type { AnalysisSummary, FrontalCyclingSummary, FrontalRunningSummary } from './types';
import type { RunningAnalysisSummary } from './running-biomechanics';

export type GhostModality = 'cycling' | 'running';
export type GhostComparisonStatus = 'aligned' | 'outside-tolerance' | 'not-comparable';

export interface GhostMetricReference {
  key: string;
  label: string;
  unit: string;
  expected: number;
  tolerance: number;
  note: string;
}

export interface GhostReference {
  id: string;
  version: string;
  modality: GhostModality;
  label: string;
  description: string;
  immutable: true;
  metrics: readonly GhostMetricReference[];
}

export interface GhostComparison {
  key: string;
  label: string;
  unit: string;
  observed: number;
  expected: number;
  tolerance: number;
  delta: number;
  status: GhostComparisonStatus;
}

/**
 * Fixture de calibración, no población normativa. Los valores se corresponden
 * con los casos demo que acompañan a la aplicación y sirven para detectar
 * regresiones de geometría, unidades y presentación.
 */
export const GHOST_REFERENCES: Record<GhostModality, GhostReference> = {
  cycling: {
    id: 'ghost-bike-biplanar',
    version: '2026-09-12.1',
    modality: 'cycling',
    label: 'Fantasma bike · calibración biplanar',
    description: 'Ciclista sintético estable para QA. No representa una postura ideal ni prescribe un ajuste.',
    immutable: true,
    metrics: [
      { key: 'kneeFlexionBdc', label: 'Flexión de rodilla BDC', unit: '°', expected: 38.6, tolerance: 2, note: 'Salida del caso sintético canónico.' },
      { key: 'hipAngleMin', label: 'Ángulo mínimo de cadera', unit: '°', expected: 86.2, tolerance: 2, note: 'Salida del caso sintético canónico.' },
      { key: 'torsoAngleMedian', label: 'Inclinación de torso', unit: '°', expected: 47.5, tolerance: 2, note: 'Salida del caso sintético canónico.' },
      { key: 'kneeLateralExcursionLeftMm', label: 'Tracking izquierdo', unit: 'mm', expected: 10.7, tolerance: 2, note: 'Salida con escala estimada por ancho pélvico.' },
      { key: 'kneeLateralExcursionRightMm', label: 'Tracking derecho', unit: 'mm', expected: 12.3, tolerance: 2, note: 'Salida con escala estimada por ancho pélvico.' },
      { key: 'pelvicRockingDeg', label: 'Balanceo pélvico', unit: '°', expected: 5.7, tolerance: 1, note: 'Salida del caso sintético canónico.' },
    ],
  },
  running: {
    id: 'ghost-running-biplanar',
    version: '2026-09-12.1',
    modality: 'running',
    label: 'Fantasma running · calibración biplanar',
    description: 'Corredor sintético estable para QA. No representa una técnica ideal ni un objetivo universal.',
    immutable: true,
    metrics: [
      { key: 'cadenceSpm', label: 'Cadencia', unit: 'SPM', expected: 171.4, tolerance: 2, note: 'Salida del caso sintético canónico; no rango normativo.' },
      { key: 'footStrikeAngleDeg', label: 'Ángulo de contacto', unit: '°', expected: 2.9, tolerance: 2, note: 'Clasificación morfológica de prueba.' },
      { key: 'overstridingIndex', label: 'Índice de sobrezancada', unit: '', expected: -0.1, tolerance: 0.05, note: 'Índice normalizado de prueba.' },
      { key: 'kneeFlexionAtContactDeg', label: 'Flexión de rodilla en IC', unit: '°', expected: 11.5, tolerance: 2, note: 'Salida del caso sintético canónico.' },
      { key: 'torsoLeanMedianDeg', label: 'Inclinación de tronco', unit: '°', expected: 10.1, tolerance: 2, note: 'Lectura descriptiva de prueba.' },
      { key: 'pelvicObliquityDeg', label: 'Oblicuidad pélvica', unit: '°', expected: 7.3, tolerance: 2, note: 'No equivale automáticamente a Trendelenburg.' },
      { key: 'dynamicKneeValgusLeftDeg', label: 'Proyección frontal izquierda', unit: '°', expected: 3.4, tolerance: 2, note: 'Proyección 2D de prueba.' },
      { key: 'dynamicKneeValgusRightDeg', label: 'Proyección frontal derecha', unit: '°', expected: 3.4, tolerance: 2, note: 'Proyección 2D de prueba.' },
      { key: 'stepWidthRatio', label: 'Ancho de paso relativo', unit: '', expected: 0.9, tolerance: 0.1, note: 'Ratio descriptivo de prueba.' },
    ],
  },
};

export function compareToGhost(
  observed: number | undefined,
  reference: GhostMetricReference,
): GhostComparison {
  if (observed === undefined || !Number.isFinite(observed)) {
    return {
      key: reference.key,
      label: reference.label,
      unit: reference.unit,
      observed: Number.NaN,
      expected: reference.expected,
      tolerance: reference.tolerance,
      delta: Number.NaN,
      status: 'not-comparable',
    };
  }

  const delta = observed - reference.expected;
  return {
    key: reference.key,
    label: reference.label,
    unit: reference.unit,
    observed,
    expected: reference.expected,
    tolerance: reference.tolerance,
    delta,
    status: Math.abs(delta) <= reference.tolerance ? 'aligned' : 'outside-tolerance',
  };
}

function compareMetrics(
  ghost: GhostReference,
  observed: Record<string, number | undefined>,
): GhostComparison[] {
  return ghost.metrics.map((reference) => compareToGhost(observed[reference.key], reference));
}

export function compareCyclingToGhost(
  summary: AnalysisSummary,
  frontal?: FrontalCyclingSummary,
): GhostComparison[] {
  return compareMetrics(GHOST_REFERENCES.cycling, {
    kneeFlexionBdc: summary.kneeFlexionBdc,
    hipAngleMin: summary.hipAngleMin,
    torsoAngleMedian: summary.torsoAngleMedian,
    kneeLateralExcursionLeftMm: frontal?.kneeLateralExcursionLeftMm,
    kneeLateralExcursionRightMm: frontal?.kneeLateralExcursionRightMm,
    pelvicRockingDeg: frontal?.pelvicRockingDeg,
  });
}

export function compareRunningToGhost(
  summary: RunningAnalysisSummary,
  frontal?: FrontalRunningSummary,
): GhostComparison[] {
  return compareMetrics(GHOST_REFERENCES.running, {
    cadenceSpm: summary.cadenceSpm,
    footStrikeAngleDeg: summary.footStrikeAngleDeg,
    overstridingIndex: summary.overstridingIndex,
    kneeFlexionAtContactDeg: summary.kneeFlexionAtContactDeg,
    torsoLeanMedianDeg: summary.torsoLeanMedianDeg,
    pelvicObliquityDeg: frontal?.pelvicObliquityDeg ?? frontal?.contralateralPelvicDropDeg,
    dynamicKneeValgusLeftDeg: frontal?.dynamicKneeValgusLeftDeg,
    dynamicKneeValgusRightDeg: frontal?.dynamicKneeValgusRightDeg,
    stepWidthRatio: frontal?.stepWidthRatio,
  });
}

export function ghostComparisonLabel(status: GhostComparisonStatus): string {
  switch (status) {
    case 'aligned':
      return 'Alineado';
    case 'outside-tolerance':
      return 'Diferencia';
    case 'not-comparable':
      return 'Sin plano';
  }
}
