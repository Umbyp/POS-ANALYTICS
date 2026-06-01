# คู่มือ Deploy — Analytics (Production)

repo นี้มี 2 ส่วน ใช้ฐานข้อมูล **Supabase ตัวเดียวกับ POS** (อ่านอย่างเดียว ไม่ต้องตั้งค่า DB ใหม่):

| ส่วน | โฮสต์ | โฟลเดอร์ |
|------|-------|----------|
| Analytics API (FastAPI + pandas + Prophet) | **Render** (Python) | `apps/analytics-api` |
| Analytics Web (Next.js) | **Vercel** | `apps/analytics-web` |

> คู่มือฉบับเต็มของทั้งระบบ (POS + Analytics + การเชื่อม URL + Stripe) อยู่ที่ `DEPLOY.md` ของ repo **pos-system**

---

## 1. Analytics API → Render
1. Render → **New → Blueprint** → เลือก repo นี้ (อ่าน `render.yaml`, service `analytics-api`)
2. Environment (ดู `apps/analytics-api/.env.example`):
   - `DATABASE_URL` = Supabase **direct** (`...:5432/postgres`) — ตัวเดียวกับ POS
   - `GEMINI_API_KEY` = คีย์ Gemini
   - `OPENROUTER_API_KEY` = (ทางเลือก, fallback)
   - `CORS_ORIGINS` = `https://analytics-web.vercel.app,https://pos-web.vercel.app`
3. Deploy → รอ `/health` เขียว → คัดลอก URL (เช่น `https://analytics-api.onrender.com`)

build/start ตั้งไว้ใน `render.yaml` แล้ว:
- build = `pip install -r requirements.txt`
- start = `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- Python = 3.11.9 (มี wheel ของ prophet/pandas)

> ถ้า Prophet ติดตั้ง/รันไม่ได้ ระบบจะ fallback ไปคำนวณพยากรณ์แบบค่าเฉลี่ยรายวันอัตโนมัติ (ไม่ crash)

---

## 2. Analytics Web → Vercel
1. Vercel → **Add New → Project** → เลือก repo นี้
2. **Root Directory** = `apps/analytics-web`
3. Environment Variables:
   - `NEXT_PUBLIC_ANALYTICS_API` = `https://analytics-api.onrender.com`
4. Deploy → ได้ URL (เช่น `https://analytics-web.vercel.app`)

---

## 3. หลัง deploy
- กลับไปใส่ URL ของ Analytics Web ใน `CORS_ORIGINS` ของ Render `analytics-api` (ถ้ายังไม่ได้ใส่) → Save
- เปิดเว็บ → ต้องเห็นยอดขาย/กราฟ/พยากรณ์จากข้อมูลจริง

## ⚠️ หมายเหตุ
- **Render free plan หลับเมื่อไม่มีทราฟฟิก** (cold start) — ครั้งแรกที่เปิดอาจช้า ~50 วิ แนะนำ Starter ถ้าต้องการให้พร้อมตลอด
- Analytics เป็น **read-only** ต่อฐานข้อมูล — ปลอดภัยกับข้อมูล POS
