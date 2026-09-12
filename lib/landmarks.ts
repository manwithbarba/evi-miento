import type { Side } from './types';

/**
 * Índices de MediaPipe Pose Landmarker por lado.
 * Fuente única de verdad: elimina la duplicación entre page.tsx (SIDE_LANDMARKS)
 * y biomechanics.ts (SIDE_INDEX).
 *
 * Incluye heel y footIndex necesarios para running gait analysis.
 */
export const SIDE_LANDMARKS = {
  left: { shoulder: 11, hip: 23, knee: 25, ankle: 27, heel: 29, footIndex: 31 },
  right: { shoulder: 12, hip: 24, knee: 26, ankle: 28, heel: 30, footIndex: 32 },
} as const;

/** Puntos mínimos para ciclismo (hombro, cadera, rodilla, tobillo). */
export function cyclingLandmarkIndices(side: Side) {
  const s = SIDE_LANDMARKS[side];
  return [s.shoulder, s.hip, s.knee, s.ankle] as const;
}

/** Puntos necesarios para running (hombro, cadera, rodilla, tobillo, talón, punta). */
export function runningLandmarkIndices(side: Side) {
  const s = SIDE_LANDMARKS[side];
  return [s.shoulder, s.hip, s.knee, s.ankle, s.heel, s.footIndex] as const;
}

/** Índices bilaterales para vista frontal/posterior (ambas extremidades y pelvis). */
export const BILATERAL_LANDMARKS = {
  leftShoulder: 11,
  rightShoulder: 12,
  leftHip: 23,
  rightHip: 24,
  leftKnee: 25,
  rightKnee: 26,
  leftAnkle: 27,
  rightAnkle: 28,
  leftHeel: 29,
  rightHeel: 30,
  leftFootIndex: 31,
  rightFootIndex: 32,
} as const;

export function frontalLandmarkIndices() {
  return [
    BILATERAL_LANDMARKS.leftShoulder,
    BILATERAL_LANDMARKS.rightShoulder,
    BILATERAL_LANDMARKS.leftHip,
    BILATERAL_LANDMARKS.rightHip,
    BILATERAL_LANDMARKS.leftKnee,
    BILATERAL_LANDMARKS.rightKnee,
    BILATERAL_LANDMARKS.leftAnkle,
    BILATERAL_LANDMARKS.rightAnkle,
    BILATERAL_LANDMARKS.leftHeel,
    BILATERAL_LANDMARKS.rightHeel,
    BILATERAL_LANDMARKS.leftFootIndex,
    BILATERAL_LANDMARKS.rightFootIndex,
  ] as const;
}

