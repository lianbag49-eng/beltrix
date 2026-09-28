const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));

export function evaluateRiskEnvelope(input={},limits={}){
 const notionalUsd=Number(input.notionalUsd);
 const equityUsd=Number(input.equityUsd);
 const requestedLeverage=finite(input.requestedLeverage)?Number(input.requestedLeverage):(finite(notionalUsd)&&finite(equityUsd)&&equityUsd>0?notionalUsd/equityUsd:null);
 const maxLeverage=finite(limits.maxLeverage)?Number(limits.maxLeverage):null;
 const maxNotionalUsd=finite(limits.maxNotionalUsd)?Number(limits.maxNotionalUsd):null;
 const minEquityUsd=finite(limits.minEquityUsd)?Number(limits.minEquityUsd):null;
 const reasons=[];
 if(!finite(notionalUsd)||notionalUsd<=0)reasons.push('invalid_notional');
 if(!finite(equityUsd)||equityUsd<=0)reasons.push('invalid_equity');
 if(maxLeverage===null||maxNotionalUsd===null)reasons.push('market_limits_required');
 if(maxLeverage!==null&&requestedLeverage!==null&&requestedLeverage>maxLeverage)reasons.push('leverage_limit');
 if(maxNotionalUsd!==null&&finite(notionalUsd)&&notionalUsd>maxNotionalUsd)reasons.push('notional_limit');
 if(minEquityUsd!==null&&finite(equityUsd)&&equityUsd<minEquityUsd)reasons.push('minimum_equity');
 const leverage=requestedLeverage;
 const initialMarginUsd=finite(notionalUsd)&&finite(leverage)&&leverage>0?notionalUsd/leverage:null;
 return Object.freeze({
  status:reasons.length?'blocked':'accepted',
  reasons:Object.freeze(reasons),
  notionalUsd:finite(notionalUsd)?notionalUsd:null,
  equityUsd:finite(equityUsd)?equityUsd:null,
  leverage:finite(leverage)?leverage:null,
  initialMarginUsd,
  limits:Object.freeze({maxLeverage,maxNotionalUsd,minEquityUsd})
 });
}
