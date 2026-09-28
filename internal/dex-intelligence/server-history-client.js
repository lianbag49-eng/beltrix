const cleanBase=value=>String(value||'').trim().replace(/\/+$/,'');

export function createServerHistoryClient({baseUrl,fetchImpl=fetch,getToken=()=>''}={}){
 const base=cleanBase(baseUrl);
 if(!base)return Object.freeze({enabled:false,history:async()=>null,latest:async()=>null,health:async()=>null});
 async function request(path,{auth=true,method='GET',body=null}={}){
  const headers={accept:'application/json'};
  if(auth){
   const token=String(await getToken()||'').trim();
   if(!token)throw Error('Market Intelligence server token is not available');
   headers.authorization='Bearer '+token;
  }
  if(body!==null)headers['content-type']='application/json';
  const response=await fetchImpl(base+path,{method,credentials:'omit',headers,body:body===null?undefined:JSON.stringify(body)});
  let data=null;try{data=await response.json()}catch{}
  if(!response.ok)throw Error(data?.error||('Market Intelligence API '+response.status));
  return data;
 }
 return Object.freeze({
  enabled:true,
  health:()=>request('/health',{auth:false}),
  async history({asset,hours=24,limit=500}={}){
   const q=new URLSearchParams({asset:String(asset||'').toUpperCase(),hours:String(hours),limit:String(limit)});
   return request('/v1/history?'+q);
  },
  async latest(asset){
   const q=new URLSearchParams({asset:String(asset||'').toUpperCase()});
   return request('/v1/latest?'+q);
  },
  collectorHealth(limit=100){
   const q=new URLSearchParams({limit:String(limit)});
   return request('/v1/collector-health?'+q);
  },
  openAlerts(limit=200){
   const q=new URLSearchParams({limit:String(limit)});
   return request('/v1/open-alerts?'+q);
  },
  operations(asset='BTC'){
   const q=new URLSearchParams({asset:String(asset||'').toUpperCase()});
   return request('/v1/operations?'+q);
  },
  quality({asset='BTC',hours=24}={}){
   const q=new URLSearchParams({asset:String(asset||'').toUpperCase(),hours:String(hours)});
   return request('/v1/quality?'+q);
  },
  comparison({asset='BTC',hours=168}={}){
   const q=new URLSearchParams({asset:String(asset||'').toUpperCase(),hours:String(hours)});
   return request('/v1/comparison?'+q);
  },
  bd(){
   return request('/v1/bd');
  },
  protocol(){
   return request('/v1/protocol');
  },
  planExecution(intent){
   return request('/v1/execution/plan',{method:'POST',body:intent});
  },
  async updateAlertStatus(id,status){
   const token=String(await getToken()||'').trim();
   if(!token)throw Error('Market Intelligence server token is not available');
   const response=await fetchImpl(base+'/v1/alerts/'+Number(id),{
    method:'PATCH',
    credentials:'omit',
    headers:{accept:'application/json','content-type':'application/json',authorization:'Bearer '+token},
    body:JSON.stringify({status})
   });
   let data=null;try{data=await response.json()}catch{}
   if(!response.ok)throw Error(data?.error||('Market Intelligence API '+response.status));
   return data;
  }
 });
}
