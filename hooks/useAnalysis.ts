'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  buildKneeRecommendation,
  makeDemoSummary,
  summarizePoseFrames,
  type AnalysisSummary,
  type TargetRange,
  type Side,
} from '@/lib/biomechanics';
import { drawPose } from '@/lib/draw-pose';
import {
  makeFrontalCyclingDemoSummary,
  makeFrontalRunningDemoSummary,
  summarizeFrontalCyclingFrames,
  summarizeFrontalRunningFrames,
} from '@/lib/frontal-biomechanics';
import { sampleVideoPoses } from '@/lib/pose-engine';
import {
  summarizeRunningFrames,
  buildRunningRecommendations,
  makeRunningDemoSummary,
  type RunningAnalysisSummary,
  type RunningRecommendation,
} from '@/lib/running-biomechanics';
import { evaluateMetrologicalQuality } from '@/lib/traffic-light';
import type {
  AnalysisState,
  CameraView,
  FrontalCyclingSummary,
  FrontalRunningSummary,
  MetrologicalEvaluation,
  SportModality,
} from '@/lib/types';
import { isConfidenceSufficient } from '@/lib/validation';

export interface CyclingAnalysisResult {
  modality: 'cycling';
  summary: AnalysisSummary;
  frontal?: FrontalCyclingSummary;
  recommendation: ReturnType<typeof buildKneeRecommendation> | null;
  metrological: MetrologicalEvaluation;
}

export interface RunningAnalysisResult {
  modality: 'running';
  summary: RunningAnalysisSummary;
  frontal?: FrontalRunningSummary;
  recommendations: RunningRecommendation[];
  metrological: MetrologicalEvaluation;
}

export type AnalysisResult = CyclingAnalysisResult | RunningAnalysisResult;

export function useAnalysis(modality: SportModality) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const objectUrlRef = useRef<string | null>(null);

  const [activeView, setActiveView] = useState<CameraView>('sagittal');
  const [side, setSide] = useState<Side>('right');
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoName, setVideoName] = useState('');
  const [state, setState] = useState<AnalysisState>('idle');
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [isDemo, setIsDemo] = useState(false);

  // Cycling-specific state
  const [target, setTarget] = useState<TargetRange>({ min: 25, max: 35 });

  const clearVideo = useCallback(() => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = null;
    setVideoUrl(null);
    setVideoName('');
    setResult(null);
    setState('idle');
    setProgress(0);
    setError('');
    setSaved(false);
    setIsDemo(false);
    const canvas = canvasRef.current;
    canvas?.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
  }, []);

  // Cleanup on unmount
  useEffect(() => () => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
  }, []);

  const loadFile = useCallback((file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('video/')) {
      setError('Elegí un archivo de video MP4, MOV o WebM.');
      setState('error');
      return;
    }
    if (file.size > 350 * 1024 * 1024) {
      setError('Para mantener el análisis ágil, usá un video de hasta 350 MB.');
      setState('error');
      return;
    }
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const nextUrl = URL.createObjectURL(file);
    objectUrlRef.current = nextUrl;
    setVideoUrl(nextUrl);
    setVideoName(file.name);
    setIsDemo(false);
    setSaved(false);
    setError('');
    setState('video-ready');
  }, []);

  const runDemo = useCallback(() => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = null;
    setVideoUrl(null);
    setVideoName('Demostración biplanar integrada');

    if (modality === 'cycling') {
      const summary = makeDemoSummary();
      const frontal = makeFrontalCyclingDemoSummary();
      const metrological = evaluateMetrologicalQuality(summary.confidence, summary.frameCoverage);
      setResult({
        modality: 'cycling',
        summary,
        frontal,
        // El demo es un fantasma de QA: no debe emitir una prescripción.
        recommendation: null,
        metrological,
      });
    } else {
      const summary = makeRunningDemoSummary();
      const frontal = makeFrontalRunningDemoSummary();
      const metrological = evaluateMetrologicalQuality(summary.confidence, summary.frameCoverage);
      setResult({
        modality: 'running',
        summary,
        frontal,
        recommendations: buildRunningRecommendations(summary),
        metrological,
      });
    }

    setProgress(100);
    setState('complete');
    setError('');
    setSaved(false);
    setIsDemo(true);
  }, [modality, target]);

  const analyzeVideo = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      setState('loading');
      setProgress(2);
      setError('');
      const frames = await sampleVideoPoses(
        video,
        (value) => {
          setState('analyzing');
          setProgress(value);
        },
        modality,
      );

      if (activeView === 'sagittal') {
        if (modality === 'cycling') {
          const summary = summarizePoseFrames(frames, side);
          if (!summary) {
            throw new Error('No hubo suficientes cuadros nítidos. Revisá que el lado elegido esté completo y bien iluminado.');
          }
          if (!isConfidenceSufficient(summary.confidence)) {
            throw new Error('La confianza de la detección es insuficiente (< 65%). Revisá iluminación, encuadre y que la persona sea visible de cuerpo completo.');
          }
          const metrological = evaluateMetrologicalQuality(summary.confidence, summary.frameCoverage);
          const recommendation = buildKneeRecommendation(summary.kneeFlexionBdc, target);
          setResult((prev) => ({
            modality: 'cycling',
            summary,
            frontal: prev?.modality === 'cycling' ? prev.frontal : undefined,
            recommendation,
            metrological,
          }));

          video.currentTime = summary.selectedFrame.time;
          video.addEventListener(
            'seeked',
            () => {
              if (canvasRef.current) {
                drawPose(canvasRef.current, video, summary.selectedFrame.landmarks, side, 'cycling', 'sagittal');
              }
            },
            { once: true },
          );
        } else {
          const summary = summarizeRunningFrames(frames, side);
          if (!summary) {
            throw new Error('No se detectaron suficientes ciclos de zancada. Revisá que el video muestre al menos 3 zancadas completas del lado visible.');
          }
          if (!isConfidenceSufficient(summary.confidence)) {
            throw new Error('La confianza de la detección es insuficiente (< 65%). Revisá iluminación, encuadre y que los pies sean visibles.');
          }
          const metrological = evaluateMetrologicalQuality(summary.confidence, summary.frameCoverage);
          const recommendations = buildRunningRecommendations(summary);
          setResult((prev) => ({
            modality: 'running',
            summary,
            frontal: prev?.modality === 'running' ? prev.frontal : undefined,
            recommendations,
            metrological,
          }));

          video.currentTime = summary.selectedFrame.time;
          video.addEventListener(
            'seeked',
            () => {
              if (canvasRef.current) {
                drawPose(canvasRef.current, video, summary.selectedFrame.landmarks, side, 'running', 'sagittal');
              }
            },
            { once: true },
          );
        }
      } else {
        // Vista Frontal
        if (modality === 'cycling') {
          const frontal = summarizeFrontalCyclingFrames(frames);
          if (!frontal) {
            throw new Error('No hubo suficientes cuadros con ambas piernas y pelvis visibles. Revisá iluminación y que la cámara esté centrada.');
          }
          if (!isConfidenceSufficient(frontal.confidence)) {
            throw new Error('Confianza de detección frontal insuficiente (< 65%). Asegurate de que cadera, rodillas y tobillos sean visibles en ambos lados.');
          }
          const metrological = evaluateMetrologicalQuality(frontal.confidence, frontal.frameCoverage);
          setResult((prev) => {
            const baseSummary = prev?.modality === 'cycling' ? prev.summary : makeDemoSummary();
            const recommendation = prev?.modality === 'cycling' ? prev.recommendation : buildKneeRecommendation(baseSummary.kneeFlexionBdc, target);
            return {
              modality: 'cycling',
              summary: baseSummary,
              frontal,
              recommendation,
              metrological,
            };
          });

          video.currentTime = frontal.selectedFrame.time;
          video.addEventListener(
            'seeked',
            () => {
              if (canvasRef.current) {
                drawPose(canvasRef.current, video, frontal.selectedFrame.landmarks, side, 'cycling', 'frontal');
              }
            },
            { once: true },
          );
        } else {
          const frontal = summarizeFrontalRunningFrames(frames);
          if (!frontal) {
            throw new Error('No se detectaron suficientes cuadros frontales con ambos miembros visibles. Revisá que el plano frontal abarque pelvis y pies.');
          }
          if (!isConfidenceSufficient(frontal.confidence)) {
            throw new Error('Confianza frontal insuficiente (< 65%).');
          }
          const metrological = evaluateMetrologicalQuality(frontal.confidence, frontal.frameCoverage);
          setResult((prev) => {
            const baseSummary = prev?.modality === 'running' ? prev.summary : makeRunningDemoSummary();
            const recommendations = prev?.modality === 'running' ? prev.recommendations : buildRunningRecommendations(baseSummary);
            return {
              modality: 'running',
              summary: baseSummary,
              frontal,
              recommendations,
              metrological,
            };
          });

          video.currentTime = frontal.selectedFrame.time;
          video.addEventListener(
            'seeked',
            () => {
              if (canvasRef.current) {
                drawPose(canvasRef.current, video, frontal.selectedFrame.landmarks, side, 'running', 'frontal');
              }
            },
            { once: true },
          );
        }
      }

      setState('complete');
      setProgress(100);
      setSaved(false);
    } catch (caught) {
      setState('error');
      setError(caught instanceof Error ? caught.message : 'No se pudo completar el análisis.');
    }
  }, [activeView, modality, side, target]);

  const buildSessionRecord = useCallback(() => {
    if (!result) throw new Error('No hay un análisis completo para guardar.');
    return {
      schemaVersion: 3,
      createdAt: new Date().toISOString(),
      modality,
      activeView,
      side,
      videoName,
      demo: isDemo,
      result,
      disclaimer: 'Herramienta de apoyo biomecánico deportivo. No sustituye una evaluación clínica profesional.',
    };
  }, [activeView, isDemo, modality, result, side, videoName]);

  const saveBaseline = useCallback(() => {
    const record = buildSessionRecord();
    localStorage.setItem(`movimiento:${modality}:last-baseline`, JSON.stringify(record));
    setSaved(true);
    return record;
  }, [buildSessionRecord, modality]);

  const downloadReport = useCallback(() => {
    const record = buildSessionRecord();
    const blob = new Blob([JSON.stringify(record, null, 2)], { type: 'application/json' });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = href;
    anchor.download = `movimiento-${modality}-${activeView}-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(href);
  }, [activeView, buildSessionRecord, modality]);

  return {
    // Refs
    videoRef,
    canvasRef,
    fileInputRef,
    // State
    activeView,
    setActiveView,
    side,
    setSide,
    videoUrl,
    videoName,
    state,
    setState,
    progress,
    result,
    error,
    saved,
    setSaved,
    isDemo,
    target,
    setTarget,
    // Actions
    clearVideo,
    loadFile,
    runDemo,
    analyzeVideo,
    saveBaseline,
    downloadReport,
    buildSessionRecord,
  };
}
