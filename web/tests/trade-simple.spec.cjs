const {test,expect}=require('@playwright/test');
const {setup,connect}=require('./simple-trade-fixture.cjs');
const $=(page,id)=>page.locator('#'+id);
async function mode(page,value){if(await $(page,'markets').getAttribute('data-trade-layout')!==value)await $(page,'tradeLayoutMode').click();await expect($(page,'markets')).toHaveAttribute('data-trade-layout',value);}
async function options(page){if(!await $(page,'simpleOrderOptions').evaluate(e=>e.open))await page.locator('#simpleOrderOptions > summary').click();}

test('Simple is the default; redundant selectors and generic review are not visible',async({page})=>{
 await setup(page);await expect($(page,'markets')).toHaveAttribute('data-trade-layout','simple');
 for(const id of ['marketType','tradeSide','tradeType','tradeReview'])await expect($(page,id)).toBeHidden();
 await expect(page.locator('[data-trade-product=perp]')).toHaveAttribute('aria-pressed','true');
 for(const id of ['tradeSize','marketNetwork','futuresLong','tradeStatus'])await expect($(page,id)).toBeVisible();
 await expect($(page,'futuresShort')).toBeHidden();await expect($(page,'tradeModeNote')).toBeHidden();
 await page.locator('#futuresExtra > summary').click();await expect($(page,'tradeModeNote')).toBeVisible();await page.locator('#futuresExtra > summary').click();
 await expect($(page,'simpleMarketDetails')).not.toHaveAttribute('open','');
 await expect($(page,'futuresExtra')).not.toHaveAttribute('open','');
 await expect($(page,'futuresLong')).toBeDisabled();await expect($(page,'futuresShort')).toBeDisabled();
});

test('view toggle preserves exact form nodes, values, order context and preference',async({page})=>{
 const {posted}=await setup(page);await connect(page);await page.locator('[data-fast-type=Market]').click();
 await $(page,'tradeSize').fill('1.25');await options(page);await $(page,'tradeSlippage').fill('0.7');
 await page.evaluate(()=>window.originalInputs=Object.fromEntries(['tradeSize','tradeType','tradeSlippage','tradeReduce'].map(id=>[id,document.getElementById(id)])));
 for(const view of ['advanced','simple','advanced']){
  await mode(page,view);await expect($(page,'tradeSize')).toHaveValue('1.25');await expect($(page,'tradeSlippage')).toHaveValue('0.7');await expect($(page,'tradeType')).toHaveValue('Market');
  expect(await page.evaluate(()=>Object.entries(window.originalInputs).every(([id,node])=>node===document.getElementById(id)))).toBe(true);
 }
 expect(posted).toHaveLength(0);expect(await page.evaluate(()=>window.calls.filter(x=>/sign|send/i.test(x.method)))).toEqual([]);
 await page.reload();await expect($(page,'markets')).toHaveAttribute('data-trade-layout','advanced');await expect($(page,'tradeType')).toBeVisible();
});

test('Spot is token-only and product switches use the real market selector',async({page})=>{
 await setup(page);await connect(page);await page.locator('[data-trade-product=spot]').click();
 await expect($(page,'marketType')).toHaveValue('spot');await expect($(page,'marketSymbol')).toHaveValue('@0');
 for(const selector of ['.fast-open-close','.fast-size','#futuresLeverageDrawer','[data-account-tab=positions]','[data-account-tab=funding]'])await expect(page.locator(selector)).toBeHidden();
 await expect($(page,'futuresLong')).toHaveText('Buy');await expect($(page,'futuresShort')).toHaveText('Sell');
 await expect(page.locator('[data-account-tab=balances]')).toHaveAttribute('aria-selected','true');
 await expect($(page,'tradeReduce')).not.toBeChecked();await options(page);await expect($(page,'simpleTriggerTools')).toBeHidden();
 await page.locator('[data-trade-product=perp]').click();await expect($(page,'marketType')).toHaveValue('perp');await expect($(page,'futuresLeverageDrawer')).toBeVisible();
 await expect(page.locator('.fast-open-close')).toBeVisible();
 await expect($(page,'tradeStatus')).not.toContainText('Invalid type');
});

test('both product reviews keep mainnet acknowledgement and never sign on a large button click',async({page})=>{
 const {posted}=await setup(page);await connect(page,'mainnet');
 for(const product of ['spot','perp']){
  await page.locator(`[data-trade-product=${product}]`).click();
  await expect($(page,'marketSymbol')).toHaveValue(product==='spot'?'@0':'ETH');
  await page.locator('[data-fast-type=Market]').click();await $(page,'tradeSize').fill('1');
  await page.locator('[data-gold-direction=sell]').click();await expect($(page,'futuresShort')).toBeEnabled();await $(page,'futuresShort').click();
  await expect($(page,'tradeDialog')).toBeVisible();await expect($(page,'tradeLiveAckField')).toBeVisible();await expect($(page,'tradeSubmit')).toBeDisabled();
  await expect($(page,'tradeLayoutMode')).toBeDisabled();await expect(page.locator('[data-trade-product=spot]')).toBeDisabled();
  expect(posted).toHaveLength(0);expect(await page.evaluate(()=>window.calls.filter(x=>/sign|send/i.test(x.method)))).toEqual([]);
  await $(page,'tradeClose').click();
 }
});

test('TP/SL in collapsed settings still reaches the original reduce-only trigger path',async({page})=>{
 const {posted}=await setup(page);await connect(page);await options(page);await page.locator('[data-fast-type=Stop]').click();
 await expect($(page,'tradeType')).toHaveValue('Stop');await expect($(page,'tradeReduce')).toBeChecked();await expect($(page,'tradeSize')).toHaveValue('2');
 await $(page,'tradeTrigger').fill('2400');await $(page,'futuresLong').click();await expect($(page,'tradeSummary')).toContainText('Trigger: 2400');
 await $(page,'tradeSubmit').click();await expect.poll(()=>posted.length).toBe(1);expect(posted[0].action.orders[0]).toMatchObject({b:false,r:true,s:'2',t:{trigger:{triggerPx:'2400',tpsl:'sl',isMarket:true}}});
});

test('special order options and price chosen from the book remain truthful',async({page})=>{
 await setup(page);await connect(page);await options(page);await $(page,'tradeType').selectOption('Twap');
 await expect($(page,'tradeTwapField')).toBeVisible();await expect($(page,'simpleOrderSummary')).toContainText('TWAP');
 await expect($(page,'simpleOrderOptions')).toHaveAttribute('open','');await page.locator('#simpleOrderOptions > summary').click();
 await page.waitForTimeout(3500);expect(await $(page,'simpleOrderOptions').evaluate(e=>e.open)).toBe(false);
 await page.locator('#marketBids .book-level').first().click();await expect($(page,'tradeType')).toHaveValue('Gtc');await expect($(page,'tradePrice')).toHaveValue('2499');
 await expect($(page,'simpleOrderSummary')).toContainText('Limit');
});

test('Simple perps retains applied-leverage MAX sizing, Open/Close, and stale data locks',async({page})=>{
 await setup(page);await connect(page);await page.locator('[data-fast-type=Market]').click();await page.locator('[data-size-pct="50"]').click();
 await expect($(page,'tradeSize')).toHaveValue('4.9605');await options(page);await page.locator('[data-gold-direction=sell]').click();await expect($(page,'tradeSize')).toHaveValue('4.8939');
 await page.locator('[data-intent=close]').click();await expect($(page,'tradeSize')).toHaveValue('2');await expect($(page,'tradeReduce')).toBeChecked();
 await page.locator('[data-intent=open]').click();await expect($(page,'tradeReduce')).not.toBeChecked();
 await page.evaluate(()=>window.stopBook=true);await expect($(page,'futuresLong')).toBeDisabled({timeout:10000});await expect(page.locator('[data-size-pct="50"]')).toBeDisabled();
});

test('compact view reduces ticket height for both products without overflow or removing funding actions',async({page})=>{
 await setup(page);await connect(page);await page.locator('[data-fast-type=Market]').click();
 for(const product of ['perp','spot']){
  await page.locator(`[data-trade-product=${product}]`).click();
  await expect($(page,'marketSymbol')).toHaveValue(product==='spot'?'@0':'ETH');
  for(const width of [320,390,430,1280]){
   await page.setViewportSize({width,height:844});await page.waitForTimeout(250);
   expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
   await expect($(page,'tradeSize')).toBeVisible();await expect($(page,'marketNetwork')).toBeVisible();
   for(const sel of ['[data-funding=deposit]','[data-funding=withdraw]','[data-usdt-open]'])await expect(page.locator('#markets '+sel)).toBeVisible();
  }
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(100);
  const simple=(await page.locator('.order-ticket').boundingBox()).height;
  await page.screenshot({path:`test-results/simple-${product}-mobile.png`,fullPage:true});
  await mode(page,'advanced');const advanced=(await page.locator('.order-ticket').boundingBox()).height;
  expect(simple).toBeLessThan(advanced);await mode(page,'simple');
 }
});

test('typing and expanding settings preserve focus without invoking page navigation',async({page})=>{
 await setup(page);await page.addStyleTag({content:'.page{min-height:2600px}'});await page.setViewportSize({width:390,height:844});
 await $(page,'tradeSize').evaluate(e=>scrollTo(0,e.getBoundingClientRect().top+scrollY-180));
 const before=await page.evaluate(()=>scrollY);expect(before).toBeGreaterThan(0);
 await page.evaluate(()=>{window.simpleScrolls=[];const f=window.scrollTo;window.scrollTo=(...a)=>{window.simpleScrolls.push(a);return f(...a);};});
 await $(page,'tradeSize').click();await page.keyboard.type('0.5');await page.waitForTimeout(350);
 await expect($(page,'tradeSize')).toBeFocused();expect(Math.abs(await page.evaluate(()=>scrollY)-before)).toBeLessThanOrEqual(2);
 expect(await page.evaluate(()=>window.simpleScrolls)).toEqual([]);
});

// Product selection emits a transient empty market before loading its metadata.
test('changing products never submits an undefined coin to account refresh',async({page})=>{
 const {posted}=await setup(page);await connect(page);
 for(const product of ['spot','perp','spot','perp']){
  await page.locator(`[data-trade-product=${product}]`).click();
  await expect($(page,'marketSymbol')).toHaveValue(product==='spot'?'@0':'ETH');
  await page.waitForTimeout(150);
  await expect($(page,'tradeStatus')).not.toContainText('Invalid type');
 }
 expect(posted).toHaveLength(0);
});

test('compact Close direction reverses the order side and never opens the wrong position',async({page})=>{
 const {posted}=await setup(page);await connect(page);await page.locator('[data-fast-type=Market]').click();
 await page.locator('[data-intent=close]').click();
 await expect($(page,'tradeSide')).toHaveValue('sell');await expect($(page,'tradeReduce')).toBeChecked();
 await expect($(page,'futuresLong')).toBeVisible();await expect($(page,'futuresLong')).toHaveText('Close Long');
 await expect($(page,'futuresShort')).toBeHidden();
 await page.locator('[data-gold-direction=sell]').click();
 await expect($(page,'tradeSide')).toHaveValue('buy');await expect($(page,'futuresShort')).toBeVisible();
 await expect($(page,'futuresShort')).toHaveText('Close Short');await expect($(page,'futuresShort')).toBeDisabled();
 await page.locator('[data-gold-direction=buy]').click();await $(page,'futuresLong').click();
 await expect($(page,'tradeDialog')).toBeVisible();await expect($(page,'tradeReduce')).toBeChecked();
 expect(posted).toHaveLength(0);expect(await page.evaluate(()=>window.calls.filter(x=>/sign|send/i.test(x.method)))).toEqual([]);
 await $(page,'tradeClose').click();await page.locator('[data-intent=open]').click();
 await expect($(page,'tradeReduce')).not.toBeChecked();
});
