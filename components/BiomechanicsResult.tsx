'use client';

import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  Download,
  Save,
  ShieldCheck,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import type { TargetRange } from '@/lib/types';
import type { AnalysisResult } from '@/hooks/useAnalysis';
import {
  trafficLightBadgeClasses,
  trafficLightLabel,
} from '@/lib/traffic-light';
import type { MetrologicalEvaluation, TrafficLightLevel } from '@/lib/types';
import {
  compareCyclingToGhost,
  compareRunningToGhost,
  ghostComparisonLabel,
  type GhostComparison,
} from '@/lib/ghost-reference';

function TrafficIcon({ level }: { level: TrafficLightLevel }) {
  switch (level) {
    case 'green':
      return <CheckCircle2 className="size-3.5 shrink-0" />;
    case 'yellow':
      return <AlertTriangle className="size-3.5 shrink-0" />;
    case 'red':
      return <AlertOctagon className="size-3.5 shrink-0" />;
  }
}

function MetrologicalQualityBanner({ evalData }: { evalData: MetrologicalEvaluation }) {
  const badgeClass = trafficLightBadgeClasses(evalData.level);
  return (
    <div className={`mb-4 rounded-xl border p-3.5 transition ${badgeClass}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-medium text-xs">
          <TrafficIcon level={evalData.level} />
          <span>{evalData.title}</span>
        </div>
        <span className="font-mono text-[11px] font-semibold">{evalData.qualityBand}</span>
      </div>
      <p className="mt-1.5 text-[11px] leading-relaxed opacity-90">
        {evalData.description}
      </p>
      <div className="mt-2 flex items-center justify-between border-t border-current/15 pt-1.5 text-[10px] opacity-80">
        <span>Confianza: {Math.round(evalData.confidence * 100)}%</span>
        <span>Cobertura temporal: {Math.round(evalData.frameCoverage * 100)}%</span>
      </div>
    </div>
  );
}

function GhostBadge({ comparison }: { comparison: GhostComparison | undefined }) {
  if (!comparison) return null;
  const level: TrafficLightLevel = comparison.status === 'aligned'
    ? 'green'
    : comparison.status === 'outside-tolerance'
      ? 'yellow'
      : 'red';
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${trafficLightBadgeClasses(level)}`}>
      <TrafficIcon level={level} />
      Fantasma · {ghostComparisonLabel(comparison.status)}
    </span>
  );
}

function DescriptiveNote({ children }: { children: ReactNode }) {
  return <p className="text-[10px] leading-relaxed text-slate-500">Lectura descriptiva · {children}</p>;
}

function TrafficBadge({ level }: { level: TrafficLightLevel }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${trafficLightBadgeClasses(level)}`}>
      <TrafficIcon level={level} />
      {trafficLightLabel(level)}
    </span>
  );
}

function ActionButtons({
  saved,
  onSave,
  onDownload,
}: {
  saved: boolean;
  onSave: () => void;
  onDownload: () => void;
}) {
  return (
    <div className="mt-5 flex gap-2">
      <Button
        variant="outline"
        size="sm"
        className="flex-1 border-white/10 bg-white/[.03] text-xs text-slate-300 hover:bg-white/[.07]"
        onClick={onSave}
      >
        <Save data-icon="inline-start" />
        {saved ? 'Guardado en sesión' : 'Guardar línea base'}
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="border-white/10 bg-white/[.03] text-xs text-slate-300 hover:bg-white/[.07]"
        onClick={onDownload}
      >
        <Download data-icon="inline-start" />
        JSON
      </Button>
    </div>
  );
}

export function EmptyResult() {
  return (
    <aside className="panel flex min-h-[560px] flex-col items-center justify-center p-6 text-center">
      <div className="grid size-14 place-items-center rounded-2xl border border-white/10 bg-white/[.02] text-slate-500">
        <ShieldCheck className="size-6" />
      </div>
      <h3 className="mt-4 text-base font-semibold text-white">Esperando video</h3>
      <p className="mt-1 max-w-[240px] text-xs leading-5 text-slate-500">
        Cargá una grabación o iniciá la demostración para obtener calidad de señal, lecturas descriptivas y comparación con el fantasma de calibración.
      </p>
    </aside>
  );
}

interface BiomechanicsResultProps {
  result: AnalysisResult;
  cyclingProfile?: { hip: TargetRange; torso: TargetRange };
  saved: boolean;
  onSave: () => void;
  onDownload: () => void;
}

export function BiomechanicsResult({
  result,
  cyclingProfile,
  saved,
  onSave,
  onDownload,
}: BiomechanicsResultProps) {
  const { metrological } = result;

  if (result.modality === 'cycling') {
    const { summary, frontal, recommendation } = result;
    const profile = cyclingProfile ?? { hip: { min: 70, max: 100 }, torso: { min: 35, max: 55 } };
    const ghostComparisons = compareCyclingToGhost(summary, frontal);
    const ghostFor = (key: string) => ghostComparisons.find((comparison) => comparison.key === key);

    return (
      <aside className="panel p-5">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <p className="step-label">03 · Resultado Biplanar</p>
            <h2 className="mt-1 text-lg font-semibold text-white">Evaluación Ciclismo</h2>
          </div>
          <span className="rounded-full bg-white/5 px-2.5 py-1 font-mono text-xs text-slate-400">
            {frontal ? 'Biplanar' : 'Sagital'}
          </span>
        </div>

        {/* Semáforo Metrológico */}
        <MetrologicalQualityBanner evalData={metrological} />
        <p className="mb-3 text-[10px] leading-relaxed text-slate-500">
          El fantasma bike es un control sintético de regresión. Sirve para detectar cambios del algoritmo, no para decidir si una postura es correcta.
        </p>

        {/* Plano Sagital */}
        <div className="space-y-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Cámara 1 · Plano Sagital (Lateral)
          </p>

          <div className="metric-card">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm text-slate-200">Flexión rodilla · BDC</p>
                <p className="mt-0.5 text-xs text-slate-500">Define ajuste de altura de sillín</p>
              </div>
              <GhostBadge comparison={ghostFor('kneeFlexionBdc')} />
            </div>
            <div className="mt-2.5 flex items-baseline justify-between">
              <span className="font-mono text-2xl font-semibold text-white">
                {summary.kneeFlexionBdc.toFixed(1)}°
              </span>
              <span className="text-xs text-slate-400">fantasma 38.6° ±2°</span>
            </div>
            <DescriptiveNote>La revisión sobre altura de sillín apoya medir dinámicamente, pero no un rango universal. El objetivo de la sesión es comparar y explorar.</DescriptiveNote>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="metric-card">
              <p className="text-xs text-slate-400">Ángulo cadera mín.</p>
              <p className="mt-1 font-mono text-lg font-semibold text-white">{summary.hipAngleMin.toFixed(1)}°</p>
              <GhostBadge comparison={ghostFor('hipAngleMin')} />
              <p className="text-[10px] text-slate-500">perfil operativo {profile.hip.min}°–{profile.hip.max}°</p>
            </div>
            <div className="metric-card">
              <p className="text-xs text-slate-400">Inclinación torso</p>
              <p className="mt-1 font-mono text-lg font-semibold text-white">{summary.torsoAngleMedian.toFixed(1)}°</p>
              <GhostBadge comparison={ghostFor('torsoAngleMedian')} />
              <p className="text-[10px] text-slate-500">perfil operativo {profile.torso.min}°–{profile.torso.max}°</p>
            </div>
          </div>
        </div>

        {/* Plano Frontal / Posterior (si existe) */}
        {frontal && (
          <div className="mt-4 space-y-2.5 border-t border-white/8 pt-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Cámara 2 · Plano Frontal (Knee Tracking & Pelvis)
            </p>

            <div className="metric-card">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm text-slate-200">Balanceo pélvico (coronal)</p>
                  <p className="mt-0.5 text-xs text-slate-500">Oscilación en el sillín</p>
                </div>
                <GhostBadge comparison={ghostFor('pelvicRockingDeg')} />
              </div>
              <p className="mt-2 font-mono text-xl font-semibold text-white">
                {frontal.pelvicRockingDeg.toFixed(1)}°
              </p>
              <DescriptiveNote>Puede orientar una prueba de sillín, fatiga y control; no demuestra por sí solo una altura incorrecta.</DescriptiveNote>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="metric-card">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">Tracking Izq</span>
                  <GhostBadge comparison={ghostFor('kneeLateralExcursionLeftMm')} />
                </div>
                <p className="mt-1 font-mono text-base font-semibold text-white">
                  {frontal.kneeLateralExcursionLeftMm.toFixed(1)} mm
                </p>
                <DescriptiveNote>escala estimada por ancho pélvico</DescriptiveNote>
              </div>
              <div className="metric-card">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">Tracking Der</span>
                  <GhostBadge comparison={ghostFor('kneeLateralExcursionRightMm')} />
                </div>
                <p className="mt-1 font-mono text-base font-semibold text-white">
                  {frontal.kneeLateralExcursionRightMm.toFixed(1)} mm
                </p>
                <DescriptiveNote>escala estimada por ancho pélvico</DescriptiveNote>
              </div>
            </div>
          </div>
        )}

        {recommendation && (
          <div className="mt-4 rounded-xl border border-white/8 bg-white/[.025] p-3.5">
            <p className="text-xs font-semibold text-white">{recommendation.title}</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">{recommendation.detail}</p>
          </div>
        )}

        <ActionButtons saved={saved} onSave={onSave} onDownload={onDownload} />
      </aside>
    );
  }

  // Running
  const { summary, frontal, recommendations } = result;
  const ghostComparisons = compareRunningToGhost(summary, frontal);
  const ghostFor = (key: string) => ghostComparisons.find((comparison) => comparison.key === key);

  return (
    <aside className="panel p-5">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="step-label">03 · Resultado Biplanar</p>
          <h2 className="mt-1 text-lg font-semibold text-white">Evaluación Carrera</h2>
        </div>
        <span className="rounded-full bg-white/5 px-2.5 py-1 font-mono text-xs text-slate-400">
          {frontal ? 'Biplanar' : 'Sagital'}
        </span>
      </div>

      {/* Semáforo Metrológico */}
      <MetrologicalQualityBanner evalData={metrological} />
      <p className="mb-3 text-[10px] leading-relaxed text-slate-500">
        El fantasma running es un control sintético de regresión. Sirve para detectar cambios del algoritmo, no para definir una técnica ideal.
      </p>

      {/* Plano Sagital */}
      <div className="space-y-2.5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          Cámara 1 · Plano Sagital (Zancada y Contacto)
        </p>

        <div className="metric-card">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm text-slate-200">Cadencia de paso</p>
              <p className="mt-0.5 text-xs text-slate-500">Frecuencia por minuto</p>
            </div>
            <GhostBadge comparison={ghostFor('cadenceSpm')} />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="font-mono text-2xl font-semibold text-white">
              {summary.cadenceSpm} <span className="text-sm font-normal text-slate-400">SPM</span>
            </span>
            <span className="text-xs text-slate-400">fantasma 171.4 ±2 SPM</span>
          </div>
          <DescriptiveNote>La evidencia apoya probar cambios graduales en casos seleccionados, no una cadencia óptima universal.</DescriptiveNote>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="metric-card">
            <p className="text-xs text-slate-400">Ángulo de contacto</p>
            <p className="mt-1 font-mono text-lg font-semibold text-white">{summary.footStrikeAngleDeg.toFixed(1)}°</p>
            <p className="text-[10px] capitalize text-lime-300">{summary.footStrikeType}</p>
            <GhostBadge comparison={ghostFor('footStrikeAngleDeg')} />
          </div>
          <div className="metric-card">
            <p className="text-xs text-slate-400">Sobrezancada</p>
            <p className="mt-1 font-mono text-lg font-semibold text-white">{summary.overstridingIndex.toFixed(2)}</p>
            <GhostBadge comparison={ghostFor('overstridingIndex')} />
            <DescriptiveNote>índice normalizado; sin corte universal</DescriptiveNote>
          </div>
          <div className="metric-card">
            <p className="text-xs text-slate-400">Rodilla · Contacto</p>
            <p className="mt-1 font-mono text-lg font-semibold text-white">{summary.kneeFlexionAtContactDeg.toFixed(1)}°</p>
            <p className="text-[10px] text-slate-500">flexión en IC</p>
            <GhostBadge comparison={ghostFor('kneeFlexionAtContactDeg')} />
          </div>
          <div className="metric-card">
            <p className="text-xs text-slate-400">Inclinación tronco</p>
            <p className="mt-1 font-mono text-lg font-semibold text-white">{summary.torsoLeanMedianDeg.toFixed(1)}°</p>
            <GhostBadge comparison={ghostFor('torsoLeanMedianDeg')} />
            <DescriptiveNote>vs vertical; sin ventana universal</DescriptiveNote>
          </div>
        </div>
      </div>

      {/* Plano Frontal / Posterior (si existe) */}
      {frontal && (
        <div className="mt-4 space-y-2.5 border-t border-white/8 pt-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Cámara 2 · Plano Frontal (Estabilidad y Alineación)
          </p>

          <div className="metric-card">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm text-slate-200">Oblicuidad pélvica observada</p>
                <p className="mt-0.5 text-xs text-slate-500">proyección coronal 2D</p>
              </div>
              <GhostBadge comparison={ghostFor('pelvicObliquityDeg')} />
            </div>
            <p className="mt-2 font-mono text-xl font-semibold text-white">
              {frontal.pelvicObliquityDeg.toFixed(1)}°
            </p>
            <DescriptiveNote>Esta lectura no identifica por sí sola una caída contralateral ni un Trendelenburg clínico.</DescriptiveNote>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="metric-card">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Valgo Izq</span>
                  <GhostBadge comparison={ghostFor('dynamicKneeValgusLeftDeg')} />
              </div>
                <p className="mt-1 font-mono text-base font-semibold text-white">
                  {frontal.dynamicKneeValgusLeftDeg.toFixed(1)}°
                </p>
                <DescriptiveNote>proyección 2D</DescriptiveNote>
            </div>
            <div className="metric-card">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Valgo Der</span>
                  <GhostBadge comparison={ghostFor('dynamicKneeValgusRightDeg')} />
              </div>
                <p className="mt-1 font-mono text-base font-semibold text-white">
                  {frontal.dynamicKneeValgusRightDeg.toFixed(1)}°
                </p>
                <DescriptiveNote>proyección 2D</DescriptiveNote>
            </div>
          </div>

          <div className="metric-card">
            <div className="flex items-start justify-between gap-2">
              <span className="text-xs text-slate-400">Ancho de paso y cruzamiento</span>
              <GhostBadge comparison={ghostFor('stepWidthRatio')} />
            </div>
            <p className="mt-1 text-xs text-slate-300">
              Ratio relativo: {frontal.stepWidthRatio.toFixed(2)}. {frontal.crossoverDetected ? 'Se observó posible cruzamiento en la proyección.' : 'No se observó cruzamiento en la proyección.'} Sin corte universal para prescribir una corrección.
            </p>
          </div>
        </div>
      )}

      {/* Pautas deportivas */}
      <div className="mt-4 space-y-2">
        {recommendations.map((rec) => (
          <div key={rec.title} className="rounded-xl border border-white/8 bg-white/[.025] p-3.5">
            <div className="flex items-center gap-2">
              <TrafficBadge level={rec.status === 'optimal' ? 'green' : rec.status === 'attention' ? 'yellow' : 'red'} />
              <p className="text-xs font-semibold text-white">{rec.title}</p>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-400">{rec.detail}</p>
          </div>
        ))}
      </div>

      <ActionButtons saved={saved} onSave={onSave} onDownload={onDownload} />
    </aside>
  );
}
