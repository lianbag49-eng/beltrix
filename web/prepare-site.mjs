import {mkdir,copyFile,writeFile,readFile,access} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';

const source=dirname(fileURLToPath(import.meta.url));
const root=process.argv.includes('--root');
const out=root?'public':'public/beltrix';
await mkdir(out,{recursive:true});

const assets=[
 'index.html','app.js','paper.js','paper-core.js','market.js',
 'attribution-core.js','attribution-client.js','growth-delivery.js','growth-regions.js','compliance-core.js',
 'builder-config.js','builder-core.js','chart-core.js','chart-ui.js','chart-studio.css',
 'terminal-clean.js','terminal-clean.css','terminal-core.js',
 'trading.bundle.js','wallet.bundle.js','usdt.bundle.js',
 'usdt.css','wallet.css','funding.css','terminal.css','mobile-futures.css','trade-simple.css','futures-ux.js',
 'sw.js','icon.svg','beltrix-symbol.svg','beltrix-icon.png','manifest.webmanifest'
];

const copied=new Set();
async function copyAsset(name){
 if(copied.has(name))return;
 await copyFile(join(source,name),join(out,name));
 copied.add(name);
 if(!name.endsWith('.js'))return;
 const body=await readFile(join(source,name),'utf8');
 const specs=[];
 for(const re of [/\bfrom\s*['"]\.\/([^'"]+)['"]/g,/\bimport\s*['"]\.\/([^'"]+)['"]/g,/\bimport\(\s*['"]\.\/([^'"]+)['"]\s*\)/g]){
  for(const match of body.matchAll(re))specs.push(match[1]);
 }
 for(const spec of specs){
  try{await access(join(source,spec))}catch{throw Error('Source module missing: '+spec+', imported by '+name)}
  await copyAsset(spec);
 }
}
for(const name of assets)await copyAsset(name);

for(const name of [...copied].filter(x=>x.endsWith('.js'))){
 const body=await readFile(join(out,name),'utf8');
 for(const re of [/\bfrom\s*['"]\.\/([^'"]+)['"]/g,/\bimport\s*['"]\.\/([^'"]+)['"]/g,/\bimport\(\s*['"]\.\/([^'"]+)['"]\s*\)/g]){
  for(const match of body.matchAll(re)){
   try{await access(join(out,match[1]))}catch{throw Error('Static publish is missing '+match[1]+', imported by '+name)}
  }
 }
}

if(!root){
 await mkdir('public/web',{recursive:true});
 await writeFile('public/web/index.html','<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>BELTRIX</title><body style="background:#08090b;color:#e6be72;font:18px system-ui;padding:40px"><p>BELTRIX has a new address.</p><a style="color:inherit" href="../beltrix/">Open BELTRIX</a><script>location.replace("../beltrix/"+location.search+location.hash)</script></body></html>');
}