# Deploy ด้วย Docker / Portainer

สถาปัตยกรรม:

```
PostgreSQL (ของคุณ, query ผ่าน pgAdmin)
        ▲ query (ใช้ logic เดียวกับ pipeline เดิม → ตัวเลขตรง 100%)
   ┌────┴────┐         ┌──────────────┐
   │  api    │◀──/api──│  dashboard   │ :8088  (nginx เสิร์ฟ static + proxy /api)
   │ FastAPI │         │   nginx      │
   └─────────┘         └──────────────┘
```

- **api** (`api/`): FastAPI + psycopg อ่านตารางใน Postgres (ตารางเดียวกับที่ดูใน pgAdmin) แล้วคำนวณ → `/api/data`, `/api/detail/<month>` · cache ผลไว้ (`CACHE_TTL`)
- **dashboard**: nginx เสิร์ฟหน้าเว็บ + proxy `/api` ไป api · ถ้า API ล่ม เว็บ fallback ไปไฟล์ static อัตโนมัติ
- ฐานข้อมูลเป็น **ของคุณเอง** (ไม่ได้สร้างใน stack) — api แค่เชื่อมต่อผ่าน env

ไฟล์: [`Dockerfile`](Dockerfile) · [`nginx.conf`](nginx.conf) · [`api/`](api/) · [`docker-compose.yml`](docker-compose.yml) · [`.env.example`](.env.example)

---

## ⚙️ ต้องตั้งค่า env ก่อน (สำคัญ)

คัดลอก [`.env.example`](.env.example) เป็น `.env` แล้วกรอก (หรือใส่เป็น environment variables ของ stack ใน Portainer):

| ตัวแปร | ความหมาย |
|---|---|
| `PG_HOST` | host ของ Postgres (`host.docker.internal` ถ้า DB อยู่บนเครื่อง host เดียวกัน) |
| `PG_PORT` `PG_DB` `PG_USER` `PG_PASSWORD` | ข้อมูลเชื่อมต่อ |
| `PG_TABLE` | ชื่อตารางที่ mirror MATELINE เช่น `public.mateline` (ใส่ `"..."` ถ้าชื่อมีเว้นวรรค) |
| **`MONTH_SQL`** | **นิยามว่าแต่ละแถวอยู่เดือนไหน** ค่าเริ่มต้น `to_char("Closed", 'YYYY-MM')` |
| `CACHE_TTL` | วินาทีที่ cache ผล (เริ่มต้น 600) |

> ⚠️ **`MONTH_SQL` คือสิ่งเดียวที่ต้องยืนยันให้ตรง schema จริง** — ตาราง Excel เดิมแบ่งเดือนด้วย *ชื่อไฟล์* แต่ใน Postgres ต้องแบ่งจากคอลัมน์วันที่ ถ้าเดือนอ้างจาก `Closed` ใช้ค่าเริ่มต้นได้เลย ถ้า `Closed` เป็น text ใช้ `left("Closed",7)` หรือถ้าอยากแบ่งตามเดือนที่เปิดงานใช้ `to_char("Created Time",'YYYY-MM')`

## วิธี deploy บน Portainer (Stacks จาก Git)

1. **Stacks → Add stack** ตั้งชื่อ เช่น `tt-dashboard`
2. เลือก **Repository** → URL repo → **Compose path:** `WebApp_Behavior_Ranking/docker-compose.yml`
3. ในช่อง **Environment variables** ใส่ `PG_HOST`, `PG_DB`, `PG_USER`, `PG_PASSWORD`, `PG_TABLE`, `MONTH_SQL` (ตามตารางบน)
4. **Deploy the stack** → Portainer build ทั้ง api + dashboard แล้วรันให้
5. เปิด `http://<host>:8088`

ข้อมูลอัปเดตเองตาม DB (cache รีเฟรชทุก `CACHE_TTL` วินาที) · บังคับรีเฟรชทันที: `POST /api/refresh`

## รัน/ทดสอบบนเครื่อง

```bash
cd WebApp_Behavior_Ranking
cp .env.example .env        # แล้วแก้ค่าให้ตรง DB ของคุณ
docker compose up -d --build
# เปิด http://localhost:8088   ·   เช็ก API: curl http://localhost:8088/api/data | head -c 300
docker compose down
```

> ถ้า DB อยู่บนเครื่อง host: `PG_HOST=host.docker.internal` (compose ตั้ง `extra_hosts` ให้แล้ว)

---

## หมายเหตุ

- **ตัวเลขตรงกับของเดิม 100%** — api ใช้ `scripts/agg_core.py` ตัวเดียวกับ pipeline Excel ที่ validate แล้ว (8 เมตริกตรง 100%)
- **pgAdmin**: ถ้าอยากมีในชุดเดียวกัน เปิด service `pgadmin` ที่คอมเมนต์ไว้ใน `docker-compose.yml` (ค่าเริ่มต้นคุณ query ผ่าน pgAdmin เดิมได้เลย)
- **ยังมีโหมด static**: ไฟล์ `data/*.json` + pipeline `build_data.py` ยังใช้ได้ (เช่น deploy ขึ้น GitHub Pages โดยไม่มี API) — เว็บจะลอง `/api` ก่อน ถ้าไม่มีค่อย fallback ไฟล์ static
- ไฟล์ Excel, backup, `.env` ไม่ถูกใส่ลง image
