const {test,expect}=require('@playwright/test');
const QRCode=require('qrcode');
const {fixture,connect,A,B}=require('./wallet-fixture.cjs');
async function sendForm(page){
 await fixture(page);await connect(page);
 await page.locator('.w-actions [data-action=send]').click();
 await page.locator('#fundingPaymentImport summary').click();
}
async function qrFile(text){return {name:'recipient.png',mimeType:'image/png',buffer:await QRCode.toBuffer(text,{width:420,margin:4})};}

test('wallet QR image works without BarcodeDetector and still requires transfer review',async({page})=>{
 await page.addInitScript(()=>{window.BarcodeDetector=undefined;});
 await sendForm(page);
 await page.locator('#fundingQRFile').setInputFiles(await qrFile(`ethereum:${B}@1?value=150000000000000000`));
 await expect(page.locator('#fundingPaymentText')).toHaveValue(new RegExp(B));
 await page.locator('#fundingApplyPayment').click();
 await expect(page.locator('#wSendTo')).toHaveValue(B);await expect(page.locator('#wSendAmount')).toHaveValue('0.15');
 expect(await page.evaluate(()=>walletFixture.sent.length)).toBe(0);
 await page.locator('#wSendReview').click();await expect(page.locator('#wSignTransfer')).toBeDisabled();
});

test('trading withdrawal QR validates its network and token before filling fields',async({page})=>{
 await fixture(page);await connect(page);
 await page.locator('#wallet [data-funding=withdraw]').click();await page.locator('#fundingTradingChoice').click();
 await page.locator('#fundingWithdrawalQR summary').click();
 const token='0xaf88d065e77c8cC2239327C5EDb3A432268e5831';
 await page.locator('#withdrawalQRFile').setInputFiles(await qrFile(`ethereum:${token}@42161/transfer?address=${B}&uint256=10000000`));
 await page.locator('[data-withdrawal-apply]').click();
 await expect(page.locator('#fundingDestination')).toHaveValue(B);await expect(page.locator('#fundingAmount')).toHaveValue('10');
 await page.locator('[data-withdrawal-text]').fill(`ethereum:${token}@1/transfer?address=${A}&uint256=5000000`);
 await page.locator('[data-withdrawal-apply]').click();await expect(page.locator('[data-withdrawal-status]')).toContainText('network differs');
 await expect(page.locator('#fundingDestination')).toHaveValue(B);await expect(page.locator('#fundingAmount')).toHaveValue('10');
 await expect(page.locator('#fundingReview')).toBeDisabled();expect(await page.evaluate(()=>walletFixture.sent.length)).toBe(0);
 await page.locator('#fundingSwitch').click();await page.locator('#fundingConnect').click();await expect(page.locator('#fundingReview')).toBeEnabled();
 await expect(page.locator('#fundingDestination')).toHaveValue(B);await expect(page.locator('#fundingAmount')).toHaveValue('10');
});

test('camera denial leaves image import usable',async({page})=>{
 await page.addInitScript(()=>{Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:async()=>{throw new DOMException('Denied','NotAllowedError');}}});});
 await sendForm(page);await page.locator('[data-qr-camera]').click();
 await expect(page.locator('[data-qr-status]')).toContainText('permission denied');
 await page.locator('#fundingQRFile').setInputFiles(await qrFile(B));await expect(page.locator('#fundingPaymentText')).toHaveValue(B);
 expect(await page.evaluate(()=>walletFixture.sent.length)).toBe(0);
});

test('closing the dialog while camera permission is pending releases the late stream',async({page})=>{
 await page.addInitScript(()=>{window.qrStopped=0;Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:()=>new Promise(resolve=>{window.resolveCamera=()=>resolve({getTracks:()=>[{stop:()=>window.qrStopped++}]});})}});});
 await sendForm(page);await page.locator('[data-qr-camera]').click();
 await expect.poll(()=>page.evaluate(()=>typeof window.resolveCamera)).toBe('function');
 await page.locator('#wClose').click();await page.evaluate(()=>window.resolveCamera());
 await expect.poll(()=>page.evaluate(()=>qrStopped)).toBe(1);expect(await page.evaluate(()=>walletFixture.sent.length)).toBe(0);
});

test('camera decodes real QR pixels and stops after finding a recipient',async({page,browserName})=>{
 await sendForm(page);
 const image=await QRCode.toDataURL(B,{width:420,margin:4});
 await page.evaluate(async({src,frameAdapter})=>{
  const img=new Image();img.src=src;await img.decode();const canvas=document.createElement('canvas');canvas.width=420;canvas.height=420;canvas.getContext('2d').drawImage(img,0,0);
  const stream=canvas.captureStream(10),frames=setInterval(()=>canvas.getContext('2d').drawImage(img,0,0),100);window.cameraCanvas=canvas;window.cameraStream=stream;window.stopQRFrames=()=>clearInterval(frames);window.qrCameraRequests=0;
  Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:async()=>{window.qrCameraRequests++;return stream;}}});
  // Linux WebKit's synthetic capture stream did not deliver frames in CI.
  // Supply real QR pixels at the media boundary while exercising the same scan,
  // decoder, recipient validation and track cleanup. Chromium uses captureStream.
  if(frameAdapter){
   const play=HTMLMediaElement.prototype.play,draw=CanvasRenderingContext2D.prototype.drawImage;
   HTMLMediaElement.prototype.play=function(){if(this.getAttribute('aria-label')==='QR camera preview'){for(const [key,value] of Object.entries({readyState:4,videoWidth:420,videoHeight:420}))Object.defineProperty(this,key,{configurable:true,value});return Promise.resolve();}return play.call(this);};
   CanvasRenderingContext2D.prototype.drawImage=function(source,...args){return draw.call(this,source instanceof HTMLVideoElement&&source.getAttribute('aria-label')==='QR camera preview'?canvas:source,...args);};
  }
 },{src:image,frameAdapter:browserName==='webkit'});
 await expect.poll(()=>page.evaluate(()=>window.cameraStream.getTracks().map(track=>track.readyState))).toEqual(['live']);
 await page.locator('[data-qr-camera]').click();
 await expect.poll(()=>page.evaluate(()=>window.qrCameraRequests)).toBe(1);
 await expect(page.locator('#fundingPaymentText')).toHaveValue(B);
 // Read the actual source track state: WebKit can return a fresh JS wrapper
 // from getTracks(), so replacing one wrapper's stop() is not reliable.
 await expect.poll(()=>page.evaluate(()=>window.cameraStream.getTracks().map(track=>track.readyState))).toEqual(['ended']);
 await page.evaluate(()=>window.stopQRFrames());await expect(page.locator('[data-qr-preview]')).toBeHidden();
 expect(await page.evaluate(()=>walletFixture.sent.length)).toBe(0);
});

test('a camera that never starts video releases its tracks and offers image import',async({page})=>{
 await sendForm(page);await page.clock.install();
 await page.evaluate(()=>{
  const c=document.createElement('canvas'),stream=c.captureStream();window.cameraCanvas=c;window.cameraStream=stream;
  Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:async()=>stream}});
  HTMLMediaElement.prototype.play=()=>new Promise(()=>{});
 });
 await expect.poll(()=>page.evaluate(()=>window.cameraStream.getTracks().map(track=>track.readyState))).toEqual(['live']);
 await page.locator('[data-qr-camera]').click();await expect(page.locator('[data-qr-preview]')).toBeVisible();
 await page.clock.fastForward(11000);await expect(page.locator('[data-qr-status]')).toContainText('video is unavailable');
 await expect.poll(()=>page.evaluate(()=>window.cameraStream.getTracks().map(track=>track.readyState))).toEqual(['ended']);await expect(page.locator('[data-qr-preview]')).toBeHidden();await expect(page.locator('[data-qr-image]')).toBeEnabled();
});
