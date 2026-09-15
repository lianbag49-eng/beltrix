// Public, read-only evidence. No wallet, signature, deposit or order endpoint.
import {mkdir,writeFile} from 'node:fs/promises';
const base='https://api.hyperliquid-testnet.xyz';
async function read(body){const r=await fetch(base+'/info',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('Info HTTP '+r.status);return r.json()}
function walk(levels,quantity){let remaining=quantity,value=0,filled=0;for(const l of levels){const px=Number(l.px),sz=Number(l.sz);if(!(px>0&&sz>0&&Number.isFinite(px)&&Number.isFinite(sz)))throw Error('Invalid depth');const take=Math.min(remaining,sz);remaining-=take;filled+=take;value+=take*px;if(remaining<quantity*1e-10)break}return {coverage:filled/quantity,averagePrice:filled?value/filled:null,quotedValue:value}}
const [perps,spot]=await Promise.all([read({type:'meta'}),read({type:'spotMeta'})]);
const markets=perps.universe.filter(x=>['BTC','ETH'].includes(x.name)).map(x=>({kind:'perpetual',coin:x.name,label:x.name}));
const tokens=new Map(spot.tokens.map(t=>[t.index,t]));
for(const m of spot.universe.filter(x=>tokens.get(x.tokens[1])?.name==='USDC').slice(0,3))markets.push({kind:'spot',coin:m.index===0?'PURR/USDC':'@'+m.index,label:tokens.get(m.tokens[0])?.name+'/USDC'});
if(!markets.some(x=>x.kind==='spot')||!markets.some(x=>x.kind==='perpetual'))throw Error('Missing spot or perpetual metadata');
const rows=[];for(const m of markets){try{
 const b=await read({type:'l2Book',coin:m.coin}),bid=Number(b.levels?.[0]?.[0]?.px),ask=Number(b.levels?.[1]?.[0]?.px);
 if(b.coin!==m.coin||!Number.isFinite(b.time)||Math.abs(Date.now()-b.time)>15000||!(bid>0&&ask>=bid))throw Error('Empty, crossed or stale book');
 const mid=(bid+ask)/2,depth=b.levels.map(ls=>ls.reduce((n,l)=>n+Number(l.px)*Number(l.sz),0));
 const samples=[100,1000,10000].map(n=>({referenceNotionalUSDC:n,buy:walk(b.levels[1],n/mid),sell:walk(b.levels[0],n/mid)}));
 rows.push({...m,status:'measured',bookTime:new Date(b.time).toISOString(),spreadBps:(ask-bid)/mid*10000,visibleBidDepthUSDC:depth[0],visibleAskDepthUSDC:depth[1],samples});
 }catch(e){rows.push({...m,status:'unavailable',reason:e.message})}}
const report={createdAt:new Date().toISOString(),network:'Hyperliquid testnet',releaseReady:false,scope:'BTC/ETH perpetuals and first three metadata-listed USDC spot pairs; read-only snapshot, not a liquidity guarantee',limitations:['Visible depth only; may change before execution','No fees, queue position, market impact beyond returned depth, or actual fills verified','No liquidity capital supplied'],markets:rows,remainingGates:['Funded testnet execution with user wallet signatures','Actual iPhone wallet tests','Independent security audit and remediation']};
await mkdir('test-results',{recursive:true});await writeFile('test-results/testnet-liquidity.json',JSON.stringify(report,null,2));
console.log('TESTNET_LIQUIDITY_EVIDENCE '+JSON.stringify(report));
