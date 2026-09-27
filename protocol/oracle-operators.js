import {recoverMessageAddress,getAddress,isAddress} from 'viem';
import {oracleConsensus} from './oracle.js';

const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const addr=value=>{
 const s=String(value||'').trim();
 if(!isAddress(s,{strict:true}))throw Error('Oracle operator must be a valid EVM address');
 return getAddress(s);
};

export function defineOracleOperatorSet({operators=[],quorum=2}={}){
 const rows=[];
 const seen=new Set();
 for(const input of operators){
  const address=addr(input.address);
  const key=address.toLowerCase();
  if(seen.has(key))throw Error('Duplicate oracle operator: '+address);
  seen.add(key);
  const weight=Number(input.weight??1);
  if(!Number.isInteger(weight)||weight<1)throw Error('Oracle operator weight must be a positive integer');
  rows.push(Object.freeze({address,weight,enabled:input.enabled!==false,label:String(input.label||'').trim()||address.slice(0,10)}));
 }
 const q=Number(quorum);
 if(!Number.isInteger(q)||q<1||q>rows.filter(x=>x.enabled).length)throw Error('Invalid oracle operator quorum');
 return Object.freeze({operators:Object.freeze(rows),quorum:q});
}

export function oracleObservationMessage(input={}){
 const market=String(input.market||'').trim().toUpperCase();
 const operator=addr(input.operator);
 const price=Number(input.price);
 const timestamp=Number(input.timestamp);
 const nonce=Number(input.nonce);
 if(!market)throw Error('Oracle market is required');
 if(!finite(price)||price<=0)throw Error('Oracle price must be positive');
 if(!Number.isInteger(timestamp)||timestamp<=0)throw Error('Oracle timestamp must be a positive integer');
 if(!Number.isInteger(nonce)||nonce<0)throw Error('Oracle nonce must be a non-negative integer');
 return [
  'BELTRIX_ORACLE_V1',
  'market='+market,
  'operator='+operator.toLowerCase(),
  'price='+String(price),
  'timestamp='+String(timestamp),
  'nonce='+String(nonce)
 ].join('\n');
}

export async function verifyOperatorObservation(input,operatorSet){
 const operator=addr(input.operator);
 const row=operatorSet?.operators?.find(x=>x.address.toLowerCase()===operator.toLowerCase()&&x.enabled);
 if(!row)throw Error('Oracle operator is not enabled');
 const signature=String(input.signature||'');
 if(!/^0x[0-9a-fA-F]{130}$/.test(signature))throw Error('Oracle signature must be a 65-byte hex signature');
 const message=oracleObservationMessage(input);
 const recovered=await recoverMessageAddress({message,signature});
 if(recovered.toLowerCase()!==operator.toLowerCase())throw Error('Oracle signature does not match operator');
 return Object.freeze({
  operator,
  label:row.label,
  weight:row.weight,
  market:String(input.market).trim().toUpperCase(),
  price:Number(input.price),
  timestamp:Number(input.timestamp),
  nonce:Number(input.nonce),
  signature
 });
}

export async function oracleOperatorConsensus(signedObservations,{operatorSet,now=Date.now(),maxAgeMs=15000,maxDeviationBps=100}={}){
 if(!operatorSet)throw Error('Oracle operator set is required');
 const verified=[];
 for(const raw of signedObservations||[]){
  try{verified.push(await verifyOperatorObservation(raw,operatorSet))}catch{}
 }
 const latest=new Map();
 for(const row of verified){
  const key=row.operator.toLowerCase();
  const prior=latest.get(key);
  if(!prior||row.nonce>prior.nonce||row.nonce===prior.nonce&&row.timestamp>prior.timestamp)latest.set(key,row);
 }
 const fresh=[...latest.values()].filter(x=>Number(now)-x.timestamp<=Number(maxAgeMs));
 const distinct=fresh.length;
 if(distinct<operatorSet.quorum){
  return Object.freeze({ok:false,price:null,operators:Object.freeze(fresh),reasons:Object.freeze(['operator-quorum'])});
 }
 const consensus=oracleConsensus(fresh.map(x=>({source:x.operator,price:x.price,timestamp:x.timestamp})),{
  now,maxAgeMs,minSources:operatorSet.quorum,maxDeviationBps
 });
 return Object.freeze({
  ok:consensus.ok,
  price:consensus.price,
  operators:Object.freeze(fresh),
  worstDeviationBps:consensus.worstDeviationBps??null,
  reasons:Object.freeze(consensus.reasons||[])
 });
}
