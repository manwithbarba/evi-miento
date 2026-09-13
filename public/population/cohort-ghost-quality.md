# Auditoría de fantasmas poblacionales

Procesado: 2026-09-13. Los archivos fuente se descargan fuera del repositorio y no se publican; sólo se versionan agregados compactos y trazabilidad.

## Running · RBDS

- Fuente: [Figshare](https://doi.org/10.6084/m9.figshare.4543435), salida `RBDSxxxprocessed.txt`.
- Archivos auditados: 39.
- Participantes observados / con al menos una velocidad válida: 39 / 39.
- Exclusiones de archivo: 0; exclusiones de estrato por velocidad: 16 (8 participantes no tienen 2,5 ni 4,5 m/s en la salida pública; 3,5 m/s sí está disponible).
- n efectivo por velocidad: 2,5 m/s = 31; 3,5 m/s = 39; 4,5 m/s = 31.
- Normalización: ángulos en grados, 101 puntos exactos de fase 0–100%, mediana bilateral por participante.
- Las curvas se publican por 2,5, 3,5 y 4,5 m/s; no se mezclan velocidades dentro de una curva.

## Bike · Mendeley Data

- Fuente: [Mendeley Data](https://data.mendeley.com/datasets/tvnwnzy8vm/1), `Dataset setback SR.xlsx`.
- Filas de condiciones procesadas: 192.
- Participantes observados / efectivos: 32 / 32.
- El artículo informa n=34, pero la planilla pública contiene 32 identificadores completos; esa brecha queda visible y evita presentar n=34 como n efectivo.
- Exclusiones por calidad: 0.
- Normalización: ángulos en grados, desplazamientos de cm a mm y cadencia en rpm; mediana de las 6 condiciones antes de calcular cuantiles de cohorte.
- No se inventa una fase 0–100%: la planilla publica estadísticos por condición y posiciones de manivela.

## Alcance

Los dos archivos `cohort-ghost` quedan publicados como candidatos exploratorios y no alimentan recomendaciones automáticas. El índice conserva además fuentes abiertas enlazadas para futuras ampliaciones, pero no las presenta como procesadas.
