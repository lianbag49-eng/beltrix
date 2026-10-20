# Ourbit BD AI Copilot 구현·검증 결과

확인일: 2026-10-19 (Asia/Seoul)

## 접속 및 소스

- [CRM 접속](https://ourbit-bd-copilot.onrender.com)
- [Render 관리](https://dashboard.render.com/web/srv-dbavo2ijnfac739b9c70)
- [소스 및 검토 PR #53](https://github.com/lianbag49-eng/beltrix/pull/53)
- 기준 코드 커밋: `43bec3e08a0b35613ea26f07096762c3fcc9983a`
- 기존 My Workspace, BELTRIX 저장소, Neon BELTRIX 프로젝트를 사용했다. Ourbit 전용 서비스·Git 브랜치·DB 브랜치·스키마로 구성했다.
- PR은 초안이며 기존 main에 병합하지 않았다.

## 구현 결과

| 항목 | 구현 및 검증 범위 |
|---|---|
| 웹 CRM | Next.js/TypeScript. 로그인, 발굴 목록, KOL 상세, 담당자·상태·메모, 제안 검토, 발굴·활동 기록, 직원 계정·연결 설정 |
| 인증·권한 | 직원 슬롯 3개, 관리자·검토자·담당자, Argon2 비밀번호 해시, DB 세션, HttpOnly/Secure 쿠키, Origin 검증, 로그인 시도 제한 |
| 공개 KOL 발굴 | YouTube 공식 API. 검색 상위 최대 5개 채널, 채널별 공개 업로드 최대 10개, 출처·확인일·최근 게시일·숨긴 구독자 처리 |
| 중복 검증 | 고유 channel_id + 원자적 upsert. 중복 갱신 시 담당자·메모·진행 상태 보존 |
| 프로필 분석 | 기본 공개 텍스트 키워드 분석. 선택적 Gemini 연결 시 출처 영상 인덱스를 검증한 콘텐츠 유형 추정 |
| 제안문 승인 | 검증된 비상업적 문의 문구만 생성. 작성자 본인 승인 금지. 타 검토자 승인과 버전 검사. 승인·출처 유효기간 검사 후 문구 복사 |
| Telegram | 직원 숫자 ID 허용 목록, 개인 채팅, 웹훅 비밀값, 중복 업데이트 차단. KOL 조회·AI 분석·검토 대기 초안·검토 수 조회 |
| DB | Neon 별도 브랜치 `ourbit-bd-mvp`, `ourbit` 스키마, Alembic 0001, 테이블 9개 |
| 배포 | 하나의 Render Docker 서비스에서 Next.js와 내부 FastAPI를 실행. 비밀값은 Render 변수로 관리 |

대외 메시지는 직원의 기존 Telegram 계정에서 직접 발송한다. 승인되지 않은 요율, 만료 이벤트, 미확정 연동 일정은 제안문에 넣을 수 없다.

## 검증 증거

- Python 문법 검사, TypeScript/TSX 구문 검사 통과.
- Render 빌드에서 백엔드 테스트 21개 통과. 권한·타인 승인·중복·오래된 출처·임의 홍보 문구 차단·봇 재처리·AI 출처 검증 등을 포함한다.
- Next.js 타입 검사와 프로덕션 빌드 통과.
- Chromium 390px와 1280px에서 로그인 → CRM → KOL 상세 → 검토 화면 검사 통과. 가로 넘침 및 JavaScript 오류 없음. 이 검사는 격리된 테스트 API 응답을 사용한다.
- 실행 서버 준비 검사에서 실제 DB 준비 응답 200, 비로그인 CRM 조회 401, 페이지·모든 클라이언트 스크립트 200을 확인했다.
- Neon에서 마이그레이션 버전 0001과 테이블 9개를 재확인했다. 운영 직원·KOL 데이터는 각 0개였다.
- 최종 코드 `43bec3e` 배포 `dep-dbb01fc9v7es73a6c3ug`: `live`. 2026-10-19 20:37:44 KST에 배포 완료, 이후 실행 준비 검사도 통과했다.

## 사용자 연결이 필요한 항목

1. Render 비밀 변수에 32자 이상의 임의 `BOOTSTRAP_TOKEN`을 설정한 뒤, 직원 본인이 `/setup`에서 첫 관리자 계정을 등록한다.
2. 관리자 화면에서 실제 직원 2명을 추가하고 역할·Telegram 숫자 ID를 등록한다.
3. `YOUTUBE_API_KEY`, 내부 봇의 `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`을 Render 비밀 변수로 등록한다.
4. 내부 봇 웹훅을 등록하고 직원이 봇과 개인 대화를 시작한다.
5. AI를 사용하려면 `GEMINI_API_KEY`와 사용 가능한 `GEMINI_MODEL`을 설정한다.

자세한 절차는 [SETUP.md](SETUP.md)에 있다. DB 연결 문자열은 이미 등록되어 있다. 비밀번호·토큰은 채팅에 전달하지 않는다.

## 확인하지 못한 부분과 제한

- 실제 YouTube 발굴·Gemini 분석·Telegram 응답은 해당 키·직원 연결 전이라 라이브 성공으로 보고하지 않는다. 현재 제공자 검증은 모의 응답을 사용했다.
- 계정·OAuth·BotFather 로그인은 직원이 직접 수행한다. 실제 고객·직원 정보를 임의로 입력하지 않았다.
- Codex 브라우저의 제어 연결이 시간 초과되어 그 경로의 화면 확인은 끝내지 못했다. 배포 빌드의 별도 Chromium 검사와 실행 서버 준비 검사로 동작을 검증했다.
- 로컬 런타임 패키지 설치는 네트워크 제한으로 실패해 Render 빌드에서 실행 검증을 수행했다.
- Render 무료 서비스의 유휴 중단 때문에 첫 접속·봇 응답이 지연될 수 있다.
- Blueprint CLI/API 검증은 별도로 수행하지 않았다. 실제 배포는 Render API로 Docker 서비스를 생성해 검증했다.
- 이전 대화의 상세 응답은 참조 표시만 반환되어 복원하지 못했다. 이번 사용자 요청에 명시된 요구사항을 구현 기준으로 사용했다.

출처·확인일과 구현 상세는 [README.md](README.md), 작업 인계는 [PROJECT_LOG.md](PROJECT_LOG.md)에 남겼다.
