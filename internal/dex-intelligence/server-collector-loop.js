import {runMarketIntelligenceCycle} from './collector-runner.js';
import {saveCollectorRun} from './collector-run-store.js';
import {persistAlertState} from './alert-store.js';
import {persistBdEvents} from './bd-event-store.js';

export function createServerCollectorLoop({
 repository,
 queryClient,
 assets=['BTC','ETH','SOL'],
 intervalMs=15*60*1000,
 cycle=runMarketIntelligenceCycle,
 now=()=>Date.now(),
 logger=console
}={}){
 if(!repository||typeof repository.save!=='function')throw Error('Collector loop requires telemetry repository');
 if(!queryClient||typeof queryClient.query!=='function')throw Error('Collector loop requires query client');
 const normalized=[...new Set((assets||[]).map(x=>String(x||'').trim().toUpperCase()).filter(Boolean))];
 let timer=null,running=false,stopped=false,last=null;

 async function run(){
  if(running||stopped)return last;
  running=true;
  const startedAt=now(),rows=[];
  try{
   for(const asset of normalized){
    const assetStarted=now();
    try{
     const result=await cycle(asset,{repository,now:assetStarted});
     const alertPersistence=await persistAlertState(queryClient,{asset,alerts:result.alerts||[],timestamp:result.timestamp||now()});
     const bdPersistence=await persistBdEvents(queryClient,result.bdEvents||[]);
     rows.push(Object.freeze({
      asset,ok:true,durationMs:Math.max(0,now()-assetStarted),
      alerts:(result.alerts||[]).length,
      bdEvents:(result.bdEvents||[]).length,
      persistence:result.persistence||null,
      alertPersistence,
      bdPersistence
     }));
    }catch(error){
     rows.push(Object.freeze({asset,ok:false,durationMs:Math.max(0,now()-assetStarted),error:String(error?.message||error)}));
    }
   }
   const successful=rows.filter(x=>x.ok).length,failed=rows.length-successful,finishedAt=now();
   last=Object.freeze({version:1,startedAt,finishedAt,successful,failed,assets:Object.freeze([...normalized]),rows:Object.freeze(rows)});
   await saveCollectorRun(queryClient,last);
   logger.info?.('BELTRIX collector cycle '+JSON.stringify({successful,failed,assets:normalized,finishedAt:new Date(finishedAt).toISOString()}));
   return last;
  }finally{
   running=false;
  }
 }

 function start({immediate=true}={}){
  if(timer||stopped)return;
  if(immediate)void run().catch(error=>logger.error?.('BELTRIX collector cycle failed',error));
  timer=setInterval(()=>void run().catch(error=>logger.error?.('BELTRIX collector cycle failed',error)),Math.max(60000,Number(intervalMs)||15*60*1000));
  timer.unref?.();
 }
 function stop(){
  stopped=true;
  if(timer){clearInterval(timer);timer=null}
 }
 function status(){return Object.freeze({running,stopped,last});}
 return Object.freeze({run,start,stop,status});
}
