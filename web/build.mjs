import {build} from 'esbuild';
for(const entry of ['trading','wallet'])await build({entryPoints:[`web/${entry}.js`],outfile:`web/${entry}.bundle.js`,bundle:true,format:'esm',target:'es2022',minify:true,legalComments:'eof'});
