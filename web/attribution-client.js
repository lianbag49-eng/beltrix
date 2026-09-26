import {parseAttribution,mergeAttribution,attributionEvent} from './attribution-core.js';

export const ATTRIBUTION_KEY='beltrix-attribution-v1';
export const GROWTH_QUEUE_KEY='beltrix-growth-events-v1';
const SIGNAL_FIELDS=['referral','source','medium','campaign','content','term','language','region'];

function readJson(storage,key,fallback){
 try{const v=JSON.parse(storage?.getItem?.(key)||'null');return v??fallback}catch{return fallback}
}
function writeJson(storage,key,value){
 try{storage?.setItem?.(key,JSON.stringify(value));return true}catch{return false}
}
export function getStoredAttribution(storage=globalThis.localStorage){
 const value=readJson(storage,ATTRIBUTION_KEY,null);
 return value&&typeof value==='object'&&!Array.isArray(value)?value:null;
}
export function captureAttribution(rawUrl,storage=globalThis.localStorage,now=Date.now()){
 const incoming=parseAttribution(rawUrl,now);
 const hasSignal=SIGNAL_FIELDS.some(k=>incoming[k]);
 const previous=getStoredAttribution(storage);
 if(!hasSignal)return previous;
 const merged=mergeAttribution(previous,incoming,now);
 writeJson(storage,ATTRIBUTION_KEY,merged);
 return merged;
}
export function getGrowthQueue(storage=globalThis.localStorage){
 const value=readJson(storage,GROWTH_QUEUE_KEY,[]);
 return Array.isArray(value)?value.slice(-200):[];
}
export function recordGrowthEvent(type,extra={},storage=globalThis.localStorage,now=Date.now()){
 const attribution=getStoredAttribution(storage)||{};
 const event=attributionEvent(type,attribution,extra,now);
 const queue=[...getGrowthQueue(storage),event].slice(-200);
 writeJson(storage,GROWTH_QUEUE_KEY,queue);
 if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent('beltrix:growth-event',{detail:event}));
 return event;
}
export function bootstrapGrowthTracking({url=globalThis.location?.href||'',storage=globalThis.localStorage,now=Date.now()}={}){
 const attribution=captureAttribution(url,storage,now);
 const event=recordGrowthEvent('page_view',{path:globalThis.location?.pathname||'/'},storage,now);
 if(typeof window!=='undefined'){
  window.beltrixGrowth=Object.freeze({
   attribution:()=>getStoredAttribution(storage),
   events:()=>getGrowthQueue(storage)
  });
  window.dispatchEvent(new CustomEvent('beltrix:attribution',{detail:attribution}));
 }
 return {attribution,event};
}
