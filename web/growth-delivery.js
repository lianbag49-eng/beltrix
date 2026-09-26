import {GROWTH_QUEUE_KEY,getGrowthQueue} from './attribution-client.js';

function cleanObject(value){
 if(Array.isArray(value))return value.slice(0,100).map(cleanObject);
 if(!value||typeof value!=='object')return value;
 const out={};
 for(const [key,val] of Object.entries(value)){
  if(/secret|private.?key|api.?key|seed|password|token|cookie|session/i.test(key))continue;
  out[key]=cleanObject(val);
 }
 return out;
}

function fnv1a(text){
 let hash=0x811c9dc5;
 for(let i=0;i<text.length;i++){hash^=text.charCodeAt(i);hash=Math.imul(hash,0x01000193)}
 return (hash>>>0).toString(16).padStart(8,'0');
}

export function deliveryBatch(events){
 return (Array.isArray(events)?events:[]).slice(-100).map(event=>{
  const clean=cleanObject(event);
  return Object.freeze({...clean,eventId:'evt_'+fnv1a(JSON.stringify(clean))});
 });
}

export function growthEndpoint(doc=globalThis.document){
 const meta=doc?.querySelector?.('meta[name="beltrix-growth-endpoint"]')?.content?.trim();
 const globalValue=typeof globalThis.BELTRIX_GROWTH_ENDPOINT==='string'?globalThis.BELTRIX_GROWTH_ENDPOINT.trim():'';
 return meta||globalValue||null;
}

export async function deliverGrowthEvents(events,{endpoint=growthEndpoint(),fetchImpl=globalThis.fetch}={}){
 const batch=deliveryBatch(events);
 if(!endpoint||!batch.length)return Object.freeze({sent:0,skipped:true});
 const url=new URL(endpoint,globalThis.location?.href||'https://beltrix.invalid/');
 if(url.protocol!=='https:'&&url.hostname!=='localhost'&&url.hostname!=='127.0.0.1')throw Error('Growth endpoint must use HTTPS');
 const response=await fetchImpl(url.href,{
  method:'POST',
  credentials:'omit',
  keepalive:true,
  headers:{'Content-Type':'application/json'},
  body:JSON.stringify({version:1,events:batch})
 });
 if(!response.ok)throw Error('Growth delivery HTTP '+response.status);
 return Object.freeze({sent:batch.length,skipped:false});
}

export async function flushGrowthQueue({storage=globalThis.localStorage,endpoint=growthEndpoint(),fetchImpl=globalThis.fetch}={}){
 const events=getGrowthQueue(storage);
 const result=await deliverGrowthEvents(events,{endpoint,fetchImpl});
 if(result.sent){
  try{storage?.setItem?.(GROWTH_QUEUE_KEY,'[]')}catch{}
 }
 return result;
}

export function installGrowthDelivery({intervalMs=15000}={}){
 const endpoint=growthEndpoint();
 if(!endpoint)return ()=>{};
 let stopped=false;
 const flush=()=>{if(!stopped)flushGrowthQueue({endpoint}).catch(()=>{})};
 const timer=setInterval(flush,Math.max(5000,Number(intervalMs)||15000));
 addEventListener?.('pagehide',flush);
 queueMicrotask(flush);
 return ()=>{stopped=true;clearInterval(timer);removeEventListener?.('pagehide',flush)};
}
