import {validateMarketIntelligenceRuntimeEnv} from './runtime-config.js';
import {applyMarketIntelligenceSchema} from './apply-schema.js';

async function loadQueryClient(){
 const modulePath=String(process.env.MI_QUERY_CLIENT_MODULE||'./query-client.pg.js').trim();
 const mod=await import(modulePath);
 const factory=mod.createQueryClient||mod.default;
 if(typeof factory!=='function')throw Error('Query client module must export createQueryClient()');
 return factory({databaseUrl:process.env.MI_DATABASE_URL});
}

const config=validateMarketIntelligenceRuntimeEnv(process.env);
if(!config.databaseConfigured)throw Error('MI_DATABASE_URL missing');
const client=await loadQueryClient();
try{
 const out=await applyMarketIntelligenceSchema(client);
 process.stdout.write(JSON.stringify(out)+'\n');
}finally{
 if(typeof client.end==='function')await client.end();
}
