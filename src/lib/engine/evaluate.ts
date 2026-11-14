import { calcScenario, lineValue, sumLines } from "./calc";
import { TVER } from "./factors";
import { calcTrees, type TreeResult } from "./trees";
import type { FieldRecord, ScenarioResult, Settings } from "./types";

export interface Check {
  ok: boolean;
  text: string;
}

export interface Evaluation {
  baseline: ScenarioResult;
  project: ScenarioResult | null;
  trees: TreeResult | null;
  /** MRV: ปริมาณที่ลดได้ = BE − PE (+ การกักเก็บของต้นไม้) */
  reductionKgCO2e: number | null;
  /** T-VER: ปริมาณที่ขอรับรองได้หลังหักตามระเบียบวิธี */
  tver: null | {
    method: string;
    steps: { label: string; value: number }[];
    creditKgCO2e: number;
    checks: Check[];
    notes: string[];
  };
}

const ENERGY_KEYS = ["fuel", "elec", "transport"];
const FIRE_KEYS = ["fireCH4", "fireN2O"];
const SOIL_KEYS = ["n2oDirect", "n2oAtd", "n2oLeach", "urea", "lime"];

export function evaluate(rec: FieldRecord, settings: Settings): Evaluation {
  const bl = calcScenario(rec.baseline, rec.crop, rec.standard, settings);
  const pj = rec.hasProject ? calcScenario(rec.project, rec.crop, rec.standard, settings) : null;
  const isTree = rec.crop === "fruit" || rec.crop === "forest";
  const trees = isTree ? calcTrees(rec.trees, rec.baseline.areaRai) : null;

  let reduction: number | null = null;
  if (pj) reduction = bl.totalKgCO2e - pj.totalKgCO2e;
  if (trees) reduction = (reduction ?? 0) + trees.removalKgCO2;

  const ev: Evaluation = { baseline: bl, project: pj, trees, reductionKgCO2e: reduction, tver: null };
  if (rec.standard !== "tver") return ev;

  const checks: Check[] = [];
  const notes: string[] = [];
  const nDrop = (pjFSN: number) => (bl.nInputs.FSN > 0 ? 1 - pjFSN / bl.nInputs.FSN : 0);

  if (rec.crop === "rice") {
    // T-VER-P-METH-13-08
    const pjr = pj ?? bl;
    const beCH4 = lineValue(bl, "riceCH4") * TVER.RICE_CONSERVATIVENESS;
    const beSoil = sumLines(bl, SOIL_KEYS);
    const pjCore = lineValue(pjr, "riceCH4") + sumLines(pjr, SOIL_KEYS);
    const er0 = beCH4 + beSoil - pjCore;
    const pjFuel = sumLines(pjr, ENERGY_KEYS);
    const pjFire = sumLines(pjr, FIRE_KEYS);
    const fuelIn = er0 > 0 && pjFuel >= TVER.SIGNIFICANCE * er0;
    const fireIn = er0 > 0 && pjFire >= TVER.SIGNIFICANCE * er0;
    const er1 = er0 - (fuelIn ? pjFuel : 0) - (fireIn ? pjFire : 0);
    const credit = Math.max(0, er1) * (1 - TVER.RICE_UNCERTAINTY_DEDUCTION);
    const waterChanged = pj ? rec.project.rice.waterRegime !== rec.baseline.rice.waterRegime : false;
    const nd = pj ? nDrop(pj.nInputs.FSN) : 0;
    checks.push({ ok: waterChanged || nd >= TVER.MIN_N_REDUCTION, text: "ปรับการจัดการน้ำ หรือ ลดปุ๋ยเคมีไนโตรเจน ≥ 5% เทียบกรณีฐาน" });
    if (pj && rec.baseline.yieldKgPerRai > 0) {
      const yd = 1 - rec.project.yieldKgPerRai / rec.baseline.yieldKgPerRai;
      checks.push({ ok: yd <= 0.05, text: `ผลผลิตลดลงไม่เกิน 5% (ลดลง ${(yd * 100).toFixed(1)}%; 5–15% ต้องมีคำอธิบาย)` });
    }
    checks.push({ ok: !!pj, text: "มีข้อมูลกรณีดำเนินโครงการ" });
    notes.push("ใช้ค่า default (Method 3): หักความไม่แน่นอน 15% และคูณ CH₄ กรณีฐานด้วย 0.89");
    notes.push("N₂O คิดจาก FSN + FON เท่านั้น ด้วย EF1FR 0.003 (ขังน้ำต่อเนื่อง) / 0.005 (ระบายน้ำ)");
    notes.push(`เชื้อเพลิง/ไฟฟ้า${fuelIn ? "" : "ไม่"}ถูกนับ และการเผา${fireIn ? "" : "ไม่"}ถูกนับ (นับเมื่อ ≥ 5% ของปริมาณที่ลดได้)`);
    notes.push("ต้องมีหนังสือแสดงสิทธิในที่ดิน และข้อมูลกรณีฐานย้อนหลังอย่างน้อย 3 ปี");
    ev.tver = {
      method: "T-VER-P-METH-13-08",
      steps: [
        { label: "CH₄ กรณีฐาน × 0.89", value: beCH4 },
        { label: "N₂O + ยูเรีย + ปูน กรณีฐาน", value: beSoil },
        { label: "การปล่อยกรณีโครงการ (CH₄ + ดิน)", value: -pjCore },
        { label: "เชื้อเพลิง/ไฟฟ้า กรณีโครงการ", value: fuelIn ? -pjFuel : 0 },
        { label: "การเผา กรณีโครงการ", value: fireIn ? -pjFire : 0 },
        { label: "หักความไม่แน่นอน 15%", value: -Math.max(0, er1) * TVER.RICE_UNCERTAINTY_DEDUCTION },
      ],
      creditKgCO2e: credit,
      checks,
      notes,
    };
    return ev;
  }

  if (rec.crop === "field" || rec.crop === "vegetable") {
    // T-VER-S-METH-13-05
    const pjr = pj ?? bl;
    const be = sumLines(bl, SOIL_KEYS) + sumLines(bl, ENERGY_KEYS);
    const pe = sumLines(pjr, SOIL_KEYS) + sumLines(pjr, ENERGY_KEYS);
    const nd = pj ? nDrop(pj.nInputs.FSN) : 0;
    checks.push({ ok: nd >= TVER.MIN_N_REDUCTION, text: `ลดการใช้ปุ๋ยเคมีไนโตรเจน ≥ 5% (ลดลง ${(nd * 100).toFixed(1)}%)` });
    checks.push({ ok: !!pj, text: "มีข้อมูลกรณีดำเนินโครงการ" });
    notes.push("N₂O คิดจาก FSN + FON ด้วย EF 0.010; ไม่พิจารณาการรั่วไหล");
    notes.push("ต้องเป็นพื้นที่เกษตรมาแล้ว ≥ 5 ปี และมีข้อมูลการใช้ปุ๋ยย้อนหลัง ≥ 3 ปี");
    notes.push("การกักเก็บคาร์บอนในดิน (SOC) เป็นทางเลือก ต้องวัดจริงก่อน-หลัง — ยังไม่รวมในเครื่องมือนี้");
    ev.tver = {
      method: "T-VER-S-METH-13-05",
      steps: [
        { label: "การปล่อยกรณีฐาน (ปุ๋ย ปูน พลังงาน)", value: be },
        { label: "การปล่อยกรณีโครงการ", value: -pe },
      ],
      creditKgCO2e: Math.max(0, be - pe),
      checks,
      notes,
    };
    return ev;
  }

  // ไม้ผล/พืชยืนต้น (13-06) และ ป่าไม้ (13-01/13-04)
  const removal = trees?.removalKgCO2 ?? 0;
  const pjr = pj ?? bl;
  const steps = [{ label: "การกักเก็บคาร์บอนของต้นไม้ที่เพิ่มขึ้น", value: removal }];
  let credit = removal;
  if (rec.crop === "fruit") {
    const be = sumLines(bl, SOIL_KEYS) + sumLines(bl, ENERGY_KEYS);
    const pe = sumLines(pjr, SOIL_KEYS) + sumLines(pjr, ENERGY_KEYS) + sumLines(pjr, FIRE_KEYS);
    steps.push({ label: "การปล่อยกรณีฐาน", value: be }, { label: "การปล่อยกรณีโครงการ (รวมเผากิ่ง/ใบ)", value: -pe });
    credit += be - pe;
    const nd = pj ? nDrop(pj.nInputs.FSN) : 0;
    checks.push({ ok: nd >= TVER.MIN_N_REDUCTION || !pj, text: `ลดการใช้ปุ๋ยเคมีไนโตรเจน ≥ 5% (ถ้าขอเครดิตจากการลดปุ๋ย)` });
    notes.push("ไม้ป่า/ไม้เศรษฐกิจที่ปลูกเสริมต้องไม่เกิน 50% ของพื้นที่โครงการ");
  } else {
    const pe = sumLines(pjr, SOIL_KEYS) + sumLines(pjr, ENERGY_KEYS) + sumLines(pjr, FIRE_KEYS);
    if (pe > 0) { steps.push({ label: "การปล่อยจากกิจกรรมโครงการ", value: -pe }); credit -= pe; }
    notes.push("ระเบียบวิธีป่าไม้มีเงื่อนไขเพิ่มเติม (เช่น บัฟเฟอร์ ความถาวร) ที่ต้องตรวจสอบกับ อบก. ก่อนยื่นจริง");
  }
  if (trees?.current) checks.push({ ok: trees.current.smallTrees === 0, text: `ต้นไม้ทุกต้นมี DBH ≥ 4.5 ซม. และสูง > 1.3 ม. (ไม่นับ ${trees.current.smallTrees} ต้น)` });
  checks.push({ ok: rec.trees.years >= 1, text: "ระบุช่วงเวลาติดตามผล (อบก. แนะนำทุก 3–5 ปี)" });
  notes.push("คำนวณคาร์บอนต้นไม้ตาม T-VER-TOOL-FOR/AGR-01: (AGB + BGB) × 0.47 × 44/12");
  ev.tver = {
    method: rec.crop === "fruit" ? "T-VER-S-METH-13-06" : "T-VER-S-METH-13-01 / 13-04",
    steps,
    creditKgCO2e: Math.max(0, credit),
    checks,
    notes,
  };
  return ev;
}
