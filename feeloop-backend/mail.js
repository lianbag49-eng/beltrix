const crypto = require("crypto");

const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const EMAIL_FROM = process.env.EMAIL_FROM || "";

function configured(){ return Boolean(RESEND_API_KEY && EMAIL_FROM); }

async function sendEmail({to,subject,html}){
  if(!configured()) return {sent:false,reason:"provider_not_configured"};
  const res=await fetch("https://api.resend.com/emails",{
    method:"POST",
    headers:{
      "Authorization":"Bearer "+RESEND_API_KEY,
      "Content-Type":"application/json"
    },
    body:JSON.stringify({from:EMAIL_FROM,to:[to],subject,html})
  });
  if(!res.ok) throw new Error("EMAIL_PROVIDER_ERROR");
  return {sent:true};
}

function verificationEmail({origin,token}){
  const url=origin+"/verify-email.html?token="+encodeURIComponent(token);
  return {
    subject:"Verify your FEELOOP email",
    html:`<p>Verify your FEELOOP email address.</p><p><a href="${url}">Verify email</a></p><p>If you did not create this account, ignore this message.</p>`
  };
}

function passwordResetEmail({origin,token}){
  const url=origin+"/reset-password.html?token="+encodeURIComponent(token);
  return {
    subject:"Reset your FEELOOP password",
    html:`<p>A password reset was requested for your FEELOOP account.</p><p><a href="${url}">Reset password</a></p><p>This link expires in 30 minutes.</p>`
  };
}

module.exports={configured,sendEmail,verificationEmail,passwordResetEmail};
