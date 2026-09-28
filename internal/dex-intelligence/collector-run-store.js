export async function saveCollectorRun(client,run={}){
 if(!client||typeof client.query!=='function')throw Error('Collector run store requires a query-capable client');
 const startedAt=new Date(Number(run.startedAt)||Date.now()).toISOString();
 const finishedAt=new Date(Number(run.finishedAt)||Date.now()).toISOString();
 const successful=Math.max(0,Number(run.successful)||0);
 const failed=Math.max(0,Number(run.failed)||0);
 const result=await client.query(
  `insert into mi_collector_runs(started_at,finished_at,successful_assets,failed_assets,payload)
   values ($1,$2,$3,$4,$5::jsonb)
   returning id`,
  [startedAt,finishedAt,successful,failed,JSON.stringify(run)]
 );
 return result.rows[0]||null;
}
