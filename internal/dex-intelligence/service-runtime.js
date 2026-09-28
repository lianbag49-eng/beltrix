import {createPostgresTelemetryAdapter} from './storage/postgres-adapter.js';
import {createTelemetryRepository} from './storage/telemetry-repository.js';
import {createMarketIntelligenceApi} from './server-api.js';
import {createNodeRequestHandler,createMarketIntelligenceHttpServer} from './node-http-runtime.js';

export function createMarketIntelligenceService({queryClient,apiToken,clock,allowedOrigin=''}={}){
 if(!queryClient||typeof queryClient.query!=='function')throw Error('Market Intelligence service requires a query-capable database client');
 const adapter=createPostgresTelemetryAdapter(queryClient);
 const repository=createTelemetryRepository(adapter);
 const api=createMarketIntelligenceApi({repository,token:apiToken,clock,allowedOrigin});
 return Object.freeze({
  adapter,
  repository,
  api,
  handler:createNodeRequestHandler(api),
  createServer:()=>createMarketIntelligenceHttpServer(api)
 });
}
