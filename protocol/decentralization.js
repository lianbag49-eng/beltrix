export const DECENTRALIZATION_COMPONENTS=Object.freeze([
 'user-custody',
 'user-signed-orders',
 'open-market-registry',
 'independent-oracle-policy',
 'protocol-risk-policy',
 'multi-party-governance',
 'permissionless-settlement',
 'beltrix-native-state'
]);

export function decentralizationState(input={}){
 const components=Object.fromEntries(DECENTRALIZATION_COMPONENTS.map(k=>[k,Boolean(input[k])]));
 const missing=DECENTRALIZATION_COMPONENTS.filter(k=>!components[k]);
 const satisfied=DECENTRALIZATION_COMPONENTS.filter(k=>components[k]);
 let stage='bootstrap';
 if(components['open-market-registry']&&components['independent-oracle-policy']&&components['protocol-risk-policy']&&components['multi-party-governance'])stage='hybrid';
 if(missing.length===0)stage='native';
 return Object.freeze({stage,components:Object.freeze(components),satisfied:Object.freeze(satisfied),missing:Object.freeze(missing)});
}

export const CURRENT_DECENTRALIZATION_STATE=decentralizationState({
 'user-custody':true,
 'user-signed-orders':true,
 'open-market-registry':false,
 'independent-oracle-policy':true,
 'protocol-risk-policy':true,
 'multi-party-governance':false,
 'permissionless-settlement':false,
 'beltrix-native-state':false
});
