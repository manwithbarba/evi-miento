# Movimiento · Plataforma de Análisis Biomecánico Deportivo

Plataforma web de evaluación biomecánica y optimización técnica para **Ciclismo (*Bike Fitting*)** y **Carrera a Pie (*Running Gait Analysis*)**. Diseñada bajo una arquitectura biplanar desacoplada (Fase A) con procesamiento neuronal 100% en el borde del cliente (*edge computing* en navegador) mediante MediaPipe Pose Full, sistema de semaforización dual (metrológico y biomecánico) y recomendaciones conservadoras trazables.

> **Aviso Metodológico**: Herramienta de apoyo técnico deportivo. No constituye un producto sanitario ni sustituye el diagnóstico clínico o la evaluación presencial de un profesional de la salud o biomecánico certificado.

---

## 1. Características Principales

- **Multideporte Especializado**:
  - **Ciclismo**: Flexión de rodilla en BDC (cuadro de máxima extensión), ángulo mínimo de cadera, inclinación de torso, desviación mediolateral de rodilla (*Knee Tracking*) y balanceo pélvico en el sillín (*Pelvic Rocking*).
  - **Carrera a Pie**: Detección temporal de ciclos de zancada (IC, MS, TO), cadencia (SPM), ángulo de contacto podálico (*Foot Strike Angle*), clasificación morfológica (retropié, mediopié, antepié), índice de sobrezancada, flexión articular, caída pélvica contralateral (*Trendelenburg dinámico*), valgo dinámico de rodilla (FPPA) y base de sustentación (*Crossover Gait*).
- **Arquitectura Biplanar Desacoplada (Fase A)**:
  - Soporte para **Cámara 1 (Plano Sagital / Lateral)** y **Cámara 2 (Plano Frontal o Posterior)** sin requerir sincronización electrónica rígida por cable (*genlock*) ni calibración con tablero de ajedrez.
- **Sistema de Semaforización Dual (WCAG 2.1 AA)**:
  - **Semáforo Metrológico**: Evalúa la certeza probabilística y cobertura temporal del sensor visual, cuantificando la incertidumbre instrumental ($\pm 1.5^\circ$ en verde, $\pm 4.0^\circ$ en amarillo, bloqueo preventivo en rojo si la confianza es $< 65\%$).
  - **Semáforo Biomecánico**: Clasificación funcional (Verde/Óptimo, Amarillo/Atención, Rojo/Revisión) con insignias accesibles mediante íconos semánticos (`CheckCircle2`, `AlertTriangle`, `AlertOctagon`).
- **Privacidad y Procesamiento Local**:
  - El video se procesa en el navegador del usuario utilizando WebAssembly y WebGL/WebGPU. Ningún fotograma o flujo de video se transmite a servidores externos.
- **Trazabilidad y Exportación**:
  - Persistencia de líneas base en `localStorage` y descarga de informes estructurados en formato JSON (esquema versión 3).

---

## 2. Pila Tecnológica

- **Framework**: React 19 + Vinext 1.0 (Next.js sobre Vite 8) + TypeScript 5.9.
- **Inferencia Postural**: `@mediapipe/tasks-vision` (modelo neuronal `pose_landmarker_full.task`).
- **Estilos y UI**: Tailwind CSS 4, componentes modulares accesibles tipo Shadcn / Base UI y Lucide Icons.
- **Testing y Linter**: Vitest 5 (74 pruebas automatizadas) y Oxlint.
- **Contenerización**: Docker (multi-stage build sobre Alpine Linux) y Docker Compose.

---

## 3. Guía de Ejecución Rápida en Local

### 3.1. Requisitos Previos
- Node.js versión `>= 22.13.0`
- Gestor de paquetes `npm`

### 3.2. Instalación y Ejecución con Node
```bash
# 1. Clonar el repositorio y acceder al directorio
git clone https://github.com/manwithbarba/movimiento.git
cd movimiento/bikefit-lab

# 2. Instalar dependencias
npm install

# 3. Iniciar servidor de desarrollo
npm run dev
```
La aplicación estará disponible en [http://localhost:3000](http://localhost:3000).

### 3.3. Verificación Automatizada y Casos Sintéticos
```bash
# Ejecutar suite de pruebas unitarias (74 tests)
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

## 5. Casos Sintéticos de Prueba Reproducibles

Para validar el comportamiento del sistema sin requerir grabaciones reales inmediatas, se generaron cuatro conjuntos de datos cinemáticos sintéticos en `public/samples/`:
1. `synthetic_biker_sagittal.json`: 60 cuadros de pedaleo lateral a 87 RPM con flexión BDC en rango funcional.
2. `synthetic_biker_frontal.json`: 60 cuadros con tracking patelar lineal (< 15 mm) y oscilación pélvica.
3. `synthetic_runner_sagittal.json`: 90 cuadros a 30 fps modelando zancada a 171.4 SPM con impacto de mediopié y flexión amortiguadora en IC.
4. `synthetic_runner_frontal.json`: 60 cuadros con caída pélvica contralateral y control de valgo dinámico.

Puede procesar estos conjuntos en consola en cualquier momento ejecutando:
```bash
npm run eval:synthetic
```

---

## 6. Publicación del Proyecto en GitHub

Si desea subir el proyecto a su cuenta de GitHub (`manwithbarba`), siga los siguientes pasos:

```bash
# 1. Verificar el estado del repositorio local
git status

# 2. Añadir y registrar los cambios en un commit inicial
git add .
git commit -m "feat: plataforma Movimiento v2.0 - soporte biplanar, semaforización, docker y casos sintéticos"

# 3. Crear el repositorio en GitHub utilizando GitHub CLI (autenticado)
gh repo create movimiento --public --source=. --remote=origin --push

# (Alternativa manual si prefiere crear el repo desde la web de GitHub):
# git remote add origin https://github.com/manwithbarba/movimiento.git
# git branch -M main
# git push -u origin main
```

---

## 7. Documentación Metodológica y Científica

- [Protocolo y Metodología de Evaluación Cinemática](docs/METODOLOGIA_EVALUACION.md): Especificaciones de ángulo de cámara, distancias, definiciones matemáticas y matriz de semaforización.
- [Referencias Bibliográficas y Evidencia Científica](docs/REFERENCIAS_BIBLIOGRAFICAS.md): Más de 20 estudios indexados (PubMed/Scopus) en formato APA (7.ª edición).

---

## 8. Licencia

Distribuido bajo licencia MIT. El modelo y runtime de MediaPipe Pose se distribuyen bajo licencia Apache 2.0.
