'use client';
import {FormEvent,useState} from 'react';
export default function StaffForm({done}:{done:()=>void}){
 const [message,setMessage]=useState('');const [busy,setBusy]=useState(false);
 async function save(e:FormEvent<HTMLFormElement>){
  e.preventDefault();setBusy(true);setMessage('');const form=e.currentTarget;const data=new FormData(form);
  try{
   const response=await fetch('/api/users/'+data.get('slot'),{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({email:data.get('email'),name:data.get('name'),password:data.get('password'),role:data.get('role'),telegram_id:data.get('telegram')?Number(data.get('telegram')):null})});
   const result=await response.json();if(!response.ok)throw Error(typeof result.detail==='string'?result.detail:'입력을 확인하세요.');
   form.reset();setMessage('직원 계정을 저장하고 이전 로그인 세션을 해제했습니다.');done();
  }catch(error){setMessage(error instanceof Error?error.message:'저장에 실패했습니다.');}finally{setBusy(false);}
 }
 return <section className="staff"><h2>직원 계정 관리</h2><p className="muted small">슬롯에 등록하면 해당 직원의 계정 정보가 갱신됩니다. 첫 관리자는 슬롯 1입니다.</p><form onSubmit={save}><div className="form-row"><label>직원 슬롯<select name="slot" defaultValue="2"><option value="1">1</option><option value="2">2</option><option value="3">3</option></select></label><label>권한<select name="role"><option value="analyst">담당자</option><option value="reviewer">검토자</option><option value="admin">관리자</option></select></label></div><div className="form-row"><label>이름<input name="name" required maxLength={80}/></label><label>이메일<input name="email" type="email" autoComplete="off" required maxLength={254}/></label></div><div className="form-row"><label>새 비밀번호<input name="password" type="password" autoComplete="new-password" required minLength={14} maxLength={256}/></label><label>Telegram 사용자 ID (선택)<input name="telegram" type="number" min="1" step="1"/></label></div><button className="primary" disabled={busy}>{busy?'저장 중…':'직원 계정 저장'}</button></form>{message&&<p role="status">{message}</p>}</section>;
}
