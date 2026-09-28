import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';

export async function applyMarketIntelligenceSchema(queryClient,{
 schemaPath=resolve('internal/dex-intelligence/storage/postgres-schema.sql')
}={}){
 if(!queryClient||typeof queryClient.query!=='function')throw Error('Schema apply requires a query-capable client');
 const sql=await readFile(schemaPath,'utf8');
 await queryClient.query(sql);
 return Object.freeze({applied:true,schemaPath});
}
