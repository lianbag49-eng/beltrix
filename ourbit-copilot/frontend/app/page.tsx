'use client';

import {FormEvent, useCallback, useEffect, useState} from 'react';
import StaffForm from './staff-form';
import ProfileAnalysis from './profile-analysis';

type User = {id:number; name:string; role:'admin'|'reviewer'|'analyst'};
type KOL = {id:number; channel_id:string; title:string; description:string; subscribers:number|null; source_url:string; latest_published_at:string|null; verified_at:string; videos:{title:string;url:string;published_at:string}[]; analysis:{method:string;topics:string[];freshness:string;limitations:string[]};owner_id:number|null;stage:string;notes:string};
type Proposal = {id:number;kol_id:number;author_id:number;body:string;generator:string;status:string;version:number;review_note:string;created_at:string};
type Integrations = {youtube:boolean;telegram:boolean;ai:boolean};
type History = {id:number;query:string;created_at:string;result:{created:number;duplicates:number}};
type Audit = {id:number;actor_id:number|null;action:string;target:string;created_at:string};
const stages:Record<string,string> = {new:'새 후보',researching:'검토 중',contacted:'연락 완료',negotiating:'협의 중',closed:'종료'};
const statusName:Record<string,string> = {pending:'검토 대기',approved:'승인됨',rejected:'반려됨'};
const date = (value:string|null) => value ? new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',dateStyle:'medium'}).format(new Date(value)) : '확인 불가';

async function api<T>(path:string, body?:unknown, method?:string):Promise<T> {
  const response = await fetch('/api/'+path,{method:method || (body ? 'POST':'GET'),credentials:'same-origin',headers:{'content-type':'application/json'},body:body ? JSON.stringify(body):undefined});
  const data = await response.json();
  if (!response.ok) throw new Error(typeof data.detail === 'string' ? data.detail : '입력 내용을 확인하세요.');
  return data as T;
}

export default function Workroom() {
  const [user,setUser] = useState<User|null>(null);
  const [loading,setLoading] = useState(true);
  const [busy,setBusy] = useState(false);
  const [message,setMessage] = useState('');
  const [error,setError] = useState('');
  const [view,setView] = useState('discovery');
  const [kols,setKols] = useState<KOL[]>([]);
  const [selected,setSelected] = useState<number|null>(null);
  const [proposals,setProposals] = useState<Proposal[]>([]);
  const [users,setUsers] = useState<User[]>([]);
  const [integrations,setIntegrations] = useState<Integrations|null>(null);
  const [history,setHistory] = useState<History[]>([]);
  const [audits,setAudits] = useState<Audit[]>([]);
  const [query,setQuery] = useState('');
  const [filter,setFilter] = useState('');
  const [offset,setOffset] = useState(0);

  const refresh = useCallback(async () => {
    const [ks,ps,us,ins,hs] = await Promise.all([api<KOL[]>('kols?offset='+offset),api<Proposal[]>('proposals'),api<User[]>('users'),api<Integrations>('integrations'),api<History[]>('discoveries')]);
    setKols(ks);setProposals(ps);setUsers(us);setIntegrations(ins);setHistory(hs);
  },[offset]);
  useEffect(()=>{api<User>('auth/me').then(setUser).catch(()=>{}).finally(()=>setLoading(false));},[]);
  useEffect(()=>{if(user) refresh().catch(e=>setError(e.message));},[user,refresh]);
  useEffect(()=>{if(user && view==='audit') api<Audit[]>('audit').then(setAudits).catch(e=>setError(e.message));},[user,view]);

  async function action(work:()=>Promise<void>) {
    setBusy(true);setError('');setMessage('');
    try {await work();} catch(e) {setError(e instanceof Error ? e.message:'처리하지 못했습니다.');}
    finally {setBusy(false);}
  }

  async function login(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();const data=new FormData(event.currentTarget);
    await action(async()=>{setUser(await api<User>('auth/login',{email:data.get('email'),password:data.get('password')}));});
  }
  async function search(event:FormEvent) {
    event.preventDefault();
    await action(async()=>{const result=await api<{created:number;duplicates:number;ids:number[]}>('discovery',{query});await refresh();setSelected(result.ids[0] ?? null);setMessage(`새 후보 ${result.created}명 저장 · 중복 ${result.duplicates}명 정보 갱신`);});
  }
  const kol = kols.find(k=>k.id===selected);
  const canReview = user?.role==='admin' || user?.role==='reviewer';
  const shown = kols.filter(k=>k.title.toLowerCase().includes(filter.toLowerCase()));

  if(loading) return <main className="login"><p role="status">워크룸을 열고 있습니다.</p></main>;
  if(!user) return <main className="login"><div className="login-brand"><span className="mark">o</span><span>Ourbit</span></div><div className="login-panel"><p className="muted">BD 워크룸</p><h1>다음 파트너를<br/>함께 발견하세요.</h1><p>KOL 발굴부터 제안 검토까지, 세 사람의 업무를 한곳에서 이어갑니다.</p><form onSubmit={login}><label>직원 이메일<input name="email" type="email" autoComplete="username" required/></label><label>비밀번호<input name="password" type="password" autoComplete="current-password" required maxLength={256}/></label><button className="primary" disabled={busy}>{busy?'로그인 중…':'워크룸 로그인'}</button></form>{error && <p className="error" role="alert">{error}</p>}<p className="muted small">등록된 직원 전용 · 계정 발급은 관리자에게 요청하세요.</p></div></main>;

  return <div className="shell">
    <aside className="sidebar"><a className="brand" href="/"><span className="mark">o</span>Ourbit</a><p className="workspace-label">BD 워크룸</p><nav aria-label="주 메뉴">{[['discovery','KOL 발굴'],['review','제안문 검토'],['history','발굴 기록'],['settings','연결 상태'],...(canReview?[['audit','활동 기록']]:[])].map(([id,label])=><button key={id} aria-current={view===id?'page':undefined} className={view===id?'nav active':'nav'} onClick={()=>{setView(id);setSelected(null);setError('');}}>{label}{id==='review'&&<span className="count">{proposals.filter(p=>p.status==='pending').length}</span>}</button>)}</nav><div className="sidebar-footer"><span className="avatar">{user.name.slice(0,1)}</span><div><strong>{user.name}</strong><p>{user.role==='analyst'?'담당자':user.role==='admin'?'관리자':'검토자'}</p></div><button className="text-button" onClick={()=>action(async()=>{await api('auth/logout',{});setUser(null);setKols([]);setProposals([]);})}>로그아웃</button></div></aside>
    <main className="main"><header className="topbar"><span>파트너십 리서치</span><span className="manual"><i/>검토 후 수동 발송</span></header>
      {message&&<div className="notice" role="status">{message}</div>}{error&&<div className="error notice" role="alert">{error}</div>}
      {view==='discovery'&&<><div className="page-heading"><div><h1>KOL 발굴</h1><p>공개 채널에서 후보를 찾고, 근거를 확인한 뒤 제안을 준비하세요.</p></div><span className="page-number">YouTube 리서치</span></div>
        <form className="search-box" onSubmit={search}><label htmlFor="discover">어떤 크리에이터를 찾고 있나요?</label><div className="search-row"><input id="discover" value={query} onChange={e=>setQuery(e.target.value)} placeholder="예: 비트코인 교육, 크립토 트레이딩" minLength={2} maxLength={100} required/><button className="primary" disabled={busy||!integrations?.youtube}>{busy?'공개 채널 확인 중…':'후보 자동 발굴'}</button></div><p className="small muted">검색 상위 최대 5개 채널 · 출처와 공개 업로드 확인 · 채널 ID로 중복 검증</p>{integrations&&!integrations.youtube&&<p className="connection-needed">YouTube 연결이 필요합니다. ‘연결 상태’에서 필요한 설정을 확인하세요.</p>}</form>
        <div className="section-title"><h2>후보 목록 <span>{kols.length}</span></h2><input className="filter" aria-label="저장된 후보 검색" value={filter} onChange={e=>setFilter(e.target.value)} placeholder="현재 목록에서 검색"/></div>
        <div className={kol?'research-grid open':'research-grid'}><section className="table-wrap" aria-label="KOL 후보 목록"><table><thead><tr><th>크리에이터</th><th>공개 구독자</th><th>최근 게시</th><th>진행 상태</th></tr></thead><tbody>{shown.map(k=><tr key={k.id} className={selected===k.id?'selected':''}><td><button className="kol-link" onClick={()=>setSelected(k.id)}><span className="channel-avatar">{k.title.slice(0,1)}</span><span><strong>{k.title}</strong><small>{k.analysis.topics.join(', ')||'주제 확인 필요'}</small></span></button></td><td>{k.subscribers===null?'비공개 / 미확인':k.subscribers.toLocaleString('ko-KR')}</td><td>{date(k.latest_published_at)}<small className={k.analysis.freshness==='recent'?'fresh':'muted'}>{k.analysis.freshness==='recent'?'30일 내 게시':k.analysis.freshness==='unknown'?'공개 영상 미확인':'활동 재확인 필요'}</small></td><td><span className="pill">{stages[k.stage]}</span></td></tr>)}</tbody></table>{shown.length===0&&<div className="empty"><span className="empty-symbol">◎</span><h3>확인할 후보를 모아보세요.</h3><p>위에 검색어를 입력하면 공개 채널의 출처와<br/>최근 활동을 함께 정리합니다.</p></div>}<div className="pagination"><button disabled={busy||offset===0} onClick={()=>{setOffset(Math.max(0,offset-100));setSelected(null);}}>이전</button><span>{offset+1}부터 최대 100개</span><button disabled={busy||kols.length<100} onClick={()=>{setOffset(offset+100);setSelected(null);}}>다음</button></div></section>
          {kol&&<KOLDetail key={kol.id} kol={kol} users={users} busy={busy} close={()=>setSelected(null)} save={data=>action(async()=>{await api('kols/'+kol.id,data,'PATCH');await refresh();setMessage('담당자와 진행 상태를 저장했습니다.');})} generate={()=>action(async()=>{await api('kols/'+kol.id+'/proposals',{});await refresh();setView('review');setMessage('제안문을 만들었습니다. 다른 직원의 검토를 요청하세요.');})}/>}</div></>}
      {view==='review'&&<><div className="page-heading"><div><h1>제안문 검토</h1><p>다른 직원의 검토를 거친 문구를 복사해 기존 계정에서 직접 발송하세요.</p></div></div><div className="review-list">{proposals.length===0&&<div className="empty"><h3>아직 제안문이 없습니다.</h3><p>KOL 상세 화면에서 제안문을 준비하세요.</p></div>}{proposals.map(p=><article className="proposal" key={p.id}><header><div><span className={'pill '+p.status}>{statusName[p.status]}</span><h2>{kols.find(k=>k.id===p.kol_id)?.title||`KOL #${p.kol_id}`}</h2></div><span className="muted small">{date(p.created_at)} · 작성 {users.find(u=>u.id===p.author_id)?.name||'직원'}</span></header><p className="proposal-body">{p.body}</p><p className="muted small">생성 방식: {p.generator==='gemini-intent-v1'?'AI가 협업 유형을 선택한 검증 문구':'기본 검증 문구 · AI 연결 전'}</p>{p.review_note&&<p className="review-note">검토 메모: {p.review_note}</p>}<footer>{p.status==='pending'&&canReview&&p.author_id!==user.id&&<><button className="primary" disabled={busy} onClick={()=>action(async()=>{await api(`proposals/${p.id}/review`,{version:p.version,decision:'approved'});await refresh();setMessage('제안문을 승인했습니다.');})}>승인</button><button disabled={busy} onClick={()=>action(async()=>{await api(`proposals/${p.id}/review`,{version:p.version,decision:'rejected'});await refresh();setMessage('반려했습니다. 새 제안문을 준비하세요.');})}>반려</button></>}{p.status==='pending'&&p.author_id===user.id&&<span className="muted small">다른 검토자의 승인이 필요합니다.</span>}{p.status==='approved'&&<button className="primary" disabled={busy} onClick={()=>action(async()=>{const result=await api<{body:string}>(`proposals/${p.id}/copy`,{});await navigator.clipboard.writeText(result.body);setMessage('승인 문구를 복사했습니다. 기존 계정에서 수동 발송하세요.');})}>승인 문구 복사</button>}</footer></article>)}</div></>}
      {view==='history'&&<><div className="page-heading"><div><h1>발굴 기록</h1><p>검색 결과의 신규 저장과 중복 갱신 내역을 확인하세요.</p></div></div><section className="table-wrap"><table><thead><tr><th>검색어</th><th>확인일</th><th>신규</th><th>중복 갱신</th></tr></thead><tbody>{history.map(h=><tr key={h.id}><td>{h.query}</td><td>{date(h.created_at)}</td><td>{h.result.created}</td><td>{h.result.duplicates}</td></tr>)}</tbody></table>{!history.length&&<div className="empty"><p>발굴 후 검색 이력이 표시됩니다.</p></div>}</section></>}
      {view==='settings'&&<><div className="page-heading"><div><h1>연결 상태</h1><p>연결 여부는 설정 등록 상태입니다. 실제 호출 결과는 각 기능에서 확인하세요.</p></div></div><section className="connections">{[['YouTube 공개 채널',integrations?.youtube,'관리자가 YouTube Data API 키를 비밀 변수로 등록해야 합니다.'],['내부 Telegram 봇',integrations?.telegram,'봇 토큰·웹훅 비밀값과 직원 Telegram ID 등록이 필요합니다.'],['AI 제안 유형 선택',integrations?.ai,'Gemini 키와 모델을 등록하면 AI가 검증된 협업 문구 유형을 선택합니다.']].map(([title,connected,help])=><article key={String(title)}><div><h2>{String(title)}</h2><p>{String(help)}</p></div><span className={'pill '+(connected?'approved':'')}>{connected?'설정 등록됨':'연결 필요'}</span></article>)}<p className="connection-policy">요율·이벤트·연동 일정이 포함되지 않은 기본 문구만 제공합니다. 제안은 직원의 검토 후 수동 발송합니다.</p></section></>}
      {view==='audit'&&<><div className="page-heading"><div><h1>활동 기록</h1><p>로그인, 발굴, 승인, 문구 복사 기록을 확인하세요.</p></div></div><section className="table-wrap"><table><thead><tr><th>일자</th><th>직원</th><th>작업</th><th>대상</th></tr></thead><tbody>{audits.map(a=><tr key={a.id}><td>{date(a.created_at)}</td><td>{users.find(u=>u.id===a.actor_id)?.name||'시스템'}</td><td>{a.action}</td><td>{a.target}</td></tr>)}</tbody></table></section></>}
      {view==='settings'&&user.role==='admin'&&<StaffForm done={()=>refresh().catch(e=>setError(e.message))}/>}
      <footer className="main-footer">공개 데이터 기반 리서치 · 미확인 정보는 직접 검토하세요.</footer>
    </main>
  </div>;
}

function KOLDetail({kol,users,busy,close,save,generate}:{kol:KOL;users:User[];busy:boolean;close:()=>void;save:(data:unknown)=>Promise<void>;generate:()=>Promise<void>}) {
  const [stage,setStage]=useState(kol.stage);
  const [owner,setOwner]=useState(kol.owner_id?.toString()||'');
  const [notes,setNotes]=useState(kol.notes);
  return <aside className="detail" aria-label="KOL 상세"><header><span className="pill">출처 확인 {date(kol.verified_at)}</span><button aria-label="상세 닫기" onClick={close}>닫기</button></header><h2>{kol.title}</h2><a href={kol.source_url} target="_blank" rel="noreferrer">YouTube 원본 채널 열기</a><p className="description">{kol.description||'공개 채널 설명이 없습니다.'}</p><h3>프로필 분석</h3><p>{kol.analysis.method}</p><div className="tags">{kol.analysis.topics.map(t=><span className="pill" key={t}>{t}</span>)}</div><ul className="limitations">{kol.analysis.limitations.map(t=><li key={t}>{t}</li>)}</ul><ProfileAnalysis kolId={kol.id}/><h3>최근 공개 영상</h3>{kol.videos.length?kol.videos.slice(0,3).map(v=><a className="video" key={v.url} href={v.url} target="_blank" rel="noreferrer">{v.title}<small>{date(v.published_at)}</small></a>):<p className="muted">확인 가능한 공개 영상이 없습니다.</p>}<form onSubmit={e=>{e.preventDefault();save({stage,owner_id:owner?Number(owner):null,notes});}}><div className="form-row"><label>담당자<select value={owner} onChange={e=>setOwner(e.target.value)}><option value="">미지정</option>{users.map(u=><option value={u.id} key={u.id}>{u.name}</option>)}</select></label><label>진행 상태<select value={stage} onChange={e=>setStage(e.target.value)}>{Object.entries(stages).map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label></div><label>내부 메모<textarea value={notes} onChange={e=>setNotes(e.target.value)} maxLength={5000} rows={3}/></label><button disabled={busy}>업무 정보 저장</button></form><button className="primary wide" disabled={busy} onClick={generate}>검토용 제안문 준비</button></aside>;
}
