import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,join} from 'node:path';

const output=resolve(process.argv[2]||'public');
const commit=String(process.env.GITHUB_SHA||'');
const runId=String(process.env.GITHUB_RUN_ID||'');
const repository=String(process.env.GITHUB_REPOSITORY||'');
if(!/^[0-9a-f]{40}$/i.test(commit)||!/^\d+$/.test(runId)||repository!=='lianbag49-eng/beltrix'){
 throw Error('Release manifest requires the exact BELTRIX CI commit and run identity.');
}
const assets={};
for(const file of ['index.html','trading.bundle.js','wallet.bundle.js','usdt.bundle.js']){
 const bytes=await readFile(join(output,file));
 assets[file]={bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};
}
const manifest={
 schemaVersion:1,commit,runId,runAttempt:Number(process.env.GITHUB_RUN_ATTEMPT||1),
 builtAt:new Date().toISOString(),
 validationRun:'https://github.com/'+repository+'/actions/runs/'+runId,
 assets,
 scope:'Browser and unit validation; not proof of real-funds transfers or an independent security audit.'
};
await writeFile(join(output,'release-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log('Release manifest generated for '+commit);
