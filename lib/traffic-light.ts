import type {
  BiomechanicalEvaluation,
  MetrologicalEvaluation,
  TrafficLightLevel,
} from './types';

// ---------------------------------------------------------------------------
// 1. Evaluación de Calidad Metrológica (Incertidumbre Instrumental)
// ---------------------------------------------------------------------------

/**
 * Evalúa la calidad metrológica de la inferencia combinando la confianza
 * de detección media y la cobertura temporal de cuadros válidos.
 *
 * Verde: Confianza >= 0.80 y Cobertura >= 85% (Incertidumbre angular aprox. ±1.5°)
 * Amarillo: Confianza >= 0.65 y Cobertura >= 70% (Incertidumbre aprox. ±4.0°)
 * Rojo: Confianza < 0.65 o Cobertura < 70% (Calidad insuficiente para emitir pautas)
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
      marginOfErrorDeg: 1.5,
      title: 'Calidad metrológica óptima',
      description: 'Detección anatómica nítida y continua sin oclusiones significativas. Margen de error estimado en ±1.5°.',
    };
  }

  if (confidence >= 0.65 && frameCoverage >= 0.70) {
    return {
      level: 'yellow',
      confidence,
      frameCoverage,
      marginOfErrorDeg: 4.0,
      title: 'Calidad metrológica aceptable',
      description: 'Presencia moderada de ruido visual u oclusiones en el recorrido. Margen de error estimado en ±4.0°. Interpretar tendencias.',
    };
  }

  return {
    level: 'red',
    confidence,
    frameCoverage,
    marginOfErrorDeg: 8.0,
    title: 'Calidad metrológica insuficiente',
    description: 'La baja visibilidad o cobertura temporal (<70%) no permite garantizar mediciones fiables. Repetir la captura.',
  };
}

// ---------------------------------------------------------------------------
// 2. Evaluadores Biomecánicos por Disciplina y Plano
// ---------------------------------------------------------------------------

/** Flexión de rodilla al punto muerto inferior (BDC) en ciclismo. */
export function evaluateCyclingKneeBdc(angleDeg: number): BiomechanicalEvaluation {
  if (angleDeg >= 25 && angleDeg <= 35) {
    return {
      level: 'green',
      title: 'Rango funcional óptimo',
      detail: `${angleDeg.toFixed(1)}° (rango de referencia 25°–35°). Excelente equilibrio entre potencia y salud patelofemoral.`,
    };
  }
  if ((angleDeg >= 20 && angleDeg < 25) || (angleDeg > 35 && angleDeg <= 40)) {
    return {
      level: 'yellow',
      title: 'Zona de ajuste menor',
      detail: `${angleDeg.toFixed(1)}°. Desviación moderada. Se recomienda ajuste sutil (±3 mm en sillín) si existe incomodidad.`,
    };
  }
  return {
    level: 'red',
    title: 'Desviación cinemática marcada',
    detail: `${angleDeg.toFixed(1)}°. ${angleDeg < 20 ? 'Riesgo de hiperextensión en tendón de Aquiles/isquiotibiales.' : 'Hiperflexión excesiva con sobrecarga patelofemoral.'}`,
  };
}

/** Desviación lateral de rodilla en vista frontal (Knee Tracking en ciclismo). */
export function evaluateCyclingKneeTracking(excursionMm: number): BiomechanicalEvaluation {
  if (excursionMm <= 15) {
    return {
      level: 'green',
      title: 'Alineación frontal óptima',
      detail: `${excursionMm.toFixed(1)} mm de excursión. Trayectoria lineal en el plano sagital sin colapso medial.`,
    };
  }
  if (excursionMm <= 25) {
    return {
      level: 'yellow',
      title: 'Desviación mediolateral moderada',
      detail: `${excursionMm.toFixed(1)} mm. Movimiento en "8" perceptible; revisar cuñas de calas o rotación de pie.`,
    };
  }
  return {
    level: 'red',
    title: 'Excursión lateral excesiva',
    detail: `${excursionMm.toFixed(1)} mm. Desalineación marcada de la rodilla con el eje del pedal; evaluar factor Q y soporte plantar.`,
  };
}

/** Balanceo u oscilación pélvica lateral en el sillín (Pelvic Rocking en ciclismo). */
export function evaluateCyclingPelvicRocking(rockingDeg: number): BiomechanicalEvaluation {
  if (rockingDeg <= 2.5) {
    return {
      level: 'green',
      title: 'Estabilidad pélvica conservada',
      detail: `${rockingDeg.toFixed(1)}° de oscilación. La pelvis permanece estable sobre el plano del asiento.`,
    };
  }
  if (rockingDeg <= 4.5) {
    return {
      level: 'yellow',
      title: 'Oscilación pélvica moderada',
      detail: `${rockingDeg.toFixed(1)}°. Ligero balanceo alterno; evaluar si la altura del sillín está al límite o hay fatiga.`,
    };
  }
  return {
    level: 'red',
    title: 'Balanceo pélvico acentuado',
    detail: `${rockingDeg.toFixed(1)}°. Indica habitualmente sillín excesivamente alto que obliga al ciclista a descender la cadera para alcanzar el pedal.`,
  };
}

/** Cadencia en carrera (SPM). */
export function evaluateRunningCadence(cadenceSpm: number): BiomechanicalEvaluation {
  if (cadenceSpm >= 165 && cadenceSpm <= 190) {
    return {
      level: 'green',
      title: 'Cadencia funcional',
      detail: `${cadenceSpm} SPM. Ventana óptima para minimizar picos de fuerza de impacto vertical.`,
    };
  }
  if ((cadenceSpm >= 155 && cadenceSpm < 165) || (cadenceSpm > 190 && cadenceSpm <= 205)) {
    return {
      level: 'yellow',
      title: 'Cadencia fuera de rango ideal',
      detail: `${cadenceSpm} SPM. Aceptable según antropometría y ritmo; monitorear si se acompaña de sobrezancada.`,
    };
  }
  return {
    level: 'red',
    title: 'Cadencia ineficiente o extrema',
    detail: `${cadenceSpm} SPM. ${cadenceSpm < 155 ? 'Frecuencia baja asociada a mayor oscilación vertical y tiempo de contacto.' : 'Cadencia excesiva con posible aumento del costo metabólico.'}`,
  };
}

/** Caída pélvica contralateral en carrera (Trendelenburg dinámico en apoyo monopodal). */
export function evaluateRunningPelvicDrop(dropDeg: number): BiomechanicalEvaluation {
  if (dropDeg <= 4.0) {
    return {
      level: 'green',
      title: 'Control lumbopélvico adecuado',
      detail: `${dropDeg.toFixed(1)}° de caída. Estabilización activa eficiente de los abductores de cadera.`,
    };
  }
  if (dropDeg <= 6.5) {
    return {
      level: 'yellow',
      title: 'Caída contralateral moderada',
      detail: `${dropDeg.toFixed(1)}°. Descenso de pelvis en apoyo monopodal; se sugiere reforzar glúteo medio y core.`,
    };
  }
  return {
    level: 'red',
    title: 'Trendelenburg dinámico marcado',
    detail: `${dropDeg.toFixed(1)}°. Déficit evidente de estabilización abductora; correlacionado con sobrecarga en cintilla iliotibial y rótula.`,
  };
}

/** Valgo dinámico de rodilla en plano frontal (FPPA en carrera). */
export function evaluateRunningKneeValgus(valgusDeg: number): BiomechanicalEvaluation {
  if (valgusDeg <= 5.0) {
    return {
      level: 'green',
      title: 'Alineación fémur-tibia neutra',
      detail: `${valgusDeg.toFixed(1)}° de desviación medial. Desplazamiento articular congruente en plano frontal.`,
    };
  }
  if (valgusDeg <= 10.0) {
    return {
      level: 'yellow',
      title: 'Valgo dinámico moderado',
      detail: `${valgusDeg.toFixed(1)}°. Desplazamiento medial de rodilla en la fase de amortiguación.`,
    };
  }
  return {
    level: 'red',
    title: 'Colapso en valgo significativo',
    detail: `${valgusDeg.toFixed(1)}°. Incrementa la torsión femororrotuliana; trabajar control neuromuscular y rotadores externos de cadera.`,
  };
}

/** Ancho de paso y cruzamiento en carrera. */
export function evaluateRunningStepWidth(stepWidthRatio: number, crossover: boolean): BiomechanicalEvaluation {
  if (crossover) {
    return {
      level: 'red',
      title: 'Cruzamiento de zancada (Crossover gait)',
      detail: 'El pie apoya cruzando la línea media del cuerpo. Incrementa el momento aductor en rodilla y cadera.',
    };
  }
  if (stepWidthRatio >= 0.15) {
    return {
      level: 'green',
      title: 'Base de sustentación funcional',
      detail: `Ratio intermaleolar: ${stepWidthRatio.toFixed(2)}. Separación lateral adecuada durante la marcha.`,
    };
  }
  return {
    level: 'yellow',
    title: 'Base de sustentación estrecha',
    detail: `Ratio: ${stepWidthRatio.toFixed(2)}. Muy cercano a la línea media; vigilar rozamiento entre miembros y fricción tibial.`,
  };
}

// ---------------------------------------------------------------------------
// 3. Clases y Helpers de Accesibilidad (WCAG 2.1 AA)
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
