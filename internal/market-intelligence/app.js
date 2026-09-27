import {MARKET_INTELLIGENCE_AS_OF,VENUES,money} from './venues.js';

const $=id=>document.getElementById(id);
const state={query:'',focus:'all'};

function yes(value){return value?'Yes':'No'}
function esc(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function sourceLinks(venue){return venue.sources.map(s=>'<a href="'+esc(s.url)+'" target="_blank" rel="noopener">'+esc(s.label)+'</a>').join(' · ')}

function filterVenue(v){
 const q=state.query.toLowerCase();
 if(state.focus==='white-label'&&!v.integration.turnkeyDexCreator&&!v.integration.customFrontend)return false;
 if(state.focus==='affiliate'&&!/referral|affiliate/i.test(v.economics.referral))return false;
 if(state.focus==='execution'&&!v.integration.orderRouting)return false;
 if(!q)return true;
 return [v.name,v.category].concat(v.chains,v.useCases,[v.bd.path,v.economics.whiteLabel,v.economics.referral]).join(' ').toLowerCase().includes(q);
}

function metricBar(value,max){if(value==null||!max)return 0;return Math.max(2,Math.min(100,value/max*100))}
function feeText(v){
 const maker=v.fees.makerBasePct==null?'Dynamic / verify':v.fees.makerBasePct+'% maker';
 const taker=v.fees.takerBasePct==null?'Dynamic / verify':v.fees.takerBasePct+'% taker';
 return maker+' · '+taker;
}

function venueCard(v,maxVol){
 const warning=v.metrics.warning?'<p class="warning">'+esc(v.metrics.warning)+'</p>':'';
 const uses=v.useCases.map(x=>'<li>'+esc(x)+'</li>').join('');
 const cautions=v.cautions.map(x=>'<li>'+esc(x)+'</li>').join('');
 return '<article class="venue">'+
  '<header><div><h2>'+esc(v.name)+'</h2><p>'+esc(v.category)+'</p></div><span class="status">'+esc(v.bd.status)+'</span></header>'+
  '<div class="metric"><span>30d perp volume</span><strong>'+money(v.metrics.perpVolume30d)+'</strong><i><b style="width:'+metricBar(v.metrics.perpVolume30d,maxVol)+'%"></b></i></div>'+
  '<div class="metric"><span>Open interest</span><strong>'+money(v.metrics.openInterest)+'</strong></div>'+
  warning+
  '<dl>'+
   '<div><dt>Base fees</dt><dd>'+esc(feeText(v))+'</dd></div>'+
   '<div><dt>Referral / affiliate</dt><dd>'+esc(v.economics.referral)+'</dd></div>'+
   '<div><dt>Frontend revenue</dt><dd>'+esc(v.economics.frontendRevenue)+'</dd></div>'+
   '<div><dt>White-label</dt><dd>'+esc(v.economics.whiteLabel)+'</dd></div>'+
   '<div><dt>BD route</dt><dd>'+esc(v.bd.path)+'</dd></div>'+
  '</dl>'+
  '<div class="flags">'+
   '<span>API '+yes(v.integration.publicApi)+'</span>'+
   '<span>WS '+yes(v.integration.websocket)+'</span>'+
   '<span>Custom UI '+yes(v.integration.customFrontend)+'</span>'+
   '<span>DEX Creator '+yes(v.integration.turnkeyDexCreator)+'</span>'+
   '<span>Order route '+yes(v.integration.orderRouting)+'</span>'+
  '</div>'+
  '<details><summary>Internal use & cautions</summary>'+
   '<h3>Use cases</h3><ul>'+uses+'</ul>'+
   '<h3>Cautions</h3><ul>'+cautions+'</ul>'+
   '<p class="sources">'+sourceLinks(v)+'</p>'+
  '</details>'+
 '</article>';
}

function render(){
 const rows=VENUES.filter(filterVenue);
 $('asOf').textContent='Research snapshot · '+MARKET_INTELLIGENCE_AS_OF+' · verify commercial terms before signing';
 const maxVol=Math.max(...rows.map(v=>v.metrics.perpVolume30d||0),1);
 const total=rows.reduce((s,v)=>s+(v.metrics.perpVolume30d||0),0);
 const summary=[
  ['Venues',rows.length],
  ['30d perp volume',money(total)],
  ['Custom frontends',rows.filter(v=>v.integration.customFrontend).length],
  ['Turnkey DEX creator',rows.filter(v=>v.integration.turnkeyDexCreator).length]
 ];
 $('summary').innerHTML=summary.map(x=>'<div><small>'+esc(x[0])+'</small><strong>'+esc(x[1])+'</strong></div>').join('');
 $('cards').innerHTML=rows.map(v=>venueCard(v,maxVol)).join('');
 $('tableBody').innerHTML=rows.map(v=>
  '<tr><th>'+esc(v.name)+'</th>'+
  '<td>'+money(v.metrics.perpVolume30d)+'</td>'+
  '<td>'+money(v.metrics.openInterest)+'</td>'+
  '<td>'+(v.integration.turnkeyDexCreator?'Turnkey creator':v.integration.customFrontend?'Custom frontend':'Research only')+'</td>'+
  '<td>'+esc(v.bd.status)+'</td></tr>'
 ).join('');
}

$('search').oninput=e=>{state.query=e.target.value;render()};
$('focus').onchange=e=>{state.focus=e.target.value;render()};
render();
