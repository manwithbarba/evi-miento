'use client';

import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  Download,
  Save,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { TargetRange } from '@/lib/types';
import type { AnalysisResult } from '@/hooks/useAnalysis';
import {
  evaluateCyclingKneeBdc,
  evaluateCyclingKneeTracking,
  evaluateCyclingPelvicRocking,
  evaluateRunningCadence,
  evaluateRunningKneeValgus,
  evaluateRunningPelvicDrop,
  evaluateRunningStepWidth,
  trafficLightBadgeClasses,
  trafficLightLabel,
} from '@/lib/traffic-light';
import type { MetrologicalEvaluation, TrafficLightLevel } from '@/lib/types';

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
        <span className="font-mono text-[11px] font-semibold">
          ±{evalData.marginOfErrorDeg}° incertidumbre
        </span>
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
        Cargá una grabación o iniciá la demostración para obtener la semaforización metrológica y biomecánica.
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
    const kneeEval = evaluateCyclingKneeBdc(summary.kneeFlexionBdc);

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
              <TrafficBadge level={kneeEval.level} />
            </div>
            <div className="mt-2.5 flex items-baseline justify-between">
              <span className="font-mono text-2xl font-semibold text-white">
                {summary.kneeFlexionBdc.toFixed(1)}°
              </span>
              <span className="text-xs text-slate-400">ref 25°–35°</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-400">{kneeEval.detail}</p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="metric-card">
              <p className="text-xs text-slate-400">Ángulo cadera mín.</p>
              <p className="mt-1 font-mono text-lg font-semibold text-white">{summary.hipAngleMin.toFixed(1)}°</p>
              <p className="text-[10px] text-slate-500">ref {profile.hip.min}°–{profile.hip.max}°</p>
            </div>
            <div className="metric-card">
              <p className="text-xs text-slate-400">Inclinación torso</p>
              <p className="mt-1 font-mono text-lg font-semibold text-white">{summary.torsoAngleMedian.toFixed(1)}°</p>
              <p className="text-[10px] text-slate-500">ref {profile.torso.min}°–{profile.torso.max}°</p>
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
                <TrafficBadge level={evaluateCyclingPelvicRocking(frontal.pelvicRockingDeg).level} />
              </div>
              <p className="mt-2 font-mono text-xl font-semibold text-white">
                {frontal.pelvicRockingDeg.toFixed(1)}°
              </p>
              <p className="mt-1 text-[11px] text-slate-400">
                {evaluateCyclingPelvicRocking(frontal.pelvicRockingDeg).detail}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="metric-card">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">Tracking Izq</span>
                  <TrafficBadge level={evaluateCyclingKneeTracking(frontal.kneeLateralExcursionLeftMm).level} />
                </div>
                <p className="mt-1 font-mono text-base font-semibold text-white">
                  {frontal.kneeLateralExcursionLeftMm.toFixed(1)} mm
                </p>
              </div>
              <div className="metric-card">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">Tracking Der</span>
                  <TrafficBadge level={evaluateCyclingKneeTracking(frontal.kneeLateralExcursionRightMm).level} />
                </div>
                <p className="mt-1 font-mono text-base font-semibold text-white">
                  {frontal.kneeLateralExcursionRightMm.toFixed(1)} mm
                </p>
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
  const cadenceEval = evaluateRunningCadence(summary.cadenceSpm);

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
            <TrafficBadge level={cadenceEval.level} />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="font-mono text-2xl font-semibold text-white">
              {summary.cadenceSpm} <span className="text-sm font-normal text-slate-400">SPM</span>
            </span>
            <span className="text-xs text-slate-400">ref 165–190 SPM</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">{cadenceEval.detail}</p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="metric-card">
            <p className="text-xs text-slate-400">Ángulo de contacto</p>
            <p className="mt-1 font-mono text-lg font-semibold text-white">{summary.footStrikeAngleDeg.toFixed(1)}°</p>
            <p className="text-[10px] capitalize text-lime-300">{summary.footStrikeType}</p>
          </div>
          <div className="metric-card">
            <p className="text-xs text-slate-400">Sobrezancada</p>
            <p className="mt-1 font-mono text-lg font-semibold text-white">{summary.overstridingIndex.toFixed(2)}</p>
            <p className="text-[10px] text-slate-500">{summary.overstridingIndex > 0.15 ? 'Alerta' : 'Funcional'}</p>
          </div>
          <div className="metric-card">
            <p className="text-xs text-slate-400">Rodilla · Contacto</p>
            <p className="mt-1 font-mono text-lg font-semibold text-white">{summary.kneeFlexionAtContactDeg.toFixed(1)}°</p>
            <p className="text-[10px] text-slate-500">flexión en IC</p>
          </div>
          <div className="metric-card">
            <p className="text-xs text-slate-400">Inclinación tronco</p>
            <p className="mt-1 font-mono text-lg font-semibold text-white">{summary.torsoLeanMedianDeg.toFixed(1)}°</p>
            <p className="text-[10px] text-slate-500">vs vertical (ref 4°–10°)</p>
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
                <p className="text-sm text-slate-200">Caída pélvica contralateral</p>
                <p className="mt-0.5 text-xs text-slate-500">Trendelenburg dinámico en apoyo</p>
              </div>
              <TrafficBadge level={evaluateRunningPelvicDrop(frontal.contralateralPelvicDropDeg).level} />
            </div>
            <p className="mt-2 font-mono text-xl font-semibold text-white">
              {frontal.contralateralPelvicDropDeg.toFixed(1)}°
            </p>
            <p className="mt-1 text-[11px] text-slate-400">
              {evaluateRunningPelvicDrop(frontal.contralateralPelvicDropDeg).detail}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="metric-card">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Valgo Izq</span>
                <TrafficBadge level={evaluateRunningKneeValgus(frontal.dynamicKneeValgusLeftDeg).level} />
              </div>
              <p className="mt-1 font-mono text-base font-semibold text-white">
                {frontal.dynamicKneeValgusLeftDeg.toFixed(1)}°
              </p>
            </div>
            <div className="metric-card">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Valgo Der</span>
                <TrafficBadge level={evaluateRunningKneeValgus(frontal.dynamicKneeValgusRightDeg).level} />
              </div>
              <p className="mt-1 font-mono text-base font-semibold text-white">
                {frontal.dynamicKneeValgusRightDeg.toFixed(1)}°
              </p>
            </div>
          </div>

          <div className="metric-card">
            <div className="flex items-start justify-between gap-2">
              <span className="text-xs text-slate-400">Ancho de paso y cruzamiento</span>
              <TrafficBadge level={evaluateRunningStepWidth(frontal.stepWidthRatio, frontal.crossoverDetected).level} />
            </div>
            <p className="mt-1 text-xs text-slate-300">
              {evaluateRunningStepWidth(frontal.stepWidthRatio, frontal.crossoverDetected).detail}
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
