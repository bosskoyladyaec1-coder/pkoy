// db.js — เชื่อมฐานข้อมูล + ช่องรหัสผ่านเดียว (ไม่มีระบบสมัคร / สิทธิ์ใด ๆ) · ใช้: await DB.ready แล้วเรียก DB.rpc / DB.select / DB.upsert
window.DB = (() => {
  const C = window.APP || {};
  const sb = window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY, { auth: { persistSession: true } });
  const gate = async () => {
    if (!C.SHARED_LOGIN_EMAIL) return;                               // ไม่ใช้รหัส
    const { data } = await sb.auth.getSession(); if (data.session) return;
    await new Promise(resolve => {
      const box = document.createElement('div'); box.className = 'gate';
      box.innerHTML = `<form class="gate-card"><h1>${C.NAME || 'Sales'}</h1><p>ใส่รหัสผ่านของทีม (ใส่ครั้งเดียว เครื่องนี้จะจำไว้)</p>
        <input type="password" id="gatePw" placeholder="รหัสผ่าน" autocomplete="current-password" required><button type="submit">เข้าใช้งาน</button><div class="gate-err" id="gateErr"></div></form>`;
      document.body.appendChild(box);
      box.querySelector('form').onsubmit = async e => { e.preventDefault();
        const { error } = await sb.auth.signInWithPassword({ email: C.SHARED_LOGIN_EMAIL, password: box.querySelector('#gatePw').value });
        if (error) { box.querySelector('#gateErr').textContent = 'รหัสผ่านไม่ถูกต้อง'; return; }
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
