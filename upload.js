// upload.js — อัปโหลดไฟล์จาก TikTok Seller Center → ฐานข้อมูล
// 2 แบบ: ไฟล์คำสั่งซื้อ (Orders → Export แบบทุกสถานะ) · รายงานรับเงิน (Finance → Income / Settlement)
// ข้อมูล Creator ใช้คอลัมน์ Order Channel + Creator Handle ในไฟล์คำสั่งซื้อ · ค่าคอม Creator ใช้รายงานรับเงิน (ไม่ต้องอัปไฟล์ Affiliate)
// ระบบดูหัวคอลัมน์เองว่าเป็นไฟล์แบบไหน · ถ้าขึ้น "ไม่เจอคอลัมน์ …" ให้เพิ่มชื่อคอลัมน์จริงใน alias (ไม่ต้องแก้ส่วนอื่น)
// ไม่เก็บข้อมูลส่วนตัวลูกค้า: คอลัมน์ชื่อผู้รับ / เบอร์ / ที่อยู่ / ชื่อผู้ซื้อ / ข้อความผู้ซื้อ / ข้อมูลใบกำกับภาษี (Tax Info) ถูกตัดทิ้งก่อนส่งเข้าฐานข้อมูล
const PII = /recipient|phone|address|zip ?code|buyer username|buyer message|tax info|customer.*bank|ผู้รับ|เบอร์|ที่อยู่|รหัสไปรษณีย์|ชื่อผู้ซื้อ|ข้อความ|ธนาคารของลูกค้า/i;
const KINDS = {
  orders: { name: 'คำสั่งซื้อ', table: 'orders_tt', key: 'order_id,sku_id,line_no', idCol: 'order_id',
    alias: { order_id: ['Order ID', 'หมายเลขคำสั่งซื้อ'], sku_id: ['SKU ID'], status: ['Order Status', 'สถานะคำสั่งซื้อ'], substatus: ['Order Substatus'], cancel_type: ['Cancelation/Return Type', 'Cancellation/Return Type'],
      seller_sku: ['Seller SKU'], product_name: ['Product Name', 'ชื่อสินค้า'], variation: ['Variation'], qty: ['Quantity', 'จำนวน'],
      unit_price: ['SKU Unit Original Price'], subtotal_before: ['SKU Subtotal Before Discount'], platform_discount: ['SKU Platform Discount'], seller_discount: ['SKU Seller Discount'],
      subtotal_after: ['SKU Subtotal After Discount'], shipping_fee: ['Shipping Fee After Discount'], order_amount: ['Order Amount'], refund_amount: ['Order Refund Amount'],
      created_at: ['Created Time'], paid_at: ['Paid Time'], shipped_at: ['Shipped Time'], delivered_at: ['Delivered Time'], cancelled_at: ['Cancelled Time'],
      fulfillment: ['Fulfillment Type'], warehouse: ['Warehouse Name'], province: ['Province'], payment_method: ['Payment Method'],
      order_channel: ['Order Channel', 'Content Type'], creator_handle: ['Creator Handle', 'Creator Username'] },
    dates: ['created_at', 'paid_at', 'shipped_at', 'delivered_at', 'cancelled_at'], nums: ['qty', 'unit_price', 'subtotal_before', 'platform_discount', 'seller_discount', 'subtotal_after', 'shipping_fee', 'order_amount', 'refund_amount'] },
  // รายงานรับเงิน: ไฟล์ของร้านเป็นหัวคอลัมน์ภาษาไทย (ชีต "รายละเอียดคำสั่งซื้อ") · 1 ออเดอร์มีได้หลายแถว (ได้เงิน แล้วต่อมาหักเงินคืน)
  settlement: { name: 'รายงานรับเงิน', table: 'settlement_tt', key: 'ref_id', idCol: 'ref_id',
    alias: { ref_id: ['Order/adjustment ID', 'Order/Adjustment ID', 'หมายเลขคำสั่งซื้อ/การปรับ'], type: ['Type', 'ประเภทธุรกรรม'],
      settled_at: ['Order settled time', 'Settlement time', 'เวลาที่ชำระคำสั่งซื้อ'], created_at: ['Order created time', 'เวลาที่สร้างคำสั่งซื้อ'],
      settlement_amount: ['Total settlement amount', 'ยอดการชำระเงินทั้งหมด'], revenue: ['Total revenue', 'รายได้ทั้งหมด'],
      subtotal: ['Subtotal after seller discounts', 'ยอดรวมค่าสินค้าหลังหักส่วนลดจากผู้ขาย'], refund: ['Refund subtotal after seller discounts', 'ยอดรวมเงินคืนหลังหักส่วนลดจากผู้ขาย'],
      fees: ['Total fees', 'ค่าธรรมเนียมทั้งหมด'], affiliate_commission: ['Affiliate commission', 'ค่าคอมมิชชั่นแอฟฟิลิเอต'] },
    // ค่าคอม Creator = ค่าคอมแอฟฟิลิเอต + ค่าคอมจากโฆษณาร้านค้าแอฟฟิลิเอต + ค่าคอมพาร์ทเนอร์ (คอลัมน์ไหนไม่มีก็ข้าม)
    addTo: { affiliate_commission: ['Affiliate Shop Ads commission', 'ค่าคอมมิชชั่นแอฟฟิลิเอตสำหรับโฆษณาร้านค้า', 'Affiliate partner commission', 'ค่าคอมมิชชั่นของพาร์ทเนอร์แอฟฟิลิเอต', 'ค่าคอมมิชชั่นโฆษณาร้านค้าพาร์ทเนอร์แอฟฟิลิเอต'] },
    related: ['Related order ID', 'หมายเลขคำสั่งซื้อที่เกี่ยวข้อง'],
    dates: ['settled_at', 'created_at'], nums: ['settlement_amount', 'revenue', 'subtotal', 'refund', 'fees', 'affiliate_commission'] },
};
const num = v => { if (v == null || v === '') return null; if (typeof v === 'number') return v; const n = parseFloat(String(v).replace(/[,\s฿]|THB/g, '')); return isNaN(n) ? null : n; };
// วันที่: dd/mm/yyyy hh:mm(:ss) · yyyy/mm/dd · yyyy-mm-dd · ตัวเลขวันที่ของ Excel → เวลาไทย (+07:00)
function toIso(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') { const d = new Date(Math.round((v - 25569) * 86400000)); return d.toISOString().slice(0, 19) + '+07:00'; }
  const s = String(v).trim(); let m;
  if ((m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/))) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}T${(m[4] || '0').padStart(2, '0')}:${m[5] || '00'}:${m[6] || '00'}+07:00`;
  if ((m = s.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})(?:[\sT]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/))) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}T${(m[4] || '0').padStart(2, '0')}:${m[5] || '00'}:${m[6] || '00'}+07:00`;
  return null;
}
// ดูทุกชีตในไฟล์ หาแถวหัวคอลัมน์ที่ตรงกับไฟล์แบบไหนมากที่สุด (นับจำนวนคอลัมน์ที่รู้จัก)
function detect(wb) {
  let best = null;
  for (const kind of Object.keys(KINDS)) for (const n of wb.SheetNames) {
    const K = KINDS[kind], aoa = XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: '' }), want = K.alias[K.idCol].map(x => x.toLowerCase());
    const hi = aoa.slice(0, 30).findIndex(r => r.some(c => want.includes(String(c).trim().toLowerCase()))); if (hi < 0) continue;
    const head = aoa[hi].map(h => String(h).trim().toLowerCase()), score = Object.values(K.alias).filter(names => names.some(x => head.includes(x.toLowerCase()))).length;
    if (!best || score > best.score) best = { kind, aoa, hi, score };
  }
  if (!best || best.score < 3) throw new Error('ไม่ใช่ไฟล์คำสั่งซื้อหรือรายงานรับเงิน (ไม่เจอคอลัมน์ Order ID / หมายเลขคำสั่งซื้อ/การปรับ)');
  return best;
}
async function parseFile(file) {
  let wb; try { wb = XLSX.read(await file.arrayBuffer(), { cellDates: false }); } catch (e) { throw new Error('เปิดไฟล์ไม่ได้ — ใช้ไฟล์ .xlsx หรือ .csv ที่ export จาก Seller Center'); }
  const { kind, aoa, hi } = detect(wb), K = KINDS[kind];
  const head = aoa[hi].map(h => String(h).trim()), col = {};
  Object.entries(K.alias).forEach(([f, names]) => { const i = head.findIndex(h => names.some(n => n.toLowerCase() === h.toLowerCase())); if (i >= 0) col[f] = i; });
  const missing = Object.keys(K.alias).filter(f => col[f] == null);
  const seen = {}, rows = [];
  for (const r of aoa.slice(hi + 1)) {
    const id = String(r[col[K.idCol]] ?? '').trim(); if (!/^[0-9A-Za-z_-]{6,}$/.test(id)) continue;   // ข้ามแถวคำอธิบายคอลัมน์ / แถวว่าง
    const o = {}; Object.entries(col).forEach(([f, i]) => { let v = r[i]; if (K.dates.includes(f)) v = toIso(v); else if (K.nums.includes(f)) v = num(v); else v = v === '' ? null : String(v).trim(); o[f] = v; });
    const raw = {}; head.forEach((h, i) => { if (h && !PII.test(h) && r[i] !== '' && !(kind === 'settlement' && +r[i] === 0)) raw[h] = r[i]; }); o.raw = raw;   // รายงานรับเงิน: ไม่เก็บช่องที่เป็น 0 (68 คอลัมน์ ส่วนใหญ่เป็น 0)
    Object.entries(K.addTo || {}).forEach(([f, names]) => head.forEach((h, i) => { if (names.some(n => n.toLowerCase() === h.toLowerCase())) o[f] = (o[f] || 0) + (num(r[i]) || 0); }));
    if (kind === 'orders') { o.sku_id = o.sku_id || o.seller_sku || '-'; const k = o.order_id + '|' + o.sku_id; o.line_no = seen[k] = (seen[k] || 0) + 1; }
    if (kind === 'settlement') {   // แถวของออเดอร์เดียวกัน (ได้เงิน / หักเงินคืน) แยกกันด้วยวันที่เงินเข้า + ยอด · รายการปรับยอดผูกกับออเดอร์ที่เกี่ยวข้อง
      const ri = head.findIndex(h => K.related.some(n => n.toLowerCase() === h.toLowerCase())), rel = ri >= 0 ? String(r[ri] ?? '').trim() : '';
      o.order_id = /^\d{6,}$/.test(rel) ? rel : id; o.ref_id = [id, o.type || '', (o.settled_at || '').slice(0, 10), o.settlement_amount ?? ''].join('|'); }
    rows.push(o);
  }
  return { kind, rows, missing, head };
}
const upTime = s => new Date(s).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
async function renderUploadLog() {
  const box = document.getElementById('upLog'); if (!box) return;
  const log = await DB.select('uploads', '*', q => q.order('uploaded_at', { ascending: false }).limit(20)).catch(() => []);
  box.innerHTML = log.map(u => `<tr><td class="l">${upTime(u.uploaded_at)}</td><td class="l">${esc((KINDS[u.kind] || {}).name || u.kind)}</td><td class="l">${esc(u.file_name)}</td><td class="num">${fmt(u.rows)}</td><td class="l">${u.date_from ? dTh(u.date_from) + ' – ' + dTh(u.date_to) : '—'}</td></tr>`).join('') || '<tr><td colspan="5" class="l ui-muted">ยังไม่เคยอัปโหลด</td></tr>';
}
async function uploadOne(f, item) {
  const set = (cls, badge, msg) => { item.className = 'up-item ' + cls; item.innerHTML = `${badge ? `<span class="ui-badge">${badge}</span>` : ''}<b>${esc(f.name)}</b><span class="msg">${msg}</span>`; };
  try {
    set('', '', 'กำลังอ่านไฟล์…'); const { kind, rows, missing } = await parseFile(f), K = KINDS[kind];
    if (!rows.length) throw new Error('ไม่เจอแถวข้อมูลในไฟล์');
    const dts = rows.map(r => ((kind === 'settlement' ? r.settled_at : r.created_at) || '').slice(0, 10)).filter(Boolean).sort();   // รายงานรับเงิน: ช่วงวันที่เงินเข้า
    const up = await DB.insert('uploads', { kind, file_name: f.name, rows: rows.length, date_from: dts[0] || null, date_to: dts[dts.length - 1] || null });
    rows.forEach(r => { r.upload_id = up.id; r.updated_at = new Date().toISOString(); });
    await DB.upsert(K.table, rows, K.key, (n, t) => set('', K.name, `กำลังบันทึก ${fmt(n)} / ${fmt(t)} แถว…`));
    const range = dts.length ? ` · ${dTh(dts[0])} – ${dTh(dts[dts.length - 1])}` : '';
    if (missing.length) set('warn', K.name, `บันทึก ${fmt(rows.length)} แถว${range} · ไม่เจอคอลัมน์: ${esc(missing.join(', '))}`);
    else set('ok', K.name, `✓ บันทึก ${fmt(rows.length)} แถว${range}`);
    return true;
  } catch (e) { set('err', '', 'อัปโหลดไม่สำเร็จ: ' + esc(e.message)); return false; }
}
async function pageUpload(el) {
  el.innerHTML = `<section class="panel"><div class="panel-h"><h2>อัปโหลดไฟล์จาก TikTok Seller Center ${tip('ใช้ 2 ไฟล์:<br><b>คำสั่งซื้อ</b> — Export แบบ "ทุกสถานะ" (ไม่ใช่เฉพาะเสร็จสมบูรณ์)<br><b>รายงานรับเงิน</b> — จากเมนูการเงิน (Income / Settlement)<br><br>อัปไฟล์ซ้ำได้ ออเดอร์เดิมจะถูกอัปเดตทับ ไม่เกิดยอดซ้ำ<br>ชื่อ / เบอร์ / ที่อยู่ / ข้อมูลใบกำกับภาษีของลูกค้าถูกตัดทิ้งก่อนบันทึก')}</h2></div>
    <label class="drop" id="upDrop"><input type="file" id="upFile" accept=".xlsx,.xls,.csv" multiple hidden>
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/></svg>
      <b>ลากไฟล์มาวาง หรือกดเพื่อเลือกไฟล์</b><span>ไฟล์คำสั่งซื้อ หรือ รายงานรับเงิน · ระบบดูให้เองว่าเป็นไฟล์แบบไหน · เลือกหลายไฟล์พร้อมกันได้</span></label>
    <div class="up-list" id="upList"></div></section>
    <section class="panel"><div class="panel-h"><h2>ประวัติการอัปโหลด</h2></div><div class="wide"><table class="ui-table tbl" data-no-page><thead><tr><th class="l">เวลา</th><th class="l">ประเภท</th><th class="l">ไฟล์</th><th class="num">แถว</th><th class="l">ช่วงวันที่ในไฟล์</th></tr></thead><tbody id="upLog"></tbody></table></div></section>`;
  await renderUploadLog();
  const drop = document.getElementById('upDrop'), input = document.getElementById('upFile'), list = document.getElementById('upList');
  const go = async files => {
    if (!files.length) return; list.innerHTML = '';
    const items = [...files].map(() => list.appendChild(Object.assign(document.createElement('div'), { className: 'up-item' })));
    for (let i = 0; i < files.length; i++) await uploadOne(files[i], items[i]);   // ทีละไฟล์ตามลำดับ
    input.value = ''; if (window.clearCache) clearCache(); renderUploadLog();
  };
  input.onchange = () => go(input.files);
  ['dragenter', 'dragover'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.add('is-over'); }));
  ['dragleave', 'drop'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.remove('is-over'); }));
  drop.addEventListener('drop', e => go(e.dataTransfer.files));
}
