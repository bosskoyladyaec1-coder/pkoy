// db.js — เชื่อมฐานข้อมูล + ช่องรหัสผ่านเดียว (ไม่มีระบบสมัคร / สิทธิ์ใด ๆ) · ใช้: await DB.ready แล้วเรียก DB.rpc / DB.select / DB.upsert
window.DB = (() => {
  const C = window.APP || {};
  const sb = window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY, { auth: { persistSession: true } });
  const gate = async () => {
    if (!C.SHARED_LOGIN_EMAIL) return;                               // ไม่ใช้รหัส
    const { data } = await sb.auth.getSession(); if (data.session) return;
    await new Promise(resolve => {
      const box = document.createElement('div'); box.className = 'gate';
      box.innerHTML = `<form class="gate-card" novalidate>
        <div class="gate-logo" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg></div>
        <h1>เข้าสู่ระบบ</h1><p class="gate-sys"></p>
        <label for="gatePw">รหัสผ่าน</label>
        <input type="password" id="gatePw" placeholder="กรอกรหัสผ่าน" autocomplete="current-password">
        <div class="gate-err" id="gateErr" role="alert"></div>
        <button type="submit">เข้าสู่ระบบ</button>
        <small>ระบบจะจดจำการเข้าสู่ระบบบนอุปกรณ์นี้</small></form>`;
      box.querySelector('.gate-sys').textContent = C.NAME || 'ระบบวิเคราะห์ยอดขาย';
      document.body.appendChild(box);
      const pw = box.querySelector('#gatePw'), err = box.querySelector('#gateErr'), btn = box.querySelector('button');
      pw.focus();
      // ข้อความแจ้งตามสาเหตุจริง (เดิมขึ้น "รหัสผ่านไม่ถูกต้อง" ทุกกรณี ทำให้หาสาเหตุยาก)
      const why = m => /invalid login credentials/i.test(m) ? 'รหัสผ่านไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง'
        : /email not confirmed/i.test(m) ? 'บัญชีผู้ใช้ยังไม่ได้รับการยืนยัน กรุณาติดต่อผู้ดูแลระบบ'
        : /rate|too many/i.test(m) ? 'เข้าสู่ระบบผิดหลายครั้งเกินไป กรุณารอสักครู่แล้วลองใหม่'
        : /fetch|network|load failed/i.test(m) ? 'ไม่สามารถเชื่อมต่อระบบได้ กรุณาตรวจสอบอินเทอร์เน็ต หรือติดต่อผู้ดูแลระบบ'
        : 'เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง';
      box.querySelector('form').onsubmit = async e => { e.preventDefault();
        if (!pw.value) { err.textContent = 'กรุณากรอกรหัสผ่าน'; pw.focus(); return; }
        err.textContent = ''; btn.disabled = true; btn.textContent = 'กำลังตรวจสอบ…';
        let error; try { ({ error } = await sb.auth.signInWithPassword({ email: C.SHARED_LOGIN_EMAIL, password: pw.value })); } catch (x) { error = x; }
        btn.disabled = false; btn.textContent = 'เข้าสู่ระบบ';
        if (error) { err.textContent = why(String(error.message || error)); pw.select(); return; }
        box.remove(); resolve(); };
    });
  };
  const ready = gate();
  const ok = r => { if (r.error) throw new Error(r.error.message); return r.data; };
  return {
    ready, client: sb,
    rpc: async (fn, args) => { await ready; return ok(await sb.rpc(fn, args || {})); },
    // อ่านทั้งตาราง / view ทีละ 1,000 แถวจนครบ · q = (query) => query.gte(...).lte(...)
    select: async (table, cols = '*', q = x => x) => { await ready; const out = [];
      for (let from = 0; ; from += 1000) { const rows = ok(await q(sb.from(table).select(cols)).range(from, from + 999)); out.push(...rows); if (rows.length < 1000) return out; } },
    // เขียนทีละ 500 แถว (แถวเดิมที่คีย์ซ้ำ = อัปเดตทับ)
    upsert: async (table, rows, onConflict, onProgress) => { await ready;
      for (let i = 0; i < rows.length; i += 500) { ok(await sb.from(table).upsert(rows.slice(i, i + 500), { onConflict })); onProgress && onProgress(Math.min(rows.length, i + 500), rows.length); } },
    insert: async (table, row) => { await ready; return ok(await sb.from(table).insert(row).select().single()); },
    signOut: async () => { await sb.auth.signOut(); location.reload(); },
  };
})();
