# 구현·인계 기록

기준일: 2026-10-19 (Asia/Seoul)

## 결정

- 기존 Render My Workspace 및 lianbag49-eng/beltrix 저장소 사용 요청을 반영.
- feature/ourbit-bd-mvp 브랜치의 ourbit-copilot 경로에 구현. 기존 서비스와 격리된 배포.
- 기존 Neon BELTRIX Market Intelligence 프로젝트에 ourbit-bd-mvp 브랜치 생성.
- CRM 데이터는 ourbit 스키마. 기존 프로젝트 데이터에 대한 분석·수정은 수행하지 않음.
- 계정 3개, 직원 개인 Telegram 채팅, 대외 수동 발송.
- Gemini AI 어댑터는 선택 연결. 키가 없으면 규칙 분석·기본 문구임을 명시.

## 작성 완료

웹 CRM, FastAPI API, 고정 Alembic 마이그레이션, 직원 관리·세션·권한, YouTube 발굴·중복 갱신·공개 출처·최근 게시일,
출처를 검증하는 AI 프로필 분석, 제안문 작성·타인 승인·승인 문구 복사, 내부 Telegram 웹훅, 테스트, Docker 및 Render 설정.

## 현재 검증 상태

Python 문법 검사와 TSX 구문 검사를 통과함. 로컬 Python/Node 패키지 설치는 네트워크·캐시 제한으로 실패함.
런타임 테스트와 전체 빌드 결과는 배포 검증 후 이 문서를 갱신한다. 작성 완료와 실행 검증을 구분한다.

## 사용자 연결 필요

첫 관리자 본인 계정 등록, 나머지 직원 계정과 Telegram 숫자 ID, YouTube API 키,
BotFather 내부 봇 토큰, 선택적 Gemini 키·모델. 모든 비밀값은 Render 비밀 변수에 직접 입력.
Telegram 웹훅 등록은 내부 봇 토큰 연결 후 실행한다.

## 다음 행동

GitHub에 검토 가능한 소스 게시 → Render Docker 빌드 테스트 → Neon 마이그레이션 확인 → HTTPS 화면·API 확인 → 결과 기록.
