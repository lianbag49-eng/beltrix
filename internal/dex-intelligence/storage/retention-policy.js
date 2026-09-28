export const DEFAULT_RETENTION=Object.freeze({
 snapshotsDays:30,
 collectorRunsDays:30,
 resolvedAlertsDays:90,
 bdEventsDays:180
});

const boundedDays=(value,fallback)=>Math.max(1,Math.min(3650,Number(value)||fallback));

export function retentionCutoffs(policy=DEFAULT_RETENTION,now=Date.now()){
 const iso=days=>new Date(now-boundedDays(days,1)*86400000).toISOString();
 return Object.freeze({
  snapshotsBefore:iso(policy.snapshotsDays??DEFAULT_RETENTION.snapshotsDays),
  collectorRunsBefore:iso(policy.collectorRunsDays??DEFAULT_RETENTION.collectorRunsDays),
  resolvedAlertsBefore:iso(policy.resolvedAlertsDays??DEFAULT_RETENTION.resolvedAlertsDays),
  bdEventsBefore:iso(policy.bdEventsDays??DEFAULT_RETENTION.bdEventsDays)
 });
}

export function retentionSql(policy=DEFAULT_RETENTION,now=Date.now()){
 const c=retentionCutoffs(policy,now);
 return Object.freeze([
  {table:'mi_snapshots',sql:'delete from mi_snapshots where captured_at < $1',params:[c.snapshotsBefore]},
  {table:'mi_collector_runs',sql:'delete from mi_collector_runs where finished_at < $1',params:[c.collectorRunsBefore]},
  {table:'mi_alert_events',sql:"delete from mi_alert_events where status='resolved' and resolved_at < $1",params:[c.resolvedAlertsBefore]},
  {table:'mi_bd_events',sql:'delete from mi_bd_events where created_at < $1',params:[c.bdEventsBefore]}
 ]);
}
