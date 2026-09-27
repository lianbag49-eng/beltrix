export const BELTRIX_PROTOCOL_ROLES=Object.freeze({
 'oracle-updater':Object.freeze(['setOracle']),
 'risk-manager':Object.freeze([
  'setOpenInterestCaps','setMarginTableIds','setMarginModes',
  'setFundingMultipliers','setFundingInterestRates'
 ]),
 'emergency-guardian':Object.freeze(['haltTrading']),
 'fee-admin':Object.freeze(['setFeeRecipient','setFeeScale','setGrowthModes']),
 'market-admin':Object.freeze(['registerAsset','registerAsset2','setPerpAnnotation'])
});

export function roleVariants(role){
 const variants=BELTRIX_PROTOCOL_ROLES[String(role||'')];
 if(!variants)throw Error('Unknown BELTRIX protocol role: '+role);
 return [...variants];
}

export function normalizeRoleGrant(input={}){
 const role=String(input.role||'').trim();
 const account=String(input.account||'').trim().toLowerCase();
 if(!BELTRIX_PROTOCOL_ROLES[role])throw Error('Unknown BELTRIX protocol role: '+role);
 if(!/^0x[0-9a-f]{40}$/.test(account))throw Error('Role grant account must be a 20-byte EVM address');
 return Object.freeze({
  role,
  account,
  variants:Object.freeze(roleVariants(role))
 });
}

export function expandSubDeployerPermissions(grants=[]){
 const out=[];
 const seen=new Set();
 for(const raw of grants){
  const grant=normalizeRoleGrant(raw);
  for(const variant of grant.variants){
   const key=variant+'|'+grant.account;
   if(seen.has(key))continue;
   seen.add(key);
   out.push(Object.freeze({variant,user:grant.account,allowed:true,role:grant.role}));
  }
 }
 return Object.freeze(out);
}
