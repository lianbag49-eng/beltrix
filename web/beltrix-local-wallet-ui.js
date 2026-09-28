
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
   list+='<article class="w-local-vault-row"><div><strong>'+esc(v.name)+'</strong><small>'+esc(v.address)+'</small></div><div class="w-local-vault-controls">'+
    (active?'<span class="w-badge">Active</span>':'<button class="w-secondary" data-unlock="'+esc(v.id)+'">Unlock</button>')+
    '<button class="w-text-button" data-backup="'+esc(v.id)+'">Backup</button>'+
    '<button class="w-text-button danger" data-remove="'+esc(v.id)+'">Remove</button></div></article>';
  }
  body().innerHTML=
   '<div class="w-local-state '+(state.active?'unlocked':'locked')+'"><strong>'+(state.active?'Unlocked':'Locked')+'</strong><span>'+
   (state.active?esc(state.active.name)+' · '+esc(short(state.active.address)):'Private keys remain encrypted in this browser.')+'</span></div>'+
   (state.active?'<div class="w-form-row"><button id="wLocalLock" class="w-secondary">Lock now</button><button id="wLocalActiveBackup" class="w-secondary">Backup recovery key</button></div>':'')+
   '<div class="w-local-actions"><button id="wLocalCreate" class="w-primary">Create BELTRIX Wallet</button><button id="wLocalImport" class="w-secondary">Import recovery key</button></div>'+
   '<hr class="w-divider"><div class="w-list-head"><span>Wallets in this browser</span><span>'+vaults.length+'</span></div>'+
   '<div class="w-local-vault-list">'+(list||'<p class="w-note">No BELTRIX Local Wallet exists in this browser yet.</p>')+'</div>'+
   '<p id="wLocalWalletStatus" class="w-inline-status" role="status"></p>'+
   '<p class="w-note">BELTRIX Local Wallet is non-custodial. The encrypted vault stays in this browser. BELTRIX servers, Neon and Render never receive the recovery key.</p>';

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
   '<p class="w-note">A new EVM private key is generated on this device and encrypted before storage.</p>'+
   '<label class="w-field">Wallet name<input id="wLocalName" maxlength="40" value="BELTRIX Wallet" autocomplete="off"></label>'+
   '<label class="w-field">Wallet password<input id="wLocalPassword" type="password" minlength="10" autocomplete="new-password"></label>'+
   '<label class="w-field">Confirm password<input id="wLocalPassword2" type="password" minlength="10" autocomplete="new-password"></label>'+
   '<button id="wLocalCreateConfirm" class="w-primary full">Create wallet</button><button id="wLocalBack" class="w-text-button">Back</button>'+
   '<p id="wLocalWalletStatus" class="w-inline-status" role="status"></p><p class="w-note">The password is not recoverable. Save the recovery key shown after creation.</p>';
  doc.getElementById('wLocalBack').onclick=render;
  doc.getElementById('wLocalCreateConfirm').onclick=async()=>{
   try{
    const password=doc.getElementById('wLocalPassword').value;
    if(password!==doc.getElementById('wLocalPassword2').value)return status('Passwords do not match.','error');
    status('Generating and encrypting wallet…');
    const result=await manager.create({name:doc.getElementById('wLocalName').value,password,chainId:preferredChainId(win)});
    showRecovery(result.recoveryKey,result.wallet);
   }catch(error){status(error.message||error,'error')}
  };
 }

 function showRecovery(recoveryKey,wallet){
  title('Back up your recovery key');
  body().innerHTML=
   '<div class="w-error">This key controls the wallet. Anyone with it can move the assets. BELTRIX cannot recover it for you.</div>'+
   '<p class="w-note">'+esc(wallet.name)+' · '+esc(wallet.address)+'</p>'+
   '<label class="w-field">Recovery key<textarea id="wLocalRecovery" class="w-input w-local-secret" rows="3" readonly spellcheck="false">'+esc(recoveryKey)+'</textarea></label>'+
   '<button id="wLocalCopyRecovery" class="w-secondary full">Copy recovery key</button>'+
   '<label class="w-check"><input id="wLocalRecoverySaved" type="checkbox">I saved the recovery key somewhere safe.</label>'+
   '<button id="wLocalRecoveryDone" class="w-primary full" disabled>Finish</button><p id="wLocalWalletStatus" class="w-inline-status" role="status"></p>';
  doc.getElementById('wLocalCopyRecovery').onclick=()=>copy(recoveryKey);
  doc.getElementById('wLocalRecoverySaved').onchange=e=>{doc.getElementById('wLocalRecoveryDone').disabled=!e.target.checked};
  doc.getElementById('wLocalRecoveryDone').onclick=async()=>{await render();updateBadge()};
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
  body().innerHTML='<div class="w-error">Only reveal the recovery key in a private place. Never paste it into chat or support messages.</div>'+
   '<label class="w-field">Wallet password<input id="wLocalBackupPassword" type="password" autocomplete="current-password"></label>'+
   '<button id="wLocalBackupReveal" class="w-primary full">Reveal recovery key</button><button id="wLocalBack" class="w-text-button">Back</button>'+
   '<div id="wLocalBackupResult"></div><p id="wLocalWalletStatus" class="w-inline-status" role="status"></p>';
  doc.getElementById('wLocalBack').onclick=render;
  doc.getElementById('wLocalBackupReveal').onclick=async()=>{
   try{
    const key=await manager.exportRecoveryKey({id,password:doc.getElementById('wLocalBackupPassword').value});
    doc.getElementById('wLocalBackupResult').innerHTML='<label class="w-field">Recovery key<textarea id="wLocalBackupKey" class="w-input w-local-secret" rows="3" readonly spellcheck="false">'+esc(key)+'</textarea></label><button id="wLocalBackupCopy" class="w-secondary full">Copy recovery key</button>';
    doc.getElementById('wLocalBackupCopy').onclick=()=>copy(key);
    status('Recovery key revealed.','success');
   }catch(error){status(error.message||error,'error')}
  };
 }

 function showImport(){
  title('Import BELTRIX Wallet');
  body().innerHTML='<div class="w-error">Import only a recovery key you control. It is encrypted locally before storage.</div>'+
   '<label class="w-field">Wallet name<input id="wLocalImportName" maxlength="40" value="Imported BELTRIX Wallet" autocomplete="off"></label>'+
   '<label class="w-field">EVM recovery key<textarea id="wLocalImportKey" class="w-input w-local-secret" rows="3" placeholder="0x…" autocomplete="off" spellcheck="false"></textarea></label>'+
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
    await manager.importRecoveryKey({name:doc.getElementById('wLocalImportName').value,recoveryKey:doc.getElementById('wLocalImportKey').value,password,chainId:preferredChainId(win)});
    status('Wallet imported and unlocked.','success');updateBadge();setTimeout(render,120);
   }catch(error){status(error.message||error,'error')}
  };
 }

 async function showRemove(id){
  title('Remove '+await walletName(id));
  body().innerHTML='<div class="w-error">This removes the encrypted wallet from this browser. Back up the recovery key first.</div>'+
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

 button.onclick=async()=>{open();await render()};
 doc.getElementById('wLocalWalletClose').onclick=()=>dialog.close();
 win.addEventListener('beltrix:local-wallet-state',updateBadge);
 updateBadge();
 return true;
}
