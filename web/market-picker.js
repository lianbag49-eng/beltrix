import {applyHyperliquidLogo,hyperliquidLogoUrl,logoFallbackText} from './asset-logo.js';

const $=id=>document.getElementById(id);

function logoWrap(market,size='normal'){
 const wrap=document.createElement('span');
 wrap.className='asset-logo-wrap '+(size==='small'?'asset-logo-small':'');
 wrap.dataset.fallback=logoFallbackText(market);
 const img=document.createElement('img');
 img.loading='lazy';img.decoding='async';img.referrerPolicy='no-referrer';
 wrap.append(img);applyHyperliquidLogo(img,market);return wrap;
}

export function createMarketPicker(select){
 const button=$('marketPickerButton'),dialog=$('marketPickerDialog'),search=$('marketPickerSearch'),list=$('marketPickerList'),close=$('marketPickerClose');
 if(!select||!button||!dialog||!search||!list||!close)throw Error('Market picker controls are missing');
 let markets=[];

 function selected(){return markets.find(x=>x.value===select.value)||markets[0]||null}

 function sync(){
  const market=selected();
  const logo=$('marketPickerLogoWrap');
  logo.replaceChildren();
  if(market)logo.append(logoWrap(market));
  $('marketPickerSymbol').textContent=market?.displaySymbol||market?.base||market?.value||'Select market';
  $('marketPickerPair').textContent=market?market.label:'Hyperliquid market';
  button.disabled=!market;
 }

 function draw(){
  const query=search.value.trim().toLowerCase();
  list.replaceChildren();
  const rows=markets.filter(m=>!query||[m.value,m.label,m.base,m.quote,m.fullName,m.displaySymbol].some(v=>String(v||'').toLowerCase().includes(query)));
  for(const market of rows){
   const item=document.createElement('button');
   item.type='button';item.className='market-picker-row';
   item.dataset.market=market.value;
   item.setAttribute('aria-current',String(market.value===select.value));
   item.append(logoWrap(market,'small'));
   const copy=document.createElement('span');copy.className='market-picker-copy';
   const top=document.createElement('strong');top.textContent=market.displaySymbol||market.base||market.value;
   const bottom=document.createElement('small');const venue=market.hip3?(market.dexFullName||market.dex):'';bottom.textContent=[market.fullName&&market.fullName!==market.displaySymbol?market.fullName:null,venue,market.label].filter(Boolean).join(' · ');
   copy.append(top,bottom);item.append(copy);
   const tag=document.createElement('span');tag.className='market-picker-tag';tag.textContent=market.spot?'SPOT':market.hip3?'HIP-3':'PERP';item.append(tag);
   item.onclick=()=>{select.value=market.value;select.dispatchEvent(new Event('change',{bubbles:true}));dialog.close();};
   list.append(item);
  }
  $('marketPickerCount').textContent=rows.length+' / '+markets.length+' markets';
  if(!rows.length){const empty=document.createElement('p');empty.className='market-picker-empty';empty.textContent='No matching Hyperliquid markets.';list.append(empty);}
 }

 button.onclick=()=>{search.value='';draw();dialog.showModal();requestAnimationFrame(()=>search.focus())};
 close.onclick=()=>dialog.close();
 search.addEventListener('input',draw);
 dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close()});
 select.addEventListener('change',sync);

 return {
  update(next){markets=Array.isArray(next)?next:[];sync();},
  sync,
  logoFor(market){return hyperliquidLogoUrl(market)}
 };
}
