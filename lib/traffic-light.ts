import type {
  BiomechanicalEvaluation,
  MetrologicalEvaluation,
  TrafficLightLevel,
} from './types';
import type { EvidenceStrength } from './evidence';

// ---------------------------------------------------------------------------
// Calidad de señal
// ---------------------------------------------------------------------------

/**
 * Combina confianza y cobertura para decidir si una lectura puede mostrarse.
 * Estas bandas describen calidad de señal; no son intervalos de error angular.
 */
export function evaluateMetrologicalQuality(
  confidence: number,
  frameCoverage: number,
): MetrologicalEvaluation {
  if (confidence >= 0.80 && frameCoverage >= 0.85) {
    return {
      level: 'green',
      confidence,
      frameCoverage,
      qualityBand: 'high',
      title: 'Calidad de señal alta',
      description: 'Detección continua y con buena visibilidad. La lectura es utilizable para comparar tendencias; esta banda no representa un margen de error angular validado.',
    };
  }

  if (confidence >= 0.65 && frameCoverage >= 0.70) {
    return {
      level: 'yellow',
      confidence,
      frameCoverage,
      qualityBand: 'usable',
      title: 'Calidad de señal utilizable',
      description: 'Hay ruido visual u oclusiones moderadas. Interpretá tendencias y repetí la captura antes de tomar decisiones de ajuste.',
    };
  }

  return {
    level: 'red',
    confidence,
    frameCoverage,
    qualityBand: 'insufficient',
    title: 'Calidad de señal insuficiente',
    description: 'La visibilidad o cobertura temporal no alcanza para interpretar la métrica. Repetí la captura con mejor encuadre e iluminación.',
  };
}

// ---------------------------------------------------------------------------
// Evaluaciones legadas: lectura descriptiva, no corte normativo
// ---------------------------------------------------------------------------

function descriptiveEvaluation(
  value: number,
  label: string,
  unit: string,
  evidenceStrength: EvidenceStrength,
  detail: string,
): BiomechanicalEvaluation {
  const formatted = Number.isFinite(value) ? `${value.toFixed(1)}${unit}` : 'sin dato';
  return {
    level: 'yellow',
    title: 'Lectura descriptiva',
    detail: `${label}: ${formatted}. ${detail}`,
    evidenceStrength,
    source: 'descriptive',
  };
}

/** Compatibilidad API: la flexión BDC se informa, no se juzga con un corte fijo. */
export function evaluateCyclingKneeBdc(angleDeg: number): BiomechanicalEvaluation {
  return descriptiveEvaluation(
    angleDeg,
    'Flexión de rodilla BDC',
    '°',
    'moderate',
    'El ángulo dinámico ayuda a explorar la altura del sillín, pero la revisión disponible no establece un rango universal. Compará con tu línea base y confort.',
  );
}

export function evaluateCyclingKneeTracking(excursionMm: number): BiomechanicalEvaluation {
  return descriptiveEvaluation(
    excursionMm,
    'Tracking de rodilla',
    ' mm',
    'limited',
    'La escala lineal es estimada a partir del ancho pélvico asumido; no hay un corte universal validado para indicar lesión o ajuste.',
  );
}

export function evaluateCyclingPelvicRocking(rockingDeg: number): BiomechanicalEvaluation {
  return descriptiveEvaluation(
    rockingDeg,
    'Balanceo pélvico',
    '°',
    'limited',
    'Puede orientar una prueba de sillín, fatiga y control, pero no demuestra por sí solo que el sillín esté alto.',
  );
}

export function evaluateRunningCadence(cadenceSpm: number): BiomechanicalEvaluation {
  return descriptiveEvaluation(
    cadenceSpm,
    'Cadencia',
    ' SPM',
    'moderate',
    'La cadencia puede modificarse experimentalmente; la evidencia no respalda una cadencia óptima universal.',
  );
}

export function evaluateRunningPelvicDrop(dropDeg: number): BiomechanicalEvaluation {
  return descriptiveEvaluation(
    dropDeg,
    'Oblicuidad pélvica',
    '°',
    'insufficient',
    'La lectura 2D no identifica por sí sola una caída contralateral ni un Trendelenburg clínico.',
  );
}

export function evaluateRunningKneeValgus(valgusDeg: number): BiomechanicalEvaluation {
  return descriptiveEvaluation(
    valgusDeg,
    'Proyección frontal de rodilla',
    '°',
    'insufficient',
    'Es una proyección 2D dependiente del plano de cámara; no se aplica un punto de corte universal.',
  );
}

export function evaluateRunningStepWidth(stepWidthRatio: number, crossover: boolean): BiomechanicalEvaluation {
  return {
    level: 'yellow',
    title: 'Lectura descriptiva',
    detail: `Ancho de paso relativo: ${Number.isFinite(stepWidthRatio) ? stepWidthRatio.toFixed(2) : 'sin dato'}. ${crossover ? 'Se observó posible cruzamiento en la proyección.' : 'No se observó cruzamiento en la proyección.'} La literatura no respalda un corte universal para prescribir una corrección.`,
    evidenceStrength: 'insufficient',
    source: 'descriptive',
  };
}

/**
 * Semáforo exclusivamente técnico para comparar una lectura con un fantasma
 * de QA. Nunca debe interpretarse como semáforo clínico o normativo.
 */
export function evaluateAgainstGhost(
  observed: number,
  expected: number,
  tolerance: number,
  label: string,
  unit = '',
): BiomechanicalEvaluation {
  if (!Number.isFinite(observed)) {
    return {
      level: 'red',
      title: 'Sin dato comparable',
      detail: `${label}: no se pudo calcular la lectura para contrastarla con el fantasma de calibración.`,
      evidenceStrength: 'limited',
      source: 'ghost',
    };
  }

  const delta = observed - expected;
  const absoluteDelta = Math.abs(delta);
  const level: TrafficLightLevel = absoluteDelta <= tolerance
    ? 'green'
    : absoluteDelta <= tolerance * 2
      ? 'yellow'
      : 'red';
  const direction = delta >= 0 ? 'por encima' : 'por debajo';

  return {
    level,
    title: level === 'green' ? 'Compatible con fantasma' : level === 'yellow' ? 'Diferencia para explorar' : 'Revisar calibración',
    detail: `${label}: ${observed.toFixed(1)}${unit}; fantasma ${expected.toFixed(1)}${unit} ±${tolerance}${unit}. La lectura está ${direction} en ${absoluteDelta.toFixed(1)}${unit}; esto sólo controla el comportamiento del algoritmo.`,
    evidenceStrength: 'limited',
    source: 'ghost',
  };
}

// ---------------------------------------------------------------------------
// Clases y helpers de accesibilidad (WCAG 2.1 AA)
// ---------------------------------------------------------------------------

export function trafficLightBadgeClasses(level: TrafficLightLevel): string {
  switch (level) {
    case 'green':
      return 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300';
    case 'yellow':
      return 'border-amber-400/25 bg-amber-400/10 text-amber-300';
    case 'red':
      return 'border-rose-400/25 bg-rose-400/10 text-rose-300';
  }
}

export function trafficLightBorderClasses(level: TrafficLightLevel): string {
  switch (level) {
    case 'green':
      return 'border-emerald-400/30';
    case 'yellow':
      return 'border-amber-400/30';
    case 'red':
      return 'border-rose-400/30';
  }
}

export function trafficLightLabel(level: TrafficLightLevel): string {
  switch (level) {
    case 'green':
      return 'Óptimo';
    case 'yellow':
      return 'Atención';
    case 'red':
      return 'Revisión';
  }
}
