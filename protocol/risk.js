const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));

export function defineRiskPolicy(input={}){
 const maxLeverage=Number(input.maxLeverage??20);
 const maxOrderNotionalUsd=Number(input.maxOrderNotionalUsd??1000000);
 const maxOpenInterestUsd=Number(input.maxOpenInterestUsd??10000000);
 const minOracleSources=Number(input.minOracleSources??2);
 const maxOracleAgeMs=Number(input.maxOracleAgeMs??15000);
 const maxOracleDeviationBps=Number(input.maxOracleDeviationBps??100);
 if(!Number.isInteger(maxLeverage)||maxLeverage<1)throw Error('Invalid maxLeverage');
 for(const [name,value] of Object.entries({maxOrderNotionalUsd,maxOpenInterestUsd,maxOracleAgeMs,maxOracleDeviationBps})){
  if(!finite(value)||Number(value)<=0)throw Error('Invalid '+name);
 }
 if(!Number.isInteger(minOracleSources)||minOracleSources<1)throw Error('Invalid minOracleSources');
 return Object.freeze({maxLeverage,maxOrderNotionalUsd,maxOpenInterestUsd,minOracleSources,maxOracleAgeMs,maxOracleDeviationBps});
}

export function assessIntentRisk(intent,{policy,oracle,marketState={}}={}){
 const p=defineRiskPolicy(policy||{});
 const reasons=[];
 if(!oracle?.ok||!finite(oracle?.price)||Number(oracle.price)<=0)reasons.push('oracle-unavailable');
 const px=Number(oracle?.price||0),size=Number(intent?.size||0);
 const notional=px>0&&size>0?px*size:null;
 if(notional!==null&&notional>p.maxOrderNotionalUsd)reasons.push('order-notional-cap');
 if(intent?.leverage!=null&&Number(intent.leverage)>p.maxLeverage)reasons.push('leverage-cap');
 const oi=Number(marketState?.openInterestUsd??0);
 if(Number.isFinite(oi)&&notional!==null&&oi+notional>p.maxOpenInterestUsd)reasons.push('open-interest-cap');
 if(marketState?.halted)reasons.push('market-halted');
 return Object.freeze({
  allowed:reasons.length===0,
  notionalUsd:notional,
  maxLeverage:p.maxLeverage,
  reasons:Object.freeze(reasons)
 });
}
