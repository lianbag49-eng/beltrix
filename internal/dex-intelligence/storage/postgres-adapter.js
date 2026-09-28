const json=v=>JSON.stringify(v??null);

export function createPostgresTelemetryAdapter(client){
 if(!client||typeof client.query!=='function')throw Error('Postgres adapter requires a query-capable client');

 return Object.freeze({
  async insertSnapshot(record){
   await client.query('BEGIN');
   try{
    const head=await client.query(
     `insert into mi_snapshots(asset,captured_at,source,payload)
      values ($1,$2,$3,$4::jsonb)
      returning id`,
     [record.asset,record.capturedAt,'collector',json(record.payload)]
    );
    const snapshotId=head.rows[0].id;
    for(const row of record.observations){
     await client.query(
      `insert into mi_venue_observations(
       snapshot_id,venue,ok,health,latency_ms,spread_bps,depth_25_usd,min_fill_ratio,
       funding_rate,open_interest,open_interest_usd,open_interest_unit,
       volume_24h,volume_24h_usd,volume_24h_unit,capacity_long_usd,capacity_short_usd,flags
      ) values (
       $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18::jsonb
      )`,
      [
       snapshotId,row.venue,row.ok,row.health,row.latencyMs,row.spreadBps,row.depth25Usd,row.minFillRatio,
       row.fundingRate,row.openInterest,row.openInterestUsd,row.openInterestUnit,
       row.volume24h,row.volume24hUsd,row.volume24hUnit,row.capacityLongUsd,row.capacityShortUsd,json(row.flags)
      ]
     );
    }
    await client.query('COMMIT');
    return Object.freeze({snapshotId});
   }catch(error){
    await client.query('ROLLBACK');
    throw error;
   }
  },

  async querySnapshots({asset,since,limit=1000}={}){
   const result=await client.query(
    `select asset,captured_at,payload
       from mi_snapshots
      where ($1::text is null or asset=$1)
        and ($2::timestamptz is null or captured_at >= $2::timestamptz)
      order by captured_at asc
      limit $3`,
    [asset||null,since||null,limit]
   );
   return result.rows.map(row=>row.payload);
  },

  async queryCollectorHealth({limit=100}={}){
   const result=await client.query(
    `select finished_at,successful_assets,failed_assets,healthy
       from mi_collector_health_recent
      order by finished_at desc
      limit $1`,
    [Math.max(1,Math.min(500,Number(limit)||100))]
   );
   return result.rows;
  },

  async queryOpenAlerts({limit=200}={}){
   const result=await client.query(
    `select id,asset,venue,alert_key,severity,status,message,evidence,opened_at,last_seen_at
       from mi_open_alerts
      limit $1`,
    [Math.max(1,Math.min(1000,Number(limit)||200))]
   );
   return result.rows;
  },

  async updateAlertStatus({id,status}={}){
   if(!Number.isInteger(Number(id))||Number(id)<=0)throw Error('Invalid alert id');
   if(!['acknowledged','resolved'].includes(status))throw Error('Invalid alert status');
   const result=await client.query(
    `update mi_alert_events
        set status=$2,
            resolved_at=case when $2='resolved' then now() else resolved_at end,
            last_seen_at=greatest(last_seen_at,now())
      where id=$1 and status in ('open','acknowledged')
      returning id,asset,venue,alert_key,severity,status,message,evidence,opened_at,last_seen_at,resolved_at`,
    [Number(id),status]
   );
   return result.rows[0]||null;
  }
 });
}
