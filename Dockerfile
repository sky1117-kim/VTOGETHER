# Cloud Run 배포용 Dockerfile (Next.js standalone)
# 빌드 단계
FROM node:20-bookworm-slim AS builder

WORKDIR /app

# 패키지 파일 복사
COPY package.json package-lock.json ./

# 의존성 설치 (CI 환경 재현성을 위해 lock 파일 기준 설치)
RUN npm ci

# 소스 복사 및 빌드
# NEXT_PUBLIC_* 는 `npm run build` 시점에 JS 번들에 포함됩니다. .dockerignore 때문에 .env 가 없으므로
# Cloud Run 배포 시 `gcloud run deploy --set-build-env-vars` 로 넣거나, 로컬 빌드 시 동일 변수를 환경에 설정하세요.
COPY . .
RUN npm run build

# 실행 단계
FROM node:20-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

# standalone 출력에서 필요한 파일만 복사
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 8080

CMD ["node", "server.js"]
