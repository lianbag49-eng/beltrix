import {createHash} from 'node:crypto';
const base=new URL(process.argv[2]);
const expected=String(process.env.GITHUB_SHA||'');
if(base.protocol!=='https:'||base.hostname!=='lianbag49-eng.github.io'||!/^\w{40}$/.test(expected)){
 throw Error('Expected the configured public BELTRIX site and a CI commit.');
}
const url=file=>{const u=new URL(file,base);u.searchParams.set('release',expected);return u};
async function read(file){
 const res=await fetch(url(file),{cache:'no-store',signal:AbortSignal.timeout(20000)});
 if(!res.ok)throw Error(file+' HTTP '+res.status);
 return Buffer.from(await res.arrayBuffer());
}
let failure;
for(let attempt=0;attempt<4;attempt++){
 try{
  const manifest=JSON.parse((await read('release-manifest.json')).toString('utf8'));
  if(manifest.commit!==expected)throw Error('Public release revision does not match the validated commit.');
  for(const file of ['index.html','trading.bundle.js','wallet.bundle.js','usdt.bundle.js']){
   const bytes=await read(file),expectedAsset=manifest.assets?.[file];
   if(!expectedAsset||bytes.length!==expectedAsset.bytes||createHash('sha256').update(bytes).digest('hex')!==expectedAsset.sha256){
    throw Error('Published asset mismatch: '+file);
   }
  }
  console.log(JSON.stringify({ok:true,commit:expected,runId:manifest.runId,checkedAssets:4,mode:'public-read-only'}));
  failure=null;break;
 }catch(error){failure=error;if(attempt<3)await new Promise(resolve=>setTimeout(resolve,3000));}
}
if(failure)throw failure;
