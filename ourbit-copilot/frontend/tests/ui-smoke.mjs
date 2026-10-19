import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
import {cp} from 'node:fs/promises';

await cp('.next/static','.next/standalone/.next/static',{recursive:true});
const server=spawn('node',['.next/standalone/server.js'],{stdio:'inherit',env:{...process.env,PORT:'3100',HOSTNAME:'127.0.0.1'}});
let browser;
try{
 for(let i=0;i<60;i++){
  try{if((await fetch('http://127.0.0.1:3100')).ok)break;}catch{}
  await new Promise(resolve=>setTimeout(resolve,500));
 }
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 for(const width of [390,1280]){
  const page=await browser.newPage({viewport:{width,height:900}});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  let loggedIn=false;
  const stamp=new Date().toISOString();
  const user={id:3,name:'테스트 담당자',role:'analyst'};
  const kol={id:1,channel_id:'UC_TEST',title:'테스트 교육 채널',description:'공개 프로필 테스트',subscribers:null,source_url:'https://www.youtube.com/channel/UC_TEST',latest_published_at:null,verified_at:stamp,videos:[],analysis:{method:'공개 텍스트 키워드 분석',topics:['비트코인'],freshness:'unknown',limitations:['검토용 데이터']},stage:'new',notes:'',owner_id:null};
  await page.route('**/api/**',async route=>{
   const path=new URL(route.request().url()).pathname;
   const responses={
    '/api/auth/me':loggedIn?user:{detail:'로그인이 필요합니다.'},
    '/api/auth/login':user,
    '/api/kols':[kol],'/api/proposals':[], '/api/users':[user],
    '/api/integrations':{youtube:false,telegram:false,ai:false},'/api/discoveries':[]
   };
   if(path==='/api/auth/login')loggedIn=true;
   await route.fulfill({status:path==='/api/auth/me'&&!loggedIn?401:200,contentType:'application/json',body:JSON.stringify(responses[path]||{})});
  });
  await page.goto('http://127.0.0.1:3100');
  await page.getByRole('button',{name:'워크룸 로그인'}).waitFor();
  await page.getByLabel('직원 이메일').fill('fixture@example.test');
  await page.getByLabel('비밀번호',{exact:true}).fill('fixture-password-only');
  await page.getByRole('button',{name:'워크룸 로그인'}).click();
  await page.getByRole('heading',{name:'KOL 발굴',exact:true}).waitFor();
  await page.getByRole('button',{name:/테스트 교육 채널/}).click();
  await page.getByRole('complementary',{name:'KOL 상세'}).waitFor();
  await page.getByRole('button',{name:'검토용 제안문 준비'}).waitFor();
  assert(await page.getByText('비공개 / 미확인',{exact:true}).isVisible());
  assert(await page.getByText('확인 불가',{exact:true}).isVisible());
  assert(await page.getByRole('button',{name:'후보 자동 발굴'}).isDisabled());
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'Viewport overflow');
  await page.getByRole('button',{name:'제안문 검토',exact:false}).click();
  await page.getByText('아직 제안문이 없습니다.').waitFor();
  assert.deepEqual(errors,[]);
  console.log(`UI_SMOKE_PASS: ${width}px login, CRM, KOL details, hidden metrics, approval view, no JS errors`);
  await page.close();
 }
}finally{await browser?.close();server.kill('SIGTERM');}
