# Casos sintéticos y fantasmas de calibración

Los archivos `synthetic_*.json` son casos geométricos reproducibles. Los archivos
`ghost_*.json` son copias etiquetadas como fixtures de calibración para detectar
regresiones en unidades, fórmulas y presentación.

Los fantasmas son inmutables y no representan una postura ideal, un grupo
normativo ni un objetivo clínico. Se regeneran con:

```bash
npm run eval:synthetic
```

Las evaluaciones reales nunca deben modificar estos fixtures. Para eso se
utiliza una línea base personal o una versión poblacional aprobada, según la
arquitectura descrita en `docs/ARQUITECTURA_DATOS_Y_FANTASMAS.md`.
