const CODE=/^[A-Za-z0-9][A-Za-z0-9._-]{1,63}$/;
const VALUE=/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

export function validPartnerCode(value){return CODE.test(String(value||'').trim())}

function optional(value,name){
 const v=String(value||'').trim();
 if(!v)return null;
 if(!VALUE.test(v))throw Error(`Invalid ${name}`);
 return v;
}

export function buildPartnerLink({baseUrl,code,source='partner',campaign='',language='',region=''}){
 const partner=String(code||'').trim();
 if(!validPartnerCode(partner))throw Error('Partner code must be 2–64 letters, numbers, dot, underscore or hyphen');
 const u=new URL(String(baseUrl));
 u.hash='';
 u.search='';
 u.searchParams.set('ref',partner);
 const src=optional(source,'source');if(src)u.searchParams.set('utm_source',src);
 const cmp=optional(campaign,'campaign');if(cmp)u.searchParams.set('utm_campaign',cmp);
 const lang=optional(language,'language');if(lang)u.searchParams.set('language',lang);
 const reg=optional(region,'region');if(reg)u.searchParams.set('region',reg);
 return u.toString();
}

export function summarizeGrowthEvents(events=[]){
 const rows=Array.isArray(events)?events:[];
 const out={pageViews:0,walletConnections:0,confirmedOrders:0,builderApprovals:0,total:rows.length};
 for(const e of rows){
  if(e?.type==='page_view')out.pageViews++;
  else if(e?.type==='wallet_connected')out.walletConnections++;
  else if(e?.type==='trade_order_confirmed')out.confirmedOrders++;
  else if(e?.type==='builder_fee_approved')out.builderApprovals++;
 }
 return Object.freeze(out);
}
