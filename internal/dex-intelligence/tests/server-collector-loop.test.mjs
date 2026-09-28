import test from 'node:test';
import assert from 'node:assert/strict';
import {createServerCollectorLoop} from '../server-collector-loop.js';

test('server collector persists each asset snapshot and one run summary',async()=>{
 const saved=[],queries=[];
 const repository={save:async snap=>{saved.push(snap);return {snapshotId:saved.length}}};
 const queryClient={query:async(sql,args)=>{queries.push([sql,args]);if(sql.includes('select id,venue,alert_key'))return {rows:[]};if(sql.includes('insert into mi_collector_runs'))return {rows:[{id:99}]};return {rows:[]}}};
 const cycle=async(asset,{repository})=>{
  const snapshot={asset,timestamp:1000,venues:{}};
  const persistence=await repository.save(snapshot);
  return {snapshot,persistence,alerts:[],bdEvents:[]};
 };
 const loop=createServerCollectorLoop({
  repository,queryClient,assets:['BTC','ETH','SOL'],cycle,
  now:(()=>{let n=1000;return()=>n+=100})()
 });
 const result=await loop.run();
 assert.equal(result.successful,3);
 assert.equal(result.failed,0);
 assert.deepEqual(saved.map(x=>x.asset),['BTC','ETH','SOL']);
 assert.ok(queries.some(([sql])=>sql.includes('insert into mi_collector_runs')));
 assert.ok(queries.some(([sql])=>sql.includes('select id,venue,alert_key')));
});

test('server collector isolates one asset failure and still records run',async()=>{
 const repository={save:async()=>({snapshotId:1})};
 const queryClient={query:async sql=>sql.includes('select id,venue,alert_key')?{rows:[]}:{rows:[{id:1}]}};
 const cycle=async asset=>{if(asset==='ETH')throw Error('fixture offline');return {alerts:[],bdEvents:[],persistence:{snapshotId:1}}};
 const loop=createServerCollectorLoop({repository,queryClient,assets:['BTC','ETH','SOL'],cycle});
 const out=await loop.run();
 assert.equal(out.successful,2);
 assert.equal(out.failed,1);
 assert.equal(out.rows.find(x=>x.asset==='ETH').ok,false);
});

test('collector start schedules recurring work and stop prevents new schedules',async()=>{
 let cycles=0;
 const repository={save:async()=>({})};
 const queryClient={query:async sql=>sql.includes('select id,venue,alert_key')?{rows:[]}:{rows:[{id:1}]}};
 const cycle=async()=>{cycles++;return {alerts:[],bdEvents:[]}};
 const loop=createServerCollectorLoop({repository,queryClient,assets:['BTC'],cycle,intervalMs:60000});
 loop.start({immediate:true});
 await new Promise(resolve=>setTimeout(resolve,10));
 assert.equal(cycles,1);
 loop.stop();
 assert.equal(loop.status().stopped,true);
});
