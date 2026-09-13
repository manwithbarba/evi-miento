'use client';

import { useEffect, useMemo, useState } from 'react';
import { Activity, ArrowLeft, Bike, CircleAlert, Database, Footprints, RefreshCw, ShieldCheck } from 'lucide-react';

import { GHOST_REFERENCES, type GhostModality } from '@/lib/ghost-reference';

type GhostView = 'sagittal' | 'frontal';

interface GhostFixture {
  description: string;
  fixtureRole: string;
  ghostId: string;
  ghostVersion: string;
  immutable: boolean;
  modality: GhostModality;
  view: GhostView;
  fps: number;
  frames: Array<{ time: number; landmarks: unknown[] }>;
}

interface PopulationSource {
  id: string;
  title: string;
  modality: GhostModality;
  participants: number | null;
  license: string;
  url: string;
  data: string;
  suitability: string;
  limitation: string;
}

interface PopulationGhostManifest {
  id: string;
  version: string;
  status: 'candidate' | 'approved' | 'retired';
  activeInRecommendations: boolean;
  title: string;
  description: string;
  sources: PopulationSource[];
  nextStep: string;
}

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

const FIXTURES: Record<GhostModality, Record<GhostView, string>> = {
  running: {
    sagittal: '/samples/ghost_runner_sagittal.json',
    frontal: '/samples/ghost_runner_frontal.json',
  },
  cycling: {
    sagittal: '/samples/ghost_biker_sagittal.json',
    frontal: '/samples/ghost_biker_frontal.json',
  },
};

function assetPath(path: string) {
  return `${BASE_PATH}${path}`;
}

function GhostSketch({ modality, view }: { modality: GhostModality; view: GhostView }) {
  if (modality === 'running') {
    return (
      <svg viewBox="0 0 520 300" aria-label={`Fantasma de running en plano ${view}`}>
        <title>Fantasma de running</title>
        <path className="ghost-ground" d="M55 260 H465" />
        <circle className="ghost-head" cx="270" cy="47" r="18" />
        <path className="ghost-body" d="M264 66 L250 145 L266 206 L252 254 M250 145 L211 205 L197 242 M250 145 L290 201 L312 239 M260 91 L225 126 M260 91 L300 132" />
        <circle className="ghost-joint" cx="260" cy="91" r="5" /><circle className="ghost-joint" cx="250" cy="145" r="5" />
        <circle className="ghost-joint" cx="266" cy="206" r="5" /><circle className="ghost-joint" cx="252" cy="254" r="5" />
        <circle className="ghost-joint" cx="197" cy="242" r="5" /><circle className="ghost-joint" cx="312" cy="239" r="5" />
        <text className="ghost-caption" x="330" y="55">171.4 SPM</text>
        <text className="ghost-caption" x="330" y="78">FSA 2.9°</text>
        <text className="ghost-caption" x="330" y="101">biplanar</text>
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 520 300" aria-label={`Fantasma de bike en plano ${view}`}>
      <title>Fantasma de bike</title>
      <g className="ghost-bike"><circle cx="105" cy="235" r="47" /><circle cx="400" cy="235" r="47" /><path d="M105 235 L205 235 L172 155 L315 165 L400 235 L205 235 L315 165" /><path d="M172 155 L155 128 M315 165 L340 119 M325 125 H365" /></g>
      <path className="ghost-body" d="M246 45 L230 72 L204 146 L278 163 L330 123 M204 146 L236 205 L212 235 M204 146 L169 203 L203 235" />
      <circle className="ghost-head" cx="252" cy="30" r="16" />
      <circle className="ghost-joint" cx="230" cy="72" r="5" /><circle className="ghost-joint" cx="204" cy="146" r="5" />
      <circle className="ghost-joint" cx="236" cy="205" r="5" /><circle className="ghost-joint" cx="212" cy="235" r="5" />
      <circle className="ghost-joint" cx="278" cy="163" r="5" /><circle className="ghost-joint" cx="330" cy="123" r="5" />
      <text className="ghost-caption" x="340" y="55">BDC 38.6°</text>
      <text className="ghost-caption" x="340" y="78">cadera 86.2°</text>
      <text className="ghost-caption" x="340" y="101">biplanar</text>
    </svg>
  );
}

function metricValue(value: number, unit: string) {
  return `${value.toFixed(1)}${unit}`;
}

export default function GhostLabPage() {
  const [modality, setModality] = useState<GhostModality>('running');
  const [view, setView] = useState<GhostView>('sagittal');
  const [fixture, setFixture] = useState<GhostFixture | null>(null);
  const [population, setPopulation] = useState<PopulationGhostManifest | null>(null);
  const [loadedFixtureUrl, setLoadedFixtureUrl] = useState<string | null>(null);
  const [populationLoading, setPopulationLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reference = GHOST_REFERENCES[modality];
  const fixtureUrl = useMemo(() => assetPath(FIXTURES[modality][view]), [modality, view]);

  useEffect(() => {
    let cancelled = false;
    fetch(fixtureUrl)
      .then((response) => {
        if (!response.ok) throw new Error(`No se pudo cargar ${fixtureUrl}`);
        return response.json() as Promise<GhostFixture>;
      })
      .then((data) => {
        if (!cancelled) {
          setFixture(data);
          setLoadedFixtureUrl(fixtureUrl);
          setError(null);
        }
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setLoadedFixtureUrl(fixtureUrl);
          setError(reason instanceof Error ? reason.message : 'No se pudo cargar el fixture.');
        }
      });
    return () => { cancelled = true; };
  }, [fixtureUrl]);

  useEffect(() => {
    let cancelled = false;
    fetch(assetPath('/population/ghost-manifest.json'))
      .then((response) => response.json() as Promise<PopulationGhostManifest>)
      .then((data) => { if (!cancelled) setPopulation(data); })
      .catch(() => { if (!cancelled) setPopulation(null); })
      .finally(() => { if (!cancelled) setPopulationLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const loading = loadedFixtureUrl !== fixtureUrl;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-white/8 bg-[#0b1016]/92 backdrop-blur-xl">
        <div className="mx-auto flex min-h-16 max-w-[1240px] items-center justify-between gap-4 px-5 lg:px-8">
          <a href={assetPath('/')} className="flex items-center gap-3">
            <div className="grid size-9 place-items-center rounded-xl bg-lime-300 text-[#10160b]"><Activity className="size-5" /></div>
            <div><p className="text-[15px] font-semibold text-white">Evi Miento</p><p className="text-xs text-slate-500">Laboratorio de fantasmas</p></div>
          </a>
          <a href={assetPath('/')} className="flex items-center gap-2 text-xs text-slate-400 transition hover:text-lime-200"><ArrowLeft className="size-3.5" /> Volver al análisis</a>
        </div>
      </header>

      <section className="mx-auto max-w-[1240px] px-5 py-8 lg:px-8 lg:py-12">
        <div className="max-w-3xl">
          <p className="step-label">Página pública de prueba</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-white sm:text-5xl">Probá el fantasma sin convertirlo en una norma.</h1>
          <p className="mt-4 text-base leading-7 text-slate-400">Esta página carga los fixtures inmutables de running y bike, muestra su trazabilidad y verifica que las métricas del caso sintético sigan alineadas con la referencia esperada.</p>
        </div>

        <div className="mt-8 grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
          <section className="panel p-5 sm:p-7">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><p className="step-label">Fantasma sintético</p><h2 className="mt-2 text-2xl font-semibold text-white">{reference.label}</h2></div>
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/8 px-3 py-1.5 text-xs text-emerald-200"><ShieldCheck className="size-3.5" /> inmutable</span>
            </div>

            <fieldset className="mt-5 flex flex-wrap gap-2">
              <legend className="sr-only">Modalidad y plano de cámara</legend>
              <button type="button" onClick={() => setModality('running')} className={`ghost-toggle ${modality === 'running' ? 'ghost-toggle-active' : ''}`}><Footprints className="size-4" /> Running</button>
              <button type="button" onClick={() => setModality('cycling')} className={`ghost-toggle ${modality === 'cycling' ? 'ghost-toggle-active' : ''}`}><Bike className="size-4" /> Bike</button>
              <span className="mx-1 hidden w-px bg-white/10 sm:block" />
              <button type="button" onClick={() => setView('sagittal')} className={`ghost-toggle ${view === 'sagittal' ? 'ghost-toggle-active' : ''}`}>Lateral</button>
              <button type="button" onClick={() => setView('frontal')} className={`ghost-toggle ${view === 'frontal' ? 'ghost-toggle-active' : ''}`}>Frontal</button>
            </fieldset>

            <div className="ghost-stage mt-5"><GhostSketch modality={modality} view={view} /><div className="frame-tag"><RefreshCw className="size-3.5" /> {loading ? 'Cargando fixture…' : `${fixture?.frames.length ?? 0} cuadros · ${fixture?.fps ?? '—'} fps`}</div></div>
            <p className="mt-4 text-sm leading-6 text-slate-400">{reference.description}</p>
            {error ? <p className="mt-3 flex items-center gap-2 text-sm text-rose-300"><CircleAlert className="size-4" /> {error}</p> : null}
          </section>

          <section className="panel p-5 sm:p-7">
            <p className="step-label">Chequeo de regresión</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Lecturas esperadas</h2>
            <p className="mt-3 text-sm leading-6 text-slate-400">La comparación es técnica: controla geometría, unidades y presentación. No indica riesgo, lesión ni “postura correcta”.</p>
            <div className="mt-5 grid gap-2">
              {reference.metrics.map((metric) => (
                <div key={metric.key} className="metric-card flex items-center justify-between gap-3">
                  <div><p className="text-sm text-slate-200">{metric.label}</p><p className="mt-1 text-xs text-slate-500">tolerancia ±{metric.tolerance}{metric.unit}</p></div>
                  <span className="font-mono text-sm font-semibold text-lime-200">{metricValue(metric.expected, metric.unit)}</span>
                </div>
              ))}
            </div>
            <div className="mt-5 rounded-xl border border-lime-300/15 bg-lime-300/5 p-4 text-sm leading-6 text-lime-100"><strong>Estado:</strong> fixture disponible · versión {reference.version} · archivo <code>{fixtureUrl.replace(`${BASE_PATH}/`, '')}</code></div>
          </section>
        </div>

        <section className="panel mt-5 p-5 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="step-label">Datos abiertos</p><h2 className="mt-2 text-2xl font-semibold text-white">Fantasma poblacional: candidato, todavía no activo</h2></div><span className="inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-300/8 px-3 py-1.5 text-xs text-amber-200"><Database className="size-3.5" /> {populationLoading ? 'cargando…' : population?.status ?? 'sin manifiesto'}</span></div>
          <p className="mt-4 max-w-4xl text-sm leading-6 text-slate-400">Sí existen datos abiertos útiles, pero no son directamente equivalentes a la salida 2D de Evi Miento. Este manifiesto publica la procedencia y deja el agregado como candidato hasta re-procesar señales, armonizar protocolos y calcular estadísticas robustas por cohorte.</p>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {population?.sources.map((source) => (
              <article key={source.id} className="rounded-xl border border-white/8 bg-black/10 p-4">
                <div className="flex items-start justify-between gap-3"><div><p className="text-xs uppercase tracking-[0.12em] text-slate-500">{source.modality === 'running' ? 'Running' : 'Bike'}</p><h3 className="mt-1 font-medium text-slate-100">{source.title}</h3></div><span className="shrink-0 rounded-full bg-white/5 px-2 py-1 text-xs text-slate-400">{source.participants ? `n=${source.participants}` : 'n pendiente'}</span></div>
                <p className="mt-3 text-sm leading-6 text-slate-400">{source.data}</p><p className="mt-2 text-xs leading-5 text-slate-500">{source.suitability} Limitación: {source.limitation}</p>
                <a className="source-chip mt-4 inline-block text-xs" href={source.url} target="_blank" rel="noreferrer">Ver fuente · {source.license}</a>
              </article>
            ))}
          </div>
          <div className="mt-5 flex items-start gap-3 rounded-xl border border-white/8 bg-white/[.025] p-4 text-sm leading-6 text-slate-400"><CircleAlert className="mt-0.5 size-4 shrink-0 text-amber-300" /><p><strong className="text-slate-200">Siguiente paso:</strong> {population?.nextStep ?? 'validar el manifiesto y procesar los datos originales fuera de la aplicación.'}</p></div>
        </section>

        <footer className="mt-6 text-xs leading-5 text-slate-600">Evi Miento · página de QA pública · los fantasmas poblacionales no se usan para recomendar ajustes automáticamente.</footer>
      </section>
    </main>
  );
}
