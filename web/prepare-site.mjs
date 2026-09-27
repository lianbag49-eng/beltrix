import {mkdir,copyFile,writeFile,readFile,access} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';

const source=dirname(fileURLToPath(import.meta.url));
const root=process.argv.includes('--root');
const out=root?'public':'public/beltrix';

await mkdir(out,{recursive:true});

const seedAssets=[
  'index.html','app.js','paper.js','paper-core.js','market.js',
  'market-picker.js','market-picker.css','asset-logo.js',
  'venue-adapter.js','hyperliquid-venue.js','orderly-venue.js',
  'attribution-core.js','attribution-client.js',
  'builder-config.js','builder-core.js',
  'chart-core.js','chart-ui.js','chart-studio.css',
  'terminal-clean.js','terminal-clean.css','terminal-core.js',
  'trading.bundle.js','wallet.bundle.js','usdt.bundle.js',
  'usdt.css','wallet.css','funding.css','terminal.css',
  'mobile-futures.css','trade-simple.css','futures-ux.js',
  'sw.js','icon.svg','beltrix-symbol.svg','beltrix-icon.png','manifest.webmanifest'
];

const patterns=[
  new RegExp("from\\s*['\"]\\./([^'\"]+)['\"]",'g'),
  new RegExp("import\\s*['\"]\\./([^'\"]+)['\"]",'g'),
  new RegExp("import\\(\\s*['\"]\\./([^'\"]+)['\"]\\s*\\)",'g')
];

const copied=new Set();
async function copyModule(name){
  if(copied.has(name))return;
  const src=join(source,name),dest=join(out,name);
  await access(src);
  await copyFile(src,dest);
  copied.add(name);
  if(!name.endsWith('.js'))return;
  const body=await readFile(src,'utf8');
  for(const re of patterns){
    re.lastIndex=0;
    for(const match of body.matchAll(re)){
      const dependency=match[1];
      await copyModule(dependency);
    }
  }
}

for(const name of seedAssets)await copyModule(name);

// Validate the exact public artifact after recursive module closure is copied.
for(const name of [...copied].filter(x=>x.endsWith('.js'))){
  const body=await readFile(join(out,name),'utf8');
  for(const re of patterns){
    re.lastIndex=0;
    for(const match of body.matchAll(re)){
      try{await access(join(out,match[1]))}
      catch{throw Error(`Static publish is missing ${match[1]}, imported by ${name}`)}
    }
  }
}

if(!root){
  await mkdir('public/web',{recursive:true});
  await writeFile(
    'public/web/index.html',
    '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>BELTRIX</title><body style="background:#08090b;color:#e6be72;font:18px system-ui;padding:40px"><p>BELTRIX has a new address.</p><a style="color:inherit" href="../beltrix/">Open BELTRIX</a><script>location.replace("../beltrix/"+location.search+location.hash)</script></body></html>'
  );
}
