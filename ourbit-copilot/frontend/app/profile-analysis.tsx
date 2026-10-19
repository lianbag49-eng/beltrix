'use client';
import {useState} from 'react';
export type AI = {label:string;notice:string;evidence:{title:string;url:string;published_at:string}[]};
export default function ProfileAnalysis({kolId,initial}:{kolId:number;initial?:AI}){
 const [result,setResult]=useState(initial);const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 async function analyze(){setBusy(true);setError('');try{const response=await fetch(`/api/kols/${kolId}/analyze`,{method:'POST',headers:{'content-type':'application/json'},body:'{}'});const data=await response.json();if(!response.ok)throw Error(typeof data.detail==='string'?data.detail:'분석을 완료하지 못했습니다.');setResult(data.analysis.ai);}catch(e){setError(e instanceof Error?e.message:'분석 오류');}finally{setBusy(false);}}
 return <section><h3>AI 콘텐츠 분석</h3>{result&&<><p>{result.label}</p><p className="muted small">{result.notice}</p>{result.evidence.map(v=><a className="video" href={v.url} key={v.url} target="_blank" rel="noreferrer">근거 영상: {v.title}</a>)}</>}<button disabled={busy} onClick={analyze}>{busy?'분석 중…':'출처 기반 AI 분석'}</button>{error&&<p className="error" role="alert">{error}</p>}</section>;
}
