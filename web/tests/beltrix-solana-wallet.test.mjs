import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {Transaction,SystemProgram} from '@solana/web3.js';
import {deriveBeltrixSolanaAddress,deriveBeltrixSolanaKeypair,createBeltrixSolanaProvider} from '../beltrix-solana-wallet.js';
import {providersFor} from '../usdt-providers.js';

const PHRASE='test test test test test test test test test test test junk';

test('BELTRIX phrase deterministically derives a Solana account',async()=>{
 const a=await deriveBeltrixSolanaAddress(PHRASE,{cryptoImpl:webcrypto});
 const b=await deriveBeltrixSolanaAddress(PHRASE,{cryptoImpl:webcrypto});
 const c=await deriveBeltrixSolanaAddress(PHRASE,{accountIndex:1,cryptoImpl:webcrypto});
 assert.equal(a,b);
 assert.notEqual(a,c);
 assert.match(a,/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
});

test('BELTRIX Solana provider signs locally without exposing secretKey',async()=>{
 const keypair=await deriveBeltrixSolanaKeypair(PHRASE,{cryptoImpl:webcrypto});
 const provider=createBeltrixSolanaProvider({keypair});
 assert.equal('secretKey' in provider,false);
 const connected=await provider.connect();
 assert.equal(connected.publicKey.toBase58(),keypair.publicKey.toBase58());
 const tx=new Transaction({
  feePayer:keypair.publicKey,
  recentBlockhash:'11111111111111111111111111111111'
 }).add(SystemProgram.transfer({fromPubkey:keypair.publicKey,toPubkey:keypair.publicKey,lamports:1}));
 const signed=await provider.signTransaction(tx);
 assert.equal(signed.verifySignatures(),true);
 provider.lock();
 assert.equal(provider.publicKey,null);
 await assert.rejects(()=>provider.connect(),e=>e.code===4100);
});

test('Solana USDT provider discovery includes unlocked BELTRIX Wallet',async()=>{
 const keypair=await deriveBeltrixSolanaKeypair(PHRASE,{cryptoImpl:webcrypto});
 const provider=createBeltrixSolanaProvider({keypair});
 const win={beltrixWallet:{solanaProvider:provider}};
 const rows=providersFor('solana',win);
 assert.equal(rows[0].id,'beltrix-solana');
 assert.equal(rows[0].name,'BELTRIX Wallet · Solana');
 assert.equal(rows[0].provider,provider);
});
