# Node 20은 2026-04 지원 종료 → 현재 LTS인 24로 (SRV-03)
FROM node:24-alpine
# 베이스 이미지 패키지 보안 업데이트 반영
RUN apk upgrade --no-cache
WORKDIR /app
COPY app/package.json ./
COPY app/index.js ./
USER node
EXPOSE 3000
CMD ["node", "index.js"]
