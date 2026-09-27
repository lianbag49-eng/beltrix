export const INCIDENT_TYPES=Object.freeze({
 ORACLE_QUORUM_LOSS:'oracle-quorum-loss',
 ORACLE_DEVIATION:'oracle-deviation',
 SETTLEMENT_OUTAGE:'settlement-outage',
 GOVERNANCE_COMPROMISE:'governance-compromise',
 MARKET_DATA_STALE:'market-data-stale',
 LIQUIDITY_COLLAPSE:'liquidity-collapse'
});

const RESPONSES=Object.freeze({
 [INCIDENT_TYPES.ORACLE_QUORUM_LOSS]:Object.freeze({
  severity:'critical',
  immediate:['fail-close-new-risk','preserve-reduce-only-exits','alert-oracle-operators','publish-incident-state'],
  recovery:['restore-quorum-with-approved-operators','verify-fresh-signed-observations','run-deviation-check'],
  resume:['oracle-quorum-restored','freshness-window-satisfied','operator-signatures-verified','human-guardian-approval']
 }),
 [INCIDENT_TYPES.ORACLE_DEVIATION]:Object.freeze({
  severity:'critical',
  immediate:['fail-close-new-risk','freeze-oracle-dependent-config','compare-independent-sources','publish-incident-state'],
  recovery:['identify-outlier-source','rotate-or-disable-faulty-operator','rebuild-consensus'],
  resume:['deviation-below-policy-threshold','minimum-source-count-restored','human-guardian-approval']
 }),
 [INCIDENT_TYPES.SETTLEMENT_OUTAGE]:Object.freeze({
  severity:'critical',
  immediate:['stop-new-settlement-routing','preserve-local-intents','alert-users-of-settlement-status','publish-incident-state'],
  recovery:['verify-provider-health','reconcile-open-submissions','confirm-position-state'],
  resume:['provider-health-restored','submission-reconciliation-complete','human-operator-approval']
 }),
 [INCIDENT_TYPES.GOVERNANCE_COMPROMISE]:Object.freeze({
  severity:'critical',
  immediate:['freeze-config-changes','activate-emergency-guardian','publish-compromise-notice'],
  recovery:['rotate-compromised-signers','rebuild-quorum','revalidate-timelock','review-all-pending-proposals'],
  resume:['new-signer-set-verified','timelock-verified','public-config-republished','multi-party-approval']
 }),
 [INCIDENT_TYPES.MARKET_DATA_STALE]:Object.freeze({
  severity:'warning',
  immediate:['mark-market-data-degraded','disable-derived-analytics','preserve-user-custody'],
  recovery:['restore-collector-health','verify-fresh-timestamps'],
  resume:['fresh-market-data-restored']
 }),
 [INCIDENT_TYPES.LIQUIDITY_COLLAPSE]:Object.freeze({
  severity:'critical',
  immediate:['block-size-increasing-orders','preserve-reduce-only-exits','raise-risk-alert'],
  recovery:['recompute-depth','review-open-interest-cap','review-max-order-notional'],
  resume:['depth-threshold-restored','risk-policy-reviewed','human-risk-manager-approval']
 })
});

export function incidentResponsePlan(type,{market=null,detectedAt=Date.now(),evidence={}}={}){
 const row=RESPONSES[type];
 if(!row)throw Error('Unknown BELTRIX incident type: '+type);
 return Object.freeze({
  protocol:'beltrix',
  type,
  severity:row.severity,
  market:market?String(market).toUpperCase():null,
  detectedAt:Number(detectedAt),
  evidence:Object.freeze({...evidence}),
  automaticResume:false,
  immediate:Object.freeze([...row.immediate]),
  recovery:Object.freeze([...row.recovery]),
  resumeConditions:Object.freeze([...row.resume])
 });
}

export function canResumeIncident(plan,evidence={}){
 if(!plan?.resumeConditions)throw Error('Incident response plan is required');
 const checks=plan.resumeConditions.map(id=>Object.freeze({id,passed:evidence[id]===true}));
 return Object.freeze({
  ready:checks.every(x=>x.passed),
  automaticResume:false,
  checks:Object.freeze(checks),
  missing:Object.freeze(checks.filter(x=>!x.passed).map(x=>x.id))
 });
}
