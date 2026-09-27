import {defineSettlementAdapter,SETTLEMENT_CAPABILITIES} from './settlement.js';
import {canonicalTradeIntent,validateIntentFreshness} from './intent.js';

function cleanPrice(value){
 const n=Number(value);
 if(!Number.isFinite(n)||n<=0)throw Error('A positive settlement price is required');
 return String(value);
}

export function prepareHyperliquidIntent(intent,{settlementMarket,marketOrderPrice,now=Date.now()}={}){
 const i=canonicalTradeIntent(intent);
 validateIntentFreshness(i,now);
 if(!settlementMarket||!Number.isInteger(settlementMarket.assetId)||settlementMarket.assetId<0)throw Error('Hyperliquid asset id is required');
 const tif=i.orderType==='market'?'Ioc':'Gtc';
 const price=i.orderType==='limit'?cleanPrice(i.limitPrice):cleanPrice(marketOrderPrice);
 return Object.freeze({
  settlement:'hyperliquid',
  actionType:'order',
  userAccount:i.account,
  unsigned:true,
  requiresUserSignature:true,
  executionSemantics:i.orderType==='market'?'aggressive-ioc-limit':'resting-limit',
  order:Object.freeze({
   a:settlementMarket.assetId,
   b:i.side==='buy',
   p:price,
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
