const OFFICIAL_ICON_BASE='https://app.hyperliquid.xyz/coins/';

const NAMES=Object.freeze({
 BTC:'Bitcoin',ETH:'Ethereum',SOL:'Solana',HYPE:'Hyperliquid',DOGE:'Dogecoin',XRP:'XRP',
 BNB:'BNB',ADA:'Cardano',AVAX:'Avalanche',LINK:'Chainlink',SUI:'Sui',APT:'Aptos',
 ARB:'Arbitrum',OP:'Optimism',LTC:'Litecoin',BCH:'Bitcoin Cash',DOT:'Polkadot',
 UNI:'Uniswap',AAVE:'Aave',NEAR:'NEAR Protocol',ATOM:'Cosmos',TRX:'TRON',
 TON:'Toncoin',WIF:'dogwifhat',PEPE:'Pepe',SHIB:'Shiba Inu',BONK:'Bonk',
 INJ:'Injective',TIA:'Celestia',SEI:'Sei',JUP:'Jupiter',ENA:'Ethena',PENDLE:'Pendle',
 FARTCOIN:'Fartcoin',PENGU:'Pudgy Penguins',TAO:'Bittensor',WLD:'Worldcoin',
 ONDO:'Ondo',MKR:'Maker',CRV:'Curve',LDO:'Lido DAO',ETC:'Ethereum Classic'
});

function cleanBase(symbol){
 const raw=String(symbol||'').trim();
 const colon=raw.lastIndexOf(':');
 const value=colon>=0?raw.slice(colon+1):raw;
 return value.replace(/^U(?=[A-Z0-9])/,'');
}

export function hyperliquidAssetName(symbol){
 const base=cleanBase(symbol).replace(/-PERP$/i,'').replace(/\/USDC$/i,'');
 return NAMES[base]||base;
}

export function hyperliquidLogoUrl(symbol){
 let token=cleanBase(symbol).replace(/-PERP$/i,'').replace(/\/USDC$/i,'');
 if(!token)return null;
 if(token==='USDC')return OFFICIAL_ICON_BASE+'USDC_USDC.svg';
 if(token.includes('USD'))return OFFICIAL_ICON_BASE+encodeURIComponent(token)+'_USDC.svg';
 return OFFICIAL_ICON_BASE+encodeURIComponent(token)+'_USDC.svg';
}

export function hyperliquidFallbackText(symbol){
 const value=cleanBase(symbol).replace(/[^A-Za-z0-9]/g,'');
 return (value.slice(0,2)||'?').toUpperCase();
}

export function normalizeAllPerpMetas(payload){
 const out=[];
 const rows=Array.isArray(payload)?payload:[];
 rows.forEach((entry,dexIndex)=>{
  let meta,contexts,dex='';
  if(Array.isArray(entry)){
   meta=entry[0];contexts=entry[1];
  }else if(entry&&typeof entry==='object'){
   meta=entry.meta||entry[0]||entry;
   contexts=entry.contexts||entry.assetCtxs||entry[1];
   dex=String(entry.dex||entry.name||'');
  }
  const universe=Array.isArray(meta?.universe)?meta.universe:[];
  universe.forEach((item,index)=>{
   if(item?.isDelisted)return;
   const rawName=String(item?.name||'');
   if(!rawName)return;
   const prefixed=rawName.includes(':')?rawName:(dexIndex===0?rawName:(dex?dex+':'+rawName:rawName));
   const asset=dexIndex===0?index:100000+dexIndex*10000+index;
   out.push(Object.freeze({
    value:prefixed,
    label:prefixed+' / USDC PERP',
    symbol:prefixed,
    base:cleanBase(prefixed),
    quote:'USDC',
    spot:false,
    dex:dexIndex===0?'':(dex||prefixed.split(':')[0]||''),
    dexIndex,
    asset,
    szDecimals:item?.szDecimals,
    maxLeverage:item?.maxLeverage,
    onlyIsolated:!!item?.onlyIsolated||item?.marginMode==='strictIsolated'||item?.marginMode==='noCross',
    delisted:false,
    hip3:dexIndex>0,
    tradeSupported:dexIndex===0,
    context:Array.isArray(contexts)?contexts[index]||null:null,
    logo:hyperliquidLogoUrl(prefixed),
    name:hyperliquidAssetName(prefixed),
    raw:item
   }));
  });
 });
 return out;
}

export function enrichHyperliquidRow(row){
 const symbol=row?.value||row?.symbol||row?.base||'';
 const displaySymbol=String(symbol).startsWith('@')?(row?.base||symbol):(row?.base||symbol);
 return Object.freeze({...row,logo:hyperliquidLogoUrl(displaySymbol),name:hyperliquidAssetName(displaySymbol),base:row?.base||cleanBase(symbol)});
}
