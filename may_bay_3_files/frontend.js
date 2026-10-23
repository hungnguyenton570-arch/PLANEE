/* Máy Bay / Aviator demo frontend — vanilla JavaScript.
   Serve this file at /frontend.js from the same origin as backend.py.
   No real-money features; points are virtual. */
(() => {
  const style = document.createElement("style");
  style.textContent = `
  *{box-sizing:border-box}body{margin:0;background:#101114;color:#eee;font:14px Arial,sans-serif}
  button,input{font:inherit}button{cursor:pointer;border:0;border-radius:8px;padding:11px 15px;font-weight:bold}
  input{background:#1b1d22;color:#fff;border:1px solid #383b43;padding:11px;border-radius:7px;width:100%;margin:5px 0 12px}
  .shell{max-width:1180px;margin:auto;padding:16px}.top{display:flex;justify-content:space-between;align-items:center;background:#191a1e;padding:14px 18px;border-radius:10px;margin-bottom:12px}
  .brand{color:#f05c67;font-size:25px;font-weight:900;font-style:italic}.muted{color:#9b9da6}.layout{display:grid;grid-template-columns:260px 1fr;gap:12px}
  .panel{background:#191a1e;border:1px solid #292b31;border-radius:12px;padding:14px;min-width:0}
  .auth{max-width:420px;margin:8vh auto}.auth h1{color:#f05c67}.row{display:flex;gap:8px;align-items:center}.row>*{flex:1}
  .primary{background:#50a83e;color:white}.secondary{background:#30333a;color:white}.danger{background:#bd3946;color:white}
  .screen{height:340px;border-radius:12px;position:relative;overflow:hidden;background:repeating-conic-gradient(from 15deg at 50% 100%,#191a20 0deg 10deg,#0b0c0f 10deg 20deg);display:flex;flex-direction:column;align-items:center;justify-content:center}
  .screen:before{content:"";position:absolute;inset:0;background:radial-gradient(ellipse at 50% 100%,transparent 0%,#0008 75%);pointer-events:none}
  .status{position:absolute;top:0;left:0;right:0;text-align:center;background:#d68b35;padding:5px;font-size:11px;font-weight:bold}
  .mult{font-size:clamp(48px,8vw,78px);font-weight:900;color:#e94855;z-index:1;text-shadow:0 2px 14px #000}.message{z-index:1;font-size:22px;margin-bottom:10px}
  .controls{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px}.betbox{background:#202228;padding:12px;border-radius:10px}
  .betbox button{width:100%;margin-top:6px}.chips{display:flex;gap:6px}.chips button{padding:7px;flex:1}
  .history{display:flex;gap:7px;overflow:auto;margin:10px 0}.pill{background:#292b32;padding:6px 9px;border-radius:20px;white-space:nowrap}
  .green{color:#6ac65a}.red{color:#f15d68}.players{max-height:65vh;overflow:auto}.player{padding:9px 0;border-bottom:1px solid #2a2c32;display:flex;justify-content:space-between;gap:8px}
  .hide{display:none!important}.notice{padding:10px;background:#24262c;border-radius:8px;margin:8px 0}.tabs{display:flex;gap:8px;margin:8px 0}
  table{width:100%;border-collapse:collapse}td,th{text-align:left;padding:8px;border-bottom:1px solid #34363c;overflow-wrap:anywhere}
  @media(max-width:760px){.layout{grid-template-columns:1fr}.players{max-height:260px}.screen{height:280px}.controls{grid-template-columns:1fr}.top{gap:10px;flex-wrap:wrap}}
  `;
  document.head.appendChild(style);
  document.body.innerHTML = `
  <div class="shell">
    <header class="top"><div class="brand">✈ Aviator</div><div id="account">Chưa đăng nhập</div><button id="logout" class="secondary hide">Đăng xuất</button></header>
    <section id="auth" class="panel auth">
      <h1>Máy Bay</h1><p class="muted">Game giải trí bằng điểm ảo</p>
      <div class="tabs"><button id="loginTab" class="primary">Đăng nhập</button><button id="registerTab" class="secondary">Đăng ký</button></div>
      <form id="authForm"><label>Tên tài khoản</label><input id="username" minlength="3" maxlength="24" required autocomplete="username">
      <label>Mật khẩu</label><input id="password" type="password" minlength="8" required autocomplete="current-password">
      <button class="primary" type="submit" style="width:100%">Đăng nhập</button></form><div id="authMsg" class="notice hide"></div>
    </section>
    <section id="game" class="hide">
      <div class="layout">
        <aside class="panel"><b>Người chơi</b><p class="muted">Điểm ảo trong phiên</p><div id="myStats"></div><div class="players" id="players"></div></aside>
        <main>
          <div class="panel">
            <div class="row"><span class="muted">PHIÊN <b id="roundId">—</b></span><span class="muted" style="text-align:right">Điểm: <b id="balance">—</b></span></div>
            <div class="history" id="history"></div>
            <div class="screen"><div class="status" id="phase">ĐANG KẾT NỐI</div><div class="message" id="message">Sẵn sàng?</div><div class="mult" id="mult">1.00x</div></div>
            <div class="controls">
              <div class="betbox"><div class="row"><b>CƯỢC 1</b><span class="muted" id="betState1">Chưa đặt</span></div>
                <label>Số điểm cược</label><input id="amount1" type="number" min="1" step="1" value="100">
                <div class="chips"><button class="secondary" data-add="amount1" data-value="10">+10</button><button class="secondary" data-add="amount1" data-value="50">+50</button><button class="secondary" data-add="amount1" data-value="100">+100</button></div>
                <button id="bet1" class="primary">Đặt cược</button><button id="cash1" class="danger hide">CHỐT ĐIỂM</button>
              </div>
              <div class="betbox"><div class="row"><b>CƯỢC 2</b><span class="muted" id="betState2">Chưa đặt</span></div>
                <label>Số điểm cược</label><input id="amount2" type="number" min="1" step="1" value="50">
                <div class="chips"><button class="secondary" data-add="amount2" data-value="10">+10</button><button class="secondary" data-add="amount2" data-value="50">+50</button><button class="secondary" data-add="amount2" data-value="100">+100</button></div>
                <button id="bet2" class="primary">Đặt cược</button><button id="cash2" class="danger hide">CHỐT ĐIỂM</button>
              </div>
            </div><div id="gameMsg" class="notice">Chờ phiên tiếp theo…</div>
          </div>
          <div id="admin" class="panel hide" style="margin-top:12px"><h3>🛠 Bảng quản trị</h3><div id="adminStats"></div>
            <h4>Tài khoản</h4><div style="overflow:auto"><table><thead><tr><th>Tài khoản</th><th>Điểm</th><th>Thắng</th><th>Thua</th><th>Cộng điểm</th></tr></thead><tbody id="adminUsers"></tbody></table></div>
            <p class="muted">Chỉ tài khoản quản trị được phép cộng điểm. Mọi thay đổi được ghi vào nhật ký.</p>
          </div>
        </main>
      </div>
    </section>
  </div>`;
  const $ = id => document.getElementById(id);
  let token = sessionStorage.getItem("mb_token") || "";
  let mode = "login", me = null, phase = "waiting", currentRound = null, placed = [false,false], cashed = [false,false];
  let poller = null, seenRound = null;

  async function api(path, opts={}) {
    const res = await fetch(path, { ...opts, headers: {"Content-Type":"application/json", ...(token?{Authorization:"Bearer "+token}:{}), ...(opts.headers||{})} });
    const data = await res.json().catch(()=>({error:"Phản hồi máy chủ không hợp lệ"}));
    if (!res.ok) throw new Error(data.error || "Có lỗi xảy ra");
    return data;
  }
  function msg(s){$("gameMsg").textContent=s}
  function authMsg(s){$("authMsg").textContent=s;$("authMsg").classList.remove("hide")}
  function setMode(m){mode=m;$("loginTab").className=m==="login"?"primary":"secondary";$("registerTab").className=m==="register"?"primary":"secondary";$("authForm").querySelector("button[type=submit]").textContent=m==="login"?"Đăng nhập":"Tạo tài khoản";$("password").autocomplete=m==="login"?"current-password":"new-password"}
  $("loginTab").onclick=()=>setMode("login");$("registerTab").onclick=()=>setMode("register");
  $("authForm").onsubmit=async e=>{e.preventDefault();try{const d=await api("/api/"+mode,{method:"POST",body:JSON.stringify({username:$("username").value.trim(),password:$("password").value})});token=d.token;sessionStorage.setItem("mb_token",token);await start()}catch(err){authMsg(err.message)}};
  $("logout").onclick=()=>{clearInterval(poller);token="";me=null;sessionStorage.removeItem("mb_token");$("game").classList.add("hide");$("auth").classList.remove("hide");$("logout").classList.add("hide");$("account").textContent="Chưa đăng nhập"};
  document.querySelectorAll("[data-add]").forEach(b=>b.onclick=()=>{const el=$(b.dataset.add);el.value=Math.max(1,Number(el.value||0)+Number(b.dataset.value))});
  async function start(){ $("auth").classList.add("hide");$("game").classList.remove("hide");$("logout").classList.remove("hide");try{await refresh();clearInterval(poller);poller=setInterval(refresh,500)}catch(e){$("auth").classList.remove("hide");$("game").classList.add("hide");authMsg(e.message)}}
  async function refresh(){
    try {
      const d=await api("/api/state"); me=d.me; currentRound=d.round; phase=d.round.phase;
      $("account").textContent=`${me.username}${me.is_admin?" · ADMIN":""}`;$("balance").textContent=me.points.toLocaleString();
      $("roundId").textContent=d.round.id;$("phase").textContent=phase==="waiting"?`ĐẶT CƯỢC · ${d.round.seconds_left}s`:phase==="flying"?"MÁY BAY ĐANG BAY":"PHIÊN ĐÃ KẾT THÚC";
      $("mult").textContent=Number(d.round.multiplier).toFixed(2)+"x";
      $("message").textContent=phase==="waiting"?"ĐẶT CƯỢC TRƯỚC KHI BAY":phase==="flying"?"ĐỪNG QUÊN CHỐT ĐIỂM":"MÁY BAY ĐÃ RỜI ĐI!";
      $("history").innerHTML=(d.history||[]).map(x=>`<span class="pill ${x.crash>=2?"green":"red"}">${Number(x.crash).toFixed(2)}x</span>`).join("");
      $("myStats").innerHTML=`<p>Điểm: <b>${me.points.toLocaleString()}</b></p><p>Thắng: <b class="green">${me.wins}</b> · Thua: <b class="red">${me.losses}</b></p><p class="muted">Tỷ lệ thắng: ${me.played?((me.wins/me.played)*100).toFixed(1):"0.0"}%</p>`;
      $("players").innerHTML=(d.leaderboard||[]).map(p=>`<div class="player"><span>${escapeHtml(p.username)}</span><b>${Number(p.points).toLocaleString()}</b></div>`).join("");
      if(seenRound!==d.round.id){seenRound=d.round.id;placed=[false,false];cashed=[false,false];[1,2].forEach(n=>{$("betState"+n).textContent="Chưa đặt";$("bet"+n).classList.remove("hide");$("cash"+n).classList.add("hide")})}
      [1,2].forEach(n=>{const bet=(d.my_bets||[]).find(b=>b.slot===n);if(bet){placed[n-1]=true;$("betState"+n).textContent=bet.cashed_out?`Đã chốt ${bet.payout} điểm`:bet.settled?(bet.payout?`+${bet.payout} điểm`:"Mất cược"): `Đã cược ${bet.amount}`;if(bet.cashed_out)cashed[n-1]=true;if(phase==="flying"&&!bet.cashed_out&&!bet.settled){$("bet"+n).classList.add("hide");$("cash"+n).classList.remove("hide")}else{$("cash"+n).classList.add("hide");$("bet"+n).classList.toggle("hide",placed[n-1])}}else if(phase!=="waiting"){$("bet"+n).classList.add("hide");$("cash"+n).classList.add("hide")}});
      msg(phase==="waiting"?`Bạn có ${d.round.seconds_left} giây để đặt cược. Mỗi lượt cược dùng điểm ảo.`:phase==="flying"?"Máy bay đang bay — chốt điểm trước khi phiên kết thúc!":"Phiên đã kết thúc. Điểm được cập nhật tự động.");
      $("admin").classList.toggle("hide",!me.is_admin);
      if(me.is_admin) renderAdmin(d.admin);
    } catch(e) { if(e.message.toLowerCase().includes("token")||e.message.toLowerCase().includes("đăng nhập"))$("logout").click(); }
  }
  function renderAdmin(a){if(!a)return;$("adminStats").innerHTML=`<p>Tổng tài khoản: <b>${a.total_users}</b> · Tổng điểm: <b>${a.total_points}</b> · Tổng cược: <b>${a.total_wagered}</b></p>`;
    $("adminUsers").innerHTML=a.users.map(u=>`<tr><td>${escapeHtml(u.username)}</td><td>${u.points}</td><td>${u.wins}</td><td>${u.losses}</td><td><input type="number" min="1" max="1000000" id="grant-${u.id}" value="100"><button class="primary" data-grant="${u.id}">Cộng</button></td></tr>`).join("");
    $("adminUsers").querySelectorAll("[data-grant]").forEach(b=>b.onclick=async()=>{const amount=Number($("grant-"+b.dataset.grant).value);if(!Number.isInteger(amount)||amount<1||amount>1000000)return alert("Nhập số điểm từ 1 đến 1.000.000");try{await api("/api/admin/grant",{method:"POST",body:JSON.stringify({user_id:Number(b.dataset.grant),amount})});msg("Đã gửi yêu cầu cộng điểm.");await refresh()}catch(e){alert(e.message)}});
  }
  [1,2].forEach(n=>{
    $("bet"+n).onclick=async()=>{try{const amount=Number($("amount"+n).value);if(!Number.isInteger(amount)||amount<1)throw Error("Cược phải là số nguyên dương");await api("/api/bet",{method:"POST",body:JSON.stringify({amount,slot:n})});placed[n-1]=true;msg("Đã đặt cược.");await refresh()}catch(e){msg(e.message)}};
    $("cash"+n).onclick=async()=>{try{const d=await api("/api/cashout",{method:"POST",body:JSON.stringify({slot:n})});cashed[n-1]=true;msg(`Đã chốt ở ${d.multiplier.toFixed(2)}x — nhận ${d.payout} điểm!`);await refresh()}catch(e){msg(e.message)}};
  });
  function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
  setMode("login");if(token)start();
})();
