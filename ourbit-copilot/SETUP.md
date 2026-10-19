# 운영 연결 순서

구현 코드와 배포된 초기 워크룸이 준비되어 있다. 실제 직원과 외부 API 연결은 아래 순서로 진행한다.

1. [Render 서비스](https://dashboard.render.com/web/srv-dbavo2ijnfac739b9c70)의 Environment에서 임의의 충분히 긴 `BOOTSTRAP_TOKEN`(32자 이상)을 비밀 변수로 설정하고 반영 배포한다. 비밀값을 채팅에 보내지 않는다.
2. [첫 관리자 등록](https://ourbit-bd-copilot.onrender.com/setup) 화면에서 직원 본인이 초기 설정 코드·이메일·비밀번호를 입력한다. 첫 등록 후 초기 설정 API가 닫힌다.
3. 로그인 후 ‘연결 상태 → 직원 계정 관리’에서 슬롯 2·3을 등록한다. 다른 직원의 제안문을 승인할 검토자 또는 관리자가 최소 한 명 더 있어야 한다.
4. YouTube Data API v3를 활성화한 키를 `YOUTUBE_API_KEY`로 등록한다. 키 제한은 서버에서 사용할 YouTube Data API로 설정한다.
5. 직원이 BotFather에서 내부 봇을 만들고 `TELEGRAM_BOT_TOKEN`을 비밀 변수로 등록한다. 임의의 `TELEGRAM_WEBHOOK_SECRET`도 등록하고, 각 직원의 Telegram 숫자 ID를 해당 직원 슬롯에 입력한다.
6. 직원이 봇과 개인 대화를 시작한다. 서버 환경에서 `python -m app.telegram_setup --url https://ourbit-bd-copilot.onrender.com/api/telegram/webhook`을 실행하거나 Telegram 공식 setWebhook API로 URL과 같은 비밀값을 등록한다. 무료 Render 서비스의 셸 제약이 있으면 동일 비밀값을 가진 승인된 로컬 실행 환경에서 등록 도구를 실행한다.
7. AI 기능을 사용하려면 `GEMINI_API_KEY`와 사용 가능한 `GEMINI_MODEL`을 등록한다. 미연결 시 화면에는 기본 키워드 분석·검증 문구를 사용한다고 표시한다.
8. 실제 검색어 한 개로 공개 KOL을 발굴하고, 원본 채널·최근 게시일을 대조한다. 상세에서 AI 분석과 제안문 생성을 실행한 뒤 다른 검토자가 승인하고 승인 문구를 복사한다.
9. 내부 봇에서 `/kol 검색어`로 KOL 번호를 확인하고 `/analyze 번호`, `/draft 번호`, `/pending`을 확인한다. 제안문은 검토 대기로 저장되며 대외 발송은 직원의 기존 계정에서 직접 수행한다.

DB 연결 문자열은 이미 Render 비밀 변수에 등록되어 있다. 기존 서비스의 비밀값을 복사할 필요가 없다.
계정·OAuth·BotFather 로그인과 비밀번호 입력은 직원이 직접 수행한다.
