import {validateMarketIntelligenceRuntimeEnv} from './runtime-config.js';
import {createMarketIntelligenceService} from './service-runtime.js';
import {listen} from './node-http-runtime.js';

function envError(message){
 const error=new Error(message);
 error.code='BELTRIX_RUNTIME_CONFIG';
 return error;
}

async function loadQueryClient(){
 const modulePath=String(process.env.MI_QUERY_CLIENT_MODULE||'').trim();
 if(!modulePath)throw envError('MI_QUERY_CLIENT_MODULE is required until the production PostgreSQL driver is installed.');
 const mod=await import(modulePath);
 const factory=mod.createQueryClient||mod.default;
 if(typeof factory!=='function')throw envError('MI_QUERY_CLIENT_MODULE must export createQueryClient() or a default factory.');
 const client=await factory({databaseUrl:process.env.MI_DATABASE_URL});
 if(!client||typeof client.query!=='function')throw envError('Query client factory did not return an object with query(sql, params).');
 return client;
}

export async function startMarketIntelligenceServer(){
 const config=validateMarketIntelligenceRuntimeEnv(process.env);
 if(!config.ready)throw envError(config.issues.join('; '));
 const queryClient=await loadQueryClient();
 const service=createMarketIntelligenceService({queryClient,apiToken:process.env.MI_API_TOKEN,allowedOrigin:config.adminOrigin});
 const server=service.createServer();
 const address=await listen(server,{port:config.port,host:config.host});
 const shutdown=async signal=>{
  process.stderr.write('BELTRIX Market Intelligence shutting down: '+signal+'\n');
  await new Promise(resolve=>server.close(resolve));
  if(typeof queryClient.end==='function')await queryClient.end();
 };
 for(const signal of ['SIGTERM','SIGINT'])process.once(signal,()=>shutdown(signal).finally(()=>process.exit(0)));
 return Object.freeze({server,service,queryClient,address});
}

if(import.meta.url===new URL(process.argv[1],'file:').href){
 startMarketIntelligenceServer()
  .then(({address})=>process.stdout.write(JSON.stringify({service:'beltrix-market-intelligence',listening:address})+'\n'))
  .catch(error=>{process.stderr.write(String(error?.stack||error)+'\n');process.exit(1)});
}
