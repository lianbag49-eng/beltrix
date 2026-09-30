const {test,expect}=require('@playwright/test');

// All remote traffic is either mocked or blocked. These tests never sign or
// submit transactions; the existing review and acknowledgement guards remain.
async function setup(page,mode){
  await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
  const meta={universe:[{name:'ETH',szDecimals:4,maxLeverage:20}]};
  const spot={tokens:[{name:'USDC',index:0,szDecimals:2},{name:'HYPE',index:1,szDecimals:2}],universe:[{name:'@0',tokens:[1,0],index:0}]};
  const ctx={markPx:'2500',oraclePx:'2500',prevDayPx:'2550',dayNtlVlm:'125000000',openInterest:'50000',funding:'0.0001'};
  await page.route('**/info',async route=>{
    const q=route.request().postDataJSON();let data=[];
    if(q.type==='meta')data=meta;
    else if(q.type==='spotMeta')data=spot;
    else if(q.type==='metaAndAssetCtxs')data=[meta,[ctx]];
    else if(q.type==='spotMetaAndAssetCtxs')data=[spot,[ctx]];
    else if(q.type==='activeAssetData')data={coin:q.coin,user:q.user,leverage:{type:'cross',value:5},maxTradeSzs:['10','10'],availableToTrade:['5000','4000'],markPx:'2500'};
    else if(q.type==='clearinghouseState')data={marginSummary:{accountValue:'10000'},withdrawable:'5000',assetPositions:[{position:{coin:'ETH',szi:'2',entryPx:'2450',liquidationPx:'2200',leverage:{type:'cross',value:5},marginUsed:'1000',unrealizedPnl:'100',cumFunding:{sinceOpen:'-0.1'}}}]};
    else if(q.type==='spotClearinghouseState')data={balances:[]};
    else if(q.type==='candleSnapshot')data=Array.from({length:80},(_,i)=>({t:Date.now()-(80-i)*60000,o:'2490',h:'2510',l:'2480',c:'2500',v:'100'}));
    await route.fulfill({json:data});
  });
  const posted=[];
  await page.route('**/exchange',route=>{posted.push(route.request().postData());return route.abort();});
  await page.addInitScript(mode=>{
    localStorage.setItem('beltrix-trade-layout-v1',mode);
    window.focusTestCalls=[];
    window.ethereum={on(){},removeListener(){},async request(q){
      window.focusTestCalls.push(q.method);
      if(['eth_accounts','eth_requestAccounts'].includes(q.method))return ['0x1111111111111111111111111111111111111111'];
      if(q.method==='eth_chainId')return '0x66eee';
      if(q.method==='wallet_switchEthereumChain')return null;
      throw Error('Signing is forbidden in the focus-scroll regression: '+q.method);
    }};
    window.WebSocket=class{
      constructor(){this.readyState=1;setTimeout(()=>this.onopen?.(),0);}
      send(s){const q=JSON.parse(s);if(q.subscription?.type==='l2Book')this.timer=setInterval(()=>this.onmessage?.({data:JSON.stringify({channel:'l2Book',data:{coin:q.subscription.coin,time:Date.now(),levels:[Array.from({length:5},(_,i)=>({px:String(2499-i),sz:'3'})),Array.from({length:5},(_,i)=>({px:String(2501+i),sz:'4'}))]}})}),300);}
      close(){clearInterval(this.timer);this.readyState=3;}
    };
  },mode);
  await page.goto('/web/#markets');
  await expect(page.locator('#fastOrderBar')).toBeVisible();
  await page.locator('#marketNetwork').selectOption('testnet');
  await page.locator('#tradeConnect').click();
  await expect(page.locator('[data-size-pct="50"]')).toBeEnabled();
  await page.locator('[data-fast-type="Market"]').click();
  return posted;
}

for(const mode of ['simple','advanced'])for(const width of [320,390,430]){
  test(`${mode} ${width}px: focused input permits scroll, layout compensation and an ordinary review click`,async({page})=>{
    await page.setViewportSize({width,height:740});
    const posted=await setup(page,mode);
    const input=page.locator('#tradeSize');
    await input.fill('1');
    await expect(input).toBeFocused();

    // Scroll deliberately while the focus guard is armed, without blurring or
    // faking a pointerdown. The old viewport anchor undid this every frame.
    const target=await page.evaluate(()=>{
      const input=document.getElementById('tradeSize');
      input.dispatchEvent(new Event('input',{bubbles:true}));
      const scroller=document.scrollingElement;
      scroller.scrollTop+=120;
      window.dispatchEvent(new Event('beltrix:market'));
      return scroller.scrollTop;
    });
    await page.waitForTimeout(250);
    expect(Math.abs(await page.evaluate(()=>document.scrollingElement.scrollTop)-target)).toBeLessThan(3);
    await expect(input).toBeFocused();

    // A real layout shift above the focused field should still be compensated.
    // Disable native anchoring in this test so it cannot hide a JS regression.
    await page.addStyleTag({content:'* { overflow-anchor: none !important; }'});
    const before=await page.evaluate(()=>{
      const input=document.getElementById('tradeSize');
      input.dispatchEvent(new Event('input',{bubbles:true}));
      const top=input.getBoundingClientRect().top;
      const spacer=document.createElement('div');
      spacer.id='focusLayoutSpacer';spacer.style.height='64px';
      document.querySelector('.order-ticket').prepend(spacer);
      return top;
    });
    await expect.poll(async()=>Math.abs((await input.boundingBox()).y-before)).toBeLessThan(3);
    await expect(input).toHaveValue('1');

    // Regular Playwright actionability checks: no force, DOM click, blur or
    // artificial wait for the guard to expire before reaching the review.
    await input.fill('1.1');
    await page.locator('#futuresLong').click();
    await expect(page.locator('#tradeDialog')).toBeVisible();
    await expect(page.locator('#tradeSummary')).toContainText('Buy / Long');
    expect(posted).toEqual([]);
    expect(await page.evaluate(()=>window.focusTestCalls.filter(method=>/sign|send/i.test(method)))).toEqual([]);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  });
}
