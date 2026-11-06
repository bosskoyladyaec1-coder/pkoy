// app.js — หน้าวิเคราะห์ (อ่านจาก view ในฐานข้อมูล · หน้าเว็บแค่แสดง) · หน้า: ภาพรวม · Creator · สินค้าที่ส่ง · สต็อก · เงินเข้า · อัปโหลด
// กฎที่ยกมาจากระบบต้นแบบ: ยอดเงินเต็มจำนวน ไม่มี ฿ · ⓘ ทุกตัวเลขบอกรวม / ไม่รวม · แถวรวมล่างสุด = ตัวเลขในแถบบน · สีเขียว / แดงใช้เมื่อหมายถึงดี / ไม่ดีเท่านั้น
const PAGES = [['overview', 'ภาพรวม'], ['creators', 'Creator'], ['products', 'สินค้าที่ส่ง'], ['stock', 'สต็อก'], ['money', 'เงินเข้า'], ['upload', 'อัปโหลด']];
const fmt = v => Math.round(+v || 0).toLocaleString('en-US');
const fmt1 = v => (+v || 0).toLocaleString('en-US', { maximumFractionDigits: 1 });
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const tip = t => `<span class="pr-i" data-tip="${esc(t)}" style="font-size:11px;color:var(--text3);font-weight:400;cursor:default;">ⓘ</span>`;
const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const dTh = s => new Date(s + 'T00:00:00').toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
const days = (a, b) => { const out = []; for (let d = new Date(a + 'T00:00:00'); ymd(d) <= b; d.setDate(d.getDate() + 1)) out.push(ymd(d)); return out; };
const SRC_COLOR = { 'ร้าน · Live': '#E11D48', 'ร้าน · คลิป': '#0D9488', 'ร้าน · หน้าสินค้า': '#64748B', 'Creator · Live': '#FB7185', 'Creator · คลิป': '#2DD4BF', 'Creator · หน้าสินค้า': '#A78BFA' };
const srcColor = s => SRC_COLOR[s] || '#F59E0B';
let RANGE = { from: '', to: '' }, CHARTS = {}, PRESETS = {};

function toggleTheme() { const on = document.body.classList.toggle('light-theme'); localStorage.setItem('theme', on ? 'light' : 'dark'); route(); }
if (localStorage.getItem('theme') !== 'dark') document.body.classList.add('light-theme');

function markPreset() { document.querySelectorAll('#presets button').forEach(b => { const [a, c] = PRESETS[b.dataset.p](); b.setAttribute('aria-pressed', a === RANGE.from && c === RANGE.to); }); }
function setRange(a, b) { RANGE = { from: a, to: b }; document.getElementById('dFrom').value = a; document.getElementById('dTo').value = b; markPreset(); route(); }
function initRange() {
  const n = new Date(), p = PRESETS = {
    '7 วัน': () => [ymd(new Date(n.getFullYear(), n.getMonth(), n.getDate() - 6)), ymd(n)], '30 วัน': () => [ymd(new Date(n.getFullYear(), n.getMonth(), n.getDate() - 29)), ymd(n)],
    'เดือนนี้': () => [ymd(new Date(n.getFullYear(), n.getMonth(), 1)), ymd(n)], 'เดือนก่อน': () => [ymd(new Date(n.getFullYear(), n.getMonth() - 1, 1)), ymd(new Date(n.getFullYear(), n.getMonth(), 0))] };
  document.getElementById('presets').innerHTML = Object.keys(p).map(k => `<button type="button" data-p="${k}">${k}</button>`).join('');
  document.querySelectorAll('#presets button').forEach(b => b.onclick = () => setRange(...p[b.dataset.p]()));
  ['dFrom', 'dTo'].forEach(id => document.getElementById(id).onchange = () => setRange(document.getElementById('dFrom').value, document.getElementById('dTo').value));
  const [a, b] = p['เดือนนี้'](); RANGE = { from: a, to: b }; document.getElementById('dFrom').value = a; document.getElementById('dTo').value = b; markPreset();
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
  const rows = await DB.select('v_sales_daily', '*', inRange);
  if (!rows.length) return el.innerHTML = '<div class="panel empty-note">ยังไม่มียอดขายในช่วงนี้ — อัปโหลดไฟล์คำสั่งซื้อที่หน้า "อัปโหลด"</div>';
  const T = rows.reduce((a, r) => ({ rev: a.rev + +r.revenue, ord: a.ord + +r.orders, items: a.items + +r.items }), { rev: 0, ord: 0, items: 0 });
  const bySrc = {}; rows.forEach(r => { const s = bySrc[r.source] = bySrc[r.source] || { rev: 0, ord: 0, items: 0 }; s.rev += +r.revenue; s.ord += +r.orders; s.items += +r.items; });
  const aff = Object.entries(bySrc).filter(([k]) => k.startsWith('Creator')).reduce((a, [, v]) => a + v.rev, 0);
  const srcs = Object.keys(bySrc).sort((a, b) => bySrc[b].rev - bySrc[a].rev), ds = days(RANGE.from, RANGE.to);
  el.innerHTML = `<section class="ui-metrics hero">
      ${metric('ยอดขาย', fmt(T.rev), `${ds.length} วัน · เฉลี่ย ${fmt(T.rev / ds.length)} / วัน`, 'ยอดสินค้าหลังส่วนลด <b>ไม่รวม</b>ค่าส่ง และ<b>ไม่รวม</b>ออเดอร์ที่ยกเลิก · นับตามวันที่สั่งซื้อ (เวลาไทย)')}
      ${metric('ออเดอร์', fmt(T.ord), '', '<b>ไม่รวม</b>ออเดอร์ที่ยกเลิก')}
      ${metric('AOV', fmt(T.ord ? T.rev / T.ord : 0), 'ยอดขาย ÷ ออเดอร์', 'ยอดขายเฉลี่ยต่อออเดอร์')}
      ${metric('ชิ้นที่ขาย', fmt(T.items), '', 'จำนวนชิ้นในออเดอร์ที่ไม่ถูกยกเลิก')}
      ${metric('ยอดผ่าน Creator', T.rev ? (aff / T.rev * 100).toFixed(1) + '%' : '—', 'ยอด ' + fmt(aff), 'ยอดของออเดอร์ที่มี Creator Handle (ไม่นับบัญชีร้านเอง) ÷ ยอดขายทั้งหมด')}
    </section>
    <div class="grid2"><section class="panel"><div class="panel-h"><h2>ยอดขายรายวัน แยกแหล่งที่มา</h2></div><div style="height:280px;"><canvas id="cSales"></canvas></div></section>
    <section class="panel"><div class="panel-h"><h2>แหล่งที่มา ${tip('ช่องทางจากคอลัมน์ Order Channel ในไฟล์คำสั่งซื้อ (Live / คลิป / หน้าสินค้า)<br>ร้าน = ไม่มี Creator หรือเป็นบัญชีร้านเอง · Creator = มี Creator Handle')}</h2></div>
      <div class="wide"><table class="ui-table tbl" data-no-sort data-no-page><thead><tr><th class="l">แหล่ง</th><th class="num">ยอดขาย</th><th class="l">สัดส่วน</th><th class="num">ออเดอร์</th></tr></thead><tbody>
      ${srcs.map(s => { const x = bySrc[s], sh = x.rev / T.rev * 100; return `<tr><td class="l"><span style="display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:8px;background:${srcColor(s)}"></span>${esc(s)}</td><td class="num">${fmt(x.rev)}</td><td class="l"><span class="bar"><b style="width:${sh.toFixed(1)}%;background:${srcColor(s)}"></b></span>${Math.round(sh)}%</td><td class="num">${fmt(x.ord)}</td></tr>`; }).join('')}
      </tbody><tfoot><tr><td class="l">รวม</td><td class="num">${fmt(T.rev)}</td><td class="l">100%</td><td class="num">${fmt(T.ord)}</td></tr></tfoot></table></div></section></div>`;
  chart('cSales', { type: 'bar', data: { labels: ds.map(dTh), datasets: srcs.map(s => ({ label: s, data: ds.map(d => rows.filter(r => r.d === d && r.source === s).reduce((a, r) => a + +r.revenue, 0)), backgroundColor: srcColor(s), borderRadius: 3, stack: 's' })) },
    options: { maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: css('--text2'), boxWidth: 10 } } }, scales: { x: { stacked: true, ticks: { color: css('--text3'), maxRotation: 0, autoSkip: true, maxTicksLimit: 12 }, grid: { display: false } }, y: { stacked: true, ticks: { color: css('--text3') }, grid: { color: css('--grid') || 'rgba(0,0,0,.06)' } } } } });
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
