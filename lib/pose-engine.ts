import type { NormalizedLandmark, PoseLandmarker } from '@mediapipe/tasks-vision';

import type { PoseFrame } from '@/lib/biomechanics';
import type { SportModality } from '@/lib/types';

const WASM_ROOT = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm';
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task';

let landmarkerPromise: Promise<PoseLandmarker> | null = null;

async function createLandmarker(): Promise<PoseLandmarker> {
  const { FilesetResolver, PoseLandmarker } = await import('@mediapipe/tasks-vision');
  const fileset = await FilesetResolver.forVisionTasks(WASM_ROOT, true);

  try {
    return await PoseLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
      runningMode: 'VIDEO',
      numPoses: 1,
      minPoseDetectionConfidence: 0.55,
      minPosePresenceConfidence: 0.55,
      minTrackingConfidence: 0.55,
    });
  } catch {
    return PoseLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate: 'CPU' },
      runningMode: 'VIDEO',
      numPoses: 1,
      minPoseDetectionConfidence: 0.55,
      minPosePresenceConfidence: 0.55,
      minTrackingConfidence: 0.55,
    });
  }
}

export function preparePoseEngine(): Promise<PoseLandmarker> {
  landmarkerPromise ??= createLandmarker();
  return landmarkerPromise;
}

function seek(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error('El video tardó demasiado en responder.'));
    }, 5000);
    const cleanup = () => {
      window.clearTimeout(timeout);
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('error', onError);
    };
    const onSeeked = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error('No se pudo leer este archivo de video.'));
    };
    video.addEventListener('seeked', onSeeked, { once: true });
    video.addEventListener('error', onError, { once: true });
    video.currentTime = time;
  });
}

export async function sampleVideoPoses(
  video: HTMLVideoElement,
  onProgress: (progress: number) => void,
  modality: SportModality = 'cycling',
): Promise<PoseFrame[]> {
  if (!Number.isFinite(video.duration) || video.duration <= 0) {
    throw new Error('El video no tiene una duración válida.');
  }

  const landmarker = await preparePoseEngine();
  const usableDuration = Math.min(video.duration, 20);
  const start = usableDuration > 4 ? 0.75 : 0;
  const end = usableDuration > 4 ? usableDuration - 0.75 : usableDuration;
  const baseSampleRate = modality === 'running' ? 10 : 6;
  const maxSamples = modality === 'running' ? 200 : 72;
  const sampleCount = Math.min(maxSamples, Math.max(18, Math.floor((end - start) * baseSampleRate)));
  const frames: PoseFrame[] = [];

  video.pause();
  for (let index = 0; index < sampleCount; index += 1) {
    const ratio = sampleCount === 1 ? 0 : index / (sampleCount - 1);
    const time = start + (end - start) * ratio;
    await seek(video, time);
    const result = landmarker.detectForVideo(video, index * 100);
    const landmarks = result.landmarks[0];
    if (landmarks) {
      frames.push({
        time,
        landmarks: landmarks.map((point: NormalizedLandmark) => ({
          x: point.x,
          y: point.y,
          z: point.z,
          visibility: point.visibility,
        })),
      });
    }
    onProgress(Math.round(((index + 1) / sampleCount) * 100));
    await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
  }

  return frames;
}
