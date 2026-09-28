import {mkdir,copyFile,rm,writeFile} from 'node:fs/promises';
import {join} from 'node:path';

const src='internal/dex-intelligence',out='internal-preview';
await rm(out,{recursive:true,force:true});
await mkdir(join(out,'admin'),{recursive:true});

for(const file of [
 'venue-registry.js',
 'market-normalizer.js',
 'market-snapshot.js',
 'market-intelligence.js',
 'alert-engine.js',
 'bd-events.js',
 'trend-series.js',
 'market-metrics.js',
 'telemetry-history.js',
 'venue-research.js',
 'liquidity.js',
 'bd-matrix.js',
 'bd-pipeline.js',
 'commercial-model.js',
 'execution-qualification.js',
 'public-data.js',
 'server-history-client.js'
])await copyFile(join(src,file),join(out,file));

for(const file of ['index.html','app.js','style.css'])
 await copyFile(join(src,'admin',file),join(out,'admin',file));

await writeFile(join(out,'index.html'),'<!doctype html><meta charset="utf-8"><title>BELTRIX DEX Intelligence</title><script>location.replace("./admin/")</script><a href="./admin/">Open DEX Intelligence</a>');
