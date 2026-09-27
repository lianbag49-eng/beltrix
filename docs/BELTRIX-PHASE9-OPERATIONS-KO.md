# BELTRIX Protocol Phase 9 — Operations Readiness

## 목표

Phase 9는 Phase 8에서 만든 signed oracle / ownership transition 구조를
실제 운영 준비 수준으로 끌어올리는 단계입니다.

이 단계의 핵심은 **실제 production key나 사용자 자금을 쓰지 않고도**
다음 운영 절차를 반복 검증할 수 있게 만드는 것입니다.

- Ownership transition dry-run
- Oracle operator rotation
- Incident recovery
- Public protocol config disclosure
- Config fingerprint
- HIP-3 testnet deployment dry-run

---

## 1. Ownership Dry-run

실제 onchain transfer 전에 다음 조건을 검사합니다.

- 현재 owner가 plan과 일치하는지
- target multisig가 current owner와 다른지
- signer set 중복이 없는지
- quorum이 signer set 안에서 유효한지
- timelock이 0보다 큰지
- guardian이 owner/multisig와 분리돼 있는지
- role grant가 BELTRIX에 정의된 최소 권한 역할인지

결과는 broadcast payload가 아니라 **manual review checklist**입니다.

---

## 2. Public Config Disclosure

BELTRIX는 production 운영 시 다음 정보를 공개 검증 가능하게 만드는 방향입니다.

- protocol revision
- network
- decentralization stage
- ownership address
- governance signer set / quorum / timelock
- oracle operator addresses / quorum
- market definitions
- enabled settlement adapters

Private key, seed, password, API key, token 같은 secret-like key는 public config
생성 단계에서 차단합니다.

각 public config는 SHA-256 fingerprint를 만들 수 있습니다.

이 fingerprint를 release / governance proposal / docs와 함께 공개하면 특정 시점
BELTRIX protocol config가 무엇이었는지 검증할 수 있습니다.

---

## 3. Oracle Operator Rotation

Oracle operator를 한 번에 전부 바꾸면 quorum continuity가 깨질 수 있습니다.

BELTRIX rotation plan은 다음 순서를 사용합니다.

1. next operator set 공개
2. 새 operator signature 검증
3. old/new set overlap window
4. next quorum 활성화
5. old operator retire

기본적으로 최소 하나 이상의 operator overlap을 요구하도록 설계했습니다.

---

## 4. Incident Recovery

현재 정의한 incident class:

### Oracle quorum loss
- new risk fail-close
- reduce-only exit 보존
- oracle operator alert
- quorum/freshness/signature 복구 후 guardian 승인

### Oracle deviation
- new risk fail-close
- outlier source 식별
- faulty operator disable/rotation
- deviation threshold 복구 확인

### Settlement outage
- new settlement routing 중단
- unresolved submission reconciliation
- position state 확인

### Governance compromise
- config change freeze
- emergency guardian activation
- signer rotation
- timelock 재검증
- public config 재공개

### Stale market data
- analytics degraded 표시
- derived analytics disable
- fresh timestamp 복구 확인

### Liquidity collapse
- size-increasing order 차단
- reduce-only exit 보존
- OI cap / max order notional 재검토

**자동 resume은 허용하지 않습니다.**

---

## 5. HIP-3 Testnet Dry-run

Phase 9의 HIP-3 testnet runner는 실제 deploy transaction을 만들거나 제출하지
않습니다.

검사 항목:

- plan unsigned 여부
- research-only 여부
- operator address review
- market config review
- oracle/risk policy review
- mainnet과 분리된 test wallet
- testnet balance
- deployer action schema
- post-deploy verification
- halt/rollback procedure

모든 gate가 채워져야 사람이 실제 testnet deployment를 검토할 수 있습니다.

---

## 현재 상태

### Structural readiness
완료:

- ownership dry-run engine
- incident recovery model
- oracle rotation plan
- public config disclosure
- public config fingerprint
- HIP-3 testnet dry-run engine

### External / operational dependency
아직 필요:

- 실제 production multisig
- signer set
- timelock
- emergency guardian
- 독립 oracle operator 주소/운영
- ownership recovery rehearsal
- HIP-3 testnet deploy
- HIP-3 testnet trading
- public config 실제 게시

즉 Phase 9는 **코드/운영 구조는 준비**, 실제 onchain 운영 주체와 testnet evidence는
아직 미완료 상태입니다.
