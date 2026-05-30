# How to run pos-analytics

ระบบ analytics มี 2 services:
- **analytics-api** (FastAPI, Python) — port 8000
- **analytics-web** (Next.js) — port 3001

ทั้งคู่ต้องรันพร้อมกัน

## 0. Prerequisites

- POS main system รันอยู่ (pos-system) — แชร์ DB เดียวกัน
- มีข้อมูล orders ใน DB (ถ้ายังไม่มี รัน `npm run db:seed:mock` ใน `pos-system/apps/api`)
- `DATABASE_URL` ใน `apps/analytics-api/.env` ตรงกับ DB เดียวกันกับ POS

## 1. Start analytics-api (Python)

```bash
cd apps/analytics-api

# ครั้งแรก: setup venv
python -m venv venv
# Windows
venv\Scripts\activate
# Mac/Linux
source venv/bin/activate

pip install -r requirements.txt

# Run
uvicorn app.main:app --port 8000 --reload
```

จะเห็นที่ console:
```
INFO:     Uvicorn running on http://127.0.0.1:8000
```

ทดสอบ:
```bash
curl http://localhost:8000/api/analytics/stores
```
ต้องคืน JSON [array of stores]

## 2. Start analytics-web (Next.js)

```bash
# คนละ terminal
cd apps/analytics-web
npm install
npm run dev
```

จะเห็น:
```
- Local:    http://localhost:3001
```

เปิด browser ไปที่ http://localhost:3001

## 3. ตรวจสอบว่า services เชื่อมต่อกันแล้ว

ที่มุมซ้ายล่างของ analytics-web จะเห็น health indicator:

- 🟢 **Connected · 2,968 orders · 30 วัน** = ทุกอย่าง OK
- 🔴 **Service offline** = analytics-api ไม่ตอบ (รัน step 1 ใหม่)
- 🟡 **ยังไม่มีข้อมูลออเดอร์** = ต้องรัน seed mock data

## 4. ถ้ายังไม่มีข้อมูล mock

```bash
# ไปที่ pos-system repo (คนละ folder)
cd ../pos-system/apps/api

# Run mock seed (60 วัน, ~2968 orders, 30 customers)
DAYS=60 npm run db:seed:mock

# หรือ Windows
$env:DAYS=60; npm run db:seed:mock
```

หลังรันแล้ว refresh analytics-web — ทุกหน้าจะมีข้อมูลให้ดู

## หน้าที่มีให้ดู

| URL | ใช้เพื่อ |
|-----|---------|
| `/` | Overview — KPI + chart + heatmap |
| `/playbook` | ต้องทำวันนี้ (priority list) |
| `/customers` | กลุ่มลูกค้า + SMS template + Export CSV |
| `/cohort` | การกลับมาซื้อซ้ำ (retention matrix) |
| `/menu` | เมนูไหนทำเงิน (BCG matrix) |
| `/basket` | สินค้าขายคู่กัน |
| `/promotions` | โปรโมชันที่ AI แนะนำ |
| `/whatif` | ลองคำนวณก่อนตัดสินใจ |
| `/forecast` | พยากรณ์ยอดขาย (Prophet) |
| `/goal` | ติดตามเป้าหมาย |
| `/insights` | AI insights |
| `/assistant` | Chat AI |

## Troubleshooting

### "Service offline" — แม้ uvicorn รันอยู่
- ตรวจ port: `uvicorn` ต้องอยู่ที่ port **8000** (frontend ต่อตรงที่นั่น)
- ตรวจ CORS: ใน `apps/analytics-api/.env` ต้องมี `CORS_ORIGINS=http://localhost:3001`
- ลอง curl: `curl http://localhost:8000/health`

### "ยังไม่มีข้อมูล" — แม้รัน seed แล้ว
- ตรวจ store_id ใน sidebar ตรงกับ store ที่ seed
- รัน: ใน pos-system DB → `SELECT COUNT(*) FROM "Order"` ควรเป็น 2900+

### บางหน้ายังไม่มีข้อมูล (e.g. promotions)
- หน้าโปรโมชันแนะนำต้องการ basket data > 5 co-occurrence — ถ้า seed น้อยอาจไม่พอ
- ใช้ `DAYS=90` หรือ `DAYS=120` ใน seed

### Prophet error ใน forecast page
- ติดตั้ง: `pip install prophet` (อาจต้องลง Visual Studio Build Tools บน Windows)
- ถ้าไม่อยากใช้ Prophet — page จะ fallback ใช้ค่าเฉลี่ย
