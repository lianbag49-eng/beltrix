# BELTRIX Protocol Incident Recovery Runbook

This runbook is operational guidance for BELTRIX protocol incidents.

It does not grant automated authority and does not sign or submit transactions.

## Principles

1. Fail closed for new risk when oracle or settlement integrity is uncertain.
2. Preserve user custody.
3. Preserve reduce-only exits where the underlying settlement venue safely permits them.
4. Never auto-resume critical incidents.
5. Publish operational state and config fingerprints when appropriate.
6. Require human/multi-party approval before resuming critical paths.

## Incident classes

- oracle-quorum-loss
- oracle-deviation
- settlement-outage
- governance-compromise
- market-data-stale
- liquidity-collapse

## Required evidence before incident closure

Every incident record should contain:

- incident id
- market / affected scope
- detected timestamp
- triggering evidence
- immediate actions
- operator acknowledgements
- recovery checks
- resume approvals
- final resolved timestamp
- related protocol config fingerprint

## Governance compromise

If governance compromise is suspected:

- freeze pending config changes
- activate the reviewed emergency guardian path
- invalidate or rotate compromised signers
- review every pending proposal
- revalidate quorum and timelock
- publish a new public config fingerprint
- do not resume until multi-party approval is recorded

## Oracle incident

For quorum loss or source deviation:

- halt new risk-increasing actions
- preserve safe exits where possible
- verify signed observations independently
- rotate/disable faulty operators using overlap-safe rotation
- rebuild quorum
- verify freshness and deviation constraints
- obtain guardian / governance approval before resume

## Settlement outage

- stop new routing to the affected settlement
- retain BELTRIX intents locally where safe
- reconcile every unresolved submission
- compare settlement account positions and orders
- do not assume a timeout means an order failed
- resume only after settlement health and reconciliation both pass
