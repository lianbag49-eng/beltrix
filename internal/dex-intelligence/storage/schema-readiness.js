const requiredTables=Object.freeze([
 'mi_collector_runs','mi_snapshots','mi_venue_observations','mi_alert_events','mi_bd_events'
]);
const requiredViews=Object.freeze([
 'mi_latest_venue_state','mi_collector_health_recent','mi_open_alerts'
]);

const clean=x=>String(x||'').trim().toLowerCase();

export function evaluatePersistenceSchema({tables=[],views=[]}={}){
 const tableSet=new Set(tables.map(x=>clean(x.name||x.table_name||x)));
 const viewSet=new Set(views.map(x=>clean(x.name||x.table_name||x)));
 const missingTables=requiredTables.filter(x=>!tableSet.has(x));
 const missingViews=requiredViews.filter(x=>!viewSet.has(x));
 return Object.freeze({
  ready:missingTables.length===0&&missingViews.length===0,
  requiredTables,
  requiredViews,
  missingTables:Object.freeze(missingTables),
  missingViews:Object.freeze(missingViews)
 });
}

export function schemaVerificationSql(){
 return Object.freeze([
  `select table_name from information_schema.tables where table_schema='public' and table_name like 'mi_%' order by table_name`,
  `select table_name from information_schema.views where table_schema='public' and table_name like 'mi_%' order by table_name`,
  `select count(*)::int as snapshots from mi_snapshots`,
  `select count(*)::int as collector_runs from mi_collector_runs`,
  `select count(*)::int as open_alerts from mi_open_alerts`
 ]);
}
