// ตั้งค่าการเชื่อม Supabase (ค่าจาก Supabase → Project Settings → API) · ไฟล์นี้เปิดเผยได้ ความปลอดภัยอยู่ที่ RLS ในฐานข้อมูล
window.APP = {
  NAME: 'TikTok Sales',                       // ชื่อบนหัวเว็บ
  SUPABASE_URL: 'https://YOUR-PROJECT.supabase.co',
  SUPABASE_ANON_KEY: 'YOUR-ANON-KEY',
  // รหัสผ่านเดียวทั้งบริษัท (แนะนำ): สร้างผู้ใช้ 1 คนใน Supabase → Authentication → Users แล้วใส่อีเมลนั้นที่นี่
  // ตั้งเป็น '' ถ้าจะไม่ใช้รหัสเลย — อ่าน "ความปลอดภัย" ใน STARTER.md ก่อน (ต้องรัน sql/02_open_access.sql แทน)
  SHARED_LOGIN_EMAIL: 'team@your-company.com',
};
