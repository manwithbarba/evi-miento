'use client';

import { Gauge } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { TargetRange, Side } from '@/lib/types';
import type { CyclingDiscipline, SportModality } from '@/lib/types';

const CYCLING_PROFILES: Record<CyclingDiscipline, {
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

export function getCyclingProfile(discipline: CyclingDiscipline) {
  return CYCLING_PROFILES[discipline];
}

interface SessionConfigProps {
  modality: SportModality;
  // Shared
  side: Side;
  onSideChange: (side: Side) => void;
  notes: string;
  onNotesChange: (notes: string) => void;
  // Cycling
  discipline: CyclingDiscipline;
  onDisciplineChange: (d: CyclingDiscipline) => void;
  inseam: string;
  onInseamChange: (v: string) => void;
  crank: string;
  onCrankChange: (v: string) => void;
  target: TargetRange;
  onTargetChange: (t: TargetRange) => void;
  // Running
  height: string;
  onHeightChange: (v: string) => void;
  cadenceEstimate: string;
  onCadenceEstimateChange: (v: string) => void;
}

export function SessionConfig({
  modality,
  side,
  onSideChange,
  notes,
  onNotesChange,
  discipline,
  onDisciplineChange,
  inseam,
  onInseamChange,
  crank,
  onCrankChange,
  target,
  onTargetChange,
  height,
  onHeightChange,
  cadenceEstimate,
  onCadenceEstimateChange,
}: SessionConfigProps) {
  return (
    <aside className="panel p-5">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <p className="step-label">01 · Preparación</p>
          <h2 className="mt-1 text-lg font-semibold text-white">Datos de referencia</h2>
        </div>
        <Gauge className="size-5 text-slate-500" />
      </div>

      <div className="space-y-4">
        {modality === 'cycling' ? (
          <>
            <div>
              <p className="field-label">Disciplina</p>
              <Select value={discipline} onValueChange={(v) => onDisciplineChange(v as CyclingDiscipline)}>
                <SelectTrigger aria-label="Disciplina" className="mt-2 h-11 w-full border-white/10 bg-white/[.035] px-3 text-slate-100"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CYCLING_PROFILES).map(([value, item]) => (
                    <SelectItem key={value} value={value}>{item.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="field-label" htmlFor="inseam">Entrepierna
                <div className="input-unit"><Input id="inseam" value={inseam} onChange={(e) => onInseamChange(e.target.value)} inputMode="decimal" /><span>cm</span></div>
              </label>
              <label className="field-label" htmlFor="crank">Biela
                <div className="input-unit"><Input id="crank" value={crank} onChange={(e) => onCrankChange(e.target.value)} inputMode="decimal" /><span>mm</span></div>
              </label>
            </div>

            <div>
              <p className="field-label">Objetivo de rodilla · BDC</p>
              <div className="mt-2 grid grid-cols-2 gap-3">
                <label className="input-unit mt-0" htmlFor="target-min"><Input id="target-min" aria-label="Flexión mínima de rodilla" type="number" min="10" max="60" value={target.min} onChange={(e) => onTargetChange({ ...target, min: Number(e.target.value) })} /><span>° mín.</span></label>
                <label className="input-unit mt-0" htmlFor="target-max"><Input id="target-max" aria-label="Flexión máxima de rodilla" type="number" min="10" max="60" value={target.max} onChange={(e) => onTargetChange({ ...target, max: Number(e.target.value) })} /><span>° máx.</span></label>
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-500">Es un objetivo inicial configurable, no un límite clínico.</p>
            </div>
          </>
        ) : (
          <>
            <div>
              <label className="field-label" htmlFor="runner-height">Estatura
                <div className="input-unit"><Input id="runner-height" value={height} onChange={(e) => onHeightChange(e.target.value)} inputMode="decimal" /><span>cm</span></div>
              </label>
            </div>

            <div>
              <label className="field-label" htmlFor="cadence-estimate">Cadencia estimada <span className="text-slate-500">(opcional)</span>
                <div className="input-unit"><Input id="cadence-estimate" value={cadenceEstimate} onChange={(e) => onCadenceEstimateChange(e.target.value)} inputMode="decimal" placeholder="170" /><span>SPM</span></div>
              </label>
            </div>

            <div className="rounded-lg border border-amber-300/15 bg-amber-300/[.04] px-3 py-2">
              <p className="text-xs leading-5 text-amber-200">Superficie: <strong>cinta de correr</strong> (requerida para análisis 2D sagital).</p>
            </div>
          </>
        )}

        {/* Shared fields */}
        <div>
          <p className="field-label">Lado visible</p>
          <Select value={side} onValueChange={(v) => onSideChange(v as Side)}>
            <SelectTrigger aria-label="Lado visible" className="mt-2 h-11 w-full border-white/10 bg-white/[.035] px-3 text-slate-100"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="right">Derecho</SelectItem><SelectItem value="left">Izquierdo</SelectItem></SelectContent>
          </Select>
        </div>

        <label className="field-label" htmlFor="notes">Notas o molestias
          <Input id="notes" value={notes} onChange={(e) => onNotesChange(e.target.value)} placeholder={modality === 'cycling' ? 'Ej.: carga anterior en rodilla' : 'Ej.: molestia en tendón de Aquiles'} className="mt-2 h-11 border-white/10 bg-white/[.035] px-3 text-slate-100" />
        </label>
      </div>

      {/* Capture guidelines */}
      <div className="mt-6 rounded-xl border border-lime-300/10 bg-lime-300/[.04] p-4">
        <p className="text-sm font-medium text-lime-100">Antes de grabar</p>
        <ul className="mt-2 space-y-2 text-sm leading-5 text-slate-400">
          <li>• Cámara fija y perpendicular</li>
          <li>• {modality === 'cycling' ? 'Ciclista' : 'Corredor'} completo en cuadro</li>
          {modality === 'cycling' ? (
            <li>• 10–15 s de pedaleo estable</li>
          ) : (
            <>
              <li>• 15–20 s de carrera estable tras calentamiento</li>
              <li>• ≥60 FPS recomendados (cámara lenta ideal)</li>
            </>
          )}
        </ul>
      </div>
    </aside>
  );
}
