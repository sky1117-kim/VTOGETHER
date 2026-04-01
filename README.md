This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

---

## ⚠️ **당신이 할 일** (필수)

1. **Supabase SQL 실행**: `docs/migrations/` 안의 마이그레이션을 **순서대로** SQL Editor에서 실행 (006-1 → 006 → 011 등). 건강 챌린지 사용 시 **`033-health-challenge.sql`** · **`034-health-challenge-event-id.sql`** 도 실행하고, 세아웍스 스냅샷 동기화 사용 시 **`036-seah-org-sync-tables.sql`** 도 실행하세요.
2. **최초 관리자 지정**: Supabase Table Editor에서 `users` 테이블 → 한 명의 `is_admin`을 **true**로 설정.
3. **.env**: `SUPABASE_SERVICE_ROLE_KEY` 등 필요한 키 설정.

자세한 내용 → **`docs/당신이-할-일.md`**

---

## 주요 기능 / 페이지

- **메인**: `/` — 대시보드, 기부, **이벤트 & 챌린지**(필터 하단에 **건강 챌린지** People 블록 → 그 아래 일반 이벤트 카드), 명예의 전당(분기별 TOP 10)
- **상점**: `/shop` — `V.Medal`로 굿즈 구매 또는 `V.Credit` 전환 상품 구매
- **관리자**: `/admin` — 대시보드(전사 기부·목표 달성률·승인 대기·**MAU**·**이벤트 적립 현황** People/V.Together/매칭금), 메인 문구 편집, 사용자·관리자 설정. 네비에 승인 대기 배지, 설정 섹션 접기/펼치기 지원
- **지급/적립 내역**: `/admin/point-grant` — 수동 지급 + 직원 전체 지급/적립/사용 거래 통합 조회(이름/이메일/사유 검색, 유형·재화·기간 필터, 페이지 이동)
- **이벤트 관리**: `/admin/events` — 목록, `/admin/events/new` — 등록 (보상: V.Credit/굿즈/커피쿠폰 복수 선택, 인증: 사진·텍스트·숫자·동료선택+텍스트 + 직원 안내문)
- **칭찬 챌린지 인증 UX 개선**: 이벤트 인증 모달에서 동료 다중 선택(여러 명) + 추천 조직명 직접 입력 + 개선된 카드형 UI 지원 (2026.03.30)
- **동료 선택 인원 설정**: 관리자 이벤트 등록에서 `동료 선택` 인증 항목별로 `개인형(1명)`/`조직형(여러 명)`을 지정 가능. 참여 모달·서버 검증이 동일 규칙 적용 (2026.03.30)
- **인증 심사**: `/admin/verifications` — 이벤트 참여 인증 승인/반려, 일괄 처리
- **건강 챌린지**: 시즌은 **`/admin/events/new`** 에서 People 이벤트와 함께 등록(체크박스). 정산·시즌 목록: `/admin/health-challenges` · 활동 심사: `/admin/verifications`. DB: `033-health-challenge.sql`, `034-health-challenge-event-id.sql`
- **기부처 관리**: `/admin/donation-targets` — 목표 수정, 오프라인 성금 합산
- **상점 상품 관리**: `/admin/shop-products` — 상점 상품 등록/활성화/가격·재고·설명 수정 + 상품 이미지 업로드(드래그앤드롭/자동압축) + 검색/필터
- **상점 카드 UX 개선**: `/shop` — 상품 카드 높이 축소, 설명 `전체 내용 보기` 팝업, 상품별 다중 이미지 좌우 슬라이드 지원 (2026.03.31)
- **상점 상품 분류 확장**: 상점 분류를 `굿즈` / `V.Credit` / `알맹상점` 3가지로 운영 (2026.03.31)
- **숫자 입력 UX**: 주요 입력 폼에서 숫자 타이핑 시 천 단위 콤마 자동 표시 (`20000` → `20,000`, 저장 시 숫자로 변환)
- **최근 접속 사용자**: `/admin/recent-users` — 마지막 접속 시각 기준 사용자 목록
- **스켈레톤 UI**: 메인·마이·기부·관리자 페이지 로딩 시 콘텐츠 자리 표시용 스켈레톤 표시
- **세아웍스 인사 연동(배치형)**: `seah_org_units`(조직) + `seah_employees`(직원) 스냅샷 테이블로 분리 저장 후 서비스에서 필요 시 조인 사용. 외부 API는 `/api/cron/seah-orgsync`를 하루 1회 호출해 동기화 (`docs/seah-orgsync-api.md` 참고)
- **Google Chat 에러 알림**: 서버/클라이언트 에러 발생 시 에러 전용 Chat 스페이스로 알림 전송 (`GOOGLE_CHAT_WEBHOOK_URL`)
- **Google Chat 승인 대기 알림**: 이벤트 인증이 제출되면 관리자 전용 Chat 스페이스로 승인 대기 알림 전송 (`GOOGLE_CHAT_ADMIN_WEBHOOK_URL`, `/admin/verifications`)

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
