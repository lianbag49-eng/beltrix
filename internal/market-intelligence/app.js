import {MARKET_INTELLIGENCE_AS_OF,VENUES,money} from './venues.js';
import {BD_PIPELINE,pipelineCounts} from './bd-crm.js';
import {WHITE_LABEL_MATRIX} from './white-label.js';
import {venueExecutionState,EXECUTION_GATES} from './execution-gates.js';

const $=id=>document.getElementById(id);
const state={query:'',focus:'all',live:new Map(),generatedAt:null};

const yes=value=>value?'Yes':'No';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sourceLinks=venue=>venue.sources.map(s=>'<a href="'+esc(s.url)+'" target="_blank" rel="noopener">'+esc(s.label)+'</a>').join(' · ');

function filterVenue(v){
 const q=state.query.toLowerCase();
 if(state.focus==='white-label'&&!v.integration.turnkeyDexCreator&&!v.integration.customFrontend)return false;
 if(state.focus==='affiliate'&&!/referral|affiliate|distributor/i.test(v.economics.referral))return false;
 if(state.focus==='execution'&&!v.integration.orderRouting)return false;
 if(!q)return true;
 return [v.name,v.category].concat(v.chains,v.useCases,[v.bd.path,v.economics.whiteLabel,v.economics.referral]).join(' ').toLowerCase().includes(q);
}
function currentMetrics(v){
 const live=state.live.get(v.id);
 if(!live||live.error)return {volume:v.metrics.perpVolume30d,oi:v.metrics.openInterest,label:'30d snapshot',confidence:v.metrics.warning?'warning':'snapshot'};
 return {volume:live.volume24h??v.metrics.perpVolume30d,oi:live.openInterestUsd??v.metrics.openInterest,label:live.volume24h!=null?'24h direct':'snapshot fallback',confidence:live.confidence||'direct'};
}
function metricBar(value,max){if(value==null||!max)return 0;return Math.max(2,Math.min(100,value/max*100))}
function feeText(v){
 const maker=v.fees.makerBasePct==null?'Dynamic / verify':v.fees.makerBasePct+'% maker';
 const taker=v.fees.takerBasePct==null?'Dynamic / verify':v.fees.takerBasePct+'% taker';
 return maker+' · '+taker;
}
function venueCard(v,maxVol){
 const m=currentMetrics(v),live=state.live.get(v.id);
 const warning=[v.metrics.warning,live?.error?'Live collector: '+live.error:null].filter(Boolean).map(x=>'<p class="warning">'+esc(x)+'</p>').join('');
 return '<article class="venue">'+
  '<header><div><h2>'+esc(v.name)+'</h2><p>'+esc(v.category)+'</p></div><span class="status">'+esc(v.bd.status)+'</span></header>'+
  '<div class="metric"><span>'+esc(m.label)+' volume</span><strong>'+money(m.volume)+'</strong><i><b style="width:'+metricBar(m.volume,maxVol)+'%"></b></i></div>'+
  '<div class="metric"><span>Open interest</span><strong>'+money(m.oi)+'</strong></div>'+
  '<p class="confidence">Data: '+esc(m.confidence)+(live?.retrievedAt?' · '+esc(new Date(live.retrievedAt).toLocaleString()):'')+'</p>'+
  warning+
  '<dl>'+
   '<div><dt>Base fees</dt><dd>'+esc(feeText(v))+'</dd></div>'+
   '<div><dt>Referral / affiliate</dt><dd>'+esc(v.economics.referral)+'</dd></div>'+
   '<div><dt>Frontend revenue</dt><dd>'+esc(v.economics.frontendRevenue)+'</dd></div>'+
   '<div><dt>White-label</dt><dd>'+esc(v.economics.whiteLabel)+'</dd></div>'+
   '<div><dt>BD route</dt><dd>'+esc(v.bd.path)+'</dd></div>'+
  '</dl>'+
  '<div class="flags">'+
   '<span>API '+yes(v.integration.publicApi)+'</span><span>WS '+yes(v.integration.websocket)+'</span>'+
   '<span>Custom UI '+yes(v.integration.customFrontend)+'</span><span>DEX Creator '+yes(v.integration.turnkeyDexCreator)+'</span>'+
   '<span>Order route '+yes(v.integration.orderRouting)+'</span>'+
  '</div>'+
  '<details><summary>Internal use & cautions</summary><h3>Use cases</h3><ul>'+v.useCases.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul>'+
  '<h3>Cautions</h3><ul>'+v.cautions.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul><p class="sources">'+sourceLinks(v)+'</p></details>'+
 '</article>';
}
function renderBd(){
 const counts=pipelineCounts();
 $('bdSummary').textContent=Object.entries(counts).filter(([,n])=>n).map(([s,n])=>s+': '+n).join(' · ');
 $('bdBody').innerHTML=BD_PIPELINE.map(x=>'<tr><th>'+esc(x.venue)+'</th><td>'+esc(x.stage)+'</td><td>'+esc(x.workstream)+'</td><td>'+esc(x.nextAction)+'</td><td>'+esc(x.contactRoute)+'</td></tr>').join('');
}
function renderWhiteLabel(){
 $('whiteLabelBody').innerHTML=WHITE_LABEL_MATRIX.map(x=>'<tr><th>'+esc(x.venue)+'</th><td>'+esc(x.model)+'</td><td>'+yes(x.turnkey)+'</td><td>'+yes(x.sharedLiquidity)+'</td><td>'+esc(x.customFees)+'</td><td>'+esc(x.role)+'</td></tr>').join('');
}
function renderExecution(){
 $('gateLegend').textContent=EXECUTION_GATES.map(x=>x.id).join(' · ');
 $('executionBody').innerHTML=VENUES.map(v=>{const g=venueExecutionState(v.id);return '<tr><th>'+esc(v.name)+'</th><td class="'+(g.eligible?'ok':'blocked')+'">'+(g.eligible?'Eligible':'Blocked')+'</td><td>'+esc(g.missing.join(', ')||'—')+'</td></tr>'}).join('');
}
function render(){
 const rows=VENUES.filter(filterVenue),metrics=rows.map(currentMetrics),maxVol=Math.max(...metrics.map(x=>x.volume||0),1);
 $('asOf').textContent='Research snapshot · '+MARKET_INTELLIGENCE_AS_OF+(state.generatedAt?' · live pull '+new Date(state.generatedAt).toLocaleString():' · no live snapshot loaded');
 const total=metrics.reduce((s,v)=>s+(v.volume||0),0);
 const summary=[['Venues',rows.length],['Displayed volume',money(total)],['Custom frontends',rows.filter(v=>v.integration.customFrontend).length],['Turnkey DEX creator',rows.filter(v=>v.integration.turnkeyDexCreator).length]];
 $('summary').innerHTML=summary.map(x=>'<div><small>'+esc(x[0])+'</small><strong>'+esc(x[1])+'</strong></div>').join('');
 $('cards').innerHTML=rows.map(v=>venueCard(v,maxVol)).join('');
 $('tableBody').innerHTML=rows.map(v=>{const m=currentMetrics(v);return '<tr><th>'+esc(v.name)+'</th><td>'+money(m.volume)+'</td><td>'+money(m.oi)+'</td><td>'+esc(m.confidence)+'</td><td>'+(v.integration.turnkeyDexCreator?'Turnkey creator':v.integration.customFrontend?'Custom frontend':'Research only')+'</td><td>'+esc(v.bd.status)+'</td></tr>'}).join('');
 renderBd();renderWhiteLabel();renderExecution();
}
async function loadSnapshot(){
 try{
  const r=await fetch('./snapshot.json',{cache:'no-store'});if(!r.ok)return;
  const data=await r.json();state.generatedAt=data.generatedAt||null;
  for(const row of data.rows||[])state.live.set(row.id,row);
 }catch{}
 render();
}
$('search').oninput=e=>{state.query=e.target.value;render()};
$('focus').onchange=e=>{state.focus=e.target.value;render()};
render();loadSnapshot();
