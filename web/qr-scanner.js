import jsQR from 'jsqr';

/** Local-only decoding. Callers validate the network/asset and keep normal review. */
export function mountQRScanner({host,onResult,isCurrent=()=>true,prefix='payment',fileId=prefix+'QRFile'}){
 const root=document.createElement('section');root.className='w-qr-scanner';
 root.innerHTML=`<div class="funding-grid"><button type="button" class="w-secondary" data-qr-camera>Scan QR with camera</button><button type="button" class="w-secondary" data-qr-image>Read QR image</button></div><input type="file" id="${prefix}QRFile" accept="image/png,image/jpeg,image/webp" hidden><div data-qr-preview hidden><video muted playsinline aria-label="QR camera preview" style="display:block;width:100%;max-height:280px;object-fit:contain;background:#000"></video><button type="button" class="w-secondary" data-qr-stop>Stop camera</button></div><p class="w-inline-status" role="status" data-qr-status></p>`;
 host.append(root);
 const camera=root.querySelector('[data-qr-camera]'),file=root.querySelector('input'),preview=root.querySelector('[data-qr-preview]'),video=root.querySelector('video'),message=root.querySelector('[data-qr-status]');
 file.id=fileId;
 const dialog=host.closest('dialog'),canvas=document.createElement('canvas'),ctx=canvas.getContext('2d',{willReadFrequently:true});
 const listeners=new AbortController();let stream=null,timer=null,version=0,destroyed=false;
 const valid=()=>!destroyed&&root.isConnected&&(!dialog||dialog.open)&&isCurrent();
 const status=text=>{if(root.isConnected)message.textContent=text;};
 function stop(){version++;clearTimeout(timer);timer=null;stream?.getTracks().forEach(t=>t.stop());stream=null;video.srcObject=null;preview.hidden=true;camera.disabled=false;}
 function dispose(){if(destroyed)return;stop();destroyed=true;listeners.abort();observer.disconnect();}
 const observer=new MutationObserver(()=>{if(!root.isConnected)dispose();});
 observer.observe(dialog||host.parentElement||host,{childList:true,subtree:true});
 const options={signal:listeners.signal};
 dialog?.addEventListener('close',stop,options);dialog?.addEventListener('cancel',stop,options);
 document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();},options);
 window.addEventListener('pagehide',stop,options);
 function decode(source,width,height){
  const scale=Math.min(1,1200/Math.max(width,height));canvas.width=Math.max(1,Math.round(width*scale));canvas.height=Math.max(1,Math.round(height*scale));
  ctx.drawImage(source,0,0,canvas.width,canvas.height);const pixels=ctx.getImageData(0,0,canvas.width,canvas.height);
  return jsQR(pixels.data,pixels.width,pixels.height,{inversionAttempts:'attemptBoth'})?.data;
 }
 async function accept(text){if(!valid())return;stop();await onResult(text);if(valid())status('QR read. Check the address, network and amount before review.');}
 camera.onclick=async()=>{
  stop();if(!navigator.mediaDevices?.getUserMedia){status('Camera is unavailable. Use Read QR image or paste the address.');return;}
  const mine=version;camera.disabled=true;status('Allow camera access, then point at the recipient QR.');
  try{
   const opened=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}}});
   if(mine!==version||!valid()){opened.getTracks().forEach(t=>t.stop());return;}
   stream=opened;video.muted=true;video.playsInline=true;video.srcObject=stream;preview.hidden=false;
   const noFrames=()=>{if(mine!==version)return;stop();status('Camera video is unavailable. Use Read QR image or try the camera again.');};
   const started=Date.now();timer=setTimeout(noFrames,10000);await video.play();
   if(mine!==version)return;clearTimeout(timer);
   const scan=async()=>{
    if(mine!==version||!valid()){stop();return;}
    try{if(video.readyState>=2&&video.videoWidth){const value=decode(video,video.videoWidth,video.videoHeight);if(value){await accept(value);return;}}else if(Date.now()-started>=10000){noFrames();return;}}
    catch(e){stop();status(e.message);return;}
    timer=setTimeout(scan,200);
   };scan();
  }catch(e){if(mine===version){stop();status(e.name==='NotAllowedError'?'Camera permission denied. Allow camera access in your browser or use Read QR image.':e.name==='NotFoundError'?'No camera found. Use Read QR image.':'Camera could not start. Use Read QR image.');}}
 };
 root.querySelector('[data-qr-stop]').onclick=()=>{stop();status('Camera stopped.');};
 root.querySelector('[data-qr-image]').onclick=()=>file.click();
 file.onchange=async()=>{
  const selected=file.files?.[0];if(!selected)return;stop();const mine=version;let bitmap;
  try{
   if(!['image/png','image/jpeg','image/webp'].includes(selected.type)||selected.size>8*1024*1024)throw Error('Choose a PNG, JPEG or WebP QR image smaller than 8 MB.');
   bitmap=await createImageBitmap(selected);if(mine!==version||!valid())return;
   if(bitmap.width*bitmap.height>24000000)throw Error('QR image dimensions are too large.');
   const text=decode(bitmap,bitmap.width,bitmap.height);if(!text)throw Error('No readable QR found. Use a clearer image or paste the address.');
   await accept(text);
  }catch(e){if(valid())status(e.message);}finally{bitmap?.close();file.value='';}
 };
 return {stop,dispose};
}
