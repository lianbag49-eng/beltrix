export function alertsToBdEvents(alerts,{asset,timestamp=Date.now()}={}){
 const events=[];
 for(const item of alerts||[]){
  if(!['warning','critical'].includes(item.severity))continue;
  const high=item.severity==='critical';
  events.push(Object.freeze({
   venue:item.venue,
   eventType:'market-intelligence-alert',
   source:'market-intelligence',
   priority:high?'high':'medium',
   title:(high?'Critical':'Watch')+' · '+item.venue+' · '+item.key,
   detail:item.message,
   asset:String(asset||''),
   timestamp:Number(timestamp),
   evidence:Object.freeze({...item.evidence,severity:item.severity})
  }));
 }
 return Object.freeze(events);
}

export function summarizeBdEvents(events=[]){
 const byVenue={};
 for(const event of events){
  const row=byVenue[event.venue]||(byVenue[event.venue]={total:0,high:0,medium:0,low:0,lastAt:null});
  row.total+=1;
  row[event.priority]=(row[event.priority]||0)+1;
  row.lastAt=Math.max(row.lastAt||0,event.timestamp||0);
 }
 return Object.freeze(byVenue);
}
