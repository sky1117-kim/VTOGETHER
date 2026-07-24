# 🔒 보안 점검 리포트 — vtogether
점검일: 2026-07-24 | 환경: Next.js 16 (App Router) + Supabase(Auth/SSR/RLS), GCP Cloud Run 배포 | LLM/AI SDK: 미사용 | 대상: 프로젝트 루트 전체 | 점검 방식: 정적 코드 분석 (네트워크 요청 없음)

## 1. 요약

- **종합 위험 등급: D (위험)** — 지금 이대로 두면 로그인한 일반 임직원 누구나 관리자 기능(운영 데이터 삭제·전사 개인정보 조회·공지 위·변조)을 실행할 수 있습니다. 다만 이미 구현된 부분(인증 방식, XSS 방어, 기부금 처리 로직 등)은 상당히 신경 써서 만들어졌고, 고쳐야 할 패턴 자체도 코드베이스 안에 이미 정답이 있어 수정 난이도는 낮은 편입니다.
- **발견 현황**: 🔴 CRITICAL 3 / 🟠 HIGH 6 / 🟡 MEDIUM 11 / ⚪ LOW 7 / ✅ 양호 다수(카테고리별 상세 참고)
- **카테고리별 결과 요약**

| 카테고리 | 상태 | 핵심 내용 |
|---|---|---|
| A. 비밀정보/자격증명 | 🟡 | .env 미커밋(양호), 배포 스크립트가 일부 시크릿을 평문 환경변수로 전달 |
| B. 접근제어/인가 | 🔴 | 관리자 전용 서버 액션 다수가 인가 검사 없음 — **최우선 조치 대상** |
| C. 인증/세션 | 🟠 | 로그인 성공 직후 흐름을 노리는 오픈 리다이렉트 |
| D. 인젝션 | 🟡 | 검색 필터 문자열 이스케이프 미흡(관리자 전용, 실질 위험 낮음) |
| E. XSS | ✅ | 유일한 innerHTML 사용처가 DOMPurify로 적절히 방어됨 |
| F. 암호화 | ✅ | 평문 민감정보 저장 없음, 경미한 개선점만 존재 |
| G. 보안헤더/CORS/설정 | 🟠 | CSP·X-Frame-Options 등 보안 헤더 전무 |
| H. 입력검증/파일업로드 | 🟡 | 업로드 파일 검증이 클라이언트 선언값에만 의존 |
| I. SSRF/오픈리다이렉트 | 🟠 | C와 동일 이슈(오픈 리다이렉트), 그 외 양호 |
| J. 로깅/민감데이터 | ⚪ | 토큰/비밀번호 로그 노출 없음, 경미한 개선점만 존재 |
| K. 의존성/공급망 | 🟠 | Next.js·DOMPurify 등 주요 의존성 구버전(알려진 CVE 다수) |
| L. 레이트리밋 | 🟡 | 전 구간에 서버측 요청 제한 없음 |
| M. 비즈니스 로직 | 🟡 | 상점 구매 잔액/재고 차감이 원자적이지 않음(경쟁조건) |
| N. AI/LLM | N/A | LLM/AI SDK 미사용 |

- **깨진 설계 원칙 요약**: ① **완전한 중재(complete mediation) 실패** — "관리자 페이지 진입만 막으면 된다"는 잘못된 가정으로, Next.js Server Action이 그 자체로 독립된 호출 가능 엔드포인트라는 점을 놓쳐 다수의 관리자 기능이 무방비 상태입니다. ② **일관성 없는 방어(defense inconsistency)** — 같은 파일·같은 패턴의 함수인데 어떤 것은 인가 검사가 있고 어떤 것은 없어, "팀이 올바른 패턴을 알고 있었지만 일부 함수에 적용을 빠뜨렸다"는 것이 반복적으로 확인됩니다.

## 2. 🚨 즉시 조치가 필요한 항목 (CRITICAL/HIGH)

### [SEC-B-01] `resetAndSeedTestData()` — 인가 검사 없이 운영 데이터 전체 삭제 가능 — 🔴 CRITICAL
- **무엇이 문제인가**: 관리자 대시보드의 "테스트 데이터 초기화" 버튼 뒤에 있는 서버 함수에 로그인 여부·관리자 여부를 확인하는 코드가 단 한 줄도 없습니다.
- **왜 위험한가**: 로그인만 되어 있으면(일반 직원이어도) 이 기능을 브라우저 개발자 도구 없이도 직접 호출할 수 있고, 실행되면 전 직원의 포인트·기부 거래 내역이 통째로 삭제되고 포인트·메달이 0으로 초기화됩니다. 실서비스 데이터가 순식간에 파괴될 수 있습니다.
- **깨진 원칙**: 완전한 중재, 기본 거부(default-deny)
- **근거(위치)**: `api/actions/admin.ts:1439`
```ts
export async function resetAndSeedTestData(): Promise<{ success: boolean; error: string | null }> {
  const supabase = createAdminClient()   // ← 호출자 인증/인가 검사 없이 바로 실행
  await supabase.from('point_transactions').update({ deleted_at: now }).is('deleted_at', null)
  await supabase.from('donations').update({ deleted_at: now }).is('deleted_at', null)
  ...
```
- **조치 방법**: 같은 파일 내 `grantPoints` 등이 이미 쓰고 있는 패턴을 그대로 재사용하세요.
```ts
async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, error: '로그인이 필요합니다.' }
  const admin = createAdminClient()
  const { data: me } = await admin.from('users').select('is_admin').eq('user_id', user.id).is('deleted_at', null).maybeSingle()
  if (!me?.is_admin) return { ok: false as const, error: '관리자 권한이 필요합니다.' }
  return { ok: true as const, userId: user.id }
}

export async function resetAndSeedTestData() {
  const auth = await requireAdmin()
  if (!auth.ok) return { success: false, error: auth.error }
  if (process.env.NODE_ENV === 'production') {
    return { success: false, error: '운영 환경에서는 사용할 수 없습니다.' }
  }
  // 기존 로직...
}
```

### [SEC-B-02] `api/actions/admin.ts` 다수 함수 — 인가 검사 없이 전사 개인정보 열람·핵심 콘텐츠 변조 — 🔴 CRITICAL
- **무엇이 문제인가**: 같은 파일 안에서 `grantPoints`/`updateUserAdmin`/`deleteUserAccountByAdmin` 등 6개 함수는 관리자 검증이 정확히 되어 있는데, **아래 17개 함수는 전혀 없습니다.**
  - 조회(PII 유출): `getUsersForAdmin`, `getPointTransactionsForAdmin`, `getRecentActiveUsersForAdmin`, `getAdminDashboardStats`, `getDonationAmountsByPeriod`, `getEventEarnedStats`, `getMatchingAmountByTarget`, `getOverTargetDonors`, `getEventsForRewardFulfillment`, `getNonPointRewardFulfillmentList`, `getSiteContentForAdmin`
  - 변경(위·변조): `setRewardFulfillment`, `updateSiteContent`, `uploadPopupImage`, `syncPopupToNoticeManual`
- **왜 위험한가**: 로그인한 임직원 누구나 전 직원의 이메일·이름·부서·포인트·메달·기부액을 열람하거나, 홈페이지 배너/팝업 내용을 바꾸거나, 보상 발송 상태를 조작할 수 있습니다.
- **깨진 원칙**: 완전한 중재, 최소권한
- **근거(위치)**: `api/actions/admin.ts:50` (`getUsersForAdmin`)
```ts
export async function getUsersForAdmin(...) {
  const supabase = createAdminClient()   // ← 인증 검사 없음, service-role로 바로 조회
  const { data } = await supabase.from('users').select('user_id, email, name, dept_name, current_points, ...')
```
- **조치 방법**: SEC-B-01과 동일한 `requireAdmin()` 가드를 위 17개 함수 각각의 시작부에 추가하세요.

### [SEC-B-03] `api/actions/admin/donation-targets.ts` — 파일 전체 인가 검사 없음, 기부금액 임의 조작 가능 — 🔴 CRITICAL
- **무엇이 문제인가**: `getDonationTargetsForAdmin`, `updateDonationTargetAmount`, `addOfflineDonation` 3개 함수 모두 `auth.getUser()` 호출 자체가 없습니다.
- **왜 위험한가**: 로그인한 직원이면 누구나 `addOfflineDonation()`을 직접 호출해 기부처의 현재 모금액을 부풀리고 "목표 달성" 상태로 바꾸거나, `updateDonationTargetAmount()`로 목표 금액 자체를 바꿀 수 있습니다. 사내 공개 대시보드에 노출되는 신뢰도 있는 수치가 조작됩니다.
- **깨진 원칙**: 최소권한, 기본 거부
- **근거(위치)**: `api/actions/admin/donation-targets.ts:63-96`
```ts
export async function addOfflineDonation(targetId: string, amount: number) {
  if (amount <= 0 || !Number.isInteger(amount)) { ... }
  const supabase = createAdminClient()   // ← 인증 검사 없음
  const newAmount = (row.current_amount ?? 0) + amount
  await supabase.from('donation_targets').update({ current_amount: newAmount, status: newStatus }).eq('target_id', targetId)
```
- **조치 방법**: 같은 폴더의 `api/actions/admin/events.ts:30-46`에 있는 `requireAdmin()` 헬퍼를 가져와 3개 함수 전부에 적용하세요.

### [SEC-B-04] `api/actions/notices.ts` 관리자 섹션 — 공지/팝업 임의 생성·수정·삭제 가능 — 🟠 HIGH
- **무엇이 문제인가**: 코드 주석에 `// ── 관리자 액션 ──`이라 명시했지만, `createNotice`, `updateNotice`, `deleteNotice`, `toggleNoticePopup`, `getNoticesForAdmin`, `fetchMentionableUsers` 6개 함수 전부 인증 검사가 없습니다.
- **왜 위험한가**: 로그인한 직원이면 누구나 회사 공지사항을 생성·삭제하거나 팝업 배너를 조작할 수 있어, 사내 허위 공지·피싱 게시에 악용될 수 있습니다.
- **깨진 원칙**: 기본 거부
- **근거(위치)**: `api/actions/notices.ts:191-197`
```ts
export async function deleteNotice(id: string): Promise<{ error: string | null }> {
  const supabase = createAdminClient()   // ← 인증 검사 없음
  const { error } = await supabase.from('notices').delete().eq('id', id)
```
- **조치 방법**: 같은 파일의 `toggleNoticeLike`/`addNoticeComment`(사용자 액션)는 로그인 체크가 정상이니, 관리자 6개 함수에도 `requireAdmin()` 가드를 추가하세요.

### [SEC-B-05] `api/actions/admin/shop-orders.ts` — `getShopOrdersForAdmin`에만 인가 검사 누락 — 🟠 HIGH
- **무엇이 문제인가**: 같은 파일의 `setShopOrderFulfillment`(158줄)는 로그인+관리자 이중 검증이 정확한데, `getShopOrdersForAdmin`(26줄)만 빠져 있습니다.
- **왜 위험한가**: 로그인한 직원이면 누구나 전 직원의 상점 구매 내역과 이름/이메일/부서(PII)를 조회할 수 있습니다.
- **깨진 원칙**: 완전한 중재(같은 파일 안에서도 함수별로 방어가 누락될 수 있음을 보여주는 사례)
- **근거(위치)**: `api/actions/admin/shop-orders.ts:26-50`
- **조치 방법**: 동일 파일의 `setShopOrderFulfillment`가 쓰는 인증 패턴을 그대로 `getShopOrdersForAdmin` 앞부분에 추가하세요.

### [SEC-C-01 / SEC-I-01] 로그인/OAuth 콜백 오픈 리다이렉트 — `//evil.com` 우회 — 🟠 HIGH
- **무엇이 문제인가**: 로그인 후 이동할 페이지(`next` 파라미터)가 안전한지 검사할 때 `path.startsWith('/')`만 확인합니다. 그런데 `//evil.com`도 `/`로 시작하는 문자열이라 이 검사를 통과하며, 브라우저는 `//`로 시작하는 문자열을 **다른 사이트의 주소**로 해석합니다.
- **왜 위험한가**: 회사의 실제 로그인 주소로 시작하는 링크(`https://vtogether.../login?next=//evil.com`)를 사내 메일/메신저로 보내면, 피해자는 정상적으로 구글 로그인을 거친 뒤(회사 도메인만 허용되므로 의심하지 않음) 최종적으로 외부 피싱 사이트로 자동 이동합니다. "신뢰하는 사내 로그인"이라는 정황을 그대로 악용하는 피싱에 매우 효과적입니다.
- **깨진 원칙**: 완전한 중재(신뢰 경계를 문자열 접두사 검사 하나로 잘못 판단)
- **근거(위치)**: `app/auth/callback/route.ts:21-24, 50-51`
```ts
function toSameOriginRedirect(path: string, requestUrl: URL) {
  const safePath = path.startsWith('/') ? path : '/'
  return new URL(safePath, requestUrl.origin)   // '//evil.com' → https://evil.com 으로 해석됨
}
```
동일 패턴이 `app/(auth)/login/page.tsx:20`, `app/(auth)/login/LoginForm.tsx:59-66`에도 있습니다.
- **조치 방법**: 아래 공통 유틸을 만들어 3개 파일 모두에 적용하세요.
```ts
// lib/safe-redirect.ts
export function isSafeNextPath(next?: string | null): next is string {
  if (!next) return false
  if (!next.startsWith('/')) return false
  if (next.startsWith('//')) return false   // 프로토콜 상대 URL 차단
  if (next.startsWith('/\\')) return false  // 백슬래시 우회 차단
  return true
}
// 사용
redirect(isSafeNextPath(next) ? next : '/')
```

### [SEC-G-01] 보안 응답 헤더가 전혀 설정되어 있지 않음 — 🟠 HIGH
- **무엇이 문제인가**: `next.config.ts`에 `headers()` 설정이 없어 HSTS, X-Frame-Options, Content-Security-Policy, X-Content-Type-Options, Referrer-Policy, Permissions-Policy가 전부 응답에 포함되지 않습니다. Next.js는 이 헤더들을 어떤 버전에서도 자동으로 추가해주지 않습니다.
- **왜 위험한가**: 로그인 세션과 관리자 화면이 있는 서비스에서 `X-Frame-Options`/CSP `frame-ancestors`가 없으면 관리자 화면을 투명 iframe에 숨겨 클릭을 유도하는 클릭재킹 공격에 노출됩니다. CSP가 없으면 만에 하나 XSS가 발생했을 때 피해를 막아줄 마지막 방어선이 없는 셈이고, HSTS가 없으면 최초 HTTP 접속 시 다운그레이드 공격 여지가 생깁니다. 특히 위 SEC-B 항목들(무방비 관리자 기능)과 결합되면 클릭재킹으로 관리자 액션을 유도하는 공격 사슬이 가능해집니다.
- **깨진 원칙**: 안전한 실패(심층 방어의 마지막 층이 비어 있음)
- **근거(위치)**: `next.config.ts` 전체 (headers() 함수 부재)
- **조치 방법**:
```ts
// next.config.ts
const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
      ],
    }]
  },
  // ...기존 설정
}
```
CSP는 사용 중인 GA/third-parties 스크립트와 Supabase storage 도메인을 반영해 점진적으로 도입하는 것을 권장합니다(바로 엄격하게 적용하면 기존 기능이 깨질 수 있음).

### [SEC-K-01] Next.js 16.1.6 — 다수의 High severity CVE (미들웨어 우회·CSRF 우회·SSRF) — 🟠 HIGH
- **무엇이 문제인가**: 설치된 `next@16.1.6`은 `npm audit` 기준 다수의 high severity 취약점 범위에 포함됩니다.
- **왜 위험한가**: 이 앱은 로그인 여부 확인을 사실상 `middleware.ts` 하나에 의존하는데, 알려진 CVE 중 일부가 미들웨어 우회를 가능하게 합니다(다행히 `app/admin/layout.tsx` 등 일부 민감 페이지는 자체적으로도 세션을 재검증해 완전 우회는 아님). 그 외에도 Server Actions CSRF null-origin 우회, Server Actions/rewrites 관련 SSRF 취약점이 포함되어 있습니다.
- **깨진 원칙**: 안전한 실패, 신뢰 경계(프레임워크 자체의 방어선이 약화됨)
- **근거**: `package.json`의 `"next": "16.1.6"`, `npm audit --production` 결과 next 관련 high severity 다건
- **조치 방법**: `npm install next@16.2.11`(또는 그 이상, non-major 업그레이드로 fixAvailable 확인됨) 후 회귀 테스트.

### [SEC-K-02] DOMPurify(isomorphic-dompurify) 구버전 — 유일한 XSS 방어선이 노후화 — 🟠 HIGH
- **무엇이 문제인가**: 코드베이스에서 사용자 입력을 HTML로 렌더링하는 유일한 지점(`components/main/EventInfoModal.tsx`)이 DOMPurify로 안전하게 방어되고 있는데, 설치된 dompurify 버전(3.3.1)이 구버전이라 알려진 우회 취약점(FORBID_TAGS 우회, 프로토타입 오염 등) 범위에 포함됩니다.
- **왜 위험한가**: 지금 당장 XSS가 발생하는 것은 아니지만(사용 방식 자체는 올바름), 이 라이브러리가 뚫리면 코드베이스의 XSS 방어가 통째로 무력화됩니다.
- **깨진 원칙**: 안전한 실패(단일 방어선의 신뢰성)
- **근거**: `package.json`의 `"isomorphic-dompurify": "^3.0.0-rc.2"`, 실제 설치된 dompurify 3.3.1
- **조치 방법**: `npm install isomorphic-dompurify@latest` 후 `npm ls dompurify`로 3.4.7 이상 확보 여부 확인.

## 3. 카테고리별 상세 결과

### A. 비밀정보·자격증명 — 🟡 MEDIUM
- ✅ **양호**: `.env`, `.env.local`은 git에 커밋되어 있지 않음(`git ls-files`로 확인, `.env.example`만 추적됨, 더미 값만 포함). `SUPABASE_SERVICE_ROLE_KEY`는 GCP Secret Manager로 관리되고 Cloud Run에는 `--set-secrets`로 전달됨(`scripts/setup-secrets.sh`, `scripts/deploy.sh`). 소스 전체에서 하드코딩된 API 키/개인키 패턴 검색 결과 0건.
- **[SEC-A-01] MEDIUM** — `scripts/deploy.sh`가 `SEAH_ORGSYNC_PASSWORD`, `SMTP_PASS`, `GOOGLE_CHAT_WEBHOOK_URL`을 `--set-env-vars`(평문)로 Cloud Run에 전달합니다(`SUPABASE_SERVICE_ROLE_KEY`만 Secret Manager 사용). Cloud Run 콘솔이나 `gcloud run services describe`를 조회할 수 있는 IAM 권한자라면 누구나 이 값을 평문으로 열람할 수 있습니다. DB 직접 유출 수준은 아니지만(서비스 롤 키는 안전), 사내 인사 API 계정·메일 발신 계정이 유출되면 피싱 발신 등 부차 피해가 가능합니다.
  - 근거: `scripts/deploy.sh:84-134`
  - 조치: 기존 `SUPABASE_SERVICE_ROLE_KEY` 패턴처럼 나머지 3개도 Secret Manager로 이전.
```bash
gcloud secrets create seah-orgsync-password --data-file=- <<< "$SEAH_ORGSYNC_PASSWORD"
gcloud secrets create smtp-pass --data-file=- <<< "$SMTP_PASS"
gcloud secrets create google-chat-webhook-url --data-file=- <<< "$GOOGLE_CHAT_WEBHOOK_URL"
# deploy.sh의 --set-secrets에 추가
```

### B. 접근제어·인가 — 🔴 CRITICAL (2절 참고)
CRITICAL 3건(SEC-B-01~03), HIGH 2건(SEC-B-04~05) 외 추가:
- **[SEC-B-06] MEDIUM** — `api/actions/admin/shop-products.ts`의 `getShopProductsForAdmin`, `api/actions/admin/health-challenges.ts`의 `getLinkedHealthSeasonForEvent`에만 각각 `requireAdmin()`/`assertIsAdmin()`이 누락됨(같은 파일의 다른 함수들은 모두 정상 적용). 노출 데이터 민감도는 낮으나(비활성 상품, 시즌 설정값), 일관성 결여 자체가 구조적 위험 신호입니다. → 누락된 한 줄만 추가.
- **[SEC-B-07] MEDIUM** — `api/actions/admin/seah-orgsync.ts`의 `syncSeahOrgsyncSnapshot`이 `'use server'` 함수로도 export되어 있어, 크론 전용 시크릿(`SEAH_ORGSYNC_CRON_SECRET`) 없이 로그인한 직원이 직접 호출할 수 있습니다. 이 함수는 외부 인사 API를 호출하고 퇴사자를 자동 비활성화하는 부수효과가 있어 남용 시 외부 API 부하·의도치 않은 계정 비활성화로 이어질 수 있습니다. → `requireAdmin()` 추가 또는 내부 함수로 격리.
- ✅ **양호(모범 사례)**: `app/admin/layout.tsx`(로그인+`is_admin` 이중 리다이렉트), `api/actions/admin/events.ts`(10개 함수 전부 `requireAdmin()` 일관 적용, 클라이언트가 보낸 `_createdBy`를 무시하고 서버 검증값 사용), `api/actions/admin/verifications.ts`(8개 함수 전부 `requireAdminReviewer()` 적용), `admin.ts`의 `grantPoints`/`grantMedals`/`updateUserAdmin`/`deleteUserAccountByAdmin`/`revertAdminGrantTransaction`/`grantCurrencyBatchToUsers`(정확한 이중 검증). IDOR 관점에서 `donation.ts`/`shop.ts`/`events.ts`/`health-challenges.ts`의 사용자 액션은 전부 세션의 `user.id`만 사용하고 클라이언트가 보낸 `userId`를 신뢰하지 않음(양호).

### C. 인증·세션 관리 — 🟠 HIGH
HIGH 1건(SEC-C-01, 2절 참고) 외 추가:
- **[SEC-C-02] MEDIUM** — `api/actions/donation.ts`의 `donatePoints()`는 게스트 테스트 우회(`GUEST_TEST_USER_ID`)를 사용할 때 `NODE_ENV` 검사가 없습니다. 반면 같은 목적의 `api/actions/auth.ts`의 `getCurrentUser()`는 `process.env.NODE_ENV !== 'production'`으로 명시적으로 운영 환경을 차단합니다. 지금은 미들웨어가 비로그인 요청을 `/login`으로 리다이렉트하므로 즉시 악용은 어렵지만, 단일 방어선(미들웨어)에만 의존하는 구조입니다.
  - 근거: `api/actions/donation.ts:8, 27-44` vs `api/actions/auth.ts:67-70`
  - 조치: `donation.ts`에도 `const allowGuestTestUser = process.env.NODE_ENV !== 'production'` 가드 추가.
- **[SEC-C-03] LOW / ⚠️확인필요** — `app/api/cron/seah-orgsync/route.ts:17-19`의 크론 시크릿 비교가 `!==` 단순 비교로, 이론적으로 타이밍 공격 여지가 있습니다(실제 악용 난이도는 높음). `crypto.timingSafeEqual` 사용 권장.
- ✅ **양호**: 자체 비밀번호 인증이 없고 Google OAuth(PKCE)만 사용해 사용자 열거(enumeration) 위험 자체가 낮음. `app/auth/callback/route.ts:131`에서 `@vntgcorp.com` 도메인 제한을 클라이언트 힌트가 아닌 **서버에서 재검증**(모범 사례). 백도어/우회 패턴(`bypass`, `SKIP_AUTH`, 하드코딩된 관리자 이메일) 전수 검색 결과 0건. 쿠키 옵션(`secure`/`httpOnly`/`sameSite`)을 임의로 약화시킨 곳 없음.

### D. 인젝션 — 🟡 MEDIUM
- **[SEC-D-01] MEDIUM** — Supabase의 `.or()` 필터는 `column.op.value` 형식의 원문 문법 문자열을 파싱하는데, 여기에 사용자 입력을 이스케이프 없이 결합하는 곳이 있습니다. SQL 자체는 파라미터 바인딩되어 SQLi는 아니지만, `,` `.` `(` `)` 같은 문법 문자로 검색 조건을 의도치 않게 확장/우회할 수 있습니다.
  - 근거: `api/actions/admin/verifications.ts:778`(이스케이프 전무), `api/actions/admin.ts:178,196`(쉼표만 치환), `api/actions/admin/shop-orders.ts:47,58,84,107`(일부 문자만 치환)
  - 실질 영향: 위 4곳 모두 관리자 인증을 통과한 뒤 실행되므로 즉각적 권한 상승은 아니나, 검색 오작동·파싱 오류를 유발할 수 있고 향후 일반 사용자용 검색에 같은 패턴이 재사용되면 위험도가 올라갑니다.
  - 조치: `const q = filter.q.trim().replace(/[,.()\\]/g, ' ').slice(0, 100)`처럼 예약 문자를 모두 제거/이스케이프.
- ✅ **양호**: 원시 SQL(`raw()`/`sql\``) 사용 없음. `rpc()` 호출은 2건뿐이며 모두 객체 파라미터 바인딩(문자열 결합 없음). `exec/execSync/spawn/child_process`, `eval/new Function/vm` 전수 검색 0건. `scripts/generate-result-ppt.py`는 사용자 입력을 받지 않는 하드코딩 스크립트.

### E. 크로스사이트 스크립팅(XSS) — ✅ 양호
- `dangerouslySetInnerHTML` 사용처는 전체 코드베이스에 단 1곳(`components/main/EventInfoModal.tsx:169`)이며 DOMPurify 화이트리스트(`ALLOWED_TAGS`/`ALLOWED_ATTR`)로 적절히 방어됨.
- 댓글·답글·멘션(`NoticeList.tsx`, `PopupNotice.tsx`, `MentionInput.tsx`)은 전부 React JSX로 렌더링되어 자동 이스케이프됨 — `innerHTML`/`insertAdjacentHTML`/`document.write` 전수 검색 0건.
- 단, 이 방어선이 의존하는 DOMPurify 라이브러리 자체가 구버전인 문제는 SEC-K-02 참고.

### F. 암호화(Cryptographic Failures) — ✅ 양호
- `docs/database-schema.sql` 확인 결과 주민번호/계좌/전화번호 등 민감 PII 컬럼 없음, 비밀번호 해시도 저장하지 않음(Supabase Auth/Google OAuth 위임).
- 비TLS(`http://`) 통신, 인증서 검증 비활성화(`rejectUnauthorized: false`) 패턴 전수 검색 0건.
- **[SEC-F-01] LOW** — 업로드 파일명 생성에 `Math.random()`을 사용하는 곳이 5군데 있음(`lib/upload-event-photo.ts` 등). 보안 토큰 생성용은 아니라 실질 위험은 낮으나, `crypto.randomUUID()`로 바꾸는 것을 권장.

### G. 보안 설정·헤더·CORS — 🟠 HIGH
HIGH 1건(SEC-G-01, 2절 참고) 외 추가:
- **[SEC-G-02] MEDIUM** — `app/api/debug/seah-orgsync/route.ts`가 세아웍스 인사 API 원본 응답(직원 이메일·부서 샘플)을 반환하는 디버그용 라우트인데 프로덕션에 그대로 배포되어 있습니다. `NODE_ENV==='production'`일 때만 관리자 인증을 요구하도록 게이트되어 있고(`Dockerfile:24`에 `ENV NODE_ENV=production`이 명시되어 현재는 정상 작동 확인), 게이트 자체는 유효하지만 "디버그 코드가 그대로 운영에 실려 있는 것" 자체가 안티패턴이며, 향후 실수로 이 조건이 풀리면 즉시 PII가 유출됩니다.
  - 조치: 프로덕션 빌드에서 라우트를 제거하거나, 별도의 명시적 플래그(`SEAH_ORGSYNC_DEBUG_ENABLED`)로 이중 게이트.
- **[SEC-G-03] MEDIUM** — SEC-K-01의 Next.js 구버전에 포함된 `GHSA-mq59-m269-xvcx`(Server Actions CSRF null-origin 우회)로 인해, Server Action의 기본 Origin 헤더 기반 CSRF 방어가 약화되어 있습니다. → SEC-K-01 업그레이드로 함께 해소됨.
- ✅ **양호**: CORS 관련 코드(`cors(`, `Access-Control-Allow-Origin`) 검색 결과 0건 — 별도로 열어주지 않으므로 기본적으로 동일 출처만 허용. API 에러 응답이 원시 스택 트레이스를 반환하지 않음(`report-client-error`, 주요 Server Action의 catch 블록 확인).

### H. 입력검증·파일업로드 — 🟡 MEDIUM
- **[SEC-H-01] MEDIUM** — 이미지 업로드 5곳(`lib/upload-event-photo.ts`, `api/actions/events.ts` 3곳, `api/actions/admin/shop-products.ts`, `api/actions/admin.ts`의 `uploadPopupImage`)이 모두 클라이언트가 보낸 `file.type`(MIME)과 `file.name`의 확장자만 확인하고, 실제 파일 내용(매직바이트)은 검증하지 않습니다. `file.type`은 요청자가 자유롭게 조작 가능한 값입니다. Storage 정책(`docs/migrations/028-...sql`)도 MIME/확장자 제약이 없어 DB 계층의 2차 방어도 없습니다.
  - 경감 요인: 로그인이 `@vntgcorp.com` 도메인으로 제한되어 익명 공격은 불가하고, Storage가 메인 도메인과 다른 서브도메인이라 저장된 악성 HTML/SVG가 실행되어도 메인 앱 쿠키를 직접 탈취하진 못함. 다만 사내 인증 계정이 있으면 이 검증은 우회 가능합니다.
  - 조치: `file-type` 같은 매직바이트 검증 라이브러리로 실제 파일 시그니처를 확인하고, 저장 시 확장자도 감지된 값을 사용(원본 파일명 미신뢰). Supabase Storage 버킷 생성 시 `allowedMimeTypes`도 함께 설정.
- **[SEC-H-02] LOW** — Server Action 입력값에 zod 등 공통 스키마 검증이 없고 TS 타입 캐스팅에 의존합니다(런타임에는 무의미). 다만 실사용 영향은 제한적 — 금액/상태 등 중요 값은 함수 내부에서 개별 방어(`Number.isInteger` 등)를 하고, 가장 민감한 기부 로직은 DB RPC(`process_donation_atomic`)에서 재검증하는 이중 방어 구조입니다. 장기적으로 zod 스키마 도입을 권장.
- ✅ **양호**: `xlsx` 라이브러리는 서버 데이터를 클라이언트로 내보내기(쓰기)만 하고, 사용자가 업로드한 엑셀을 파싱(`XLSX.read()`)하는 흐름이 코드베이스 전체에 없음 — 알려진 취약점(프로토타입 오염 등)이 대부분 파싱 경로에서 발생하므로 현재 사용 패턴에서는 위험 없음.

### I. SSRF·오픈 리다이렉트 — 🟠 HIGH (SEC-C-01과 동일 이슈, 2절 참고)
- ✅ **양호**: `next.config.ts`의 `images.remotePatterns`가 `unsplash` 고정 호스트 + 환경변수로 파싱한 Supabase 호스트만 허용해 임의 원격 이미지 프록시(SSRF 벡터) 불가능. 외부 API 호출(`lib/google-chat-alert.ts`, `lib/seah-orgsync.ts`)의 URL·인증정보가 전부 환경변수 고정값이라 사용자 입력이 목적지에 반영되지 않음. `lib/supabase/middleware.ts`의 로그인 리다이렉트는 쿼리 파라미터가 아닌 `request.nextUrl.pathname`만 사용해 오픈 리다이렉트 우회가 원천적으로 불가능(안전한 구현).

### J. 민감 데이터 보호·로깅·모니터링 — ⚪ LOW
- **[SEC-J-01] LOW** — `lib/google-chat-alert.ts`가 클라이언트 에러 스택과 함께 `userId`/`userEmail`/`userName`을 사내 Google Chat 웹훅으로 전송합니다. 토큰/비밀번호 유출은 아니고 일반적인 사내 알림 관행이나, 해당 Chat Space 접근 권한 범위(전사 vs 소수 운영팀)에 따라 개인정보 처리방침상 검토가 필요할 수 있습니다.
- **[SEC-J-02] LOW** — `api/queries/user.ts`의 `getUserData()`가 `select('*')`로 전체 컬럼을 반환하나, 현재 코드베이스 어디서도 호출되지 않는 데드코드라 즉시 위험은 없습니다. 향후 재사용 시를 대비해 필요한 컬럼만 명시적으로 select하는 것을 권장.
- ✅ **양호**: `console.log`/`console.error`에 토큰·비밀번호를 직접 출력하는 곳 전수 검색 0건.

### K. 취약한 구성요소·무결성 — 🟠 HIGH
HIGH 2건(SEC-K-01~02, 2절 참고) 외 추가:
- **[SEC-K-03] MEDIUM** — `sharp@0.34.5`에 libvips 관련 CVE(high severity)가 있습니다. Next.js 이미지 최적화 파이프라인이 내부적으로 sharp를 사용하며, 이벤트 인증사진·팝업 이미지 등 **사용자 업로드 이미지가 실제로 이 경로를 거칩니다** — 악성 이미지를 통한 DoS 공격면이 존재합니다. → `npm install sharp@0.35.3`(메이저 업그레이드, 호환성 테스트 필요).
- **[SEC-K-04] MEDIUM** — `xlsx@0.18.5`에 프로토타입 오염·ReDoS 취약점이 있고 npm 공식 수정판이 없습니다(SheetJS가 npm 배포를 중단). 다만 SEC-H 확인 결과 현재 쓰기(export) 전용으로만 사용되어 당장 익스플로잇은 어렵습니다. 장기적으로 `exceljs` 등 유지보수 중인 라이브러리로 교체를 권장.
- **[SEC-K-05] LOW** — `nodemailer@8.0.7`에 `raw`/`jsonTransport` 옵션 악용 CVE가 있으나, 코드가 표준 `sendMail({to, subject, html})`만 사용해 해당 벡터에 해당하지 않음. `react-markdown` 경유 `linkify-it`/`markdown-it`의 ReDoS는 관리자 입력 콘텐츠 한 곳에만 쓰여 공격 표면이 제한적. 둘 다 업그레이드는 권장.
- ✅ **양호**: `package-lock.json` 커밋됨. `curl ... | sh` 등 원격 코드 실행 패턴 전수 검색 0건. `.github/workflows` 없음(공급망 CI 점검 N/A).

### L. 레이트리밋·남용 방지 — 🟡 MEDIUM
- **[SEC-L-01] MEDIUM** — `middleware.ts`, `next.config.ts`를 포함해 코드베이스 전체에 요청 횟수 제한(rate limit/throttle) 로직이 전혀 없습니다. 비밀번호 로그인이 없어 브루트포스 위험은 낮지만, 건강 챌린지 인증 제출(`submitHealthActivityLogsBatch`)에 1일 제출 횟수 상한이 없어 짧은 시간에 대량 제출 시 관리자 심사 대기열이 폭증하거나 매 제출마다 호출되는 Google Chat 알림이 스팸성으로 몰릴 수 있습니다.
  - 조치: Cloud Run 앞단(Cloud Armor) 또는 애플리케이션 레벨(Upstash Redis 등)로 사용자별/IP별 제한 도입. 최소한 건강 챌린지 제출 건수 상한과 관리자 알림 디바운스 적용.

### M. 안전하지 않은 설계·비즈니스 로직 — 🟡 MEDIUM
- **[SEC-M-01] MEDIUM** — `api/actions/shop.ts`의 `purchaseShopProduct()`가 잔액 확인(`current_medals` 조회) 후 차감(`update`)하는 "읽고-쓰기" 방식으로 되어 있어, DB 레벨의 조건부 갱신(원자적 처리)이 아닙니다. 같은 사용자가 짧은 시간에 두 번 요청하면(더블클릭 등) 둘 다 잔액 검사를 통과한 뒤 순차 차감되어 **실제 잔액보다 많은 금액을 소비(더블 스펜딩)** 하거나 재고를 초과 판매할 수 있습니다. 반면 `donation.ts`의 `donatePoints()`는 `process_donation_atomic` DB 함수(RPC)로 원자성을 확보한 모범 사례입니다.
  - 근거: `api/actions/shop.ts:106-118`
  - 조치: Postgres RPC로 원자적 처리하거나, 최소한 조건부 UPDATE로 방어(`update users set current_medals = current_medals - :amount where user_id = :uid and current_medals >= :amount`, 영향받은 행이 0이면 잔액부족 처리). 재고도 동일 패턴 적용.
- **[SEC-M-02] MEDIUM / ⚠️확인필요** — `api/actions/admin/health-challenges.ts`의 `approveHealthActivityLogGroup()`은 매 승인마다 "이번 제출값만으로" 레벨을 산정해 메달을 즉시 지급하며, 이 경로에는 월 최대 한도(`maxMonthlyMedals`) 체크가 없습니다(월별 정산 함수 `runHealthChallengeMonthlySettlement`에만 상한이 있음). 관리자가 같은 사용자의 여러 건을 각각 승인하면 매번 독립적으로 상위 레벨 보상을 반복 지급받을 수 있습니다. 코드 주석상 의도된 정책일 가능성이 있어 확신도는 낮습니다 — 담당팀 확인 필요.
- **[SEC-M-03] LOW / ⚠️확인필요** — `api/actions/events.ts`의 칭찬 챌린지 "여러 명 선택(MULTIPLE)" 모드에서 선택 인원 수 상한이 서버에 없습니다. 선택 인원만큼 각각 전액이 지급되므로 총 지급액이 비례해 커집니다. 정상 기능일 수 있으나 예산 통제 관점에서 서버측 상한(예: 최대 10명)을 명시하는 것을 권장합니다.
- ✅ **양호**: `donation.ts`는 원자적 RPC로 경쟁조건 방지. `verifications.ts`는 승인 전 `status !== 'PENDING'` 체크와 조건부 UPDATE로 이중 승인/이중 지급을 정확히 차단. `events.ts`의 반려 후 재제출도 소유자(`user_id`) 조건을 걸어 IDOR을 방지.

### N. AI/LLM 애플리케이션 보안 — N/A
- 의존성에 OpenAI/Anthropic/LangChain 등 LLM SDK가 없어 해당 없음.

## 4. 조치 로드맵

- **★★★ 긴급(24시간 내)**
  - SEC-B-01, SEC-B-02, SEC-B-03: 관리자 서버 액션 인가 검사 추가 (이미 코드베이스에 정답 패턴 존재, 복사-적용 수준)
  - SEC-B-04, SEC-B-05: 공지/상점주문 관리자 함수 인가 검사 추가
  - SEC-C-01 / SEC-I-01: 오픈 리다이렉트 수정 (`isSafeNextPath` 유틸 1개 작성 후 3개 파일에 적용)
- **★★ 단기(1주 내)**
  - SEC-K-01: Next.js 업그레이드(16.2.11+)
  - SEC-K-02: isomorphic-dompurify 최신화
  - SEC-G-01: 보안 헤더 추가(`next.config.ts`)
  - SEC-B-06, SEC-B-07: 나머지 admin 함수 인가 검사 일관화, seah-orgsync 서버 액션 가드
  - SEC-C-02: donation.ts 게스트 우회 NODE_ENV 가드
  - SEC-H-01: 업로드 매직바이트 검증 공통 유틸 적용
  - SEC-M-01: 상점 구매 잔액/재고 원자적 처리
- **★ 중기(1개월 내)**
  - SEC-A-01: 배포 스크립트 시크릿을 Secret Manager로 전환
  - SEC-D-01: `.or()` 필터 이스케이프 공통화
  - SEC-K-03, SEC-K-04, SEC-K-05: sharp/xlsx/nodemailer 업그레이드 및 xlsx 대체 검토
  - SEC-L-01: 레이트리밋 도입
  - SEC-G-02: 디버그 라우트 정리
  - SEC-M-02, SEC-M-03: 정책 재확인 후 필요시 상한 로직 추가
  - SEC-F-01, SEC-H-02, SEC-J-01, SEC-J-02, SEC-C-03: 경미한 개선사항 순차 반영

## 5. 프로세스·아키텍처 권고

정적 점검으로 직접 확인되지는 않았지만, 이 프로젝트의 맥락(임직원 대상 사내 포인트/기부 플랫폼, GCP Cloud Run, Supabase)에서 특히 관련 있는 권고만 선별했습니다.

- **Server Action = 독립 엔드포인트라는 규칙을 팀 컨벤션으로 명문화**: 이번 점검에서 발견된 CRITICAL/HIGH 이슈 대부분이 "페이지 진입만 막으면 안전하다"는 오해에서 비롯됐습니다. `requireAdmin()` 같은 공통 헬퍼를 만들고, 신규 관리자 액션 작성 시 반드시 첫 줄에 호출하도록 코드 리뷰 체크리스트나 린트 규칙(예: 파일명 패턴 기반 정적 검사 스크립트)으로 강제하는 것을 권장합니다.
- **CI에 `npm audit`/시크릿 스캐닝 도입**: 현재 `.github/workflows`가 없어 자동화된 취약점 스캔이 없습니다. GitHub Actions 등에 `npm audit --production`, `gitleaks`/`trufflehog` 같은 시크릿 스캐너를 PR 게이트로 넣으면 SEC-K 계열 이슈를 다음에는 코드 리뷰 이전에 잡을 수 있습니다.
- **제로 트러스트/최소 권한 관점에서 `service_role` 클라이언트 사용 범위 재검토**: 이번 점검에서 확인된 대부분의 CRITICAL 이슈가 `createAdminClient()`(RLS 우회)를 인가 검사 없이 호출하는 패턴이었습니다. 가능한 곳은 RLS가 적용되는 일반 클라이언트로 전환하면, 설령 애플리케이션 코드의 인가 검사를 빠뜨리더라도 DB 레벨의 RLS 정책이 최후의 방어선이 되어 이번과 같은 사고의 파급력을 크게 줄일 수 있습니다.
- **취약점 제보 창구**: 사내용 서비스라도 임직원이 취약점을 발견했을 때 보고할 수 있는 간단한 연락 경로(예: 사내 채널)를 안내해두면 조기 발견에 도움이 됩니다.

## 6. 점검 한계 및 다음 단계

- 이 점검은 **정적 분석**이라 런타임 동작(실제 배포 환경에 적용된 접근제어, 응답 헤더, Cloud Run/로드밸런서 레벨 설정, 레이트리밋 등)은 확인하지 못했습니다. 특히 SEC-G-01(보안 헤더)은 애플리케이션 코드에는 없지만 인프라 레벨(로드밸런서 등)에서 별도로 주입하고 있을 가능성을 배제할 수 없어, 실제 배포 환경에서 직접 확인이 필요합니다.
- SEC-B 계열 발견은 3개의 독립된 감사 에이전트가 각자 교차 확인했지만, `api/actions/**` 전체에 대한 **100% 전수조사**는 아닙니다. 안전을 위해 `grep -L "requireAdmin\|is_admin\|assertIsAdmin" api/actions/**/*.ts` 방식으로 한 번 더 전수 재확인하는 것을 권장합니다.
- SEC-M-02(건강챌린지 월 상한)는 코드만으로는 "의도된 정책"인지 "버그"인지 확신할 수 없어 담당팀 확인이 필요합니다.
- 실제 배포된 서버를 대상으로 한 동적 점검(실제 접근제어 응답, 보안 헤더 응답, 레이트리밋 동작 확인)은 `/secure-check:live`로 이어서 실행하시길 권장합니다(단, 본인 소유·점검 권한이 있는 시스템에만 사용).
