import QRCode from 'qrcode';
import {ExchangeClient,HttpTransport,InfoClient} from '@nktkas/hyperliquid';
import {createWalletClient,custom,erc20Abi,decodeFunctionResult,parseAbi,parseEventLogs,toHex,formatUnits} from 'viem';
import {readClient,network as walletNetwork} from './wallet-data.js';
import {address,same,short,hashOK,cleanText} from './wallet-core.js';
import {getFundingSession,withFundingSession} from './trading.js';
import {fundingNetwork,fundingIntent,depositRequest,usd,usdText,optionalUsd,spotAvailable,assertFundingReview,fundingFingerprint,matchingDepositTransaction,matchingWithdrawal,transferEvidence,paymentRequest,parsePaymentRequest,DOCUMENTED_WITHDRAWAL_FEE} from './funding-core.js';

const $=id=>document.getElementById(id),esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const JOURNAL='beltrix-funding-v1',LOCKED=new Set(['Preparing','Unknown','Pending','Withdrawal pending']);
const bridgeAbi=parseAbi(['function paused() view returns (bool)','function usdcToken() view returns (address)','event FinalizedWithdrawal(address indexed user, address destination, uint64 usd, uint64 nonce, bytes32 message)']);
let view='deposit',version=0,busy=false,review=null,balances=null,session=null,checking=false,lastPoll=0;
const err=e=>cleanText(e?.shortMessage||e?.message||'Request failed. No automatic retry was made.',280);
function status(text){if($('fStatus'))$('fStatus').textContent=text;}
function readRecords(){
 let rows;try{rows=JSON.parse(localStorage.getItem(JOURNAL)||'[]');}catch{throw Error('Funding journal is unreadable. Do not retry an earlier transfer.');}
 if(!Array.isArray(rows))throw Error('Funding journal is invalid.');
 for(const r of rows){if(!r||typeof r.id!=='string'||!Object.hasOwn({deposit:1,withdraw:1,transfer:1},r.kind)||!['mainnet','testnet'].includes(r.network)||!/^0x[0-9a-f]{40}$/i.test(r.account)||typeof r.status!=='string')throw Error('Funding journal is invalid. Reconcile your transactions before submitting.');}
 return rows;
}
function putRecord(record){
 const rows=readRecords().filter(x=>x.id!==record.id);rows.unshift(record);
 // Never discard an unresolved request just to enforce a history limit.
 const saved=[...rows.filter(x=>LOCKED.has(x.status)),...rows.filter(x=>!LOCKED.has(x.status)).slice(0,200)];
 localStorage.setItem(JOURNAL,JSON.stringify(saved));
}
function scopedRecords(s){return readRecords().filter(r=>r.network===s.network&&same(r.account,s.account));}
function assertNoPending(s){
 if(scopedRecords(s).some(r=>LOCKED.has(r.status)))throw Error('An earlier funding request is pending or unconfirmed. Open Funding history and check its status; do not resend.');
 const walletRows=JSON.parse(localStorage.getItem('beltrix-transactions-v1')||'[]');
 if(Array.isArray(walletRows)&&walletRows.some(r=>same(r.account,s.account)&&r.chainId===fundingNetwork(s.network).chainId&&['Preparing','Unknown','Pending'].includes(r.status)))throw Error('A wallet transfer is pending. Reconcile it in Wallet notifications first.');
}
function api(net){return new InfoClient({transport:new HttpTransport({isTestnet:net==='testnet',timeout:12000})});}
function rpc(s){return readClient(walletNetwork(fundingNetwork(s.network).chainId),s.provider);}
function atSameSession(s){const now=getFundingSession();return now.connected&&now.provider===s.provider&&fundingFingerprint(now)===fundingFingerprint(s);}
function bind(id,fn,event='click'){const el=$(id);if(el)el.addEventListener(event,e=>Promise.resolve().then(()=>fn(e)).catch(e=>status(err(e))));}
function activeVersion(v,s){return v===version&&$('fundingDialog').open&&atSameSession(s);}
function close(){if(busy)return;version++;review=null;balances=null;session=null;$('fundingDialog').close();}
function controlsDisabled(disabled){for(const e of $('fundingDialog').querySelectorAll('button,input,select'))e.disabled=disabled;}
function mount(){
 if($('fundingDialog'))return;
 const css=document.createElement('link');css.rel='stylesheet';css.href='./funding.css';document.head.append(css);
 const bar=document.createElement('div');bar.className='funding-toolbar';bar.setAttribute('aria-label','Trading funds');
 bar.innerHTML='<button id="tradeDeposit" type="button">Deposit</button><button id="tradeWithdraw" type="button">Withdraw</button><button id="tradeTransferFunds" type="button">Spot ↔ Perps</button><button id="tradeFundingHistory" type="button">Funding history</button>';
 document.querySelector('.market-card > .market-controls').after(bar);
 document.body.insertAdjacentHTML('beforeend','<dialog id="fundingDialog" class="funding-modal" aria-labelledby="fundingTitle"><header><h2 id="fundingTitle">Trading funds</h2><button id="fundingClose" type="button" aria-label="Close funding">×</button></header><div id="fundingBody"></div><p id="fStatus" role="status"></p></dialog>');
 for(const [id,mode] of [['tradeDeposit','deposit'],['tradeWithdraw','withdraw'],['tradeTransferFunds','transfer'],['tradeFundingHistory','history']])bind(id,()=>open(mode));
 bind('fundingClose',close);$('fundingDialog').addEventListener('cancel',e=>{e.preventDefault();close();});
 const walletEntry=()=>{if(!$('wallet')||$('walletFundingEntry'))return;const b=document.createElement('button');b.id='walletFundingEntry';b.type='button';b.className='w-secondary full';b.textContent='Trading account · Deposit / Withdraw';b.addEventListener('click',()=>open('deposit'));const entry=document.querySelector('.w-trading-entry');if(entry)entry.append(b);else $('wallet').append(b);};
 walletEntry();window.addEventListener('load',walletEntry,{once:true});
 document.documentElement.dataset.fundingUx='v1';
}
async function readBalances(s){
 const net=fundingNetwork(s.network),client=rpc(s),info=api(s.network);
 const result=await Promise.allSettled([
  client.readContract({address:address(net.token),abi:erc20Abi,functionName:'balanceOf',args:[address(s.account)]}),
  info.clearinghouseState({user:s.account}),info.spotClearinghouseState({user:s.account}),info.userAbstraction({user:s.account})
 ]);
 const get=i=>result[i].status==='fulfilled'?result[i].value:null;
 return {at:Date.now(),wallet:typeof get(0)==='bigint'?get(0):null,perps:optionalUsd(get(1)?.withdrawable),spot:spotAvailable(get(2)),mode:get(3),partial:result.some(r=>r.status==='rejected')};
}
function lines(s){const n=fundingNetwork(s.network);return `<span class="funding-badge ${s.network==='mainnet'?'live':''}">${s.network==='mainnet'?'MAINNET · REAL FUNDS':'TESTNET · TEST FUNDS'}</span><dl class="funding-lines"><div><dt>Network</dt><dd>${esc(n.label)} · ${n.chainId}</dd></div><div><dt>Account</dt><dd>${esc(s.account||'Not connected')}</dd></div><div><dt>Asset</dt><dd>Native USDC · 6 decimals</dd></div></dl>`;}
function open(mode='deposit'){
 if(busy)return;view=mode;version++;review=null;balances=null;session=getFundingSession();const s=session,net=fundingNetwork(s.network);
 $('fundingTitle').textContent=mode==='history'?'Funding history':mode==='receive'?'Receive USDC in wallet':mode==='withdraw'?'Withdraw to wallet':mode==='transfer'?'Spot ↔ Perps transfer':'Deposit to trading account';
 $('fundingBody').innerHTML=lines(s);status('');if(!$('fundingDialog').open)$('fundingDialog').showModal();
 if(!s.connected){$('fundingBody').insertAdjacentHTML('beforeend','<p class="funding-note">Connect the trading wallet on your selected network first. Wallet balances and trading balances are separate. No address or QR is invented.</p><button id="fConnect" class="primary" type="button">Connect trading wallet</button>');bind('fConnect',()=>{close();$('tradeConnect').click();});return;}
 if(s.blocked){status('Finish or cancel the open trading review before managing funds.');return;}
 if(mode==='receive'){renderReceive(s);return;}if(mode==='history'){try{renderHistory(s);}catch(e){status(err(e));}return;}
 const name=mode==='deposit'?'Wallet USDC → Hyperliquid trading account':mode==='withdraw'?'Hyperliquid available Perps USDC → Arbitrum wallet':'Transfer USDC between your own Spot and Perps accounts';
 $('fundingBody').insertAdjacentHTML('beforeend',`<p class="funding-route">${esc(name)}</p><div id="fBalances" class="funding-balances">Loading available balances…</div>${mode==='deposit'?'<div class="funding-warning">Native USDC only. Do not send USDT, USDC.e, ETH, or assets on another chain to the bridge. Minimum bridge deposit: 5 USDC.</div><button id="fReceive" class="wallet" type="button">Receive USDC · Address / QR</button>':''}${mode==='withdraw'?`<label class="funding-field">Destination wallet<input id="fDestination" value="${esc(s.account)}" autocomplete="off" spellcheck="false" aria-describedby="fDestinationNote"></label><p id="fDestinationNote" class="funding-note">Use an address that receives native USDC on ${esc(net.label)}. A compatible address/network QR request may be pasted. No memo is supported.</p><p class="funding-warning">Withdrawable balance is not total equity. The documented venue fee is 1 USDC, deducted from the requested amount. BELTRIX minimum: 2 USDC. Settlement is not instant.</p>`:''}${mode==='transfer'?'<label class="funding-field">Direction<select id="fDirection"><option value="toPerp">Spot → Perps</option><option value="toSpot">Perps → Spot</option></select></label><p class="funding-note">Standard accounts only. Unified/portfolio modes are not changed by this action.</p>':''}<label class="funding-field">Amount (USDC)<input id="fAmount" inputmode="decimal" placeholder="0.00" autocomplete="off"></label><div class="funding-small-actions"><button id="fMax" type="button" disabled>MAX</button><button id="fRefresh" type="button">Refresh balances</button></div><p id="fNetAmount" class="funding-note"></p><button id="fReview" class="primary" type="button" disabled>Review ${mode}</button><button id="fHistory" class="wallet" type="button">Funding history</button><p class="funding-note">BELTRIX does not hold your keys. Every write requires your connected wallet. Sending to your wallet does not automatically fund your trading account.</p><a class="funding-link" href="${net.venue}" target="_blank" rel="noopener noreferrer">Open official Hyperliquid ↗</a>`);
 bind('fReceive',()=>open('receive'));bind('fHistory',()=>open('history'));bind('fRefresh',()=>refreshBalances());bind('fReview',prepare);
 bind('fMax',()=>{if(!balances||Date.now()-balances.at>30000)throw Error('Refresh balances first.');const n=mode==='deposit'?balances.wallet:mode==='withdraw'?balances.perps:$('fDirection').value==='toPerp'?balances.spot:balances.perps;if(n===null)throw Error('Available balance unknown.');$('fAmount').value=usdText(n);amountHint();});
 bind('fAmount',amountHint,'input');refreshBalances().catch(e=>status(err(e)));
}
function amountHint(){if(!$('fNetAmount'))return;try{$('fNetAmount').textContent=view==='withdraw'?(usd($('fAmount').value)<2000000n?'Minimum withdrawal: 2 USDC.':`Estimated receipt: ${usdText(usd($('fAmount').value)-DOCUMENTED_WITHDRAWAL_FEE)} USDC after documented fee.`):'';}catch{$('fNetAmount').textContent='';}}
async function refreshBalances(){
 const s=session,v=version;if(!s||busy)return;busy=true;controlsDisabled(true);status('Reading wallet and trading balances…');
 try{const data=await withFundingSession(s,async({check})=>{const x=await readBalances(s);await check();return x;});if(!activeVersion(v,s))return;balances=data;
 $('fBalances').textContent=`Wallet: ${data.wallet===null?'unavailable':usdText(data.wallet)} USDC · Perps withdrawable: ${data.perps===null?'unavailable':usdText(data.perps)} USDC · Spot available: ${data.spot===null?'unavailable':usdText(data.spot)} USDC`;
 status(data.partial?'Some sources are unavailable. Unsupported actions remain blocked at review.':'Balances refreshed. Review checks them again.');
 }finally{busy=false;if(v===version&&$('fundingDialog').open)controlsDisabled(false);}
}
function renderReceive(s){
 const net=fundingNetwork(s.network),v=version;
 $('fundingBody').insertAdjacentHTML('beforeend',`<p class="funding-warning">This is YOUR wallet address, not the shared bridge contract. Receive native USDC here first, then use Deposit. Never withdraw from an exchange directly to the shared bridge.</p><p class="funding-note">Token contract: <span class="funding-address">${esc(address(net.token))}</span></p><label class="funding-field">QR format<select id="fQrFormat"><option value="address">Address only · exchange-compatible</option><option value="request">USDC + network · EIP-681</option></select></label><label class="funding-field">Requested amount (optional)<input id="fQrAmount" inputmode="decimal" placeholder="Leave blank for any amount"></label><canvas id="fQR" class="funding-qr" aria-label="Personal wallet USDC receive QR"></canvas><div id="fQrAddress" class="funding-address">${esc(address(s.account))}</div><p id="fQrNote" class="funding-note"></p><div class="funding-small-actions"><button id="fQrCopy" type="button">Copy address</button><button id="fQrSave" type="button" disabled>Save QR</button></div><button id="fDepositBack" class="primary" type="button">Next: Deposit from wallet</button>`);
 let generated=false,sequence=0;
 const draw=async()=>{const seq=++sequence;generated=false;$('fQrSave').disabled=true;const canvas=$('fQR');canvas.getContext('2d').clearRect(0,0,canvas.width,canvas.height);delete canvas.dataset.payload;const requested=$('fQrAmount').value.trim();if(requested)usd(requested);const format=$('fQrFormat').value,payload=format==='address'?address(s.account):paymentRequest({recipient:s.account,chainId:net.chainId,token:net.token,quantity:requested});
 $('fQrNote').textContent=format==='address'?`Address-only QR: select ${net.label} and native USDC in the sending app. Any requested amount is not encoded.`:'Network and USDC contract are encoded. Verify support in the sending app; scanning never submits a transfer.';
 await QRCode.toCanvas($('fQR'),payload,{width:256,margin:4,color:{dark:'#111111',light:'#ffffff'}});if(v!==version||seq!==sequence)return;generated=true;$('fQR').dataset.payload=payload;$('fQrSave').disabled=false;status('');};
 bind('fQrFormat',draw,'change');bind('fQrAmount',draw,'input');bind('fQrCopy',async()=>{await navigator.clipboard.writeText(address(s.account));status('Wallet address copied. Confirm the network separately.');});bind('fDepositBack',()=>open('deposit'));
 bind('fQrSave',()=>{if(!generated)return;const out=document.createElement('canvas');out.width=800;out.height=1000;const c=out.getContext('2d');c.fillStyle='#fff';c.fillRect(0,0,800,1000);c.fillStyle='#111';c.textAlign='center';c.font='bold 26px sans-serif';c.fillText('BELTRIX · Receive native USDC',400,52);c.font='24px sans-serif';c.fillText(`${net.label} · Chain ${net.chainId}`,400,95);c.imageSmoothingEnabled=false;c.drawImage($('fQR'),80,125,640,640);c.font='18px monospace';c.fillText(address(s.account),400,820);c.font='20px sans-serif';c.fillText(s.network==='mainnet'?'MAINNET · REAL FUNDS':'TESTNET ONLY',400,875);c.fillText('Wallet receipt is not a trading-account deposit.',400,920);const a=document.createElement('a');a.href=out.toDataURL('image/png');a.download=`BELTRIX-USDC-${net.chainId}-${s.account}.png`;a.click();});draw().catch(e=>status(err(e)));
}
async function depositPreflight(s,intent){
 const net=fundingNetwork(s.network),client=rpc(s),request=depositRequest(intent);
 const [paused,token,decimals,code,gas,gasPrice,native,nonce]=await Promise.all([
  client.readContract({address:address(net.bridge),abi:bridgeAbi,functionName:'paused'}),client.readContract({address:address(net.bridge),abi:bridgeAbi,functionName:'usdcToken'}),client.readContract({address:address(net.token),abi:erc20Abi,functionName:'decimals'}),client.getCode({address:s.account}),
  client.estimateGas({account:s.account,to:request.to,data:request.data,value:0n}),client.getGasPrice(),client.getBalance({address:s.account}),client.getTransactionCount({address:s.account,blockTag:'pending'})
 ]);
 if(paused!==false||!same(token,net.token)||decimals!==6)throw Error('Bridge configuration is unverified or paused. No deposit is allowed.');
 if(code&&code!=='0x')throw Error('Contract/delegated wallets require a separately verified deposit flow. Use the official venue.');
 if(gas<=0n||gasPrice<=0n)throw Error('Gas estimate unavailable.');const gasLimit=(gas*120n+99n)/100n,budgetPrice=(gasPrice*125n+99n)/100n;
 if(native<gasLimit*budgetPrice)throw Error('Insufficient Arbitrum ETH for the deposit gas budget.');
 const simulation=await client.call({account:s.account,to:request.to,data:request.data,value:0n});
 if(!simulation.data||decodeFunctionResult({abi:erc20Abi,functionName:'transfer',data:simulation.data})!==true)throw Error('USDC transfer simulation did not succeed.');
 return {request,gas:gasLimit,gasPrice:budgetPrice,fee:gasLimit*budgetPrice,txNonce:nonce};
}
async function prepare(){
 if(busy||!session)return;const s=session,v=version,kind=view;assertNoPending(s);
 const input={kind,network:s.network,account:s.account,quantity:$('fAmount').value,toPerp:kind==='transfer'?$('fDirection').value==='toPerp':undefined};
 if(kind==='withdraw'){const request=parsePaymentRequest($('fDestination').value,{chainId:fundingNetwork(s.network).chainId,token:fundingNetwork(s.network).token,decimals:6});if(request.quantity!==null&&usd(request.quantity)!==usd(input.quantity))throw Error('QR requested amount differs from the entered withdrawal amount.');input.destination=request.recipient;}
 busy=true;controlsDisabled(true);status('Checking available funds, network and transaction details…');
 try{const p=await withFundingSession(s,async({check})=>{const b=await readBalances(s),intent=fundingIntent({...input,balances:b});const extra=kind==='deposit'?await depositPreflight(s,intent):{startBlock:(await rpc(s).getBlockNumber()).toString()};await check();return {...intent,...extra,epoch:s.epoch,provider:s.provider,created:Date.now(),expires:Date.now()+30000};});if(!activeVersion(v,s))throw Error('Funding form changed. Review again.');showReview(p);
 }finally{busy=false;if(v===version&&$('fundingDialog').open){controlsDisabled(false);if($('fConfirm'))$('fConfirm').disabled=!$('fAck').checked;}}
}
function showReview(p){
 review=p;const net=fundingNetwork(p.network);$('fundingTitle').textContent='Review '+p.kind;
 $('fundingBody').innerHTML=lines(p)+`<div class="funding-amount">${esc(p.quantity)} USDC</div><dl class="funding-lines"><div><dt>Action</dt><dd>${p.kind==='deposit'?'Wallet → trading account':p.kind==='withdraw'?'Perps → Arbitrum wallet':p.toPerp?'Spot → Perps':'Perps → Spot'}</dd></div><div><dt>${p.kind==='deposit'?'Official bridge':'Recipient'}</dt><dd>${esc(p.destination)}</dd></div><div><dt>Token contract</dt><dd>${esc(address(net.token))}</dd></div>${p.kind==='deposit'?`<div><dt>Gas budget</dt><dd>${formatUnits(p.fee,18)} ETH</dd></div><div><dt>Wallet nonce</dt><dd>${p.txNonce}</dd></div>`:p.kind==='withdraw'?`<div><dt>Documented fee</dt><dd>1 USDC</dd></div><div><dt>Estimated receipt</dt><dd>${usdText(BigInt(p.units)-DOCUMENTED_WITHDRAWAL_FEE)} USDC</dd></div>`:'<div><dt>Network gas</dt><dd>No EVM transfer</dd></div>'}</dl><p class="funding-warning">${p.network==='mainnet'?'This action moves REAL FUNDS. ':''}${p.kind==='deposit'?'Only this connected wallet is credited. On-chain confirmation and trading-account credit are separate. Gas budget is an estimate; check final fees in your wallet.':p.kind==='withdraw'?'An accepted request is not proof of delivery. Completion is verified from the bridge finalization event and USDC transfer. Fees and settlement time can change.':'This changes margin allocation. Check open positions before moving funds out of Perps.'}</p><label class="funding-check"><input id="fAck" type="checkbox">I checked the full address, network, asset, amount and fees.</label><button id="fConfirm" class="primary" type="button" disabled>Confirm in wallet</button><button id="fEdit" class="wallet" type="button">Back</button><p class="funding-note">Review expires in 30 seconds. No approvals or unlimited token allowances are requested.</p>`;
 status('Review every detail before signing.');bind('fAck',()=>{$('fConfirm').disabled=!$('fAck').checked||busy;},'change');bind('fEdit',()=>open(p.kind));bind('fConfirm',submit);
}
function isRejection(e){for(let x=e;x;x=x.cause)if(x.code===4001)return true;return e?.name==='ApiRequestError';}
async function submit(){
 if(busy||!review||!$('fAck')?.checked)return;const p=review,v=version;busy=true;controlsDisabled(true);let record=null,attempted=false;
 try{
  if(!navigator.locks?.request)throw Error('This browser cannot safely coordinate funding submissions. Use a browser with Web Locks support.');
  await navigator.locks.request(`beltrix-funding:${p.network}:${p.account.toLowerCase()}`,{ifAvailable:true},async lock=>{
   if(!lock)throw Error('A funding request is active in another tab.');
   assertFundingReview(p,getFundingSession());assertNoPending(p);
   await withFundingSession(p,async({check})=>{
    const valid=async()=>{assertFundingReview(p,getFundingSession());if(version!==v||!$('fundingDialog').open)throw Error('Funding review was closed.');await check();assertFundingReview(p,getFundingSession());};
    await valid();const latest=await readBalances(p);fundingIntent({...p,balances:latest});
    let deposit;
    if(p.kind==='deposit'){deposit=await depositPreflight(p,p);if(deposit.txNonce!==p.txNonce||deposit.gas>p.gas||deposit.gasPrice>p.gasPrice)throw Error('Nonce or network gas changed. Review again.');}
    await valid();
    record={id:crypto.randomUUID(),kind:p.kind,network:p.network,account:p.account,destination:p.destination,quantity:p.quantity,units:p.units,toPerp:p.toPerp,created:Date.now(),status:'Preparing',txNonce:p.txNonce,startBlock:p.startBlock,hash:null};
    putRecord(record);status('Approve the exact request in your wallet. Do not submit it again.');
    if(p.kind==='deposit'){
     attempted=true;const hash=await p.provider.request({method:'eth_sendTransaction',params:[{...p.request,value:'0x0',chainId:toHex(fundingNetwork(p.network).chainId),gas:toHex(p.gas),gasPrice:toHex(p.gasPrice),nonce:toHex(p.txNonce)}]});
     if(!hashOK(hash))throw Error('Wallet returned no verifiable transaction hash.');record.hash=hash;record.status='Pending';
    }else{
     const base=new HttpTransport({isTestnet:p.network==='testnet',timeout:15000});
     const transport={isTestnet:p.network==='testnet',async request(endpoint,payload,signal){if(endpoint==='exchange'){await valid();attempted=true;}return base.request(endpoint,payload,signal);}};
     const raw=createWalletClient({account:p.account,chain:walletNetwork(fundingNetwork(p.network).chainId).chain,transport:custom(p.provider,{retryCount:0})});
     const wallet={...raw,async signTypedData(request){await valid();record.actionNonce=Number(request.message.time??request.message.nonce);if(!Number.isSafeInteger(record.actionNonce))throw Error('Invalid funding nonce.');putRecord(record);const signed=await raw.signTypedData(request);await valid();return signed;}};
     const client=new ExchangeClient({wallet,transport,signatureChainId:toHex(fundingNetwork(p.network).chainId)});
     const result=p.kind==='withdraw'?await client.withdraw3({destination:p.destination,amount:p.quantity}):await client.usdClassTransfer({amount:p.quantity,toPerp:p.toPerp});
     if(result.status!=='ok'||result.response?.type!=='default')throw Error('Funding response is not confirmed.');record.status=p.kind==='withdraw'?'Withdrawal pending':'Accepted by Hyperliquid';
    }
    putRecord(record);review=null;
   });
  });
  busy=false;open('history');
 }catch(e){
  if(record){record.status=isRejection(e)?'Rejected':attempted?'Unknown':'Not submitted';record.error=err(e);try{putRecord(record);}catch{status('Storage failed. Preserve the wallet transaction hash. Do not retry this transfer.');}}
  review=null;$('fundingBody').insertAdjacentHTML('beforeend','<button id="fAfterError" class="wallet" type="button">Open funding history</button>');bind('fAfterError',()=>open('history'));status(err(e)+(record?.status==='Unknown'?' The result is uncertain. Check history before any retry.':''));
 }finally{busy=false;if($('fundingClose'))$('fundingClose').disabled=false;if($('fAfterError'))$('fAfterError').disabled=false;}
}
async function verifyDeposit(r,s,providedHash){
 const hash=providedHash||r.hash;if(!hashOK(hash))throw Error('Find the transaction hash in your wallet activity and enter it below.');
 const client=rpc(s),tx=await client.getTransaction({hash});if(!matchingDepositTransaction(r,tx))throw Error('Transaction does not match the reviewed sender, token, amount, bridge and nonce.');
 const receipt=await client.getTransactionReceipt({hash});if(!receipt)throw Error('Transaction is still pending.');
 if(receipt.status==='reverted'){r.status='Failed';r.hash=hash;putRecord(r);return;}
 if(!same(receipt.from,r.account)||!same(receipt.to,fundingNetwork(r.network).token)||!transferEvidence(receipt,fundingNetwork(r.network),r.account,r.destination,r.units))throw Error('Matching USDC transfer could not be verified.');
 r.hash=hash;r.status='Arbitrum confirmed';r.confirmedAt=Date.now();putRecord(r);
}
async function verifyWithdrawal(r,s,providedHash){
 if(!Number.isSafeInteger(r.actionNonce))throw Error('Withdrawal nonce is not available. Check the official venue.');
 const net=fundingNetwork(r.network),client=rpc(s);let matches;
 if(providedHash){const receipt=await client.getTransactionReceipt({hash:providedHash});matches=parseEventLogs({abi:bridgeAbi,eventName:'FinalizedWithdrawal',logs:receipt.logs||[],strict:true}).filter(x=>matchingWithdrawal(r,x));}
 else{const latest=await client.getBlockNumber(),start=BigInt(r.scanBlock||r.startBlock),end=start+1999n<latest?start+1999n:latest;if(start>latest)return;
 const logs=await client.getLogs({address:address(net.bridge),event:bridgeAbi.find(a=>a.type==='event'),args:{user:address(r.account)},fromBlock:start,toBlock:end,strict:true});matches=logs.filter(x=>matchingWithdrawal(r,x));r.scanBlock=end.toString();putRecord(r);}
 for(const log of matches){const receipt=await client.getTransactionReceipt({hash:log.transactionHash});if(!transferEvidence(receipt,net,net.bridge,r.destination,log.args.usd))throw Error('Bridge event found but matching token delivery is unverified.');r.status='Arbitrum confirmed';r.hash=log.transactionHash;r.receivedUnits=log.args.usd.toString();r.confirmedAt=Date.now();putRecord(r);return;}
 if(providedHash)throw Error('Receipt does not contain the exact bridge withdrawal nonce and recipient.');
}
async function checkRecords(s){
 for(const r of scopedRecords(s).filter(r=>LOCKED.has(r.status)).slice(0,10)){
  try{if(r.kind==='deposit'&&r.hash)await verifyDeposit(r,s);else if(r.kind==='withdraw')await verifyWithdrawal(r,s);}catch(e){r.lastCheck=err(e);putRecord(r);}
 }
}
function renderHistory(s){
 const net=fundingNetwork(s.network);$('fundingBody').insertAdjacentHTML('beforeend','<p class="funding-note">Submitted here and venue ledger records are shown separately. A wallet receipt is not proof of Hyperliquid credit. A withdrawal is delivered only after a matching bridge event and token transfer.</p><button id="fHistoryRefresh" class="wallet" type="button">Refresh / check status</button><button id="fNewDeposit" class="wallet" type="button">Deposit</button><div id="fLocalHistory"></div><h3>Hyperliquid ledger · last 7 days</h3><div id="fVenueHistory">Loading…</div>');
 bind('fNewDeposit',()=>open('deposit'));bind('fHistoryRefresh',()=>refreshHistory(s));paintRecords(s);refreshHistory(s).catch(e=>status(err(e)));
 $('fundingBody').insertAdjacentHTML('beforeend',`<a class="funding-link" href="${net.venue}" target="_blank" rel="noopener noreferrer">Verify on official Hyperliquid ↗</a>`);
}
function paintRecords(s){
 if(!$('fLocalHistory'))return;const net=fundingNetwork(s.network),rows=scopedRecords(s);
 $('fLocalHistory').innerHTML=rows.length?rows.map(r=>`<article class="funding-record"><strong>${esc(r.kind)} · ${esc(r.quantity)} USDC</strong><span>${esc(r.status)}</span><small>${esc(new Date(r.created).toLocaleString('en-US'))}</small><div class="funding-address">${esc(r.destination)}</div>${hashOK(r.hash)?`<a class="funding-link" href="${net.explorer}/tx/${r.hash}" target="_blank" rel="noopener noreferrer">Transaction ${esc(short(r.hash))} ↗</a>`:''}${r.kind==='deposit'&&r.status==='Arbitrum confirmed'?'<p class="funding-note">USDC reached the bridge. Check the ledger below for trading credit; BELTRIX does not infer it from a balance increase.</p>':''}${r.receivedUnits?`<p>Verified received: ${esc(usdText(r.receivedUnits))} USDC</p>`:''}${LOCKED.has(r.status)?`<p class="funding-warning">Do not repeat this request. ${esc(r.lastCheck||r.error||'Awaiting verifiable confirmation.')}</p>${r.kind!=='transfer'?`<label class="funding-field">Transaction hash from wallet / explorer<input data-reconcile-hash="${esc(r.id)}" placeholder="0x…" autocomplete="off"></label><button type="button" data-reconcile-funding="${esc(r.id)}">Verify transaction</button>`:'<p class="funding-note">An ambiguous Spot/Perps response remains locked. Verify its result with the venue; a similar amount in the ledger is not sufficient to identify this request.</p>'}`:''}</article>`).join(''):'<p class="funding-note">No funding requests submitted from this browser for this account/network.</p>';
 for(const b of $('fLocalHistory').querySelectorAll('[data-reconcile-funding]'))b.onclick=async()=>{if(checking||busy)return;const r=scopedRecords(s).find(r=>r.id===b.dataset.reconcileFunding),input=[...$('fLocalHistory').querySelectorAll('[data-reconcile-hash]')].find(i=>i.dataset.reconcileHash===r.id),hash=input.value.trim();if(!hashOK(hash))return status('Enter a valid transaction hash.');checking=true;b.disabled=true;try{await withFundingSession(s,async({check})=>{await check();if(r.kind==='deposit')await verifyDeposit(r,s,hash);else await verifyWithdrawal(r,s,hash);await check();});if(atSameSession(s)){paintRecords(s);status('Exact transaction verified.');}}catch(e){status(err(e));}finally{checking=false;b.disabled=false;}};
}
async function refreshHistory(s){
 if(checking||busy)return;const v=version;checking=true;lastPoll=Date.now();if($('fHistoryRefresh'))$('fHistoryRefresh').disabled=true;
 try{await withFundingSession(s,async({check})=>{await checkRecords(s);await check();});if(!activeVersion(v,s))return;paintRecords(s);
 const data=await api(s.network).userNonFundingLedgerUpdates({user:s.account,startTime:Date.now()-7*86400000});if(!activeVersion(v,s))return;
 if(!Array.isArray(data))throw Error('Venue ledger unavailable.');const rows=data.filter(r=>['deposit','withdraw','accountClassTransfer'].includes(r.delta?.type)).slice(-100).reverse();
 $('fVenueHistory').innerHTML=rows.length?rows.map(r=>`<article class="funding-record"><strong>${esc(r.delta.type)} · ${esc(r.delta.usdc)} USDC</strong><small>${esc(new Date(r.time).toLocaleString('en-US'))}</small><div class="funding-address">Hyperliquid ledger hash: ${esc(r.hash)}</div>${r.delta.destination?`<div class="funding-address">To: ${esc(r.delta.destination)}</div>`:''}<p class="funding-note">${r.delta.type==='withdraw'?'Ledger record only; not proof of arrival on Arbitrum.':'Reported by Hyperliquid.'}</p></article>`).join(''):'<p class="funding-note">No returned deposit/withdrawal/transfer records in this time window.</p>';
 status('Showing up to 100 returned ledger rows for the last 7 days. This is not a complete all-time history.');
 }catch(e){if(activeVersion(v,s)){if($('fVenueHistory'))$('fVenueHistory').textContent='Ledger unavailable or incomplete. This does not mean the account has no transfers.';status(err(e));}}
 finally{checking=false;if($('fHistoryRefresh'))$('fHistoryRefresh').disabled=false;}
}
// Poll only an open history panel; never send a transaction or repeat a signature.
setInterval(()=>{if($('fundingDialog')?.open&&view==='history'&&session&&atSameSession(session)&&!document.hidden&&Date.now()-lastPoll>15000)refreshHistory(session);},5000);
function invalidateFunding(){if(!$('fundingDialog')?.open)return;review=null;balances=null;version++;if(!busy){$('fundingBody').replaceChildren();queueMicrotask(()=>open(view));}else status('Wallet session changed. Do not repeat a pending wallet request.');}
window.addEventListener('beltrix:wallet',invalidateFunding);
$('marketNetwork').addEventListener('change',invalidateFunding);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
