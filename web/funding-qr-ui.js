import QRCode from 'qrcode';
import {NETWORKS,network,readClient,readToken} from './wallet-data.js';
import {address,same,cleanText} from './wallet-core.js';
import {FUNDING_ROUTES,receivePayload,parsePaymentRequest} from './funding-core.js';
export const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const esc=escapeHTML;
export async function copyFundingText(text,status){
 try{await navigator.clipboard.writeText(text);status('Copied.');}catch{status('Clipboard unavailable. Select and copy the displayed text.');}
}
export function showFundingReceive({recipient,chainId,view}){
 recipient=address(recipient);
 const v=view('Deposit to your wallet',`<p class="w-note">This QR belongs to your selected wallet. Receiving here does not automatically credit your Hyperliquid trading account.</p><label class="w-field">Network<select id="fundingReceiveNetwork">${NETWORKS.map(n=>`<option value="${n.chain.id}" ${chainId===n.chain.id?'selected':''}>${esc(n.name)}${n.testnet?' · Testnet':''}</option>`).join('')}</select></label><label class="w-field">Asset<select id="fundingReceiveAsset"></select></label><div id="fundingCustomToken" hidden><label class="w-field">ERC-20 contract<input id="fundingTokenContract" placeholder="0x…" autocomplete="off" spellcheck="false"></label><button id="fundingTokenRead" class="w-secondary" type="button">Read token contract</button></div><label class="w-field">QR format<select id="fundingReceiveFormat"><option value="address">Address only · exchange-compatible</option><option value="payment">Payment request · network / asset / amount</option></select></label><label class="w-field">Requested amount (optional)<input id="fundingReceiveAmount" inputmode="decimal" placeholder="Any amount" disabled></label><p id="fundingReceiveAssetInfo" class="w-note"></p><canvas id="fundingReceiveQR" class="w-qr" aria-label="Wallet deposit QR code"></canvas><div id="fundingReceiveAddress" class="w-address-box">${esc(recipient)}</div><div class="funding-grid"><button id="fundingCopyAddress" class="w-primary" type="button">Copy address</button><button id="fundingSaveQR" class="w-secondary" type="button" disabled>Save QR</button><button id="fundingShareQR" class="w-secondary" type="button">Share details</button><button id="fundingCopyRequest" class="w-secondary" type="button" disabled>Copy QR text</button></div><details><summary>Encoded QR text</summary><textarea id="fundingQrText" class="w-input" readonly rows="3"></textarea></details><div class="w-error">Verify the exact network and asset contract at the sender. An EVM address cannot identify the network by itself. Native Bitcoin, Solana and TRON deposits are not supported here.</div><p id="fundingQRStatus" class="w-inline-status" role="status"></p>`);
 const by=id=>v.root.querySelector('#'+id),status=t=>{if(v.valid())by('fundingQRStatus').textContent=cleanText(t,250);};
 let token=null,revision=0,payload='',ready=false;
 const net=()=>network(Number(by('fundingReceiveNetwork').value));
 function resetAssets(){const n=net(),route=Object.values(FUNDING_ROUTES).find(r=>r.chainId===n.chain.id);by('fundingReceiveAsset').innerHTML=`<option value="native">${esc(n.symbol)} · native asset</option>${route?'<option value="usdc">USDC · official bridge token</option>':''}<option value="custom">Other ERC-20 · verify contract</option>`;selectAsset();}
 function selectAsset(){const n=net(),kind=by('fundingReceiveAsset').value;by('fundingCustomToken').hidden=kind!=='custom';by('fundingTokenContract').value='';token=kind==='native'?{address:'native',decimals:18,symbol:n.symbol}:kind==='usdc'?{address:Object.values(FUNDING_ROUTES).find(r=>r.chainId===n.chain.id).usdc,decimals:6,symbol:'USDC'}:null;update();}
 async function update(){
  const version=++revision;ready=false;by('fundingSaveQR').disabled=true;by('fundingCopyRequest').disabled=true;by('fundingQrText').value='';
  const canvas=by('fundingReceiveQR');canvas.getContext('2d').clearRect(0,0,canvas.width,canvas.height);
  by('fundingReceiveAmount').disabled=by('fundingReceiveFormat').value==='address';
  if(!token){status('Read and verify the ERC-20 contract before generating a QR.');return;}
  try{
   const n=net(),mode=by('fundingReceiveFormat').value;
   payload=receivePayload({recipient,chainId:n.chain.id,token:token.address,decimals:token.decimals,value:by('fundingReceiveAmount').value,format:mode});
   by('fundingReceiveAssetInfo').textContent=`${n.name} · chain ID ${n.chain.id} · ${token.symbol}${token.address!=='native'?' · Contract '+token.address:''}. ${mode==='address'?'Address-only QR does NOT encode network, asset or amount. Select them manually in the sending app.':'Payment request is supported only by compatible EIP-681 wallets; verify their displayed details.'}`;
   const temp=document.createElement('canvas');await QRCode.toCanvas(temp,payload,{width:288,margin:4,errorCorrectionLevel:'M',color:{dark:'#000000',light:'#ffffff'}});
   if(!v.valid()||version!==revision)return;
   canvas.width=temp.width;canvas.height=temp.height;canvas.getContext('2d').drawImage(temp,0,0);by('fundingQrText').value=payload;ready=true;
   by('fundingSaveQR').disabled=false;by('fundingCopyRequest').disabled=false;status('QR ready. This is your wallet address, not the shared bridge contract.');
  }catch(e){status(e.message);}
 }
 by('fundingReceiveNetwork').onchange=resetAssets;by('fundingReceiveAsset').onchange=selectAsset;by('fundingReceiveFormat').onchange=update;by('fundingReceiveAmount').oninput=update;
 by('fundingTokenContract').oninput=()=>{token=null;update();};
 by('fundingTokenRead').onclick=async()=>{const version=++revision,n=net();token=null;ready=false;by('fundingSaveQR').disabled=true;by('fundingCopyRequest').disabled=true;try{const t=await readToken(readClient(n),address(by('fundingTokenContract').value),recipient);if(!v.valid()||version!==revision)return;token=t;await update();}catch(e){if(v.valid()&&version===revision)status(e.message);}};
 by('fundingCopyAddress').onclick=()=>copyFundingText(recipient,status);
 by('fundingCopyRequest').onclick=()=>ready&&copyFundingText(payload,status);
 by('fundingShareQR').onclick=async()=>{const n=net(),text=`BELTRIX wallet deposit\nNetwork: ${n.name} (chain ID ${n.chain.id})\nRecipient: ${recipient}\nAsset: ${token?.symbol||'Verify asset'}${token?.address&&token.address!=='native'?'\nContract: '+token.address:''}\nUse the exact network at the sender. This is not a direct Hyperliquid deposit.`;try{if(navigator.share)await navigator.share({title:'Wallet deposit details',text});else await copyFundingText(text,status);}catch(e){if(e.name!=='AbortError')status(e.message);}};
 by('fundingSaveQR').onclick=()=>{if(!ready)return;const out=document.createElement('canvas');out.width=780;out.height=1040;const c=out.getContext('2d');c.fillStyle='#fff';c.fillRect(0,0,780,1040);c.fillStyle='#111';c.textAlign='center';c.font='bold 30px sans-serif';c.fillText('BELTRIX · Wallet deposit',390,52);c.font='22px sans-serif';c.fillText(`${net().name} · ${token.symbol} · ${net().chain.id}`,390,95);c.imageSmoothingEnabled=false;c.drawImage(by('fundingReceiveQR'),66,125,648,648);c.font='23px monospace';c.fillText(recipient.slice(0,22),390,810);c.fillText(recipient.slice(22),390,842);c.font='18px sans-serif';c.fillText(by('fundingReceiveFormat').value==='address'?'Address only — select network and asset manually.':'EIP-681 payment request — verify details before sending.',390,884);c.fillText('Not the Hyperliquid bridge address.',390,920);if(token.address!=='native'){c.font='14px monospace';c.fillText('Token: '+token.address,390,958);}const a=document.createElement('a');a.download=`BELTRIX-wallet-deposit-${net().chain.id}.png`;a.href=out.toDataURL('image/png');a.click();};
 resetAssets();
}

/** Extend the existing, validated Send form. Importing a QR only fills fields. */
export function installPaymentRequestImport(){
 const host=document.getElementById('wDialogBody');
 const mount=()=>{
  const recipient=host.querySelector('#wSendTo'),asset=host.querySelector('#wSendAsset'),quantity=host.querySelector('#wSendAmount');
  if(!recipient||host.querySelector('#fundingPaymentImport'))return;
  const panel=document.createElement('details');panel.id='fundingPaymentImport';panel.innerHTML='<summary>Import payment QR text / image</summary><label class="w-field">Address or ethereum: request<textarea id="fundingPaymentText" class="w-input" rows="3" maxlength="1024"></textarea></label><input id="fundingQRFile" type="file" accept="image/*" hidden><div class="funding-grid"><button id="fundingApplyPayment" class="w-secondary" type="button">Apply request</button><button id="fundingReadQRImage" class="w-secondary" type="button">Read QR image</button></div><p class="w-note">Import only fills recipient and optional amount. It never approves a token, switches a network or sends funds. The normal transfer review is still required.</p><p id="fundingImportStatus" class="w-inline-status" role="status"></p>';
  recipient.parentElement.after(panel);
  const q=id=>panel.querySelector('#'+id),status=t=>q('fundingImportStatus').textContent=cleanText(t,220);
  q('fundingApplyPayment').onclick=async()=>{
   const provider=window.beltrixWallet?.provider,account=window.beltrixWallet?.account,selected=asset.value,text=q('fundingPaymentText').value;
   try{if(!provider)throw Error('Connect your sending wallet first.');const chainId=Number(await provider.request({method:'eth_chainId'}));
    const t=selected==='native'?{decimals:18}:await readToken(readClient(network(chainId),provider),selected,account);
    const parsed=parsePaymentRequest(text,{chainId,token:selected,decimals:t.decimals});
    const actual=Number(await provider.request({method:'eth_chainId'}));
    if(!recipient.isConnected||asset.value!==selected||actual!==chainId||provider!==window.beltrixWallet?.provider||!same(account,window.beltrixWallet?.account))throw Error('Send form or wallet changed. Import again.');
    recipient.value=parsed.recipient;if(parsed.value!==null)quantity.value=parsed.value;
    for(const el of [recipient,quantity]){el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));}
    status(parsed.networkSpecified?'Request imported. Review the full recipient and amount.':'Address imported. No network was encoded; verify the selected network.');
   }catch(e){status(e.message);}
  };
  const scan=q('fundingReadQRImage');
  if(!globalThis.BarcodeDetector){scan.disabled=true;status('QR image scanning is unavailable in this browser. Paste the address or QR text instead.');}
  scan.onclick=()=>q('fundingQRFile').click();
  q('fundingQRFile').onchange=async()=>{let image;try{const f=q('fundingQRFile').files[0];if(!f||f.size>8*1024*1024)throw Error('Choose a QR image smaller than 8 MB.');image=await createImageBitmap(f);const results=await new BarcodeDetector({formats:['qr_code']}).detect(image);if(results.length!==1)throw Error('Use an image containing exactly one readable QR.');q('fundingPaymentText').value=results[0].rawValue;status('Decoded locally. Select Apply request, then review the transfer.');}catch(e){status(e.message);}finally{image?.close();q('fundingQRFile').value='';}};
 };
 new MutationObserver(mount).observe(host,{childList:true,subtree:true});mount();
}
