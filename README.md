This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

---

## ⚠️ **당신이 할 일** (필수)

1. **Supabase SQL 실행**: `docs/migrations/` 안의 마이그레이션을 **순서대로** SQL Editor에서 실행 (006-1 → 006 → 011 등).
2. **최초 관리자 지정**: Supabase Table Editor에서 `users` 테이블 → 한 명의 `is_admin`을 **true**로 설정.
3. **.env**: `SUPABASE_SERVICE_ROLE_KEY` 등 필요한 키 설정.

자세한 내용 → **`docs/당신이-할-일.md`**

---

## 주요 기능 / 페이지

- **메인**: `/` — 대시보드, 기부, 이벤트 & 챌린지, 명예의 전당(TOP 10)
- **관리자**: `/admin` — 대시보드(전사 기부·목표 달성률·승인 대기·**MAU**·**이벤트 적립 현황** Culture/V.Together/매칭금), 포인트 지급, 메인 문구 편집, 사용자·관리자 설정
- **이벤트 관리**: `/admin/events` — 목록, `/admin/events/new` — 등록 (보상: V.Point/굿즈/커피쿠폰 복수 선택, 인증: 사진·텍스트·숫자·동료선택+텍스트 + 직원 안내문)
- **인증 심사**: `/admin/verifications` — 이벤트 참여 인증 승인/반려, 일괄 처리
- **기부처 관리**: `/admin/donation-targets` — 목표 수정, 오프라인 성금 합산
- **최근 접속 사용자**: `/admin/recent-users` — 마지막 접속 시각 기준 사용자 목록
- **스켈레톤 UI**: 메인·마이·기부·관리자 페이지 로딩 시 콘텐츠 자리 표시용 스켈레톤 표시
- **세아웍스 인사 연동**: 로그인 시 부서명(`dept_name`) 자동 동기화 (`docs/seah-orgsync-api.md` 참고)

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
