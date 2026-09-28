import test from 'node:test';
import assert from 'node:assert/strict';
import {persistAlertState} from '../alert-store.js';
import {persistBdEvents} from '../bd-event-store.js';

test('alert store resolves stale alerts and upserts active alerts',async()=>{
 const calls=[];
 const client={query:async(sql,args)=>{
  calls.push([sql,args]);
  if(sql.includes('select id,venue,alert_key'))return {rows:[{id:1,venue:'orderly',alert_key:'old'}]};
  return {rows:[]};
 }};
 const out=await persistAlertState(client,{
  asset:'btc',timestamp:1000,
  alerts:[{venue:'paradex',key:'latency',severity:'warning',message:'Slow',evidence:{latencyMs:900}}]
 });
 assert.equal(out.active,1);
 assert.ok(calls.some(([sql])=>sql.includes("set status='resolved'")));
 assert.ok(calls.some(([sql])=>sql.includes('insert into mi_alert_events')));
 assert.ok(calls.some(([,args])=>args?.includes('BTC')));
});

test('BD event store deduplicates through event_key conflict rule',async()=>{
 const calls=[];
 const client={query:async(sql,args)=>{calls.push([sql,args]);return {rows:[{id:5}]}}};
 const out=await persistBdEvents(client,[{
  asset:'ETH',venue:'orderly',eventType:'market-intelligence-alert',source:'market-intelligence',
  priority:'high',title:'Watch',detail:'Latency',timestamp:1000,evidence:{severity:'warning'}
 }]);
 assert.equal(out.inserted,1);
 assert.equal(calls.length,1);
 assert.match(calls[0][0],/on conflict \(event_key\)/);
 assert.match(calls[0][1][0],/ETH\|orderly\|market-intelligence-alert/);
});
