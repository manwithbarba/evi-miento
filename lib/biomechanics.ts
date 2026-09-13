import { SIDE_LANDMARKS } from './landmarks';

export type Side = 'left' | 'right';

export interface LandmarkPoint {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
}

export interface PoseFrame {
  time: number;
  landmarks: LandmarkPoint[];
}

export interface TargetRange {
  min: number;
  max: number;
}

export interface AnalysisSummary {
  kneeFlexionBdc: number;
  hipAngleMin: number;
  torsoAngleMedian: number;
  /** Media de visibilidad por landmark en los cuadros válidos. */
  detectionConfidence: number;
  /** Proporción de cuadros válidos sobre el total. */
  frameCoverage: number;
  /** Producto de detectionConfidence × frameCoverage (derivado). */
  confidence: number;
  validFrames: number;
  totalFrames: number;
  selectedFrame: PoseFrame;
}

// Landmark indices imported from lib/landmarks.ts (SIDE_LANDMARKS)

export function angleAt(
  first: LandmarkPoint,
  vertex: LandmarkPoint,
  third: LandmarkPoint,
): number {
  const a = { x: first.x - vertex.x, y: first.y - vertex.y };
  const b = { x: third.x - vertex.x, y: third.y - vertex.y };
  const denominator = Math.hypot(a.x, a.y) * Math.hypot(b.x, b.y);

  if (!denominator) return Number.NaN;

  const cosine = Math.min(1, Math.max(-1, (a.x * b.x + a.y * b.y) / denominator));
  return (Math.acos(cosine) * 180) / Math.PI;
}

export function torsoAngleFromHorizontal(shoulder: LandmarkPoint, hip: LandmarkPoint): number {
  const dx = Math.abs(shoulder.x - hip.x);
  const dy = Math.abs(shoulder.y - hip.y);
  return (Math.atan2(dy, dx) * 180) / Math.PI;
}

export function median(values: number[]): number {
  if (!values.length) return Number.NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function rounded(value: number): number {
  return Math.round(value * 10) / 10;
}

function frameConfidence(points: LandmarkPoint[]): number {
  return points.reduce((sum, point) => sum + (point.visibility ?? 1), 0) / points.length;
}

export function summarizePoseFrames(
  frames: PoseFrame[],
  side: Side,
  minimumVisibility = 0.55,
): AnalysisSummary | null {
  const index = SIDE_LANDMARKS[side];
  const measured = frames
    .map((frame) => {
      const shoulder = frame.landmarks[index.shoulder];
      const hip = frame.landmarks[index.hip];
      const knee = frame.landmarks[index.knee];
      const ankle = frame.landmarks[index.ankle];
      if (!shoulder || !hip || !knee || !ankle) return null;

      const points = [shoulder, hip, knee, ankle];
      const confidence = frameConfidence(points);
      if (points.some((point) => (point.visibility ?? 1) < minimumVisibility)) return null;

      const includedKneeAngle = angleAt(hip, knee, ankle);
      const hipAngle = angleAt(shoulder, hip, knee);
      const torsoAngle = torsoAngleFromHorizontal(shoulder, hip);

      if (![includedKneeAngle, hipAngle, torsoAngle].every(Number.isFinite)) return null;
      return { frame, includedKneeAngle, hipAngle, torsoAngle, confidence };
    })
    .filter((value): value is NonNullable<typeof value> => value !== null);

  if (measured.length < 3) return null;

  const bottomDeadCentre = measured.reduce((best, item) =>
    item.includedKneeAngle > best.includedKneeAngle ? item : best,
  );
  const kneeFlexionBdc = 180 - bottomDeadCentre.includedKneeAngle;
  const hipAngleMin = Math.min(...measured.map((item) => item.hipAngle));
  const torsoAngleMedian = median(measured.map((item) => item.torsoAngle));
  const avgDetection = measured.reduce((sum, item) => sum + item.confidence, 0) / measured.length;
  const coverage = measured.length / Math.max(frames.length, 1);

  return {
    kneeFlexionBdc: rounded(kneeFlexionBdc),
    hipAngleMin: rounded(hipAngleMin),
    torsoAngleMedian: rounded(torsoAngleMedian),
    detectionConfidence: rounded(avgDetection),
    frameCoverage: rounded(coverage),
    confidence: rounded(Math.min(1, avgDetection * coverage)),
    validFrames: measured.length,
    totalFrames: frames.length,
    selectedFrame: bottomDeadCentre.frame,
  };
}

export type RangeStatus = 'within' | 'below' | 'above';

export function rangeStatus(value: number, target: TargetRange): RangeStatus {
  if (value < target.min) return 'below';
  if (value > target.max) return 'above';
  return 'within';
}

export function buildKneeRecommendation(value: number, target: TargetRange): {
  title: string;
  detail: string;
  status: RangeStatus;
} {
  const status = rangeStatus(value, target);
  if (status === 'above') {
    return {
      status,
      title: 'Probar una suba mínima del sillín',
      detail: 'La rodilla llega más flexionada que el objetivo operativo. Subí 3 mm como experimento único, repetí el mismo protocolo y conservá el cambio sólo si mejora la lectura, el confort y la estabilidad.',
    };
  }
  if (status === 'below') {
    return {
      status,
      title: 'Probar una baja mínima del sillín',
      detail: 'La rodilla llega más extendida que el objetivo operativo. Bajá 3 mm como experimento único y repetí la medición antes de realizar otro cambio.',
    };
  }
  return {
    status,
    title: 'Conservar la altura como línea de base',
    detail: 'La flexión de rodilla está dentro del objetivo operativo configurado. No cambies la altura sólo por esta lectura; revisá confort, estabilidad pélvica y síntomas.',
  };
}

export function makeDemoSummary(): AnalysisSummary {
  const landmarks = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0.96 }));
  return {
    kneeFlexionBdc: 38.6,
    hipAngleMin: 86.2,
    torsoAngleMedian: 47.5,
    detectionConfidence: 0.96,
    frameCoverage: 0.94,
    confidence: 0.9,
    validFrames: 64,
    totalFrames: 68,
    selectedFrame: { time: 4.2, landmarks },
  };
}
