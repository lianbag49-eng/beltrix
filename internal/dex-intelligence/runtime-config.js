export function validateMarketIntelligenceRuntimeEnv(env=process.env){
 const databaseUrl=String(env.MI_DATABASE_URL||'').trim();
 const apiToken=String(env.MI_API_TOKEN||'').trim();
 const issues=[];
 if(!databaseUrl)issues.push('MI_DATABASE_URL missing');
 else if(!/^postgres(?:ql)?:\/\//i.test(databaseUrl))issues.push('MI_DATABASE_URL must be a postgres URL');
 if(!apiToken)issues.push('MI_API_TOKEN missing');
 else if(apiToken.length<24)issues.push('MI_API_TOKEN should be at least 24 characters');
 return Object.freeze({
  ready:issues.length===0,
  issues:Object.freeze(issues),
  databaseConfigured:Boolean(databaseUrl),
  apiTokenConfigured:Boolean(apiToken),
  port:Number(env.PORT)||8788,
  host:String(env.HOST||'127.0.0.1')
 });
}
