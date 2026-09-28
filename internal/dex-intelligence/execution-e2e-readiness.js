import {INITIAL_QUALIFICATION} from './execution-qualification.js';

const PROFILES=Object.freeze({
 orderly:Object.freeze({
  venue:'orderly',
  mode:'testnet-only',
  credentials:Object.freeze(['accountId','orderlyKey','requestSigner','evmAddress']),
  sequence:Object.freeze([
   'authenticate/orderly-key-ready',
   'create-minimum-size-test-order',
   'get-order-by-id',
   'cancel-open-order-if-resting',
   'verify-cancel-or-fill-terminal-state',
   'reconcile-account-positions'
  ]),
  liveFunds:false,
  notes:'Use Orderly testnet only. Do not promote to execution until the full lifecycle is evidenced.'
 }),
 paradex:Object.freeze({
  venue:'paradex',
  mode:'testnet-only',
  credentials:Object.freeze(['evmProvider','paradexAccount','jwt','paradexOrderSigner']),
  sequence:Object.freeze([
   'evm-siwe-authenticate',
   'create-minimum-size-test-order',
   'get-order-by-id',
   'cancel-open-order-if-resting',
   'verify-cancel-or-fill-terminal-state',
   'reconcile-positions'
  ]),
  liveFunds:false,
  notes:'Use Paradex testnet only. Prefer a trading subkey; never store a main private key in BELTRIX server config.'
 })
});

export function executionE2eProfile(venue){
 const id=String(venue||'');
 const profile=PROFILES[id];
 if(!profile)throw Error('Unsupported testnet E2E venue: '+id);
 const qualification=INITIAL_QUALIFICATION[id];
 return Object.freeze({
  ...profile,
  currentlyQualified:Boolean(qualification?.qualified),
  missingGates:Object.freeze([...(qualification?.missing||[])]),
  promotable:false
 });
}

export function evaluateE2eEvidence(venue,evidence={}){
 const profile=executionE2eProfile(venue);
 const steps=profile.sequence.map(id=>Object.freeze({id,passed:evidence[id]===true}));
 const complete=steps.every(x=>x.passed);
 return Object.freeze({
  venue:profile.venue,
  complete,
  steps:Object.freeze(steps),
  mayMarkPaperOrTestnetE2E:complete,
  mayPromoteToExecution:false,
  reason:complete
   ?'Testnet E2E evidence complete; remaining qualification gates must still pass independently.'
   :'Testnet E2E evidence incomplete.'
 });
}
