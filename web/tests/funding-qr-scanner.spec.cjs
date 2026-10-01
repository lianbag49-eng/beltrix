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

test('camera decodes real QR pixels and stops after finding a recipient',async({page})=>{
 await sendForm(page);
 const image=await QRCode.toDataURL(B,{width:420,margin:4});
 await page.evaluate(async src=>{
  const img=new Image();img.src=src;await img.decode();const canvas=document.createElement('canvas');canvas.width=420;canvas.height=420;canvas.getContext('2d').drawImage(img,0,0);
  const stream=canvas.captureStream(10),frames=setInterval(()=>canvas.getContext('2d').drawImage(img,0,0),100);window.cameraCanvas=canvas;window.qrStopped=0;window.qrCameraRequests=0;
  for(const track of stream.getTracks()){const stop=track.stop.bind(track);track.stop=()=>{window.qrStopped++;clearInterval(frames);stop();};}
  Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:async()=>{window.qrCameraRequests++;return stream;}}});
 },image);
 await page.locator('[data-qr-camera]').click();
 await expect.poll(()=>page.evaluate(()=>window.qrCameraRequests)).toBe(1);
 await expect(page.locator('#fundingPaymentText')).toHaveValue(B);
 await expect.poll(()=>page.evaluate(()=>qrStopped)).toBe(1);await expect(page.locator('[data-qr-preview]')).toBeHidden();
 expect(await page.evaluate(()=>walletFixture.sent.length)).toBe(0);
});
