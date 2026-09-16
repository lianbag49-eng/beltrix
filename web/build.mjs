import {build} from 'esbuild';
for (const entry of ['trading', 'wallet']) {
  const source = entry === 'wallet' ? 'wallet-entry' : 'trading-entry';
  await build({entryPoints:[`web/${source}.js`],outfile:`web/${entry}.bundle.js`,bundle:true,format:'esm',target:'es2022',minify:true,legalComments:'eof'});
}

await import('./tests/html-integrity.mjs');
