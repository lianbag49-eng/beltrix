/** Pure, causal chart calculations. No account, order, wallet or RPC access.
 * RSI: Wilder RMA, SMA seed. EMA: SMA seed, alpha=2/(length+1).
 * BB: population standard deviation; MACD histogram = MACD - signal.
 * Incomplete warm-up points are null, never zero. Flat RSI is defined as 50.
 */
export const INDICATORS = Object.freeze(['volume', 'rsi', 'macd', 'ma', 'ema', 'boll']);
export const CHART_DEFAULTS = Object.freeze({volume:true,rsi:true,macd:false,ma:false,ema:false,boll:false,muted:false,rsiPeriod:14,maPeriod:25,emaPeriod:21,bollPeriod:20,bollWidth:2});
const valid = x => typeof x === 'number' && Number.isFinite(x);
const period = n => { if (!Number.isInteger(n) || n < 2 || n > 200) throw Error('Period must be an integer from 2 to 200.'); return n; };
export function chartPreferences(raw) {
 const out={...CHART_DEFAULTS};
 if(!raw || typeof raw!=='object' || Array.isArray(raw))return out;
 for(const key of [...INDICATORS,'muted'])if(typeof raw[key]==='boolean')out[key]=raw[key];
 for(const key of ['rsiPeriod','maPeriod','emaPeriod','bollPeriod'])if(Number.isInteger(raw[key])&&raw[key]>=2&&raw[key]<=200)out[key]=raw[key];
 if(valid(raw.bollWidth)&&raw.bollWidth>=0.5&&raw.bollWidth<=5)out.bollWidth=raw.bollWidth;
 return out;
}
export function validCandle(raw) {
 if(!raw || typeof raw!=='object')return null;
 const keys=['t','o','h','l','c','v'];
 if(keys.some(k=>raw[k]===null||raw[k]===undefined||raw[k]===''||typeof raw[k]==='boolean'))return null;
 const c=Object.fromEntries(keys.map(k=>[k,Number(raw[k])]));
 if(!Object.values(c).every(Number.isFinite)||!Number.isSafeInteger(c.t)||c.t<=0||Math.min(c.o,c.c,c.l)<=0||c.v<0||c.h<Math.max(c.o,c.c)||c.l>Math.min(c.o,c.c))return null;
 return c;
}
export function normalizeCandles(raw, limit=1000) {
 if(!Array.isArray(raw))return [];
 const byTime=new Map();
 for(const row of raw){const c=validCandle(row);if(c)byTime.set(c.t,c);}
 return [...byTime.values()].sort((a,b)=>a.t-b.t).slice(-Math.max(1,Math.min(5000,limit)));
}
export function sma(values,n) {
 period(n);let sum=0,window=[];
 return values.map(value=>{
  if(!valid(value)){sum=0;window=[];return null;}
  window.push(value);sum+=value;if(window.length>n)sum-=window.shift();
  return window.length===n?sum/n:null;
 });
}
export function ema(values,n) {
 period(n);let seed=[],previous=null;const alpha=2/(n+1);
 return values.map(value=>{
  if(!valid(value)){seed=[];previous=null;return null;}
  if(previous===null){seed.push(value);if(seed.length<n)return null;previous=seed.reduce((a,b)=>a+b,0)/n;}
  else previous=alpha*value+(1-alpha)*previous;
  return previous;
 });
}
export function rsi(values,n=14) {
 period(n);let previous=null,steps=0,gain=0,loss=0;
 return values.map(value=>{
  if(!valid(value)){previous=null;steps=0;gain=0;loss=0;return null;}
  if(previous===null){previous=value;return null;}
  const delta=value-previous;previous=value;steps++;
  if(steps<=n){gain+=Math.max(0,delta)/n;loss+=Math.max(0,-delta)/n;}
  else {gain=(gain*(n-1)+Math.max(0,delta))/n;loss=(loss*(n-1)+Math.max(0,-delta))/n;}
  if(steps<n)return null;
  return gain===0&&loss===0?50:loss===0?100:100-100/(1+gain/loss);
 });
}
export function bollinger(values,n=20,width=2) {
 period(n);if(!valid(width)||width<=0||width>5)throw Error('Invalid band width.');
 const middle=sma(values,n),upper=[],lower=[];
 for(let i=0;i<values.length;i++){
  if(middle[i]===null){upper.push(null);lower.push(null);continue;}
  let variance=0;for(let j=i-n+1;j<=i;j++)variance+=(values[j]-middle[i])**2/n;
  const spread=width*Math.sqrt(variance);upper.push(middle[i]+spread);lower.push(middle[i]-spread);
 }
 return {middle,upper,lower};
}
export function macd(values,fast=12,slow=26,signalPeriod=9) {
 period(fast);period(slow);period(signalPeriod);if(fast>=slow)throw Error('Fast period must be shorter than slow period.');
 const a=ema(values,fast),b=ema(values,slow);
 const line=a.map((x,i)=>x===null||b[i]===null?null:x-b[i]);
 const signal=ema(line,signalPeriod),histogram=line.map((x,i)=>x===null||signal[i]===null?null:x-signal[i]);
 return {line,signal,histogram};
}
export function calculateIndicators(candles,prefs) {
 const p=chartPreferences(prefs),close=candles.map(c=>c.c);
 return {ma:sma(close,p.maPeriod),ema:ema(close,p.emaPeriod),rsi:rsi(close,p.rsiPeriod),boll:bollinger(close,p.bollPeriod,p.bollWidth),macd:macd(close)};
}
export function visibleWindow(length,count=60,offset=0) {
 const take=Math.min(length,Math.max(12,Math.min(500,Math.round(count))));
 const end=Math.max(take,Math.min(length,length-Math.max(0,Math.round(offset))));
 return {start:Math.max(0,end-take),end,offset:Math.max(0,length-end),count:take};
}
