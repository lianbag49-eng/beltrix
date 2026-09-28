import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {batchToPostgresSql} from './postgres-sql-export.js';

const input=resolve(process.argv[2]||process.env.MI_OUTPUT||'test-results/market-intelligence/latest.json');
const output=resolve(process.argv[3]||'test-results/market-intelligence/persist.sql');
const batch=JSON.parse(await readFile(input,'utf8'));
const sql=batchToPostgresSql(batch);
await writeFile(output,sql,'utf8');
console.log(JSON.stringify({input,output,bytes:Buffer.byteLength(sql)}));
