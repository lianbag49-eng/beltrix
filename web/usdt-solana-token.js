// Narrow original SPL Token Program codec; no Token-2022 extensions or approvals.
// Layout/enum references: solana-program/token (state.rs, instruction.rs),
// associated-token-account interface (CreateIdempotent = 1). Bounds are explicit.
import {PublicKey,TransactionInstruction,SystemProgram} from '@solana/web3.js';
import {Buffer} from 'buffer';
export const TOKEN_PROGRAM=new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
export const ATA_PROGRAM=new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');
export function associated(owner,mint){return PublicKey.findProgramAddressSync([owner.toBuffer(),TOKEN_PROGRAM.toBuffer(),mint.toBuffer()],ATA_PROGRAM)[0];}
export function decodeMint(info){
 if(!info||!info.owner.equals(TOKEN_PROGRAM)||info.data.length!==82||info.data[45]!==1)throw Error('Solana USDT mint is missing or is not an initialized original SPL mint.');
 return {decimals:info.data[44]};
}
export function decodeToken(info){
 if(!info||!info.owner.equals(TOKEN_PROGRAM)||info.data.length!==165)throw Error('Invalid original SPL token account.');
 const b=info.data;if(![1,2].includes(b[108]))throw Error('Token account is not initialized.');
 return {mint:new PublicKey(b.subarray(0,32)),owner:new PublicKey(b.subarray(32,64)),amount:new DataView(b.buffer,b.byteOffset,b.byteLength).getBigUint64(64,true),frozen:b[108]===2};
}
export function createATA(payer,owner,mint){return new TransactionInstruction({programId:ATA_PROGRAM,keys:[{pubkey:payer,isSigner:true,isWritable:true},{pubkey:associated(owner,mint),isSigner:false,isWritable:true},{pubkey:owner,isSigner:false,isWritable:false},{pubkey:mint,isSigner:false,isWritable:false},{pubkey:SystemProgram.programId,isSigner:false,isWritable:false},{pubkey:TOKEN_PROGRAM,isSigner:false,isWritable:false}],data:Buffer.from([1])});}
export function checkedTransfer(source,mint,destination,owner,amount,decimals){
 if(typeof amount!=='bigint'||amount<=0n||amount>=2n**64n||!Number.isInteger(decimals)||decimals<0||decimals>255||source.equals(destination))throw Error('Invalid SPL transfer.');
 const data=Buffer.alloc(10);data[0]=12;data.writeBigUInt64LE(amount,1);data[9]=decimals;
 return new TransactionInstruction({programId:TOKEN_PROGRAM,keys:[{pubkey:source,isSigner:false,isWritable:true},{pubkey:mint,isSigner:false,isWritable:false},{pubkey:destination,isSigner:false,isWritable:true},{pubkey:owner,isSigner:true,isWritable:false}],data});
}
