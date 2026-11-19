import { describe, expect, it } from "vitest";
import { calcScenario, n2oAtdN, n2oDirectN, n2oLeachN } from "../src/lib/engine/calc";
import { evaluate } from "../src/lib/engine/evaluate";
import { calcBiochar, calcSoil, socFromSamples } from "../src/lib/engine/soil";
import { calcTrees, stock, treeBiomass } from "../src/lib/engine/trees";
import { fuelCO2PerL, FUELS, TVER } from "../src/lib/engine/factors";
import { DEFAULT_SETTINGS, emptyTrees, newRecord, sampleRice, uid } from "../src/lib/defaults";
import type { SoilCarbon } from "../src/lib/engine/types";

const co2e = (n2oN: number) => n2oN * (44 / 28) * 265;

describe("ทวนสอบกับตัวอย่าง 04_BE and PE calculation (ดร.นิตยา)", () => {
  it("N₂O จากปุ๋ย 1 ไร่: 46-0-0 10 กก. + 15-15-15 25 กก. → FSN 8.35; มูลไก่ 100 กก. (2.7%N) → FON 2.7", () => {
    const rec = newRecord("field");
    rec.standard = "tver";
    rec.baseline.areaRai = 1;
    rec.baseline.chemFerts = [
      { id: uid(), round: 1, formula: "46-0-0", kgPerRai: 10 },
      { id: uid(), round: 2, formula: "15-15-15", kgPerRai: 25 },
    ];
    rec.baseline.orgFerts = [{ id: uid(), type: "chicken", nPct: 2.7, kgPerRai: 100 }];
    const r = calcScenario(rec.baseline, "field", "tver", DEFAULT_SETTINGS);
    expect(r.nInputs.FSN).toBeCloseTo(8.35, 6);
    expect(r.nInputs.FON).toBeCloseTo(2.7, 6);
    // T-VER ไม่รวมเศษพืช (FCR) ใน N₂O ทางตรง
    const direct = r.lines.find((l) => l.key === "n2oDirect")!.kgCO2e;
    expect(direct).toBeCloseTo(co2e(n2oDirectN(8.35, 2.7, 0, 0.01)), 6);
    expect(direct).toBeCloseTo(46.0154, 3);
    expect(r.lines.find((l) => l.key === "n2oAtd")!.kgCO2e).toBeCloseTo(co2e(n2oAtdN(8.35, 2.7)), 6);
    expect(r.lines.find((l) => l.key === "n2oLeach")!.kgCO2e).toBeCloseTo(co2e(n2oLeachN(8.35, 2.7, 0)), 6);
  });

  it("ต้นตะแบก D 50 ซม. H 30 ม. → WT 1,829.64 กก., C_ABG 3,153.08, C_BLG 851.33, รวม 4,004.41 kgCO₂", () => {
    const w = treeBiomass("general", 50, 30);
    expect(w.ws).toBeCloseTo(1400.0, 0);
    expect(w.wb).toBeCloseTo(366.55, 1);
    expect(Math.abs(w.wl - 63.09)).toBeLessThan(0.15); // สูตรให้ 62.99
    expect(w.wt).toBeCloseTo(1829.64, 0);
    const cAbg = w.wt * 0.47 * 44 / 12;
    expect(cAbg).toBeCloseTo(3153.08, 0);
    const inv = { ...emptyTrees("forest"), rootRatio: "tgoGeneral" as const, plotAreaRai: 1 };
    const s = stock([{ id: "a", dbh: 50, height: 30, count: 1 }], inv, 1);
    expect(s.co2Kg).toBeCloseTo(4004.41, 0);
  });

  it("ไม้ขุดล้อม: ไม่คิดมวลชีวภาพใต้ดิน (bBLG = 0) → เหลือ 3,153.08 kgCO₂", () => {
    const inv = { ...emptyTrees("forest"), rootRatio: "tgoGeneral" as const, plotAreaRai: 1, transplanted: true };
    expect(stock([{ id: "a", dbh: 50, height: 30, count: 1 }], inv, 1).co2Kg).toBeCloseTo(3153.08, 0);
  });

  it("นับจำนวนต้น: C_TT = T × t × MAI × 10⁻³ (1,000 ต้น × 3.49 ปี × 9.5 = 33.155 tCO₂)", () => {
    const inv = { ...emptyTrees("fruit"), method: "count" as const, treeCount: 1000, years: 3.49 };
    expect(calcTrees(inv, 10).removalKgCO2 / 1000).toBeCloseTo(33.155, 6);
  });

  it("เชื้อเพลิงใน T-VER คิดเฉพาะ CO₂: ดีเซล 36.42 MJ/L × 74,100 kg/TJ = 2.6987 kgCO₂/L", () => {
    expect(fuelCO2PerL("diesel")).toBeCloseTo(2.69872, 5);
    expect(fuelCO2PerL("gasoline")).toBeCloseTo(2.18156, 5);
    expect(FUELS.diesel.co2PerL).toBeCloseTo(fuelCO2PerL("diesel"), 4);
    const rec = newRecord("field");
    rec.baseline.areaRai = 1;
    rec.baseline.machines = [{ id: "m", stage: "x", machine: "tractorM", fuel: "diesel", mode: "liters", hoursPerRai: 0, times: 1, lph: 0, liters: 100, kwh: 0 }];
    const tv = calcScenario(rec.baseline, "field", "tver", DEFAULT_SETTINGS);
    const mrv = calcScenario(rec.baseline, "field", "mrv", DEFAULT_SETTINGS);
    expect(tv.lines.find((l) => l.key === "fuel")!.kgCO2e).toBeCloseTo(269.87, 1);
    expect(mrv.lines.find((l) => l.key === "fuel")!.kgCO2e).toBeCloseTo(297.93, 1);
    expect(tv.activity.dieselL).toBe(100);
  });
});

describe("คาร์บอนในดิน T-VER-S-TOOL-01-02", () => {
  const base: SoilCarbon = {
    enabled: true, method: "sample", years: 3, climate: "T3", soilClass: "LAC", socRefCustom: null,
    baseline: [{ id: "1", socPct: 1.0, bd: 1.4, depthCm: 30 }],
    current: [{ id: "2", socPct: 1.2, bd: 1.4, depthCm: 30 }],
    bl: { flu: "annual", fmg: "full", fi: "low" }, pj: { flu: "annual", fmg: "reduced", fi: "high" },
  };
  it("ทางเลือกที่ 1: SOC = %OC × BD × ความลึก × 0.16 (tC/ไร่)", () => {
    expect(socFromSamples(base.baseline)).toBeCloseTo(6.72, 6);
    const r = calcSoil(base, 10)!;
    expect(r.deltaTC).toBeCloseTo(13.44, 6); // 10 ไร่ × (8.064 − 6.72)
    expect(r.deltaKgCO2).toBeCloseTo(13.44 * 44 / 12 * 1000, 3);
  });
  it("ทางเลือกที่ 2: dSOC = (SOC_t − SOC_0)/20 และไม่เกิน 0.128 tC/ไร่/ปี", () => {
    const r = calcSoil({ ...base, method: "ref" }, 10)!;
    const ref = 38 * 0.16;
    expect(r.soc0PerRai).toBeCloseTo(ref * 0.83 * 1 * 0.92, 6);
    expect(r.soctPerRai).toBeCloseTo(ref * 0.83 * 1.04 * 1.11, 6);
    expect(r.ratePerRai!).toBeCloseTo((r.soctPerRai - r.soc0PerRai) / 20, 6);
    expect(r.deltaTC).toBeCloseTo(10 * r.ratePerRai! * 3, 6);
    const big = calcSoil({ ...base, method: "ref", socRefCustom: 400, pj: { flu: "paddy", fmg: "noTill", fi: "highManure" } }, 1)!;
    expect(big.capped).toBe(true);
    expect(big.ratePerRai).toBe(0.128);
  });
});

describe("ถ่านชีวภาพ T-VER-P-METH-14-03", () => {
  it("BE = W × FOC × Fperm × 44/12; PE_fugitive = W × 0.03 × 0.1 × 28", () => {
    const r = calcBiochar({ enabled: true, tonnesDry: 10, focPct: 70, process: "high", dieselL: 100, kwh: 1000 }, 28, 0.4999)!;
    expect(r.beKg).toBeCloseTo(10 * 0.7 * 0.89 * 44 / 12 * 1000, 3);
    expect(r.fugitiveKg).toBeCloseTo(840, 6);
    expect(r.elecKg).toBeCloseTo(499.9, 6);
    expect(r.creditKg).toBeCloseTo(r.beKg - r.fuelKg - r.elecKg - r.fugitiveKg, 6);
  });
});

describe("เครดิต T-VER จำแนกตามพืช", () => {
  it("ข้าว P-METH-13-08: ผลรวมขั้นตอน = เครดิต และหัก U_d 15%", () => {
    const rec = sampleRice();
    rec.standard = "tver";
    const ev = evaluate(rec, DEFAULT_SETTINGS);
    expect(ev.tver!.method).toBe("T-VER-P-METH-13-08");
    const sum = ev.tver!.steps.reduce((a, b) => a + b.value, 0);
    expect(sum).toBeCloseTo(ev.tver!.creditKgCO2e, 6);
    expect(ev.tver!.ud).toBe(TVER.UD_DEFAULT);
    expect(ev.tver!.params.some((p) => p.sym === "SF_w")).toBe(true);
  });

  function fieldRec(track: "standard" | "premium") {
    const rec = newRecord("field");
    rec.standard = "tver"; rec.hasProject = true;
    rec.baseline.areaRai = 10; rec.baseline.yieldKgPerRai = 12000;
    rec.baseline.chemFerts = [{ id: uid(), round: 1, formula: "46-0-0", kgPerRai: 50 }];
    rec.project = structuredClone(rec.baseline);
    rec.project.chemFerts = [{ id: uid(), round: 1, formula: "46-0-0", kgPerRai: 40 }];
    rec.tverOpt = { track, ud: 0.15, outsideOrgC: 0, landRight: true, history3y: true };
    return rec;
  }

  it("พืชไร่ S-METH-13-05: เครดิต = C_BS − C_PROJ (+C_soil) ไม่หักความไม่แน่นอน", () => {
    const rec = fieldRec("standard");
    const ev = evaluate(rec, DEFAULT_SETTINGS);
    expect(ev.tver!.method).toBe("T-VER-S-METH-13-05");
    const be = ev.baseline.totalKgCO2e, pe = ev.project!.totalKgCO2e;
    expect(ev.tver!.creditKgCO2e).toBeCloseTo(be - pe, 6);
    expect(ev.tver!.checks[0].ok).toBe(true); // ลด N 20%
  });

  it("พืชไร่ P-METH-13-06: ไม่นับยูเรีย/ปูน และหัก U_d", () => {
    const rec = fieldRec("premium");
    const ev = evaluate(rec, DEFAULT_SETTINGS);
    expect(ev.tver!.method).toBe("T-VER-P-METH-13-06");
    const n2o = (r: typeof ev.baseline) => r.lines.filter((l) => l.group === "n2o").reduce((s, l) => s + l.kgCO2e, 0);
    expect(ev.tver!.creditKgCO2e).toBeCloseTo((n2o(ev.baseline) - n2o(ev.project!)) * 0.85, 6);
  });

  it("ไม้ผล S-METH-13-06 รวมคาร์บอนในดิน และการเผากิ่งใช้ COMF 0.55", () => {
    const rec = newRecord("fruit");
    rec.standard = "tver";
    rec.baseline.areaRai = 5;
    rec.baseline.residue = { type: "other", kgPerRai: 500, removedPct: 0, burnedAreaRai: 5 };
    rec.trees = { ...rec.trees, method: "count", treeCount: 100, years: 2 };
    rec.soil = {
      enabled: true, method: "sample", years: 2, climate: "T3", soilClass: "LAC", socRefCustom: null,
      baseline: [{ id: "1", socPct: 1, bd: 1.3, depthCm: 30 }], current: [{ id: "2", socPct: 1.1, bd: 1.3, depthCm: 30 }],
      bl: { flu: "perennial", fmg: "full", fi: "medium" }, pj: { flu: "perennial", fmg: "full", fi: "medium" },
    };
    const ev = evaluate(rec, DEFAULT_SETTINGS);
    expect(ev.tver!.method).toBe("T-VER-S-METH-13-06");
    const fire = ev.baseline.lines.find((l) => l.key === "fireCH4")!;
    expect(fire.mass).toBeCloseTo(5 * 500 * 0.55 * 2.7e-3, 6);
    const soilKg = ev.soil!.deltaKgCO2;
    const steps = ev.tver!.steps;
    expect(steps[0].value).toBeCloseTo(100 * 9.5 * 2, 6);
    expect(steps[1].value).toBeCloseTo(soilKg, 6);
    expect(ev.tver!.perYearKgCO2e).toBeCloseTo(ev.tver!.creditKgCO2e / 2, 6);
  });

  it("ถ่านชีวภาพแสดงเป็นระเบียบวิธีเสริม", () => {
    const rec = fieldRec("standard");
    rec.biochar = { enabled: true, tonnesDry: 2, focPct: 60, process: "medium", dieselL: 0, kwh: 0 };
    const ev = evaluate(rec, DEFAULT_SETTINGS);
    expect(ev.extras[0].method).toBe("T-VER-P-METH-14-03");
    expect(ev.extras[0].creditKgCO2e).toBeGreaterThan(0);
  });
});
