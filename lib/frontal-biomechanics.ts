import { BILATERAL_LANDMARKS } from './landmarks';
import { angleAt, median } from './biomechanics';
import type {
  FrontalCyclingSummary,
  FrontalRunningSummary,
  LandmarkPoint,
  PoseFrame,
} from './types';

// ---------------------------------------------------------------------------
// Helpers trigonométricos en plano frontal (coronal)
// ---------------------------------------------------------------------------

function rounded(value: number): number {
  return Math.round(value * 10) / 10;
}

function frameBilateralConfidence(points: LandmarkPoint[]): number {
  return points.reduce((sum, p) => sum + (p.visibility ?? 1), 0) / points.length;
}

/**
 * Ángulo de inclinación pélvica respecto a la horizontal en el plano frontal.
 * 0° = pelvis perfectamente nivelada.
 */
export function pelvicAngleDeg(leftHip: LandmarkPoint, rightHip: LandmarkPoint): number {
  const dx = Math.abs(rightHip.x - leftHip.x);
  const dy = Math.abs(rightHip.y - leftHip.y);
  if (dx < 0.0001) return 90;
  return Math.atan2(dy, dx) * (180 / Math.PI);
}

/**
 * Ángulo de proyección en el plano frontal (FPPA / valgo dinámico).
 * Desviación respecto a los 180° de alineación recta cadera-rodilla-tobillo.
 * 0° = perfectamente recto; > 0° = desviación medial (valgo).
 */
export function frontalKneeValgusDeg(
  hip: LandmarkPoint,
  knee: LandmarkPoint,
  ankle: LandmarkPoint,
): number {
  const angle = angleAt(hip, knee, ankle);
  if (!Number.isFinite(angle)) return Number.NaN;
  return Math.max(0, 180 - angle);
}

/**
 * Distancia horizontal entre tobillos normalizada por el ancho bi-ilíaco de la pelvis.
 * Ratio < 0.1 indica base muy estrecha; crossover si los pies se cruzan en el eje X.
 */
export function stepWidthNormalized(
  leftAnkle: LandmarkPoint,
  rightAnkle: LandmarkPoint,
  leftHip: LandmarkPoint,
  rightHip: LandmarkPoint,
): { ratio: number; crossover: boolean } {
  const pelvicWidth = Math.hypot(rightHip.x - leftHip.x, rightHip.y - leftHip.y);
  if (pelvicWidth < 0.001) return { ratio: 0, crossover: false };

  // En imagen frontal estándar: el pie izquierdo del sujeto está a la derecha del observador
  // o viceversa. Medimos la separación absoluta y verificamos inversión de orden.
  const ankleDist = Math.abs(rightAnkle.x - leftAnkle.x);
  const ratio = ankleDist / pelvicWidth;

  // Si la cadera izquierda está a menor X que la derecha pero el tobillo izquierdo está a mayor X
  const hipsOrder = leftHip.x < rightHip.x;
  const anklesOrder = leftAnkle.x < rightAnkle.x;
  const crossover = hipsOrder !== anklesOrder && ankleDist > 0.01;

  return { ratio: rounded(ratio), crossover };
}

/**
 * Desviación horizontal de la rodilla respecto a la línea plomada cadera-tobillo.
 * Normalizada y escalada a milímetros asumiendo un ancho pélvico humano medio de 260 mm.
 */
export function kneePlumblineDeviationMm(
  hip: LandmarkPoint,
  knee: LandmarkPoint,
  ankle: LandmarkPoint,
  pelvicWidthPixels: number,
  assumedPelvicWidthMm = 260,
): number {
  if (pelvicWidthPixels < 0.001) return 0;
  const mmPerPixel = assumedPelvicWidthMm / pelvicWidthPixels;

  const dy = ankle.y - hip.y;
  if (Math.abs(dy) < 0.0001) return 0;

  // Posición X teórica sobre la línea recta cadera->tobillo a la altura Y de la rodilla
  const expectedX = hip.x + ((knee.y - hip.y) / dy) * (ankle.x - hip.x);
  const deviationPixels = Math.abs(knee.x - expectedX);
  return rounded(deviationPixels * mmPerPixel);
}

// ---------------------------------------------------------------------------
// Resumidor Frontal de Ciclismo (Knee Tracking + Pelvic Rocking)
// ---------------------------------------------------------------------------

export function summarizeFrontalCyclingFrames(
  frames: PoseFrame[],
  minimumVisibility = 0.55,
): FrontalCyclingSummary | null {
  const measured = frames
    .map((frame) => {
      const lh = frame.landmarks[BILATERAL_LANDMARKS.leftHip];
      const rh = frame.landmarks[BILATERAL_LANDMARKS.rightHip];
      const lk = frame.landmarks[BILATERAL_LANDMARKS.leftKnee];
      const rk = frame.landmarks[BILATERAL_LANDMARKS.rightKnee];
      const la = frame.landmarks[BILATERAL_LANDMARKS.leftAnkle];
      const ra = frame.landmarks[BILATERAL_LANDMARKS.rightAnkle];

      if (!lh || !rh || !lk || !rk || !la || !ra) return null;
      const points = [lh, rh, lk, rk, la, ra];
      if (points.some((p) => (p.visibility ?? 1) < minimumVisibility)) return null;

      const pWidth = Math.hypot(rh.x - lh.x, rh.y - lh.y);
      const pAngle = pelvicAngleDeg(lh, rh);
      const lDev = kneePlumblineDeviationMm(lh, lk, la, pWidth);
      const rDev = kneePlumblineDeviationMm(rh, rk, ra, pWidth);
      const conf = frameBilateralConfidence(points);

      return { frame, pAngle, lDev, rDev, conf };
    })
    .filter((v): v is NonNullable<typeof v> => v !== null);

  if (measured.length < 5) return null;

  const pAngles = measured.map((m) => m.pAngle);
  const pelvicRockingDeg = rounded(Math.max(...pAngles) - Math.min(...pAngles));
  const lDevMedian = rounded(median(measured.map((m) => m.lDev)));
  const rDevMedian = rounded(median(measured.map((m) => m.rDev)));

  const avgDetection = measured.reduce((sum, m) => sum + m.conf, 0) / measured.length;
  const coverage = measured.length / Math.max(frames.length, 1);

  // Cuadro con mayor confianza
  const best = measured.reduce((b, m) => (m.conf > b.conf ? m : b));

  return {
    modality: 'cycling',
    view: 'frontal',
    kneeLateralExcursionLeftMm: lDevMedian,
    kneeLateralExcursionRightMm: rDevMedian,
    pelvicRockingDeg,
    detectionConfidence: rounded(avgDetection),
    frameCoverage: rounded(coverage),
    confidence: rounded(Math.min(1, avgDetection * coverage)),
    validFrames: measured.length,
    totalFrames: frames.length,
    selectedFrame: best.frame,
  };
}

// ---------------------------------------------------------------------------
// Resumidor Frontal de Carrera (Caída Pélvica + Valgo Dinámico + Step Width)
// ---------------------------------------------------------------------------

export function summarizeFrontalRunningFrames(
  frames: PoseFrame[],
  minimumVisibility = 0.55,
): FrontalRunningSummary | null {
  const measured = frames
    .map((frame) => {
      const lh = frame.landmarks[BILATERAL_LANDMARKS.leftHip];
      const rh = frame.landmarks[BILATERAL_LANDMARKS.rightHip];
      const lk = frame.landmarks[BILATERAL_LANDMARKS.leftKnee];
      const rk = frame.landmarks[BILATERAL_LANDMARKS.rightKnee];
      const la = frame.landmarks[BILATERAL_LANDMARKS.leftAnkle];
      const ra = frame.landmarks[BILATERAL_LANDMARKS.rightAnkle];

      if (!lh || !rh || !lk || !rk || !la || !ra) return null;
      const points = [lh, rh, lk, rk, la, ra];
      if (points.some((p) => (p.visibility ?? 1) < minimumVisibility)) return null;

      const pAngle = pelvicAngleDeg(lh, rh);
      const lValgus = frontalKneeValgusDeg(lh, lk, la);
      const rValgus = frontalKneeValgusDeg(rh, rk, ra);
      const { ratio, crossover } = stepWidthNormalized(la, ra, lh, rh);
      const conf = frameBilateralConfidence(points);

      return { frame, pAngle, lValgus, rValgus, ratio, crossover, conf };
    })
    .filter((v): v is NonNullable<typeof v> => v !== null);

  if (measured.length < 6) return null;

  // Caída pélvica máxima observada durante los apoyos monopodales
  const pelvicDropDeg = rounded(Math.max(...measured.map((m) => m.pAngle)));
  const lValgusMedian = rounded(median(measured.map((m) => m.lValgus)));
  const rValgusMedian = rounded(median(measured.map((m) => m.rValgus)));
  const stepWidthRatio = rounded(median(measured.map((m) => m.ratio)));
  const crossoverDetected = measured.some((m) => m.crossover);

  const avgDetection = measured.reduce((sum, m) => sum + m.conf, 0) / measured.length;
  const coverage = measured.length / Math.max(frames.length, 1);
  const best = measured.reduce((b, m) => (m.conf > b.conf ? m : b));

  return {
    modality: 'running',
    view: 'frontal',
    contralateralPelvicDropDeg: pelvicDropDeg,
    dynamicKneeValgusLeftDeg: lValgusMedian,
    dynamicKneeValgusRightDeg: rValgusMedian,
    stepWidthRatio,
    crossoverDetected,
    detectionConfidence: rounded(avgDetection),
    frameCoverage: rounded(coverage),
    confidence: rounded(Math.min(1, avgDetection * coverage)),
    validFrames: measured.length,
    totalFrames: frames.length,
    selectedFrame: best.frame,
  };
}

// ---------------------------------------------------------------------------
// Demos Frontales
// ---------------------------------------------------------------------------

export function makeFrontalCyclingDemoSummary(): FrontalCyclingSummary {
  const landmarks = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0.94 }));
  return {
    modality: 'cycling',
    view: 'frontal',
    kneeLateralExcursionLeftMm: 11.2,
    kneeLateralExcursionRightMm: 13.8,
    pelvicRockingDeg: 1.9,
    detectionConfidence: 0.94,
    frameCoverage: 0.91,
    confidence: 0.86,
    validFrames: 58,
    totalFrames: 64,
    selectedFrame: { time: 3.4, landmarks },
  };
}

export function makeFrontalRunningDemoSummary(): FrontalRunningSummary {
  const landmarks = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0.92 }));
  return {
    modality: 'running',
    view: 'frontal',
    contralateralPelvicDropDeg: 3.6,
    dynamicKneeValgusLeftDeg: 4.1,
    dynamicKneeValgusRightDeg: 4.6,
    stepWidthRatio: 0.22,
    crossoverDetected: false,
    detectionConfidence: 0.92,
    frameCoverage: 0.89,
    confidence: 0.82,
    validFrames: 62,
    totalFrames: 70,
    selectedFrame: { time: 4.2, landmarks },
  };
}
