#!/bin/bash
# Secret Manager에 운영 시크릿 등록 (최초 1회, 이후 재실행해도 이미 있는 건 건너뜀)
# 사용법: ./scripts/setup-secrets.sh
#
# SUPABASE_SERVICE_ROLE_KEY는 필수, 나머지(SEAH_ORGSYNC_PASSWORD/SMTP_PASS/GOOGLE_CHAT_WEBHOOK_URL)는
# .env에 있을 때만 등록합니다. 전부 --set-env-vars(평문)가 아닌 --set-secrets로 Cloud Run에 전달되어야
# Cloud Run 콘솔/IAM 조회 권한만으로 값이 노출되지 않습니다.

set -e
cd "$(dirname "$0")/.."

echo "🔐 Secret Manager 설정"
echo ""

# 운영 .env 로드 (.env.local 은 사용하지 않음)
if [ ! -f .env ]; then
  echo "❌ .env 파일이 없습니다. (SUPABASE_SERVICE_ROLE_KEY 가 있는 운영용 .env)"
  exit 1
fi

set -a
source .env 2>/dev/null || true
set +a

if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo "❌ .env에 SUPABASE_SERVICE_ROLE_KEY가 없습니다."
  exit 1
fi

PROJECT=$(gcloud config get-value project 2>/dev/null || true)
PROJECT_NUM=""
if [ -n "$PROJECT" ]; then
  PROJECT_NUM=$(gcloud projects describe "$PROJECT" --format="value(projectNumber)" 2>/dev/null || true)
fi
SERVICE_ACCOUNT="${PROJECT_NUM}-compute@developer.gserviceaccount.com"

# create_secret_if_missing <secret-name> <value>
create_secret_if_missing() {
  local name="$1"
  local value="$2"

  if [ -z "$value" ]; then
    return 0
  fi

  if gcloud secrets describe "$name" &>/dev/null 2>&1; then
    echo "✓ ${name} 시크릿이 이미 있습니다. (새 값으로 덮어쓰려면: gcloud secrets delete ${name})"
    return 0
  fi

  echo -n "$value" | gcloud secrets create "$name" --data-file=-
  echo "✓ ${name} 시크릿 생성 완료"

  if [ -n "$PROJECT_NUM" ]; then
    gcloud secrets add-iam-policy-binding "$name" \
      --member="serviceAccount:${SERVICE_ACCOUNT}" \
      --role="roles/secretmanager.secretAccessor" \
      --quiet 2>/dev/null || true
    echo "  → Cloud Run 서비스 계정에 접근 권한 부여 완료"
  else
    echo "  ⚠️  프로젝트 번호를 확인할 수 없어 권한 부여를 건너뜁니다. gcloud config set project 를 확인하세요."
  fi
  echo ""
}

create_secret_if_missing "supabase-service-role" "$SUPABASE_SERVICE_ROLE_KEY"
create_secret_if_missing "seah-orgsync-password" "$SEAH_ORGSYNC_PASSWORD"
create_secret_if_missing "seah-orgsync-cron-secret" "$SEAH_ORGSYNC_CRON_SECRET"
create_secret_if_missing "smtp-pass" "$SMTP_PASS"
create_secret_if_missing "google-chat-webhook-url" "$GOOGLE_CHAT_WEBHOOK_URL"
create_secret_if_missing "google-chat-admin-webhook-url" "$GOOGLE_CHAT_ADMIN_WEBHOOK_URL"

echo ""
echo "이제 ./scripts/deploy.sh 또는 npm run deploy 로 배포하세요."
echo ""
