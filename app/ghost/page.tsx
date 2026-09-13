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
  nEffective?: number;
  processingStatus?: string;
  ghostFile?: string;
}

interface CohortGhostSummary {
  id: string;
  title: string;
  modality: GhostModality;
  file: string;
  nEffective: number;
  scope: string;
  metric: { label: string; value: string; p10: string; p90: string; unit: string };
}

interface PopulationGhostManifest {
  id: string;
  version: string;
  status: 'candidate' | 'approved' | 'retired';
  activeInRecommendations: boolean;
  title: string;
  description: string;
  sources: PopulationSource[];
  cohortGhosts: CohortGhostSummary[];
  nextStep: string;
}

interface PopulationCurve {
  median: number[];
  p10: number[];
  p90: number[];
}

interface PopulationBand {
  median: number;
  p10: number;
  p90: number;
  unit: string;
}

interface PopulationStratum {
  label: string;
  nEffective: number;
  curves?: Record<string, PopulationCurve>;
  metrics?: Record<string, PopulationBand>;
  participantSummaries?: Record<string, PopulationBand>;
}

interface PopulationGhostFile {
  modality: GhostModality;
  defaultStratum: string;
  population: { nEffective: number };
  strata: Record<string, PopulationStratum>;
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

function populationMetric(cohort: PopulationGhostFile, modality: GhostModality) {
  const stratum = cohort.strata[cohort.defaultStratum];
  const metric = modality === 'running'
    ? stratum?.participantSummaries?.kneeAngleZAtContact
    : stratum?.metrics?.kneeFlexionRangeDeg;
  if (!stratum || !metric) return null;
  return {
    label: modality === 'running' ? 'Rodilla en contacto' : 'Rango de flexión de rodilla',
    ...metric,
    nEffective: stratum.nEffective,
    stratumLabel: stratum.label,
  };
}

function displayUnit(unit: string) {
  return unit === 'deg' ? '°' : unit;
}

function PopulationOverlay({ modality, cohort }: { modality: GhostModality; cohort: PopulationGhostFile }) {
  const stratum = cohort.strata[cohort.defaultStratum];
  if (!stratum) return null;

  const metric = populationMetric(cohort, modality);
  const bandWidth = metric
    ? Math.max(10, Math.min(24, 8 + (metric.p90 - metric.p10) / 2))
    : 12;
  const bodyPath = modality === 'running'
    ? 'M264 66 L250 145 M250 145 L211 205 L197 242 M250 145 L290 201 L312 239 M260 91 L225 126 M260 91 L300 132'
    : 'M238 69 L232 82 L172 145 M232 82 L278 96 L340 121 M172 145 L222 184 L234 205 L245 215 M172 145 L150 202 L156 235 L165 255';

  return (
    <g className="ghost-population" aria-label={`Rango poblacional P10 a P90, n efectivo ${stratum.nEffective}`}>
      <path className="ghost-population-band" d={bodyPath} style={{ strokeWidth: bandWidth }} />
    </g>
  );
}

function PopulationRangeCard({ modality, cohort }: { modality: GhostModality; cohort: PopulationGhostFile }) {
  const metric = populationMetric(cohort, modality);
  if (!metric) return null;
  const unit = displayUnit(metric.unit);
  const span = Math.max(metric.p90 - metric.p10, 0.001);
  const position = (value: number) => `${((value - metric.p10) / span) * 100}%`;
  return (
    <div className="population-range-card" aria-label={`${metric.label}: P10 ${metric.p10.toFixed(1)}${unit}, mediana ${metric.median.toFixed(1)}${unit}, P90 ${metric.p90.toFixed(1)}${unit}`}>
      <div className="flex items-center justify-between gap-3">
        <div><p className="step-label">Dispersión poblacional visible</p><p className="mt-1 text-sm text-slate-200">{metric.label} · {metric.stratumLabel}</p></div>
        <span className="shrink-0 font-mono text-xs text-amber-200">n={metric.nEffective}</span>
      </div>
      <div className="population-range-track" aria-hidden="true"><span className="population-range-fill" /><span className="population-range-marker" style={{ left: position(metric.p10) }} /><span className="population-range-marker population-range-marker-median" style={{ left: position(metric.median) }} /><span className="population-range-marker" style={{ left: position(metric.p90) }} /></div>
      <div className="mt-2 flex justify-between gap-2 font-mono text-[11px] text-slate-400"><span>P10 {metric.p10.toFixed(1)}{unit}</span><span className="text-lime-200">Mediana {metric.median.toFixed(1)}{unit}</span><span>P90 {metric.p90.toFixed(1)}{unit}</span></div>
      <p className="mt-2 text-xs leading-5 text-slate-500">La banda sobre el cuerpo es una proyección visual del rango de métricas; no representa coordenadas articulares observadas.</p>
    </div>
  );
}

function GhostSketch({ modality, view, cohortGhost }: { modality: GhostModality; view: GhostView; cohortGhost?: PopulationGhostFile }) {
  if (modality === 'running') {
    return (
      <svg viewBox="0 0 520 300" aria-label={`Fantasma de running en plano ${view}`}>
        <title>Fantasma de running</title>
        <path className="ghost-ground" d="M55 260 H465" />
        {cohortGhost ? <PopulationOverlay modality={modality} cohort={cohortGhost} /> : null}
        <circle className="ghost-head" cx="270" cy="47" r="18" />
        <path className="ghost-body" d="M264 66 L250 145 M250 145 L211 205 L197 242 M250 145 L290 201 L312 239 M260 91 L225 126 M260 91 L300 132" />
        <circle className="ghost-joint" cx="260" cy="91" r="5" /><circle className="ghost-joint" cx="250" cy="145" r="5" />
        <circle className="ghost-joint" cx="211" cy="205" r="5" /><circle className="ghost-joint" cx="197" cy="242" r="5" />
        <circle className="ghost-joint" cx="290" cy="201" r="5" /><circle className="ghost-joint" cx="312" cy="239" r="5" />
        {cohortGhost ? <path className="ghost-population-median" d="M264 66 L250 145 M250 145 L211 205 L197 242 M250 145 L290 201 L312 239 M260 91 L225 126 M260 91 L300 132" /> : null}
        <text className="ghost-caption" x="330" y="55">171.4 SPM</text>
        <text className="ghost-caption" x="330" y="78">FSA 2.9°</text>
        <text className="ghost-caption" x="330" y="101">biplanar</text>
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 520 300" aria-label={`Fantasma de bike en plano ${view}`}>
      <title>Fantasma de bike con dos miembros inferiores y cinco apoyos</title>
      <g className="ghost-bike">
        <circle cx="105" cy="235" r="47" />
        <circle cx="400" cy="235" r="47" />
        <path d="M105 235 L205 235 L172 155 L315 165 L400 235 L205 235 L315 165" />
        <path d="M172 155 L155 128 M315 165 L340 119 M325 125 H365" />
        <path className="ghost-crank" d="M205 235 L245 215 M205 235 L165 255" />
        <circle className="ghost-support" cx="172" cy="155" r="6" />
        <circle className="ghost-support" cx="340" cy="121" r="6" />
        <circle className="ghost-support" cx="334" cy="126" r="6" />
        <circle className="ghost-support" cx="245" cy="215" r="6" />
        <circle className="ghost-support" cx="165" cy="255" r="6" />
      </g>
      {cohortGhost ? <PopulationOverlay modality={modality} cohort={cohortGhost} /> : null}
      <path className="ghost-support-link" d="M172 145 L172 155" />
      <path className="ghost-body" d="M238 69 L232 82 L172 145 M232 82 L278 96 L340 121 M172 145 L222 184 L234 205 L245 215 M172 145 L150 202 L156 235 L165 255" />
      <path className="ghost-body ghost-body-far" d="M228 87 L266 109 L334 126" />
      <circle className="ghost-head" cx="238" cy="53" r="16" />
      <circle className="ghost-joint" cx="232" cy="82" r="5" /><circle className="ghost-joint" cx="172" cy="145" r="5" />
      <circle className="ghost-joint" cx="278" cy="96" r="5" /><circle className="ghost-joint" cx="222" cy="184" r="5" />
      <circle className="ghost-joint" cx="234" cy="205" r="5" /><circle className="ghost-joint" cx="150" cy="202" r="5" />
      <circle className="ghost-joint" cx="156" cy="235" r="5" />
      {cohortGhost ? <path className="ghost-population-median" d="M238 69 L232 82 L172 145 M232 82 L278 96 L340 121 M172 145 L222 184 L234 205 L245 215 M172 145 L150 202 L156 235 L165 255" /> : null}
      <text className="ghost-caption" x="350" y="55">BDC 38.6°</text>
      <text className="ghost-caption" x="350" y="78">cadera 86.2°</text>
      <text className="ghost-caption" x="350" y="101">2 piernas · 5 apoyos</text>
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
  const [populationGhosts, setPopulationGhosts] = useState<Partial<Record<GhostModality, PopulationGhostFile>>>({});
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

  useEffect(() => {
    let cancelled = false;
    const files: Record<GhostModality, string> = {
      running: assetPath('/population/cohort-ghost-running.json'),
      cycling: assetPath('/population/cohort-ghost-cycling.json'),
    };
    Promise.all(Object.entries(files).map(async ([modality, url]) => {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`No se pudo cargar ${url}`);
      return [modality as GhostModality, await response.json() as PopulationGhostFile] as const;
    }))
      .then((entries) => {
        if (!cancelled) setPopulationGhosts(Object.fromEntries(entries) as Partial<Record<GhostModality, PopulationGhostFile>>);
      })
      .catch(() => { if (!cancelled) setPopulationGhosts({}); });
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
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-white sm:text-5xl">simulá ajustes</h1>
          <p className="mt-4 text-base leading-7 text-slate-400">Probá los fantasmas de running y bike con dos miembros inferiores, revisá las métricas de control y compará referencias poblacionales procesadas sin convertirlas en una norma.</p>
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

            <div className="ghost-stage mt-5"><GhostSketch modality={modality} view={view} cohortGhost={populationGhosts[modality]} /><div className="frame-tag"><RefreshCw className="size-3.5" /> {loading ? 'Cargando fixture…' : `${fixture?.frames.length ?? 0} cuadros · ${fixture?.fps ?? '—'} fps`}</div></div>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-400" aria-label="Leyenda del fantasma">
              <span className="inline-flex items-center gap-2"><i className="legend-line legend-line-original" /> Fantasma original</span>
              <span className="inline-flex items-center gap-2"><i className="legend-line legend-line-population" /> Banda P10–P90</span>
              <span className="inline-flex items-center gap-2"><i className="legend-line legend-line-median" /> Mediana poblacional</span>
              {populationGhosts[modality] ? <span className="text-amber-200">n efectivo={populationGhosts[modality]?.population.nEffective}</span> : <span>Cargando cohorte…</span>}
            </div>
            {populationGhosts[modality] ? <PopulationRangeCard modality={modality} cohort={populationGhosts[modality] as PopulationGhostFile} /> : null}
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
          <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="step-label">Datos abiertos</p><h2 className="mt-2 text-2xl font-semibold text-white">Fantasmas poblacionales procesados</h2></div><span className="inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-300/8 px-3 py-1.5 text-xs text-amber-200"><Database className="size-3.5" /> {populationLoading ? 'cargando…' : population?.status ?? 'sin manifiesto'}</span></div>
          <p className="mt-4 max-w-4xl text-sm leading-6 text-slate-400">Se procesaron salidas públicas de running y bike, con unidades y fase documentadas, control por participante y agregación robusta. Siguen siendo referencias exploratorias: no son una postura ideal ni activan recomendaciones automáticas.</p>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {population?.cohortGhosts.map((cohort) => (
              <article key={cohort.id} className="rounded-xl border border-lime-300/15 bg-lime-300/5 p-4">
                <div className="flex items-start justify-between gap-3"><div><p className="text-xs uppercase tracking-[0.12em] text-lime-200">{cohort.modality === 'running' ? 'Running' : 'Bike'}</p><h3 className="mt-1 font-medium text-white">{cohort.title}</h3></div><span className="shrink-0 rounded-full bg-white/8 px-2 py-1 text-xs text-lime-100">n efectivo={cohort.nEffective}</span></div>
                <p className="mt-3 text-sm text-slate-300">{cohort.metric.label}: <strong className="text-lime-100">mediana {cohort.metric.value}{cohort.metric.unit}</strong> · P10–P90 {cohort.metric.p10}{cohort.metric.unit}–{cohort.metric.p90}{cohort.metric.unit}</p>
                <p className="mt-2 text-xs leading-5 text-slate-400">{cohort.scope}</p>
                <a className="source-chip mt-4 inline-block text-xs" href={assetPath(cohort.file)} target="_blank" rel="noreferrer">Respaldo de datos · mediana / P10–P90</a>
              </article>
            ))}
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {population?.sources.map((source) => (
              <article key={source.id} className="rounded-xl border border-white/8 bg-black/10 p-4">
                <div className="flex items-start justify-between gap-3"><div><p className="text-xs uppercase tracking-[0.12em] text-slate-500">{source.modality === 'running' ? 'Running' : 'Bike'}</p><h3 className="mt-1 font-medium text-slate-100">{source.title}</h3></div><span className="shrink-0 rounded-full bg-white/5 px-2 py-1 text-xs text-slate-400">{source.nEffective ? `n efectivo=${source.nEffective}` : source.participants ? `n informado=${source.participants}` : 'n no auditado'}</span></div>
                <p className="mt-3 text-sm leading-6 text-slate-400">{source.data}</p><p className="mt-2 text-xs leading-5 text-slate-500">{source.suitability} Limitación: {source.limitation}</p>
                <a className="source-chip mt-4 inline-block text-xs" href={source.url} target="_blank" rel="noreferrer">Ver fuente · {source.license}</a>
              </article>
            ))}
          </div>
          <div className="mt-5 flex items-start gap-3 rounded-xl border border-lime-300/15 bg-lime-300/5 p-4 text-sm leading-6 text-slate-300"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-lime-200" /><p><strong className="text-lime-100">Estado de esta versión:</strong> {population?.nextStep ?? 'los agregados poblacionales están incorporados como candidatos exploratorios.'} <a className="ml-1 text-lime-200 underline" href={assetPath('/population/cohort-ghost-quality.md')} target="_blank" rel="noreferrer">Ver reporte de exclusiones</a></p></div>
        </section>

        <footer className="mt-6 text-xs leading-5 text-slate-600">Evi Miento · página de QA pública · los fantasmas poblacionales no se usan para recomendar ajustes automáticamente.</footer>
      </section>
    </main>
  );
}
