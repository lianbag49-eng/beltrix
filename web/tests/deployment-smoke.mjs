const base = new URL(process.argv[2]);
if (base.protocol !== 'https:') throw Error('Expected HTTPS deployment URL');
async function verify() {
  const response = await fetch(base, {cache:'no-store'});
  if (!response.ok) throw Error(`Page HTTP ${response.status}`);
  const html = await response.text();
  for (const marker of ['BELTRIX','tradeTwapMinutes','tradeLiveAck','paperTopup','paperReview']) {
    if (!html.includes(marker)) throw Error(`Missing page marker: ${marker}`);
  }
  const assets = ['paper.js','paper-core.js','trading.bundle.js','wallet.bundle.js','market.js','terminal.css','beltrix-icon.png','manifest.webmanifest','mobile-futures.css'];
  for (const asset of assets) {
    const r = await fetch(new URL(asset,base), {cache:'no-store'});
    if (!r.ok || (r.headers.get('content-type') || '').includes('text/html')) throw Error(`${asset}: invalid response ${r.status}`);
    const bytes=await r.arrayBuffer();if(!bytes.byteLength)throw Error(`${asset}: empty response`);
    if(asset==='trading.bundle.js'&&!new TextDecoder().decode(bytes).includes('futuresSizePercent'))throw Error('Published trading bundle is missing futures V2');
  }
}
for (let attempt = 0; ; attempt++) {
  try { await verify(); break; }
  catch (error) { if (attempt === 3) throw error; await new Promise(resolve=>setTimeout(resolve,5000)); }
}
console.log(`BELTRIX page, TWAP controls and production assets verified at ${base}`);
