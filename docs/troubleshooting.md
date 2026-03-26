# 트러블슈팅

## 마이그레이션 SQL 실행 방법 (Supabase)

`docs/migrations/*.sql` 파일을 적용할 때:

1. [Supabase 대시보드](https://supabase.com) 로그인 후 **프로젝트 선택**
2. 왼쪽 메뉴 **SQL Editor** 클릭
3. **New query** 로 새 쿼리 창 열기
4. 적용할 `.sql` 파일 내용 **전체 복사** → 에디터에 붙여넣기
5. **Run** 버튼(또는 `Ctrl+Enter` / `Cmd+Enter`)으로 실행

실행 후 Table Editor에서 해당 테이블을 열어 컬럼/데이터가 바뀌었는지 확인하면 됩니다.

**Phase 2 (이벤트 & 챌린지) 적용 시:**  
반드시 **`006-1-add-admin-column.sql`** 을 먼저 실행한 뒤 **`006-create-events-tables.sql`** 을 실행하세요.  
이미 예전에 `campaigns` 테이블을 만든 경우에만 **`010-rename-campaigns-to-events.sql`** 을 실행해 events로 바꾸세요.  
`users.is_admin` 컬럼이 없으면 events 테이블 RLS 정책에서 오류가 납니다.

**Supabase Lint (auth_rls_initplan, multiple_permissive_policies) 해결:**  
Database → Security Advisor / Performance Advisor에서 RLS 관련 경고가 뜨면 **`026-fix-rls-auth-initplan-and-merge-policies.sql`** 을 실행하세요.  
`auth.uid()` → `(select auth.uid())` 로 변경해 쿼리당 1회만 평가되도록 하고, 동일 role/action의 복수 정책을 OR 조건으로 병합합니다.

## My Status 진행률이 안 뜨거나 에러가 날 때

- **원인:** DB의 `users.level` 값이 `ECO_KEEPER`, `GREEN_MASTER`, `EARTH_HERO` 셋이 아니거나, 메인 문구(site_content)가 비어 있으면 카드/진행률이 깨질 수 있습니다.
- **해결:** 코드에서 이미 다음처럼 방어했습니다.
  - `level`은 세 값 중 하나로 보정해서 사용합니다 (그 외 값이면 `ECO_KEEPER`로 처리).
  - `hero_title` / `hero_subtitle` 등이 비어 있으면 기본 문구를 씁니다.
- 그래도 에러가 나면 브라우저 개발자 도구(F12) → Console 탭에서 빨간 에러 메시지를 확인해 보세요.

## "거래 내역 기록 실패" (기부 시)

- **원인:** `point_transactions` 테이블에 INSERT를 허용하는 RLS 정책이 없어서, 로그인한 사용자가 기부할 때 거래 내역 삽입이 막힙니다.
- **해결:** Supabase SQL Editor에서 아래 마이그레이션을 실행하세요.
  - 파일: `docs/migrations/008-point-transactions-insert-policy.sql`
  - 내용: `Users can insert own transactions` 정책 추가 (본인 `user_id`로만 INSERT 허용)
- 실행 후 기부 모달에서 다시 "기부하기"를 시도하면 정상 처리됩니다.

## 구간 저장 실패: submission_deadline 컬럼을 찾을 수 없음

- **에러 메시지:** `구간 저장 실패: Could not find the 'submission_deadline' column of 'event_rounds' in the schema cache`
- **원인:** `event_rounds` 테이블에 **인증 마감일** 컬럼(`submission_deadline`)이 없습니다. 기간제 이벤트에서 "해당 월 3구간 자동 생성"을 누를 때 이 컬럼에 값을 넣는데, 마이그레이션을 안 해두면 컬럼이 없어서 오류가 납니다.
- **해결:** Supabase SQL Editor에서 **마이그레이션 013**을 실행하세요.
  - 파일: `docs/migrations/013-event-rounds-submission-deadline.sql`
  - 내용: `event_rounds` 테이블에 `submission_deadline` 컬럼 추가 (TIMESTAMPTZ, NULL 허용)
- 실행 후 다시 "해당 월 3구간 자동 생성" 버튼을 누르면 정상 동작합니다.

## 소개문구·상태 수정 시 short_description 컬럼을 찾을 수 없음

- **에러 메시지:** `Could not find the 'short_description' column of 'events' in the schema cache`
- **원인:** `events` 테이블에 **짧은 소개** 컬럼(`short_description`)이 없습니다. 이벤트 수정 폼에서 이 값을 저장하려다 실패합니다.
- **해결:** Supabase SQL Editor에서 **마이그레이션 015**를 실행하세요.
  - 파일: `docs/migrations/015-events-short-description.sql`
  - 내용: `events` 테이블에 `short_description` 컬럼 추가 (TEXT, NULL 허용)
- 실행 후 이벤트 상세 페이지에서 "소개문구 · 상태 수정" 저장이 정상 동작합니다.

## 구간 저장 실패: duplicate key value violates unique constraint

- **에러 메시지:** `duplicate key value violates unique constraint "event_rounds_event_id_round_number_key"`
- **원인:** `event_rounds`의 기존 유니크 제약이 소프트 삭제(deleted_at)를 고려하지 않아, 삭제된 구간이 있어도 같은 번호로 새 구간을 추가할 수 없습니다.
- **해결:** Supabase SQL Editor에서 **마이그레이션 021**을 실행하세요.
  - 파일: `docs/migrations/021-event-rounds-partial-unique.sql`
  - 내용: 기존 유니크 제약 제거 후, `deleted_at IS NULL`인 행만 유일성 유지하는 부분 인덱스 생성
- ⚠️ **020-soft-delete-all-tables.sql**을 먼저 실행한 뒤 021을 실행하세요.

## column events.deleted_at does not exist

- **에러 메시지:** `column events.deleted_at does not exist`
- **원인:** `events` 및 관련 테이블에 **deleted_at** 컬럼(소프트 삭제용)이 없습니다. 코드에서 소프트 삭제를 사용하는데 마이그레이션이 적용되지 않았습니다.
- **해결:** Supabase SQL Editor에서 **마이그레이션 020**을 실행하세요.
  - 파일: `docs/migrations/020-soft-delete-all-tables.sql`
  - 내용: events, event_rounds, event_rewards, event_verification_methods, event_submissions 등에 `deleted_at` 컬럼 추가
- 실행 후 이벤트 목록·상세 조회 및 삭제가 정상 동작합니다.

## 인증 방식 저장 실패: unit 컬럼을 찾을 수 없음

- **에러 메시지:** `인증 방식 저장 실패: Could not find the 'unit' column of 'event_verification_methods' in the schema cache`
- **원인:** `event_verification_methods` 테이블에 **unit** 컬럼이 없습니다. 숫자(VALUE) 인증 방식에 단위(km/h 등)를 저장하려다 실패합니다.
- **해결:** Supabase SQL Editor에서 **마이그레이션 019**를 실행하세요.
  - 파일: `docs/migrations/019-verification-value-unit.sql`
  - 내용: `event_verification_methods` 테이블에 `unit` 컬럼 추가 (TEXT, NULL 허용)
- 실행 후 숫자 인증 방식에 단위 설정이 정상 동작합니다.

## 인증 방식 저장 실패: input_style 컬럼을 찾을 수 없음

- **에러 메시지:** `인증 방식 저장 실패: Could not find the 'input_style' column of 'event_verification_methods' in the schema cache`
- **원인:** `event_verification_methods` 테이블에 **input_style** 컬럼이 없습니다. 새 이벤트 등록 시 인증 방식(단답/장문/객관식)을 저장하려다 실패합니다.
- **해결:** Supabase SQL Editor에서 **마이그레이션 014**를 실행하세요.
  - 파일: `docs/migrations/014-verification-input-style.sql`
  - 내용: `event_verification_methods` 테이블에 `input_style` 컬럼 추가 (TEXT, NULL 허용, 'SHORT'/'LONG' 값만 허용)
- 실행 후 이벤트 등록·수정 시 인증 방식 저장이 정상 동작합니다.

## 인증 방식 저장 실패: options 컬럼을 찾을 수 없음 (객관식)

- **에러 메시지:** `인증 방식 저장 실패: Could not find the 'options' column of 'event_verification_methods' in the schema cache`
- **원인:** `event_verification_methods` 테이블에 **options** 컬럼이 없습니다. 객관식(CHOICE) 인증 방식을 저장하려다 실패합니다.
- **해결:** Supabase SQL Editor에서 **마이그레이션 031**을 실행하세요.
  - 파일: `docs/migrations/031-verification-choice-input-style.sql`
  - 내용: `input_style`에 'CHOICE' 추가, `options` JSONB 컬럼 추가

## 사진 업로드가 느릴 때 (직접 업로드로 속도 개선)

- **증상:** 이벤트 인증에서 사진 업로드가 오래 걸리거나 "업로드 중..."에서 멈춤.
- **원인:** 기존에는 브라우저 → Cloud Run → Supabase 경로로 업로드되어, Cloud Run을 경유하는 구간에서 지연이 발생할 수 있습니다.
- **해결:** Supabase SQL Editor에서 **마이그레이션 028**을 실행하세요.
  - 파일: `docs/migrations/028-storage-event-verification-upload-policy.sql`
  - 내용: 로그인한 사용자가 `event-verification` 버킷에 직접 업로드할 수 있는 Storage 정책 추가
  - 실행 후 브라우저 → Supabase 직접 업로드로 전환되어 속도가 개선됩니다. (정책이 없으면 기존 방식으로 폴백)

## Bucket not found (이벤트 인증 사진 업로드 시)

- **에러 메시지:** `Bucket not found` (이벤트 인증 모달에서 사진 선택 후 업로드할 때)
- **원인:** Supabase **Storage**에 인증 사진을 저장하는 버킷이 없습니다. 코드에서는 `event-verification` 이라는 이름의 버킷을 사용합니다.
- **해결:** Supabase 대시보드에서 버킷을 만들어 주세요.
  1. [Supabase 대시보드](https://supabase.com) → 프로젝트 선택
  2. 왼쪽 메뉴 **Storage** 클릭
  3. **New bucket** 버튼 클릭
  4. **Name**에 `event-verification` 입력 (이름을 정확히 맞춰야 합니다)
  5. **Public bucket**을 켜기 (인증 제출 후 이미지 URL을 화면에 보여주려면 공개 필요)
  6. **Create bucket** 클릭
- 생성 후 이벤트 인증 모달에서 다시 사진을 선택·업로드하면 정상 동작합니다.

## 테스트 유저 2가 이벤트 참여(사진 업로드 등)가 안 될 때

- **증상:** 테스트 유저 1은 이벤트 인증·사진 업로드가 되는데, 테스트 유저 2는 모든 이벤트에서 실패함. "업로드 중..."에서 멈추거나 제출 시 에러.
- **원인:** `event_submissions` 테이블의 `user_id`가 `users(user_id)`를 참조합니다. **테스트 유저 2가 `users` 테이블에 없으면** 제출이 FK(외래키) 위반으로 실패합니다. 로그인 시 auth 콜백에서 users에 자동 등록되지만, 이전에 RLS 등으로 upsert가 실패했을 수 있습니다.
- **해결:**
  1. **코드 수정 반영:** auth 콜백이 이제 admin 클라이언트로 users upsert를 수행합니다. 최신 코드로 배포 후, **테스트 유저 2로 로그아웃 → 다시 로그인**하면 users에 자동 등록됩니다.
  2. **수동 등록:** Supabase **Table Editor** → **users**에서 테스트 유저 2의 `user_id`(Supabase Auth의 UUID)가 있는지 확인하세요. 없으면 아래 SQL로 추가할 수 있습니다.
     ```sql
     -- Supabase Auth 사용자 ID는 Authentication → Users에서 확인
     INSERT INTO users (user_id, email, name, dept_name, current_points, total_donated_amount, level)
     VALUES ('여기에_Supabase_Auth_UUID', 'test2@vntgcorp.com', '테스트유저2', NULL, 0, 0, 'ECO_KEEPER')
     ON CONFLICT (user_id) DO NOTHING;
     ```
  3. **Storage 버킷:** 사진 업로드가 "업로드 중..."에서 멈추면 `event-verification` 버킷이 있는지, Public인지 확인하세요. (위 "Bucket not found" 항목 참고)

## 인증 승인 후 아무것도 진행이 안 될 때

- **증상:** 제출 후 관리자가 승인했는데, 포인트가 안 들어오거나 "보상받기" 버튼이 안 보임.
- **원인:** 1) 페이지가 새로고침되지 않아 이전 상태가 보임. 2) 이벤트에 보상(V.Credit 등)이 없거나, 복수 보상이면 사용자가 직접 선택해야 함.
- **해결:**
  1. **페이지 새로고침:** 메인 페이지를 새로고침(F5)하거나 탭을 전환했다가 다시 돌아오면 최신 상태가 반영됩니다. (탭 전환 시 자동 갱신됨)
  2. **보상받기 클릭:** 복수 보상(V.Credit + 커피쿠폰 등)이면 승인 후 즉시 지급되지 않습니다. 메인 카드에서 **"보상받기"** 버튼을 눌러 받을 보상을 선택하세요.
  3. **이벤트 보상 확인:** 관리자 페이지에서 해당 이벤트의 보상이 등록되어 있는지 확인하세요. event_rewards에 V.Credit 등이 없으면 포인트가 지급되지 않습니다.

## 세아웍스 API "This operation was aborted" (타임아웃)

- **증상:** 디버그 API에서 `error: "This operation was aborted"` 반환
- **원인:** 세아웍스 API가 20초 내에 응답하지 않음. Cloud Run에서 세아웍스 개발 서버로의 접근이 막혀 있거나, API가 사내망 전용일 수 있음.
- **해결:**
  1. **VNTG 그룹웨어서비스팀(정선우 담당자)** 에 문의: Cloud Run(Google IP)에서 `devapi-seahworks.seah.co.kr` 접근이 가능한지, IP 화이트리스트 등이 필요한지 확인
  2. **로컬에서 테스트:** `npm run dev` 후 `http://localhost:3000/api/debug/seah-orgsync` 호출 — 사내망에서 실행 시 접근 가능할 수 있음
  3. **운영 API 사용:** 개발 API 대신 운영 API URL로 전환 (정의서의 운영 서버 URL + GW_PRD_ORGSYNC 계정)

## 로그인 시 HTTP 500 에러 (개발 서버 / Cloud Run)

- **증상:** 로그인 후 "페이지가 작동하지 않습니다" (HTTP ERROR 500)
- **원인:** 세아웍스 API 연동 시 환경 변수 미설정 또는 API 호출 실패
- **해결:**
  1. **Cloud Run 배포 시:** `.env`에 `SEAH_ORGSYNC_USER_API_URL`, `SEAH_ORGSYNC_USERNAME`, `SEAH_ORGSYNC_PASSWORD`가 있으면 배포 스크립트가 자동 포함합니다. 없으면 부서 동기화만 스킵되고 로그인은 정상 동작합니다.
  2. **여전히 500이면:** Cloud Run 로그 확인 (`gcloud run services logs read vtogether --region=asia-northeast3`) — 실제 에러 메시지 확인.
  3. **세아웍스 API 비활성화:** 부서 동기화가 필요 없으면 `.env`에서 `SEAH_ORGSYNC_*` 변수를 제거하면 API 호출을 건너뜁니다.

## Google Chat 알림이 오지 않을 때

- **증상:** 서버에서 에러가 나거나 `global-error` 화면이 떠도 Google Chat에 메시지가 오지 않음
- **원인 후보:**
  1. `GOOGLE_CHAT_WEBHOOK_URL` 환경 변수 누락
  2. `.env`에 URL을 따옴표 없이 넣어서(`&` 포함) 쉘에서 값이 깨짐
  3. Cloud Run 최신 리비전에 환경 변수가 반영되지 않음
- **해결:**
  1. `.env`/`.env.local`에 아래처럼 저장
     - `GOOGLE_CHAT_WEBHOOK_URL='https://chat.googleapis.com/v1/spaces/...&token=...'`
  2. `npm run deploy`로 재배포
  3. Cloud Run에서 변수 반영 확인
     - `gcloud run services describe vtogether --region asia-northeast3 --format="value(spec.template.spec.containers[0].env[].name)"`
     - 출력에 `GOOGLE_CHAT_WEBHOOK_URL` 포함 여부 확인
