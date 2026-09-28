import {timingSafeEqual} from 'node:crypto';

const json=(status,body,headers={})=>Object.freeze({
 status,
 headers:Object.freeze({'content-type':'application/json; charset=utf-8','cache-control':'no-store',...headers}),
 body:JSON.stringify(body)
});

function bearer(headers={}){
 const raw=String(headers.authorization||headers.Authorization||'');
 return raw.toLowerCase().startsWith('bearer ')?raw.slice(7).trim():'';
}
function sameSecret(a,b){
 const x=Buffer.from(String(a||'')),y=Buffer.from(String(b||''));
 return x.length>0&&x.length===y.length&&timingSafeEqual(x,y);
}
function parseUrl(input='/',base='https://beltrix.internal'){
 try{return new URL(input,base)}catch{return new URL('/',base)}
}
function cleanAsset(value){
 const asset=String(value||'').trim().toUpperCase();
 return /^[A-Z0-9]{2,16}$/.test(asset)?asset:'';
}
function cleanLimit(value,fallback=500){
 const n=Number(value);
 return Number.isInteger(n)&&n>0?Math.min(5000,n):fallback;
}
function hoursAgo(hours){
 const n=Math.max(1,Math.min(24*90,Number(hours)||24));
 return new Date(Date.now()-n*60*60*1000).toISOString();
}

export function createMarketIntelligenceApi({repository,token,clock=()=>Date.now()}={}){
 if(!repository||typeof repository.history!=='function')throw Error('Market Intelligence API requires a telemetry repository');
 const configured=String(token||'');
 return Object.freeze({
  async handle(request={}){
   const method=String(request.method||'GET').toUpperCase();
   const url=parseUrl(request.url||'/');
   if(method!=='GET')return json(405,{error:'method_not_allowed'},{allow:'GET'});
   if(url.pathname==='/health')return json(200,{ok:true,service:'beltrix-market-intelligence',time:new Date(clock()).toISOString()});
   if(!configured||!sameSecret(bearer(request.headers),configured))return json(401,{error:'unauthorized'});
   if(url.pathname==='/v1/history'){
    const asset=cleanAsset(url.searchParams.get('asset'));
    if(!asset)return json(400,{error:'invalid_asset'});
    const limit=cleanLimit(url.searchParams.get('limit'));
    const since=url.searchParams.get('since')||hoursAgo(url.searchParams.get('hours'));
    const rows=await repository.history({asset,since,limit});
    return json(200,{asset,since,limit,count:rows.length,rows});
   }
   if(url.pathname==='/v1/latest'){
    const asset=cleanAsset(url.searchParams.get('asset'));
    if(!asset)return json(400,{error:'invalid_asset'});
    const rows=await repository.history({asset,since:hoursAgo(24*30),limit:5000});
    const latest=rows.length?rows[rows.length-1]:null;
    return json(200,{asset,latest});
   }
   if(url.pathname==='/v1/collector-health'){
    const limit=cleanLimit(url.searchParams.get('limit'),100);
    const rows=typeof repository.collectorHealth==='function'?await repository.collectorHealth({limit}):[];
    return json(200,{count:rows.length,rows});
   }
   if(url.pathname==='/v1/open-alerts'){
    const limit=cleanLimit(url.searchParams.get('limit'),200);
    const rows=typeof repository.openAlerts==='function'?await repository.openAlerts({limit}):[];
    return json(200,{count:rows.length,rows});
   }
   return json(404,{error:'not_found'});
  }
 });
}
