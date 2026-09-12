# Metodología de Evaluación Cinemática y Protocolo de Adquisición

**Plataforma Movimiento · Laboratorio de Biomecánica Deportiva**  
*Documento Técnico Metodológico — Versión 2.0*

---

## 1. Introducción y Marco Teórico

El análisis biomecánico del movimiento humano mediante videogrametría bidimensional (2D) representa una alternativa validada, reproducible y de bajo costo frente a los sistemas optoelectrónicos tridimensionales (3D) de laboratorio (e.g., Vicon, Qualisys). No obstante, la validez interna de las mediciones angulares y lineales derivadas de modelos computacionales de estimación postural sin marcadores (*markerless motion capture*) depende estrictamente de la estandarización del protocolo de adquisición de imagen y del control de fuentes de error sistemático.

La plataforma **Movimiento** implementa un modelo cinemático biplanar desacoplado (Fase A) que aborda simultáneamente:
1. El **plano sagital (lateral)** para cuantificar la flexión/extensión articular, cadencia, ángulo de contacto e inclinación segmentaria.
2. El **plano frontal/posterior (coronal)** para cuantificar la estabilidad lumbopélvica, el valgo dinámico de rodilla y la trayectoria de los miembros en el eje transversal.

---

## 2. Protocolo Estandarizado de Captura de Video

Para minimizar los artefactos derivados de la distorsión geométrica de lente y el error de paralaje, se establece el siguiente protocolo de adquisición:

### 2.1. Especificaciones del Sensor Óptico
- **Frecuencia de cuadro (*Framerate*)**: Mínimo 30 fps para ciclismo; recomendado 60 fps (mínimo estricto 30 fps) para carrera a pie, debido a la brevedad temporal de la fase de amortiguación (150–250 ms).
- **Velocidad de obturación (*Shutter Speed*)**: Preferentemente manual $\ge 1/500\text{ s}$ para suprimir el desenfoque por movimiento (*motion blur*) en segmentos distales (tobillo y pie).
- **Resolución espacial**: Mínimo 1080p (1920 × 1080 píxeles).
- **Foco y exposición**: Foco bloqueado sobre el sujeto; evitar filtros de suavizado o distorsión gran angular (desactivar modos "ultra-wide" o de ojo de pez).

### 2.2. Disposición Espacial y Calibración Geométrica

#### A. Cámara 1 · Plano Sagital (Vista Lateral)
- **Orientación**: Eje óptico rigurosamente ortogonal (90°) respecto a la línea de avance o plano del cuadro de la bicicleta / cinta de correr.
- **Altura del trípode**: Alineada con el centro de masa anatómico estimado o trocánter mayor (~0.90 m a 1.10 m sobre el nivel del suelo).
- **Distancia al sujeto**: 2.50 m a 3.50 m. A mayor distancia focal y retroceso de la cámara, se reduce la distorsión angular de perspectiva en los bordes del encuadre.
- **Encuadre**: El sujeto debe ocupar entre el 60% y el 80% de la altura del fotograma, con visibilidad completa de cabeza a pies a lo largo de todo el ciclo de movimiento.

#### B. Cámara 2 · Plano Frontal / Posterior (Vista Coronal)
- **Orientación**: Eje óptico colineal (0° o 180°) con la línea media de desplazamiento del atleta (frente al atleta o inmediatamente detrás de la cinta/rodillo).
- **Altura del trípode**: Nivel medio de la pelvis (~0.90 m a 1.05 m).
- **Distancia al sujeto**: 2.20 m a 3.00 m, asegurando encuadre simétrico de ambos miembros inferiores y cintura escapular.

### 2.3. Preparación del Atleta y Entorno
- **Vestimenta**: Ropa deportiva técnica ajustada al cuerpo, de tonalidad contrastante con el fondo, para evitar que pliegues holgados falseen la estimación de los centros articulares.
- **Calzado**: Calzado habitual de entrenamiento debidamente atado.
- **Iluminación**: Fuente de luz difusa frontal o cenital ($\ge 500\text{ lux}$) que minimice sombras proyectadas sobre el piso o la cinta.

---

## 3. Definición Físico-Matemática de Variables Cinemáticas

### 3.1. Ciclismo (*Bike Fitting*)

1. **Flexión de Rodilla en el Punto Muerto Inferior (BDC - Bottom Dead Centre)**:
   $$\theta_{\text{knee\_flex}} = 180^\circ - \arccos\left(\frac{\vec{u} \cdot \vec{v}}{\|\vec{u}\| \|\vec{v}\|}\right)$$
   Donde $\vec{u} = \mathbf{P}_{\text{hip}} - \mathbf{P}_{\text{knee}}$ y $\vec{v} = \mathbf{P}_{\text{ankle}} - \mathbf{P}_{\text{knee}}$.
   El BDC se identifica dinámicamente como el cuadro del ciclo de pedaleo donde el ángulo incluido de la rodilla alcanza su valor máximo (máxima extensión de la pierna).

2. **Ángulo Mínimo de Cadera**:
   Mínimo ángulo relativo entre el vector fémur ($\mathbf{P}_{\text{knee}} - \mathbf{P}_{\text{hip}}$) y el vector tronco ($\mathbf{P}_{\text{shoulder}} - \mathbf{P}_{\text{hip}}$) en la fase de potencia superior (TDC).

3. **Inclinación del Torso respecto a la Horizontal**:
   $$\theta_{\text{torso}} = \arctan\left(\frac{|\Delta y|}{|\Delta x|}\right) \times \frac{180^\circ}{\pi}$$
   Calculado entre el hombro y el trocánter mayor (cadera).

4. **Knee Tracking (Excursión Mediolateral de Rodilla en Plano Frontal)**:
   Desviación horizontal de la rodilla respecto a la línea plomada virtual trazada entre cadera y tobillo a lo largo de un ciclo completo de pedaleo:
   $$d_{\text{dev}}(t) = |x_{\text{knee}}(t) - x_{\text{plumb}}(t)| \times \text{Escala}_{\text{mm/px}}$$

5. **Balanceo Pélvico Coronal (*Pelvic Rocking*)**:
   Amplitud angular pico a pico ($\theta_{\max} - \theta_{\min}$) de la línea bi-ilíaca ($\mathbf{P}_{\text{hip\_left}} \leftrightarrow \mathbf{P}_{\text{hip\_right}}$) respecto a la horizontal.

---

### 3.2. Carrera a Pie (*Running Gait Analysis*)

1. **Cadencia de Paso (SPM - Steps Per Minute)**:
   Calculada a partir de los intervalos de tiempo inter-contacto de la misma extremidad ($T_{\text{stride}}$):
   $$\text{SPM} = \text{Mediana}\left(\frac{60}{T_{\text{stride}}}\right) \times 2$$

2. **Ángulo de Contacto del Pie (*Foot Strike Angle* - FSA)**:
   Ángulo sagital del vector talón-antepié ($\mathbf{P}_{\text{toe}} - \mathbf{P}_{\text{heel}}$) respecto al plano horizontal en el fotograma exacto del contacto inicial (IC):
   $$\text{FSA} = \arctan\left(\frac{y_{\text{toe}} - y_{\text{heel}}}{x_{\text{toe}} - x_{\text{heel}}}\right) \times \frac{180^\circ}{\pi}$$
   - **Retropié (*Rearfoot*)**: $\text{FSA} > +8.0^\circ$
   - **Mediopié (*Midfoot*)**: $-8.0^\circ \le \text{FSA} \le +8.0^\circ$
   - **Antepié (*Forefoot*)**: $\text{FSA} < -8.0^\circ$

3. **Índice de Sobrezancada (*Overstriding Index*)**:
   Distancia horizontal proyectada entre el tobillo y la rodilla en el instante de contacto inicial, normalizada por la longitud del segmento tibial:
   $$I_{\text{overstride}} = \frac{x_{\text{ankle}} - x_{\text{knee}}}{\|\mathbf{P}_{\text{knee}} - \mathbf{P}_{\text{ankle}}\|}$$

4. **Caída Pélvica Contralateral (*Dynamic Trendelenburg*)**:
   Descenso angular de la hemipelvis contralateral respecto a la horizontal en la fase de apoyo monopodal medio (*midstance*):
   $$\theta_{\text{drop}} = \arctan\left(\frac{|y_{\text{hip\_right}} - y_{\text{hip\_left}}|}{|x_{\text{hip\_right}} - x_{\text{hip\_left}}|}\right) \times \frac{180^\circ}{\pi}$$

5. **Ángulo de Proyección en Plano Frontal (FPPA / Valgo Dinámico)**:
   Desviación angular respecto a los 180° de alineación recta cadera-rodilla-tobillo en el plano coronal:
   $$\text{FPPA} = 180^\circ - \theta_{\text{frontal\_knee}}$$

6. **Ancho de Base de Sustentación (*Step Width Ratio*) y Cruzamiento**:
   Distancia transversal intermaleolar dividida por el ancho pélvico bi-ilíaco. Se cataloga como *Crossover Gait* si la línea de trayectoria de un pie cruza el eje medio sagital del cuerpo.

---

## 4. Matriz de Semaforización y Rangos Normativos

La semaforización de **Movimiento** desacopla de forma estricta la calidad de la señal del comportamiento fisiológico.

### 4.1. Semáforo Metrológico (Incertidumbre Instrumental)

| Nivel | Condición Probabilística | Cobertura Temporal | Incertidumbre Angular ($\pm$) | Acción del Sistema |
| :--- | :--- | :--- | :--- | :--- |
| **Verde** | Confianza media $C \ge 0.80$ | Cobertura $\ge 85\%$ | $\pm 1.5^\circ$ | Emisión normal de métricas y pautas. |
| **Amarillo** | $0.65 \le C < 0.80$ | $70\% \le \text{Cob} < 85\%$ | $\pm 4.0^\circ$ | Pautas con advertencia de margen de error. |
| **Rojo** | $C < 0.65$ | $\text{Cob} < 70\%$ | $\pm 8.0^\circ$ (o no calculable) | **Bloqueo preventivo**; no se emiten recomendaciones. |

### 4.2. Semáforo Biomecánico y Pautas Deportivas

| Variable | Óptimo (Verde) | Atención (Amarillo) | Revisión Prioritaria (Rojo) | Justificación Mecánica |
| :--- | :--- | :--- | :--- | :--- |
| **Flexión Rodilla BDC** (Ciclismo) | $25.0^\circ\text{–}35.0^\circ$ | $20.0^\circ\text{–}24.9^\circ$ / $35.1^\circ\text{–}40.0^\circ$ | $< 20.0^\circ$ / $> 40.0^\circ$ | Consenso Holmes/Pruitt. Evita hiperflexión patelar o hiperextensión isquiotibial. |
| **Knee Tracking** (Ciclismo) | $\le 15.0\text{ mm}$ | $15.1\text{–}25.0\text{ mm}$ | $> 25.0\text{ mm}$ | Trayectoria patelar en el plano sagital; previene fricción femororrotuliana. |
| **Pelvic Rocking** (Ciclismo) | $\le 2.5^\circ$ | $2.6^\circ\text{–}4.5^\circ$ | $> 4.5^\circ$ | Marcador de sillín excesivamente alto o inestabilidad central. |
| **Cadencia de Paso** (Carrera) | $165\text{–}190\text{ SPM}$ | $155\text{–}164$ / $191\text{–}205\text{ SPM}$ | $< 155\text{ SPM}$ / $> 205\text{ SPM}$ | Cadencias bajas incrementan la fuerza de reacción vertical y el frenado. |
| **Caída Pélvica** (Carrera) | $\le 4.0^\circ$ | $4.1^\circ\text{–}6.5^\circ$ | $> 6.5^\circ$ | Debilidad de abductores de cadera (glúteo medio); sobrecarga en cintilla iliotibial. |
| **Valgo Dinámico (FPPA)** (Carrera) | $\le 5.0^\circ$ | $5.1^\circ\text{–}10.0^\circ$ | $> 10.0^\circ$ | Incremento del estrés de contacto en carilla lateral rotuliana. |
| **Sobrezancada** (Carrera) | $\le 0.10$ | $0.11\text{–}0.18$ | $> 0.18$ | Aterrizaje del pie por delante del centro de masa con pico de frenado. |

---

## 5. Análisis Crítico y Límites Metodológicos

1. **Compresión Proyectiva 2D**: El análisis asume que los movimientos articulares son estrictamente coplanares con el plano de la cámara. Cualquier rotación axial no controlada (e.g., torsión tibial en carrera) genera proyecciones aparentes que pueden sobrestimar o subestimar los ángulos reales.
2. **Estimación sin Marcadores Óseos**: MediaPipe Pose estima centros articulares funcionales a partir del contorno y textura visual. No reemplaza la palpación anatómica de prominencias óseas (e.g., epicóndilo lateral, maléolo externo) en patología compleja.
3. **Poder Predictivo No Patológico**: Una clasificación en zona "amarilla" o "roja" describe una **desviación cinemática estadística respecto a la media poblacional atlética**, no un diagnóstico lesional. Todo cambio de técnica o altura de sillín debe ser contrastado con el confort individual y la presencia de sintomatología.
