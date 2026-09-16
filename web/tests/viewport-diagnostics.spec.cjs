const {test,expect}=require('@playwright/test');
const fs=require('node:fs/promises');
// Read-only diagnostics for real document overflow; never connect or submit.
test('record mobile viewport geometry before and after resize',async({page},info)=>{
 await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
 await page.route('**/info',r=>{const q=r.request().postDataJSON();const meta={universe:[{name:'ETH',szDecimals:4,maxLeverage:20},{name:'BTC',szDecimals:5,maxLeverage:40}]};const ctx={markPx:'2500',oraclePx:'2500',prevDayPx:'2550',dayNtlVlm:'125000000',openInterest:'50000',funding:'0.0001'};return r.fulfill({json:q.type==='meta'?meta:q.type==='metaAndAssetCtxs'?[meta,[ctx,ctx]]:q.type==='spotMeta'?{tokens:[],universe:[]}:[]});});
 await page.addInitScript(()=>{window.ethereum={on(){},removeListener(){},async request(q){if(q.method==='eth_accounts')return [];throw Error('No signing allowed in viewport diagnostics');}};window.WebSocket=class{constructor(){this.readyState=1;setTimeout(()=>this.onopen?.(),0);}send(){}close(){this.readyState=3;}};});
 await page.setViewportSize({width:390,height:844});await page.goto('/web/#markets');await expect(page.locator('#fastOrderBar')).toBeVisible();await expect(page.locator('#markets .funding-bar [data-usdt-open]')).toBeVisible();
 const measure=()=>page.evaluate(()=>({innerWidth,clientWidth:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth,visualWidth:visualViewport?.width,overflow:[...document.querySelectorAll('body *')].filter(e=>{const r=e.getBoundingClientRect();return r.width&&r.height&&(r.right>innerWidth||r.left<0);}).map(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return {tag:e.tagName,id:e.id,cls:typeof e.className==='string'?e.className:'',left:r.left,right:r.right,width:r.width,text:e.children.length?'':e.textContent.slice(0,100),overflowX:s.overflowX,minWidth:s.minWidth,whiteSpace:s.whiteSpace,parent:e.parentElement?.id||e.parentElement?.className};}).slice(0,100)}));
 const results=[];
 for(const width of [320,390,430,1280]){await page.setViewportSize({width,height:844});const immediate=await measure();await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));const settled=await measure();results.push({requestedWidth:width,immediate,settled});await page.screenshot({path:info.outputPath('viewport-'+width+'.png'),fullPage:true});}
 await fs.writeFile(info.outputPath('viewport-geometry.json'),JSON.stringify(results,null,2));
});
