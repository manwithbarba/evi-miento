'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, DragEvent } from 'react';
import {
  Activity,
  AlertCircle,
  Bike,
  Check,
  CircleCheck,
  Download,
  FileVideo,
  Gauge,
  Play,
  RotateCcw,
  Save,
  ShieldCheck,
  Sparkles,
  Upload,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  buildKneeRecommendation,
  makeDemoSummary,
  rangeStatus,
  summarizePoseFrames,
  type AnalysisSummary,
  type LandmarkPoint,
  type Side,
  type TargetRange,
} from '@/lib/biomechanics';
import { sampleVideoPoses } from '@/lib/pose-engine';

type Discipline = 'road' | 'race' | 'gravel' | 'mtb';
type AnalysisState = 'idle' | 'video-ready' | 'loading' | 'analyzing' | 'complete' | 'error';

const PROFILES: Record<Discipline, {
  label: string;
  knee: TargetRange;
  hip: TargetRange;
  torso: TargetRange;
}> = {
  road: { label: 'Ruta · resistencia', knee: { min: 25, max: 35 }, hip: { min: 70, max: 100 }, torso: { min: 35, max: 55 } },
  race: { label: 'Ruta · rendimiento', knee: { min: 25, max: 35 }, hip: { min: 65, max: 90 }, torso: { min: 20, max: 45 } },
  gravel: { label: 'Gravel', knee: { min: 25, max: 37 }, hip: { min: 70, max: 105 }, torso: { min: 35, max: 60 } },
  mtb: { label: 'MTB', knee: { min: 27, max: 39 }, hip: { min: 75, max: 110 }, torso: { min: 40, max: 65 } },
};

const SIDE_LANDMARKS = {
  left: { shoulder: 11, hip: 23, knee: 25, ankle: 27 },
  right: { shoulder: 12, hip: 24, knee: 26, ankle: 28 },
} as const;

function statusLabel(status: ReturnType<typeof rangeStatus>) {
  if (status === 'within') return 'En objetivo';
  if (status === 'below') return 'Por debajo';
  return 'Por encima';
}

function statusClasses(status: ReturnType<typeof rangeStatus>) {
  if (status === 'within') return 'border-lime-300/20 bg-lime-300/[.06] text-lime-200';
  return 'border-amber-300/20 bg-amber-300/[.06] text-amber-200';
}

function drawPose(
  canvas: HTMLCanvasElement,
  video: HTMLVideoElement,
  landmarks: LandmarkPoint[],
  side: Side,
) {
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
  const index = SIDE_LANDMARKS[side];
  const points = [index.shoulder, index.hip, index.knee, index.ankle]
    .map((item) => landmarks[item])
    .filter(Boolean)
    .map((point) => ({
      x: offsetX + point.x * drawnWidth,
      y: offsetY + point.y * drawnHeight,
      visibility: point.visibility ?? 1,
    }));

  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.strokeStyle = 'rgba(226,232,240,.92)';
  context.lineWidth = 4;
  context.beginPath();
  points.forEach((point, position) => {
    if (position === 0) context.moveTo(point.x, point.y);
    else context.lineTo(point.x, point.y);
  });
  context.stroke();

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

export default function Home() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const objectUrlRef = useRef<string | null>(null);
  const [discipline, setDiscipline] = useState<Discipline>('road');
  const [side, setSide] = useState<Side>('right');
  const [inseam, setInseam] = useState('82');
  const [crank, setCrank] = useState('172.5');
  const [notes, setNotes] = useState('');
  const [target, setTarget] = useState<TargetRange>(PROFILES.road.knee);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoName, setVideoName] = useState('');
  const [state, setState] = useState<AnalysisState>('idle');
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<AnalysisSummary | null>(null);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [isDemo, setIsDemo] = useState(false);

  const profile = PROFILES[discipline];
  const recommendation = useMemo(
    () => result ? buildKneeRecommendation(result.kneeFlexionBdc, target) : null,
    [result, target],
  );

  const applyDiscipline = useCallback((value: Discipline) => {
    setDiscipline(value);
    setTarget(PROFILES[value].knee);
    setSaved(false);
  }, []);

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
    setResult(null);
    setIsDemo(false);
    setSaved(false);
    setError('');
    setState('video-ready');
  }, []);

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    loadFile(event.target.files?.[0]);
    event.target.value = '';
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    loadFile(event.dataTransfer.files?.[0]);
  };

  const runDemo = useCallback(() => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = null;
    setVideoUrl(null);
    setVideoName('Demostración integrada');
    setResult(makeDemoSummary());
    setProgress(100);
    setState('complete');
    setError('');
    setSaved(false);
    setIsDemo(true);
  }, []);

  const analyzeVideo = async () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      setState('loading');
      setProgress(2);
      setError('');
      const frames = await sampleVideoPoses(video, (value) => {
        setState('analyzing');
        setProgress(value);
      });
      const summary = summarizePoseFrames(frames, side);
      if (!summary) {
        throw new Error('No hubo suficientes cuadros nítidos. Revisá que el lado elegido esté completo y bien iluminado.');
      }
      setResult(summary);
      setState('complete');
      setProgress(100);
      setSaved(false);
      video.currentTime = summary.selectedFrame.time;
      video.addEventListener('seeked', () => {
        if (canvasRef.current) drawPose(canvasRef.current, video, summary.selectedFrame.landmarks, side);
      }, { once: true });
    } catch (caught) {
      setResult(null);
      setState('error');
      setError(caught instanceof Error ? caught.message : 'No se pudo completar el análisis.');
    }
  };

  const sessionRecord = useCallback(() => {
    if (!result || !recommendation) throw new Error('No hay un análisis completo para guardar.');
    return {
      schemaVersion: 1,
      createdAt: new Date().toISOString(),
      session: {
        discipline,
        disciplineLabel: profile.label,
        side,
        inseamCm: Number(inseam),
        crankMm: Number(crank),
        notes,
        videoName,
        demo: isDemo,
      },
      target: { kneeFlexionBdc: target },
      measurements: {
        kneeFlexionBdcDeg: result.kneeFlexionBdc,
        hipAngleMinDeg: result.hipAngleMin,
        torsoAngleMedianDeg: result.torsoAngleMedian,
        confidence: result.confidence,
        validFrames: result.validFrames,
        totalFrames: result.totalFrames,
      },
      recommendation,
      disclaimer: 'Herramienta de apoyo. No sustituye una evaluación profesional o médica.',
    };
  }, [crank, discipline, inseam, isDemo, notes, profile.label, recommendation, result, side, target, videoName]);

  const saveBaseline = useCallback(() => {
    const record = sessionRecord();
    localStorage.setItem('velofit:last-baseline', JSON.stringify(record));
    setSaved(true);
    return record;
  }, [sessionRecord]);

  const downloadReport = () => {
    const record = sessionRecord();
    const blob = new Blob([JSON.stringify(record, null, 2)], { type: 'application/json' });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = href;
    anchor.download = `velofit-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(href);
  };

  useEffect(() => {
    const modelContext = document.modelContext;
    if (!modelContext?.registerTool) return;
    const lifecycle = new AbortController();
    const register = async () => {
      await modelContext.registerTool({
        name: 'configure_bike_fit_session',
        title: 'Configurar evaluación',
        description: 'Configura los datos visibles de una evaluación de bike fitting sin iniciar el análisis de video.',
        inputSchema: {
          type: 'object',
          properties: {
            discipline: { type: 'string', enum: ['road', 'race', 'gravel', 'mtb'] },
            side: { type: 'string', enum: ['left', 'right'] },
            inseamCm: { type: 'number', minimum: 40, maximum: 120 },
            crankMm: { type: 'number', minimum: 120, maximum: 220 },
          },
          required: ['discipline', 'side', 'inseamCm', 'crankMm'],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        execute(input) {
          const value = input as Record<string, unknown>;
          if (!['road', 'race', 'gravel', 'mtb'].includes(String(value.discipline))) throw new Error('Disciplina no válida.');
          if (!['left', 'right'].includes(String(value.side))) throw new Error('Lado no válido.');
          const inseamValue = Number(value.inseamCm);
          const crankValue = Number(value.crankMm);
          if (inseamValue < 40 || inseamValue > 120 || crankValue < 120 || crankValue > 220) throw new Error('Medidas fuera de rango.');
          applyDiscipline(value.discipline as Discipline);
          setSide(value.side as Side);
          setInseam(String(inseamValue));
          setCrank(String(crankValue));
          return { configured: true, discipline: value.discipline, side: value.side };
        },
      }, { signal: lifecycle.signal });
      await modelContext.registerTool({
        name: 'load_demo_bike_fit',
        title: 'Cargar demostración',
        description: 'Carga la demostración integrada y muestra una lectura biomecánica completa.',
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        execute() {
          runDemo();
          return { loaded: true, mode: 'demo' };
        },
      }, { signal: lifecycle.signal });
      await modelContext.registerTool({
        name: 'save_bike_fit_baseline',
        title: 'Guardar línea de base',
        description: 'Guarda en este dispositivo el análisis completo que ya está visible.',
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        execute() {
          const record = saveBaseline();
          return { saved: true, createdAt: record.createdAt };
        },
      }, { signal: lifecycle.signal });
    };
    void register().catch(() => undefined);
    return () => lifecycle.abort();
  }, [applyDiscipline, runDemo, saveBaseline]);

  const metrics = result ? [
    { label: 'Flexión de rodilla · BDC', value: result.kneeFlexionBdc, target, note: 'define la recomendación' },
    { label: 'Ángulo mínimo de cadera', value: result.hipAngleMin, target: profile.hip, note: 'lectura contextual' },
    { label: 'Inclinación del torso', value: result.torsoAngleMedian, target: profile.torso, note: 'mediana del video' },
  ] : [];

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="no-print border-b border-white/8 bg-[#0b1016]/92 backdrop-blur-xl">
        <div className="mx-auto flex min-h-16 max-w-[1480px] items-center justify-between px-5 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="grid size-9 place-items-center rounded-xl bg-lime-300 text-[#10160b] shadow-[0_0_24px_rgba(190,242,100,.2)]">
              <Bike className="size-5" strokeWidth={2.3} />
            </div>
            <div>
              <p className="text-[15px] font-semibold tracking-[-0.02em] text-white">VeloFit Lab</p>
              <p className="text-xs text-slate-500">Bike fitting asistido</p>
            </div>
          </div>
          <div className="hidden items-center gap-2 rounded-full border border-emerald-300/15 bg-emerald-300/5 px-3 py-1.5 text-xs text-emerald-200 sm:flex">
            <ShieldCheck className="size-3.5" />
            El video se procesa en este dispositivo
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-[1480px] px-5 py-6 lg:px-8 lg:py-8">
        <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="mb-2 font-mono text-xs font-semibold uppercase tracking-[0.18em] text-lime-300">Nueva evaluación · Vista lateral</p>
            <h1 className="max-w-3xl text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">Ajustá la bicicleta con evidencia, una medición a la vez.</h1>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <CircleCheck className="size-4 text-lime-300" />
            Protocolo guiado en 3 pasos
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[340px_minmax(0,1fr)_350px]">
          <aside className="panel p-5">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="step-label">01 · Preparación</p>
                <h2 className="mt-1 text-lg font-semibold text-white">Datos de referencia</h2>
              </div>
              <Gauge className="size-5 text-slate-500" />
            </div>

            <div className="space-y-4">
              <div>
                <p className="field-label">Disciplina</p>
                <Select value={discipline} onValueChange={(value) => applyDiscipline(value as Discipline)}>
                  <SelectTrigger aria-label="Disciplina" className="mt-2 h-11 w-full border-white/10 bg-white/[.035] px-3 text-slate-100"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(PROFILES).map(([value, item]) => <SelectItem key={value} value={value}>{item.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="field-label" htmlFor="inseam">Entrepierna<div className="input-unit"><Input id="inseam" value={inseam} onChange={(event) => setInseam(event.target.value)} inputMode="decimal" /><span>cm</span></div></label>
                <label className="field-label" htmlFor="crank">Biela<div className="input-unit"><Input id="crank" value={crank} onChange={(event) => setCrank(event.target.value)} inputMode="decimal" /><span>mm</span></div></label>
              </div>

              <div>
                <p className="field-label">Lado visible</p>
                <Select value={side} onValueChange={(value) => { setSide(value as Side); setResult(null); setSaved(false); }}>
                  <SelectTrigger aria-label="Lado visible" className="mt-2 h-11 w-full border-white/10 bg-white/[.035] px-3 text-slate-100"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="right">Derecho</SelectItem><SelectItem value="left">Izquierdo</SelectItem></SelectContent>
                </Select>
              </div>

              <div>
                <p className="field-label">Objetivo de rodilla · BDC</p>
                <div className="mt-2 grid grid-cols-2 gap-3">
                  <label className="input-unit mt-0" htmlFor="target-min"><Input id="target-min" aria-label="Flexión mínima de rodilla" type="number" min="10" max="60" value={target.min} onChange={(event) => setTarget((current) => ({ ...current, min: Number(event.target.value) }))} /><span>° mín.</span></label>
                  <label className="input-unit mt-0" htmlFor="target-max"><Input id="target-max" aria-label="Flexión máxima de rodilla" type="number" min="10" max="60" value={target.max} onChange={(event) => setTarget((current) => ({ ...current, max: Number(event.target.value) }))} /><span>° máx.</span></label>
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-500">Es un objetivo inicial configurable, no un límite clínico.</p>
              </div>

              <label className="field-label" htmlFor="notes">Notas o molestias<Input id="notes" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Ej.: carga anterior en rodilla" className="mt-2 h-11 border-white/10 bg-white/[.035] px-3 text-slate-100" /></label>
            </div>

            <div className="mt-6 rounded-xl border border-lime-300/10 bg-lime-300/[.04] p-4">
              <p className="text-sm font-medium text-lime-100">Antes de grabar</p>
              <ul className="mt-2 space-y-2 text-sm leading-5 text-slate-400"><li>• Cámara fija y perpendicular</li><li>• Ciclista completo en cuadro</li><li>• 10–15 s de pedaleo estable</li></ul>
            </div>
          </aside>

          <section className="panel min-h-[560px] overflow-hidden p-3 sm:p-5">
            <div className="mb-4 flex items-center justify-between px-1">
              <div><p className="step-label">02 · Captura</p><h2 className="mt-1 text-lg font-semibold text-white">Video lateral</h2></div>
              <span className="status-dot">{state === 'analyzing' ? 'Analizando' : state === 'complete' ? 'Completado' : 'Listo'}</span>
            </div>

            <Input ref={fileInputRef} type="file" accept="video/mp4,video/quicktime,video/webm,video/*" className="hidden" onChange={onFileChange} />
            <div className="video-stage" onDragOver={(event) => event.preventDefault()} onDrop={onDrop}>
              {isDemo ? (
                <div className="demo-rider" aria-label="Vista de demostración con marcadores corporales">
                  <svg viewBox="0 0 760 430" aria-label="Esquema de posición ciclista detectada">
                    <title>Esquema de posición ciclista detectada</title>
                    <g className="bike-lines"><circle cx="185" cy="337" r="77" /><circle cx="568" cy="337" r="77" /><path d="M185 337 L316 337 L268 209 L451 222 L568 337 L316 337 L451 222" /><path d="M268 209 L245 176 M451 222 L482 167 M461 174 L506 174" /></g>
                    <g className="body-lines"><circle cx="350" cy="78" r="28" /><path d="M342 108 L312 184 L405 210 L465 174" /><path d="M312 184 L354 273 L309 337" /><path d="M312 184 L269 257 L318 337" /></g>
                    {[[342,108],[312,184],[354,273],[309,337],[405,210],[465,174]].map(([cx,cy]) => <circle key={`${cx}-${cy}`} className="joint" cx={cx} cy={cy} r="7" />)}
                    <path className="angle-arc" d="M329 248 A43 43 0 0 1 365 296" /><text className="angle-text" x="375" y="286">31.8°</text>
                  </svg>
                  <div className="frame-tag"><Activity className="size-3.5" /> Cuadro estable · 94% confianza</div>
                </div>
              ) : videoUrl ? (
                <div className="relative h-full w-full">
                  <video ref={videoRef} src={videoUrl} className="h-full w-full object-contain" controls={state !== 'complete'} playsInline muted preload="metadata" onLoadedMetadata={() => setState('video-ready')} />
                  <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true" />
                  {result && <div className="frame-tag"><Activity className="size-3.5" /> BDC estimado · {Math.round(result.confidence * 100)}% confianza</div>}
                </div>
              ) : (
                <div className="flex h-full flex-col items-center justify-center px-6 text-center">
                  <div className="mb-5 grid size-16 place-items-center rounded-2xl border border-dashed border-lime-300/30 bg-lime-300/[.04] text-lime-300"><Upload className="size-7" /></div>
                  <h3 className="text-xl font-semibold text-white">Cargá un video lateral</h3>
                  <p className="mt-2 max-w-sm text-sm leading-6 text-slate-400">MP4, MOV o WebM. Podés soltar el archivo acá; no se envía a ningún servidor.</p>
                  <div className="mt-6 flex flex-wrap justify-center gap-3">
                    <Button className="h-10 bg-lime-300 px-4 text-[#0e1608] hover:bg-lime-200" onClick={() => fileInputRef.current?.click()}><Upload data-icon="inline-start" /> Elegir video</Button>
                    <Button variant="outline" className="h-10 border-white/10 bg-white/[.03] px-4 text-slate-200 hover:bg-white/[.07]" onClick={runDemo}><Play data-icon="inline-start" /> Usar demostración</Button>
                  </div>
                </div>
              )}
            </div>

            {(state === 'loading' || state === 'analyzing') && (
              <div className="mt-4 rounded-xl border border-lime-300/10 bg-lime-300/[.035] p-4">
                <div className="mb-3 flex items-center justify-between gap-3 text-sm"><span className="font-medium text-lime-100">{state === 'loading' ? 'Preparando el motor abierto de pose…' : 'Midiendo ciclos de pedaleo…'}</span><span className="font-mono text-lime-200">{progress}%</span></div>
                <Progress aria-label="Progreso del análisis" value={progress} className="[&_[data-slot=progress-indicator]]:bg-lime-300 [&_[data-slot=progress-track]]:bg-white/8" />
              </div>
            )}

            {state === 'error' && <div role="alert" className="mt-4 flex items-start gap-3 rounded-xl border border-rose-300/15 bg-rose-300/[.05] px-4 py-3 text-sm leading-5 text-rose-100"><AlertCircle className="mt-0.5 size-4 shrink-0" />{error}</div>}

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/8 bg-black/10 px-4 py-3">
              <div className="flex min-w-0 items-center gap-3 text-sm text-slate-400"><FileVideo className="size-4 shrink-0 text-lime-300" /><span className="truncate">{videoName || 'El análisis muestrea hasta 20 s y conserva sólo puntos articulares.'}</span></div>
              <div className="flex gap-2">
                {(videoUrl || isDemo) && <Button variant="ghost" size="sm" className="text-slate-400 hover:bg-white/5 hover:text-white" onClick={clearVideo}><RotateCcw data-icon="inline-start" /> Reiniciar</Button>}
                {videoUrl && state !== 'loading' && state !== 'analyzing' && <Button size="sm" className="bg-lime-300 text-[#0e1608] hover:bg-lime-200" onClick={analyzeVideo}><Sparkles data-icon="inline-start" /> {result ? 'Reanalizar' : 'Analizar video'}</Button>}
              </div>
            </div>
          </section>

          <aside className="panel p-5">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div><p className="step-label">03 · Resultado</p><h2 className="mt-1 text-lg font-semibold text-white">Lectura biomecánica</h2></div>
              <span className="rounded-full bg-white/5 px-2.5 py-1 font-mono text-xs text-slate-500">MVP 0.1</span>
            </div>

            {result ? (
              <>
                <div className="space-y-3">
                  {metrics.map((metric) => {
                    const metricStatus = rangeStatus(metric.value, metric.target);
                    return <div key={metric.label} className="metric-card">
                      <div className="flex items-start justify-between gap-3"><div><p className="text-sm text-slate-300">{metric.label}</p><p className="mt-1 text-xs text-slate-600">{metric.note}</p></div><span className={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${statusClasses(metricStatus)}`}>{statusLabel(metricStatus)}</span></div>
                      <div className="mt-3 flex items-end justify-between"><span className="font-mono text-2xl font-semibold text-white">{metric.value.toFixed(1)}°</span><span className="text-xs text-slate-500">objetivo {metric.target.min}–{metric.target.max}°</span></div>
                    </div>;
                  })}
                </div>

                <div className="mt-4 rounded-xl border border-white/8 bg-white/[.025] p-4">
                  <div className="flex items-start gap-3"><div className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-full ${recommendation?.status === 'within' ? 'bg-lime-300 text-[#10160b]' : 'bg-amber-300 text-[#1c1405]'}`}>{recommendation?.status === 'within' ? <Check className="size-4" /> : <Activity className="size-4" />}</div><div><p className="text-sm font-medium text-white">{recommendation?.title}</p><p className="mt-2 text-sm leading-6 text-slate-400">{recommendation?.detail}</p></div></div>
                  <div className="mt-4 border-t border-white/8 pt-3 text-xs text-slate-500">{result.validFrames}/{result.totalFrames} cuadros válidos · {Math.round(result.confidence * 100)}% confianza global</div>
                </div>

                <div className="no-print mt-4 grid grid-cols-2 gap-2">
                  <Button variant="outline" className="h-10 border-white/10 bg-white/[.03] text-slate-200 hover:bg-white/[.07]" onClick={saveBaseline}>{saved ? <Check data-icon="inline-start" /> : <Save data-icon="inline-start" />}{saved ? 'Guardado' : 'Guardar base'}</Button>
                  <Button className="h-10 bg-white text-slate-950 hover:bg-slate-200" onClick={downloadReport}><Download data-icon="inline-start" /> Informe</Button>
                </div>
              </>
            ) : (
              <div className="flex min-h-[430px] flex-col items-center justify-center rounded-xl border border-dashed border-white/10 bg-black/10 px-6 text-center"><Activity className="size-8 text-slate-700" /><p className="mt-4 text-sm font-medium text-slate-300">Todavía no hay una lectura</p><p className="mt-2 text-sm leading-6 text-slate-500">Cargá un video o usá la demostración para revisar el flujo completo.</p></div>
            )}
          </aside>
        </div>

        <section className="method-grid mt-5">
          <div className="panel p-5 sm:p-6">
            <p className="step-label">Qué hace el MVP</p>
            <h2 className="mt-2 text-xl font-semibold text-white">Medición trazable, no una prescripción automática</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">MediaPipe detecta 33 puntos corporales; VeloFit calcula geometría 2D sobre el lado visible, estima el cuadro de máxima extensión y conserva la confianza de cada lectura. Sólo la rodilla genera una sugerencia, siempre en pasos de 3 mm y con nueva medición obligatoria.</p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs"><a className="source-chip" href="https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker/web_js" target="_blank" rel="noreferrer">MediaPipe · documentación</a><a className="source-chip" href="https://pubmed.ncbi.nlm.nih.gov/24499342/" target="_blank" rel="noreferrer">Validez de cinemática 2D</a><a className="source-chip" href="https://pubmed.ncbi.nlm.nih.gov/39304615/" target="_blank" rel="noreferrer">Consenso de medición</a></div>
          </div>
          <div className="panel p-5 sm:p-6">
            <p className="step-label">Cómo validarlo</p>
            <ol className="mt-4 grid gap-3 text-sm text-slate-400 sm:grid-cols-2">
              <li className="validation-step"><span>1</span><div><strong>Geometría</strong><p>Pruebas con ángulos conocidos y casos límite.</p></div></li>
              <li className="validation-step"><span>2</span><div><strong>Referencia</strong><p>Comparar videos con medición 3D o Kinovea ciega.</p></div></li>
              <li className="validation-step"><span>3</span><div><strong>Repetibilidad</strong><p>MAE, ICC y Bland–Altman entre sesiones.</p></div></li>
              <li className="validation-step"><span>4</span><div><strong>Uso seguro</strong><p>Probar claridad, errores y escalamiento profesional.</p></div></li>
            </ol>
          </div>
        </section>

        <footer className="mt-5 flex flex-col justify-between gap-2 text-xs leading-5 text-slate-600 sm:flex-row"><span>Herramienta de apoyo; ante dolor, adormecimiento o lesión, consultá a un profesional de salud.</span><span>MediaPipe Tasks Vision · Apache 2.0 · procesamiento local</span></footer>
      </section>
    </main>
  );
}
