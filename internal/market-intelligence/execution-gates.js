export const EXECUTION_GATES=Object.freeze([
 {id:'telemetry',label:'Reliable live telemetry',required:true},
 {id:'api',label:'Documented public trading API',required:true},
 {id:'testnet',label:'Isolated test environment or safe simulation path',required:true},
 {id:'reconcile',label:'Order/fill/position reconciliation model',required:true},
 {id:'fees',label:'Verified current fee and revenue economics',required:true},
 {id:'risk',label:'Liquidation, margin, oracle and outage behavior reviewed',required:true},
 {id:'legal',label:'Jurisdiction/product policy reviewed',required:true},
 {id:'security',label:'Signing/key model reviewed',required:true},
 {id:'e2e',label:'Funded execution E2E approved',required:true}
]);

export function executionGate({telemetry=false,api=false,testnet=false,reconcile=false,fees=false,risk=false,legal=false,security=false,e2e=false}={}){
 const state={telemetry,api,testnet,reconcile,fees,risk,legal,security,e2e};
 const missing=EXECUTION_GATES.filter(g=>g.required&&!state[g.id]).map(g=>g.id);
 return Object.freeze({eligible:missing.length===0,missing});
}

export const CURRENT_RESEARCH_STATE=Object.freeze({
 hyperliquid:Object.freeze({telemetry:true,api:true,testnet:true,reconcile:true,fees:true,risk:true,legal:false,security:true,e2e:true}),
 orderly:Object.freeze({telemetry:true,api:true,testnet:false,reconcile:false,fees:false,risk:false,legal:false,security:false,e2e:false}),
 gmx:Object.freeze({telemetry:true,api:true,testnet:true,reconcile:false,fees:false,risk:false,legal:false,security:false,e2e:false}),
 dydx:Object.freeze({telemetry:true,api:true,testnet:false,reconcile:false,fees:false,risk:false,legal:false,security:false,e2e:false}),
 paradex:Object.freeze({telemetry:false,api:true,testnet:false,reconcile:false,fees:true,risk:false,legal:false,security:false,e2e:false}),
 aster:Object.freeze({telemetry:false,api:true,testnet:true,reconcile:false,fees:false,risk:false,legal:false,security:false,e2e:false}),
 drift:Object.freeze({telemetry:false,api:true,testnet:false,reconcile:false,fees:false,risk:false,legal:false,security:false,e2e:false}),
 aevo:Object.freeze({telemetry:true,api:true,testnet:false,reconcile:false,fees:false,risk:false,legal:false,security:false,e2e:false})
});

export function venueExecutionState(id){return executionGate(CURRENT_RESEARCH_STATE[id]||{})}
