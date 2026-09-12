'use client';

import { Bike, Footprints } from 'lucide-react';
import type { SportModality } from '@/lib/types';

interface ModalitySelectorProps {
  onSelect: (modality: SportModality) => void;
}

export function ModalitySelector({ onSelect }: ModalitySelectorProps) {
  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center px-5">
      <p className="mb-2 font-mono text-xs font-semibold uppercase tracking-[0.18em] text-lime-300">
        Seleccioná tu deporte
      </p>
      <h1 className="mb-3 max-w-2xl text-center text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">
        Análisis biomecánico deportivo
      </h1>
      <p className="mb-10 max-w-md text-center text-sm leading-6 text-slate-400">
        Elegí la modalidad para configurar el análisis. El video se procesa localmente en este dispositivo.
      </p>
      <div className="grid w-full max-w-2xl gap-4 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => onSelect('cycling')}
          className="group panel flex flex-col items-center gap-4 p-8 transition-all hover:border-lime-300/30 hover:shadow-[0_0_40px_rgba(190,242,100,.08)]"
        >
          <div className="grid size-16 place-items-center rounded-2xl bg-lime-300 text-[#10160b] shadow-[0_0_24px_rgba(190,242,100,.2)] transition-transform group-hover:scale-110">
            <Bike className="size-8" strokeWidth={2} />
          </div>
          <div className="text-center">
            <p className="text-lg font-semibold text-white">Ciclismo</p>
            <p className="mt-1 text-sm text-slate-400">Bike fitting · Vista lateral</p>
            <p className="mt-3 text-xs leading-5 text-slate-500">
              Flexión de rodilla en BDC, ángulo de cadera, inclinación del torso.
              Recomendación de ajuste de sillín en pasos de 3 mm.
            </p>
          </div>
        </button>
        <button
          type="button"
          onClick={() => onSelect('running')}
          className="group panel flex flex-col items-center gap-4 p-8 transition-all hover:border-lime-300/30 hover:shadow-[0_0_40px_rgba(190,242,100,.08)]"
        >
          <div className="grid size-16 place-items-center rounded-2xl bg-lime-300 text-[#10160b] shadow-[0_0_24px_rgba(190,242,100,.2)] transition-transform group-hover:scale-110">
            <Footprints className="size-8" strokeWidth={2} />
          </div>
          <div className="text-center">
            <p className="text-lg font-semibold text-white">Carrera</p>
            <p className="mt-1 text-sm text-slate-400">Análisis de la marcha · Vista lateral</p>
            <p className="mt-3 text-xs leading-5 text-slate-500">
              Cadencia, patrón de contacto, sobrezancada, flexión de rodilla,
              inclinación del tronco. Recomendaciones de técnica deportiva.
            </p>
          </div>
        </button>
      </div>
    </div>
  );
}
