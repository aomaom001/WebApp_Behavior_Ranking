# Team Behavior Ranking Dashboard

แดชบอร์ดเปรียบเทียบพฤติกรรมการทำงาน 4 ด้านของทีม ระหว่าง 2 เดือน
สรุปจากไฟล์ MATELINE Ticket Closed 11 เดือน (ก.ค. 2025 – พ.ค. 2026) — ~800,000 Work Order, 5,618 แถว (ทีม × เดือน), 1,166 ทีม

เว็บแบบ static ล้วน (HTML + CSS + JavaScript) ไม่มี framework ไม่มี build step

## โครงสร้างโปรเจค

```
WebApp_Behavior_Ranking/
├── index.html              # โครงหน้า (markup อย่างเดียว)
├── css/
│   └── styles.css          # สไตล์ทั้งหมด
├── js/
│   └── app.js              # logic: โหลด data → render ตาราง/กราฟ/ฟิลเตอร์
├── data/
│   └── data.json           # ข้อมูลสรุป (โหลดผ่าน fetch ตอนรันไทม์)
├── scripts/
│   ├── build_data.py       # data pipeline: Excel (.xlsx) → data/data.json
│   └── requirements.txt    # dependency ของ pipeline (openpyxl)
├── server.js               # dev server เล็กๆ ไม่มี dependency
├── package.json            # npm scripts
├── .github/workflows/
│   └── deploy.yml          # auto-deploy ขึ้น GitHub Pages เมื่อ push main
├── .gitignore
├── .editorconfig
└── .nojekyll               # บอก GitHub Pages ไม่ต้องประมวลผลด้วย Jekyll
```

## รันบนเครื่อง (Local)

ต้องเปิดผ่าน web server — **double-click `index.html` ตรงๆ จะไม่ทำงาน** เพราะ browser บล็อกการ `fetch` ไฟล์ผ่าน `file://`

ต้องมี [Node.js](https://nodejs.org) 18 ขึ้นไป จากนั้น:

```bash
npm run dev
```

แล้วเปิด <http://localhost:5273>

> ไม่อยากใช้ Node ก็ได้ — ใช้ static server อะไรก็ได้ เช่น `python -m http.server 5273` หรือส่วนขยาย "Live Server" ใน VS Code

## Deploy (GitHub Pages)

push ขึ้น branch `main` แล้ว GitHub Actions (`.github/workflows/deploy.yml`) จะ deploy ให้อัตโนมัติ

ตั้งค่าครั้งแรกครั้งเดียว:

1. ไปที่ repo บน GitHub → **Settings → Pages**
2. หัวข้อ **Build and deployment → Source** เลือก **GitHub Actions**
3. push อะไรก็ได้ขึ้น `main` (หรือกด Run workflow เอง) — เว็บจะอยู่ที่
   `https://aomaom001.github.io/WebApp_Behavior_Ranking/`

## วิธีใช้งานแดชบอร์ด

1. เลือก **Skill**: ทุก Skill / NODE / OFC (มุมขวาบน)
2. เลือก **พฤติกรรม** 1 ใน 4 แท็บ (จัดอันดับแยกแต่ละพฤติกรรม)
3. เลือก **ระดับ**: ภาค → จังหวัด → ทีม (กรองภาค/จังหวัดเพื่อเจาะลึก)
4. เลือก **เดือน A (ตั้งต้น)** และ **เดือน B (เทียบ)** เพื่อดูว่าดีขึ้น/แย่ลง
5. คลิกแถวในตารางเพื่อดูแนวโน้ม 11 เดือนของหน่วยนั้น
6. **ค้นหา** กรองตารางตามชื่อ/ภาค/จังหวัด · **Export CSV** ดึงตารางที่เห็นออกไปทำรายงาน (เปิดใน Excel ภาษาไทยได้)
7. ปุ่ม 🌙/☀️ มุมขวาบน สลับธีม Light/Dark (จำค่าไว้)

## ตัวชี้วัด 4 พฤติกรรม (ค่าต่ำ = ดีกว่า, อันดับ 1 = แย่ที่สุด)

- **WO ซ้ำ Ticket เดิม** = (จำนวน WO − จำนวน Ticket ไม่ซ้ำ) ÷ WO
- **เปิด WO ไม่ทำงานจริง** = WO ที่เป็น No-Visit / ไม่มี Complete Solution / Canceled ÷ WO
- **ช่วยข้าม Province** = WO ที่ Province ไม่ตรงกับ Province หลักของ Ticket ÷ WO
- **System WO ผิดปกติ** = WO ที่ Creator = System ÷ WO

Δ (เดลตา): ▼ เขียว = ลดลง = **ดีขึ้น** · ▲ แดง = เพิ่มขึ้น = **แย่ลง**
"WO ขั้นต่ำ" ใช้ตัดหน่วยที่งานน้อยเกินไป (ค่าเริ่มต้น 20)

## อัปเดตข้อมูล (Data Pipeline)

ข้อมูลใน `data/data.json` สร้างจากไฟล์ Excel ต้นฉบับ (`MATELINE TICKET CLOSED_*.xlsx`) ด้วยสคริปต์
`scripts/build_data.py` ไฟล์ Excel ตั้งใจไม่เก็บใน repo (ดู `.gitignore`) เพราะใหญ่ — เก็บไว้นอก repo

**เมื่อมีข้อมูลเดือนใหม่:**

```bash
pip install -r scripts/requirements.txt          # ครั้งแรกครั้งเดียว

# เอาไฟล์ .xlsx เดือนใหม่ไปไว้ในโฟลเดอร์เดียวกับเดือนอื่นๆ แล้ว:
python scripts/build_data.py --src "path/to/excel/folder" --out data/data.json
```

จากนั้น commit เฉพาะ `data/data.json` ที่อัปเดต

**ตรวจสอบความถูกต้อง** (เทียบกับ data.json ปัจจุบัน โดยไม่เขียนทับ):

```bash
python scripts/build_data.py --src "path/to/excel/folder" --validate data/data.json
```

### นิยามที่ใช้คำนวณ (ใน `build_data.py`)
| ฟิลด์ | สูตร | สถานะ |
|-------|------|--------|
| `wo` | จำนวนแถว WO ของทีม | ✅ ตรงข้อมูลเดิม 100% |
| `tickets` | จำนวน Source Ticket ID ที่ไม่ซ้ำ (ไม่นับค่าว่าง) | ✅ 100% |
| `dup` | `wo − tickets` | ✅ 100% |
| `nowork` | WO ที่ Status = Canceled **หรือ** Complete Solution ว่าง | ✅ 100% |
| `cancel` | WO ที่ Status = Canceled | ✅ 100% |
| `cross` | WO ที่ Province ≠ province หลักของ Ticket (province ที่พบบ่อยสุด) | ✅ 100% |
| `sys` | WO ที่ WO Creator = System | ✅ 100% |
| `man` | `wo − sys` | ✅ 100% |
| `region/prov/skill` | ค่าที่พบบ่อยสุดในแถวของทีม | ~99% (ต่างเฉพาะทีมที่ทำงานคร่อมจังหวัด) |

> สคริปต์ผ่านการ validate กับ data.json เดิมครบทั้ง 11 เดือน 5,618 records — ตัวชี้วัดทั้ง 8 ตรง 100%
> หากต้องการเปลี่ยนนิยาม `cross` (เช่น มี lookup site→province) แก้แค่ฟังก์ชัน `ticket_main_province()`
