# vtogether 실서버 동적 보안 점검 리포트

- 대상: `https://vtogether-899896571605.asia-northeast3.run.app/` (Cloud Run, Next.js) + Supabase 프로젝트 `yvohwd***` (마스킹)
- 점검일: 2026-07-24
- 점검자: Claude Code (`/secure-check:live`)
- 범위: 비파괴적 런타임 점검 (헤더/경로/RLS/레이트리밋/CORS/SSRF). `ACCESS_TOKEN`(로그인 테스트 계정 JWT) 미제공 → 인증 필요 항목(#4, #6)은 **미실행**.

---

## 🚨 종합 등급: 🔴 CRITICAL (즉시 조치 필요)

가장 시급한 문제 하나(#5)가 **회사 구성원 215명의 이메일·이름·부서·관리자 여부**를 로그인 없이 인터넷 어디서든 열람 가능하게 만들고 있습니다. 나머지는 대부분 경미합니다.

---

## 1) 보안 헤더 (웹) — 🟠

```
GET https://vtogether-...run.app/  → 307 → /login (200)
```
`/login` 응답 헤더:
```
x-powered-by: Next.js
cache-control: private, no-cache, no-store, max-age=0, must-revalidate
```
- HSTS(`Strict-Transport-Security`): ❌ 없음
- CSP(`Content-Security-Policy`): ❌ 없음
- `X-Frame-Options` / CSP `frame-ancestors`: ❌ 없음 → 클릭재킹(Clickjacking) 방어 없음
- `X-Content-Type-Options: nosniff`: ❌ 없음
- `Referrer-Policy`: ❌ 없음
- `Permissions-Policy`: ❌ 없음
- `X-Powered-By: Next.js`: 🟡 존재 (내부 프레임워크 정보 노출)

**설명(쉬운 말)**: 브라우저에 "이 사이트는 항상 HTTPS로만, iframe에 넣지 마라, 콘텐츠 타입을 함부로 추측하지 마라"고 알려주는 보안 헤더가 하나도 없습니다. 당장 뚫리는 건 아니지만 클릭재킹·MIME 스니핑·프로토콜 다운그레이드 공격에 방어선이 없는 상태입니다.

**조치**:
- `next.config.js`에 `headers()` 설정 추가 (또는 미들웨어에서 일괄 적용):
  ```js
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Content-Security-Policy', value: "default-src 'self'; ..." },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  ```
- `next.config.js`에 `poweredByHeader: false` 추가해 `X-Powered-By` 제거.

---

## 2) 관리자/민감 경로 노출 — ✅ 양호

```
/admin /manage /console /api/admin /.env /.git/config /_next/webpack-hmr /api/health
→ 전부 307 → /login 리다이렉트 (미들웨어가 모든 경로를 로그인 벽 뒤로 감쌈)
```
`/.env`를 직접 요청해도 실제 파일 내용이 아니라 `/login?next=%2F.env` 로 리다이렉트되어 로그인 페이지 HTML만 반환됩니다. 정적 파일로서의 `.env`/`.git`은 서버에 노출되지 않습니다.

---

## 3) 소스맵 노출 — ✅ 양호

`/_next/static/chunks/main.js.map` → `404`. 프로덕션 소스맵 미노출.

---

## 4) Supabase RLS — 본인 데이터만 조회 — ⚪ 미실행

`ACCESS_TOKEN`(로그인 테스트 계정 JWT) 미제공으로 실행하지 않았습니다. 아래 명령으로 직접 확인 권장:
```bash
curl -s "https://<PROJECT_REF>.supabase.co/rest/v1/point_transactions?select=*" \
  -H "apikey: <ANON_KEY>" -H "Authorization: Bearer <내_로그인_JWT>" | jq 'length'
```

---

## 5) Supabase 익명 접근 차단 — 🔴 CRITICAL → ✅ 조치 완료 (2026-07-24)

```bash
curl -s "https://<PROJECT_REF>.supabase.co/rest/v1/users?select=*&limit=5" -H "apikey: <ANON_KEY>"
```
**결과**: 로그인·인증 토큰 전혀 없이 `anon` 키만으로 `public.users` 테이블 **전체 215행**이 그대로 반환됨 (`content-range: 0-214/215`).

노출 컬럼: `user_id, email, name, dept_name, current_points, total_donated_amount, level, created_at, updated_at, is_admin, last_active_at, deleted_at, current_medals`

즉 **전 직원의 사내 이메일·실명·소속 부서·관리자(is_admin) 여부·포인트/기부 내역**이 누구나(로그인조차 필요 없이) `curl` 한 줄로 전부 열람 가능합니다.

**근본 원인** — [docs/migrations/026-fix-rls-auth-initplan-and-merge-policies.sql:12-15](docs/migrations/026-fix-rls-auth-initplan-and-merge-policies.sql#L12-L15):
```sql
-- SELECT: 랭킹용 전체 조회 허용 (기존 "Public can view" + "Users can view own" 병합 → 모두 허용)
CREATE POLICY "Users can view own data or rankings"
  ON users FOR SELECT
  USING (true);
```
사내 랭킹(리더보드) 기능을 위해 `USING (true)`로 전체 허용 정책을 만들면서 `TO authenticated` 같은 역할 제한을 걸지 않았습니다. Supabase 기본 설정상 `anon` role도 `public.users`에 대한 SELECT 권한(grant)을 갖고 있어, 로그인하지 않은 익명 요청도 이 정책에 걸려 전체 행을 그대로 받습니다.

**즉시 조치 (SQL, Supabase SQL Editor에서 실행)**:
```sql
-- 1) 익명(anon) 역할의 익명 조회를 즉시 차단 (가장 빠른 응급 조치)
ALTER POLICY "Users can view own data or rankings" ON users TO authenticated;

-- 2) (권장) 랭킹에는 email/is_admin 등 민감 컬럼이 필요 없으므로,
--    랭킹 전용 뷰를 만들어 필요한 컬럼만 노출하고 users 테이블 직접 조회는 본인 행으로 제한
CREATE VIEW public.user_rankings AS
  SELECT user_id, name, dept_name, level, current_points, current_medals
  FROM public.users
  WHERE deleted_at IS NULL;

DROP POLICY "Users can view own data or rankings" ON users;
CREATE POLICY "Users can view own row"
  ON users FOR SELECT
  TO authenticated
  USING ((select auth.uid())::text = user_id);
```
1번만 적용해도 익명 접근은 즉시 차단됩니다. 다만 로그인한 **모든 내부 사용자**가 여전히 다른 직원의 이메일/`is_admin` 여부까지 볼 수 있는 점은 랭킹 기능 목적을 벗어나므로, 2번(뷰 분리)까지 함께 반영을 권장합니다.

**여담**: 같은 anon 키로 `point_transactions`, `event_submissions`, `shop_orders`, `user_notifications`는 정상적으로 빈 배열(`[]`)만 반환되어 해당 테이블들의 RLS는 올바르게 동작 중입니다. `users` 테이블만 예외적으로 뚫려 있는 상태입니다.

**✅ 조치 완료**: Supabase Management API로 프로덕션 DB에 `ALTER POLICY "Users can view own data or rankings" ON users TO authenticated;` 적용 (마이그레이션 파일: [docs/migrations/051-fix-users-select-anon-exposure.sql](docs/migrations/051-fix-users-select-anon-exposure.sql)).
- 적용 후 `pg_policies` 조회로 `roles = {authenticated}` 확인.
- anon key만으로 재요청 시 `[]` (빈 배열) 반환 확인 — 익명 접근 완전 차단.
- 랭킹 뷰 분리(2번, email/is_admin 등 민감 컬럼을 인증 사용자에게도 과도 노출하지 않도록)는 아직 미적용 — 후속 작업으로 권장.

---

## 6) 수직 권한 상승 (본인 role 변경 시도) — ⚪ 미실행

`ACCESS_TOKEN` 미제공으로 실행하지 않았습니다. #5 조치 후 로그인 테스트 계정으로 아래 확인 권장:
```bash
curl -s -o /dev/null -w "%{http_code}\n" -X PATCH \
  "https://<PROJECT_REF>.supabase.co/rest/v1/users?user_id=eq.<내_ID>" \
  -H "apikey: <ANON_KEY>" -H "Authorization: Bearer <내_JWT>" \
  -H "Content-Type: application/json" -d '{"is_admin":true}'
```
(#5의 SELECT `USING(true)`와 별개로 UPDATE 정책은 `auth.uid() = user_id`로 본인 행 제한은 걸려 있으나, `is_admin` 같은 민감 컬럼까지 자유롭게 UPDATE 가능한지는 컬럼 단위 제한이 없어 보이므로 실제 테스트 권장.)

---

## 7) 관리자 API 차단 (Supabase Auth) — ✅ 양호

```bash
curl -s "https://<PROJECT_REF>.supabase.co/auth/v1/admin/users" -H "apikey: <ANON_KEY>"
→ {"code":401,"error_code":"no_authorization","msg":"This endpoint requires a valid Bearer token"}
```
anon 키만으로는 관리자 API 접근 불가. 정상.

---

## 8) 정보 노출 — 에러 hint — 🟡

```bash
curl -s "https://<PROJECT_REF>.supabase.co/rest/v1/nonexistent_probe_zzz" -H "apikey: <ANON_KEY>"
→ {"hint":"Perhaps you meant the table 'public.event_rounds'", ...}
```
존재하지 않는 테이블명을 요청하면 PostgREST가 실제 내부 테이블명을 힌트로 알려줍니다 (`event_rounds`, `health_challenge_tracks` 등 확인됨). 공격자가 스키마를 추측·열거하는 데 도움을 줄 수 있는 낮은 수준의 정보 노출입니다. PostgREST 기본 동작이라 완전히 끄기는 어렵지만, 프로덕션에서는 API Gateway/프록시로 이런 에러 바디를 일반화된 메시지로 치환하는 것을 고려할 수 있습니다.

---

## 9) 레이트리밋 / 브루트포스 방어 — 🟠

존재하지 않는 더미 계정(`nonexistent-probe-secaudit@example.com`)으로 20회 연속 로그인 시도 → **20회 모두 `400`**, 429/423 없음.

**설명**: 짧은 시간에 20번을 때려도 잠기거나 막히는 신호가 보이지 않았습니다. Supabase Auth 플랫폼 차원의 rate limit(기본적으로 IP당 시간당 제한)이 백그라운드에 있을 수 있으나 이번 20회 범위에서는 드러나지 않았습니다. 실제 존재하는 계정 대상 브루트포스에 대한 서버측 잠금 여부는 별도 확인이 필요합니다(단, 실제 계정으로 테스트 시 계정 잠금을 유발할 수 있어 이번 점검에서는 수행하지 않았습니다).

**조치**: Supabase 대시보드 → Authentication → Rate Limits 설정을 확인하고, 필요시 애플리케이션 레벨에서 로그인 폼에 추가 지연/캡차(hCaptcha 등)를 고려하세요.

---

## 10) CORS 오설정 — ✅ N/A / 정상

- 앱 자체 API(`/api/report-client-error`)는 모든 요청이 미들웨어에서 `/login`으로 307 리다이렉트되어, CORS preflight가 실제 핸들러에 도달하기 전에 차단됩니다.
- Supabase REST(`/rest/v1/users`)는 `Access-Control-Allow-Origin: *`를 반환하지만, 이는 PostgREST의 기본 동작이며 인증이 **쿠키가 아닌 `Authorization: Bearer` 헤더**로 이뤄지므로 제3자 사이트가 피해자의 세션을 자동으로 얹어 보낼 수 없어 일반적인 CSRF 경로로는 악용되지 않습니다(단, #5의 anon 키 자체가 공개 정보라 익명 데이터는 어차피 누구나 조회 가능 — 근본 문제는 #5).

---

## 11) SSRF — Next.js 이미지 프록시 — ✅ 양호

```bash
curl ".../_next/image?url=http://169.254.169.254/latest/meta-data/&w=64&q=75" → 400
```
내부망/클라우드 메타데이터 주소로의 이미지 프록시 요청이 차단됩니다.

---

## 요약 표

| # | 항목 | 등급 |
|---|---|---|
| 1 | 보안 헤더 | 🟠 |
| 2 | 관리자/민감 경로 노출 | ✅ |
| 3 | 소스맵 노출 | ✅ |
| 4 | RLS 본인 데이터만 조회 | ⚪ 미실행 |
| 5 | Supabase 익명 접근 차단 (`users` 테이블) | 🔴 CRITICAL |
| 6 | 수직 권한 상승 | ⚪ 미실행 |
| 7 | 관리자 API 차단 | ✅ |
| 8 | 에러 hint 정보 노출 | 🟡 |
| 9 | 레이트리밋/브루트포스 방어 | 🟠 |
| 10 | CORS 오설정 | ✅ |
| 11 | SSRF (이미지 프록시) | ✅ |

---

## 가장 시급한 3가지

1. **[🔴 CRITICAL] `users` 테이블 익명 전체 노출** — 215명 전 직원 이메일/이름/부서/관리자여부가 인증 없이 공개 중. `docs/migrations/026-....sql:12-15`의 SELECT 정책에 `TO authenticated` 즉시 추가 (본 리포트 #5의 SQL 참고). **오늘 중 적용 권장.**
2. **[🟠] 보안 헤더 전무** — HSTS/CSP/X-Frame-Options 등 추가로 클릭재킹·다운그레이드 공격 표면 축소.
3. **[🟠] 로그인 브루트포스 방어 미확인** — Supabase Auth Rate Limit 설정 점검 + 로그인 폼 캡차/지연 고려.

---

## 참고
- 이번 점검은 `ACCESS_TOKEN`(로그인 세션) 없이 진행되어 #4, #6 (RLS 본인 데이터 제한, 권한 상승) 항목은 미실행입니다. #5 조치 후 로그인 테스트 계정으로 다시 확인하는 것을 권장합니다.
- 정적 코드 기반 점검(`/secure-check:audit`)과 교차 확인을 권장합니다 — 특히 다른 테이블에도 `USING (true)` 같은 과도하게 허용적인 RLS 정책이 있는지 전수 조사가 필요합니다 (`docs/migrations/*.sql` 안에 `USING (true)`로 검색).
- 자격증명(anon key, service role key 등)은 이 리포트에 평문으로 남기지 않았습니다.
