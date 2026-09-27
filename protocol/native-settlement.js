import {defineSettlementAdapter,SETTLEMENT_CAPABILITIES} from './settlement.js';

export const BELTRIX_NATIVE_REQUIREMENTS=Object.freeze([
 'audited-settlement-contracts-or-chain',
 'onchain-market-registry',
 'onchain-risk-parameters',
 'independent-oracle-consensus',
 'permissionless-user-signing',
 'position-and-margin-accounting',
 'liquidation-engine',
 'insurance-or-backstop-policy',
 'governance-upgrade-controls',
 'emergency-halt-and-recovery',
 'public-state-indexing'
]);

export function prepareBeltrixNativeIntent(){
 throw Error('BELTRIX-native settlement is research-only and not enabled for user funds');
}

export const beltrixNativeSettlement=defineSettlementAdapter({
 id:'beltrix-native',
 label:'BELTRIX Native Settlement',
 status:'research',
 capabilities:[
  SETTLEMENT_CAPABILITIES.PERPS,
  SETTLEMENT_CAPABILITIES.NON_CUSTODIAL,
  SETTLEMENT_CAPABILITIES.NATIVE_SETTLEMENT,
  SETTLEMENT_CAPABILITIES.ONCHAIN_CONFIG
 ],
 prepareIntent:prepareBeltrixNativeIntent,
 requirements:BELTRIX_NATIVE_REQUIREMENTS
});
