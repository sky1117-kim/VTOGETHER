# 관리자 페이지 설계서 (Admin)

작성일: 2026.02.13  
상태: 설계 완료  
참조: PRD.md §4 관리자 기능, plan-phase2.md, plan-phase2-review.md

---

## 1. 개요 및 목표

### 1.1 목적
- **관리자 전용 영역**에서 전사 지표 확인, 이벤트·기부처·인증 심사를 한 곳에서 수행할 수 있도록 설계합니다.
- 이미 구현된 `/admin`(대시·사용자·포인트 지급), `/admin/events`(목록·등록)를 **PRD 4.1~4.4**에 맞춰 보완하고, **인증 심사**와 **기부처 관리**를 추가합니다.

### 1.2 설계 원칙
- **진입점**: `/admin` → 대시보드 + 사이드/상단 네비로 하위 메뉴 이동
- **권한**: `users.is_admin = true` 인 사용자만 접근 (이미 `layout.tsx`에서 검사)
- **데이터**: 관리자 전용 조회/변경은 `createAdminClient()` 사용 (RLS 우회)
- **반응형**: 모바일에서 테이블 가로 스크롤, 플로팅 액션 바 터치 영역 확보

---

## 2. URL 및 라우팅 구조

| URL | 설명 | 비고 |
|-----|------|------|
| `/admin` | 대시보드 (지표 + 바로가기) | 기존 보강 |
| `/admin/events` | 이벤트 목록 | 있음 |
| `/admin/events/new` | 이벤트 등록 (CMS) | 있음 |
| `/admin/events/[id]/edit` | 이벤트 수정 (CMS) | **신규** |
| `/admin/verifications` | 인증 심사 센터 (대량 승인/반려) | **신규** |
| `/admin/donation-targets` | 기부처 관리 (목표·오프라인 합산) | **신규** |

**레이아웃 네비게이션 (admin/layout.tsx)**  
- 상단 또는 좌측에: 대시보드 | 이벤트 | 인증 심사 | 기부처 관리 링크 추가 권장

---

## 3. 대시보드 (`/admin`)

### 3.1 PRD 요구 지표 (4.1)
| 지표 | 데이터 소스 | 비고 |
|------|-------------|------|
| 전사 누적 기부금 | `donation_targets` SUM(current_amount) 또는 `point_transactions` type=DONATED SUM(ABS(amount)) | 기존 `getTotalDonationStats()` 활용 |
| 목표 달성률 | 위 동일 + SUM(target_amount), progress % | 동일 |
| MAU | (선택) 월별 로그인/접속 수 — 현재 세션 테이블 없으면 "준비 중" 또는 제외 | Phase 3 권장 |
| 승인 대기 건수 | `event_submissions` WHERE status = 'PENDING' COUNT | **신규 쿼리** |

### 3.2 구현 방안
- **api/queries/admin.ts** (또는 **api/actions/admin.ts** 내 함수) 추가:
  - `getAdminDashboardStats()`:  
    - `getTotalDonationStats()` 재사용 → totalCurrent, totalTarget, progress  
    - `event_submissions`에서 PENDING 개수 조회
- **app/admin/page.tsx** 수정:
  - "전사 누적 기부금" → 실제 금액 표시
  - "목표 달성률" → progress % 표시
  - "승인 대기" → 건수 표시 + 클릭 시 `/admin/verifications` 이동

---

## 4. 이벤트 관리 (CMS)

### 4.1 현재 구현 상태
- 목록: `/admin/events` — `getEventsForAdmin()` 사용
- 등록: `/admin/events/new` — `CreateEventForm` + `createEvent()` Server Action
- **수정 페이지 없음** → 이벤트 수정 시 재등록 불가

### 4.2 이벤트 수정 페이지 (`/admin/events/[id]/edit`)

| 항목 | 내용 |
|------|------|
| **파일** | `app/admin/events/[id]/edit/page.tsx` |
| **데이터** | 이벤트 1건 + event_rounds + event_verification_methods 조회 (관리자 전용) |
| **폼** | CreateEventForm과 유사한 **EditEventForm** (기본값 채움, 구간/인증 방식 수정 가능) |
| **Server Action** | `api/actions/admin/events.ts` → `updateEvent(eventId, input)` |
| **제약** | 이미 제출된 submission이 있는 이벤트는 인증 방식 삭제 시 데이터 정합성 주의 (가능하면 수정 제한 또는 경고) |

**updateEvent 로직 요약**
- events 행 UPDATE (title, description, category, type, reward_*, image_url, status)
- event_verification_methods: 기존 삭제 후 재삽입 (또는 diff 후 insert/delete)
- event_rounds: 기존 삭제 후 재삽입 (기간제만; 이미 제출된 round_id 참조 중이면 삭제 불가이므로 “구간 추가만” 허용 등 정책 결정)

### 4.3 PRD 4.2 Smart Form 반영 (이미 반영된 부분)
- 인증 방식 다중 선택: CreateEventForm에서 처리
- 칭찬 챌린지: PEER_SELECT 시 쌍방 지급 옵션 (reward_policy BOTH)
- 보상: 포인트(승인 시 자동 적립) / 쿠폰(별도 발송 안내) / 선택 — 문구는 폼에 안내로 표시
- 구간(Round): 기간제(SEASONAL)일 때 N개 구간 추가/삭제

---

## 5. 인증 심사 센터 (`/admin/verifications`)

### 5.1 PRD 4.3 요구사항
- 대량 처리: 체크박스 다중 선택 → Floating Action Bar ([일괄 승인] / [일괄 반려])
- 콘텐츠 미리보기: 사진(썸네일·클릭 확대), 텍스트(말풍선), 수치(강조)

### 5.2 페이지 설계

| 항목 | 내용 |
|------|------|
| **파일** | `app/admin/verifications/page.tsx` (Server Component로 목록 렌더, 클라이언트는 체크·플로팅 바·모달) |
| **목록 데이터** | status = 'PENDING' 인 `event_submissions` 조회, event title, round 정보, user name/email, verification_data, created_at |
| **필터** | (선택) 이벤트별 필터, 기간 필터 |

### 5.3 테이블/카드 UI
- **데스크톱**: 테이블 — 체크박스 | 이벤트명 | 구간 | 참여자 | 인증 미리보기(사진/텍스트/수치) | 제출일 | 액션(승인/반려)
- **모바일**: 카드 리스트 또는 접을 수 있는 행, 가로 스크롤 방지 (overflow-x-auto 또는 카드 레이아웃)
- **미리보기**:
  - `verification_data.photo_url` → 썸네일, 클릭 시 모달/다이얼로그로 원본 확대
  - `verification_data.text` → 말풍선 또는 truncate + "더보기"
  - `verification_data.value` → 강조 텍스트
  - `verification_data.peer_id` → 수신자 이름 표시 (users 조인 또는 별도 조회)

### 5.4 Server Actions
- **api/actions/admin/verifications.ts** (신규)
  - `approveSubmission(submissionId: string)`: 단건 승인 → 포인트 지급(및 쌍방 지급 시 peer_user_id 처리), status=APPROVED, reviewed_by, reviewed_at
  - `rejectSubmission(submissionId: string, reason?: string)`: status=REJECTED, rejection_reason
  - `bulkApproveSubmissionIds(submissionIds: string[])`: 반복 또는 트랜잭션으로 일괄 승인
  - `bulkRejectSubmissionIds(submissionIds: string[], reason?: string)`: 일괄 반려
- 보상 지급 로직: `reward_policy = 'BOTH'` 이고 `peer_user_id` 있으면 참여자+수신자 둘 다 포인트 지급, point_transactions 2건, users current_points 갱신

### 5.5 쿼리
- **api/queries/admin/verifications.ts** 또는 **api/actions/admin** 내:
  - `getPendingSubmissionsForAdmin(filters?: { eventId?: string })`: event_submissions (pending) + events (title) + users (참여자 이름) + 필요 시 peer_user 이름

---

## 6. 기부처 관리 (`/admin/donation-targets`)

### 6.1 PRD 4.4 요구사항
- 목표 수정: 기부처별 `target_amount` 수정 (기본 1,000만원)
- 오프라인 합산: `current_amount` 강제 증액(보정) 기능

### 6.2 페이지 설계

| 항목 | 내용 |
|------|------|
| **파일** | `app/admin/donation-targets/page.tsx` |
| **목록** | `donation_targets` 전체 조회 (이미 공개 쿼리 있음 → 관리자용은 admin 클라이언트로 조회) |
| **UI** | 테이블: 기부처명 | 목표 금액 | 현재 모금액 | 달성률 | 상태 | [목표 수정] [오프라인 합산] |

### 6.3 기능
- **목표 수정**: 인라인 입력 또는 모달 → `target_amount` UPDATE (1,000만 등 기본값 안내)
- **오프라인 합산**: "추가할 금액" 입력 → `current_amount = current_amount + 입력값` UPDATE (검증: 양수만 허용)
- **상태**: `current_amount >= target_amount` 시 자동 COMPLETED 처리 정책은 기존 기부 플로우와 동일 유지; 관리자가 수동으로 COMPLETED 해제할지 여부는 선택(필요 시 "다시 ACTIVE로 되돌리기" 버튼)

### 6.4 Server Actions
- **api/actions/admin/donation-targets.ts** (신규)
  - `updateDonationTargetAmount(targetId: string, targetAmount: number)`: target_amount 업데이트
  - `addOfflineDonation(targetId: string, amount: number)`: current_amount += amount (양수 검증)

---

## 7. DB·쿼리·액션 정리

### 7.1 사용 테이블
- **기존**: users, donation_targets, donations, point_transactions, events, event_rounds, event_verification_methods, event_submissions
- **추가 마이그레이션**: 없음 (이미 006, 006-1, 010 등 반영 가정)

### 7.2 신규/보강 파일

| 구분 | 파일 | 설명 |
|------|------|------|
| 쿼리 | `api/queries/admin/dashboard.ts` 또는 `api/actions/admin.ts` 내 | getAdminDashboardStats (기부 합계 + PENDING 건수) |
| 쿼리 | `api/queries/admin/verifications.ts` | getPendingSubmissionsForAdmin |
| 액션 | `api/actions/admin/events.ts` | updateEvent (이벤트 수정) |
| 액션 | `api/actions/admin/verifications.ts` | approveSubmission, rejectSubmission, bulkApproveSubmissionIds, bulkRejectSubmissionIds |
| 액션 | `api/actions/admin/donation-targets.ts` | updateDonationTargetAmount, addOfflineDonation |
| 페이지 | `app/admin/events/[id]/edit/page.tsx` | 이벤트 수정 |
| 페이지 | `app/admin/verifications/page.tsx` | 인증 심사 센터 |
| 페이지 | `app/admin/donation-targets/page.tsx` | 기부처 관리 |
| 컴포넌트 | EditEventForm, VerificationsTable 등 | 필요 시 분리 |

### 7.3 RLS
- 관리자 액션은 `createAdminClient()` 사용으로 RLS 우회 (서버에서만 호출, is_admin 체크는 layout/액션 내부에서 수행)
- event_submissions 관리자 정책은 006-create-events-tables.sql에 이미 정의되어 있으면 유지

---

## 8. 레이아웃 네비게이션 제안

**app/admin/layout.tsx** 상단 링크 확장 예시:

- 메인으로 | **V.Together 관리자** | 대시보드 | 이벤트 | 인증 심사 | 기부처 관리

또는 좌측 세로 메뉴(숨김 가능)로 대시보드 / 이벤트 / 인증 심사 / 기부처 관리 넣어 한 번에 이동 가능하게 구성.

---

## 9. 개발 순서 권장

1. **대시보드 지표 연동** — getAdminDashboardStats, admin/page.tsx 지표 카드 실제 데이터 표시
2. **기부처 관리** — donation-targets 페이지 + updateDonationTargetAmount, addOfflineDonation (이벤트/심사와 독립)
3. **인증 심사 센터** — getPendingSubmissionsForAdmin, verifications 페이지, approve/reject 단건 → bulk
4. **이벤트 수정** — getEventForAdmin(단건), updateEvent, edit 페이지 + EditEventForm
5. **레이아웃 네비** — admin layout에 인증 심사·기부처 관리 링크 추가
6. (선택) MAU 지표 — 로그/세션 테이블 도입 시 대시보드에 추가

---

## 10. 정리

- **대시보드**: 전사 기부·목표 달성률·승인 대기 건수 연동
- **이벤트**: 목록/등록 유지, **수정 페이지** 추가
- **인증 심사**: 전용 페이지 + 대량 승인/반려 + 미리보기
- **기부처**: 전용 페이지 + 목표 수정 + 오프라인 합산

이 설계서를 기준으로 구현 시 `docs/progress.md`에 항목별 완료 여부를 체크해 나가면 됩니다.
