# Metodología de evaluación

**Evi Miento · Evidencia en movimiento**  
Documento técnico — versión 3.0

## 1. Alcance

Evi Miento calcula cinemática 2D markerless a partir de MediaPipe Pose en dos
planos desacoplados:

- **Running**: ciclos de zancada, cadencia, ángulo de contacto, índice de
  sobrezancada, flexión de rodilla, inclinación del tronco y proyecciones
  frontales.
- **Bike**: flexión dinámica de rodilla en BDC, ángulo mínimo de cadera,
  inclinación del tronco, tracking frontal y balanceo pélvico.

El producto es una herramienta de observación y experimentación deportiva. No
diagnostica lesiones, no define una postura correcta universal y no sustituye
una evaluación profesional.

## 2. Captura recomendada

Estas condiciones reducen ruido y paralaje, pero no constituyen una validación
de error angular por sí mismas:

- 30 fps como mínimo; 60 fps es preferible para running.
- Obturación manual cercana o superior a 1/500 s cuando sea posible.
- Resolución 1080p o superior, foco y exposición bloqueados.
- Cámara lateral ortogonal para el plano sagital y frontal/posterior centrada
  para el plano coronal.
- Trípode estable, fondo contrastante, ropa ajustada y cuerpo completo visible.
- Repetir la toma si hay oclusiones, movimiento de cámara o salida frecuente del
  encuadre.

La cámara frontal y la lateral son mediciones complementarias; no se fusionan
como si fueran una reconstrucción 3D.

## 3. Definición de variables

### 3.1. Bike

1. **Flexión de rodilla BDC**: `180° - ángulo incluido hip–knee–ankle` en el
   cuadro de máxima extensión observada.
2. **Ángulo mínimo de cadera**: mínimo del ángulo shoulder–hip–knee durante el
   segmento capturado.
3. **Torso**: ángulo shoulder–hip respecto de la horizontal.
4. **Tracking**: desviación horizontal de la rodilla respecto de la línea
   cadera–tobillo, escalada con un ancho pélvico asumido de 260 mm. Si se
   necesita una medida lineal válida, hace falta una escala física visible.
5. **Balanceo pélvico**: amplitud pico a pico de la línea bi-ilíaca.

### 3.2. Running

1. **Cadencia**: intervalos entre contactos del mismo lado, convertidos a
   pasos/minuto.
2. **Foot Strike Angle**: ángulo del vector talón–punta respecto de la
   horizontal en el contacto detectado. La etiqueta retropié/mediopié/antepié
   es morfológica y depende de la convención de imagen.
3. **Sobrezancada**: separación anteroposterior tobillo–rodilla normalizada por
   la tibia en el contacto detectado.
4. **Flexión de rodilla y tronco**: lecturas sagitales por fase/ciclo.
5. **Plano frontal**: oblicuidad pélvica, proyección cadera–rodilla–tobillo,
   ancho de paso relativo y posible cruzamiento. La oblicuidad no se etiqueta
   automáticamente como caída contralateral o Trendelenburg.

## 4. Calidad e interpretación

### 4.1. Calidad de señal

| Banda | Condición | Uso |
| --- | --- | --- |
| Alta | confianza ≥ 0.80 y cobertura ≥ 85% | comparación de tendencias |
| Utilizable | confianza ≥ 0.65 y cobertura ≥ 70% | repetir antes de ajustar |
| Insuficiente | por debajo de esos valores | no interpretar la métrica |

La confianza y la cobertura son indicadores del dato. **No se presentan como
±1.5°, ±4° u ±8°**, porque esos márgenes no están validados para este pipeline
markerless, cámara, plano y población.

### 4.2. Matriz de evidencia aplicada

| Variable | Uso admitido en la aplicación | Evidencia |
| --- | --- | --- |
| BDC de rodilla bike | explorar altura dinámica y repetir medición | moderada para medir; limitada para cortes universales |
| Cadencia running | probar cambios graduales individualizados | moderada para efectos mecánicos inmediatos |
| Foot strike | describir y advertir redistribución de cargas | limitada; no prescribe retropié o antepié |
| Valgo, pelvis y ancho de paso | describir tendencias 2D | insuficiente para cortes o diagnóstico |
| Torso bike/running | describir contexto y consistencia | limitada/insuficiente para una ventana fija |
| Feedback visual/auditivo | facilitar un experimento técnico | moderada para algunos cambios de carga; respuesta individual |

La aplicación evita rangos fijos como “cadencia óptima”, “FPPA normal”,
“pelvic drop seguro” o “torso correcto”. Los perfiles de disciplina del
formulario son objetivos operativos configurables, no valores normativos.

## 5. Fantasmas y líneas base

Los fantasmas `ghost_*.json` son casos sintéticos inmutables. Cada lectura se
puede contrastar con una tolerancia de QA para detectar regresiones en fórmulas,
unidades y UI. Una diferencia sólo significa que el algoritmo se apartó de la
fixture.

Las evaluaciones reales se comparan con:

- una **línea base personal**, aceptada por el atleta y repetida bajo un
  protocolo comparable; o
- una **referencia poblacional versionada**, agregada por contexto y publicada
  sólo después de controles de calidad.

Nunca se modifica un fantasma sintético con datos reales. El diseño de base de
datos, versionado y respaldo está en
`docs/ARQUITECTURA_DATOS_Y_FANTASMAS.md`.

## 6. Limitaciones

- La proyección 2D no resuelve rotaciones axiales ni profundidad.
- Los centros articulares markerless no equivalen a marcadores óseos palpados.
- El plano frontal actual usa supuestos de escala para milímetros y no identifica
  de forma específica la fase de apoyo de cada hemipelvis.
- Un valor aislado no establece causalidad, riesgo ni necesidad de corrección.
- La intervención debe cambiar una variable por vez, repetirse y conservarse
  sólo si mejora comodidad, control o rendimiento sin síntomas.

## 7. Validación pendiente

Para convertir una lectura en una medida validada se necesitan, por modalidad,
comparación ciega con 3D/Kinovea, error absoluto medio, ICC, Bland–Altman,
repetibilidad entre sesiones, análisis por subgrupos y validación externa. Hasta
entonces, los fantasmas son pruebas de software y no evidencia clínica.
