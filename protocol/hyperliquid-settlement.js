import {defineSettlementAdapter,SETTLEMENT_CAPABILITIES} from './settlement.js';
import {canonicalTradeIntent,validateIntentFreshness} from './intent.js';

function cleanPrice(value){
 if(value===null||value===undefined)return null;
 const n=Number(value);if(!Number.isFinite(n)||n<=0)throw Error('Invalid price');return String(value);
}

export function prepareHyperliquidIntent(intent,{market,now=Date.now()}={}){
 const i=canonicalTradeIntent(intent);
 validateIntentFreshness(i,now);
 if(!market||!Number.isInteger(market.assetId)||market.assetId<0)throw Error('Hyperliquid asset id is required');
 const tif=i.orderType==='market'?'Ioc':'Gtc';
 return Object.freeze({
  settlement:'hyperliquid',
  actionType:'order',
  userAccount:i.account,
  unsigned:true,
  requiresUserSignature:true,
  order:Object.freeze({
   a:market.assetId,
   b:i.side==='buy',
   p:i.orderType==='limit'?cleanPrice(i.limitPrice):null,
   s:String(i.size),
   r:i.reduceOnly,
   t:Object.freeze({limit:Object.freeze({tif})})
  }),
  beltrixIntent:i
 });
}

export const hyperliquidSettlement=defineSettlementAdapter({
 id:'hyperliquid',
 label:'Hyperliquid Bootstrap Settlement',
 status:'live',
 capabilities:[
  SETTLEMENT_CAPABILITIES.PERPS,
  SETTLEMENT_CAPABILITIES.NON_CUSTODIAL,
  SETTLEMENT_CAPABILITIES.EXTERNAL_BOOTSTRAP,
  SETTLEMENT_CAPABILITIES.BELTRIX_MARKETS
 ],
 prepareIntent:prepareHyperliquidIntent,
 notes:'BELTRIX owns intent/policy/risk UX while final settlement and margining remain on Hyperliquid.'
});
