// app.js — หน้าวิเคราะห์ (อ่านจาก view ในฐานข้อมูล · หน้าเว็บแค่แสดง) · หน้า: ภาพรวม · Creator · สินค้าที่ส่ง · สต็อก · เงินเข้า · อัปโหลด
// กฎที่ยกมาจากระบบต้นแบบ: ยอดเงินเต็มจำนวน ไม่มี ฿ · ⓘ ทุกตัวเลขบอกรวม / ไม่รวม · แถวรวมล่างสุด = ตัวเลขในแถบบน · สีเขียว / แดงใช้เมื่อหมายถึงดี / ไม่ดีเท่านั้น
const PAGES = [['overview', 'ภาพรวม'], ['creators', 'Creator'], ['products', 'สินค้าที่ส่ง'], ['items', 'รายละเอียดออเดอร์'], ['stock', 'สต็อก'], ['money', 'เงินเข้า'], ['upload', 'อัปโหลด']];
const fmt = v => (Math.round(+v || 0) || 0).toLocaleString('en-US');   // || 0 กัน "-0"
const fmt1 = v => (+v || 0).toLocaleString('en-US', { maximumFractionDigits: 1 });
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const tip = t => `<span class="pr-i" data-tip="${esc(t.replace(/<br\s*\/?>/g, '\n').replace(/<\/?b>/g, ''))}" style="font-size:11px;color:var(--text3);font-weight:400;cursor:default;">ⓘ</span>`;
const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const dTh = s => new Date(s + 'T00:00:00').toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
const days = (a, b) => { const out = []; for (let d = new Date(a + 'T00:00:00'); ymd(d) <= b; d.setDate(d.getDate() + 1)) out.push(ymd(d)); return out; };
const SRC_COLOR = { 'ร้าน · Live': '#E11D48', 'ร้าน · คลิป': '#0D9488', 'ร้าน · หน้าสินค้า': '#64748B', 'Creator · Live': '#FB7185', 'Creator · คลิป': '#2DD4BF', 'Creator · หน้าสินค้า': '#A78BFA' };
const srcColor = s => SRC_COLOR[s] || '#F59E0B';
let RANGE = { from: '', to: '' }, CHARTS = {};

function toggleTheme() { const on = document.body.classList.toggle('light-theme'); localStorage.setItem('theme', on ? 'light' : 'dark'); route(); }
if (localStorage.getItem('theme') !== 'dark') document.body.classList.add('light-theme');

// ===== ช่วงวันที่: ปุ่มเดียวบนแถบบน · กดแล้วมีช่วงลัด (ซ้าย) + ปฏิทิน 2 เดือน (ขวา) · ปีแสดงเป็น พ.ศ. =====
const TH_M = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const TH_ML = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
const TH_WD = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
const pDate = s => new Date(s + 'T00:00:00');
const dLong = s => { const d = pDate(s); return `${d.getDate()} ${TH_M[d.getMonth()]} ${d.getFullYear() + 543}`; };
const dFull = s => pDate(s).toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
function rangeText(a, b) {
  const x = pDate(a), y = pDate(b);
  if (a === b) return dLong(a);
  if (x.getFullYear() !== y.getFullYear()) return `${dLong(a)} – ${dLong(b)}`;
  return x.getMonth() === y.getMonth() ? `${x.getDate()} – ${y.getDate()} ${TH_M[y.getMonth()]} ${y.getFullYear() + 543}` : `${x.getDate()} ${TH_M[x.getMonth()]} – ${y.getDate()} ${TH_M[y.getMonth()]} ${y.getFullYear() + 543}`;
}
function presets() {
  const n = new Date(), y = n.getFullYear(), m = n.getMonth(), d = n.getDate(), D = (a, b, c) => ymd(new Date(a, b, c));
  return { 'วันนี้': [D(y, m, d), D(y, m, d)], 'เมื่อวาน': [D(y, m, d - 1), D(y, m, d - 1)], '7 วันล่าสุด': [D(y, m, d - 6), D(y, m, d)],
    '30 วันล่าสุด': [D(y, m, d - 29), D(y, m, d)], 'เดือนนี้': [D(y, m, 1), D(y, m, d)], 'เดือนก่อน': [D(y, m - 1, 1), D(y, m, 0)] };
}
const presetOf = (a, b) => { const p = presets(); return ['เดือนนี้', 'เดือนก่อน', ...Object.keys(p)].find(k => p[k][0] === a && p[k][1] === b) || ''; };   // ตรงหลายช่วง (เช่น 1–7 = เดือนนี้ = 7 วัน) ใช้ชื่อเดือนก่อน
const CAL_ICON = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>';
function drawRangeBtn() {
  const t = presetOf(RANGE.from, RANGE.to), b = document.getElementById('rpBtn');
  b.innerHTML = `${CAL_ICON}${t ? `<span class="rp-tag">${t}</span>` : ''}<span class="rp-txt">${rangeText(RANGE.from, RANGE.to)}</span><i class="rp-car"></i>`;
}
function setRange(a, b) { if (b < a) [a, b] = [b, a]; RANGE = { from: a, to: b }; drawRangeBtn(); route(); }
let RP = null;   // กล่องเลือกช่วงที่เปิดอยู่: { pop, a, b, hover, view }
function closeRP() { if (!RP) return; RP.pop.remove(); RP = null; document.getElementById('rpBtn').setAttribute('aria-expanded', 'false'); }
function monthHTML(y, m) {
  const lead = new Date(y, m, 1).getDay(), n = new Date(y, m + 1, 0).getDate(), today = ymd(new Date());
  let cells = '<span></span>'.repeat(lead);
  for (let d = 1; d <= n; d++) { const s = ymd(new Date(y, m, d)); cells += `<button type="button" class="rp-d${s === today ? ' is-today' : ''}" data-d="${s}"${s > today ? ' disabled' : ''}>${d}</button>`; }
  return `<div class="rp-cal"><div class="rp-mh">${TH_ML[m]} ${y + 543}</div><div class="rp-wd">${TH_WD.map(w => `<span>${w}</span>`).join('')}</div><div class="rp-g">${cells}</div></div>`;
}
function paintRP() {
  const end = RP.b || (RP.hover && RP.hover >= RP.a ? RP.hover : null);
  RP.pop.querySelectorAll('.rp-d').forEach(c => { const d = c.dataset.d;
    c.classList.toggle('is-start', d === RP.a); c.classList.toggle('is-end', !!end && d === end); c.classList.toggle('in-range', !!end && d > RP.a && d < end); c.classList.toggle('is-span', !!end && end !== RP.a); });
  const p = presets(); RP.pop.querySelectorAll('[data-p]').forEach(x => x.setAttribute('aria-pressed', p[x.dataset.p][0] === RP.a && p[x.dataset.p][1] === RP.b));
  RP.pop.querySelector('.rp-sel').innerHTML = RP.b ? `<b>${rangeText(RP.a, RP.b)}</b> · ${fmt(days(RP.a, RP.b).length)} วัน` : `<b>${dLong(RP.a)}</b> – เลือกวันสุดท้าย`;
  RP.pop.querySelector('[data-act="ok"]').disabled = !RP.b;
}
function drawRP() {
  const v = RP.view, v2 = new Date(v.getFullYear(), v.getMonth() + 1, 1), n = new Date(), canNext = v2 < new Date(n.getFullYear(), n.getMonth(), 1);
  RP.pop.innerHTML = `<div class="rp-side">${Object.keys(presets()).map(k => `<button type="button" data-p="${k}">${k}</button>`).join('')}</div>
    <div class="rp-main"><div class="rp-nav"><button type="button" class="rp-arrow" data-nav="-1" aria-label="เดือนก่อน">‹</button><button type="button" class="rp-arrow" data-nav="1" aria-label="เดือนถัดไป"${canNext ? '' : ' disabled'}>›</button></div>
      <div class="rp-cals">${monthHTML(v.getFullYear(), v.getMonth())}${monthHTML(v2.getFullYear(), v2.getMonth())}</div>
      <div class="rp-foot"><span class="rp-sel"></span><button type="button" class="btn" data-act="cancel">ยกเลิก</button><button type="button" class="btn pri rp-go" data-act="ok"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>ค้นหา</button></div></div>`;
  paintRP();
  const r = document.getElementById('rpBtn').getBoundingClientRect(), w = RP.pop.offsetWidth;
  RP.pop.style.top = (r.bottom + 8) + 'px'; RP.pop.style.left = Math.max(8, Math.min(r.right - w, innerWidth - w - 8)) + 'px';
}
function openRP() {
  if (RP) return closeRP();
  const e = pDate(RANGE.to), pop = document.createElement('div');
  RP = { pop, a: RANGE.from, b: RANGE.to, hover: null, view: new Date(e.getFullYear(), e.getMonth() - 1, 1) };
  pop.className = 'rp-pop'; pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-label', 'เลือกช่วงวันที่');
  document.body.appendChild(pop); document.getElementById('rpBtn').setAttribute('aria-expanded', 'true'); drawRP();
  pop.addEventListener('click', ev => {
    ev.stopPropagation();
    const p = ev.target.closest('[data-p]'); if (p) { [RP.a, RP.b] = presets()[p.dataset.p]; RP.hover = null; const e = pDate(RP.b); RP.view = new Date(e.getFullYear(), e.getMonth() - 1, 1); return drawRP(); }
    const nav = ev.target.closest('[data-nav]'); if (nav) { if (!nav.disabled) { RP.view = new Date(RP.view.getFullYear(), RP.view.getMonth() + +nav.dataset.nav, 1); drawRP(); } return; }
    const d = ev.target.closest('[data-d]');
    if (d && !d.disabled) { const x = d.dataset.d; if (RP.b || x < RP.a) { RP.a = x; RP.b = null; } else RP.b = x; RP.hover = null; return paintRP(); }   // กดวันแรก แล้วกดวันสุดท้าย (กดวันเดิมซ้ำ = วันเดียว)
    const act = ev.target.closest('[data-act]'); if (!act) return;
    if (act.dataset.act === 'ok' && RP.b) { const { a, b } = RP; closeRP(); setRange(a, b); } else if (act.dataset.act === 'cancel') closeRP();
  });
  pop.addEventListener('mouseover', ev => { if (!RP || RP.b) return; const c = ev.target.closest('[data-d]'); const h = c && !c.disabled ? c.dataset.d : null; if (h !== RP.hover) { RP.hover = h; paintRP(); } });
}
function initRange() {
  const box = document.getElementById('range');
  if (!document.getElementById('rpBtn')) box.innerHTML = '<button type="button" class="rp-btn" id="rpBtn" aria-haspopup="dialog" aria-expanded="false"></button>';
  document.getElementById('rpBtn').onclick = e => { e.stopPropagation(); openRP(); };
  document.addEventListener('click', e => { if (RP && !RP.pop.contains(e.target)) closeRP(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeRP(); if (e.key === 'Enter' && RP && RP.b) { e.preventDefault(); const { a, b } = RP; closeRP(); setRange(a, b); } });
  addEventListener('resize', closeRP);
  const [a, b] = presets()['เดือนนี้']; RANGE = { from: a, to: b }; drawRangeBtn();
}
const inRange = q => q.gte('d', RANGE.from).lte('d', RANGE.to);
const metric = (label, value, sub, info) => `<div class="ui-metric is-static"><span class="ui-metric-l">${label}${info ? ' ' + tip(info) : ''}</span><span class="ui-metric-v" data-fit>${value}</span><span class="md">${sub || '&nbsp;'}</span></div>`;
const chart = (id, cfg) => { if (CHARTS[id]) CHARTS[id].destroy(); const el = document.getElementById(id); if (el) CHARTS[id] = new Chart(el, cfg); };
const css = v => getComputedStyle(document.body).getPropertyValue(v).trim();
const dash = '<span class="ui-muted">—</span>';
// ที่จำข้อมูล 2 ชั้น: หน่วยความจำ + ในเครื่อง (IndexedDB)
//   เปิดหน้า / เปิดเว็บใหม่ → ใช้ข้อมูลที่จำไว้ขึ้นทันที แล้วโหลดใหม่เบื้องหลัง ถ้าข้อมูลเปลี่ยนจึงวาดหน้าใหม่ (ไม่กระพริบ)
//   อัปไฟล์ / แก้สต็อก → ล้างที่จำทั้งหมด · ออกจากระบบ → ล้างที่จำในเครื่อง
const CACHE = new Map();
const IDB = (() => { let dbp = null;
  const open = () => dbp || (dbp = new Promise((res, rej) => { const r = indexedDB.open('sales-cache', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }));
  const run = (mode, fn) => open().then(db => new Promise((res, rej) => { const t = db.transaction('kv', mode), r = fn(t.objectStore('kv')); t.oncomplete = () => res(r && r.result); t.onerror = () => rej(t.error); }));
  return { get: k => run('readonly', s => s.get(k)).catch(() => undefined), set: (k, v) => run('readwrite', s => s.put(v, k)).catch(() => {}), clear: () => run('readwrite', s => s.clear()).catch(() => {}) }; })();
const ckey = (view, ranged) => view + (ranged ? '|' + RANGE.from + '|' + RANGE.to : '');
const pull = (k, view, ranged, rng) => DB.select(view, '*', ranged ? q => q.gte('d', rng.from).lte('d', rng.to) : undefined).then(d => { IDB.set(k, d); return d; });
function refresh(k, view, ranged, rng, oldP) {
  const m = CACHE.get(k); if (m) m.t = Date.now();
  Promise.all([pull(k, view, ranged, rng), oldP]).then(([d, old]) => { if (JSON.stringify(d) === JSON.stringify(old)) return; CACHE.set(k, { p: Promise.resolve(d), t: Date.now() }); redrawSoon(); }).catch(() => {});
}
function sel(view, ranged = true) {
  const k = ckey(view, ranged), rng = { ...RANGE }, m = CACHE.get(k);
  if (m) { if (Date.now() - m.t > 600000) refresh(k, view, ranged, rng, m.p); return m.p; }   // เกิน 10 นาที: ใช้ของเดิมก่อน แล้วโหลดใหม่เบื้องหลัง
  const p = IDB.get(k).then(saved => { if (saved === undefined) return pull(k, view, ranged, rng); refresh(k, view, ranged, rng, Promise.resolve(saved)); return saved; });
  CACHE.set(k, { p, t: Date.now() }); p.catch(() => CACHE.delete(k)); return p;
}
function clearCache() { CACHE.clear(); IDB.clear(); }
let REDRAW_T = 0;
function redrawSoon() {   // ข้อมูลใหม่มาถึง → วาดหน้าปัจจุบันใหม่แบบเงียบ (ข้ามถ้ากำลังเปิดกล่อง / กรอกข้อมูลค้างอยู่)
  clearTimeout(REDRAW_T); REDRAW_T = setTimeout(() => { if (RP || document.querySelector('.drawer, .st-tbl tr.is-dirty, .ui-dlg-bg') || document.activeElement && /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) return; route(true); }, 400);
}
// โหลดข้อมูลของหน้าอื่นรอไว้ (ช่วงวันที่เดียวกัน) ตอนเครื่องว่าง → สลับหน้าแล้วขึ้นทันที
const PAGE_VIEWS = { overview: ['v_sales_daily', 'v_basket_daily', 'v_item_sales_daily', 'v_status_daily'], creators: ['v_creator_daily', 'v_creator_status_daily'], products: ['v_ship_daily', 'v_ship_items_daily'], items: ['v_item_sales_daily', 'v_sales_daily'], money: ['v_settlement_daily'] };
const SHARED_VIEWS = ['v_item_names', 'v_stock', 'products'];
function prefetch() {
  const jobs = [...new Set(Object.values(PAGE_VIEWS).flat())].map(v => [v, true]).concat(SHARED_VIEWS.map(v => [v, false])).filter(([v, r]) => !CACHE.has(ckey(v, r)));
  const next = () => { const j = jobs.shift(); if (!j) return; sel(j[0], j[1]).catch(() => {}).finally(() => (window.requestIdleCallback || setTimeout)(next)); };
  setTimeout(next, 800);
}
// โครงหน้ารอโหลด (แทนข้อความ "กำลังโหลด…" ที่ทำให้หน้ากระพริบ)
const SKEL = `<section class="ui-metrics hero" aria-busy="true">${'<div class="ui-metric is-static"><span class="ui-skel sk-l"></span><span class="ui-skel sk-v"></span><span class="ui-skel sk-s"></span></div>'.repeat(4)}</section>
  <div class="grid2"><section class="panel"><div class="ui-skel sk-box"></div></section><section class="panel"><div class="ui-skel sk-box"></div></section></div>`;
function pinHeads() {
  const tb = document.querySelector('.topbar'), tbBottom = tb && getComputedStyle(tb).position === 'sticky' ? tb.getBoundingClientRect().bottom : 0;
  document.querySelectorAll('.content table.ui-table, .drawer table.ui-table').forEach(t => {
    const head = t.tHead; if (!head) return;
    const box = t.closest('.dr-body'), top = box ? box.getBoundingClientRect().top : tbBottom, r = t.getBoundingClientRect();
    const y = Math.max(0, Math.min(top - r.top, r.height - head.offsetHeight - (t.tFoot ? t.tFoot.offsetHeight : 0) - 40));
    const v = y > 0 ? `translateY(${y}px)` : ''; if (head.dataset.y === v) return; head.dataset.y = v;
    head.querySelectorAll('th').forEach(th => { th.style.transform = v; th.classList.toggle('is-pinned', y > 0); });
  });
}
let PIN_RAF = 0; const pinSoon = () => { if (!PIN_RAF) PIN_RAF = requestAnimationFrame(() => { PIN_RAF = 0; pinHeads(); }); };
addEventListener('scroll', pinSoon, true); addEventListener('resize', pinSoon);
function limitRows(root) {   // ตารางที่มี data-limit="n": แสดง n แถวแรก + ปุ่มแสดงทั้งหมด (แถวรวมด้านล่างรวมทุกแถวเสมอ)
  root.querySelectorAll('table[data-limit]:not([data-limited])').forEach(t => {
    t.dataset.limited = '1'; const n = +t.dataset.limit, extra = [...t.tBodies[0].rows].slice(n); if (!extra.length) return;
    const b = document.createElement('button'); b.type = 'button'; b.className = 'btn more';
    const set = open => { extra.forEach(r => r.hidden = !open); b.textContent = open ? `ย่อเหลือ ${n} แถว` : `แสดงทั้งหมด ${fmt(n + extra.length)} แถว`; b.onclick = () => set(!open); };
    set(false); t.closest('.panel').querySelector('.panel-h').appendChild(b);
  });
}

// ===== ภาพรวม: ยอดขาย (เฉพาะส่งสำเร็จ) · ออเดอร์ · AOV · ยอดผ่าน Creator · รอส่งถึง + สถานะออเดอร์ + กราฟรายวัน + แหล่งที่มา + สินค้าขายดี =====
const SALE_INFO = 'นับเฉพาะออเดอร์ที่<b>ส่งสำเร็จ</b> (ลูกค้าได้รับของแล้ว)<br><b>ไม่รวม</b> กำลังส่ง / คืนสินค้า / ตีกลับ / ยกเลิก';
async function pageOverview(el) {
  const [rows, B, I, N, STA] = await Promise.all([sel('v_sales_daily'), sel('v_basket_daily'), sel('v_item_sales_daily'), sel('v_item_names', false), sel('v_status_daily')]);
  if (!rows.length && !STA.length) return el.innerHTML = '<div class="panel empty-note">ยังไม่มียอดขายในช่วงนี้ — อัปโหลดไฟล์คำสั่งซื้อที่หน้า "อัปโหลด"</div>';
  const T = rows.reduce((a, r) => ({ rev: a.rev + +r.revenue, ord: a.ord + +r.orders }), { rev: 0, ord: 0 });
  const bySrc = {}; rows.forEach(r => { const s = bySrc[r.source] = bySrc[r.source] || { rev: 0, ord: 0 }; s.rev += +r.revenue; s.ord += +r.orders; });
  const aff = Object.entries(bySrc).filter(([k]) => k.startsWith('Creator')).reduce((a, [, v]) => a + v.rev, 0);
  const wait = STA.filter(r => r.state === 'กำลังส่ง').reduce((a, r) => ({ rev: a.rev + +r.revenue, ord: a.ord + +r.orders }), { rev: 0, ord: 0 });
  const srcs = Object.keys(bySrc).sort((a, b) => bySrc[b].rev - bySrc[a].rev), ds = days(RANGE.from, RANGE.to);
  el.innerHTML = `<section class="ui-metrics hero">
      ${metric('ยอดขาย', fmt(T.rev), `${ds.length} วัน · เฉลี่ย ${fmt(T.rev / ds.length)} / วัน`, 'ยอดสินค้าหลังส่วนลด <b>ไม่รวม</b>ค่าส่ง · นับตามวันที่สั่งซื้อ (เวลาไทย)<br>' + SALE_INFO)}
      ${metric('ออเดอร์', fmt(T.ord), 'ส่งสำเร็จ', SALE_INFO)}
      ${metric('AOV', fmt(T.ord ? T.rev / T.ord : 0), 'ยอดขาย ÷ ออเดอร์', 'ยอดขายเฉลี่ยต่อออเดอร์ที่ส่งสำเร็จ')}
      ${metric('ยอดผ่าน Creator', T.rev ? (aff / T.rev * 100).toFixed(1) + '%' : '—', 'ยอด ' + fmt(aff), 'ยอดของออเดอร์ที่มี Creator (ไม่นับบัญชีร้านเอง) ÷ ยอดขาย')}
      ${metric('รอส่งถึงลูกค้า', fmt(wait.rev), `${fmt(wait.ord)} ออเดอร์ · ยังไม่นับในยอดขาย`, 'ออเดอร์ที่ยังอยู่ระหว่างส่ง จะนับเป็นยอดขายเมื่อส่งสำเร็จ (อัปไฟล์คำสั่งซื้อรอบถัดไป)')}
    </section>
    <section class="panel"><div class="panel-h"><h2>สถานะออเดอร์ ${tip('นับตามวันที่สั่งซื้อ ทุกออเดอร์รวมที่ยกเลิก<br>นับเป็นยอดขาย = ส่งสำเร็จเท่านั้น (ตรงกับยอดขาย / ออเดอร์ในแถบบน)<br>% = สัดส่วนของออเดอร์ทั้งหมด · ตีกลับเทียบกับพัสดุที่ส่งออกไปแล้ว')}</h2><span class="ui-muted">ออเดอร์ทั้งหมด ${statusTotal(STA)} (รวมยกเลิก)</span></div>${statusStrip(STA)}</section>
    <div class="grid2"><section class="panel"><div class="panel-h"><h2>ยอดขายรายวัน แยกแหล่งที่มา</h2></div><div style="height:280px;"><canvas id="cSales"></canvas></div></section>
    <section class="panel"><div class="panel-h"><h2>แหล่งที่มา ${tip('ช่องทางจากคอลัมน์ Order Channel ในไฟล์คำสั่งซื้อ (Live / คลิป / หน้าสินค้า)<br>ร้าน = ไม่มี Creator หรือเป็นบัญชีร้านเอง · Creator = มี Creator Handle')}</h2></div>
      <div class="wide"><table class="ui-table tbl" data-no-sort data-no-page><thead><tr><th class="l">แหล่ง</th><th class="num">ยอดขาย</th><th class="l">สัดส่วน</th><th class="num">ออเดอร์</th></tr></thead><tbody>
      ${srcs.map(s => { const x = bySrc[s], sh = x.rev / T.rev * 100; return `<tr><td class="l"><span class="src-dot" style="background:${srcColor(s)}"></span>${esc(s)}</td><td class="num">${fmt(x.rev)}</td><td class="l"><span class="bar"><b style="width:${sh.toFixed(1)}%;background:${srcColor(s)}"></b></span>${Math.round(sh)}%</td><td class="num">${fmt(x.ord)}</td></tr>`; }).join('')}
      </tbody><tfoot><tr><td class="l">รวม</td><td class="num">${fmt(T.rev)}</td><td class="l">100%</td><td class="num">${fmt(T.ord)}</td></tr></tfoot></table></div></section></div>
    <section class="panel" id="prodPanel"><div class="panel-h"><h2>สินค้าขายดี ${tip('ตะกร้า = สินค้าที่ลูกค้ากดซื้อ (Product Name)<br>สินค้าจริง = แตกชุดโปรเป็นสินค้าตามรหัส SKU · ยอดของชุดโปรแบ่งให้แต่ละสินค้าตาม RSP (ยังไม่มี RSP = หารเฉลี่ย)<br>' + SALE_INFO)}</h2>
      <span style="flex:1"></span><div class="ui-presets" id="prodTabs">${Object.entries(PROD_TABS).map(([k, n]) => `<button type="button" data-t="${k}" aria-pressed="${k === PROD_TAB}">${n}</button>`).join('')}</div></div>
      <div class="wide" id="prodBody"></div></section>`;
  const P = prodData(B, I, N);
  const drawProd = () => { document.getElementById('prodBody').innerHTML = prodTable(P); document.querySelectorAll('#prodTabs button').forEach(b => b.setAttribute('aria-pressed', b.dataset.t === PROD_TAB)); if (window.UI && UI.fit) UI.fit(); pinSoon(); };
  document.querySelectorAll('#prodTabs button').forEach(b => b.onclick = () => { PROD_TAB = b.dataset.t; drawProd(); });
  drawProd();
  chart('cSales', { type: 'bar', data: { labels: ds.map(dTh), datasets: srcs.map(s => ({ label: s, data: ds.map(d => rows.filter(r => r.d === d && r.source === s).reduce((a, r) => a + +r.revenue, 0)), backgroundColor: srcColor(s), borderColor: srcColor(s), borderWidth: 0, borderRadius: 3, stack: 's' })) },
    options: { maintainAspectRatio: false, animation: false, interaction: { mode: 'index', intersect: false },
      plugins: { legend: { position: 'bottom', labels: { color: css('--text2'), boxWidth: 10 } },
        tooltip: { uiShare: true, itemSort: (a, b) => b.parsed.y - a.parsed.y, filter: i => i.parsed.y > 0,
          callbacks: { title: it => dFull(ds[it[0].dataIndex]), label: c => `${c.dataset.label}: ${fmt(c.parsed.y)}`, footer: it => 'รวม: ' + fmt(it.reduce((a, i) => a + i.parsed.y, 0)) } } }, scales: { x: { stacked: true, ticks: { color: css('--text3'), maxRotation: 0, autoSkip: true, maxTicksLimit: 12 }, grid: { display: false } }, y: { stacked: true, ticks: { color: css('--text3') }, grid: { color: css('--grid') || 'rgba(0,0,0,.06)' } } } } });
}

// ===== สถานะออเดอร์: แถบสัดส่วน + ตัวเลขแต่ละสถานะ (นับตามวันที่สั่งซื้อ · รวมออเดอร์ที่ยกเลิก) =====
const ST = [['ส่งสำเร็จ', 'var(--good)', 'ok', 'ลูกค้าได้รับของแล้ว (เสร็จสมบูรณ์ / จัดส่งสำเร็จ) · นับเป็นยอดขาย'], ['กำลังส่ง', 'var(--blue)', 'wait', 'ยังไม่ถึงมือลูกค้า (ที่จะจัดส่ง / อยู่ระหว่างขนส่ง) · จะนับเป็นยอดขายเมื่อส่งสำเร็จ'],
  ['คืนสินค้า', 'var(--warn)', 'no', 'ลูกค้าขอคืนสินค้า / คืนเงินหลังได้รับของ'], ['ตีกลับ', 'var(--bad)', 'no', 'ระบบยกเลิกเพราะส่งไม่สำเร็จ (การจัดส่งพัสดุไม่สำเร็จ / พัสดุเสียหาย / สูญหาย)'],
  ['ยกเลิก', 'var(--text3)', 'no', 'ลูกค้าหรือร้านยกเลิกก่อนส่ง'], ['ไม่ชำระเงิน', 'color-mix(in srgb, var(--text3) 45%, transparent)', 'no', 'ระบบยกเลิกเพราะลูกค้าไม่ชำระเงินตามกำหนด']];
const ST_GROUPS = [['ok', 'นับเป็นยอดขาย', 'good', 1], ['wait', 'รอส่งถึง', 'wait', 1], ['no', 'ไม่นับเป็นยอดขาย', 'bad', 4]];
function statusStrip(rows, compact) {
  const by = {}; let all = 0; rows.forEach(r => { const x = by[r.state] = by[r.state] || { n: 0, rev: 0, why: {} }; x.n += +r.orders; x.rev += +r.revenue; all += +r.orders; if (r.reason) x.why[r.reason] = (x.why[r.reason] || 0) + +r.orders; });
  if (!all) return `<div class="ui-muted" style="padding:6px 0">ยังไม่มีออเดอร์ในช่วงนี้</div>`;
  const n = k => (by[k] || { n: 0 }).n, sent = n('ส่งสำเร็จ') + n('คืนสินค้า') + n('ตีกลับ'), pct = v => (all ? v / all * 100 : 0).toFixed(1) + '%';
  const item = ([k, c, , info]) => { const x = by[k] || { n: 0, rev: 0, why: {} }, why = Object.entries(x.why).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([w, v]) => `${w} ${fmt(v)}`).join('<br>');
    return `<div class="st-item${x.n ? '' : ' is-zero'}"><span class="st-dot" style="background:${c}"></span><div><div class="st-name">${k} ${tip(info + (why && k !== 'ส่งสำเร็จ' ? '<br><br>เหตุผล:<br>' + why : ''))}</div>
      <div class="st-num"><b>${fmt(x.n)}</b><span>${pct(x.n)}</span></div><small>${k === 'ตีกลับ' && sent ? `${(x.n / sent * 100).toFixed(1)}% ของที่ส่งออกไป` : 'ยอด ' + fmt(x.rev)}</small></div></div>`; };
  return `<div class="st-bar">${ST.filter(([k]) => n(k)).map(([k, c]) => `<i style="flex:${n(k)};background:${c}" data-tip="${k} ${fmt(n(k))} ออเดอร์ (${pct(n(k))})"></i>`).join('')}</div>
    <div class="st-legend${compact ? ' compact' : ''}">${ST_GROUPS.map(([g, label, cls, span]) => `<span class="st-gl ${cls}" style="--span:${span}">${label}</span>`).join('')}${ST.map(item).join('')}</div>`;
}
const statusTotal = rows => fmt(rows.reduce((a, r) => a + +r.orders, 0));

// ===== สินค้าขายดี (ในหน้าภาพรวม): ตะกร้า / SKU / สินค้าจริง · รวมยอดจาก view รายวันของแต่ละแบบ =====
let PROD_TAB = 'basket';
const PROD_TABS = { basket: 'ตะกร้า', item: 'สินค้าจริง' };
function prodData(B, I, N) {   // B = ตะกร้าต่อวัน (basket, revenue, orders, skus) · I = สินค้าจริงต่อวัน (item, amount, orders) จากยอดที่แบ่งแล้ว
  const P = { basket: {}, item: {}, names: Object.fromEntries(N.map(r => [r.item, r.name])), T: { rev: 0, itemRev: 0 } };
  B.forEach(r => { const x = P.basket[r.basket] = P.basket[r.basket] || { rev: 0, ord: 0, skus: new Set() }; x.rev += +r.revenue; x.ord += +r.orders; (r.skus || []).forEach(k => x.skus.add(k)); P.T.rev += +r.revenue; });
  I.forEach(r => { const x = P.item[r.item] = P.item[r.item] || { rev: 0, ord: 0 }; x.rev += +r.amount; x.ord += +r.orders; P.T.itemRev += +r.amount; });
  return P;
}
function prodTable(P, TAB = PROD_TAB) {
  const share = (v, t) => { const p = t ? v / t * 100 : 0; return `<span class="bar"><b style="width:${p.toFixed(1)}%"></b></span>${p > 0 && p < 1 ? '&lt;1' : Math.round(p)}%`; };
  const ordH = `<th class="num">ออเดอร์ ${tip('จำนวนออเดอร์ที่ซื้อรายการนี้<br>1 ออเดอร์ซื้อได้หลายรายการ แถวรวมจึงไม่รวมช่องนี้ (จำนวนออเดอร์จริงดูที่แถบบน)')}</th>`;
  const table = (head, body, foot) => `<table class="ui-table tbl prod" data-no-sort data-no-page><thead><tr>${head}</tr></thead><tbody>${body}</tbody><tfoot><tr>${foot}</tr></tfoot></table>`;
  if (TAB === 'basket') { const L = Object.entries(P.basket).sort((a, b) => b[1].rev - a[1].rev);
    return L.length ? table(`<th class="num">#</th><th class="l">ตะกร้า</th><th class="num">ยอดขาย</th><th class="l">สัดส่วน</th>${ordH}`,
      L.map(([n, x], i) => `<tr><td class="num ui-muted">${i + 1}</td><td class="l"><span class="pn ui-trunc">${esc(n)}</span><small>${fmt(x.skus.size)} SKU</small></td><td class="num">${fmt(x.rev)}</td><td class="l">${share(x.rev, P.T.rev)}</td><td class="num">${fmt(x.ord)}</td></tr>`).join(''),
      `<td></td><td class="l">รวม ${fmt(L.length)} ตะกร้า</td><td class="num">${fmt(P.T.rev)}</td><td class="l">100%</td><td></td>`) : '<div class="empty-note">ไม่มีสินค้าในช่วงนี้</div>'; }
  const L = Object.entries(P.item).sort((a, b) => b[1].rev - a[1].rev);
  return L.length ? table(`<th class="num">#</th><th class="l">สินค้าจริง</th><th class="num">ยอดขาย ${tip('ยอดที่แบ่งให้สินค้าแต่ละตัว (ชุดโปรแบ่งตาม RSP / หารเฉลี่ย) รวมกันเท่ายอดขาย')}</th><th class="l">สัดส่วน</th>${ordH}`,
    L.map(([k, x], i) => `<tr><td class="num ui-muted">${i + 1}</td><td class="l">${P.names[k] && P.names[k] !== k ? `<span class="pn ui-trunc">${esc(P.names[k])}</span><small class="ui-code">${esc(k)}</small>` : `<span class="pn ui-code">${esc(k)}</span><small>ยังไม่มีชื่อ</small>`}</td><td class="num">${fmt(x.rev)}</td><td class="l">${share(x.rev, P.T.itemRev)}</td><td class="num">${fmt(x.ord)}</td></tr>`).join(''),
    `<td></td><td class="l">รวม ${fmt(L.length)} รายการ</td><td class="num">${fmt(P.T.itemRev)}</td><td class="l">100%</td><td></td>`) : '<div class="empty-note">ไม่มีสินค้าในช่วงนี้</div>';
}

// ===== Creator: ใครขายได้เท่าไร =====
async function pageCreators(el) {
  const [rows, CST] = await Promise.all([sel('v_creator_daily'), sel('v_creator_status_daily')]);
  const stBy = {}; CST.forEach(r => { const x = stBy[r.creator] = stBy[r.creator] || {}; x[r.state] = (x[r.state] || 0) + +r.orders; });
  const okN = c => (stBy[c] || {})['ส่งสำเร็จ'] || 0, backN = c => (stBy[c] || {})['ตีกลับ'] || 0, sentN = c => okN(c) + backN(c) + ((stBy[c] || {})['คืนสินค้า'] || 0);
  const backCell = c => backN(c) ? `${fmt(backN(c))}<small>${(backN(c) / sentN(c) * 100).toFixed(1)}%</small>` : dash;
  const by = {}; rows.forEach(r => { const c = by[r.creator] = by[r.creator] || { rev: 0, ord: 0, com: 0, types: new Set() }; c.rev += +r.revenue; c.ord += +r.orders; c.com += +r.commission; if (r.content_type) c.types.add(r.content_type); });
  const list = Object.entries(by).sort((a, b) => b[1].rev - a[1].rev), T = list.reduce((a, [, c]) => ({ rev: a.rev + c.rev, ord: a.ord + c.ord, com: a.com + c.com }), { rev: 0, ord: 0, com: 0 });
  if (!list.length) return el.innerHTML = '<div class="panel empty-note">ยังไม่มีออเดอร์ผ่าน Creator ในช่วงนี้</div>';
  const TYPE_ORDER = ['Live', 'คลิป', 'หน้าสินค้า'], types = c => [...c.types].sort((a, b) => (TYPE_ORDER.indexOf(a) + 1 || 9) - (TYPE_ORDER.indexOf(b) + 1 || 9)).join(' · ');
  const comInfo = 'ค่าคอมจากรายงานรับเงิน นับเฉพาะออเดอร์ที่ TikTok โอนเงินแล้ว<br>— = ยังไม่มีข้อมูล (ยังไม่ได้อัปรายงานรับเงิน หรือยังไม่ถึงรอบโอน)';
  el.innerHTML = `<section class="ui-metrics hero">${metric('Creator ที่มียอด', fmt(list.length), 'คน', 'จำนวน Creator ที่มีออเดอร์ในช่วงนี้ (ไม่นับบัญชีร้านเอง)')}${metric('ยอดขายผ่าน Creator', fmt(T.rev), '', 'ยอดสินค้าหลังส่วนลด <b>ไม่รวม</b>ค่าส่ง<br>' + SALE_INFO)}${metric('ค่าคอม Creator', T.com ? fmt(T.com) : '—', T.com && T.rev ? (T.com / T.rev * 100).toFixed(1) + '% ของยอด' : '', comInfo)}${metric('ออเดอร์', fmt(T.ord), 'ส่งสำเร็จ', 'ออเดอร์ที่มี Creator<br>' + SALE_INFO)}${(() => { const b = list.reduce((a, [n]) => a + backN(n), 0), sn = list.reduce((a, [n]) => a + sentN(n), 0); return metric('ตีกลับ', fmt(b), sn ? (b / sn * 100).toFixed(1) + '% ของที่ส่งออกไป' : '', 'ออเดอร์ของ Creator ที่ระบบยกเลิกเพราะส่งไม่สำเร็จ<br>% = ตีกลับ ÷ (ส่งสำเร็จ + คืนสินค้า + ตีกลับ)'); })()}</section>
    <section class="panel"><div class="panel-h"><h2>Creator เรียงตามยอดขาย ${tip('กดที่แถวเพื่อดูสินค้า / โปรที่ Creator คนนั้นขาย และสถานะออเดอร์')}</h2></div><div class="wide"><table class="ui-table tbl cr-tbl" data-no-page data-limit="20"><thead><tr><th class="l">Creator</th><th class="l">ช่องทาง</th><th class="num">ยอดขาย</th><th class="num">สัดส่วน</th><th class="num">ออเดอร์ ${tip('ออเดอร์ที่ส่งสำเร็จ')}</th><th class="num">ตีกลับ ${tip('ออเดอร์ที่ส่งไม่สำเร็จ · % เทียบกับที่ส่งออกไป')}</th><th class="num">ค่าคอม ${tip(comInfo)}</th></tr></thead><tbody>
    ${list.map(([n, c]) => `<tr data-c="${esc(n)}" tabindex="0"><td class="l"><span class="cr-name">${esc(n)}</span></td><td class="l">${esc(types(c))}</td><td class="num">${fmt(c.rev)}</td><td class="num">${(c.rev / T.rev * 100).toFixed(1)}%</td><td class="num">${fmt(c.ord)}</td><td class="num">${backCell(n)}</td><td class="num">${c.com ? fmt(c.com) : dash}</td></tr>`).join('')}
    </tbody><tfoot><tr><td class="l">รวม ${fmt(list.length)} คน</td><td></td><td class="num">${fmt(T.rev)}</td><td class="num">100%</td><td class="num">${fmt(T.ord)}</td><td class="num">${fmt(list.reduce((a, [n]) => a + backN(n), 0))}</td><td class="num">${T.com ? fmt(T.com) : dash}</td></tr></tfoot></table></div></section>`;
  el.querySelectorAll('.cr-tbl tbody tr').forEach(tr => { const go = () => openCreator(tr.dataset.c, by[tr.dataset.c], types(by[tr.dataset.c]), CST.filter(r => r.creator === tr.dataset.c)); tr.onclick = go; tr.onkeydown = e => { if (e.key === 'Enter') go(); }; });
}

// ===== กล่องรายละเอียด Creator: ตัวเลขสรุป + สถานะออเดอร์ + สินค้า / โปรที่ขาย (ตะกร้า / สินค้าจริง) =====
let DR_TAB = 'basket';
function closeCreator() { document.querySelectorAll('.dr-bg, .drawer').forEach(e => e.remove()); document.removeEventListener('keydown', drKey); }
function drKey(e) { if (e.key === 'Escape') closeCreator(); }
const crSel = (view, name) => { const k = 'cr|' + view + '|' + name + '|' + RANGE.from + '|' + RANGE.to; if (!CACHE.has(k)) { const p = DB.select(view, '*', q => inRange(q).eq('creator', name)); CACHE.set(k, { t: Date.now(), p }); p.catch(() => CACHE.delete(k)); } return CACHE.get(k).p; };
async function openCreator(name, c, typesText, stRows) {
  closeCreator();
  const bg = document.createElement('div'), dr = document.createElement('aside'); bg.className = 'dr-bg'; dr.className = 'drawer'; dr.setAttribute('role', 'dialog'); dr.setAttribute('aria-label', 'รายละเอียด ' + name);
  dr.innerHTML = `<div class="dr-h"><div><div class="dr-t">${esc(name)}</div><div class="ui-muted">${esc(typesText)} · ${rangeText(RANGE.from, RANGE.to)}</div></div><button type="button" class="dr-x" aria-label="ปิด">✕</button></div><div class="dr-body">${SKEL}</div>`;
  document.body.append(bg, dr); requestAnimationFrame(() => { bg.classList.add('on'); dr.classList.add('on'); });
  bg.onclick = closeCreator; dr.querySelector('.dr-x').onclick = closeCreator; document.addEventListener('keydown', drKey);
  let R, OI, N; try { [R, OI, N] = await Promise.all([crSel('v_creator_sku_daily', name), crSel('v_order_items', name), sel('v_item_names', false)]); } catch (e) { dr.querySelector('.dr-body').innerHTML = `<div class="panel empty-note" style="color:var(--bad)">โหลดไม่สำเร็จ: ${esc(e.message)}</div>`; return; }
  if (!dr.isConnected) return;
  const B = Object.values(R.reduce((m, r) => { const x = m[r.basket] = m[r.basket] || { basket: r.basket, revenue: 0, orders: 0, skus: [] }; x.revenue += +r.revenue; x.orders += +r.orders; x.skus.push(r.sku); return m; }, {}));
  const I = Object.values(OI.reduce((m, r) => { const x = m[r.item] = m[r.item] || { item: r.item, amount: 0, ids: new Set() }; x.amount += +r.amount; x.ids.add(r.order_id); return m; }, {})).map(x => ({ item: x.item, amount: x.amount, orders: x.ids.size }));
  const P = prodData(B, I, N), st = stRows.reduce((m, r) => (m[r.state] = (m[r.state] || 0) + +r.orders, m), {}), sent = (st['ส่งสำเร็จ'] || 0) + (st['คืนสินค้า'] || 0) + (st['ตีกลับ'] || 0);
  const body = dr.querySelector('.dr-body');
  body.innerHTML = `<section class="ui-metrics hero">${metric('ยอดขาย', fmt(c.rev), '', 'ยอดสินค้าหลังส่วนลด <b>ไม่รวม</b>ค่าส่ง<br>' + SALE_INFO)}${metric('ออเดอร์', fmt(c.ord), 'ส่งสำเร็จ', SALE_INFO)}
      ${metric('ตีกลับ', fmt(st['ตีกลับ'] || 0), sent ? ((st['ตีกลับ'] || 0) / sent * 100).toFixed(1) + '% ของที่ส่งออกไป' : '', 'ตีกลับ ÷ (ส่งสำเร็จ + คืนสินค้า + ตีกลับ)')}${metric('ค่าคอม', c.com ? fmt(c.com) : '—', c.com && c.rev ? (c.com / c.rev * 100).toFixed(1) + '% ของยอด' : '', 'ค่าคอมจากรายงานรับเงิน นับเฉพาะออเดอร์ที่ TikTok โอนเงินแล้ว')}</section>
    <section class="panel"><div class="panel-h"><h2>สถานะออเดอร์</h2><span class="ui-muted">ทั้งหมด ${statusTotal(stRows)} ออเดอร์</span></div>${statusStrip(stRows, true)}</section>
    <section class="panel" id="drProd"><div class="panel-h"><h2>สินค้า / โปรที่ขาย</h2><span style="flex:1"></span><div class="ui-presets" id="drTabs"><button type="button" data-t="basket">ตะกร้า</button><button type="button" data-t="item">สินค้าจริง</button></div></div><div class="wide" id="drBody"></div></section>`;
  const draw = () => { body.querySelector('#drBody').innerHTML = prodTable(P, DR_TAB); body.querySelectorAll('#drTabs button').forEach(b => b.setAttribute('aria-pressed', b.dataset.t === DR_TAB)); if (window.UI && UI.fit) UI.fit(); pinSoon(); };
  body.querySelectorAll('#drTabs button').forEach(b => b.onclick = () => { DR_TAB = b.dataset.t; draw(); }); draw();
}

// ===== สินค้าที่ส่ง: ของที่ออกจากคลังจริง (แตกชุดโปรเป็นชิ้น) นับตามวันที่ส่ง · กราฟรายวัน + ตารางสินค้า × วัน (สีเข้ม = ส่งเยอะ) =====
const TH_WD1 = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
async function pageProducts(el) {
  const [D, R, N] = await Promise.all([sel('v_ship_daily'), sel('v_ship_items_daily'), sel('v_item_names', false)]), ds = days(RANGE.from, RANGE.to);
  if (!D.length) return el.innerHTML = '<div class="panel empty-note">ยังไม่มีสินค้าที่ส่งในช่วงนี้</div>';
  const names = Object.fromEntries(N.map(r => [r.item, r.name])), dayOf = Object.fromEntries(D.map(r => [r.d, r]));
  const T = D.reduce((a, r) => ({ pcs: a.pcs + +r.pcs, ord: a.ord + +r.orders }), { pcs: 0, ord: 0 }), busy = [...D].sort((a, b) => b.pcs - a.pcs)[0];
  const by = {}; R.forEach(r => { const x = by[r.item] = by[r.item] || { q: {}, t: 0 }; x.q[r.d] = (x.q[r.d] || 0) + +r.pcs; x.t += +r.pcs; });
  const L = Object.entries(by).sort((a, b) => b[1].t - a[1].t), top = L[0], nm = k => names[k] && names[k] !== k ? names[k] : k;
  const heat = (v, max) => v ? ` style="--h:${Math.max(.12, v / max).toFixed(2)}"` : '';
  el.innerHTML = `<section class="ui-metrics hero">${metric('ชิ้นที่ส่ง', fmt(T.pcs), `${ds.length} วัน · เฉลี่ย ${fmt1(T.pcs / ds.length)} / วัน`, 'ชิ้นจริงที่ออกจากคลัง (แตกชุดโปรเป็นชิ้น) นับตามวันที่ส่ง (Shipped Time)<br><b>ไม่รวม</b>ออเดอร์ที่ยกเลิก (รวมที่กำลังส่ง)')}
      ${metric('ออเดอร์ที่ส่ง', fmt(T.ord), `เฉลี่ย ${fmt1(T.ord / ds.length)} / วัน`, 'จำนวนออเดอร์ (พัสดุ) ที่ส่งออกในช่วงนี้')}
      ${metric('วันที่ส่งมากสุด', busy ? dTh(busy.d) : '—', busy ? `${fmt(busy.pcs)} ชิ้น · ${fmt(busy.orders)} ออเดอร์` : '', 'วันที่ส่งของออกมากที่สุดในช่วงนี้')}
      ${metric('ส่งมากสุด', top ? fmt(top[1].t) + ' ชิ้น' : '—', top ? `<span class="ui-trunc">${esc(nm(top[0]))}</span>` : '', 'สินค้าจริงที่ส่งออกมากที่สุดในช่วงนี้')}</section>
    <section class="panel"><div class="panel-h"><h2>ส่งออกรายวัน ${tip('แท่ง = ชิ้นที่ส่ง · ชี้ที่แท่งเพื่อดูจำนวนออเดอร์ของวันนั้น')}</h2></div><div style="height:220px;"><canvas id="cShip"></canvas></div></section>
    <section class="panel"><div class="panel-h"><h2>สินค้าที่ส่งรายวัน (ชิ้น) ${tip('แถว = สินค้าจริง · คอลัมน์ = วันที่ส่ง<br>สีเข้ม = วันที่สินค้านั้นส่งเยอะเมื่อเทียบกับวันอื่นของสินค้าเดียวกัน<br>เลื่อนซ้ายขวาได้ ชื่อสินค้าจะค้างอยู่ด้านซ้าย')}</h2></div><div class="wide ship-wrap"><table class="ui-table tbl ship-tbl" data-no-sort data-no-page>
      <thead><tr><th class="l stick">สินค้า</th><th class="num tot">รวม</th>${ds.map(d => { const w = pDate(d).getDay(); return `<th class="num dcol${w === 0 ? ' sun' : ''}"><small>${TH_WD1[w]}</small>${pDate(d).getDate()}</th>`; }).join('')}</tr></thead><tbody>
      ${L.map(([k, x]) => { const max = Math.max(...Object.values(x.q)); return `<tr><td class="l stick"><span class="pn ui-trunc">${esc(nm(k))}</span><small class="ui-code">${esc(k)}</small></td><td class="num tot"><b>${fmt(x.t)}</b></td>${ds.map(d => `<td class="num hc"${heat(x.q[d], max)}>${x.q[d] ? fmt(x.q[d]) : ''}</td>`).join('')}</tr>`; }).join('')}
      </tbody><tfoot><tr><td class="l stick">รวม ${fmt(L.length)} รายการ</td><td class="num tot">${fmt(T.pcs)}</td>${ds.map(d => `<td class="num">${dayOf[d] ? fmt(dayOf[d].pcs) : ''}</td>`).join('')}</tr></tfoot></table></div></section>`;
  chart('cShip', { type: 'bar', data: { labels: ds.map(dTh), datasets: [{ label: 'ชิ้นที่ส่ง', data: ds.map(d => dayOf[d] ? +dayOf[d].pcs : 0), backgroundColor: css('--accent'), borderRadius: 3, maxBarThickness: 26 }] },
    options: { maintainAspectRatio: false, animation: false, interaction: { mode: 'index', intersect: false }, plugins: { legend: { display: false },
      tooltip: { callbacks: { title: it => dFull(ds[it[0].dataIndex]), label: c => `ชิ้นที่ส่ง: ${fmt(c.parsed.y)}`, footer: it => { const r = dayOf[ds[it[0].dataIndex]]; return r ? 'ออเดอร์: ' + fmt(r.orders) : ''; } } } },
      scales: { x: { ticks: { color: css('--text3'), maxRotation: 0, autoSkip: true, maxTicksLimit: 16 }, grid: { display: false } }, y: { ticks: { color: css('--text3') }, grid: { color: css('--grid') || 'rgba(0,0,0,.06)' } } } } });
}

// ===== รายละเอียดออเดอร์ (แตกออเดอร์): แต่ละบรรทัดของออเดอร์ → สินค้าจริง + ยอดต่อชิ้น (แบ่งตาม RSP / หารเฉลี่ย) · รวมกลับ = ยอดเดิมทุกสตางค์ · ดาวน์โหลด Excel =====
const fmt2 = v => (+v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const METHOD = { 'ไม่ต้องแบ่ง': '', 'ตาม RSP': 'good', 'หารเฉลี่ย': 'warn' };
const SALE_STATES = ['ส่งสำเร็จ'];
let IT = { page: 0, q: '' };
const IT_PER = 20;
async function pageItems(el) {
  const [S, T, N, PR] = await Promise.all([sel('v_item_sales_daily'), sel('v_sales_daily'), sel('v_item_names', false), sel('products', false)]);
  if (!T.length) return el.innerHTML = '<div class="panel empty-note">ยังไม่มียอดขายในช่วงนี้</div>';
  const names = Object.fromEntries(N.map(r => [r.item, r.name])), rsp = Object.fromEntries(PR.filter(r => +r.rsp > 0).map(r => [r.sku, +r.rsp]));
  const by = {}; S.forEach(r => { const x = by[r.item] = by[r.item] || { pcs: 0, amt: 0, avg: 0, byRsp: 0 }; x.pcs += +r.pcs; x.amt += +r.amount; x.avg += +r.pcs_avg; x.byRsp += +r.pcs_rsp; });
  const L = Object.entries(by).sort((a, b) => b[1].amt - a[1].amt), A = L.reduce((a, [, x]) => ({ pcs: a.pcs + x.pcs, amt: a.amt + x.amt, avg: a.avg + x.avg, byRsp: a.byRsp + x.byRsp }), { pcs: 0, amt: 0, avg: 0, byRsp: 0 });
  const rev = T.reduce((a, r) => a + +r.revenue, 0), ord = T.reduce((a, r) => a + +r.orders, 0), same = Math.abs(rev - A.amt) < 0.005;
  const wayTip = x => [x.pcs - x.avg - x.byRsp ? `ขายเดี่ยว ไม่ต้องแบ่ง ${fmt(x.pcs - x.avg - x.byRsp)} ชิ้น` : '', x.byRsp ? `อยู่ในชุดโปร แบ่งตาม RSP ${fmt(x.byRsp)} ชิ้น` : '', x.avg ? `อยู่ในชุดโปร หารเฉลี่ย ${fmt(x.avg)} ชิ้น (ยังไม่มี RSP ครบในชุด)` : ''].filter(Boolean).join('\n');
  pageActs().innerHTML = `${same ? '' : `<span class="ui-badge bad it-chk" data-tip="${esc(`แยกเป็นรายชิ้นแล้วรวมกลับ ${fmt2(A.amt)}\nยอดขาย ${fmt2(rev)}\nไม่ตรงกัน กรุณาแจ้งผู้ดูแลระบบ`)}">! รวมกลับไม่ตรงกับยอดขาย</span>`}
    <button type="button" class="btn pri it-dl" id="itDl"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v12M7 11l5 5 5-5M5 20h14"/></svg>ดาวน์โหลด Excel</button>`;
  el.innerHTML = `<section class="ui-metrics hero">${metric('ออเดอร์', fmt(ord), 'ส่งสำเร็จ', SALE_INFO)}${metric('ชิ้นจริง', fmt(A.pcs), fmt(L.length) + ' รายการสินค้า', 'แตกชุดโปรเป็นชิ้นตามรหัส SKU')}
      ${metric('ยอดขาย', fmt2(rev), 'ทศนิยม 2 ตำแหน่ง', 'SKU Subtotal After Discount (ยอดหลังส่วนลด ไม่รวมค่าส่ง) ตัวเดียวกับหน้าภาพรวม<br>' + SALE_INFO)}
      ${metric('ชิ้นที่ยังหารเฉลี่ย', fmt(A.avg), A.byRsp ? `ตาม RSP แล้ว ${fmt(A.byRsp)} ชิ้น` : 'ยังไม่มีราคา RSP', 'ชิ้นที่อยู่ในชุดโปรและยังไม่มี RSP ครบทุกตัวในชุด จึงแบ่งยอดแบบหารเฉลี่ยเท่ากันทุกชิ้น<br>กรอก RSP ที่หน้าสต็อกแล้ว ระบบแบ่งตามสัดส่วน RSP ให้เอง')}</section>
    <section class="panel"><div class="panel-h"><h2>สรุปรายสินค้าจริง ${tip('ยอดหลังแบ่ง = ยอดของบรรทัดที่แบ่งให้สินค้าแต่ละตัวแล้ว รวมกันเท่ายอดขาย<br>ราคาเฉลี่ยต่อชิ้น = ยอดหลังแบ่ง ÷ ชิ้น')}</h2></div><div class="wide">
      <table class="ui-table tbl prod" data-no-sort data-no-page><thead><tr><th class="num">#</th><th class="l">สินค้าจริง</th><th class="num">ชิ้น</th><th class="num">ยอดหลังแบ่ง</th><th class="num">ราคาเฉลี่ย / ชิ้น</th><th class="num">RSP ${tip('ราคา RSP ต่อชิ้น ใช้แบ่งยอดชุดโปร (กรอกที่หน้าสต็อก)<br>ชี้ที่ช่องเพื่อดูว่าแบ่งยอดแบบไหนกี่ชิ้น')}</th></tr></thead><tbody>
      ${L.map(([k, x], i) => `<tr><td class="num ui-muted">${i + 1}</td><td class="l">${names[k] && names[k] !== k ? `<span class="pn ui-trunc">${esc(names[k])}</span><small class="ui-code">${esc(k)}</small>` : `<span class="pn ui-code">${esc(k)}</span><small>ยังไม่มีชื่อ</small>`}</td><td class="num">${fmt(x.pcs)}</td><td class="num">${fmt2(x.amt)}</td><td class="num">${fmt2(x.pcs ? x.amt / x.pcs : 0)}</td><td class="num"><span class="has-tip" data-tip="${esc(wayTip(x))}">${rsp[k] ? fmt2(rsp[k]) : '—'}</span>${x.avg ? '<i class="m-dot" aria-hidden="true"></i>' : ''}</td></tr>`).join('')}
      </tbody><tfoot><tr><td></td><td class="l">รวม ${fmt(L.length)} รายการ</td><td class="num">${fmt(A.pcs)}</td><td class="num">${fmt2(A.amt)}</td><td></td><td></td></tr></tfoot></table></div></section>
    <section class="panel" id="itOrders"><div class="panel-h"><h2>รายการออเดอร์ ${tip('แต่ละออเดอร์แตกเป็นสินค้าจริง<br>ยอดของแต่ละบรรทัด (SKU) แบ่งให้สินค้าในชุด เศษสตางค์ไปรวมที่สินค้าตัวสุดท้าย รวมกลับเท่ายอดบรรทัดเสมอ')}</h2>
      <span style="flex:1"></span><div class="form-row"><input type="search" id="itQ" placeholder="ค้นหาหมายเลขคำสั่งซื้อ" value="${esc(IT.q)}" style="width:230px"><button type="button" class="btn" id="itGo">ค้นหา</button></div></div><div id="itBody"><div class="ui-skel sk-box"></div></div></section>`;
  const go = () => { IT.q = document.getElementById('itQ').value.trim(); IT.page = 0; drawOrders(names); };
  document.getElementById('itGo').onclick = go; document.getElementById('itQ').onkeydown = e => { if (e.key === 'Enter') go(); };
  document.getElementById('itDl').onclick = e => exportItems(e.currentTarget, names, rsp, L, A, rev);
  drawOrders(names);
}
async function drawOrders(names) {
  const box = document.getElementById('itBody'); if (!box) return;
  let q = DB.client.from('v_orders').select('order_id, d, state, creator, revenue', { count: 'exact' }).gte('d', RANGE.from).lte('d', RANGE.to).in('state', SALE_STATES);
  if (IT.q) q = q.ilike('order_id', `%${IT.q}%`);
  const { data: O, count, error } = await q.order('d', { ascending: false }).order('order_id').range(IT.page * IT_PER, IT.page * IT_PER + IT_PER - 1);
  if (error) return box.innerHTML = `<div class="empty-note" style="color:var(--bad)">โหลดไม่สำเร็จ: ${esc(error.message)}</div>`;
  if (!O.length) return box.innerHTML = `<div class="empty-note">${IT.q ? 'ไม่พบหมายเลขคำสั่งซื้อนี้ในช่วงวันที่ที่เลือก' : 'ไม่มีออเดอร์ในช่วงนี้'}</div>`;
  const R = await DB.select('v_order_items', '*', x => x.in('order_id', O.map(o => o.order_id)).order('sku_id').order('line_no').order('k'));
  const pages = Math.ceil(count / IT_PER);
  const ST_CLS = { 'ส่งสำเร็จ': 'good', 'คืนสินค้า': 'warn' }, MTIP = { 'ไม่ต้องแบ่ง': 'SKU ชิ้นเดียว ไม่ต้องแบ่งยอด', 'ตาม RSP': 'ชุดโปร: แบ่งยอดตามสัดส่วน RSP', 'หารเฉลี่ย': 'ชุดโปร: หารเฉลี่ยเท่ากันทุกชิ้น (ยังไม่มี RSP ครบในชุด)' };
  box.innerHTML = `<div class="wide"><table class="ui-table tbl it-tbl" data-no-sort data-no-page><thead><tr><th class="l">คำสั่งซื้อ</th><th class="l">วันที่สั่ง</th><th class="l">Creator</th><th class="l">SKU</th><th class="num">ชุด</th><th class="num">ยอด SKU</th><th class="l">สินค้าจริง</th><th class="num">ชิ้น</th><th class="num">ราคาต่อชิ้น</th><th class="num">ยอดหลังแบ่ง ${tip('ยอดของ SKU ที่แบ่งให้สินค้าแต่ละตัว รวมกันเท่ายอด SKU<br>ชี้ที่ตัวเลขเพื่อดูวิธีแบ่ง · จุดสีส้ม = หารเฉลี่ยเพราะยังไม่มี RSP')}</th></tr></thead><tbody>
    ${O.map((o, oi) => { const items = R.filter(r => r.order_id === o.order_id), lines = [...new Set(items.map(r => r.sku_id + '|' + r.line_no))], n = items.length, cls = oi % 2 ? ' o-alt' : '';
      const head = `<td class="l" rowspan="${n}"><span class="ui-code">${esc(o.order_id)}</span></td><td class="l" rowspan="${n}">${dTh(o.d)}</td><td class="l" rowspan="${n}">${o.creator ? esc(o.creator) : dash}</td>`;
      let first = true;
      return lines.map(key => { const g = items.filter(r => r.sku_id + '|' + r.line_no === key);
        return g.map((r, j) => { const tr = `<tr class="${first ? 'o-start' : ''}${cls}">${first ? head : ''}${j ? '' : `<td class="l" rowspan="${g.length}"><span class="ui-code">${esc(r.sku)}</span></td><td class="num" rowspan="${g.length}">${fmt(r.sets)}</td><td class="num" rowspan="${g.length}">${fmt2(r.line_amount)}</td>`}<td class="l"><span class="pn ui-trunc">${esc(names[r.item] || r.item)}</span><small class="ui-code">${esc(r.item)}</small></td><td class="num">${fmt(r.pcs)}</td><td class="num">${fmt2(r.amount / r.pcs)}</td><td class="num"><b class="has-tip" data-tip="${esc(MTIP[r.method] || r.method)}">${fmt2(r.amount)}</b>${r.method === 'หารเฉลี่ย' ? '<i class="m-dot" aria-hidden="true"></i>' : ''}</td></tr>`; first = false; return tr; }).join(''); }).join(''); }).join('')}
    </tbody></table></div>
    <div class="ui-pager"><span>ออเดอร์ ${fmt(IT.page * IT_PER + 1)}–${fmt(Math.min(count, IT.page * IT_PER + IT_PER))} จาก ${fmt(count)}</span><div class="ui-pager-btns"><button type="button" data-p="-1"${IT.page ? '' : ' disabled'}>‹ ก่อนหน้า</button><button type="button" aria-current="page">${fmt(IT.page + 1)} / ${fmt(pages)}</button><button type="button" data-p="1"${IT.page + 1 < pages ? '' : ' disabled'}>ถัดไป ›</button></div></div>`;
  box.querySelectorAll('[data-p]').forEach(b => b.onclick = () => { IT.page += +b.dataset.p; drawOrders(names); document.getElementById('itOrders').scrollIntoView({ behavior: 'smooth', block: 'start' }); });
}
// ดาวน์โหลด Excel: ชีตรายละเอียด (1 แถว = สินค้าจริง 1 ตัวในบรรทัด) + ชีตสรุปรายสินค้า + แถวตรวจรวมกลับ
async function exportItems(btn, names, rsp, L, A, rev) {
  const label = btn.innerHTML; btn.disabled = true; btn.textContent = 'กำลังเตรียมไฟล์…';
  try {
    const R = await DB.select('v_order_items', '*', q => inRange(q).order('d').order('order_id').order('sku_id').order('line_no').order('k'));
    const r2 = v => Math.round(v * 100) / 100;
    const detail = R.map(r => ({ 'วันที่สั่ง': r.d, 'หมายเลขคำสั่งซื้อ': r.order_id, 'สถานะ': r.state, 'Creator': r.creator || '', 'SKU': r.sku, 'จำนวนชุด': +r.sets,
      'ยอด SKU (หลังส่วนลด)': +r.k === 1 ? +r.line_amount : null, 'รหัสสินค้าจริง': r.item, 'ชื่อสินค้า': names[r.item] || r.item, 'จำนวนชิ้น': +r.pcs,
      'ราคาต่อชิ้น': r2(r.amount / r.pcs), 'ยอดหลังแบ่ง': +r.amount, 'วิธีแบ่ง': r.method }));
    const sum = detail.reduce((a, r) => a + r['ยอดหลังแบ่ง'], 0);
    detail.push({}, { 'หมายเลขคำสั่งซื้อ': 'รวม', 'ยอด SKU (หลังส่วนลด)': r2(detail.reduce((a, r) => a + (r['ยอด SKU (หลังส่วนลด)'] || 0), 0)), 'จำนวนชิ้น': detail.reduce((a, r) => a + (r['จำนวนชิ้น'] || 0), 0), 'ยอดหลังแบ่ง': r2(sum) });
    const summary = L.map(([k, x]) => ({ 'รหัสสินค้าจริง': k, 'ชื่อสินค้า': names[k] || k, 'ชิ้น': x.pcs, 'ยอดหลังแบ่ง': r2(x.amt), 'ราคาเฉลี่ยต่อชิ้น': r2(x.pcs ? x.amt / x.pcs : 0), 'RSP': rsp[k] || null, 'ชิ้นที่แบ่งตาม RSP': x.byRsp, 'ชิ้นที่หารเฉลี่ย': x.avg }));
    summary.push({}, { 'ชื่อสินค้า': 'รวมรายชิ้น', 'ชิ้น': A.pcs, 'ยอดหลังแบ่ง': r2(A.amt) }, { 'ชื่อสินค้า': 'ยอดขาย (ตรวจสอบ)', 'ยอดหลังแบ่ง': r2(rev) });
    const wb = XLSX.utils.book_new(), money = ['ยอด SKU (หลังส่วนลด)', 'ราคาต่อชิ้น', 'ยอดหลังแบ่ง', 'ราคาเฉลี่ยต่อชิ้น', 'RSP'];
    [['รายละเอียด', detail], ['สรุปรายสินค้า', summary]].forEach(([n, rows]) => {
      const ws = XLSX.utils.json_to_sheet(rows), head = Object.keys(rows[0]), rng = XLSX.utils.decode_range(ws['!ref']);
      head.forEach((h, c) => { if (!money.includes(h)) return; for (let r = 1; r <= rng.e.r; r++) { const cell = ws[XLSX.utils.encode_cell({ r, c })]; if (cell && cell.t === 'n') cell.z = '#,##0.00'; } });
      ws['!cols'] = head.map(h => ({ wch: Math.max(10, h.length + 4, h === 'ชื่อสินค้า' ? 40 : 0, h === 'หมายเลขคำสั่งซื้อ' ? 22 : 0) }));
      XLSX.utils.book_append_sheet(wb, ws, n);
    });
    XLSX.writeFile(wb, `รายละเอียดออเดอร์_${RANGE.from}_${RANGE.to}.xlsx`);
  } catch (e) { uiAlert ? uiAlert('ดาวน์โหลดไม่สำเร็จ', { text: e.message, tone: 'bad' }) : alert(e.message); }
  btn.disabled = false; btn.innerHTML = label;
}

// ===== สต็อก + ราคา RSP: รายการสินค้าจริงทุกตัวที่เคยขาย (ดึงให้เอง) · กรอกชื่อ / RSP / สต็อกตั้งต้นในตาราง · บันทึกรับเข้า =====
async function pageStock(el) {
  const rows = await sel('v_stock', false), today = ymd(new Date());
  const noRsp = rows.filter(r => !(+r.rsp > 0)).length, notCounted = rows.filter(r => !r.counted).length, low = rows.filter(r => r.days_left != null && +r.days_left < +r.min_days).length;
  const num = v => v == null || v === '' ? '' : +v;
  el.innerHTML = `<section class="ui-metrics hero">${metric('สินค้าจริง', fmt(rows.length), 'รายการ', 'สินค้าจริงทุกตัวที่เคยขาย (แตกจากรหัส SKU) + ที่เพิ่มเอง')}${metric('ยังไม่มี RSP', fmt(noRsp), noRsp ? 'ชุดโปรที่มีสินค้าเหล่านี้จะหารเฉลี่ย' : 'ครบแล้ว', 'RSP ใช้แบ่งยอดชุดโปรในหน้ารายละเอียดออเดอร์')}
      ${metric('ยังไม่ตั้งสต็อก', fmt(notCounted), 'ยังไม่กรอกสต็อกตั้งต้น', 'กรอกสต็อกตั้งต้น + วันที่นับ แล้วระบบเริ่มนับคงเหลือให้')}${metric('ใกล้หมด', fmt(low), 'ขายได้อีกน้อยกว่ากำหนด', 'ขายได้อีก (วัน) น้อยกว่าจำนวนวันขั้นต่ำของสินค้านั้น (ตั้งต้น 14 วัน)')}</section>
    <section class="panel"><div class="panel-h"><h2>สินค้าและสต็อก ${tip('กรอกได้ในตาราง แล้วกดบันทึก<br>ชื่อ: ใช้แสดงทุกหน้า (เว้นว่าง = ใช้ชื่อจากไฟล์คำสั่งซื้อ)<br>RSP: ราคาต่อชิ้น ใช้แบ่งยอดชุดโปร<br>สต็อกตั้งต้น + วันที่นับ: เริ่มนับคงเหลือ = ตั้งต้น + รับเข้า − ส่งออก (นับชิ้นจริง ตั้งแต่วันที่นับ)<br>ขายได้อีก = คงเหลือ ÷ ส่งออกเฉลี่ย 30 วัน')}</h2>
      <span style="flex:1"></span><span class="ui-muted" id="stDirty"></span><button type="button" class="btn pri" id="stSave" disabled>บันทึก</button></div>
      <div class="wide"><table class="ui-table tbl st-tbl" data-no-sort data-no-page><thead><tr><th class="l">สินค้าจริง</th><th class="num">RSP (บาท)</th><th class="num">สต็อกตั้งต้น</th><th class="l">วันที่นับ</th><th class="num">รับเข้า</th><th class="num">ส่งออก</th><th class="num">คงเหลือ</th><th class="num">ส่งเฉลี่ย / วัน</th><th class="num">ขายได้อีก</th></tr></thead><tbody>
      ${rows.map(r => `<tr data-sku="${esc(r.sku)}"><td class="l"><span class="ui-code">${esc(r.sku)}</span><input class="st-in st-nm" data-f="name" value="${esc(r.name_set || '')}" placeholder="${esc(r.name !== r.sku ? r.name : 'ตั้งชื่อสินค้า')}"></td>
        <td class="num"><input class="st-in st-n" data-f="rsp" type="number" min="0" step="0.01" value="${num(r.rsp)}" placeholder="—"></td>
        <td class="num"><input class="st-in st-n" data-f="opening_stock" type="number" min="0" step="1" value="${num(r.opening_stock)}" placeholder="—"></td>
        <td class="l"><input class="st-in" data-f="opening_date" type="date" value="${String(r.opening_date || '').slice(0, 10)}" max="${today}"></td>
        <td class="num">${r.counted ? fmt(r.stock_in) : dash}</td><td class="num">${r.counted ? fmt(r.shipped) : dash}</td>
        <td class="num">${r.counted ? `<b${+r.on_hand < 0 ? ' style="color:var(--bad)"' : ''}>${fmt(r.on_hand)}</b>` : dash}</td><td class="num">${fmt1(r.avg_day)}</td>
        <td class="num">${r.days_left == null ? dash : `<span class="ui-chip ${+r.days_left < +r.min_days ? 'dn' : 'up'}">${fmt(r.days_left)} วัน</span>`}</td></tr>`).join('') || '<tr><td colspan="9" class="l ui-muted">ยังไม่มีสินค้า — อัปโหลดไฟล์คำสั่งซื้อก่อน</td></tr>'}
      </tbody></table></div></section>
    <section class="panel"><div class="panel-h"><h2>บันทึกรับสินค้าเข้า ${tip('จำนวนเป็นชิ้นจริง · นับเฉพาะรับเข้าตั้งแต่วันที่นับสต็อกตั้งต้นของสินค้านั้น')}</h2></div>
      <div class="form-row"><select id="siSku" style="min-width:260px"><option value="">เลือกสินค้า</option>${rows.map(r => `<option value="${esc(r.sku)}">${esc(r.sku)} · ${esc(r.name)}</option>`).join('')}</select>
      <input id="siQty" type="number" min="1" placeholder="จำนวน (ชิ้น)" style="width:130px"><input id="siDate" type="date" value="${today}" max="${today}"><input id="siNote" placeholder="หมายเหตุ" style="flex:1;min-width:160px"><button class="btn pri" id="siSave">บันทึก</button></div><div class="gate-err" id="siMsg" style="margin-top:6px"></div></section>`;
  // แก้ในตาราง: เทียบกับค่าเดิม นับแถวที่เปลี่ยน แล้วบันทึกทีเดียว
  const dirty = () => [...el.querySelectorAll('.st-tbl tbody tr[data-sku]')].filter(tr => [...tr.querySelectorAll('.st-in')].some(i => i.value !== i.defaultValue));
  const mark = () => { const d = dirty(); el.querySelectorAll('.st-tbl tbody tr').forEach(tr => tr.classList.toggle('is-dirty', d.includes(tr))); document.getElementById('stSave').disabled = !d.length; document.getElementById('stDirty').textContent = d.length ? `แก้ไข ${fmt(d.length)} รายการ ยังไม่บันทึก` : ''; };
  el.querySelectorAll('.st-in').forEach(i => { i.addEventListener('input', mark); i.addEventListener('change', mark); });
  document.getElementById('stSave').onclick = async e => {
    const btn = e.currentTarget, rowsOut = dirty().map(tr => { const v = f => tr.querySelector(`[data-f="${f}"]`).value.trim(); return { sku: tr.dataset.sku, name: v('name') || null, rsp: v('rsp') === '' ? null : +v('rsp'), opening_stock: v('opening_stock') === '' ? null : +v('opening_stock'), opening_date: v('opening_date') || null }; });
    const bad = rowsOut.find(r => (r.opening_stock == null) !== (r.opening_date == null));
    if (bad) { await uiAlert('กรอกสต็อกตั้งต้นและวันที่นับคู่กัน', { text: `สินค้า ${bad.sku}: ต้องมีทั้งจำนวนตั้งต้นและวันที่นับ หรือเว้นว่างทั้งคู่`, tone: 'bad' }); return; }
    btn.disabled = true; btn.textContent = 'กำลังบันทึก…';
    try { await DB.upsert('products', rowsOut, 'sku'); clearCache(); route(); } catch (x) { btn.disabled = false; btn.textContent = 'บันทึก'; uiAlert('บันทึกไม่สำเร็จ', { text: x.message, tone: 'bad' }); }
  };
  document.getElementById('siSave').onclick = async () => {
    const sku = siSku.value, qty = +siQty.value, msg = document.getElementById('siMsg');
    if (!sku || !(qty > 0)) { msg.textContent = 'กรุณาเลือกสินค้าและกรอกจำนวน'; return; }
    msg.textContent = ''; await DB.insert('stock_in', { sku, qty, moved_on: siDate.value, note: siNote.value || null }); clearCache(); route();
  };
}

// ===== เงินเข้า: รายได้ − ค่าธรรมเนียมทั้งหมด (รวมค่าคอม Creator แล้ว) + ปรับยอด / ชดเชย = เงินเข้า · ตามรายงานรับเงิน นับตามวันที่เงินเข้า =====
async function pageMoney(el) {
  const rows = [...await sel('v_settlement_daily')].sort((a, b) => a.d < b.d ? 1 : -1).map(r => ({ ...r, adj: +r.amount - +r.revenue - +r.fees }));
  const S = k => rows.reduce((a, r) => a + (+r[k] || 0), 0), feePct = S('revenue') ? Math.abs(S('fees')) / S('revenue') * 100 : 0;
  const neg = v => `<span class="ui-muted">${fmt(v)}</span>`;
  el.innerHTML = `<section class="ui-metrics hero money-hero">${metric('รายได้', fmt(S('revenue')), 'ยอดขาย + ค่าส่งที่ลูกค้าจ่าย ฯลฯ', 'รายได้ทั้งหมดตามรายงานรับเงิน (ก่อนหักค่าธรรมเนียม)')}
      ${metric('− ค่าธรรมเนียมทั้งหมด', fmt(Math.abs(S('fees'))), `${feePct.toFixed(1)}% ของรายได้ · ในนี้ค่าคอม Creator ${fmt(Math.abs(S('affiliate_commission')))}`, 'ค่าธรรมเนียมทุกอย่างที่ TikTok หัก<br>รวมค่าคอมมิชชั่น TikTok / ค่าคอม Creator / ค่าธรรมเนียมคำสั่งซื้อ / ค่าส่งสุทธิ ฯลฯ<br>ค่าคอม Creator <b>อยู่ในก้อนนี้แล้ว</b> ไม่ต้องหักซ้ำ')}
      ${metric('+ ปรับยอด / ชดเชย', fmt(S('adj')), 'เงินชดเชย / รายการปรับยอดจาก TikTok', 'เงินเข้า − รายได้ + ค่าธรรมเนียม (เช่น เงินชดเชยด้านโลจิสติกส์)')}
      ${metric('= เงินเข้า', fmt(S('amount')), `${fmt(S('orders'))} ออเดอร์`, 'ยอดที่ TikTok โอนเข้าจริง หักค่าธรรมเนียมและค่าคอม Creator แล้ว · นับตามวันที่เงินเข้า')}</section>
    <section class="panel"><div class="panel-h"><h2>เงินเข้ารายวัน</h2></div><div class="wide"><table class="ui-table tbl" data-no-page><thead><tr><th class="l">วันที่เงินเข้า</th><th class="num">ออเดอร์</th><th class="num">รายได้</th><th class="num">ค่าธรรมเนียม</th><th class="num">ในนี้ค่าคอม Creator ${tip('เป็นส่วนหนึ่งของค่าธรรมเนียม (ไม่ใช่หักเพิ่ม)')}</th><th class="num">ปรับยอด</th><th class="num">เงินเข้า</th></tr></thead><tbody>
    ${rows.map(r => `<tr><td class="l">${dFull(r.d)}</td><td class="num">${fmt(r.orders)}</td><td class="num">${fmt(r.revenue)}</td><td class="num">${fmt(r.fees)}</td><td class="num">${neg(r.affiliate_commission)}</td><td class="num">${Math.round(r.adj) ? fmt(r.adj) : dash}</td><td class="num"><b>${fmt(r.amount)}</b></td></tr>`).join('') || '<tr><td colspan="7" class="l ui-muted">ยังไม่มีข้อมูลเงินเข้าในช่วงนี้ — อัปโหลดรายงานรับเงินที่หน้า "อัปโหลด"</td></tr>'}
    </tbody>${rows.length ? `<tfoot><tr><td class="l">รวม</td><td class="num">${fmt(S('orders'))}</td><td class="num">${fmt(S('revenue'))}</td><td class="num">${fmt(S('fees'))}</td><td class="num">${neg(S('affiliate_commission'))}</td><td class="num">${fmt(S('adj'))}</td><td class="num">${fmt(S('amount'))}</td></tr></tfoot>` : ''}</table></div></section>`;
}

// ===== ตัวสลับหน้า (#ชื่อหน้า) =====
function pageActs() { let a = document.getElementById('pageActs'); if (!a) { a = document.createElement('div'); a.id = 'pageActs'; a.className = 'page-acts'; document.getElementById('range').before(a); } return a; }
let PREFETCHED = '';
async function route(quiet) {
  if (!quiet) closeCreator(); const keepY = quiet ? scrollY : 0; pageActs().innerHTML = '';
  const id = (location.hash || '#overview').slice(1), pg = PAGES.find(p => p[0] === id) || PAGES[0];
  document.querySelectorAll('#nav a').forEach(a => a.classList.toggle('on', a.dataset.p === pg[0]));
  document.getElementById('pageTitle').textContent = pg[1];
  document.getElementById('range').style.visibility = ['stock', 'upload'].includes(pg[0]) ? 'hidden' : 'visible';
  const el = document.getElementById('content'); if (!quiet) el.innerHTML = pg[0] === 'upload' ? '' : SKEL;
  try { await ({ overview: pageOverview, creators: pageCreators, products: pageProducts, items: pageItems, stock: pageStock, money: pageMoney, upload: pageUpload })[pg[0]](el); limitRows(el); if (window.UI && UI.fit) UI.fit(); if (quiet) scrollTo(0, keepY); pinSoon();
    if (PREFETCHED !== RANGE.from + RANGE.to) { PREFETCHED = RANGE.from + RANGE.to; prefetch(); } }
  catch (e) { el.innerHTML = `<div class="panel empty-note" style="color:var(--bad)">โหลดไม่สำเร็จ: ${esc(e.message)}</div>`; }
}
document.getElementById('appName').textContent = (window.APP && APP.NAME) || 'ระบบวิเคราะห์ยอดขาย'; document.title = document.getElementById('appName').textContent;
document.querySelector('.sb-logo').innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M5 20V12M12 20V5M19 20v-9"/></svg>';   // โลโก้กลาง ไม่ผูกกับช่องทางใด
const NAV_ICON = { overview: 'M4 13h6V4H4zM14 20h6v-9h-6zM14 4h6v4h-6zM4 20h6v-3H4z', creators: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0', products: 'M3 7h11v9H3zM14 10h4l3 3v3h-7M7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM17 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  items: 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6M9 16h3', stock: 'M21 8 12 3 3 8v8l9 5 9-5zM3 8l9 5 9-5M12 13v8', money: 'M3 7h18v12H3zM3 11h18M7 15h3', upload: 'M12 16V4M7 9l5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3' };
document.getElementById('nav').innerHTML = PAGES.map(([id, n]) => `<a href="#${id}" data-p="${id}"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${NAV_ICON[id] || ''}"/></svg><span>${n}</span></a>`).join('');
if (!(window.APP && APP.SHARED_LOGIN_EMAIL)) document.getElementById('btnOut').style.display = 'none';
else document.getElementById('btnOut').onclick = async () => { await IDB.clear(); DB.signOut(); };   // ออกจากระบบ = ล้างข้อมูลที่จำไว้ในเครื่องด้วย
initRange(); window.addEventListener('hashchange', route); DB.ready.then(route);
