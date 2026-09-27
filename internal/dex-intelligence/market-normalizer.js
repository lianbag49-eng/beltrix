const ALIASES=Object.freeze({XBT:'BTC',WBTC:'BTC',WETH:'ETH',WSOL:'SOL'});

export const CANONICAL_MARKETS=Object.freeze({
 BTC:Object.freeze({
  hyperliquid:'BTC',
  orderly:'PERP_BTC_USDC',
  paradex:'BTC-USD-PERP',
  dydx:'BTC-USD',
  gmx:'BTC',
  drift:'BTC-PERP'
 }),
 ETH:Object.freeze({
  hyperliquid:'ETH',
  orderly:'PERP_ETH_USDC',
  paradex:'ETH-USD-PERP',
  dydx:'ETH-USD',
  gmx:'ETH',
  drift:'ETH-PERP'
 }),
 SOL:Object.freeze({
  hyperliquid:'SOL',
  orderly:'PERP_SOL_USDC',
  paradex:'SOL-USD-PERP',
  dydx:'SOL-USD',
  gmx:'SOL',
  drift:'SOL-PERP'
 })
});

export const SUPPORTED_CANONICAL_ASSETS=Object.freeze(Object.keys(CANONICAL_MARKETS));

export function canonicalAsset(input){
 const raw=String(input||'').trim().toUpperCase();
 if(!raw)return '';
 const cleaned=raw
  .replace(/^PERP[_-]/,'')
  .replace(/[-_/](USD|USDC|USDT)([-_/]PERP)?$/,'')
  .replace(/[-_/]PERP$/,'');
 return ALIASES[cleaned]||cleaned;
}

export function venueSymbol(asset,venueId){
 const canonical=canonicalAsset(asset);
 const symbol=CANONICAL_MARKETS[canonical]?.[String(venueId||'')];
 if(!symbol)throw Error('Unsupported market mapping: '+canonical+' @ '+venueId);
 return symbol;
}

export function marketRouting(asset){
 const canonical=canonicalAsset(asset);
 const row=CANONICAL_MARKETS[canonical];
 if(!row)throw Error('Unsupported canonical asset: '+canonical);
 return Object.freeze({
  asset:canonical,
  symbols:Object.freeze({...row})
 });
}

export function hasVenueMarket(asset,venueId){
 const canonical=canonicalAsset(asset);
 return Boolean(CANONICAL_MARKETS[canonical]?.[String(venueId||'')]);
}
