// BELTRIX venue abstraction. Pure module: no wallet, DOM, or network access.
export const VENUE_CAPABILITIES=Object.freeze({
 MARKET_DATA:'market-data',
 PERPS:'perps',
 SPOT:'spot',
 TRADING:'trading',
 REFERRAL:'referral',
 BUILDER_FEES:'builder-fees',
 READ_ONLY:'read-only'
});

function slug(value,name){
 const v=String(value??'').trim().toLowerCase();
 if(!/^[a-z0-9][a-z0-9-]{1,39}$/.test(v))throw Error(`${name} must be a lowercase slug`);
 return v;
}
function unique(values){return [...new Set(values)]}

export function defineVenueAdapter(config){
 if(!config||typeof config!=='object')throw Error('Venue config is required');
 const id=slug(config.id,'Venue id'),label=String(config.label||'').trim();
 if(!label)throw Error('Venue label is required');
 const networks=config.networks&&typeof config.networks==='object'?Object.freeze({...config.networks}):Object.freeze({});
 if(!Object.keys(networks).length)throw Error('At least one venue network is required');
 const capabilities=Object.freeze(unique((config.capabilities||[]).map(x=>String(x))));
 return Object.freeze({...config,id,label,networks,capabilities});
}

export function normalizeVenueMarket(input){
 const symbol=String(input?.symbol||'').trim();
 const venue=String(input?.venue||'').trim();
 const marketType=input?.marketType==='spot'?'spot':'perp';
 if(!symbol||!venue)throw Error('Normalized market requires symbol and venue');
 const n=v=>v===null||v===undefined||v===''?null:Number(v);
 const tickSize=n(input.tickSize),minSize=n(input.minSize),maxLeverage=n(input.maxLeverage);
 if(tickSize!==null&&(!Number.isFinite(tickSize)||tickSize<=0))throw Error('Invalid tick size');
 if(minSize!==null&&(!Number.isFinite(minSize)||minSize<0))throw Error('Invalid minimum size');
 if(maxLeverage!==null&&(!Number.isFinite(maxLeverage)||maxLeverage<1))throw Error('Invalid maximum leverage');
 return Object.freeze({
  venue,
  symbol,
  base:String(input.base||symbol.split(/[-_/]/)[0]||symbol),
  quote:String(input.quote||'USDC'),
  marketType,
  tickSize,
  minSize,
  maxLeverage,
  nativeId:input.nativeId??symbol,
  raw:input.raw??null
 });
}

export class VenueRegistry{
 #venues=new Map();
 register(adapter){
  if(!adapter?.id)throw Error('Venue adapter is required');
  if(this.#venues.has(adapter.id))throw Error(`Venue already registered: ${adapter.id}`);
  this.#venues.set(adapter.id,adapter);return adapter;
 }
 get(id){const v=this.#venues.get(String(id));if(!v)throw Error(`Unknown venue: ${id}`);return v}
 has(id){return this.#venues.has(String(id))}
 list(){return [...this.#venues.values()]}
 select({requires=[],network}={}){
  const need=new Set(requires);
  return this.list().filter(v=>(!network||v.networks?.[network])&&[...need].every(x=>v.capabilities.includes(x)));
 }
}
