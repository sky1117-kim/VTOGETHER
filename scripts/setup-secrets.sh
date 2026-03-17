#!/bin/bash
# Secret Manager에 supabase-service-role 시크릿 등록 (최초 1회)
# 사용법: ./scripts/setup-secrets.sh

set -e
cd "$(dirname "$0")/.."

echo "🔐 Secret Manager 설정"
echo ""

# .env 로드
if [ ! -f .env ]; then
  echo "❌ .env 파일이 없습니다."
  exit 1
fi

set -a
source .env 2>/dev/null || true
set +a

if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo "❌ .env에 SUPABASE_SERVICE_ROLE_KEY가 없습니다."
  exit 1
fi

# 이미 있으면 스킵
if gcloud secrets describe supabase-service-role &>/dev/null 2>&1; then
  echo "✓ supabase-service-role 시크릿이 이미 있습니다."
  echo ""
  echo "새 키로 덮어쓰려면 먼저 삭제하세요:"
  echo "  gcloud secrets delete supabase-service-role"
  exit 0
fi

# 시크릿 생성
echo -n "$SUPABASE_SERVICE_ROLE_KEY" | gcloud secrets create supabase-service-role --data-file=-
echo "✓ supabase-service-role 시크릿 생성 완료"
echo ""

# Cloud Run 서비스 계정에 권한 부여
PROJECT=$(gcloud config get-value project 2>/dev/null || true)
if [ -z "$PROJECT" ]; then
  echo "⚠️  프로젝트를 확인할 수 없어 권한 부여를 건너뜁니다."
  exit 0
fi

PROJECT_NUM=$(gcloud projects describe "$PROJECT" --format="value(projectNumber)" 2>/dev/null || true)
if [ -z "$PROJECT_NUM" ]; then
  echo "⚠️  프로젝트 번호를 가져올 수 없어 권한 부여를 건너뜁니다."
  exit 0
fi

SERVICE_ACCOUNT="${PROJECT_NUM}-compute@developer.gserviceaccount.com"
gcloud secrets add-iam-policy-binding supabase-service-role \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/secretmanager.secretAccessor" \
  --quiet 2>/dev/null || true

echo "✓ Cloud Run 서비스 계정에 시크릿 접근 권한 부여 완료"
echo ""
echo "이제 ./scripts/deploy.sh 또는 npm run deploy 로 배포하세요."
echo ""
