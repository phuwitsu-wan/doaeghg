import {
  BURN, CFOA, COMF_PERENNIAL, EF_C_RICE, EF_DOLOMITE, EF_LIMESTONE, EF_UREA, ELEC_EF, FUELS, GWP_SETS, HA_PER_RAI, N2O,
  RESIDUES, SF_P, SF_W, TRANSPORT_FUELS,
} from "./factors";
import type { CropGroup, ScenarioResult, Scenario, Settings, SourceLine, Standard } from "./types";

const C_TO_CO2 = 44 / 12;
const N2ON_TO_N2O = 44 / 28;

export function gwp(settings: Settings) {
  return GWP_SETS[settings.gwp] ?? GWP_SETS.AR5;
}

export function elecEF(settings: Settings): number {
  if (settings.elecCustom != null && settings.elecCustom > 0) return settings.elecCustom;
  return ELEC_EF[settings.elec]?.value ?? ELEC_EF.tgo2026.value;
}

/** %N จากสูตรปุ๋ย "N-P-K" (ตัวเลขตัวแรก) */
export function nPctFromFormula(formula: string): number {
  const n = parseFloat(String(formula).split("-")[0]);
  return Number.isFinite(n) ? n : 0;
}
export const isUrea = (formula: string) => formula.trim() === "46-0-0";

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

/* ======================= สมการย่อย (ทดสอบแยกได้) ======================= */

/** [MRV Eq.1] kg ก๊าซ = A(ไร่) × MB(kg/ไร่) × Cf × Gef(g/kg) × 10⁻³ */
export function burningGas(areaRai: number, mbKgPerRai: number, efGPerKg: number, cf = BURN.CF) {
  return areaRai * mbKgPerRai * cf * efGPerKg * 1e-3;
}

/** [MRV Eq.2.2] SFo = (1 + Σ ROA(kg/ไร่) × 0.00625 × CFOA)^0.59 */
export function sfo(organics: { type: keyof typeof CFOA; kgPerRai: number }[]) {
  const sum = organics.reduce((s, o) => s + num(o.kgPerRai) * 0.00625 * (CFOA[o.type]?.value ?? 0), 0);
  return Math.pow(1 + sum, 0.59);
}

/** [MRV Eq.2] kg CH4 = EF(kgCH4/ha/วัน) × t(วัน) × AH(ไร่) × 0.16 */
export function riceCH4(efDaily: number, days: number, harvestedRai: number) {
  return efDaily * days * harvestedRai * HA_PER_RAI;
}

/** [MRV Eq.3] kg N2O-N ทางตรง */
export const n2oDirectN = (FSN: number, FON: number, FCR: number, ef: number) => (FSN + FON + FCR) * ef;
/** [MRV Eq.4] kg N2O-N จากการระเหยและตกสะสม */
export const n2oAtdN = (FSN: number, FON: number) => (FSN * N2O.FRAC_GASF + FON * N2O.FRAC_GASM) * N2O.EF4;
/** [MRV Eq.5] kg N2O-N จากการชะล้าง */
export const n2oLeachN = (FSN: number, FON: number, FCR: number) => (FSN + FON + FCR) * N2O.FRAC_LEACH * N2O.EF5;

/** [MRV Eq.6] kg CO2 จากยูเรีย */
export const ureaCO2 = (kgUrea: number) => kgUrea * EF_UREA * C_TO_CO2;
/** [MRV Eq.7] kg CO2 จากปูน */
export const limeCO2 = (kgLimestone: number, kgDolomite: number) =>
  (kgLimestone * EF_LIMESTONE + kgDolomite * EF_DOLOMITE) * C_TO_CO2;

/** EF N2O ทางตรงตามชนิดพืชและมาตรฐาน */
export function directEF(crop: CropGroup, s: Scenario, standard: Standard): { ef: number; label: string } {
  if (crop !== "rice" || s.rice.waterRegime === "upland") return { ef: N2O.EF1, label: "EF1 = 0.010" };
  if (standard === "tver") {
    return s.rice.waterRegime === "continuous"
      ? { ef: N2O.EF1FR_CONT, label: "EF1FR ขังน้ำต่อเนื่อง = 0.003" }
      : { ef: N2O.EF1FR_DRAIN, label: "EF1FR ระบายน้ำ = 0.005" };
  }
  return { ef: N2O.EF1FR, label: "EF1FR = 0.004" };
}

/* ======================= คำนวณ 1 กรณี ======================= */

export function calcScenario(s: Scenario, crop: CropGroup, standard: Standard, settings: Settings): ScenarioResult {
  const G = gwp(settings);
  const A = num(s.areaRai);
  const lines: SourceLine[] = [];
  const warnings: string[] = [];
  const push = (l: SourceLine) => { if (l.kgCO2e !== 0 || l.mass) lines.push(l); };

  if (A <= 0) warnings.push("ยังไม่ได้ระบุพื้นที่เพาะปลูก");

  /* --- N inputs --- */
  let FSN = 0;
  let ureaKg = 0;
  for (const f of s.chemFerts) {
    const kg = num(f.kgPerRai) * A;
    FSN += kg * nPctFromFormula(f.formula) / 100;
    if (isUrea(f.formula)) ureaKg += kg;
  }
  let FON = 0;
  for (const o of s.orgFerts) FON += num(o.kgPerRai) * A * num(o.nPct) / 100;

  /* --- เศษวัสดุ และการเผา --- */
  const res = RESIDUES[s.residue.type] ?? RESIDUES.other;
  const remainPerRai = num(s.residue.kgPerRai) * (1 - Math.min(100, Math.max(0, num(s.residue.removedPct))) / 100);
  const burnedRai = Math.min(num(s.residue.burnedAreaRai), A);
  if (num(s.residue.burnedAreaRai) > A) warnings.push("พื้นที่เผามากกว่าพื้นที่ปลูก — ใช้ค่าพื้นที่ปลูกแทน");
  const residueLeftKg = (A - burnedRai) * remainPerRai + burnedRai * remainPerRai * BURN.UNBURNT_FRACTION; // [MRV Eq.3.3]
  const FCR_raw = residueLeftKg * res.nPct / 100;
  // T-VER (13-05, 13-06, 13-08) คิด N2O จาก FSN + FON เท่านั้น
  const FCR = standard === "tver" ? 0 : FCR_raw;

  // ไม้ยืนต้นภายใต้ T-VER 13-06 ใช้ COMF 0.55 (§5.2.4); อื่น ๆ ใช้ Cf เศษวัสดุ 0.8 (IPCC Table 2.6)
  const tree = crop === "fruit" || crop === "forest";
  const burnCf = standard === "tver" && tree ? COMF_PERENNIAL : BURN.CF;
  if (burnedRai > 0 && remainPerRai > 0) {
    const ch4 = burningGas(burnedRai, remainPerRai, BURN.EF_CH4, burnCf);
    const n2o = burningGas(burnedRai, remainPerRai, BURN.EF_N2O, burnCf);
    const tag = burnCf === BURN.CF ? "" : ` COMF ${burnCf}`;
    push({ key: "fireCH4", label: "CH₄ จากการเผาเศษวัสดุ", group: "fire", gas: "CH4", mass: ch4, kgCO2e: ch4 * G.CH4, eq: `Eq.1.1${tag}` });
    push({ key: "fireN2O", label: "N₂O จากการเผาเศษวัสดุ", group: "fire", gas: "N2O", mass: n2o, kgCO2e: n2o * G.N2O, eq: `Eq.1.2${tag}` });
  }

  /* --- มีเทนจากนาข้าว --- */
  let riceAct: ScenarioResult["activity"]["rice"];
  if (crop === "rice") {
    const r = s.rice;
    const sfw = SF_W[r.waterRegime]?.value ?? 1;
    const sfp = SF_P[r.preSeason]?.value ?? 1;
    const so = sfo(r.organics);
    const ef = EF_C_RICE * sfw * sfp * so;
    riceAct = { harvestedRai: num(r.harvestedAreaRai), days: num(r.days), sfw, sfp, sfo: so, efDaily: ef };
    const ch4 = riceCH4(ef, num(r.days), num(r.harvestedAreaRai));
    push({ key: "riceCH4", label: "CH₄ จากการปลูกข้าว", group: "rice", gas: "CH4", mass: ch4, kgCO2e: ch4 * G.CH4,
      eq: `Eq.2 (EF=${ef.toFixed(3)} = 1.22×${sfw}×${sfp}×${so.toFixed(3)})` });
    if (num(r.harvestedAreaRai) > A && A > 0) warnings.push("พื้นที่เก็บเกี่ยวมากกว่าพื้นที่ปลูก");
    if (num(r.days) <= 0) warnings.push("ยังไม่ได้ระบุอายุเก็บเกี่ยวข้าว (วัน)");
  }

  /* --- N2O จากดิน --- */
  const { ef: ef1, label: efLabel } = directEF(crop, s, standard);
  const dN = n2oDirectN(FSN, FON, FCR, ef1);
  const aN = n2oAtdN(FSN, FON);
  const lN = n2oLeachN(FSN, FON, FCR);
  push({ key: "n2oDirect", label: "N₂O ทางตรงจากปุ๋ยและเศษวัสดุ", group: "n2o", gas: "N2O", mass: dN * N2ON_TO_N2O, kgCO2e: dN * N2ON_TO_N2O * G.N2O, eq: `Eq.3 (${efLabel})` });
  push({ key: "n2oAtd", label: "N₂O ทางอ้อม – การระเหย NH₃/NOx", group: "n2o", gas: "N2O", mass: aN * N2ON_TO_N2O, kgCO2e: aN * N2ON_TO_N2O * G.N2O, eq: "Eq.4" });
  push({ key: "n2oLeach", label: "N₂O ทางอ้อม – การชะล้าง", group: "n2o", gas: "N2O", mass: lN * N2ON_TO_N2O, kgCO2e: lN * N2ON_TO_N2O * G.N2O, eq: "Eq.5" });

  /* --- CO2 จากยูเรีย ปูน --- */
  const u = ureaCO2(ureaKg);
  push({ key: "urea", label: "CO₂ จากปุ๋ยยูเรีย", group: "co2soil", gas: "CO2", mass: u, kgCO2e: u, eq: "Eq.6" });
  const l = limeCO2(num(s.limestoneKgPerRai) * A, num(s.dolomiteKgPerRai) * A);
  push({ key: "lime", label: "CO₂ จากปูนขาว/โดโลไมต์", group: "co2soil", gas: "CO2", mass: l, kgCO2e: l, eq: "Eq.7" });

  /* --- พลังงาน --- */
  // T-VER: CO2 เท่านั้น = FC × NCV × EF_CO2 (ไม่รวม CH4/N2O จากการเผาไหม้)
  const tv = standard === "tver";
  let fuelKg = 0;
  let elecKg = 0;
  let dieselL = 0;
  let gasolineL = 0;
  let kwh = 0;
  const efE = elecEF(settings);
  for (const m of s.machines) {
    if (m.fuel === "electric") {
      elecKg += num(m.kwh) * efE;
      kwh += num(m.kwh);
    } else {
      const liters = m.mode === "liters" ? num(m.liters) : num(m.hoursPerRai) * Math.max(1, num(m.times)) * num(m.lph) * A;
      const f = FUELS[m.fuel] ?? FUELS.diesel;
      fuelKg += liters * (tv ? f.co2PerL : f.efPerL);
      if (m.fuel === "diesel") dieselL += liters; else gasolineL += liters;
    }
  }
  push({ key: "fuel", label: "การเผาไหม้น้ำมันของเครื่องจักรกลเกษตร", group: "energy", gas: tv ? "CO2" : "mix", kgCO2e: fuelKg,
    eq: tv ? "FC×NCV×EF_CO2 (ดีเซล 2.6987, เบนซิน 2.1816 kgCO₂/L)" : "Eq.8" });
  push({ key: "elec", label: "การใช้ไฟฟ้า (เช่น สูบน้ำ)", group: "energy", gas: "CO2", kgCO2e: elecKg, eq: `Eq.9 (${efE} kgCO₂e/kWh)` });
  let trKg = 0;
  let otherFuelKgCO2 = 0;
  for (const t of s.transports) {
    const L = transportLiters(t);
    const tf = TRANSPORT_FUELS[t.fuel];
    const kg = L * (tf ? (tv ? tf.co2 : tf.ef) : 0);
    trKg += kg;
    if (t.fuel === "diesel") dieselL += L;
    else if (t.fuel === "gasoline" || t.fuel === "gasolineCat") gasolineL += L;
    else otherFuelKgCO2 += kg;
  }
  push({ key: "transport", label: "การขนส่ง (ฟาง/ใบอ้อย/ผลผลิต)", group: "energy", gas: tv ? "CO2" : "mix", kgCO2e: trKg, eq: tv ? "FC×NCV×EF_CO2" : "Eq.10" });

  const total = lines.reduce((x, y) => x + y.kgCO2e, 0);
  const byGas = { CO2: 0, CH4: 0, N2O: 0 };
  for (const ln of lines) {
    if (ln.gas === "CH4") byGas.CH4 += ln.kgCO2e;
    else if (ln.gas === "N2O") byGas.N2O += ln.kgCO2e;
    else byGas.CO2 += ln.kgCO2e;
  }
  const yieldTotal = num(s.yieldKgPerRai) * A;

  return {
    lines,
    totalKgCO2e: total,
    perRai: A > 0 ? total / A : 0,
    perKgProduct: yieldTotal > 0 ? total / yieldTotal : null,
    byGas,
    nInputs: { FSN, FON, FCR: FCR_raw },
    activity: {
      dieselL, gasolineL, otherFuelKgCO2, kwh, ureaKg,
      limestoneKg: num(s.limestoneKgPerRai) * A, dolomiteKg: num(s.dolomiteKgPerRai) * A,
      burnedRai, burnedDmKg: burnedRai * remainPerRai, burnCf, rice: riceAct,
    },
    warnings,
  };
}

export const lineValue = (r: ScenarioResult, key: string) => r.lines.find((l) => l.key === key)?.kgCO2e ?? 0;
export const sumLines = (r: ScenarioResult, keys: string[]) => keys.reduce((s, k) => s + lineValue(r, k), 0);

/** ปริมาณเชื้อเพลิงของการขนส่ง 1 รายการ (ลิตร หรือ กก.) [MRV Eq.10]
 *  แบบระยะทาง: ระยะทาง × (2 ถ้าคิดเที่ยวกลับ) × จำนวนเที่ยว ÷ กม./ลิตร */
export function transportLiters(t: import("./types").TransportUse): number {
  if (t.mode === "distance") {
    const kmpl = num(t.kmPerL);
    if (kmpl <= 0) return 0;
    return num(t.km) * (t.roundTrip === false ? 1 : 2) * Math.max(0, num(t.trips)) / kmpl;
  }
  return num(t.amount);
}
