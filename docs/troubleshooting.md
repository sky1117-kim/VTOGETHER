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

## 인증 방식 저장 실패: input_style 컬럼을 찾을 수 없음

- **에러 메시지:** `인증 방식 저장 실패: Could not find the 'input_style' column of 'event_verification_methods' in the schema cache`
- **원인:** `event_verification_methods` 테이블에 **input_style** 컬럼이 없습니다. 새 이벤트 등록 시 인증 방식(단답/장문)을 저장하려다 실패합니다.
- **해결:** Supabase SQL Editor에서 **마이그레이션 014**를 실행하세요.
  - 파일: `docs/migrations/014-verification-input-style.sql`
  - 내용: `event_verification_methods` 테이블에 `input_style` 컬럼 추가 (TEXT, NULL 허용, 'SHORT'/'LONG' 값만 허용)
- 실행 후 이벤트 등록·수정 시 인증 방식 저장이 정상 동작합니다.

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
