import {freshMarket} from './order-validation.js';
import {sizeFraction,closingSide} from './futures-sizing.js';
const $=id=>document.getElementById(id);
const API={mainnet:'https://api.hyperliquid.xyz/info',testnet:'https://api.hyperliquid-testnet.xyz/info'};
const TTL=20000;
let market=null,user=null,network=null,snapshot=null,version=0,loading=false,controller=null,selectedPct=null,marginEdited=false,internalInput=false,attemptedAt=0;
const ticket=document.querySelector('.order-ticket');
if(!ticket||$('fastOrderBar'))throw Error('Futures terminal cannot mount');
const css=document.createElement('link');css.rel='stylesheet';css.href=new URL('./mobile-futures.css',import.meta.url).href;css.id='futuresStyles';document.head.append(css);
function element(tag,cls,html){const e=document.createElement(tag);e.className=cls;e.innerHTML=html;return e;}
const bar=element('div','fast-order-bar',`<div class="fast-row fast-open-close" role="group" aria-label="Position intent"><button type="button" data-intent="open" aria-pressed="true">Open</button><button type="button" data-intent="close" aria-pressed="false">Close</button></div><div class="fast-row" role="group" aria-label="Order direction"><button type="button" data-fast-side="buy">Long</button><button type="button" data-fast-side="sell">Short</button></div><div class="fast-row fast-types" role="group" aria-label="Quick order type"><button type="button" data-fast-type="Market">Market</button><button type="button" data-fast-type="Gtc">Limit</button><button type="button" data-fast-type="Stop">SL</button><button type="button" data-fast-type="TakeProfit">TP</button></div>`);bar.id='fastOrderBar';
ticket.prepend(bar);
const leverageDrawer=element('details','futures-leverage','<summary id="futuresLeverageSummary">Margin &amp; leverage <span>Change</span></summary>');leverageDrawer.id='futuresLeverageDrawer';
$('tradeLeveragePanel').before(leverageDrawer);leverageDrawer.append($('tradeLeveragePanel'));ticket.prepend(leverageDrawer);
const extra=element('details','futures-extra','<summary>Order details &amp; account</summary>');extra.id='futuresExtra';ticket.append(extra);
extra.append($('tradeAccount'));
const estimates=ticket.querySelector('.order-estimate');
const available=$('tradeAvailable').closest('div'),availableList=element('dl','order-estimate futures-available','');available.before(availableList);availableList.append(available);ticket.insertBefore(availableList,estimates);extra.append(estimates);
for(const p of [...ticket.querySelectorAll(':scope > .feed-note')])if(p.id!=='tradeModeNote')extra.append(p);
const heading=ticket.querySelector(':scope > h3');if(heading)extra.append(heading);

const sizes=element('div','fast-size',`<label for="futuresSizePercent">Position size <output id="futuresSizeLabel">Manual</output></label><input id="futuresSizePercent" type="range" min="0" max="100" step="1" value="0" aria-label="Order size percentage"><div class="fast-row" role="group" aria-label="Quick size"><button type="button" data-size-pct="25">25%</button><button type="button" data-size-pct="50">50%</button><button type="button" data-size-pct="75">75%</button><button type="button" data-size-pct="100">MAX</button></div><p id="futuresSizingStatus" class="futures-note">Connect to load size limits.</p>`);
$('tradeSize').closest('label').after(sizes);
const actions=element('div','futures-actions',`<button type="button" id="futuresLong" class="futures-long" disabled>Open Long</button><button type="button" id="futuresShort" class="futures-short" disabled>Open Short</button><small>Opens a review. Wallet approval is still required.</small>`);$('tradeReview').before(actions);
const note=element('p','futures-note','');note.id='futuresModeHint';bar.after(note);
const bookMid=element('div','futures-book-mid','<small>Mark price</small><strong id="futuresBookPrice">—</strong><small id="futuresBookFeed">Waiting for live book</small>');$('marketSpread').before(bookMid);
const funding=element('div','futures-funding','<small>Funding / 1h · indicative</small><strong id="futuresFunding">—</strong><span id="futuresFundingClock">—</span>');document.querySelector('.depth').prepend(funding);
const imbalance=element('div','futures-imbalance',`<div><span id="futuresBidShare">Bids —</span><span id="futuresAskShare">Asks —</span></div><div class="futures-ratio-track"><i id="futuresRatioFill"></i></div><small>Displayed depth, not trader long/short ratio</small>`);$('marketBids').after(imbalance);
const accountPanel=document.querySelector('.terminal-account'),chart=document.querySelector('.chart-panel'),layout=document.querySelector('.trade-layout');
const chartDrawer=element('details','futures-chart','<summary>Chart <span>Expand / collapse</span></summary>');chartDrawer.id='futuresChart';accountPanel.after(chartDrawer);
const mq=matchMedia('(max-width:680px)');function arrange(){leverageDrawer.open=!mq.matches;extra.open=!mq.matches;if(chart.parentNode!==layout)layout.prepend(chart);chartDrawer.hidden=true;chartDrawer.open=false;window.dispatchEvent(new Event('resize'));}mq.addEventListener('change',arrange);arrange();
function setText(id,text){if($(id).textContent!==text)$(id).textContent=text;}
function emitInput(el){internalInput=true;try{el.dispatchEvent(new Event('input',{bubbles:true}));}finally{internalInput=false;}}
function editable(){return !$('tradeSize').disabled&&!$('tradeType').disabled&&!$('tradeDialog').open;}
function current(){return snapshot&&snapshot.version===version&&Date.now()-snapshot.at>=0&&Date.now()-snapshot.at<TTL&&user&&network===market?.network&&$('marketNetwork').value===network&&snapshot.coin===market?.market?.value;}
function position(){return current()?snapshot.position:null;}
function closeMode(){return !market?.market?.spot&&$('tradeReduce').checked;}
function invalidate(){version++;controller?.abort();controller=null;loading=false;snapshot=null;attemptedAt=0;selectedPct=null;$('futuresSizePercent').value='0';}
async function refreshSizing(){
  if(loading||Date.now()-attemptedAt<5000||!user||network!==market?.network||!market?.market||!API[network]||document.hidden)return;
  attemptedAt=Date.now();
  const coin=market.market.value,spot=!!market.market.spot,v=version,u=user,n=network;
  const c=new AbortController();controller=c;loading=true;const timer=setTimeout(()=>c.abort(),8000);
  async function info(type){const r=await fetch(API[n],{method:'POST',credentials:'omit',headers:{'Content-Type':'application/json'},body:JSON.stringify({type,user:u,...(type==='activeAssetData'?{coin}:{})}),signal:c.signal});if(!r.ok)throw Error('Size data unavailable');return r.json();}
  try{
    const [asset,perps]=await Promise.all([spot?Promise.resolve(null):info('activeAssetData'),spot?Promise.resolve(null):info('clearinghouseState')]);
    if(v!==version||u!==user||n!==network||coin!==market?.market?.value)return;
    if(!spot&&(asset?.coin!==coin||asset?.user&&asset.user.toLowerCase()!==u.toLowerCase()||!Array.isArray(perps?.assetPositions)))throw Error('Account or market mismatch');
    snapshot={version:v,coin,at:Date.now(),asset,position:perps?.assetPositions.map(x=>x.position).find(p=>p.coin===coin)||null};
  }catch{if(v===version)snapshot=null;}finally{clearTimeout(timer);if(v===version){loading=false;sync();}}
}
function sizingIssue(){
  if(!user)return 'Connect to load size limits.';
  if(market?.market?.spot)return 'Spot: enter token size manually. No leverage.';
  if(!freshMarket(market))return 'Waiting for a fresh order book.';
  if(!current())return loading?'Loading account size limits…':'Size limits unavailable. Refresh account.';
  if(closeMode())return closingSide(position()?.szi)?null:'No position to reduce in this market.';
  const a=snapshot.asset;
  if(Number($('tradeLeverage').value)!==a?.leverage?.value||$('tradeMarginMode').value!==a?.leverage?.type)return 'Apply margin/leverage changes, then refresh.';
  if(!Array.isArray(a?.maxTradeSzs)||a.maxTradeSzs.length!==2)return 'Venue size limits unavailable. Enter size manually.';
  return null;
}
function setPercent(p){
  if(!editable()||sizingIssue())return;
  try{
    const close=closeMode(),pos=position(),side=$('tradeSide').value;
    if(close&&side!==closingSide(pos?.szi))throw Error('Choose the side that reduces your position.');
    const max=close?pos.szi.replace(/^-/,''):snapshot.asset.maxTradeSzs[side==='buy'?0:1];
    const size=sizeFraction(max,p,market.market.szDecimals,close?0:200);
    $('tradeSize').value=size;selectedPct=p;$('futuresSizePercent').value=String(p);emitInput($('tradeSize'));sync();
  }catch(e){setText('futuresSizingStatus',e.message);}
}
function setSide(side){if(!editable()||$('tradeSide').disabled||!['buy','sell'].includes(side))return;const pct=selectedPct;$('tradeSide').value=side;emitInput($('tradeSide'));if(pct!==null)setPercent(pct);sync();}
function setType(type){
  if(!editable())return;const option=[...$('tradeType').options].find(o=>o.value===type);if(!option||option.disabled)return;
  if(['Stop','TakeProfit'].includes(type)){
    const pos=position(),side=closingSide(pos?.szi);if(!side){setText('futuresSizingStatus','Load an existing position before setting TP/SL.');return;}
    $('tradeSide').value=side;$('tradeReduce').checked=true;$('tradeSize').value=pos.szi.replace(/^-/,'');selectedPct=null;
  }
  $('tradeType').value=type;emitInput($('tradeType'));sync();
}
function setIntent(close){
  if(!editable()||market?.market?.spot)return;
  if(['Stop','TakeProfit'].includes($('tradeType').value)){$('tradeType').value='Market';emitInput($('tradeType'));}
  $('tradeReduce').checked=close;selectedPct=null;emitInput($('tradeReduce'));
  if(close){const pos=position(),side=closingSide(pos?.szi);if(side){setSide(side);setPercent(100);}}
  sync();
}
function reviewSide(side){if($('tradeReview').disabled||!editable())return;setSide(side);if(closeMode()&&closingSide(position()?.szi)!==side)return;if(!$('tradeReview').disabled)$('tradeReview').click();sync();}
bar.addEventListener('click',e=>{const b=e.target.closest('button');if(!b||b.disabled)return;if(b.dataset.intent)setIntent(b.dataset.intent==='close');if(b.dataset.fastSide)setSide(b.dataset.fastSide);if(b.dataset.fastType)setType(b.dataset.fastType);});
sizes.addEventListener('click',e=>{const b=e.target.closest('[data-size-pct]');if(b&&!b.disabled)setPercent(Number(b.dataset.sizePct));});
$('futuresSizePercent').addEventListener('input',e=>setPercent(Number(e.target.value)));
$('tradeDialog').addEventListener('close',sync);$('tradeDialog').addEventListener('cancel',()=>queueMicrotask(sync));
$('futuresLong').onclick=()=>reviewSide(closeMode()?'sell':'buy');$('futuresShort').onclick=()=>reviewSide(closeMode()?'buy':'sell');
document.addEventListener('input',e=>{if(e.target.id==='tradeSize'&&!internalInput)selectedPct=null;if(['tradeLeverage','tradeMarginMode'].includes(e.target.id)&&!internalInput)marginEdited=true;if(e.target.closest('.order-ticket'))sync();});
$('tradeRefresh').addEventListener('click',()=>{snapshot=null;attemptedAt=0;refreshSizing();});
window.addEventListener('beltrix:wallet',e=>{invalidate();user=e.detail?.account||null;network=user?(e.detail.chainId===421614?'testnet':e.detail.chainId===42161?'mainnet':null):null;marginEdited=false;sync();refreshSizing();});
window.addEventListener('beltrix:market',e=>{const next=e.detail;if(market?.network!==next.network||market?.market?.value!==next.market?.value){invalidate();marginEdited=false;}market=next;sync();if(!snapshot&&!loading)refreshSizing();});
function updateCounts(){for(const [tab,id,label] of [['positions','tradePositions','Positions'],['orders','tradeOrders','Open orders']]){const root=$(id),count=root.querySelector('table')?root.querySelectorAll('tbody tr').length:root.textContent.trim()==='No records'?0:'—';const b=document.querySelector(`[data-account-tab="${tab}"]`),text=`${label} (${count})`;if(b.textContent!==text)b.textContent=text;}}
function sync(){
  // A background refresh must never modify a pending review or signing form.
  const leverage=current()?snapshot.asset?.leverage:null;
  if(!marginEdited&&editable()&&leverage&&Number.isInteger(leverage.value)&&['cross','isolated'].includes(leverage.type)&&(Number($('tradeLeverage').value)!==leverage.value||$('tradeMarginMode').value!==leverage.type)){
    $('tradeLeverage').value=String(leverage.value);$('tradeMarginMode').value=leverage.type;emitInput($('tradeLeverage'));
  }
  const spot=!!market?.market?.spot,close=closeMode(),side=$('tradeSide').value,type=$('tradeType').value,edit=editable(),posSide=closingSide(position()?.szi),issue=sizingIssue();
  for(const b of bar.querySelectorAll('[data-intent]')){b.disabled=!edit||spot;b.setAttribute('aria-pressed',String((b.dataset.intent==='close')===close));}
  for(const b of bar.querySelectorAll('[data-fast-side]')){b.disabled=!edit||$('tradeSide').disabled;b.setAttribute('aria-pressed',String(b.dataset.fastSide===side));b.textContent=spot?(b.dataset.fastSide==='buy'?'Buy':'Sell'):(b.dataset.fastSide==='buy'?'Long':'Short');}
  for(const b of bar.querySelectorAll('[data-fast-type]')){b.disabled=!edit||['Stop','TakeProfit'].includes(b.dataset.fastType)&&(spot||!posSide);b.setAttribute('aria-pressed',String(b.dataset.fastType===type));}
  for(const b of sizes.querySelectorAll('[data-size-pct]')){b.disabled=!edit||!!issue;b.setAttribute('aria-pressed',String(Number(b.dataset.sizePct)===selectedPct));}
  $('futuresSizePercent').disabled=!edit||!!issue;setText('futuresSizeLabel',selectedPct===null?'Manual':selectedPct+'%');
  setText('futuresSizingStatus',issue||(close?'Percentage of the current position.':'Venue max size · 2% buffer · rounded down.'));
  setText('futuresModeHint',spot?'Spot uses tokens, not leveraged positions.':['Stop','TakeProfit'].includes(type)?'Standalone TP/SL for an existing position. Not a paired bracket; no automatic OCO.':close?'Reduce only. Cannot open or reverse a position.':'Net position mode. Opposite orders can reduce or reverse a position.');
  leverageDrawer.hidden=spot;
  const applied=current()?snapshot.asset?.leverage:null;
  setText('futuresLeverageSummary',applied?`${applied.type==='isolated'?'Isolated':'Cross'} · ${applied.value}x · Change`:'Margin & leverage · Change');
  funding.hidden=spot;setText('futuresFunding',$('marketFunding').textContent);setText('futuresFundingClock',$('marketFundingCountdown').textContent);
  setText('futuresLong',spot?'Buy':close?'Close Long':'Open Long');setText('futuresShort',spot?'Sell':close?'Close Short':'Open Short');
  $('futuresLong').disabled=$('tradeReview').disabled||!edit||(close&&posSide!=='sell');$('futuresShort').disabled=$('tradeReview').disabled||!edit||(close&&posSide!=='buy');
  const fresh=freshMarket(market),ctx=market?.context;setText('futuresBookPrice',fresh&&Number(ctx?.markPx)>0&&Date.now()-market.contextReceived<90000?Number(ctx.markPx).toLocaleString('en-US',{maximumFractionDigits:8}):'—');
  setText('futuresBookFeed',fresh?'Live · '+market.network:'Stale / unavailable');
  const levels=market?.book?.levels,n=$('bookDepth').value==='deep'?20:5;
  const sum=i=>(levels?.[i]||[]).slice(0,n).reduce((s,l)=>s+Number(l.sz),0),bid=sum(0),ask=sum(1),total=bid+ask,valid=fresh&&total>0&&Number.isFinite(total),ratio=valid?bid/total*100:50;
  setText('futuresBidShare',valid?`Bids ${ratio.toFixed(0)}%`:'Bids —');setText('futuresAskShare',valid?`Asks ${(100-ratio).toFixed(0)}%`:'Asks —');$('futuresRatioFill').style.width=ratio+'%';imbalance.classList.toggle('unavailable',!valid);updateCounts();
}
const observer=new MutationObserver(()=>{sync();if($('tradeStatus').textContent.startsWith('Applied ')&&!loading){snapshot=null;refreshSizing();}});
observer.observe($('tradeReview'),{attributes:true,attributeFilter:['disabled']});
for(const id of ['tradePositions','tradeOrders','tradeStatus'])observer.observe($(id),{childList:true,subtree:true});
setInterval(()=>{sync();if(user&&!document.hidden&&(!snapshot||Date.now()-snapshot.at>15000)&&!loading)refreshSizing();},3000);
window.addEventListener('pagehide',()=>{invalidate();sync();});
sync();document.documentElement.dataset.futuresUx='v2';
