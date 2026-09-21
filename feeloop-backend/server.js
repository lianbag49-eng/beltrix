const express = require("express");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const { authenticator } = require("otplib");
const { Pool } = require("pg");
const { configured: mailConfigured, sendEmail, verificationEmail, passwordResetEmail } = require("./mail");

const app = express();
app.set("trust proxy", 1);

const PORT = Number(process.env.PORT || 3000);
const PUBLIC_DIR = path.resolve(__dirname, "../feeloop-preview-site");
const DATABASE_URL = process.env.DATABASE_URL || "";
const APP_ENV = process.env.APP_ENV || "staging";
const COOKIE_NAME = "feeloop_session";
const COOKIE_SECURE = process.env.COOKIE_SECURE !== "false";
const BLOCKED_COUNTRIES = new Set((process.env.BLOCKED_COUNTRIES || "KR").split(",").map(v=>v.trim().toUpperCase()).filter(Boolean));
const ADMIN_BOOTSTRAP_HASH = "073f3b223eaea762cf26d12aaf9ef0a47b5897121e62a6ba4e98d190e713f090";
const SESSION_DAYS = 7;

if(!DATABASE_URL){
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: process.env.PGSSL === "disable" ? false : { rejectUnauthorized: false },
  max: 5,
  idleTimeoutMillis: 30000
});

const EXCHANGE_SEED = [
  {id:"bingx",name:"BingX",short:"BX"},
  {id:"toobit",name:"Toobit",short:"TB"},
  {id:"bitget",name:"Bitget",short:"BG"},
  {id:"coinw",name:"CoinW",short:"CW"}
];

function now(){ return new Date().toISOString(); }
function id(prefix){ return prefix + "_" + crypto.randomBytes(9).toString("hex"); }
function token(){ return crypto.randomBytes(32).toString("base64url"); }
function hashToken(v){ return crypto.createHash("sha256").update(String(v||"")).digest("hex"); }
function cleanEmail(v){ return String(v||"").trim().toLowerCase(); }
function cleanCountry(v){ return String(v||"").trim().toUpperCase().slice(0,2); }
function numeric(v){ const n=Number(v); return Number.isFinite(n)?n:0; }
function safeHttpUrl(v){
  const raw=String(v||"").trim();
  if(!raw) return "";
  try{
    const u=new URL(raw);
    return ["http:","https:"].includes(u.protocol)?u.toString():"";
  }catch{return "";}
}
function publicUser(u){
  if(!u) return null;
  return {
    id:u.id,email:u.email,role:u.role,country:u.country||"",
    emailVerified:!!u.email_verified,mfaEnabled:!!u.mfa_enabled,
    createdAt:u.created_at
  };
}
function countryFromRequest(req){
  return cleanCountry(req.get("cf-ipcountry") || req.get("x-vercel-ip-country") || req.get("x-country-code") || "");
}
function isBlockedCountry(country){ return BLOCKED_COUNTRIES.has(cleanCountry(country)); }
function moneyRound(v){ return Math.round(numeric(v)*1e8)/1e8; }

async function q(text,params=[]){ return pool.query(text,params); }
async function tx(fn){
  const client=await pool.connect();
  try{
    await client.query("BEGIN");
    const result=await fn(client);
    await client.query("COMMIT");
    return result;
  }catch(err){
    await client.query("ROLLBACK");
    throw err;
  }finally{
    client.release();
  }
}
async function audit(actorId,action,target="",meta={}){
  await q(
    "INSERT INTO feeloop.audit_logs(id,actor_id,action,target,meta,created_at) VALUES($1,$2,$3,$4,$5::jsonb,NOW())",
    [id("aud"),actorId||null,action,target,JSON.stringify(meta||{})]
  );
}
async function getUserById(userId){
  const r=await q("SELECT * FROM feeloop.users WHERE id=$1 LIMIT 1",[userId]);
  return r.rows[0]||null;
}
async function getUserByEmail(email){
  const r=await q("SELECT * FROM feeloop.users WHERE LOWER(email)=LOWER($1) LIMIT 1",[email]);
  return r.rows[0]||null;
}
async function createSession(res,user,req){
  const raw=token();
  const sessionId=id("ses");
  const expiresAt=new Date(Date.now()+SESSION_DAYS*86400000);
  await q(
    `INSERT INTO feeloop.sessions(id,user_id,token_hash,expires_at,ip,user_agent)
     VALUES($1,$2,$3,$4,$5,$6)`,
    [sessionId,user.id,hashToken(raw),expiresAt.toISOString(),req.ip,String(req.get("user-agent")||"").slice(0,500)]
  );
  res.cookie(COOKIE_NAME,raw,{
    httpOnly:true,secure:COOKIE_SECURE,sameSite:"lax",
    maxAge:SESSION_DAYS*86400000,path:"/"
  });
}
async function revokeSession(raw){
  if(!raw) return;
  await q("UPDATE feeloop.sessions SET revoked_at=NOW() WHERE token_hash=$1 AND revoked_at IS NULL",[hashToken(raw)]);
}
function clearAuthCookie(res){
  res.clearCookie(COOKIE_NAME,{httpOnly:true,secure:COOKIE_SECURE,sameSite:"lax",path:"/"});
}

async function initDatabase(){
  await q("CREATE SCHEMA IF NOT EXISTS feeloop");
  for(const e of EXCHANGE_SEED){
    await q(
      `INSERT INTO feeloop.exchange_configs(id,name,short,enabled,connector_status)
       VALUES($1,$2,$3,TRUE,'pending')
       ON CONFLICT(id) DO NOTHING`,
      [e.id,e.name,e.short]
    );
  }
  await q(
    `INSERT INTO feeloop.country_rules(country,status,reason)
     VALUES('KR','BLOCK','Customer onboarding excluded')
     ON CONFLICT(country) DO NOTHING`
  );
  await q("DELETE FROM feeloop.sessions WHERE expires_at < NOW() OR revoked_at IS NOT NULL");
  await q("DELETE FROM feeloop.password_reset_tokens WHERE expires_at < NOW() OR used=TRUE");
  await q("DELETE FROM feeloop.email_verification_tokens WHERE expires_at < NOW() OR used=TRUE");
}

app.use(helmet({
  contentSecurityPolicy:{
    directives:{
      defaultSrc:["'self'"],
      scriptSrc:["'self'"],
      styleSrc:["'self'","'unsafe-inline'"],
      imgSrc:["'self'","data:"],
      connectSrc:["'self'"],
      objectSrc:["'none'"],
      baseUri:["'self'"],
      frameAncestors:["'none'"]
    }
  },
  crossOriginEmbedderPolicy:false
}));
app.use(express.json({limit:"256kb"}));
app.use(express.urlencoded({extended:false,limit:"256kb"}));
app.use(cookieParser());

app.use(async(req,res,next)=>{
  const raw=req.cookies[COOKIE_NAME];
  if(!raw) return next();
  try{
    const r=await q(
      `SELECT u.*, s.id AS session_id
       FROM feeloop.sessions s
       JOIN feeloop.users u ON u.id=s.user_id
       WHERE s.token_hash=$1 AND s.revoked_at IS NULL AND s.expires_at>NOW()
       LIMIT 1`,
      [hashToken(raw)]
    );
    if(r.rows[0]){
      req.user=r.rows[0];
      req.sessionId=r.rows[0].session_id;
      await q("UPDATE feeloop.sessions SET last_seen_at=NOW() WHERE id=$1",[req.sessionId]).catch(()=>{});
    }
  }catch(err){ console.error("session lookup failed",err.message); }
  next();
});

function requireAuth(req,res,next){
  if(!req.user) return res.status(401).json({error:"AUTH_REQUIRED"});
  next();
}
function requireAdmin(req,res,next){
  if(!req.user || req.user.role!=="admin") return res.status(403).json({error:"ADMIN_REQUIRED"});
  next();
}
function sameOriginMutation(req,res,next){
  if(["GET","HEAD","OPTIONS"].includes(req.method)) return next();
  const origin=req.get("origin");
  if(!origin) return next();
  const expected=`${req.protocol}://${req.get("host")}`;
  if(origin!==expected) return res.status(403).json({error:"ORIGIN_REJECTED"});
  next();
}
app.use(sameOriginMutation);

const authLimiter=rateLimit({windowMs:15*60*1000,limit:30,standardHeaders:true,legacyHeaders:false});
const apiLimiter=rateLimit({windowMs:60*1000,limit:180,standardHeaders:true,legacyHeaders:false});
app.use("/api/auth",authLimiter);
app.use("/api",apiLimiter);

app.get("/healthz",async(req,res)=>{
  try{
    await q("SELECT 1");
    res.json({ok:true,env:APP_ENV,storage:"postgres",time:now()});
  }catch{
    res.status(503).json({ok:false,env:APP_ENV,storage:"postgres",time:now()});
  }
});

app.get("/api/public/config",async(req,res)=>{
  const ex=await q(
    `SELECT id,name,short,enabled,cashback_rate AS "cashbackRate",
            maker_fee AS "makerFee",taker_fee AS "takerFee",
            connector_status AS "connectorStatus"
     FROM feeloop.exchange_configs
     WHERE enabled=TRUE ORDER BY name`
  );
  const blocked=await q("SELECT country FROM feeloop.country_rules WHERE status='BLOCK' ORDER BY country");
  res.json({
    app:"FEELOOP",environment:APP_ENV,
    exchanges:ex.rows,
    blockedCountries:blocked.rows.map(r=>r.country),
    registrationOpen:true
  });
});

app.get("/api/auth/bootstrap-status",async(req,res)=>{
  const r=await q("SELECT EXISTS(SELECT 1 FROM feeloop.users WHERE role='admin') AS exists");
  res.json({adminExists:!!r.rows[0].exists});
});

let adminBootstrapInProgress=false;
app.post("/api/auth/bootstrap-admin",async(req,res)=>{
  if(adminBootstrapInProgress) return res.status(409).json({error:"ADMIN_SETUP_BUSY"});
  adminBootstrapInProgress=true;
  try{
    const exists=await q("SELECT EXISTS(SELECT 1 FROM feeloop.users WHERE role='admin') AS exists");
    if(exists.rows[0].exists) return res.status(410).json({error:"ADMIN_ALREADY_CONFIGURED"});
    const phraseHash=hashToken(req.body.bootstrapPhrase||"");
    const a=Buffer.from(phraseHash),b=Buffer.from(ADMIN_BOOTSTRAP_HASH);
    if(a.length!==b.length||!crypto.timingSafeEqual(a,b)) return res.status(403).json({error:"INVALID_BOOTSTRAP_PHRASE"});
    const email=cleanEmail(req.body.email);
    const password=String(req.body.password||"");
    if(!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({error:"INVALID_EMAIL"});
    if(password.length<12) return res.status(400).json({error:"PASSWORD_TOO_SHORT"});
    const passwordHash=await bcrypt.hash(password,12);
    const userId=id("usr");
    await q(
      `INSERT INTO feeloop.users(id,email,password_hash,role,country,email_verified,mfa_enabled,created_at,updated_at)
       VALUES($1,$2,$3,'admin','',TRUE,FALSE,NOW(),NOW())`,
      [userId,email,passwordHash]
    );
    const user=await getUserById(userId);
    await audit(userId,"ADMIN_BOOTSTRAPPED",userId,{email});
    await createSession(res,user,req);
    res.status(201).json({user:publicUser(user)});
  }catch(err){
    if(err.code==="23505") return res.status(409).json({error:"EMAIL_EXISTS"});
    throw err;
  }finally{
    adminBootstrapInProgress=false;
  }
});

app.post("/api/auth/register",async(req,res)=>{
  const email=cleanEmail(req.body.email);
  const password=String(req.body.password||"");
  const country=cleanCountry(req.body.country);
  const ipCountry=countryFromRequest(req);
  if(!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({error:"INVALID_EMAIL"});
  if(password.length<10) return res.status(400).json({error:"PASSWORD_TOO_SHORT"});
  if(!country) return res.status(400).json({error:"COUNTRY_REQUIRED"});
  if(isBlockedCountry(country)||isBlockedCountry(ipCountry)) return res.status(451).json({error:"COUNTRY_NOT_SUPPORTED"});
  if(req.body.acceptTerms!==true) return res.status(400).json({error:"TERMS_REQUIRED"});
  const passwordHash=await bcrypt.hash(password,12);
  const userId=id("usr");
  const emailNeedsVerification=mailConfigured();
  try{
    await q(
      `INSERT INTO feeloop.users(id,email,password_hash,role,country,email_verified,mfa_enabled,created_at,updated_at)
       VALUES($1,$2,$3,'user',$4,$5,FALSE,NOW(),NOW())`,
      [userId,email,passwordHash,country,!emailNeedsVerification]
    );
  }catch(err){
    if(err.code==="23505") return res.status(409).json({error:"EMAIL_EXISTS"});
    throw err;
  }
  let user=await getUserById(userId);
  await audit(userId,"USER_REGISTERED",userId,{country,ipCountry:ipCountry||null});
  if(emailNeedsVerification){
    const raw=token();
    await q(
      `INSERT INTO feeloop.email_verification_tokens(id,user_id,token_hash,expires_at,used)
       VALUES($1,$2,$3,NOW()+INTERVAL '24 hours',FALSE)`,
      [id("emv"),userId,hashToken(raw)]
    );
    const msg=verificationEmail({origin:`${req.protocol}://${req.get("host")}`,token:raw});
    await sendEmail({to:email,subject:msg.subject,html:msg.html});
  }else{
    await createSession(res,user,req);
  }
  user=await getUserById(userId);
  res.status(201).json({user:publicUser(user),emailVerification:emailNeedsVerification?"required":"provider-not-configured"});
});

app.post("/api/auth/login",async(req,res)=>{
  const email=cleanEmail(req.body.email);
  const password=String(req.body.password||"");
  const user=await getUserByEmail(email);
  if(!user || !(await bcrypt.compare(password,user.password_hash))) return res.status(401).json({error:"INVALID_CREDENTIALS"});
  if(user.role!=="admin" && isBlockedCountry(user.country)) return res.status(451).json({error:"COUNTRY_NOT_SUPPORTED"});
  if(user.role!=="admin" && mailConfigured() && !user.email_verified) return res.status(403).json({error:"EMAIL_NOT_VERIFIED"});
  if(user.mfa_enabled){
    const mfaRaw=token();
    const mfaHash=hashToken(mfaRaw);
    await q(
      `INSERT INTO feeloop.system_settings(key,value,updated_at)
       VALUES($1,$2::jsonb,NOW())
       ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value,updated_at=NOW()`,
      ["mfa_login_"+mfaHash,JSON.stringify({userId:user.id,expiresAt:new Date(Date.now()+5*60*1000).toISOString()})]
    );
    return res.json({mfaRequired:true,mfaToken:mfaRaw});
  }
  await createSession(res,user,req);
  await audit(user.id,"LOGIN",user.id,{ip:req.ip});
  res.json({user:publicUser(user)});
});

app.post("/api/auth/mfa-login",async(req,res)=>{
  const raw=String(req.body.mfaToken||"");
  const key="mfa_login_"+hashToken(raw);
  const r=await q("SELECT value FROM feeloop.system_settings WHERE key=$1",[key]);
  if(!r.rows[0]) return res.status(401).json({error:"MFA_SESSION_EXPIRED"});
  const info=r.rows[0].value;
  if(!info?.userId || !info?.expiresAt || new Date(info.expiresAt)<=new Date()){
    await q("DELETE FROM feeloop.system_settings WHERE key=$1",[key]);
    return res.status(401).json({error:"MFA_SESSION_EXPIRED"});
  }
  const user=await getUserById(info.userId);
  if(!user?.mfa_enabled || !authenticator.check(String(req.body.code||""),user.mfa_secret||"")){
    return res.status(401).json({error:"INVALID_MFA_CODE"});
  }
  await q("DELETE FROM feeloop.system_settings WHERE key=$1",[key]);
  await createSession(res,user,req);
  await audit(user.id,"LOGIN_MFA",user.id,{ip:req.ip});
  res.json({user:publicUser(user)});
});

app.post("/api/auth/logout",requireAuth,async(req,res)=>{
  await revokeSession(req.cookies[COOKIE_NAME]);
  clearAuthCookie(res);
  await audit(req.user.id,"LOGOUT",req.user.id,{});
  res.json({ok:true});
});
app.post("/api/auth/logout-all",requireAuth,async(req,res)=>{
  await q("UPDATE feeloop.sessions SET revoked_at=NOW() WHERE user_id=$1 AND revoked_at IS NULL",[req.user.id]);
  clearAuthCookie(res);
  await audit(req.user.id,"LOGOUT_ALL",req.user.id,{});
  res.json({ok:true});
});
app.get("/api/auth/me",requireAuth,(req,res)=>res.json({user:publicUser(req.user)}));

app.get("/api/auth/sessions",requireAuth,async(req,res)=>{
  const r=await q(
    `SELECT id,created_at,last_seen_at,expires_at,ip,user_agent,
            CASE WHEN id=$2 THEN TRUE ELSE FALSE END AS current
     FROM feeloop.sessions
     WHERE user_id=$1 AND revoked_at IS NULL AND expires_at>NOW()
     ORDER BY last_seen_at DESC`,
    [req.user.id,req.sessionId]
  );
  res.json({sessions:r.rows});
});
app.delete("/api/auth/sessions/:id",requireAuth,async(req,res)=>{
  const r=await q(
    "UPDATE feeloop.sessions SET revoked_at=NOW() WHERE id=$1 AND user_id=$2 AND revoked_at IS NULL RETURNING id",
    [req.params.id,req.user.id]
  );
  if(!r.rows.length) return res.status(404).json({error:"NOT_FOUND"});
  await audit(req.user.id,"SESSION_REVOKED",req.params.id,{});
  res.json({ok:true});
});

app.post("/api/auth/verify-email",async(req,res)=>{
  const h=hashToken(req.body.token||"");
  const r=await q(
    `SELECT * FROM feeloop.email_verification_tokens
     WHERE token_hash=$1 AND used=FALSE AND expires_at>NOW() LIMIT 1`,[h]
  );
  const rec=r.rows[0];
  if(!rec) return res.status(400).json({error:"INVALID_OR_EXPIRED_TOKEN"});
  await tx(async c=>{
    await c.query("UPDATE feeloop.users SET email_verified=TRUE,updated_at=NOW() WHERE id=$1",[rec.user_id]);
    await c.query("UPDATE feeloop.email_verification_tokens SET used=TRUE WHERE id=$1",[rec.id]);
  });
  await audit(rec.user_id,"EMAIL_VERIFIED",rec.user_id,{});
  const user=await getUserById(rec.user_id);
  await createSession(res,user,req);
  res.json({ok:true,user:publicUser(user)});
});

app.post("/api/auth/resend-verification",async(req,res)=>{
  const email=cleanEmail(req.body.email);
  const user=await getUserByEmail(email);
  if(user && user.role==="user" && !user.email_verified && mailConfigured()){
    const raw=token();
    await q("DELETE FROM feeloop.email_verification_tokens WHERE user_id=$1",[user.id]);
    await q(
      `INSERT INTO feeloop.email_verification_tokens(id,user_id,token_hash,expires_at,used)
       VALUES($1,$2,$3,NOW()+INTERVAL '24 hours',FALSE)`,
      [id("emv"),user.id,hashToken(raw)]
    );
    const msg=verificationEmail({origin:`${req.protocol}://${req.get("host")}`,token:raw});
    await sendEmail({to:user.email,subject:msg.subject,html:msg.html});
  }
  res.json({ok:true,emailProviderConfigured:mailConfigured()});
});

app.post("/api/auth/password-reset/request",async(req,res)=>{
  const email=cleanEmail(req.body.email);
  const user=await getUserByEmail(email);
  if(user){
    const raw=token();
    await q("DELETE FROM feeloop.password_reset_tokens WHERE user_id=$1",[user.id]);
    await q(
      `INSERT INTO feeloop.password_reset_tokens(id,user_id,token_hash,expires_at,used)
       VALUES($1,$2,$3,NOW()+INTERVAL '30 minutes',FALSE)`,
      [id("rst"),user.id,hashToken(raw)]
    );
    if(mailConfigured()){
      const msg=passwordResetEmail({origin:`${req.protocol}://${req.get("host")}`,token:raw});
      await sendEmail({to:email,subject:msg.subject,html:msg.html});
    }
    await audit(user.id,"PASSWORD_RESET_REQUESTED",user.id,{emailProviderConfigured:mailConfigured()});
  }
  res.json({ok:true,emailProviderConfigured:mailConfigured()});
});
app.post("/api/auth/password-reset/confirm",async(req,res)=>{
  const h=hashToken(req.body.token||"");
  const r=await q(
    `SELECT * FROM feeloop.password_reset_tokens
     WHERE token_hash=$1 AND used=FALSE AND expires_at>NOW() LIMIT 1`,[h]
  );
  const rec=r.rows[0];
  if(!rec) return res.status(400).json({error:"INVALID_OR_EXPIRED_TOKEN"});
  const password=String(req.body.password||"");
  if(password.length<10) return res.status(400).json({error:"PASSWORD_TOO_SHORT"});
  const passwordHash=await bcrypt.hash(password,12);
  await tx(async c=>{
    await c.query("UPDATE feeloop.users SET password_hash=$1,updated_at=NOW() WHERE id=$2",[passwordHash,rec.user_id]);
    await c.query("UPDATE feeloop.password_reset_tokens SET used=TRUE WHERE id=$1",[rec.id]);
    await c.query("UPDATE feeloop.sessions SET revoked_at=NOW() WHERE user_id=$1 AND revoked_at IS NULL",[rec.user_id]);
  });
  await audit(rec.user_id,"PASSWORD_RESET_COMPLETED",rec.user_id,{});
  res.json({ok:true});
});

app.post("/api/auth/mfa/setup",requireAdmin,async(req,res)=>{
  if(req.user.mfa_enabled) return res.status(409).json({error:"MFA_ALREADY_ENABLED"});
  const secret=authenticator.generateSecret();
  await q("UPDATE feeloop.users SET mfa_pending_secret=$1,updated_at=NOW() WHERE id=$2",[secret,req.user.id]);
  res.json({secret,otpauthUri:authenticator.keyuri(req.user.email,"FEELOOP",secret)});
});
app.post("/api/auth/mfa/enable",requireAdmin,async(req,res)=>{
  const fresh=await getUserById(req.user.id);
  if(!fresh?.mfa_pending_secret) return res.status(400).json({error:"MFA_SETUP_REQUIRED"});
  if(!authenticator.check(String(req.body.code||""),fresh.mfa_pending_secret)) return res.status(400).json({error:"INVALID_MFA_CODE"});
  await q(
    "UPDATE feeloop.users SET mfa_secret=mfa_pending_secret,mfa_pending_secret=NULL,mfa_enabled=TRUE,updated_at=NOW() WHERE id=$1",
    [req.user.id]
  );
  await audit(req.user.id,"MFA_ENABLED",req.user.id,{});
  res.json({ok:true});
});

async function financials(userId,client=pool){
  const f=await client.query(
    `SELECT COALESCE(SUM(fee_amount),0)::float8 AS total_fees,
            COALESCE(SUM(cashback_amount),0)::float8 AS accrued
     FROM feeloop.fee_records WHERE user_id=$1`,[userId]
  );
  const p=await client.query(
    `SELECT
       COALESCE(SUM(amount) FILTER (WHERE status IN ('pending','processing')),0)::float8 AS reserved,
       COALESCE(SUM(amount) FILTER (WHERE status='paid'),0)::float8 AS paid
     FROM feeloop.payouts WHERE user_id=$1`,[userId]
  );
  const totalFees=numeric(f.rows[0].total_fees),accrued=numeric(f.rows[0].accrued);
  const reserved=numeric(p.rows[0].reserved),paid=numeric(p.rows[0].paid);
  return {totalFees,accrued,reserved,paid,available:Math.max(0,accrued-reserved-paid)};
}

app.get("/api/dashboard",requireAuth,async(req,res)=>{
  const [summary,ledger,accounts,payouts,events]=await Promise.all([
    financials(req.user.id),
    q(`SELECT id,exchange_id AS "exchangeId",source_record_id AS "sourceRecordId",
              fee_amount::float8 AS "feeAmount",cashback_amount::float8 AS "cashbackAmount",
              status,occurred_at AS "occurredAt",created_at AS "createdAt"
       FROM feeloop.fee_records WHERE user_id=$1 ORDER BY occurred_at DESC LIMIT 500`,[req.user.id]),
    q(`SELECT id,exchange_id AS "exchangeId",uid,status,created_at AS "createdAt",updated_at AS "updatedAt"
       FROM feeloop.exchange_accounts WHERE user_id=$1 ORDER BY created_at DESC`,[req.user.id]),
    q(`SELECT id,amount::float8 AS amount,method,destination,status,payment_ref AS "paymentRef",
              created_at AS "createdAt",updated_at AS "updatedAt"
       FROM feeloop.payouts WHERE user_id=$1 ORDER BY created_at DESC LIMIT 200`,[req.user.id]),
    q(`SELECT id,exchange_id AS "exchangeId",title,type,summary,start_at AS "startAt",end_at AS "endAt",
              reward,region,source_url AS "sourceUrl",status,created_at AS "createdAt"
       FROM feeloop.events WHERE status='published'
       AND (start_at IS NULL OR start_at<=NOW())
       AND (end_at IS NULL OR end_at>=NOW())
       ORDER BY start_at DESC NULLS LAST,created_at DESC LIMIT 5`)
  ]);
  res.json({user:publicUser(req.user),summary,ledger:ledger.rows,accounts:accounts.rows,payouts:payouts.rows,events:events.rows});
});

app.get("/api/exchange-accounts",requireAuth,async(req,res)=>{
  const r=await q(`SELECT id,exchange_id AS "exchangeId",uid,status,created_at AS "createdAt",updated_at AS "updatedAt"
                   FROM feeloop.exchange_accounts WHERE user_id=$1 ORDER BY created_at DESC`,[req.user.id]);
  res.json({accounts:r.rows});
});
app.post("/api/exchange-accounts",requireAuth,async(req,res)=>{
  const exchangeId=String(req.body.exchangeId||"");
  const uid=String(req.body.uid||"").trim();
  const e=await q("SELECT id FROM feeloop.exchange_configs WHERE id=$1 AND enabled=TRUE",[exchangeId]);
  if(!e.rows.length) return res.status(400).json({error:"INVALID_EXCHANGE"});
  if(!uid||uid.length>100) return res.status(400).json({error:"INVALID_UID"});
  const account={id:id("exa"),userId:req.user.id,exchangeId,uid};
  try{
    const r=await q(
      `INSERT INTO feeloop.exchange_accounts(id,user_id,exchange_id,uid,status,created_at,updated_at)
       VALUES($1,$2,$3,$4,'pending',NOW(),NOW())
       RETURNING id,user_id AS "userId",exchange_id AS "exchangeId",uid,status,created_at AS "createdAt",updated_at AS "updatedAt"`,
      [account.id,account.userId,exchangeId,uid]
    );
    await audit(req.user.id,"EXCHANGE_UID_ADDED",account.id,{exchangeId,uid});
    res.status(201).json({account:r.rows[0]});
  }catch(err){
    if(err.code==="23505") return res.status(409).json({error:"UID_ALREADY_REGISTERED"});
    throw err;
  }
});
app.delete("/api/exchange-accounts/:id",requireAuth,async(req,res)=>{
  const r=await q("DELETE FROM feeloop.exchange_accounts WHERE id=$1 AND user_id=$2 RETURNING id,exchange_id,uid",[req.params.id,req.user.id]);
  if(!r.rows.length) return res.status(404).json({error:"NOT_FOUND"});
  await audit(req.user.id,"EXCHANGE_UID_REMOVED",req.params.id,{exchangeId:r.rows[0].exchange_id,uid:r.rows[0].uid});
  res.json({ok:true});
});

app.get("/api/payouts",requireAuth,async(req,res)=>{
  const r=await q(`SELECT id,amount::float8 AS amount,method,destination,status,payment_ref AS "paymentRef",
                          created_at AS "createdAt",updated_at AS "updatedAt"
                   FROM feeloop.payouts WHERE user_id=$1 ORDER BY created_at DESC`,[req.user.id]);
  res.json({payouts:r.rows});
});
app.post("/api/payouts",requireAuth,async(req,res)=>{
  const amount=moneyRound(req.body.amount);
  const method=String(req.body.method||"").trim();
  const destination=String(req.body.destination||"").trim();
  if(amount<=0) return res.status(400).json({error:"INVALID_AMOUNT"});
  if(!["exchange_uid","wallet"].includes(method)) return res.status(400).json({error:"INVALID_METHOD"});
  if(!destination||destination.length>250) return res.status(400).json({error:"INVALID_DESTINATION"});
  const payout=await tx(async c=>{
    await c.query("SELECT pg_advisory_xact_lock(hashtext($1))",[req.user.id]);
    const fin=await financials(req.user.id,c);
    if(amount>fin.available){
      const err=new Error("INSUFFICIENT_AVAILABLE_BALANCE");err.code="BALANCE";err.available=fin.available;throw err;
    }
    const payoutId=id("pay");
    const r=await c.query(
      `INSERT INTO feeloop.payouts(id,user_id,amount,method,destination,status,created_at,updated_at)
       VALUES($1,$2,$3,$4,$5,'pending',NOW(),NOW())
       RETURNING id,amount::float8 AS amount,method,destination,status,created_at AS "createdAt"`,
      [payoutId,req.user.id,amount,method,destination]
    );
    return r.rows[0];
  }).catch(err=>{
    if(err.code==="BALANCE") return {__error:"INSUFFICIENT_AVAILABLE_BALANCE",available:err.available};
    throw err;
  });
  if(payout.__error) return res.status(400).json({error:payout.__error,available:payout.available});
  await audit(req.user.id,"PAYOUT_REQUESTED",payout.id,{amount,method});
  res.status(201).json({payout});
});

app.get("/api/events",async(req,res)=>{
  const r=await q(
    `SELECT id,exchange_id AS "exchangeId",title,type,summary,start_at AS "startAt",end_at AS "endAt",
            reward,region,source_url AS "sourceUrl",status,created_at AS "createdAt"
     FROM feeloop.events WHERE status='published'
     AND (start_at IS NULL OR start_at<=NOW())
     AND (end_at IS NULL OR end_at>=NOW())
     ORDER BY start_at DESC NULLS LAST,created_at DESC`
  );
  res.json({events:r.rows});
});
app.get("/api/events/:id",async(req,res)=>{
  const r=await q(
    `SELECT id,exchange_id AS "exchangeId",title,type,summary,start_at AS "startAt",end_at AS "endAt",
            reward,region,source_url AS "sourceUrl",status,created_at AS "createdAt"
     FROM feeloop.events WHERE id=$1 AND status='published' LIMIT 1`,[req.params.id]
  );
  if(!r.rows.length) return res.status(404).json({error:"NOT_FOUND"});
  res.json({event:r.rows[0]});
});

app.get("/api/admin/overview",requireAdmin,async(req,res)=>{
  const [metrics,payouts,accounts,exchanges,events,audits]=await Promise.all([
    q(`SELECT
        (SELECT COUNT(*) FROM feeloop.users WHERE role='user')::int AS users,
        (SELECT COUNT(*) FROM feeloop.payouts WHERE status IN ('pending','processing'))::int AS pending_payouts,
        (SELECT COALESCE(SUM(amount),0)::float8 FROM feeloop.payouts WHERE status IN ('pending','processing')) AS pending_amount,
        (SELECT COALESCE(SUM(commission_amount),0)::float8 FROM feeloop.fee_records) AS gross_commission,
        (SELECT GREATEST(COALESCE(SUM(commission_amount-cashback_amount),0),0)::float8 FROM feeloop.fee_records) AS platform_margin`),
    q(`SELECT id,user_id AS "userId",amount::float8 AS amount,method,destination,status,payment_ref AS "paymentRef",
              created_at AS "createdAt",updated_at AS "updatedAt"
       FROM feeloop.payouts ORDER BY created_at DESC LIMIT 100`),
    q(`SELECT id,user_id AS "userId",exchange_id AS "exchangeId",uid,status,
              created_at AS "createdAt",updated_at AS "updatedAt"
       FROM feeloop.exchange_accounts ORDER BY created_at DESC LIMIT 100`),
    q(`SELECT id,name,short,enabled,cashback_rate::float8 AS "cashbackRate",
              partner_commission_rate::float8 AS "partnerCommissionRate",
              maker_fee::float8 AS "makerFee",taker_fee::float8 AS "takerFee",
              connector_status AS "connectorStatus"
       FROM feeloop.exchange_configs ORDER BY name`),
    q(`SELECT id,exchange_id AS "exchangeId",title,type,summary,start_at AS "startAt",end_at AS "endAt",
              reward,region,source_url AS "sourceUrl",status,created_at AS "createdAt",updated_at AS "updatedAt"
       FROM feeloop.events ORDER BY created_at DESC LIMIT 100`),
    q(`SELECT id,actor_id AS "actorId",action,target,meta,created_at AS "createdAt"
       FROM feeloop.audit_logs ORDER BY created_at DESC LIMIT 100`)
  ]);
  const m=metrics.rows[0];
  res.json({
    metrics:{
      pendingPayouts:m.pending_payouts,pendingAmount:numeric(m.pending_amount),users:m.users,
      grossCommission:numeric(m.gross_commission),platformMargin:numeric(m.platform_margin)
    },
    payouts:payouts.rows,exchangeAccounts:accounts.rows,exchanges:exchanges.rows,events:events.rows,audit:audits.rows
  });
});

app.get("/api/admin/users",requireAdmin,async(req,res)=>{
  const search=String(req.query.q||"").trim();
  const r=await q(
    `SELECT u.id,u.email,u.role,u.country,u.email_verified,u.mfa_enabled,u.created_at,
       COALESCE(f.total_fees,0)::float8 AS total_fees,
       COALESCE(f.accrued,0)::float8 AS accrued,
       COALESCE(p.reserved,0)::float8 AS reserved,
       COALESCE(p.paid,0)::float8 AS paid
     FROM feeloop.users u
     LEFT JOIN (
       SELECT user_id,SUM(fee_amount) total_fees,SUM(cashback_amount) accrued
       FROM feeloop.fee_records GROUP BY user_id
     ) f ON f.user_id=u.id
     LEFT JOIN (
       SELECT user_id,
       SUM(amount) FILTER(WHERE status IN ('pending','processing')) reserved,
       SUM(amount) FILTER(WHERE status='paid') paid
       FROM feeloop.payouts GROUP BY user_id
     ) p ON p.user_id=u.id
     WHERE u.role='user' AND ($1='' OR LOWER(u.email) LIKE LOWER('%'||$1||'%'))
     ORDER BY u.created_at DESC LIMIT 250`,[search]
  );
  res.json({users:r.rows.map(u=>({
    id:u.id,email:u.email,role:u.role,country:u.country,emailVerified:u.email_verified,mfaEnabled:u.mfa_enabled,createdAt:u.created_at,
    summary:{
      totalFees:numeric(u.total_fees),accrued:numeric(u.accrued),reserved:numeric(u.reserved),paid:numeric(u.paid),
      available:Math.max(0,numeric(u.accrued)-numeric(u.reserved)-numeric(u.paid))
    }
  }))});
});

app.patch("/api/admin/exchange-accounts/:id",requireAdmin,async(req,res)=>{
  const status=String(req.body.status||"");
  if(!["pending","verified","rejected"].includes(status)) return res.status(400).json({error:"INVALID_STATUS"});
  const r=await q(
    `UPDATE feeloop.exchange_accounts SET status=$1,updated_at=NOW() WHERE id=$2
     RETURNING id,user_id AS "userId",exchange_id AS "exchangeId",uid,status,updated_at AS "updatedAt"`,
    [status,req.params.id]
  );
  if(!r.rows.length) return res.status(404).json({error:"NOT_FOUND"});
  await audit(req.user.id,"EXCHANGE_UID_STATUS",req.params.id,{status});
  res.json({account:r.rows[0]});
});

app.patch("/api/admin/exchanges/:id",requireAdmin,async(req,res)=>{
  const fields={};
  for(const key of ["cashbackRate","partnerCommissionRate","makerFee","takerFee"]){
    if(req.body[key]===undefined) continue;
    if(req.body[key]===""||req.body[key]===null) fields[key]=null;
    else{
      const n=numeric(req.body[key]);
      if(n<0||n>100) return res.status(400).json({error:"INVALID_RATE",field:key});
      fields[key]=n;
    }
  }
  const status=req.body.connectorStatus!==undefined?String(req.body.connectorStatus).slice(0,40):undefined;
  const current=await q("SELECT * FROM feeloop.exchange_configs WHERE id=$1",[req.params.id]);
  if(!current.rows.length) return res.status(404).json({error:"NOT_FOUND"});
  const c=current.rows[0];
  const r=await q(
    `UPDATE feeloop.exchange_configs SET
      cashback_rate=$1,partner_commission_rate=$2,maker_fee=$3,taker_fee=$4,connector_status=$5,updated_at=NOW()
     WHERE id=$6
     RETURNING id,name,short,enabled,cashback_rate::float8 AS "cashbackRate",
       partner_commission_rate::float8 AS "partnerCommissionRate",maker_fee::float8 AS "makerFee",
       taker_fee::float8 AS "takerFee",connector_status AS "connectorStatus"`,
    [
      fields.cashbackRate!==undefined?fields.cashbackRate:c.cashback_rate,
      fields.partnerCommissionRate!==undefined?fields.partnerCommissionRate:c.partner_commission_rate,
      fields.makerFee!==undefined?fields.makerFee:c.maker_fee,
      fields.takerFee!==undefined?fields.takerFee:c.taker_fee,
      status!==undefined?status:c.connector_status,
      req.params.id
    ]
  );
  await audit(req.user.id,"EXCHANGE_CONFIG_UPDATED",req.params.id,fields);
  res.json({exchange:r.rows[0]});
});

app.post("/api/admin/fee-records/import",requireAdmin,async(req,res)=>{
  const userId=String(req.body.userId||"");
  const exchangeId=String(req.body.exchangeId||"");
  const sourceRecordId=String(req.body.sourceRecordId||"").trim();
  const feeAmount=moneyRound(req.body.feeAmount);
  const commissionAmount=moneyRound(req.body.commissionAmount);
  const occurredAt=req.body.occurredAt?new Date(req.body.occurredAt):new Date();
  if(!sourceRecordId) return res.status(400).json({error:"SOURCE_ID_REQUIRED"});
  if(!Number.isFinite(occurredAt.getTime())) return res.status(400).json({error:"INVALID_OCCURRED_AT"});
  const [user,ex]=await Promise.all([getUserById(userId),q("SELECT * FROM feeloop.exchange_configs WHERE id=$1",[exchangeId])]);
  if(!user||user.role!=="user") return res.status(400).json({error:"INVALID_USER"});
  if(!ex.rows.length) return res.status(400).json({error:"INVALID_EXCHANGE"});
  const rate=numeric(ex.rows[0].cashback_rate)/100;
  const cashback=Math.min(commissionAmount,Math.max(0,feeAmount*rate));
  const recId=id("fee");
  try{
    const r=await q(
      `INSERT INTO feeloop.fee_records
       (id,user_id,exchange_id,source_record_id,fee_amount,commission_amount,cashback_amount,status,occurred_at,created_at)
       VALUES($1,$2,$3,$4,$5,$6,$7,'eligible',$8,NOW())
       RETURNING id,user_id AS "userId",exchange_id AS "exchangeId",source_record_id AS "sourceRecordId",
         fee_amount::float8 AS "feeAmount",commission_amount::float8 AS "commissionAmount",
         cashback_amount::float8 AS "cashbackAmount",status,occurred_at AS "occurredAt"`,
      [recId,userId,exchangeId,sourceRecordId,feeAmount,commissionAmount,cashback,occurredAt.toISOString()]
    );
    await audit(req.user.id,"FEE_RECORD_IMPORTED",recId,{userId,exchangeId,sourceRecordId});
    res.status(201).json({record:r.rows[0]});
  }catch(err){
    if(err.code==="23505") return res.status(409).json({error:"DUPLICATE_SOURCE_RECORD"});
    throw err;
  }
});

app.patch("/api/admin/payouts/:id",requireAdmin,async(req,res)=>{
  const status=String(req.body.status||"");
  if(!["pending","processing","paid","rejected"].includes(status)) return res.status(400).json({error:"INVALID_STATUS"});
  const paymentRef=String(req.body.paymentRef||"").trim().slice(0,300);
  if(status==="paid"&&!paymentRef) return res.status(400).json({error:"PAYMENT_REFERENCE_REQUIRED"});
  const r=await q(
    `UPDATE feeloop.payouts SET status=$1,payment_ref=CASE WHEN $2='' THEN payment_ref ELSE $2 END,updated_at=NOW()
     WHERE id=$3
     RETURNING id,user_id AS "userId",amount::float8 AS amount,method,destination,status,payment_ref AS "paymentRef",
       created_at AS "createdAt",updated_at AS "updatedAt"`,
    [status,paymentRef,req.params.id]
  );
  if(!r.rows.length) return res.status(404).json({error:"NOT_FOUND"});
  await audit(req.user.id,"PAYOUT_STATUS_UPDATED",req.params.id,{status,paymentRef:paymentRef||null});
  res.json({payout:r.rows[0]});
});

app.get("/api/admin/events",requireAdmin,async(req,res)=>{
  const r=await q(
    `SELECT id,exchange_id AS "exchangeId",title,type,summary,start_at AS "startAt",end_at AS "endAt",
            reward,region,source_url AS "sourceUrl",status,created_at AS "createdAt",updated_at AS "updatedAt"
     FROM feeloop.events ORDER BY created_at DESC`
  );
  res.json({events:r.rows});
});
app.post("/api/admin/events",requireAdmin,async(req,res)=>{
  const title=String(req.body.title||"").trim();
  const exchangeId=String(req.body.exchangeId||"").trim();
  if(!title) return res.status(400).json({error:"INVALID_EVENT"});
  const ex=await q("SELECT id FROM feeloop.exchange_configs WHERE id=$1",[exchangeId]);
  if(!ex.rows.length) return res.status(400).json({error:"INVALID_EXCHANGE"});
  const status=["draft","published","archived"].includes(req.body.status)?req.body.status:"draft";
  const eventId=id("evt");
  const r=await q(
    `INSERT INTO feeloop.events
     (id,exchange_id,title,type,summary,start_at,end_at,reward,region,source_url,status,created_at,updated_at)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW(),NOW())
     RETURNING id,exchange_id AS "exchangeId",title,type,summary,start_at AS "startAt",end_at AS "endAt",
       reward,region,source_url AS "sourceUrl",status,created_at AS "createdAt",updated_at AS "updatedAt"`,
    [
      eventId,exchangeId,title,String(req.body.type||"Promotion").trim().slice(0,80),
      String(req.body.summary||"").trim().slice(0,1000),
      req.body.startAt||null,req.body.endAt||null,
      String(req.body.reward||"").trim().slice(0,300),
      String(req.body.region||"Eligible regions only").trim().slice(0,300),
      safeHttpUrl(req.body.sourceUrl).slice(0,1000),status
    ]
  );
  await audit(req.user.id,"EVENT_CREATED",eventId,{exchangeId,title,status});
  res.status(201).json({event:r.rows[0]});
});
app.patch("/api/admin/events/:id",requireAdmin,async(req,res)=>{
  const current=await q("SELECT * FROM feeloop.events WHERE id=$1",[req.params.id]);
  if(!current.rows.length) return res.status(404).json({error:"NOT_FOUND"});
  const c=current.rows[0];
  const status=req.body.status!==undefined&&["draft","published","archived"].includes(req.body.status)?req.body.status:c.status;
  const r=await q(
    `UPDATE feeloop.events SET title=$1,type=$2,summary=$3,start_at=$4,end_at=$5,reward=$6,region=$7,source_url=$8,status=$9,updated_at=NOW()
     WHERE id=$10
     RETURNING id,exchange_id AS "exchangeId",title,type,summary,start_at AS "startAt",end_at AS "endAt",
       reward,region,source_url AS "sourceUrl",status,created_at AS "createdAt",updated_at AS "updatedAt"`,
    [
      req.body.title!==undefined?String(req.body.title):c.title,
      req.body.type!==undefined?String(req.body.type):c.type,
      req.body.summary!==undefined?String(req.body.summary):c.summary,
      req.body.startAt!==undefined?(req.body.startAt||null):c.start_at,
      req.body.endAt!==undefined?(req.body.endAt||null):c.end_at,
      req.body.reward!==undefined?String(req.body.reward):c.reward,
      req.body.region!==undefined?String(req.body.region):c.region,
      req.body.sourceUrl!==undefined?safeHttpUrl(req.body.sourceUrl):c.source_url,
      status,req.params.id
    ]
  );
  await audit(req.user.id,"EVENT_UPDATED",req.params.id,{status});
  res.json({event:r.rows[0]});
});

app.get("/api/admin/audit",requireAdmin,async(req,res)=>{
  const r=await q(
    `SELECT id,actor_id AS "actorId",action,target,meta,created_at AS "createdAt"
     FROM feeloop.audit_logs ORDER BY created_at DESC LIMIT 500`
  );
  res.json({audit:r.rows});
});
app.get("/api/admin/connectors",requireAdmin,async(req,res)=>{
  const r=await q("SELECT id,connector_status FROM feeloop.exchange_configs ORDER BY id");
  res.json({connectors:r.rows.map(x=>({
    exchangeId:x.id,status:x.connector_status,configured:false,
    capabilities:{uidVerification:false,feeSync:false,eventSync:false,payout:false}
  }))});
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

initDatabase().then(()=>{
  app.listen(PORT,()=>console.log(`FEELOOP ${APP_ENV} listening on :${PORT} using relational postgres storage`));
}).catch(err=>{
  console.error("Startup failed",err);
  process.exit(1);
});
