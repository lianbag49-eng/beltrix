import {writeFile} from 'node:fs/promises';
import {collectVenueTelemetry} from './collectors.mjs';

const ids=process.argv.slice(2).filter(Boolean);
const rows=await collectVenueTelemetry(ids.length?ids:undefined);
const result={generatedAt:new Date().toISOString(),rows};
const out=new URL('./snapshot.json',import.meta.url);
await writeFile(out,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
