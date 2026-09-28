const json=v=>JSON.stringify(v??{});

export async function persistAlertState(client,{asset,alerts=[],timestamp=Date.now()}={}){
 if(!client||typeof client.query!=='function')throw Error('Alert store requires query client');
 const at=new Date(Number(timestamp)||Date.now()).toISOString();
 const active=(alerts||[]).filter(x=>x?.venue&&x?.key);
 const current=await client.query(
  `select id,venue,alert_key
     from mi_alert_events
    where asset=$1 and status in ('open','acknowledged')`,
  [String(asset||'').toUpperCase()]
 );
 for(const row of current.rows||[]){
  const stillActive=active.some(x=>x.venue===row.venue&&x.key===row.alert_key);
  if(!stillActive){
   await client.query(
    `update mi_alert_events
        set status='resolved',resolved_at=$2,last_seen_at=$2
      where id=$1`,
    [row.id,at]
   );
  }
 }
 for(const alert of active){
  await client.query(
   `insert into mi_alert_events(asset,venue,alert_key,severity,status,message,evidence,opened_at,last_seen_at)
    values ($1,$2,$3,$4,'open',$5,$6::jsonb,$7,$7)
    on conflict (asset,venue,alert_key) where status in ('open','acknowledged')
    do update set severity=excluded.severity,message=excluded.message,evidence=excluded.evidence,last_seen_at=excluded.last_seen_at`,
   [String(asset||'').toUpperCase(),alert.venue,alert.key,alert.severity,alert.message,json(alert.evidence||{}),at]
  );
 }
 return Object.freeze({active:active.length,resolved:Math.max(0,(current.rows||[]).length-active.length)});
}
