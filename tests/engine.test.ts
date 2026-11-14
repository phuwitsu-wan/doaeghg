import { describe, expect, it } from "vitest";
import { burningGas, calcScenario, limeCO2, n2oAtdN, n2oDirectN, n2oLeachN, riceCH4, sfo, ureaCO2 } from "../src/lib/engine/calc";
import { evaluate } from "../src/lib/engine/evaluate";
import { calcTrees, treeBiomass } from "../src/lib/engine/trees";
import { DEFAULT_SETTINGS, emptyScenario, newRecord, sampleRice, uid } from "../src/lib/defaults";
import { FUELS } from "../src/lib/engine/factors";

const toCO2e = (n2oN: number) => n2oN * (44 / 28) * 265;

describe("ตรงกับ Worksheet_Rice_GHG_Cal.xlsx (Field 1)", () => {
  it("ปูนขาว 10 กก. + โดโลไมต์ 20 กก. = 13.9333 kgCO2", () => {
    expect(limeCO2(10, 0)).toBeCloseTo(4.4, 6);
    expect(limeCO2(0, 20)).toBeCloseTo(9.533333333, 6);
    expect(limeCO2(10, 20)).toBeCloseTo(13.93333333, 6);
  });
  it("ยูเรีย 300 กก. = 220 kgCO2", () => {
    expect(ureaCO2(300)).toBeCloseTo(220, 6);
  });
  it("ดีเซล 300 ลิตร = 893.79 kgCO2e", () => {
    expect(300 * FUELS.diesel.efPerL).toBeCloseTo(893.79, 6);
  });
  it("CH4 นาข้าว: 80 ha, 111 วัน, ไถกลบฟาง 100 t/ha (<30 วัน)", () => {
    const so = sfo([{ type: "strawShort", kgPerRai: 100 * 1000 / 6.25 }]);
    expect(so).toBeCloseTo(15.22473039, 6);
    const ef = 1.22 * 1 * 1 * so;
    expect(ef).toBeCloseTo(18.57417107, 6);
    const ch4 = riceCH4(ef, 111, 80 * 6.25);
    expect(ch4).toBeCloseTo(164938.6391, 3);
    expect(ch4 * 28).toBeCloseTo(4618281.896, 1);
  });
  it("N2O ทางตรงนาข้าว FSN 8.35, FON 2.7, FCR 1.24 (EF1FR 0.004) = 20.4716", () => {
    expect(toCO2e(n2oDirectN(8.35, 2.7, 1.24, 0.004))).toBeCloseTo(20.47162857, 6);
  });
  it("N2O ระเหย = 6.18605, ชะล้าง = 13.51127", () => {
    expect(toCO2e(n2oAtdN(8.35, 2.7))).toBeCloseTo(6.186046429, 6);
    expect(toCO2e(n2oLeachN(8.35, 2.7, 1.24))).toBeCloseTo(13.51127486, 6);
  });
});

describe("ตรงกับ Worksheet_Sugarcane_GHG_Cal.xlsx", () => {
  it("N2O ทางตรงอ้อย FSN = 0.46×25 + 0.21×50 + 0.27×50 = 35.5 kgN → 147.832", () => {
    const FSN = 0.46 * 25 + 0.21 * 50 + 0.27 * 50;
    expect(FSN).toBeCloseTo(35.5, 9);
    expect(toCO2e(n2oDirectN(FSN, 0, 0, 0.01))).toBeCloseTo(147.8321429, 6);
  });
});

describe("คู่มือ MRV Eq.1 การเผาชีวมวล", () => {
  it("10 ไร่ × 725.6 kg/ไร่", () => {
    const ch4 = burningGas(10, 725.6, 2.7);
    const n2o = burningGas(10, 725.6, 0.07);
    expect(ch4).toBeCloseTo(10 * 725.6 * 0.8 * 2.7e-3, 9);
    expect(ch4 * 28 + n2o * 265).toBeCloseTo(546.52192, 4);
  });
});

describe("calcScenario แบบครบวงจร", () => {
  it("รวมแหล่งต่าง ๆ และคำนวณต่อไร่", () => {
    const s = emptyScenario("field");
    s.areaRai = 10;
    s.yieldKgPerRai = 12000;
    s.chemFerts = [{ id: uid(), round: 1, formula: "46-0-0", kgPerRai: 25 }];
    s.limestoneKgPerRai = 1;
    s.machines = [{ id: uid(), stage: "ไถ", machine: "tractorL", fuel: "diesel", mode: "hours", hoursPerRai: 1, times: 1, lph: 23.4, liters: 0, kwh: 0 },
      { id: uid(), stage: "สูบน้ำ", machine: "pump", fuel: "electric", mode: "liters", hoursPerRai: 0, times: 1, lph: 0, liters: 0, kwh: 100 }];
    const r = calcScenario(s, "field", "mrv", DEFAULT_SETTINGS);
    const FSN = 250 * 0.46;
    const expected = toCO2e(n2oDirectN(FSN, 0, 0, 0.01)) + toCO2e(n2oAtdN(FSN, 0)) + toCO2e(n2oLeachN(FSN, 0, 0))
      + ureaCO2(250) + limeCO2(10, 0) + 234 * 2.9793 + 100 * 0.475;
    expect(r.totalKgCO2e).toBeCloseTo(expected, 6);
    expect(r.perRai).toBeCloseTo(expected / 10, 6);
    expect(r.perKgProduct).toBeCloseTo(expected / 120000, 9);
  });

  it("เศษวัสดุที่เผา เหลือ 20% เข้าสู่ FCR (Eq.3.3)", () => {
    const s = emptyScenario("rice");
    s.areaRai = 10; s.rice.harvestedAreaRai = 10;
    s.residue = { type: "rice", kgPerRai: 1000, removedPct: 0, burnedAreaRai: 4 };
    const r = calcScenario(s, "rice", "mrv", DEFAULT_SETTINGS);
    expect(r.nInputs.FCR).toBeCloseTo((6 * 1000 + 4 * 1000 * 0.2) * 0.0062, 9);
  });
});

describe("T-VER", () => {
  it("13-08 ข้าว: หัก 0.89 และ 15% และเครดิต > 0 เมื่อเปลี่ยนเป็น AWD", () => {
    const rec = sampleRice();
    rec.standard = "tver";
    const ev = evaluate(rec, DEFAULT_SETTINGS);
    expect(ev.tver?.method).toBe("T-VER-P-METH-13-08");
    expect(ev.tver!.creditKgCO2e).toBeGreaterThan(0);
    const sum = ev.tver!.steps.reduce((a, b) => a + b.value, 0);
    expect(sum).toBeCloseTo(ev.tver!.creditKgCO2e, 6);
    expect(ev.tver!.checks[0].ok).toBe(true);
  });
  it("13-05 พืชไร่: ลดปุ๋ย < 5% ไม่ผ่านเงื่อนไข", () => {
    const rec = newRecord("field");
    rec.standard = "tver"; rec.hasProject = true;
    rec.baseline.areaRai = 10;
    rec.baseline.chemFerts = [{ id: "a", round: 1, formula: "46-0-0", kgPerRai: 50 }];
    rec.project = structuredClone(rec.baseline);
    rec.project.chemFerts[0].kgPerRai = 49;
    const ev = evaluate(rec, DEFAULT_SETTINGS);
    expect(ev.tver!.checks[0].ok).toBe(false);
  });
});

describe("ต้นไม้ (T-VER Tool)", () => {
  it("Ogawa: D=20 ซม. H=15 ม.", () => {
    const b = treeBiomass("general", 20, 15);
    const x = 400 * 15;
    expect(b.ws).toBeCloseTo(0.0396 * Math.pow(x, 0.933), 9);
    expect(b.wb).toBeCloseTo(0.00349 * Math.pow(x, 1.03), 9);
    expect(b.wl).toBeCloseTo(1 / (28 / (b.ws + b.wb) + 0.025), 9);
  });
  it("การกักเก็บที่เพิ่มขึ้น และขยายผลจากแปลงตัวอย่าง", () => {
    const rec = newRecord("forest");
    rec.trees.plotAreaRai = 1;
    rec.trees.current = [{ id: "1", dbh: 20, height: 15, count: 10 }, { id: "2", dbh: 3, height: 2, count: 5 }];
    rec.trees.years = 5;
    const r = calcTrees(rec.trees, 4);
    const agb = treeBiomass("general", 20, 15).wt * 10 * 4;
    expect(r.removalKgCO2).toBeCloseTo(agb * 1.2 * 0.47 * 44 / 12, 6);
    expect(r.current!.smallTrees).toBe(5);
    expect(r.annualKgCO2).toBeCloseTo(r.removalKgCO2 / 5, 9);
  });
  it("Option 1 นับต้น: 100 ต้น × 9.5 × 3 ปี", () => {
    const rec = newRecord("fruit");
    rec.trees.method = "count"; rec.trees.treeCount = 100; rec.trees.years = 3;
    expect(calcTrees(rec.trees, 5).removalKgCO2).toBe(2850);
  });
});

describe("ไฟล์ Excel และที่อยู่", async () => {
  const { buildXlsx } = await import("../src/lib/xlsx");
  const { matchPlace } = await import("../src/lib/address");
  const fs = await import("node:fs");
  const data = JSON.parse(fs.readFileSync("public/thai-address.json", "utf8"));

  it("สร้าง .xlsx เป็น zip ที่ถูกต้อง", () => {
    const b = buildXlsx([{ name: "สรุป", rows: [{ cells: ["แปลง", "ค่า"], style: "head" }, { cells: ["นาทุ่ง <1>", 12.5] }] }]);
    expect(b[0]).toBe(0x50); expect(b[1]).toBe(0x4b);
    fs.writeFileSync("/tmp/test-out.xlsx", b);
  });
  it("จับคู่ผลจาก Nominatim: ต่างจังหวัด", () => {
    const p = matchPlace(["บ้านหนองโพ", "ตำบลหนองโพ", "อำเภอตาคลี", "จังหวัดนครสวรรค์", "60140", "ประเทศไทย"], data);
    expect(p).toEqual({ province: "นครสวรรค์", district: "ตาคลี", subdistrict: "หนองโพ" });
  });
  it("จับคู่ผลจาก Nominatim: กรุงเทพ", () => {
    const p = matchPlace(["แขวงลาดยาว", "เขตจตุจักร", "กรุงเทพมหานคร", "10900"], data);
    expect(p).toEqual({ province: "กรุงเทพมหานคร", district: "จตุจักร", subdistrict: "ลาดยาว" });
  });
  it("อนุมานอำเภอจากตำบลเมื่อไม่มีชื่ออำเภอ", () => {
    const p = matchPlace(["ตำบลหนองโพ", "จังหวัดนครสวรรค์"], data);
    expect(p.district).toBe("ตาคลี");
  });
});

describe("แรงม้ารถแทรกเตอร์", async () => {
  const { tractorClass } = await import("../src/screens/steps");
  it("แบ่งกลุ่มตามคู่มือ MRV", () => {
    expect([tractorClass(15), tractorClass(21), tractorClass(45), tractorClass(46), tractorClass(75), tractorClass(76)])
      .toEqual(["tractorXS", "tractorS", "tractorS", "tractorM", "tractorM", "tractorL"]);
  });
});
