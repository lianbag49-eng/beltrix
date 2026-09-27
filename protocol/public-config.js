import {createHash} from 'node:crypto';

const FORBIDDEN_KEY=/private|secret|seed|mnemonic|password|api[-_]?key|token/i;

function clean(value,max=128){
 return String(value??'').trim().slice(0,max);
}

function stable(value){
 if(Array.isArray(value))return value.map(stable);
 if(value&&typeof value==='object'){
  return Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])]));
 }
 return value;
}

function assertPublicSafe(value,path='root'){
 if(Array.isArray(value)){value.forEach((v,i)=>assertPublicSafe(v,path+'['+i+']'));return}
 if(!value||typeof value!=='object')return;
 for(const [key,val] of Object.entries(value)){
  if(FORBIDDEN_KEY.test(key))throw Error('Public config contains forbidden secret-like key at '+path+'.'+key);
  assertPublicSafe(val,path+'.'+key);
 }
}

export function canonicalPublicConfig(input={}){
 const revision=Number(input.revision??0);
 if(!Number.isInteger(revision)||revision<0)throw Error('Public config revision must be a non-negative integer');
 const network=clean(input.network||'unassigned',64).toLowerCase();
 const stage=clean(input.stage||'bootstrap',32).toLowerCase();

 const config={
  protocol:'beltrix',
  schemaVersion:1,
  revision,
  network,
  stage,
  ownership:input.ownership?stable(input.ownership):null,
  governance:input.governance?stable(input.governance):null,
  oracle:input.oracle?stable(input.oracle):null,
  markets:Array.isArray(input.markets)?input.markets.map(stable):[],
  settlements:Array.isArray(input.settlements)?input.settlements.map(stable):[],
  generatedAt:input.generatedAt?new Date(input.generatedAt).toISOString():new Date(0).toISOString()
 };
 assertPublicSafe(config);
 return Object.freeze(config);
}

export function stablePublicConfigJson(config){
 const normalized=stable(canonicalPublicConfig(config));
 return JSON.stringify(normalized);
}

export function publicConfigFingerprint(config){
 const json=stablePublicConfigJson(config);
 return 'sha256:'+createHash('sha256').update(json).digest('hex');
}

export function buildDisclosureBundle(input={}){
 const config=canonicalPublicConfig(input);
 return Object.freeze({
  config,
  fingerprint:publicConfigFingerprint(config),
  disclosure:Object.freeze({
   containsPrivateKeys:false,
   containsSecrets:false,
   purpose:'Publicly verifiable BELTRIX protocol configuration metadata'
  })
 });
}
