import {normalizeTheme,nextTheme,THEME_STORAGE_KEY,themeMetaColor} from './ui-theme-core.js';

const $=id=>document.getElementById(id);
const root=document.documentElement;
const app=document.querySelector('.app');
if(!app)throw Error('BELTRIX app root unavailable');

root.dataset.beltrixUi='pearl-cobalt';

const css=document.createElement('link');
css.rel='stylesheet';
css.href=new URL('./pearl-cobalt.css',import.meta.url).href;
css.id='pearlCobaltStyles';
document.head.append(css);

function readTheme(){
 try{return normalizeTheme(localStorage.getItem(THEME_STORAGE_KEY))}catch{return 'light'}
}
function applyTheme(theme,{persist=true}={}){
 const value=normalizeTheme(theme);
 root.dataset.theme=value;
 root.style.colorScheme=value;
 const meta=document.querySelector('meta[name="theme-color"]');
 if(meta)meta.content=themeMetaColor(value);
 if(persist)try{localStorage.setItem(THEME_STORAGE_KEY,value)}catch{}
 const toggle=$('pcThemeToggle');
 if(toggle){
  toggle.setAttribute('aria-pressed',String(value==='dark'));
  toggle.setAttribute('aria-label',value==='dark'?'Switch to light mode':'Switch to dark mode');
  toggle.innerHTML=value==='dark'
   ?'<span aria-hidden="true">☀</span><span>Light</span>'
   :'<span aria-hidden="true">◐</span><span>Dark</span>';
 }
 window.dispatchEvent(new CustomEvent('beltrix:theme',{detail:{theme:value}}));
 window.dispatchEvent(new Event('resize'));
}
applyTheme(readTheme(),{persist:false});

function node(tag,cls,html=''){
 const el=document.createElement(tag);el.className=cls;el.innerHTML=html;return el;
}
function safeText(id,fallback='—'){return ($(id)?.textContent||fallback).trim()||fallback}
function currentSymbol(){
 return safeText('marketPickerSymbol',safeText('marketSymbol','Market')).replace(/\s+/g,' ');
}
function activateMarket(value){
 const select=$('marketSymbol');
 if(!select||select.disabled)return;
 const option=[...select.options].find(o=>o.value===value);
 if(!option)return;
 select.value=value;
 select.dispatchEvent(new Event('change',{bubbles:true}));
}
function openMarketPicker(){
 const button=$('marketPickerButton');
 if(button&&!button.disabled){button.click();return}
 const dialog=$('marketPickerDialog');
 if(dialog?.showModal)dialog.showModal();
}
function scrollToElement(el){
 el?.scrollIntoView({behavior:'smooth',block:'start'});
}
function syncThemeToggle(){
 if(!$('pcThemeToggle'))return;
 applyTheme(root.dataset.theme||'light',{persist:false});
}

function mountHeader(){
 if($('pcThemeToggle'))return;
 const top=document.querySelector('.top');
 const brand=top?.querySelector('.brand');
 if(!top||!brand)return;
 const brandSub=brand.querySelector('small');
 if(brandSub)brandSub.textContent='DECENTRALIZED DERIVATIVES';

 const nav=node('div','pc-header-nav');
 nav.setAttribute('role','group');nav.setAttribute('aria-label','Pearl Cobalt product shortcuts');
 const items=[
  ['Trade',()=>scrollToElement(document.querySelector('.chart-panel'))],
  ['Markets',openMarketPicker],
  ['Portfolio',()=>scrollToElement(document.querySelector('.terminal-account'))],
  ['Protocol',()=>scrollToElement($('pcProtocolCard'))],
  ['Intelligence',()=>scrollToElement($('pcIntelligenceStrip'))]
 ];
 for(const item of items){
  const b=node('button','pc-header-link',item[0]);b.type='button';b.setAttribute('aria-label','Open '+item[0]+' section');b.onclick=item[1];nav.append(b);
 }
 brand.after(nav);

 const search=node('button','pc-market-search','<span aria-hidden="true">⌕</span><span>Search markets</span><kbd>⌘K</kbd>');
 search.type='button';search.onclick=openMarketPicker;
 const theme=node('button','pc-theme-toggle');theme.type='button';theme.id='pcThemeToggle';
 theme.onclick=()=>applyTheme(nextTheme(root.dataset.theme));
 const walletProvider=$('walletProvider');
 top.insertBefore(search,walletProvider||null);
 top.insertBefore(theme,walletProvider||null);
 syncThemeToggle();

 document.addEventListener('keydown',e=>{
  if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){
   if(['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName))return;
   e.preventDefault();openMarketPicker();
  }
 });
}

function marketOptions(){
 const select=$('marketSymbol');
 if(!select)return [];
 return [...select.options].filter(o=>o.value).slice(0,12).map(o=>({
  value:o.value,
  label:(o.textContent||o.value).trim()
 }));
}
function renderWatchlist(sidebar){
 const list=sidebar?.querySelector('.pc-watchlist-list');if(!list)return;
 const rows=marketOptions();
 const active=$('marketSymbol')?.value;
 list.replaceChildren();
 for(const row of rows){
  const b=node('button','pc-market-row');
  b.type='button';b.dataset.marketValue=row.value;b.setAttribute('aria-current',String(row.value===active));
  const base=row.label.replace(/\s*\/.*$/,'').replace(/-PERP$/i,'').split(':').pop();
  b.innerHTML='<span class="pc-coin">'+(base||'?').slice(0,3)+'</span><span><strong>'+row.label+'</strong><small>Perpetual market</small></span><span class="pc-row-arrow">›</span>';
  b.onclick=()=>activateMarket(row.value);
  list.append(b);
 }
 if(!rows.length)list.innerHTML='<p class="pc-empty">Markets are loading…</p>';
}

function marketBase(label){
 return String(label||'').replace(/\s*\/.*$/,'').replace(/-PERP$/i,'').split(':').pop()||'MKT';
}
function renderMarketRibbon(){
 const ribbon=$('pcMarketRibbon');if(!ribbon)return;
 const rows=marketOptions().slice(0,3),active=$('marketSymbol')?.value;
 const currentMark=safeText('marketMark');
 const currentChange=safeText('marketChange');
 const cards=rows.map((row,index)=>{
  const selected=row.value===active;
  const base=marketBase(row.label);
  const metric=selected
   ?'<strong>'+currentMark+'</strong><small class="'+($('marketChange')?.className||'')+'">'+currentChange+'</small>'
   :'<strong>'+row.label+'</strong><small>Open market</small>';
  return '<button type="button" class="pc-ribbon-market" data-pc-market="'+row.value+'" aria-current="'+String(selected)+'"><span class="pc-ribbon-coin">'+base.slice(0,3)+'</span><span>'+metric+'</span><span class="pc-ribbon-arrow">↗</span></button>';
 }).join('');
 ribbon.innerHTML=cards+'<button type="button" class="pc-ribbon-add" data-pc-ribbon-add><span>＋</span><strong>Add market</strong><small>Browse all markets</small></button>';
 for(const button of ribbon.querySelectorAll('[data-pc-market]'))button.onclick=()=>activateMarket(button.dataset.pcMarket);
 ribbon.querySelector('[data-pc-ribbon-add]')?.addEventListener('click',openMarketPicker);
}
function mountMarketRibbon(){
 if($('pcMarketRibbon'))return;
 const root=$('markets'),card=root?.querySelector('.market-card');
 if(!root||!card)return;
 const ribbon=node('section','pc-market-ribbon');ribbon.id='pcMarketRibbon';
 card.before(ribbon);renderMarketRibbon();
}
function mountIntelligenceStrip(){
 if($('pcIntelligenceStrip'))return;
 const account=document.querySelector('.terminal-account');
 if(!account)return;
 const strip=node('section','pc-intelligence-strip',[
  '<div class="pc-strip-head"><span class="pc-icon">▧</span><strong>Protocol &amp; Market Intelligence</strong><span>Live market telemetry</span></div>',
  '<div class="pc-strip-grid">',
  '<article><small>Funding rate</small><strong data-pc-strip="funding">—</strong><span>Current market</span></article>',
  '<article><small>Open interest</small><strong data-pc-strip="oi">—</strong><span>Venue-reported</span></article>',
  '<article><small>24h volume</small><strong data-pc-strip="volume">—</strong><span>Notional activity</span></article>',
  '<article><small>Oracle status</small><strong class="green">Healthy</strong><span>Live market feed</span></article>',
  '<article><small>Protocol risk</small><strong>Guarded</strong><span>Wallet review required</span></article>',
  '</div>'
 ].join(''));
 strip.id='pcIntelligenceStrip';account.before(strip);
}
function syncIntelligenceStrip(){
 const strip=$('pcIntelligenceStrip');if(!strip)return;
 const map={funding:'marketFunding',oi:'marketOI',volume:'marketVolume'};
 for(const [key,id] of Object.entries(map)){
  const target=strip.querySelector('[data-pc-strip="'+key+'"]');
  if(target)target.textContent=safeText(id);
 }
}

function mountSidebar(){
 if($('pcSidebar'))return;
 const sidebarHtml=[
  '<div class="pc-rail-nav">',
  '<button type="button" data-pc-action="dashboard" class="active" aria-label="Open dashboard"><span>⌂</span>Dashboard</button>',
  '<button type="button" data-pc-action="markets" aria-label="Open market selector"><span>◈</span>Markets</button>',
  '<button type="button" data-pc-action="trade" aria-label="Open trading workspace"><span>⇄</span>Trade</button>',
  '<button type="button" data-pc-action="protocol" aria-label="Open protocol overview"><span>⬡</span>Protocol</button>',
  '<button type="button" data-pc-action="analytics" aria-label="Open market intelligence"><span>⌁</span>Intelligence</button>',
  '<button type="button" data-pc-action="portfolio" aria-label="Open trading portfolio"><span>▣</span>Portfolio</button>',
  '<button type="button" data-pc-action="governance" aria-label="Open governance overview"><span>◇</span>Governance</button>',
  '<button type="button" data-pc-action="settings" aria-label="Open settings"><span>⚙</span>Settings</button>',
  '</div>',
  '<section class="pc-watchlist">',
  '<header><div><small>MARKETS</small><strong>Watchlist</strong></div><button type="button" data-pc-add-market aria-label="Open market selector">+</button></header>',
  '<div class="pc-watchlist-list"></div>',
  '</section>',
  '<section class="pc-brand-note"><strong>Open markets.<br>Higher standards.</strong><p>Self-custodial trading with BELTRIX protocol controls.</p></section>'
 ].join('');
 const sidebar=node('aside','pc-sidebar',sidebarHtml);
 sidebar.id='pcSidebar';
 const top=document.querySelector('.top');
 top.after(sidebar);
 sidebar.querySelector('[data-pc-add-market]').onclick=openMarketPicker;
 sidebar.querySelector('[data-pc-action="dashboard"]').onclick=()=>scrollToElement($('pcMarketRibbon'));
 sidebar.querySelector('[data-pc-action="trade"]').onclick=()=>scrollToElement(document.querySelector('.chart-panel'));
 sidebar.querySelector('[data-pc-action="markets"]').onclick=openMarketPicker;
 sidebar.querySelector('[data-pc-action="portfolio"]').onclick=()=>scrollToElement(document.querySelector('.terminal-account'));
 sidebar.querySelector('[data-pc-action="analytics"]').onclick=()=>scrollToElement($('pcIntelligenceStrip'));
 sidebar.querySelector('[data-pc-action="protocol"]').onclick=()=>scrollToElement($('pcProtocolCard'));
 sidebar.querySelector('[data-pc-action="governance"]').onclick=()=>scrollToElement($('pcProtocolCard'));
 sidebar.querySelector('[data-pc-action="settings"]').onclick=()=>window.openPage?.('settings');
 renderWatchlist(sidebar);
}

function mountRightRail(){
 if($('pcRightRail'))return;
 const railHtml=[
  '<section class="pc-insight-card pc-protocol-card" id="pcProtocolCard">',
  '<div class="pc-card-kicker"><span class="pc-icon">⬡</span><span>Protocol Overview</span><span class="pc-live-pill">BOOTSTRAP</span></div>',
  '<h2>Own the policy.<br>Keep settlement modular.</h2>',
  '<p>BELTRIX defines market identity, intent, oracle policy and risk controls. Hyperliquid is the current settlement substrate.</p>',
  '<div class="pc-protocol-grid">',
  '<div><small>Market registry</small><strong>BTC · ETH · SOL</strong></div>',
  '<div><small>Custody</small><strong>Self-custody</strong></div>',
  '<div><small>Settlement</small><strong>Hyperliquid</strong></div>',
  '<div><small>Native layer</small><strong>Research</strong></div>',
  '</div></section>',
  '<section class="pc-insight-card" id="pcMarketIntel">',
  '<div class="pc-card-kicker"><span class="pc-icon">◎</span><span>Protocol Status</span><span class="pc-status-dot">Live</span></div>',
  '<div class="pc-intel-grid">',
  '<div><small>Custody</small><strong>Self-custody</strong></div>',
  '<div><small>Signing</small><strong>User wallet</strong></div>',
  '<div><small>Oracle</small><strong>Multi-source policy</strong></div>',
  '<div><small>Risk</small><strong>Pre-settlement guard</strong></div>',
  '<div><small>Settlement</small><strong>Hyperliquid</strong></div>',
  '<div><small>Native layer</small><strong>Research</strong></div>',
  '</div>',
  '<p class="pc-intel-note">BELTRIX owns the intent, market, oracle and risk control layers while settlement remains modular.</p>',
  '</section>'
 ].join('');
 const rail=node('aside','pc-right-rail',railHtml);
 rail.id='pcRightRail';
 const sidebar=$('pcSidebar');
 sidebar.after(rail);
}

function syncIntel(){
 renderMarketRibbon();
 syncIntelligenceStrip();
}

function mount(){
 mountHeader();mountSidebar();mountRightRail();mountMarketRibbon();mountIntelligenceStrip();
 renderWatchlist($('pcSidebar'));syncIntel();

 const select=$('marketSymbol');
 if(select){
  select.addEventListener('change',()=>{queueMicrotask(()=>{renderWatchlist($('pcSidebar'));syncIntel();})});
  new MutationObserver(()=>renderWatchlist($('pcSidebar'))).observe(select,{childList:true,subtree:true});
 }
 for(const id of ['marketMark','marketOI','marketVolume','marketFunding','marketChange','marketPickerSymbol']){
  const el=$(id);if(el)new MutationObserver(syncIntel).observe(el,{childList:true,subtree:true,characterData:true});
 }
 window.addEventListener('beltrix:market',()=>{renderWatchlist($('pcSidebar'));syncIntel();});
 window.addEventListener('beltrix:page',e=>{
  const trading=e.detail==='markets';
  $('pcSidebar')?.classList.toggle('pc-hidden',!trading);
  $('pcRightRail')?.classList.toggle('pc-hidden',!trading);
 });
 document.body.dataset.pearlCobalt='ready';
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});
else mount();
