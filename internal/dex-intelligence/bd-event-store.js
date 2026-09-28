const json=v=>JSON.stringify(v??{});

export async function persistBdEvents(client,events=[]){
 if(!client||typeof client.query!=='function')throw Error('BD event store requires query client');
 let inserted=0;
 for(const event of events||[]){
  if(!event?.venue||!event?.eventType)continue;
  const asset=String(event.asset||'').toUpperCase();
  const eventKey=[asset,event.venue,event.eventType,event.title||'',event.detail||''].join('|');
  const result=await client.query(
   `insert into mi_bd_events(event_key,asset,venue,event_type,source,priority,title,detail,evidence,created_at)
    values ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10)
    on conflict (event_key) where event_key is not null do nothing
    returning id`,
   [
    eventKey,asset||null,event.venue,event.eventType,event.source||'market-intelligence',
    event.priority||'medium',event.title||'',event.detail||'',json(event.evidence||{}),
    new Date(Number(event.timestamp)||Date.now()).toISOString()
   ]
  );
  if(result.rows?.length)inserted++;
 }
 return Object.freeze({inserted});
}
