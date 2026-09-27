import {VENUES} from '../venue-registry.js';
import {bdMatrix} from '../bd-matrix.js';
import {COMMERCIAL_MODELS} from '../commercial-model.js';
import {INITIAL_QUALIFICATION} from '../execution-qualification.js';
import {INITIAL_BD_PIPELINE,nextActionState} from '../bd-pipeline.js';
import {SUPPORTED_CANONICAL_ASSETS,marketRouting} from '../market-normalizer.js';
import {collectAssetBooks,collectGmxState} from '../market-snapshot.js';

const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>Number.isFinite(Number(n))?new Intl.NumberFormat('en-US',{maximumFractionDigits:2}).format(Number(n)):'N/A';
const bps=n=>Number.isFinite(Number(n))?fmt(n)+' bps':'N/A';
const pct=n=>Number.isFinite(Number(n))?(Number(n)*100).toFixed(1)+'%':'N/A';
const yn=v=>v?'<span class="ok">Yes</span>':'<span class="na">No</span>';
const health=v=>v==='healthy'?'<span class="ok">Healthy</span>':v==='degraded'?'<span class="warn">Degraded</span>':'<span class="bad">Unavailable</span>';

function table(headers,rows){
 return '<div class="table-wrap"><table><thead><tr>'+headers.map(x=>'<th>'+esc(x)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(r=>'<tr>'+r.map(x=>'<td>'+x+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';
}

function currentAsset(){return $('assetSelect')?.value||'BTC'}
function currentNotional(){return Math.max(100,Number($('notional')?.value)||10000)}
function feeAssumptions(){
 const out={};
 for(const input of document.querySelectorAll('[data-fee]')){
  const n=Number(input.value);
  if(input.value!==''&&Number.isFinite(n)&&n>=0)out[input.dataset.fee]=n;
 }
 return out;
}

function renderOverview(){
 const route=marketRouting(currentAsset());
 $('overview').innerHTML='<div class="cards">'+VENUES.map(v=>{
  const symbol=route.symbols[v.id]||'N/A';
  return '<article class="card '+(v.role==='baseline'?'baseline':'')+'"><small>'+esc(v.role.toUpperCase())+'</small><h2>'+esc(v.name)+'</h2><p>'+esc(v.marketModel)+'</p><div>'+v.integration.map(x=>'<span class="tag">'+esc(x)+'</span>').join('')+'</div><p>'+esc(route.asset)+' mapping: <code>'+esc(symbol)+'</code></p><p>White-label: '+(v.whiteLabel?'Yes':'No')+' · Execution candidate: '+(v.executionCandidate?'Yes':'No')+'</p></article>';
 }).join('')+'</div>';
}

function renderBD(){
 const pipeline=INITIAL_BD_PIPELINE.map(v=>[
  esc(v.name),
  '<code>'+esc(v.stage)+'</code>',
  esc(v.objectives.join(', ')),
  esc(v.nextAction||'N/A'),
  esc(v.nextActionAt||'N/A'),
  '<span class="'+(nextActionState(v)==='overdue'?'bad':nextActionState(v)==='due-soon'?'warn':'na')+'">'+esc(nextActionState(v))+'</span>'
 ]);
 $('bdPipeline').innerHTML=table(['Partner','Stage','Objectives','Next action','Due','Action state'],pipeline);

 const rows=bdMatrix().map(v=>[esc(v.name),esc(v.marketModel),esc(v.integration),esc(v.revenue),yn(v.whiteLabel),yn(v.sharedLiquidity),yn(v.executionCandidate)]);
 $('bdTable').innerHTML=table(['Venue','Market model','Integration','Revenue modes','White-label','Shared liquidity','Execution candidate'],rows);
}

function renderFees(){
 const rows=COMMERCIAL_MODELS.map(v=>[
  esc(v.venue),
  esc(v.frontendRevenue.join(', ')||'N/A'),
  yn(v.affiliate),
  yn(v.whiteLabel),
  esc(v.feeControl),
  esc(v.checkedAt),
  v.sources.map((d,i)=>'<a href="'+esc(d)+'" target="_blank" rel="noopener">Source '+(i+1)+'</a>').join(' · ')
 ]);
 $('feesTable').innerHTML=table(['Venue','Frontend revenue','Affiliate','White-label','Fee control','Checked','Sources'],rows);
}

function renderExecution(){
 const rows=Object.values(INITIAL_QUALIFICATION).map(v=>[
  esc(v.venue),
  v.qualified?'<span class="ok">Execution qualified</span>':'<span class="na">Research only</span>',
  esc(v.mode),
  v.missing.length?String(v.missing.length):'0',
  esc(v.missing.join(', ')||'All gates evidenced'),
  esc(v.reviewedAt||'N/A')
 ]);
 $('executionTable').innerHTML=table(['Venue','Status','Mode','Missing gates','Required evidence','Reviewed'],rows);
}

function renderIntegration(){
 const rows=VENUES.map(v=>{
  const mappings=SUPPORTED_CANONICAL_ASSETS.map(asset=>{
   try{return asset+': '+marketRouting(asset).symbols[v.id]}catch{return asset+': N/A'}
  }).join(' · ');
  return [esc(v.name),esc(v.dataStatus),esc(v.chains.join(', ')),esc(mappings),v.docs.map((d,i)=>'<a href="'+esc(d)+'" target="_blank" rel="noopener">Source '+(i+1)+'</a>').join(' · ')];
 });
 $('integrationTable').innerHTML=table(['Venue','Data status','Chains','Canonical mappings','Official sources'],rows);
}

async function refreshLiquidity(){
 const asset=currentAsset(),notional=currentNotional(),fees=feeAssumptions();
 $('liquidityStatus').textContent='Loading '+asset+' public market data…';
 $('liquidityTable').textContent='';
 $('gmxState').textContent='Loading GMX pool state…';

 const [rows,gmx]=await Promise.all([
  collectAssetBooks(asset,{notionalUsd:notional,feeBpsByVenue:fees}),
  collectGmxState(asset)
 ]);

 $('liquidityStatus').textContent='Read-only snapshot · '+asset+' · $'+fmt(notional)+' simulated order · refreshed '+new Date().toLocaleTimeString();

 const rendered=rows.map(v=>{
  if(!v.ok)return [esc(v.venue),'<code>'+esc(v.symbol)+'</code>',health('unavailable'),'N/A','N/A','N/A','N/A','N/A','N/A','N/A','N/A','<span class="bad">'+esc(v.error)+'</span>'];
  const s=v.snapshot;
  return [
   esc(v.venue),
   '<code>'+esc(v.symbol)+'</code>',
   health(v.health.status),
   bps(s.book.spreadBps),
   '$'+fmt(s.depth[25].total),
   bps(v.buy?.marketImpactBps),
   bps(v.sell?.marketImpactBps),
   v.buy?.feeBps===null?'N/A':bps(v.buy.feeBps),
   bps(v.buy?.effectiveCostBps),
   bps(v.sell?.effectiveCostBps),
   pct(Math.min(v.buy?.fillRatio??0,v.sell?.fillRatio??0)),
   v.receivedAt?new Date(v.receivedAt).toLocaleTimeString():'N/A'
  ];
 });
 $('liquidityTable').innerHTML=table(['Venue','Symbol','Health','Spread','Depth ±25bps','Buy impact','Sell impact','Fee input','Buy effective','Sell effective','Min fill','Timestamp'],rendered);

 $('gmxState').innerHTML=gmx.ok
  ?'<strong>GMX '+esc(gmx.chain)+'</strong> · market-state endpoint healthy · '+fmt(gmx.marketCount)+' markets returned · '+fmt(gmx.matchingMarkets)+' '+esc(asset)+' matches.<br><span class="note">'+esc(gmx.note)+'</span>'
  :'<strong>GMX '+esc(gmx.chain)+'</strong> · <span class="bad">Unavailable</span> · '+esc(gmx.error||'collector error');
}

for(const b of document.querySelectorAll('[data-tab]'))b.onclick=()=>{
 for(const x of document.querySelectorAll('[data-tab]'))x.setAttribute('aria-pressed',String(x===b));
 for(const p of document.querySelectorAll('[data-panel]'))p.hidden=p.id!==b.dataset.tab;
};

$('refresh').onclick=()=>{renderOverview();refreshLiquidity()};
$('assetSelect').onchange=()=>{renderOverview();refreshLiquidity()};
$('notional').onchange=refreshLiquidity;
for(const x of document.querySelectorAll('[data-fee]'))x.onchange=refreshLiquidity;

renderOverview();
renderBD();
renderFees();
renderExecution();
renderIntegration();
refreshLiquidity();
