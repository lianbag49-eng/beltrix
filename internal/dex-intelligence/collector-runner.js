import {collectAssetBooks,collectGmxState} from './market-snapshot.js';
import {collectMarketMetrics} from './market-metrics.js';
import {makeTelemetrySnapshot} from './telemetry-history.js';
import {buildMarketIntelligence} from './market-intelligence.js';
import {evaluateMarketAlerts,dedupeAlerts} from './alert-engine.js';
import {alertsToBdEvents} from './bd-events.js';

export async function runMarketIntelligenceCycle(asset,{
 fetchImpl=fetch,
 repository=null,
 notionalUsd=10000,
 feeBpsByVenue={},
 now=Date.now(),
 healthByVenue={},
 previousByVenue={}
}={}){
 const [bookRows,gmxState,metricRows]=await Promise.all([
  collectAssetBooks(asset,{fetchImpl,notionalUsd,feeBpsByVenue,now}),
  collectGmxState(asset,{fetchImpl}),
  collectMarketMetrics(asset,{fetchImpl})
 ]);
 const timestamp=Date.now();
 const snapshot=makeTelemetrySnapshot({asset,bookRows,gmxState,metricRows,timestamp});
 const intelligence=buildMarketIntelligence({bookRows,gmxState});
 const alerts=dedupeAlerts(evaluateMarketAlerts(intelligence.rows,{healthByVenue,previousByVenue}));
 const bdEvents=alertsToBdEvents(alerts,{asset,timestamp});
 let persistence=null;
 if(repository?.save)persistence=await repository.save(snapshot);
 return Object.freeze({
  asset:String(asset),
  timestamp,
  bookRows,
  gmxState,
  metricRows,
  snapshot,
  intelligence,
  alerts,
  bdEvents,
  persistence
 });
}
