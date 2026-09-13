'use client';

import { Activity } from 'lucide-react';

/**
 * Esquema SVG de un corredor en fase de apoyo medio sobre cinta,
 * con landmarks de hombro, cadera, rodilla, tobillo, talón y punta.
 */
export function RunningDemoSvg() {
  return (
    <svg viewBox="0 0 760 430" aria-label="Esquema de posición de corredor detectada">
      <title>Esquema de posición de corredor detectada</title>

      {/* Cinta de correr */}
      <g className="treadmill-lines">
        <rect x="100" y="380" width="560" height="30" rx="6" />
        <line x1="130" y1="395" x2="200" y2="395" />
        <line x1="230" y1="395" x2="300" y2="395" />
        <line x1="330" y1="395" x2="400" y2="395" />
        <line x1="430" y1="395" x2="500" y2="395" />
        <line x1="530" y1="395" x2="600" y2="395" />
      </g>

      {/* Corredor - segmentos corporales */}
      <g className="body-lines">
        {/* Cabeza */}
        <circle cx="370" cy="65" r="26" />
        {/* Tronco: hombro → cadera */}
        <path d="M365 93 L350 200" />
        {/* Pierna de apoyo: cadera → rodilla → tobillo → talón → punta */}
        <path d="M350 200 L370 295 L355 370 L340 375 L370 378" />
        {/* Pierna de balanceo */}
        <path d="M350 200 L300 280 L285 330" />
        {/* Brazos */}
        <path d="M365 130 L320 190" />
        <path d="M365 130 L410 195" />
      </g>

      {/* Articulaciones (landmarks) */}
      {[
        [365, 130],  // hombro
        [350, 200],  // cadera
        [370, 295],  // rodilla
        [355, 370],  // tobillo
        [340, 375],  // talón
        [370, 378],  // punta
      ].map(([cx, cy]) => (
        <circle key={`${cx}-${cy}`} className="joint" cx={cx} cy={cy} r="7" />
      ))}

      {/* Arco de ángulo FSA */}
      <path className="angle-arc" d="M347 358 A25 25 0 0 0 372 362" />
      <text className="angle-text" x="380" y="358">2.9°</text>

      {/* Cadencia */}
      <text className="angle-text" x="480" y="80" style={{ fontSize: 16 }}>171.4 SPM</text>
    </svg>
  );
}
