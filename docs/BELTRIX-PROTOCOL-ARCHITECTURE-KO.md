# BELTRIX Protocol Architecture

## 목표

BELTRIX는 Hyperliquid 기반으로 시작했지만 최종적으로 **특정 거래소 UI에
종속되지 않는 자체 탈중앙 파생상품 Protocol**을 목표로 합니다.

여기서 “자체 시스템”은 단순히 브랜드나 프론트엔드를 의미하지 않습니다.

BELTRIX가 직접 소유해야 하는 레이어는 다음과 같습니다.

1. **BELTRIX Market Registry**
2. **BELTRIX Trade Intent**
3. **BELTRIX Oracle Policy**
4. **BELTRIX Risk Engine**
5. **BELTRIX Governance / Protocol Config**
6. **BELTRIX Settlement Adapter Standard**
7. **BELTRIX Market Intelligence**
8. 장기적으로 **BELTRIX-native Settlement**

---

# 1. 사용자 자산 소유권

BELTRIX의 기본 원칙은 Non-custodial입니다.

사용자 private key를 BELTRIX 서버가 보관하는 방식으로 가지 않습니다.

```text
User Wallet
   ↓
BELTRIX Intent
   ↓
Policy / Risk 검증
   ↓
Wallet Signature
   ↓
Settlement
```

거래소 API Key를 중앙 서버에 모아서 주문하는 CEX형 architecture와 구분합니다.

---

# 2. BELTRIX Trade Intent

사용자는 “Hyperliquid 주문” 자체를 먼저 만드는 것이 아니라
**BELTRIX Protocol Intent**를 생성합니다.

예:

```text
Market: BTC-PERP
Side: BUY
Size: 0.5 BTC
Leverage: 10x
Max Slippage: 20 bps
Settlement preference:
  - Hyperliquid
  - future BELTRIX-native
Expiry
Nonce
```

BELTRIX Intent는 venue-independent합니다.

즉 향후 settlement layer가 바뀌어도 사용자 UX와 상위 protocol policy를
다시 만들 필요가 없습니다.

---

# 3. BELTRIX Market Registry

BELTRIX는 자체 canonical market identity를 사용합니다.

예:

```text
BELTRIX BTC-PERP
  ├ Hyperliquid BTC
  ├ BELTRIX HIP-3 BTC market
  ├ Qualified external settlement
  └ BELTRIX-native BTC-PERP
```

Market Registry가 정의하는 정보:

- Base / Quote
- Collateral
- Market status
- Oracle policy
- Risk policy
- Allowed settlement layers

현재 bootstrap registry에는 BTC-PERP / ETH-PERP / SOL-PERP를 정의했습니다.

---

# 4. Oracle Layer

BELTRIX의 자체 시장 시스템을 만들려면 하나의 거래소 mark price에 모든
risk를 맡기면 안 됩니다.

BELTRIX Oracle Policy는 여러 source를 받아:

- stale source 제거
- source별 최신값 선택
- median consensus
- source 최소 개수
- source간 deviation 제한

을 검사합니다.

Oracle consensus를 통과하지 못하면 BELTRIX Risk Layer가 settlement
이전에 거래 준비를 중단합니다.

---

# 5. Risk Engine

BELTRIX Market은 자체 risk configuration을 갖습니다.

현재 protocol core에서 지원하는 policy:

- Max Leverage
- Max Order Notional
- Max Open Interest
- Oracle availability
- Market Halt

장기적으로 추가할 항목:

- maintenance margin
- initial margin
- concentration limits
- liquidation bands
- funding caps
- volatility-based leverage
- insurance/backstop exposure

---

# 6. Settlement Layer

BELTRIX Protocol과 실제 settlement를 분리합니다.

```text
BELTRIX Protocol Core
        |
        +-- Hyperliquid Settlement
        |
        +-- BELTRIX HIP-3 Settlement
        |
        +-- Qualified External DEX
        |
        +-- BELTRIX Native Settlement
```

새로운 venue가 생겨도 BELTRIX Core 전체를 바꾸지 않고 settlement adapter만
추가할 수 있는 구조입니다.

---

# 7. Hyperliquid의 역할

Hyperliquid는 BELTRIX의 최종 정체성이 아니라 **Bootstrap Infrastructure**로
사용합니다.

### 현재

Hyperliquid native perp liquidity / settlement를 사용합니다.

### 다음 단계 — BELTRIX HIP-3

HIP-3를 이용하면 BELTRIX 이름으로 별도 builder-deployed perp DEX를
구축하는 hybrid path를 검토할 수 있습니다.

이 경우 BELTRIX는 다음을 직접 운영하는 방향을 검토합니다.

- Market definition
- Oracle definition / update policy
- Leverage parameters
- OI caps
- Fee recipient
- Market halt policy
- Sub-deployer structure

반면 orderbook/margining/settlement substrate는 HyperCore를 활용할 수 있습니다.

즉 이것은 **BELTRIX가 자체 시장 운영권을 확보하면서도 초기부터 새로운
matching engine 전체를 다시 만드는 위험을 줄이는 중간 단계**입니다.

---

# 8. BELTRIX Native

최종 native stage에서는 external exchange가 protocol의 필수 dependency가
아니어야 합니다.

필요 구성:

```text
BELTRIX Native
│
├ Onchain Market Registry
├ Oracle Network / Aggregator
├ Margin Engine
├ Position Accounting
├ Funding Engine
├ Liquidation Engine
├ Insurance / Backstop
├ Fee Accounting
├ Governance
├ Emergency Controls
├ State Indexer
└ Settlement Contracts / Chain
```

이 단계는 보안 감사와 상당한 protocol engineering이 필요한 별도 프로젝트로
취급합니다.

현재 Phase 6는 이를 위한 **control-plane semantics와 adapter boundary를 먼저
고정하는 단계**입니다.

---

# 9. Governance

BELTRIX Protocol config가 한 명의 서버 관리자 DB 값으로만 존재하면 진정한
탈중앙화 시스템이 될 수 없습니다.

단계적으로:

### Stage A
Developer-controlled config

### Stage B
Multisig + Timelock

### Stage C
Onchain Governor / delegated governance

### Stage D
Permissionless market proposals within predefined risk constraints

로 이전합니다.

Phase 6 코드에는 signer / quorum / timelock / proposal / approval semantics를
먼저 구현했습니다.

---

# 10. 현재 정확한 포지셔닝

현재:

**BELTRIX Protocol is in bootstrap stage.**

- 사용자 custody: 사용자
- 사용자 signature: 사용자 wallet
- BELTRIX Market / Oracle / Risk control layer: 구축 중
- Settlement: Hyperliquid bootstrap
- BELTRIX-native settlement: research
- Onchain decentralized governance: 미배포

따라서 지금 당장 “완전 독립 자체 DEX”라고 말하지 않습니다.

대신:

> BELTRIX는 Hyperliquid를 bootstrap settlement로 시작했지만,
> 자체 Market Registry, Trade Intent, Oracle, Risk, Governance,
> Market Intelligence 및 Settlement Adapter를 가진 독립적인
> decentralized derivatives protocol layer로 전환 중입니다.

라고 설명하는 것이 현재 단계에 가장 정확합니다.

---

# 11. 개발 순서

1. BELTRIX Protocol Core ✅
2. Venue-independent Trade Intent ✅
3. Market Registry ✅
4. Oracle Consensus ✅
5. Risk Policy ✅
6. Settlement Adapter ✅
7. Governance-ready Config ✅
8. Hyperliquid Bootstrap Adapter ✅
9. BELTRIX HIP-3 deployer research / testnet
10. Protocol config multisig + timelock
11. Independent oracle service
12. Testnet liquidation / margin engine research
13. BELTRIX-native settlement prototype
14. Security audit
15. Native protocol launch review
