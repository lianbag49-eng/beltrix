import {Keypair,VersionedTransaction} from '@solana/web3.js';

const HARDENED=0x80000000;
const encoder=new TextEncoder();
const concat=(...arrays)=>{
 const length=arrays.reduce((n,x)=>n+x.length,0),out=new Uint8Array(length);
 let offset=0;for(const x of arrays){out.set(x,offset);offset+=x.length}return out;
};
const u32be=value=>{
 const out=new Uint8Array(4);new DataView(out.buffer).setUint32(0,value>>>0,false);return out;
};
async function hmacSha512(key,data,cryptoImpl){
 const k=await cryptoImpl.subtle.importKey('raw',key,{name:'HMAC',hash:'SHA-512'},false,['sign']);
 return new Uint8Array(await cryptoImpl.subtle.sign('HMAC',k,data));
}
async function mnemonicSeed(mnemonic,{passphrase='',cryptoImpl=globalThis.crypto}={}){
 if(!cryptoImpl?.subtle)throw Error('Secure browser cryptography is unavailable.');
 const phrase=String(mnemonic||'').normalize('NFKD').trim().toLowerCase().replace(/\s+/g,' ');
 const words=phrase.split(' ').filter(Boolean);
 if(![12,15,18,21,24].includes(words.length))throw Error('Invalid BIP-39 recovery phrase.');
 const material=await cryptoImpl.subtle.importKey('raw',encoder.encode(phrase),'PBKDF2',false,['deriveBits']);
 const salt=encoder.encode('mnemonic'+String(passphrase||'').normalize('NFKD'));
 return new Uint8Array(await cryptoImpl.subtle.deriveBits({name:'PBKDF2',hash:'SHA-512',salt,iterations:2048},material,512));
}
async function slip10Ed25519(seed,path,{cryptoImpl=globalThis.crypto}={}){
 let digest=await hmacSha512(encoder.encode('ed25519 seed'),seed,cryptoImpl);
 let key=digest.slice(0,32),chain=digest.slice(32);
 for(const index of path){
  if(!Number.isInteger(index)||index<0||index>=HARDENED)throw Error('Invalid Solana derivation index.');
  digest=await hmacSha512(chain,concat(Uint8Array.of(0),key,u32be(index+HARDENED)),cryptoImpl);
  key=digest.slice(0,32);chain=digest.slice(32);
 }
 return key;
}

export async function deriveBeltrixSolanaKeypair(mnemonic,{accountIndex=0,cryptoImpl=globalThis.crypto}={}){
 const seed=await mnemonicSeed(mnemonic,{cryptoImpl});
 try{
  const child=await slip10Ed25519(seed,[44,501,accountIndex,0],{cryptoImpl});
  try{return Keypair.fromSeed(child)}finally{child.fill(0)}
 }finally{seed.fill(0)}
}

export async function deriveBeltrixSolanaAddress(mnemonic,options={}){
 return (await deriveBeltrixSolanaKeypair(mnemonic,options)).publicKey.toBase58();
}

export function createBeltrixSolanaProvider({keypair}={}){
 if(!keypair?.publicKey||!keypair?.secretKey)throw Error('BELTRIX Solana Provider requires a local keypair.');
 let locked=false;const listeners=new Map();
 const emit=(event,payload)=>{for(const fn of listeners.get(event)||[])try{fn(payload)}catch{}};
 const assertUnlocked=()=>{if(locked)throw Object.assign(Error('BELTRIX Wallet is locked.'),{code:4100})};
 const provider={
  isBeltrixWallet:true,
  isBeltrixSolanaWallet:true,
  get publicKey(){return locked?null:keypair.publicKey},
  async connect(){assertUnlocked();return {publicKey:keypair.publicKey}},
  async disconnect(){provider.lock();},
  async signTransaction(transaction){
   assertUnlocked();
   if(!transaction)throw Error('Solana transaction is required.');
   if(transaction instanceof VersionedTransaction||typeof transaction.sign==='function'&&Array.isArray(transaction.signatures)){
    if(transaction instanceof VersionedTransaction)transaction.sign([keypair]);
    else if(typeof transaction.partialSign==='function')transaction.partialSign(keypair);
    else transaction.sign(keypair);
    return transaction;
   }
   if(typeof transaction.partialSign==='function'){transaction.partialSign(keypair);return transaction}
   throw Error('Unsupported Solana transaction type.');
  },
  async signAllTransactions(transactions=[]){
   assertUnlocked();const out=[];
   for(const transaction of transactions)out.push(await provider.signTransaction(transaction));
   return out;
  },
  on(event,listener){
   if(typeof listener!=='function')return provider;
   if(!listeners.has(event))listeners.set(event,new Set());
   listeners.get(event).add(listener);return provider;
  },
  removeListener(event,listener){listeners.get(event)?.delete(listener);return provider},
  lock(){
   if(locked)return;locked=true;
   emit('accountChanged',null);emit('disconnect');
   listeners.clear();
  }
 };
 return Object.freeze(provider);
}

export async function createBeltrixSolanaWallet(mnemonic,options={}){
 const keypair=await deriveBeltrixSolanaKeypair(mnemonic,options);
 return Object.freeze({
  address:keypair.publicKey.toBase58(),
  provider:createBeltrixSolanaProvider({keypair})
 });
}
