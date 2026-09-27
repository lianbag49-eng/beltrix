# BELTRIX Protocol Phase 10 — Native Risk / Margin Simulation

## 목적

Phase 10은 BELTRIX-native settlement를 바로 만들기 전에,
**자체 perpetual risk/margin accounting을 실제 자금 없이 수치적으로 검증하는 단계**입니다.

현재 구현 범위는 isolated-margin simulation입니다.

---

## 구현된 모델

### Isolated Margin

- Entry Price
- Position Size
- Collateral
- Position Leverage
- Unrealized PnL
- Position Equity
- Initial Margin Requirement
- Maintenance Margin Requirement
- Long / Short Liquidation Price

### Funding Engine

- Long / Short funding cashflow
- Funding rate cap
- Accumulated funding state
- Funding event record

### Liquidation Simulation

- Maintenance-margin breach detection
- Liquidation close notional
- Liquidation fee
- User residual equity
- Insurance fund draw
- Residual deficit / bad-debt signal

### Risk Stress Grid

- price shock grid
- liquidation region detection
- insurance insufficiency detection
- residual bad-debt visibility

---

## 현재 단순화한 부분

이 모델은 **production trading engine이 아닙니다.**

아직 제외된 주요 항목:

- Cross Margin
- Portfolio Netting
- Partial Liquidation
- Multi-position account equity
- ADL
- Socialized loss
- Dynamic margin tiers
- Volatility-based risk
- Market-specific maintenance curves
- Fee/funding interactions under partial close
- Oracle delay / mark smoothing
- Bankruptcy-price engine

즉 지금 단계에서는 **isolated position 단위의 risk invariant를 검증하는 연구용 모델**입니다.

---

## 현재 검증한 수치 관계

### Long

Position:

- Entry = 100
- Size = 10
- Collateral = 200
- Maintenance Margin Ratio = 5%

Liquidation price:

```text
(entry * size - collateral)
--------------------------------
size * (1 - maintenance margin)
```

결과 약 84.2105.

### Short

```text
(collateral + entry * size)
--------------------------------
size * (1 + maintenance margin)
```

결과 약 114.2857.

Unit tests에서 해당 boundary 전후 liquidatable state를 검증합니다.

---

## Funding

Long position은 positive funding에서 payment를 지불하고,
Short position은 동일 조건에서 payment를 수취합니다.

Funding rate는 market policy의 absolute cap 안으로 clamp됩니다.

---

## Insurance / Deficit

Liquidation 시:

1. Position equity 계산
2. Liquidation fee 계산
3. Equity로 fee/deficit 충당
4. 부족분을 insurance balance에서 draw
5. 남는 부족분은 residual deficit로 표시

현재 이 residual deficit는 **감춰지지 않고 명시적으로 상태에 남도록** 설계했습니다.

---

## Native protocol로 가기 위해 남은 핵심

Phase 10 다음 단계:

1. Cross-margin account model
2. Portfolio netting
3. Partial liquidation
4. ADL / backstop policy
5. Bad debt policy
6. Margin tier curve
7. Oracle / mark price separation
8. Property-based / invariant tests
9. External risk review
10. Testnet state machine

이 단계들을 통과한 뒤에만 BELTRIX-native settlement의 user-fund readiness를 논의할 수 있습니다.

---

## 현재 상태

**Isolated risk simulation: READY**

**Production native risk engine: NOT READY**

이 구분을 코드의 Phase 10 readiness gate에서도 유지합니다.
