import {normalizeTheme,nextTheme,THEME_STORAGE_KEY,themeMetaColor} from './ui-theme-core.js';

const $=id=>document.getElementById(id);
const root=document.documentElement;
const app=document.querySelector('.app');
if(!app)throw Error('BELTRIX app root unavailable');

root.dataset.beltrixUi='pearl-cobalt';

if(!document.getElementById('pearlCobaltStyles')){
 const css=document.createElement('link');
 css.rel='stylesheet';
 css.href=new URL('./pearl-cobalt.css',import.meta.url).href;
 css.id='pearlCobaltStyles';
 document.head.append(css);
}

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
   ?'<span class="pc-theme-icon" aria-hidden="true">☀</span><span>Light</span>'
   :'<span class="pc-theme-icon" aria-hidden="true">◐</span><span>Dark</span>';
 }
 window.dispatchEvent(new CustomEvent('beltrix:theme',{detail:{theme:value}}));
 window.dispatchEvent(new Event('resize'));
}
applyTheme(readTheme(),{persist:false});

function node(tag,cls,html=''){
 const el=document.createElement(tag);el.className=cls;el.innerHTML=html;return el;
}
function safeText(id,fallback='—'){return ($(id)?.textContent||fallback).trim()||fallback}
function currentSymbol(){return safeText('marketPickerSymbol',safeText('marketSymbol','Market')).replace(/\s+/g,' ')}
function currentMarketValue(){return $('marketSymbol')?.value||''}
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
function scrollToElement(el){el?.scrollIntoView({behavior:'smooth',block:'start'})}
function syncThemeToggle(){if($('pcThemeToggle'))applyTheme(root.dataset.theme||'light',{persist:false})}

function mountHeader(){
 if($('pcThemeToggle'))return;
 const top=document.querySelector('.top');
 const brand=top?.querySelector('.brand');
 if(!top||!brand)return;

 brand.querySelector('small').textContent='DECENTRALIZED DERIVATIVES';

 const nav=node('div','pc-header-nav');
 nav.setAttribute('role','group');
 nav.setAttribute('aria-label','BELTRIX product shortcuts');
 const items=[
  ['Dashboard',()=>scrollToElement($('markets'))],
  ['Markets',openMarketPicker],
  ['Trade',()=>scrollToElement(document.querySelector('.trade-layout'))],
  ['Protocol',()=>scrollToElement($('pcProtocolCard'))],
  ['Intelligence',()=>scrollToElement($('pcIntelligenceBar'))],
  ['Portfolio',()=>scrollToElement(document.querySelector('.terminal-account'))]
 ];
 for(const [label,action] of items){
  const b=node('button','pc-header-link',label);
  b.type='button';
  b.setAttribute('aria-label','Open '+label+' section');
  b.onclick=action;
  nav.append(b);
 }
 brand.after(nav);

 const search=node('button','pc-market-search','<span aria-hidden="true">⌕</span><span>Search markets, tokens, or strategies…</span><kbd>⌘K</kbd>');
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
 return [...select.options].filter(o=>o.value).slice(0,16).map(o=>({
  value:o.value,
  label:(o.textContent||o.value).trim()
 }));
}
function optionBase(label){
 return String(label||'').replace(/\s*\/.*$/,'').replace(/-PERP$/i,'').split(':').pop().replace(/^@\d+$/,'SPOT');
}
function preferredMarketCards(){
 const options=marketOptions();
 const active=currentMarketValue();
 const desired=['BTC','ETH','SOL'];
 const chosen=[];
 for(const base of desired){
  const found=options.find(o=>optionBase(o.label).toUpperCase()===base);
  if(found)chosen.push(found);
 }
 if(!chosen.some(x=>x.value===active)){
  const current=options.find(x=>x.value===active);
  if(current)chosen.unshift(current);
 }
 return [...new Map(chosen.map(x=>[x.value,x])).values()].slice(0,3);
}

function mountMarketStrip(){
 if($('pcMarketStrip'))return;
 const marketCard=document.querySelector('#markets .market-card');
 if(!marketCard)return;
 const strip=node('section','pc-market-strip');strip.id='pcMarketStrip';
 const controls=marketCard.querySelector('.simple-trade-toolbar')||marketCard.querySelector(':scope > .market-controls');
 marketCard.insertBefore(strip,controls||marketCard.firstChild);
 renderMarketStrip();
}
function renderMarketStrip(){
 const strip=$('pcMarketStrip');if(!strip)return;
 const active=currentMarketValue();
 const rows=preferredMarketCards();
 strip.replaceChildren();
 for(const row of rows){
  const base=optionBase(row.label);
  const button=node('button','pc-ticker-card');
  button.type='button';button.dataset.marketValue=row.value;
  button.setAttribute('aria-current',String(row.value===active));
  const selected=row.value===active;
  button.innerHTML=
   '<span class="pc-ticker-coin">'+base.slice(0,3)+'</span>'+
   '<span class="pc-ticker-copy"><strong>'+row.label+'</strong><small>'+(selected?safeText('marketMark','Live market'):'Open market')+'</small></span>'+
   '<span class="pc-ticker-change '+(selected?($('marketChange')?.className||''):'')+'">'+(selected?safeText('marketChange','Live'):'↗')+'</span>';
  button.onclick=()=>activateMarket(row.value);
  strip.append(button);
 }
 const add=node('button','pc-ticker-card pc-add-market','<span class="pc-add-plus">+</span><span class="pc-ticker-copy"><strong>Add market</strong><small>Browse all markets</small></span>');
 add.type='button';add.onclick=openMarketPicker;strip.append(add);
}

function renderWatchlist(sidebar){
 const list=sidebar?.querySelector('.pc-watchlist-list');if(!list)return;
 const rows=marketOptions();
 const active=currentMarketValue();
 list.replaceChildren();
 for(const row of rows){
  const b=node('button','pc-market-row');
  b.type='button';b.dataset.marketValue=row.value;b.setAttribute('aria-current',String(row.value===active));
  const base=optionBase(row.label);
  b.innerHTML='<span class="pc-coin">'+(base||'?').slice(0,3)+'</span><span><strong>'+row.label+'</strong><small>'+(row.value===active?safeText('marketMark','Live'):'Perpetual market')+'</small></span><span class="pc-row-arrow">›</span>';
  b.onclick=()=>activateMarket(row.value);
  list.append(b);
 }
 if(!rows.length)list.innerHTML='<p class="pc-empty">Markets are loading…</p>';
}

function mountSidebar(){
 if($('pcSidebar'))return;
 const sidebarHtml=[
  '<div class="pc-rail-nav">',
  '<button type="button" data-pc-action="dashboard" class="active"><span>⌂</span>Dashboard</button>',
  '<button type="button" data-pc-action="markets"><span>▥</span>Markets</button>',
  '<button type="button" data-pc-action="trade"><span>⇄</span>Trade</button>',
  '<button type="button" data-pc-action="protocol"><span>⬡</span>Protocol</button>',
  '<button type="button" data-pc-action="analytics"><span>⌁</span>Intelligence</button>',
  '<button type="button" data-pc-action="portfolio"><span>◔</span>Portfolio</button>',
  '<button type="button" data-pc-action="governance"><span>⌘</span>Governance</button>',
  '</div>',
  '<section class="pc-watchlist">',
  '<header><div><small>MARKETS</small><strong>Watchlist</strong></div><button type="button" data-pc-add-market aria-label="Open market selector">+</button></header>',
  '<div class="pc-watchlist-list"></div>',
  '</section>',
  '<section class="pc-brand-note"><span class="pc-brand-line"></span><strong>Open markets.<br>Higher standards.</strong><p>BELTRIX protocol controls with self-custodial settlement.</p></section>',
  '<div class="pc-sidebar-foot"><button type="button" data-pc-action="settings"><span>⚙</span>Settings</button></div>'
 ].join('');
 const sidebar=node('aside','pc-sidebar',sidebarHtml);sidebar.id='pcSidebar';
 document.querySelector('.top').after(sidebar);
 sidebar.querySelector('[data-pc-add-market]').onclick=openMarketPicker;
 sidebar.querySelector('[data-pc-action="dashboard"]').onclick=()=>scrollToElement($('markets'));
 sidebar.querySelector('[data-pc-action="markets"]').onclick=openMarketPicker;
 sidebar.querySelector('[data-pc-action="trade"]').onclick=()=>scrollToElement(document.querySelector('.trade-layout'));
 sidebar.querySelector('[data-pc-action="portfolio"]').onclick=()=>scrollToElement(document.querySelector('.terminal-account'));
 sidebar.querySelector('[data-pc-action="analytics"]').onclick=()=>scrollToElement($('pcIntelligenceBar'));
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
  '<h2>A decentralized derivatives protocol built beyond one venue.</h2>',
  '<p>BELTRIX owns market identity, intent, oracle policy and risk controls. Settlement stays modular and user-signed.</p>',
  '<div class="pc-protocol-list">',
  '<div><span>Market Registry</span><strong>BTC · ETH · SOL</strong></div>',
  '<div><span>Oracle Policy</span><strong>Multi-source</strong></div>',
  '<div><span>Risk Engine</span><strong>Guarded</strong></div>',
  '<div><span>Settlement</span><strong>Hyperliquid bootstrap</strong></div>',
  '</div>',
  '<button type="button" class="pc-outline-action" data-pc-protocol-action>Explore protocol</button>',
  '</section>',
  '<section class="pc-insight-card pc-promo-card">',
  '<span class="pc-promo-kicker">BELTRIX</span>',
  '<h3>A more open<br>tomorrow.</h3>',
  '<p>Decentralized derivatives for global markets.</p>',
  '<span class="pc-promo-horizon" aria-hidden="true"></span>',
  '</section>'
 ].join('');
 const rail=node('aside','pc-right-rail',railHtml);rail.id='pcRightRail';
 $('pcSidebar').after(rail);
 rail.querySelector('[data-pc-protocol-action]').onclick=()=>scrollToElement($('pcIntelligenceBar'));
}

function mountIntelligenceBar(){
 if($('pcIntelligenceBar'))return;
 const account=document.querySelector('.terminal-account');
 if(!account)return;
 const bar=node('section','pc-intelligence-bar',[
  '<div class="pc-intel-head"><div><span class="pc-icon">⌬</span><strong>Protocol &amp; Market Intelligence</strong></div><span class="pc-intel-live">● Live</span></div>',
  '<div class="pc-intel-cards">',
  '<article><small>Funding rate</small><strong data-pc-metric="funding">—</strong><span>Current venue rate</span></article>',
  '<article><small>Open interest</small><strong data-pc-metric="oi">—</strong><span>Selected market</span></article>',
  '<article><small>24h volume</small><strong data-pc-metric="volume">—</strong><span>Selected market</span></article>',
  '<article><small>Oracle status</small><strong data-pc-metric="oracle">—</strong><span>Venue oracle feed</span></article>',
  '<article><small>Protocol risk</small><strong class="pc-risk-state">Guarded</strong><span>Wallet review + policy checks</span></article>',
  '</div>'
 ].join(''));
 bar.id='pcIntelligenceBar';account.before(bar);
}

function syncIntelligence(){
 const bar=$('pcIntelligenceBar');if(!bar)return;
 const values={
  funding:safeText('marketFunding'),
  oi:safeText('marketOI'),
  volume:safeText('marketVolume'),
  oracle:safeText('marketOracle')
 };
 for(const [key,value] of Object.entries(values)){
  const el=bar.querySelector('[data-pc-metric="'+key+'"]');if(el)el.textContent=value;
 }
}

function decorateCore(){
 const marketCard=document.querySelector('#markets .market-card');
 marketCard?.classList.add('pc-main-workspace');
 marketCard?.querySelector(':scope > .market-controls')?.classList.add('pc-core-controls');
 document.querySelector('.trade-layout')?.classList.add('pc-trade-grid');
 document.querySelector('.chart-panel')?.classList.add('pc-chart-card');
 document.querySelector('.depth')?.classList.add('pc-book-card');
 document.querySelector('.order-ticket')?.classList.add('pc-order-card');
 document.querySelector('.terminal-account')?.classList.add('pc-account-card');
 document.querySelector('.simple-trade-toolbar')?.classList.add('pc-product-toolbar');
}

function stabilizeMobileDisclosures(){
 const mobile=matchMedia('(max-width:680px)');
 for(const id of ['futuresChart','futuresLeverageDrawer','futuresExtra']){
  const details=$(id);
  const summary=details?.querySelector(':scope > summary');
  if(!summary||summary.dataset.pcStableScroll==='1')continue;
  summary.dataset.pcStableScroll='1';
  summary.addEventListener('click',()=>{
   if(!mobile.matches)return;
   const before=window.scrollY;
   const restore=()=>{
    const scroller=document.scrollingElement||document.documentElement;
    if(Math.abs(window.scrollY-before)>1)scroller.scrollTop=before;
   };
   requestAnimationFrame(()=>{restore();requestAnimationFrame(restore);});
  });
 }
}

function syncActiveMarketViews(){
 const active=currentMarketValue();
 const mark=safeText('marketMark','Live market');
 const change=safeText('marketChange','Live');
 const changeClass=$('marketChange')?.className||'';

 for(const card of document.querySelectorAll('#pcMarketStrip .pc-ticker-card[data-market-value]')){
  const selected=card.dataset.marketValue===active;
  card.setAttribute('aria-current',String(selected));
  const small=card.querySelector('.pc-ticker-copy small');
  const delta=card.querySelector('.pc-ticker-change');
  if(small)small.textContent=selected?mark:'Open market';
  if(delta){
   delta.textContent=selected?change:'↗';
   delta.className='pc-ticker-change '+(selected?changeClass:'');
  }
 }
 for(const row of document.querySelectorAll('#pcSidebar .pc-market-row[data-market-value]')){
  const selected=row.dataset.marketValue===active;
  row.setAttribute('aria-current',String(selected));
  const small=row.querySelector('small');
  if(small)small.textContent=selected?mark:'Perpetual market';
 }
 syncIntelligence();
}

function rebuildMarketViews(){
 renderWatchlist($('pcSidebar'));
 renderMarketStrip();
 syncActiveMarketViews();
}

function mount(){
 mountHeader();mountSidebar();mountRightRail();mountMarketStrip();mountIntelligenceBar();decorateCore();stabilizeMobileDisclosures();
 rebuildMarketViews();

 const select=$('marketSymbol');
 if(select){
  select.addEventListener('change',()=>queueMicrotask(rebuildMarketViews));
  new MutationObserver(rebuildMarketViews).observe(select,{childList:true,subtree:true});
 }
 for(const id of ['marketMark','marketOracle','marketOI','marketVolume','marketFunding','marketChange']){
  const el=$(id);
  if(el)new MutationObserver(syncActiveMarketViews).observe(el,{childList:true,subtree:true,characterData:true});
 }
 const symbol=$('marketPickerSymbol');
 if(symbol)new MutationObserver(syncActiveMarketViews).observe(symbol,{childList:true,subtree:true,characterData:true});

 window.addEventListener('beltrix:market',()=>queueMicrotask(rebuildMarketViews));
 window.addEventListener('beltrix:page',e=>{
  const trading=e.detail==='markets';
  $('pcSidebar')?.classList.toggle('pc-hidden',!trading);
  $('pcRightRail')?.classList.toggle('pc-hidden',!trading);
 });
 document.body.dataset.pearlCobalt='ready';
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});
else mount();
