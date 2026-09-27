# BELTRIX — Partner / BD Introduction Brief

## 1. Executive Summary

**BELTRIX**는 탈중앙 파생상품 시장을 대상으로 개발 중인 **DEX Trading Terminal + Multi-Venue Infrastructure** 프로젝트입니다.

현재 공개 제품은 Hyperliquid를 execution baseline으로 사용하며, 주요 perpetual market을 BELTRIX 자체 UI에서 탐색하고 차트·호가·선물 거래 흐름을 사용할 수 있도록 구성되어 있습니다.

동시에 내부적으로는 Hyperliquid, Orderly, GMX, Paradex, dYdX 등 주요 DEX를 대상으로 **Market Intelligence, execution qualification, BD, fee/revenue 및 white-label 분석 인프라**를 개발하고 있습니다.

장기적인 목표는 특정 DEX의 단순 프론트엔드를 만드는 것이 아니라 다음 레이어를 분리해 재사용 가능한 거래 인프라를 구축하는 것입니다.

- User Experience
- Asset / Market Registry
- Market Data
- Venue Adapters
- Execution
- Risk
- Analytics
- Attribution
- BD / Commercial Intelligence
- White-label

---

# 2. 문제 정의

현재 DEX 파생상품 시장은 venue마다 다음 요소가 제각각입니다.

- Market symbol
- Orderbook 구조
- Funding
- Open Interest
- Trading fees
- Liquidity model
- Wallet / signing
- Rate limits
- API architecture
- Referral / builder economics
- White-label 지원 범위

사용자와 사업자는 여러 프로토콜을 비교하기 위해 각기 다른 UI와 API를 개별적으로 사용해야 합니다.

BELTRIX는 이를 **Asset-first abstraction layer**로 통합하는 것을 목표로 합니다.

예:

BTC
→ Hyperliquid BTC
→ Orderly PERP_BTC_USDC
→ Paradex BTC-USD-PERP
→ dYdX BTC-USD
→ GMX BTC market

사용자는 “거래소”보다 “자산”을 중심으로 시장을 보고, 시스템 내부에서 각 venue의 데이터를 정규화합니다.

---

# 3. 현재 제품

## Public BELTRIX

현재 외부에서 확인 가능한 제품은 **Hyperliquid-first trading terminal**입니다.

### 구현된 주요 기능

- Hyperliquid 전체 시장 탐색 구조
- 공식 자산 로고
- 실시간 차트
- Orderbook
- Futures UI
- 모바일 / 데스크톱 UI
- Builder fee explicit consent
- Referral / campaign attribution foundation
- Venue adapter foundation
- Black & Gold visual identity

Public URL:

https://lianbag49-eng.github.io/beltrix/

---

# 4. Internal DEX Intelligence

BELTRIX 내부 Admin / Market Intelligence 시스템은 경쟁 DEX를 직접 실행시키기 전에 기술 및 사업 관점에서 비교하도록 설계되었습니다.

## 현재 비교 대상

- Hyperliquid
- Orderly
- GMX
- Paradex
- dYdX
- Drift

## Liquidity Intelligence

CLOB venue:

- Spread
- ±10 / ±25 / ±50 bps depth
- $1K / $10K / $50K / $100K simulated order impact
- Fill ratio
- Data freshness
- API latency

GMX:

- Oracle / pool execution model
- Long trading capacity
- Short trading capacity
- Base liquidity
- JIT liquidity
- Limiting factor
- JIT data state
- Market data state

서로 다른 liquidity model을 동일한 orderbook처럼 왜곡해서 비교하지 않는 것이 설계 원칙입니다.

---

# 5. Market Metrics & Monitoring

Phase 4부터 내부 Market Intelligence는 단일 시점 비교뿐 아니라 시간축 데이터도 축적하도록 확장하고 있습니다.

수집 대상:

- Funding Rate
- Open Interest
- 24h Volume
- Spread
- Depth
- Market Impact
- API Availability
- API Latency
- GMX Capacity

현재 history는 내부 Admin 브라우저의 local storage 기반으로 최대 7일 보관하도록 설계되어 있으며, 추후 database-backed historical analytics로 이전할 수 있는 구조입니다.

---

# 6. Execution Qualification

BELTRIX는 “API가 존재한다”는 이유만으로 새로운 venue를 바로 실거래에 연결하지 않습니다.

각 venue는 다음 gate를 통과해야 합니다.

1. Public Market Data
2. Canonical Symbol Mapping
3. Normalized Liquidity Model
4. Fee Model
5. Execution Cost Model
6. Signing Model
7. Order Lifecycle
8. Position Reconciliation
9. Rate Limits
10. Regional Policy
11. Failure Recovery
12. Paper/Testnet E2E

현재 BELTRIX에서 공개 execution baseline으로 취급되는 venue는 Hyperliquid이며, 경쟁 DEX는 research-only입니다.

---

# 7. White-label Strategy

BELTRIX는 향후 B2B white-label을 중요한 사업 축으로 검토하고 있습니다.

## 목표 구조

BELTRIX Core

→ Partner Brand  
→ Partner Domain  
→ Partner Markets  
→ Partner Fee Policy  
→ Partner Analytics  
→ Selected Liquidity / Execution Provider

## 연구 중인 주요 방식

### Orderly
Shared liquidity 및 builder/broker형 white-label 후보

검토 영역:

- DEX creation
- Custom frontend
- Broker economics
- Fee configuration
- Domain / branding
- Shared liquidity
- Migration / shutdown / dependency risk

### Hyperliquid
Builder Code 및 HIP-3를 활용한 별도 market/business model 연구

### GMX
Custom frontend + UI fee / referral 기반 integration 연구

---

# 8. Business Model

BELTRIX가 검토하는 수익 모델은 다음과 같습니다.

## B2C
- Builder/frontend fees
- Referral attribution
- Trading frontend economics

## B2B
- White-label setup
- Monthly infrastructure fee
- Revenue share
- Custom integration
- Market Intelligence

## Infrastructure
- Venue adapter
- Data normalization
- Execution analytics
- Institutional dashboard
- API / data service

각 revenue stream은 해당 protocol 정책, 사용자 동의, 계약 및 규제 요건을 충족하는 범위에서만 적용됩니다.

---

# 9. 핵심 차별점

### Asset-first
거래소를 기준으로 UI를 분할하지 않고 마켓을 중심으로 여러 venue를 연결합니다.

### Model-aware
CLOB과 pool-based venue를 억지로 동일한 지표로 표현하지 않습니다.

### Execution-gated
새 venue를 바로 실주문에 연결하지 않고 검증 절차를 둡니다.

### White-label-ready
Frontend와 core infrastructure를 분리하는 방향으로 개발합니다.

### Business + Technical Intelligence
API integration뿐 아니라 BD, fees, referral, white-label, operational dependency도 함께 관리합니다.

---

# 10. 현재 단계 구분

## LIVE / PUBLIC
- Hyperliquid-first BELTRIX trading terminal
- Market discovery
- Chart / orderbook
- Futures interface
- Asset logos
- Builder consent
- Attribution foundation

## INTERNAL / READ-ONLY
- Multi-DEX market normalization
- Liquidity comparison
- Execution-cost simulation
- Market Intelligence
- GMX JIT-aware capacity
- BD / white-label research
- Funding/OI/volume history
- API health monitoring

## RESEARCH-ONLY
- Orderly execution
- GMX execution
- Paradex execution
- dYdX execution

## ROADMAP
- Database-backed market history
- Extended asset coverage
- Venue testnet E2E
- New venue qualification
- White-label deployment
- Institutional/Admin analytics
- User-controlled multi-venue execution

---

# 11. 1분 소개 스크립트

“BELTRIX는 탈중앙 파생상품 시장을 위한 트레이딩 터미널입니다. 지금 공개 제품은 Hyperliquid를 기반으로 전체 마켓을 BELTRIX 자체 UI에서 볼 수 있게 만들었고, 단순 프론트엔드에서 끝내지 않고 여러 DEX를 연결할 수 있는 인프라 구조로 확장하고 있습니다.

내부적으로는 Hyperliquid, Orderly, GMX, Paradex, dYdX 같은 거래소의 유동성, 스프레드, 예상 체결비용, Funding, OI, Volume, API 상태를 자산 기준으로 정규화해서 비교하고 있습니다.

향후에는 이 인프라를 기반으로 새로운 execution venue를 검증해서 추가하거나 파트너사가 자기 브랜드로 사용할 수 있는 white-label 거래 터미널까지 확장하는 것이 목표입니다.

결국 BELTRIX가 만들려는 것은 하나의 DEX UI가 아니라 여러 DEX와 유동성 인프라를 연결하는 Trading Infrastructure Layer입니다.”

---

# 12. 짧은 메신저 소개

BELTRIX라는 DEX 트레이딩 인프라를 개발하고 있습니다.

현재는 Hyperliquid 기반으로 전체 perpetual market, 차트, orderbook, 선물 거래 UI를 제공하고 있고, 내부적으로 Orderly·GMX·Paradex·dYdX 등 여러 DEX의 유동성/수수료/Funding/OI/API 상태를 비교하는 Market Intelligence 시스템까지 구축 중입니다.

향후에는 검증된 venue를 추가하고, 파트너용 white-label DEX frontend 및 execution infrastructure까지 확장하는 방향입니다.

https://lianbag49-eng.github.io/beltrix/

---

# 13. 예상 질문

## “BELTRIX 자체 DEX인가요?”
현재 단계에서는 Hyperliquid-first trading terminal 및 infrastructure project입니다. BELTRIX 자체 독립 유동성/오더북을 가진 별도 venue라고 설명하지 않습니다.

## “다른 DEX도 거래 가능한가요?”
현재 경쟁 DEX는 read-only Market Intelligence와 기술 검증 단계입니다. 실 execution은 qualification 및 E2E 검증 이후 단계적으로 검토합니다.

## “왜 여러 DEX를 연결하나요?”
DEX마다 유동성 구조, fee, funding, API 및 market coverage가 다르기 때문에 하나의 플랫폼에서 자산 기준으로 비교·관리할 수 있는 infrastructure layer를 만들기 위해서입니다.

## “White-label은 가능한가요?”
기술 구조는 white-label 방향을 고려해 분리 설계하고 있으며 Orderly 등을 포함한 후보 인프라를 내부 검토 중입니다. 실제 상용 white-label은 계약·운영·규제·기술 검증 이후 출시 단계입니다.

## “수익 모델은 무엇인가요?”
Frontend/builder economics, referral attribution, B2B white-label, integration, Market Intelligence 및 향후 infrastructure revenue를 검토하고 있습니다.

---

# 14. Recommended Positioning

### Korean
**BELTRIX — 멀티베뉴 DEX 트레이딩 터미널 및 Market Intelligence / Execution Infrastructure**

### English
**BELTRIX — A Hyperliquid-first decentralized derivatives terminal evolving into multi-venue market intelligence, execution and white-label infrastructure.**
