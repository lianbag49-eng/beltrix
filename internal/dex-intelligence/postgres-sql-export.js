import {DEFAULT_RETENTION,retentionCutoffs} from './storage/retention-policy.js';
const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const text=v=>{
 if(v===null||v===undefined)return 'NULL';
 const s=String(v).replace(/\\0/g,'').replace(/\\/g,'\\\\').replace(/'/g,"''");
 return "E'"+s+"'";
};
const json=v=>text(JSON.stringify(v??null))+'::jsonb';
const num=v=>finite(v)?String(Number(v)):'NULL';
const bool=v=>v?'true':'false';
const ts=v=>finite(v)?text(new Date(Number(v)).toISOString())+'::timestamptz':'now()';

function observationTuple(snapshotIdAlias,venue,state){
 const metric=state?.metric||{};
 return [
  snapshotIdAlias,text(venue),bool(Boolean(state?.ok)),text(state?.health||null),
  num(state?.latencyMs),num(state?.spreadBps),num(state?.depth25Usd),num(state?.minFillRatio),
  num(metric?.fundingRate),num(metric?.openInterest),num(metric?.openInterestUsd),text(metric?.openInterestUnit||null),
  num(metric?.volume24h),num(metric?.volume24hUsd),text(metric?.volume24hUnit||null),
  num(state?.capacityLongUsd),num(state?.capacityShortUsd),json(state?.flags||[])
 ].join(',');
}

export function batchToPostgresSql(batch){
 if(!batch||batch.version!==1||!Array.isArray(batch.rows))throw Error('Invalid scheduled collector batch');
 const statements=['begin;'];
 statements.push('insert into mi_collector_runs(started_at,finished_at,successful_assets,failed_assets,payload) values ('+ts(batch.startedAt)+','+ts(batch.finishedAt)+','+num(batch.successful)+','+num(batch.failed)+','+json(batch)+');');
 for(const row of batch.rows){
  if(!row?.ok||!row.snapshot)continue;
  const snap=row.snapshot,flagsByVenue=Object.fromEntries((row.intelligence?.rows||[]).map(x=>[x.venue,x.flags||[]])),entries=Object.entries(snap.venues||{}).map(([venue,state])=>[venue,{...state,flags:flagsByVenue[venue]||state?.flags||[]}]);
  const values=entries.map(([venue,state])=>'('+observationTuple('s.id',venue,state)+')').join(',\n');
  let stmt='with s as (\n'+
   ' insert into mi_snapshots(asset,captured_at,source,payload)\n'+
   ' values ('+text(snap.asset)+','+ts(snap.timestamp)+',\'scheduled-collector\','+json(snap)+')\n'+
   ' returning id\n)\n';
  if(values){
   stmt+='insert into mi_venue_observations(\n'+
    ' snapshot_id,venue,ok,health,latency_ms,spread_bps,depth_25_usd,min_fill_ratio,\n'+
    ' funding_rate,open_interest,open_interest_usd,open_interest_unit,\n'+
    ' volume_24h,volume_24h_usd,volume_24h_unit,capacity_long_usd,capacity_short_usd,flags\n'+
    ')\nselect * from (values\n'+values+'\n) as v(\n'+
    ' snapshot_id,venue,ok,health,latency_ms,spread_bps,depth_25_usd,min_fill_ratio,\n'+
    ' funding_rate,open_interest,open_interest_usd,open_interest_unit,\n'+
    ' volume_24h,volume_24h_usd,volume_24h_unit,capacity_long_usd,capacity_short_usd,flags\n'+
    ');';
  }else stmt+='select id from s;';
  statements.push(stmt);
  const activeAlerts=(row.alerts||[]).filter(x=>x?.venue&&x?.key);
  const activePairs=activeAlerts.map(x=>'('+text(x.venue)+','+text(x.key)+')').join(',');
  statements.push(
   'update mi_alert_events set status=\'resolved\',resolved_at='+ts(snap.timestamp)+',last_seen_at='+ts(snap.timestamp)+
   ' where asset='+text(snap.asset)+' and status in (\'open\',\'acknowledged\')'+
   (activePairs?' and (venue,alert_key) not in ('+activePairs+');':';')
  );
  for(const alert of activeAlerts){
   statements.push(
    'insert into mi_alert_events(asset,venue,alert_key,severity,status,message,evidence,opened_at,last_seen_at)\n'+
    'values ('+text(snap.asset)+','+text(alert.venue)+','+text(alert.key)+','+text(alert.severity)+',\'open\','+text(alert.message)+','+json(alert.evidence||{})+','+ts(snap.timestamp)+','+ts(snap.timestamp)+')\n'+
    'on conflict (asset,venue,alert_key) where status in (\'open\',\'acknowledged\')\n'+
    'do update set severity=excluded.severity,message=excluded.message,evidence=excluded.evidence,last_seen_at=excluded.last_seen_at;'
   );
  }
  for(const event of row.bdEvents||[]){
   if(!event?.venue||!event?.eventType)continue;
   const eventKey=[snap.asset,event.venue,event.eventType,event.title||'',event.detail||''].join('|');
   statements.push(
    'insert into mi_bd_events(event_key,asset,venue,event_type,source,priority,title,detail,evidence,created_at)\n'+
    'values ('+text(eventKey)+','+text(snap.asset)+','+text(event.venue)+','+text(event.eventType)+','+text(event.source||'market-intelligence')+','+text(event.priority||'medium')+','+text(event.title||'')+','+text(event.detail||'')+','+json(event.evidence||{})+','+ts(event.timestamp||snap.timestamp)+')\n'+
    'on conflict (event_key) where event_key is not null do nothing;'
   );
  }
 }
 const cutoffs=retentionCutoffs(DEFAULT_RETENTION,Number(batch.finishedAt)||Date.now());
 statements.push(
  'delete from mi_alert_events where status=\'resolved\' and coalesce(resolved_at,last_seen_at,opened_at) < '+text(cutoffs.resolvedAlertsBefore)+'::timestamptz;',
  'delete from mi_snapshots where captured_at < '+text(cutoffs.snapshotsBefore)+'::timestamptz;',
  'delete from mi_collector_runs where finished_at < '+text(cutoffs.collectorRunsBefore)+'::timestamptz;',
  'delete from mi_bd_events where created_at < '+text(cutoffs.bdEventsBefore)+'::timestamptz;'
 );
 statements.push('commit;');
 return statements.join('\n\n')+'\n';
}
