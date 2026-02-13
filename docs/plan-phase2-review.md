# Phase 2 설계 검토 결과

검토일: 2026.02.12

## ✅ 잘 설계된 부분

1. **테이블 구조**: Campaigns, Rounds, Verification Methods, Submissions로 명확하게 분리
2. **인증 방식**: JSONB로 유연하게 저장하여 다양한 인증 방식 지원
3. **RLS 정책**: 기본적인 보안 정책이 잘 설정됨
4. **인덱스**: 자주 조회되는 컬럼에 인덱스가 적절히 설정됨

## ⚠️ 개선이 필요한 부분

### 1. **상시 이벤트 참여 제한 문제**

**현재 설계**:
```sql
UNIQUE(campaign_id, COALESCE(round_id, '00000000-0000-0000-0000-000000000000'::uuid), user_id)
```

**문제점**:
- 상시 이벤트(type='ALWAYS')는 round_id가 NULL인데, COALESCE로 더미 UUID를 사용하는 방식이 깔끔하지 않음
- 상시 이벤트는 사용자가 여러 번 참여할 수 있어야 할 수도 있음 (PRD에 명시되지 않음)

**제안**:
- 상시 이벤트는 중복 참여 허용 vs 1회만 참여 중 어느 쪽인지 PRD 확인 필요
- 만약 1회만 참여라면, Partial Unique Index 사용:
```sql
CREATE UNIQUE INDEX idx_campaign_submissions_unique_always 
ON campaign_submissions(campaign_id, user_id) 
WHERE round_id IS NULL;

CREATE UNIQUE INDEX idx_campaign_submissions_unique_seasonal 
ON campaign_submissions(campaign_id, round_id, user_id) 
WHERE round_id IS NOT NULL;
```

### 2. **관리자 권한 관리**

**현재 상태**: RLS 정책이 주석 처리됨

**문제점**:
- users 테이블에 `is_admin` 컬럼이 없음
- 관리자 기능을 사용하려면 권한 체크가 필요

**제안**:
- Option A: users 테이블에 `is_admin BOOLEAN DEFAULT false` 컬럼 추가
- Option B: 환경변수나 별도 관리자 테이블 사용
- Option C: 특정 이메일 도메인/리스트로 관리자 판단

### 3. **이미지 업로드 (Supabase Storage)**

**누락된 부분**:
- Storage 버킷 생성 및 설정
- 업로드 권한 정책
- 이미지 URL 저장 방식

**제안**:
- `campaigns` 테이블의 `image_url`은 관리자가 직접 입력
- `campaign_submissions.verification_data`의 `photo_url`은 Supabase Storage에 업로드
- Storage 버킷: `campaign-submissions` 생성 필요
- 업로드 경로: `campaigns/{campaign_id}/{user_id}/{timestamp}.jpg`

### 4. **보상 선택 (CHOICE) 로직**

**PRD 내용**: "챌린지 달성 후 보상 옵션이 CHOICE인 경우"

**명확화 필요**:
- "달성 후" = 승인(APPROVED) 후를 의미하는지 확인 필요
- 보상 선택은 승인 후, 실제 지급 전에 선택하는 것으로 추정

**제안**:
- `campaign_submissions`에 `reward_choice_pending BOOLEAN` 필드 추가
- 승인 시 `reward_type='CHOICE'`이면 `reward_choice_pending=true`로 설정
- 사용자가 선택하면 `reward_type`과 `reward_amount` 업데이트 후 지급

### 5. **칭찬 챌린지 자동 설정**

**PRD 내용**: "동료 지목 옵션 체크 시 -> 쌍방 지급 옵션 토글 활성화"

**명확화 필요**:
- PEER_SELECT 인증 방식이 있으면 자동으로 `reward_policy='BOTH'`로 설정?
- 아니면 관리자가 수동으로 선택?

**제안**:
- UI에서 PEER_SELECT 체크 시 `reward_policy` 자동으로 'BOTH'로 변경 (수정 가능)
- 또는 DB 제약조건으로 PEER_SELECT가 있으면 `reward_policy='BOTH'` 강제

### 6. **구간(Round) 보상 우선순위**

**현재 설계**: `campaign_rounds.reward_amount`가 있으면 상위 보상 우선

**명확화 필요**:
- Campaign의 `reward_amount`와 Round의 `reward_amount` 중 어느 것이 우선인지?
- PRD에는 "구간별 보상" 언급이 없음

**제안**:
- Round의 `reward_amount`가 있으면 우선 사용
- 없으면 Campaign의 `reward_amount` 사용
- 또는 Round 보상 기능을 Phase 2에서 제외하고 Phase 3으로 이동

### 7. **관리자 심사 권한**

**현재 RLS**: 관리자가 모든 submission을 조회/수정할 수 있는 정책 없음

**제안**:
```sql
-- 관리자는 모든 submission 조회 가능
CREATE POLICY "Admins can view all submissions"
  ON campaign_submissions FOR SELECT
  USING (auth.uid()::text IN (SELECT user_id FROM users WHERE is_admin = true));

-- 관리자는 승인/반려 가능
CREATE POLICY "Admins can update submissions"
  ON campaign_submissions FOR UPDATE
  USING (auth.uid()::text IN (SELECT user_id FROM users WHERE is_admin = true));
```

### 8. **데이터 검증**

**추가 필요**:
- `reward_type='POINTS'`일 때 `reward_amount` 필수
- `reward_type='COUPON'`일 때 `reward_amount` NULL 가능
- `reward_policy='BOTH'`일 때 `peer_user_id` 필수 (칭찬 챌린지)
- `type='SEASONAL'`일 때 최소 1개 Round 필수

**제안**: 애플리케이션 레벨에서 검증하거나, DB 트리거로 검증

## 📋 추가 고려사항

1. **쿠폰 보상**: 쿠폰은 어떻게 관리할지? (별도 테이블? 외부 시스템?)
2. **알림 시스템**: User B에게 알림 발송은 Phase 2에 포함? (현재는 "향후 구현"으로 표시)
3. **이미지 리사이징**: 업로드된 이미지 자동 리사이징 필요 여부
4. **반려 사유 필수**: 반려 시 `rejection_reason` 필수 여부

## 🎯 권장 조치사항

### 즉시 수정 필요:
1. ✅ 관리자 권한 컬럼 추가 (`users.is_admin`)
2. ✅ 상시 이벤트 참여 제한 방식 명확화
3. ✅ 관리자 RLS 정책 활성화

### Phase 2 개발 전 확인 필요:
1. 상시 이벤트 중복 참여 허용 여부
2. Round 보상 기능 포함 여부
3. 쿠폰 보상 관리 방식

### Phase 2 개발 중 구현:
1. Supabase Storage 버킷 설정
2. 이미지 업로드 로직
3. 보상 선택 모달
