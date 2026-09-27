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
  }
 });
}
