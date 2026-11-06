// upload.js — อัปโหลดไฟล์จาก TikTok Seller Center → ฐานข้อมูล
// 3 แบบ: ไฟล์คำสั่งซื้อ (Export orders) · ไฟล์ Affiliate (Affiliate Center → Orders) · ไฟล์เงินเข้า (Finance → Income / Settlement)
// ⚠️ ชื่อคอลัมน์ด้านล่างเป็นค่าตั้งต้น ต้องเทียบกับไฟล์จริงของบริษัทก่อนใช้ (เพิ่มชื่อใน alias ได้ ไม่ต้องแก้ส่วนอื่น)
// ไม่เก็บข้อมูลส่วนตัวลูกค้า: คอลัมน์ชื่อผู้รับ / เบอร์ / ที่อยู่ / ชื่อผู้ซื้อ / ข้อความผู้ซื้อ ถูกตัดทิ้งก่อนส่งเข้าฐานข้อมูล
const PII = /recipient|phone|address|zip ?code|buyer username|buyer message|ผู้รับ|เบอร์|ที่อยู่|รหัสไปรษณีย์|ชื่อผู้ซื้อ|ข้อความ/i;
const KINDS = {
  orders: { name: 'ไฟล์คำสั่งซื้อ (Export orders)', table: 'orders_tt', key: 'order_id,sku_id,line_no', idCol: 'order_id',
    alias: { order_id: ['Order ID', 'หมายเลขคำสั่งซื้อ'], sku_id: ['SKU ID'], status: ['Order Status', 'สถานะคำสั่งซื้อ'], substatus: ['Order Substatus'], cancel_type: ['Cancelation/Return Type', 'Cancellation/Return Type'],
      seller_sku: ['Seller SKU'], product_name: ['Product Name', 'ชื่อสินค้า'], variation: ['Variation'], qty: ['Quantity', 'จำนวน'],
      unit_price: ['SKU Unit Original Price'], subtotal_before: ['SKU Subtotal Before Discount'], platform_discount: ['SKU Platform Discount'], seller_discount: ['SKU Seller Discount'],
      subtotal_after: ['SKU Subtotal After Discount'], shipping_fee: ['Shipping Fee After Discount'], order_amount: ['Order Amount'], refund_amount: ['Order Refund Amount'],
      created_at: ['Created Time'], paid_at: ['Paid Time'], shipped_at: ['Shipped Time'], delivered_at: ['Delivered Time'], cancelled_at: ['Cancelled Time'],
      fulfillment: ['Fulfillment Type'], warehouse: ['Warehouse Name'], province: ['Province'], payment_method: ['Payment Method'] },
    dates: ['created_at', 'paid_at', 'shipped_at', 'delivered_at', 'cancelled_at'], nums: ['qty', 'unit_price', 'subtotal_before', 'platform_discount', 'seller_discount', 'subtotal_after', 'shipping_fee', 'order_amount', 'refund_amount'] },
  affiliate: { name: 'ไฟล์ Affiliate (ออเดอร์ที่มาจาก Creator)', table: 'affiliate_tt', key: 'order_id,sku_id,creator', idCol: 'order_id',
    alias: { order_id: ['Order ID'], sku_id: ['SKU ID'], creator: ['Creator Username', 'Creator name', 'Creator'], content_type: ['Content Type'], content_id: ['Content ID'], status: ['Order Status'],
      gmv: ['Payment Amount', 'GMV'], commission_rate: ['Standard Commission Rate', 'Commission Rate'], commission: ['Estimated Commission', 'Est. standard commission', 'Actual Commission'] },
    dates: [], nums: ['gmv', 'commission_rate', 'commission'] },
  settlement: { name: 'ไฟล์เงินเข้า (Income / Settlement)', table: 'settlement_tt', key: 'ref_id', idCol: 'ref_id',
    alias: { ref_id: ['Order/adjustment ID', 'Order/Adjustment ID'], type: ['Type'], settled_at: ['Order settled time', 'Settlement time'], settlement_amount: ['Total settlement amount'],
      revenue: ['Total revenue'], fees: ['Total fees'], affiliate_commission: ['Affiliate commission'] },
    dates: ['settled_at'], nums: ['settlement_amount', 'revenue', 'fees', 'affiliate_commission'] },
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
async function parseFile(file, kind) {
  const K = KINDS[kind], wb = XLSX.read(await file.arrayBuffer(), { cellDates: false }), ws = wb.Sheets[wb.SheetNames[0]];
  const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' });
  const want = K.alias[K.idCol].map(x => x.toLowerCase());
  const hi = aoa.findIndex(r => r.some(c => want.includes(String(c).trim().toLowerCase())));
  if (hi < 0) throw new Error(`ไม่เจอหัวคอลัมน์ "${K.alias[K.idCol][0]}" — เลือกประเภทไฟล์ถูกไหม?`);
  const head = aoa[hi].map(h => String(h).trim()), col = {};
  Object.entries(K.alias).forEach(([f, names]) => { const i = head.findIndex(h => names.some(n => n.toLowerCase() === h.toLowerCase())); if (i >= 0) col[f] = i; });
  const missing = Object.keys(K.alias).filter(f => col[f] == null);
  const seen = {}, rows = [];
  for (const r of aoa.slice(hi + 1)) {
    const id = String(r[col[K.idCol]] ?? '').trim(); if (!/^[0-9A-Za-z_-]{6,}$/.test(id)) continue;   // ข้ามแถวคำอธิบายคอลัมน์ / แถวว่าง
    const o = {}; Object.entries(col).forEach(([f, i]) => { let v = r[i]; if (K.dates.includes(f)) v = toIso(v); else if (K.nums.includes(f)) v = num(v); else v = v === '' ? null : String(v).trim(); o[f] = v; });
    const raw = {}; head.forEach((h, i) => { if (h && !PII.test(h) && r[i] !== '') raw[h] = r[i]; }); o.raw = raw;
    if (kind === 'orders') { o.sku_id = o.sku_id || o.seller_sku || '-'; const k = o.order_id + '|' + o.sku_id; o.line_no = seen[k] = (seen[k] || 0) + 1; }
    if (kind === 'affiliate') { o.sku_id = o.sku_id || ''; o.creator = o.creator || ''; }
    if (kind === 'settlement') { o.order_id = id; if (o.type) o.ref_id = id + '|' + o.type; }
    rows.push(o);
  }
  return { rows, missing, head };
}
async function pageUpload(el) {
  const log = await DB.select('uploads', '*', q => q.order('uploaded_at', { ascending: false }).limit(20)).catch(() => []);
  el.innerHTML = `<section class="panel"><div class="panel-h"><h2>อัปโหลดไฟล์จาก TikTok Seller Center</h2></div>
    <div class="form-row"><select id="upKind">${Object.entries(KINDS).map(([k, x]) => `<option value="${k}">${x.name}</option>`).join('')}</select><input type="file" id="upFile" accept=".xlsx,.xls,.csv"><button class="btn pri" id="upGo">อัปโหลด</button></div>
    <div id="upMsg" style="margin-top:10px;font-size:13px;color:var(--text2)">อัปไฟล์ซ้ำได้ ออเดอร์เดิมจะถูกอัปเดตทับ (ไม่เกิดยอดซ้ำ) · ข้อมูลชื่อ / เบอร์ / ที่อยู่ลูกค้าถูกตัดทิ้งก่อนบันทึก</div></section>
    <section class="panel"><div class="panel-h"><h2>ประวัติการอัปโหลด</h2></div><table class="ui-table tbl" data-no-page><thead><tr><th class="l">เวลา</th><th class="l">ประเภท</th><th class="l">ไฟล์</th><th class="num">แถว</th><th class="l">ช่วงวันที่ในไฟล์</th></tr></thead><tbody>
    ${log.map(u => `<tr><td class="l">${new Date(u.uploaded_at).toLocaleString('th-TH')}</td><td class="l">${esc((KINDS[u.kind] || {}).name || u.kind)}</td><td class="l">${esc(u.file_name)}</td><td class="num">${fmt(u.rows)}</td><td class="l">${u.date_from ? dTh(u.date_from) + ' – ' + dTh(u.date_to) : '—'}</td></tr>`).join('') || '<tr><td colspan="5" class="l ui-muted">ยังไม่เคยอัปโหลด</td></tr>'}
    </tbody></table></section>`;
  document.getElementById('upGo').onclick = async () => {
    const f = document.getElementById('upFile').files[0], kind = document.getElementById('upKind').value, msg = document.getElementById('upMsg'), K = KINDS[kind];
    if (!f) return msg.textContent = 'เลือกไฟล์ก่อน';
    try {
      msg.textContent = 'กำลังอ่านไฟล์…'; const { rows, missing } = await parseFile(f, kind);
      if (!rows.length) throw new Error('ไม่เจอแถวข้อมูลในไฟล์');
      const dts = rows.map(r => (r.created_at || r.settled_at || '').slice(0, 10)).filter(Boolean).sort();
      const up = await DB.insert('uploads', { kind, file_name: f.name, rows: rows.length, date_from: dts[0] || null, date_to: dts[dts.length - 1] || null });
      rows.forEach(r => { r.upload_id = up.id; r.updated_at = new Date().toISOString(); });
      await DB.upsert(K.table, rows, K.key, (n, t) => { msg.textContent = `กำลังบันทึก ${fmt(n)} / ${fmt(t)} แถว…`; });
      msg.innerHTML = `✓ บันทึก ${fmt(rows.length)} แถว${missing.length ? ` · <span style="color:var(--warn)">ไม่เจอคอลัมน์: ${esc(missing.join(', '))} (เพิ่มชื่อคอลัมน์ใน upload.js)</span>` : ''}`;
      setTimeout(route, 1200);
    } catch (e) { msg.innerHTML = `<span style="color:var(--bad)">อัปโหลดไม่สำเร็จ: ${esc(e.message)}</span>`; }
  };
}
