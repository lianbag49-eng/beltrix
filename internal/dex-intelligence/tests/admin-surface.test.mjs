import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';

test('Admin module remains valid JavaScript',()=>{
 const out=spawnSync(process.execPath,['--check','internal/dex-intelligence/admin/app.js'],{encoding:'utf8'});
 assert.equal(out.status,0,out.stderr||out.stdout);
});

test('Admin index exposes operations comparison execution and protocol surfaces',async()=>{
 const html=await readFile('internal/dex-intelligence/admin/index.html','utf8');
 for(const id of ['operations','compare','execution','protocol','opsSummary','qualityTable','venueCompareTable','routePlanResult','protocolLayers']){
  assert.match(html,new RegExp('id="'+id+'"'));
 }
});

test('preview build copies every new Admin dependency',async()=>{
 const src=await readFile('internal/dex-intelligence/build-preview.mjs','utf8');
 for(const file of ['operations-health.js','data-quality.js','venue-comparison.js','bd-intelligence.js','execution-router.js','protocol-core.js']){
  assert.ok(src.includes(file),file+' missing from preview build');
 }
});
