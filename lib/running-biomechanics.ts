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
): RunningRecommendation[] {
  const recs: RunningRecommendation[] = [];

  // Cadencia
  if (metrics.cadenceSpm < 160 && metrics.overstridingIndex > 0.15) {
    recs.push({
      status: 'caution',
      title: 'Cadencia baja con sobrezancada',
      detail: `Cadencia actual: ${metrics.cadenceSpm} SPM. Probá incrementar un 5% (≈${Math.round(metrics.cadenceSpm * 1.05)} SPM) usando un metrónomo. Acortar la zancada reduce las fuerzas de frenado al contacto.`,
    });
  } else if (metrics.cadenceSpm < 160) {
    recs.push({
      status: 'attention',
      title: 'Cadencia por debajo de 160 SPM',
      detail: `Cadencia actual: ${metrics.cadenceSpm} SPM. Una cadencia moderadamente baja no es necesariamente un problema si el patrón de contacto es eficiente. Considerar incrementar solo si se combina con molestias.`,
    });
  } else if (metrics.cadenceSpm > 200) {
    recs.push({
      status: 'attention',
      title: 'Cadencia alta',
      detail: `Cadencia actual: ${metrics.cadenceSpm} SPM. Verificar que la eficiencia metabólica no esté comprometida; una cadencia excesiva puede incrementar el costo cardiorrespiratorio.`,
    });
  } else {
    recs.push({
      status: 'optimal',
      title: 'Cadencia dentro de rango funcional',
      detail: `Cadencia actual: ${metrics.cadenceSpm} SPM (rango 160–200 SPM).`,
    });
  }

  // Patrón de contacto + rodilla en IC
  if (metrics.footStrikeType === 'rearfoot' && metrics.kneeFlexionAtContactDeg < 15) {
    recs.push({
      status: 'caution',
      title: 'Aterrizaje de talón con rodilla extendida',
      detail: 'La combinación de retropié marcado y rodilla casi bloqueada en el contacto inicial genera fuerzas de frenado elevadas. Trabajar skipping y propioceptivos de contacto.',
    });
  } else if (metrics.footStrikeType === 'rearfoot') {
    recs.push({
      status: 'attention',
      title: 'Patrón de retropié',
      detail: `Ángulo de contacto: ${metrics.footStrikeAngleDeg}°. No es necesariamente ineficiente si la cadencia es adecuada y no hay molestias.`,
    });
  } else {
    recs.push({
      status: 'optimal',
      title: `Patrón de ${metrics.footStrikeType === 'midfoot' ? 'mediopié' : 'antepié'}`,
      detail: `Ángulo de contacto: ${metrics.footStrikeAngleDeg}°.`,
    });
  }

  // Inclinación del tronco
  if (metrics.torsoLeanMedianDeg < 2) {
    recs.push({
      status: 'attention',
      title: 'Postura excesivamente erguida',
      detail: 'Inclinación del tronco < 2°. Favorecer una leve inclinación desde el tobillo (no flexión lumbar) para mejorar la propulsión.',
    });
  } else if (metrics.torsoLeanMedianDeg > 15) {
    recs.push({
      status: 'caution',
      title: 'Colapso anterior excesivo',
      detail: `Inclinación del tronco: ${metrics.torsoLeanMedianDeg}°. Reforzar estabilidad de core y revisar fatiga.`,
    });
  } else {
    recs.push({
      status: 'optimal',
      title: 'Inclinación del tronco adecuada',
      detail: `Inclinación: ${metrics.torsoLeanMedianDeg}° (rango funcional 4°–10°).`,
    });
  }

  return recs;
}

// ---------------------------------------------------------------------------
// Demo
// ---------------------------------------------------------------------------

export function makeRunningDemoSummary(): RunningAnalysisSummary {
  return {
    modality: 'running',
    cadenceSpm: 168,
    footStrikeAngleDeg: 6.2,
    footStrikeType: 'midfoot',
    overstridingIndex: 0.08,
    kneeFlexionAtContactDeg: 18.4,
    kneeFlexionAtMidstanceDeg: 38.7,
    torsoLeanMedianDeg: 7.1,
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
