export type { LandmarkPoint, PoseFrame, TargetRange, Side, RangeStatus, AnalysisSummary } from './biomechanics';
export type { RunningAnalysisSummary, RunningRecommendation, FootStrikeType } from './running-biomechanics';
export type { EvidenceReference, EvidenceStrength, EvidenceUse, MetricEvidence } from './evidence';
export type { GhostComparison, GhostComparisonStatus, GhostMetricReference, GhostReference } from './ghost-reference';

/** Modalidad deportiva soportada. */
export type SportModality = 'cycling' | 'running';

/** Plano de visión de la cámara en captura biplanar desacoplada. */
export type CameraView = 'sagittal' | 'frontal';

/** Niveles de semaforización accesibles (WCAG 2.1 AA). */
export type TrafficLightLevel = 'green' | 'yellow' | 'red';

/** Calidad de señal observada. No es una estimación validada de error angular. */
export interface MetrologicalEvaluation {
  level: TrafficLightLevel;
  confidence: number;
  frameCoverage: number;
  qualityBand: 'high' | 'usable' | 'insufficient';
  title: string;
  description: string;
}

/** Evaluación descriptiva conservada por compatibilidad con el semáforo legado. */
export interface BiomechanicalEvaluation {
  level: TrafficLightLevel;
  title: string;
  detail: string;
  evidenceStrength?: import('./evidence').EvidenceStrength;
  source?: 'descriptive' | 'ghost';
}

/** Cinemática frontal en carrera (vista posterior o anterior). */
export interface FrontalRunningSummary {
  modality: 'running';
  view: 'frontal';
  /** Oblicuidad de la línea bi-ilíaca; no equivale por sí sola a Trendelenburg. */
  pelvicObliquityDeg: number;
  /** Alias legado conservado para sesiones guardadas anteriores. */
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
  /** La escala lineal actual se estima usando un ancho pélvico asumido. */
  linearScale: 'assumed-pelvic-width';
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
