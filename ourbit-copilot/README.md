# Ourbit BD AI Copilot MVP

직원 3명용 Next.js/TypeScript CRM + FastAPI + Neon PostgreSQL + Render.

## 구현 범위

- 검색어를 통한 YouTube 공개 채널 발굴: 최대 5개 채널, 채널별 최근 공개 업로드 최대 10개.
- 공식 채널 ID로 중복 방지·정보 갱신. 출처 URL, 확인 시각, 최근 영상 게시일, 구독자 비공개 상태 보존.
- 기본 프로필은 공개 텍스트 키워드 분석. 선택적 Gemini 연결 시 원본 영상 인덱스를 검증하는 콘텐츠 유형 AI 분석.
- KOL 담당자, 내부 메모, 진행 상태. 발굴 이력과 감사 기록.
- 비밀번호 Argon2 해시, DB 세션, HttpOnly/Secure/SameSite 쿠키, 요청 Origin 검사, DB 로그인 시도 제한.
- 관리자·검토자·담당자. 계정 슬롯은 DB 제약으로 3개. 작성자 본인 승인 불가.
- AI는 검증된 협업 문의 문구 유형만 선택. 연결 전에는 기본 문구임을 표시.
- 승인 전 복사 차단. 승인 유효기간 7일, 공개 출처 확인 유효기간 30일.
- 직원 Telegram ID 허용 목록, 개인 채팅만 지원, 웹훅 비밀값 검증, update_id 재처리 차단.
- 외부 KOL에게 자동 발송하는 기능은 없음. 기존 Telegram 계정에서 직원이 직접 발송.

## 시작

Python 3.12+, Node.js 24 기준. 비밀값은 `.env` 또는 배포 서비스 비밀 변수에 입력한다.

```sh
cd backend
python -m venv .venv
# 가상환경 활성화 후
pip install -r requirements.txt
cp .env.example .env
alembic upgrade head
uvicorn app.main:app --host 127.0.0.1 --port 8000
```

```sh
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

로컬 최초 계정은 `backend`에서 `python -m app.manage provision --slot 1`로 등록한다.
웹 초기 설정을 사용하려면 충분히 긴 임의의 `BOOTSTRAP_TOKEN`을 서버 비밀 변수로 등록한 후 `/setup`에 접속한다.
첫 관리자 생성 후 초기 설정 API는 닫힌다. 테스트용 자격 증명은 운영에 생성하지 않는다.

## 운영 연결

| 변수 | 목적 | 비밀 여부 |
|---|---|---|
| APP_ENV | 운영은 `production` | 일반 |
| WEB_ORIGIN | 실제 CRM HTTPS 주소, 끝 `/` 제외 | 일반 |
| DATABASE_URL | Neon 실행용 연결 문자열, SSL 사용 | 비밀 |
| DATABASE_URL_UNPOOLED | Neon 직접 연결, 마이그레이션 전용 | 비밀 |
| DATABASE_SCHEMA | `ourbit` | 일반 |
| BOOTSTRAP_TOKEN | 첫 관리자 등록 코드, 설정 후 제거 가능 | 비밀 |
| YOUTUBE_API_KEY | YouTube Data API v3 키 | 비밀 |
| TELEGRAM_BOT_TOKEN | BotFather 발급 내부 봇 토큰 | 비밀 |
| TELEGRAM_WEBHOOK_SECRET | Telegram 웹훅 인증 코드 | 비밀 |
| GEMINI_API_KEY / GEMINI_MODEL | 선택적 AI 연결, 사용 가능한 모델명을 직접 설정 | 비밀 / 일반 |
| API_BASE_URL | 컨테이너 내부 FastAPI 주소 | 일반 |

관리자는 `/setup`에서 본인의 실제 계정을 등록한 뒤, 연결 상태 화면에서 직원 슬롯 2·3과 Telegram 숫자 ID를 등록한다.
계정 정보 변경은 해당 직원의 기존 로그인 세션을 폐기한다. 비활성화는 `python -m app.manage disable --slot N`으로 수행한다.
비밀번호·토큰을 채팅이나 Git에 붙이지 않는다. 로그인·OAuth·BotFather 계정 작업은 직원이 수행한다.

Telegram 웹훅 URL은 `https://<실제 CRM 주소>/api/telegram/webhook`.
서버의 등록 도구 `python -m app.telegram_setup --url <URL>`은 환경변수의 토큰과 웹훅 비밀값을 사용한다.
직원이 내부 봇과 개인 대화를 먼저 시작해야 한다. 명령: `/start`, `/kol 검색어`, `/pending`.
Telegram 응답은 내부 조회·검토 링크 안내이며 제안문 승인은 CRM에서 수행한다.

## DB / API

Alembic `0001`은 독립된 고정 마이그레이션이며, 코드 변경에 따라 과거 정의가 달라지지 않는다.
PostgreSQL에서는 `ourbit` 스키마와 스키마 내 Alembic 버전을 사용한다. SQLite는 로컬 개발·격리 테스트용이다.
운영 마이그레이션은 직접 연결 문자열을 사용하며, `-pooler` 호스트를 거부한다.
파괴적인 downgrade는 제공하지 않는다. 복구는 승인된 백업·스냅샷 절차로 수행한다.

| API | 설명 |
|---|---|
| POST /auth/bootstrap, /auth/login, /auth/logout | 초기 관리자, 로그인, 로그아웃 |
| GET /auth/me, /users | 현재 직원·팀 목록 |
| PUT /users/{1..3} | 관리자 직원 계정 발급·갱신 |
| POST /discovery; GET /discoveries | 공개 후보 발굴·이력 |
| GET /kols, /kols/{id}; PATCH /kols/{id} | 목록·상세·업무 정보 |
| POST /kols/{id}/analyze | 출처 검증 AI 콘텐츠 분석 |
| POST /kols/{id}/proposals | 검토용 제안문 생성 |
| GET /proposals | 제안문 목록 |
| POST /proposals/{id}/review | 다른 검토자의 승인·반려, 버전 검사 |
| POST /proposals/{id}/copy | 승인·출처 유효기간 검사 후 복사 기록 |
| GET /integrations, /audit | 설정 등록 상태·감사 기록 |
| POST /telegram/webhook | 비밀값·직원 ID를 검증한 내부 봇 |
| GET /healthz, /readyz | 프로세스·DB 준비 상태 |

브라우저는 `/api/…`를 사용한다. FastAPI는 컨테이너의 loopback에서만 수신한다.
API 세션 쿠키는 브라우저 저장소에 토큰을 노출하지 않는다. 웹훅에는 별도 비밀 헤더가 필요하다.

## 검증과 배포

```sh
cd backend
python -m pytest -q
alembic upgrade head
cd ../frontend
npm run typecheck
npm run build
```

Dockerfile은 위 테스트와 프런트엔드 빌드가 통과해야 이미지를 만든다. 실패하면 배포가 중단된다.
모바일 390px와 PC 1280px 브라우저 검사도 빌드 안에서 실행한다. 이 검사는 명시된 테스트용 API 응답을 사용하며 실제 KOL·직원 데이터는 생성하지 않는다.
서버 시작 시 실제 DB 준비 상태, 비로그인 데이터 접근 차단(401), 페이지와 클라이언트 스크립트 응답을 검사한다.
하나의 Render 서비스에서 Next.js와 내부 FastAPI를 실행한다. DB는 Neon에 저장한다.
현재 Render 무료 서비스는 유휴 중단이 있으므로 봇 응답 지연이 발생할 수 있다. 운영 전용 상시 가동 요금제 전환은 별도 결정한다.
`render.yaml`은 저장소 루트에서 `ourbit-copilot/render.yaml` 경로를 지정해 사용한다.
배포 전 Blueprint는 Render CLI/API로 플랫폼 검증해야 한다. YAML 파일 작성만으로 검증 완료가 아니다.

## 의도적으로 제한한 부분

- 거래량·진성 구독자·투자 성과·협업 의향은 확인하지 않으며 추정 수치를 표시하지 않는다.
- 발굴은 검색 상위 표본이며 YouTube 전체 크리에이터를 전수 수집하지 않는다. 검색 페이지 순회·주기 수집은 후속 범위다.
- 공개 업로드를 확인할 수 없으면 최근 게시일은 `확인 불가`로 남긴다.
- 외부 요율·이벤트·연동 일정의 승인 원장이 아직 없으므로 해당 내용은 제안문에 포함할 수 없다.
- 자유 문장 편집은 MVP에서 제공하지 않는다. 검증 문구 유형 선택과 직원 승인 흐름에 한정한다.
- Telegram 중복 방지는 일반 재전송을 차단한다. 외부 전송 성공 직후 DB 연결이 실패하는 경계에서는 동일 내부 답변이 재전송될 수 있다.
- Gemini 연결은 선택 구현이다. 실제 키·모델을 연결하기 전에는 라이브 AI 분석 성공으로 보고하지 않는다.

## 출처 및 확인일

확인일: 2026-10-19 (Asia/Seoul).

- [YouTube search.list](https://developers.google.com/youtube/data/reference/rest/v3/search/list)
- [YouTube playlistItems.list](https://developers.google.com/youtube/data/reference/rest/v3/playlistItems/list)
- [Telegram Bot API](https://core.telegram.org/bots/api)
- [FastAPI 보안](https://fastapi.tiangolo.com/tutorial/security/oauth2-jwt/)
- [Next.js 설정](https://nextjs.org/docs/app/api-reference/config/next-config-js)
- [Gemini generateContent](https://ai.google.dev/api/generate-content?hl=en)
- [Render Blueprint](https://render.com/docs/blueprint-spec), [배포](https://render.com/docs/deploys), [비밀 변수](https://render.com/docs/configure-environment-variables)

이전 대화의 상세 응답은 참조 표시만 반환되어 읽지 못했다. 이번 사용자 요청에 명시된 요구사항을 구현 기준으로 사용했다.
