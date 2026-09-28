import {CANONICAL_MARKETS,SUPPORTED_CANONICAL_ASSETS} from './market-normalizer.js';

const market=(asset,overrides={})=>Object.freeze({
 id:'BELTRIX-'+asset+'-PERP',
 asset,
 quoteAsset:'USD',
 product:'perpetual',
 status:'active',
 symbols:Object.freeze({...CANONICAL_MARKETS[asset]}),
 oraclePolicy:'multi-source-observation-v1',
 riskPolicy:'explicit-market-limits-v1',
 settlementPolicy:'adapter-routed-v1',
 bootstrapSettlement:'hyperliquid',
 ...overrides
});

export const BELTRIX_MARKETS=Object.freeze(Object.fromEntries(
 SUPPORTED_CANONICAL_ASSETS.map(asset=>[asset,market(asset)])
));

export function marketDefinition(asset){
 const key=String(asset||'').toUpperCase();
 const row=BELTRIX_MARKETS[key];
 if(!row)throw Error('Unknown BELTRIX market: '+key);
 return row;
}

export function marketRegistrySnapshot(){
 return Object.freeze(Object.values(BELTRIX_MARKETS));
}
