import {hyperliquidFallbackText} from './hyperliquid-market-catalog.js';

const $=id=>document.getElementById(id);
const state={rows:[],selected:null};

function marketKey(row){return row?.value||row?.symbol||''}

function img(row,size=28){
 const wrap=document.createElement('span');wrap.className='hl-token-logo';wrap.style.setProperty('--logo-size',size+'px');
 const fallback=document.createElement('span');fallback.textContent=hyperliquidFallbackText(marketKey(row));wrap.append(fallback);
 if(row?.logo){
  const image=document.createElement('img');image.alt='';image.loading='lazy';image.referrerPolicy='no-referrer';
  image.src=row.logo;image.onload=()=>wrap.classList.add('loaded');image.onerror=()=>image.remove();wrap.append(image);
 }
 return wrap;
}

function selectedRow(){return state.rows.find(x=>marketKey(x)===$('marketSymbol').value)||state.rows[0]||null}

function syncButton(){
 const row=selectedRow();state.selected=row;
 const b=$('marketPickerButton');if(!b)return;
 b.replaceChildren();
 if(!row){b.textContent='Select market';return}
 b.append(img(row,24));
 const text=document.createElement('span');text.className='hl-market-picker-copy';
 const title=document.createElement('strong');title.textContent=row.base||row.value;
 const sub=document.createElement('small');sub.textContent=(row.name||row.base)+(row.spot?' · Spot':row.dex?' · '+row.dex+' · Perp':' · Perp');
 text.append(title,sub);b.append(text);
 const chevron=document.createElement('span');chevron.className='hl-market-picker-chevron';chevron.textContent='⌄';b.append(chevron);
}

function render(){
 const q=$('marketPickerSearch').value.trim().toLowerCase(),kind=$('marketType').value;
 const rows=state.rows.filter(row=>{
  if(row.spot!==(kind==='spot'))return false;
  if(!q)return true;
  return [row.value,row.base,row.name,row.dex].some(v=>String(v||'').toLowerCase().includes(q));
 });
 const box=$('marketPickerList');box.replaceChildren();
 const current=$('marketSymbol').value;
 for(const row of rows){
  const b=document.createElement('button');b.type='button';b.className='hl-market-row';b.dataset.value=marketKey(row);
  b.setAttribute('aria-selected',String(marketKey(row)===current));
  b.append(img(row,30));
  const copy=document.createElement('span');copy.className='hl-market-row-copy';
  const title=document.createElement('strong');title.textContent=row.base||row.value;
  const detail=document.createElement('small');detail.textContent=(row.name||row.base)+(row.dex?' · '+row.dex:'')+(row.spot?' · Spot':' · Perp');
  copy.append(title,detail);b.append(copy);
  if(Number.isFinite(Number(row.maxLeverage))&&!row.spot){const lev=document.createElement('span');lev.className='hl-market-leverage';lev.textContent=row.maxLeverage+'x';b.append(lev)}
  b.onclick=()=>{const s=$('marketSymbol');s.value=marketKey(row);s.dispatchEvent(new Event('change',{bubbles:true}));$('marketPickerDialog').close();syncButton();};
  box.append(b);
 }
 $('marketPickerEmpty').hidden=rows.length>0;
 $('marketPickerCount').textContent=rows.length+' markets';
}

export function installHyperliquidMarketPicker(){
 const select=$('marketSymbol');if(!select||$('marketPickerButton'))return;
 select.classList.add('hl-native-market-select');
 select.setAttribute('aria-hidden','true');select.tabIndex=-1;

 const button=document.createElement('button');button.type='button';button.id='marketPickerButton';button.className='select hl-market-picker-button';button.setAttribute('aria-haspopup','dialog');button.setAttribute('aria-label','Select Hyperliquid market');
 select.before(button);

 const dialog=document.createElement('dialog');dialog.id='marketPickerDialog';dialog.className='hl-market-dialog';
 dialog.innerHTML='<div class="hl-market-dialog-head"><div><strong>Hyperliquid markets</strong><small id="marketPickerCount">0 markets</small></div><button type="button" id="marketPickerClose" aria-label="Close">×</button></div><input id="marketPickerSearch" class="select" placeholder="Search BTC, ETH, HYPE…" autocomplete="off"><div id="marketPickerList" class="hl-market-list"></div><p id="marketPickerEmpty" class="muted" hidden>No matching markets.</p>';
 document.body.append(dialog);
 button.onclick=()=>{render();dialog.showModal();requestAnimationFrame(()=>$('marketPickerSearch').focus())};
 $('marketPickerClose').onclick=()=>dialog.close();
 $('marketPickerSearch').oninput=render;
 dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close()});
 select.addEventListener('change',syncButton);
 $('marketType').addEventListener('change',()=>{syncButton();if(dialog.open)render()});
 syncButton();
}

export function setHyperliquidMarketRows(rows){
 state.rows=Array.isArray(rows)?rows:[];
 syncButton();
 if($('marketPickerDialog')?.open)render();
}
