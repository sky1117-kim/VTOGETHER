# 세아웍스 인사 연동 REST API 설정 가이드

VNTG 그룹웨어서비스팀 정선우 담당자로부터 발급받은 API 사용 정보입니다.

## 1. 이메일 안내 내용 요약

**이메일에서 전달한 내용:**
- **system_id**: `VTOGETHER` (API 호출 시 이 값을 사용)
- **Basic Auth 계정**: Username / Password (별도 발급)

**환경별 계정:**
| 환경 | Username | Password |
|------|----------|----------|
| 개발 서버 | GW_DEV_ORGSYNC | (이메일에서 전달받은 값) |
| 운영 서버 | GW_PRD_ORGSYNC | (이메일에서 전달받은 값) |

> ⚠️ **보안**: 계정 정보는 외부로 공유하지 말고, `.env`에만 저장하세요. `.env`는 Git에 커밋되지 않습니다.

## 2. 해야 할 일 (체크리스트)

### 2-1. 환경 변수 설정

`.env` 또는 `.env.local` 파일에 아래 변수를 추가하세요:

```env
# 세아웍스 인사 연동 (개발/운영 중 선택)
SEAH_ORGSYNC_USER_API_URL=https://...   # 사용자 정보 API (정의서에서 확인)
SEAH_ORGSYNC_ORG_API_URL=https://...    # 조직도 API (정의서에서 확인)
SEAH_ORGSYNC_USERNAME=GW_DEV_ORGSYNC   # 개발: GW_DEV_ORGSYNC / 운영: GW_PRD_ORGSYNC
SEAH_ORGSYNC_PASSWORD=이메일에서_받은_비밀번호
```

- **개발**: Username `GW_DEV_ORGSYNC`, Password는 이메일 발급 내용
- **운영**: Username `GW_PRD_ORGSYNC`, Password는 이메일 발급 내용
- **API Base URL**: 이메일과 함께 전달된 **정의서**에서 API URL 확인

### 2-2. 정의서 확인

이메일에 "정의서를 참고하시어"라고 했으므로, **정의서 파일**을 함께 받았을 가능성이 높습니다.

정의서에서 확인할 내용:
- **사용자 API URL** (`SEAH_ORGSYNC_USER_API_URL`): 사용자 정보 조회
- **조직도 API URL** (`SEAH_ORGSYNC_ORG_API_URL`): 조직도/부서 정보 조회
- 요청/응답 형식 (JSON 등)

### 2-3. API 호출 시 사용할 값

코드에서 API를 호출할 때:
1. **system_id**: `VTOGETHER` (헤더 또는 파라미터로 전달)
2. **인증**: Basic Auth (Username + Password를 Base64 인코딩)
3. **URL**: 사용자 조회 → `SEAH_ORGSYNC_USER_API_URL`, 조직도 조회 → `SEAH_ORGSYNC_ORG_API_URL`

## 3. V.Together 연동 구현

- **`lib/seah-orgsync.ts`**: API 클라이언트 (`fetchEmployees`, `getDeptNameByEmail`, `fetchDepartments`)
- **`app/auth/callback/route.ts`**: 로그인 시 세아웍스 API로 부서 조회 → `users.dept_name` 자동 동기화
- **부서 정보**: 로그인할 때마다 `users.dept_name` 자동 갱신
- **프로필 사진**: API 정의서에 해당 필드 없음. 향후 추가 시 연동 예정

## 4. 트러블슈팅

- **401 Unauthorized**: Username/Password가 잘못되었거나, 개발/운영 계정을 잘못 사용했을 수 있음
- **정의서가 없음**: VNTG 그룹웨어서비스팀 정선우 담당자에게 정의서 요청
