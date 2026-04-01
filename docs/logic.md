# 비즈니스 로직 정리

## 부서 정보 (dept_name)

- **Google 로그인**은 프로필에 부서를 내려주지 않기 때문에, 최초 로그인 시 `public.users`에 저장되는 `dept_name`은 **항상 NULL**입니다.
- 현재는 **관리자 페이지(/admin)** 의 사용자 목록에서 해당 사용자 행의 부서 입력란에 부서명을 입력한 뒤 **저장**하면 됩니다.
- **구현됨(배치형):** 세아웍스 인사 데이터는 `seah_org_units`(조직) + `seah_employees`(직원) 2테이블로 분리 저장합니다. 서비스 로직은 `users`를 그대로 사용하고, 필요할 때 `users.email = seah_employees.email` 조인 후 조직(`seah_org_units.org_name`)을 참조합니다.
- **동기화 주기:** 외부 세아웍스 API는 `/api/cron/seah-orgsync`를 **하루 1회** 배치로 호출합니다. 실시간(로그인/페이지 진입 시) 외부 API 호출은 하지 않습니다.
- **식별자/정책:** 이메일은 소문자 정규화(`lower(email)`) 기준으로 관리하고, 퇴사자(`status_code='N'`)는 삭제하지 않고 비활성 상태로 유지합니다.
- **예정:** 메인 My Status 카드의 프로필 사진은 현재 플레이스홀더(이름 첫 글자)이며, 세아웍스 API에 프로필 이미지 필드가 추가되면 연동 예정입니다.

## 포인트 거래 내역 (point_transactions) — 추출용 컬럼

- Supabase에서 데이터를 뽑을 때 **JOIN 없이** 누가·얼마·어디에 기부했는지 보기 쉽도록, 거래 기록 시점의 **스냅샷**을 저장합니다.
- **user_email**, **user_name**: 기록 시점의 사용자 이메일·이름 (나중에 엑셀/리포트에서 user_id 대신 보기 위함).
- **donation_target_name**: 기부 건일 때 기부처명 전용 컬럼 (기부처 열만 따로 필터/정렬하기 쉽게).
- `user_id`, `amount`, `related_id` 등 기존 컬럼은 그대로 두고, 위 세 컬럼은 "보기 편의용"으로만 사용합니다.

## V.Medal / 상점 / 매칭기부 (2026.03.26)

- 재화는 `V.Credit` + `V.Medal` 2종으로 운영합니다.
- 이벤트 보상 정책:
  - `People` 이벤트 승인 보상은 `V.Medal` 적립
  - `V.Together` 이벤트 승인 보상은 `V.Credit` 적립
- `V.Medal` 상점:
  - 상품 분류는 `굿즈`, `V.Credit`, `알맹상점` 3가지로 운영
  - `V.Credit` 분류 상품 구매 시 즉시 `V.Credit` 지급
- `V.Credit` 출처 추적:
  - `credit_lots`에 `ACTIVITY`, `MEDAL_EXCHANGE`, `ADMIN_GRANT`로 lot 저장
  - 기부 시 오래된 lot부터 FIFO 차감
  - 차감 결과는 `donation_lot_allocations`에 저장
- 상점 상품 이미지 저장 규칙(2026.03.31):
  - `shop_products.image_url` 컬럼은 단일 URL뿐 아니라 **여러 URL을 줄바꿈으로 연결한 문자열**도 허용합니다.
  - `/shop`에서는 줄바꿈(또는 쉼표) 기준으로 분리해 이미지 슬라이드로 보여줍니다.
  - `/admin/shop-products` 업로드는 여러 파일 선택이 가능하며, 업로드된 URL을 줄바꿈으로 누적 저장합니다.
- 매칭기부:
  - 일반 활동으로 적립된 `V.Credit` 기부는 매칭 제외
  - `V.Medal -> V.Credit` 전환 lot(`MEDAL_EXCHANGE`)에서 차감된 금액만 매칭 인정
- 관리자 대시보드 매칭 지표:
  - 이벤트 카테고리별 적립 + lot 기반 매칭금 집계로 계산

## Phase 2: 이벤트 & 챌린지

- **관리자 권한**: `users.is_admin = true` 인 사용자만 `/admin` 접근 및 이벤트 등록·인증 심사 가능.
- **지급/적립 내역 통합 화면**: `/admin/point-grant`에서 수동 지급과 거래 내역 조회를 함께 처리. 수동 지급은 기존과 동일하게 `users.current_points` 증가 + `point_transactions`에 `type=EARNED`, `related_type=ADMIN_GRANT`, `description`=사유(없으면「관리자 지급」)로 기록.
- **관리자 거래 조회 기준**: 같은 페이지에서 `point_transactions` 전체를 대상으로 이름/이메일/사유 검색, 거래유형(`EARNED`/`DONATED`/`USED`), 재화(`V_CREDIT`/`V_MEDAL`), 출처코드(`related_type`), 기간 필터로 조회.
- **Footer 관리자 링크**: 메인/기부/마이 페이지 하단 Footer의 "관리자" 링크는 **관리자(`is_admin = true`)일 때만** 표시됩니다. 일반 사용자에게는 노출되지 않습니다.
- **최초 관리자 설정**: 한 명은 Supabase Table Editor에서 `users` 테이블 → 해당 행의 `is_admin`을 **true**로 수동 설정. 그 다음 로그인하여 `/admin` → **관리자 계정 설정** 섹션에서 다른 사용자에게도 관리자 체크를 줄 수 있음 (웹에서 설정).
- **이벤트 구간(기간제)**: 참여 기간과 인증 마감이 다름. 1구간 1~10일(인증 15일), 2구간 11~20일(인증 25일), 3구간 21~말일(인증 익월 5일). 자세한 규칙·상태 판단은 `docs/plan-rounds-logic.md` 참고. `event_rounds.submission_deadline` 컬럼 사용 (마이그레이션 013). 해당 월 3구간 자동 생성은 `createRoundsForMonth(eventId, year, month)` 서버 액션 또는 `lib/rounds.ts`의 `getThreeRoundsForMonth(year, month)` 활용.
- **기간별 기부 (관리자 대시보드)**: 오늘/이번 주/이번 달 기부 금액은 `donations` 테이블 기준으로 집계. **오늘** = 당일 00:00 UTC~, **이번 주** = 해당 주 월요일 00:00 UTC~, **이번 달** = 해당 월 1일 00:00 UTC~. `getDonationAmountsByPeriod()` (admin 전용).
- **이벤트 문구 구분**: `events.short_description` = 카드·목록에만 보이는 한 줄 요약(최대 120자). `events.description` = 상세 보기 팝업에 표시되는 전체 소개. 마이그레이션 015.
- **이벤트 상세 띄어쓰기 정규화**: TipTap RichTextEditor가 색상·크기 등을 적용할 때 `<span>` 등 인라인 태그로 감싸며, 직렬화 시 태그 내부·뒤의 공백이 브라우저에서 다르게 렌더됨. 에디터와 모달 표시가 달라지는 문제를 막기 위해, 모달 렌더 전 (1) 인라인 태그 내부 끝 공백 제거, (2) 인라인 태그 뒤 공백+한글(조사) 붙여쓰기 적용. 예: "평균페이스 가" → "평균페이스가".
- **이벤트 상태 (ACTIVE/PAUSED/ENDED)**:
  - **ACTIVE**: 메인 화면에 노출. 진행 중인 이벤트.
  - **PAUSED**: 메인 화면에 노출되지 않음. 일시정지 상태.
  - **ENDED**: 메인 화면에 노출되지 않음. 종료된 이벤트. 관리자 목록에는 유지되며, 필요 시 "재개"로 ACTIVE로 되돌릴 수 있음.
  - 관리자 이벤트 목록(`/admin/events`)에서는 **모든 상태**의 이벤트를 볼 수 있으며, 각 행에 "종료"/"재개" 버튼으로 빠르게 상태 변경 가능. 상세 수정 폼에서도 상태 드롭다운으로 변경 가능.
- **이벤트 테이블 등록 순서**: 반드시 `006-1-add-admin-column.sql` 실행 후 `006-create-events-tables.sql` 실행.
- **이미 campaigns로 만든 DB인 경우**: `010-rename-campaigns-to-events.sql` 실행 후 events로 사용.
- **이벤트 참여**: 상시 이벤트는 사용자당 1회만, 기간제는 구간(round)당 1회만 참여 가능 (DB Unique Index).
- **이벤트 제출 → 관리자 인증 필수**: 사용자가 제출한 모든 이벤트 인증은 **항상 `status: 'PENDING'`** 으로만 저장됨. 관리자가 `/admin/verifications` 인증 심사에서 승인(또는 반려)하기 전까지 보상 지급 없음. 자동 승인 경로 없음.
- **승인 대기 Chat 알림**: 이벤트 인증이 `PENDING`으로 저장되면 서버 액션(`submitEventSubmission`)에서 Google Chat Webhook 알림을 발송합니다. 알림에는 이벤트명·제출자 ID·관리자 확인 링크(`/admin/verifications`)가 포함됩니다. 알림 전송 실패 시에도 제출 저장은 실패시키지 않습니다.
- **이벤트 운영 방식 (타입별)**:
  - **SEASONAL**: 구간별 기간·1회 참여. 상태는 LOCKED/OPEN/SUBMITTED/APPROVED/DONE/FAILED (자세한 조건은 `docs/plan-events-operations.md`).
  - **ALWAYS**: 기간 없음, 참여 빈도만 제한. `events.frequency_limit`(ONCE/DAILY/WEEKLY/MONTHLY)으로 일/주/월 1회 등 제어. 최근 제출일은 `event_submissions`에서 조회.
  - **INTERACTIVE**(칭찬 등): `reward_policy = 'BOTH'` + 인증 방식 PEER_SELECT. 승인 시 발신자·수신자 **둘 다** 같은 재화·같은 금액을 지급합니다. 재화 종류는 **`events.category`와 동일 규칙** (`api/actions/admin/verifications.ts`의 `primaryCurrency`): **People** → `V_MEDAL`, **그 외(V.Together/Culture 등)** → `V_CREDIT`. (CHOICE·복수 보상이면 아래 「승인 시 지급」 예외.)
  - **칭찬 챌린지 적립 내역 구분**: 제출자(칭찬한 사람)는 "칭찬을 함: …", 수신자는 "칭찬을 받음: …" 등으로 DB `description`에 남길 수 있으며, UI에서는 **통일 형식**으로 표시: [이벤트명] 먼저, 그 다음 [상태] 배지. 상태는 승인완료/보상 선택 대기/보상 지급 완료. 칭찬 챌린지는 [내가 칭찬한 내역] / [내가 칭찬 받은 내역] 배지로 받음·보냄 구분.
  - **칭찬 챌린지 익명 옵션**: 제출 시 "익명으로 칭찬 보내기"를 선택할 수 있음. 선택 시 칭찬 수신자에게는 포인트 내역에 "익명의 동료가 나를 칭찬하여"로 표시되며, 관리자(/admin/verifications)는 제출자 이름을 그대로 확인 가능.
- **이벤트 보상 (복수 선택)**:
  - 보상 유형: **V.Credit**, **굿즈**, **커피쿠폰**. 하나만 선택하거나 여러 개 선택 가능.
  - `event_rewards` 테이블에 이벤트별로 저장. V.Credit·커피쿠폰은 `amount` 필수, 굿즈는 금액 없음.
- **승인 시 재화 지급 (`approveSubmission`)**:
  - `events.reward_type === 'CHOICE'`이거나 **`event_rewards` 행이 2개 이상**이면 복수/선택형으로 보아 **승인 직후 재화(V.Credit/V.Medal)를 지급하지 않음** (사용자 보상 선택 플로 대기).
  - 위가 아니고 **단일 재화 보상**이면서 금액이 잡히면, 카테고리 정책(People=V.Medal, 그 외=V.Credit)에 따라 **승인 즉시** 발신자(및 쌍방이면 수신자)에게 지급.
- **관리자 대시보드·이벤트 적립·매칭 (`getEventEarnedStats`)**:
  - 이벤트 승인으로 쌓인 적립은 `point_transactions`(type=`EARNED`, related_type=`EVENT`)를 제출→이벤트 카테고리로 묶어 **People V.Medal**, **V.Together V.Credit** 등으로 표시합니다(People이 예전 데이터로 V.Credit만 쌓인 경우도 합산에 포함).
  - **매칭금**: 기부 시 `donation_lot_allocations`에 기록된 금액 중, 출처 lot이 **`credit_lots.source_type = MEDAL_EXCHANGE`**(메달 상점에서 V.Credit으로 전환한 뒤 기부한 분)만 합산합니다.
  - **전체 모인금액**(대시보드 카드): **이벤트로 적립된 V.Credit 합(`totalCreditEarned`) + 위 매칭금**. UI 안내: "이벤트 Credit + 매칭금 (기부 가능 재원)". V.Medal 적립 총액은 같은 섹션의 **전체 사용자 적립**에서 Credit·Medal을 함께 표시합니다.

## 건강 챌린지 (마이그레이션 033·034·035·037, People 재화: V.Medal)

- **데이터 모델**: 활동·정산은 `health_challenge_*` 테이블. **시즌은 `/admin/events/new`에서 People 이벤트와 함께 생성하거나**, 이벤트 상세 `/admin/events/[eventId]`의 「건강 챌린지 룰」에서 시즌을 새로 붙일 수 있습니다. `health_challenge_seasons.event_id`로 이벤트와 1:1(034). **4종목(걷기·러닝·하이킹·라이딩)의 1회 최소 조건·월 누적 L1~L3·시즌 기간·ACTIVE 여부는 동일 이벤트 수정 페이지에서 편집**합니다.
- **참가 기준표 URL (035)**: `health_challenge_seasons.criteria_attachment_url` — PDF·이미지 등 공개 URL. 메인 건강 챌린지 영역에서 안내 링크로 쓸 수 있습니다.
- **메인**: 활성 시즌이 있으면 메인 「이벤트 & 챌린지」블록 **안**(필터 아래, 이벤트 카드 그리드 위)에 `#health-challenge`로 노출. 한 번에 **여러 건** 인증을 제출할 수 있고, **종목(블록)마다 사진을 여러 장** 첨부할 수 있습니다(`photo_urls` JSON 배열).
- **제출 정책(2026.03.31 업데이트)**: 건강 챌린지는 한 번의 제출에서 **같은 달의 여러 활동일을 달력으로 다중 선택**할 수 있습니다. 같은 달에 같은 종목을 여러 번 제출할 수 있지만, **같은 종목 + 같은 활동일** 조합은 중복 제출할 수 없습니다.
- **중복 방지 안전장치(2026.03.31)**: 서버 사전검증 외에 DB 유니크 인덱스(`037-health-log-unique-track-date.sql`, `uq_health_logs_user_track_activity_active`: `season_id, user_id, track_id, activity_date` + `deleted_at IS NULL` + `status IN (PENDING, APPROVED)`)로 동시 제출 레이스에서도 중복 행이 생기지 않게 막습니다. **반려(`REJECTED`)는 유니크 조건에서 제외**되어 동일 종목·같은 활동일로 **재제출** 가능합니다. 인덱스가 과거에 전체 유니크로만 잡혀 있었다면 `039-health-log-unique-allow-resubmit-after-reject.sql`로 DROP 후 부분 유니크를 재적용하세요.
- **개념 (레벨 달성)**: 건강 챌린지의 **레벨(L1~L3)** 은 RPG식「레벨 업」이 아니라, **월·종목별 누적 수치(거리·고도 등)로 그 달에 L1~L3 중 어디까지 달성했는지**를 나타냅니다.
- **심사(`/admin/verifications`)**: 활동 로그 승인 시 해당 활동일이 속한 **연·월** 롤업에 기여분을 더하고, 종목 임계값으로 `achieved_level`(0~3)을 다시 계산합니다. **승인 직전까지 달성해 있던 단계(`prevAchieved`)와 승인 후 달성 단계(`achieved`)의 차이** = **이번 승인으로 새로 달성한 단계 수**이며, 그만큼만 V.Medal을 **즉시** 지급합니다(시즌 연결 이벤트의 V_Medal 단가×단계, 없으면 레벨당 1M). **L1 최소 임계(첫 구간)에도 못 미치면** 달성 단계가 없으므로 지급이 없습니다.
- **월말 정산**: `/admin/health-challenges` 또는 인증 심사 화면에서 연·월 선택 후 실행하는 **배치 정산**입니다. 롤업 기준 사용자별 **종목 달성 레벨 합**에 맞춰 V.Medal을 지급(레벨 1당 1M 등, 이벤트 연결 시 단가·상한은 코드와 동일). `point_transactions`에 `related_type=HEALTH_CHALLENGE_SETTLEMENT`로 남깁니다. **해당 연·월·사용자에 이미 `PAID` 정산이 있으면** 재지급하지 않습니다(승인 즉시 지급으로 이미 정산된 경우 포함).
- **기본 종목·L1~L3**: 시즌 생성 시 서버가 기획표 기준 4종목·임계값을 자동 채웁니다(마이그레이션 시드 없음).

## Soft Delete (020 마이그레이션)

- 모든 테이블에 `deleted_at` 컬럼 추가. 데이터 삭제 시 실제 DELETE 대신 `deleted_at = NOW()`로 플래그 처리.
- 조회 시 `deleted_at IS NULL`인 행만 노출. 이벤트·구간·제출·기부·포인트 거래 등 모두 적용.

## 인증 방식 상세 (이벤트 제출)

- **항목 종류**: 사진 / 텍스트 / 숫자 / 동료 선택. 여러 개 조합 가능 (예: 텍스트 2개, 사진+텍스트, 동료 선택+텍스트).
- **제목(label)**: 모든 인증 방식에 공통. 관리자가 이벤트 등록 시 "제목 (심사 시 표시)"를 입력. 인증 심사·상세 보기에서 "(제목) - 제출답변" 형태로 표시. 비우면 방식명(사진/텍스트/숫자/동료 선택)으로 fallback.
- **`event_verification_methods.instruction`**: 직원에게 보여줄 안내 문구 (예: "이런 이런 사진을 제출하세요", "이런 숫자를 기재하세요").
- **`event_verification_methods.input_style`**: 단답(SHORT)=한 줄 입력, 장문(LONG)=여러 줄 입력, 객관식(CHOICE)=관리자가 정한 선택지 중 하나 선택. **텍스트(TEXT) 항목에만** 선택 가능 (마이그레이션 014, 031).
- **객관식(CHOICE) 인증**: 관리자가 선택지를 2개 이상 입력. 참여자는 그 중 하나를 선택. `event_verification_methods.options` JSONB에 선택지 문자열 배열 저장.
- **숫자(VALUE) 인증**: 숫자만 입력 가능 (단답/장문 옵션 없음). 제목(label)은 거리/속도/시간 등 항목명 선택 또는 직접 입력. `event_verification_methods.unit`: 단위 (예: km/h, km). 심사 화면에서 "거리: 34 km"처럼 표시.
- **숫자 입력 표시 규칙**: 웹 입력창에서는 타이핑 중 천 단위 콤마를 자동 표시 (`20000` → `20,000`). 서버 전송/검증 시에는 콤마를 제거한 순수 숫자로 변환.
- **사진 인증**: 업로드 파일은 Supabase Storage 버킷 `event-verification`에 저장. **최소 1장 필수** 제출. `verification_data`에 URL 배열로 저장. Supabase 대시보드 → Storage → New bucket → 이름 `event-verification`, Public 체크(또는 정책으로 인증 사용자 업로드 허용) 후 생성 필요.
- **칭찬 챌린지 동료 선택 확장 (2026.03.30)**: `PEER_SELECT` 인증은 단일 대상만이 아니라 **여러 명 동료 선택**을 지원. 제출 데이터는 `verification_data[method_id]`에 `{ peer_user_ids: string[], organization_name: string }` 형태로 저장하고, `peer_user_id` 컬럼에는 기존 하위호환을 위해 첫 번째 선택 동료를 함께 저장. 관리자 심사 화면에서는 "조직명 + 대표 동료 + 외 n명" 형태로 미리보기.
- **동료 선택 인원 정책 (2026.03.30)**: `PEER_SELECT` 항목의 `options`에 `SINGLE` 또는 `MULTIPLE` 저장. 관리자 등록 화면에서 항목별 선택(개인형/조직형) 가능. 참여 모달과 서버 제출 검증은 이 값을 기준으로 1명 제한 또는 다중 선택 허용을 강제.

## 이벤트 카드 버튼 표시 기준 (인증하기)

메인 **이벤트 & 챌린지** 카드 하단 버튼은 **인증하기**를 사용합니다. (참여하기 문구 없이 "인증하기"로 통일.)

| 버튼 | 표시 조건 |
|------|-----------|
| **인증하기** | **기간제(SEASONAL)**: 인증 가능(OPEN) 구간이 하나라도 있을 때. **상시(ALWAYS)**: 보상 대기 중인 제출이 없을 때(참여 가능 상태). |

- 기간제·상시 모두 제출 가능한 경우에는 "인증하기"만 노출합니다.

## Phase 3: V.Honors 랭킹 (명예의 전당)

- **표시**: 메인 페이지에만 **TOP 10** 개인 랭킹·팀 랭킹. 전체 보기 링크 및 전용 페이지 없음.
- **분기별 리셋**: 명예의 전당 랭킹은 **분기(Q1~Q4) 기준**으로 리셋됨. `donations` 테이블의 `created_at`으로 현재 분기 기부액만 집계하여 순위 산정.
- **누적 기부액 유지**: `users.total_donated_amount`는 계속 누적되며, **본인(마이페이지·대시보드)** 과 **관리자(사용자 목록)** 에서 확인 가능. ESG Level 산정·등급 배지도 누적 기준.

## ESG 레벨 구간 (누적 기부액, 2026.03.31)

- **기준**: `users.total_donated_amount`(순수 기부액, 포인트 적립액과 별개).
- **구간** (앱 UI `LevelRoadmapModal`·`DashboardSection`, 기부 시 레벨업 계산 `api/actions/donation.ts`, DB 함수 `calculate_esg_level` — 마이그레이션 **`038-update-level-thresholds-2026-03-31.sql`**):
  - **ECO_KEEPER**: 0 ~ 100,000
  - **GREEN_MASTER**: 100,001 ~ 150,000
  - **EARTH_HERO**: 150,001 ~
- **DB 동기화**: 038 실행 시 `public.calculate_esg_level` 갱신 후 삭제되지 않은 사용자의 `users.level`이 일괄 재계산됩니다. 마이그레이션 미적용이면 UI와 DB 트리거 기준 레벨이 어긋날 수 있습니다.

## MAU (월간 활성 사용자)

- **정의**: 최근 30일 이내에 한 번이라도 접속한 고유 사용자 수.
- **수집**: `users.last_active_at` — 로그인한 사용자(또는 테스트 유저)가 `getCurrentUser()`가 호출될 때마다 갱신.
- **관리자 대시보드**: "MAU (최근 30일)" 카드에 인원 수 표시. 마이그레이션 `016-users-last-active-at.sql` 미실행 시 "준비 중".

## 관리자 페이지 UX (편의·디자인)

- **대시보드 상단 카드**: "전사 누적 기부", "목표 달성률" 카드를 클릭하면 기부처 관리(`/admin/donation-targets`)로 이동합니다.
- **관리자 계정 테이블**: 이름·이메일 검색과 부서 필터로 사용자 목록을 좁혀 볼 수 있습니다. 필터 결과 인원 수가 "N명 / 전체 M명"으로 표시됩니다.
- **설정·운영 블록 순서**: 메인 화면 문구 → 포인트 지급 → 관리자 계정 → **테스트 데이터 초기화**(맨 아래). 위험한 초기화 작업은 스크롤 끝에 두어 실수 방지.
- **푸터**: 이용약관·개인정보처리방침 링크 자리 확보(현재 `#`). 실제 페이지 연동 시 href만 변경하면 됨.
- **빠른 링크**: 인증 심사·이벤트·쿠폰/굿즈 페이지 상단에 이벤트 관리·인증 심사·쿠폰/굿즈 발송·대시보드 링크 제공. 이벤트 목록·상세에서 "엑셀 다운로드"로 제출 목록 .xlsx 내려받기.

## 테스트용 포인트 부여 (내 계정에 P 넣기)

- **관리자 페이지** `/admin` 접속 후 **「포인트 지급 (기부 테스트용)」** 섹션으로 이동합니다.
- **대상 사용자** 드롭다운에서 본인 계정(이메일로 구분)을 선택합니다. (한 번도 로그인하지 않았다면 목록에 없으므로, 먼저 메인에서 Google 로그인을 한 번 해주세요.)
- **지급 포인트 (P)** 에 원하는 숫자(예: 10000)를 입력하고 **지급** 버튼을 누릅니다.
- 지급 후 메인 또는 마이페이지를 새로고침하면 보유 P와 게이지가 반영됩니다.

## 쿠폰/굿즈 발송 대상 (관리자)

- **페이지**: `/admin/reward-fulfillment`. 보상 선택에서 커피 쿠폰·굿즈를 고른 참여자 목록.
- **발송 완료 체크**: 각 행의 체크박스로 발송 완료 여부 표시. DB 컬럼 `event_submissions.non_point_fulfilled_at` (마이그레이션 017).
- **필터**: 전체 / 미발송 / 발송 완료 탭으로 목록 조회.

## 이벤트별 엑셀 다운로드 (관리자)

- **이벤트 목록** 또는 **이벤트 상세** 페이지에서 **엑셀 다운로드** 버튼 클릭 시, 해당 이벤트의 제출 목록(참여자명, 이메일, 구간, 상태, 제출일시, 보상유형, 반려사유, 인증요약)이 엑셀 파일(.xlsx)로 내려받기 됨.

## 에러 알림 (Google Chat Webhook)

- 서버/클라이언트 에러를 Google Chat으로 받기 위해 `GOOGLE_CHAT_WEBHOOK_URL` 환경 변수를 사용합니다.
- 관리자 운영 알림(예: 이벤트 승인 대기)은 `GOOGLE_CHAT_ADMIN_WEBHOOK_URL` 환경 변수로 별도 전송합니다.
- **클라이언트 에러**는 `app/global-error.tsx`에서 `/api/report-client-error`로 전송한 뒤, 서버에서 Chat Webhook으로 전달합니다. (웹훅 URL을 브라우저에 직접 노출하지 않음)
- **서버 에러**는 인증 관련 Route/Action의 실패 지점에서 `sendGoogleChatAlert()`를 호출해 알림을 보냅니다.
- 보안 정책: 웹훅 URL은 비밀 값이므로 `.env.local`/`.env`에만 저장하고, 코드/채팅/문서에 실제 URL을 남기지 않습니다.
