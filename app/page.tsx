'use client';

import { useCallback, useState } from 'react';
import type { ChangeEvent, DragEvent } from 'react';
import { Activity, Bike, CircleCheck, Footprints, ShieldCheck } from 'lucide-react';

import { BiomechanicsResult, EmptyResult } from '@/components/BiomechanicsResult';
import { ModalitySelector } from '@/components/ModalitySelector';
import { RunningDemoSvg } from '@/components/RunningDemoSvg';
import { SessionConfig, getCyclingProfile } from '@/components/SessionConfig';
import { VideoCapture } from '@/components/VideoCapture';
import { useAnalysis } from '@/hooks/useAnalysis';
import type { CyclingDiscipline, SportModality } from '@/lib/types';

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

/** SVG de demostración para ciclismo (idéntico al original). */
function CyclingDemoSvg() {
  return (
    <svg viewBox="0 0 760 430" aria-label="Esquema de posición ciclista detectada">
      <title>Esquema de posición ciclista detectada</title>
      <g className="bike-lines"><circle cx="185" cy="337" r="77" /><circle cx="568" cy="337" r="77" /><path d="M185 337 L316 337 L268 209 L451 222 L568 337 L316 337 L451 222" /><path d="M268 209 L245 176 M451 222 L482 167 M461 174 L506 174" /></g>
      <g className="body-lines"><circle cx="350" cy="78" r="28" /><path d="M342 108 L312 184 L405 210 L465 174" /><path d="M312 184 L354 273 L309 337" /><path d="M312 184 L269 257 L318 337" /></g>
      {[[342,108],[312,184],[354,273],[309,337],[405,210],[465,174]].map(([cx,cy]) => <circle key={`${cx}-${cy}`} className="joint" cx={cx} cy={cy} r="7" />)}
      <path className="angle-arc" d="M329 248 A43 43 0 0 1 365 296" /><text className="angle-text" x="375" y="286">38.6°</text>
    </svg>
  );
}

export default function Home() {
  const [modality, setModality] = useState<SportModality | null>(null);
  const [discipline, setDiscipline] = useState<CyclingDiscipline>('road');
  const [notes, setNotes] = useState('');
  const [inseam, setInseam] = useState('82');
  const [crank, setCrank] = useState('172.5');
  // Running
  const [height, setHeight] = useState('175');
  const [cadenceEstimate, setCadenceEstimate] = useState('');

  const activeModality = modality ?? 'cycling';
  const analysis = useAnalysis(activeModality);
  const profile = getCyclingProfile(discipline);

  const applyDiscipline = useCallback((d: CyclingDiscipline) => {
    setDiscipline(d);
    analysis.setTarget(getCyclingProfile(d).knee);
    analysis.setSaved(false);
  }, [analysis]);

  const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    analysis.loadFile(e.target.files?.[0]);
    e.target.value = '';
  };
  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    analysis.loadFile(e.dataTransfer.files?.[0]);
  };

  // Selector de modalidad
  if (!modality) {
    return (
      <main className="min-h-screen bg-background text-foreground">
        <header className="no-print border-b border-white/8 bg-[#0b1016]/92 backdrop-blur-xl">
          <div className="mx-auto flex min-h-16 max-w-[1480px] items-center justify-between px-5 lg:px-8">
            <div className="flex items-center gap-3">
              <div className="grid size-9 place-items-center rounded-xl bg-lime-300 text-[#10160b] shadow-[0_0_24px_rgba(190,242,100,.2)]">
                <Activity className="size-5" strokeWidth={2.3} />
              </div>
              <div>
                <p className="text-[15px] font-semibold tracking-[-0.02em] text-white">Evi Miento</p>
                <p className="text-xs text-slate-500">Análisis biomecánico deportivo</p>
              </div>
            </div>
          </div>
        </header>
        <ModalitySelector onSelect={setModality} />
      </main>
    );
  }

  const confidence = analysis.result
    ? (analysis.result.modality === 'cycling' ? analysis.result.summary.confidence : analysis.result.summary.confidence)
    : null;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="no-print border-b border-white/8 bg-[#0b1016]/92 backdrop-blur-xl">
        <div className="mx-auto flex min-h-16 max-w-[1480px] items-center justify-between px-5 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="grid size-9 place-items-center rounded-xl bg-lime-300 text-[#10160b] shadow-[0_0_24px_rgba(190,242,100,.2)]">
              {modality === 'cycling' ? <Bike className="size-5" strokeWidth={2.3} /> : <Footprints className="size-5" strokeWidth={2.3} />}
            </div>
            <div>
              <p className="text-[15px] font-semibold tracking-[-0.02em] text-white">Evi Miento</p>
              <p className="text-xs text-slate-500">{modality === 'cycling' ? 'Bike fitting asistido' : 'Análisis de la marcha'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <a href={`${BASE_PATH}/ghost/`} className="hidden text-xs text-slate-500 transition hover:text-lime-200 sm:block">Laboratorio ghost</a>
            <button type="button" onClick={() => { analysis.clearVideo(); setModality(null); }} className="hidden text-xs text-slate-500 transition hover:text-slate-300 sm:block">
              ← Cambiar deporte
            </button>
            <div className="hidden items-center gap-2 rounded-full border border-emerald-300/15 bg-emerald-300/5 px-3 py-1.5 text-xs text-emerald-200 sm:flex">
              <ShieldCheck className="size-3.5" />
              El video se procesa en este dispositivo
            </div>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-[1480px] px-5 py-6 lg:px-8 lg:py-8">
        <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="mb-2 font-mono text-xs font-semibold uppercase tracking-[0.18em] text-lime-300">
              Nueva evaluación · Vista lateral
            </p>
            <h1 className="max-w-3xl text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">
              {modality === 'cycling'
                ? 'Ajustá la bicicleta con evidencia, una medición a la vez.'
                : 'Analizá tu técnica de carrera, una zancada a la vez.'}
            </h1>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <CircleCheck className="size-4 text-lime-300" />
            Protocolo guiado en 3 pasos
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[340px_minmax(0,1fr)_350px]">
          <SessionConfig
            modality={modality}
            side={analysis.side}
            onSideChange={(s) => { analysis.setSide(s); analysis.setSaved(false); }}
            notes={notes}
            onNotesChange={setNotes}
            discipline={discipline}
            onDisciplineChange={applyDiscipline}
            inseam={inseam}
            onInseamChange={setInseam}
            crank={crank}
            onCrankChange={setCrank}
            target={analysis.target}
            onTargetChange={analysis.setTarget}
            height={height}
            onHeightChange={setHeight}
            cadenceEstimate={cadenceEstimate}
            onCadenceEstimateChange={setCadenceEstimate}
          />

          <VideoCapture
            modality={modality}
            activeView={analysis.activeView}
            onViewChange={analysis.setActiveView}
            state={analysis.state}
            progress={analysis.progress}
            error={analysis.error}
            videoUrl={analysis.videoUrl}
            videoName={analysis.videoName}
            isDemo={analysis.isDemo}
            hasResult={!!analysis.result}
            confidence={confidence}
            videoRef={analysis.videoRef}
            canvasRef={analysis.canvasRef}
            fileInputRef={analysis.fileInputRef}
            onFileChange={onFileChange}
            onDrop={onDrop}
            onSetState={analysis.setState}
            onClearVideo={analysis.clearVideo}
            onRunDemo={analysis.runDemo}
            onAnalyze={analysis.analyzeVideo}
            demoSvg={modality === 'cycling' ? <CyclingDemoSvg /> : <RunningDemoSvg />}
          />

          {analysis.result ? (
            <BiomechanicsResult
              result={analysis.result}
              cyclingProfile={modality === 'cycling' ? { hip: profile.hip, torso: profile.torso } : undefined}
              saved={analysis.saved}
              onSave={analysis.saveBaseline}
              onDownload={analysis.downloadReport}
            />
          ) : (
            <EmptyResult />
          )}
        </div>

        <section className="method-grid mt-5">
          <div className="panel p-5 sm:p-6">
            <p className="step-label">Qué hace Evi Miento</p>
            <h2 className="mt-2 text-xl font-semibold text-white">Medición trazable, no una prescripción automática</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
              {modality === 'cycling'
                ? 'MediaPipe detecta 33 puntos corporales; Evi Miento calcula geometría 2D sobre el lado visible, conserva la confianza de cada lectura y compara el resultado con un fantasma sintético de regresión. Sólo la rodilla genera una sugerencia, siempre en pasos de 3 mm y con nueva medición obligatoria.'
                : 'MediaPipe detecta 33 puntos corporales; Evi Miento identifica ciclos de zancada, clasifica el patrón de contacto, mide cadencia y analiza la cinemática articular. Las recomendaciones son pautas deportivas conservadoras, no diagnósticos clínicos.'}
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              <a className="source-chip" href="https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker/web_js" target="_blank" rel="noreferrer">MediaPipe · documentación</a>
              <a className="source-chip" href="https://pubmed.ncbi.nlm.nih.gov/31145650/" target="_blank" rel="noreferrer">Running · FSP y cadencia</a>
              <a className="source-chip" href="https://pubmed.ncbi.nlm.nih.gov/34706617/" target="_blank" rel="noreferrer">Bike · altura de sillín</a>
              <a className="source-chip" href="https://pubmed.ncbi.nlm.nih.gov/39285616/" target="_blank" rel="noreferrer">Bike · posición</a>
            </div>
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

        <footer className="mt-5 flex flex-col justify-between gap-2 text-xs leading-5 text-slate-600 sm:flex-row">
          <span>Herramienta de apoyo deportivo; ante dolor, adormecimiento o lesión, consultá a un profesional de salud.</span>
          <span>MediaPipe Tasks Vision · Apache 2.0 · procesamiento local</span>
        </footer>
      </section>
    </main>
  );
}
