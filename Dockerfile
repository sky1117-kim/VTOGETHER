# Cloud Run 배포용 Dockerfile (Next.js standalone)
# 빌드 단계
FROM node:20-alpine AS builder

WORKDIR /app

# sharp 등 네이티브 모듈용
RUN apk add --no-cache libc6-compat

# 패키지 파일 복사
COPY package.json package-lock.json ./

# 의존성 설치 (npm install이 lock 파일 불일치에 더 관대함)
RUN npm install

# 소스 복사 및 빌드
COPY . .
RUN npm run build

# 실행 단계
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

# standalone 출력에서 필요한 파일만 복사
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 8080

CMD ["node", "server.js"]
