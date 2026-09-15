const base = new URL(process.argv[2]);
if (base.protocol !== 'https:') throw Error('Expected HTTPS deployment URL');
async function verify() {
  const response = await fetch(base, {cache:'no-store'});
  if (!response.ok) throw Error(`Page HTTP ${response.status}`);
  const html = await response.text();
  for (const marker of ['BELTRIX','tradeTwapMinutes','tradeLiveAck']) {
    if (!html.includes(marker)) throw Error(`Missing page marker: ${marker}`);
  }
  const assets = ['trading.bundle.js','wallet.bundle.js','market.js','terminal.css','beltrix-icon.png','manifest.webmanifest'];
  for (const asset of assets) {
    const r = await fetch(new URL(asset,base), {cache:'no-store'});
    if (!r.ok || (r.headers.get('content-type') || '').includes('text/html')) throw Error(`${asset}: invalid response ${r.status}`);
    if (!(await r.arrayBuffer()).byteLength) throw Error(`${asset}: empty response`);
  }
}
for (let attempt = 0; ; attempt++) {
  try { await verify(); break; }
  catch (error) { if (attempt === 3) throw error; await new Promise(resolve=>setTimeout(resolve,5000)); }
}
console.log(`BELTRIX page, TWAP controls and production assets verified at ${base}`);
