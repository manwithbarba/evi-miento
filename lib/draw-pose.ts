import {
  BILATERAL_LANDMARKS,
  cyclingLandmarkIndices,
  runningLandmarkIndices,
} from './landmarks';
import type { CameraView, LandmarkPoint, Side, SportModality } from './types';

/**
 * Dibuja los segmentos articulares sobre el canvas superpuesto al video.
 *
 * Soporta dos vistas desacopladas:
 * - 'sagittal' (lateral): perfil unilateral según 'side' (ciclismo: 4 puntos, running: 6 puntos).
 * - 'frontal': vista posterior o anterior bilateral (línea pélvica, hombros, ambos miembros inferiores y líneas plomadas de referencia).
 */
export function drawPose(
  canvas: HTMLCanvasElement,
  video: HTMLVideoElement,
  landmarks: LandmarkPoint[],
  side: Side = 'right',
  modality: SportModality = 'cycling',
  view: CameraView = 'sagittal',
): void {
  const dpr = window.devicePixelRatio || 1;
  const width = video.clientWidth;
  const height = video.clientHeight;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  const context = canvas.getContext('2d');
  if (!context || !video.videoWidth || !video.videoHeight) return;

  context.scale(dpr, dpr);
  context.clearRect(0, 0, width, height);

  const sourceRatio = video.videoWidth / video.videoHeight;
  const boxRatio = width / height;
  const drawnWidth = sourceRatio > boxRatio ? width : height * sourceRatio;
  const drawnHeight = sourceRatio > boxRatio ? width / sourceRatio : height;
  const offsetX = (width - drawnWidth) / 2;
  const offsetY = (height - drawnHeight) / 2;

  const toScreen = (point: LandmarkPoint) => ({
    x: offsetX + point.x * drawnWidth,
    y: offsetY + point.y * drawnHeight,
    visibility: point.visibility ?? 1,
  });

  context.lineCap = 'round';
  context.lineJoin = 'round';

  if (view === 'frontal') {
    // -----------------------------------------------------------------------
    // Vista Frontal / Posterior (Bilateral)
    // -----------------------------------------------------------------------
    const lh = landmarks[BILATERAL_LANDMARKS.leftHip];
    const rh = landmarks[BILATERAL_LANDMARKS.rightHip];
    const ls = landmarks[BILATERAL_LANDMARKS.leftShoulder];
    const rs = landmarks[BILATERAL_LANDMARKS.rightShoulder];
    const lk = landmarks[BILATERAL_LANDMARKS.leftKnee];
    const rk = landmarks[BILATERAL_LANDMARKS.rightKnee];
    const la = landmarks[BILATERAL_LANDMARKS.leftAnkle];
    const ra = landmarks[BILATERAL_LANDMARKS.rightAnkle];
    const lf = landmarks[BILATERAL_LANDMARKS.leftFootIndex];
    const rf = landmarks[BILATERAL_LANDMARKS.rightFootIndex];

    const drawLine = (p1?: LandmarkPoint, p2?: LandmarkPoint, color = 'rgba(226,232,240,.92)', width = 4, dashed = false) => {
      if (!p1 || !p2) return;
      const s1 = toScreen(p1);
      const s2 = toScreen(p2);
      context.beginPath();
      context.strokeStyle = color;
      context.lineWidth = width;
      if (dashed) context.setLineDash([4, 4]);
      else context.setLineDash([]);
      context.moveTo(s1.x, s1.y);
      context.lineTo(s2.x, s2.y);
      context.stroke();
      context.setLineDash([]);
    };

    // Cintura pélvica (destacada en lima para visualizar caída/inclinación)
    drawLine(lh, rh, '#bef264', 5);
    // Hombros
    drawLine(ls, rs, 'rgba(148,163,184,.6)', 3);
    // Miembro inferior izquierdo
    drawLine(lh, lk);
    drawLine(lk, la);
    if (lf) drawLine(la, lf);
    // Miembro inferior derecho
    drawLine(rh, rk);
    drawLine(rk, ra);
    if (rf) drawLine(ra, rf);

    // Líneas plomadas cadera -> tobillo (discontinua de referencia para valgo / tracking)
    drawLine(lh, la, 'rgba(56,189,248,.45)', 2, true);
    drawLine(rh, ra, 'rgba(56,189,248,.45)', 2, true);

    // Articulaciones
    [lh, rh, ls, rs, lk, rk, la, ra, lf, rf].filter(Boolean).forEach((pt) => {
      const s = toScreen(pt!);
      context.beginPath();
      context.arc(s.x, s.y, 6, 0, Math.PI * 2);
      context.fillStyle = s.visibility > 0.7 ? '#bef264' : '#fcd34d';
      context.fill();
      context.lineWidth = 2.5;
      context.strokeStyle = '#081017';
      context.stroke();
    });

    return;
  }

  // -------------------------------------------------------------------------
  // Vista Sagital (Lateral Unilateral)
  // -------------------------------------------------------------------------
  const indices = modality === 'running'
    ? runningLandmarkIndices(side)
    : cyclingLandmarkIndices(side);

  const points = (indices as readonly number[])
    .map((idx) => landmarks[idx])
    .filter(Boolean)
    .map(toScreen);

  // Segmentos
  context.strokeStyle = 'rgba(226,232,240,.92)';
  context.lineWidth = 4;
  context.beginPath();
  points.forEach((point, position) => {
    if (position === 0) context.moveTo(point.x, point.y);
    else context.lineTo(point.x, point.y);
  });
  context.stroke();

  // Articulaciones
  points.forEach((point) => {
    context.beginPath();
    context.arc(point.x, point.y, 7, 0, Math.PI * 2);
    context.fillStyle = point.visibility > 0.7 ? '#bef264' : '#fcd34d';
    context.fill();
    context.lineWidth = 3;
    context.strokeStyle = '#081017';
    context.stroke();
  });
}
