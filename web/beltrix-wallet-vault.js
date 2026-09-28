const DB_NAME='beltrix-wallet-v1';
const STORE='vaults';
const DB_VERSION=1;
const AAD=new TextEncoder().encode('BELTRIX-LOCAL-WALLET-V1');
export const BELTRIX_VAULT_VERSION=1;
export const BELTRIX_KDF_ITERATIONS=310000;

const bytesToBase64=bytes=>{
 let s='';for(const b of bytes)s+=String.fromCharCode(b);
 return btoa(s);
};
const base64ToBytes=value=>{
 const s=atob(String(value||'')),out=new Uint8Array(s.length);
 for(let i=0;i<s.length;i++)out[i]=s.charCodeAt(i);
 return out;
};
const cleanName=value=>String(value||'BELTRIX Wallet').replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,40)||'BELTRIX Wallet';

async function derive(password,salt,cryptoImpl=globalThis.crypto){
 const value=String(password||'');
 if(value.length<10)throw Error('Use a wallet password with at least 10 characters.');
 const material=await cryptoImpl.subtle.importKey('raw',new TextEncoder().encode(value),'PBKDF2',false,['deriveKey']);
 return cryptoImpl.subtle.deriveKey(
  {name:'PBKDF2',hash:'SHA-256',salt,iterations:BELTRIX_KDF_ITERATIONS},
  material,
  {name:'AES-GCM',length:256},
  false,
  ['encrypt','decrypt']
 );
}

export async function encryptWalletSecret(secret,password,{cryptoImpl=globalThis.crypto}={}){
 if(!cryptoImpl?.subtle||typeof cryptoImpl.getRandomValues!=='function')throw Error('Secure browser cryptography is unavailable.');
 const value=String(secret||'');
 if(!/^0x[0-9a-fA-F]{64}$/.test(value))throw Error('Invalid EVM recovery key.');
 const salt=cryptoImpl.getRandomValues(new Uint8Array(16));
 const iv=cryptoImpl.getRandomValues(new Uint8Array(12));
 const key=await derive(password,salt,cryptoImpl);
 const plain=new TextEncoder().encode(value.toLowerCase());
 const encrypted=await cryptoImpl.subtle.encrypt({name:'AES-GCM',iv,additionalData:AAD,tagLength:128},key,plain);
 plain.fill(0);
 return Object.freeze({
  version:BELTRIX_VAULT_VERSION,
  kdf:'PBKDF2-SHA256',
  iterations:BELTRIX_KDF_ITERATIONS,
  cipher:'AES-256-GCM',
  salt:bytesToBase64(salt),
  iv:bytesToBase64(iv),
  ciphertext:bytesToBase64(new Uint8Array(encrypted))
 });
}

export async function decryptWalletSecret(payload,password,{cryptoImpl=globalThis.crypto}={}){
 if(Number(payload?.version)!==BELTRIX_VAULT_VERSION)throw Error('Unsupported BELTRIX wallet vault version.');
 if(payload?.kdf!=='PBKDF2-SHA256'||payload?.cipher!=='AES-256-GCM')throw Error('Unsupported BELTRIX wallet encryption format.');
 if(Number(payload?.iterations)!==BELTRIX_KDF_ITERATIONS)throw Error('Unexpected BELTRIX wallet KDF parameters.');
 const salt=base64ToBytes(payload.salt),iv=base64ToBytes(payload.iv),ciphertext=base64ToBytes(payload.ciphertext);
 const key=await derive(password,salt,cryptoImpl);
 try{
  const decrypted=await cryptoImpl.subtle.decrypt({name:'AES-GCM',iv,additionalData:AAD,tagLength:128},key,ciphertext);
  const bytes=new Uint8Array(decrypted);
  const value=new TextDecoder().decode(bytes);
  bytes.fill(0);
  if(!/^0x[0-9a-f]{64}$/.test(value))throw Error('Decrypted wallet payload is invalid.');
  return value;
 }catch(error){
  throw Error('Wallet password is incorrect or the encrypted vault is damaged.');
 }
}

function openDb(indexedDBImpl=globalThis.indexedDB){
 if(!indexedDBImpl)throw Error('IndexedDB is unavailable. BELTRIX Local Wallet requires browser storage.');
 return new Promise((resolve,reject)=>{
  const req=indexedDBImpl.open(DB_NAME,DB_VERSION);
  req.onupgradeneeded=()=>{
   const db=req.result;
   if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE,{keyPath:'id'});
  };
  req.onsuccess=()=>resolve(req.result);
  req.onerror=()=>reject(req.error||Error('Unable to open BELTRIX wallet vault.'));
 });
}

async function transact(mode,work,{indexedDBImpl=globalThis.indexedDB}={}){
 const db=await openDb(indexedDBImpl);
 try{
  return await new Promise((resolve,reject)=>{
   const tx=db.transaction(STORE,mode),store=tx.objectStore(STORE);
   let result;
   try{result=work(store)}catch(error){reject(error);return}
   tx.oncomplete=()=>resolve(result?.result??result);
   tx.onerror=()=>reject(tx.error||Error('BELTRIX wallet vault operation failed.'));
   tx.onabort=()=>reject(tx.error||Error('BELTRIX wallet vault operation was aborted.'));
  });
 }finally{db.close()}
}

export async function putVault(record,options={}){
 const value={
  id:String(record?.id||''),
  name:cleanName(record?.name),
  address:String(record?.address||''),
  createdAt:String(record?.createdAt||new Date().toISOString()),
  updatedAt:String(record?.updatedAt||new Date().toISOString()),
  encrypted:record?.encrypted
 };
 if(!value.id||!/^0x[0-9a-fA-F]{40}$/.test(value.address)||!value.encrypted)throw Error('Invalid BELTRIX wallet vault record.');
 await transact('readwrite',store=>store.put(value),options);
 return Object.freeze({...value});
}

export async function getVault(id,options={}){
 const result=await transact('readonly',store=>store.get(String(id||'')),options);
 return result?Object.freeze({...result}):null;
}

export async function listVaults(options={}){
 const rows=await transact('readonly',store=>store.getAll(),options);
 return Object.freeze((rows||[]).map(x=>Object.freeze({...x})).sort((a,b)=>String(a.createdAt).localeCompare(String(b.createdAt))));
}

export async function deleteVault(id,options={}){
 await transact('readwrite',store=>store.delete(String(id||'')),options);
 return true;
}
