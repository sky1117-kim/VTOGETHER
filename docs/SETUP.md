# V.Together 플랫폼 설정 가이드

## 1. 환경 변수 설정

`.env.local` 파일을 생성하고 다음 변수들을 설정하세요:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key

# Next.js Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## 2. 데이터베이스 스키마 설정

1. Supabase Dashboard에 접속합니다.
2. SQL Editor로 이동합니다.
3. `docs/database-schema.sql` 파일의 내용을 복사하여 실행합니다.

이 스크립트는 다음을 생성합니다:
- Users 테이블
- DonationTargets 테이블
- Donations 테이블
- PointTransactions 테이블
- RLS (Row Level Security) 정책
- 인덱스 및 트리거

## 3. Google OAuth 설정

1. Supabase Dashboard > Authentication > Providers로 이동합니다.
2. Google Provider를 활성화합니다.
3. Google Cloud Console에서 OAuth 2.0 클라이언트 ID를 생성합니다.
4. Redirect URI를 `https://your-project.supabase.co/auth/v1/callback`로 설정합니다.
5. Client ID와 Client Secret을 Supabase에 입력합니다.

## 4. 초기 데이터 설정

데이터베이스 스키마 실행 시 기본 기부처 4개가 자동으로 생성됩니다:
- 아름다운가게
- 혜명보육원
- 한국환경공단
- 한국사회복지협의회

## 5. 개발 서버 실행

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:3000`으로 접속합니다.

## 6. 로그인 없이 테스트하기 (게스트 테스트 모드)

로그인 기능을 나중에 붙일 때까지 **로그인 없이** 기부·대시보드 등을 테스트하려면:

- **비개발자용 단계별 설명** → **[로그인-없이-테스트하기.md](./로그인-없이-테스트하기.md)** 참고 (클릭해서 보세요.)

요약:
1. **DB에 테스트 유저 넣기**  
   Supabase SQL Editor에서 `docs/migrations/003-guest-test-user.sql` 내용을 붙여 넣고 Run → `guest-test` 유저(5만 P) 생성.
2. **환경 변수**  
   `.env.local`에 `GUEST_TEST_USER_ID=guest-test` 와 `SUPABASE_SERVICE_ROLE_KEY=(Supabase에서 복사한 service_role 키)` 추가.
3. 서버 재시작 후 메인 접속 시 **게스트 (테스트)** 로 5만 P 사용·기부 테스트 가능.

## 7. 테스트 사용자 (로그인 시)

- Google OAuth로 로그인할 때 `@vntg.co.kr` 도메인만 허용됩니다.
- 최초 로그인 시 Users 테이블에 자동으로 사용자가 생성됩니다.

## 8. 주요 기능

### Phase 1 (MVP) 구현 완료
- ✅ Google OAuth 인증 (@vntg.co.kr 도메인 제한)
- ✅ 사용자 프로필 및 ESG Level 시스템
- ✅ 기부 기능 (포인트 기반)
- ✅ 기부처 목표 달성 자동 처리
- ✅ 마이페이지 (기부 내역 조회)
- ✅ 메인 대시보드

### 다음 단계 (Phase 2)
- 챌린지 & 보상 시스템
- 관리자 기능
- V.Honors 랭킹 시스템
