# VeloFit Lab

Prototipo web de bike fitting asistido por video. Analiza una vista lateral con MediaPipe Pose, calcula ángulos 2D, estima el cuadro de máxima extensión de rodilla y genera una recomendación conservadora y trazable.

> Estado: MVP técnico. No está validado como dispositivo médico ni reemplaza la evaluación de un bike fitter o profesional de salud.

## Alcance del MVP

- Video local MP4/MOV/WebM; el archivo no se sube al servidor.
- Detección de 33 puntos corporales con `@mediapipe/tasks-vision`.
- Selección del lado visible y descarte de puntos con baja visibilidad.
- Flexión de rodilla en el cuadro de máxima extensión, ángulo mínimo de cadera e inclinación mediana del torso.
- Objetivo de rodilla configurable; los demás rangos son referencias prácticas del perfil elegido.
- Cambio sugerido máximo de 3 mm, seguido siempre por una nueva medición.
- Línea de base guardada en `localStorage` e informe JSON descargable sin incluir el video.
- Modo demostración para validar el flujo sin archivos externos.

## Arquitectura

```text
Video local
  → muestreo temporal (máx. 20 s / 72 cuadros)
  → MediaPipe Pose Landmarker (en el navegador)
  → filtro de visibilidad
  → geometría 2D y resumen temporal
  → regla conservadora de decisión
  → línea de base local / informe JSON
```

La interfaz usa React, TypeScript, Vinext, Tailwind, los componentes accesibles del starter Shadcn/Base UI y Lucide. MediaPipe Tasks Vision se distribuye bajo Apache 2.0. El modelo y el runtime se descargan desde los orígenes oficiales/CDN al iniciar el análisis; los cuadros se procesan localmente.

## Ejecutar y verificar

Requiere Node.js 22.13 o posterior.

```bash
npm install
npm run dev
npm test
npm run lint
npm run build
```

`npm test` valida la geometría, estadística básica, clasificación contra objetivos y el límite de 3 mm en las recomendaciones.

## Protocolo de validación propuesto

### 1. Verificación de software

- Vectores sintéticos con ángulos 0°, 30°, 90°, 150° y 180°; error aceptable menor a 0,1°.
- Casos sin longitud, puntos ausentes y visibilidad baja deben rechazarse sin emitir una recomendación.
- Pruebas de frontera para cada objetivo configurado.
- El informe debe reproducir exactamente la sesión visible y nunca incluir bytes o rutas del video.

### 2. Validez concurrente

Preparar un conjunto mínimo de 30 videos de al menos 10 ciclistas, con variedad de talla, indumentaria, lado, iluminación y tipo de bicicleta. Registrar simultáneamente una referencia:

1. Preferida: cinemática 3D con marcadores.
2. Alternativa de campo: dos evaluadores cegados en Kinovea, con protocolo y definiciones articulares idénticos.

Comparar la flexión de rodilla en BDC, el ángulo mínimo de cadera y la inclinación del torso. Informar MAE, RMSE, sesgo medio e intervalos de acuerdo de Bland–Altman. No corregir automáticamente el sesgo hasta estimarlo con la población y el montaje objetivo.

Umbrales preliminares para decidir si el MVP avanza (deben pre-registrarse y justificarse): MAE de rodilla ≤3°, cobertura de cuadros válidos ≥80% y ningún error silencioso con confianza global <65%.

### 3. Repetibilidad

- Repetir cada montaje tres veces en el mismo día y una vez en otro día.
- Mantener potencia, cadencia, cámara, distancia y altura constantes.
- Informar ICC, error estándar de medición y cambio mínimo detectable.
- Analizar por separado cambio de cámara, indumentaria oscura, oclusión y lado izquierdo/derecho.

### 4. Validación de decisión y seguridad

- Un bike fitter define, sin ver la recomendación del sistema, si subir, conservar o bajar el sillín.
- Medir acuerdo por clase y documentar los desacuerdos; la concordancia angular no garantiza una recomendación correcta.
- Verificar que ninguna salida proponga más de 3 mm por iteración.
- Dolor, adormecimiento, lesión previa, asimetría marcada o baja confianza deben derivar a revisión profesional.
- Evaluar también estabilidad pélvica, confort y seguimiento después del cambio; un ángulo aislado no define un fitting completo.

### 5. Usabilidad

Observar al menos cinco usuarios realizando el flujo sin ayuda. Registrar errores de lado, cámara, carga y comprensión del informe. Criterios mínimos: 100% completa una demostración, 90% identifica qué cambiar y todos comprenden que la herramienta no diagnostica.

## Fundamento y referencias

- [MediaPipe Pose Landmarker para Web](https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker/web_js)
- [Validez y fiabilidad de métodos cinemáticos usados en bike fitting](https://pubmed.ncbi.nlm.nih.gov/24499342/)
- [Consenso sobre dimensiones y cinemática en el ajuste de bicicletas](https://pubmed.ncbi.nlm.nih.gov/39304615/)

El estudio de validez 2D encontró buena fiabilidad intrasesión, pero también diferencias sistemáticas respecto de 3D. Por eso el producto conserva la confianza, evita presentar los rangos como límites clínicos y exige validar el montaje real antes de usar recomendaciones con personas.
