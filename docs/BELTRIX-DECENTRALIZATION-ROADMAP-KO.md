# BELTRIX Decentralization Roadmap

## 목적

BELTRIX의 목표는 Hyperliquid의 UI를 만드는 것이 아니라 **BELTRIX 자체
시장 정책과 사용자 거래 의미를 소유하는 탈중앙 파생상품 Protocol**을 만드는
것입니다.

Hyperliquid는 초기 liquidity / matching / settlement bootstrap이며,
BELTRIX Protocol의 최종 identity가 아닙니다.

---

## Stage 0 — Product Bootstrap

상태: **완료 / Public**

- Hyperliquid market discovery
- Chart / Orderbook
- Futures UI
- User wallet signing
- Builder fee consent
- Mobile / Desktop
- Attribution

이 단계에서는 제품이 Hyperliquid-specific execution에 가까웠습니다.

---

## Stage 1 — BELTRIX Control Plane

상태: **Phase 6 완료**

BELTRIX 자체 레이어:

- Market Registry
- Venue-independent Trade Intent
- Oracle Consensus Policy
- Risk Engine
- Settlement Adapter Registry
- Governance-ready config
- User-controlled settlement preference
- Decentralization state model

핵심 변화:

```text
Before
User -> Hyperliquid Order

After
User -> BELTRIX Intent
     -> BELTRIX Oracle
     -> BELTRIX Risk
     -> BELTRIX Policy
     -> Settlement Adapter
     -> Hyperliquid
```

Hyperliquid는 최종 settlement provider 중 하나가 됩니다.

---

## Stage 2 — BELTRIX HIP-3 Hybrid DEX

상태: **Phase 7 planning / research-only**

목표:

HyperCore를 그대로 사용하더라도 BELTRIX가 다음 시장 운영권을 직접 갖습니다.

- Market Definition
- Oracle Updater Policy
- Margin Configuration
- Open Interest Caps
- Fee Recipient
- Emergency Halt Roles
- Scoped Sub-deployer Permissions
- Funding / Growth Mode
- Market Metadata

현재 구현:

- BELTRIX protocol role model
- unsigned HIP-3 deployment plan
- address validation
- readiness gates

현재 미완료:

- independent live oracle operators
- multisig/timelock deployment
- incident-recovery runbook
- testnet deploy E2E
- testnet trading E2E
- liquidation behavior review
- fee reconciliation

실제 mainnet deploy / user funds는 이 gate 완료 전 활성화하지 않습니다.

---

## Stage 3 — Decentralized Protocol Ownership

목표:

BELTRIX 시장 운영 config를 개인 developer key가 아니라 여러 주체가 공동
통제하도록 이전합니다.

### Governance

```text
Developer Key
    ↓
Multisig
    ↓
Multisig + Timelock
    ↓
Onchain Governor
    ↓
Permissionless proposals within risk constraints
```

운영 역할:

- Oracle Updater
- Risk Manager
- Emergency Guardian
- Fee Admin
- Market Admin

각 역할은 최소 권한 원칙으로 분리합니다.

---

## Stage 4 — BELTRIX Oracle Network

목표:

하나의 거래소 mark price나 하나의 centralized backend가 BELTRIX market의
단일 진실 공급자가 되지 않도록 합니다.

구성 방향:

- independent source adapters
- multiple oracle operators
- stale filtering
- median / robust consensus
- deviation threshold
- emergency circuit breaker
- public observation history

BELTRIX Risk Engine은 oracle consensus가 실패하면 order settlement 전에
거래를 block합니다.

---

## Stage 5 — BELTRIX Risk / Margin Research Network

목표:

외부 settlement 없이도 자체 perp accounting을 검증할 수 있는 testnet
simulation layer를 구축합니다.

필요 모듈:

- Initial Margin
- Maintenance Margin
- Cross / Isolated Margin
- Funding Engine
- Position Accounting
- Unrealized PnL
- Liquidation Price
- Liquidation Engine
- Insurance / Backstop
- Bad Debt Handling
- ADL / Socialized-loss policy review

처음에는 실제 자금을 받지 않는 simulation / testnet으로 검증합니다.

---

## Stage 6 — BELTRIX Native Settlement Prototype

목표:

Hyperliquid가 필수 dependency가 아닌 settlement path를 만듭니다.

후보 구조:

### Option A — Smart Contract Protocol
EVM/L2 위 settlement contracts + offchain/permissionless matching

### Option B — Appchain / Rollup
BELTRIX 전용 state machine + sequencer/validator path

### Option C — Hybrid
Onchain custody / risk / settlement + decentralized external order-intent network

구체 기술 선택은 margin/liquidation testnet 결과와 성능 요구를 보고 결정합니다.

---

## Stage 7 — Native Decentralization

Native launch 전에 최소한 다음이 필요합니다.

- external security audit
- invariant / property tests
- oracle failure tests
- liquidation stress tests
- governance failure tests
- upgrade / pause controls
- incident recovery
- public state indexer
- monitoring
- bug bounty
- protocol documentation

이 조건이 갖춰지기 전에는 BELTRIX-native settlement를 user-fund-ready라고
표현하지 않습니다.

---

# 현재 위치

```text
Stage 0  Product Bootstrap        ✅
Stage 1  BELTRIX Control Plane    ✅
Stage 2  HIP-3 Hybrid Plan        🟡 Research / Validation
Stage 3  Decentralized Ownership  🟡 Phase 8 Core
Stage 4  Oracle Network           🟡 Phase 8 Core
Stage 5  Margin / Liquidation     ⬜
Stage 6  Native Settlement        ⬜
Stage 7  Native Launch            ⬜
```

현재 정확한 표현:

> BELTRIX는 Hyperliquid를 bootstrap settlement로 사용하면서도,
> 자체 Market Registry, Trade Intent, Oracle, Risk, Governance,
> Market Intelligence 및 Settlement Abstraction을 구축한
> bootstrap-stage decentralized derivatives protocol입니다.

최종 목표:

> **Hyperliquid가 없어도 BELTRIX Protocol 자체가 시장 상태와 settlement를
> 유지할 수 있는 decentralized derivatives infrastructure.**


---

# Phase 8 — Oracle Operators & Protocol Ownership

Phase 8에서는 BELTRIX 자체 정책을 한 명의 개발자 서버가 결정하지 않도록
두 개의 탈중앙화 기반을 코드로 추가합니다.

## Signed Oracle Operator Quorum

각 Oracle Operator는 자신의 EVM key로 다음 observation에 서명합니다.

- BELTRIX market id
- price
- timestamp
- nonce
- operator address

BELTRIX Oracle Network는:

- 등록된 operator인지 확인
- EVM signature를 복구해 signer 검증
- operator별 최신 nonce만 사용
- stale observation 제거
- 최소 quorum 확인
- source간 deviation 검사
- median price consensus

를 거칩니다.

현재 구현은 operator network의 **offchain verification core**이며,
실제 운영 operator와 key custody는 아직 배포하지 않습니다.

## Multisig / Timelock Ownership Transition

BELTRIX protocol config를 developer key에서 직접 관리하지 않고 다음으로
이전할 수 있도록 ownership transition plan을 정의합니다.

```text
Developer owner
      ↓
Reviewed Multisig
      ↓
Timelock policy
      ↓
Scoped protocol roles
      ↓
Direct developer permission revocation
      ↓
Public config disclosure
```

이 plan은 실제 chain ownership을 변경하지 않는 **unsigned / research-only**
계획입니다.

현재 실제 배포 전에 남은 evidence:

- production multisig address
- signer identity / separation review
- timelock duration
- emergency guardian
- least-privilege role map
- ownership transition dry-run
- recovery runbook
- public configuration disclosure
