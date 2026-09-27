const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));

export function defineMarginPolicy(input={}){
 const initialMarginRatio=Number(input.initialMarginRatio??0.1);
 const maintenanceMarginRatio=Number(input.maintenanceMarginRatio??0.05);
 const liquidationFeeBps=Number(input.liquidationFeeBps??50);
 const maxLeverage=Number(input.maxLeverage??10);
 if(!finite(initialMarginRatio)||initialMarginRatio<=0||initialMarginRatio>=1)throw Error('Invalid initialMarginRatio');
 if(!finite(maintenanceMarginRatio)||maintenanceMarginRatio<=0||maintenanceMarginRatio>=initialMarginRatio)throw Error('Invalid maintenanceMarginRatio');
 if(!finite(liquidationFeeBps)||liquidationFeeBps<0||liquidationFeeBps>1000)throw Error('Invalid liquidationFeeBps');
 if(!Number.isInteger(maxLeverage)||maxLeverage<1)throw Error('Invalid maxLeverage');
 return Object.freeze({initialMarginRatio,maintenanceMarginRatio,liquidationFeeBps,maxLeverage});
}

export function defineIsolatedPosition(input={}){
 const side=input.side==='short'?'short':input.side==='long'?'long':null;
 const size=Number(input.size),entryPrice=Number(input.entryPrice),collateral=Number(input.collateral);
 if(!side)throw Error('Position side must be long or short');
 if(!finite(size)||size<=0)throw Error('Position size must be positive');
 if(!finite(entryPrice)||entryPrice<=0)throw Error('Entry price must be positive');
 if(!finite(collateral)||collateral<=0)throw Error('Collateral must be positive');
 return Object.freeze({side,size,entryPrice,collateral,realizedFunding:Number(input.realizedFunding??0)});
}

export function positionNotional(position,markPrice=position?.entryPrice){
 const mark=Number(markPrice);
 if(!position||!finite(mark)||mark<=0)throw Error('Valid position and markPrice are required');
 return position.size*mark;
}

export function positionLeverage(position){
 return position.size*position.entryPrice/position.collateral;
}

export function unrealizedPnl(position,markPrice){
 const mark=Number(markPrice);
 if(!position||!finite(mark)||mark<=0)throw Error('Valid position and markPrice are required');
 const direction=position.side==='long'?1:-1;
 return direction*(mark-position.entryPrice)*position.size;
}

export function positionEquity(position,markPrice){
 return position.collateral+Number(position.realizedFunding||0)+unrealizedPnl(position,markPrice);
}

export function liquidationPrice(position,policyInput={}){
 const policy=defineMarginPolicy(policyInput);
 const q=position.size,p0=position.entryPrice,c=position.collateral+Number(position.realizedFunding||0),m=policy.maintenanceMarginRatio;
 const px=position.side==='long'
  ?(p0*q-c)/(q*(1-m))
  :(c+p0*q)/(q*(1+m));
 return Math.max(0,px);
}

export function marginHealth(position,markPrice,policyInput={}){
 const policy=defineMarginPolicy(policyInput);
 const mark=Number(markPrice);
 const notional=positionNotional(position,mark);
 const equity=positionEquity(position,mark);
 const maintenanceRequirement=notional*policy.maintenanceMarginRatio;
 const initialRequirement=notional*policy.initialMarginRatio;
 const ratio=notional>0?equity/notional:null;
 return Object.freeze({
  markPrice:mark,
  notional,
  equity,
  unrealizedPnl:unrealizedPnl(position,mark),
  initialRequirement,
  maintenanceRequirement,
  marginRatio:ratio,
  liquidatable:equity<=maintenanceRequirement,
  liquidationPrice:liquidationPrice(position,policy)
 });
}

export function validateOpeningPosition(position,policyInput={}){
 const policy=defineMarginPolicy(policyInput);
 const leverage=positionLeverage(position);
 const requiredInitial=position.size*position.entryPrice*policy.initialMarginRatio;
 const reasons=[];
 if(leverage>policy.maxLeverage)reasons.push('max-leverage');
 if(position.collateral<requiredInitial)reasons.push('initial-margin');
 return Object.freeze({
  allowed:reasons.length===0,
  leverage,
  requiredInitial,
  reasons:Object.freeze(reasons)
 });
}
