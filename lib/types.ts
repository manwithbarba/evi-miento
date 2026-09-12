export type { LandmarkPoint, PoseFrame, TargetRange, Side, RangeStatus, AnalysisSummary } from './biomechanics';
export type { RunningAnalysisSummary, RunningRecommendation, FootStrikeType } from './running-biomechanics';

/** Modalidad deportiva soportada. */
export type SportModality = 'cycling' | 'running';

/** Plano de visión de la cámara en captura biplanar desacoplada. */
export type CameraView = 'sagittal' | 'frontal';

/** Niveles de semaforización accesibles (WCAG 2.1 AA). */
export type TrafficLightLevel = 'green' | 'yellow' | 'red';

/** Evaluación metrológica de la calidad del dato e incertidumbre instrumental. */
export interface MetrologicalEvaluation {
  level: TrafficLightLevel;
  confidence: number;
  frameCoverage: number;
  marginOfErrorDeg: number;
  title: string;
  description: string;
}

/** Evaluación biomecánica normativa respecto a rangos funcionales. */
export interface BiomechanicalEvaluation {
  level: TrafficLightLevel;
  title: string;
  detail: string;
}

/** Cinemática frontal en carrera (vista posterior o anterior). */
export interface FrontalRunningSummary {
  modality: 'running';
  view: 'frontal';
  contralateralPelvicDropDeg: number;
  dynamicKneeValgusLeftDeg: number;
  dynamicKneeValgusRightDeg: number;
  stepWidthRatio: number;
  crossoverDetected: boolean;
  detectionConfidence: number;
  frameCoverage: number;
  confidence: number;
  validFrames: number;
  totalFrames: number;
  selectedFrame: import('./biomechanics').PoseFrame;
}

/** Cinemática frontal en ciclismo (vista frontal o posterior). */
export interface FrontalCyclingSummary {
  modality: 'cycling';
  view: 'frontal';
  kneeLateralExcursionLeftMm: number;
  kneeLateralExcursionRightMm: number;
  pelvicRockingDeg: number;
  detectionConfidence: number;
  frameCoverage: number;
  confidence: number;
  validFrames: number;
  totalFrames: number;
  selectedFrame: import('./biomechanics').PoseFrame;
}

/** Estado del flujo de análisis (compartido entre modalidades). */
export type AnalysisState =
  | 'idle'
  | 'video-ready'
  | 'loading'
  | 'analyzing'
  | 'complete'
  | 'error';

/** Disciplina de ciclismo. */
export type CyclingDiscipline = 'road' | 'race' | 'gravel' | 'mtb';

/** Nivel del corredor. */
export type RunnerLevel = 'recreational' | 'intermediate' | 'competitive';
