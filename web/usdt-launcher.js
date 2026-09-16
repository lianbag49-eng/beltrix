// Keep chain SDKs out of the initial trading/wallet bundle.
export function installUsdtLauncher(win=window){
 const doc=win.document;if(doc.getElementById('walletUsdtEntry'))return;
 const home=doc.getElementById('wallet');if(!home)return;
 const entry=doc.createElement('button');entry.id='walletUsdtEntry';entry.type='button';entry.className='w-secondary full';entry.dataset.usdtOpen='receive';entry.style.margin='0';entry.textContent='USDT wallet';entry.setAttribute('aria-label','USDT send and receive on eight networks');
 const actions=home.querySelector('.w-trading-buttons');if(actions){actions.style.gridTemplateColumns='repeat(3,minmax(0,1fr))';actions.append(entry);}else home.prepend(entry);
 for(const bar of doc.querySelectorAll('.funding-bar')){const b=doc.createElement('button');b.type='button';b.className='wallet';b.dataset.usdtOpen='send';b.textContent='USDT';b.setAttribute('aria-label','USDT multi-network wallet');bar.append(b);}
 const addChoice=()=>{const box=doc.querySelector('#fundingBody .funding-choices');if(!box||box.querySelector('[data-usdt-open]'))return;const b=doc.createElement('button');b.type='button';b.className='w-secondary';b.dataset.usdtOpen='receive';b.textContent='USDT · multi-network wallet';box.append(b);};
 const funding=doc.getElementById('fundingBody');if(funding)new win.MutationObserver(addChoice).observe(funding,{childList:true,subtree:true});
 let loader;
 doc.addEventListener('click',async e=>{
  const b=e.target.closest?.('button[data-usdt-open]');if(!b||b.disabled)return;b.disabled=true;
  try{loader||=import(new URL('./usdt.bundle.js',doc.baseURI).href);const module=await loader;doc.getElementById('fundingDialog')?.close();b.disabled=false;module.openUsdt(b.dataset.usdtOpen,b);}
  catch{loader=null;win.toast?.('USDT tools could not load. Refresh and try again.');}finally{b.disabled=false;}
 });
}
