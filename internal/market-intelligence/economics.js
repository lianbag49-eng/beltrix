const finite=v=>typeof v==='number'&&Number.isFinite(v);
const bpsToRate=bps=>bps/10_000;

export function tradingCostScenario({
 monthlyVolumeUsd=0,
 takerShare=0.6,
 userMakerBps=0,
 userTakerBps=0,
 protocolMakerBps=0,
 protocolTakerBps=0,
 affiliateSharePct=0,
 userDiscountPct=0,
 fixedMonthlyCostUsd=0
}={}){
 for(const [name,value] of Object.entries({monthlyVolumeUsd,takerShare,userMakerBps,userTakerBps,protocolMakerBps,protocolTakerBps,affiliateSharePct,userDiscountPct,fixedMonthlyCostUsd})){
  if(!finite(value))throw Error(name+' must be finite');
 }
 if(monthlyVolumeUsd<0||takerShare<0||takerShare>1||affiliateSharePct<0||affiliateSharePct>100||userDiscountPct<0||userDiscountPct>100)throw Error('Invalid scenario bounds');
 const takerVolume=monthlyVolumeUsd*takerShare,makerVolume=monthlyVolumeUsd-takerVolume;
 const grossUserFees=makerVolume*bpsToRate(userMakerBps)+takerVolume*bpsToRate(userTakerBps);
 const protocolCost=makerVolume*bpsToRate(protocolMakerBps)+takerVolume*bpsToRate(protocolTakerBps);
 const discount=grossUserFees*userDiscountPct/100;
 const affiliate=grossUserFees*affiliateSharePct/100;
 const net=grossUserFees-protocolCost-discount-affiliate-fixedMonthlyCostUsd;
 return Object.freeze({makerVolume,takerVolume,grossUserFees,protocolCost,discount,affiliate,fixedMonthlyCostUsd,net});
}

export function effectiveTradeCostBps({feeBps=0,spreadBps=0,impactBps=0,executionBps=0,fundingBps=0,bridgeBps=0}={}){
 const values=[feeBps,spreadBps,impactBps,executionBps,fundingBps,bridgeBps];
 if(values.some(v=>!finite(v)))throw Error('Cost inputs must be finite');
 return values.reduce((a,b)=>a+b,0);
}
