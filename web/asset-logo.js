const OFFICIAL_COIN_CDN='https://app.hyperliquid.xyz/coins/';

const DISPLAY_ALIASES=Object.freeze({
  UBTC:'BTC'
});

export function hyperliquidDisplaySymbol(value){
  const raw=String(value||'').trim();
  const withoutDex=raw.includes(':')?raw.split(':').pop():raw;
  const base=withoutDex.split('/')[0];
  return DISPLAY_ALIASES[base]||base;
}

export function hyperliquidLogoSymbol(market){
  const raw=market?.base||market?.logoSymbol||market?.symbol||market?.value||'';
  return hyperliquidDisplaySymbol(raw);
}

export function hyperliquidLogoUrl(market){
  const symbol=hyperliquidLogoSymbol(market);
  if(!symbol)return null;
  return OFFICIAL_COIN_CDN+encodeURIComponent(symbol)+'.svg';
}

export function logoFallbackText(market){
  const symbol=hyperliquidLogoSymbol(market);
  return (symbol||'?').replace(/[^A-Za-z0-9]/g,'').slice(0,3).toUpperCase()||'?';
}

export function applyHyperliquidLogo(img,market){
  if(!img)return;
  const src=hyperliquidLogoUrl(market);
  img.hidden=!src;
  img.dataset.fallback=logoFallbackText(market);
  img.alt=hyperliquidLogoSymbol(market)?hyperliquidLogoSymbol(market)+' logo':'Asset logo';
  img.onerror=()=>{img.hidden=true;img.closest?.('.asset-logo-wrap')?.classList.add('logo-fallback')};
  img.onload=()=>{img.hidden=false;img.closest?.('.asset-logo-wrap')?.classList.remove('logo-fallback')};
  if(src&&img.src!==src)img.src=src;
}
