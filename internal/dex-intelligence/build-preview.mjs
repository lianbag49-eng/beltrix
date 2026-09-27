import {mkdir,copyFile,rm} from 'node:fs/promises';
import {join} from 'node:path';

const src='internal/dex-intelligence',out='internal-preview';
await rm(out,{recursive:true,force:true});
await mkdir(join(out,'admin'),{recursive:true});

for(const file of [
 'venue-registry.js',
 'liquidity.js',
 'bd-matrix.js',
 'bd-pipeline.js',
 'commercial-model.js',
 'execution-qualification.js',
 'public-data.js'
])await copyFile(join(src,file),join(out,file));

for(const file of ['index.html','app.js','style.css'])
 await copyFile(join(src,'admin',file),join(out,'admin',file));
