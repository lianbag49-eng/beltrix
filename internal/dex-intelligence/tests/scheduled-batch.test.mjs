import test from 'node:test';
import assert from 'node:assert/strict';
import {runMarketIntelligenceBatch} from '../scheduled-batch.js';

test('scheduled batch isolates one asset failure and keeps successful snapshots',async()=>{
 const cycle=async asset=>{
  if(asset==='ETH')throw Error('fixture unavailable');
  return {
   snapshot:{asset,timestamp:1,venues:{}},
   alerts:[],
   bdEvents:[],
   intelligence:{rows:[]},
   persistence:null
  };
 };
 const result=await runMarketIntelligenceBatch({assets:['BTC','ETH','SOL'],cycle,now:123});
 assert.equal(result.ok,true);
 assert.equal(result.successful,2);
 assert.equal(result.failed,1);
 assert.equal(result.rows.find(x=>x.asset==='ETH').ok,false);
 assert.equal(result.rows.find(x=>x.asset==='BTC').snapshot.asset,'BTC');
});

test('scheduled batch reports failure when every asset fails',async()=>{
 const cycle=async()=>{throw Error('offline')};
 const result=await runMarketIntelligenceBatch({assets:['BTC','ETH'],cycle,now:123});
 assert.equal(result.ok,false);
 assert.equal(result.successful,0);
 assert.equal(result.failed,2);
});
