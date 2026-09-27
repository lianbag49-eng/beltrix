import {VENUES} from '../venue-registry.js';
import {bdMatrix} from '../bd-matrix.js';
import {hyperliquidBook,paradexBook,dydxBook} from '../public-data.js';
import {liquiditySnapshot} from '../liquidity.js';
import {COMMERCIAL_MODELS} from '../commercial-model.js';
import {INITIAL_QUALIFICATION} from '../execution-qualification.js';

const $=id=>document.getElementById(id);
const fmt=n=>Number.isFinite(n)?new Intl.NumberFormat('en-US',{maximumFractionDigits:2}).format(n):'N/A';
const yn=v=>v?'<span class="ok">Yes</span>':'<span class="na">No</span>';

function table(headers,rows){
 return '<div class="table-wrap"><table><thead><tr>'+headers.map(x=>'<th>'+x+'</th>').join('')+'</tr></thead><tbody>'+rows.map(r=>'<tr>'+r.map(x=>'<td>'+x+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';
}

function renderOverview(){
 $('overview').innerHTML='<div class="cards">'+VENUES.map(v=>'<article class="card '+(v.role==='baseline'?'baseline':'')+'"><small>'+v.role.toUpperCase()+'</small><h2>'+v.name+'</h2><p>'+v.marketModel+'</p><div>'+v.integration.map(x=>'<span class="tag">'+x+'</span>').join('')+'</div><p>White-label: '+(v.whiteLabel?'Yes':'No')+' · Execution candidate: '+(v.executionCandidate?'Yes':'No')+'</p></article>').join('')+'</div>';
}

function renderBD(){
 const rows=bdMatrix().map(v=>[v.name,v.marketModel,v.integration,v.revenue,yn(v.whiteLabel),yn(v.sharedLiquidity),yn(v.executionCandidate)]);
 $('bdTable').innerHTML=table(['Venue','Market model','Integration','Revenue modes','White-label','Shared liquidity','Execution candidate'],rows);
}

function renderFees(){
 const rows=COMMERCIAL_MODELS.map(v=>[
  v.venue,
  v.frontendRevenue.join(', ')||'N/A',
  yn(v.affiliate),
  yn(v.whiteLabel),
  v.feeControl,
  v.checkedAt,
  v.sources.map((d,i)=>'<a href="'+d+'" target="_blank" rel="noopener">Source '+(i+1)+'</a>').join(' · ')
 ]);
 $('feesTable').innerHTML=table(['Venue','Frontend revenue','Affiliate','White-label','Fee control','Checked','Sources'],rows);
}

function renderExecution(){
 const rows=Object.values(INITIAL_QUALIFICATION).map(v=>[
  v.venue,
  v.qualified?'<span class="ok">Qualified</span>':'<span class="na">Research only</span>',
  v.missing.length?String(v.missing.length):'0',
  v.missing.join(', ')||'All gates evidenced',
  v.reviewedAt||'N/A'
 ]);
 $('executionTable').innerHTML=table(['Venue','Status','Missing gates','Required evidence','Reviewed'],rows);
}

function renderIntegration(){
 const rows=VENUES.map(v=>[v.name,v.dataStatus,v.chains.join(', '),v.docs.map((d,i)=>'<a href="'+d+'" target="_blank" rel="noopener">Source '+(i+1)+'</a>').join(' · ')]);
 $('integrationTable').innerHTML=table(['Venue','Data status','Chains','Official sources'],rows);
}

async function refreshLiquidity(){
 $('liquidityTable').textContent='Loading public books…';
 const tasks=[
  ['Hyperliquid',()=>hyperliquidBook('BTC')],
  ['Paradex',()=>paradexBook('BTC-USD-PERP')],
  ['dYdX',()=>dydxBook('BTC-USD')]
 ];
 const results=[];
 for(const [name,fn] of tasks){
  try{
   const raw=await fn(),s=liquiditySnapshot(raw);
   results.push([name,fmt(s.book.spreadBps)+' bps',fmt(s.depth[10].total),fmt(s.depth[25].total),fmt(s.depth[50].total),fmt(s.impact[10000].buy.impactBps)+' bps',new Date(raw.receivedAt).toLocaleTimeString()]);
  }catch(e){
   results.push([name,'N/A','N/A','N/A','N/A','N/A','Unavailable']);
  }
 }
 for(const name of ['Orderly','GMX','Drift'])results.push([name,'N/A','N/A','N/A','N/A','N/A','Collector pending / different model']);
 $('liquidityTable').innerHTML=table(['Venue','Spread','Depth ±10bps USD','Depth ±25bps USD','Depth ±50bps USD','$10k buy impact','Timestamp'],results);
}

for(const b of document.querySelectorAll('[data-tab]'))b.onclick=()=>{
 for(const x of document.querySelectorAll('[data-tab]'))x.setAttribute('aria-pressed',String(x===b));
 for(const p of document.querySelectorAll('[data-panel]'))p.hidden=p.id!==b.dataset.tab;
};
$('refresh').onclick=refreshLiquidity;
renderOverview();renderBD();renderFees();renderExecution();renderIntegration();refreshLiquidity();
