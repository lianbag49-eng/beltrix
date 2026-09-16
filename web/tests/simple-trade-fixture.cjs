const {expect}=require('@playwright/test');
async function setup(page){
 const state={size:'2',max:['10.12349','9.98765'],fail:false},posted=[];
 const meta={universe:[{name:'ETH',szDecimals:4,maxLeverage:20},{name:'BTC',szDecimals:5,maxLeverage:40}]};
 const spot={tokens:[{name:'USDC',index:0,szDecimals:2},{name:'HYPE',index:1,szDecimals:2}],universe:[{name:'@0',tokens:[1,0],index:0}]};
 const ctx={markPx:'2500',oraclePx:'2500',prevDayPx:'2550',dayNtlVlm:'125000000',openInterest:'50000',funding:'0.0001'};
 await page.route('**/info',async r=>{const q=r.request().postDataJSON();let data=[];
 if(q.type==='meta')data=meta;else if(q.type==='spotMeta')data=spot;
 else if(q.type==='metaAndAssetCtxs')data=[meta,[ctx,ctx]];else if(q.type==='spotMetaAndAssetCtxs')data=[spot,[ctx]];
 else if(q.type==='activeAssetData'){if(state.fail)return r.fulfill({status:503,body:'Unavailable'});data={coin:q.coin,user:q.user,leverage:{type:'cross',value:5},maxTradeSzs:state.max,availableToTrade:['5000','4000'],markPx:'2500'};}
 else if(q.type==='clearinghouseState')data={marginSummary:{accountValue:'10000'},withdrawable:'5000',assetPositions:state.size==='0'?[]:[{position:{coin:'ETH',szi:state.size,entryPx:'2450',leverage:{type:'cross',value:5},marginUsed:'1000',unrealizedPnl:'100',cumFunding:{sinceOpen:'-0.1'}}}]};
 else if(q.type==='spotClearinghouseState')data={balances:[]};
 else if(q.type==='candleSnapshot')data=Array.from({length:80},(_,i)=>({t:Date.now()-(80-i)*60000,o:'2490',h:'2510',l:'2480',c:String(2490+i%20),v:'100'}));
 await r.fulfill({json:data});});
 await page.route('**/exchange',r=>{posted.push(r.request().postDataJSON());return r.fulfill({json:{status:'ok',response:{type:'order',data:{statuses:[{resting:{oid:42}}]}}}});});
 await page.addInitScript(()=>{window.calls=[];window.listeners={};window.fakeChain='0x66eee';window.ethereum={on(k,fn){(window.listeners[k]??=[]).push(fn);},removeListener(){},async request(q){window.calls.push(q);if(['eth_accounts','eth_requestAccounts'].includes(q.method))return ['0x1111111111111111111111111111111111111111'];if(q.method==='eth_chainId')return window.fakeChain;if(q.method==='wallet_switchEthereumChain'){window.fakeChain=q.params[0].chainId;return null;}if(q.method==='eth_signTypedData_v4')return '0x'+'11'.repeat(64)+'1b';throw Error(q.method);}};
 window.WebSocket=class{constructor(){this.readyState=1;setTimeout(()=>this.onopen?.(),0);}send(s){const q=JSON.parse(s);if(q.subscription?.type==='l2Book')this.timer=setInterval(()=>{if(!window.stopBook)this.onmessage?.({data:JSON.stringify({channel:'l2Book',data:{coin:q.subscription.coin,time:Date.now(),levels:[Array.from({length:5},(_,i)=>({px:String(2499-i),sz:String(3+i)})),Array.from({length:5},(_,i)=>({px:String(2501+i),sz:String(4+i)}))]}})});},300);}close(){clearInterval(this.timer);this.readyState=3;}};});
 await page.route('**/*',r=>['127.0.0.1','localhost'].includes(new URL(r.request().url()).hostname)||r.request().url().endsWith('/info')||r.request().url().endsWith('/exchange')?r.fallback():r.abort());
 await page.goto('/web/#markets');await expect(page.locator('html')).toHaveAttribute('data-simple-trade','v1');
 return {state,posted};
}
async function connect(page,net='testnet'){await page.locator('#marketNetwork').selectOption(net);await page.locator('#tradeConnect').click();await expect(page.locator('[data-size-pct="50"]')).toBeEnabled();}

module.exports={setup,connect};
