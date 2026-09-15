// Never release a wallet signature to the exchange client after session drift.
export function guardedWallet(wallet,check,snapshot,now=Date.now){
 return {...wallet,async signTypedData(request){
  await check();const session=snapshot(),deadline=now()+30000;
  const signature=await wallet.signTypedData(request);
  await check();
  if(snapshot()!==session||now()>deadline)throw Error('Wallet session changed or signature expired. Review again.');
  return signature;
 }};
}
