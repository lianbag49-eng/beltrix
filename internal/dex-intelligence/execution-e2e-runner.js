const terminalStatus=value=>['CANCELLED','CANCELED','FILLED','REJECTED','FAILED','EXPIRED'].includes(String(value||'').toUpperCase());
const restingStatus=value=>['NEW','OPEN','PENDING','ACCEPTED','PARTIALLY_FILLED','PARTIAL_FILLED'].includes(String(value||'').toUpperCase());

function requireTestnet(client,confirmTestnet){
 if(!client||client.mode!=='testnet-only')throw Error('BELTRIX E2E runner accepts testnet-only clients.');
 if(confirmTestnet!==true)throw Error('Explicit confirmTestnet=true is required before creating a test order.');
}
function freezeEvidence(venue,steps,details={}){
 const complete=steps.every(x=>x.passed);
 return Object.freeze({
  venue,
  mode:'testnet-only',
  complete,
  steps:Object.freeze(steps.map(x=>Object.freeze({...x}))),
  details:Object.freeze({...details}),
  producedAt:new Date().toISOString()
 });
}
const step=(id,passed,evidence=null)=>({id,passed:Boolean(passed),evidence});

export async function runOrderlyTestnetLifecycle(client,{
 order,
 confirmTestnet=false
}={}){
 requireTestnet(client,confirmTestnet);
 const steps=[];
 let created=null,current=null,cancelled=null,reconciled=null;
 created=await client.createOrder(order);
 const orderId=created?.data?.order_id??created?.order_id??created?.data?.orderId;
 steps.push(step('create-minimum-size-test-order',Boolean(orderId),{orderId:orderId??null}));
 if(!orderId)return freezeEvidence('orderly',steps,{created});

 current=await client.getOrder(orderId);
 const status=current?.data?.status??current?.status;
 steps.push(step('get-order-by-id',Boolean(current),{status:status??null}));

 if(!terminalStatus(status)){
  cancelled=await client.cancelOrder({orderId,symbol:order?.symbol});
  steps.push(step('cancel-open-order-if-resting',Boolean(cancelled),{requested:true}));
  current=await client.getOrder(orderId);
 }else steps.push(step('cancel-open-order-if-resting',true,{skipped:'already-terminal'}));

 const finalStatus=current?.data?.status??current?.status;
 steps.push(step('verify-cancel-or-fill-terminal-state',terminalStatus(finalStatus)||!restingStatus(finalStatus),{status:finalStatus??null}));
 reconciled=await client.reconcileAccountState();
 steps.push(step('reconcile-account-positions',Array.isArray(reconciled?.positions),{positions:reconciled?.positions?.length??null}));
 return freezeEvidence('orderly',steps,{orderId:String(orderId),finalStatus:finalStatus??null});
}

export async function runParadexTestnetLifecycle(client,{
 order,
 confirmTestnet=false
}={}){
 requireTestnet(client,confirmTestnet);
 const steps=[];
 let created=null,current=null,reconciled=null;
 created=await client.createOrder(order);
 const orderId=created?.id??created?.order_id;
 steps.push(step('create-minimum-size-test-order',Boolean(orderId),{orderId:orderId??null}));
 if(!orderId)return freezeEvidence('paradex',steps,{created});

 current=await client.getOrder(orderId);
 const status=current?.status;
 steps.push(step('get-order-by-id',Boolean(current),{status:status??null}));

 if(!terminalStatus(status)){
  await client.cancelOrder(orderId);
  steps.push(step('cancel-open-order-if-resting',true,{requested:true}));
  current=await client.getOrder(orderId);
 }else steps.push(step('cancel-open-order-if-resting',true,{skipped:'already-terminal'}));

 const finalStatus=current?.status;
 steps.push(step('verify-cancel-or-fill-terminal-state',terminalStatus(finalStatus)||!restingStatus(finalStatus),{status:finalStatus??null}));
 reconciled=await client.reconcilePositions();
 steps.push(step('reconcile-positions',Array.isArray(reconciled?.positions),{positions:reconciled?.positions?.length??null}));
 return freezeEvidence('paradex',steps,{orderId:String(orderId),finalStatus:finalStatus??null});
}
