// Product-level region/feature gating. This is a policy engine, not legal advice.
export const FEATURES=Object.freeze({
 VIEW_MARKETS:'view-markets',
 CONNECT_WALLET:'connect-wallet',
 TRADE:'trade',
 AFFILIATE:'affiliate',
 PAYOUT:'payout',
 CAMPAIGN:'campaign'
});

export const REGION_GROUPS=Object.freeze({
 CIS:'cis',
 CHINESE_SPEAKING:'chinese-speaking',
 GLOBAL:'global',
 RESTRICTED:'restricted'
});

const DEFAULT_POLICY=Object.freeze({
 group:REGION_GROUPS.GLOBAL,
 allow:[FEATURES.VIEW_MARKETS,FEATURES.CONNECT_WALLET,FEATURES.TRADE,FEATURES.AFFILIATE,FEATURES.PAYOUT,FEATURES.CAMPAIGN],
 deny:[]
});

const POLICIES=Object.freeze({
 RU:Object.freeze({group:REGION_GROUPS.CIS,allow:[FEATURES.VIEW_MARKETS],deny:[FEATURES.CONNECT_WALLET,FEATURES.TRADE,FEATURES.AFFILIATE,FEATURES.PAYOUT,FEATURES.CAMPAIGN],reason:'restricted-jurisdiction-review'}),
 BY:Object.freeze({group:REGION_GROUPS.CIS,allow:[FEATURES.VIEW_MARKETS],deny:[FEATURES.CONNECT_WALLET,FEATURES.TRADE,FEATURES.AFFILIATE,FEATURES.PAYOUT,FEATURES.CAMPAIGN],reason:'restricted-jurisdiction-review'}),
 CN:Object.freeze({group:REGION_GROUPS.RESTRICTED,allow:[FEATURES.VIEW_MARKETS],deny:[FEATURES.CONNECT_WALLET,FEATURES.TRADE,FEATURES.AFFILIATE,FEATURES.PAYOUT,FEATURES.CAMPAIGN],reason:'mainland-china-virtual-asset-restriction'}),
 HK:Object.freeze({group:REGION_GROUPS.CHINESE_SPEAKING,allow:[FEATURES.VIEW_MARKETS,FEATURES.CONNECT_WALLET],deny:[FEATURES.TRADE,FEATURES.AFFILIATE,FEATURES.PAYOUT,FEATURES.CAMPAIGN],reason:'requires-local-product-approval'}),
 TW:Object.freeze({group:REGION_GROUPS.CHINESE_SPEAKING,allow:[...DEFAULT_POLICY.allow],deny:[]}),
 SG:Object.freeze({group:REGION_GROUPS.CHINESE_SPEAKING,allow:[...DEFAULT_POLICY.allow],deny:[]}),
 MY:Object.freeze({group:REGION_GROUPS.CHINESE_SPEAKING,allow:[...DEFAULT_POLICY.allow],deny:[]})
});

function code(value){return String(value||'').trim().toUpperCase().slice(0,2)}

export function policyForCountry(country){
 const c=code(country);
 const p=POLICIES[c]||DEFAULT_POLICY;
 return Object.freeze({country:c||null,...p});
}

export function canUseFeature(country,feature){
 const p=policyForCountry(country);
 if(p.deny.includes(feature))return false;
 return p.allow.includes(feature);
}

export function requireFeature(country,feature){
 if(!canUseFeature(country,feature)){
  const p=policyForCountry(country);
  throw Error('Feature '+feature+' is unavailable for '+(p.country||'unknown')+' ('+(p.reason||'policy')+')');
 }
 return true;
}
