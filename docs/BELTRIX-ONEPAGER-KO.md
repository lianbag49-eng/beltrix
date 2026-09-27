# BELTRIX — External One-Pager

## Decentralized Derivatives Protocol & Trading Infrastructure

**BELTRIX는 Hyperliquid를 초기 bootstrap settlement로 활용해 시작했지만, 현재는 자체 Market Registry, Trade Intent, Oracle Policy, Risk Engine, Governance-ready Config 및 Settlement Adapter를 갖는 독립적인 탈중앙 파생상품 Protocol Layer를 구축하고 있습니다.**

### 30초 소개

BELTRIX의 공개 제품은 현재 Hyperliquid에서 실제 settlement를 수행하지만, 상위 거래 의미와 정책을 특정 거래소 주문 형식에 종속시키지 않는 BELTRIX Protocol Core를 구축했습니다. 사용자는 BELTRIX Market/Intent를 기준으로 접근하고, BELTRIX가 자체 Oracle/Risk 정책을 검증한 뒤 사용자가 허용한 settlement adapter를 통해 실행하는 구조입니다. 내부적으로는 Hyperliquid·Orderly·Paradex·dYdX·GMX 등 주요 DEX의 유동성, 시장 상태 및 execution 조건도 함께 분석합니다.

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

## BELTRIX Protocol 핵심 구조

### 0. BELTRIX Protocol Core
현재 코드에 다음 독립 레이어가 추가되어 있습니다.

- BELTRIX Market Registry
- Venue-independent Trade Intent
- Multi-source Oracle Consensus
- BELTRIX Risk Policy
- Settlement Adapter Registry
- Governance-ready signer/quorum/timelock model
- Explicit BELTRIX-native settlement boundary

현재 단계는 **Bootstrap**이며 Hyperliquid가 live settlement provider 역할을 합니다. BELTRIX-native settlement는 아직 research-only입니다.

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

### 3. BELTRIX HIP-3 Hybrid Path
다음 단계에서는 Hyperliquid의 builder-deployed perp 구조를 이용해 BELTRIX 이름의 시장을 운영하는 hybrid path를 준비하고 있습니다.

BELTRIX 정책에서 다음 운영 항목을 생성하는 unsigned deploy plan까지 구현했습니다.

- Market definition
- Oracle updater policy
- Margin configuration
- Open Interest cap
- Fee recipient
- Scoped sub-deployer permissions
- Funding / growth / annotation options

실제 mainnet 배포나 사용자 자금 연결은 아직 활성화하지 않았습니다.

### 4. Execution Adapter Architecture
각 DEX를 BELTRIX UI에 직접 하드코딩하지 않고 venue adapter 구조로 분리해 향후 새로운 execution venue를 추가할 수 있도록 설계하고 있습니다.

### 5. White-label Infrastructure
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

BELTRIX의 목표는 **“또 하나의 거래소 UI”가 아니라 자체 Market/Oracle/Risk/Governance 정책을 소유하고 여러 settlement substrate를 사용할 수 있는 독립적인 Decentralized Derivatives Protocol Layer**를 구축하는 것입니다.

현재는 Hyperliquid-first 제품으로 시작하고 있지만, 백엔드와 내부 시스템은 향후 새로운 DEX, white-label 사업, institutional/BD integration까지 확장할 수 있도록 분리 설계하고 있습니다.

---

## 소개 시 권장 표현

**짧게:**  
“BELTRIX는 Hyperliquid를 settlement bootstrap으로 시작했지만, 자체 Market Registry·Trade Intent·Oracle·Risk·Governance·Settlement Adapter를 가진 탈중앙 파생상품 Protocol로 전환하고 있습니다.”

**조금 더 전문적으로:**  
“BELTRIX is a decentralized derivatives protocol in bootstrap stage, using Hyperliquid as its current settlement substrate while building its own market, oracle, risk, governance and settlement abstraction.”

### 현재 사용을 피하는 표현

- “BELTRIX 자체 오더북과 자체 유동성을 가진 독립 DEX”
- “모든 DEX에서 이미 자동으로 최적 체결”
- “Orderly/GMX/Paradex/dYdX와 공식 제휴 완료”

해당 기능이나 제휴가 실제 활성화된 이후에만 사용하는 것이 정확합니다.
