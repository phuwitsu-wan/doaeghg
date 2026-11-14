import { useState } from "react";
import { CFOA, FUELS, MACHINES, ORGANIC_FERTS, RESIDUES, ROOT_RATIOS, SF_P, SF_W, TRANSPORT_FUELS, type CFOAKey, type MachineKey, type RootKey, type SFpKey, type SFwKey, type TransportKey } from "@/lib/engine/factors";
import { ALLOMETRIC, treeBiomass } from "@/lib/engine/trees";
import { nPctFromFormula } from "@/lib/engine/calc";
import type { CropGroup, FieldRecord, MachineUse, Scenario, TreeInventory, TreeRow } from "@/lib/engine/types";
import { CROP_NAMES, uid } from "@/lib/defaults";
import { Choice, Item, Num, NumInput, Q, Select, Text } from "@/components/ui";
import { AddressPicker } from "@/components/Address";

export type UpdS = (fn: (s: Scenario) => void) => void;
export type UpdR = (fn: (r: FieldRecord) => void) => void;

const SACK = [{ label: "กก./ไร่", scale: 1 }, { label: "กระสอบ/ไร่", scale: 50 }];
const fmt1 = (n: number) => n.toLocaleString("th-TH", { maximumFractionDigits: 1 });

/* ====================== ขั้นที่ 1: ข้อมูลแปลง ====================== */
export function PlotStep({ rec, upd }: { rec: FieldRecord; upd: UpdR }) {
  const isTree = rec.crop === "fruit" || rec.crop === "forest";
  return (
    <>
      <Q title="แปลงนี้ปลูกอะไร">
        <Choice label="ชนิดพืช" value={rec.cropName} onChange={(v) => upd((r) => { r.cropName = v; })}
          options={[...new Set([...CROP_NAMES[rec.crop], rec.cropName])].map((n) => ({ key: n, label: n }))} />
      </Q>
      <Q title="เจ้าของแปลง">
        <div className="grid2">
          <Text label="ชื่อ-สกุลเกษตรกร" value={rec.info.farmer} onChange={(v) => upd((r) => { r.info.farmer = v; })} />
          <Text label="ชื่อแปลง" placeholder="เช่น แปลงหลังบ้าน" value={rec.info.plotName} onChange={(v) => upd((r) => { r.info.plotName = v; })} />
          <Text label="ฤดูกาล / ปีเพาะปลูก (พ.ศ.)" value={rec.info.season} onChange={(v) => upd((r) => { r.info.season = v; })} />
          <Text label="หมายเหตุ" value={rec.info.note} onChange={(v) => upd((r) => { r.info.note = v; })} />
        </div>
      </Q>
      <Q title="ที่ตั้งแปลง" help="ยืนอยู่ในแปลงแล้วกด “ใช้ตำแหน่งปัจจุบัน” ระบบจะกรอกตำบล อำเภอ จังหวัดให้ หรือเลือกเองจากรายการ">
        <AddressPicker
          value={{ province: rec.info.province, district: rec.info.district, subdistrict: rec.info.subdistrict, lat: rec.info.lat, lng: rec.info.lng }}
          onChange={(v) => upd((r) => {
            if (v.province !== undefined) r.info.province = v.province;
            if (v.district !== undefined) r.info.district = v.district;
            if (v.subdistrict !== undefined) r.info.subdistrict = v.subdistrict;
            if (v.lat !== undefined) r.info.lat = v.lat;
            if (v.lng !== undefined) r.info.lng = v.lng;
          })} />
      </Q>
      <Q title="ขนาดแปลงและผลผลิต">
        <div className="grid2">
          <Num label="พื้นที่เพาะปลูก" unit="ไร่" value={rec.baseline.areaRai} onChange={(v) => upd((r) => {
            for (const s of [r.baseline, r.project]) {
              if (s.rice.harvestedAreaRai === 0 || s.rice.harvestedAreaRai === s.areaRai) s.rice.harvestedAreaRai = v;
              s.areaRai = v;
            }
          })} />
          {rec.crop !== "forest" && (
            <Num label={rec.hasProject ? "ผลผลิต ก่อนเข้าร่วมโครงการ" : "ผลผลิต"} unit="กก./ไร่" value={rec.baseline.yieldKgPerRai} onChange={(v) => upd((r) => { r.baseline.yieldKgPerRai = v; })} />
          )}
          {rec.crop !== "forest" && rec.hasProject && (
            <Num label="ผลผลิต หลังเข้าร่วมโครงการ" unit="กก./ไร่" value={rec.project.yieldKgPerRai} onChange={(v) => upd((r) => { r.project.yieldKgPerRai = v; })} />
          )}
        </div>
      </Q>
      <Q title="ต้องการคำนวณแบบไหน" help={isTree ? "ไม้ผลและป่าไม้จะคิดการกักเก็บคาร์บอนของต้นไม้ด้วย" : undefined}>
        <Choice boxy label="รูปแบบการคำนวณ" value={rec.hasProject ? "yes" : "no"} onChange={(v) => upd((r) => {
          r.hasProject = v === "yes";
          if (r.hasProject && !r.project.chemFerts.length && !r.project.machines.length) {
            r.project = structuredClone(r.baseline);
          }
        })} options={[
          { key: "no", label: "คิดการปล่อยของแปลงนี้", sub: "ข้อมูลฤดูกาลเดียว" },
          { key: "yes", label: "เปรียบเทียบก่อน-หลังเข้าร่วมโครงการ", sub: "เช่น ไม่เผา ลดปุ๋ย เปียกสลับแห้ง" },
        ]} />
        <div style={{ marginTop: "0.75rem" }}>
          <Choice boxy label="มาตรฐาน" value={rec.standard} onChange={(v) => upd((r) => { r.standard = v; })} options={[
            { key: "mrv", label: "MRV / IPCC", sub: "ตามคู่มือ MRV ใช้ทั่วไป" },
            { key: "tver", label: "T-VER", sub: "ประมาณการคาร์บอนเครดิต อบก." },
          ]} />
        </div>
      </Q>
    </>
  );
}

/* ====================== เครื่องจักร ====================== */
const STAGE_MACHINES: Record<string, MachineKey[]> = {
  เตรียมดิน: ["tractorM", "tractorXS"],
  ปลูก: ["transplanterWalk", "transplanterRide", "tractorS"],
  สูบน้ำ: ["pump"],
  "ใส่ปุ๋ย/ฉีดพ่น/ดูแล": ["sprayer", "tractorS"],
  เก็บเกี่ยว: ["combine", "caneHarvester", "tractorM"],
  จัดการเศษวัสดุ: ["tractorS"],
};
const TRACTORS: MachineKey[] = ["tractorXS", "tractorS", "tractorM", "tractorL"];
const isTractor = (k: MachineKey) => TRACTORS.includes(k);
/** แบ่งกลุ่มรถแทรกเตอร์ตามแรงม้า [MRV Eq.8.2]: < 21, 21–45, 46–75, > 75 แรงม้า */
export const tractorClass = (hp: number): MachineKey => (hp < 21 ? "tractorXS" : hp <= 45 ? "tractorS" : hp <= 75 ? "tractorM" : "tractorL");
const DEFAULT_HP: Partial<Record<MachineKey, number>> = { tractorXS: 12, tractorS: 35, tractorM: 60, tractorL: 90 };
const HP_RANGE: Partial<Record<MachineKey, string>> = { tractorXS: "ต่ำกว่า 21 แรงม้า", tractorS: "21–45 แรงม้า", tractorM: "46–75 แรงม้า", tractorL: "มากกว่า 75 แรงม้า" };
const SHORT: Partial<Record<MachineKey, string>> = {
  tractorXS: "รถไถเดินตาม / แทรกเตอร์จิ๋ว", tractorS: "รถแทรกเตอร์", tractorM: "รถแทรกเตอร์", tractorL: "รถแทรกเตอร์",
  transplanterWalk: "รถดำนาเดินตาม", transplanterRide: "รถดำนานั่งขับ", pump: "เครื่องสูบน้ำน้ำมัน",
  sprayer: "เครื่องพ่นสะพายหลัง", combine: "รถเกี่ยวนวดข้าว", caneHarvester: "รถตัดอ้อย",
};

function MachineRow({ m, s, upd }: { m: MachineUse; s: Scenario; upd: UpdS }) {
  const [fine, setFine] = useState(false);
  const set = (p: Partial<MachineUse>) => upd((x) => { const r = x.machines.find((y) => y.id === m.id); if (r) Object.assign(r, p); });
  const remove = () => upd((x) => { x.machines = x.machines.filter((y) => y.id !== m.id); });
  if (m.fuel === "electric") {
    return (
      <Item title="ปั๊มน้ำไฟฟ้า" onRemove={remove}>
        <Num label="ไฟฟ้าที่ใช้ทั้งฤดู" unit="kWh" value={m.kwh} onChange={(v) => set({ kwh: v })} hint="ดูจากบิลค่าไฟ หรือ กำลังมอเตอร์ (kW) × ชั่วโมงที่สูบ" />
      </Item>
    );
  }
  const liters = m.mode === "liters" ? m.liters : m.hoursPerRai * Math.max(1, m.times) * m.lph * s.areaRai;
  return (
    <Item title={<>{SHORT[m.machine] ?? MACHINES[m.machine].label}{isTractor(m.machine) && m.hp ? ` ${m.hp} แรงม้า` : ""} <span className="muted small">ใช้{FUELS[m.fuel as keyof typeof FUELS]?.label ?? "ดีเซล"} ≈ {fmt1(liters)} ลิตร</span></>} onRemove={remove}>
      {isTractor(m.machine) && (
        <Num label="ขนาดเครื่องยนต์" unit="แรงม้า" value={m.hp ?? 0}
          hint={`${HP_RANGE[m.machine] ?? ""} ใช้น้ำมัน ${MACHINES[m.machine].lph} ลิตร/ชม.`}
          onChange={(v) => { const k = tractorClass(v || 0); set({ hp: v, machine: k, lph: MACHINES[k].lph }); }} />
      )}
      {m.mode === "hours" ? (
        <>
          <Num label="เวลาทำงาน" unit="ชม./ไร่" value={m.hoursPerRai} onChange={(v) => set({ hoursPerRai: v })} />
          <Num label="ทำกี่ครั้ง" unit="ครั้ง" value={m.times} onChange={(v) => set({ times: v })} />
        </>
      ) : (
        <Num label="น้ำมันที่ใช้ทั้งแปลง" unit="ลิตร" value={m.liters} onChange={(v) => set({ liters: v })} />
      )}
      {fine ? (
        <>
          <Select label="ชนิดน้ำมัน" value={m.fuel as keyof typeof FUELS} options={Object.entries(FUELS).map(([k, v]) => [k as keyof typeof FUELS, v.label])} onChange={(v) => set({ fuel: v })} />
          {m.mode === "hours" && <Num label="อัตราสิ้นเปลือง" unit="ลิตร/ชม." value={m.lph} onChange={(v) => set({ lph: v })} />}
          <div className="field"><span className="lbl">วิธีกรอก</span>
            <button type="button" className="btn btn-line btn-wide" onClick={() => set({ mode: m.mode === "hours" ? "liters" : "hours" })}>
              {m.mode === "hours" ? "กรอกเป็นลิตรแทน" : "กรอกเป็นชั่วโมงแทน"}
            </button>
          </div>
        </>
      ) : (
        <div className="field" style={{ alignSelf: "end" }}>
          <button type="button" className="btn-link" onClick={() => setFine(true)}>ปรับชนิดน้ำมัน / อัตราสิ้นเปลือง</button>
        </div>
      )}
    </Item>
  );
}

export function Machines({ s, upd, stage, electric }: { s: Scenario; upd: UpdS; stage: string; electric?: boolean }) {
  const rows = s.machines.filter((m) => m.stage === stage);
  const add = (k: MachineKey | "electric") => upd((x) => {
    const mk: MachineKey = k === "electric" ? "pump" : k;
    x.machines.push({ id: uid(), stage, machine: mk, fuel: k === "electric" ? "electric" : MACHINES[mk].fuel, mode: "hours", hoursPerRai: 0, times: 1, lph: MACHINES[mk].lph, liters: 0, kwh: 0, hp: DEFAULT_HP[mk] });
  });
  return (
    <div>
      <div className="chips">
        {STAGE_MACHINES[stage].map((k) => (
          <button key={k} type="button" className="chip chip-add" onClick={() => add(k)}>+ {k === "tractorXS" ? "รถไถเดินตาม" : SHORT[k]}<small>{isTractor(k) && k !== "tractorXS" ? "ระบุแรงม้าได้" : `${MACHINES[k].lph} ลิตร/ชม.`}</small></button>
        ))}
        {electric && <button type="button" className="chip chip-add" onClick={() => add("electric")}>+ ปั๊มน้ำไฟฟ้า<small>คิดจาก kWh</small></button>}
      </div>
      {rows.map((m) => <MachineRow key={m.id} m={m} s={s} upd={upd} />)}
    </div>
  );
}

/* ====================== ขั้นที่ 2: เตรียมดิน ====================== */
export function PrepStep({ s, upd }: { s: Scenario; upd: UpdS }) {
  return (
    <>
      <Q title="ใช้เครื่องจักรอะไรเตรียมดิน" help="กดเพื่อเพิ่ม แล้วกรอกเวลาทำงานต่อไร่ ถ้าไม่ใช้ข้ามได้เลย">
        <Machines s={s} upd={upd} stage="เตรียมดิน" />
      </Q>
      <Q title="ใส่ปูนปรับสภาพดินไหม" help="ถ้าไม่ใส่ เว้นว่างไว้">
        <div className="grid2">
          <Num label="ปูนขาว / ปูนมาร์ล" units={SACK} value={s.limestoneKgPerRai} onChange={(v) => upd((x) => { x.limestoneKgPerRai = v; })} />
          <Num label="โดโลไมต์" units={SACK} value={s.dolomiteKgPerRai} onChange={(v) => upd((x) => { x.dolomiteKgPerRai = v; })} />
        </div>
      </Q>
    </>
  );
}

/* ====================== ขั้นที่ 3: ปลูกและน้ำ ====================== */
const WATER: { key: SFwKey; label: string; sub: string }[] = [
  { key: "continuous", label: "ขังน้ำตลอด", sub: "นาชลประทาน" },
  { key: "awd", label: "เปียกสลับแห้ง", sub: "AWD" },
  { key: "single", label: "ระบายน้ำออก 1 ครั้ง", sub: "นาชลประทาน" },
  { key: "multiple", label: "ระบายน้ำออกหลายครั้ง", sub: "นาชลประทาน" },
  { key: "rainfed", label: "นาน้ำฝน นาลุ่ม", sub: "" },
  { key: "drought", label: "นาน้ำฝน นาดอน", sub: "มักแห้งแล้ง" },
  { key: "deep", label: "นาน้ำลึก", sub: "" },
  { key: "upland", label: "ข้าวไร่", sub: "ไม่ขังน้ำ" },
];
const PRE: { key: SFpKey; label: string; sub: string }[] = [
  { key: "short", label: "แห้งไม่ถึง 6 เดือน", sub: "หรือขังน้ำไม่ถึง 30 วัน" },
  { key: "flooded30", label: "ขังน้ำเกิน 30 วัน", sub: "ก่อนปลูก" },
  { key: "dry180", label: "แห้งเกิน 6 เดือน", sub: "" },
  { key: "dry365", label: "แห้งเกิน 1 ปี", sub: "" },
];
const ORG_SHORT: Record<CFOAKey, string> = { strawShort: "ไถกลบฟาง (ไม่ถึง 30 วันก่อนปลูก)", strawLong: "ไถกลบฟาง (เกิน 30 วันก่อนปลูก)", manure: "ปุ๋ยคอก", compost: "ปุ๋ยหมัก", green: "ปุ๋ยพืชสด" };

export function PlantStep({ s, upd, crop }: { s: Scenario; upd: UpdS; crop: CropGroup }) {
  const rice = crop === "rice";
  return (
    <>
      {rice && (
        <>
          <Q title="อายุข้าวและพื้นที่เก็บเกี่ยว">
            <div className="grid2">
              <Num label="ปลูกถึงเก็บเกี่ยว" unit="วัน" value={s.rice.days} onChange={(v) => upd((x) => { x.rice.days = v; })} />
              <Num label="พื้นที่ที่เก็บเกี่ยวได้" unit="ไร่" value={s.rice.harvestedAreaRai} onChange={(v) => upd((x) => { x.rice.harvestedAreaRai = v; })} hint="ปกติเท่ากับพื้นที่ปลูก ยกเว้นเสียหาย" />
            </div>
          </Q>
          <Q title="ระหว่างปลูก จัดการน้ำในนาอย่างไร" help="มีผลต่อก๊าซมีเทนมากที่สุด">
            <Choice boxy label="การจัดการน้ำระหว่างปลูก" value={s.rice.waterRegime} onChange={(v) => upd((x) => { x.rice.waterRegime = v; })} options={WATER} />
          </Q>
          <Q title="ก่อนปลูกรอบนี้ นาอยู่ในสภาพไหน">
            <Choice boxy label="การจัดการน้ำก่อนปลูก" value={s.rice.preSeason} onChange={(v) => upd((x) => { x.rice.preSeason = v; })} options={PRE} />
          </Q>
          <Q title="ก่อนปลูก ไถกลบฟางหรือใส่อินทรียวัตถุลงนาไหม" help="ฟางให้ใช้น้ำหนักแห้ง สารอื่นใช้น้ำหนักสด">
            <div className="chips">
              {(Object.keys(CFOA) as CFOAKey[]).map((k) => (
                <button key={k} type="button" className="chip chip-add" onClick={() => upd((x) => {
                  x.rice.organics.push({ id: uid(), type: k, kgPerRai: k.startsWith("straw") ? Math.round(RESIDUES.rice.defaultKgPerRai) : 0 });
                })}>+ {ORG_SHORT[k]}</button>
              ))}
            </div>
            {s.rice.organics.map((o) => (
              <Item key={o.id} title={ORG_SHORT[o.type]} onRemove={() => upd((x) => { x.rice.organics = x.rice.organics.filter((y) => y.id !== o.id); })}>
                <Num label="ปริมาณ" units={[{ label: "กก./ไร่", scale: 1 }, { label: "ตัน/ไร่", scale: 1000 }]} value={o.kgPerRai}
                  onChange={(v) => upd((x) => { const r = x.rice.organics.find((y) => y.id === o.id); if (r) r.kgPerRai = v; })} />
              </Item>
            ))}
          </Q>
        </>
      )}
      <Q title="ใช้เครื่องจักรปลูกไหม">
        <Machines s={s} upd={upd} stage="ปลูก" />
      </Q>
      <Q title={rice ? "สูบน้ำเข้านาไหม" : "ให้น้ำด้วยเครื่องสูบน้ำไหม"}>
        <Machines s={s} upd={upd} stage="สูบน้ำ" electric />
      </Q>
    </>
  );
}

/* ====================== ขั้นที่ 4: ปุ๋ย ====================== */
const COMMON_ORG = ["cow", "chicken", "pig", "compost", "green"];
const QUICK_FORMULAS = ["46-0-0", "16-20-0", "15-15-15", "16-16-8", "18-46-0", "21-0-0", "0-0-60"];

export function FertStep({ s, upd, care }: { s: Scenario; upd: UpdS; care?: boolean }) {
  const [custom, setCustom] = useState("");
  const addChem = (formula: string) => upd((x) => { x.chemFerts.push({ id: uid(), round: x.chemFerts.length + 1, formula, kgPerRai: 0 }); });
  const addOrg = (k: string) => upd((x) => { x.orgFerts.push({ id: uid(), type: k, nPct: ORGANIC_FERTS[k].nPct, kgPerRai: 0 }); });
  const totalN = s.chemFerts.reduce((a, f) => a + f.kgPerRai * nPctFromFormula(f.formula) / 100, 0);
  return (
    <>
      <Q title="ปุ๋ยเคมีที่ใส่" help="กดสูตรปุ๋ยเพื่อเพิ่มทีละครั้งที่ใส่ แตะหน่วยเพื่อสลับระหว่าง กก. กับ กระสอบ (50 กก.)">
        <div className="chips">
          {QUICK_FORMULAS.map((f) => <button key={f} type="button" className="chip chip-add num" onClick={() => addChem(f)}>+ {f}</button>)}
          <span className="row" style={{ gap: "0.4rem" }}>
            <input className="inp" style={{ width: "8.5rem", minHeight: 48 }} placeholder="สูตรอื่น N-P-K" value={custom} onChange={(e) => setCustom(e.target.value)} aria-label="สูตรปุ๋ยอื่น" />
            <button type="button" className="btn btn-line" disabled={!/^\d+(\.\d+)?-\d+/.test(custom)} onClick={() => { addChem(custom.trim()); setCustom(""); }}>เพิ่ม</button>
          </span>
        </div>
        {s.chemFerts.map((f, i) => (
          <Item key={f.id} title={<>ครั้งที่ {i + 1}: สูตร <span className="num">{f.formula}</span> <span className="muted small">N {nPctFromFormula(f.formula)}%</span></>}
            onRemove={() => upd((x) => { x.chemFerts = x.chemFerts.filter((y) => y.id !== f.id); x.chemFerts.forEach((y, j) => { y.round = j + 1; }); })}>
            <Num label="ปริมาณที่ใส่" units={SACK} value={f.kgPerRai} onChange={(v) => upd((x) => { const r = x.chemFerts.find((y) => y.id === f.id); if (r) r.kgPerRai = v; })} />
          </Item>
        ))}
        {s.chemFerts.length > 0 && <p className="muted small" style={{ marginTop: "0.5rem" }}>รวมไนโตรเจนจากปุ๋ยเคมี {fmt1(totalN)} กก.N/ไร่</p>}
      </Q>
      <Q title="ปุ๋ยอินทรีย์ ปุ๋ยคอก ปุ๋ยหมัก">
        <div className="chips">
          {COMMON_ORG.map((k) => (
            <button key={k} type="button" className="chip chip-add" onClick={() => addOrg(k)}>+ {ORGANIC_FERTS[k].label}</button>
          ))}
          <select className="inp" style={{ width: "auto", minHeight: 48 }} aria-label="ปุ๋ยอินทรีย์ชนิดอื่น" value=""
            onChange={(e) => { if (e.target.value) addOrg(e.target.value); }}>
            <option value="">+ ชนิดอื่น…</option>
            {Object.entries(ORGANIC_FERTS).filter(([k]) => !COMMON_ORG.includes(k)).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
        {s.orgFerts.map((o) => (
          <Item key={o.id} title={ORGANIC_FERTS[o.type]?.label ?? o.type} onRemove={() => upd((x) => { x.orgFerts = x.orgFerts.filter((y) => y.id !== o.id); })}>
            <Num label="ปริมาณ" units={SACK} value={o.kgPerRai} onChange={(v) => upd((x) => { const r = x.orgFerts.find((y) => y.id === o.id); if (r) r.kgPerRai = v; })} />
            <Num label="ไนโตรเจน" unit="%" value={o.nPct} onChange={(v) => upd((x) => { const r = x.orgFerts.find((y) => y.id === o.id); if (r) r.nPct = v; })} />
          </Item>
        ))}
      </Q>
      <Q title={care ? "เครื่องจักรที่ใช้ดูแลแปลง" : "ใช้เครื่องหว่านปุ๋ยหรือพ่นสารไหม"}>
        <Machines s={s} upd={upd} stage="ใส่ปุ๋ย/ฉีดพ่น/ดูแล" />
      </Q>
      {care && (
        <Q title="ใส่ปูนปรับสภาพดินไหม">
          <div className="grid2">
            <Num label="ปูนขาว / ปูนมาร์ล" units={SACK} value={s.limestoneKgPerRai} onChange={(v) => upd((x) => { x.limestoneKgPerRai = v; })} />
            <Num label="โดโลไมต์" units={SACK} value={s.dolomiteKgPerRai} onChange={(v) => upd((x) => { x.dolomiteKgPerRai = v; })} />
          </div>
        </Q>
      )}
    </>
  );
}

/* ====================== ขั้นที่ 5: เก็บเกี่ยวและเศษวัสดุ ====================== */
type ResMode = "keep" | "remove" | "burnAll" | "burnSome";
function resMode(s: Scenario): ResMode {
  const b = s.residue.burnedAreaRai;
  if (b > 0 && b >= s.areaRai) return "burnAll";
  if (b > 0) return "burnSome";
  if (s.residue.removedPct > 0) return "remove";
  return "keep";
}

export function HarvestStep({ s, upd, crop }: { s: Scenario; upd: UpdS; crop: CropGroup }) {
  const isTree = crop === "fruit" || crop === "forest";
  const mode = resMode(s);
  const res = RESIDUES[s.residue.type] ?? RESIDUES.other;
  const [ship, setShip] = useState(s.transports.length > 0);
  return (
    <>
      {!isTree && (
        <Q title="เก็บเกี่ยวด้วยเครื่องจักรไหม" help="ถ้าใช้แรงงานคน ข้ามได้">
          <Machines s={s} upd={upd} stage="เก็บเกี่ยว" />
        </Q>
      )}
      <Q title={isTree ? "เศษกิ่งและใบที่ตัดแต่ง จัดการอย่างไร" : crop === "rice" ? "ฟางและตอซัง จัดการอย่างไร" : "เศษพืชหลังเก็บเกี่ยว จัดการอย่างไร"}>
        <Choice boxy label="การจัดการเศษวัสดุ" value={mode} onChange={(m) => upd((x) => {
          if (!x.residue.kgPerRai) x.residue.kgPerRai = (RESIDUES[x.residue.type] ?? RESIDUES.other).defaultKgPerRai;
          if (m === "keep") { x.residue.removedPct = 0; x.residue.burnedAreaRai = 0; }
          if (m === "remove") { x.residue.burnedAreaRai = 0; if (!x.residue.removedPct) x.residue.removedPct = 70; }
          if (m === "burnAll") { x.residue.burnedAreaRai = x.areaRai; }
          if (m === "burnSome") { x.residue.burnedAreaRai = Math.round((x.areaRai / 2) * 10) / 10 || 1; }
        })} options={[
          { key: "keep", label: "ไถกลบ / ทิ้งไว้ในแปลง", sub: "ไม่เผา" },
          { key: "remove", label: crop === "rice" ? "อัดฟางนำออกไป" : "อัดก้อน / นำออกไปใช้", sub: "ขายหรือใช้ประโยชน์" },
          { key: "burnAll", label: "เผาทั้งแปลง", sub: "" },
          { key: "burnSome", label: "เผาบางส่วน", sub: "" },
        ]} />
        <div className="grid2" style={{ marginTop: "1rem" }}>
          {!isTree && crop !== "rice" && (
            <Select label="ชนิดเศษพืช" value={s.residue.type} options={Object.entries(RESIDUES).map(([k, v]) => [k, v.label])}
              onChange={(v) => upd((x) => { x.residue.type = v; x.residue.kgPerRai = RESIDUES[v].defaultKgPerRai; })} />
          )}
          <Num label="ปริมาณเศษพืชทั้งหมด (แห้ง)" unit="กก./ไร่" value={s.residue.kgPerRai} onChange={(v) => upd((x) => { x.residue.kgPerRai = v; })}
            hint={res.defaultKgPerRai ? `ค่าอ้างอิง ${res.defaultKgPerRai.toLocaleString()} กก./ไร่ (${res.note}) ใช้ค่าวัดจริงได้` : "ใส่ค่าที่ชั่งหรือประเมินในแปลง"} />
          {mode === "remove" && <Num label="สัดส่วนที่นำออก" unit="%" value={s.residue.removedPct} onChange={(v) => upd((x) => { x.residue.removedPct = Math.min(100, v); })} />}
          {mode === "burnSome" && <Num label="พื้นที่ที่เผา" unit="ไร่" value={s.residue.burnedAreaRai} onChange={(v) => upd((x) => { x.residue.burnedAreaRai = Math.min(v, x.areaRai); })} />}
        </div>
      </Q>
      {mode === "remove" && (
        <Q title="ใช้เครื่องจักรอัดก้อนหรือกวาดไหม">
          <Machines s={s} upd={upd} stage="จัดการเศษวัสดุ" />
        </Q>
      )}
      <Q title="ขนส่งเศษพืชหรือผลผลิตออกจากแปลงไหม" help="คิดจากน้ำมันที่รถขนส่งใช้">
        <Choice label="มีการขนส่ง" value={ship ? "y" : "n"} onChange={(v) => {
          setShip(v === "y");
          if (v === "n") upd((x) => { x.transports = []; });
          else if (!s.transports.length) upd((x) => { x.transports.push({ id: uid(), desc: "", fuel: "diesel", amount: 0 }); });
        }} options={[{ key: "n", label: "ไม่มี" }, { key: "y", label: "มี" }]} />
        {ship && s.transports.map((t) => (
          <Item key={t.id} title="การขนส่ง" onRemove={() => upd((x) => { x.transports = x.transports.filter((y) => y.id !== t.id); })}>
            <Text label="ขนอะไร ไปไหน" placeholder="เช่น ฟางอัดก้อนไปโรงไฟฟ้า" value={t.desc} onChange={(v) => upd((x) => { const r = x.transports.find((y) => y.id === t.id); if (r) r.desc = v; })} />
            <Select<TransportKey> label="เชื้อเพลิง" value={t.fuel} options={Object.entries(TRANSPORT_FUELS).map(([k, v]) => [k as TransportKey, v.label])}
              onChange={(v) => upd((x) => { const r = x.transports.find((y) => y.id === t.id); if (r) r.fuel = v; })} />
            <Num label="ใช้เชื้อเพลิงรวม" unit={TRANSPORT_FUELS[t.fuel].unit === "kg" ? "กก." : "ลิตร"} value={t.amount}
              onChange={(v) => upd((x) => { const r = x.transports.find((y) => y.id === t.id); if (r) r.amount = v; })} />
          </Item>
        ))}
        {ship && <button type="button" className="btn-link" onClick={() => upd((x) => { x.transports.push({ id: uid(), desc: "", fuel: "diesel", amount: 0 }); })}>+ เพิ่มเที่ยวขนส่ง</button>}
      </Q>
    </>
  );
}

/* ====================== ต้นไม้ ====================== */
function TreeRows({ rows, which, upd, eq }: { rows: TreeRow[]; which: "baseline" | "current"; upd: (fn: (t: TreeInventory) => void) => void; eq: string }) {
  const set = (id: string, p: Partial<TreeRow>) => upd((t) => { const r = t[which].find((x) => x.id === id); if (r) Object.assign(r, p); });
  return (
    <div>
      {rows.map((r, i) => {
        const small = !(r.dbh >= 4.5) || !(r.height > 1.3);
        const w = treeBiomass(eq, r.dbh, r.height).wt;
        return (
          <Item key={r.id} title={<>กลุ่มที่ {i + 1} <span className={small && (r.dbh || r.height) ? "small" : "muted small"} style={small && (r.dbh || r.height) ? { color: "var(--ember)" } : undefined}>
            {small ? (r.dbh || r.height ? "เล็กกว่าเกณฑ์ ไม่นับ" : "") : `${fmt1(w)} กก./ต้น`}</span></>}
            onRemove={() => upd((t) => { t[which] = t[which].filter((x) => x.id !== r.id); })}>
            <div className="field"><label>เส้นผ่านศูนย์กลางที่ 1.3 ม.</label><div className="box"><NumInput label="DBH" value={r.dbh} onChange={(v) => set(r.id, { dbh: v })} /><span className="unit">ซม.</span></div></div>
            <div className="field"><label>ความสูง</label><div className="box"><NumInput label="ความสูง" value={r.height} onChange={(v) => set(r.id, { height: v })} /><span className="unit">ม.</span></div></div>
            <div className="field"><label>จำนวนต้นขนาดนี้</label><div className="box"><NumInput label="จำนวนต้น" value={r.count} onChange={(v) => set(r.id, { count: Math.round(v) })} /><span className="unit">ต้น</span></div></div>
          </Item>
        );
      })}
      <button type="button" className="btn btn-line" style={{ marginTop: "0.6rem" }} onClick={() => upd((t) => { t[which].push({ id: uid(), dbh: 0, height: 0, count: 1 }); })}>+ เพิ่มกลุ่มต้นไม้</button>
    </div>
  );
}

export function TreeStep({ t, upd }: { t: TreeInventory; upd: (fn: (t: TreeInventory) => void) => void }) {
  const [hasOld, setHasOld] = useState(t.baseline.length > 0);
  return (
    <>
      <Q title="ประเมินต้นไม้ด้วยวิธีไหน">
        <Choice boxy label="วิธีประเมิน" value={t.method} onChange={(v) => upd((x) => { x.method = v; })} options={[
          { key: "allometric", label: "วัดขนาดต้นไม้", sub: "แม่นยำ ใช้ได้ทุกขนาดโครงการ" },
          { key: "count", label: "นับจำนวนต้น", sub: "9.5 kgCO₂/ต้น/ปี แปลงย่อย ≤ 30 ไร่" },
        ]} />
      </Q>
      {t.method === "count" ? (
        <Q title="จำนวนต้นและระยะเวลา">
          <div className="grid2">
            <Num label="ต้นไม้ที่ปลูกและยังมีชีวิต" unit="ต้น" value={t.treeCount} onChange={(v) => upd((x) => { x.treeCount = Math.round(v); })} />
            <Num label="ปลูกมาแล้ว / ช่วงที่ขอคิด" unit="ปี" value={t.years} onChange={(v) => upd((x) => { x.years = v; })} />
          </div>
        </Q>
      ) : (
        <>
          <Q title="แปลงที่วัด" help="แปลงมาตรฐาน 40 × 40 ม. = 1 ไร่ ถ้าวัดทุกต้นในแปลง ให้ใส่พื้นที่ทั้งแปลง">
            <div className="grid2">
              <Num label="พื้นที่แปลงที่วัด" unit="ไร่" value={t.plotAreaRai} onChange={(v) => upd((x) => { x.plotAreaRai = v; })} />
              <Num label="ห่างจากปีฐานกี่ปี" unit="ปี" value={t.years} onChange={(v) => upd((x) => { x.years = v; })} />
            </div>
          </Q>
          <Q title="ต้นไม้ที่วัดได้ปีนี้" help="จัดกลุ่มต้นที่ขนาดใกล้เคียงกัน นับเฉพาะต้นที่โตกว่า 4.5 ซม. และสูงเกิน 1.3 ม.">
            <TreeRows rows={t.current} which="current" upd={upd} eq={t.equation} />
          </Q>
          <Q title="ในปีฐาน มีต้นไม้อยู่ในแปลงแล้วไหม" help="ถ้าเป็นการปลูกใหม่บนพื้นที่โล่ง เลือก “ไม่มี”">
            <Choice label="มีต้นไม้ในปีฐาน" value={hasOld ? "y" : "n"} onChange={(v) => { setHasOld(v === "y"); if (v === "n") upd((x) => { x.baseline = []; }); }}
              options={[{ key: "n", label: "ไม่มี ปลูกใหม่" }, { key: "y", label: "มี" }]} />
            {hasOld && <div style={{ marginTop: "0.5rem" }}><TreeRows rows={t.baseline} which="baseline" upd={upd} eq={t.equation} /></div>}
          </Q>
          <details className="more">
            <summary>ตั้งค่าสมการ (สำหรับผู้เชี่ยวชาญ)</summary>
            <div className="grid2" style={{ marginTop: "0.75rem" }}>
              <Select label="สมการแอลโลเมตรี" value={t.equation} options={Object.entries(ALLOMETRIC).map(([k, v]) => [k, `${v.label} (${v.source})`])} onChange={(v) => upd((x) => { x.equation = v; })} />
              <Select<RootKey> label="สัดส่วนราก/ลำต้น" value={t.rootRatio} options={Object.entries(ROOT_RATIOS).map(([k, v]) => [k as RootKey, `${v.label}: ${v.value}`])} onChange={(v) => upd((x) => { x.rootRatio = v; })} />
              <Num label="สัดส่วนคาร์บอน (CF)" value={t.carbonFraction} onChange={(v) => upd((x) => { x.carbonFraction = v; })} hint="ค่าเริ่มต้น IPCC 0.47" />
            </div>
          </details>
        </>
      )}
    </>
  );
}

export const SF_TEXT = { SF_W, SF_P };
