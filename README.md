# Evi Miento · Evidencia en movimiento

Plataforma web de observación biomecánica para **Ciclismo (*Bike Fitting*)** y **Carrera a Pie (*Running Gait Analysis*)**. Diseñada bajo una arquitectura biplanar desacoplada (Fase A) con procesamiento neuronal 100% en el borde del cliente mediante MediaPipe Pose Full, calidad de señal explícita, fantasmas de calibración y recomendaciones conservadoras trazables.

> **Aviso Metodológico**: Herramienta de apoyo técnico deportivo. No constituye un producto sanitario ni sustituye el diagnóstico clínico o la evaluación presencial de un profesional de la salud o biomecánico certificado.

---

## 1. Características Principales

- **Multideporte Especializado**:
  - **Ciclismo**: Flexión de rodilla en BDC (cuadro de máxima extensión), ángulo mínimo de cadera, inclinación de torso, desviación mediolateral de rodilla (*Knee Tracking*) y balanceo pélvico en el sillín (*Pelvic Rocking*).
  - **Carrera a Pie**: Detección temporal de ciclos de zancada (IC, MS, TO), cadencia (SPM), ángulo de contacto podálico (*Foot Strike Angle*), clasificación morfológica (retropié, mediopié, antepié), índice de sobrezancada, flexión articular, oblicuidad pélvica proyectada, proyección frontal de rodilla (FPPA) y base de sustentación (*Crossover Gait*).
- **Arquitectura Biplanar Desacoplada (Fase A)**:
  - Soporte para **Cámara 1 (Plano Sagital / Lateral)** y **Cámara 2 (Plano Frontal o Posterior)** sin requerir sincronización electrónica rígida por cable (*genlock*) ni calibración con tablero de ajedrez.
- **Interpretación explícita (WCAG 2.1 AA)**:
  - **Calidad de señal**: Combina confianza y cobertura temporal. No se presenta como margen de error angular porque ese error no está validado para este pipeline.
  - **Fantasma de calibración**: Compara las lecturas con fixtures sintéticos inmutables para detectar regresiones del algoritmo; no clasifica riesgo ni postura ideal.
- **Privacidad y Procesamiento Local**:
  - El video se procesa en el navegador del usuario utilizando WebAssembly y WebGL/WebGPU. Ningún fotograma o flujo de video se transmite a servidores externos.
- **Trazabilidad y Exportación**:
  - Persistencia de líneas base en `localStorage` y descarga de informes estructurados en formato JSON (esquema versión 3).

---

## 2. Pila Tecnológica

- **Framework**: React 19 + Vinext 1.0 (Next.js sobre Vite 8) + TypeScript 5.9.
- **Inferencia Postural**: `@mediapipe/tasks-vision` (modelo neuronal `pose_landmarker_full.task`).
- **Estilos y UI**: Tailwind CSS 4, componentes modulares accesibles tipo Shadcn / Base UI y Lucide Icons.
- **Testing y Linter**: Vitest 5 (69 pruebas automatizadas) y Oxlint.
- **Contenerización**: Docker (multi-stage build sobre Alpine Linux) y Docker Compose.

---

## 3. Guía de Ejecución Rápida en Local

### 3.1. Requisitos Previos
- Node.js versión `>= 22.13.0`
- Gestor de paquetes `npm`

### 3.2. Instalación y Ejecución con Node
```bash
# 1. Clonar el repositorio y acceder al directorio
git clone https://github.com/manwithbarba/evi-miento.git
cd evi-miento

# 2. Instalar dependencias
npm install

# 3. Iniciar servidor de desarrollo
npm run dev
```
La aplicación estará disponible en [http://localhost:3000](http://localhost:3000).

### 3.3. Verificación Automatizada y Casos Sintéticos
```bash
# Ejecutar suite de pruebas unitarias (69 tests)
npm test

# Ejecutar análisis estático (oxlint)
npm run lint

# Ejecutar evaluación cinemática CLI sobre los casos sintéticos (biker y runner)
npm run eval:synthetic

# Compilar para producción
npm run build
```

---

## 4. Ejecución Contenerizada con Docker

El proyecto incluye un `Dockerfile` multi-etapa optimizado y un archivo `docker-compose.yml`.

### 4.1. Despliegue con Docker Compose
Asegúrese de que el motor de Docker (Docker Desktop) se encuentre en ejecución y ejecute:

```bash
docker compose up --build
```

La aplicación compilará los artefactos estáticos, verificará los tests y levantará el servidor en [http://localhost:3000](http://localhost:3000).

Para detener el contenedor:
```bash
docker compose down
```

---

## 5. Casos Sintéticos y Fantasmas de Calibración

Para validar el comportamiento del sistema sin requerir grabaciones reales inmediatas, se generaron cuatro conjuntos sintéticos y sus copias etiquetadas como fantasmas en `public/samples/`:
1. `synthetic_biker_sagittal.json`: 60 cuadros de pedaleo lateral a 87 RPM con salida estable de calibración.
2. `synthetic_biker_frontal.json`: 60 cuadros con tracking y oscilación pélvica reproducibles.
3. `synthetic_runner_sagittal.json`: 90 cuadros a 30 fps modelando zancada a 171.4 SPM con impacto de mediopié y flexión amortiguadora en IC.
4. `synthetic_runner_frontal.json`: 60 cuadros con oblicuidad pélvica proyectada y proyección frontal de rodilla.
5. `ghost_biker_sagittal.json` y `ghost_biker_frontal.json`: fixture bike inmutable para regresión biplanar.
6. `ghost_runner_sagittal.json` y `ghost_runner_frontal.json`: fixture running inmutable para regresión biplanar.

Puede procesar estos conjuntos en consola en cualquier momento ejecutando:
```bash
npm run eval:synthetic
```

---

---

## 6. Evidencia, datos y documentación

- [Laboratorio público de fantasmas](https://manwithbarba.github.io/evi-miento/ghost/): prueba estática de los fixtures sintéticos y del manifiesto de fuentes abiertas.
- [Protocolo y Metodología de Evaluación Cinemática](docs/METODOLOGIA_EVALUACION.md): captura, métricas, límites y política de interpretación.
- [Referencias Bibliográficas y Evidencia Científica](docs/REFERENCIAS_BIBLIOGRAFICAS.md): revisiones sistemáticas y metaanálisis recuperados.
- [Arquitectura de Datos y Fantasmas](docs/ARQUITECTURA_DATOS_Y_FANTASMAS.md): separación entre fixtures sintéticos, líneas base personales y referencias poblacionales versionadas.

---

## 7. Licencia

Distribuido bajo licencia MIT. El modelo y runtime de MediaPipe Pose se distribuyen bajo licencia Apache 2.0.
