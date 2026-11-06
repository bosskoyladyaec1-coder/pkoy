/* ui.js — ตัวช่วยหน้าตากลางของ ระบบวิเคราะห์ยอดขาย (ใช้คู่กับ ui.css ทุกหน้า)
   โหลดท้าย body:  script src="ui.js?v=20261007a" defer
   1) ตัวเลขในการ์ดย่อให้พอดีกล่องเองทุกขนาดจอ (ไม่ตัดเป็น 1.4M — แสดงเต็มเสมอ)
   3) Tooltip กราฟ (Chart.js) ทุกกราฟหน้าตาเดียวกัน + เส้นชี้วันแนวตั้ง — ใช้ title/label/footer callbacks เดิมของแต่ละกราฟได้เลย
      ใส่ plugins.tooltip.uiShare = true ถ้าอยากให้โชว์ % สัดส่วนต่อรวมในแต่ละแถว
   5) กล่องยืนยัน / แจ้งเตือน ของเว็บเอง: uiConfirm / uiAlert / uiPrompt (ท้ายไฟล์)
   4) Tooltip ตอนชี้เมาส์: ใส่ data-tip="ข้อความ" (หรือ title เดิม) ที่ปุ่ม/ไอคอน · ข้อความที่ถูกตัด "…" ใส่ class ui-trunc จะโชว์ชื่อเต็มเอง
   2) ช่องวันที่ / ช่องเดือน ทุกช่องแสดงแบบไทยเหมือนกันทุกเครื่อง: "7 ต.ค. 2569" / "ต.ค. 2569"
      ค่าจริงใน input ยังเป็น YYYY-MM-DD / YYYY-MM เหมือนเดิม โค้ดเดิมที่อ่าน .value หรือฟัง change ใช้ได้ทันที
      ช่องไหนอยากคงแบบเดิมให้ใส่ data-native */
(function () {
  'use strict';
  const MS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  const ML = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
  const WD = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
  const pad = n => String(n).padStart(2, '0');
  // กล่องลอย (ปฏิทิน / tooltip) วางที่ <html> ไม่ใช่ <body> เพราะ dashboard ย่อ body ด้วย zoom บนจอเล็ก → วางใน body แล้วตำแหน่งเพี้ยน
  const portal = el => { el.classList.toggle('ui-light', document.body.classList.contains('light-theme')); if (el.parentNode !== document.documentElement) document.documentElement.appendChild(el); return el; };
  const iso = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const parse = s => { const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(s || ''); return m ? new Date(+m[1], +m[2] - 1, m[3] ? +m[3] : 1) : null; };
  const showDate = s => { const d = parse(s); return d ? d.getDate() + ' ' + MS[d.getMonth()] + ' ' + (d.getFullYear() + 543) : ''; };
  const showMonth = s => { const d = parse(s); return d ? MS[d.getMonth()] + ' ' + (d.getFullYear() + 543) : ''; };

  /* ───────── 1) ตัวเลขพอดีกล่อง ───────── */
  const FIT_SEL = '.ui-metric-v, .kpi-value, [data-fit]';
  const MIN_PX = 14;
  function groupOf(el) {
    return el.closest('[data-fit-group], .ui-metrics') || (el.closest('.card') || el).parentElement || document.body;
  }
  function fitAll() {
    const els = [...document.querySelectorAll(FIT_SEL)].filter(el => el.offsetParent !== null);
    const groups = new Map();
    els.forEach(el => { el.style.fontSize = ''; el.style.whiteSpace = ''; const g = groupOf(el); (groups.get(g) || groups.set(g, []).get(g)).push(el); });
    groups.forEach(list => {
      let size = Infinity;
      list.forEach(el => {
        el.style.whiteSpace = 'nowrap';
        let s = parseFloat(getComputedStyle(el).fontSize);
        const w = el.clientWidth;
        if (!w) return;
        if (el.scrollWidth > w + 1) s = Math.max(MIN_PX, Math.floor(s * w / el.scrollWidth));
        size = Math.min(size, s);
      });
      if (!isFinite(size)) return;
      list.forEach(el => {
        const base = parseFloat(getComputedStyle(el).fontSize);
        if (size < base) el.style.fontSize = size + 'px';
        if (el.scrollWidth > el.clientWidth + 1) el.style.whiteSpace = 'normal';   // ยาวมากจริงๆ ถึงขนาดเล็กสุดแล้ว → ให้ขึ้นบรรทัดใหม่แทนการล้น
      });
    });
  }
  let fitQueued = false;
  function queueFit() { if (fitQueued) return; fitQueued = true; requestAnimationFrame(() => { fitQueued = false; fitAll(); }); }


  /* ───────── 3) Tooltip กราฟ ───────── */
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function chartTip(context) {
    const { chart, tooltip } = context;
    const host = chart.canvas.parentNode;
    let el = host.querySelector(':scope > .ui-ctip');
    if (!el) { el = document.createElement('div'); el.className = 'ui-ctip'; host.appendChild(el); }
    if (tooltip.opacity === 0 || !tooltip.dataPoints || !tooltip.dataPoints.length) { el.style.opacity = 0; return; }
    const pts = tooltip.dataPoints, opt = chart.options.plugins.tooltip || {};
    const share = !!opt.uiShare, total = pts.reduce((s, p) => s + (+p.parsed.y || 0), 0);
    const rows = (tooltip.body || []).map((b, i) => {
      const p = pts[i] || {}, ds = p.dataset || {}, lab = ds.label || '';
      let line = (b.lines || []).join(' '), name = line, val = '';
      if (lab && line.startsWith(lab + ': ')) { name = lab; val = line.slice(lab.length + 2); }
      else { const k = line.lastIndexOf(': '); if (k > 0) { name = line.slice(0, k); val = line.slice(k + 2); } }
      const lc = (tooltip.labelColors || [])[i] || {};
      const col = typeof ds.borderColor === 'string' ? ds.borderColor : (lc.borderColor || lc.backgroundColor || 'var(--accent)');
      const pct = share && total ? ((+p.parsed.y || 0) / total * 100).toFixed(1) + '%' : '';
      return `<div class="ui-ctip-r"><i${/tiktok/i.test(name) ? ' class="ui-tt"' : ''} style="--c:${esc(col)}"></i><span>${esc(name)}</span><b>${esc(val)}</b>${share ? `<em>${pct}</em>` : ''}</div>`;
    }).join('');
    const foot = (tooltip.footer || []).filter(Boolean).map(f => {
      const k = f.lastIndexOf(': ');
      return k > 0 ? `<div class="ui-ctip-f"><span>${esc(f.slice(0, k))}</span><b>${esc(f.slice(k + 2))}</b></div>` : `<div class="ui-ctip-f"><span>${esc(f)}</span></div>`;
    }).join('');
    el.innerHTML = `<div class="ui-ctip-h">${esc((tooltip.title || []).join(' '))}</div>${rows}${foot}`;
    const w = el.offsetWidth, h = el.offsetHeight, x = tooltip.caretX, ox = chart.canvas.offsetLeft, oy = chart.canvas.offsetTop;
    let left = x + 16; if (left + w > chart.width) left = x - w - 16;
    const top = Math.max(0, Math.min(tooltip.caretY - h / 2, chart.height - h));
    el.style.left = (ox + Math.max(0, left)) + 'px'; el.style.top = (oy + top) + 'px'; el.style.opacity = 1;
  }
  const crosshair = {
    id: 'uiCrosshair',
    afterDatasetsDraw(chart) {
      if (chart.config.type !== 'line') return;
      const act = chart.tooltip && chart.tooltip.getActiveElements ? chart.tooltip.getActiveElements() : [];
      if (!act.length) return;
      const x = act[0].element.x, { top, bottom } = chart.chartArea, ctx = chart.ctx;
      ctx.save(); ctx.strokeStyle = getComputedStyle(document.body).getPropertyValue('--text3').trim() || '#888';
      ctx.globalAlpha = .55; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, bottom); ctx.stroke(); ctx.restore();
    }
  };
  function setupCharts() {
    if (!window.Chart || window.Chart.__ui) return;
    window.Chart.__ui = true;
    window.Chart.register(crosshair);
    const t = window.Chart.defaults.plugins.tooltip;
    t.enabled = false; t.external = chartTip;
  }
  setupCharts();

  /* ───────── 4) Tooltip ตอนชี้เมาส์ ───────── */
  let tipEl = null, tipFor = null;
  function hideTip() { if (tipEl) tipEl.classList.remove('is-on'); tipFor = null; }
  function placeTip(t) {
    const r = t.getBoundingClientRect(), w = tipEl.offsetWidth, h = tipEl.offsetHeight;
    let top = r.top - h - 8; if (top < 8) top = r.bottom + 8;
    if (top + h > innerHeight - 8) top = Math.max(8, innerHeight - h - 8);
    tipEl.style.top = top + 'px';
    tipEl.style.left = Math.max(8, Math.min(r.left + r.width / 2 - w / 2, innerWidth - w - 8)) + 'px';
  }
  function showTip(t, text, img, html) {
    if (!tipEl) { tipEl = document.createElement('div'); tipEl.className = 'ui-tip'; tipEl.setAttribute('role', 'tooltip'); }
    portal(tipEl); tipFor = t;
    // (2026-10-14) data-tip-img = ภาพตอนชี้เมาส์ (เช่น ภาพแอด / ปกคลิป) · ข้อความใน data-tip แสดงใต้ภาพ
    if (img) {
      tipEl.textContent = ''; tipEl.classList.add('has-img');
      const im = document.createElement('img'); im.className = 'ui-tip-img'; im.alt = ''; im.referrerPolicy = 'no-referrer';
      im.onload = () => { if (tipFor === t) placeTip(t); };
      im.onerror = () => { im.replaceWith(Object.assign(document.createElement('div'), { className: 'ui-tip-noimg', textContent: 'โหลดภาพไม่ได้ (ลิงก์ภาพอาจหมดอายุ)' })); if (tipFor === t) placeTip(t); };
      im.src = img; tipEl.appendChild(im);
      if (text) { const c = document.createElement('div'); c.textContent = text; tipEl.appendChild(c); }
    } else if (html) { tipEl.classList.remove('has-img'); tipEl.classList.add('is-html'); tipEl.innerHTML = text; }   // ⓘ แบบเดิม (เนื้อหาจากโค้ดเว็บเอง)
    else { tipEl.classList.remove('has-img', 'is-html'); tipEl.textContent = text; }
    if (!html) tipEl.classList.remove('is-html');
    placeTip(t);
    tipEl.classList.add('is-on');
  }
  // (2026-10-20) ⓘ แบบเดิมที่ต้อง "คลิก" (.ads-info-wrap + กล่อง .ads-info-popover) → ชี้เมาส์แล้วขึ้นกล่องเดียวกับ data-tip ทั้งเว็บ
  //   เฉพาะกล่องที่ปุ่มเป็นไอคอน ⓘ (กล่องที่เป็นปุ่มเลือก เช่น "เลือกสินค้า" ยังคลิกเหมือนเดิม)
  function infoWrap(el) {
    const w = el && el.closest && el.closest('.ads-info-wrap'); if (!w) return null;
    const icon = [...w.children].find(c => c.tagName === 'SPAN' && c.textContent.trim() === 'ⓘ'); if (!icon) return null;
    const p = w.querySelector('.ads-info-popover, [id^="tip-"]'); if (!p || p.contains(el)) return null;
    const html = p.innerHTML.trim(); return html ? [w, html, null, true] : null;
  }
  function tipTarget(e) {
    const iw = infoWrap(e.target); if (iw) return iw;
    const t = e.target.closest && e.target.closest('[data-tip], [data-tip-img], [title], .ui-trunc');
    if (!t) return null;
    // (2026-10-14) title ของเบราว์เซอร์ (กล่องดำ) → ย้ายไปใช้กล่อง tooltip กลางหน้าตาเดียวกันทั้งเว็บ
    //   โค้ดหน้าไหนตั้ง title ใหม่ทีหลัง (หรือล้างเป็นค่าว่าง) ก็ตามทันในการชี้ครั้งถัดไป · ช่องกรอกข้อมูลคง title เดิมของเบราว์เซอร์
    if (t.hasAttribute('title') && !(t instanceof SVGElement) && !/^(SELECT|INPUT|TEXTAREA|OPTION)$/.test(t.tagName)) {
      const v = t.getAttribute('title'); t.removeAttribute('title');
      if (v && v.trim()) { t.setAttribute('data-tip', v); t.dataset.tipT = '1'; }
      else if (t.dataset.tipT) { t.removeAttribute('data-tip'); delete t.dataset.tipT; return null; }
      if (!t.hasAttribute('data-tip')) return null;
    }
    if (t.hasAttribute('data-tip-img')) return [t, t.getAttribute('data-tip') || '', t.getAttribute('data-tip-img')];
    if (t.hasAttribute('data-tip')) return [t, t.getAttribute('data-tip')];
    return t.scrollWidth > t.clientWidth + 1 ? [t, t.textContent.trim()] : null;
  }
  document.addEventListener('mouseover', e => { const r = tipTarget(e); if (!r) { if (tipFor && !tipFor.contains(e.target)) hideTip(); return; } if (r[0] !== tipFor) showTip(r[0], r[1], r[2], r[3]); });
  // คลิก ⓘ แบบเดิม: ไม่เปิดกล่องลอยแบบเก่าแล้ว (กันค้าง / หน้าตาไม่เหมือนกัน) · แตะบนมือถือ = โชว์ tooltip เดียวกัน
  document.addEventListener('click', e => { const r = infoWrap(e.target); if (!r) return; e.stopPropagation(); e.preventDefault(); if (tipFor === r[0]) hideTip(); else showTip(r[0], r[1], r[2], r[3]); }, true);
  document.addEventListener('focusin', e => { const r = tipTarget(e); if (r) showTip(r[0], r[1], r[2], r[3]); });
  document.addEventListener('focusout', hideTip);
  addEventListener('scroll', hideTip, true);

  /* ───────── 2) ช่องวันที่ / เดือน ───────── */
  let pop = null, popFor = null, view = null;
  function closePop() { if (pop) { pop.remove(); pop = null; popFor = null; } }

  function setValue(input, v) {
    input.value = v;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }
  function inRange(input, s) {
    const min = input.getAttribute('min'), max = input.getAttribute('max');
    return !(min && s < min) && !(max && s > max);
  }
  function place(btn) {
    const r = btn.getBoundingClientRect(), w = pop.offsetWidth, h = pop.offsetHeight;
    let top = r.bottom + 6; if (top + h > innerHeight - 8 && r.top - h - 6 > 8) top = r.top - h - 6;
    pop.style.top = top + 'px';
    pop.style.left = Math.max(8, Math.min(r.left, innerWidth - w - 8)) + 'px';
  }
  function drawDay(input, btn) {
    const sel = input.value, today = iso(new Date());
    const first = new Date(view.getFullYear(), view.getMonth(), 1), start = new Date(first); start.setDate(1 - first.getDay());
    let cells = '';
    for (let i = 0; i < 42; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i);
      const s = iso(d), out = d.getMonth() !== view.getMonth(), ok = inRange(input, s);
      cells += `<button type="button" class="ui-cal-d${out ? ' is-out' : ''}${s === today ? ' is-today' : ''}" data-v="${s}"${s === sel ? ' aria-selected="true"' : ''}${ok ? '' : ' disabled'}>${d.getDate()}</button>`;
    }
    pop.innerHTML = `<div class="ui-cal-h"><button type="button" class="ui-cal-nav" data-nav="-1" aria-label="เดือนก่อน">‹</button>
      <b>${ML[view.getMonth()]} ${view.getFullYear() + 543}</b><button type="button" class="ui-cal-nav" data-nav="1" aria-label="เดือนถัดไป">›</button></div>
      <div class="ui-cal-w">${WD.map(w => `<span>${w}</span>`).join('')}</div><div class="ui-cal-g">${cells}</div>
      <div class="ui-cal-f"><button type="button" class="ui-cal-link" data-v="${today}"${inRange(input, today) ? '' : ' disabled'}>วันนี้</button></div>`;
    place(btn);
  }
  function drawMonth(input, btn) {
    const sel = input.value, y = view.getFullYear(), now = new Date(), cur = now.getFullYear() + '-' + pad(now.getMonth() + 1);
    let cells = '';
    for (let m = 0; m < 12; m++) {
      const s = y + '-' + pad(m + 1), ok = inRange(input, s);
      cells += `<button type="button" class="ui-cal-m${s === cur ? ' is-today' : ''}" data-v="${s}"${s === sel ? ' aria-selected="true"' : ''}${ok ? '' : ' disabled'}>${MS[m]}</button>`;
    }
    pop.innerHTML = `<div class="ui-cal-h"><button type="button" class="ui-cal-nav" data-nav="-12" aria-label="ปีก่อน">‹</button>
      <b>${y + 543}</b><button type="button" class="ui-cal-nav" data-nav="12" aria-label="ปีถัดไป">›</button></div><div class="ui-cal-mg">${cells}</div>`;
    place(btn);
  }
  function open(input, btn) {
    if (popFor === input) { closePop(); return; }
    closePop();
    const isMonth = input._uiKind === 'month';
    view = parse(input.value) || parse(input.getAttribute('max')) || new Date();
    view = new Date(view.getFullYear(), view.getMonth(), 1);
    pop = document.createElement('div'); pop.className = 'ui-cal'; pop.setAttribute('role', 'dialog');
    portal(pop); popFor = input;
    const draw = () => (isMonth ? drawMonth : drawDay)(input, btn);
    pop.addEventListener('click', e => {
      e.stopPropagation();   // คลิกในปฏิทินไม่ให้เมนูอื่นของหน้า (เช่น เมนูช่วงวันที่) ปิดตัวเอง
      const nav = e.target.closest('[data-nav]');
      if (nav) { view.setMonth(view.getMonth() + +nav.dataset.nav); draw(); return; }
      const pick = e.target.closest('[data-v]');
      if (pick && !pick.disabled) { setValue(input, pick.dataset.v); closePop(); btn.focus(); }
    });
    draw();
    const s = pop.querySelector('[aria-selected="true"]') || pop.querySelector('.is-today:not([disabled])'); if (s) s.focus();
  }

  function enhance(input) {
    if (input._uiBtn || input.hasAttribute('data-native')) return;
    const kind = input.getAttribute('type');
    input._uiKind = kind;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ui-datebtn';
    btn.setAttribute('aria-label', input.getAttribute('aria-label') || input.title || (kind === 'month' ? 'เลือกเดือน' : 'เลือกวันที่'));
    btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg><span></span>';
    const label = btn.querySelector('span');
    const sync = () => {
      const v = input.value;
      label.textContent = (kind === 'month' ? showMonth(v) : showDate(v)) || (kind === 'month' ? 'เลือกเดือน' : 'เลือกวันที่');
      btn.classList.toggle('is-empty', !v);
      btn.disabled = input.disabled;
    };
    // โค้ดเดิมที่สั่ง input.value = '...' → ปุ่มเปลี่ยนตามทันที
    const proto = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
    Object.defineProperty(input, 'value', { configurable: true, get() { return proto.get.call(this); }, set(v) { proto.set.call(this, v); sync(); } });
    new MutationObserver(sync).observe(input, { attributes: true, attributeFilter: ['disabled', 'value'] });
    input.addEventListener('change', sync);
    input.classList.add('ui-native-hidden');
    input.setAttribute('tabindex', '-1');
    input.after(btn);
    input._uiBtn = btn;
    btn.addEventListener('click', () => open(input, btn));
    sync();
  }
  function enhanceAll(root) {
    (root || document).querySelectorAll('input[type="date"], input[type="month"]').forEach(enhance);
  }

  document.addEventListener('click', e => { if (pop && !pop.contains(e.target) && !(popFor && popFor._uiBtn && popFor._uiBtn.contains(e.target))) closePop(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && pop) { const b = popFor && popFor._uiBtn; closePop(); if (b) b.focus(); } });
  addEventListener('resize', () => { closePop(); queueFit(); });
  addEventListener('scroll', e => { if (pop && !pop.contains(e.target)) closePop(); }, true);

  function start() {
    setupCharts();
    enhanceAll();
    fitAll();
    new MutationObserver(muts => {
      for (const m of muts) for (const n of m.addedNodes) if (n.nodeType === 1) {
        if (n.matches && n.matches('input[type="date"], input[type="month"]')) enhance(n); else if (n.querySelector) enhanceAll(n);
      }
      queueFit();
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
    if (document.fonts) document.fonts.ready.then(queueFit);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();

  window.UI = { fit: queueFit, enhanceDates: enhanceAll, showDate, showMonth, setupCharts };
})();

/* (2026-10-20) กล่องยืนยัน / แจ้งเตือน / ถามข้อความ ของเว็บเอง แทน confirm / alert / prompt ของเบราว์เซอร์
   (กล่องของเบราว์เซอร์มีชื่อเว็บ "… บอกว่า" และแต่งสีไม่ได้)
   uiConfirm(หัวข้อ, { text, ok, cancel, tone: 'good' | 'bad' | 'pri', icon }) → Promise<true/false>
   uiAlert(หัวข้อ, { text, tone, icon })                                       → Promise (ปิดแล้ว)
   uiPrompt(หัวข้อ, { text, value, placeholder, ok, type })                     → Promise<ข้อความ | null>
   Enter = ยืนยัน · Esc / คลิกนอกกล่อง = ยกเลิก */
(function () {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function open(o) {
    return new Promise(res => {
      if (!o.text && /\n/.test(o.title || '')) { const t = String(o.title), i = t.indexOf('\n'); o = { ...o, title: t.slice(0, i).trim(), text: t.slice(i + 1).trim() }; }
      const tone = o.tone || 'pri', single = !!o.single, inp = !!o.input;
      const icon = o.icon || (tone === 'good' ? '✓' : tone === 'bad' ? '!' : 'i');
      const prev = document.activeElement;
      const bg = document.createElement('div'); bg.className = 'ui-dlg-bg';
      bg.innerHTML = `<div class="ui-dlg" role="dialog" aria-modal="true"><div class="hd"><span class="ic ${tone}">${esc(icon)}</span><div class="tx"><div class="t">${esc(o.title || '')}</div>${o.text ? `<div class="b">${esc(o.text)}</div>` : ''}</div></div>`
        + (inp ? `<input class="in" type="${o.type === 'password' ? 'password' : 'text'}" value="${esc(o.value || '')}" placeholder="${esc(o.placeholder || '')}">` : '')
        + `<div class="ft">${single ? '' : `<button type="button" class="btn ghost" data-v="0">${esc(o.cancel || 'ยกเลิก')}</button>`}<button type="button" class="btn ${tone}" data-v="1">${esc(o.ok || 'ตกลง')}</button></div></div>`;
      const field = bg.querySelector('.in');
      const done = v => { document.removeEventListener('keydown', onKey, true); bg.remove(); try { prev && prev.focus && prev.focus(); } catch (e) {} res(v); };
      const yes = () => done(inp ? field.value : single ? undefined : true), no = () => done(inp ? null : single ? undefined : false);
      const onKey = e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); no(); } else if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.stopPropagation(); yes(); } };
      bg.addEventListener('mousedown', e => { if (e.target === bg) no(); });
      bg.querySelectorAll('[data-v]').forEach(b => b.addEventListener('click', () => b.dataset.v === '1' ? yes() : no()));
      document.addEventListener('keydown', onKey, true);
      document.body.appendChild(bg);
      setTimeout(() => { if (field) { field.focus(); field.select(); } else bg.querySelector('[data-v="1"]').focus(); }, 0);
    });
  }
  window.uiConfirm = (title, o = {}) => open({ ...o, title });
  window.uiAlert = (title, o = {}) => open({ ...o, title, single: true });
  window.uiPrompt = (title, o = {}) => open({ ...o, title, input: true });
})();

/* (2026-10-26) กันหน้าเด้งตอนโหลดข้อมูลใหม่ — ใช้ทุกหน้า (dashboard / upload / admin / health)
   ต้นเหตุ: หลายหน้าเปลี่ยนกล่องเป็นข้อความ "กำลังโหลด…" ระหว่างรอข้อมูล กล่องจึงยุบเหลือบรรทัดเดียว แล้วยืดกลับตอนข้อมูลมา → ทั้งหน้าเด้ง
   วิธีแก้กลาง: ตอนกล่องถูกเปลี่ยนเป็นข้อความกำลังโหลด ล็อกความสูงกล่องไว้เท่าเดิม (ถ้าเป็นแถวในตาราง ล็อกที่กรอบตาราง)
   แล้วปล่อยคืนทันทีที่ข้อมูลจริงเขียนลงกล่องนั้น (หรือกล่องข้างใน / กล่องที่ครอบ) · กันค้าง: ปล่อยเองหลัง 12 วินาที */
(function () {
  const D = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
  if (!D || !D.set || Element.prototype.__uiHoldPatched) return;
  Object.defineProperty(Element.prototype, '__uiHoldPatched', { value: true });
  const PH = /กำลังโหลด|กำลังคำนวณ|กำลังดึง|loading/i, TBL = { TBODY: 1, THEAD: 1, TFOOT: 1, TR: 1, TABLE: 1 }, HELD = new Set();
  const release = t => {
    if (!HELD.has(t)) return; HELD.delete(t); clearTimeout(t.__uiHoldTimer);
    const prev = t.__uiHoldPrev || ''; requestAnimationFrame(() => { t.style.minHeight = prev; });
  };
  Object.defineProperty(Element.prototype, 'innerHTML', {
    configurable: true, enumerable: D.enumerable, get: D.get,
    set(v) {
      let hold = null;
      try {
        const s = typeof v === 'string' ? v : '';
        if (s && s.length < 700 && PH.test(s) && this.isConnected) {
          const t = TBL[this.tagName] ? (((this.closest && this.closest('table')) || this).parentElement || this) : this;
          const h = t.offsetHeight;
          if (h > 80 && !HELD.has(t)) { t.__uiHoldPrev = t.style.minHeight || ''; t.style.minHeight = h + 'px'; HELD.add(t); clearTimeout(t.__uiHoldTimer); t.__uiHoldTimer = setTimeout(() => release(t), 12000); }
        } else if (HELD.size) {
          hold = [...HELD].filter(t => t === this || t.contains(this) || this.contains(t));
        }
      } catch (e) { hold = null; }
      D.set.call(this, v);
      if (hold && hold.length) hold.forEach(release);
    }
  });
})();
