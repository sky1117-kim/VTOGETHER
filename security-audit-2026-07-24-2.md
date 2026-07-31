# 🔒 보안 재점검 리포트 — vtogether (1차 수정 이후)
점검일: 2026-07-24 | 환경: Next.js 16 + Supabase(Auth/SSR/RLS), GCP Cloud Run | LLM/AI SDK: 미사용 | 대상: 프로젝트 루트 전체 | 점검 방식: 정적 코드 분석(1차 감사 항목 재검증 + 신규 발견)

> 이 리포트는 [security-audit-2026-07-24.md](security-audit-2026-07-24.md)에서 발견된 항목들을 실제로 고친 뒤, 그 수정이 올바른지 **독립적으로 재검증**한 결과입니다. 4개의 재검증 에이전트가 "이미 고쳤다고 주장된 내용"을 그대로 믿지 않고 코드를 다시 열어 확인했으며, 그 과정에서 새로운 문제 3건을 추가로 찾아 즉시 수정했습니다.

## 1. 요약

- **종합 위험 등급: B (양호)** — 1차 감사의 CRITICAL 3건·HIGH 6건은 전부 수정이 확인됐고, 재검증 중 새로 발견된 HIGH 1건·MEDIUM 1건·LOW 1건도 이번에 함께 수정했습니다. 남은 항목은 실사용 패턴상 위험이 낮다고 판단해 의도적으로 보류한 의존성 이슈와, 코드가 아닌 "정책 확인이 필요한" 비즈니스 로직 2건뿐입니다.
- **발견 현황(재검증 기준)**: 🔴 CRITICAL 0 (3건 모두 수정확인) / 🟠 HIGH 1건 **신규 발견 → 수정완료** (기존 6건은 수정확인) / 🟡 MEDIUM 1건 **신규 발견 → 수정완료** / ⚪ LOW 1건 **신규 발견 → 수정완료**, 정책확인 2건 잔존
- **카테고리별 재검증 요약**

| 카테고리 | 1차 감사 결과 | 재검증 결과 |
|---|---|---|
| A. 비밀정보 | 🟡 (배포스크립트 평문) | ✅ Secret Manager 경유로 전환 확인 |
| B. 접근제어 | 🔴 CRITICAL 3 / HIGH 2 | ✅ 전부 수정확인 + 🟡🟠 신규 2건 발견·수정 |
| C. 인증/세션 | 🟠 (오픈리다이렉트) | 🟠 **수정한 코드에 우회 경로가 남아있었음 → 재수정 완료** |
| D. 인젝션 | 🟡 (`.or()` 필터) | ✅ 전부 수정확인, 추가 잔존 지점 없음 |
| E. XSS | ✅ | ✅ 회귀 없음 |
| G. 보안헤더/설정 | 🟠 | ✅ 6종 헤더·디버그라우트 게이트 전부 정상 |
| H. 업로드 검증 | 🟡 | ✅ 5곳 매직바이트 검증 전부 정상 |
| I. SSRF/리다이렉트 | 🟠 (C와 동일) | 🟠 → ✅ (재수정 완료) |
| K. 의존성 | 🟠 | 🟡 next/dompurify/sharp 업그레이드 확인, nodemailer/postcss/xlsx 잔존(위험 낮음, 의도적 보류) |
| M. 비즈니스로직 | 🟡 | 🟡 상점 경쟁조건 수정확인(DB 마이그레이션 수동 적용 필요), 나머지 2건은 정책확인 필요로 잔존 |

- **깨진 설계 원칙 요약**: 이번 재검증에서 드러난 패턴은 **"부분적 방어(partial mitigation)의 함정"**입니다. 오픈 리다이렉트 수정은 `//`, `/\` 두 가지 알려진 우회만 막는 블록리스트 방식이라 URL 파서의 문자 정규화(탭/개행 제거) 특성을 이용한 세 번째 우회를 놓쳤고, 업로드 인가 수정 작업은 "관리자 함수"에만 집중하다 보니 "로그인만 하면 되는 일반 사용자 함수" 3개에는 최소한의 인증 체크조차 빠뜨렸습니다. 두 경우 모두 **화이트리스트(허용된 것만 통과)보다 블록리스트(알려진 나쁜 것만 차단)에 의존**했다는 공통점이 있습니다.

## 2. 🚨 이번에 발견해 즉시 수정한 항목

### [SEC-C-01-R] 오픈 리다이렉트 수정이 제어문자 삽입으로 우회 가능했음 — 🟠 HIGH → 수정완료
- **무엇이 문제였나**: 1차 감사에서 고친 `lib/safe-redirect.ts`의 `isSafeNextPath`는 `next.startsWith('//')`와 `next.startsWith('/\\')`만 문자열로 검사했습니다. 그런데 `/\t/evil.com`(경로 맨 앞에 탭 문자)처럼 `//`도 `/\`도 아닌 문자열은 이 검사를 통과하지만, 실제로 리다이렉트를 만드는 `new URL(path, origin)` 함수(브라우저가 `Location` 헤더를 해석할 때도 동일한 표준을 씀)는 파싱 전에 탭·개행·캐리지리턴을 제거해버려서 결과적으로 `//evil.com`과 똑같이 해석됩니다.
- **왜 위험한가**: 회사 로그인 주소로 시작하는 링크(`.../login?next=%2F%09%2Fevil.com`)를 피해자에게 보내면, 정상적으로 구글 로그인을 마친 뒤 외부 사이트로 자동 이동합니다 — 1차 감사에서 지적했던 것과 완전히 같은 피싱 시나리오가 "고친 코드"에서도 그대로 재현됩니다.
- **직접 재현해 확인함**(node로 실행):
```
"/\t/evil.com" -> (수정 전) isSafeNextPath: true -> 최종 리다이렉트: https://evil.com/
```
- **깨진 원칙**: 완전한 중재 — 블록리스트가 "알려진 두 가지 패턴"만 막았고, 신뢰 경계를 문자열 비교가 아니라 실제 URL 파싱 결과로 검증하지 않았음.
- **조치 방법(적용 완료)**: `lib/safe-redirect.ts`에 제어문자 차단과, 플레이스홀더 origin에 대해 실제로 `new URL()`을 파싱해 origin이 그대로인지 재확인하는 로직을 추가했습니다.
```ts
const SAFE_REDIRECT_PLACEHOLDER_ORIGIN = 'https://safe-redirect-placeholder.local'

export function isSafeNextPath(next?: string | null): next is string {
  if (!next) return false
  if (typeof next !== 'string') return false
  if (/[\x00-\x1F\x7F]/.test(next)) return false   // 제어문자 차단
  if (!next.startsWith('/')) return false
  if (next.startsWith('//')) return false
  if (next.startsWith('/\\')) return false

  let resolved: URL
  try {
    resolved = new URL(next, SAFE_REDIRECT_PLACEHOLDER_ORIGIN)
  } catch {
    return false
  }
  return resolved.origin === SAFE_REDIRECT_PLACEHOLDER_ORIGIN   // 최종 방어선
}
```
수정 후 `/\t/evil.com`, `/\n/evil.com`, `/\r/evil.com`, `//evil.com`, `/\evil.com`, `https://evil.com` 전부 `false`로, `/my/page` 등 정상 경로는 `true`로 확인했습니다.

### [SEC-B-08] 이벤트/건강챌린지 인증사진 업로드 3종에 로그인 확인 자체가 없었음 — 🟡 MEDIUM → 수정완료
- **무엇이 문제였나**: 1차 감사·수정은 "관리자 전용 함수"에 인가 검사를 넣는 데 집중했는데, `api/actions/events.ts`의 `uploadEventVerificationPhoto`(일반 사용자용 인증사진 업로드), `uploadHealthCriteriaAttachment`(관리자용 기준표 업로드), `uploadEventRepresentativeImage`(관리자용 대표이미지 업로드) 3개 함수는 **로그인 여부 확인 자체가 없었습니다.**
- **왜 위험한가**: Server Action은 로그인 세션 없이도 URL만 알면 직접 호출 가능한 공개 엔드포인트입니다. 로그인하지 않은 외부인이 이 함수들을 반복 호출해 회사 Supabase Storage에 5~15MB 파일을 무제한 업로드할 수 있어(업로드 개수 제한 없음), 스토리지 비용 증가나 부적절한 콘텐츠 호스팅에 악용될 수 있습니다.
- **깨진 원칙**: 기본 거부 — "이 화면은 로그인해야 보인다"는 가정만으로 서버 함수를 방치.
- **근거(위치)**: `api/actions/events.ts` — 화면 사용처 확인 결과 `uploadEventVerificationPhoto`는 일반 로그인 사용자용(`HealthChallengePanel.tsx`, `HealthChallengeVerifyModal.tsx`, `EventVerifyModal.tsx`에서 호출), `uploadHealthCriteriaAttachment`/`uploadEventRepresentativeImage`는 관리자 전용 화면(`app/admin/events/**`)에서만 호출됨을 확인.
- **조치 방법(적용 완료)**: `uploadEventVerificationPhoto`에는 로그인 확인, 나머지 2개에는 `requireAdmin()`(파일 내 새로 추가한 헬퍼) 추가.
```ts
export async function uploadEventVerificationPhoto(formData: FormData) {
  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return { url: null, error: '로그인이 필요합니다.' }
  // ...기존 로직
}
export async function uploadHealthCriteriaAttachment(formData: FormData) {
  const auth = await requireAdmin()
  if (!auth.ok) return { url: null, error: auth.error }
  // ...기존 로직
}
export async function uploadEventRepresentativeImage(formData: FormData) {
  const auth = await requireAdmin()
  if (!auth.ok) return { url: null, error: auth.error }
  // ...기존 로직
}
```

### [SEC-B-09] `getPendingVerificationCount` 인가 검사 누락 — ⚪ LOW → 수정완료
- **무엇이 문제였나**: `api/actions/admin.ts`의 `getPendingVerificationCount()`(승인 대기 건수를 반환하는 함수, 관리자 사이드바 배지용)에 `requireAdmin()`이 빠져 있었습니다. 같은 목적의 자매 함수 `getPendingHealthChallengeLogCount`는 정확히 검사가 들어있었는데, 이번 함수만 누락됐습니다.
- **왜 위험한가**: 노출되는 정보가 정수 하나(대기 건수)뿐이라 실질적 피해는 매우 작지만, 로그인하지 않은 외부인도 이 값을 조회할 수 있는 상태였습니다.
- **조치 방법(적용 완료)**: `requireAdmin()` 한 줄 추가.

## 3. 1차 감사 항목 재검증 결과 (상세)

### B. 접근제어 — ✅ CRITICAL/HIGH 전부 수정확인
- `admin.ts` 17개 함수, `admin/donation-targets.ts` 3개, `notices.ts` 관리자 6개, `admin/shop-orders.ts`/`admin/shop-products.ts`/`admin/health-challenges.ts` 누락 4건, `admin/seah-orgsync.ts`(`'use server'` 제거로 크론 보호 우회 불가 확인) — **모두 `requireAdmin()`/`assertIsAdmin()`이 함수 실행 경로 최상단에서 호출되며, 우회 가능한 조건문 안에 있지 않음을 직접 확인**했습니다.
- `notices.ts`의 `fetchMentionableUsers`는 관리자 전용이 아니라 "로그인 사용자 전체가 댓글 멘션에 쓰는 함수"라는 의도가 맞고, 로그인 체크가 정확히 들어가 있음을 확인.

### C. 인증/세션 — 🟠 위 SEC-C-01-R 참고(재수정 완료), 나머지는 수정확인
- 게스트 우회(`donation.ts`)의 `NODE_ENV` 가드, 크론 시크릿의 `timingSafeEqual` 비교 — 둘 다 정상 반영 확인. `app/`, `api/` 전체에서 예전 방식(`.startsWith('/')`만 쓰는 리다이렉트 검증)이 남아있는 곳이 없는지 전수 검색했으나 추가 발견 없음.

### D. 인젝션 — ✅ 전부 수정확인
- `admin.ts`(포인트거래 검색), `admin/shop-orders.ts`(주문 검색), `admin/verifications.ts`(`searchBackfillUsers`) 3개 지점의 `.or()` 필터 이스케이프(`,.()\` 제거) 확인. `.or(` 패턴 전수 검색 결과 이 3곳 외 사용자 입력이 들어가는 추가 지점 없음(`api/queries/notices.ts`의 나머지 사용처는 서버가 생성한 값이라 해당 없음).

### G. 보안헤더/설정 — ✅ 수정확인
- `next.config.ts`의 `headers()`에 6종 헤더 전부 존재, `poweredByHeader: false` 확인. 디버그 라우트(`app/api/debug/seah-orgsync/route.ts`)의 `SEAH_ORGSYNC_DEBUG_ENABLED` 이중 게이트가 인증 체크보다 먼저 평가되어 우회 불가 확인. `deploy.sh`/`setup-secrets.sh`에 이 플래그를 설정하는 코드가 없어 기본값이 "꺼짐"(fail-closed)임도 확인.
- ⚪ 참고(필수 조치 아님): CSP `script-src`에 `'unsafe-inline'`이 포함돼 있어 XSS 방어력을 일부 낮춥니다(GA/GTM 인라인 스니펫 때문에 불가피한 트레이드오프). 여유가 있을 때 nonce/hash 기반으로 좁히는 것을 고려해볼 수 있습니다.

### H. 업로드 검증 — ✅ 수정확인 (SEC-B-08과는 별개로, 검증 로직 자체는 정상)
- `lib/validate-image-upload.ts`가 시그니처 인식 실패 시 즉시 거부(fail-closed)하는지 확인. 5개 업로드 지점 모두 매직바이트 검증 함수를 호출하고 실패 시 즉시 반환, 저장 경로 확장자도 감지값 사용, `Math.random()` 잔존 없음(`randomUUID`로 전환) 확인. `file.type` 단독 검증 잔존 지점 없음.

### K. 의존성 — 🟡 주요 3개는 수정확인, 나머지는 위험 낮아 의도적 보류
- `next` 16.2.11, `dompurify` 3.4.12(via isomorphic-dompurify), `sharp` 0.35.3(+ `overrides`로 Next 내부 중첩 sharp까지 단일화) — 실제 설치본까지 확인.
- **잔여 4건**(`npm audit` 기준, 필수 조치 아님):
  - `nodemailer`(HIGH, `raw` 옵션 악용 CVE) — 코드가 `raw` 옵션을 쓰지 않아 현재 익스플로잇 경로 없음. 메이저 업그레이드는 실제 메일 발송 테스트 없이 진행하기엔 리스크가 더 크다고 판단해 보류(1차 감사와 동일 결론 유지).
  - `postcss`(HIGH+MODERATE, `next` 내부 번들) — Next.js가 자체 번들한 빌드타임 의존성이라 우리 쪽에서 고칠 수 없음. Next 공식 패치 대기.
  - `xlsx`(HIGH×2, 공식 수정 없음) — 내보내기(export) 전용 사용이라 파싱 경로가 없어 익스플로잇 불가 확인.
- 시크릿 관리 스크립트(`deploy.sh`/`setup-secrets.sh`) 로직 재확인: 5개 시크릿(세아웍스 비밀번호·크론시크릿·SMTP비밀번호·구글챗웹훅 2종) 모두 Secret Manager 우선, 없으면 평문 폴백+경고 로그. bash 문법 오류 없음.

### M. 비즈니스 로직 — 🟡 경쟁조건은 수정확인(단, DB 마이그레이션 수동 적용 필요), 정책성 2건은 잔존
- `shop.ts`의 `purchaseShopProduct`가 `purchase_shop_product_atomic` RPC를 정확한 파라미터로 호출하도록 바뀌었고, SQL 함수 자체도 `FOR UPDATE` 행 잠금 + `SECURITY DEFINER` + `service_role` 전용 권한으로 안전하게 설계됨을 확인했습니다. **다만 이 SQL이 실제 Supabase 프로덕션 DB에 적용됐는지는 코드만으로 확인할 수 없습니다** — 배포 시 마이그레이션을 실행하지 않았다면 RPC 호출 자체가 오류를 낼 수 있으니 반드시 확인이 필요합니다.
- 건강챌린지 월 상한 우회 가능성, 칭찬 다수선택 인원 상한 부재 — 1차 감사와 동일하게 낮은 확신도(⚪ LOW)로 남아있으며, 코드 문제라기보다 "이게 의도된 정책인지" 담당팀 확인이 필요한 사안이라 이번에도 코드는 건드리지 않았습니다.

## 4. 조치 로드맵

- **완료(이번 세션에 즉시 반영)**: SEC-C-01-R(오픈 리다이렉트 재우회 차단), SEC-B-08(업로드 3종 인증 추가), SEC-B-09(승인대기 건수 인가 추가)
- **★★★ 배포 전 반드시 확인**: `docs/migrations/053-shop-purchase-atomic-rpc.sql`이 Supabase에 실제 적용됐는지 확인(안 됐다면 상점 구매가 즉시 오류).
- **★ 여유 있을 때**: CSP `script-src`의 `unsafe-inline`을 nonce 방식으로 좁히기, `nodemailer` 메이저 업그레이드(실제 메일 발송 테스트와 함께), 건강챌린지 월 상한/칭찬 다수선택 정책 담당팀 확인.

## 5. 점검 한계 및 다음 단계

- 이번 재검증도 정적 분석입니다. `purchase_shop_product_atomic` RPC의 실제 DB 적용 여부, Cloud Run에 실제로 배포된 보안 헤더 응답, Secret Manager에 시크릿이 실제로 등록됐는지는 코드만으로 확인이 불가능하므로 운영 환경에서 직접 확인이 필요합니다.
- 이번 재검증에서 "1차 수정이 불완전했던 사례"가 2건(오픈 리다이렉트, 업로드 인증) 나온 만큼, 다음 기능 추가·수정 시에도 한 번에 끝내지 말고 이런 식의 독립 재검증(또는 `/secure-check:live`를 통한 실제 배포 환경 동적 점검)을 정기적으로 돌리는 것을 권장합니다.
