import {mkdir,writeFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {runMarketIntelligenceBatch,DEFAULT_SCHEDULED_ASSETS} from './scheduled-batch.js';

const assets=(process.env.MI_ASSETS||DEFAULT_SCHEDULED_ASSETS.join(','))
 .split(',').map(x=>x.trim().toUpperCase()).filter(Boolean);
const output=resolve(process.env.MI_OUTPUT||'test-results/market-intelligence/latest.json');

const result=await runMarketIntelligenceBatch({assets});
await mkdir(dirname(output),{recursive:true});
await writeFile(output,JSON.stringify(result,null,2)+'\n','utf8');

const summary={
 output,
 assets:result.assets,
 successful:result.successful,
 failed:result.failed,
 finishedAt:new Date(result.finishedAt).toISOString()
};
console.log(JSON.stringify(summary));
if(!result.ok)process.exitCode=1;
