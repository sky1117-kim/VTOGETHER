# 비즈니스 로직 정리

## 부서 정보 (dept_name)

- **Google 로그인**은 프로필에 부서를 내려주지 않기 때문에, 최초 로그인 시 `public.users`에 저장되는 `dept_name`은 **항상 NULL**입니다.
- 현재는 **관리자 페이지(/admin)** 의 사용자 목록에서 해당 사용자 행의 부서 입력란에 부서명을 입력한 뒤 **저장**하면 됩니다.
- **예정:** 회사 그룹웨어 **세아웍스** 연동으로 부서 정보를 자동으로 불러와 `dept_name`에 반영할 예정입니다.
- **예정:** 메인 My Status 카드의 프로필 사진은 현재 플레이스홀더이며, 세아웍스 연동 후 프로필 이미지를 불러와 표시할 예정입니다.

## 포인트 거래 내역 (point_transactions) — 추출용 컬럼

- Supabase에서 데이터를 뽑을 때 **JOIN 없이** 누가·얼마·어디에 기부했는지 보기 쉽도록, 거래 기록 시점의 **스냅샷**을 저장합니다.
- **user_email**, **user_name**: 기록 시점의 사용자 이메일·이름 (나중에 엑셀/리포트에서 user_id 대신 보기 위함).
- **donation_target_name**: 기부 건일 때 기부처명 전용 컬럼 (기부처 열만 따로 필터/정렬하기 쉽게).
- `user_id`, `amount`, `related_id` 등 기존 컬럼은 그대로 두고, 위 세 컬럼은 "보기 편의용"으로만 사용합니다.

## Phase 2: 이벤트 & 챌린지

- **관리자 권한**: `users.is_admin = true` 인 사용자만 `/admin` 접근 및 이벤트 등록·인증 심사 가능.
- **최초 관리자 설정**: 한 명은 Supabase Table Editor에서 `users` 테이블 → 해당 행의 `is_admin`을 **true**로 수동 설정. 그 다음 로그인하여 `/admin` → **관리자 계정 설정** 섹션에서 다른 사용자에게도 관리자 체크를 줄 수 있음 (웹에서 설정).
- **이벤트 구간(기간제)**: 참여 기간과 인증 마감이 다름. 1구간 1~10일(인증 15일), 2구간 11~20일(인증 25일), 3구간 21~말일(인증 익월 5일). 자세한 규칙·상태 판단은 `docs/plan-rounds-logic.md` 참고. `event_rounds.submission_deadline` 컬럼 사용 (마이그레이션 013). 해당 월 3구간 자동 생성은 `createRoundsForMonth(eventId, year, month)` 서버 액션 또는 `lib/rounds.ts`의 `getThreeRoundsForMonth(year, month)` 활용.
- **기간별 기부 (관리자 대시보드)**: 오늘/이번 주/이번 달 기부 금액은 `donations` 테이블 기준으로 집계. **오늘** = 당일 00:00 UTC~, **이번 주** = 해당 주 월요일 00:00 UTC~, **이번 달** = 해당 월 1일 00:00 UTC~. `getDonationAmountsByPeriod()` (admin 전용).
- **이벤트 문구 구분**: `events.short_description` = 카드·목록에만 보이는 한 줄 요약(최대 120자). `events.description` = 상세 보기 팝업에 표시되는 전체 소개. 마이그레이션 015.
- **이벤트 테이블 등록 순서**: 반드시 `006-1-add-admin-column.sql` 실행 후 `006-create-events-tables.sql` 실행.
- **이미 campaigns로 만든 DB인 경우**: `010-rename-campaigns-to-events.sql` 실행 후 events로 사용.
- **이벤트 참여**: 상시 이벤트는 사용자당 1회만, 기간제는 구간(round)당 1회만 참여 가능 (DB Unique Index).
- **이벤트 제출 → 관리자 인증 필수**: 사용자가 제출한 모든 이벤트 인증은 **항상 `status: 'PENDING'`** 으로만 저장됨. 관리자가 `/admin/verifications` 인증 심사에서 승인(또는 반려)하기 전까지 보상 지급 없음. 자동 승인 경로 없음.
- **이벤트 운영 방식 (타입별)**:
  - **SEASONAL**: 구간별 기간·1회 참여. 상태는 LOCKED/OPEN/SUBMITTED/APPROVED/DONE/FAILED (자세한 조건은 `docs/plan-events-operations.md`).
  - **ALWAYS**: 기간 없음, 참여 빈도만 제한. `events.frequency_limit`(ONCE/DAILY/WEEKLY/MONTHLY)으로 일/주/월 1회 등 제어. 최근 제출일은 `event_submissions`에서 조회.
  - **INTERACTIVE**(칭찬 등): `reward_policy = 'BOTH'` + 인증 방식 PEER_SELECT. 승인 시 발신자·수신자 **둘 다** V.Point 지급 (다른 이벤트와 동일하게, V.Point 있으면 승인 시점에 즉시 지급).
- **이벤트 보상 (복수 선택)**:
  - 보상 유형: **V.Point**, **굿즈**, **커피쿠폰**. 하나만 선택하거나 여러 개 선택 가능.
  - `event_rewards` 테이블에 이벤트별로 저장. V.Point·커피쿠폰은 `amount` 필수, 굿즈는 금액 없음.
  - **승인 시 V.Point 지급**: 보상이 1개든 2개 이상이든, V.Point가 포함되어 있으면 관리자가 승인하는 시점에 참여자(및 칭찬 챌린지 시 수신자)에게 V.Point 즉시 지급. "보상 선택" 없이 지급됨.
- **인증 방식**:
  - 사진 / 텍스트 / 숫자 / 동료 선택+텍스트. 항목을 여러 개 추가 가능 (예: 텍스트 2개, 사진+텍스트 등).
  - `event_verification_methods.instruction`: 직원에게 보여줄 안내 문구 (예: "이런 이런 사진을 제출하세요", "이런 숫자를 기재하세요").
  - `event_verification_methods.input_style`: 단답(SHORT)=한 줄 입력, 장문(LONG)=여러 줄 입력. 관리자 등록 시 텍스트/숫자 항목에 선택 가능 (마이그레이션 014).
  - **사진 인증**: 업로드 파일은 Supabase Storage 버킷 `event-verification`에 저장. Supabase 대시보드 → Storage → New bucket → 이름 `event-verification`, Public 체크(또는 정책으로 인증 사용자 업로드 허용) 후 생성 필요.

## 이벤트 카드 버튼 표시 기준 (인증하기 / 보상받기)

메인 **이벤트 & 챌린지** 카드 하단 버튼은 **인증하기**와 **보상받기**만 사용합니다. (참여하기 문구 없이 모두 "인증하기"로 통일.)

| 버튼 | 표시 조건 |
|------|-----------|
| **보상받기** | 해당 이벤트에 **승인(APPROVED)된 제출**이 있어, 보상 수령(또는 보상 선택)을 아직 하지 않았을 때. `hasPendingReward` = true 인 이벤트. |
| **인증하기** | **기간제(SEASONAL)**: 인증 가능(OPEN) 구간이 하나라도 있을 때. **상시(ALWAYS)**: 보상 대기 중인 제출이 없을 때(참여 가능 상태). |

- 기간제·상시 모두 제출 가능한 경우에는 "인증하기"만 노출합니다.
- 보상받기와 인증하기는 조건에 따라 **동시에** 나올 수 있습니다 (예: 1구간 보상대기 + 2구간 인증가능).

## Phase 3: V.Honors 랭킹

- **표시**: 메인 페이지에만 **TOP 10** 개인 랭킹·팀 랭킹. 전체 보기 링크 및 전용 페이지 없음.

## MAU (월간 활성 사용자)

- **정의**: 최근 30일 이내에 한 번이라도 접속한 고유 사용자 수.
- **수집**: `users.last_active_at` — 로그인한 사용자(또는 테스트 유저)가 `getCurrentUser()`가 호출될 때마다 갱신.
- **관리자 대시보드**: "MAU (최근 30일)" 카드에 인원 수 표시. 마이그레이션 `016-users-last-active-at.sql` 미실행 시 "준비 중".

## 테스트용 포인트 부여 (내 계정에 P 넣기)

- **관리자 페이지** `/admin` 접속 후 **「포인트 지급 (기부 테스트용)」** 섹션으로 이동합니다.
- **대상 사용자** 드롭다운에서 본인 계정(이메일로 구분)을 선택합니다. (한 번도 로그인하지 않았다면 목록에 없으므로, 먼저 메인에서 Google 로그인을 한 번 해주세요.)
- **지급 포인트 (P)** 에 원하는 숫자(예: 10000)를 입력하고 **지급** 버튼을 누릅니다.
- 지급 후 메인 또는 마이페이지를 새로고침하면 보유 P와 게이지가 반영됩니다.
