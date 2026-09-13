/**
 * Registro compacto de evidencia utilizado por la interfaz y la documentación.
 *
 * Las revisiones sistemáticas informan qué puede medirse o probarse como
 * intervención; no convierten una cifra aislada en un punto de corte clínico.
 */

export type EvidenceStrength = 'moderate' | 'limited' | 'insufficient';
export type EvidenceUse = 'measurement' | 'association' | 'intervention' | 'calibration';

export interface EvidenceReference {
  label: string;
  url: string;
  pmid?: string;
}

export interface MetricEvidence {
  strength: EvidenceStrength;
  use: EvidenceUse;
  summary: string;
  references: readonly EvidenceReference[];
}

export const EVIDENCE_REFERENCES = {
  running2d: {
    label: 'Oliveira et al. 2019 · fiabilidad/validez de FSP y cadencia',
    url: 'https://pubmed.ncbi.nlm.nih.gov/31145650/',
    pmid: '31145650',
  },
  runningRisk: {
    label: 'Ceyssens et al. 2019 · factores biomecánicos y lesiones',
    url: 'https://pubmed.ncbi.nlm.nih.gov/31028658/',
    pmid: '31028658',
  },
  runningMeta: {
    label: 'Lopes et al. 2023 · biomecánica y lesiones en corredores',
    url: 'https://pubmed.ncbi.nlm.nih.gov/37651773/',
    pmid: '37651773',
  },
  cadence: {
    label: 'Neal et al. 2022 · revisión y metaanálisis de cadencia',
    url: 'https://pubmed.ncbi.nlm.nih.gov/36057913/',
    pmid: '36057913',
  },
  gaitRetraining: {
    label: 'Napier et al. 2022 · reentrenamiento de la marcha',
    url: 'https://pubmed.ncbi.nlm.nih.gov/35128941/',
    pmid: '35128941',
  },
  footStrike: {
    label: 'Xu et al. 2021 · patrón de apoyo y cargas',
    url: 'https://pubmed.ncbi.nlm.nih.gov/32813597/',
    pmid: '32813597',
  },
  feedback: {
    label: 'Revisiones de biofeedback en tiempo real',
    url: 'https://pubmed.ncbi.nlm.nih.gov/38967313/',
    pmid: '38967313',
  },
  saddleHeight: {
    label: 'Bini & Priego-Quesada 2022 · altura del sillín',
    url: 'https://pubmed.ncbi.nlm.nih.gov/34706617/',
    pmid: '34706617',
  },
  cyclingPosition: {
    label: 'Husband et al. 2024 · optimización de posición ciclista',
    url: 'https://pubmed.ncbi.nlm.nih.gov/39285616/',
    pmid: '39285616',
  },
  cyclingSpine: {
    label: 'Antequera-Vique et al. 2023 · postura de columna en ciclismo',
    url: 'https://pubmed.ncbi.nlm.nih.gov/35440291/',
    pmid: '35440291',
  },
  cyclingKnee: {
    label: 'Revisión de factores extrínsecos y biomecánica de rodilla en ciclismo',
    url: 'https://pubmed.ncbi.nlm.nih.gov/29234554/',
    pmid: '29234554',
  },
} as const;

export const METRIC_EVIDENCE = {
  cycling: {
    kneeFlexionBdc: {
      strength: 'moderate',
      use: 'measurement',
      summary: 'La altura del sillín puede evaluarse con el ángulo dinámico de rodilla; no existe un rango universal válido para todos los ciclistas.',
      references: [EVIDENCE_REFERENCES.saddleHeight, EVIDENCE_REFERENCES.cyclingPosition],
    },
    kneeTracking: {
      strength: 'limited',
      use: 'association',
      summary: 'La excursión frontal es una lectura descriptiva; no hay un corte universal validado ni una relación directa con lesión.',
      references: [EVIDENCE_REFERENCES.cyclingKnee, EVIDENCE_REFERENCES.cyclingPosition],
    },
    pelvicRocking: {
      strength: 'limited',
      use: 'association',
      summary: 'El balanceo puede ayudar a explorar la interacción sillín–fatiga–control, pero no identifica por sí solo una altura incorrecta.',
      references: [EVIDENCE_REFERENCES.saddleHeight, EVIDENCE_REFERENCES.cyclingSpine],
    },
    torso: {
      strength: 'limited',
      use: 'measurement',
      summary: 'La posición del tronco depende de disciplina, tarea y comodidad; no se incorpora como rango normativo.',
      references: [EVIDENCE_REFERENCES.cyclingPosition, EVIDENCE_REFERENCES.cyclingSpine],
    },
  },
  running: {
    cadence: {
      strength: 'moderate',
      use: 'intervention',
      summary: 'Aumentar la cadencia puede modificar variables de carga de forma inmediata; la literatura no respalda una cadencia óptima universal.',
      references: [EVIDENCE_REFERENCES.cadence, EVIDENCE_REFERENCES.gaitRetraining],
    },
    footStrike: {
      strength: 'limited',
      use: 'association',
      summary: 'El patrón de apoyo redistribuye cargas entre rodilla, tobillo y Aquiles; no debe presentarse como mejor o peor por sí solo.',
      references: [EVIDENCE_REFERENCES.footStrike, EVIDENCE_REFERENCES.running2d],
    },
    frontalKinematics: {
      strength: 'insufficient',
      use: 'association',
      summary: 'La evidencia de valgo, oblicuidad pélvica y otros factores es heterogénea e insuficiente para cortes universales.',
      references: [EVIDENCE_REFERENCES.runningRisk, EVIDENCE_REFERENCES.runningMeta],
    },
    torso: {
      strength: 'insufficient',
      use: 'measurement',
      summary: 'La inclinación del tronco se informa como descripción contextual; no se aplica una ventana fija.',
      references: [EVIDENCE_REFERENCES.runningRisk, EVIDENCE_REFERENCES.runningMeta],
    },
    feedback: {
      strength: 'moderate',
      use: 'intervention',
      summary: 'El feedback visual o auditivo puede ayudar a probar cambios y reducir algunas cargas; debe evaluarse con tolerancia individual.',
      references: [EVIDENCE_REFERENCES.feedback, EVIDENCE_REFERENCES.gaitRetraining],
    },
  },
} as const satisfies Record<string, Record<string, MetricEvidence>>;

export function evidenceStrengthLabel(strength: EvidenceStrength): string {
  switch (strength) {
    case 'moderate':
      return 'Evidencia moderada';
    case 'limited':
      return 'Evidencia limitada';
    case 'insufficient':
      return 'Evidencia insuficiente';
  }
}
