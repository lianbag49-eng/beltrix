import {defineMarginPolicy,marginHealth,positionEquity,positionNotional} from './margin-model.js';

export function simulateLiquidation(position,markPrice,policyInput={},insuranceBalance=0){
 const policy=defineMarginPolicy(policyInput);
 const health=marginHealth(position,markPrice,policy);
 if(!health.liquidatable){
  return Object.freeze({
   triggered:false,
   health,
   closeNotional:0,
   liquidationFee:0,
   equityBefore:health.equity,
   deficit:0,
   insuranceDraw:0,
   residualDeficit:0
  });
 }
 const closeNotional=positionNotional(position,markPrice);
 const liquidationFee=closeNotional*policy.liquidationFeeBps/10000;
 const equityBefore=positionEquity(position,markPrice);
 const deficit=Math.max(0,liquidationFee-equityBefore);
 const insurance=Math.max(0,Number(insuranceBalance)||0);
 const insuranceDraw=Math.min(insurance,deficit);
 const residualDeficit=Math.max(0,deficit-insuranceDraw);
 return Object.freeze({
  triggered:true,
  health,
  closeNotional,
  liquidationFee,
  equityBefore,
  deficit,
  insuranceDraw,
  residualDeficit,
  userResidual:Math.max(0,equityBefore-liquidationFee)
 });
}

export function liquidationDecision(position,markPrice,policyInput={}){
 const health=marginHealth(position,markPrice,policyInput);
 return Object.freeze({
  shouldLiquidate:health.liquidatable,
  markPrice:Number(markPrice),
  liquidationPrice:health.liquidationPrice,
  equity:health.equity,
  maintenanceRequirement:health.maintenanceRequirement,
  reasons:Object.freeze(health.liquidatable?['maintenance-margin-breach']:[])
 });
}
