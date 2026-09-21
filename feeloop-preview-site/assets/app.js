
const FeeLoop = (() => {
  const EXCHANGES = [
    {id:"bingx",name:"BingX",short:"BX",status:"Partner API pending",maker:"TBD",taker:"TBD",cashback:"TBD",tone:"blue",
      description:"Exchange connector profile prepared for referral UID verification, eligible-fee sync and payout reconciliation."},
    {id:"toobit",name:"Toobit",short:"TB",status:"Partner API pending",maker:"TBD",taker:"TBD",cashback:"TBD",tone:"blue",
      description:"One-level referral adapter reserved. Final cashback rules will be published only after partner terms are verified."},
    {id:"bitget",name:"Bitget",short:"BG",status:"Partner API pending",maker:"TBD",taker:"TBD",cashback:"TBD",tone:"blue",
      description:"Designed for UID mapping, source-level commission records and auditable cashback ledger entries."},
    {id:"coinw",name:"CoinW",short:"CW",status:"Partner API pending",maker:"TBD",taker:"TBD",cashback:"TBD",tone:"blue",
      description:"Connector slot prepared for commission ingestion, deduplication and manual payout workflow."}
  ];

  const EVENTS = [
    {id:"bingx-volume-sprint",exchange:"BingX",exchangeId:"bingx",type:"Trading competition",title:"Volume Sprint — UI Preview",
      summary:"Preview of how a verified exchange trading event will be presented inside FEELOOP.",
      period:"Dates pending verification",reward:"Reward details pending",region:"Eligible regions only",status:"Preview",tone:"blue",
      steps:["Open the verified partner event page.","Review region, product and volume eligibility.","Join through the official flow.","Track progress after the data connector is live."],
      terms:["This page is a product UI mock-up, not a live promotion.","Final dates, rewards and eligibility must come from an official exchange or partner source.","Restricted jurisdictions will be hidden or blocked at production launch."]},
    {id:"toobit-deposit-boost",exchange:"Toobit",exchangeId:"toobit",type:"Deposit promotion",title:"Deposit Boost — UI Preview",
      summary:"Example detail layout for a deposit-based partner campaign.",
      period:"Dates pending verification",reward:"Reward details pending",region:"Eligible regions only",status:"Preview",tone:"blue",
      steps:["Verify the official campaign source.","Register through the supported route.","Complete the published deposit conditions.","Claim or receive rewards according to the exchange terms."],
      terms:["Example content only.","FEELOOP does not publish a reward amount until official terms are verified.","Eligibility can differ by country and account status."]},
    {id:"bitget-vip-match",exchange:"Bitget",exchangeId:"bitget",type:"VIP campaign",title:"VIP Match — UI Preview",
      summary:"Example event page for a VIP or fee-tier campaign with source verification controls.",
      period:"Dates pending verification",reward:"Tier details pending",region:"Eligible regions only",status:"Preview",tone:"blue",
      steps:["Review the verified VIP requirements.","Connect the eligible UID.","Submit required proof if the exchange requires it.","Track status in the FEELOOP event center."],
      terms:["Example content only.","All tier and fee benefits remain pending until a verified source is connected.","Exchange terms take precedence over FEELOOP summaries."]},
    {id:"coinw-fee-week",exchange:"CoinW",exchangeId:"coinw",type:"Fee promotion",title:"Fee Week — UI Preview",
      summary:"Example event detail for a fee-rebate or trading-fee campaign.",
      period:"Dates pending verification",reward:"Fee benefit pending",region:"Eligible regions only",status:"Preview",tone:"blue",
      steps:["Open the official event terms.","Confirm the qualifying market and order types.","Trade only after enrollment is confirmed.","Check eligible fee records after connector sync."],
      terms:["Example content only.","No cashback or fee claim is active from this preview page.","Published values will be source-stamped in production."]}
  ];

  const DEMO_LEDGER = [
    {date:"2026-09-20",exchange:"BingX",uid:"18•••55",fee:312.20,cashback:187.32,status:"Eligible"},
    {date:"2026-09-18",exchange:"Toobit",uid:"66•••31",fee:217.80,cashback:130.68,status:"Pending"},
    {date:"2026-09-15",exchange:"Bitget",uid:"99•••70",fee:461.20,cashback:276.72,status:"Paid"},
    {date:"2026-09-11",exchange:"CoinW",uid:"42•••91",fee:198.55,cashback:119.13,status:"Eligible"}
  ];

  const PAYOUTS = [
    {id:"PO-1048",user:"demo@feeloop.app",exchange:"BingX",method:"Exchange UID",amount:187.32,status:"pending",created:"2026-09-21"},
    {id:"PO-1047",user:"alexa@example.com",exchange:"Bitget",method:"Exchange UID",amount:442.10,status:"processing",created:"2026-09-21"},
    {id:"PO-1046",user:"marco@example.com",exchange:"Toobit",method:"Wallet",amount:231.45,status:"paid",created:"2026-09-20"},
    {id:"PO-1045",user:"demo@feeloop.app",exchange:"Bitget",method:"Exchange UID",amount:276.72,status:"paid",created:"2026-09-19"}
  ];

  const fmtMoney = v => new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(Number(v)||0);
  const $ = (q,root=document) => root.querySelector(q);
  const $$ = (q,root=document) => [...root.querySelectorAll(q)];
  const query = key => new URLSearchParams(location.search).get(key);
  const escapeHtml = s => String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));

  function toast(msg){
    let t=$("#toast");
    if(!t){t=document.createElement("div");t.id="toast";t.className="toast";document.body.appendChild(t)}
    t.textContent=msg;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2200);
  }

  function exchangeCard(e){
    return `<a class="card exchange-card" href="exchange.html?id=${e.id}">
      <div class="ex-head"><div class="exlogo">${e.short}</div><span class="pill ${e.tone}">${e.status}</span></div>
      <div style="margin-top:18px"><h3>${e.name}</h3><div class="big-number">${e.cashback === "TBD" ? "Rate pending" : e.cashback}</div>
      <p class="meta">${e.description}</p></div>
      <div class="feature-list">
        <div class="feature"><i></i> Direct referral UID verification</div>
        <div class="feature"><i></i> Source-level fee ledger</div>
        <div class="feature"><i></i> Manual payout in V1</div>
      </div>
    </a>`;
  }

  function eventCard(e){
    return `<a class="card event-card" href="event.html?id=${e.id}" data-exchange="${e.exchangeId}" data-type="${e.type.toLowerCase()}">
      <div class="tag">${escapeHtml(e.exchange)} · ${escapeHtml(e.type)}</div>
      <h3 style="margin-top:10px">${escapeHtml(e.title)}</h3>
      <p class="meta">${escapeHtml(e.summary)}</p>
      <div class="event-meta"><span class="pill blue">${escapeHtml(e.status)}</span><span class="pill gray">${escapeHtml(e.period)}</span></div>
      <div class="spacer"></div>
      <div class="feature">View event detail <span aria-hidden="true">→</span></div>
    </a>`;
  }

  function renderCards(){
    $$("[data-exchanges]").forEach(el=>el.innerHTML=EXCHANGES.map(exchangeCard).join(""));
    $$("[data-events]").forEach(el=>{
      const limit=Number(el.dataset.limit||0);
      el.innerHTML=(limit?EVENTS.slice(0,limit):EVENTS).map(eventCard).join("");
    });
  }

  function initFeeLab(){
    const form=$("#feeLab"); if(!form) return;
    const calc=()=>{
      const vol=Math.max(0,Number($("#vol")?.value||0));
      const fee=Math.max(0,Number($("#fee")?.value||0))/100;
      const rebate=Math.min(100,Math.max(0,Number($("#rebate")?.value||0)))/100;
      const eligible=Math.min(100,Math.max(0,Number($("#eligible")?.value||0)))/100;
      const fees=vol*fee*eligible, cash=fees*rebate, cost=fees-cash;
      if($("#cash")) $("#cash").textContent=fmtMoney(cash);
      if($("#fees")) $("#fees").textContent=fmtMoney(fees);
      if($("#cost")) $("#cost").textContent=fmtMoney(cost);
      if($("#saved")) $("#saved").textContent=(rebate*100).toFixed(2)+"%";
    };
    form.addEventListener("input",calc);form.addEventListener("submit",e=>{e.preventDefault();calc();toast("Estimate updated")});calc();
  }

  function initLogin(){
    const form=$("#loginForm"); if(!form) return;
    form.addEventListener("submit",e=>{
      e.preventDefault();
      const email=$("#email").value.trim().toLowerCase();
      const password=$("#password").value;
      const isAdmin=email==="admin@feeloop.app" && password==="Admin123!";
      const isUser=email==="demo@feeloop.app" && password==="Demo123!";
      if(!isAdmin&&!isUser){$("#loginError").textContent="Use the demo credentials shown below.";return}
      localStorage.removeItem("feeloop_session");
      const nextSession={email,role:isAdmin?"admin":"user",created:Date.now(),version:5};
      localStorage.setItem("feeloop_session",JSON.stringify(nextSession));
      location.replace(isAdmin?"admin.html":"dashboard.html");
    });
    $("[data-fill-login]").forEach(btn=>btn.addEventListener("click",()=>{
      localStorage.removeItem("feeloop_session");
      const type=btn.dataset.fillLogin;
      $("#email").value=type==="admin"?"admin@feeloop.app":"demo@feeloop.app";
      $("#password").value=type==="admin"?"Admin123!":"Demo123!";
      $("#loginError").textContent="";
    }));
  }

  function session(){try{return JSON.parse(localStorage.getItem("feeloop_session")||"null")}catch{return null}}
  function enforceAuth(){
    const required=document.body.dataset.authRole;
    const s=session();
    if(required==="user"){
      const validMember=s && s.role==="user" && s.email==="demo@feeloop.app";
      const validAdminPreview=s && s.role==="admin" && s.email==="admin@feeloop.app" && query("preview")==="1";
      if(!validMember && !validAdminPreview){
        if(s && s.role==="admin") location.replace("admin.html");
        else {
          localStorage.removeItem("feeloop_session");
          location.replace("login.html?switch=member");
        }
        return false;
      }
    }
    if(required==="admin"){
      const valid=s && s.role==="admin" && s.email==="admin@feeloop.app";
      if(!valid){
        if(s && s.role==="user") location.replace("dashboard.html");
        else {
          localStorage.removeItem("feeloop_session");
          location.replace("login.html?switch=admin");
        }
        return false;
      }
    }
    return true;
  }
  function logout(){localStorage.removeItem("feeloop_session");location.href="index.html"}

  function initDashboard(){
    const root=$("#dashboardLedger"); if(!root) return;
    root.innerHTML=DEMO_LEDGER.map(r=>`<tr><td>${r.date}</td><td><strong>${r.exchange}</strong></td><td>${r.uid}</td><td>${fmtMoney(r.fee)}</td><td>${fmtMoney(r.cashback)}</td><td><span class="status ${r.status==="Paid"?"paid":r.status==="Pending"?"processing":"pending"}">${r.status}</span></td></tr>`).join("");
    const eventEl=$("#dashboardEvents");if(eventEl) eventEl.innerHTML=EVENTS.slice(0,3).map(e=>`<a href="event.html?id=${e.id}" class="step"><div class="step-no">↗</div><div><b>${e.exchange}</b><div class="meta">${e.title}</div></div></a>`).join("");
    const modal=$("#payoutModal"), open=$("#requestPayout"), close=$("#closePayout"), form=$("#payoutForm");
    open?.addEventListener("click",()=>modal.classList.add("open"));
    close?.addEventListener("click",()=>modal.classList.remove("open"));
    modal?.addEventListener("click",e=>{if(e.target===modal)modal.classList.remove("open")});
    form?.addEventListener("submit",e=>{
      e.preventDefault();
      const amount=Number($("#payoutAmount").value||0);
      if(amount<=0||amount>437.13){toast("Enter an amount up to $437.13");return}
      modal.classList.remove("open");toast("Demo payout request created");
    });
  }

  function initEvents(){
    const grid=$("#eventGrid"); if(!grid) return;
    const render=()=>{grid.innerHTML=EVENTS.map(eventCard).join("")};
    render();
    $$(".chip[data-filter]").forEach(btn=>btn.addEventListener("click",()=>{
      $$(".chip[data-filter]").forEach(x=>x.classList.remove("active"));btn.classList.add("active");
      const f=btn.dataset.filter;
      $$(".event-card",grid).forEach(card=>card.style.display=(f==="all"||card.dataset.exchange===f||card.dataset.type.includes(f))?"flex":"none");
    }));
    $("#eventSearch")?.addEventListener("input",e=>{
      const q=e.target.value.toLowerCase().trim();
      $$(".event-card",grid).forEach(card=>card.style.display=card.textContent.toLowerCase().includes(q)?"flex":"none");
    });
  }

  function initEventDetail(){
    const root=$("#eventDetail"); if(!root) return;
    const e=EVENTS.find(x=>x.id===query("id"))||EVENTS[0];
    document.title=`${e.title} — FEELOOP`;
    root.innerHTML=`
      <div class="page-hero">
        <div class="eyebrow">${escapeHtml(e.exchange)} · ${escapeHtml(e.type)}</div>
        <h1>${escapeHtml(e.title)}</h1>
        <p class="lead">${escapeHtml(e.summary)}</p>
      </div>
      <div class="exchange-hero">
        <div class="panel hero-panel">
          <div class="section-head" style="margin-bottom:16px"><div><h3>Event overview</h3><div class="meta">Structured for verified source ingestion later.</div></div><span class="pill blue">${escapeHtml(e.status)}</span></div>
          <div class="scorebox">
            <div class="score"><div class="meta">Period</div><b>${escapeHtml(e.period)}</b></div>
            <div class="score"><div class="meta">Reward</div><b>${escapeHtml(e.reward)}</b></div>
            <div class="score"><div class="meta">Region</div><b>${escapeHtml(e.region)}</b></div>
            <div class="score"><div class="meta">Source status</div><b>Awaiting partner feed</b></div>
          </div>
          <div class="notice" style="margin-top:18px"><b>UI preview only.</b> This is not an active exchange promotion. FEELOOP will only publish verified dates, rewards and eligibility when an official source is connected.</div>
        </div>
        <div class="panel hero-panel">
          <h3>Participation flow</h3><div class="flow" style="margin-top:14px">
            ${e.steps.map((s,i)=>`<div class="step"><div class="step-no">${i+1}</div><div>${escapeHtml(s)}</div></div>`).join("")}
          </div>
        </div>
      </div>
      <div class="grid-2" style="margin-top:18px">
        <div class="panel"><h3>Terms & controls</h3><div class="feature-list">${e.terms.map(t=>`<div class="feature"><i></i>${escapeHtml(t)}</div>`).join("")}</div></div>
        <div class="panel"><h3>Related exchange</h3><p class="meta">See connector status, UID flow and future fee settings.</p><div style="margin-top:16px"><a class="btn primary" href="exchange.html?id=${e.exchangeId}">Open ${escapeHtml(e.exchange)} page</a></div></div>
      </div>`;
  }

  function initExchangeDetail(){
    const root=$("#exchangeDetail");if(!root)return;
    const e=EXCHANGES.find(x=>x.id===query("id"))||EXCHANGES[0];
    const related=EVENTS.filter(x=>x.exchangeId===e.id);
    document.title=`${e.name} Cashback — FEELOOP`;
    root.innerHTML=`
      <div class="page-hero">
        <div class="eyebrow">Exchange profile</div><h1>${e.name} on FEELOOP</h1>
        <p class="lead">${escapeHtml(e.description)}</p>
      </div>
      <div class="exchange-hero">
        <div class="panel hero-panel">
          <div class="ex-head"><div class="exlogo" style="width:62px;height:62px;font-size:20px">${e.short}</div><span class="pill blue">${e.status}</span></div>
          <div class="scorebox">
            <div class="score"><div class="meta">Cashback rate</div><b>${e.cashback}</b></div>
            <div class="score"><div class="meta">Maker fee</div><b>${e.maker}</b></div>
            <div class="score"><div class="meta">Taker fee</div><b>${e.taker}</b></div>
            <div class="score"><div class="meta">Settlement</div><b>Manual payout V1</b></div>
          </div>
          <div class="notice" style="margin-top:18px">Final referral link, cashback rate and fee values remain unpublished until the partner account and API terms are verified.</div>
        </div>
        <div class="panel hero-panel">
          <h3>Connection flow</h3>
          <div class="flow" style="margin-top:14px">
            <div class="step"><div class="step-no">1</div><div><b>Join through FEELOOP</b><div class="meta">Official referral route will appear here.</div></div></div>
            <div class="step"><div class="step-no">2</div><div><b>Submit UID</b><div class="meta">Direct referral relationship is checked.</div></div></div>
            <div class="step"><div class="step-no">3</div><div><b>Sync eligible fees</b><div class="meta">Affiliate API records are deduplicated.</div></div></div>
            <div class="step"><div class="step-no">4</div><div><b>Request payout</b><div class="meta">Operator verifies and records payment receipt.</div></div></div>
          </div>
        </div>
      </div>
      <div class="section">
        <div class="section-head"><div><div class="eyebrow">Events</div><h2>${e.name} event center</h2></div><a class="btn" href="events.html">All events</a></div>
        <div class="grid-3">${related.length?related.map(eventCard).join(""):`<div class="panel empty">No verified events yet.</div>`}</div>
      </div>`;
  }

  function payoutState(){
    try{return JSON.parse(localStorage.getItem("feeloop_payouts")||"null")||PAYOUTS}catch{return PAYOUTS}
  }
  function savePayouts(v){localStorage.setItem("feeloop_payouts",JSON.stringify(v))}
  function initAdmin(){
    const tbody=$("#payoutQueue");if(!tbody)return;
    const draw=()=>{
      const rows=payoutState();
      tbody.innerHTML=rows.map(p=>`<tr><td><strong>${p.id}</strong><div class="meta">${p.created}</div></td><td>${p.user}</td><td>${p.exchange}</td><td>${p.method}</td><td><strong>${fmtMoney(p.amount)}</strong></td><td><span class="status ${p.status}">${p.status}</span></td><td><div class="action-row">${p.status!=="paid"?`<button class="btn sm" data-payout="${p.id}" data-action="processing">Process</button><button class="btn sm primary" data-payout="${p.id}" data-action="paid">Mark paid</button>`:""}${p.status==="pending"?`<button class="btn sm danger" data-payout="${p.id}" data-action="rejected">Reject</button>`:""}</div></td></tr>`).join("");
      $$("[data-payout]").forEach(btn=>btn.addEventListener("click",()=>{
        const list=payoutState();const row=list.find(x=>x.id===btn.dataset.payout);if(row){row.status=btn.dataset.action;savePayouts(list);draw();toast(`${row.id} updated to ${row.status}`)}
      }));
    };draw();

    const ex=$("#adminExchanges");if(ex) ex.innerHTML=EXCHANGES.map(e=>`<div class="card"><div class="ex-head"><div class="exlogo">${e.short}</div><span class="pill blue">API pending</span></div><h3 style="margin-top:14px">${e.name}</h3><div class="form-grid" style="margin-top:12px"><div class="field"><label>Cashback %<input placeholder="Pending" disabled></label></div><div class="field"><label>Partner commission %<input placeholder="Pending" disabled></label></div></div><div class="meta" style="margin-top:12px">Unlock after verified partner credentials are available.</div></div>`).join("");
    const cms=$("#adminEvents");if(cms) cms.innerHTML=EVENTS.map(e=>`<tr><td><strong>${e.exchange}</strong></td><td>${e.title}</td><td>${e.type}</td><td><span class="status processing">preview</span></td><td><a class="btn sm" href="event.html?id=${e.id}">View</a></td></tr>`).join("");
  }

  function initOperatorPreview(){
    const s=session();
    const preview=s && s.role==="admin" && s.email==="admin@feeloop.app" && query("preview")==="1";
    if(!preview) return;
    const back=$("#backToAdmin");
    if(back) back.style.display="inline-flex";
    const pill=$("#previewModePill");
    if(pill){pill.textContent="Operator preview";pill.className="pill warn";}
  }

  function bindGlobal(){
    if(!enforceAuth()) return;
    renderCards();initFeeLab();initLogin();initDashboard();initEvents();initEventDetail();initExchangeDetail();initAdmin();initOperatorPreview();
    $$("[data-logout]").forEach(x=>x.addEventListener("click",logout));
    const y=$("#year");if(y)y.textContent=new Date().getFullYear();
  }
  return {bindGlobal,fmtMoney,toast,EXCHANGES,EVENTS};
})();
document.addEventListener("DOMContentLoaded",FeeLoop.bindGlobal);
