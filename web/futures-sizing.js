// Exact, downward-rounded quantities. Never infer leverage from an editable field.
export function sizeFraction(maxSize, percent, decimals, reserveBps=0) {
  if(typeof maxSize!=='string'||! /^(0|[1-9]\d*)(\.\d+)?$/.test(maxSize)||maxSize.length>60)throw Error('Size data unavailable');
  if(!Number.isInteger(percent)||percent<0||percent>100||!Number.isInteger(decimals)||decimals<0||decimals>8||!Number.isInteger(reserveBps)||reserveBps<0||reserveBps>=10000)throw Error('Invalid sizing parameters');
  const [whole,fraction='']=maxSize.split('.');
  const units=BigInt(whole+fraction)*BigInt(percent)*BigInt(10000-reserveBps)*10n**BigInt(decimals)/(100n*10000n*10n**BigInt(fraction.length));
  let s=units.toString().padStart(decimals+1,'0');
  if(decimals)s=s.slice(0,-decimals)+'.'+s.slice(-decimals);
  return s.includes('.')?s.replace(/0+$/,'').replace(/\.$/,''):s;
}
export function closingSide(positionSize) {
  if(typeof positionSize!=='string'||! /^-?(0|[1-9]\d*)(\.\d+)?$/.test(positionSize)||Number(positionSize)===0)return null;
  return positionSize.startsWith('-')?'buy':'sell';
}
