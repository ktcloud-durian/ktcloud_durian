# 빌드 위치: 저장소 루트 (docker build -f services/web/Dockerfile .)
# 3단계: ① 화면(React) 빌드 → ② 서버 패키지 설치 → ③ 실행 이미지(npm·yarn·pnpm 없음, SRV-03)

FROM node:24-alpine AS ui
WORKDIR /ui
RUN npm install -g pnpm@10.34.3 --ignore-scripts
COPY frontend/package.json frontend/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --ignore-scripts
COPY frontend/ ./
RUN pnpm build

FROM node:24-alpine AS deps
WORKDIR /app
COPY services/web/package.json services/web/package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

FROM node:24-alpine
RUN apk upgrade --no-cache \
 && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
           /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
           /opt/yarn* /usr/local/bin/yarn /usr/local/bin/yarnpkg
ENV NODE_ENV=production
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY services/web/package.json ./
COPY services/web/src ./src
COPY --from=ui /ui/dist ./public
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:3000/health || exit 1
CMD ["node", "src/server.js"]
