import { calcScenario, elecEF, gwp, lineValue, sumLines, directEF } from "./calc";
import {
  BIOCHAR_FPERM, BURN, COMF_PERENNIAL, DEADWOOD, EF_C_RICE, EF_DOLOMITE, EF_LIMESTONE, EF_UREA, FUEL_NCV, MAI_PER_TREE, N2O, ROOT_RATIOS,
  SOC_FI, SOC_FLU, SOC_FMG, TVER,
} from "./factors";
import { calcBiochar, calcSoil, socRefPerRai, type BiocharResult, type SoilResult } from "./soil";
import { calcTrees, eqOf, rootRatio, type TreeResult } from "./trees";
import type { FieldRecord, ScenarioResult, Settings, TverOptions } from "./types";

export interface Check {
  ok: boolean;
  text: string;
}

/** 1 แถวในตารางพารามิเตอร์สำหรับบันทึกตามมาตรฐาน (PDD / Monitoring Report) */
export interface TverParam {
  sym: string;
  desc: string;
  unit: string;
  bl: string | number | null;
  pj: string | number | null;
  source: string;
  monitored: boolean; // true = พารามิเตอร์ที่ต้องติดตามผล
}

export interface TverResult {
  method: string;
  title: string;
  equation: string;
  steps: { label: string; value: number }[];
  creditKgCO2e: number;
  periodYears: number;
  perYearKgCO2e: number;
  ud: number;
  checks: Check[];
  notes: string[];
  params: TverParam[];
}

export interface Evaluation {
  baseline: ScenarioResult;
  project: ScenarioResult | null;
  trees: TreeResult | null;
  soil: SoilResult | null;
  /** MRV: ปริมาณที่ลดได้ = BE − PE (+ การกักเก็บของต้นไม้) */
  reductionKgCO2e: number | null;
  /** T-VER: ปริมาณที่ขอรับรองได้หลังหักตามระเบียบวิธี */
  tver: TverResult | null;
  /** ระเบียบวิธีเสริมที่คิดแยก (เช่น ถ่านชีวภาพ P-METH-14-03) */
  extras: TverResult[];
}

export const DEFAULT_TVER_OPT: TverOptions = { track: "standard", ud: TVER.UD_DEFAULT, outsideOrgC: 0, landRight: false, history3y: false };
export const tverOpt = (rec: FieldRecord): TverOptions => ({ ...DEFAULT_TVER_OPT, ...(rec.tverOpt ?? {}) });

/** ระเบียบวิธีที่ใช้ตามชนิดพืชและประเภทโครงการ */
export function methodFor(rec: FieldRecord): { code: string; title: string } {
  const t = tverOpt(rec).track;
  switch (rec.crop) {
    case "rice": return { code: "T-VER-P-METH-13-08", title: "การจัดการพื้นที่ปลูกข้าวที่ดี (Premium)" };
    case "field":
    case "vegetable":
      return t === "premium"
        ? { code: "T-VER-P-METH-13-06", title: "การจัดการพื้นที่การเกษตรที่ดี (Premium)" }
        : { code: "T-VER-S-METH-13-05", title: "การใช้ปุ๋ยอย่างถูกวิธีในพื้นที่เกษตร (Standard)" };
    case "fruit":
      return t === "premium"
        ? { code: "T-VER-P-METH-13-06", title: "การจัดการพื้นที่การเกษตรที่ดี (Premium)" }
        : { code: "T-VER-S-METH-13-06", title: "การกักเก็บคาร์บอนและลดการปล่อยจากการปลูกพืชยืนต้น (Standard)" };
    default: return { code: "T-VER-S-TOOL-01-01 / 01-02 / 01-03", title: "ป่าไม้: การกักเก็บคาร์บอนของต้นไม้ ดิน ไม้ตายและเศษซาก" };
  }
}

const SOIL_N2O = ["n2oDirect", "n2oAtd", "n2oLeach"];
const SOIL_CO2 = ["urea", "lime"];
const FUEL_KEYS = ["fuel", "transport"];
const ENERGY_KEYS = ["fuel", "elec", "transport"];
const FIRE_KEYS = ["fireCH4", "fireN2O"];
const r4 = (n: number) => Math.round(n * 1e4) / 1e4;
const t = (kg: number) => r4(kg / 1000);

export function evaluate(rec: FieldRecord, settings: Settings): Evaluation {
  const bl = calcScenario(rec.baseline, rec.crop, rec.standard, settings);
  const pj = rec.hasProject ? calcScenario(rec.project, rec.crop, rec.standard, settings) : null;
  const isTree = rec.crop === "fruit" || rec.crop === "forest";
  const trees = isTree ? calcTrees(rec.trees, rec.baseline.areaRai) : null;
  const soil = calcSoil(rec.soil, (pj ? rec.project : rec.baseline).areaRai);

  let reduction: number | null = null;
  if (pj) reduction = bl.totalKgCO2e - pj.totalKgCO2e;
  if (trees) reduction = (reduction ?? 0) + trees.removalKgCO2;

  const ev: Evaluation = { baseline: bl, project: pj, trees, soil, reductionKgCO2e: reduction, tver: null, extras: [] };
  if (rec.standard !== "tver") return ev;

  const G = gwp(settings);
  const opt = tverOpt(rec);
  const pjr = pj ?? bl;
  const { code, title } = methodFor(rec);
  const checks: Check[] = [];
  const notes: string[] = [];
  const nDrop = bl.nInputs.FSN > 0 && pj ? 1 - pj.nInputs.FSN / bl.nInputs.FSN : 0;
  const yieldDrop = pj && rec.baseline.yieldKgPerRai > 0 ? 1 - rec.project.yieldKgPerRai / rec.baseline.yieldKgPerRai : null;
  const periodYears = isTree ? Math.max(1, rec.trees.years || 1) : 1;
  const soilKg = soil ? (soil.deltaKgCO2 / soil.years) * periodYears : 0;
  const params = baseParams(rec, bl, pj, settings);

  const common = () => {
    checks.push({ ok: opt.landRight, text: "มีหนังสือแสดงสิทธิการใช้ประโยชน์ที่ดินที่ถูกต้องตามกฎหมาย" });
    checks.push({ ok: opt.history3y, text: "มีข้อมูลกิจกรรมกรณีฐานย้อนหลังอย่างน้อย 3 ปี (หรือข้อมูลอ้างอิงจากหน่วยงาน)" });
    checks.push({ ok: !!(rec.info.lat && rec.info.lng), text: "มีพิกัดแปลง (ใช้ระบุขอบเขต ควรเก็บพิกัดมุมแปลงอย่างน้อย 4 จุด)" });
  };
  const yieldCheck = () => {
    if (yieldDrop != null) checks.push({ ok: yieldDrop <= TVER.MAX_YIELD_DROP, text: `ผลผลิตลดลงไม่เกิน 5% (ลดลง ${(yieldDrop * 100).toFixed(1)}%; 5–15% ต้องมีคำชี้แจง)` });
  };
  const finish = (steps: TverResult["steps"], credit: number, ud: number, equation: string): TverResult => {
    const c = Math.max(0, credit);
    return { method: code, title, equation, steps, creditKgCO2e: c, periodYears, perYearKgCO2e: c / periodYears, ud, checks, notes, params };
  };

  if (rec.crop === "rice") {
    // T-VER-P-METH-13-08: ER = (BE − PE − LE) × (1 − Ud)
    const beCH4 = lineValue(bl, "riceCH4") * TVER.RICE_CONSERVATIVENESS;
    const beSoil = sumLines(bl, [...SOIL_N2O, ...SOIL_CO2]);
    const pjCore = lineValue(pjr, "riceCH4") + sumLines(pjr, [...SOIL_N2O, ...SOIL_CO2]);
    const er0 = beCH4 + beSoil - pjCore;
    const pjFuel = sumLines(pjr, ENERGY_KEYS);
    const pjFire = sumLines(pjr, FIRE_KEYS);
    const fuelIn = er0 > 0 && pjFuel >= TVER.SIGNIFICANCE * er0;
    const fireIn = er0 > 0 && pjFire >= TVER.SIGNIFICANCE * er0;
    const er1 = er0 - (fuelIn ? pjFuel : 0) - (fireIn ? pjFire : 0);
    const ud = opt.ud;
    const waterChanged = pj ? rec.project.rice.waterRegime !== rec.baseline.rice.waterRegime : false;
    checks.push({ ok: waterChanged || nDrop >= TVER.MIN_N_REDUCTION, text: `ปรับปรุงการจัดการน้ำ หรือ ลดปุ๋ยเคมีไนโตรเจน ≥ 5% (ลดลง ${(nDrop * 100).toFixed(1)}%)` });
    checks.push({ ok: !!pj, text: "มีข้อมูลกรณีดำเนินโครงการ" });
    yieldCheck();
    common();
    notes.push("แนวทางการประเมินที่ 3 (ค่าแนะนำ): คูณ CH₄ กรณีฐานด้วย CF 0.89 และหักความไม่แน่นอน Ud 15%");
    notes.push("EF_BL,c = 1.22 kgCH₄/ha/วัน = 0.1952 kgCH₄/ไร่/วัน (IPCC 2019 Table 5.11)");
    notes.push("N₂O คิดจาก FSN + FON ด้วย EF ทางตรง 0.003 (ขังน้ำต่อเนื่อง) / 0.005 (ระบายน้ำ 1 ครั้งหรือหลายครั้ง)");
    notes.push(`เชื้อเพลิง (CO₂ เท่านั้น) และไฟฟ้า${fuelIn ? "ถูกนับ" : "ไม่ถูกนับ"} การเผาชีวมวล${fireIn ? "ถูกนับ" : "ไม่ถูกนับ"} — นับเมื่อมากกว่า 5% ของปริมาณที่ลดได้ (§5.2.5–5.2.6)`);
    notes.push("ไม่พิจารณาการรั่วไหล (LE = 0)");
    params.push(
      { sym: "CF", desc: "ตัวปรับลดค่าการปล่อยกรณีฐาน (Conservativeness factor)", unit: "-", bl: TVER.RICE_CONSERVATIVENESS, pj: null, source: "UNFCCC/FCCC/SBSTA/2015/L.13", monitored: false },
      { sym: "U_d", desc: "ค่าปรับลดจากความไม่แน่นอน", unit: "-", bl: null, pj: ud, source: "แนวทางการประเมินที่ 3 กำหนด 15%", monitored: false },
    );
    ev.tver = finish([
      { label: "BE: CH₄ กรณีฐาน × 0.89", value: beCH4 },
      { label: "BE: N₂O + ยูเรีย + ปูน กรณีฐาน", value: beSoil },
      { label: "PE: CH₄ + N₂O + ยูเรีย + ปูน กรณีโครงการ", value: -pjCore },
      { label: "PE: เชื้อเพลิง/ไฟฟ้า กรณีโครงการ", value: fuelIn ? -pjFuel : 0 },
      { label: "PE: การเผาชีวมวล กรณีโครงการ", value: fireIn ? -pjFire : 0 },
      { label: `หักความไม่แน่นอน U_d ${(ud * 100).toFixed(0)}%`, value: -Math.max(0, er1) * ud },
    ], Math.max(0, er1) * (1 - ud), ud, "ER = (BE − PE − LE) × (1 − U_d)");
  } else if ((rec.crop === "field" || rec.crop === "vegetable" || rec.crop === "fruit") && opt.track === "premium") {
    // T-VER-P-METH-13-06: ΔC = (ΔC_P + GHG − LE) × UF
    const treeKg = trees?.removalKgCO2 ?? 0;
    const dFuel = sumLines(bl, FUEL_KEYS) - sumLines(pjr, FUEL_KEYS);
    const dN2O = sumLines(bl, SOIL_N2O) - sumLines(pjr, SOIL_N2O);
    const dFire = sumLines(bl, FIRE_KEYS) - sumLines(pjr, FIRE_KEYS);
    const le = opt.outsideOrgC * TVER.OM_LEAKAGE * 44 / 12;
    const ud = opt.ud;
    const gross = soilKg + treeKg + dFuel + dN2O + dFire - le;
    const soilPractice = rec.soil?.enabled ?? false;
    checks.push({ ok: soilPractice || nDrop >= TVER.MIN_N_REDUCTION || treeKg > 0, text: "มีกิจกรรมการจัดการที่ดีอย่างน้อย 1 ข้อ: เพิ่มคาร์บอนในดิน/ลดปุ๋ย N/ปรับการจัดการน้ำ" });
    checks.push({ ok: !!pj, text: "มีข้อมูลกรณีดำเนินโครงการ (ปรับปรุงมากกว่า 5% ของค่าเฉลี่ยย้อนหลัง)" });
    yieldCheck();
    common();
    notes.push("ไม่นับ CO₂ จากยูเรียและปูนในระเบียบวิธีนี้ (GHG = ΔCO₂ เชื้อเพลิง + ΔCH₄ + ΔN₂O + การเผา)");
    notes.push("ถ้าเก็บตัวอย่างดินจริง ต้องมีพื้นที่ควบคุมอย่างน้อย 2 แห่ง และวัดลึก ≥ 30 ซม.");
    notes.push(`การรั่วไหลจากวัสดุอินทรีย์ภายนอก = 12% ของคาร์บอนในวัสดุ (${opt.outsideOrgC.toLocaleString()} กก.C)`);
    notes.push("ค่า U_d ตั้งต้น 15% ตามหลักอนุรักษ์ ปรับได้เมื่อมีผลประเมินความไม่แน่นอนจริง");
    params.push(
      { sym: "LE_OM", desc: "คาร์บอนในวัสดุอินทรีย์ปรับปรุงดินจากภายนอก", unit: "กก.C", bl: null, pj: opt.outsideOrgC, source: "บันทึกการซื้อ/ผลวิเคราะห์", monitored: true },
      { sym: "UF", desc: "สัดส่วนการปรับลดจากความไม่แน่นอน (1 − U_d)", unit: "-", bl: null, pj: r4(1 - ud), source: "ผลประเมินความไม่แน่นอน", monitored: false },
    );
    ev.tver = finish([
      { label: "ΔSOC คาร์บอนในดินเพิ่มขึ้น", value: soilKg },
      { label: "ΔC_TREE ต้นไม้กักเก็บเพิ่ม", value: treeKg },
      { label: "ΔCO₂ เชื้อเพลิงที่ลดได้", value: dFuel },
      { label: "ΔN₂O จากปุ๋ยที่ลดได้", value: dN2O },
      { label: "ΔCH₄/N₂O จากการเผาที่ลดได้", value: dFire },
      { label: "LE การรั่วไหล", value: -le },
      { label: `หักความไม่แน่นอน U_d ${(ud * 100).toFixed(0)}%`, value: -Math.max(0, gross) * ud },
    ], Math.max(0, gross) * (1 - ud), ud, "ΔC = (ΔSOC + ΔC_TREE + GHG − LE) × UF");
  } else if (rec.crop === "field" || rec.crop === "vegetable") {
    // T-VER-S-METH-13-05: C_AGR = (C_BS − C_PROJ − C_LEAK) + C_soil
    const be = sumLines(bl, [...SOIL_N2O, ...SOIL_CO2, ...FUEL_KEYS]);
    const pe = sumLines(pjr, [...SOIL_N2O, ...SOIL_CO2, ...FUEL_KEYS]);
    checks.push({ ok: nDrop >= TVER.MIN_N_REDUCTION, text: `ลดการใช้ปุ๋ยเคมีไนโตรเจน ≥ 5% เทียบกรณีฐาน (ลดลง ${(nDrop * 100).toFixed(1)}%)` });
    checks.push({ ok: !!pj, text: "มีข้อมูลกรณีดำเนินโครงการ" });
    common();
    notes.push("N₂O คิดจาก FSN + FON ด้วย EF1 0.010 (ไม่รวมเศษพืช FCR) ไม่พิจารณาการรั่วไหล ไม่หักความไม่แน่นอน");
    notes.push("เชื้อเพลิงคิดเฉพาะ CO₂ = FC × NCV × EF_CO₂; ระเบียบวิธีไม่รวมการใช้ไฟฟ้า");
    notes.push("ต้องเป็นพื้นที่เกษตรมาแล้ว ≥ 5 ปี; C_soil เป็นทางเลือก ใช้ T-VER-S-TOOL-01-02");
    ev.tver = finish([
      { label: "C_BS การปล่อยกรณีฐาน (N₂O ยูเรีย ปูน เชื้อเพลิง)", value: be },
      { label: "C_PROJ การปล่อยกรณีโครงการ", value: -pe },
      { label: "C_soil คาร์บอนในดินเพิ่มขึ้น (ทางเลือก)", value: soilKg },
    ], be - pe + soilKg, 0, "C_AGR = (C_BS − C_PROJ − C_LEAK) + C_soil");
  } else if (rec.crop === "fruit") {
    // T-VER-S-METH-13-06: CPCP = (CPS_t − CPS_i) + (GHG_BS − GHG_proj)
    const treeKg = trees?.removalKgCO2 ?? 0;
    const ghgBs = sumLines(bl, [...SOIL_N2O, ...SOIL_CO2, ...FUEL_KEYS]);
    const ghgPj = sumLines(pjr, [...SOIL_N2O, ...SOIL_CO2, ...FUEL_KEYS, ...FIRE_KEYS]);
    checks.push({ ok: nDrop >= TVER.MIN_N_REDUCTION || !pj, text: `ลดการใช้ปุ๋ยเคมีไนโตรเจน ≥ 5% (ถ้าขอเครดิตจากการลดปุ๋ย; ลดลง ${(nDrop * 100).toFixed(1)}%)` });
    if (trees?.current) checks.push({ ok: trees.current.smallTrees === 0, text: `ต้นไม้ทุกต้นเข้านิยาม (DBH ≥ 4.5 ซม. สูง > 1.3 ม.; ไม่นับ ${trees.current.smallTrees} ต้น)` });
    common();
    notes.push("CPS = (C_TREE + SOC) × 44/12 ตาม T-VER-S-TOOL-01-01 และ 01-02");
    notes.push(`การเผากิ่ง/ใบ: C_Burning = 0.001 × A × B × COMF ${COMF_PERENNIAL} × (EF_CH₄ × GWP + EF_N₂O × GWP)`);
    notes.push("ไม้ป่า/ไม้เศรษฐกิจที่ปลูกเสริมต้องไม่เกิน 50% ของพื้นที่โครงการ");
    ev.tver = finish([
      { label: "CPS_t − CPS_i: ต้นไม้กักเก็บเพิ่ม", value: treeKg },
      { label: "CPS_t − CPS_i: คาร์บอนในดินเพิ่ม (ทางเลือก)", value: soilKg },
      { label: "GHG_BS การปล่อยกรณีฐาน (N₂O ยูเรีย ปูน เชื้อเพลิง)", value: ghgBs },
      { label: "GHG_proj การปล่อยกรณีโครงการ (รวมเผากิ่ง/ใบ)", value: -ghgPj },
    ], treeKg + soilKg + ghgBs - ghgPj, 0, "CPCP = (CPS_t − CPS_i) + (GHG_BS − GHG_proj)");
  } else {
    const treeKg = trees?.removalKgCO2 ?? 0;
    const pe = sumLines(pjr, [...SOIL_N2O, ...SOIL_CO2, ...FUEL_KEYS, ...FIRE_KEYS]);
    if (trees?.current) checks.push({ ok: trees.current.smallTrees === 0, text: `ต้นไม้ทุกต้นเข้านิยาม (ไม่นับ ${trees.current.smallTrees} ต้น)` });
    common();
    notes.push("ระเบียบวิธีป่าไม้ (เช่น การปลูกป่า) มีเงื่อนไขเพิ่มเติม เช่น ความถาวร บัฟเฟอร์ ที่ต้องตรวจสอบกับ อบก. ก่อนยื่นจริง");
    ev.tver = finish([
      { label: "ต้นไม้กักเก็บเพิ่ม (รวมไม้ตาย/เศษซาก ถ้าเลือก)", value: treeKg },
      { label: "คาร์บอนในดินเพิ่ม (ทางเลือก)", value: soilKg },
      { label: "การปล่อยจากกิจกรรมโครงการ", value: -pe },
    ], treeKg + soilKg - pe, 0, "C = ΔC_TREE + ΔSOC − การปล่อยจากโครงการ");
  }

  treeParams(rec, trees, params);
  soilParams(rec, soil, params);
  if (rec.trees.method === "count" && isTree) {
    checks.push({ ok: rec.baseline.areaRai <= 30, text: "นับจำนวนต้น (ทางเลือกที่ 1): แปลงย่อยไม่เกิน 30 ไร่ และรวมทั้งโครงการไม่เกิน 1,000 ไร่" });
  }
  if (soil?.method === "ref") {
    checks.push({ ok: (ev.tver?.perYearKgCO2e ?? 0) <= 1_000_000, text: "คาร์บอนในดินแบบค่าอ้างอิง (ทางเลือกที่ 2) ใช้ได้เฉพาะโครงการขนาดเล็กมาก ≤ 1,000 tCO₂e/ปี" });
    if (soil.capped) notes.push("อัตราสะสมคาร์บอนในดินเกิน 0.128 tC/ไร่/ปี จึงใช้ค่าสูงสุด 0.128 ตามเครื่องมือ");
  }

  const bc = calcBiochar(rec.biochar, G.CH4, elecEF(settings));
  if (bc && rec.biochar) ev.extras.push(biocharResult(rec, bc));
  return ev;
}

/* ======================= ตารางพารามิเตอร์ ======================= */

function baseParams(rec: FieldRecord, bl: ScenarioResult, pj: ScenarioResult | null, settings: Settings): TverParam[] {
  const G = gwp(settings);
  const P: TverParam[] = [];
  const both = (f: (r: ScenarioResult) => number) => [r4(f(bl)), pj ? r4(f(pj)) : null] as const;
  const add = (sym: string, desc: string, unit: string, v: readonly [number | string | null, number | string | null], source: string, monitored = true) =>
    P.push({ sym, desc, unit, bl: v[0], pj: v[1], source, monitored });
  const isRice = rec.crop === "rice";

  add("A", "พื้นที่โครงการ / หน่วยตัวอย่าง", "ไร่", [rec.baseline.areaRai, pj ? rec.project.areaRai : null], "สำรวจพื้นที่ อ้างอิงพิกัด หรือภาพถ่ายดาวเทียม");
  add("พิกัด", "ละติจูด, ลองจิจูด (จุดกลางแปลง)", "องศา", [rec.info.lat && rec.info.lng ? `${rec.info.lat}, ${rec.info.lng}` : "-", null], "GPS — ควรเก็บพิกัดมุมแปลง ≥ 4 จุด");
  add("Y", "ผลผลิต", "กก./ไร่", [rec.baseline.yieldKgPerRai, pj ? rec.project.yieldKgPerRai : null], "บันทึกของเกษตรกร / ใบรับซื้อ");
  if (isRice) {
    add("A_s,i", "พื้นที่เก็บเกี่ยวในฤดูปลูก", "ไร่", both((r) => r.activity.rice?.harvestedRai ?? 0), "บันทึกของเกษตรกร");
    add("t", "ระยะเวลาปลูก (วัน)", "วัน", both((r) => r.activity.rice?.days ?? 0), "บันทึกวันปลูก–เก็บเกี่ยว");
    add("SF_w", "ตัวปรับการจัดการน้ำช่วงฤดูปลูก", "-", both((r) => r.activity.rice?.sfw ?? 0), "IPCC 2019 Table 5.12");
    add("SF_p", "ตัวปรับการจัดการน้ำก่อนฤดูปลูก", "-", both((r) => r.activity.rice?.sfp ?? 0), "IPCC 2019 Table 5.13");
    add("SF_o", "ตัวปรับการใส่วัสดุอินทรีย์", "-", both((r) => r.activity.rice?.sfo ?? 0), "(1 + Σ ROA × 0.00625 × CFOA)^0.59; IPCC 2019 Table 5.14");
    add("EF_BL,c", "ค่าการปล่อย CH₄ ขังน้ำต่อเนื่อง ไม่ใส่อินทรีย์", "กก.CH₄/ไร่/วัน", [TVER.RICE_EF_BL_C_RAI, null], `IPCC 2019 Table 5.11 (${EF_C_RICE} กก./เฮกตาร์/วัน)`, false);
  }
  add("F_SN", "ไนโตรเจนจากปุ๋ยเคมี", "กก.N", both((r) => r.nInputs.FSN), "ใบเสร็จ/บันทึกการใส่ปุ๋ย × %N ตามสูตร");
  add("F_ON", "ไนโตรเจนจากปุ๋ยอินทรีย์", "กก.N", both((r) => r.nInputs.FON), "บันทึกการใส่ปุ๋ย × %N (ผลวิเคราะห์หรือค่าอ้างอิง)");
  add("M_Urea", "ปุ๋ยยูเรียที่ใช้", "ตัน", both((r) => r.activity.ureaKg / 1000), "ใบเสร็จ/บันทึกของเกษตรกร");
  add("M_Limestone", "หินปูน/ปูนขาวที่ใช้", "ตัน", both((r) => r.activity.limestoneKg / 1000), "ใบเสร็จ/บันทึกของเกษตรกร");
  add("M_Dolomite", "โดโลไมต์ที่ใช้", "ตัน", both((r) => r.activity.dolomiteKg / 1000), "ใบเสร็จ/บันทึกของเกษตรกร");
  add("FC_diesel", "น้ำมันดีเซลที่ใช้ (เครื่องจักร + ขนส่ง)", "ลิตร", both((r) => r.activity.dieselL), "ใบเสร็จ/สมุดบันทึกการเติมน้ำมัน");
  add("FC_gasoline", "น้ำมันเบนซินที่ใช้", "ลิตร", both((r) => r.activity.gasolineL), "ใบเสร็จ/สมุดบันทึกการเติมน้ำมัน");
  add("EC", "ไฟฟ้าที่ใช้", "MWh", both((r) => r.activity.kwh / 1000), "มิเตอร์ kWh หรือพิกัดกำลัง × ชั่วโมง");
  add("A_burn", "พื้นที่ที่เผาชีวมวล", "ไร่", both((r) => r.activity.burnedRai), "บันทึกของเกษตรกร");
  add("MB", "มวลชีวภาพแห้งที่ถูกเผา", "ตัน", both((r) => r.activity.burnedDmKg / 1000), "เก็บตัวอย่าง หรือสัดส่วนเศษวัสดุต่อผลผลิต");

  const ef1 = directEF(rec.crop, rec.baseline, "tver").ef;
  const ef1p = pj ? directEF(rec.crop, rec.project, "tver").ef : null;
  add("EF_N2O,Direct", "ค่าการปล่อย N₂O ทางตรง", "กก.N₂O-N/กก.N", [ef1, ef1p], "IPCC 2019 Table 11.1", false);
  add("Frac_GASF / Frac_GASM", "สัดส่วน N ระเหย (ปุ๋ยเคมี / อินทรีย์)", "-", [`${N2O.FRAC_GASF} / ${N2O.FRAC_GASM}`, null], "IPCC 2019 Table 11.3", false);
  add("EF_ATD", "ค่าการปล่อย N₂O จากการตกสะสม", "กก.N₂O-N/กก.N", [N2O.EF4, null], "IPCC 2019 Table 11.3", false);
  add("Frac_LEACH / EF_LEACH", "สัดส่วนการชะล้าง / ค่าการปล่อย", "-", [`${N2O.FRAC_LEACH} / ${N2O.EF5}`, null], "IPCC 2019 Table 11.3", false);
  add("EF_Urea / EF_Limestone / EF_Dolomite", "ค่าการปล่อยจากยูเรีย หินปูน โดโลไมต์", "tC/t", [`${EF_UREA} / ${EF_LIMESTONE} / ${EF_DOLOMITE}`, null], "IPCC 2006 Vol.4 Ch.11", false);
  add("NCV_diesel / NCV_gasoline", "ค่าความร้อนสุทธิ", "MJ/ลิตร", [`${FUEL_NCV.diesel.ncv} / ${FUEL_NCV.gasoline.ncv}`, null], "รายงานสถิติพลังงานของประเทศไทย พพ.", false);
  add("EF_CO2", "ค่าการปล่อย CO₂ ของเชื้อเพลิง (ดีเซล / เบนซิน)", "kgCO₂/TJ", [`${FUEL_NCV.diesel.efCO2} / ${FUEL_NCV.gasoline.efCO2}`, null], "IPCC 2006 Vol.2 Table 1.4", false);
  add("EF_Elec", "ค่าการปล่อยจากไฟฟ้า", "tCO₂/MWh", [elecEF(settings), null], "อบก. (ค่าการปล่อยไฟฟ้าโครงข่าย)", false);
  const tree = rec.crop === "fruit" || rec.crop === "forest";
  add("C_f / COMF", "สัดส่วนการเผาไหม้", "-", [tree ? COMF_PERENNIAL : BURN.CF, null], tree ? "13-06 ค่าแนะนำ (IPCC 2019 Table 2.6)" : "IPCC 2019 Table 2.6", false);
  add("EF_CH4 / EF_N2O (เผา)", "ค่าการปล่อยจากการเผาวัสดุเหลือทิ้งการเกษตร", "g/kg แห้ง", [`${BURN.EF_CH4} / ${BURN.EF_N2O}`, null], "IPCC 2019 Table 2.5", false);
  add("GWP CH₄ / N₂O", "ศักยภาพทำให้โลกร้อน", "-", [`${G.CH4} / ${G.N2O}`, null], `IPCC ${settings.gwp} ตามที่ อบก. กำหนด`, false);
  return P;
}

function treeParams(rec: FieldRecord, trees: TreeResult | null, P: TverParam[]) {
  if (!trees) return;
  const inv = rec.trees;
  if (trees.method === "count") {
    P.push(
      { sym: "T", desc: "จำนวนต้นไม้ที่สูงเกิน 1.30 ม. ในพื้นที่โครงการ", unit: "ต้น", bl: null, pj: inv.treeCount, source: "สำรวจและติดหมายเลขทุกต้น", monitored: true },
      { sym: "t", desc: "ปีที่ดำเนินการติดตามผล", unit: "ปี", bl: null, pj: inv.years, source: "ช่วงขอการรับรอง", monitored: true },
      { sym: "MAI", desc: "อัตราการเพิ่มพูนการกักเก็บคาร์บอน", unit: "kgCO₂/ต้น/ปี", bl: MAI_PER_TREE, pj: null, source: "T-VER-S-TOOL-01-01 §5.1", monitored: false },
    );
    return;
  }
  const e = eqOf(inv.equation);
  const n = (rows: typeof inv.current) => rows.reduce((s, x) => s + (x.count || 0), 0);
  P.push(
    { sym: "a_p", desc: "พื้นที่แปลงตัวอย่าง", unit: "ไร่", bl: inv.plotAreaRai, pj: inv.plotAreaRai, source: "วางแปลง 40 × 40 ม. (1 ไร่) หรือวัดทั้งแปลง", monitored: true },
    { sym: "D, H", desc: `ขนาดต้นไม้ที่วัด (${e.d === "d0" ? "D0 ชิดดิน" : e.d === "none" ? "ความสูง" : "DBH ที่ 1.30 ม."}) — จำนวนต้นในแปลงตัวอย่าง`, unit: "ต้น", bl: n(inv.baseline), pj: n(inv.current), source: "ตรวจวัดในแปลงตัวอย่าง", monitored: true },
    { sym: "สมการ", desc: e.label, unit: "-", bl: e.source, pj: null, source: "T-VER-S-TOOL-01-01 ภาคผนวกที่ 2", monitored: false },
    { sym: "R", desc: inv.transplanted ? "สัดส่วนราก/ต้น (ไม้ขุดล้อม: bBLG = 0)" : "สัดส่วนน้ำหนักแห้งราก/ต้น", unit: "-", bl: rootRatio(inv), pj: null, source: inv.transplanted ? "TOOL-01-01 ขั้นตอนที่ 3" : ROOT_RATIOS[inv.rootRatio]?.label ?? "", monitored: false },
    { sym: "CF", desc: "สัดส่วนคาร์บอนในเนื้อไม้", unit: "tC/t แห้ง", bl: inv.carbonFraction, pj: null, source: "TOOL-01-01 §5.1", monitored: false },
    { sym: "C_TREE", desc: "คาร์บอนของต้นไม้ในพื้นที่โครงการ", unit: "tC", bl: t(trees.baseline?.carbonKg ?? 0), pj: t(trees.current?.carbonKg ?? 0), source: "คำนวณ", monitored: true },
  );
  const dw = DEADWOOD[inv.deadwood ?? "none"];
  if (dw && (dw.dw || dw.li)) {
    P.push({ sym: "DF_DW / DF_LI", desc: `ไม้ตาย / เศษซากพืช (${dw.label})`, unit: "-", bl: `${dw.dw} / ${dw.li}`, pj: null, source: "T-VER-S-TOOL-01-03 (AR-TOOL12)", monitored: false });
  }
}

function soilParams(rec: FieldRecord, soil: SoilResult | null, P: TverParam[]) {
  if (!soil || !rec.soil) return;
  const s = rec.soil;
  if (soil.method === "sample") {
    const avg = (rows: typeof s.baseline, k: "socPct" | "bd" | "depthCm") => {
      const ok = rows.filter((x) => x[k] > 0);
      return ok.length ? r4(ok.reduce((a, x) => a + x[k], 0) / ok.length) : null;
    };
    P.push(
      { sym: "N_i", desc: "จำนวนจุดเก็บตัวอย่างดิน", unit: "จุด", bl: s.baseline.length, pj: s.current.length, source: "แผนการเก็บตัวอย่าง", monitored: true },
      { sym: "SOC_sample", desc: "คาร์บอนอินทรีย์ในดิน (เฉลี่ย)", unit: "g C/100 g ดิน", bl: avg(s.baseline, "socPct"), pj: avg(s.current, "socPct"), source: "ผลวิเคราะห์ห้องปฏิบัติการ", monitored: true },
      { sym: "BD_sample", desc: "ความหนาแน่นรวมของดิน (เฉลี่ย)", unit: "g/cm³", bl: avg(s.baseline, "bd"), pj: avg(s.current, "bd"), source: "ผลวิเคราะห์ห้องปฏิบัติการ", monitored: true },
      { sym: "Dep_sample", desc: "ความลึกที่เก็บตัวอย่าง (≥ 30 ซม.)", unit: "ซม.", bl: avg(s.baseline, "depthCm"), pj: avg(s.current, "depthCm"), source: "บันทึกการเก็บตัวอย่าง", monitored: true },
    );
  } else {
    P.push(
      { sym: "SOC_ref", desc: "คาร์บอนในดินอ้างอิง (สภาพธรรมชาติ)", unit: "tC/ไร่", bl: r4(socRefPerRai(s)), pj: null, source: "IPCC 2019 Table 2.3 (TOOL-01-02 ภาคผนวก ตารางที่ 1)", monitored: false },
      { sym: "F_LU / F_MG / F_I", desc: "ค่าสัมประสิทธิ์การใช้ที่ดิน / การไถพรวน / อินทรียวัตถุ", unit: "-", bl: `${SOC_FLU[s.bl.flu].label} / ${SOC_FMG[s.bl.fmg].label} / ${SOC_FI[s.bl.fi].label}`, pj: `${SOC_FLU[s.pj.flu].label} / ${SOC_FMG[s.pj.fmg].label} / ${SOC_FI[s.pj.fi].label}`, source: "IPCC 2019 Table 5.5", monitored: true },
    );
  }
  P.push(
    { sym: "SOC", desc: "คาร์บอนที่สะสมในดิน", unit: "tC/ไร่", bl: r4(soil.soc0PerRai), pj: r4(soil.soctPerRai), source: soil.method === "sample" ? "Σ(SOC × BD × Dep × 0.16)/N" : "SOC_ref × F_LU × F_MG × F_I", monitored: true },
    { sym: "ΔSOC", desc: `การเปลี่ยนแปลงคาร์บอนในดินทั้งพื้นที่ (${soil.years} ปี)`, unit: "tC", bl: null, pj: r4(soil.deltaTC), source: soil.method === "sample" ? "A × (SOC_t − SOC_0)" : "A × dSOC × T", monitored: true },
  );
}

function biocharResult(rec: FieldRecord, bc: BiocharResult): TverResult {
  const b = rec.biochar!;
  return {
    method: "T-VER-P-METH-14-03",
    title: "การเปลี่ยนชีวมวลเป็นถ่านชีวภาพเพื่อใช้ประโยชน์ในดิน (Premium)",
    equation: "ER = BE − PE − LE; BE = W × FOC × F_perm × 44/12",
    steps: [
      { label: "BE คาร์บอนที่กักเก็บในถ่านชีวภาพ", value: bc.beKg },
      { label: "PE_FF เชื้อเพลิงในการผลิต (CO₂)", value: -bc.fuelKg },
      { label: "PE_EC ไฟฟ้า", value: -bc.elecKg },
      { label: "PE_fugitive มีเทนจากก๊าซสังเคราะห์", value: -bc.fugitiveKg },
    ],
    creditKgCO2e: bc.creditKg,
    periodYears: 1,
    perYearKgCO2e: bc.creditKg,
    ud: 0,
    checks: [
      { ok: b.focPct > 0, text: "มีผลวิเคราะห์สัดส่วนคาร์บอนอินทรีย์ (FOC) จากห้องปฏิบัติการ" },
      { ok: true, text: "ชีวมวลต้องเป็นของเสียทางการเกษตรที่ยั่งยืน และถ่านต้องใช้ในดิน ไม่นำไปเผาเป็นเชื้อเพลิง" },
    ],
    notes: [
      `F_perm ${bc.fperm} (${BIOCHAR_FPERM[b.process].label}) — IPCC 2019 Vol.4 Appendix 4`,
      "PE_fugitive = W × SMG 0.030 × f 0.1 × GWP_CH₄ (AMS-III.BG)",
      "คิดแยกเป็นอีกโครงการหนึ่ง ไม่รวมกับเครดิตของแปลง",
    ],
    params: [
      { sym: "W_biochar", desc: "น้ำหนักแห้งถ่านชีวภาพที่ผลิตและใช้ในดิน", unit: "ตัน/ปี", bl: null, pj: b.tonnesDry, source: "ชั่งน้ำหนักทุกรอบการผลิต", monitored: true },
      { sym: "FOC", desc: "สัดส่วนคาร์บอนอินทรีย์ในถ่าน", unit: "%", bl: null, pj: b.focPct, source: "ผลวิเคราะห์ห้องปฏิบัติการ", monitored: true },
      { sym: "F_perm", desc: "ค่าความคงอยู่ 100 ปี", unit: "-", bl: bc.fperm, pj: null, source: "IPCC 2019 Appendix 4", monitored: false },
      { sym: "FC", desc: "ดีเซลที่ใช้ในการผลิต", unit: "ลิตร", bl: null, pj: b.dieselL, source: "ใบเสร็จ", monitored: true },
      { sym: "EC", desc: "ไฟฟ้าที่ใช้ในการผลิต", unit: "MWh", bl: null, pj: b.kwh / 1000, source: "มิเตอร์", monitored: true },
    ],
  };
}
