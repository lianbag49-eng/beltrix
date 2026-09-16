import {build} from 'esbuild';
import {mkdir,writeFile} from 'node:fs/promises';
for (const entry of ['trading', 'wallet', 'usdt']) {
  const result=await build({entryPoints:[`web/${entry}-entry.js`],outfile:`web/${entry}.bundle.js`,bundle:true,format:'esm',platform:'browser',target:'es2022',minify:true,legalComments:'eof',metafile:entry==='usdt',...(entry==='usdt'?{inject:['web/usdt-buffer.js']}: {})});
  if(entry==='usdt'){
    // Do not ship the vulnerable Node-only streaming RPC parser or native bigint addon.
    const unsafe=Object.keys(result.metafile.inputs).filter(p=>/node_modules\/(stream-json|bigint-buffer)\//.test(p));
    if(unsafe.length)throw Error('Unexpected unsafe browser dependency: '+unsafe.join(', '));
    await mkdir('test-results',{recursive:true});await writeFile('test-results/usdt-bundle-inputs.json',JSON.stringify(result.metafile,null,2));
  }
}
await import('./tests/html-integrity.mjs');
