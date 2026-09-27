import {marginHealth} from './margin-model.js';
import {simulateLiquidation} from './liquidation-sim.js';

export function stressPosition(position,{policy,prices=[],insuranceBalance=0}={}){
 if(!Array.isArray(prices)||!prices.length)throw Error('Stress prices are required');
 const rows=prices.map(price=>{
  const health=marginHealth(position,price,policy);
  const liquidation=simulateLiquidation(position,price,policy,insuranceBalance);
  return Object.freeze({
   price:Number(price),
   equity:health.equity,
   marginRatio:health.marginRatio,
   liquidatable:health.liquidatable,
   insuranceDraw:liquidation.insuranceDraw,
   residualDeficit:liquidation.residualDeficit
  });
 });
 const firstLiquidation=rows.find(x=>x.liquidatable)||null;
 return Object.freeze({
  rows:Object.freeze(rows),
  firstLiquidation,
  anyResidualDeficit:rows.some(x=>x.residualDeficit>0)
 });
}

export function generatePriceShockGrid(referencePrice,{downPct=0.8,upPct=0.8,steps=16}={}){
 const ref=Number(referencePrice),n=Number(steps);
 if(!Number.isFinite(ref)||ref<=0)throw Error('Reference price must be positive');
 if(!Number.isInteger(n)||n<2||n>500)throw Error('Invalid stress steps');
 const down=Math.max(0,Number(downPct)),up=Math.max(0,Number(upPct));
 const min=ref*(1-down),max=ref*(1+up);
 const gap=(max-min)/(n-1);
 return Object.freeze(Array.from({length:n},(_,i)=>min+gap*i));
}
