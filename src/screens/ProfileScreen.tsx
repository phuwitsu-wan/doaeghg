import { useId, useState } from "react";
import { PROVINCES } from "@/lib/provinces";
import { saveProfile, useProfile, type Profile } from "@/lib/profile";
import { uid } from "@/lib/defaults";
import { useSettings } from "@/lib/store";
import { go } from "@/lib/router";
import { Text } from "@/components/ui";
import { CONFIG } from "@/config";

const POSITIONS = ["นักวิชาการส่งเสริมการเกษตร", "เจ้าพนักงานการเกษตร", "เกษตรอำเภอ", "เกษตรจังหวัด", "อาสาสมัครเกษตร", "นักวิจัย / อาจารย์", "อื่น ๆ"];

/** ลงทะเบียนผู้ใช้งาน (ครั้งแรก) และแก้ไขข้อมูลผู้ใช้ */
export function ProfileScreen({ firstRun }: { firstRun: boolean }) {
  const existing = useProfile();
  const [settings] = useSettings();
  const [p, setP] = useState<Profile>(existing ?? {
    id: uid(), name: "", position: POSITIONS[0], agency: "", province: "", phone: "", email: "", consentAt: "", createdAt: new Date().toISOString(),
  });
  const [consent, setConsent] = useState(!!existing?.consentAt);
  const [tried, setTried] = useState(false);
  const pid = useId(), vid = useId();
  const set = (patch: Partial<Profile>) => setP((x) => ({ ...x, ...patch }));
  const missing = [!p.name.trim() && "ชื่อ-สกุล", !p.agency.trim() && "หน่วยงาน", !p.province && "จังหวัดที่ปฏิบัติงาน", !consent && "การยินยอม"].filter(Boolean) as string[];

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (missing.length) return;
    saveProfile({ ...p, name: p.name.trim(), agency: p.agency.trim(), consentAt: p.consentAt || new Date().toISOString() }, settings);
    go("/");
  };

  return (
    <form className="page" style={{ maxWidth: "44rem", margin: "0 auto" }} onSubmit={submit} noValidate>
      <h1>{firstRun ? "ลงทะเบียนผู้ใช้งาน" : "ข้อมูลผู้ใช้งาน"}</h1>
      <p className="lead muted" style={{ margin: "0.4rem 0 1.25rem" }}>
        {firstRun ? "กรอกครั้งเดียว ระบบจะใส่ชื่อคุณเป็นผู้บันทึกในทุกแปลงและทุกรายงานให้อัตโนมัติ" : "ข้อมูลนี้แสดงเป็นผู้บันทึกในรายงานทุกฉบับ"}
      </p>
      <div className="grid2">
        <Text label="ชื่อ-สกุล *" value={p.name} onChange={(v) => set({ name: v })} />
        <div className="field">
          <label htmlFor={pid}>ตำแหน่ง</label>
          <select id={pid} className="inp" value={p.position} onChange={(e) => set({ position: e.target.value })}>
            {[...new Set([p.position, ...POSITIONS])].map((x) => <option key={x}>{x}</option>)}
          </select>
        </div>
        <Text label="หน่วยงาน / สังกัด *" placeholder="เช่น สำนักงานเกษตรอำเภอเมือง" value={p.agency} onChange={(v) => set({ agency: v })} />
        <div className="field">
          <label htmlFor={vid}>จังหวัดที่ปฏิบัติงาน *</label>
          <select id={vid} className="inp" value={p.province} onChange={(e) => set({ province: e.target.value })}>
            <option value="">เลือกจังหวัด</option>
            {PROVINCES.map((x) => <option key={x}>{x}</option>)}
          </select>
        </div>
        <Text label="โทรศัพท์" value={p.phone} onChange={(v) => set({ phone: v.replace(/[^0-9+\- ]/g, "") })} />
        <Text label="อีเมล" value={p.email} onChange={(v) => set({ email: v })} />
      </div>

      <label className="consent">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        <span>
          ข้าพเจ้ายินยอมให้เก็บข้อมูลผู้ใช้งานข้างต้นและประวัติการใช้งาน (เช่น วันเวลาที่ใช้ จำนวนแปลง ผลการคำนวณ) เพื่อใช้ติดตามและรายงานผลการดำเนินงาน
          ตาม พ.ร.บ.คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 ข้อมูลจะถูกส่งเข้าฐานข้อมูลของ{CONFIG.madeBy} โดยอัตโนมัติ ชื่อเกษตรกรจะไม่ถูกส่งออกจากเครื่อง
        </span>
      </label>

      {tried && missing.length > 0 && <p className="warn" style={{ marginTop: "1rem" }}>กรุณากรอก: {missing.join(", ")}</p>}
      <div className="pager">
        {!firstRun && <button type="button" className="btn btn-line" onClick={() => go("/")}>ยกเลิก</button>}
        <button type="submit" className="btn btn-main">{firstRun ? "เริ่มใช้งาน" : "บันทึกข้อมูล"}</button>
      </div>

      <footer className="credit-foot">
        <p>
          เว็บแอปนี้คำนวณการปล่อยก๊าซเรือนกระจกโดยอ้างอิงข้อมูลจาก คู่มือ MRV การปล่อยก๊าซเรือนกระจกในภาคเกษตร (GIZ / TGC EMC),
          {" "}2006 IPCC Guidelines และ 2019 Refinement และระเบียบวิธี T-VER ขององค์การบริหารจัดการก๊าซเรือนกระจก (องค์การมหาชน) <a href="#/method">ดูวิธีคำนวณ</a>
        </p>
        <p>จัดทำโดย <b>{CONFIG.madeBy}</b></p>
      </footer>
    </form>
  );
}
