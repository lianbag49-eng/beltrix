
import {beltrixWalletManager} from './beltrix-local-wallet.js';

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const short=a=>typeof a==='string'?a.slice(0,6)+'…'+a.slice(-4):'—';

function preferredChainId(win){
 try{
  const saved=JSON.parse(win.localStorage.getItem('beltrix-wallet-v1')||'null');
  const n=Number(saved?.network);
  return Number.isInteger(n)&&n>0?n:1;
 }catch{return 1}
}

export function installBeltrixLocalWalletUI({manager=beltrixWalletManager,win=window}={}){
 if(!manager||win.document.documentElement.dataset.beltrixLocalWalletUi==='1')return false;
 const doc=win.document,accountMode=doc.getElementById('wAccountMode');
 if(!accountMode)return false;
 doc.documentElement.dataset.beltrixLocalWalletUi='1';

 const button=doc.createElement('button');
 button.id='wBeltrixVault';
 button.type='button';
 button.className='w-local-vault-button';
 button.innerHTML='<span class="w-local-vault-dot"></span><span>BELTRIX Wallet</span><small id="wBeltrixVaultState">Local vault</small>';
 accountMode.after(button);

 const multi=doc.createElement('section');
 multi.id='wBeltrixMultichain';
 multi.className='w-section-card w-beltrix-multichain';
 multi.hidden=true;
 button.after(multi);

 const dialog=doc.createElement('dialog');
 dialog.id='wLocalWalletDialog';
 dialog.className='wallet-modal w-local-wallet-modal';
 dialog.innerHTML='<div class="w-modal-head"><h2 id="wLocalWalletTitle">BELTRIX Wallet</h2><button type="button" id="wLocalWalletClose" class="w-icon-button" aria-label="Close BELTRIX Wallet">×</button></div><div id="wLocalWalletBody"></div>';
 doc.body.append(dialog);

 const body=()=>doc.getElementById('wLocalWalletBody');
 const title=value=>{doc.getElementById('wLocalWalletTitle').textContent=value};
 const status=(text,type='')=>{
  const el=doc.getElementById('wLocalWalletStatus');
  if(el){el.textContent=String(text||'');el.className='w-inline-status '+type}
 };
 const open=()=>{if(!dialog.open)dialog.showModal()};
 const updateBadge=()=>{
  const state=manager.state(),el=doc.getElementById('wBeltrixVaultState');
  if(el)el.textContent=state.active?short(state.active.address):'Local vault';
  button.dataset.unlocked=String(Boolean(state.active));
  if(state.active){
   multi.hidden=false;
   multi.innerHTML='<div class="w-list-head"><span>BELTRIX Account</span><span>'+(state.active.solanaAddress?'EVM + Solana':'EVM')+'</span></div>'+
    '<div class="w-beltrix-chain-row"><div><strong>EVM</strong><small>'+esc(state.active.address)+'</small></div><button type="button" class="w-text-button" id="wCopyBeltrixEvm">Copy</button></div>'+
    (state.active.solanaAddress?'<div class="w-beltrix-chain-row"><div><strong>Solana</strong><small>'+esc(state.active.solanaAddress)+'</small></div><button type="button" class="w-text-button" id="wCopyBeltrixSol">Copy</button></div>':'<p class="w-note">Legacy private-key wallets are EVM-only. Import a recovery phrase to enable Solana.</p>')+
    '<div class="w-form-row"><button type="button" class="w-secondary" data-usdt-open="receive">Receive</button><button type="button" class="w-secondary" data-usdt-open="send">Send</button><button type="button" class="w-primary" id="wBeltrixTrade">Trade</button></div>'+
    '<p class="w-note">One local recovery phrase, chain-specific addresses. Always verify the destination network before sending.</p>';
   doc.getElementById('wCopyBeltrixEvm')?.addEventListener('click',()=>copy(state.active.address));
   doc.getElementById('wCopyBeltrixSol')?.addEventListener('click',()=>copy(state.active.solanaAddress));
   doc.getElementById('wBeltrixTrade')?.addEventListener('click',()=>win.openPage?.('markets'));
  }else{
   multi.hidden=true;
   multi.replaceChildren();
  }
 };
 const copy=async text=>{
  try{await win.navigator.clipboard.writeText(text);status('Copied.','success')}
  catch{status('Clipboard access is unavailable. Select and copy manually.','error')}
 };

 async function walletName(id){
  const rows=await manager.list();
  return rows.find(x=>x.id===id)?.name||'BELTRIX Wallet';
 }

 async function render(){
  title('BELTRIX Wallet');
  const vaults=await manager.list(),state=manager.state();
  let list='';
  for(const v of vaults){
   const active=state.active?.id===v.id;
   list+='<article class="w-local-vault-row"><div><strong>'+esc(v.name)+'</strong><small>EVM · '+esc(v.address)+'</small>'+(v.solanaAddress?'<small>Solana · '+esc(v.solanaAddress)+'</small>':'')+'</div><div class="w-local-vault-controls">'+
    (active?'<span class="w-badge">Active</span>':'<button class="w-secondary" data-unlock="'+esc(v.id)+'">Unlock</button>')+
    '<button class="w-text-button" data-backup="'+esc(v.id)+'">Backup</button>'+
    '<button class="w-text-button danger" data-remove="'+esc(v.id)+'">Remove</button></div></article>';
  }
  body().innerHTML=
   '<div class="w-local-state '+(state.active?'unlocked':'locked')+'"><strong>'+(state.active?'Unlocked':'Locked')+'</strong><span>'+
   (state.active?esc(state.active.name)+' · '+esc(short(state.active.address))+(state.active.solanaAddress?' · SOL '+esc(short(state.active.solanaAddress)):''):'Recovery material remains encrypted in this browser.')+'</span></div>'+
   (state.active?'<div class="w-form-row"><button id="wLocalLock" class="w-secondary">Lock now</button><button id="wLocalActiveBackup" class="w-secondary">Backup recovery</button></div>':'')+
   '<div class="w-local-actions"><button id="wLocalCreate" class="w-primary">Create BELTRIX Wallet</button><button id="wLocalImport" class="w-secondary">Import wallet</button></div>'+
   '<hr class="w-divider"><div class="w-list-head"><span>Wallets in this browser</span><span>'+vaults.length+'</span></div>'+
   '<div class="w-local-vault-list">'+(list||'<p class="w-note">No BELTRIX Local Wallet exists in this browser yet.</p>')+'</div>'+
   '<p id="wLocalWalletStatus" class="w-inline-status" role="status"></p>'+
   '<p class="w-note">BELTRIX Local Wallet is non-custodial. The encrypted vault stays in this browser. BELTRIX servers, Neon and Render never receive the recovery phrase or private key.</p>';

  doc.getElementById('wLocalCreate').onclick=showCreate;
  doc.getElementById('wLocalImport').onclick=showImport;
  doc.getElementById('wLocalLock')?.addEventListener('click',async()=>{manager.lock();await render();updateBadge()});
  doc.getElementById('wLocalActiveBackup')?.addEventListener('click',()=>showBackup(state.active.id));
  body().querySelectorAll('[data-unlock]').forEach(x=>x.onclick=()=>showUnlock(x.dataset.unlock));
  body().querySelectorAll('[data-backup]').forEach(x=>x.onclick=()=>showBackup(x.dataset.backup));
  body().querySelectorAll('[data-remove]').forEach(x=>x.onclick=()=>showRemove(x.dataset.remove));
  updateBadge();
 }

 function showCreate(){
  title('Create BELTRIX Wallet');
  body().innerHTML=
   '<p class="w-note">Create a new BELTRIX self-custody wallet on this device. Your recovery phrase is generated locally and is never sent to BELTRIX, Neon or Render.</p>'+
   '<label class="w-field">Wallet name<input id="wLocalName" maxlength="40" value="BELTRIX Wallet" autocomplete="off"></label>'+
   '<button id="wLocalCreateConfirm" class="w-primary full">Create wallet</button><button id="wLocalBack" class="w-text-button">Back</button>'+
   '<p id="wLocalWalletStatus" class="w-inline-status" role="status"></p>';
  doc.getElementById('wLocalBack').onclick=render;
  doc.getElementById('wLocalCreateConfirm').onclick=async()=>{
   try{
    status('Generating recovery phrase on this device…');
    const draft=await manager.beginCreate({name:doc.getElementById('wLocalName').value});
    showRecovery(draft);
   }catch(error){status(error.message||error,'error')}
  };
 }

 function showRecovery(draft){
  title('Back up your recovery phrase');
  body().innerHTML=
   '<div class="w-error">These 12 words control the wallet. Anyone with them can move the assets. BELTRIX cannot recover them for you.</div>'+
   '<p class="w-note">'+esc(draft.name)+'<br>EVM · '+esc(draft.address)+(draft.solanaAddress?'<br>Solana · '+esc(draft.solanaAddress):'')+'</p>'+
   '<label class="w-field">12-word recovery phrase<textarea id="wLocalRecovery" class="w-input w-local-secret" rows="4" readonly spellcheck="false">'+esc(draft.recoveryPhrase)+'</textarea></label>'+
   '<button id="wLocalCopyRecovery" class="w-secondary full">Copy recovery phrase</button>'+
   '<label class="w-check"><input id="wLocalRecoverySaved" type="checkbox">I saved these 12 words somewhere safe.</label>'+
   '<button id="wLocalRecoveryNext" class="w-primary full" disabled>Continue</button><button id="wLocalCreateCancel" class="w-text-button">Cancel</button>'+
   '<p id="wLocalWalletStatus" class="w-inline-status" role="status"></p>';
  doc.getElementById('wLocalCopyRecovery').onclick=()=>copy(draft.recoveryPhrase);
  doc.getElementById('wLocalRecoverySaved').onchange=e=>{doc.getElementById('wLocalRecoveryNext').disabled=!e.target.checked};
  doc.getElementById('wLocalCreateCancel').onclick=()=>{manager.cancelCreate({token:draft.token});render()};
  doc.getElementById('wLocalRecoveryNext').onclick=()=>showDeviceLock(draft);
 }

 function showDeviceLock(draft){
  title('Secure this device');
  body().innerHTML=
   '<p class="w-note">Set a local password to encrypt this wallet on this device. This password is not your recovery phrase and cannot restore the wallet on another device.</p>'+
   '<label class="w-field">Local wallet password<input id="wLocalPassword" type="password" minlength="10" autocomplete="new-password"></label>'+
   '<label class="w-field">Confirm password<input id="wLocalPassword2" type="password" minlength="10" autocomplete="new-password"></label>'+
   '<button id="wLocalFinishCreate" class="w-primary full">Activate BELTRIX Wallet</button><button id="wLocalDeviceBack" class="w-text-button">Back to recovery phrase</button>'+
   '<p id="wLocalWalletStatus" class="w-inline-status" role="status"></p>';
  doc.getElementById('wLocalDeviceBack').onclick=()=>showRecovery(draft);
  doc.getElementById('wLocalFinishCreate').onclick=async()=>{
   try{
    const password=doc.getElementById('wLocalPassword').value;
    if(password!==doc.getElementById('wLocalPassword2').value)return status('Passwords do not match.','error');
    status('Encrypting wallet on this device…');
    await manager.finishCreate({token:draft.token,password,chainId:preferredChainId(win)});
    status('BELTRIX Wallet is ready.','success');
    updateBadge();
    setTimeout(render,120);
   }catch(error){status(error.message||error,'error')}
  };
 }

 async function showUnlock(id){
  title('Unlock '+await walletName(id));
  body().innerHTML='<label class="w-field">Wallet password<input id="wLocalUnlockPassword" type="password" autocomplete="current-password"></label>'+
   '<button id="wLocalUnlockConfirm" class="w-primary full">Unlock wallet</button><button id="wLocalBack" class="w-text-button">Back</button>'+
   '<p id="wLocalWalletStatus" class="w-inline-status" role="status"></p>';
  doc.getElementById('wLocalBack').onclick=render;
  doc.getElementById('wLocalUnlockConfirm').onclick=async()=>{
   try{
    status('Decrypting local vault…');
    await manager.unlock({id,password:doc.getElementById('wLocalUnlockPassword').value,chainId:preferredChainId(win)});
    status('Wallet unlocked.','success');updateBadge();setTimeout(render,120);
   }catch(error){status(error.message||error,'error')}
  };
 }

 async function showBackup(id){
  title('Backup '+await walletName(id));
  body().innerHTML='<div class="w-error">Only reveal recovery material in a private place. Never paste it into chat or support messages.</div>'+
   '<label class="w-field">Wallet password<input id="wLocalBackupPassword" type="password" autocomplete="current-password"></label>'+
   '<button id="wLocalBackupReveal" class="w-primary full">Reveal recovery key</button><button id="wLocalBack" class="w-text-button">Back</button>'+
   '<div id="wLocalBackupResult"></div><p id="wLocalWalletStatus" class="w-inline-status" role="status"></p>';
  doc.getElementById('wLocalBack').onclick=render;
  doc.getElementById('wLocalBackupReveal').onclick=async()=>{
   try{
    const material=await manager.exportRecovery({id,password:doc.getElementById('wLocalBackupPassword').value});
    const label=material.type==='mnemonic'?'Recovery phrase':'Recovery key';
    doc.getElementById('wLocalBackupResult').innerHTML='<label class="w-field">'+label+'<textarea id="wLocalBackupKey" class="w-input w-local-secret" rows="4" readonly spellcheck="false">'+esc(material.secret)+'</textarea></label><button id="wLocalBackupCopy" class="w-secondary full">Copy '+label.toLowerCase()+'</button>';
    doc.getElementById('wLocalBackupCopy').onclick=()=>copy(material.secret);
    status(label+' revealed.','success');
   }catch(error){status(error.message||error,'error')}
  };
 }

 function showImport(){
  title('Import BELTRIX Wallet');
  body().innerHTML='<div class="w-error">Import only recovery material you control. It is encrypted locally before storage.</div>'+
   '<label class="w-field">Wallet name<input id="wLocalImportName" maxlength="40" value="Imported BELTRIX Wallet" autocomplete="off"></label>'+
   '<label class="w-field">12/15/18/21/24-word recovery phrase or 0x recovery key<textarea id="wLocalImportKey" class="w-input w-local-secret" rows="4" placeholder="word1 word2 … or 0x…" autocomplete="off" spellcheck="false"></textarea></label>'+
   '<label class="w-field">New wallet password<input id="wLocalImportPassword" type="password" minlength="10" autocomplete="new-password"></label>'+
   '<label class="w-field">Confirm password<input id="wLocalImportPassword2" type="password" minlength="10" autocomplete="new-password"></label>'+
   '<button id="wLocalImportConfirm" class="w-primary full">Encrypt & import</button><button id="wLocalBack" class="w-text-button">Back</button>'+
   '<p id="wLocalWalletStatus" class="w-inline-status" role="status"></p>';
  doc.getElementById('wLocalBack').onclick=render;
  doc.getElementById('wLocalImportConfirm').onclick=async()=>{
   try{
    const password=doc.getElementById('wLocalImportPassword').value;
    if(password!==doc.getElementById('wLocalImportPassword2').value)return status('Passwords do not match.','error');
    status('Encrypting imported wallet…');
    await manager.importRecovery({name:doc.getElementById('wLocalImportName').value,recovery:doc.getElementById('wLocalImportKey').value,password,chainId:preferredChainId(win)});
    status('Wallet imported and unlocked.','success');updateBadge();setTimeout(render,120);
   }catch(error){status(error.message||error,'error')}
  };
 }

 async function showRemove(id){
  title('Remove '+await walletName(id));
  body().innerHTML='<div class="w-error">This removes the encrypted wallet from this browser. Back up the recovery phrase or recovery key first.</div>'+
   '<label class="w-field">Wallet password<input id="wLocalRemovePassword" type="password" autocomplete="current-password"></label>'+
   '<label class="w-check"><input id="wLocalRemoveAck" type="checkbox">I have a recovery backup or accept losing access from this browser.</label>'+
   '<button id="wLocalRemoveConfirm" class="w-secondary full" disabled>Remove local wallet</button><button id="wLocalBack" class="w-text-button">Cancel</button>'+
   '<p id="wLocalWalletStatus" class="w-inline-status" role="status"></p>';
  doc.getElementById('wLocalBack').onclick=render;
  doc.getElementById('wLocalRemoveAck').onchange=e=>{doc.getElementById('wLocalRemoveConfirm').disabled=!e.target.checked};
  doc.getElementById('wLocalRemoveConfirm').onclick=async()=>{
   try{
    await manager.remove({id,password:doc.getElementById('wLocalRemovePassword').value});
    status('Local wallet removed.','success');updateBadge();setTimeout(render,120);
   }catch(error){status(error.message||error,'error')}
  };
 }

 const launch=async()=>{open();await render()};
 button.onclick=launch;
 const tradeButton=doc.getElementById('tradeBeltrixWallet');
 if(tradeButton)tradeButton.onclick=launch;
 win.openBeltrixLocalWallet=launch;
 win.addEventListener('beltrix:open-local-wallet',()=>launch());
 doc.getElementById('wLocalWalletClose').onclick=()=>dialog.close();
 win.addEventListener('beltrix:local-wallet-state',()=>{
  updateBadge();
  const state=manager.state();
  if(tradeButton)tradeButton.textContent=state.active?'BELTRIX '+short(state.active.address):'BELTRIX Wallet';
 });
 updateBadge();
 const state=manager.state();
 if(tradeButton)tradeButton.textContent=state.active?'BELTRIX '+short(state.active.address):'BELTRIX Wallet';
 return true;
}
