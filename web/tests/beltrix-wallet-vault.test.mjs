import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {encryptWalletSecret,decryptWalletSecret,BELTRIX_KDF_ITERATIONS} from '../beltrix-wallet-vault.js';

const KEY='0x'+'11'.repeat(32);

test('BELTRIX vault encrypts recovery key before storage',async()=>{
 const encrypted=await encryptWalletSecret(KEY,'correct horse battery',{cryptoImpl:webcrypto});
 assert.equal(encrypted.version,1);
 assert.equal(encrypted.iterations,BELTRIX_KDF_ITERATIONS);
 assert.equal(JSON.stringify(encrypted).includes(KEY.slice(2)),false);
 assert.equal(await decryptWalletSecret(encrypted,'correct horse battery',{cryptoImpl:webcrypto}),KEY);
});

test('BELTRIX vault rejects wrong passwords and weak vault passwords',async()=>{
 const encrypted=await encryptWalletSecret(KEY,'a-strong-wallet-password',{cryptoImpl:webcrypto});
 await assert.rejects(()=>decryptWalletSecret(encrypted,'wrong-wallet-password',{cryptoImpl:webcrypto}),/incorrect|damaged/i);
 await assert.rejects(()=>encryptWalletSecret(KEY,'short',{cryptoImpl:webcrypto}),/at least 10/i);
});

test('BELTRIX vault rejects malformed recovery keys',async()=>{
 await assert.rejects(()=>encryptWalletSecret('0x1234','a-strong-wallet-password',{cryptoImpl:webcrypto}),/recovery key/i);
});
