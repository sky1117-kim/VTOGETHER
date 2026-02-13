# Phase 2: 챌린지 & 보상 시스템 기술 설계서

작성일: 2026.02.12
상태: 설계 중

## 1. 개요

Phase 2에서는 챌린지(이벤트) 등록, 참여, 심사, 보상 지급 시스템을 구축합니다.

## 2. 데이터베이스 스키마 설계

### 2.1 Campaigns 테이블 (챌린지/이벤트)
```sql
CREATE TABLE campaigns (
  campaign_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL CHECK (category IN ('V_TOGETHER', 'CULTURE')),
  type TEXT NOT NULL CHECK (type IN ('ALWAYS', 'SEASONAL')),
  reward_policy TEXT NOT NULL CHECK (reward_policy IN ('SENDER_ONLY', 'BOTH')),
  reward_type TEXT NOT NULL CHECK (reward_type IN ('POINTS', 'COUPON', 'CHOICE')),
  reward_amount INTEGER, -- 포인트 보상 금액 (쿠폰일 경우 NULL)
  image_url TEXT,
  status TEXT DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'PAUSED', 'ENDED')),
  created_by TEXT REFERENCES users(user_id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 2.2 Campaign Rounds 테이블 (구간 정보)
```sql
CREATE TABLE campaign_rounds (
  round_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES campaigns(campaign_id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL, -- 1, 2, 3...
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  reward_amount INTEGER, -- 구간별 보상 (상위 보상이 있으면 우선)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(campaign_id, round_number)
);
```

### 2.3 Campaign Verification Methods 테이블 (인증 방식)
```sql
CREATE TABLE campaign_verification_methods (
  method_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES campaigns(campaign_id) ON DELETE CASCADE,
  method_type TEXT NOT NULL CHECK (method_type IN ('PHOTO', 'TEXT', 'VALUE', 'PEER_SELECT')),
  is_required BOOLEAN DEFAULT true,
  label TEXT, -- 사용자에게 보여줄 라벨 (예: "인증 사진", "칭찬 메시지")
  placeholder TEXT, -- 입력 필드 placeholder
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 2.4 Campaign Submissions 테이블 (참여 내역)
```sql
CREATE TABLE campaign_submissions (
  submission_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES campaigns(campaign_id) ON DELETE CASCADE,
  round_id UUID REFERENCES campaign_rounds(round_id), -- NULL 가능 (상시 이벤트)
  user_id TEXT REFERENCES users(user_id) ON DELETE CASCADE,
  status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  verification_data JSONB, -- { photo_url: "...", text: "...", value: 123, peer_id: "..." }
  peer_user_id TEXT REFERENCES users(user_id), -- 칭찬 챌린지의 경우 수신자
  reward_received BOOLEAN DEFAULT false, -- 보상 지급 여부
  reward_type TEXT, -- 실제 받은 보상 타입 (CHOICE인 경우)
  reward_amount INTEGER, -- 실제 받은 보상 금액
  rejection_reason TEXT, -- 반려 사유
  reviewed_by TEXT REFERENCES users(user_id), -- 심사자
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(campaign_id, round_id, user_id) -- 한 구간당 1회만 참여 가능
);
```

## 3. 페이지 구조

### 3.1 관리자 페이지
- `/admin/campaigns` - 챌린지 목록 및 등록
- `/admin/campaigns/new` - 새 챌린지 등록 (CMS)
- `/admin/campaigns/[id]/edit` - 챌린지 수정
- `/admin/verifications` - 인증 심사 센터 (대량 승인/반려)

### 3.2 사용자 페이지
- `/campaigns` - 챌린지 목록 (필터: 전체/V.Together/Culture)
- `/campaigns/[id]` - 챌린지 상세 및 참여 모달

## 4. 주요 기능 구현 계획

### 4.1 관리자 이벤트 등록 (CMS)
**파일**: `app/admin/campaigns/new/page.tsx`

**기능**:
- 챌린지 기본 정보 입력 (제목, 설명, 카테고리, 타입)
- 인증 방식 다중 선택 (체크박스)
- 보상 설정 (포인트/쿠폰/선택)
- 칭찬 챌린지 옵션 (동료 지목 시 쌍방 지급 토글)
- 구간(Round) 추가/삭제 (기간제 이벤트)

**Server Action**: `api/actions/admin/campaigns.ts`
- `createCampaign()`
- `updateCampaign()`

### 4.2 사용자 챌린지 참여 모달
**파일**: `components/campaigns/CampaignParticipateModal.tsx`

**기능**:
- 동적 폼 생성 (인증 방식에 따라)
  - PHOTO: 이미지 업로드
  - TEXT: 텍스트 입력
  - VALUE: 숫자 입력
  - PEER_SELECT: 동료 검색 및 선택
- 제출 전 유효성 검사
- 제출 후 "심사 대기 중" 상태 표시

**Server Action**: `api/actions/campaigns.ts`
- `submitCampaign()`

### 4.3 칭찬 챌린지 쌍방 지급 트랜잭션
**파일**: `api/actions/admin/verifications.ts`

**기능**:
- 승인 시 `reward_policy` 확인
- `BOTH`인 경우:
  1. 참여자(User A)에게 포인트 지급
  2. 수신자(User B)에게 포인트 지급
  3. PointTransactions 2건 생성
  4. User B에게 알림 (향후 구현)

**함수**: `approveSubmission(submissionId)`

### 4.4 관리자 대량 심사 기능
**파일**: `app/admin/verifications/page.tsx`

**기능**:
- 체크박스 다중 선택
- 선택 시 하단 Floating Action Bar 표시
- 일괄 승인/반려 버튼
- 콘텐츠 미리보기:
  - 사진: 썸네일 (클릭 시 확대)
  - 텍스트: 말풍선 형태
  - 수치: 강조 표시

**Server Action**: `api/actions/admin/verifications.ts`
- `bulkApproveSubmissionIds()`
- `bulkRejectSubmissionIds()`

## 5. 개발 순서

1. **DB 마이그레이션** (006-create-campaigns-tables.sql)
2. **타입 정의** (types/database.ts 업데이트)
3. **관리자 챌린지 등록 페이지** (CMS)
4. **사용자 챌린지 목록/상세 페이지**
5. **사용자 참여 모달** (동적 폼)
6. **관리자 심사 센터** (대량 처리)
7. **보상 지급 로직** (쌍방 지급 포함)

## 6. 주의사항

- 챌린지 참여는 한 구간당 1회만 가능 (UNIQUE 제약)
- 칭찬 챌린지의 경우 `peer_user_id` 필수
- 보상 지급은 트랜잭션으로 처리 (원자성 보장)
- 이미지 업로드는 Supabase Storage 사용
