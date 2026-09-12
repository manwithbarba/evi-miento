'use client';

import type { RefObject, ChangeEvent, DragEvent } from 'react';
import {
  Activity,
  AlertCircle,
  Camera,
  FileVideo,
  Play,
  RotateCcw,
  Sparkles,
  Upload,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import type { AnalysisState, CameraView, SportModality } from '@/lib/types';

interface VideoCaptureProps {
  modality: SportModality;
  activeView: CameraView;
  onViewChange: (view: CameraView) => void;
  state: AnalysisState;
  progress: number;
  error: string;
  videoUrl: string | null;
  videoName: string;
  isDemo: boolean;
  hasResult: boolean;
  confidence: number | null;
  videoRef: RefObject<HTMLVideoElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
  onSetState: (state: AnalysisState) => void;
  onClearVideo: () => void;
  onRunDemo: () => void;
  onAnalyze: () => void;
  demoSvg?: React.ReactNode;
}

export function VideoCapture({
  modality,
  activeView,
  onViewChange,
  state,
  progress,
  error,
  videoUrl,
  videoName,
  isDemo,
  hasResult,
  confidence,
  videoRef,
  canvasRef,
  fileInputRef,
  onFileChange,
  onDrop,
  onSetState,
  onClearVideo,
  onRunDemo,
  onAnalyze,
  demoSvg,
}: VideoCaptureProps) {
  const frameLabel = activeView === 'sagittal'
    ? (modality === 'cycling'
        ? `BDC estimado · ${confidence != null ? Math.round(confidence * 100) : 0}% confianza`
        : `Contacto inicial estimado · ${confidence != null ? Math.round(confidence * 100) : 0}% confianza`)
    : (modality === 'cycling'
        ? `Paso frontal · ${confidence != null ? Math.round(confidence * 100) : 0}% confianza`
        : `Apoyo monopodal · ${confidence != null ? Math.round(confidence * 100) : 0}% confianza`);

  const analyzeLabel = activeView === 'sagittal'
    ? (modality === 'cycling' ? 'Midiendo ciclos de pedaleo…' : 'Detectando zancadas…')
    : (modality === 'cycling' ? 'Analizando tracking y balanceo pélvico…' : 'Calculando caída pélvica y valgo dinámico…');

  return (
    <section className="panel min-h-[560px] overflow-hidden p-3 sm:p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-1">
        <div>
          <p className="step-label">02 · Captura Biplanar Desacoplada</p>
          <div className="mt-1 flex items-center gap-2">
            <h2 className="text-lg font-semibold text-white">
              {activeView === 'sagittal' ? 'Cámara 1 · Vista Lateral (Sagital)' : 'Cámara 2 · Vista Frontal/Posterior'}
            </h2>
          </div>
        </div>

        {/* Selector de cámara / plano biplanar */}
        <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/[.04] p-1">
          <button
            type="button"
            onClick={() => onViewChange('sagittal')}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition ${
              activeView === 'sagittal'
                ? 'bg-lime-300 text-[#0e1608] shadow-sm font-semibold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Camera className="size-3.5" />
            Sagital (Lateral)
          </button>
          <button
            type="button"
            onClick={() => onViewChange('frontal')}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition ${
              activeView === 'frontal'
                ? 'bg-lime-300 text-[#0e1608] shadow-sm font-semibold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Camera className="size-3.5" />
            Frontal / Posterior
          </button>
        </div>
      </div>

      <div className="mb-3 rounded-lg border border-white/6 bg-white/[.02] px-3 py-1.5 text-xs text-slate-400">
        {activeView === 'sagittal'
          ? 'Cámara lateral a 90° respecto al eje de movimiento, a la altura de la cadera.'
          : 'Cámara posterior o frontal centrada sobre el eje medio del atleta, visualizando ambas piernas.'}
      </div>

      <Input
        ref={fileInputRef}
        type="file"
        accept="video/mp4,video/quicktime,video/webm,video/*"
        className="hidden"
        onChange={onFileChange}
      />

      <div className="video-stage" onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
        {isDemo && demoSvg ? (
          <div className="demo-rider" aria-label="Vista de demostración con marcadores corporales">
            {demoSvg}
            <div className="frame-tag">
              <Activity className="size-3.5" /> Demo Biplanar · {confidence != null ? Math.round(confidence * 100) : 0}% confianza
            </div>
          </div>
        ) : videoUrl ? (
          <div className="relative h-full w-full">
            <video
              ref={videoRef}
              src={videoUrl}
              className="h-full w-full object-contain"
              controls={state !== 'complete'}
              playsInline
              muted
              preload="metadata"
              onLoadedMetadata={() => onSetState('video-ready')}
            />
            <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true" />
            {hasResult && <div className="frame-tag"><Activity className="size-3.5" /> {frameLabel}</div>}
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center px-6 text-center">
            <div className="mb-5 grid size-16 place-items-center rounded-2xl border border-dashed border-lime-300/30 bg-lime-300/[.04] text-lime-300">
              <Upload className="size-7" />
            </div>
            <h3 className="text-xl font-semibold text-white">
              {activeView === 'sagittal' ? 'Cargá un video lateral' : 'Cargá un video frontal o posterior'}
            </h3>
            <p className="mt-2 max-w-sm text-sm leading-6 text-slate-400">
              MP4, MOV o WebM. El procesamiento se ejecuta íntegramente en tu navegador.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Button className="h-10 bg-lime-300 px-4 text-[#0e1608] hover:bg-lime-200" onClick={() => fileInputRef.current?.click()}>
                <Upload data-icon="inline-start" /> Elegir video
              </Button>
              <Button variant="outline" className="h-10 border-white/10 bg-white/[.03] px-4 text-slate-200 hover:bg-white/[.07]" onClick={onRunDemo}>
                <Play data-icon="inline-start" /> Demostración biplanar
              </Button>
            </div>
          </div>
        )}
      </div>

      {(state === 'loading' || state === 'analyzing') && (
        <div className="mt-4 rounded-xl border border-lime-300/10 bg-lime-300/[.035] p-4">
          <div className="mb-3 flex items-center justify-between gap-3 text-sm">
            <span className="font-medium text-lime-100">{state === 'loading' ? 'Preparando el modelo MediaPipe Full…' : analyzeLabel}</span>
            <span className="font-mono text-lime-200">{progress}%</span>
          </div>
          <Progress aria-label="Progreso del análisis" value={progress} className="[&_[data-slot=progress-indicator]]:bg-lime-300 [&_[data-slot=progress-track]]:bg-white/8" />
        </div>
      )}

      {state === 'error' && (
        <div role="alert" className="mt-4 flex items-start gap-3 rounded-xl border border-rose-300/15 bg-rose-300/[.05] px-4 py-3 text-sm leading-5 text-rose-100">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />{error}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/8 bg-black/10 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3 text-sm text-slate-400">
          <FileVideo className="size-4 shrink-0 text-lime-300" />
          <span className="truncate">{videoName || 'Muestreo inteligente y análisis en el borde del cliente.'}</span>
        </div>
        <div className="flex gap-2">
          {(videoUrl || isDemo) && (
            <Button variant="ghost" size="sm" className="text-slate-400 hover:bg-white/5 hover:text-white" onClick={onClearVideo}>
              <RotateCcw data-icon="inline-start" /> Reiniciar
            </Button>
          )}
          {videoUrl && state !== 'loading' && state !== 'analyzing' && (
            <Button size="sm" className="bg-lime-300 text-[#0e1608] hover:bg-lime-200" onClick={onAnalyze}>
              <Sparkles data-icon="inline-start" /> {hasResult ? 'Reanalizar vista' : `Analizar vista ${activeView}`}
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
