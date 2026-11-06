// ตั้งค่าการเชื่อม Supabase (ค่าจาก Supabase → Project Settings → API) · ไฟล์นี้เปิดเผยได้ ความปลอดภัยอยู่ที่ RLS ในฐานข้อมูล
window.APP = {
  NAME: 'TikTok Sales',                       // ชื่อบนหัวเว็บ
  SUPABASE_URL: 'https://etogrqoncgwkzdrwpbga.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0b2dycW9uY2d3a3pkcndwYmdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM2MjIxMzEsImV4cCI6MjEwOTE5ODEzMX0.IijYsHGwuPM_YMbo-yesTWoADAxUKIP9Az1D4Jfm3n0',
  // รหัสผ่านเดียวทั้งบริษัท (แนะนำ): สร้างผู้ใช้ 1 คนใน Supabase → Authentication → Users แล้วใส่อีเมลนั้นที่นี่
  // ตั้งเป็น '' ถ้าจะไม่ใช้รหัสเลย — อ่าน "ความปลอดภัย" ใน STARTER.md ก่อน (ต้องรัน sql/02_open_access.sql แทน)
  SHARED_LOGIN_EMAIL: 'wowbylizaoff@gmail.com',
};
