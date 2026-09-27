const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const positive=v=>finite(v)&&Number(v)>0;

function clean(value,max=96){return String(value??'').trim().slice(0,max)}
function whole(value,name){
 const n=Number(value);
 if(!Number.isInteger(n)||n<0)throw Error(name+' must be a non-negative integer');
 return n;
}

export function canonicalTradeIntent(input={}){
 const side=input.side==='sell'?'sell':input.side==='buy'?'buy':null;
 if(!side)throw Error('Trade intent side must be buy or sell');
 const market=clean(input.market,64).toUpperCase();
 if(!market)throw Error('Trade intent market is required');
 const account=clean(input.account,128);
 if(!account)throw Error('Trade intent account is required');
 const size=Number(input.size);
 if(!positive(size))throw Error('Trade intent size must be positive');
 const orderType=input.orderType==='limit'?'limit':'market';
 const limitPrice=orderType==='limit'?Number(input.limitPrice):null;
 if(orderType==='limit'&&!positive(limitPrice))throw Error('Limit order requires a positive limitPrice');
 const leverage=input.leverage==null?null:Number(input.leverage);
 if(leverage!==null&&(!Number.isInteger(leverage)||leverage<1))throw Error('Leverage must be a positive integer');
 const maxSlippageBps=input.maxSlippageBps==null?null:Number(input.maxSlippageBps);
 if(maxSlippageBps!==null&&(!finite(maxSlippageBps)||maxSlippageBps<0||maxSlippageBps>500))throw Error('maxSlippageBps must be 0-500');
 const expiry=whole(input.expiry,'expiry');
 const nonce=whole(input.nonce,'nonce');
 return Object.freeze({
  protocol:'beltrix',
  version:1,
  account,
  market,
  side,
  size,
  orderType,
  limitPrice,
  reduceOnly:Boolean(input.reduceOnly),
  leverage,
  maxSlippageBps,
  expiry,
  nonce,
  settlementPreferences:Object.freeze(
   Array.isArray(input.settlementPreferences)
    ?[...new Set(input.settlementPreferences.map(x=>clean(x,40).toLowerCase()).filter(Boolean))]
    :[]
  )
 });
}

export function validateIntentFreshness(intent,now=Date.now()){
 if(!intent?.expiry)throw Error('Intent expiry is required');
 if(Number(intent.expiry)<=Number(now))throw Error('Trade intent expired');
 return true;
}

export function intentSigningEnvelope(intent,{revision=1,chainContext='agnostic'}={}){
 const i=canonicalTradeIntent(intent);
 return Object.freeze({
  domain:Object.freeze({name:'BELTRIX Protocol',version:'1',chainContext:String(chainContext)}),
  revision:Number(revision),
  intent:i
 });
}
