import {formatUnits,toHex} from 'viem';
import {address,same,cleanText} from './wallet-core.js';
import {network} from './wallet-data.js';
import {fundingRoute,DOCUMENTED_WITHDRAWAL_FEE} from './funding-core.js';
import {FundingService} from './funding-service.js';
import {readFundingJournal,TERMINAL} from './funding-journal.js';
import {showFundingReceive,installPaymentRequestImport,escapeHTML as esc} from './funding-qr-ui.js';

export function installFundingUI(){
 if(document.getElementById('fundingDialog'))return;
 const css=document.createElement('link');css.rel='stylesheet';css.href='./funding.css';document.head.append(css);
 const controls=()=>{const section=document.createElement('section');section.className='funding-bar';section.setAttribute('aria-label','Deposit and withdrawal');section.innerHTML='<button class="w-secondary" type="button" data-funding="deposit">↓ Deposit</button><button class="w-secondary" type="button" data-funding="withdraw">↑ Withdraw</button><button class="w-secondary" type="button" data-funding="history">Transfer history</button>';return section;};
 document.querySelector('.market-stats').before(controls());
 document.querySelector('#wallet .w-banner').before(controls());
 const dialog=document.createElement('dialog');dialog.id='fundingDialog';dialog.className='wallet-modal';dialog.setAttribute('aria-labelledby','fundingTitle');
 dialog.innerHTML='<div class="w-modal-head"><button id="fundingBack" class="w-text-button" type="button" hidden>Back</button><h2 id="fundingTitle"></h2><button id="fundingClose" class="w-icon-button" type="button" aria-label="Close funding dialog">✕</button></div><div id="fundingBody"></div>';
 document.body.append(dialog);const root=document.getElementById('fundingBody');
 let revision=0,scope=0,service=null,providerListeners=[],busy=false,currentEnv='mainnet';
 const by=id=>root.querySelector('#'+id);
 const note=text=>{const el=by('fundingFormStatus');if(el)el.textContent=cleanText(text,350);else window.toast?.(cleanText(text,240));};
 function detach(){for(const [p,event,fn] of providerListeners)p.removeListener?.(event,fn);providerListeners=[];}
 function invalidate(){scope++;service=null;detach();const b=by('fundingReview')||by('fundingSubmit');if(b)b.disabled=true;note('Wallet selection changed. Reconnect and review again.');}
 function close(){revision++;scope++;service=null;detach();dialog.close();}
 function view(title,html,back=null){
  const mine=++revision;document.getElementById('fundingTitle').textContent=title;root.innerHTML=html;
  const b=document.getElementById('fundingBack');b.hidden=!back;b.onclick=back;
  if(!dialog.open)dialog.showModal();
  return {root,valid:()=>mine===revision&&dialog.open};
 }
 document.getElementById('fundingClose').onclick=close;dialog.addEventListener('cancel',()=>{revision++;scope++;service=null;detach();});
 function bindProvider(p){detach();for(const event of ['accountsChanged','chainChanged','disconnect']){p.on?.(event,invalidate);providerListeners.push([p,event,invalidate]);}}
 function legacy(action){close();document.querySelector(`.w-actions [data-action="${action}"]`)?.click();}
 function walletReceiveChain(){try{return network(JSON.parse(localStorage.getItem('beltrix-wallet-v1')||'{}').network||1).chain.id;}catch{return 1;}}
 function receive(chainId){
  const account=window.beltrixWallet?.account||service?.account;
  if(!account){close();window.beltrixWallet?.openAccounts();window.toast?.('Select a wallet address, then choose Deposit again.');return;}
  showFundingReceive({recipient:account,chainId:chainId||service?.route.chainId||walletReceiveChain(),view:(title,html)=>view(title,html,()=>chooser('deposit'))});
  const p=window.beltrixWallet?.provider;if(p){detach();for(const event of ['accountsChanged','chainChanged','disconnect']){p.on?.(event,close);providerListeners.push([p,event,close]);}}
 }
 function chooser(kind){
  if(busy)return;scope++;service=null;detach();
  if(kind==='history'){historyView();return;}
  const deposit=kind==='deposit';
  view(deposit?'Choose deposit destination':'Choose withdrawal source',`<p class="w-note">Your EVM wallet and Hyperliquid trading account have separate balances. Choose where the funds should go.</p><div class="funding-choices"><button id="fundingWalletChoice" type="button" class="w-provider"><span><strong>${deposit?'Wallet deposit QR':'Send from wallet'}</strong><small>${deposit?'Receive from an exchange or another wallet. Address, network and QR.':'Send native assets or ERC-20 tokens with the existing gas and recipient review.'}</small></span></button><button id="fundingTradingChoice" type="button" class="w-provider"><span><strong>${deposit?'Deposit USDC to trading':'Withdraw trading USDC'}</strong><small>${deposit?'Your Arbitrum wallet → Hyperliquid bridge → trading account.':'Hyperliquid account → native USDC on Arbitrum. Wallet signature required.'}</small></span></button></div><div class="w-error">Do not send from a centralized exchange directly to the shared Hyperliquid bridge contract. Receive into your own wallet first.</div><p class="w-note">BELTRIX does not create custodial deposit addresses or store private keys. Other chains and assets require their own supported route.</p>`);
  by('fundingWalletChoice').onclick=()=>deposit?receive():legacy('send');by('fundingTradingChoice').onclick=()=>bridgeView(kind);
 }
 function bridgeView(kind){
  if(busy)return;scope++;service=null;detach();currentEnv=document.getElementById('marketNetwork').value==='testnet'?'testnet':'mainnet';
  const v=view(kind==='deposit'?'Deposit to trading':'Withdraw from trading',`<label class="w-field">Trading environment<select id="fundingEnv"><option value="mainnet" ${currentEnv==='mainnet'?'selected':''}>Mainnet · REAL FUNDS</option><option value="testnet" ${currentEnv==='testnet'?'selected':''}>Testnet · TEST ASSETS</option></select></label><p id="fundingRoute" class="w-note"></p><div class="funding-grid"><button id="fundingConnect" type="button" class="w-secondary">Connect funding wallet</button><button id="fundingSwitch" type="button" class="w-secondary">Switch wallet network</button></div><div id="fundingAccount" class="w-address-box">No funding wallet connected</div><dl class="w-review-lines"><div><dt>Wallet USDC</dt><dd id="fundingWalletBalance">—</dd></div><div><dt>Trading withdrawable</dt><dd id="fundingAvailable">—</dd></div></dl>${kind==='withdraw'?'<label class="w-field">Recipient on Arbitrum<input id="fundingDestination" placeholder="0x…" autocomplete="off" spellcheck="false"></label><button id="fundingUseSelf" type="button" class="w-text-button">Use connected wallet</button>':''}<label class="w-field">Amount (USDC)<input id="fundingAmount" inputmode="decimal" placeholder="0.00" autocomplete="off"></label><button id="fundingReview" type="button" class="w-primary full" disabled>Review ${kind}</button>${kind==='deposit'?'<button id="fundingWalletQR" type="button" class="w-secondary full">Get personal wallet deposit QR first</button>':''}<p id="fundingFormStatus" class="w-inline-status" role="status"></p><p class="w-note">${kind==='deposit'?'Native USDC only, minimum 5 USDC. USDC.e, USDT and other assets are not supported by this bridge route. ETH is needed for Arbitrum gas.':'BELTRIX minimum: 2 USDC. Documented venue withdrawal fee: 1 USDC, included in the requested amount. The venue fee can change. No wallet ETH is required for withdrawal.'} Bridge status, token identity and available funds are rechecked before submission.</p><details><summary>Limits and official route</summary><p class="w-note">EOA wallets only. Smart-contract/delegated wallets, vaults and subaccounts are not supported here. Spot-to-perp transfers and other deposit routes remain in the official venue. This new integration has automated tests but has not completed a funded exercise or independent security audit.</p><a id="fundingOfficial" class="w-link" target="_blank" rel="noopener noreferrer">Open official Hyperliquid ↗</a></details>`,()=>chooser(kind));
  function routeText(){const r=fundingRoute(currentEnv);by('fundingRoute').textContent=`${r.testnet?'TESTNET':'MAINNET — REAL FUNDS'} · ${r.label} · Chain ${r.chainId} · USDC ${r.usdc}`;by('fundingOfficial').href=r.venue;}
  routeText();
  by('fundingEnv').onchange=()=>{invalidate();currentEnv=by('fundingEnv').value;by('fundingAmount').value='';by('fundingAccount').textContent='Reconnect on the selected network';by('fundingWalletBalance').textContent='—';by('fundingAvailable').textContent='—';routeText();};
  const chosen=()=>window.beltrixWallet?.provider||(document.getElementById('walletProvider').value==='okx'?window.okxwallet:window.ethereum);
  by('fundingSwitch').onclick=async()=>{if(busy)return;try{const p=chosen();if(!p)throw Error('Open BELTRIX in a wallet browser or connect a browser wallet.');const r=fundingRoute(currentEnv);await p.request({method:'wallet_switchEthereumChain',params:[{chainId:toHex(r.chainId)}]});if(v.valid())note('Network switch requested. Connect funding wallet to continue.');}catch(e){if(v.valid())note(e.shortMessage||e.message);}};
  by('fundingConnect').onclick=async()=>{
   if(busy)return;const token=++scope,env=currentEnv;busy=true;by('fundingConnect').disabled=true;
   try{const p=chosen();if(!p)throw Error('No wallet detected. Open BELTRIX inside your wallet browser.');
    const accounts=await p.request({method:'eth_requestAccounts'}),account=address(accounts?.[0]),chainId=Number(await p.request({method:'eth_chainId'}));
    if(!v.valid()||token!==scope||env!==currentEnv)throw Error('Funding view changed. Connect again.');
    if(chainId!==fundingRoute(env).chainId)throw Error('Switch your wallet to '+fundingRoute(env).label+' first.');
    const selected=window.beltrixWallet?.account;
    if(selected&&!same(selected,account))throw Error('The funding signer differs from the selected BELTRIX wallet. Select the same account first.');
    if(!selected)window.dispatchEvent(new CustomEvent('beltrix:wallet',{detail:{account,provider:p,chainId}}));
    bindProvider(p);
    const guard=()=>{if(token!==scope||env!==currentEnv||!dialog.open)throw Error('Funding session changed or closed. Review again.');const now=window.beltrixWallet?.account;if(now&&!same(now,account))throw Error('Selected wallet address changed.');};
    service=new FundingService({provider:p,account,env,assertCurrent:guard});
    by('fundingAccount').textContent=account;
    if(kind==='withdraw')by('fundingDestination').value=account;
    const data=await service.balances();if(!v.valid()||token!==scope)return;
    by('fundingWalletBalance').textContent=data.wallet===null?'Unavailable':data.wallet+' USDC';by('fundingAvailable').textContent=data.withdrawable===null?'Unavailable':data.withdrawable+' USDC';
    by('fundingReview').disabled=false;note('Connected. Check the full address and selected network.');
   }catch(e){if(v.valid())note(e.shortMessage||e.message);}finally{busy=false;if(v.valid())by('fundingConnect').disabled=false;}
  };
  if(kind==='withdraw')by('fundingUseSelf').onclick=()=>{if(service)by('fundingDestination').value=service.account;};
  if(kind==='deposit')by('fundingWalletQR').onclick=()=>receive(fundingRoute(currentEnv).chainId);
  by('fundingReview').onclick=async()=>{
   if(busy||!service)return;const client=service;busy=true;by('fundingReview').disabled=true;
   try{note('Verifying bridge, account, available funds and fees…');const review=await client.prepare(kind,by('fundingAmount').value,kind==='withdraw'?by('fundingDestination').value:client.account);if(v.valid())reviewView(client,review);}catch(e){if(v.valid())note(e.shortMessage||e.message);}finally{busy=false;if(v.valid())by('fundingReview').disabled=!service;}
  };
 }
 function reviewView(client,review){
  const r=client.route,deposit=review.kind==='deposit',n=formatUnits(review.quantity,6);
  const v=view('Confirm '+review.kind,`<span class="w-badge ${r.testnet?'test':'neutral'}">${r.testnet?'TESTNET':'MAINNET · REAL FUNDS'}</span><div class="w-review-amount">${esc(n)} USDC</div><dl class="w-review-lines"><div><dt>Funding account</dt><dd>${esc(client.account)}</dd></div><div><dt>${deposit?'Bridge contract':'Recipient'}</dt><dd>${esc(review.recipient)}</dd></div><div><dt>Network</dt><dd>${esc(r.label)} · ${r.chainId}</dd></div><div><dt>Token contract</dt><dd>${esc(r.usdc)}</dd></div>${deposit?`<div><dt>ETH gas budget</dt><dd>${esc(formatUnits(review.tx.fee,18))} ETH</dd></div>`:`<div><dt>Documented fee</dt><dd>1 USDC</dd></div><div><dt>Estimated recipient amount</dt><dd>${esc(formatUnits(review.quantity-DOCUMENTED_WITHDRAWAL_FEE,6))} USDC</dd></div>`}</dl><div class="w-error">${deposit?'Only the sending wallet receives the trading credit. This is not a personal deposit address to share with an exchange.':'This signs a withdrawal of real trading funds on mainnet. API acceptance is not proof of payment to the recipient.'}</div><p class="w-note">Review expires in 60 seconds. ${deposit?'L2 data fees may be additional; check the final network fee in your wallet.':'If the wallet or network changes during signing, the signature is not submitted.'}</p><label class="w-check"><input id="fundingAck" type="checkbox"><span>I verified the complete recipient / bridge, network, token and amount. ${r.testnet?'These are test assets.':'This uses REAL FUNDS.'}</span></label><button id="fundingSubmit" type="button" class="w-primary full" disabled>Confirm in wallet</button><p id="fundingFormStatus" class="w-inline-status" role="status"></p>`,()=>bridgeView(review.kind));
  by('fundingAck').onchange=()=>by('fundingSubmit').disabled=!by('fundingAck').checked||busy;
  by('fundingSubmit').onclick=async()=>{
   if(busy||!by('fundingAck').checked)return;busy=true;by('fundingSubmit').disabled=true;
   try{note('Waiting for wallet approval. Do not repeat this request.');const result=await client.execute(review);if(v.valid()){view('Funding request recorded',`<h3>${esc(result.status)}</h3><p class="w-note">${deposit?'The wallet returned a transaction hash. Arbitrum confirmation and Hyperliquid credit are verified separately.':'The venue acknowledged the request. It is not yet verified as delivered on Arbitrum.'}</p>${result.hash?`<div class="w-address-box">${esc(result.hash)}</div>`:''}<button id="fundingShowHistory" type="button" class="w-primary full">Check funding history</button>`);by('fundingShowHistory').onclick=historyView;}}catch(e){if(v.valid())note(e.message);}finally{busy=false;}
  };
 }
 function historyView(){
  if(busy)return;const account=service?.account||window.beltrixWallet?.account;
  if(!account){close();window.beltrixWallet?.openAccounts();return;}
  const env=currentEnv,r=fundingRoute(env);let records=[];let issue='';
  try{records=readFundingJournal().filter(x=>x.env===env&&same(x.account,account));}catch(e){issue=e.message;}
  const client=new FundingService({provider:null,account,env,assertCurrent:()=>{}});
  const v=view('Funding history',`<label class="w-field">Environment<select id="fundingHistoryEnv"><option value="mainnet" ${env==='mainnet'?'selected':''}>Mainnet</option><option value="testnet" ${env==='testnet'?'selected':''}>Testnet</option></select></label><div class="w-address-box">${esc(account)}</div><p class="w-note">Local bridge requests for this account and environment. Request acceptance, chain confirmation and trading credit are separate states.</p>${issue?`<p class="w-error">${esc(issue)}</p>`:''}<div id="fundingLocalHistory">${records.length?records.map(x=>`<article class="w-section-card"><div class="w-row"><strong>${esc(x.kind)} · ${esc(formatUnits(BigInt(x.quantity),6))} USDC</strong><span class="w-badge neutral">${esc(x.status)}</span></div><p class="w-note">${esc(new Date(x.created).toLocaleString('en-US'))}<br>Recipient: ${esc(x.recipient)}<br>${esc(x.note||x.error||'')}</p>${x.hash?`<a class="w-link" href="${network(r.chainId).explorer}/tx/${x.hash}" target="_blank" rel="noopener noreferrer">View chain transaction ↗</a>`:''}${!TERMINAL.has(x.status)?`<button type="button" class="w-secondary" data-funding-check="${esc(x.id)}">Check / reconcile</button>`:''}</article>`).join(''):'<p class="w-note">No local bridge requests for this account.</p>'}</div><h3>Hyperliquid ledger · last 30 days</h3><p class="w-note">Provider-reported records, up to 100 displayed. A withdrawal ledger entry alone does not prove Arbitrum delivery.</p><div id="fundingLedger">Loading…</div><button id="fundingWalletHistory" class="w-secondary full" type="button">Open wallet blockchain history</button><p id="fundingFormStatus" class="w-inline-status" role="status"></p>`);
  by('fundingHistoryEnv').onchange=()=>{currentEnv=by('fundingHistoryEnv').value;historyView();};by('fundingWalletHistory').onclick=()=>legacy('history');
  root.querySelectorAll('[data-funding-check]').forEach(b=>b.onclick=()=>{const id=b.dataset.fundingCheck;const w=view('Verify funding status','<p class="w-note">This checks existing records only and never repeats a transfer. Paste the deposit or settlement transaction hash from your wallet / explorer. Withdrawals can also scan the most recent 2,000 blocks.</p><label class="w-field">Transaction hash (optional for recent withdrawals)<input id="fundingCheckHash" placeholder="0x…" autocomplete="off" spellcheck="false"></label><button id="fundingCheckNow" class="w-primary full" type="button">Verify existing transaction</button><p id="fundingFormStatus" class="w-inline-status" role="status"></p>',historyView);by('fundingCheckNow').onclick=async()=>{if(busy)return;busy=true;by('fundingCheckNow').disabled=true;try{const row=await client.reconcile(id,by('fundingCheckHash').value);if(w.valid())note(row.status+' · '+(row.note||'Verified existing transaction.'));}catch(e){if(w.valid())note(e.shortMessage||e.message);}finally{busy=false;if(w.valid())by('fundingCheckNow').disabled=false;}};});
  client.ledger().then(rows=>{if(v.valid())by('fundingLedger').innerHTML=rows.length?rows.map(x=>`<div class="w-approval"><strong>${esc(x.delta?.type||'Ledger update')}</strong><p class="w-note">${esc(new Date(x.time).toLocaleString('en-US'))} · ${esc(x.delta?.usdc??x.delta?.amount??'—')}<br>${esc(x.hash||'')}</p></div>`).join(''):'No ledger records returned.';}).catch(e=>{if(v.valid())by('fundingLedger').textContent='Ledger unavailable — not an empty balance. '+cleanText(e.message,180);});
 }
 document.addEventListener('click',e=>{const b=e.target.closest?.('button[data-funding]');if(b&&!b.disabled)chooser(b.dataset.funding);});
 installPaymentRequestImport();document.documentElement.dataset.fundingUx='v1';
}
