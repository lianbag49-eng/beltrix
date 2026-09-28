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

export function createMarketIntelligenceApi({repository,token,clock=()=>Date.now(),allowedOrigin=''}={}){
 if(!repository||typeof repository.history!=='function')throw Error('Market Intelligence API requires a telemetry repository');
 const configured=String(token||'');
 const originAllowed=request=>{const origin=String(request?.headers?.origin||request?.headers?.Origin||'');return Boolean(allowedOrigin&&origin===allowedOrigin)};
 const cors=request=>originAllowed(request)?{'access-control-allow-origin':allowedOrigin,'access-control-allow-methods':'GET, PATCH, OPTIONS','access-control-allow-headers':'Authorization, Content-Type','vary':'Origin'}:{};
 return Object.freeze({
  async handle(request={}){
   const method=String(request.method||'GET').toUpperCase();
   const url=parseUrl(request.url||'/');
   if(method==='OPTIONS')return json(200,{ok:true},cors(request));
   if(method==='GET'&&url.pathname==='/health')return json(200,{ok:true,service:'beltrix-market-intelligence',time:new Date(clock()).toISOString()},cors(request));
   if(method==='GET'&&url.pathname==='/ready'){
    try{
     const rows=typeof repository.collectorHealth==='function'?await repository.collectorHealth({limit:1}):[];
     const latest=rows[0]||null;
     const finishedAt=latest?.finished_at||latest?.finishedAt||null;
     const ageMs=finishedAt?Math.max(0,clock()-new Date(finishedAt).getTime()):null;
     const ready=Boolean(latest)&&ageMs!==null&&ageMs<=90*60*1000&&Number(latest.successful_assets??latest.successfulAssets??0)>0;
     return json(ready?200:503,{ok:ready,service:'beltrix-market-intelligence',collector:{finishedAt,ageMs,successfulAssets:Number(latest?.successful_assets??latest?.successfulAssets??0),failedAssets:Number(latest?.failed_assets??latest?.failedAssets??0)}},cors(request));
    }catch(error){
     return json(503,{ok:false,service:'beltrix-market-intelligence',error:'persistence_unavailable'},cors(request));
    }
   }
   if(!['GET','PATCH'].includes(method))return json(405,{error:'method_not_allowed'},{allow:'GET, PATCH, OPTIONS',...cors(request)});
   if(!configured||!sameSecret(bearer(request.headers),configured))return json(401,{error:'unauthorized'},cors(request));
   if(url.pathname==='/v1/history'){
    const asset=cleanAsset(url.searchParams.get('asset'));
    if(!asset)return json(400,{error:'invalid_asset'},cors(request));
    const limit=cleanLimit(url.searchParams.get('limit'));
    const since=url.searchParams.get('since')||hoursAgo(url.searchParams.get('hours'));
    const rows=await repository.history({asset,since,limit});
    return json(200,{asset,since,limit,count:rows.length,rows},cors(request));
   }
   if(url.pathname==='/v1/latest'){
    const asset=cleanAsset(url.searchParams.get('asset'));
    if(!asset)return json(400,{error:'invalid_asset'},cors(request));
    const rows=await repository.history({asset,since:hoursAgo(24*30),limit:5000});
    const latest=rows.length?rows[rows.length-1]:null;
    return json(200,{asset,latest},cors(request));
   }
   if(url.pathname==='/v1/collector-health'){
    const limit=cleanLimit(url.searchParams.get('limit'),100);
    const rows=typeof repository.collectorHealth==='function'?await repository.collectorHealth({limit}):[];
    return json(200,{count:rows.length,rows},cors(request));
   }
   if(method==='GET'&&url.pathname==='/v1/open-alerts'){
    const limit=cleanLimit(url.searchParams.get('limit'),200);
    const rows=typeof repository.openAlerts==='function'?await repository.openAlerts({limit}):[];
    return json(200,{count:rows.length,rows},cors(request));
   }
   if(method==='PATCH'&&/^\/v1\/alerts\/\d+$/.test(url.pathname)){
    if(typeof repository.updateAlertStatus!=='function')return json(501,{error:'alert_updates_unavailable'},cors(request));
    const id=Number(url.pathname.split('/').pop());
    const status=String(request.body?.status||'');
    if(!['acknowledged','resolved'].includes(status))return json(400,{error:'invalid_alert_status'},cors(request));
    const row=await repository.updateAlertStatus({id,status});
    if(!row)return json(404,{error:'alert_not_found'},cors(request));
    return json(200,{alert:row},cors(request));
   }
   return json(404,{error:'not_found'},cors(request));
  }
 });
}
