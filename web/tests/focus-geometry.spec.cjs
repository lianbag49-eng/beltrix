const {test,expect}=require('@playwright/test');
const {setup}=require('./simple-trade-fixture.cjs');
test.use({storageState:{cookies:[],origins:[]}});
for(let run=0;run<3;run++)test(`focus geometry ${run}`,async({page})=>{
 await setup(page);
 await page.addStyleTag({content:'.page{min-height:2600px}'});
 await page.setViewportSize({width:390,height:844});
 const field=page.locator('#tradeSize');
 await field.evaluate(e=>scrollTo(0,e.getBoundingClientRect().top+scrollY-180));
 const beforeScroll=await page.evaluate(()=>scrollY);
 const beforeBox=await field.boundingBox();
 await page.evaluate(()=>{
  window.simpleScrolls=[];
  const old=window.scrollTo;
  window.scrollTo=(...args)=>{window.simpleScrolls.push(args);return old(...args)};
  window.focusGeometry=[];
  const sample=type=>{
   const field=document.getElementById('tradeSize'),r=field.getBoundingClientRect();
   window.focusGeometry.push({type,t:performance.now(),y:r.y,docY:r.y+scrollY,scrollY,focused:document.activeElement===field,innerHeight,vv:{height:visualViewport.height,offset:visualViewport.offsetTop,scale:visualViewport.scale}});
  };
  ['pointerdown','focusin','input','focusout'].forEach(type=>document.addEventListener(type,()=>sample(type),true));
  window.addEventListener('resize',()=>sample('resize'));
  window.addEventListener('scroll',()=>sample('scroll'));
  sample('beforeClick');
 });
 await field.click();
 await page.keyboard.type('0.5');
 await page.waitForTimeout(350);
 const afterBox=await field.boundingBox();
 const evidence=await page.evaluate(()=>({events:window.focusGeometry,scrolls:window.simpleScrolls,scrollY,dpr:devicePixelRatio,rect:document.getElementById('tradeSize').getBoundingClientRect().toJSON()}));
 console.log('FOCUS_GEOMETRY',JSON.stringify({run,beforeScroll,beforeBox,afterBox,...evidence}));
 await expect(field).toBeFocused();
 expect(Math.abs(afterBox.y-beforeBox.y)).toBeLessThanOrEqual(2);
 expect(evidence.scrolls).toEqual([]);
});
