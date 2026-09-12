# Multi-stage Dockerfile para Movimiento · Plataforma de Análisis Biomecánico Deportivo
FROM node:22-alpine AS builder

WORKDIR /app

# Instalación de dependencias con cache eficiente
COPY package.json package-lock.json ./
RUN npm ci

# Copia del código fuente
COPY . .

# Verificación de calidad automatizada en fase de construcción
RUN npm test
RUN npm run lint

# Compilación del bundle de producción
RUN npm run build

# ----------------------------------------------------------------------------
# Etapa 2: Runner de Producción
# ----------------------------------------------------------------------------
FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Copia de artefactos construidos y dependencias
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public
COPY --from=builder /app/app ./app
COPY --from=builder /app/lib ./lib
COPY --from=builder /app/components ./components
COPY --from=builder /app/hooks ./hooks
COPY --from=builder /app/vite.config.ts ./vite.config.ts

# Uso de usuario sin privilegios por seguridad
USER node

EXPOSE 3000

# Inicio del servidor de producción con vinext
CMD ["npx", "vinext", "start", "-p", "3000", "-H", "0.0.0.0"]
