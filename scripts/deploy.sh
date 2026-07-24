#!/bin/bash
# vtogether Cloud Run 배포 스크립트
# 사용법: ./scripts/deploy.sh  또는  npm run deploy

set -e
cd "$(dirname "$0")/.."

echo "📦 vtogether Cloud Run 배포"
echo ""

# 1. gcloud 설치 확인
if ! command -v gcloud &>/dev/null; then
  echo "❌ gcloud CLI가 설치되어 있지 않습니다."
  echo "   설치: https://cloud.google.com/sdk/docs/install"
  exit 1
fi

# 2. gcloud 로그인 확인
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>/dev/null | grep -q .; then
  echo "❌ gcloud에 로그인되어 있지 않습니다."
  echo "   실행: gcloud auth login"
  exit 1
fi

# 3. 프로젝트 확인
PROJECT=$(gcloud config get-value project 2>/dev/null || true)
if [ -z "$PROJECT" ]; then
  echo "❌ gcloud 프로젝트가 설정되지 않았습니다."
  echo "   실행: gcloud config set project 프로젝트ID"
  exit 1
fi
echo "✓ 프로젝트: $PROJECT"
echo ""

# 4. 운영 환경 변수 로드 (로컬 전용 .env.local 은 배포에 쓰지 않음)
if [ ! -f .env ]; then
  echo "❌ .env 파일이 없습니다. 운영/배포용으로 프로젝트 루트에 .env 를 만들어주세요."
  echo "   (로컬 개발은 .env.local — deploy 는 이 스크립트가 읽지 않습니다.)"
  exit 1
fi

set -a
source .env 2>/dev/null || true
set +a

# 5. 필수 환경 변수 확인
if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ] || [ -z "$NEXT_PUBLIC_SUPABASE_ANON_KEY" ]; then
  echo "❌ .env에 NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY가 있어야 합니다."
  exit 1
fi

# APP_URL: localhost면 기본 Cloud Run URL 사용
APP_URL="${NEXT_PUBLIC_APP_URL:-}"
if [ -z "$APP_URL" ] || [[ "$APP_URL" == *"localhost"* ]]; then
  # 프로젝트 번호로 URL 추정 (배포 후 실제 URL로 .env 수정 권장)
  PROJECT_NUM=$(gcloud projects describe "$PROJECT" --format="value(projectNumber)" 2>/dev/null || true)
  if [ -n "$PROJECT_NUM" ]; then
    APP_URL="https://vtogether-${PROJECT_NUM}.asia-northeast3.run.app"
  else
    APP_URL="https://vtogether.run.app"
  fi
  echo "💡 NEXT_PUBLIC_APP_URL이 없거나 localhost입니다. 임시 URL 사용: $APP_URL"
  echo "   배포 후 .env의 NEXT_PUBLIC_APP_URL을 실제 URL로 수정하고 다시 배포하세요."
  echo ""
fi

# 6. 배포 실행
echo "🚀 배포 시작..."
echo ""

# 시크릿 성격의 값(비밀번호·웹훅 URL 등)은 --set-env-vars(평문, Cloud Run 콘솔/IAM 조회 권한만으로 열람 가능)이
# 아니라 --set-secrets(Secret Manager)로 전달합니다. ./scripts/setup-secrets.sh 를 먼저 실행해 시크릿을
# 등록해두면 이 스크립트가 자동으로 감지해 사용하고, 없으면 평문 env로 폴백하며 경고를 남깁니다.
SECRET_MAPPINGS=""
add_secret_or_fallback_env() {
  local env_key="$1"
  local secret_name="$2"
  local value="$3"
  if [ -z "$value" ]; then
    return 0
  fi
  if gcloud secrets describe "$secret_name" &>/dev/null 2>&1; then
    if [ -n "$SECRET_MAPPINGS" ]; then
      SECRET_MAPPINGS="$SECRET_MAPPINGS,${env_key}=${secret_name}:latest"
    else
      SECRET_MAPPINGS="${env_key}=${secret_name}:latest"
    fi
  else
    echo "⚠️  ${secret_name} 시크릿이 없어 ${env_key}를 평문 환경변수로 전달합니다. ./scripts/setup-secrets.sh 실행을 권장합니다."
    ENV_VARS="$ENV_VARS,${env_key}=${value}"
  fi
}

# 런타임(서비스) 환경 변수 — 컨테이너 실행 시 process.env
# SERVER_SUPABASE_PUBLIC_* : NEXT_PUBLIC 이 빈 채로 번들에 박힌 경우에도 서버/RSC가 런타임으로 브라우저에 넘길 값 (NEXT_PUBLIC 과 동일로 설정)
ENV_VARS="NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL,NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY,NEXT_PUBLIC_APP_URL=$APP_URL,SERVER_SUPABASE_PUBLIC_URL=$NEXT_PUBLIC_SUPABASE_URL,SERVER_SUPABASE_PUBLIC_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY"

# 빌드 단계 환경 변수 — `next build` / 클라이언트·Edge 번들에 NEXT_PUBLIC_* 를 박기 위해 필수.
# (.dockerignore 로 .env 가 이미지에 없어서, 여기 없으면 로그인 버튼 등 브라우저용 Supabase 클라이언트가 undefined 가 됨)
BUILD_ENV_VARS="NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL,NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY,NEXT_PUBLIC_APP_URL=$APP_URL"
if [ -n "${NEXT_PUBLIC_GA_MEASUREMENT_ID:-}" ]; then
  BUILD_ENV_VARS="$BUILD_ENV_VARS,NEXT_PUBLIC_GA_MEASUREMENT_ID=$NEXT_PUBLIC_GA_MEASUREMENT_ID"
fi
echo "✓ 빌드 시 NEXT_PUBLIC_* 주입 (로그인·클라이언트 번들)"

# 세아웍스 인사 연동 (선택) — .env에 있으면 배포에 포함
if [ -n "$SEAH_ORGSYNC_USER_API_URL" ] && [ -n "$SEAH_ORGSYNC_USERNAME" ] && [ -n "$SEAH_ORGSYNC_PASSWORD" ]; then
  echo "✓ 세아웍스 API 환경 변수 포함"
  ENV_VARS="$ENV_VARS,SEAH_ORGSYNC_USER_API_URL=$SEAH_ORGSYNC_USER_API_URL,SEAH_ORGSYNC_ORG_API_URL=$SEAH_ORGSYNC_ORG_API_URL,SEAH_ORGSYNC_USERNAME=$SEAH_ORGSYNC_USERNAME"
  add_secret_or_fallback_env "SEAH_ORGSYNC_PASSWORD" "seah-orgsync-password" "$SEAH_ORGSYNC_PASSWORD"
  if [ -n "$SEAH_ORGSYNC_CRON_SECRET" ]; then
    echo "✓ SEAH_ORGSYNC_CRON_SECRET 포함 (크론 엔드포인트)"
    add_secret_or_fallback_env "SEAH_ORGSYNC_CRON_SECRET" "seah-orgsync-cron-secret" "$SEAH_ORGSYNC_CRON_SECRET"
  fi
fi

# 구글 챗 에러 알림 (선택) — .env에 있으면 배포에 포함 (.env.local 은 deploy 시 로드되지 않음)
if [ -n "$GOOGLE_CHAT_WEBHOOK_URL" ]; then
  echo "✓ GOOGLE_CHAT_WEBHOOK_URL 포함"
  add_secret_or_fallback_env "GOOGLE_CHAT_WEBHOOK_URL" "google-chat-webhook-url" "$GOOGLE_CHAT_WEBHOOK_URL"
fi

# 구글 챗 관리자 스페이스(승인 대기 등) — .env에 있으면 배포에 포함
if [ -n "$GOOGLE_CHAT_ADMIN_WEBHOOK_URL" ]; then
  echo "✓ GOOGLE_CHAT_ADMIN_WEBHOOK_URL 포함"
  add_secret_or_fallback_env "GOOGLE_CHAT_ADMIN_WEBHOOK_URL" "google-chat-admin-webhook-url" "$GOOGLE_CHAT_ADMIN_WEBHOOK_URL"
fi

# 적립 알림 이메일 SMTP (선택) — .env에 있으면 배포에 포함 (.env.local 은 deploy 시 로드되지 않음)
if [ -n "$SMTP_HOST" ] && [ -n "$SMTP_USER" ] && [ -n "$SMTP_PASS" ]; then
  echo "✓ SMTP 적립 알림 메일 환경 변수 포함"
  SMTP_PORT_VAL="${SMTP_PORT:-587}"
  SMTP_SECURE_VAL="${SMTP_SECURE:-false}"
  ENV_VARS="$ENV_VARS,SMTP_HOST=$SMTP_HOST,SMTP_PORT=$SMTP_PORT_VAL,SMTP_SECURE=$SMTP_SECURE_VAL,SMTP_USER=$SMTP_USER"
  add_secret_or_fallback_env "SMTP_PASS" "smtp-pass" "$SMTP_PASS"
  if [ -n "$MAIL_FROM" ]; then
    ENV_VARS="$ENV_VARS,MAIL_FROM=$MAIL_FROM"
  fi
else
  echo "💡 SMTP_HOST/USER/PASS 가 .env에 없어 적립 알림 메일은 운영에서 비활성입니다."
fi

# supabase-service-role은 필수 시크릿이므로 별도로 확인
if gcloud secrets describe supabase-service-role &>/dev/null 2>&1; then
  echo "✓ Secret Manager의 supabase-service-role 사용"
  SECRET_MAPPINGS="SUPABASE_SERVICE_ROLE_KEY=supabase-service-role:latest${SECRET_MAPPINGS:+,$SECRET_MAPPINGS}"
else
  echo "⚠️  supabase-service-role 시크릿이 없습니다. ./scripts/setup-secrets.sh 를 먼저 실행하세요."
fi

if [ -n "$SECRET_MAPPINGS" ]; then
  gcloud run deploy vtogether \
    --source . \
    --region asia-northeast3 \
    --allow-unauthenticated \
    --set-build-env-vars "$BUILD_ENV_VARS" \
    --set-env-vars "$ENV_VARS" \
    --set-secrets "$SECRET_MAPPINGS"
else
  gcloud run deploy vtogether \
    --source . \
    --region asia-northeast3 \
    --allow-unauthenticated \
    --set-build-env-vars "$BUILD_ENV_VARS" \
    --set-env-vars "$ENV_VARS"
fi

echo ""
echo "✅ 배포 완료!"
echo ""

# 배포 직후 세아웍스 스냅샷 동기화 (API 키가 있을 때만)
if [ -n "$SEAH_ORGSYNC_USER_API_URL" ] && [ -n "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo "🔄 세아웍스 인사 스냅샷 동기화 중..."
  if npm run sync:seah; then
    echo "✓ 세아웍스 동기화 완료"
  else
    echo "⚠️  세아웍스 동기화 실패 (배포는 완료됨). npm run sync:seah 로 수동 재시도하세요."
  fi
  echo ""
fi

echo "📍 접속 URL: $APP_URL"
echo "   (Cloud Run 콘솔에서 실제 URL 확인: https://console.cloud.google.com/run?project=$PROJECT)"
echo ""
echo "📌 다음 확인 사항:"
echo "   • Supabase → Authentication → URL Configuration: Redirect URLs에 $APP_URL/** 추가"
echo "   • 운영 .env 의 NEXT_PUBLIC_APP_URL이 위 URL과 일치하는지 확인"
echo ""
