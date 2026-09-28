const DB_NAME='beltrix-wallet-v1';
const STORE='vaults';
const DB_VERSION=1;
const AAD_V1=new TextEncoder().encode('BELTRIX-LOCAL-WALLET-V1');
const AAD_V2=new TextEncoder().encode('BELTRIX-LOCAL-WALLET-V2');
export const BELTRIX_VAULT_VERSION=2;
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
const privateKeyOK=value=>/^0x[0-9a-fA-F]{64}$/.test(String(value||'').trim());
const mnemonicOK=value=>{
 const words=String(value||'').trim().toLowerCase().split(/\s+/).filter(Boolean);
 return [12,15,18,21,24].includes(words.length)&&words.every(x=>/^[a-z]+$/.test(x));
};

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

async function encryptPayload(value,password,{cryptoImpl=globalThis.crypto,aad=AAD_V2,version=2,secretType='privateKey'}={}){
 if(!cryptoImpl?.subtle||typeof cryptoImpl.getRandomValues!=='function')throw Error('Secure browser cryptography is unavailable.');
 const salt=cryptoImpl.getRandomValues(new Uint8Array(16));
 const iv=cryptoImpl.getRandomValues(new Uint8Array(12));
 const key=await derive(password,salt,cryptoImpl);
 const plain=new TextEncoder().encode(value);
 try{
  const encrypted=await cryptoImpl.subtle.encrypt({name:'AES-GCM',iv,additionalData:aad,tagLength:128},key,plain);
  return Object.freeze({
   version,
   secretType,
   kdf:'PBKDF2-SHA256',
   iterations:BELTRIX_KDF_ITERATIONS,
   cipher:'AES-256-GCM',
   salt:bytesToBase64(salt),
   iv:bytesToBase64(iv),
   ciphertext:bytesToBase64(new Uint8Array(encrypted))
  });
 }finally{plain.fill(0)}
}

async function decryptPayload(payload,password,{cryptoImpl=globalThis.crypto,aad}={}){
 if(payload?.kdf!=='PBKDF2-SHA256'||payload?.cipher!=='AES-256-GCM')throw Error('Unsupported BELTRIX wallet encryption format.');
 if(Number(payload?.iterations)!==BELTRIX_KDF_ITERATIONS)throw Error('Unexpected BELTRIX wallet KDF parameters.');
 const salt=base64ToBytes(payload.salt),iv=base64ToBytes(payload.iv),ciphertext=base64ToBytes(payload.ciphertext);
 const key=await derive(password,salt,cryptoImpl);
 try{
  const decrypted=await cryptoImpl.subtle.decrypt({name:'AES-GCM',iv,additionalData:aad,tagLength:128},key,ciphertext);
  const bytes=new Uint8Array(decrypted);
  try{return new TextDecoder().decode(bytes)}finally{bytes.fill(0)}
 }catch{
  throw Error('Wallet password is incorrect or the encrypted vault is damaged.');
 }
}

export async function encryptWalletSecret(secret,password,{cryptoImpl=globalThis.crypto}={}){
 const value=String(secret||'').trim().toLowerCase();
 if(!privateKeyOK(value))throw Error('Invalid EVM recovery key.');
 return encryptPayload(value,password,{cryptoImpl,aad:AAD_V1,version:1,secretType:'privateKey'});
}

export async function decryptWalletSecret(payload,password,{cryptoImpl=globalThis.crypto}={}){
 const version=Number(payload?.version);
 if(version===1){
  const value=await decryptPayload(payload,password,{cryptoImpl,aad:AAD_V1});
  if(!/^0x[0-9a-f]{64}$/.test(value))throw Error('Decrypted wallet payload is invalid.');
  return value;
 }
 const material=await decryptWalletMaterial(payload,password,{cryptoImpl});
 return material.secret;
}

export async function encryptWalletMaterial(material,password,{cryptoImpl=globalThis.crypto}={}){
 const type=String(material?.type||'');
 let secret=String(material?.secret||'').trim();
 if(type==='privateKey'){
  if(!privateKeyOK(secret))throw Error('Invalid EVM recovery key.');
  secret=secret.toLowerCase();
 }else if(type==='mnemonic'){
  secret=secret.toLowerCase().replace(/\s+/g,' ').trim();
  if(!mnemonicOK(secret))throw Error('Invalid BIP-39 recovery phrase.');
 }else throw Error('Unsupported BELTRIX wallet secret type.');
 return encryptPayload(secret,password,{cryptoImpl,aad:AAD_V2,version:2,secretType:type});
}

export async function decryptWalletMaterial(payload,password,{cryptoImpl=globalThis.crypto}={}){
 const version=Number(payload?.version);
 if(version===1){
  const secret=await decryptPayload(payload,password,{cryptoImpl,aad:AAD_V1});
  if(!/^0x[0-9a-f]{64}$/.test(secret))throw Error('Decrypted wallet payload is invalid.');
  return Object.freeze({type:'privateKey',secret});
 }
 if(version!==2)throw Error('Unsupported BELTRIX wallet vault version.');
 const type=String(payload?.secretType||'');
 const secret=(await decryptPayload(payload,password,{cryptoImpl,aad:AAD_V2})).trim();
 if(type==='privateKey'&&!/^0x[0-9a-f]{64}$/.test(secret))throw Error('Decrypted wallet payload is invalid.');
 if(type==='mnemonic'&&!mnemonicOK(secret))throw Error('Decrypted wallet payload is invalid.');
 if(!['privateKey','mnemonic'].includes(type))throw Error('Unsupported BELTRIX wallet secret type.');
 return Object.freeze({type,secret});
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
  backupConfirmedAt:record?.backupConfirmedAt?String(record.backupConfirmedAt):null,
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
