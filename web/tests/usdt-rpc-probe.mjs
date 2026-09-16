// Read-only public token metadata; no wallet, account balance, signing or broadcast.
import {writeFile,mkdir} from 'node:fs/promises';
import {USDT_ROUTES} from '../usdt-registry.js';
import {SOLANA_MAINNET_GENESIS} from '../usdt-solana.js';
const rows=[];let mismatches=0;
async function json(url,body){const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error('HTTP '+r.status);return r.json();}
for(const r of USDT_ROUTES){try{let decimals,identity;
 if(r.family==='evm'){
  const chain=await json(r.rpc,{jsonrpc:'2.0',id:1,method:'eth_chainId',params:[]});identity=Number(chain.result);if(identity!==r.chainId){if(chain.error)throw Error('RPC error: '+chain.error.message);throw Error('MISMATCH: network '+identity);}
  const token=await json(r.rpc,{jsonrpc:'2.0',id:2,method:'eth_call',params:[{to:r.token,data:'0x313ce567'},'latest']});if(!token.result)throw Error('No token decimals response');decimals=Number(BigInt(token.result));
 }else if(r.family==='tron'){
  const token=await json(r.rpc+'/wallet/triggerconstantcontract',{owner_address:r.token,contract_address:r.token,function_selector:'decimals()',visible:true});if(token.result?.result!==true||!token.constant_result?.[0])throw Error('TRON metadata unavailable');decimals=Number(BigInt('0x'+token.constant_result[0]));identity='TRON configured mainnet endpoint';
 }else{
  const genesis=await json(r.rpc,{jsonrpc:'2.0',id:1,method:'getGenesisHash',params:[]});identity=genesis.result;if(!identity)throw Error('No genesis response');if(identity!==SOLANA_MAINNET_GENESIS)throw Error('MISMATCH: Solana genesis '+identity);
  const token=await json(r.rpc,{jsonrpc:'2.0',id:2,method:'getAccountInfo',params:[r.token,{encoding:'base64',commitment:'finalized'}]});const value=token.result?.value;if(value?.owner!=='TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')throw Error('MISMATCH: Solana mint owner');const data=Buffer.from(value.data[0],'base64');if(data.length!==82||data[45]!==1)throw Error('MISMATCH: Solana mint state');decimals=data[44];
 }
 if(decimals!==r.decimals)throw Error('MISMATCH: token precision '+decimals);rows.push({route:r.id,result:'metadata verified',identity,token:r.token,decimals});
 }catch(e){const bad=String(e.message).startsWith('MISMATCH:');if(bad)mismatches++;rows.push({route:r.id,result:bad?'mismatch':'RPC unavailable',detail:String(e.message).slice(0,200)});}}
await mkdir('test-results',{recursive:true});await writeFile('test-results/usdt-public-metadata.json',JSON.stringify({checkedAt:new Date().toISOString(),scope:'Public metadata only; not a funded transfer or wallet integration test.',rows},null,2));console.log(JSON.stringify(rows,null,2));if(mismatches)throw Error('Public route identity mismatch');
