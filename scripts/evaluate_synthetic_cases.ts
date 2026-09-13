import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildKneeRecommendation,
  makeDemoSummary,
  summarizePoseFrames,
  type LandmarkPoint,
  type PoseFrame,
} from '../lib/biomechanics';
import {
  summarizeFrontalCyclingFrames,
  summarizeFrontalRunningFrames,
} from '../lib/frontal-biomechanics';
import { BILATERAL_LANDMARKS, SIDE_LANDMARKS } from '../lib/landmarks';
import {
  buildRunningRecommendations,
  makeRunningDemoSummary,
  summarizeRunningFrames,
} from '../lib/running-biomechanics';
import { evaluateMetrologicalQuality } from '../lib/traffic-light';
import { compareCyclingToGhost, compareRunningToGhost, GHOST_REFERENCES } from '../lib/ghost-reference';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const samplesDir = path.resolve(__dirname, '../public/samples');

if (!fs.existsSync(samplesDir)) {
  fs.mkdirSync(samplesDir, { recursive: true });
}

// ---------------------------------------------------------------------------
// 1. Generador de Casos Sintéticos
// ---------------------------------------------------------------------------

function makeEmptyLandmarks(visibility = 0.94): LandmarkPoint[] {
  return Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility }));
}

/**
 * Caso Sintético 1: Ciclista en Vista Sagital (Lateral Derecha)
 * Modelo cinemático: rotación circular de biela a 90 RPM (1.5 Hz), 60 cuadros a 15 fps (4 s).
 */
export function generateBikerSagittalFrames(): PoseFrame[] {
  const frames: PoseFrame[] = [];
  const fps = 15;
  const count = 60;
  const cadenceHz = 1.45; // ~87 RPM

  const hipX = 0.42;
  const hipY = 0.44;
  const crankX = 0.46;
  const crankY = 0.78;
  const crankR = 0.085;

  for (let i = 0; i < count; i++) {
    const time = i / fps;
    const angle = 2 * Math.PI * cadenceHz * time;

    // Pedal trajectory (BDC ocurre cuando el pedal está abajo, angle = pi)
    const pedalX = crankX + crankR * Math.sin(angle);
    const pedalY = crankY + crankR * Math.cos(angle);

    const ankleX = pedalX;
    const ankleY = pedalY - 0.02;

    // Cinemática de rodilla (interpolación geométrica hacia adelante de la línea cadera-tobillo)
    const midX = (hipX + ankleX) / 2;
    const midY = (hipY + ankleY) / 2;
    const kneeOffset = 0.09 + 0.03 * Math.sin(angle);
    const kneeX = midX + kneeOffset;
    const kneeY = midY;

    const shoulderX = hipX + 0.22;
    const shoulderY = hipY - 0.24;

    const landmarks = makeEmptyLandmarks(0.95);
    const right = SIDE_LANDMARKS.right;

    landmarks[right.shoulder] = { x: shoulderX, y: shoulderY, visibility: 0.96 };
    landmarks[right.hip] = { x: hipX, y: hipY, visibility: 0.96 };
    landmarks[right.knee] = { x: kneeX, y: kneeY, visibility: 0.95 };
    landmarks[right.ankle] = { x: ankleX, y: ankleY, visibility: 0.94 };

    frames.push({ time, landmarks });
  }

  return frames;
}

/**
 * Caso Sintético 2: Ciclista en Vista Frontal (Bilateral)
 * Modelo cinemático: tracking lineal de rodillas con oscilación lateral < 15 mm y oscilación pélvica < 2.5°.
 */
export function generateBikerFrontalFrames(): PoseFrame[] {
  const frames: PoseFrame[] = [];
  const fps = 15;
  const count = 60;
  const cadenceHz = 1.45;

  for (let i = 0; i < count; i++) {
    const time = i / fps;
    const phase = 2 * Math.PI * cadenceHz * time;
    const pelvicTilt = 0.006 * Math.sin(phase);

    const landmarks = makeEmptyLandmarks(0.94);

    // Hips
    landmarks[BILATERAL_LANDMARKS.leftHip] = { x: 0.44, y: 0.48 + pelvicTilt, visibility: 0.95 };
    landmarks[BILATERAL_LANDMARKS.rightHip] = { x: 0.56, y: 0.48 - pelvicTilt, visibility: 0.95 };

    // Knees (con excursión mediolateral controlada)
    landmarks[BILATERAL_LANDMARKS.leftKnee] = {
      x: 0.44 + 0.007 * Math.sin(phase),
      y: 0.68 + 0.08 * Math.cos(phase),
      visibility: 0.94,
    };
    landmarks[BILATERAL_LANDMARKS.rightKnee] = {
      x: 0.56 - 0.008 * Math.sin(phase),
      y: 0.68 - 0.08 * Math.cos(phase),
      visibility: 0.94,
    };

    // Ankles
    landmarks[BILATERAL_LANDMARKS.leftAnkle] = {
      x: 0.44,
      y: 0.88 + 0.06 * Math.cos(phase),
      visibility: 0.93,
    };
    landmarks[BILATERAL_LANDMARKS.rightAnkle] = {
      x: 0.56,
      y: 0.88 - 0.06 * Math.cos(phase),
      visibility: 0.93,
    };

    frames.push({ time, landmarks });
  }

  return frames;
}

/**
 * Caso Sintético 3: Corredor en Vista Sagital (Lateral Derecha)
 * Modelo cinemático: ciclo de zancada a 172 SPM (~1.43 Hz de ciclo completo unilateral), 60 cuadros a 30 fps (2 s).
 */
export function generateRunnerSagittalFrames(): PoseFrame[] {
  const frames: PoseFrame[] = [];
  const fps = 30;
  const count = 90; // 3.0 s (permite detectar >= 4 ciclos de zancada)
  const strideHz = 1.43; // ~172 SPM (86 ciclos/min por extremidad * 2)

  const hipX = 0.48;
  const hipY = 0.48;
  const shoulderX = hipX + 0.05;
  const shoulderY = hipY - 0.28;

  for (let i = 0; i < count; i++) {
    const time = i / fps;
    const phase = 2 * Math.PI * strideHz * time;

    // Oscilación vertical del tobillo: máximo Y = contacto inicial (suelo)
    const ankleY = 0.82 + 0.06 * Math.cos(phase);
    const ankleX = hipX + 0.06 * Math.sin(phase);

    // Rodilla
    const kneeY = 0.65 + 0.02 * Math.cos(phase);
    const kneeX = hipX + 0.03 * Math.sin(phase) + 0.02;

    // Pie: talón y punta
    const heelY = ankleY + 0.02;
    const heelX = ankleX - 0.03;
    const toeY = ankleY + 0.024;
    const toeX = ankleX + 0.05;

    const landmarks = makeEmptyLandmarks(0.93);
    const right = SIDE_LANDMARKS.right;

    landmarks[right.shoulder] = { x: shoulderX, y: shoulderY, visibility: 0.95 };
    landmarks[right.hip] = { x: hipX, y: hipY, visibility: 0.95 };
    landmarks[right.knee] = { x: kneeX, y: kneeY, visibility: 0.94 };
    landmarks[right.ankle] = { x: ankleX, y: ankleY, visibility: 0.93 };
    landmarks[right.heel] = { x: heelX, y: heelY, visibility: 0.92 };
    landmarks[right.footIndex] = { x: toeX, y: toeY, visibility: 0.92 };

    frames.push({ time, landmarks });
  }

  return frames;
}

/**
 * Caso Sintético 4: Corredor en Vista Frontal (Bilateral)
 * Modelo cinemático: apoyo monopodal alterno y proyección frontal reproducible.
 */
export function generateRunnerFrontalFrames(): PoseFrame[] {
  const frames: PoseFrame[] = [];
  const fps = 30;
  const count = 60;
  const strideHz = 1.43;

  for (let i = 0; i < count; i++) {
    const time = i / fps;
    const phase = 2 * Math.PI * strideHz * time;
    const pelvicTilt = 0.009 * Math.sin(phase);

    const landmarks = makeEmptyLandmarks(0.93);

    // Pelvis
    landmarks[BILATERAL_LANDMARKS.leftHip] = { x: 0.43, y: 0.48 + pelvicTilt, visibility: 0.95 };
    landmarks[BILATERAL_LANDMARKS.rightHip] = { x: 0.57, y: 0.48 - pelvicTilt, visibility: 0.95 };

    // Knees (valgo dinámico en carga)
    landmarks[BILATERAL_LANDMARKS.leftKnee] = {
      x: 0.44 + 0.008 * Math.sin(phase),
      y: 0.67,
      visibility: 0.93,
    };
    landmarks[BILATERAL_LANDMARKS.rightKnee] = {
      x: 0.56 - 0.008 * Math.sin(phase),
      y: 0.67,
      visibility: 0.93,
    };

    // Ankles
    landmarks[BILATERAL_LANDMARKS.leftAnkle] = {
      x: 0.44,
      y: 0.86 + 0.05 * Math.sin(phase),
      visibility: 0.92,
    };
    landmarks[BILATERAL_LANDMARKS.rightAnkle] = {
      x: 0.56,
      y: 0.86 - 0.05 * Math.sin(phase),
      visibility: 0.92,
    };

    frames.push({ time, landmarks });
  }

  return frames;
}

// ---------------------------------------------------------------------------
// 2. Guardado de Fixtures JSON en public/samples
// ---------------------------------------------------------------------------

const bikerSagittal = generateBikerSagittalFrames();
const bikerFrontal = generateBikerFrontalFrames();
const runnerSagittal = generateRunnerSagittalFrames();
const runnerFrontal = generateRunnerFrontalFrames();

function writeFixture(
  filename: string,
  description: string,
  modality: 'cycling' | 'running',
  view: 'sagittal' | 'frontal',
  fps: number,
  frames: PoseFrame[],
): void {
  fs.writeFileSync(
    path.join(samplesDir, filename),
    JSON.stringify({
      description,
      fixtureRole: 'calibration-ghost',
      ghostId: GHOST_REFERENCES[modality].id,
      ghostVersion: GHOST_REFERENCES[modality].version,
      immutable: true,
      modality,
      view,
      fps,
      frames,
    }, null, 2),
  );
}

fs.writeFileSync(
  path.join(samplesDir, 'synthetic_biker_sagittal.json'),
  JSON.stringify({ description: 'Ciclista sintético · Plano sagital lateral derecho', fps: 15, frames: bikerSagittal }, null, 2),
);

// Las copias con nombre ghost_* son fixtures inmutables para regresión. Los
// nombres synthetic_* se conservan para compatibilidad con la versión anterior.
writeFixture('ghost_biker_sagittal.json', 'Fantasma bike · plano sagital para calibración', 'cycling', 'sagittal', 15, bikerSagittal);
writeFixture('ghost_biker_frontal.json', 'Fantasma bike · plano frontal para calibración', 'cycling', 'frontal', 15, bikerFrontal);
writeFixture('ghost_runner_sagittal.json', 'Fantasma running · plano sagital para calibración', 'running', 'sagittal', 30, runnerSagittal);
writeFixture('ghost_runner_frontal.json', 'Fantasma running · plano frontal para calibración', 'running', 'frontal', 30, runnerFrontal);
fs.writeFileSync(
  path.join(samplesDir, 'synthetic_biker_frontal.json'),
  JSON.stringify({ description: 'Ciclista sintético · Plano frontal coronal', fps: 15, frames: bikerFrontal }, null, 2),
);
fs.writeFileSync(
  path.join(samplesDir, 'synthetic_runner_sagittal.json'),
  JSON.stringify({ description: 'Corredor sintético · Plano sagital lateral derecho', fps: 30, frames: runnerSagittal }, null, 2),
);
fs.writeFileSync(
  path.join(samplesDir, 'synthetic_runner_frontal.json'),
  JSON.stringify({ description: 'Corredor sintético · Plano frontal coronal', fps: 30, frames: runnerFrontal }, null, 2),
);

// ---------------------------------------------------------------------------
// 3. Ejecución de la Evaluación Cinemática y Reporte en Consola
// ---------------------------------------------------------------------------

console.log('================================================================================');
console.log('       MOVIMIENTO · INFORME DE EVALUACIÓN CINEMÁTICA DE CASOS SINTÉTICOS        ');
console.log('================================================================================\n');

// A. CICLISMO
console.log('▶ [CASO 1] EVALUACIÓN BIOMECÁNICA: CICLISMO (BIKE FITTING)');
console.log('--------------------------------------------------------------------------------');
const bikeSagSummary = summarizePoseFrames(bikerSagittal, 'right');
const bikeFroSummary = summarizeFrontalCyclingFrames(bikerFrontal);

if (bikeSagSummary) {
  const metroSag = evaluateMetrologicalQuality(bikeSagSummary.confidence, bikeSagSummary.frameCoverage);
  const rec = buildKneeRecommendation(bikeSagSummary.kneeFlexionBdc, { min: 25, max: 35 });
  const ghostComparisons = compareCyclingToGhost(bikeSagSummary, bikeFroSummary ?? undefined);

  console.log(`[Plano Sagital]`);
  console.log(`  • Calidad de señal:           [${metroSag.level.toUpperCase()}] ${metroSag.title}`);
  console.log(`  • Flexión de Rodilla en BDC: ${bikeSagSummary.kneeFlexionBdc}° -> fantasma ${ghostComparisons.find(c => c.key === 'kneeFlexionBdc')?.status}`);
  console.log(`  • Ángulo Mínimo de Cadera:   ${bikeSagSummary.hipAngleMin}°`);
  console.log(`  • Inclinación del Torso:     ${bikeSagSummary.torsoAngleMedian}°`);
  console.log(`  • Recomendación de Ajuste:   "${rec.title}" — ${rec.detail}`);
}

if (bikeFroSummary) {
  const ghostComparisons = compareCyclingToGhost(bikeSagSummary ?? makeDemoSummary(), bikeFroSummary);

  console.log(`\n[Plano Frontal]`);
  console.log(`  • Knee Tracking Izquierdo:   ${bikeFroSummary.kneeLateralExcursionLeftMm} mm -> fantasma ${ghostComparisons.find(c => c.key === 'kneeLateralExcursionLeftMm')?.status}`);
  console.log(`  • Knee Tracking Derecho:     ${bikeFroSummary.kneeLateralExcursionRightMm} mm -> fantasma ${ghostComparisons.find(c => c.key === 'kneeLateralExcursionRightMm')?.status}`);
  console.log(`  • Balanceo Pélvico (Sillín): ${bikeFroSummary.pelvicRockingDeg}° -> fantasma ${ghostComparisons.find(c => c.key === 'pelvicRockingDeg')?.status}`);
}

// B. CARRERA
console.log('\n▶ [CASO 2] EVALUACIÓN BIOMECÁNICA: CARRERA A PIE (RUNNING GAIT)');
console.log('--------------------------------------------------------------------------------');
const runSagSummary = summarizeRunningFrames(runnerSagittal, 'right');
const runFroSummary = summarizeFrontalRunningFrames(runnerFrontal);

if (runSagSummary) {
  const metroRun = evaluateMetrologicalQuality(runSagSummary.confidence, runSagSummary.frameCoverage);
  const recs = buildRunningRecommendations(runSagSummary);
  const ghostComparisons = compareRunningToGhost(runSagSummary, runFroSummary ?? undefined);

  console.log(`[Plano Sagital]`);
  console.log(`  • Calidad de señal:           [${metroRun.level.toUpperCase()}] ${metroRun.title}`);
  console.log(`  • Cadencia de Paso:          ${runSagSummary.cadenceSpm} SPM -> fantasma ${ghostComparisons.find(c => c.key === 'cadenceSpm')?.status}`);
  console.log(`  • Ángulo de Contacto (FSA):  ${runSagSummary.footStrikeAngleDeg}° (${runSagSummary.footStrikeType})`);
  console.log(`  • Índice de Sobrezancada:    ${runSagSummary.overstridingIndex}`);
  console.log(`  • Flexión de Rodilla en IC:  ${runSagSummary.kneeFlexionAtContactDeg}°`);
  console.log(`  • Inclinación del Tronco:    ${runSagSummary.torsoLeanMedianDeg}°`);
  console.log(`  • Pautas Técnicas Emitidas:`);
  recs.forEach(r => console.log(`      - [${r.status.toUpperCase()}] ${r.title}: ${r.detail}`));
}

if (runFroSummary) {
  const ghostComparisons = compareRunningToGhost(runSagSummary ?? makeRunningDemoSummary(), runFroSummary);

  console.log(`\n[Plano Frontal]`);
  console.log(`  • Oblicuidad pélvica:           ${runFroSummary.pelvicObliquityDeg}° -> fantasma ${ghostComparisons.find(c => c.key === 'pelvicObliquityDeg')?.status}`);
  console.log(`  • Proyección frontal Izq:       ${runFroSummary.dynamicKneeValgusLeftDeg}° -> fantasma ${ghostComparisons.find(c => c.key === 'dynamicKneeValgusLeftDeg')?.status}`);
  console.log(`  • Proyección frontal Der:       ${runFroSummary.dynamicKneeValgusRightDeg}° -> fantasma ${ghostComparisons.find(c => c.key === 'dynamicKneeValgusRightDeg')?.status}`);
  console.log(`  • Base de sustentación:         ${runFroSummary.stepWidthRatio} (Cruzamiento: ${runFroSummary.crossoverDetected ? 'Sí' : 'No'}) -> fantasma ${ghostComparisons.find(c => c.key === 'stepWidthRatio')?.status}`);
}

console.log('\n================================================================================');
console.log('Fixtures sintéticos generados exitosamente en public/samples/:');
console.log('  - synthetic_biker_sagittal.json');
console.log('  - synthetic_biker_frontal.json');
console.log('  - synthetic_runner_sagittal.json');
console.log('  - synthetic_runner_frontal.json');
console.log('Ghosts de calibración inmutables:');
console.log('  - ghost_biker_sagittal.json / ghost_biker_frontal.json');
console.log('  - ghost_runner_sagittal.json / ghost_runner_frontal.json');
console.log('================================================================================\n');
