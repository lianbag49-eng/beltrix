const FeeLoop = (() => {
  const $=(q,r=document)=>r.querySelector(q);
  const $$=(q,r=document)=>[...r.querySelectorAll(q)];
  const query=k=>new URLSearchParams(location.search).get(k);
  const money=v=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:2}).format(Number(v)||0);
  const pct=v=>v===null||v===undefined?"Pending":Number(v).toFixed(2)+"%";
  const escapeHtml=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));

  let publicConfig={exchanges:[],blockedCountries:["KR"],environment:"staging"};
  let currentUser=null;

  async function api(url,opts={}){
    const init={credentials:"same-origin",headers:{"Content-Type":"application/json",...(opts.headers||{})},...opts};
    if(init.body && typeof init.body!=="string") init.body=JSON.stringify(init.body);
    const res=await fetch(url,init);
    let data={};
    try{data=await res.json()}catch{}
    if(!res.ok){
      const err=new Error(data.error||"REQUEST_FAILED");
      err.status=res.status;err.data=data;throw err;
    }
    return data;
  }

  function toast(msg,type=""){
    let el=$("#toast");
    if(!el){el=document.createElement("div");el.id="toast";el.className="toast";document.body.appendChild(el)}
    el.textContent=msg;el.className="toast show"+(type?" "+type:"");
    setTimeout(()=>el.className="toast",2600);
  }

  function errorText(err){
    const map={
      INVALID_CREDENTIALS:"Invalid email or password.",
      PASSWORD_TOO_SHORT:"Use at least 10 characters for your password.",
      COUNTRY_REQUIRED:"Select your country or region.",
      COUNTRY_NOT_SUPPORTED:"FEELOOP is not available for customer onboarding in this jurisdiction.",
      TERMS_REQUIRED:"You must accept the Terms and Privacy Policy.",
      EMAIL_EXISTS:"An account already exists with this email.",
      AUTH_REQUIRED:"Please log in to continue.",
      ADMIN_REQUIRED:"Administrator access is required.",
      UID_ALREADY_REGISTERED:"This UID is already registered.",
      INVALID_UID:"Enter a valid exchange UID.",
      INSUFFICIENT_AVAILABLE_BALANCE:"The requested amount exceeds your available cashback.",
      PAYMENT_REFERENCE_REQUIRED:"A transfer ID or TXID is required before marking a payout paid.",
      INVALID_MFA_CODE:"The authentication code is invalid.",
      MFA_SESSION_EXPIRED:"The MFA login session expired. Please log in again."
    };
    return map[err.message]||err.message.replaceAll("_"," ").toLowerCase().replace(/^./,c=>c.toUpperCase());
  }

  async function loadPublicConfig(){
    try{publicConfig=await api("/api/public/config")}catch{
      publicConfig={exchanges:[
        {id:"bingx",name:"BingX",short:"BX",cashbackRate:null,makerFee:null,takerFee:null,connectorStatus:"pending"},
        {id:"toobit",name:"Toobit",short:"TB",cashbackRate:null,makerFee:null,takerFee:null,connectorStatus:"pending"},
        {id:"bitget",name:"Bitget",short:"BG",cashbackRate:null,makerFee:null,takerFee:null,connectorStatus:"pending"},
        {id:"coinw",name:"CoinW",short:"CW",cashbackRate:null,makerFee:null,takerFee:null,connectorStatus:"pending"}
      ],blockedCountries:["KR"],environment:"offline"};
    }
  }

  async function loadMe(){
    try{currentUser=(await api("/api/auth/me")).user;return currentUser}catch{currentUser=null;return null}
  }

  function exchangeCard(e){
    const rate=e.cashbackRate===null||e.cashbackRate===undefined?"Rate pending":pct(e.cashbackRate);
    return `<a class="card exchange-card" href="exchange.html?id=${encodeURIComponent(e.id)}">
      <div class="ex-head"><div class="exlogo">${escapeHtml(e.short||e.name.slice(0,2).toUpperCase())}</div><span class="pill blue">${escapeHtml(e.connectorStatus||"pending")}</span></div>
      <div style="margin-top:18px"><h3>${escapeHtml(e.name)}</h3><div class="big-number">${rate}</div>
      <p class="meta">Direct referral UID mapping, source-level fee records and cashback payout tracking.</p></div>
      <div class="feature-list">
        <div class="feature"><i></i> UID connection workflow</div>
        <div class="feature"><i></i> Deduplicated fee ledger</div>
        <div class="feature"><i></i> Manual payout V1</div>
      </div>
    </a>`;
  }

  function eventCard(e){
    const ex=publicConfig.exchanges.find(x=>x.id===e.exchangeId);
    return `<a class="card event-card" href="event.html?id=${encodeURIComponent(e.id)}" data-exchange="${escapeHtml(e.exchangeId)}" data-type="${escapeHtml(String(e.type||"").toLowerCase())}">
      <div class="tag">${escapeHtml(ex?.name||e.exchangeId)} · ${escapeHtml(e.type||"Promotion")}</div>
      <h3 style="margin-top:10px">${escapeHtml(e.title)}</h3>
      <p class="meta">${escapeHtml(e.summary||"")}</p>
      <div class="event-meta">${e.startAt?`<span class="pill gray">${escapeHtml(new Date(e.startAt).toLocaleDateString())}</span>`:""}${e.reward?`<span class="pill blue">${escapeHtml(e.reward)}</span>`:""}</div>
      <div class="spacer"></div><div class="feature">View event detail →</div>
    </a>`;
  }

  function renderExchangeCards(){
    $$("[data-exchanges]").forEach(el=>{
      el.innerHTML=publicConfig.exchanges.length?publicConfig.exchanges.map(exchangeCard).join(""):'<div class="panel empty" style="grid-column:1/-1">No exchanges configured yet.</div>';
    });
  }

  async function renderEvents(targetSelector="[data-events]",limit=0){
    let events=[];
    try{events=(await api("/api/events")).events||[]}catch{}
    $$(targetSelector).forEach(el=>{
      const list=limit?events.slice(0,limit):events;
      el.innerHTML=list.length?list.map(eventCard).join(""):'<div class="panel empty" style="grid-column:1/-1">No verified exchange events are published yet.</div>';
    });
    return events;
  }

  function initFeeLab(){
    const form=$("#feeLab");if(!form)return;
    const calc=()=>{
      const vol=Math.max(0,Number($("#vol")?.value||0));
      const fee=Math.max(0,Number($("#fee")?.value||0))/100;
      const rebate=Math.min(100,Math.max(0,Number($("#rebate")?.value||0)))/100;
      const eligible=Math.min(100,Math.max(0,Number($("#eligible")?.value||0)))/100;
      const fees=vol*fee*eligible,cash=fees*rebate,cost=fees-cash;
      if($("#cash"))$("#cash").textContent=money(cash);
      if($("#fees"))$("#fees").textContent=money(fees);
      if($("#cost"))$("#cost").textContent=money(cost);
      if($("#saved"))$("#saved").textContent=(rebate*100).toFixed(2)+"%";
    };
    form.addEventListener("input",calc);form.addEventListener("submit",e=>{e.preventDefault();calc()});calc();
  }

  async function initLogin(){
    const form=$("#loginForm");if(!form)return;
    try{
      const bs=await api("/api/auth/bootstrap-status");
      if(!bs.adminExists && $("#adminBootstrapNotice")){
        $("#adminBootstrapNotice").innerHTML='<div class="notice"><b>Administrator setup required.</b><br>The permanent database is connected, but no administrator exists yet. <a href="admin-setup.html" style="text-decoration:underline">Initialize the administrator →</a></div>';
      }
    }catch{}
    const me=await loadMe();
    if(me){location.replace(me.role==="admin"?"admin.html":"dashboard.html");return}
    let mfaToken=null;
    form.addEventListener("submit",async e=>{
      e.preventDefault();$("#loginError").textContent="";
      try{
        if(mfaToken){
          const data=await api("/api/auth/mfa-login",{method:"POST",body:{mfaToken,code:$("#mfaCode").value.trim()}});
          location.replace(data.user.role==="admin"?"admin.html":"dashboard.html");return;
        }
        const data=await api("/api/auth/login",{method:"POST",body:{email:$("#email").value.trim(),password:$("#password").value}});
        if(data.mfaRequired){
          mfaToken=data.mfaToken;$("#loginFields").style.display="none";$("#mfaFields").style.display="grid";$("#loginButton").textContent="Verify code";$("#mfaCode").focus();return;
        }
        location.replace(data.user.role==="admin"?"admin.html":"dashboard.html");
      }catch(err){$("#loginError").textContent=errorText(err)}
    });
  }

  function countryOptions(){
    const countries=[
      ["US","United States"],["CA","Canada"],["MX","Mexico"],["BR","Brazil"],["AR","Argentina"],["CL","Chile"],["CO","Colombia"],
      ["GB","United Kingdom"],["IE","Ireland"],["FR","France"],["DE","Germany"],["ES","Spain"],["PT","Portugal"],["IT","Italy"],["NL","Netherlands"],["BE","Belgium"],["CH","Switzerland"],["AT","Austria"],["SE","Sweden"],["NO","Norway"],["DK","Denmark"],["FI","Finland"],["PL","Poland"],["CZ","Czechia"],["RO","Romania"],["GR","Greece"],
      ["AE","United Arab Emirates"],["SA","Saudi Arabia"],["TR","Türkiye"],["IL","Israel"],["ZA","South Africa"],["NG","Nigeria"],["KE","Kenya"],
      ["IN","India"],["PK","Pakistan"],["BD","Bangladesh"],["SG","Singapore"],["MY","Malaysia"],["TH","Thailand"],["VN","Vietnam"],["PH","Philippines"],["ID","Indonesia"],["JP","Japan"],["TW","Taiwan"],["HK","Hong Kong"],["AU","Australia"],["NZ","New Zealand"]
    ];
    return '<option value="">Select country / region</option>'+countries.filter(([c])=>!publicConfig.blockedCountries.includes(c)).map(([c,n])=>`<option value="${c}">${n}</option>`).join("");
  }

  async function initSignup(){
    const form=$("#signupForm");if(!form)return;
    const me=await loadMe();if(me){location.replace(me.role==="admin"?"admin.html":"dashboard.html");return}
    $("#country").innerHTML=countryOptions();
    form.addEventListener("submit",async e=>{
      e.preventDefault();$("#signupError").textContent="";
      try{
        const data=await api("/api/auth/register",{method:"POST",body:{
          email:$("#email").value.trim(),password:$("#password").value,country:$("#country").value,acceptTerms:$("#acceptTerms").checked
        }});
        location.replace(data.user.role==="admin"?"admin.html":"dashboard.html");
      }catch(err){$("#signupError").textContent=errorText(err)}
    });
  }

  async function logout(){
    try{await api("/api/auth/logout",{method:"POST"})}catch{}
    location.replace("index.html");
  }

  async function guard(role,{allowAdminPreview=false}={}){
    const me=await loadMe();
    if(!me){location.replace("login.html");return null}
    if(role==="admin"&&me.role!=="admin"){location.replace("dashboard.html");return null}
    if(role==="user"&&me.role==="admin"&&!(allowAdminPreview&&query("preview")==="1")){location.replace("admin.html");return null}
    return me;
  }

  function setText(id,val){const el=$(id);if(el)el.textContent=val}
  function statusPill(status){
    const cls=status==="paid"||status==="verified"?"paid":status==="rejected"?"rejected":status==="processing"?"processing":"pending";
    return `<span class="status ${cls}">${escapeHtml(status)}</span>`;
  }

  async function initDashboard(){
    if(!$("#dashboardRoot"))return;
    const me=await guard("user",{allowAdminPreview:true});if(!me)return;
    const isPreview=me.role==="admin"&&query("preview")==="1";
    if(isPreview){$("#backToAdmin").style.display="inline-flex";$("#previewModePill").textContent="Operator preview";$("#previewModePill").className="pill warn";}
    let data={summary:{totalFees:0,cashback:0,available:0,reserved:0,paid:0},ledger:[],accounts:[],payouts:[],events:[]};
    if(!isPreview){try{data=await api("/api/dashboard")}catch(err){toast(errorText(err));}}
    setText("#metricAvailable",money(data.summary.available));setText("#metricFees",money(data.summary.totalFees));setText("#metricCashback",money(data.summary.cashback));setText("#metricPaid",money(data.summary.paid));
    $("#dashboardLedger").innerHTML=data.ledger.length?data.ledger.map(r=>`<tr><td>${escapeHtml(new Date(r.occurredAt).toLocaleDateString())}</td><td><strong>${escapeHtml(publicConfig.exchanges.find(x=>x.id===r.exchangeId)?.name||r.exchangeId)}</strong></td><td>${escapeHtml(r.sourceRecordId)}</td><td>${money(r.feeAmount)}</td><td>${money(r.cashbackAmount)}</td><td>${statusPill(r.status)}</td></tr>`).join(""):'<tr><td colspan="6"><div class="empty">No fee records yet.</div></td></tr>';
    $("#uidList").innerHTML=data.accounts.length?data.accounts.map(a=>`<div class="step"><div class="exlogo">${escapeHtml(publicConfig.exchanges.find(x=>x.id===a.exchangeId)?.short||a.exchangeId.slice(0,2).toUpperCase())}</div><div style="flex:1"><b>${escapeHtml(publicConfig.exchanges.find(x=>x.id===a.exchangeId)?.name||a.exchangeId)}</b><div class="meta">${escapeHtml(a.uid)} · ${escapeHtml(a.status)}</div></div><button class="btn sm danger" data-remove-uid="${a.id}">Remove</button></div>`).join(""):'<div class="empty">No exchange UID is connected yet.</div>';
    $$("[data-remove-uid]").forEach(b=>b.addEventListener("click",async()=>{if(!confirm("Remove this UID connection?"))return;try{await api("/api/exchange-accounts/"+b.dataset.removeUid,{method:"DELETE"});toast("UID removed");initDashboard()}catch(e){toast(errorText(e))}}));
    $("#payoutHistory").innerHTML=data.payouts.length?data.payouts.map(p=>`<tr><td>${escapeHtml(new Date(p.createdAt).toLocaleDateString())}</td><td>${money(p.amount)}</td><td>${escapeHtml(p.method)}</td><td>${statusPill(p.status)}</td><td>${escapeHtml(p.paymentRef||"—")}</td></tr>`).join(""):'<tr><td colspan="5"><div class="empty">No payout requests yet.</div></td></tr>';
    $("#dashboardEvents").innerHTML=data.events.length?data.events.map(e=>`<a href="event.html?id=${encodeURIComponent(e.id)}" class="step"><div class="step-no">↗</div><div><b>${escapeHtml(e.title)}</b><div class="meta">${escapeHtml(publicConfig.exchanges.find(x=>x.id===e.exchangeId)?.name||e.exchangeId)}</div></div></a>`).join(""):'<div class="empty">No verified exchange events yet.</div>';

    $("#uidExchange").innerHTML=publicConfig.exchanges.map(x=>`<option value="${x.id}">${escapeHtml(x.name)}</option>`).join("");
    $("[data-open-uid]")?.addEventListener("click",()=>$("#uidModal").classList.add("open"));
    $("#closeUid")?.addEventListener("click",()=>$("#uidModal").classList.remove("open"));
    $("#uidForm")?.addEventListener("submit",async e=>{
      e.preventDefault();try{await api("/api/exchange-accounts",{method:"POST",body:{exchangeId:$("#uidExchange").value,uid:$("#uidValue").value.trim()}});$("#uidModal").classList.remove("open");toast("UID submitted for verification");setTimeout(()=>location.reload(),500)}catch(err){toast(errorText(err))}
    });

    $$("[data-open-payout]").forEach(b=>b.addEventListener("click",()=>{$("#payoutAmount").max=data.summary.available;$("#payoutAvailable").textContent=money(data.summary.available);$("#payoutModal").classList.add("open")}));
    $("#closePayout")?.addEventListener("click",()=>$("#payoutModal").classList.remove("open"));
    $("#payoutForm")?.addEventListener("submit",async e=>{
      e.preventDefault();try{await api("/api/payouts",{method:"POST",body:{amount:Number($("#payoutAmount").value),method:$("#payoutMethod").value,destination:$("#payoutDestination").value.trim()}});$("#payoutModal").classList.remove("open");toast("Payout request created");setTimeout(()=>location.reload(),500)}catch(err){toast(errorText(err))}
    });
  }

  async function initEventsPage(){
    const grid=$("#eventGrid");if(!grid)return;
    const events=(await renderEvents("#eventGrid"))||[];
    $$(".chip[data-filter]").forEach(btn=>btn.addEventListener("click",()=>{
      $$(".chip[data-filter]").forEach(x=>x.classList.remove("active"));btn.classList.add("active");
      const f=btn.dataset.filter;$$(".event-card",grid).forEach(card=>card.style.display=(f==="all"||card.dataset.exchange===f||card.dataset.type.includes(f))?"flex":"none");
    }));
    $("#eventSearch")?.addEventListener("input",e=>{const q=e.target.value.toLowerCase();$$(".event-card",grid).forEach(card=>card.style.display=card.textContent.toLowerCase().includes(q)?"flex":"none")});
  }

  async function initEventDetail(){
    const root=$("#eventDetail");if(!root)return;
    try{
      const e=(await api("/api/events/"+encodeURIComponent(query("id")||""))).event;
      const ex=publicConfig.exchanges.find(x=>x.id===e.exchangeId);
      document.title=e.title+" — FEELOOP";
      root.innerHTML=`<div class="page-hero"><div class="eyebrow">${escapeHtml(ex?.name||e.exchangeId)} · ${escapeHtml(e.type||"Promotion")}</div><h1>${escapeHtml(e.title)}</h1><p class="lead">${escapeHtml(e.summary||"")}</p></div>
      <div class="exchange-hero"><div class="panel hero-panel"><h3>Event overview</h3><div class="scorebox">
        <div class="score"><div class="meta">Start</div><b>${e.startAt?escapeHtml(new Date(e.startAt).toLocaleString()):"TBA"}</b></div>
        <div class="score"><div class="meta">End</div><b>${e.endAt?escapeHtml(new Date(e.endAt).toLocaleString()):"TBA"}</b></div>
        <div class="score"><div class="meta">Reward</div><b>${escapeHtml(e.reward||"See official terms")}</b></div>
        <div class="score"><div class="meta">Region</div><b>${escapeHtml(e.region||"Eligible regions only")}</b></div>
      </div>${e.sourceUrl?`<div style="margin-top:18px"><a class="btn primary" href="${escapeHtml(e.sourceUrl)}" target="_blank" rel="noopener">Official source ↗</a></div>`:""}</div>
      <div class="panel hero-panel"><h3>FEELOOP source policy</h3><div class="feature-list"><div class="feature"><i></i> Exchange/source identity stored with the event</div><div class="feature"><i></i> Region eligibility shown separately</div><div class="feature"><i></i> Official terms take precedence over summaries</div></div></div></div>`;
    }catch{root.innerHTML='<div class="page-hero"><div class="eyebrow">Event Center</div><h1>Event unavailable.</h1><p class="lead">This event may not be published yet.</p><div style="margin-top:20px"><a class="btn" href="events.html">← Back to events</a></div></div>'}
  }

  async function initExchangeDetail(){
    const root=$("#exchangeDetail");if(!root)return;
    const e=publicConfig.exchanges.find(x=>x.id===query("id"))||publicConfig.exchanges[0];
    if(!e){root.innerHTML='<div class="page-hero"><h1>No exchange configured.</h1></div>';return}
    let events=[];try{events=(await api("/api/events")).events.filter(x=>x.exchangeId===e.id)}catch{}
    root.innerHTML=`<div class="page-hero"><div class="eyebrow">Exchange profile</div><h1>${escapeHtml(e.name)} on FEELOOP</h1><p class="lead">Partner connection status, UID flow, fee settings and verified exchange events.</p></div>
      <div class="exchange-hero"><div class="panel hero-panel"><div class="ex-head"><div class="exlogo" style="width:62px;height:62px;font-size:20px">${escapeHtml(e.short||e.name.slice(0,2))}</div><span class="pill blue">${escapeHtml(e.connectorStatus||"pending")}</span></div>
      <div class="scorebox"><div class="score"><div class="meta">Cashback rate</div><b>${pct(e.cashbackRate)}</b></div><div class="score"><div class="meta">Maker fee</div><b>${pct(e.makerFee)}</b></div><div class="score"><div class="meta">Taker fee</div><b>${pct(e.takerFee)}</b></div><div class="score"><div class="meta">Settlement</div><b>Manual payout V1</b></div></div>
      <div class="notice" style="margin-top:18px">Values remain pending until verified partner terms are configured.</div></div>
      <div class="panel hero-panel"><h3>Connection flow</h3><div class="flow" style="margin-top:14px"><div class="step"><div class="step-no">1</div><div><b>Create your FEELOOP account</b></div></div><div class="step"><div class="step-no">2</div><div><b>Submit your exchange UID</b></div></div><div class="step"><div class="step-no">3</div><div><b>UID is verified against partner data</b></div></div><div class="step"><div class="step-no">4</div><div><b>Eligible fees enter your ledger</b></div></div></div><div style="margin-top:16px"><a class="btn primary" href="dashboard.html">Connect UID</a></div></div></div>
      <div class="section"><div class="section-head"><div><div class="eyebrow">Events</div><h2>${escapeHtml(e.name)} event center</h2></div><a class="btn" href="events.html">All events</a></div><div class="grid-3">${events.length?events.map(eventCard).join(""):'<div class="panel empty">No verified events yet.</div>'}</div></div>`;
  }

  async function initAdmin(){
    if(!$("#adminRoot"))return;
    const me=await guard("admin");if(!me)return;
    let data;try{data=await api("/api/admin/overview")}catch(err){toast(errorText(err));return}
    setText("#adminPending",String(data.metrics.pendingPayouts));setText("#adminPendingAmount",money(data.metrics.pendingAmount));setText("#adminUsers",String(data.metrics.users));setText("#adminCommission",money(data.metrics.grossCommission));setText("#adminMargin",money(data.metrics.platformMargin));

    async function renderUsers(q=""){
      try{
        const d=await api("/api/admin/users"+(q?"?q="+encodeURIComponent(q):""));
        $("#userTable").innerHTML=d.users.length?d.users.map(u=>`<tr><td><strong>${escapeHtml(u.email)}</strong></td><td>${escapeHtml(u.country||"—")}</td><td>${money(u.summary.totalFees)}</td><td>${money(u.summary.accrued)}</td><td>${money(u.summary.available)}</td><td>${escapeHtml(new Date(u.createdAt).toLocaleDateString())}</td></tr>`).join(""):'<tr><td colspan="6"><div class="empty">No members found.</div></td></tr>';
      }catch(err){$("#userTable").innerHTML='<tr><td colspan="6"><div class="empty">Unable to load members.</div></td></tr>'}
    }
    await renderUsers();
    let userSearchTimer;
    $("#userSearch")?.addEventListener("input",e=>{clearTimeout(userSearchTimer);userSearchTimer=setTimeout(()=>renderUsers(e.target.value.trim()),250)});

    $("#payoutQueue").innerHTML=data.payouts.length?data.payouts.map(p=>`<tr><td><strong>${escapeHtml(p.id)}</strong><div class="meta">${escapeHtml(new Date(p.createdAt).toLocaleString())}</div></td><td>${escapeHtml(p.userId)}</td><td>${escapeHtml(p.method)}</td><td><strong>${money(p.amount)}</strong></td><td>${statusPill(p.status)}</td><td><div class="action-row">${p.status!=="paid"&&p.status!=="rejected"?`<button class="btn sm" data-payout="${p.id}" data-action="processing">Process</button><button class="btn sm primary" data-payout="${p.id}" data-action="paid">Mark paid</button><button class="btn sm danger" data-payout="${p.id}" data-action="rejected">Reject</button>`:""}</div></td></tr>`).join(""):'<tr><td colspan="6"><div class="empty">No payout requests yet.</div></td></tr>';
    $$("[data-payout]").forEach(btn=>btn.addEventListener("click",async()=>{
      const body={status:btn.dataset.action};if(body.status==="paid"){const ref=prompt("Transfer ID / TXID");if(!ref)return;body.paymentRef=ref}
      try{await api("/api/admin/payouts/"+btn.dataset.payout,{method:"PATCH",body});toast("Payout updated");setTimeout(()=>location.reload(),400)}catch(err){toast(errorText(err))}
    }));

    $("#uidQueue").innerHTML=data.exchangeAccounts.length?data.exchangeAccounts.map(a=>`<tr><td>${escapeHtml(a.userId)}</td><td><strong>${escapeHtml(publicConfig.exchanges.find(x=>x.id===a.exchangeId)?.name||a.exchangeId)}</strong></td><td>${escapeHtml(a.uid)}</td><td>${statusPill(a.status)}</td><td><div class="action-row"><button class="btn sm primary" data-uid-action="verified" data-id="${a.id}">Verify</button><button class="btn sm danger" data-uid-action="rejected" data-id="${a.id}">Reject</button></div></td></tr>`).join(""):'<tr><td colspan="5"><div class="empty">No UID verification requests yet.</div></td></tr>';
    $$("[data-uid-action]").forEach(btn=>btn.addEventListener("click",async()=>{try{await api("/api/admin/exchange-accounts/"+btn.dataset.id,{method:"PATCH",body:{status:btn.dataset.uidAction}});toast("UID status updated");setTimeout(()=>location.reload(),400)}catch(err){toast(errorText(err))}}));

    $("#adminExchanges").innerHTML=data.exchanges.map(e=>`<form class="card exchange-config" data-exchange-form="${e.id}"><div class="ex-head"><div class="exlogo">${escapeHtml(e.short||e.id.slice(0,2).toUpperCase())}</div><span class="pill blue">${escapeHtml(e.connectorStatus||"pending")}</span></div><h3 style="margin-top:14px">${escapeHtml(e.name)}</h3>
      <div class="form-grid" style="margin-top:12px"><div class="field"><label>Cashback %</label><input name="cashbackRate" type="number" step=".01" value="${e.cashbackRate??""}"></div><div class="field"><label>Partner commission %</label><input name="partnerCommissionRate" type="number" step=".01" value="${e.partnerCommissionRate??""}"></div><div class="field"><label>Maker fee %</label><input name="makerFee" type="number" step=".001" value="${e.makerFee??""}"></div><div class="field"><label>Taker fee %</label><input name="takerFee" type="number" step=".001" value="${e.takerFee??""}"></div></div><button class="btn sm primary" style="margin-top:12px">Save settings</button></form>`).join("");
    $$("[data-exchange-form]").forEach(form=>form.addEventListener("submit",async e=>{e.preventDefault();const fd=new FormData(form);const body=Object.fromEntries(fd.entries());try{await api("/api/admin/exchanges/"+form.dataset.exchangeForm,{method:"PATCH",body});toast("Exchange settings saved")}catch(err){toast(errorText(err))}}));

    $("#adminEvents").innerHTML=data.events.length?data.events.map(e=>`<tr><td><strong>${escapeHtml(publicConfig.exchanges.find(x=>x.id===e.exchangeId)?.name||e.exchangeId)}</strong></td><td>${escapeHtml(e.title)}</td><td>${escapeHtml(e.type)}</td><td>${statusPill(e.status)}</td><td><button class="btn sm" data-event-toggle="${e.id}" data-next="${e.status==="published"?"draft":"published"}">${e.status==="published"?"Unpublish":"Publish"}</button></td></tr>`).join(""):'<tr><td colspan="5"><div class="empty">No event records yet.</div></td></tr>';
    $$("[data-event-toggle]").forEach(btn=>btn.addEventListener("click",async()=>{try{await api("/api/admin/events/"+btn.dataset.eventToggle,{method:"PATCH",body:{status:btn.dataset.next}});toast("Event status updated");setTimeout(()=>location.reload(),400)}catch(err){toast(errorText(err))}}));

    $("#auditList").innerHTML=data.audit.length?data.audit.slice(0,25).map(a=>`<div class="step"><div class="step-no">•</div><div><b>${escapeHtml(a.action)}</b><div class="meta">${escapeHtml(new Date(a.createdAt).toLocaleString())} · ${escapeHtml(a.target||"system")}</div></div></div>`).join(""):'<div class="empty">No audit records yet.</div>';

    $("#newEvent")?.addEventListener("click",()=>{$("#eventModal").classList.add("open");$("#eventExchange").innerHTML=publicConfig.exchanges.map(e=>`<option value="${e.id}">${escapeHtml(e.name)}</option>`).join("")});
    $("#closeEvent")?.addEventListener("click",()=>$("#eventModal").classList.remove("open"));
    $("#eventForm")?.addEventListener("submit",async e=>{e.preventDefault();const fd=new FormData(e.currentTarget);const body=Object.fromEntries(fd.entries());try{await api("/api/admin/events",{method:"POST",body});$("#eventModal").classList.remove("open");toast("Event created");setTimeout(()=>location.reload(),400)}catch(err){toast(errorText(err))}});

    $("#setupMfa")?.addEventListener("click",async()=>{try{const r=await api("/api/auth/mfa/setup",{method:"POST"});$("#mfaSecret").textContent=r.secret;$("#mfaUri").textContent=r.otpauthUri;$("#mfaSetup").style.display="block"}catch(err){toast(errorText(err))}});
    $("#enableMfa")?.addEventListener("click",async()=>{try{await api("/api/auth/mfa/enable",{method:"POST",body:{code:$("#mfaEnableCode").value.trim()}});toast("MFA enabled");$("#mfaSetup").style.display="none"}catch(err){toast(errorText(err))}});
  }

  async function initForgot(){
    const form=$("#forgotForm");if(!form)return;
    form.addEventListener("submit",async e=>{e.preventDefault();try{await api("/api/auth/password-reset/request",{method:"POST",body:{email:$("#email").value.trim()}});$("#forgotResult").textContent="If the account exists, a reset message will be sent when the email provider is connected."}catch(err){$("#forgotResult").textContent=errorText(err)}})
  }

  async function initAdminSetup(){
    const form=$("#adminSetupForm");if(!form)return;
    try{
      const status=await api("/api/auth/bootstrap-status");
      if(status.adminExists){$("#adminSetupState").innerHTML='<div class="notice">Administrator setup is already complete. <a href="login.html" style="text-decoration:underline">Log in instead.</a></div>';form.style.display="none";return}
    }catch{}
    form.addEventListener("submit",async e=>{
      e.preventDefault();$("#adminSetupError").textContent="";
      try{
        const data=await api("/api/auth/bootstrap-admin",{method:"POST",body:{
          bootstrapPhrase:$("#bootstrapPhrase").value,
          email:$("#adminEmail").value.trim(),
          password:$("#adminPassword").value
        }});
        location.replace(data.user.role==="admin"?"admin.html":"login.html");
      }catch(err){$("#adminSetupError").textContent=errorText(err)}
    });
  }

  async function bind(){
    await loadPublicConfig();
    renderExchangeCards();
    initFeeLab();
    await initLogin();
    await initSignup();
    await initDashboard();
    await initEventsPage();
    await initEventDetail();
    await initExchangeDetail();
    await initAdmin();
    initForgot();
    await initAdminSetup();
    await renderEvents("[data-events]",3);
    $$("[data-logout]").forEach(x=>x.addEventListener("click",logout));
    const y=$("#year");if(y)y.textContent=new Date().getFullYear();
  }
  return {bind,api,toast,money};
})();
document.addEventListener("DOMContentLoaded",FeeLoop.bind);
