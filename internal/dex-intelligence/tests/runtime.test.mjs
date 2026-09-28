import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {createNodeRequestHandler} from '../node-http-runtime.js';
import {validateMarketIntelligenceRuntimeEnv} from '../runtime-config.js';

function request(server,{method='GET',path='/',headers={},body=null}={}){
 return new Promise((resolve,reject)=>{
  const address=server.address();
  const req=http.request({host:'127.0.0.1',port:address.port,path,method,headers},res=>{
   const chunks=[];res.on('data',c=>chunks.push(c));res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:Buffer.concat(chunks).toString('utf8')}));
  });
  req.on('error',reject);
  if(body!==null)req.end(body);else req.end();
 });
}

test('runtime environment fails closed until DB and token are configured',()=>{
 const missing=validateMarketIntelligenceRuntimeEnv({});
 assert.equal(missing.ready,false);
 assert.ok(missing.issues.includes('MI_DATABASE_URL missing'));
 assert.ok(missing.issues.includes('MI_API_TOKEN missing'));
 const bad=validateMarketIntelligenceRuntimeEnv({MI_DATABASE_URL:'https://example.com',MI_API_TOKEN:'short'});
 assert.equal(bad.ready,false);
 const good=validateMarketIntelligenceRuntimeEnv({MI_DATABASE_URL:'postgresql://u:p@db.example/x',MI_API_TOKEN:'x'.repeat(32),PORT:'9000'});
 assert.equal(good.ready,true);
 assert.equal(good.port,9000);
});

test('dependency-free Node handler maps request and response without caching',async()=>{
 const api={handle:async req=>({status:200,headers:{'content-type':'application/json','cache-control':'no-store'},body:JSON.stringify({method:req.method,url:req.url,body:req.body})})};
 const server=http.createServer(createNodeRequestHandler(api));
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  const out=await request(server,{method:'PATCH',path:'/v1/alerts/7',headers:{'content-type':'application/json'},body:JSON.stringify({status:'resolved'})});
  assert.equal(out.status,200);
  const data=JSON.parse(out.body);
  assert.equal(data.method,'PATCH');
  assert.equal(data.url,'/v1/alerts/7');
  assert.deepEqual(data.body,{status:'resolved'});
  assert.equal(out.headers['cache-control'],'no-store');
 }finally{server.close()}
});

test('Node handler rejects invalid JSON before reaching the API',async()=>{
 let called=false;
 const server=http.createServer(createNodeRequestHandler({handle:async()=>{called=true;return {status:200,headers:{},body:'{}'}}}));
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  const out=await request(server,{method:'PATCH',path:'/x',headers:{'content-type':'application/json'},body:'{'});
  assert.equal(out.status,400);
  assert.equal(JSON.parse(out.body).error,'invalid_json');
  assert.equal(called,false);
 }finally{server.close()}
});
