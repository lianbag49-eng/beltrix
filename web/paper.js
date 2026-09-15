import {initialPaper,openPaper,closePaper,paperPnl,validPaper} from './paper-core.js';
const $=id=>document.getElementById(id),KEY='beltrix-paper-futures-v1';
let state=initialPaper(),quote=null,revision=0,busy=false,pending=null;
try{const s=JSON.parse(localStorage.getItem(KEY));if(validPaper(s))state=s;}catch{}
const money=n=>n.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
function save(){try{localStorage.setItem(KEY,JSON.stringify(state))}catch{$('paperMessage').textContent='Storage unavailable; this practice session is temporary.'}}
function fresh(){return quote&&quote.coin===$('paperCoin').value&&Date.now()-quote.time<15000;}
function render(){
 $('paperCash').textContent=money(state.cash)+' practice USDC';
 $('paperQuote').textContent=fresh()?`${quote.coin} · Bid ${money(quote.bid)} / Ask ${money(quote.ask)} · Testnet price`:'Price unavailable or stale — refresh to trade';
 $('paperOpen').disabled=!!state.position||!fresh();$('paperClose').disabled=!state.position||!fresh()||state.position.coin!==quote.coin;
 $('paperCoin').disabled=!!state.position;
 $('paperPosition').textContent=state.position?`${state.position.coin} ${state.position.side.toUpperCase()} · ${state.position.leverage}x · Entry ${money(state.position.entry)} · Margin ${money(state.position.margin)} · Indicative PnL ${fresh()?money(paperPnl(state.position,(quote.bid+quote.ask)/2)):'unavailable'} USDC`:'No practice futures position';
 $('paperHistory').replaceChildren();for(const r of state.history){const row=document.createElement('p');row.textContent=`${r.coin} ${r.side} · Net PnL ${money(r.pnl)} USDC · ${new Date(r.time).toLocaleString('en-US')}`;$('paperHistory').append(row)}
}
async function refresh(){
 if(busy)return;busy=true;const token=++revision,coin=$('paperCoin').value;quote=null;render();
 try{const response=await fetch('https://api.hyperliquid-testnet.xyz/info',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'l2Book',coin}),signal:AbortSignal.timeout(8000)});
 if(!response.ok)throw Error('Market API unavailable');const data=await response.json();
 const bid=Number(data.levels?.[0]?.[0]?.px),ask=Number(data.levels?.[1]?.[0]?.px);
 if(data.coin!==coin||!(bid>0&&ask>=bid)||!Number.isFinite(ask)||(!Number.isFinite(Number(data.time))||Math.abs(Date.now()-Number(data.time))>15000))throw Error('Fresh two-sided order book unavailable');
 if(token===revision)quote={coin,bid,ask,time:Date.now()};
 }catch(e){$('paperMessage').textContent=e.message;}finally{busy=false;render()}
}
function review(kind){try{
 if(!fresh())throw Error('Refresh the price before trading');
 const price=kind==='open'?($('paperSide').value==='long'?quote.ask:quote.bid):(state.position.side==='long'?quote.bid:quote.ask);
 const order={coin:quote.coin,side:$('paperSide').value,margin:Number($('paperMargin').value),leverage:Number($('paperLeverage').value),price};
 const next=kind==='open'?openPaper(state,order):closePaper(state,price);
 pending={next,expires:Date.now()+10000};
 $('paperReviewText').textContent=kind==='open'?`SIMULATION ONLY: ${order.coin} ${order.side} · ${order.leverage}x · ${order.margin} USDC margin · Price ${price} · Fee 0.05%.`:`SIMULATION ONLY: Close at ${price}. Net PnL ${money(next.history[0].pnl)} USDC.`;
 $('paperReview').showModal();
 }catch(e){$('paperMessage').textContent=e.message;}
}
for(const id of ['paperSide','paperMargin','paperLeverage'])$(id).addEventListener('input',()=>{pending=null});
 $('paperCoin').onchange=()=>{pending=null;refresh()};$('paperRefresh').onclick=refresh;
 $('paperOpen').onclick=()=>review('open');$('paperClose').onclick=()=>review('close');
 $('paperConfirm').onclick=()=>{if(!pending||Date.now()>pending.expires){pending=null;$('paperReview').close();$('paperMessage').textContent='Review expired. Please try again.';return}state=pending.next;pending=null;save();render();$('paperReview').close();$('paperMessage').textContent='Practice trade complete. No real assets moved.';};
 $('paperCancel').onclick=()=>{pending=null;$('paperReview').close()};$('paperReview').addEventListener('cancel',()=>{pending=null});
 $('paperReset').onclick=()=>{if(!confirm('Reset futures practice to 100,000 USDC and clear its positions and history?'))return;pending=null;state=initialPaper();save();render()};
 window.addEventListener('storage',e=>{if(e.key===KEY){pending=null;try{const s=JSON.parse(e.newValue);if(validPaper(s))state=s}catch{}render()}});
 window.addEventListener('beltrix:page',e=>{if(e.detail==='swap')refresh()});
 if(state.position)$('paperCoin').value=state.position.coin;
 setInterval(()=>{render();if(document.body.dataset.page==='swap'&&!document.hidden&&!$('paperReview').open)refresh()},10000);
 render();
