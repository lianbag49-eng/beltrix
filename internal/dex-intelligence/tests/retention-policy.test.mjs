import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_RETENTION,retentionCutoffs,retentionSql} from '../storage/retention-policy.js';

test('default retention windows are explicit and bounded',()=>{
 assert.deepEqual(DEFAULT_RETENTION,{snapshotsDays:30,collectorRunsDays:30,resolvedAlertsDays:90,bdEventsDays:180});
 const now=Date.UTC(2026,8,28);
 const c=retentionCutoffs(DEFAULT_RETENTION,now);
 assert.equal(c.snapshotsBefore,'2026-08-29T00:00:00.000Z');
 assert.equal(c.resolvedAlertsBefore,'2026-06-30T00:00:00.000Z');
});

test('retention SQL deletes only old telemetry classes with parameterized cutoffs',()=>{
 const rows=retentionSql({},Date.UTC(2026,8,28));
 assert.equal(rows.length,4);
 assert.ok(rows.every(x=>x.sql.includes('$1')));
 assert.equal(rows.find(x=>x.table==='mi_alert_events').sql.includes("status='resolved'"),true);
 assert.equal(rows.find(x=>x.table==='mi_snapshots').sql.includes('captured_at < $1'),true);
});

test('retention days are clamped to a safe positive range',()=>{
 const c=retentionCutoffs({snapshotsDays:0,collectorRunsDays:-3,resolvedAlertsDays:999999,bdEventsDays:1},Date.UTC(2026,8,28));
 assert.equal(typeof c.snapshotsBefore,'string');
 assert.equal(new Date(c.resolvedAlertsBefore).getUTCFullYear()>=2016,true);
});
