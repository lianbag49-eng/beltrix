import {generatePrivateKey,privateKeyToAccount} from 'viem/accounts';
import {encryptWalletSecret,decryptWalletSecret,putVault,getVault,listVaults,deleteVault} from './beltrix-wallet-vault.js';
import {createBeltrixLocalProvider,announceBeltrixProvider} from './beltrix-local-provider.js';

const cleanName=value=>String(value||'BELTRIX Wallet').replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,40)||'BELTRIX Wallet';
const keyOK=value=>/^0x[0-9a-fA-F]{64}$/.test(String(value||'').trim());
const event=(win,name,detail)=>win.dispatchEvent(new CustomEvent(name,{detail}));

export function createBeltrixWalletManager({win=window,cryptoImpl=globalThis.crypto}={}){
 let active=null;

 const publicState=()=>Object.freeze({
  locked:!active,
  active:active?Object.freeze({
   id:active.record.id,
   name:active.record.name,
   address:active.record.address,
   chainId:active.provider.chainId
  }):null
 });

 const notify=()=>event(win,'beltrix:local-wallet-state',publicState());

 async function ensureUnique(address){
  const rows=await listVaults();
  if(rows.some(x=>x.address.toLowerCase()===address.toLowerCase()))throw Error('This wallet already exists in BELTRIX.');
 }

 function activate(record,privateKey,chainId=1){
  active?.provider?.lock?.();
  const account=privateKeyToAccount(privateKey);
  if(account.address.toLowerCase()!==record.address.toLowerCase())throw Error('Encrypted wallet address does not match its recovery key.');
  const provider=createBeltrixLocalProvider({account,initialChainId:chainId});
  active={record,account,provider};
  win.beltrixWallet={...win.beltrixWallet,provider,manager:api};
  announceBeltrixProvider(provider,win);
  event(win,'beltrix:local-wallet-unlocked',{account:account.address,provider,providerName:'BELTRIX Wallet',chainId:provider.chainId,id:record.id,name:record.name});
  notify();
  return publicState();
 }

 const api={
  async list(){
   return listVaults();
  },
  state:publicState,
  async create({name='BELTRIX Wallet',password,chainId=1}={}){
   const privateKey=generatePrivateKey();
   const account=privateKeyToAccount(privateKey);
   await ensureUnique(account.address);
   const now=new Date().toISOString();
   const record={
    id:cryptoImpl.randomUUID(),
    name:cleanName(name),
    address:account.address,
    createdAt:now,
    updatedAt:now,
    encrypted:await encryptWalletSecret(privateKey,password,{cryptoImpl})
   };
   await putVault(record);
   activate(record,privateKey,chainId);
   return Object.freeze({
    wallet:publicState().active,
    recoveryKey:privateKey
   });
  },
  async importRecoveryKey({name='Imported BELTRIX Wallet',recoveryKey,password,chainId=1}={}){
   const privateKey=String(recoveryKey||'').trim();
   if(!keyOK(privateKey))throw Error('Enter a valid 32-byte EVM recovery key beginning with 0x.');
   const account=privateKeyToAccount(privateKey);
   await ensureUnique(account.address);
   const now=new Date().toISOString();
   const record={
    id:cryptoImpl.randomUUID(),
    name:cleanName(name),
    address:account.address,
    createdAt:now,
    updatedAt:now,
    encrypted:await encryptWalletSecret(privateKey,password,{cryptoImpl})
   };
   await putVault(record);
   activate(record,privateKey,chainId);
   return publicState();
  },
  async unlock({id,password,chainId=1}={}){
   const record=await getVault(id);
   if(!record)throw Error('BELTRIX wallet was not found in this browser.');
   const privateKey=await decryptWalletSecret(record.encrypted,password,{cryptoImpl});
   return activate(record,privateKey,chainId);
  },
  lock(){
   if(active){
    const previous=active;
    active=null;
    previous.provider.lock();
    if(win.beltrixWallet)win.beltrixWallet.provider=null;
    event(win,'beltrix:local-wallet-locked',{address:previous.record.address,id:previous.record.id});
   }
   notify();
   return publicState();
  },
  async exportRecoveryKey({id,password}={}){
   const record=await getVault(id);
   if(!record)throw Error('BELTRIX wallet was not found in this browser.');
   return decryptWalletSecret(record.encrypted,password,{cryptoImpl});
  },
  async remove({id,password}={}){
   const record=await getVault(id);
   if(!record)return false;
   await decryptWalletSecret(record.encrypted,password,{cryptoImpl});
   if(active?.record?.id===record.id)api.lock();
   await deleteVault(record.id);
   notify();
   return true;
  }
 };
 win.beltrixWallet={provider:null,manager:api};
 notify();
 return api;
}

export const beltrixWalletManager=typeof window!=='undefined'?createBeltrixWalletManager({win:window}):null;
