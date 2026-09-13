# Arquitectura de datos y fantasmas

## Decisión

Evi Miento separa el control del algoritmo de la referencia de una persona.

1. **Fantasma sintético**: fixture reproducible, versionado e inmutable. Se usa
   para pruebas de regresión, unidades, tolerancias y presentación.
2. **Línea base personal**: sesiones aceptadas por el atleta para comparar su
   propia variabilidad. No se mezcla automáticamente con otros atletas.
3. **Referencia poblacional**: agregado versionado por contexto. Sólo se publica
   después de controles de calidad y revisión del cambio.

Una evaluación nueva nunca muta un fantasma sintético. Puede producir un
candidato de actualización para una línea base personal o, si existe un flujo
de datos consentido, para una referencia poblacional.

## Repositorios y almacenamiento

- `evi-miento`: aplicación, cálculo, UI y contratos de lectura.
- `movimiento-evidence`: revisiones sistemáticas, matriz de evidencia,
  fixtures, esquemas, migraciones, scripts de validación y reportes. No contiene
  videos ni datos personales.
- Base de datos/almacenamiento separado: sesiones y métricas derivadas, con
  control de acceso, cifrado, snapshots y restauración probada. Un repositorio
  Git no reemplaza una copia de respaldo de datos.

La aplicación actual es local-first: guarda la última línea base en
`localStorage` y permite exportarla como JSON. El siguiente backend no debe
romper ese modo de uso ni exigir subir el video.

La ruta pública `/ghost/` sirve como laboratorio de QA. Carga los fixtures
sintéticos, el índice de fuentes abiertas y los agregados generales y
específicos. El selector separa calle/plano, subida y bajada en running, y
ruta, contrarreloj y cohorte general de setback en bike. Cada capa se dibuja
sobre el mismo fantasma humano de dos miembros inferiores: la banda azul es
P10–P90 y la línea discontinua verde es la mediana. La capa es una proyección
visual de métricas, no una nube de coordenadas articulares observadas.

## Flujo de incorporación

```text
sesión opt-in
  -> validación de esquema y calidad de señal
  -> normalización de unidades y protocolo
  -> exclusión de outliers / captura no comparable
  -> estadísticas robustas por cohorte
  -> candidato de versión
  -> revisión y changelog
  -> publicación de ghost_version
```

Cada observación debe conservar modalidad, plano, protocolo, métrica, unidad,
fase del gesto, confianza, cobertura, contexto de captura y versión del
algoritmo. La agregación debe usar mediana, cuantiles e intervalo intercuartil
antes que un promedio único.

## Modelo mínimo de datos

- `evaluation_session`: identificador seudónimo, modalidad, protocolo, contexto,
  fecha, consentimiento y versión del algoritmo.
- `metric_observation`: sesión, métrica, plano, fase, valor, unidad, confianza,
  cobertura y estado de comparabilidad.
- `baseline_version`: ámbito (`personal` o `cohort`), n, estadísticos robustos,
  criterios de inclusión y versión padre.
- `ghost_version`: identificador, modalidad, versión, origen, hash del conjunto,
  estado (`candidate`, `approved`, `retired`) y changelog.
- `audit_event`: quién, qué cambió, cuándo y por qué; permite rollback.

## Reglas de actualización

- El tamaño muestral mínimo, la comparabilidad del protocolo y la calidad de
  señal deben definirse antes de publicar una nueva versión.
- Un cambio pequeño de muestra no debe generar una recomendación automática.
- Las métricas de carrera y bike deben estratificarse por tarea y contexto; no
  se debe mezclar, por ejemplo, carrera a distintas velocidades o posiciones de
  ciclismo sin declararlo.
- Los perfiles específicos no deben confundirse con la disciplina completa:
  `trail` de laboratorio con pendiente no equivale a trail técnico, y ruta o
  contrarreloj no equivalen a triatlón. Si no hay una cohorte comparable, se
  conserva el enlace como fuente indexada y no se fabrica un fantasma.
- Las diferencias del fantasma son controles del algoritmo, no alertas de
  lesión. El feedback experimental debe incluir tolerancia, confort y capacidad
  de volver a la versión anterior.
- Todo agregado publicado conserva la versión previa y su reporte de calidad.

Las corridas reproducibles están en `scripts/process_population_ghosts.py` y
`scripts/process_specialized_ghosts.py`. La segunda procesa en paralelo
conceptual los dos dominios de fuente: OSF/OpenSim para los perfiles de
running y BVH de Zenodo para ruta/contrarreloj. Publica sólo agregados compactos
en `public/population/`, junto con `specialized-ghost-quality.md`. La cohorte
running específica tiene n efectivos 18–19 por gradiente; la cohorte bike tiene
n efectivo 6 en ruta y 3 en contrarreloj. Las exclusiones y el faltante de
eventos quedan visibles en el reporte, no se imputan.

## Respaldo operativo

La base productiva debe tener copias automáticas versionadas, restauración
periódicamente verificada y exportaciones de solo lectura para auditoría. Los
fixtures sintéticos sí pueden vivir en Git; los datos de evaluaciones reales y
los videos no.
