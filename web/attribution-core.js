// Privacy-conscious referral/campaign attribution. Stores no wallet secret or credential.
const MAX=96;
const KEY_MAP=Object.freeze({
 ref:'referral',referral:'referral',
 utm_source:'source',utm_medium:'medium',utm_campaign:'campaign',utm_content:'content',utm_term:'term',
 campaign:'campaign',lang:'language',language:'language',region:'region'
});
function clean(value){
 if(value===null||value===undefined)return null;
 const v=String(value).normalize('NFKC').trim().slice(0,MAX);
 return v&&/^[\p{L}\p{N}._:@/+ -]+$/u.test(v)?v:null;
}
export function parseAttribution(rawUrl,now=Date.now()){
 const u=new URL(String(rawUrl),'https://beltrix.invalid/');
 const out={firstSeenAt:Number(now),lastSeenAt:Number(now)};
 for(const [key,target] of Object.entries(KEY_MAP)){
  if(out[target])continue;
  const v=clean(u.searchParams.get(key));if(v)out[target]=v;
 }
 return Object.freeze(out);
}
export function mergeAttribution(existing,incoming,now=Date.now()){
 const a=existing&&typeof existing==='object'?existing:{},b=incoming&&typeof incoming==='object'?incoming:{};
 const out={...a,...b};
 // Referral is first-touch: later campaigns cannot steal an already-attributed referrer.
 if(a.referral)out.referral=a.referral;
 out.firstSeenAt=Number(a.firstSeenAt||b.firstSeenAt||now);
 out.lastSeenAt=Number(now);
 return Object.freeze(out);
}
export function attributionEvent(type,attribution,extra={},now=Date.now()){
 const t=String(type||'').trim();
 if(!/^[a-z][a-z0-9_]{2,47}$/.test(t))throw Error('Invalid attribution event type');
 const safe={};
 for(const [k,v] of Object.entries(extra||{})){
  if(['secret','privateKey','apiKey','seed','password','token'].includes(k))continue;
  if(['string','number','boolean'].includes(typeof v)||v===null)safe[k]=v;
 }
 return Object.freeze({type:t,attribution:{...(attribution||{})},...safe,at:Number(now)});
}
