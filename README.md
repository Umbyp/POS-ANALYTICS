# AI Analytics Dashboard — เชื่อมกับ POS System

แพลตฟอร์ม Business Intelligence ที่ใช้ AI วิเคราะห์ข้อมูลจาก POS อัตโนมัติ
พยากรณ์ยอดขาย ตรวจจับ anomaly และมี AI assistant ตอบคำถามธุรกิจ

## 🔗 เชื่อมกับ POS อย่างไร

```
POS System (มีอยู่แล้ว)          Analytics Platform (โปรเจกต์นี้)
├── Express API ─────┐          ┌──── FastAPI (Python)
└── Next.js POS UI   │          │     - Prophet forecasting
                     ▼          ▼     - Gemini AI
              ┌──────────────────────┐
              │  PostgreSQL (Supabase)│  ← ฐานข้อมูลเดียวกัน!
              │  - ตาราง POS (อ่าน)    │
              │  - ตาราง analytics     │
              │  - pgvector            │
              └──────────────────────┘
```

**สำคัญ:** Analytics ใช้ **DATABASE_URL ตัวเดียวกับ POS** — ไม่ต้องตั้ง DB ใหม่
- อ่าน (read-only) ตาราง POS: `Order`, `Product`, `Inventory`, `OrderItem`
- สร้างตารางใหม่ของตัวเอง: `ai_insights`, `chat_sessions`, `forecast_cache`, `knowledge_embeddings`

---

## 🚀 ติดตั้ง & รัน

### 1. Backend (FastAPI)

```bash
cd apps/analytics-api

# สร้าง virtual env
python3 -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate

# ติดตั้ง dependencies
pip install -r requirements.txt
```

> ⚠️ **Prophet** ใช้เวลา install นาน (มี C++ compile) — รอสักครู่
> ถ้าติดปัญหา: `pip install prophet --no-cache-dir` หรือใช้ conda

สร้างไฟล์ `.env`:
```env
# ใช้ DIRECT_URL ของ POS (port 5432 ไม่ใช่ 6543)
DATABASE_URL=postgresql://postgres.xxxx:PASSWORD@aws-0-xxx.pooler.supabase.com:5432/postgres

GEMINI_API_KEY=your-gemini-key       # ขอฟรีที่ https://aistudio.google.com/apikey
GEMINI_MODEL=gemini-2.0-flash

OPENROUTER_API_KEY=your-openrouter-key   # fallback (optional)
PORT=8000
CORS_ORIGINS=http://localhost:3001
```

รัน:
```bash
uvicorn app.main:app --reload --port 8000
```

เปิด http://localhost:8000/docs — เห็น Swagger UI = สำเร็จ

> ตอน startup ระบบจะสร้างตาราง analytics + เปิด pgvector อัตโนมัติ

### 2. Frontend (Next.js Dashboard)

```bash
cd apps/analytics-web
npm install
cp .env.local.example .env.local
```

`.env.local`:
```env
NEXT_PUBLIC_ANALYTICS_API=http://localhost:8000
```

รัน:
```bash
npm run dev
# → http://localhost:3001
```

---

## 📊 ฟีเจอร์

### Dashboard (`/`)
- KPI cards: รายได้, กำไร, ออเดอร์, ค่าเฉลี่ยต่อบิล (พร้อม growth %)
- กราฟแนวโน้มรายได้
- Heatmap ช่วงเวลาขายดี (วัน × ชั่วโมง)
- สินค้าขายดี
- AI Insights ล่าสุด

### Forecast (`/forecast`)
- พยากรณ์รายได้ 30 วัน (Prophet)
- พยากรณ์ traffic
- ช่วงเวลา peak hours
- กราฟแสดงข้อมูลจริง + ช่วงความเชื่อมั่น

### AI Insights (`/insights`)
- Insight อัตโนมัติ: trend, anomaly, inventory, forecast
- Recommendations: ควรสั่งสินค้าอะไร, สินค้ากำไรสูง, ไอเดียโปรโมชัน
- ปุ่ม "วิเคราะห์ใหม่" รัน insight engine

### AI Assistant (`/assistant`)
- Chat กับ AI ที่เข้าใจข้อมูลธุรกิจจริง
- Streaming response (เห็นข้อความพิมพ์ทีละตัว)
- คำถามแนะนำ
- AI ดึงข้อมูลจริงจาก POS มาตอบ (RAG แบบ structured)

### Multi-Branch
- เลือกสาขาที่ sidebar — ข้อมูลทุกหน้าเปลี่ยนตาม

---

## 🧠 AI ทำงานอย่างไร

### Insight Engine (`insight_service.py`)
รัน detector หลายตัว:
- **Trend** — เทียบยอด 2 สัปดาห์ ↑↓ 15%
- **Anomaly** — z-score ตรวจยอดผิดปกติ
- **Inventory** — คำนวณวันที่สินค้าจะหมด
- **Forecast** — เตือนถ้าสัปดาห์หน้าจะตก

### AI Assistant (`ai_service.py`)
1. ผู้ใช้ถามคำถาม
2. ระบบดึงข้อมูลจริง (KPI, top products, สต็อก) → ทำเป็น context
3. ถ้าถามเรื่องอนาคต → รัน Prophet เพิ่ม context
4. ส่ง context + คำถาม ให้ Gemini → stream คำตอบกลับ
5. ถ้า Gemini ล่ม → fallback ไป OpenRouter

### Forecasting (`forecast_service.py`)
- ใช้ **Prophet** (Facebook) — เหมาะกับ time series ที่มี seasonality
- ดึงยอดขายรายวัน 120 วัน → เทรนด์ → พยากรณ์ล่วงหน้า
- ถ้าข้อมูล < 7 วัน → fallback เป็นค่าเฉลี่ย

---

## 🗂 โครงสร้าง

```
pos-analytics/
├── apps/
│   ├── analytics-api/              # FastAPI Backend
│   │   ├── app/
│   │   │   ├── main.py             # entry
│   │   │   ├── config.py
│   │   │   ├── database.py         # เชื่อม POS DB
│   │   │   ├── sql/init_analytics.sql
│   │   │   ├── services/
│   │   │   │   ├── data_service.py        # query POS data
│   │   │   │   ├── forecast_service.py    # Prophet
│   │   │   │   ├── insight_service.py     # auto insights
│   │   │   │   ├── ai_service.py          # Gemini + OpenRouter
│   │   │   │   └── recommendation_service.py
│   │   │   └── routers/
│   │   └── requirements.txt
│   └── analytics-web/              # Next.js Dashboard
│       └── src/
│           ├── app/                # Dashboard, Forecast, Insights, Assistant
│           ├── components/
│           └── lib/
```

---

## 🔌 API Endpoints

| Endpoint | ทำอะไร |
|----------|--------|
| `GET /api/analytics/kpi` | KPI สรุป |
| `GET /api/analytics/daily-sales` | ยอดขายรายวัน |
| `GET /api/analytics/heatmap` | ข้อมูล heatmap |
| `GET /api/analytics/top-products` | สินค้าขายดี |
| `GET /api/forecast/revenue` | พยากรณ์รายได้ |
| `GET /api/forecast/peak-hours` | ช่วงเวลา peak |
| `GET /api/insights` | ดึง insights |
| `POST /api/insights/generate` | สร้าง insights ใหม่ |
| `GET /api/recommendations` | คำแนะนำธุรกิจ |
| `POST /api/chat/stream` | AI chat (streaming) |

ดูทั้งหมดที่ http://localhost:8000/docs

---

## ⏰ ตั้ง Cron สร้าง Insight รายวัน

ใช้ cron / Render Cron Job เรียก:
```bash
curl -X POST "http://localhost:8000/api/insights/generate?store_id=YOUR_STORE_ID"
```

หรือใน Python:
```python
import schedule, time
from app.services.insight_service import generate_all_insights

schedule.every().day.at("06:00").do(lambda: generate_all_insights(STORE_ID))
```

---

## 🚢 Deploy

### Backend → Render
- New Web Service → Root: `apps/analytics-api`
- Build: `pip install -r requirements.txt`
- Start: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- Env: `DATABASE_URL`, `GEMINI_API_KEY`, `CORS_ORIGINS`

> ⚠️ Prophet ต้องใช้ RAM — Render free tier อาจไม่พอ แนะนำ Starter plan

### Frontend → Vercel
- Root: `apps/analytics-web`
- Env: `NEXT_PUBLIC_ANALYTICS_API`

---

## 🐛 Troubleshooting

**`relation "Order" does not exist`**
→ DATABASE_URL ชี้ผิด database — ต้องเป็นตัวเดียวกับที่ POS ใช้ + ต้อง seed POS แล้ว

**Prophet install ล้มเหลว**
→ `pip install prophet --no-cache-dir` หรือใช้ `conda install -c conda-forge prophet`

**`pgvector extension not found`**
→ Supabase รองรับ pgvector อยู่แล้ว — เปิดที่ Dashboard → Database → Extensions → เปิด `vector`

**AI ตอบว่า "ระบบ AI ไม่พร้อม"**
→ ยังไม่ได้ตั้ง `GEMINI_API_KEY` — ขอฟรีที่ https://aistudio.google.com/apikey

**CORS error**
→ เพิ่ม URL ของ frontend ใน `CORS_ORIGINS`

---

## 📝 หมายเหตุ

- ระบบนี้ออกแบบให้ทำงานคู่กับ POS System ที่สร้างไว้ก่อนหน้า
- ต้องมีข้อมูลใน POS (orders จริง) — ยิ่งมีข้อมูลเยอะ forecast ยิ่งแม่น
- Prophet ต้องการอย่างน้อย 2 สัปดาห์ของข้อมูลถึงจะพยากรณ์ได้ดี
- AI assistant ใช้ข้อมูลจริง 100% ไม่ได้มั่ว — ดึงจาก DB ก่อนตอบทุกครั้ง
