const cleanBase=value=>String(value||'').trim().replace(/\/+$/,'');

export function createServerHistoryClient({baseUrl,fetchImpl=fetch,getToken=()=>''}={}){
 const base=cleanBase(baseUrl);
 if(!base)return Object.freeze({enabled:false,history:async()=>null,latest:async()=>null,health:async()=>null});
 async function request(path,{auth=true}={}){
  const headers={accept:'application/json'};
  if(auth){
   const token=String(await getToken()||'').trim();
   if(!token)throw Error('Market Intelligence server token is not available');
   headers.authorization='Bearer '+token;
  }
  const response=await fetchImpl(base+path,{method:'GET',credentials:'omit',headers});
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
  }
 });
}
