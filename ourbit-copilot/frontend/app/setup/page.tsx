'use client';
import {useState,FormEvent} from 'react';
export default function Setup(){
  const [message,setMessage]=useState('');const [busy,setBusy]=useState(false);
  async function setup(e:FormEvent<HTMLFormElement>){
    e.preventDefault();setBusy(true);const data=new FormData(e.currentTarget);
    try{
      const response=await fetch('/api/auth/bootstrap',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:data.get('email'),name:data.get('name'),password:data.get('password'),token:data.get('token')})});
      const body=await response.json();if(!response.ok)throw Error(typeof body.detail==='string'?body.detail:'입력 내용을 확인하세요.');
      window.location.href='/';
    }catch(error){setMessage(error instanceof Error?error.message:'설정에 실패했습니다.');}finally{setBusy(false);}
  }
  return <main className="login"><div className="login-panel"><div className="login-brand"><span className="mark">o</span>Ourbit</div><h1>워크룸 초기 설정</h1><p>첫 관리자 계정을 등록합니다. 초기 설정 코드는 관리자가 Render의 비밀 변수에서 확인하세요.</p><form onSubmit={setup}><label>초기 설정 코드<input name="token" type="password" autoComplete="off" required maxLength={256}/></label><label>이름<input name="name" autoComplete="name" required maxLength={80}/></label><label>직원 이메일<input name="email" type="email" autoComplete="username" required maxLength={254}/></label><label>비밀번호 (14자 이상)<input name="password" type="password" autoComplete="new-password" required minLength={14} maxLength={256}/></label><button className="primary" disabled={busy}>{busy?'설정 중…':'첫 관리자 등록'}</button></form>{message&&<p className="error" role="alert">{message}</p>}<a href="/">로그인 화면으로</a></div></main>;
}
