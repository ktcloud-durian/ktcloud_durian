# Node 20은 2026-04 지원 종료 → 현재 LTS인 24로 (SRV-03)
FROM node:24-alpine
# 베이스 패키지 보안 업데이트 + 실행에 안 쓰는 npm·yarn·corepack 제거
# (npm에 같이 들어 있는 brace-expansion·undici 취약점 제거, 공격에 쓸 도구 줄이기)
RUN apk upgrade --no-cache \
 && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
           /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
           /opt/yarn* /usr/local/bin/yarn /usr/local/bin/yarnpkg
WORKDIR /app
COPY app/package.json ./
COPY app/index.js ./
USER node
EXPOSE 3000
CMD ["node", "index.js"]
