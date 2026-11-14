import type { Evaluation } from "./engine/evaluate";
import { CFOA, FUELS, MACHINES, ORGANIC_FERTS, RESIDUES, SF_P, SF_W, TRANSPORT_FUELS } from "./engine/factors";
import { elecEF, gwp, transportLiters } from "./engine/calc";
import { RICE_PLANT_METHODS, VEHICLES } from "./machines";
import { CROP_GROUPS, type FieldRecord, type Scenario, type ScenarioResult, type Settings } from "./engine/types";
import { assess, LEVEL_RULE, LEVEL_TEXT, levelSentence, ratioText } from "./benchmark";
import { EVENT_TEXT, type Profile, type UsageEvent } from "./profile";
import { buildXlsx, downloadBytes, type Cell, type RowStyle, type Sheet } from "./xlsx";

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const r2 = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d;
const pct = (v: number, total: number) => (total > 0 ? r2((v / total) * 100, 1) : 0);
const thDate = (iso: string) => new Date(iso).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" });

class SheetBuilder {
  rows: Sheet["rows"] = [];
  constructor(public name: string, public widths: number[]) {}
  add(cells: Cell[], style?: RowStyle) { this.rows.push({ cells, style }); return this; }
  gap() { return this.add([]); }
  done(): Sheet { return { name: this.name, widths: this.widths, rows: this.rows }; }
}

function activityRows(s: Scenario, rice: boolean): Cell[][] {
  const rows: Cell[][] = [["พื้นที่ (ไร่)", s.areaRai], ["ผลผลิต (กก./ไร่)", s.yieldKgPerRai]];
  if (rice) {
    rows.push(["พื้นที่เก็บเกี่ยว (ไร่)", s.rice.harvestedAreaRai], ["อายุเก็บเกี่ยว (วัน)", s.rice.days],
      ["การจัดการน้ำระหว่างปลูก", SF_W[s.rice.waterRegime]?.label], ["การจัดการน้ำก่อนปลูก", SF_P[s.rice.preSeason]?.label]);
    s.rice.organics.forEach((o) => rows.push([`อินทรียวัตถุลงนา: ${CFOA[o.type]?.label} (กก./ไร่)`, o.kgPerRai]));
  }
  s.chemFerts.forEach((f, i) => rows.push([`ปุ๋ยเคมีครั้งที่ ${i + 1} สูตร ${f.formula} (กก./ไร่)`, f.kgPerRai]));
  s.orgFerts.forEach((o) => rows.push([`${ORGANIC_FERTS[o.type]?.label ?? o.type} N ${o.nPct}% (กก./ไร่)`, o.kgPerRai]));
  if (s.limestoneKgPerRai) rows.push(["ปูนขาว (กก./ไร่)", s.limestoneKgPerRai]);
  if (s.dolomiteKgPerRai) rows.push(["โดโลไมต์ (กก./ไร่)", s.dolomiteKgPerRai]);
  rows.push([`เศษพืช: ${RESIDUES[s.residue.type]?.label ?? ""} (กก./ไร่)`, s.residue.kgPerRai], ["นำออกจากแปลง (%)", s.residue.removedPct], ["พื้นที่เผา (ไร่)", s.residue.burnedAreaRai]);
  s.machines.forEach((m) => rows.push([
    `${m.stage}: ${m.label ?? MACHINES[m.machine]?.label}${m.hp ? ` ${m.hp} แรงม้า` : ""} (${m.fuel === "electric" ? "ไฟฟ้า" : FUELS[m.fuel]?.label})`,
    m.fuel === "electric" ? `${m.kwh} kWh` : m.mode === "liters" ? `${m.liters} ลิตร` : `${m.hoursPerRai} ชม./ไร่ × ${m.times} ครั้ง × ${m.lph} ลิตร/ชม.`,
  ]));
  s.transports.forEach((t) => rows.push(t.mode === "distance"
    ? [`ขนส่ง: ${VEHICLES.find((v) => v.id === t.vehicle)?.label ?? "รถ"} ${t.desc || ""}`, `${t.km} กม. × ${t.roundTrip === false ? 1 : 2} × ${t.trips} เที่ยว ÷ ${t.kmPerL} กม./ลิตร = ${r2(transportLiters(t))} ลิตรดีเซล`]
    : [`ขนส่ง: ${t.desc || "-"}`, `${t.amount} (${TRANSPORT_FUELS[t.fuel]?.label})`]));
  if (rice && s.rice.plantMethod) rows.push(["วิธีปลูก", RICE_PLANT_METHODS.find((m) => m.key === s.rice.plantMethod)?.label ?? s.rice.plantMethod]);
  return rows;
}

function linesBlock(b: SheetBuilder, r: ScenarioResult) {
  b.add(["แหล่งปล่อย", "สมการ", "มวลก๊าซ (กก.)", "kgCO2e", "% ของทั้งหมด"], "head");
  r.lines.forEach((l) => b.add([l.label, l.eq, l.mass != null ? r2(l.mass, 4) : null, r2(l.kgCO2e), pct(l.kgCO2e, r.totalKgCO2e)]));
  b.add(["รวม", "", "", r2(r.totalKgCO2e), r.totalKgCO2e > 0 ? 100 : 0], "bold");
  b.add(["ต่อไร่ (kgCO2e)", "", "", r2(r.perRai)]);
  b.add(["ต่อผลผลิต 1 กก. (kgCO2e)", "", "", r.perKgProduct != null ? r2(r.perKgProduct, 4) : "-"]);
  b.add(["ไนโตรเจน FSN / FON / FCR (กก.N)", `${r2(r.nInputs.FSN)} / ${r2(r.nInputs.FON)} / ${r2(r.nInputs.FCR)}`]);
}

export function exportXlsx(items: { rec: FieldRecord; ev: Evaluation }[], settings: Settings, profile: Profile | null, filename: string) {
  const G = gwp(settings);
  const sheets: Sheet[] = [];

  const sum = new SheetBuilder("สรุปทุกแปลง", [24, 20, 14, 14, 16, 12, 10, 10, 16, 16, 16, 16, 16, 14, 16, 20]);
  sum.add(["แปลง", "เกษตรกร", "จังหวัด", "อำเภอ", "ตำบล", "พืช", "มาตรฐาน", "พื้นที่ (ไร่)", "ก่อน/ทั้งแปลง (kgCO2e)", "หลังเข้าร่วม (kgCO2e)",
    "กักเก็บต้นไม้ (kgCO2)", "ลดได้ (kgCO2e)", "เครดิต T-VER (kgCO2e)", "kgCO2e/ไร่", "kgCO2e/กก.ผลผลิต", "เทียบค่าอ้างอิง"], "head");
  for (const { rec, ev } of items) {
    const a = assess(rec, ev, settings);
    sum.add([rec.info.plotName, rec.info.farmer, rec.info.province, rec.info.district, rec.info.subdistrict, rec.cropName,
      rec.standard === "tver" ? "T-VER" : "MRV", rec.baseline.areaRai, r2(ev.baseline.totalKgCO2e), ev.project ? r2(ev.project.totalKgCO2e) : null,
      ev.trees ? r2(ev.trees.removalKgCO2) : null, ev.reductionKgCO2e != null ? r2(ev.reductionKgCO2e) : null, ev.tver ? r2(ev.tver.creditKgCO2e) : null,
      r2(ev.baseline.perRai), ev.baseline.perKgProduct != null ? r2(ev.baseline.perKgProduct, 4) : null,
      a ? `${LEVEL_TEXT[a.level].title} (${ratioText(a.ratio)} ${a.ref})` : "-"]);
  }
  sheets.push(sum.done());

  items.forEach(({ rec, ev }, i) => {
    const b = new SheetBuilder(`${i + 1} ${rec.info.plotName || rec.cropName}`, [46, 30, 16, 14, 14]);
    b.add([`${rec.info.plotName || "แปลง"} — ${CROP_GROUPS[rec.crop].label} (${rec.cropName})`], "title");
    b.add(["เกษตรกร", rec.info.farmer]);
    b.add(["ที่ตั้ง", [rec.info.subdistrict && `ต.${rec.info.subdistrict}`, rec.info.district && `อ.${rec.info.district}`, rec.info.province && `จ.${rec.info.province}`].filter(Boolean).join(" ")]);
    b.add(["พิกัด", rec.info.lat ? `${rec.info.lat}, ${rec.info.lng}` : "-"]);
    b.add(["ฤดูกาล", rec.info.season]);
    b.add(["ผู้บันทึก", rec.createdBy ? `${rec.createdBy.name} (${rec.createdBy.agency})` : rec.info.officer]);
    b.add(["มาตรฐาน", rec.standard === "tver" ? "T-VER" : "MRV (IPCC 2006/2019 Tier 1)"]);
    b.add(["GWP", `${settings.gwp}: CH4 ${G.CH4}, N2O ${G.N2O}`]);
    b.add(["EF ไฟฟ้า (kgCO2e/kWh)", elecEF(settings)]);
    const a = assess(rec, ev, settings);
    if (a) {
      b.add(["เทียบค่าอ้างอิง", `${LEVEL_TEXT[a.level].title} (เกณฑ์: ${LEVEL_RULE[a.level]})`], "bold");
      b.add(["", levelSentence(a)]);
      b.add(["ที่มาค่าอ้างอิง", a.source]);
    }
    b.gap();
    const scen: [string, Scenario, ScenarioResult][] = [[ev.project ? "ก่อนเข้าร่วมโครงการ" : "ข้อมูลกิจกรรม", rec.baseline, ev.baseline]];
    if (ev.project) scen.push(["หลังเข้าร่วมโครงการ", rec.project, ev.project]);
    for (const [label, s, r] of scen) {
      b.add([`ข้อมูลกิจกรรม — ${label}`], "title");
      activityRows(s, rec.crop === "rice").forEach((row) => b.add(row));
      b.gap();
      b.add([`ผลการคำนวณ — ${label}`], "title");
      linesBlock(b, r);
      b.gap();
    }
    if (ev.trees) {
      b.add(["การกักเก็บคาร์บอนของต้นไม้"], "title");
      if (ev.trees.method === "count") b.add([`นับต้น ${rec.trees.treeCount} ต้น × 9.5 × ${rec.trees.years} ปี (kgCO2)`, "", "", r2(ev.trees.removalKgCO2)]);
      else {
        b.add(["กลุ่มต้นไม้", "DBH (ซม.)", "สูง (ม.)", "จำนวน"], "head");
        rec.trees.baseline.forEach((t) => b.add(["ปีฐาน", t.dbh, t.height, t.count]));
        rec.trees.current.forEach((t) => b.add(["ปีที่วัด", t.dbh, t.height, t.count]));
        b.add(["CO2 ปีฐาน (กก.)", "", "", r2(ev.trees.baseline?.co2Kg ?? 0)]);
        b.add(["CO2 ปีที่วัด (กก.)", "", "", r2(ev.trees.current?.co2Kg ?? 0)]);
        b.add(["กักเก็บเพิ่มขึ้น (กก.CO2)", "", "", r2(ev.trees.removalKgCO2)], "bold");
      }
      b.gap();
    }
    if (ev.tver) {
      b.add([`T-VER ${ev.tver.method}`], "title");
      ev.tver.steps.forEach((s) => b.add([s.label, "", "", r2(s.value)]));
      b.add(["เครดิตที่ขอรับรองได้ (kgCO2e)", "", "", r2(ev.tver.creditKgCO2e)], "bold");
      ev.tver.checks.forEach((c) => b.add([`${c.ok ? "ผ่าน" : "ไม่ผ่าน"}: ${c.text}`]));
    }
    sheets.push(b.done());
  });

  if (profile) sheets.push(profileSheet(profile));
  downloadBytes(buildXlsx(sheets), filename, XLSX_MIME);
}

function profileSheet(p: Profile): Sheet {
  const b = new SheetBuilder("ผู้บันทึก", [22, 40]);
  b.add(["ข้อมูลผู้บันทึก"], "title");
  ([["ชื่อ-สกุล", p.name], ["ตำแหน่ง", p.position], ["หน่วยงาน", p.agency], ["จังหวัดที่ปฏิบัติงาน", p.province], ["โทรศัพท์", p.phone], ["อีเมล", p.email],
    ["ลงทะเบียนเมื่อ", thDate(p.createdAt)], ["ยินยอมให้เก็บข้อมูลเมื่อ", thDate(p.consentAt)], ["รหัสผู้ใช้", p.id]] as [string, string][]).forEach((r) => b.add(r));
  return b.done();
}

/** ส่งออกข้อมูลผู้ใช้งานและประวัติการใช้งาน */
export function exportUsage(profile: Profile | null, log: UsageEvent[], filename: string) {
  const b = new SheetBuilder("ประวัติการใช้งาน", [22, 22, 26, 60]);
  b.add(["วันเวลา", "กิจกรรม", "ผู้ใช้", "รายละเอียด"], "head");
  for (const e of [...log].reverse()) {
    b.add([thDate(e.at), EVENT_TEXT[e.type] ?? e.type, profile?.name ?? "", e.detail ? Object.entries(e.detail).map(([k, v]) => `${k}: ${v}`).join(", ") : ""]);
  }
  const sheets = [b.done()];
  if (profile) sheets.unshift(profileSheet(profile));
  downloadBytes(buildXlsx(sheets), filename, XLSX_MIME);
}
