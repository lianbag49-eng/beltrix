import {marketRegistrySnapshot} from './market-registry.js';
import {SETTLEMENT_ADAPTERS} from './settlement-adapter.js';
import {executionAdapterInventory} from './execution-router.js';

export const BELTRIX_PROTOCOL_LAYERS=Object.freeze([
 Object.freeze({id:'market-registry',name:'Market Registry',responsibility:'Canonical markets, symbols, product state and policy references'}),
 Object.freeze({id:'oracle',name:'Oracle Policy',responsibility:'Source freshness, quorum and deviation validation before risk/execution'}),
 Object.freeze({id:'trade-intent',name:'Trade Intent',responsibility:'Venue-independent user/order intent contract'}),
 Object.freeze({id:'execution-router',name:'Execution Router',responsibility:'Qualification-gated venue planning behind adapter boundaries'}),
 Object.freeze({id:'risk',name:'Risk Engine',responsibility:'Explicit market limits, leverage/notional/equity admission checks'}),
 Object.freeze({id:'settlement',name:'Settlement Adapter',responsibility:'Venue-specific settlement semantics isolated from BELTRIX product state'}),
 Object.freeze({id:'market-intelligence',name:'Market Intelligence',responsibility:'Read-only telemetry, data quality, venue health and BD evidence'})
]);

export function protocolArchitectureSnapshot(){
 return Object.freeze({
  version:1,
  layers:BELTRIX_PROTOCOL_LAYERS,
  markets:marketRegistrySnapshot(),
  executionAdapters:executionAdapterInventory(),
  settlementAdapters:Object.freeze(Object.values(SETTLEMENT_ADAPTERS)),
  nativeSettlementStatus:'not-enabled',
  bootstrapSettlement:'hyperliquid'
 });
}
