const express = require("express");
const path = require("path");
const fs = require("fs");
const fsp = fs.promises;
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const { authenticator } = require("otplib");
const { Pool } = require("pg");

const app = express();
app.set("trust proxy", 1);

const PORT = Number(process.env.PORT || 3000);
const PUBLIC_DIR = path.resolve(__dirname, "../feeloop-preview-site");
const DATA_FILE = process.env.DATA_FILE || "/tmp/feeloop-state.json";
const DATABASE_URL = process.env.DATABASE_URL || "";
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(48).toString("hex");
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "admin@feeloop.app").trim().toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";
const APP_ENV = process.env.APP_ENV || "staging";
const COOKIE_NAME = "feeloop_session";
const COOKIE_SECURE = process.env.COOKIE_SECURE !== "false";
const BLOCKED_COUNTRIES = new Set((process.env.BLOCKED_COUNTRIES || "KR").split(",").map(v=>v.trim().toUpperCase()).filter(Boolean));
const ADMIN_BOOTSTRAP_HASH = "073f3b223eaea762cf26d12aaf9ef0a47b5897121e62a6ba4e98d190e713f090";

const EXCHANGE_SEED = [
  {id:"bingx",name:"BingX",short:"BX",cashbackRate:null,partnerCommissionRate:null,makerFee:null,takerFee:null,connectorStatus:"pending",enabled:true},
  {id:"toobit",name:"Toobit",short:"TB",cashbackRate:null,partnerCommissionRate:null,makerFee:null,takerFee:null,connectorStatus:"pending",enabled:true},
  {id:"bitget",name:"Bitget",short:"BG",cashbackRate:null,partnerCommissionRate:null,makerFee:null,takerFee:null,connectorStatus:"pending",enabled:true},
  {id:"coinw",name:"CoinW",short:"CW",cashbackRate:null,partnerCommissionRate:null,makerFee:null,takerFee:null,connectorStatus:"pending",enabled:true}
];

const initialState = () => ({
  version: 1,
  users: [],
  exchangeAccounts: [],
  feeRecords: [],
  payouts: [],
  events: [],
  auditLogs: [],
  exchangeConfigs: EXCHANGE_SEED,
  countryRules: [{country:"KR",status:"BLOCK",reason:"Customer onboarding excluded"}],
  passwordResetTokens: []
});

let state = initialState();
let pgPool = null;
let writeChain = Promise.resolve();

function now(){ return new Date().toISOString(); }
function id(prefix){ return prefix + "_" + crypto.randomBytes(9).toString("hex"); }
function cleanEmail(v){ return String(v||"").trim().toLowerCase(); }
function cleanCountry(v){ return String(v||"").trim().toUpperCase().slice(0,2); }
function numeric(v){ const n=Number(v); return Number.isFinite(n)?n:0; }
function safeHttpUrl(v){ const raw=String(v||"").trim(); if(!raw) return ""; try{ const u=new URL(raw); return ["http:","https:"].includes(u.protocol)?u.toString():""; }catch{return "";} }
function publicUser(u){ return u ? {id:u.id,email:u.email,role:u.role,country:u.country,emailVerified:!!u.emailVerified,mfaEnabled:!!u.mfaEnabled,createdAt:u.createdAt} : null; }

function normalizeState(raw){
  const base=initialState();
  if(!raw || typeof raw!=="object") return base;
  return {
    ...base,
    ...raw,
    users:Array.isArray(raw.users)?raw.users:[],
    exchangeAccounts:Array.isArray(raw.exchangeAccounts)?raw.exchangeAccounts:[],
    feeRecords:Array.isArray(raw.feeRecords)?raw.feeRecords:[],
    payouts:Array.isArray(raw.payouts)?raw.payouts:[],
    events:Array.isArray(raw.events)?raw.events:[],
    auditLogs:Array.isArray(raw.auditLogs)?raw.auditLogs:[],
    exchangeConfigs:Array.isArray(raw.exchangeConfigs)&&raw.exchangeConfigs.length?raw.exchangeConfigs:EXCHANGE_SEED,
    countryRules:Array.isArray(raw.countryRules)?raw.countryRules:base.countryRules,
    passwordResetTokens:Array.isArray(raw.passwordResetTokens)?raw.passwordResetTokens:[]
  };
}

async function initStorage(){
  if(DATABASE_URL){
    pgPool = new Pool({connectionString:DATABASE_URL, ssl: process.env.PGSSL==="disable" ? false : {rejectUnauthorized:false}});
    await pgPool.query('CREATE SCHEMA IF NOT EXISTS feeloop');
    await pgPool.query(`CREATE TABLE IF NOT EXISTS feeloop.app_state (
      id SMALLINT PRIMARY KEY,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    const res=await pgPool.query("SELECT data FROM feeloop.app_state WHERE id=1");
    state=normalizeState(res.rows[0]?.data);
    if(!res.rows.length) await saveState();
  }else{
    try{
      state=normalizeState(JSON.parse(await fsp.readFile(DATA_FILE,"utf8")));
    }catch{
      state=initialState();
      await saveState();
    }
  }
  await seedAdmin();
}

async function saveState(){
  const snapshot=JSON.stringify(state);
  writeChain = writeChain.then(async()=>{
    if(pgPool){
      await pgPool.query(
        "INSERT INTO feeloop.app_state(id,data,updated_at) VALUES (1,$1::jsonb,NOW()) ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data,updated_at=NOW()",
        [snapshot]
      );
    }else{
      await fsp.mkdir(path.dirname(DATA_FILE),{recursive:true});
      await fsp.writeFile(DATA_FILE,snapshot,"utf8");
    }
  });
  return writeChain;
}

async function mutate(fn){
  const result=await fn(state);
  await saveState();
  return result;
}

async function seedAdmin(){
  if(!ADMIN_PASSWORD) return;
  const existing=state.users.find(u=>u.email===ADMIN_EMAIL);
  if(existing){
    if(existing.role!=="admin"){ existing.role="admin"; await saveState(); }
    return;
  }
  const passwordHash=await bcrypt.hash(ADMIN_PASSWORD,12);
  state.users.push({id:id("usr"),email:ADMIN_EMAIL,passwordHash,role:"admin",country:"",emailVerified:true,mfaEnabled:false,mfaSecret:null,createdAt:now(),updatedAt:now()});
  state.auditLogs.unshift({id:id("aud"),actorId:null,action:"ADMIN_SEEDED",target:ADMIN_EMAIL,meta:{env:APP_ENV},createdAt:now()});
  await saveState();
}

function countryFromRequest(req){
  const header = req.get("cf-ipcountry") || req.get("x-vercel-ip-country") || req.get("x-country-code") || "";
  return cleanCountry(header);
}

function isBlockedCountry(country){ return BLOCKED_COUNTRIES.has(cleanCountry(country)); }

function setAuthCookie(res,user){
  const token=jwt.sign({sub:user.id,role:user.role,email:user.email},JWT_SECRET,{expiresIn:"7d",issuer:"feeloop"});
  res.cookie(COOKIE_NAME,token,{httpOnly:true,secure:COOKIE_SECURE,sameSite:"lax",maxAge:7*24*60*60*1000,path:"/"});
}
function clearAuthCookie(res){ res.clearCookie(COOKIE_NAME,{httpOnly:true,secure:COOKIE_SECURE,sameSite:"lax",path:"/"}); }

function authOptional(req,res,next){
  const token=req.cookies[COOKIE_NAME];
  if(!token) return next();
  try{
    const payload=jwt.verify(token,JWT_SECRET,{issuer:"feeloop"});
    const user=state.users.find(u=>u.id===payload.sub);
    if(user) req.user=user;
  }catch{}
  next();
}
function requireAuth(req,res,next){ if(!req.user) return res.status(401).json({error:"AUTH_REQUIRED"}); next(); }
function requireAdmin(req,res,next){ if(!req.user || req.user.role!=="admin") return res.status(403).json({error:"ADMIN_REQUIRED"}); next(); }

function sameOriginMutation(req,res,next){
  if(["GET","HEAD","OPTIONS"].includes(req.method)) return next();
  const origin=req.get("origin");
  if(!origin) return next();
  const expected=`${req.protocol}://${req.get("host")}`;
  if(origin!==expected) return res.status(403).json({error:"ORIGIN_REJECTED"});
  next();
}

function audit(actor,action,target="",meta={}){
  state.auditLogs.unshift({id:id("aud"),actorId:actor?.id||null,action,target,meta,createdAt:now()});
  if(state.auditLogs.length>5000) state.auditLogs.length=5000;
}

function userFinancials(userId){
  const ledger=state.feeRecords.filter(r=>r.userId===userId).sort((a,b)=>b.occurredAt.localeCompare(a.occurredAt));
  const accrued=ledger.reduce((s,r)=>s+numeric(r.cashbackAmount),0);
  const payouts=state.payouts.filter(p=>p.userId===userId);
  const reserved=payouts.filter(p=>["pending","processing"].includes(p.status)).reduce((s,p)=>s+numeric(p.amount),0);
  const paid=payouts.filter(p=>p.status==="paid").reduce((s,p)=>s+numeric(p.amount),0);
  const totalFees=ledger.reduce((s,r)=>s+numeric(r.feeAmount),0);
  return {totalFees,accrued,reserved,paid,available:Math.max(0,accrued-reserved-paid),ledger,payouts:payouts.sort((a,b)=>b.createdAt.localeCompare(a.createdAt))};
}

app.use(helmet({contentSecurityPolicy:false,crossOriginEmbedderPolicy:false}));
app.use(express.json({limit:"256kb"}));
app.use(express.urlencoded({extended:false,limit:"256kb"}));
app.use(cookieParser());
app.use(sameOriginMutation);
app.use(authOptional);

const authLimiter=rateLimit({windowMs:15*60*1000,limit:40,standardHeaders:true,legacyHeaders:false});
const writeLimiter=rateLimit({windowMs:60*1000,limit:120,standardHeaders:true,legacyHeaders:false});
app.use("/api/auth",authLimiter);
app.use("/api",writeLimiter);

app.get("/healthz",(req,res)=>res.json({ok:true,env:APP_ENV,storage:pgPool?"postgres":"file",time:now()}));

app.get("/api/public/config",(req,res)=>{
  res.json({
    app:"FEELOOP",
    environment:APP_ENV,
    exchanges:state.exchangeConfigs.filter(x=>x.enabled!==false).map(x=>({...x,partnerCommissionRate:undefined})),
    blockedCountries:[...BLOCKED_COUNTRIES],
    registrationOpen:true
  });
});

app.get("/api/auth/bootstrap-status",(req,res)=>{
  res.json({adminExists:state.users.some(u=>u.role==="admin")});
});

app.post("/api/auth/bootstrap-admin",async(req,res)=>{
  if(state.users.some(u=>u.role==="admin")) return res.status(410).json({error:"ADMIN_ALREADY_CONFIGURED"});
  const phraseHash=crypto.createHash("sha256").update(String(req.body.bootstrapPhrase||"")).digest("hex");
  const a=Buffer.from(phraseHash), b=Buffer.from(ADMIN_BOOTSTRAP_HASH);
  if(a.length!==b.length || !crypto.timingSafeEqual(a,b)) return res.status(403).json({error:"INVALID_BOOTSTRAP_PHRASE"});
  const email=cleanEmail(req.body.email);
  const password=String(req.body.password||"");
  if(!email || !/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({error:"INVALID_EMAIL"});
  if(password.length<12) return res.status(400).json({error:"PASSWORD_TOO_SHORT"});
  const passwordHash=await bcrypt.hash(password,12);
  const user={id:id("usr"),email,passwordHash,role:"admin",country:"",emailVerified:true,mfaEnabled:false,mfaSecret:null,createdAt:now(),updatedAt:now()};
  await mutate(async()=>{state.users.push(user);audit(user,"ADMIN_BOOTSTRAPPED",user.id,{email});});
  setAuthCookie(res,user);
  res.status(201).json({user:publicUser(user)});
});

app.post("/api/auth/register",async(req,res)=>{
  const email=cleanEmail(req.body.email);
  const password=String(req.body.password||"");
  const country=cleanCountry(req.body.country);
  const reqCountry=countryFromRequest(req);
  if(!email || !/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({error:"INVALID_EMAIL"});
  if(password.length<10) return res.status(400).json({error:"PASSWORD_TOO_SHORT"});
  if(!country) return res.status(400).json({error:"COUNTRY_REQUIRED"});
  if(isBlockedCountry(country)||isBlockedCountry(reqCountry)) return res.status(451).json({error:"COUNTRY_NOT_SUPPORTED"});
  if(req.body.acceptTerms!==true) return res.status(400).json({error:"TERMS_REQUIRED"});
  if(state.users.some(u=>u.email===email)) return res.status(409).json({error:"EMAIL_EXISTS"});
  const passwordHash=await bcrypt.hash(password,12);
  const user={id:id("usr"),email,passwordHash,role:"user",country,emailVerified:true,mfaEnabled:false,mfaSecret:null,createdAt:now(),updatedAt:now()};
  await mutate(async()=>{state.users.push(user);audit(user,"USER_REGISTERED",user.id,{country});});
  setAuthCookie(res,user);
  res.status(201).json({user:publicUser(user)});
});

app.post("/api/auth/login",async(req,res)=>{
  const email=cleanEmail(req.body.email);
  const password=String(req.body.password||"");
  const user=state.users.find(u=>u.email===email);
  if(!user || !(await bcrypt.compare(password,user.passwordHash))) return res.status(401).json({error:"INVALID_CREDENTIALS"});
  if(user.role!=="admin" && isBlockedCountry(user.country)) return res.status(451).json({error:"COUNTRY_NOT_SUPPORTED"});
  if(user.mfaEnabled){
    const mfaToken=jwt.sign({sub:user.id,purpose:"mfa-login"},JWT_SECRET,{expiresIn:"5m",issuer:"feeloop"});
    return res.json({mfaRequired:true,mfaToken});
  }
  setAuthCookie(res,user);
  await mutate(async()=>{audit(user,"LOGIN",user.id,{ip:req.ip});});
  res.json({user:publicUser(user)});
});

app.post("/api/auth/mfa-login",async(req,res)=>{
  let payload;
  try{payload=jwt.verify(String(req.body.mfaToken||""),JWT_SECRET,{issuer:"feeloop"});}catch{return res.status(401).json({error:"MFA_SESSION_EXPIRED"});}
  if(payload.purpose!=="mfa-login") return res.status(401).json({error:"INVALID_MFA_SESSION"});
  const user=state.users.find(u=>u.id===payload.sub);
  if(!user?.mfaEnabled || !authenticator.check(String(req.body.code||""),user.mfaSecret)) return res.status(401).json({error:"INVALID_MFA_CODE"});
  setAuthCookie(res,user);
  await mutate(async()=>{audit(user,"LOGIN_MFA",user.id,{ip:req.ip});});
  res.json({user:publicUser(user)});
});

app.post("/api/auth/logout",requireAuth,async(req,res)=>{
  await mutate(async()=>audit(req.user,"LOGOUT",req.user.id,{}));
  clearAuthCookie(res);
  res.json({ok:true});
});

app.get("/api/auth/me",requireAuth,(req,res)=>res.json({user:publicUser(req.user)}));

app.post("/api/auth/password-reset/request",async(req,res)=>{
  const email=cleanEmail(req.body.email);
  const user=state.users.find(u=>u.email===email);
  if(user){
    const token=crypto.randomBytes(32).toString("hex");
    const tokenHash=crypto.createHash("sha256").update(token).digest("hex");
    await mutate(async()=>{
      state.passwordResetTokens=state.passwordResetTokens.filter(x=>x.userId!==user.id);
      state.passwordResetTokens.push({id:id("rst"),userId:user.id,tokenHash,expiresAt:new Date(Date.now()+30*60*1000).toISOString(),used:false});
      audit(user,"PASSWORD_RESET_REQUESTED",user.id,{});
    });
    if(process.env.ALLOW_DEBUG_EMAIL_TOKENS==="true") return res.json({ok:true,debugToken:token});
  }
  res.json({ok:true});
});

app.post("/api/auth/password-reset/confirm",async(req,res)=>{
  const tokenHash=crypto.createHash("sha256").update(String(req.body.token||"")).digest("hex");
  const rec=state.passwordResetTokens.find(x=>x.tokenHash===tokenHash&&!x.used&&x.expiresAt>now());
  if(!rec) return res.status(400).json({error:"INVALID_OR_EXPIRED_TOKEN"});
  const password=String(req.body.password||"");
  if(password.length<10) return res.status(400).json({error:"PASSWORD_TOO_SHORT"});
  const user=state.users.find(u=>u.id===rec.userId);
  if(!user) return res.status(400).json({error:"INVALID_TOKEN"});
  const passwordHash=await bcrypt.hash(password,12);
  await mutate(async()=>{user.passwordHash=passwordHash;user.updatedAt=now();rec.used=true;audit(user,"PASSWORD_RESET_COMPLETED",user.id,{});});
  res.json({ok:true});
});

app.post("/api/auth/mfa/setup",requireAuth,async(req,res)=>{
  if(req.user.role!=="admin") return res.status(403).json({error:"ADMIN_ONLY"});
  if(req.user.mfaEnabled) return res.status(409).json({error:"MFA_ALREADY_ENABLED"});
  const secret=authenticator.generateSecret();
  req.user.mfaPendingSecret=secret;
  await saveState();
  const uri=authenticator.keyuri(req.user.email,"FEELOOP",secret);
  res.json({secret,otpauthUri:uri});
});

app.post("/api/auth/mfa/enable",requireAuth,async(req,res)=>{
  if(req.user.role!=="admin" || !req.user.mfaPendingSecret) return res.status(400).json({error:"MFA_SETUP_REQUIRED"});
  if(!authenticator.check(String(req.body.code||""),req.user.mfaPendingSecret)) return res.status(400).json({error:"INVALID_MFA_CODE"});
  await mutate(async()=>{req.user.mfaSecret=req.user.mfaPendingSecret;req.user.mfaPendingSecret=null;req.user.mfaEnabled=true;audit(req.user,"MFA_ENABLED",req.user.id,{});});
  res.json({ok:true});
});

app.get("/api/dashboard",requireAuth,(req,res)=>{
  const fin=userFinancials(req.user.id);
  const accounts=state.exchangeAccounts.filter(a=>a.userId===req.user.id).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
  const events=state.events.filter(e=>e.status==="published").sort((a,b)=>(b.startAt||b.createdAt).localeCompare(a.startAt||a.createdAt)).slice(0,5);
  res.json({user:publicUser(req.user),summary:{totalFees:fin.totalFees,cashback:fin.accrued,available:fin.available,reserved:fin.reserved,paid:fin.paid},ledger:fin.ledger,accounts,payouts:fin.payouts,events});
});

app.get("/api/exchange-accounts",requireAuth,(req,res)=>res.json({accounts:state.exchangeAccounts.filter(a=>a.userId===req.user.id)}));
app.post("/api/exchange-accounts",requireAuth,async(req,res)=>{
  const exchangeId=String(req.body.exchangeId||"");
  const uid=String(req.body.uid||"").trim();
  const exchange=state.exchangeConfigs.find(x=>x.id===exchangeId&&x.enabled!==false);
  if(!exchange) return res.status(400).json({error:"INVALID_EXCHANGE"});
  if(!uid || uid.length>100) return res.status(400).json({error:"INVALID_UID"});
  if(state.exchangeAccounts.some(a=>a.exchangeId===exchangeId&&a.uid===uid)) return res.status(409).json({error:"UID_ALREADY_REGISTERED"});
  const account={id:id("exa"),userId:req.user.id,exchangeId,uid,status:"pending",createdAt:now(),updatedAt:now()};
  await mutate(async()=>{state.exchangeAccounts.push(account);audit(req.user,"EXCHANGE_UID_ADDED",account.id,{exchangeId,uid});});
  res.status(201).json({account});
});
app.delete("/api/exchange-accounts/:id",requireAuth,async(req,res)=>{
  const idx=state.exchangeAccounts.findIndex(a=>a.id===req.params.id&&a.userId===req.user.id);
  if(idx<0) return res.status(404).json({error:"NOT_FOUND"});
  const [account]=state.exchangeAccounts.splice(idx,1);
  await mutate(async()=>audit(req.user,"EXCHANGE_UID_REMOVED",account.id,{exchangeId:account.exchangeId,uid:account.uid}));
  res.json({ok:true});
});

app.get("/api/payouts",requireAuth,(req,res)=>res.json({payouts:state.payouts.filter(p=>p.userId===req.user.id).sort((a,b)=>b.createdAt.localeCompare(a.createdAt))}));
app.post("/api/payouts",requireAuth,async(req,res)=>{
  const amount=Math.round(numeric(req.body.amount)*100)/100;
  const method=String(req.body.method||"").trim();
  const destination=String(req.body.destination||"").trim();
  const fin=userFinancials(req.user.id);
  if(amount<=0 || amount>fin.available) return res.status(400).json({error:"INSUFFICIENT_AVAILABLE_BALANCE",available:fin.available});
  if(!["exchange_uid","wallet"].includes(method)) return res.status(400).json({error:"INVALID_METHOD"});
  if(!destination || destination.length>250) return res.status(400).json({error:"INVALID_DESTINATION"});
  const payout={id:id("pay"),userId:req.user.id,amount,method,destination,status:"pending",paymentRef:null,createdAt:now(),updatedAt:now()};
  await mutate(async()=>{state.payouts.push(payout);audit(req.user,"PAYOUT_REQUESTED",payout.id,{amount,method});});
  res.status(201).json({payout});
});

app.get("/api/events",(req,res)=>{
  const published=state.events.filter(e=>e.status==="published").sort((a,b)=>(b.startAt||b.createdAt).localeCompare(a.startAt||a.createdAt));
  res.json({events:published});
});
app.get("/api/events/:id",(req,res)=>{
  const event=state.events.find(e=>e.id===req.params.id&&e.status==="published");
  if(!event) return res.status(404).json({error:"NOT_FOUND"});
  res.json({event});
});

app.get("/api/admin/overview",requireAdmin,(req,res)=>{
  const pending=state.payouts.filter(p=>["pending","processing"].includes(p.status));
  const totalCommission=state.feeRecords.reduce((s,r)=>s+numeric(r.commissionAmount),0);
  const totalCashback=state.feeRecords.reduce((s,r)=>s+numeric(r.cashbackAmount),0);
  res.json({
    metrics:{pendingPayouts:pending.length,pendingAmount:pending.reduce((s,p)=>s+numeric(p.amount),0),users:state.users.filter(u=>u.role==="user").length,grossCommission:totalCommission,platformMargin:Math.max(0,totalCommission-totalCashback)},
    payouts:state.payouts.slice().sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,100),
    exchangeAccounts:state.exchangeAccounts.slice().sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,100),
    exchanges:state.exchangeConfigs,
    events:state.events.slice().sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,100),
    audit:state.auditLogs.slice(0,100)
  });
});

app.get("/api/admin/users",requireAdmin,(req,res)=>{
  const q=cleanEmail(req.query.q||"");
  const users=state.users.filter(u=>u.role==="user"&&(!q||u.email.includes(q))).slice(0,250).map(u=>({...publicUser(u),summary:userFinancials(u.id)}));
  res.json({users});
});

app.patch("/api/admin/exchange-accounts/:id",requireAdmin,async(req,res)=>{
  const account=state.exchangeAccounts.find(a=>a.id===req.params.id);
  if(!account) return res.status(404).json({error:"NOT_FOUND"});
  const status=String(req.body.status||"");
  if(!["pending","verified","rejected"].includes(status)) return res.status(400).json({error:"INVALID_STATUS"});
  await mutate(async()=>{account.status=status;account.updatedAt=now();audit(req.user,"EXCHANGE_UID_STATUS",account.id,{status});});
  res.json({account});
});

app.patch("/api/admin/exchanges/:id",requireAdmin,async(req,res)=>{
  const ex=state.exchangeConfigs.find(x=>x.id===req.params.id);
  if(!ex) return res.status(404).json({error:"NOT_FOUND"});
  const patch={};
  for(const key of ["cashbackRate","partnerCommissionRate","makerFee","takerFee"]){
    if(req.body[key]===null || req.body[key]==="") patch[key]=null;
    else if(req.body[key]!==undefined){
      const n=numeric(req.body[key]);
      if(n<0||n>100) return res.status(400).json({error:"INVALID_RATE",field:key});
      patch[key]=n;
    }
  }
  if(req.body.connectorStatus!==undefined) patch.connectorStatus=String(req.body.connectorStatus).slice(0,40);
  Object.assign(ex,patch);
  await mutate(async()=>audit(req.user,"EXCHANGE_CONFIG_UPDATED",ex.id,patch));
  res.json({exchange:ex});
});

app.post("/api/admin/fee-records/import",requireAdmin,async(req,res)=>{
  const userId=String(req.body.userId||"");
  const exchangeId=String(req.body.exchangeId||"");
  const sourceRecordId=String(req.body.sourceRecordId||"").trim();
  const feeAmount=Math.round(numeric(req.body.feeAmount)*100000000)/100000000;
  const commissionAmount=Math.round(numeric(req.body.commissionAmount)*100000000)/100000000;
  if(!state.users.some(u=>u.id===userId&&u.role==="user")) return res.status(400).json({error:"INVALID_USER"});
  if(!state.exchangeConfigs.some(x=>x.id===exchangeId)) return res.status(400).json({error:"INVALID_EXCHANGE"});
  if(!sourceRecordId) return res.status(400).json({error:"SOURCE_ID_REQUIRED"});
  if(state.feeRecords.some(r=>r.exchangeId===exchangeId&&r.sourceRecordId===sourceRecordId)) return res.status(409).json({error:"DUPLICATE_SOURCE_RECORD"});
  const ex=state.exchangeConfigs.find(x=>x.id===exchangeId);
  const rate=numeric(ex.cashbackRate)/100;
  const cashbackAmount=Math.min(commissionAmount,Math.max(0,feeAmount*rate));
  const rec={id:id("fee"),userId,exchangeId,sourceRecordId,feeAmount,commissionAmount,cashbackAmount,status:"eligible",occurredAt:req.body.occurredAt||now(),createdAt:now()};
  await mutate(async()=>{state.feeRecords.push(rec);audit(req.user,"FEE_RECORD_IMPORTED",rec.id,{userId,exchangeId,sourceRecordId});});
  res.status(201).json({record:rec});
});

app.patch("/api/admin/payouts/:id",requireAdmin,async(req,res)=>{
  const payout=state.payouts.find(p=>p.id===req.params.id);
  if(!payout) return res.status(404).json({error:"NOT_FOUND"});
  const status=String(req.body.status||"");
  if(!["pending","processing","paid","rejected"].includes(status)) return res.status(400).json({error:"INVALID_STATUS"});
  if(status==="paid" && !String(req.body.paymentRef||"").trim()) return res.status(400).json({error:"PAYMENT_REFERENCE_REQUIRED"});
  await mutate(async()=>{
    payout.status=status;payout.updatedAt=now();
    if(req.body.paymentRef!==undefined) payout.paymentRef=String(req.body.paymentRef||"").trim().slice(0,300);
    audit(req.user,"PAYOUT_STATUS_UPDATED",payout.id,{status,paymentRef:payout.paymentRef||null});
  });
  res.json({payout});
});

app.get("/api/admin/events",requireAdmin,(req,res)=>res.json({events:state.events.slice().sort((a,b)=>b.createdAt.localeCompare(a.createdAt))}));
app.post("/api/admin/events",requireAdmin,async(req,res)=>{
  const title=String(req.body.title||"").trim();
  const exchangeId=String(req.body.exchangeId||"").trim();
  if(!title || !state.exchangeConfigs.some(x=>x.id===exchangeId)) return res.status(400).json({error:"INVALID_EVENT"});
  const event={id:id("evt"),exchangeId,title,type:String(req.body.type||"Promotion").trim().slice(0,80),summary:String(req.body.summary||"").trim().slice(0,1000),startAt:req.body.startAt||null,endAt:req.body.endAt||null,reward:String(req.body.reward||"").trim().slice(0,300),region:String(req.body.region||"Eligible regions only").trim().slice(0,300),sourceUrl:safeHttpUrl(req.body.sourceUrl).slice(0,1000),status:["draft","published","archived"].includes(req.body.status)?req.body.status:"draft",createdAt:now(),updatedAt:now()};
  await mutate(async()=>{state.events.push(event);audit(req.user,"EVENT_CREATED",event.id,{exchangeId,title,status:event.status});});
  res.status(201).json({event});
});
app.patch("/api/admin/events/:id",requireAdmin,async(req,res)=>{
  const event=state.events.find(e=>e.id===req.params.id);
  if(!event) return res.status(404).json({error:"NOT_FOUND"});
  for(const key of ["title","type","summary","startAt","endAt","reward","region","sourceUrl","status"]){
    if(req.body[key]!==undefined) event[key]=key==="sourceUrl"?safeHttpUrl(req.body[key]).slice(0,1000):req.body[key];
  }
  if(!["draft","published","archived"].includes(event.status)) event.status="draft";
  event.updatedAt=now();
  await mutate(async()=>audit(req.user,"EVENT_UPDATED",event.id,{status:event.status}));
  res.json({event});
});

app.get("/api/admin/audit",requireAdmin,(req,res)=>res.json({audit:state.auditLogs.slice(0,500)}));

app.get("/api/admin/connectors",requireAdmin,(req,res)=>{
  res.json({connectors:state.exchangeConfigs.map(x=>({exchangeId:x.id,status:x.connectorStatus||"pending",configured:false,capabilities:{uidVerification:false,feeSync:false,payout:false}}))});
});

app.use(express.static(PUBLIC_DIR,{extensions:["html"],maxAge:0,etag:true}));
app.get("*",(req,res,next)=>{
  if(req.path.startsWith("/api/")) return res.status(404).json({error:"NOT_FOUND"});
  const file=path.join(PUBLIC_DIR,"index.html");
  fs.access(file,fs.constants.R_OK,err=>err?next():res.sendFile(file));
});

app.use((err,req,res,next)=>{
  console.error(err);
  res.status(500).json({error:"INTERNAL_ERROR"});
});

initStorage().then(()=>{
  app.listen(PORT,()=>console.log(`FEELOOP ${APP_ENV} listening on :${PORT} using ${pgPool?"postgres":"file"} storage`));
}).catch(err=>{
  console.error("Startup failed",err);
  process.exit(1);
});
