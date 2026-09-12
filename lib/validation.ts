import type { TargetRange } from './types';

export interface ValidationError {
  field: string;
  message: string;
}

/**
 * Umbral de confianza global mínimo para emitir una recomendación.
 * Documentado en README §4 pero no implementado en el MVP original.
 */
export const MIN_GLOBAL_CONFIDENCE = 0.65;

export function isConfidenceSufficient(confidence: number): boolean {
  return confidence >= MIN_GLOBAL_CONFIDENCE;
}

export function validateCyclingInputs(
  inseam: string,
  crank: string,
  target: TargetRange,
): ValidationError | null {
  const inseamNum = Number(inseam);
  const crankNum = Number(crank);
  if (!Number.isFinite(inseamNum) || inseamNum < 40 || inseamNum > 120) {
    return { field: 'inseam', message: 'Entrepierna fuera de rango (40–120 cm).' };
  }
  if (!Number.isFinite(crankNum) || crankNum < 120 || crankNum > 220) {
    return { field: 'crank', message: 'Biela fuera de rango (120–220 mm).' };
  }
  if (target.min >= target.max) {
    return { field: 'target', message: 'El mínimo del objetivo debe ser menor que el máximo.' };
  }
  return null;
}

export function validateRunningInputs(
  height: string,
  cadenceEstimate: string,
): ValidationError | null {
  const heightNum = Number(height);
  if (!Number.isFinite(heightNum) || heightNum < 100 || heightNum > 220) {
    return { field: 'height', message: 'Estatura fuera de rango (100–220 cm).' };
  }
  if (cadenceEstimate) {
    const cadNum = Number(cadenceEstimate);
    if (!Number.isFinite(cadNum) || cadNum < 100 || cadNum > 240) {
      return { field: 'cadence', message: 'Cadencia fuera de rango (100–240 SPM).' };
    }
  }
  return null;
}
