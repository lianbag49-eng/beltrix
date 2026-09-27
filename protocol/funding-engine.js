const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));

export function defineFundingPolicy(input={}){
 const intervalMs=Number(input.intervalMs??3600000);
 const maxAbsRate=Number(input.maxAbsRate??0.01);
 if(!Number.isInteger(intervalMs)||intervalMs<=0)throw Error('Invalid funding interval');
 if(!finite(maxAbsRate)||maxAbsRate<=0||maxAbsRate>0.1)throw Error('Invalid funding rate cap');
 return Object.freeze({intervalMs,maxAbsRate});
}

export function clampFundingRate(rate,policyInput={}){
 const policy=defineFundingPolicy(policyInput);
 const n=Number(rate);
 if(!finite(n))throw Error('Funding rate must be finite');
 return Math.max(-policy.maxAbsRate,Math.min(policy.maxAbsRate,n));
}

export function fundingCashflow(position,oraclePrice,rate,policyInput={}){
 const px=Number(oraclePrice);
 if(!finite(px)||px<=0)throw Error('Oracle price must be positive');
 const r=clampFundingRate(rate,policyInput);
 const signedSize=position.side==='long'?position.size:-position.size;
 return -signedSize*px*r;
}

export function applyFunding(position,oraclePrice,rate,policyInput={}){
 const cashflow=fundingCashflow(position,oraclePrice,rate,policyInput);
 return Object.freeze({
  ...position,
  realizedFunding:Number(position.realizedFunding||0)+cashflow
 });
}

export function fundingEvent({position,oraclePrice,rate,intervalStart,policy}={}){
 const cashflow=fundingCashflow(position,oraclePrice,rate,policy);
 return Object.freeze({
  type:'funding',
  side:position.side,
  size:position.size,
  oraclePrice:Number(oraclePrice),
  requestedRate:Number(rate),
  appliedRate:clampFundingRate(rate,policy),
  cashflow,
  intervalStart:Number(intervalStart)
 });
}
