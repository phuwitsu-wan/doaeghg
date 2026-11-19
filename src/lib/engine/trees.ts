import { CARBON_FRACTIONS, DEADWOOD, MAI_PER_TREE, ROOT_RATIOS, type RootKey } from "./factors";
import type { TreeInventory, TreeRow } from "./types";

/**
 * สมการแอลโลเมตรี (ผลลัพธ์ กก. น้ำหนักแห้งเหนือพื้นดิน)
 * อ้างอิง T-VER-S-TOOL-01-01 ฉบับที่ 2 ภาคผนวกที่ 2 ตารางที่ 1–2
 * D = DBH ที่ 1.30 ม. (ซม.), D0 = เส้นผ่านศูนย์กลางชิดดิน (ซม.), H = ความสูงทั้งหมด (ม.)
 * ใบ (Ogawa): WL = (28/(WS+WB) + 0.025)⁻¹ โดย WS, WB, WL มีหน่วยเป็น "ตัน" ตามสมการต้นฉบับ
 *   ตัวอย่างต้นตะแบก D 50 ซม. H 30 ม. (ดร.นิตยา/อบก.): WL = 63.09 กก. — สมการนี้ให้ 62.99 กก.
 *   (ถ้าแทนค่าเป็น กก. จะได้ 24.5 กก. ซึ่งไม่ตรงตัวอย่าง และมีเพดานใบไม่เกิน 40 กก./ต้น)
 */
type Parts = { ws: number; wb: number; wl: number; wt: number };
const ogawaLeaf = (ws: number, wb: number) => (ws + wb > 0 ? 1000 / (28 / ((ws + wb) / 1000) + 0.025) : 0);
const p = (a: number, x: number, b: number) => a * Math.pow(x, b);
const only = (wt: number): Parts => ({ ws: 0, wb: 0, wl: 0, wt });
const sum3 = (ws: number, wb: number, wl: number): Parts => ({ ws, wb, wl, wt: ws + wb + wl });

/** D: ต้องใช้เส้นผ่านศูนย์กลางแบบไหน; H: ต้องใช้ความสูงไหม */
export interface Allometric {
  label: string;
  group: "tree" | "forest" | "fruit" | "palm" | "bamboo" | "climber" | "mangrove";
  source: string;
  d: "dbh" | "d0" | "none";
  h: boolean;
  root: RootKey;
  cf: number;
  fn: (D: number, H: number) => Parts;
}

const OGAWA_GENERAL = (D: number, H: number) => {
  const x = D * D * H;
  const ws = p(0.0396, x, 0.933);
  const wb = p(0.00349, x, 1.03);
  return sum3(ws, wb, ogawaLeaf(ws, wb));
};
const CF = CARBON_FRACTIONS;

export const ALLOMETRIC: Record<string, Allometric> = {
  general: { label: "พรรณไม้ทั่วไป / ป่าเต็งรัง / ป่าเบญจพรรณ", group: "tree", source: "Ogawa et al. (1965)", d: "dbh", h: true, root: "tgoGeneral", cf: CF.general.value, fn: OGAWA_GENERAL },
  moistEvergreen: {
    label: "ป่าดิบชื้น", group: "forest", source: "Ogawa et al. (1965)", d: "dbh", h: true, root: "tgoGeneral", cf: CF.general.value,
    fn: (D, H) => { const x = D * D * H; const ws = p(0.0396, x, 0.9326); const wb = p(0.006003, x, 1.027); return sum3(ws, wb, ogawaLeaf(ws, wb)); },
  },
  dryEvergreen: {
    label: "ป่าดิบแล้ง / ป่าดิบเขา", group: "forest", source: "Tsutsumi et al. (1983)", d: "dbh", h: true, root: "tgoGeneral", cf: CF.general.value,
    fn: (D, H) => { const x = D * D * H; return sum3(p(0.0509, x, 0.919), p(0.00893, x, 0.977), p(0.014, x, 0.669)); },
  },
  pine2: {
    label: "ป่าสนเขา (สนสองใบ)", group: "forest", source: "สุนันทา (2531)", d: "dbh", h: true, root: "tgoGeneral", cf: CF.general.value,
    fn: (D, H) => { const x = D * D * H; return sum3(p(0.2141, x, 0.9814), p(0.00002, x, 1.4561), p(0.00072, x, 1.0138)); },
  },
  pine3: {
    label: "ป่าสนเขา (สนสามใบ)", group: "forest", source: "พงษ์ศักดิ์ (2524)", d: "dbh", h: true, root: "tgoGeneral", cf: CF.general.value,
    fn: (D, H) => { const x = D * D * H; return sum3(p(0.02698, x, 0.946), p(0.00018, x, 1.455), p(0.00072, x, 1.094)); },
  },
  mangrove: {
    label: "ป่าชายเลน (โกงกาง)", group: "mangrove", source: "Komiyama et al. (1987)", d: "dbh", h: true, root: "tgoMangrove", cf: CF.mangrove.value,
    fn: (D, H) => { const x = D * D * H; return sum3(p(0.05466, x, 0.945), p(0.01579, x, 0.9124), p(0.0678, x, 0.5806)); },
  },
  mangroveOther: {
    label: "ป่าชายเลน (ชนิดอื่น)", group: "mangrove", source: "Komiyama et al. (1987)", d: "dbh", h: true, root: "tgoMangrove", cf: CF.mangrove.value,
    fn: (D, H) => { const x = D * D * H; return sum3(p(0.0449, x, 0.9549), p(0.02412, x, 0.8649), p(0.09422, x, 0.5439)); },
  },
  palm: {
    label: "กลุ่มปาล์ม (ปาล์มน้ำมัน มะพร้าว หมาก)", group: "palm", source: "Pearson et al. (2005)", d: "none", h: true, root: "tgoPalm", cf: CF.palm.value,
    fn: (_D, H) => only(6.666 + 12.826 * Math.sqrt(H) * Math.log(H)),
  },
  durian: { label: "ทุเรียน (วัดชิดดิน D0)", group: "fruit", source: "ลดาวัลย์ และออ (2561)", d: "d0", h: false, root: "tgoGeneral", cf: CF.general.value, fn: (D) => only(p(0.0078, D, 2.9605)) },
  rambutan: { label: "เงาะ (วัดชิดดิน D0)", group: "fruit", source: "ลดาวัลย์ และออ (2561)", d: "d0", h: false, root: "tgoGeneral", cf: CF.general.value, fn: (D) => only(p(0.0065, D, 3.3102)) },
  longkong: { label: "ลองกอง (วัดชิดดิน D0)", group: "fruit", source: "ลดาวัลย์ และออ (2561)", d: "d0", h: false, root: "tgoGeneral", cf: CF.general.value, fn: (D) => only(p(0.0234, D, 2.768)) },
  mangosteen: { label: "มังคุด (DBH)", group: "fruit", source: "ลดาวัลย์ และออ (2561)", d: "dbh", h: false, root: "tgoGeneral", cf: CF.general.value, fn: (D) => only(p(0.2164, D, 2.3548)) },
  bambooBongPa: { label: "ไผ่บงป่า", group: "bamboo", source: "อิทธิพงศ์ (2557)", d: "dbh", h: false, root: "tgoBamboo", cf: CF.general.value, fn: (D) => only(p(0.1466, D, 0.7187)) },
  bambooBongDam: { label: "ไผ่บงดำ", group: "bamboo", source: "Kutintara (1995)", d: "dbh", h: false, root: "tgoBamboo", cf: CF.general.value, fn: (D) => only(p(0.49522, D * D, 0.8726)) },
  bambooKhaoLam: { label: "ไผ่ข้าวหลาม", group: "bamboo", source: "Kutintara (1995)", d: "dbh", h: false, root: "tgoBamboo", cf: CF.general.value, fn: (D) => only(p(0.17446, D * D, 1.0437)) },
  bambooRai: { label: "ไผ่ไร่ และไผ่ผาก", group: "bamboo", source: "Kutintara (1995)", d: "dbh", h: false, root: "tgoBamboo", cf: CF.general.value, fn: (D) => only(p(0.2425, D * D, 1.0751)) },
  climber: { label: "กลุ่มเถาวัลย์", group: "climber", source: "ชิงชัยและคณะ (2554)", d: "dbh", h: false, root: "tgoClimber", cf: CF.general.value, fn: (D) => only(p(0.8622, D, 2.021)) },
};

export const eqOf = (key: string) => ALLOMETRIC[key] ?? ALLOMETRIC.general;

/** นับเป็น "ต้นไม้" ตามนิยาม T-VER หรือไม่ (DBH ≥ 4.5 ซม. และสูง > 1.30 ม.; ไผ่/เถาวัลย์/ปาล์มใช้เงื่อนไขตามสมการ) */
export function countable(eqKey: string, D: number, H: number): boolean {
  const e = eqOf(eqKey);
  if (e.group === "bamboo" || e.group === "climber") return D > 0;
  if (e.d === "none") return H > 1.3;
  if (e.d === "d0") return D > 0 && (H === 0 || H > 1.3);
  if (!e.h) return D >= 4.5;
  return D >= 4.5 && H > 1.3;
}

export interface StockResult {
  agbKg: number; // ต่อพื้นที่โครงการ
  bgbKg: number;
  carbonKg: number; // คาร์บอนในต้นไม้ (+ ไม้ตาย/เศษซาก ถ้าเลือก)
  deadKg: number; // คาร์บอนในไม้ตายและเศษซากพืช
  co2Kg: number;
  treesPerRai: number;
  smallTrees: number; // ต้นที่ไม่เข้านิยามต้นไม้ (ไม่นับตาม T-VER)
}

export function treeBiomass(equation: string, D: number, H: number): Parts {
  const eq = eqOf(equation);
  if ((eq.d !== "none" && !(D > 0)) || (eq.h && !(H > 0))) return { ws: 0, wb: 0, wl: 0, wt: 0 };
  return eq.fn(D, H);
}

export const rootRatio = (inv: TreeInventory) => (inv.transplanted ? 0 : ROOT_RATIOS[inv.rootRatio]?.value ?? 0.27);

export function stock(rows: TreeRow[], inv: TreeInventory, projectAreaRai: number): StockResult {
  const R = rootRatio(inv);
  const CFv = inv.carbonFraction > 0 ? inv.carbonFraction : 0.47;
  const dw = DEADWOOD[inv.deadwood ?? "none"] ?? DEADWOOD.none;
  let agbPlot = 0;
  let count = 0;
  let small = 0;
  for (const t of rows) {
    const n = Math.max(0, t.count || 0);
    if (!countable(inv.equation, t.dbh, t.height)) { small += n; continue; }
    agbPlot += treeBiomass(inv.equation, t.dbh, t.height).wt * n;
    count += n;
  }
  const plot = inv.plotAreaRai > 0 ? inv.plotAreaRai : projectAreaRai;
  const scale = plot > 0 ? projectAreaRai / plot : 0;
  const agbKg = agbPlot * scale;
  const bgbKg = agbKg * R;
  const treeC = (agbKg + bgbKg) * CFv;
  const deadKg = treeC * (dw.dw + dw.li);
  const carbonKg = treeC + deadKg;
  return { agbKg, bgbKg, carbonKg, deadKg, co2Kg: carbonKg * 44 / 12, treesPerRai: plot > 0 ? count / plot : 0, smallTrees: small };
}

export interface TreeResult {
  method: "allometric" | "count";
  baseline: StockResult | null;
  current: StockResult | null;
  removalKgCO2: number; // การกักเก็บที่เพิ่มขึ้นทั้งช่วง
  annualKgCO2: number;
}

export function calcTrees(inv: TreeInventory, projectAreaRai: number): TreeResult {
  const years = inv.years > 0 ? inv.years : 1;
  if (inv.method === "count") {
    // ทางเลือกที่ 1: C_TT = T × t × MAI × 10⁻³ (MAI 9.5 kgCO2/ต้น/ปี; แปลงย่อย ≤ 30 ไร่ รวม ≤ 1,000 ไร่)
    const annual = Math.max(0, inv.treeCount) * MAI_PER_TREE;
    return { method: "count", baseline: null, current: null, removalKgCO2: annual * years, annualKgCO2: annual };
  }
  const b = stock(inv.baseline, inv, projectAreaRai);
  const c = stock(inv.current, inv, projectAreaRai);
  const removal = c.co2Kg - b.co2Kg;
  return { method: "allometric", baseline: b, current: c, removalKgCO2: removal, annualKgCO2: removal / years };
}
