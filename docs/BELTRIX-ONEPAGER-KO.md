# BELTRIX — External One-Pager

## DEX Trading Terminal & Multi-Venue Infrastructure

**BELTRIX는 현재 Hyperliquid를 핵심 execution venue로 사용하는 DEX 트레이딩 터미널이며, 장기적으로 여러 DEX의 시장 데이터·유동성·실행 인프라를 하나의 인터페이스에서 연결하는 멀티베뉴 트레이딩 인프라를 목표로 개발 중인 프로젝트입니다.**

### 30초 소개

BELTRIX는 코인/마켓을 중심으로 차트, 호가, 주문, 리스크 정보를 한 화면에 통합하는 탈중앙 파생상품 트레이딩 플랫폼입니다. 현재 공개 제품은 Hyperliquid 시장을 중심으로 동작하고 있으며, 내부적으로 Hyperliquid·Orderly·Paradex·dYdX·GMX 등 주요 DEX의 유동성, 수수료 구조, 시장 상태 및 execution 조건을 정규화해 비교하는 Market Intelligence 시스템을 구축하고 있습니다.

장기적으로는 한 거래소에 종속된 프론트엔드가 아니라 **사용자 인터페이스, 데이터 분석, execution adapter, BD/white-label 인프라를 분리한 거래 인프라**로 확장하는 것이 목표입니다.

---

## 현재 공개 제품

- Hyperliquid 기반 전체 perpetual market 탐색
- 코인 중심 마켓 UI 및 자산 로고
- 실시간 차트 및 orderbook 연동
- 선물 주문 인터페이스
- 모바일/데스크톱 반응형 UI
- Builder fee 동의 흐름
- Referral / campaign attribution 기반
- Black & Gold 기반 BELTRIX 자체 UI

**Public URL**  
https://lianbag49-eng.github.io/beltrix/

---

## BELTRIX가 만들고 있는 핵심 구조

### 1. Asset-first Trading Terminal
거래소를 먼저 선택하는 구조가 아니라 BTC, ETH, SOL 등 **자산을 먼저 선택**하고 해당 자산을 지원하는 venue 데이터를 연결합니다.

### 2. Multi-Venue Market Intelligence
내부 시스템에서 다음 항목을 정규화하고 있습니다.

- Bid / Ask / Spread
- Orderbook Depth
- 주문금액별 예상 Market Impact
- Fill Ratio
- Funding Rate
- Open Interest
- 24h Volume
- API Health / Latency
- Venue Health Alerts
- Funding / OI / Volume Trend Analytics
- GMX Long / Short Trading Capacity
- Venue별 Execution Qualification
- 수수료 및 Revenue Model
- White-label / BD 가능성

내부 history는 현재 브라우저 local storage 기반으로 운용되며, 서버형 수집으로 전환할 수 있도록 PostgreSQL 저장 스키마와 collector/storage adapter까지 준비되어 있습니다. 실제 24/7 서버 수집은 전용 backend/database 배포 이후 단계입니다.

### 3. Execution Adapter Architecture
각 DEX를 BELTRIX UI에 직접 하드코딩하지 않고 venue adapter 구조로 분리해 향후 새로운 execution venue를 추가할 수 있도록 설계하고 있습니다.

### 4. White-label Infrastructure
장기적으로 BELTRIX Core를 기반으로 파트너사가 자신의 브랜드, 도메인, 수수료 정책과 지원 마켓을 적용할 수 있는 B2B white-label 구조를 검토하고 있습니다.

---

## 현재 연구 중인 주요 Venue

| Venue | 현재 BELTRIX 내 역할 |
|---|---|
| Hyperliquid | 현재 공개 execution baseline |
| Orderly | Shared liquidity / White-label 후보 |
| GMX | Pool/JIT execution 및 frontend economics 연구 |
| Paradex | CLOB/API execution 연구 |
| dYdX | Chain/Indexer 기반 execution 연구 |
| Drift | 향후 확장 watchlist |

**중요:** 경쟁 venue는 현재 Market Intelligence 및 기술 연구용이며, BELTRIX 공개 제품에서 실주문 execution venue로 활성화되어 있지 않습니다.

---

## 사업화 방향

BELTRIX는 단순 거래 화면보다 다음 네 가지 사업 축을 목표로 합니다.

1. **Trading Frontend Revenue**  
   Builder fee, referral, frontend attribution 등 protocol이 지원하는 수익 구조

2. **White-label B2B**  
   파트너사 전용 거래 터미널 및 브랜드형 DEX frontend

3. **Market Intelligence**  
   DEX별 유동성, 시장 상태, execution quality 및 API health 분석

4. **Future Smart Execution Infrastructure**  
   충분한 검증 이후 여러 venue 중 사용자가 선택한 기준에 맞춰 execution을 지원하는 인프라

---

## BELTRIX의 방향성

BELTRIX의 목표는 **“또 하나의 거래소 UI”가 아니라 여러 DEX를 연결하고 분석하고 확장할 수 있는 독립적인 Trading Infrastructure Layer**를 구축하는 것입니다.

현재는 Hyperliquid-first 제품으로 시작하고 있지만, 백엔드와 내부 시스템은 향후 새로운 DEX, white-label 사업, institutional/BD integration까지 확장할 수 있도록 분리 설계하고 있습니다.

---

## 소개 시 권장 표현

**짧게:**  
“BELTRIX는 Hyperliquid를 기반으로 시작한 DEX 트레이딩 터미널이고, 여러 DEX의 유동성·데이터·execution을 하나의 인프라로 연결하는 방향으로 확장하고 있습니다.”

**조금 더 전문적으로:**  
“BELTRIX is a Hyperliquid-first decentralized derivatives trading terminal evolving into a multi-venue market intelligence, execution and white-label infrastructure layer.”

### 현재 사용을 피하는 표현

- “BELTRIX 자체 오더북과 자체 유동성을 가진 독립 DEX”
- “모든 DEX에서 이미 자동으로 최적 체결”
- “Orderly/GMX/Paradex/dYdX와 공식 제휴 완료”

해당 기능이나 제휴가 실제 활성화된 이후에만 사용하는 것이 정확합니다.
