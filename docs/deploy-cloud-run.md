# Cloud Run 배포 가이드 (비개발자용)

vtogether 웹 서비스를 **인터넷에 올려서 누구나 접속할 수 있게** 만드는 방법입니다.

> **Cloud Run이 뭐예요?**  
> 구글이 제공하는 "웹사이트 호스팅 서비스"입니다. 우리가 만든 앱을 구글 서버에 올려두면, 전 세계 누구나 URL로 접속할 수 있습니다.

---

## 여기서 볼 곳 (링크 모음)

| 확인할 것 | 어디서 보나요? |
|-----------|----------------|
| **Supabase 키 3개** | 로컬 `.env`에 이미 있으면 그대로 사용. 없으면 [Supabase 대시보드](https://supabase.com/dashboard) → Project Settings → API |
| **Google Cloud 프로젝트** | [Google Cloud Console](https://console.cloud.google.com) |
| **Cloud Run 서비스 (배포된 앱)** | [Cloud Run 콘솔](https://console.cloud.google.com/run) |
| **환경 변수 수정** | Cloud Run 콘솔 → vtogether 클릭 → **수정** → 변수 및 시크릿 탭 |
| **Google OAuth 설정** | [Credentials](https://console.cloud.google.com/apis/credentials) → OAuth 2.0 클라이언트 ID |
| **Secret Manager (비밀 키)** | [Secret Manager](https://console.cloud.google.com/security/secret-manager) |

배포가 끝나면 **Cloud Run 콘솔**에서 서비스 URL을 확인하고, 그 주소로 접속하면 됩니다.

---

## 1단계: 준비물 (미리 해둘 일)

배포하기 전에 아래 세 가지를 준비해야 합니다.

| 준비물 | 설명 |
|--------|------|
| **Google Cloud 프로젝트** | 구글 클라우드에서 "프로젝트"를 하나 만듭니다. (무료로 시작 가능) |
| **gcloud CLI** | 터미널(검은 창)에서 구글 클라우드를 조작하는 도구입니다. [설치 방법](https://cloud.google.com/sdk/docs/install) |
| **Supabase 키 3개** | vtogether가 쓰는 데이터베이스(Supabase) 주소와 비밀번호 같은 것들입니다. |

### gcloud 로그인하기

터미널을 열고 아래를 입력합니다.

```
gcloud auth login
```

브라우저가 뜨면 구글 계정으로 로그인합니다.

그 다음, 사용할 프로젝트를 지정합니다.

```
gcloud config set project 여기에_프로젝트_ID_입력
```

---

## 2단계: 앱이 알아야 할 정보 (환경 변수)

vtogether 앱이 제대로 동작하려면 **4가지 정보**를 알려줘야 합니다.

| 정보 이름 | 뭐하는 데 쓰나요? | 어디서 구하나요? |
|-----------|-------------------|------------------|
| `NEXT_PUBLIC_SUPABASE_URL` | 데이터베이스 주소 | **로컬 .env에 이미 있으면 그대로 사용** (또는 Supabase → Project Settings → API) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 데이터베이스 공개 키 | **로컬 .env에 이미 있으면 그대로 사용** (또는 위와 같은 곳) |
| `SUPABASE_SERVICE_ROLE_KEY` | 관리자 기능용 비밀 키 | **로컬 .env에 이미 있으면 그대로 사용** (또는 위와 같은 곳, service_role) |
| `NEXT_PUBLIC_APP_URL` | 배포 후 우리 앱 주소 | **처음엔 모름** → 배포 후 나온 URL로 나중에 수정 |

> **환경 변수가 뭐예요?**  
> 앱에게 "데이터베이스는 여기 있어", "우리 주소는 이거야" 같은 설정값을 전달하는 방식입니다.

---

## 3단계: 배포 명령어 실행

프로젝트 폴더(vtogether) 안에서 터미널을 연 뒤, 아래 **둘 중 하나**를 실행합니다.

### 방법 A: 스크립트 사용 (권장)

```bash
npm run deploy
```

또는

```bash
./scripts/deploy.sh
```

`.env` 파일의 값을 자동으로 읽어서 배포합니다. gcloud 로그인·프로젝트·필수 환경 변수를 미리 확인합니다.

### 방법 B: 수동 명령어

> 💡 **Cursor/로컬 .env에 이미 Supabase URL, anon 키를 넣어뒀다면** 그 값을 복사해서 `여기_Supabase_URL`, `여기_anon키` 자리에 붙여넣으면 됩니다. Supabase 대시보드에 다시 들어갈 필요 없어요.

```
gcloud run deploy vtogether --source . --region asia-northeast3 --allow-unauthenticated --set-env-vars "NEXT_PUBLIC_SUPABASE_URL=여기_Supabase_URL,NEXT_PUBLIC_SUPABASE_ANON_KEY=여기_anon키,NEXT_PUBLIC_APP_URL=https://임시주소.run.app"
```

**각 부분이 뭔가요?**

- `vtogether` : 서비스 이름 (원하면 다른 이름으로 바꿔도 됨)
- `--source .` : "지금 있는 폴더를 그대로 올려라"
- `--region asia-northeast3` : 서울 서버에 올린다
- `--allow-unauthenticated` : 로그인 없이 누구나 접속 가능
- `--set-env-vars` : 위에서 말한 4가지 정보를 전달

처음 실행하면 "API 사용 설정" 같은 질문이 나올 수 있습니다. `y` 입력 후 엔터하면 됩니다.

---

## 4단계: 비밀 키(service_role) 안전하게 넣기

`SUPABASE_SERVICE_ROLE_KEY`는 **절대 그대로 노출되면 안 되는** 비밀 키입니다.  
구글의 "Secret Manager"에 저장해 두고, Cloud Run이 그걸 읽어 쓰게 합니다.

### 4-1. 시크릿 등록

**방법 A: 스크립트 사용 (권장)**

```bash
npm run deploy:setup
```

또는 `./scripts/setup-secrets.sh` — `.env`의 `SUPABASE_SERVICE_ROLE_KEY`를 읽어 시크릿을 생성하고 Cloud Run 권한까지 설정합니다.

**방법 B: 수동 명령어**

```
echo -n "여기에_service_role_키_붙여넣기" | gcloud secrets create supabase-service-role --data-file=-
```

### 4-2. Cloud Run이 시크릿을 읽을 수 있게 권한 주기

먼저 프로젝트 번호를 확인합니다.

```
gcloud projects describe 프로젝트ID --format="value(projectNumber)"
```

나온 숫자를 아래 `프로젝트번호` 자리에 넣습니다.

```
gcloud secrets add-iam-policy-binding supabase-service-role --member="serviceAccount:프로젝트번호-compute@developer.gserviceaccount.com" --role="roles/secretmanager.secretAccessor"
```

### 4-3. 배포할 때 시크릿 연결하기

3단계 명령어 맨 뒤에 아래를 추가해서 다시 실행합니다.

```
--set-secrets "SUPABASE_SERVICE_ROLE_KEY=supabase-service-role:latest"
```

---

## 5단계: Google 로그인 설정 (OAuth)

배포가 끝나면 **Cloud Run URL**이 나옵니다. (예: `https://vtogether-abc123-xx.a.run.app`)

Google 로그인을 쓰려면, 이 URL을 구글에 "이 주소로 로그인 결과를 보내도 된다"고 등록해야 합니다.

1. [Google Cloud Console](https://console.cloud.google.com) 접속
2. 왼쪽 메뉴 **APIs & Services** → **Credentials**
3. **OAuth 2.0 클라이언트 ID** 클릭
4. **승인된 리디렉션 URI**에 아래 주소 추가:
   - `https://여기_Cloud_Run_URL/auth/callback`

예: `https://vtogether-abc123-xx.a.run.app/auth/callback`

5. 저장

---

## 6단계: NEXT_PUBLIC_APP_URL 수정

배포 후 실제 URL이 나왔으면, 그 URL로 `NEXT_PUBLIC_APP_URL`을 바꿔야 합니다.

1. [Cloud Run 콘솔](https://console.cloud.google.com/run) 접속
2. `vtogether` 서비스 클릭
3. **수정** 버튼
4. **변수 및 시크릿** 탭에서 `NEXT_PUBLIC_APP_URL` 값을 배포된 URL로 변경 (예: `https://vtogether-abc123-xx.a.run.app`)
5. **배포** 클릭

---

## 정리: 순서대로 하면 됩니다

1. gcloud 로그인 + 프로젝트 지정  
2. Supabase에서 URL, anon 키, service_role 키 복사  
3. `gcloud run deploy` 명령어 실행 (환경 변수 포함)  
4. Secret Manager에 service_role 키 등록 + 권한 부여  
5. Google OAuth에 리다이렉트 URI 추가  
6. 배포된 URL로 `NEXT_PUBLIC_APP_URL` 수정  

이렇게 하면 vtogether가 인터넷에서 접속 가능한 서비스로 올라갑니다.
