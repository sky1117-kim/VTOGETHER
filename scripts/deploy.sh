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

ENV_VARS="NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL,NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY,NEXT_PUBLIC_APP_URL=$APP_URL"

# 세아웍스 인사 연동 (선택) — .env에 있으면 배포에 포함
if [ -n "$SEAH_ORGSYNC_USER_API_URL" ] && [ -n "$SEAH_ORGSYNC_USERNAME" ] && [ -n "$SEAH_ORGSYNC_PASSWORD" ]; then
  echo "✓ 세아웍스 API 환경 변수 포함"
  ENV_VARS="$ENV_VARS,SEAH_ORGSYNC_USER_API_URL=$SEAH_ORGSYNC_USER_API_URL,SEAH_ORGSYNC_ORG_API_URL=$SEAH_ORGSYNC_ORG_API_URL,SEAH_ORGSYNC_USERNAME=$SEAH_ORGSYNC_USERNAME,SEAH_ORGSYNC_PASSWORD=$SEAH_ORGSYNC_PASSWORD"
fi

# 구글 챗 에러 알림 (선택) — .env에 있으면 배포에 포함 (.env.local 은 deploy 시 로드되지 않음)
if [ -n "$GOOGLE_CHAT_WEBHOOK_URL" ]; then
  echo "✓ GOOGLE_CHAT_WEBHOOK_URL 포함"
  ENV_VARS="$ENV_VARS,GOOGLE_CHAT_WEBHOOK_URL=$GOOGLE_CHAT_WEBHOOK_URL"
fi

if gcloud secrets describe supabase-service-role &>/dev/null 2>&1; then
  echo "✓ Secret Manager의 supabase-service-role 사용"
  gcloud run deploy vtogether \
    --source . \
    --region asia-northeast3 \
    --allow-unauthenticated \
    --set-env-vars "$ENV_VARS" \
    --set-secrets "SUPABASE_SERVICE_ROLE_KEY=supabase-service-role:latest"
else
  echo "⚠️  supabase-service-role 시크릿이 없습니다. ./scripts/setup-secrets.sh 를 먼저 실행하세요."
  gcloud run deploy vtogether \
    --source . \
    --region asia-northeast3 \
    --allow-unauthenticated \
    --set-env-vars "$ENV_VARS"
fi

echo ""
echo "✅ 배포 완료!"
echo ""
echo "📍 접속 URL: $APP_URL"
echo "   (Cloud Run 콘솔에서 실제 URL 확인: https://console.cloud.google.com/run?project=$PROJECT)"
echo ""
echo "📌 다음 확인 사항:"
echo "   • Supabase → Authentication → URL Configuration: Redirect URLs에 $APP_URL/** 추가"
echo "   • 운영 .env 의 NEXT_PUBLIC_APP_URL이 위 URL과 일치하는지 확인"
echo ""
