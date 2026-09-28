import {createServer} from 'node:http';

const MAX_BODY_BYTES=16*1024;

async function readJson(req){
 if(req.method==='GET'||req.method==='HEAD')return null;
 let bytes=0;const chunks=[];
 for await(const chunk of req){
  bytes+=chunk.length;
  if(bytes>MAX_BODY_BYTES)throw Object.assign(Error('request_too_large'),{statusCode:413});
  chunks.push(chunk);
 }
 if(!chunks.length)return {};
 try{return JSON.parse(Buffer.concat(chunks).toString('utf8'))}
 catch{throw Object.assign(Error('invalid_json'),{statusCode:400})}
}

export function createNodeRequestHandler(api){
 if(!api||typeof api.handle!=='function')throw Error('Node runtime requires Market Intelligence API');
 return async function handler(req,res){
  try{
   const body=await readJson(req);
   const result=await api.handle({
    method:req.method,
    url:req.url,
    headers:req.headers,
    body
   });
   res.statusCode=result.status;
   for(const [key,value] of Object.entries(result.headers||{}))res.setHeader(key,value);
   res.end(result.body);
  }catch(error){
   const status=Number(error?.statusCode)||500;
   res.statusCode=status;
   res.setHeader('content-type','application/json; charset=utf-8');
   res.setHeader('cache-control','no-store');
   res.end(JSON.stringify({error:status===500?'internal_error':String(error?.message||'request_failed')}));
  }
 };
}

export function createMarketIntelligenceHttpServer(api){
 return createServer(createNodeRequestHandler(api));
}

export function listen(server,{port=Number(process.env.PORT)||8788,host=process.env.HOST||'127.0.0.1'}={}){
 if(!server||typeof server.listen!=='function')throw Error('Invalid HTTP server');
 return new Promise((resolve,reject)=>{
  server.once('error',reject);
  server.listen(port,host,()=>{
   server.off('error',reject);
   const address=server.address();
   resolve(Object.freeze({host,address:typeof address==='object'?address.address:host,port:typeof address==='object'?address.port:port}));
  });
 });
}
