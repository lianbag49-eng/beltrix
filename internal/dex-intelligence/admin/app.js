import {VENUES} from '../venue-registry.js';
import {bdMatrix} from '../bd-matrix.js';
import {COMMERCIAL_MODELS} from '../commercial-model.js';
import {INITIAL_QUALIFICATION} from '../execution-qualification.js';
import {INITIAL_BD_PIPELINE,nextActionState} from '../bd-pipeline.js';
import {SUPPORTED_CANONICAL_ASSETS,marketRouting} from '../market-normalizer.js';
import {collectAssetBooks,collectGmxState} from '../market-snapshot.js';
import {collectMarketMetrics} from '../market-metrics.js';
import {makeTelemetrySnapshot,saveTelemetry,loadTelemetry,telemetryForAsset,apiHealthSummary,DEFAULT_HISTORY_KEY} from '../telemetry-history.js';
import {VENUE_RESEARCH,researchProfile,flattenResearch,researchCoverage} from '../venue-research.js';
import {buildMarketIntelligence} from '../market-intelligence.js';
import {evaluateMarketAlerts,dedupeAlerts} from '../alert-engine.js';
import {alertsToBdEvents} from '../bd-events.js';
import {venueTrendSeries,seriesStats,TREND_METRICS} from '../trend-series.js';
import {createServerHistoryClient} from '../server-history-client.js';

const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const fmt=n=>finite(n)?new Intl.NumberFormat('en-US',{maximumFractionDigits:2}).format(Number(n)):'N/A';
const usd=n=>finite(n)?'$'+fmt(n):'N/A';
const bps=n=>finite(n)?fmt(n)+' bps':'N/A';
const pct=n=>finite(n)?(Number(n)*100).toFixed(1)+'%':'N/A';
const rate=n=>finite(n)?(Number(n)*100).toFixed(5)+'%':'N/A';
const yn=v=>v?'<span class="ok">Yes</span>':'<span class="na">No</span>';
const health=v=>v==='healthy'?'<span class="ok">Healthy</span>':v==='degraded'?'<span class="warn">Degraded</span>':v==='live'?'<span class="ok">Live</span>':'<span class="bad">Unavailable</span>';
const statusClass=v=>v==='tested'||v==='implemented'||v==='documented'?'ok':v==='blocked'?'bad':'na';
const severityClass=v=>v==='critical'?'severity-critical':v==='warning'?'severity-warning':'severity-info';

let autoTimer=null;
let latestMetrics=[];
let latestHistory=loadTelemetry(localStorage);
let historySource='local';
let serverHistoryClient=null;
let latestAlerts=[];
let latestBdEvents=[];

function table(headers,rows){
 return '<div class="table-wrap"><table><thead><tr>'+headers.map(x=>'<th>'+esc(x)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(r=>'<tr>'+r.map(x=>'<td>'+x+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';
}

function currentAsset(){return $('assetSelect')?.value||'BTC'}
function currentNotional(){return Math.max(100,Number($('notional')?.value)||10000)}
function serverClient(){
 const base=$('serverApiBase')?.value||'';
 const token=$('serverApiToken')?.value||'';
 serverHistoryClient=createServerHistoryClient({baseUrl:base,getToken:()=>token});
 return serverHistoryClient;
}
function syncHistorySource(){
 historySource=$('historySource')?.value||'local';
 $('serverHistoryConfig').hidden=historySource!=='server';
 $('clearHistory').disabled=historySource!=='local';
 $('autoRefresh').disabled=historySource!=='local';
 renderHistory();
}
async function loadServerHistory(){
 const status=$('serverHistoryStatus'),asset=currentAsset(),hours=Number($('serverHistoryHours')?.value)||168;
 try{
  status.textContent='Loading authenticated server history…';
  const client=serverClient();
  if(!client.enabled)throw Error('Enter the internal API base URL.');
  await client.health();
  const [result,healthResult,alertResult]=await Promise.all([
   client.history({asset,hours,limit:5000}),
   client.collectorHealth(100),
   client.openAlerts(200)
  ]);
  latestHistory=Array.isArray(result?.rows)?result.rows:[];
  latestAlerts=Array.isArray(alertResult?.rows)?alertResult.rows.map(row=>({
   venue:row.venue,severity:row.severity,key:row.alert_key||row.key,message:row.message,evidence:row.evidence||{},
   status:row.status,lastSeenAt:row.last_seen_at||row.lastSeenAt
  })):[];
  historySource='server';
  const healthRows=Array.isArray(healthResult?.rows)?healthResult.rows:[];
  const latestRun=healthRows[0]||null;
  status.textContent=`Loaded ${latestHistory.length} persisted ${asset} snapshots`+(latestRun? ` · last collector run ${new Date(latestRun.finished_at||latestRun.finishedAt).toLocaleString()}`:'')+'.';
  renderAlerts();
  renderHistory();
  renderCollectorStatus();
 }catch(error){
  status.textContent='Server history unavailable: '+String(error?.message||error);
 }
}
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
  const research=researchCoverage(v.id);
  return '<article class="card '+(v.role==='baseline'?'baseline':'')+'"><small>'+esc(v.role.toUpperCase())+'</small><h2>'+esc(v.name)+'</h2><p>'+esc(v.marketModel)+'</p><div>'+v.integration.map(x=>'<span class="tag">'+esc(x)+'</span>').join('')+'</div><p>'+esc(route.asset)+' mapping: <code>'+esc(symbol)+'</code></p><p>White-label: '+(v.whiteLabel?'Yes':'No')+' · Execution candidate: '+(v.executionCandidate?'Yes':'No')+'</p><p>Research coverage: '+pct(research.knownRatio)+'</p></article>';
 }).join('')+'</div>';
}

function renderBdEvents(){
 const rows=(latestBdEvents||[]).map(v=>[
  esc(v.venue),
  '<span class="'+(v.priority==='high'?'bad':v.priority==='medium'?'warn':'na')+'">'+esc(v.priority)+'</span>',
  esc(v.title),
  esc(v.detail),
  esc(v.asset||'N/A'),
  v.timestamp?new Date(v.timestamp).toLocaleString():'N/A'
 ]);
 $('bdEventTable').innerHTML=rows.length
  ?table(['Venue','Priority','Event','Detail','Asset','Time'],rows)
  :'<p class="note">No current Market Intelligence follow-up events.</p>';
}

function renderBD(){
 const pipeline=INITIAL_BD_PIPELINE.map(v=>[
  esc(v.name),'<code>'+esc(v.stage)+'</code>',esc(v.objectives.join(', ')),esc(v.nextAction||'N/A'),esc(v.nextActionAt||'N/A'),
  '<span class="'+(nextActionState(v)==='overdue'?'bad':nextActionState(v)==='due-soon'?'warn':'na')+'">'+esc(nextActionState(v))+'</span>'
 ]);
 $('bdPipeline').innerHTML=table(['Partner','Stage','Objectives','Next action','Due','Action state'],pipeline);

 const orderly=researchProfile('orderly');
 const whiteRows=Object.entries(orderly?.whiteLabel||{}).map(([key,v])=>[
  esc(key),'<span class="'+statusClass(v.status)+'">'+esc(v.status)+'</span>',esc(v.note),
  (v.sources||[]).map((src,i)=>'<a href="'+esc(src)+'" target="_blank" rel="noopener">Source '+(i+1)+'</a>').join(' · ')||'N/A'
 ]);
 $('whiteLabelResearch').innerHTML=table(['Area','Status','Finding','Official sources'],whiteRows);

 const rows=bdMatrix().map(v=>[esc(v.name),esc(v.marketModel),esc(v.integration),esc(v.revenue),yn(v.whiteLabel),yn(v.sharedLiquidity),yn(v.executionCandidate)]);
 $('bdTable').innerHTML=table(['Venue','Market model','Integration','Revenue modes','White-label','Shared liquidity','Execution candidate'],rows);
 renderBdEvents();
}

function renderFees(){
 const rows=COMMERCIAL_MODELS.map(v=>[
  esc(v.venue),esc(v.frontendRevenue.join(', ')||'N/A'),yn(v.affiliate),yn(v.whiteLabel),esc(v.feeControl),esc(v.checkedAt),
  v.sources.map((d,i)=>'<a href="'+esc(d)+'" target="_blank" rel="noopener">Source '+(i+1)+'</a>').join(' · ')
 ]);
 $('feesTable').innerHTML=table(['Venue','Frontend revenue','Affiliate','White-label','Fee control','Checked','Sources'],rows);
}

function renderExecution(){
 const rows=Object.values(INITIAL_QUALIFICATION).map(v=>[
  esc(v.venue),v.qualified?'<span class="ok">Execution qualified</span>':'<span class="na">Research only</span>',
  esc(v.mode),v.missing.length?String(v.missing.length):'0',esc(v.missing.join(', ')||'All gates evidenced'),esc(v.reviewedAt||'N/A')
 ]);
 $('executionTable').innerHTML=table(['Venue','Status','Mode','Missing gates','Required evidence','Reviewed'],rows);

 const researchRows=[];
 for(const [venue,profile] of Object.entries(VENUE_RESEARCH)){
  for(const row of flattenResearch(profile)){
   if(row.group!=='execution')continue;
   researchRows.push([
    esc(venue),esc(row.key),'<span class="'+statusClass(row.status)+'">'+esc(row.status)+'</span>',esc(row.note),
    row.sources.map((src,i)=>'<a href="'+esc(src)+'" target="_blank" rel="noopener">Source '+(i+1)+'</a>').join(' · ')||'N/A'
   ]);
  }
 }
 $('researchTable').innerHTML=table(['Venue','Area','External research','Finding / BELTRIX state','Sources'],researchRows);
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

function renderAlerts(alerts=latestAlerts){
 const rows=(alerts||[]).map(v=>[
  esc(v.venue),
  '<span class="'+severityClass(v.severity)+'">'+esc(v.severity)+'</span>',
  esc(v.key),
  esc(v.message),
  '<code>'+esc(JSON.stringify(v.evidence||{}))+'</code>'
 ]);
 $('alertTable').innerHTML=rows.length
  ?table(['Venue','Severity','Alert','Message','Evidence'],rows)
  :'<p class="ok">No current venue-health alerts for this snapshot.</p>';
}

function renderCollectorStatus(){
 const asset=currentAsset(),history=telemetryForAsset(latestHistory,asset),latest=history.at(-1)||null;
 const ageMin=latest?.timestamp?Math.max(0,(Date.now()-Number(latest.timestamp))/60000):null;
 const freshness=ageMin===null?'No data':ageMin<=30?'Fresh':ageMin<=90?'Delayed':'Stale';
 const open=(latestAlerts||[]).filter(x=>['warning','critical'].includes(x.severity));
 const critical=open.filter(x=>x.severity==='critical').length;
 const warning=open.filter(x=>x.severity==='warning').length;
 const venueRows=latest?Object.entries(latest.venues||{}).map(([venue,v])=>[
  esc(venue),health(v.health|| (v.ok?'healthy':'unavailable')),
  finite(v.latencyMs)?fmt(v.latencyMs)+' ms':'N/A',
  (v.flags||[]).map(x=>'<span class="tag">'+esc(x)+'</span>').join(' ')||'None'
 ]):[];
 $('collectorStatusCards').innerHTML=[
  ['Collector',freshness],
  ['Critical alerts',critical],
  ['Warnings',warning],
  ['Venues observed',venueRows.length]
 ].map(([label,value])=>'<article class="summary-card"><strong>'+esc(value)+'</strong><span>'+esc(label)+'</span></article>').join('');
 $('collectorStatusTable').innerHTML=venueRows.length
  ?table(['Venue','Health','Latency','Flags'],venueRows)
  :'<p class="note">No persisted collector snapshot is available for '+esc(asset)+'.</p>';
}

function renderMarketIntelligence(bookRows,gmx){
 const mi=buildMarketIntelligence({bookRows,gmxState:gmx});
 const s=mi.summary;
 $('miSummary').innerHTML=[
  ['Venues observed',s.venues],['Live / healthy',s.live],['Degraded',s.degraded],['Unavailable',s.unavailable],
  ['Execution qualified',s.executionQualified],['Research only',s.researchOnly]
 ].map(([label,value])=>'<article class="summary-card"><strong>'+esc(value)+'</strong><span>'+esc(label)+'</span></article>').join('');

 $('miTable').innerHTML=table(
  ['Venue','Model','Data','Spread','Depth ±25bps','Min fill','Buy impact','Sell impact','Long capacity','Short capacity','JIT L/S','Missing exec gates','Research coverage','Flags'],
  mi.rows.map(v=>[
   esc(v.venue),esc(v.model),health(v.dataStatus),bps(v.spreadBps),usd(v.depth25Usd),pct(v.minFillRatio),bps(v.buyImpactBps),bps(v.sellImpactBps),
   usd(v.capacityLongUsd),usd(v.capacityShortUsd),esc((v.jitStatusLong||'N/A')+' / '+(v.jitStatusShort||'N/A')),
   esc(v.missingExecutionGates??'N/A'),pct(v.researchKnownRatio),(v.flags||[]).map(x=>'<span class="tag">'+esc(x)+'</span>').join(' ')||'None'
  ])
 );
 return mi;
}

function metricValue(metric,key,usdKey,unitKey){
 if(finite(metric?.[usdKey]))return usd(metric[usdKey]);
 if(finite(metric?.[key]))return fmt(metric[key])+(metric?.[unitKey]?' '+esc(metric[unitKey]):'');
 return 'N/A';
}

function trendValueLabel(value,unit){
 if(!finite(value))return 'N/A';
 if(unit==='USD')return usd(value);
 if(unit==='%')return Number(value).toFixed(5)+'%';
 if(unit==='ms')return fmt(value)+' ms';
 if(unit==='bps')return fmt(value)+' bps';
 return fmt(value)+' '+unit;
}

function trendChartSvg(series){
 const source=(series?.points||[]).slice(-120);
 if(!source.length)return '<p class="note">No stored points for this venue / metric combination yet.</p>';
 const width=900,height=220,padX=44,padY=24;
 let min=Math.min(...source.map(x=>x.value)),max=Math.max(...source.map(x=>x.value));
 if(min===max){const bump=Math.abs(min||1)*0.05||1;min-=bump;max+=bump}
 const span=Math.max(1,max-min);
 const x=(i)=>padX+(i/Math.max(1,source.length-1))*(width-padX*2);
 const y=(v)=>height-padY-((v-min)/span)*(height-padY*2);
 const points=source.map((p,i)=>x(i).toFixed(1)+','+y(p.value).toFixed(1)).join(' ');
 const grids=[0,.25,.5,.75,1].map(f=>{
  const yy=(padY+f*(height-padY*2)).toFixed(1);
  const value=(max-f*span);
  return '<line class="trend-grid" x1="'+padX+'" y1="'+yy+'" x2="'+(width-padX)+'" y2="'+yy+'"/>'+
   '<text class="trend-label" x="4" y="'+(Number(yy)+3)+'">'+esc(trendValueLabel(value,series.unit))+'</text>';
 }).join('');
 const first=source[0],last=source[source.length-1];
 const labels='<text class="trend-label" x="'+padX+'" y="'+(height-4)+'">'+esc(new Date(first.timestamp).toLocaleTimeString())+'</text>'+
  '<text class="trend-label" text-anchor="end" x="'+(width-padX)+'" y="'+(height-4)+'">'+esc(new Date(last.timestamp).toLocaleTimeString())+'</text>';
 const lastDot='<circle class="trend-dot" cx="'+x(source.length-1).toFixed(1)+'" cy="'+y(last.value).toFixed(1)+'" r="3"/>';
 return '<svg viewBox="0 0 '+width+' '+height+'" role="img" aria-label="'+esc(series.label)+' trend">'+grids+'<polyline class="trend-line" points="'+points+'"/>'+lastDot+labels+'</svg>';
}

function renderTrend(){
 const venue=$('trendVenue')?.value||'hyperliquid';
 const metric=$('trendMetric')?.value||'funding';
 const asset=currentAsset();
 const series=venueTrendSeries(latestHistory,{asset,venue,metric});
 const stats=seriesStats(series);
 $('trendStats').innerHTML=[
  ['Points',stats.count],
  ['Minimum',trendValueLabel(stats.min,series.unit)],
  ['Maximum',trendValueLabel(stats.max,series.unit)],
  ['Latest',trendValueLabel(stats.last,series.unit)],
  ['Change',trendValueLabel(stats.change,series.unit)]
 ].map(([label,value])=>'<article class="summary-card"><strong>'+esc(value)+'</strong><span>'+esc(label)+'</span></article>').join('');
 $('trendChart').innerHTML='<p class="note">'+esc(asset)+' · '+esc(venue)+' · '+esc(TREND_METRICS[metric]?.label||metric)+'</p>'+trendChartSvg(series);
}

function previousVenueStates(history,asset){
 const rows=telemetryForAsset(history,asset);
 const previous=rows.length?rows[rows.length-1]:null;
 return previous?.venues||{};
}

function renderHistory(metricRows=latestMetrics){
 const asset=currentAsset();
 const history=telemetryForAsset(latestHistory,asset);
 const sourceNote=$('history')?.querySelector('p.note');
 if(sourceNote)sourceNote.textContent=historySource==='server'
  ?'Persisted server telemetry. Venue-native units are kept when semantics are not safely comparable.'
  :'Snapshots are stored locally in this browser for up to 7 days. Venue-native units are kept when semantics are not safely comparable.';
 const latest=history.at(-1)||null;
 const ageMs=latest?.timestamp?Math.max(0,Date.now()-Number(latest.timestamp)):null;
 const ageMin=ageMs===null?null:ageMs/60000;
 const freshness=ageMin===null?'No data':ageMin<=30?'Fresh':ageMin<=90?'Delayed':'Stale';
 const freshnessClass=freshness==='Fresh'?'ok':freshness==='Delayed'?'warn':freshness==='Stale'?'bad':'na';
 $('historySourceHealth').innerHTML=[
  ['Source',historySource==='server'?'Server':'Local'],
  ['Snapshots',history.length],
  ['Freshness','<span class="'+freshnessClass+'">'+freshness+'</span>'],
  ['Latest',latest?.timestamp?new Date(latest.timestamp).toLocaleString():'N/A']
 ].map(([label,value])=>'<article class="summary-card"><strong>'+value+'</strong><span>'+esc(label)+'</span></article>').join('');
 const healthRows=Object.entries(apiHealthSummary(latestHistory,asset)).map(([venue,v])=>[
  esc(venue),String(v.samples),pct(v.successRatio),fmt(v.avgLatencyMs)+' ms',fmt(v.p95LatencyMs)+' ms',health(v.lastStatus),
  v.lastSeen?new Date(v.lastSeen).toLocaleString():'N/A'
 ]);
 $('healthHistory').innerHTML=healthRows.length?table(['Venue','Samples','Success','Avg latency','P95 latency','Last status','Last seen'],healthRows):'<p class="note">No stored health snapshots yet.</p>';

 const current=(metricRows||[]).map(v=>[
  esc(v.venue),esc(v.symbol),v.ok?'<span class="ok">Live</span>':'<span class="bad">Unavailable</span>',
  finite(v.markPrice)?fmt(v.markPrice):'N/A',rate(v.fundingRate),
  metricValue(v,'openInterest','openInterestUsd','openInterestUnit'),
  metricValue(v,'volume24h','volume24hUsd','volume24hUnit'),
  finite(v.latencyMs)?fmt(v.latencyMs)+' ms':'N/A'
 ]);
 $('metricCurrent').innerHTML=current.length?table(['Venue','Symbol','Status','Mark','Funding','Open interest','24h volume','Metric latency'],current):'<p class="note">Refresh to collect market metrics.</p>';

 const recent=history.slice(-40).reverse().flatMap(s=>Object.entries(s.venues||{}).map(([venue,v])=>[
  new Date(s.timestamp).toLocaleString(),esc(venue),health(v.health),finite(v.latencyMs)?fmt(v.latencyMs)+' ms':'N/A',
  v.metric?rate(v.metric.fundingRate):'N/A',
  v.metric?metricValue(v.metric,'openInterest','openInterestUsd','openInterestUnit'):'N/A',
  v.metric?metricValue(v.metric,'volume24h','volume24hUsd','volume24hUnit'):'N/A',
  finite(v.spreadBps)?bps(v.spreadBps):'N/A',
  finite(v.capacityLongUsd)?usd(v.capacityLongUsd):'N/A',
  finite(v.capacityShortUsd)?usd(v.capacityShortUsd):'N/A'
 ]));
 $('historyTable').innerHTML=recent.length?table(['Time','Venue','Health','Latency','Funding','Open interest','24h volume','Spread','Long cap','Short cap'],recent):'<p class="note">No local snapshots for '+esc(asset)+' yet.</p>';
 renderTrend();
}

function setAutoRefresh(){
 if(autoTimer){clearInterval(autoTimer);autoTimer=null}
 const ms=Number($('autoRefresh')?.value||0);
 if(ms>0)autoTimer=setInterval(()=>refreshLiquidity({record:true}),ms);
}

async function refreshLiquidity({record=true}={}){
 const asset=currentAsset(),notional=currentNotional(),fees=feeAssumptions();
 const previousByVenue=previousVenueStates(latestHistory,asset);
 $('liquidityStatus').textContent='Loading '+asset+' public market data…';
 $('liquidityTable').textContent='';
 $('gmxState').textContent='Loading GMX pool state…';

 const [rows,gmx,metrics]=await Promise.all([
  collectAssetBooks(asset,{notionalUsd:notional,feeBpsByVenue:fees}),
  collectGmxState(asset),
  collectMarketMetrics(asset)
 ]);
 latestMetrics=metrics;

 $('liquidityStatus').textContent='Read-only snapshot · '+asset+' · $'+fmt(notional)+' simulated order · refreshed '+new Date().toLocaleTimeString();

 const rendered=rows.map(v=>{
  if(!v.ok)return [esc(v.venue),'<code>'+esc(v.symbol)+'</code>',health('unavailable'),'N/A','N/A','N/A','N/A','N/A','N/A','N/A','N/A','<span class="bad">'+esc(v.error)+'</span>'];
  const s=v.snapshot;
  return [
   esc(v.venue),'<code>'+esc(v.symbol)+'</code>',health(v.health.status),bps(s.book.spreadBps),usd(s.depth[25].total),
   bps(v.buy?.marketImpactBps),bps(v.sell?.marketImpactBps),v.buy?.feeBps===null?'N/A':bps(v.buy.feeBps),
   bps(v.buy?.effectiveCostBps),bps(v.sell?.effectiveCostBps),pct(Math.min(v.buy?.fillRatio??0,v.sell?.fillRatio??0)),
   v.receivedAt?new Date(v.receivedAt).toLocaleTimeString():'N/A'
  ];
 });
 $('liquidityTable').innerHTML=table(['Venue','Symbol','Health','Spread','Depth ±25bps','Buy impact','Sell impact','Fee input','Buy effective','Sell effective','Min fill','Timestamp'],rendered);

 const cap=gmx.capacity||{},long=cap.long,short=cap.short;
 $('gmxState').innerHTML=gmx.ok
  ?'<strong>GMX '+esc(gmx.chain)+'</strong> · market-state endpoint healthy · '+fmt(gmx.marketCount)+' markets · '+fmt(gmx.matchingMarkets)+' '+esc(asset)+' matches'+
   (gmx.matchedSymbol?' · <code>'+esc(gmx.matchedSymbol)+'</code>':'')+
   '<br>Long capacity: '+usd(long?.availableLiquidityUsd)+' ('+esc(long?.jitDataStatus||'N/A')+') · Short capacity: '+usd(short?.availableLiquidityUsd)+' ('+esc(short?.jitDataStatus||'N/A')+')'+
   (gmx.capacityError?'<br><span class="warn">Capacity partial: '+esc(gmx.capacityError)+'</span>':'')+
   '<br><span class="note">'+esc(gmx.note)+'</span>'
  :'<strong>GMX '+esc(gmx.chain)+'</strong> · <span class="bad">Unavailable</span> · '+esc(gmx.error||'collector error');

 if(record&&historySource==='local'){
  const snapshot=makeTelemetrySnapshot({asset,bookRows:rows,gmxState:gmx,metricRows:metrics,timestamp:Date.now()});
  latestHistory=saveTelemetry(localStorage,snapshot,{maxEntries:720,maxAgeMs:7*24*60*60*1000});
 }
 const mi=renderMarketIntelligence(rows,gmx);
 const healthByVenue=apiHealthSummary(latestHistory,asset);
 latestAlerts=dedupeAlerts(evaluateMarketAlerts(mi.rows,{healthByVenue,previousByVenue}));
 latestBdEvents=alertsToBdEvents(latestAlerts,{asset,timestamp:Date.now()});
 renderAlerts();
 renderBdEvents();
 renderHistory(metrics);
 renderCollectorStatus();
}

for(const b of document.querySelectorAll('[data-tab]'))b.onclick=()=>{
 for(const x of document.querySelectorAll('[data-tab]'))x.setAttribute('aria-pressed',String(x===b));
 for(const p of document.querySelectorAll('[data-panel]'))p.hidden=p.id!==b.dataset.tab;
};

$('refresh').onclick=()=>{renderOverview();refreshLiquidity({record:true})};
$('assetSelect').onchange=async()=>{renderOverview();if(historySource==='server')await loadServerHistory();else renderHistory();refreshLiquidity({record:true})};
$('notional').onchange=()=>refreshLiquidity({record:true});
$('historySource').onchange=async()=>{syncHistorySource();if($('historySource').value==='server')await loadServerHistory();else{latestHistory=loadTelemetry(localStorage);historySource='local';renderHistory();}};
$('loadServerHistory').onclick=loadServerHistory;
$('serverHistoryHours').onchange=()=>{if(historySource==='server')loadServerHistory()};
$('autoRefresh').onchange=setAutoRefresh;
$('trendVenue').onchange=renderTrend;
$('trendMetric').onchange=renderTrend;
$('clearHistory').onclick=()=>{
 localStorage.removeItem(DEFAULT_HISTORY_KEY);
 latestHistory=[];
 renderHistory();
};
for(const x of document.querySelectorAll('[data-fee]'))x.onchange=()=>refreshLiquidity({record:true});

renderOverview();
renderBD();
renderFees();
renderExecution();
renderIntegration();
renderAlerts();
renderBdEvents();
syncHistorySource();
renderHistory();
refreshLiquidity({record:true});
