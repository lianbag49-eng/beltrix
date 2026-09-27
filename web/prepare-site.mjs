import {mkdir,copyFile,writeFile,readFile,access} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
const source=dirname(fileURLToPath(import.meta.url)),root=process.argv.includes('--root'),out=root?'public':'public/beltrix';
await mkdir(out,{recursive:true});
const assets=[
 'index.html',
 'app.js',
 'paper.js',
 'paper-core.js',
 'market.js',
 'market-venue-service.js',
 'venue-adapter.js',
 'hyperliquid-venue.js',
 'orderly-venue.js',
 'gmx-venue.js',
 'paradex-venue.js',
 'attribution-core.js',
 'attribution-client.js',
 'growth-delivery.js',
 'growth-regions.js',
 'compliance-core.js',
 'builder-config.js',
 'builder-core.js',
 'chart-core.js',
 'chart-ui.js',
 'chart-studio.css',
 'terminal-clean.js',
 'terminal-clean.css',
 'terminal-core.js',
 'trading.bundle.js',
 'wallet.bundle.js',
 'usdt.bundle.js',
 'usdt.css',
 'wallet.css',
 'funding.css',
 'terminal.css',
 'mobile-futures.css',
 'trade-simple.css',
 'futures-ux.js',
 'sw.js',
 'icon.svg',
 'beltrix-symbol.svg',
 'beltrix-icon.png',
 'manifest.webmanifest'
];
for(const name of assets)await copyFile(join(source,name),join(out,name));

// Validate the exact static artifact, not just the source tree. Any relative module
// import omitted from the publish bundle must fail the build before deployment.
for(const name of assets.filter(x=>x.endsWith('.js'))){
 const body=await readFile(join(out,name),'utf8');
 const specs=[];
 for(const re of [/\bfrom\s*['"]\.\/([^'"]+)['"]/g,/\bimport\s*['"]\.\/([^'"]+)['"]/g,/\bimport\(\s*['"]\.\/([^'"]+)['"]\s*\)/g]){
  for(const match of body.matchAll(re))specs.push(match[1]);
 }
 for(const spec of specs){
  const target=join(out,spec);
  try{await access(target)}catch{throw Error(`Static publish is missing ${spec}, imported by ${name}`)}
 }
}
if(!root){await mkdir('public/web',{recursive:true});await writeFile('public/web/index.html','<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>BELTRIX</title><body style="background:#08090b;color:#e6be72;font:18px system-ui;padding:40px"><p>BELTRIX has a new address.</p><a style="color:inherit" href="../beltrix/">Open BELTRIX</a><script>location.replace("../beltrix/"+location.search+location.hash)</script></body></html>');}
