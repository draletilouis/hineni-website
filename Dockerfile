# The site + admin portal + API as one Node service (Railway, or any container host).
# The site's media (public/media) is not in the image: it lives on the volume with the uploads
# (npm run push-media). See README → "Deploying on Railway".

# ---- build the pages
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY index.html admin.html vite.config.js ./
COPY public ./public
COPY src ./src
RUN npm run build

# ---- run
FROM node:22-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app
# ffmpeg converts uploaded clips (any phone format) into MP4 every browser plays: server/video.mjs
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force
COPY server ./server
COPY src/data ./src/data
COPY --from=build /app/dist ./dist
# Railway sets PORT; the volume (RAILWAY_VOLUME_MOUNT_PATH) holds everything that changes
CMD ["node", "server/index.mjs"]
