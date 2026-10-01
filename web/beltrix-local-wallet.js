import {privateKeyToAccount,generateMnemonic,mnemonicToAccount,english} from 'viem/accounts';
import {encryptWalletMaterial,decryptWalletMaterial,putVault,getVault,listVaults,deleteVault,BELTRIX_LOCAL_WALLET_LIMIT,BELTRIX_WALLET_LIMIT_MESSAGE} from './beltrix-wallet-vault.js';
import {createBeltrixLocalProvider,announceBeltrixProvider} from './beltrix-local-provider.js';
import {createBeltrixSolanaWallet} from './beltrix-solana-wallet.js';

const cleanName=value=>String(value||'BELTRIX Wallet').replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,40)||'BELTRIX Wallet';
const keyOK=value=>/^0x[0-9a-fA-F]{64}$/.test(String(value||'').trim());
const normalizePhrase=value=>String(value||'').trim().toLowerCase().replace(/\s+/g,' ');
const event=(win,name,detail)=>win.dispatchEvent(new CustomEvent(name,{detail}));

function accountFromMaterial(material){
 if(material?.type==='privateKey')return privateKeyToAccount(material.secret);
 if(material?.type==='mnemonic')return mnemonicToAccount(material.secret,{accountIndex:0,addressIndex:0,changeIndex:0});
 throw Error('Unsupported BELTRIX wallet material.');
}
function parseRecovery(value){
 const raw=String(value||'').trim();
 if(keyOK(raw))return Object.freeze({type:'privateKey',secret:raw});
 const phrase=normalizePhrase(raw);
 const words=phrase.split(' ').filter(Boolean);
 if(![12,15,18,21,24].includes(words.length))throw Error('Enter a valid BELTRIX recovery phrase or 0x recovery key.');
 try{
  mnemonicToAccount(phrase,{accountIndex:0,addressIndex:0,changeIndex:0});
  return Object.freeze({type:'mnemonic',secret:phrase});
 }catch{
  throw Error('Enter a valid BELTRIX recovery phrase or 0x recovery key.');
 }
}

export function createBeltrixWalletManager({win=window,cryptoImpl=globalThis.crypto}={}){
 let active=null,pendingCreate=null;

 const publicState=()=>Object.freeze({
  locked:!active,
  active:active?Object.freeze({
   id:active.record.id,
   name:active.record.name,
   address:active.record.address,
   chainId:active.provider.chainId,
   solanaAddress:active.solana?.address||null,
   walletType:active.walletType,
   backupConfirmed:Boolean(active.record.backupConfirmedAt),
   chains:Object.freeze(active.solana?['evm','solana']:['evm'])
  }):null
 });

 const notify=()=>event(win,'beltrix:local-wallet-state',publicState());

 async function ensureUnique(address){
  const rows=await listVaults();
  if(rows.some(x=>x.address.toLowerCase()===address.toLowerCase()))throw Error('This wallet already exists in BELTRIX.');
  if(rows.length>=BELTRIX_LOCAL_WALLET_LIMIT)throw Error(BELTRIX_WALLET_LIMIT_MESSAGE);
 }

 async function activate(record,material,chainId=1){
  active?.provider?.lock?.();
  active?.solana?.provider?.lock?.();
  const account=accountFromMaterial(material);
  if(account.address.toLowerCase()!==record.address.toLowerCase())throw Error('Encrypted wallet address does not match its recovery material.');
  const provider=createBeltrixLocalProvider({account,initialChainId:chainId});
  const solana=material.type==='mnemonic'?await createBeltrixSolanaWallet(material.secret,{cryptoImpl}):null;
  if(record.solanaAddress&&solana&&record.solanaAddress!==solana.address)throw Error('Encrypted wallet Solana address does not match its recovery phrase.');
  if(solana&&!record.solanaAddress){
   record={...record,solanaAddress:solana.address,updatedAt:new Date().toISOString()};
   await putVault(record);
  }
  active={record,walletType:material.type,account,provider,solana};
  const bridge=win.beltrixWallet||(win.beltrixWallet={});
  bridge.manager=api;
  bridge.localProvider=provider;
  bridge.solanaProvider=solana?.provider||null;
  announceBeltrixProvider(provider,win);
  event(win,'beltrix:local-wallet-unlocked',{
   account:account.address,
   solanaAccount:solana?.address||null,
   provider,
   solanaProvider:solana?.provider||null,
   providerName:'BELTRIX Wallet',
   chainId:provider.chainId,
   id:record.id,
   name:record.name,
   walletType:material.type
  });
  notify();
  return publicState();
 }

 const api={
  async list(){return listVaults()},
  state:publicState,
  async beginCreate({name='BELTRIX Wallet'}={}){
   // Keep uncommitted recovery material in memory only. Nothing is written to
   // IndexedDB or sent over the network until the user backs it up and chooses
   // a local vault password.
   const material=Object.freeze({type:'mnemonic',secret:generateMnemonic(english,128)});
   const account=accountFromMaterial(material);
   await ensureUnique(account.address);
   const solana=await createBeltrixSolanaWallet(material.secret,{cryptoImpl});
   pendingCreate={token:cryptoImpl.randomUUID(),name:cleanName(name),material,address:account.address,solanaAddress:solana.address};
   return Object.freeze({token:pendingCreate.token,name:pendingCreate.name,address:pendingCreate.address,solanaAddress:pendingCreate.solanaAddress,recoveryPhrase:material.secret});
  },
  cancelCreate({token}={}){
   if(!pendingCreate||pendingCreate.token!==token)return false;
   pendingCreate=null;
   return true;
  },
  async finishCreate({token,password,chainId=1}={}){
   const draft=pendingCreate;
   if(!draft||draft.token!==token)throw Error('Wallet creation session expired. Start again.');
   const now=new Date().toISOString();
   const record={
    id:cryptoImpl.randomUUID(),name:draft.name,address:draft.address,solanaAddress:draft.solanaAddress,
    createdAt:now,updatedAt:now,backupConfirmedAt:now,
    encrypted:await encryptWalletMaterial(draft.material,password,{cryptoImpl})
   };
   await putVault(record);
   pendingCreate=null;
   await activate(record,draft.material,chainId);
   return publicState();
  },
  async create({name='BELTRIX Wallet',password,chainId=1,strength=128}={}){
   const mnemonic=generateMnemonic(english,Number(strength)===256?256:128);
   const material=Object.freeze({type:'mnemonic',secret:mnemonic});
   const account=accountFromMaterial(material);
   await ensureUnique(account.address);
   const now=new Date().toISOString();
   const record={
    id:cryptoImpl.randomUUID(),
    name:cleanName(name),
    address:account.address,
    createdAt:now,
    updatedAt:now,
    backupConfirmedAt:null,
    encrypted:await encryptWalletMaterial(material,password,{cryptoImpl})
   };
   await putVault(record);
   await activate(record,material,chainId);
   return Object.freeze({wallet:publicState().active,recoveryPhrase:mnemonic,recoveryKey:null});
  },
  async importRecovery({name='Imported BELTRIX Wallet',recovery,password,chainId=1}={}){
   const material=parseRecovery(recovery);
   const account=accountFromMaterial(material);
   await ensureUnique(account.address);
   const now=new Date().toISOString();
   const record={
    id:cryptoImpl.randomUUID(),
    name:cleanName(name),
    address:account.address,
    createdAt:now,
    updatedAt:now,
    backupConfirmedAt:now,
    encrypted:await encryptWalletMaterial(material,password,{cryptoImpl})
   };
   await putVault(record);
   await activate(record,material,chainId);
   return publicState();
  },
  async importRecoveryKey({name='Imported BELTRIX Wallet',recoveryKey,password,chainId=1}={}){
   return api.importRecovery({name,recovery:recoveryKey,password,chainId});
  },
  async unlock({id,password,chainId=1}={}){
   const record=await getVault(id);
   if(!record)throw Error('BELTRIX wallet was not found in this browser.');
   const material=await decryptWalletMaterial(record.encrypted,password,{cryptoImpl});
   return await activate(record,material,chainId);
  },
  lock(){
   if(active){
    const previous=active;
    active=null;
    previous.provider.lock();
    previous.solana?.provider?.lock?.();
    if(win.beltrixWallet){win.beltrixWallet.localProvider=null;win.beltrixWallet.solanaProvider=null;}
    event(win,'beltrix:local-wallet-locked',{address:previous.record.address,id:previous.record.id});
   }
   notify();
   return publicState();
  },
  async exportRecovery({id,password}={}){
   const record=await getVault(id);
   if(!record)throw Error('BELTRIX wallet was not found in this browser.');
   return decryptWalletMaterial(record.encrypted,password,{cryptoImpl});
  },
  async exportRecoveryKey({id,password}={}){
   const material=await api.exportRecovery({id,password});
   return material.secret;
  },
  async confirmBackup({id}={}){
   const record=await getVault(id);
   if(!record)throw Error('BELTRIX wallet was not found in this browser.');
   const updated={...record,backupConfirmedAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
   await putVault(updated);
   if(active?.record?.id===id)active.record=updated;
   notify();
   return publicState();
  },
  async remove({id,password}={}){
   const record=await getVault(id);
   if(!record)return false;
   await decryptWalletMaterial(record.encrypted,password,{cryptoImpl});
   if(active?.record?.id===record.id)api.lock();
   await deleteVault(record.id);
   notify();
   return true;
  }
 };
 win.beltrixWallet={localProvider:null,solanaProvider:null,manager:api};
 notify();
 return api;
}

export const beltrixWalletManager=typeof window!=='undefined'?createBeltrixWalletManager({win:window}):null;
