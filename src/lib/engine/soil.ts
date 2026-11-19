import {
  BIOCHAR_F, BIOCHAR_FPERM, BIOCHAR_SMG, FUEL_NCV, SOC_FI, SOC_FLU, SOC_FMG, SOC_MAX_RATE_PER_RAI, SOC_REF, SOC_TRANSITION_YEARS,
  fuelCO2PerL,
} from "./factors";
import type { Biochar, SoilCarbon, SoilSample } from "./types";

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

/**
 * [T-VER-S-TOOL-01-02 ทางเลือกที่ 1] SOC (tC/ไร่) = Σ(%OC × BD × ความลึก × 0.16) / N
 * 0.16 = ค่าแปลงหน่วย (1 g = 10⁻⁶ t, 1 ไร่ = 1.6 × 10⁷ cm²)
 */
export function socFromSamples(samples: SoilSample[]): number | null {
  const ok = samples.filter((x) => x.socPct > 0 && x.bd > 0 && x.depthCm > 0);
  if (!ok.length) return null;
  return ok.reduce((s, x) => s + x.socPct * x.bd * x.depthCm * 0.16, 0) / ok.length;
}

export function socRefPerRai(soil: SoilCarbon): number {
  const ref = soil.socRefCustom && soil.socRefCustom > 0 ? soil.socRefCustom : SOC_REF[soil.climate]?.[soil.soilClass] ?? 38;
  return ref * 0.16; // tC/ha → tC/ไร่
}

/** [ทางเลือกที่ 2] SOC = SOCref × FLU × FMG × FI (ค่าเขตร้อนแห้ง/ชื้นตามเขตภูมิอากาศ) */
export function socFromFactors(soil: SoilCarbon, f: SoilCarbon["bl"]): number {
  const i = soil.climate === "T4" ? 0 : 1;
  return socRefPerRai(soil) * SOC_FLU[f.flu].v[i] * SOC_FMG[f.fmg].v[i] * SOC_FI[f.fi].v[i];
}

export interface SoilResult {
  method: SoilCarbon["method"];
  soc0PerRai: number; // tC/ไร่
  soctPerRai: number;
  ratePerRai: number | null; // dSOC (ทางเลือก 2) tC/ไร่/ปี
  capped: boolean;
  deltaTC: number; // ΔSOC ทั้งพื้นที่ (tC)
  deltaKgCO2: number; // × 44/12 × 1000
  years: number;
}

export function calcSoil(soil: SoilCarbon | undefined, areaRai: number): SoilResult | null {
  if (!soil?.enabled || !(areaRai > 0)) return null;
  const years = soil.years > 0 ? soil.years : 1;
  if (soil.method === "sample") {
    const s0 = socFromSamples(soil.baseline);
    const st = socFromSamples(soil.current);
    if (s0 == null || st == null) return null;
    const deltaTC = areaRai * (st - s0); // ΔSOC_t = Σ A_i × (SOC_i,t − SOC_i,0)
    return { method: "sample", soc0PerRai: s0, soctPerRai: st, ratePerRai: null, capped: false, deltaTC, deltaKgCO2: deltaTC * 44 / 12 * 1000, years };
  }
  const s0 = socFromFactors(soil, soil.bl);
  const st = socFromFactors(soil, soil.pj);
  let rate = (st - s0) / SOC_TRANSITION_YEARS; // dSOC = (SOC_t − SOC_0) / 20 ปี
  const capped = rate > SOC_MAX_RATE_PER_RAI;
  if (capped) rate = SOC_MAX_RATE_PER_RAI;
  const deltaTC = areaRai * rate * years; // ΔSOC_t = Σ A_i × dSOC × T
  return { method: "ref", soc0PerRai: s0, soctPerRai: st, ratePerRai: rate, capped, deltaTC, deltaKgCO2: deltaTC * 44 / 12 * 1000, years };
}

/* ======================= ถ่านชีวภาพ [T-VER-P-METH-14-03] ======================= */
export interface BiocharResult {
  beKg: number; // BE = W × FOC × Fperm × 44/12 (การกักเก็บ)
  fuelKg: number; // PE_FF (CO₂ ดีเซล)
  elecKg: number; // PE_EC
  fugitiveKg: number; // PE_fugitive = Q × SMG × f × GWP_CH4
  peKg: number;
  creditKg: number;
  fperm: number;
}

export function calcBiochar(b: Biochar | undefined, gwpCH4: number, efElec: number): BiocharResult | null {
  if (!b?.enabled || !(b.tonnesDry > 0)) return null;
  const W = num(b.tonnesDry);
  const foc = Math.min(100, Math.max(0, num(b.focPct))) / 100;
  const fperm = BIOCHAR_FPERM[b.process]?.value ?? 0.65;
  const beKg = W * foc * fperm * (44 / 12) * 1000;
  const fuelKg = num(b.dieselL) * fuelCO2PerL("diesel");
  const elecKg = num(b.kwh) * efElec;
  const fugitiveKg = W * BIOCHAR_SMG * BIOCHAR_F * gwpCH4 * 1000;
  const peKg = fuelKg + elecKg + fugitiveKg;
  return { beKg, fuelKg, elecKg, fugitiveKg, peKg, creditKg: Math.max(0, beKg - peKg), fperm };
}

export const DIESEL_NCV = FUEL_NCV.diesel;
