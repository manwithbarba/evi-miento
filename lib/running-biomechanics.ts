import { SIDE_LANDMARKS } from './landmarks';
import { angleAt, median } from './biomechanics';
import type { LandmarkPoint, PoseFrame, Side } from './types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FootStrikeType = 'rearfoot' | 'midfoot' | 'forefoot';

export interface StrideCycle {
  icIndex: number;
  msIndex: number;
  toIndex: number;
  icTime: number;
  toTime: number;
}

export interface RunningAnalysisSummary {
  modality: 'running';
  cadenceSpm: number;
  footStrikeAngleDeg: number;
  footStrikeType: FootStrikeType;
  overstridingIndex: number;
  kneeFlexionAtContactDeg: number;
  kneeFlexionAtMidstanceDeg: number;
  torsoLeanMedianDeg: number;
  detectionConfidence: number;
  frameCoverage: number;
  confidence: number;
  validFrames: number;
  totalFrames: number;
  strideCyclesDetected: number;
  selectedFrame: PoseFrame;
}

export interface RunningRecommendation {
  title: string;
  detail: string;
  status: 'optimal' | 'attention' | 'caution';
}

export interface RunningRecommendationContext {
  /** Línea base aceptada por el atleta; no es una norma poblacional. */
  baselineCadenceSpm?: number;
}

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

function rounded(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Ángulo del vector talón→punta respecto a la horizontal.
 * Positivo = talón más bajo que la punta (rearfoot).
 */
export function footStrikeAngle(heel: LandmarkPoint, toe: LandmarkPoint): number {
  return Math.atan2(toe.y - heel.y, toe.x - heel.x) * (180 / Math.PI);
}

export function classifyFootStrike(angle: number): FootStrikeType {
  if (angle > 8) return 'rearfoot';
  if (angle < -8) return 'forefoot';
  return 'midfoot';
}

/**
 * Inclinación del tronco respecto a la vertical (convención running).
 * 0° = perfectamente vertical.
 */
export function torsoLeanFromVertical(shoulder: LandmarkPoint, hip: LandmarkPoint): number {
  const dx = Math.abs(shoulder.x - hip.x);
  const dy = Math.abs(shoulder.y - hip.y);
  if (dy < 0.0001) return 90;
  return Math.atan2(dx, dy) * (180 / Math.PI);
}

/**
 * Distancia horizontal tobillo-rodilla normalizada por longitud de tibia.
 * Positivo = tobillo adelantado respecto a rodilla (overstriding).
 */
export function overstridingIndexCalc(
  ankle: LandmarkPoint,
  knee: LandmarkPoint,
): number {
  const tibiaLength = Math.hypot(knee.x - ankle.x, knee.y - ankle.y);
  if (tibiaLength < 0.001) return Number.NaN;
  return (ankle.x - knee.x) / tibiaLength;
}

// ---------------------------------------------------------------------------
// Stride cycle detection
// ---------------------------------------------------------------------------

interface MeasuredRunningFrame {
  frame: PoseFrame;
  index: number;
  anklY: number;
  kneeAngle: number;
  hipAngle: number;
  torsoAngle: number;
  fsAngle: number;
  overstrideIdx: number;
  confidence: number;
}

function frameConfidence(points: LandmarkPoint[]): number {
  return points.reduce((sum, p) => sum + (p.visibility ?? 1), 0) / points.length;
}

/**
 * Detecta ciclos de zancada a partir de mínimos locales de la trayectoria
 * vertical del tobillo (contacto inicial = pie más cerca del suelo = mayor y).
 */
export function detectStrideCycles(
  measured: MeasuredRunningFrame[],
  minCycleDuration = 0.3,
  maxCycleDuration = 0.95,
): StrideCycle[] {
  if (measured.length < 6) return [];

  // Suavizado con media móvil de 3 cuadros
  const smoothed = measured.map((m, i) => {
    if (i === 0 || i === measured.length - 1) return m.anklY;
    return (measured[i - 1].anklY + m.anklY + measured[i + 1].anklY) / 3;
  });

  // Detectar máximos locales de ankle.y (IC = pie abajo = y alto en coords normalizadas)
  const ics: number[] = [];
  for (let i = 1; i < smoothed.length - 1; i++) {
    if (smoothed[i] > smoothed[i - 1] && smoothed[i] >= smoothed[i + 1]) {
      ics.push(i);
    }
  }

  const cycles: StrideCycle[] = [];
  for (let c = 0; c < ics.length - 1; c++) {
    const icIdx = ics[c];
    const nextIcIdx = ics[c + 1];
    const icTime = measured[icIdx].frame.time;
    const nextIcTime = measured[nextIcIdx].frame.time;
    const duration = nextIcTime - icTime;

    if (duration < minCycleDuration || duration > maxCycleDuration) continue;

    // TO = mínimo local de ankle.y entre los dos IC (pie arriba = y bajo)
    let toIdx = icIdx + 1;
    let minY = measured[toIdx].anklY;
    for (let j = icIdx + 2; j < nextIcIdx; j++) {
      if (measured[j].anklY < minY) {
        minY = measured[j].anklY;
        toIdx = j;
      }
    }

    // MS = máxima flexión de rodilla (mínimo ángulo incluido) entre IC y TO
    let msIdx = icIdx;
    let minKneeAngle = measured[icIdx].kneeAngle;
    for (let j = icIdx + 1; j <= Math.min(toIdx, nextIcIdx - 1); j++) {
      if (measured[j].kneeAngle < minKneeAngle) {
        minKneeAngle = measured[j].kneeAngle;
        msIdx = j;
      }
    }

    cycles.push({
      icIndex: icIdx,
      msIndex: msIdx,
      toIndex: toIdx,
      icTime,
      toTime: measured[toIdx].frame.time,
    });
  }

  return cycles;
}

// ---------------------------------------------------------------------------
// Main summarizer
// ---------------------------------------------------------------------------

export function summarizeRunningFrames(
  frames: PoseFrame[],
  side: Side,
  minimumVisibility = 0.55,
): RunningAnalysisSummary | null {
  const idx = SIDE_LANDMARKS[side];

  const measured: MeasuredRunningFrame[] = [];
  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];
    const shoulder = frame.landmarks[idx.shoulder];
    const hip = frame.landmarks[idx.hip];
    const knee = frame.landmarks[idx.knee];
    const ankle = frame.landmarks[idx.ankle];
    const heel = frame.landmarks[idx.heel];
    const toe = frame.landmarks[idx.footIndex];
    if (!shoulder || !hip || !knee || !ankle || !heel || !toe) continue;

    const points = [shoulder, hip, knee, ankle, heel, toe];
    if (points.some(p => (p.visibility ?? 1) < minimumVisibility)) continue;

    const kneeAngle = angleAt(hip, knee, ankle);
    const hipAngle = angleAt(shoulder, hip, knee);
    const torsoAngle = torsoLeanFromVertical(shoulder, hip);
    const fsAngle = footStrikeAngle(heel, toe);
    const overstrideIdx = overstridingIndexCalc(ankle, knee);

    if (![kneeAngle, hipAngle, torsoAngle, fsAngle].every(Number.isFinite)) continue;

    measured.push({
      frame,
      index: i,
      anklY: ankle.y,
      kneeAngle,
      hipAngle,
      torsoAngle,
      fsAngle,
      overstrideIdx,
      confidence: frameConfidence(points),
    });
  }

  const cycles = detectStrideCycles(measured);
  if (cycles.length < 3) return null;

  // Métricas por ciclo
  const cadences: number[] = [];
  const fsAngles: number[] = [];
  const overstrides: number[] = [];
  const kneeFlexionsIC: number[] = [];
  const kneeFlexionsMS: number[] = [];
  const torsoAngles: number[] = [];

  for (const cycle of cycles) {
    const ic = measured[cycle.icIndex];
    const ms = measured[cycle.msIndex];

    // Cadencia: pasos por minuto = 60 / duración del ciclo × 2
    // (un ciclo aquí es un stride del mismo lado, 2 pasos = 1 stride)
    const strideDuration = (measured[cycles[cycles.indexOf(cycle) + 1]?.icIndex]?.frame.time ?? 0) - ic.frame.time;
    if (strideDuration > 0) {
      cadences.push(60 / strideDuration); // strides/min del lado visible
    }

    fsAngles.push(ic.fsAngle);
    overstrides.push(Number.isFinite(ic.overstrideIdx) ? ic.overstrideIdx : 0);
    kneeFlexionsIC.push(180 - ic.kneeAngle);
    kneeFlexionsMS.push(180 - ms.kneeAngle);
    torsoAngles.push(ic.torsoAngle);
  }

  if (cadences.length < 2) return null;

  // La cadencia lateral se multiplica × 2 para obtener SPM (ambos pies)
  const cadenceSpm = rounded(median(cadences) * 2);
  const fsaMedian = rounded(median(fsAngles));
  const avgDetection = measured.reduce((s, m) => s + m.confidence, 0) / measured.length;
  const coverage = measured.length / Math.max(frames.length, 1);

  // Cuadro representativo: IC del ciclo con mayor confianza
  const bestCycleIc = cycles.reduce((best, c) =>
    measured[c.icIndex].confidence > measured[best.icIndex].confidence ? c : best,
  );

  return {
    modality: 'running',
    cadenceSpm,
    footStrikeAngleDeg: fsaMedian,
    footStrikeType: classifyFootStrike(fsaMedian),
    overstridingIndex: rounded(median(overstrides)),
    kneeFlexionAtContactDeg: rounded(median(kneeFlexionsIC)),
    kneeFlexionAtMidstanceDeg: rounded(median(kneeFlexionsMS)),
    torsoLeanMedianDeg: rounded(median(torsoAngles)),
    detectionConfidence: rounded(avgDetection),
    frameCoverage: rounded(coverage),
    confidence: rounded(Math.min(1, avgDetection * coverage)),
    validFrames: measured.length,
    totalFrames: frames.length,
    strideCyclesDetected: cycles.length,
    selectedFrame: measured[bestCycleIc.icIndex].frame,
  };
}

// ---------------------------------------------------------------------------
// Recommendations (conservative, sport-only)
// ---------------------------------------------------------------------------

export function buildRunningRecommendations(
  metrics: RunningAnalysisSummary,
  context: RunningRecommendationContext = {},
): RunningRecommendation[] {
  const recs: RunningRecommendation[] = [];

  // Cadencia: sólo se sugiere experimentar si existe una línea base individual.
  const baseline = context.baselineCadenceSpm;
  const cadenceDifference = baseline && baseline > 0
    ? Math.abs(metrics.cadenceSpm - baseline) / baseline
    : 0;
  if (baseline && cadenceDifference > 0.05) {
    const direction = metrics.cadenceSpm > baseline ? 'por encima' : 'por debajo';
    recs.push({
      status: 'attention',
      title: 'Cadencia diferente de tu línea base',
      detail: `Cadencia actual: ${metrics.cadenceSpm} SPM, ${direction} de tu línea base (${baseline} SPM). Si querés probar un cambio, hacelo de forma gradual —por ejemplo ±5%— y conservá sólo lo que mejore confort y control.`,
    });
  } else {
    recs.push({
      status: 'optimal',
      title: 'Cadencia observada',
      detail: `Cadencia actual: ${metrics.cadenceSpm} SPM. No se aplica un rango óptimo universal; guardá una sesión cómoda como línea base para futuras comparaciones.`,
    });
  }

  // Patrón de contacto + rodilla en IC: describe redistribución de cargas.
  if (metrics.footStrikeType === 'rearfoot' && metrics.kneeFlexionAtContactDeg < 15) {
    recs.push({
      status: 'attention',
      title: 'Contacto de retropié con poca flexión',
      detail: 'Esta combinación puede modificar las cargas de frenado en el contacto. No es un diagnóstico: si se prueba feedback o reentrenamiento, hacelo gradualmente y controlá respuesta y molestias.',
    });
  } else if (metrics.footStrikeType === 'rearfoot') {
    recs.push({
      status: 'optimal',
      title: 'Patrón de retropié',
      detail: `Ángulo de contacto: ${metrics.footStrikeAngleDeg}°. El patrón de apoyo no es bueno o malo por sí solo: un cambio puede redistribuir cargas hacia otras estructuras.`,
    });
  } else {
    recs.push({
      status: 'optimal',
      title: `Patrón de ${metrics.footStrikeType === 'midfoot' ? 'mediopié' : 'antepié'} observado`,
      detail: `Ángulo de contacto: ${metrics.footStrikeAngleDeg}°. No se recomienda cambiarlo sólo para alcanzar una etiqueta; interpretalo junto con carga, rendimiento y confort.`,
    });
  }

  // Inclinación del tronco: no hay ventana fija aplicable a todos.
  recs.push({
    status: 'optimal',
    title: 'Inclinación del tronco observada',
    detail: `Inclinación: ${metrics.torsoLeanMedianDeg}°. Compará la consistencia entre sesiones y la relación con fatiga o confort; no se aplica una ventana universal.`,
  });

  return recs;
}

// ---------------------------------------------------------------------------
// Demo
// ---------------------------------------------------------------------------

export function makeRunningDemoSummary(): RunningAnalysisSummary {
  return {
    modality: 'running',
    cadenceSpm: 171.4,
    footStrikeAngleDeg: 2.9,
    footStrikeType: 'midfoot',
    overstridingIndex: -0.1,
    kneeFlexionAtContactDeg: 11.5,
    kneeFlexionAtMidstanceDeg: 38.7,
    torsoLeanMedianDeg: 10.1,
    detectionConfidence: 0.91,
    frameCoverage: 0.88,
    confidence: 0.80,
    validFrames: 58,
    totalFrames: 66,
    strideCyclesDetected: 8,
    selectedFrame: {
      time: 5.1,
      landmarks: Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0.93 })),
    },
  };
}
