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

แล้วเปิด <http://localhost:5173>

> ไม่อยากใช้ Node ก็ได้ — ใช้ static server อะไรก็ได้ เช่น `python -m http.server 5173` หรือส่วนขยาย "Live Server" ใน VS Code

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

## ตัวชี้วัด 4 พฤติกรรม (ค่าต่ำ = ดีกว่า, อันดับ 1 = แย่ที่สุด)

- **WO ซ้ำ Ticket เดิม** = (จำนวน WO − จำนวน Ticket ไม่ซ้ำ) ÷ WO
- **เปิด WO ไม่ทำงานจริง** = WO ที่เป็น No-Visit / ไม่มี Complete Solution / Canceled ÷ WO
- **ช่วยข้าม Province** = WO ที่ Province ไม่ตรงกับ Province หลักของ Ticket ÷ WO
- **System WO ผิดปกติ** = WO ที่ Creator = System ÷ WO

Δ (เดลตา): ▼ เขียว = ลดลง = **ดีขึ้น** · ▲ แดง = เพิ่มขึ้น = **แย่ลง**
"WO ขั้นต่ำ" ใช้ตัดหน่วยที่งานน้อยเกินไป (ค่าเริ่มต้น 20)

## อัปเดตข้อมูล

ข้อมูลใน `data/data.json` สรุปมาจากไฟล์ Excel ต้นฉบับ (`MATELINE TICKET CLOSED_*.xlsx`)
ไฟล์ Excel ตั้งใจไม่เก็บใน repo (ดู `.gitignore`) เพราะมีขนาดใหญ่ — เก็บไว้นอก repo
เมื่อมีข้อมูลเดือนใหม่ ให้ generate `data/data.json` ใหม่จากสคริปต์เดิมที่ใช้สร้าง แล้ว commit เฉพาะ `data.json`
