import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluatePersistenceSchema,schemaVerificationSql} from '../storage/schema-readiness.js';

test('schema readiness requires all Market Intelligence tables and views',()=>{
 const good=evaluatePersistenceSchema({
  tables:['mi_collector_runs','mi_snapshots','mi_venue_observations','mi_alert_events','mi_bd_events'],
  views:['mi_latest_venue_state','mi_collector_health_recent','mi_open_alerts']
 });
 assert.equal(good.ready,true);
 assert.deepEqual(good.missingTables,[]);
 assert.deepEqual(good.missingViews,[]);
});

test('schema readiness reports exact missing objects without guessing',()=>{
 const out=evaluatePersistenceSchema({tables:[{table_name:'mi_snapshots'}],views:[]});
 assert.equal(out.ready,false);
 assert.ok(out.missingTables.includes('mi_collector_runs'));
 assert.ok(out.missingViews.includes('mi_open_alerts'));
});

test('verification SQL is read-only evidence',()=>{
 const statements=schemaVerificationSql();
 assert.ok(statements.length>=5);
 for(const sql of statements)assert.match(sql,/^select\s/i);
});
