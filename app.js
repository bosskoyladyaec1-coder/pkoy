// app.js — หน้าวิเคราะห์ (อ่านจาก view ในฐานข้อมูล · หน้าเว็บแค่แสดง) · หน้า: ภาพรวม · Creator · สินค้าที่ส่ง · สต็อก · เงินเข้า · อัปโหลด
// กฎที่ยกมาจากระบบต้นแบบ: ยอดเงินเต็มจำนวน ไม่มี ฿ · ⓘ ทุกตัวเลขบอกรวม / ไม่รวม · แถวรวมล่างสุด = ตัวเลขในแถบบน · สีเขียว / แดงใช้เมื่อหมายถึงดี / ไม่ดีเท่านั้น
const PAGES = [['overview', 'ภาพรวม'], ['creators', 'Creator'], ['products', 'สินค้าที่ส่ง'], ['stock', 'สต็อก'], ['money', 'เงินเข้า'], ['upload', 'อัปโหลด']];
const fmt = v => Math.round(+v || 0).toLocaleString('en-US');
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
const presetOf = (a, b) => { const p = presets(); return Object.keys(p).find(k => p[k][0] === a && p[k][1] === b) || ''; };
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
      <div class="rp-foot"><span class="rp-sel"></span><button type="button" class="btn" data-act="cancel">ยกเลิก</button><button type="button" class="btn pri" data-act="ok">ใช้ช่วงนี้</button></div></div>`;
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
    const p = ev.target.closest('[data-p]'); if (p) { const [a, b] = presets()[p.dataset.p]; closeRP(); return setRange(a, b); }
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
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeRP(); });
  addEventListener('resize', closeRP);
  const [a, b] = presets()['เดือนนี้']; RANGE = { from: a, to: b }; drawRangeBtn();
}
const inRange = q => q.gte('d', RANGE.from).lte('d', RANGE.to);
const metric = (label, value, sub, info) => `<div class="ui-metric is-static"><span class="ui-metric-l">${label}${info ? ' ' + tip(info) : ''}</span><span class="ui-metric-v" data-fit>${value}</span><span class="md">${sub || '&nbsp;'}</span></div>`;
const chart = (id, cfg) => { if (CHARTS[id]) CHARTS[id].destroy(); const el = document.getElementById(id); if (el) CHARTS[id] = new Chart(el, cfg); };
const css = v => getComputedStyle(document.body).getPropertyValue(v).trim();
const dash = '<span class="ui-muted">—</span>';
function limitRows(root) {   // ตารางที่มี data-limit="n": แสดง n แถวแรก + ปุ่มแสดงทั้งหมด (แถวรวมด้านล่างรวมทุกแถวเสมอ)
  root.querySelectorAll('table[data-limit]').forEach(t => {
    const n = +t.dataset.limit, extra = [...t.tBodies[0].rows].slice(n); if (!extra.length) return;
    const b = document.createElement('button'); b.type = 'button'; b.className = 'btn more';
    const set = open => { extra.forEach(r => r.hidden = !open); b.textContent = open ? `ย่อเหลือ ${n} แถว` : `แสดงทั้งหมด ${fmt(n + extra.length)} แถว`; b.onclick = () => set(!open); };
    set(false); t.closest('.panel').querySelector('.panel-h').appendChild(b);
  });
}

// ===== ภาพรวม: ยอดขาย · ออเดอร์ · AOV · ชิ้น · สัดส่วนผ่าน Creator + กราฟรายวันแยกแหล่งที่มา + ตารางแหล่งที่มา =====
async function pageOverview(el) {
  const [rows, B, S, I, N] = await Promise.all([DB.select('v_sales_daily', '*', inRange), DB.select('v_basket_daily', '*', inRange), DB.select('v_sku_daily', '*', inRange), DB.select('v_item_daily', '*', inRange), DB.select('v_item_names')]);
  if (!rows.length) return el.innerHTML = '<div class="panel empty-note">ยังไม่มียอดขายในช่วงนี้ — อัปโหลดไฟล์คำสั่งซื้อที่หน้า "อัปโหลด"</div>';
  const T = rows.reduce((a, r) => ({ rev: a.rev + +r.revenue, ord: a.ord + +r.orders, items: a.items + +r.items }), { rev: 0, ord: 0, items: 0 });
  const bySrc = {}; rows.forEach(r => { const s = bySrc[r.source] = bySrc[r.source] || { rev: 0, ord: 0, items: 0 }; s.rev += +r.revenue; s.ord += +r.orders; s.items += +r.items; });
  const aff = Object.entries(bySrc).filter(([k]) => k.startsWith('Creator')).reduce((a, [, v]) => a + v.rev, 0);
  const srcs = Object.keys(bySrc).sort((a, b) => bySrc[b].rev - bySrc[a].rev), ds = days(RANGE.from, RANGE.to);
  el.innerHTML = `<section class="ui-metrics hero">
      ${metric('ยอดขาย', fmt(T.rev), `${ds.length} วัน · เฉลี่ย ${fmt(T.rev / ds.length)} / วัน`, 'ยอดสินค้าหลังส่วนลด <b>ไม่รวม</b>ค่าส่ง และ<b>ไม่รวม</b>ออเดอร์ที่ยกเลิก · นับตามวันที่สั่งซื้อ (เวลาไทย)')}
      ${metric('ออเดอร์', fmt(T.ord), '', '<b>ไม่รวม</b>ออเดอร์ที่ยกเลิก')}
      ${metric('AOV', fmt(T.ord ? T.rev / T.ord : 0), 'ยอดขาย ÷ ออเดอร์', 'ยอดขายเฉลี่ยต่อออเดอร์')}
      ${metric('ชิ้นที่ขาย', fmt(T.items), `จาก ${fmt(B.reduce((a, r) => a + +r.sets, 0))} ชุด / SKU`, 'ชิ้นจริงในออเดอร์ที่ไม่ถูกยกเลิก<br>ชุดโปรแตกเป็นชิ้นตามรหัส SKU เช่น ซื้อ 3 แถม 1 = 4 ชิ้น')}
      ${metric('ยอดผ่าน Creator', T.rev ? (aff / T.rev * 100).toFixed(1) + '%' : '—', 'ยอด ' + fmt(aff), 'ยอดของออเดอร์ที่มี Creator Handle (ไม่นับบัญชีร้านเอง) ÷ ยอดขายทั้งหมด')}
    </section>
    <div class="grid2"><section class="panel"><div class="panel-h"><h2>ยอดขายรายวัน แยกแหล่งที่มา</h2></div><div style="height:280px;"><canvas id="cSales"></canvas></div></section>
    <section class="panel"><div class="panel-h"><h2>แหล่งที่มา ${tip('ช่องทางจากคอลัมน์ Order Channel ในไฟล์คำสั่งซื้อ (Live / คลิป / หน้าสินค้า)<br>ร้าน = ไม่มี Creator หรือเป็นบัญชีร้านเอง · Creator = มี Creator Handle')}</h2></div>
      <div class="wide"><table class="ui-table tbl" data-no-sort data-no-page><thead><tr><th class="l">แหล่ง</th><th class="num">ยอดขาย</th><th class="l">สัดส่วน</th><th class="num">ออเดอร์</th></tr></thead><tbody>
      ${srcs.map(s => { const x = bySrc[s], sh = x.rev / T.rev * 100; return `<tr><td class="l"><span style="display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:8px;background:${srcColor(s)}"></span>${esc(s)}</td><td class="num">${fmt(x.rev)}</td><td class="l"><span class="bar"><b style="width:${sh.toFixed(1)}%;background:${srcColor(s)}"></b></span>${Math.round(sh)}%</td><td class="num">${fmt(x.ord)}</td></tr>`; }).join('')}
      </tbody><tfoot><tr><td class="l">รวม</td><td class="num">${fmt(T.rev)}</td><td class="l">100%</td><td class="num">${fmt(T.ord)}</td></tr></tfoot></table></div></section></div>
    <section class="panel" id="prodPanel"><div class="panel-h"><h2>สินค้าขายดี ${tip('ตะกร้า = สินค้าที่ลูกค้ากดซื้อ (Product Name) · 1 ตะกร้ามีได้หลาย SKU<br>SKU = ตัวเลือกที่ขาย (Seller SKU) · ชุดโปรนับเป็น 1 ชุด<br>สินค้าจริง = แตกชุดโปรเป็นชิ้นตามรหัส SKU เช่น MDAZ30Cx3+MDAZ15Cx1 = MDAZ30C 3 ชิ้น + MDAZ15C 1 ชิ้น<br><b>ไม่รวม</b>ออเดอร์ที่ยกเลิก')}</h2>
      <span style="flex:1"></span><div class="ui-presets" id="prodTabs">${Object.entries(PROD_TABS).map(([k, n]) => `<button type="button" data-t="${k}" aria-pressed="${k === PROD_TAB}">${n}</button>`).join('')}</div></div>
      <div class="wide" id="prodBody"></div></section>`;
  const P = prodData(B, S, I, N);
  const drawProd = () => { const panel = document.getElementById('prodPanel'); panel.querySelectorAll('.btn.more').forEach(b => b.remove()); document.getElementById('prodBody').innerHTML = prodTable(P); limitRows(panel);
    panel.querySelectorAll('#prodTabs button').forEach(b => b.setAttribute('aria-pressed', b.dataset.t === PROD_TAB)); if (window.UI && UI.fit) UI.fit(); };
  document.querySelectorAll('#prodTabs button').forEach(b => b.onclick = () => { PROD_TAB = b.dataset.t; drawProd(); });
  drawProd();
  chart('cSales', { type: 'bar', data: { labels: ds.map(dTh), datasets: srcs.map(s => ({ label: s, data: ds.map(d => rows.filter(r => r.d === d && r.source === s).reduce((a, r) => a + +r.revenue, 0)), backgroundColor: srcColor(s), borderColor: srcColor(s), borderWidth: 0, borderRadius: 3, stack: 's' })) },
    options: { maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
      plugins: { legend: { position: 'bottom', labels: { color: css('--text2'), boxWidth: 10 } },
        tooltip: { uiShare: true, itemSort: (a, b) => b.parsed.y - a.parsed.y, filter: i => i.parsed.y > 0,
          callbacks: { title: it => dFull(ds[it[0].dataIndex]), label: c => `${c.dataset.label}: ${fmt(c.parsed.y)}`, footer: it => 'รวม: ' + fmt(it.reduce((a, i) => a + i.parsed.y, 0)) } } }, scales: { x: { stacked: true, ticks: { color: css('--text3'), maxRotation: 0, autoSkip: true, maxTicksLimit: 12 }, grid: { display: false } }, y: { stacked: true, ticks: { color: css('--text3') }, grid: { color: css('--grid') || 'rgba(0,0,0,.06)' } } } } });
}

// ===== สินค้าขายดี (ในหน้าภาพรวม): ตะกร้า / SKU / สินค้าจริง · รวมยอดจาก view รายวันของแต่ละแบบ =====
let PROD_TAB = 'basket';
const PROD_TABS = { basket: 'ตะกร้า', sku: 'SKU', item: 'สินค้าจริง' };
function prodData(B, S, I, N) {
  const P = { basket: {}, sku: {}, item: {}, names: Object.fromEntries(N.map(r => [r.item, r.name])), T: { rev: 0, sets: 0, pcs: 0, single: 0, bundle: 0 } };
  B.forEach(r => { const x = P.basket[r.basket] = P.basket[r.basket] || { rev: 0, ord: 0, sets: 0, pcs: 0, skus: new Set() };
    x.rev += +r.revenue; x.ord += +r.orders; x.sets += +r.sets; x.pcs += +r.pcs; (r.skus || []).forEach(k => x.skus.add(k)); P.T.rev += +r.revenue; P.T.sets += +r.sets; P.T.pcs += +r.pcs; });
  S.forEach(r => { const x = P.sku[r.sku] = P.sku[r.sku] || { rev: 0, ord: 0, sets: 0, pcs: 0, name: r.item_name, basket: r.basket, bundle: r.is_bundle };
    x.rev += +r.revenue; x.ord += +r.orders; x.sets += +r.sets; x.pcs += +r.pcs; });
  I.forEach(r => { const x = P.item[r.item] = P.item[r.item] || { pcs: 0, single: 0, bundle: 0, ord: 0 };
    x.pcs += +r.pcs; x.single += +r.pcs_single; x.bundle += +r.pcs_bundle; x.ord += +r.orders; P.T.single += +r.pcs_single; P.T.bundle += +r.pcs_bundle; });
  return P;
}
function prodTable(P) {
  const share = (v, t) => { const p = t ? v / t * 100 : 0; return `<span class="bar"><b style="width:${p.toFixed(1)}%"></b></span>${p > 0 && p < 1 ? '&lt;1' : Math.round(p)}%`; };
  const ordH = `<th class="num">ออเดอร์ ${tip('1 ออเดอร์มีได้หลายรายการ ช่องนี้จึงไม่รวมในแถวรวม (จำนวนออเดอร์จริงดูที่แถบบน)')}</th>`;
  const table = (head, body, foot) => `<table class="ui-table tbl prod" data-no-sort data-no-page data-limit="10"><thead><tr>${head}</tr></thead><tbody>${body}</tbody><tfoot><tr>${foot}</tr></tfoot></table>`;
  if (PROD_TAB === 'basket') { const L = Object.entries(P.basket).sort((a, b) => b[1].rev - a[1].rev);
    return table(`<th class="num">#</th><th class="l">ตะกร้า</th><th class="num">ยอดขาย</th><th class="l">สัดส่วน</th>${ordH}<th class="num">ชุดที่ขาย</th><th class="num">ชิ้นจริง</th>`,
      L.map(([n, x], i) => `<tr><td class="num ui-muted">${i + 1}</td><td class="l"><span class="pn ui-trunc">${esc(n)}</span><small>${fmt(x.skus.size)} SKU</small></td><td class="num">${fmt(x.rev)}</td><td class="l">${share(x.rev, P.T.rev)}</td><td class="num">${fmt(x.ord)}</td><td class="num">${fmt(x.sets)}</td><td class="num">${fmt(x.pcs)}</td></tr>`).join(''),
      `<td></td><td class="l">รวม ${fmt(L.length)} ตะกร้า</td><td class="num">${fmt(P.T.rev)}</td><td class="l">100%</td><td></td><td class="num">${fmt(P.T.sets)}</td><td class="num">${fmt(P.T.pcs)}</td>`); }
  if (PROD_TAB === 'sku') { const L = Object.entries(P.sku).sort((a, b) => b[1].rev - a[1].rev);
    return table(`<th class="num">#</th><th class="l">SKU</th><th class="num">ยอดขาย</th><th class="l">สัดส่วน</th>${ordH}<th class="num">ชุดที่ขาย</th><th class="num">ชิ้นจริง</th>`,
      L.map(([k, x], i) => `<tr><td class="num ui-muted">${i + 1}</td><td class="l"><span class="pn"><span class="ui-code">${esc(k)}</span>${x.bundle ? ' <span class="ui-badge gold">ชุด / โปร</span>' : ''}</span><small class="ui-trunc pn">${esc(x.name || '')}</small></td><td class="num">${fmt(x.rev)}</td><td class="l">${share(x.rev, P.T.rev)}</td><td class="num">${fmt(x.ord)}</td><td class="num">${fmt(x.sets)}</td><td class="num">${fmt(x.pcs)}</td></tr>`).join(''),
      `<td></td><td class="l">รวม ${fmt(L.length)} SKU</td><td class="num">${fmt(P.T.rev)}</td><td class="l">100%</td><td></td><td class="num">${fmt(P.T.sets)}</td><td class="num">${fmt(P.T.pcs)}</td>`); }
  const L = Object.entries(P.item).sort((a, b) => b[1].pcs - a[1].pcs);
  return table(`<th class="num">#</th><th class="l">สินค้าจริง</th><th class="num">ชิ้นจริง</th><th class="l">สัดส่วน</th><th class="num">ขายเดี่ยว</th><th class="num">อยู่ในชุด / โปร</th>${ordH}`,
    L.map(([k, x], i) => `<tr><td class="num ui-muted">${i + 1}</td><td class="l">${P.names[k] && P.names[k] !== k ? `<span class="pn ui-trunc">${esc(P.names[k])}</span><small class="ui-code">${esc(k)}</small>` : `<span class="pn ui-code">${esc(k)}</span><small>ยังไม่มีชื่อ</small>`}</td><td class="num"><b>${fmt(x.pcs)}</b></td><td class="l">${share(x.pcs, P.T.pcs)}</td><td class="num">${x.single ? fmt(x.single) : dash}</td><td class="num">${x.bundle ? fmt(x.bundle) : dash}</td><td class="num">${fmt(x.ord)}</td></tr>`).join(''),
    `<td></td><td class="l">รวม ${fmt(L.length)} รายการ</td><td class="num">${fmt(P.T.pcs)}</td><td class="l">100%</td><td class="num">${fmt(P.T.single)}</td><td class="num">${fmt(P.T.bundle)}</td><td></td>`);
}

// ===== Creator: ใครขายได้เท่าไร =====
async function pageCreators(el) {
  const rows = await DB.select('v_creator_daily', '*', inRange);
  const by = {}; rows.forEach(r => { const c = by[r.creator] = by[r.creator] || { rev: 0, ord: 0, items: 0, com: 0, types: new Set() }; c.rev += +r.revenue; c.ord += +r.orders; c.items += +r.items; c.com += +r.commission; if (r.content_type) c.types.add(r.content_type); });
  const list = Object.entries(by).sort((a, b) => b[1].rev - a[1].rev), T = list.reduce((a, [, c]) => ({ rev: a.rev + c.rev, ord: a.ord + c.ord, items: a.items + c.items, com: a.com + c.com }), { rev: 0, ord: 0, items: 0, com: 0 });
  if (!list.length) return el.innerHTML = '<div class="panel empty-note">ยังไม่มีออเดอร์ผ่าน Creator ในช่วงนี้</div>';
  const TYPE_ORDER = ['Live', 'คลิป', 'หน้าสินค้า'], types = c => [...c.types].sort((a, b) => (TYPE_ORDER.indexOf(a) + 1 || 9) - (TYPE_ORDER.indexOf(b) + 1 || 9)).join(' · ');
  const comInfo = 'ค่าคอมจากรายงานรับเงิน นับเฉพาะออเดอร์ที่ TikTok โอนเงินแล้ว<br>— = ยังไม่มีข้อมูล (ยังไม่ได้อัปรายงานรับเงิน หรือยังไม่ถึงรอบโอน)';
  el.innerHTML = `<section class="ui-metrics hero">${metric('Creator ที่มียอด', fmt(list.length), 'คน', 'จำนวน Creator ที่มีออเดอร์ในช่วงนี้ (ไม่นับบัญชีร้านเอง)')}${metric('ยอดขายผ่าน Creator', fmt(T.rev), '', 'ยอดสินค้าหลังส่วนลด <b>ไม่รวม</b>ค่าส่ง และ<b>ไม่รวม</b>ออเดอร์ที่ยกเลิก')}${metric('ค่าคอม Creator', T.com ? fmt(T.com) : '—', T.com && T.rev ? (T.com / T.rev * 100).toFixed(1) + '% ของยอด' : '', comInfo)}${metric('ออเดอร์', fmt(T.ord), '', 'ออเดอร์ที่มี Creator <b>ไม่รวม</b>ออเดอร์ที่ยกเลิก')}</section>
    <section class="panel"><div class="panel-h"><h2>Creator เรียงตามยอดขาย</h2></div><div class="wide"><table class="ui-table tbl" data-no-page data-limit="20"><thead><tr><th class="l">Creator</th><th class="l">ช่องทาง</th><th class="num">ยอดขาย</th><th class="num">สัดส่วน</th><th class="num">ออเดอร์</th><th class="num">ชิ้น</th><th class="num">ค่าคอม ${tip(comInfo)}</th></tr></thead><tbody>
    ${list.map(([n, c]) => `<tr><td class="l">${esc(n)}</td><td class="l">${esc(types(c))}</td><td class="num">${fmt(c.rev)}</td><td class="num">${(c.rev / T.rev * 100).toFixed(1)}%</td><td class="num">${fmt(c.ord)}</td><td class="num">${fmt(c.items)}</td><td class="num">${c.com ? fmt(c.com) : dash}</td></tr>`).join('')}
    </tbody><tfoot><tr><td class="l">รวม ${fmt(list.length)} คน</td><td></td><td class="num">${fmt(T.rev)}</td><td class="num">100%</td><td class="num">${fmt(T.ord)}</td><td class="num">${fmt(T.items)}</td><td class="num">${T.com ? fmt(T.com) : dash}</td></tr></tfoot></table></div></section>`;
}

// ===== สินค้าที่ส่งออก: รายวัน (ตารางแถว = สินค้า · คอลัมน์ = วัน) + รวมทั้งช่วง =====
async function pageProducts(el) {
  const rows = await DB.select('v_shipped_daily', '*', inRange), ds = days(RANGE.from, RANGE.to);
  if (!rows.length) return el.innerHTML = '<div class="panel empty-note">ยังไม่มีสินค้าที่ส่งในช่วงนี้</div>';
  const by = {}; rows.forEach(r => { const p = by[r.sku] = by[r.sku] || { name: r.product_name, q: {}, t: 0 }; p.q[r.d] = (p.q[r.d] || 0) + +r.qty; p.t += +r.qty; });
  const list = Object.entries(by).sort((a, b) => b[1].t - a[1].t), dayTot = d => list.reduce((a, [, p]) => a + (p.q[d] || 0), 0), tot = list.reduce((a, [, p]) => a + p.t, 0);
  el.innerHTML = `<section class="ui-metrics hero">${metric('ชิ้นที่ส่ง', fmt(tot), `${ds.length} วัน · เฉลี่ย ${fmt1(tot / ds.length)} / วัน`, 'นับตามวันที่ส่งของ (Shipped Time) <b>ไม่รวม</b>ออเดอร์ที่ยกเลิก')}${metric('สินค้าที่มีการส่ง', fmt(list.length), 'SKU', 'จำนวน SKU ที่มีการส่งออกในช่วงนี้')}${metric('ส่งมากสุด', fmt(list[0][1].t) + ' ชิ้น', `<span class="ui-trunc">${esc(list[0][1].name || list[0][0])}</span>`, 'สินค้าที่ส่งออกจำนวนชิ้นมากที่สุดในช่วงนี้')}</section>
    <section class="panel"><div class="panel-h"><h2>สินค้าที่ส่งออกรายวัน (ชิ้น)</h2></div><div class="wide"><table class="ui-table tbl" data-no-sort data-no-page data-limit="20"><thead><tr><th class="l stick">สินค้า</th><th class="num">รวม</th>${ds.map(d => `<th class="num">${dTh(d)}</th>`).join('')}</tr></thead><tbody>
    ${list.map(([sku, p]) => `<tr><td class="l stick">${esc(p.name || sku)}<small>${esc(sku)}</small></td><td class="num"><b>${fmt(p.t)}</b></td>${ds.map(d => `<td class="num">${p.q[d] ? fmt(p.q[d]) : '<span class="ui-muted">·</span>'}</td>`).join('')}</tr>`).join('')}
    </tbody><tfoot><tr><td class="l stick">รวม</td><td class="num">${fmt(tot)}</td>${ds.map(d => `<td class="num">${fmt(dayTot(d))}</td>`).join('')}</tr></tfoot></table></div></section>`;
}

// ===== สต็อกแบบเบา: คงเหลือ · ขายได้อีกกี่วัน · บันทึกรับเข้า / เพิ่มสินค้า =====
async function pageStock(el) {
  const rows = await DB.select('v_stock');
  el.innerHTML = `<section class="panel"><div class="panel-h"><h2>สต็อกคงเหลือ ${tip('คงเหลือ = ยอดตั้งต้น + รับเข้า − ส่งออก (นับตั้งแต่วันตั้งต้น)<br>ขายได้อีก = คงเหลือ ÷ ส่งออกเฉลี่ย 30 วัน · สีแดง = น้อยกว่าจำนวนวันขั้นต่ำของสินค้านั้น<br>คงเหลือติดลบ (สีแดง) = ส่งออกมากกว่าที่บันทึกไว้ ให้เช็คสต็อกตั้งต้น / รับเข้า')}</h2></div>
    <div class="wide"><table class="ui-table tbl" data-no-page><thead><tr><th class="l">สินค้า</th><th class="num">ตั้งต้น</th><th class="num">รับเข้า</th><th class="num">ส่งออก</th><th class="num">คงเหลือ</th><th class="num">ส่งเฉลี่ย / วัน</th><th class="num">ขายได้อีก</th></tr></thead><tbody>
    ${rows.map(r => `<tr><td class="l">${esc(r.name || r.sku)}<small>${esc(r.sku)}</small></td><td class="num">${fmt(r.opening_stock)}</td><td class="num">${fmt(r.stock_in)}</td><td class="num">${fmt(r.shipped)}</td><td class="num"><b${+r.on_hand < 0 ? ' style="color:var(--bad)"' : ''}>${fmt(r.on_hand)}</b></td><td class="num">${fmt1(r.avg_day)}</td>
      <td class="num">${r.days_left == null ? '<span class="ui-muted">—</span>' : `<span class="ui-chip ${+r.days_left < +r.min_days ? 'dn' : 'up'}">${fmt(r.days_left)} วัน</span>`}</td></tr>`).join('') || '<tr><td colspan="7" class="l ui-muted">ยังไม่มีสินค้า — เพิ่มด้านล่าง</td></tr>'}
    </tbody></table></div></section>
    <div class="grid2"><section class="panel"><div class="panel-h"><h2>บันทึกรับสินค้าเข้า</h2></div><div class="form-row"><input id="siSku" placeholder="SKU" style="width:140px"><input id="siQty" type="number" placeholder="จำนวน" style="width:100px"><input id="siDate" type="date" value="${ymd(new Date())}"><input id="siNote" placeholder="หมายเหตุ" style="flex:1"><button class="btn pri" id="siSave">บันทึก</button></div></section>
    <section class="panel"><div class="panel-h"><h2>เพิ่ม / แก้สินค้า</h2></div><div class="form-row"><input id="pSku" placeholder="SKU" style="width:120px"><input id="pName" placeholder="ชื่อสินค้า" style="flex:1"><input id="pOpen" type="number" placeholder="สต็อกตั้งต้น" style="width:110px"><input id="pDate" type="date" value="${ymd(new Date())}"><button class="btn pri" id="pSave">บันทึก</button></div></section></div>`;
  document.getElementById('siSave').onclick = async () => { await DB.insert('stock_in', { sku: siSku.value.trim(), qty: +siQty.value, moved_on: siDate.value, note: siNote.value || null }); route(); };
  document.getElementById('pSave').onclick = async () => { await DB.upsert('products', [{ sku: pSku.value.trim(), name: pName.value.trim(), opening_stock: +pOpen.value || 0, opening_date: pDate.value }], 'sku'); route(); };
}

// ===== เงินเข้า =====
async function pageMoney(el) {
  const rows = (await DB.select('v_settlement_daily', '*', inRange)).sort((a, b) => a.d < b.d ? 1 : -1);
  const S = k => rows.reduce((a, r) => a + (+r[k] || 0), 0);
  el.innerHTML = `<section class="ui-metrics hero">${metric('เงินเข้า', fmt(S('amount')), `${fmt(S('orders'))} ออเดอร์`, 'ยอดที่ TikTok โอนจริงตามไฟล์ Income / Settlement นับตามวันที่โอน')}${metric('ค่าธรรมเนียม', fmt(S('fees')), '', 'ค่าธรรมเนียมที่ TikTok หักตามไฟล์ (ติดลบ = หักออก)')}${metric('ค่าคอม Creator', fmt(S('affiliate_commission')), '', 'ค่าคอม Creator ที่ TikTok หักตามรายงานรับเงิน (ติดลบ = หักออก)')}</section>
    <section class="panel"><div class="panel-h"><h2>เงินเข้ารายวัน</h2></div><div class="wide"><table class="ui-table tbl" data-no-page><thead><tr><th class="l">วันที่โอน</th><th class="num">ออเดอร์</th><th class="num">ยอดขาย</th><th class="num">ค่าธรรมเนียม</th><th class="num">ค่าคอม Creator</th><th class="num">เงินเข้า</th></tr></thead><tbody>
    ${rows.map(r => `<tr><td class="l">${dTh(r.d)}</td><td class="num">${fmt(r.orders)}</td><td class="num">${fmt(r.revenue)}</td><td class="num">${fmt(r.fees)}</td><td class="num">${fmt(r.affiliate_commission)}</td><td class="num"><b>${fmt(r.amount)}</b></td></tr>`).join('') || '<tr><td colspan="6" class="l ui-muted">ยังไม่มีข้อมูลเงินเข้าในช่วงนี้</td></tr>'}
    </tbody>${rows.length ? `<tfoot><tr><td class="l">รวม</td><td class="num">${fmt(S('orders'))}</td><td class="num">${fmt(S('revenue'))}</td><td class="num">${fmt(S('fees'))}</td><td class="num">${fmt(S('affiliate_commission'))}</td><td class="num">${fmt(S('amount'))}</td></tr></tfoot>` : ''}</table></div></section>`;
}

// ===== ตัวสลับหน้า (#ชื่อหน้า) =====
async function route() {
  const id = (location.hash || '#overview').slice(1), pg = PAGES.find(p => p[0] === id) || PAGES[0];
  document.querySelectorAll('#nav a').forEach(a => a.classList.toggle('on', a.dataset.p === pg[0]));
  document.getElementById('pageTitle').textContent = pg[1];
  document.getElementById('range').style.visibility = ['stock', 'upload'].includes(pg[0]) ? 'hidden' : 'visible';
  const el = document.getElementById('content'); el.innerHTML = '<div class="panel empty-note">กำลังโหลด…</div>';
  try { await ({ overview: pageOverview, creators: pageCreators, products: pageProducts, stock: pageStock, money: pageMoney, upload: pageUpload })[pg[0]](el); limitRows(el); if (window.UI && UI.fit) UI.fit(); }
  catch (e) { el.innerHTML = `<div class="panel empty-note" style="color:var(--bad)">โหลดไม่สำเร็จ: ${esc(e.message)}</div>`; }
}
document.getElementById('appName').textContent = (window.APP && APP.NAME) || 'Sales'; document.title = document.getElementById('appName').textContent;
document.getElementById('nav').innerHTML = PAGES.map(([id, n]) => `<a href="#${id}" data-p="${id}">${n}</a>`).join('');
if (!(window.APP && APP.SHARED_LOGIN_EMAIL)) document.getElementById('btnOut').style.display = 'none';
initRange(); window.addEventListener('hashchange', route); DB.ready.then(route);
