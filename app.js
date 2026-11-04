// Desk app · plan B. Reads the STEP 7 JSON from /d/{DATA_PATH}/ (from #d= once, kept in localStorage).
// Every FOMO link is the exact string from the JSON (built by links.py). Settings, pause and mode are read-only here.
(() => {
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const RM = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const LOCAL = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
const SIM = LOCAL ? new URLSearchParams(location.search).get('sim') : null;     // screenshot harness only
const COLORS = {scanner:'#64d2ff', auditor:'#ffffff', analyst:'#ffd60a', executor:'#00d35a', risk:'#ff6b9a'};
const NAMES = {scanner:'Scanner', auditor:'Auditor', analyst:'Analyst', executor:'Executor', risk:'Risk'};
const ORDER = ['scanner','auditor','analyst','executor','risk'];
const RANGES = ['LIVE','1H','4H','1D','1W','ALL'];

// ---- DATA_PATH ----
const m = location.hash.match(/[#&]d=([A-Za-z0-9]{32,})/);
if (m) { localStorage.setItem('desk_d', m[1]); const go = (location.hash.match(/[#&]go=([^&]+)/) || [])[1]; history.replaceState(null, '', location.pathname + location.search + '#' + (go ? decodeURIComponent(go) : '/home')); }
const D = localStorage.getItem('desk_d');
if (!D) { $('#connect').hidden = false; $('#tabs').hidden = true; return; }
const BASE = 'd/' + D + '/';

// ---- store + fetch ----
const S = {state:null, chart:{}, activity:null, agents:{}, coin:{}, audit:{}, account:null, settings:null};
let lastOk = null, failing = false, wait = 15, timer = null, round = 0, range = localStorage.getItem('desk_range') || 'LIVE';
async function get(name) {
  if (SIM === 'loading') return new Promise(() => {});
  if (SIM === 'error' && round > 0) throw new Error('offline');
  const r = await fetch(BASE + name + '?t=' + Date.now(), {cache: 'no-store'});
  if (!r.ok) throw new Error(r.status);
  return r.json();
}
async function refresh() {
  clearTimeout(timer);
  const route = parse();
  const jobs = [['state.json', j => S.state = j], [`chart/${range}.json`, j => S.chart[range] = j], ['activity.json', j => S.activity = j]];
  if (route.v === 'agents' || route.v === 'home') ORDER.forEach(a => jobs.push([`agents/${a}.json`, j => S.agents[a] = j]));
  if (route.v === 'account' || route.v === 'agents' || route.v === 'coin') jobs.push(['account.json', j => S.account = j], ['settings.json', j => S.settings = j]);
  if (route.v === 'coin') jobs.push([`coin/${route.id}.json`, j => S.coin[route.id] = j, true], [`audit/${route.id}.json`, j => S.audit[route.id] = j, true]);
  if (route.v === 'audit') jobs.push([`audit/${route.id}.json`, j => S.audit[route.id] = j, true], ['settings.json', j => S.settings = j]);
  try {
    await Promise.all(jobs.map(([n, set, optional]) => get(n).then(set).catch(e => { if (!optional) throw e; })));
    lastOk = Date.now(); failing = false; wait = 15;
  } catch (e) { failing = true; wait = Math.min(wait * 2, 120); }
  round++; render(); errRow();
  timer = setTimeout(refresh, (failing ? wait : (SIM ? 1 : 15)) * 1000);
}
let errTick = null;
function errRow() {
  const el = $('#err'); clearInterval(errTick);
  if (!failing) { el.hidden = true; return; }
  let n = wait; const show = () => { el.hidden = false;
    el.textContent = `Desk offline · retrying in ${n}s · last update ${lastOk ? new Date(lastOk).toLocaleTimeString([], {hour:'numeric', minute:'2-digit'}) : '—'}`; };
  show(); errTick = setInterval(() => { n = Math.max(0, n - 1); show(); }, 1000);
}

// ---- routing ----
function parse() { const p = (location.hash.replace(/^#\/?/, '') || 'home').split('/'); return {v: p[0] || 'home', id: p[1]}; }
addEventListener('hashchange', () => { window.scrollTo(0, 0); render(); refresh(); });
document.querySelectorAll('#tabs a').forEach(a => a.onclick = () => location.hash = '#/' + a.dataset.tab);

// ---- helpers ----
const money = v => v == null ? 'n/a' : '$' + Number(v).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
const compact = v => v == null ? 'n/a' : '$' + (v >= 1e6 ? (v/1e6).toFixed(2) + 'M' : v >= 1e3 ? (v/1e3).toFixed(1) + 'K' : Number(v).toFixed(0));
const price = v => v == null ? 'n/a' : '$' + (v >= 1 ? v.toFixed(4) : v.toPrecision(4));
const hm = ts => new Date(ts * 1000).toLocaleTimeString([], {hour: 'numeric', minute: '2-digit'});
const pct = v => (v >= 0 ? '+' : '') + Number(v).toFixed(2) + '%';
const sk = (h, w = '100%', r = 12) => `<div class="sk" style="height:${h}px;width:${w};border-radius:${r}px;margin:8px 0"></div>`;
const short = mnt => mnt ? mnt.slice(0, 4) + '…' + mnt.slice(-4) : '';
function toast(t) { const d = document.createElement('div'); d.className = 'toast'; d.textContent = t; document.body.append(d); setTimeout(() => d.remove(), 1800); }
function odo(el, text) {
  if (RM()) { el.textContent = text; el.dataset.v = text; return; }
  const prev = el.dataset.v; el.dataset.v = text;
  if (!prev || prev.length !== text.length) {
    el.innerHTML = [...text].map(ch => /\d/.test(ch) ? `<span class="odo"><span class="col">${[...'0123456789'].map(d => `<i>${d}</i>`).join('')}</span></span>` : `<span>${esc(ch)}</span>`).join('');
    [...text].forEach((ch, i) => { const c = el.children[i].querySelector('.col'); if (c) { c.style.transition = 'none'; c.style.transform = `translateY(${-ch * 1.05}em)`; } });
    if (!prev) return;
  }
  const n = text.length;
  [...text].forEach((ch, i) => { const c = el.children[i] && el.children[i].querySelector('.col'); if (!c) return;
    if (prev[i] !== ch) { c.style.transition = `transform 600ms ease-out ${(n - 1 - i) * 30}ms`; c.style.transform = `translateY(${-ch * 1.05}em)`; } });
}
function nav() {
  const unread = (S.activity?.items || []).filter(i => i.ts > Number(localStorage.getItem('desk_seen') || 0)).length;
  return `<div class="nav"><a class="tap" href="#/account" aria-label="Account"><span class="avatar">${esc((S.account?.fomo_handle || 'A')[0].toUpperCase())}</span></a>
   <span class="brand">Grok Bot <span>›</span></span><span class="sp"></span>
   <button class="tap" id="q" aria-label="Search"><svg class="icon" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg></button>
   <a class="tap bell" href="#/activity" id="bell" aria-label="Notifications"><svg viewBox="0 0 24 24"><path d="M6 16V11a6 6 0 1 1 12 0v5l2 2H4zM10 21h4"/></svg>${unread ? '<i class="dot"></i>' : ''}</a></div>
   <input class="search" id="qs" placeholder="Name, symbol or mint" autocomplete="off"><div class="results" id="qr"></div>`;
}
function wireNav() {
  const q = $('#q'), qs = $('#qs'); if (!q) return;
  q.onclick = () => { qs.classList.toggle('on'); qs.focus(); };
  $('#bell').onclick = () => localStorage.setItem('desk_seen', String(Date.now() / 1000));
  qs.oninput = () => { const t = qs.value.trim().toLowerCase(); const seen = new Map();
    for (const a of ORDER) for (const d of S.agents[a]?.decisions || []) seen.set(d.mint, d.name);
    for (const i of S.activity?.items || []) if (i.mint) seen.set(i.mint, (i.title || '').replace(/^\w+ /, ''));
    $('#qr').innerHTML = t ? [...seen].filter(([mnt, nm]) => mnt.toLowerCase().includes(t) || (nm || '').toLowerCase().includes(t)).slice(0, 8)
      .map(([mnt, nm]) => `<a href="#/coin/${esc(mnt)}"><span>${esc(nm)}</span><span class="sp"></span><span class="ter">${short(mnt)}</span></a>`).join('') || '<div class="empty">No match</div>' : ''; };
}
function rows(items) {
  if (!items.length) return '<div class="empty">Nothing yet tonight</div>';
  return '<div class="rows">' + items.map(i => {
    const to = i.kind === 'rejected' ? `#/audit/${i.mint}` : `#/coin/${i.mint}`;
    const ic = {bought: '↓', sold: '↑', stopped: '!', rejected: '×'}[i.kind] || '·';
    const cls = i.kind === 'sold' ? 'up' : (i.kind === 'stopped' ? 'down' : (i.kind === 'rejected' ? 'ter' : ''));
    return `<a href="${to}"><span class="ic ${i.kind}">${ic}</span><span class="mid"><div class="t">${esc(i.title)}</div><div class="s">${esc(i.subtitle)}</div></span><span class="v ${cls}">${esc(i.value)}</span></a>`;
  }).join('') + '</div>';
}

// ---- agent cards (Home carousel) ----
function agentCard(c, dec) {
  const col = COLORS[c.name], s = S.state, ds = (dec?.decisions || []);
  let body = '';
  if (c.name === 'scanner') {
    body = `<div class="hl" style="color:${col}">${esc(c.title)}</div>` + (ds.length ? '<div class="feed">' + ds.slice(0, 5).map(d => d.verdict === 'kill'
      ? `<div class="k"><span class="n">${esc(d.name)}</span><span class="rs">${esc(d.reason)}</span></div>`
      : `<div><span>${esc(d.name)} · liq ${compact(d.liquidityUsd)}</span><span class="up">→ auditor</span></div>`).join('') + '</div>' : '<div class="sub">Listening for graduations</div>');
  } else if (c.name === 'auditor') {
    const last = ds[0], a = last && S.audit[last.mint];
    const strips = Array.from({length: 8}, (_, i) => { const l = a?.layers?.[i]; return `<i class="${l ? (l.pass === true ? 'ok' : l.pass === false ? 'no' : '') : ''}"></i>`; }).join('');
    body = `<div class="hl">${esc(c.title)}</div><div class="strips">${last ? strips : '<i></i>'.repeat(8)}</div>
      <div>${last ? (last.passed ? '8/8 → Executor' : esc(last.reason || 'taking apart...')) : '<span class="sub">No coin taken apart yet</span>'}</div>
      <div class="foot">${c.rejected} rejected</div>`;
  } else if (c.name === 'analyst') {
    const sc = c.lastScore, r = 54, C = 2 * Math.PI * r, on = sc != null && sc >= c.greenFrom;
    body = `<div class="hl" style="color:${col}">Scoring</div><svg class="ring" viewBox="0 0 140 140"><circle cx="70" cy="70" r="${r}" stroke="#2c2c2e" stroke-width="12" fill="none"/>
      <circle cx="70" cy="70" r="${r}" stroke="${on ? '#00d35a' : '#ffd60a'}" stroke-width="12" fill="none" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - (sc || 0) / 100)}" transform="rotate(-90 70 70)"/>
      <text x="70" y="80" text-anchor="middle" fill="#fff" font-size="34" font-weight="600" font-family="-apple-system">${sc ?? '—'}</text></svg>
      <div class="foot">${sc == null ? 'Waiting for a coin' : (c.lastPassed ? 'Passed · green from ' + c.greenFrom : 'Rejected · green from ' + c.greenFrom)}</div>`;
  } else if (c.name === 'executor') {
    const fresh = ds[0] && ds[0].status === 'bought' && ds[0].ts * 1000 > Date.now() - 20000;
    body = `<div class="hl" style="color:${col}">${esc(c.title)}</div><div class="sub">${esc(c.subtitle)}</div>
      <div class="bar"><i id="exbar" style="width:${ds.length ? 100 : 0}%"></i></div><div id="exlbl">${ds.length ? '✓ Filled' : '<span class="sub">Waiting for a pass</span>'}</div>
      ${s?.mode === 'PAPER' ? '<div class="foot"><span class="pill paper">PAPER</span></div>' : ''}`;
    if (fresh && !RM()) setTimeout(execBar, 0);
  } else {
    body = `<div class="hl" style="color:${col}">${esc(c.title)}</div><div>${esc(c.lastExit || (c.open ? c.open + ' open' : 'No exits yet'))}</div>
      <div class="foot"><span class="pill r">${esc(c.pills.stop)}</span><span class="pill g">${esc(c.pills.trail)}</span></div>`;
  }
  return `<div class="acard" style="border-radius:calc((100vw - 32px) * 42 / 504)"><div class="who"><b style="background:${col}"></b>${NAMES[c.name]}</div>${body}</div>`;
}
let execRan = false;
function execBar() { if (execRan) return; execRan = true; const b = $('#exbar'), l = $('#exlbl'); if (!b) return; const t0 = performance.now();
  const step = t => { const k = Math.min(1, (t - t0) / 1200); b.style.width = (k * 100) + '%'; l.textContent = k < 1 ? `Executing... ${Math.round(k * 100)}%` : '✓ Filled'; if (k < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step); }

// ---- screens ----
function home() {
  const s = S.state, ch = S.chart[range];
  if (!s) return nav() + sk(76, '70%') + sk(20, '40%') + sk(230) + sk(44) + sk(24, '50%') + `<div class="carousel">${'<div class="acard sk"></div>'.repeat(2)}</div>` + sk(60) + sk(60);
  const start = ch?.points?.[0]?.[1], marks = (ch?.marks || []).map(mk => mk.kind === 'bought'
    ? {ts: mk.ts, text: mk.title, color: '#0a84ff'}
    : mk.kind === 'sold' ? {ts: mk.ts, text: (mk.value || '').split(' / ')[0], color: '#00d35a'}
    : {ts: mk.ts, text: `${(mk.subtitle || '').replace('Risk · ', '').replace(' stop', '')} · ${mk.value}`, color: '#ff453a'});
  const empty = !(ch?.marks || []).length && !(S.activity?.items || []).some(i => i.kind !== 'rejected');
  return nav() + `<div class="balrow"><div class="big" id="bal"></div>${s.mode === 'PAPER' ? '<span class="pill paper">PAPER</span>' : ''}</div>
   <div class="today"><span class="${s.today_pct >= 0 ? 'up' : 'down'}">${pct(s.today_pct)}</span><span class="sub">today</span>
   <span class="pill g">${Number(s.multiplier).toFixed(2)}×</span></div>
   <canvas class="chart" id="cv"></canvas>${empty ? '<div class="sub" style="text-align:center;margin-top:-120px;margin-bottom:96px">Waiting for the first trade</div>' : ''}
   <div class="ranges">${RANGES.map(r => `<button data-r="${r}" class="${r === range ? 'on' : ''}">${r}</button>`).join('')}</div>
   <h3>Agents · ${s.agents.length} running</h3>
   <div class="carousel">${ORDER.map(n => agentCard(s.agents.find(a => a.name === n), S.agents[n])).join('')}</div>
   <h3>Activity<span class="sp"></span><a href="#/activity">See all</a></h3>${rows((S.activity?.items || []).slice(0, 5))}`
   + `<script type="x">${start}</script>`.slice(0, 0) + (home.after = () => {
     odo($('#bal'), money(s.balance));
     if (ch) DeskChart.Line.draw($('#cv'), ch.points, start, marks);
     document.querySelectorAll('.ranges button').forEach(b => b.onclick = () => { range = b.dataset.r; localStorage.setItem('desk_range', range); render(); refresh(); });
   }, '');
}
function agentsTab() {
  const s = S.state; if (!s) return '<h1>Agents</h1>' + sk(180) + sk(180) + sk(180);
  const open = s.agents.find(a => a.name === 'risk').open;
  return '<h1>Agents</h1>' + ORDER.map(n => {
    const c = s.agents.find(a => a.name === n), ds = S.agents[n]?.decisions;
    const locked = n === 'risk' && open > 0;
    const list = !ds ? sk(44) + sk(44) : !ds.length ? `<div class="empty">${n === 'scanner' ? 'Listening for graduations' : 'No decisions yet tonight'}</div>` : ds.map(d => {
      const v = d.verdict || (d.passed === true ? 'pass' : d.passed === false ? 'reject' : d.status || d.reason);
      const r = d.reason || (d.score != null ? 'score ' + d.score : d.pnlUsd != null ? money(d.pnlUsd) : d.sizeUsd != null ? money(d.sizeUsd) : '');
      return `<div class="dec"><span class="ter">${hm(d.ts)}</span><span><a class="link" href="${esc(d.link)}" target="_blank" rel="noopener">${esc(d.name)}</a> · <span class="${/pass|bought|trail/.test(v) ? 'up' : 'down'}">${esc(v)}</span></span><span class="r">${esc(r)}</span></div>`; }).join('');
    return `<div class="card"><div class="hd"><span class="sdot"></span><b style="color:${COLORS[n]}">${NAMES[n]}</b><span class="sub">· ${esc(c.title)}</span><span class="sp"></span>
      <span class="switch on" title="read-only"></span></div>
      <div class="ro">${locked ? 'Locked while a position is open' : `Running · to pause send <span class="cmd">pause ${n}</span>, to resume <span class="cmd">resume ${n}</span>`}</div>
      ${list}<a class="link" href="#/account" data-sec="${n}">Settings ›</a></div>`; }).join('');
}
function activityTab() {
  const a = S.activity; if (!a) return '<h1>Activity</h1>' + sk(60) + sk(60) + sk(60) + sk(60);
  localStorage.setItem('desk_seen', String(Date.now() / 1000));
  return '<h1>Activity</h1>' + rows(a.items) + (a.next ? `<button class="btn" style="background:#2c2c2e;color:#fff" id="more">Load more</button>` : '')
    + ((activityTab.after = () => { const b = $('#more'); if (b) b.onclick = async () => { try { const n = await get(a.next); a.items = a.items.concat(n.items); a.next = n.next; render(); } catch (e) { toast('Could not load more'); } }; }), '');
}
function coinScreen(id) {
  const c = S.coin[id], au = S.audit[id], set = S.settings?.settings;
  const head = `<a class="back" href="javascript:history.back()">‹ Back</a>`;
  if (!c) return head + (round > 0 ? `<div class="empty">This coin isn't in tonight's data</div>` : sk(40, '60%') + sk(60, '50%') + sk(240) + sk(120));
  const p = c.position, open = p && p.closedAt == null, since = p && c.price ? 100 * (c.price / p.entryPrice - 1) : null;
  const age = c.stats.migratedAt ? Math.round((Date.now() / 1000 - c.stats.migratedAt) / 3600) + 'h old' : '';
  const shield = au ? (au.passed ? '<span class="chip">🛡 8/8</span>' : `<span class="chip r">🛡 ${au.layersChecked - 1}/8</span>`) : '';
  let exit = '';
  if (open && set) { const left = p.openedAt + set['risk.timeout_h'].value * 3600 - Date.now() / 1000;
    const trail = p.trailActive ? p.peakPrice * (1 - set['risk.trail_pct'].value / 100) : p.entryPrice * (1 + set['risk.trail_start_pct'].value / 100);
    exit = `<div class="card"><div class="sub">Your position · ${money(p.sizeUsd)} in · Executor</div>
      <div class="vrow"><span class="nm">Stop line</span><span class="down">${price(p.stopPrice)}</span></div>
      <div class="vrow"><span class="nm">${p.trailActive ? 'Trail line' : 'Trail starts at'}</span><span class="up">${price(trail)}</span></div>
      <div class="vrow"><span class="nm">Time left to timeout</span><span>${left > 0 ? Math.floor(left / 3600) + 'h ' + Math.floor(left % 3600 / 60) + 'm' : 'now'}</span></div></div>`; }
  return head + `<div class="hd" style="display:flex;align-items:center;gap:8px"><h1 style="margin:0">${esc(c.name)}</h1>${S.state?.mode === 'PAPER' ? '<span class="pill paper">PAPER</span>' : ''}</div>
    <div class="sub" style="display:flex;gap:8px;align-items:center;margin:4px 0 10px">${esc(c.symbol || '')} · Solana · ${age} ${shield}</div>
    <div class="big" style="font-size:48px">${price(c.price)}</div>
    ${since != null ? `<div class="${since >= 0 ? 'up' : 'down'}">${since >= 0 ? '▲' : '▼'} ${Math.abs(since).toFixed(2)}% since entry</div>` : ''}
    <canvas id="cc" style="height:260px;margin:14px 0"></canvas>
    <div class="stats"><div><span>Market cap</span>${compact(c.stats.marketCap)}</div><div><span>Liquidity</span>${compact(c.stats.liquidityUsd)}</div>
      <div><span>24h volume</span>${compact(c.stats.volumeH24)}</div><div><span>Holders</span>${c.stats.holders ? Number(c.stats.holders).toLocaleString() : 'n/a'}</div></div>
    <div style="margin-top:12px">${exit}</div>
    <a class="btn ${open ? 'sell' : ''}" href="${esc(c.coin_url)}" target="_blank" rel="noopener">${open ? 'Sell on FOMO' : 'Buy on FOMO'}</a>`
    + ((coinScreen.after = () => DeskChart.Candles.draw($('#cc'), c.candles, c.exitLines.map(l => ({...l, color: l.color === 'orange' ? '#ff9f0a' : '#00d35a'})))), '');
}
let beamFor = null;
function auditScreen(id) {
  const a = S.audit[id], head = `<a class="back" href="javascript:history.back()">‹ Back</a>`;
  const discs = n => Array.from({length: 8}, (_, i) => `<div class="disc" id="dk${i}" style="top:${i * 27}px;z-index:${8 - i}">${n ? '' : ''}</div>`).join('');
  if (!a) return head + (round > 0 ? '<h1>Auditor</h1><div class="empty">No coin taken apart yet</div>' : '<h1>Auditor</h1><div class="discs">' + discs() + '<div class="beam" style="top:0;opacity:1" id="beam"></div></div>' + sk(44) + sk(44) + sk(44));
  const en = S.settings?.settings?.['auditor.enabled']?.value ?? true;
  const name = esc(a.name);
  return head + `<h1>${name}</h1><div class="discs">${discs()}<div class="beam" id="beam"></div></div>
    <div id="verdict"></div>
    ${a.layers.map((l, i) => `<div class="vrow" id="vr${i}"><span class="nm">${l.n}. ${esc(l.name)}</span><span class="${l.pass === true ? 'up' : l.pass === false ? 'down' : 'ter'}">${esc(l.value)}</span></div>`).join('')}
    <div class="vrow"><span>Take apart before buying</span><span class="switch ${en ? 'on' : ''}"></span></div>
    <div class="ro">Read-only here · change with <span class="cmd">set auditor.enabled off</span> (asks twice)</div>
    <a class="btn" href="${esc(a.coin_url)}" target="_blank" rel="noopener">Open on FOMO</a>`
    + ((auditScreen.after = () => beam(a)), '');
}
function beam(a) {
  const verdict = () => $('#verdict').innerHTML = a.passed
    ? `<div class="verdict up">Cleared · 8/8 parts</div><div class="sub">Sent to Executor${S.agents.executor?.decisions?.find(d => d.mint === a.mint)?.sizeUsd ? ' · ' + money(S.agents.executor.decisions.find(d => d.mint === a.mint).sizeUsd) : ''}</div>`
    : `<div class="verdict down">Rejected · ${esc(a.reason)}</div><div class="sub">Grok Bot won't buy ${esc(a.name)}</div>`;
  const mark = i => { const l = a.layers[i], d = $('#dk' + i); if (!d) return; if (l.pass === true) { d.classList.add('ok'); d.textContent = '✓'; } else if (l.pass === false) { d.classList.add('no'); d.textContent = '✕'; } else d.textContent = '·'; };
  if (RM() || beamFor === a.mint + a.ts) { a.layers.forEach((_, i) => mark(i)); verdict(); return; }
  beamFor = a.mint + a.ts; const b = $('#beam'); b.style.opacity = 1; let i = 0;
  const next = () => { if (i >= a.layers.length || a.layers[i].pass === null) { b.style.opacity = 0; a.layers.forEach((_, k) => mark(k)); verdict(); return; }
    b.style.top = (i * 27 + 15) + 'px'; setTimeout(() => setTimeout(() => { mark(i); i++; next(); }, 150), 350); };
  next();
}
function accountTab() {
  const ac = S.account, st = S.settings;
  if (!ac || !st) return '<h1>Account</h1>' + sk(52) + sk(52) + sk(52) + sk(200);
  const groups = {};
  for (const [k, v] of Object.entries(st.settings)) { const g = k.split('.')[0]; (groups[g] = groups[g] || []).push([k, v]); }
  const title = {scanner: 'Scanner', auditor: 'Auditor', analyst: 'Analyst', executor: 'Executor', risk: 'Risk', desk: 'Desk'};
  const setRow = ([k, v]) => {
    const cmd = `<span class="cmd">set ${esc(k)} ${esc(v.value)}</span>`;
    if (typeof v.value === 'number' && v.min != null) return `<div class="set"><label>${esc(k.split('.').slice(1).join('.'))}</label><input type="number" value="${v.value}" disabled>
      <input type="range" min="${v.min}" max="${v.max}" step="${Number.isInteger(v.value) ? 1 : 0.01}" value="${v.value}" disabled><div class="ro" style="grid-column:1/3">${cmd}</div></div>`;
    return `<div class="set"><label>${esc(k.split('.').slice(1).join('.'))}</label><input class="field" value="${esc(v.value)}" disabled><div class="ro" style="grid-column:1/3">${v.choices ? 'one of ' + v.choices.map(esc).join(' / ') + ' · ' : ''}${cmd}</div></div>`;
  };
  return `<h1>Account</h1>
   <div class="card"><div class="vrow"><span>Mode</span><span class="pill ${ac.mode === 'PAPER' ? 'paper' : ''}">${esc(ac.mode)}</span></div>
     <div class="ro">Switch with <span class="cmd">paper</span> or <span class="cmd">live</span> (then type LIVE to confirm)</div>
     <div class="vrow"><span>Stack</span><input class="field" value="${money(ac.stack)}" disabled></div><div class="ro">Change with <span class="cmd">stack 1240</span></div></div>
   <div class="card rows">
     <a href="${esc(ac.profile_url)}" target="_blank" rel="noopener"><span class="mid"><div class="t">Your FOMO profile</div><div class="s">@${esc(ac.fomo_handle)}</div></span><span class="ter">›</span></a>
     <a href="#" id="invite"><span class="mid"><div class="t">Invite a friend</div><div class="s">Share your FOMO invite</div></span><span class="ter">›</span></a></div>
   <div class="card"><div class="vrow"><span>Notifier</span><span class="up">${esc(ac.notifier === 'discord' ? 'Discord · connected' : ac.notifier)}</span></div>
     <div class="vrow"><span>Send test push</span><span class="cmd">status</span></div>
     <div class="vrow"><span>Push notifications</span><span class="sub">Not available</span></div><div class="ro">${esc(ac.push.note)}</div></div>
   <h3>Settings</h3><div class="ro">Read-only on plan B. Each row shows the command to send.</div>
   ${Object.entries(groups).map(([g, list]) => `<div class="group" id="sec-${g}"><h4>${title[g] || g}</h4>${list.map(setRow).join('')}</div>`).join('')}`
   + ((accountTab.after = () => { $('#invite').onclick = async e => { e.preventDefault(); const url = ac.signup_url;
       try { if (navigator.share) { await navigator.share({title: 'FOMO', url}); return; } } catch (x) { return; }
       try { await navigator.clipboard.writeText(url); } catch (x) { const t = document.createElement('textarea'); t.value = url; document.body.append(t); t.select(); document.execCommand('copy'); t.remove(); }
       toast('Link copied'); };
     const sec = sessionStorage.getItem('desk_sec'); if (sec) { sessionStorage.removeItem('desk_sec'); const el = $('#sec-' + sec); if (el) el.scrollIntoView(); } }), '');
}
document.addEventListener('click', e => { const a = e.target.closest('[data-sec]'); if (a) sessionStorage.setItem('desk_sec', a.dataset.sec); });

function render() {
  const r = parse(), app = $('#app');
  document.querySelectorAll('#tabs a').forEach(a => a.classList.toggle('on', a.dataset.tab === r.v));
  const f = {home, agents: agentsTab, activity: activityTab, account: accountTab, coin: () => coinScreen(r.id), audit: () => auditScreen(r.id)}[r.v] || home;
  const fn = {home, agents: agentsTab, activity: activityTab, account: accountTab, coin: coinScreen, audit: auditScreen}[r.v] || home;
  fn.after = null; app.innerHTML = f(); wireNav(); if (fn.after) fn.after();
}
addEventListener('resize', () => render());
render(); refresh();
if ('serviceWorker' in navigator && !LOCAL) navigator.serviceWorker.register('sw.js');
})();
