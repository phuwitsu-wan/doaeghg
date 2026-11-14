import { MAI_PER_TREE, ROOT_RATIOS } from "./factors";
import type { TreeInventory, TreeRow } from "./types";

/**
 * สมการแอลโลเมตรี (D = DBH ซม., H = ความสูง ม., ผลลัพธ์ กก. น้ำหนักแห้ง)
 * อ้างอิง T-VER-TOOL-FOR/AGR-01 ภาคผนวก 2
 * ใบ (Ogawa): 1/WL = 28/(WS+WB) + 0.025  (รูปแบบดั้งเดิมของ Ogawa et al., 1965)
 */
type Parts = { ws: number; wb: number; wl: number; wt: number };
const ogawaLeaf = (ws: number, wb: number) => (ws + wb > 0 ? 1 / (28 / (ws + wb) + 0.025) : 0);
const p = (a: number, x: number, b: number) => a * Math.pow(x, b);

export const ALLOMETRIC: Record<string, { label: string; use: string; source: string; fn: (D: number, H: number) => Parts }> = {
  general: {
    label: "พรรณไม้ทั่วไป / ป่าเต็งรัง / ป่าเบญจพรรณ",
    use: "ไม้ผล ไม้ยืนต้นทั่วไป ป่าผลัดใบ",
    source: "Ogawa et al. (1965)",
    fn: (D, H) => {
      const x = D * D * H;
      const ws = p(0.0396, x, 0.933);
      const wb = p(0.00349, x, 1.03);
      const wl = ogawaLeaf(ws, wb);
      return { ws, wb, wl, wt: ws + wb + wl };
    },
  },
  moistEvergreen: {
    label: "ป่าดิบชื้น",
    use: "ป่าดิบชื้น",
    source: "Ogawa et al. (1965)",
    fn: (D, H) => {
      const x = D * D * H;
      const ws = p(0.0396, x, 0.9326);
      const wb = p(0.006003, x, 1.027);
      const wl = ogawaLeaf(ws, wb);
      return { ws, wb, wl, wt: ws + wb + wl };
    },
  },
  dryEvergreen: {
    label: "ป่าดิบแล้ง / ป่าดิบเขา",
    use: "ป่าดิบแล้ง ป่าดิบเขา",
    source: "Tsutsumi et al. (1983)",
    fn: (D, H) => {
      const x = D * D * H;
      const ws = p(0.0509, x, 0.919);
      const wb = p(0.00893, x, 0.977);
      const wl = p(0.014, x, 0.669);
      return { ws, wb, wl, wt: ws + wb + wl };
    },
  },
  mangrove: {
    label: "ป่าชายเลน (โกงกาง)",
    use: "ไม้โกงกาง",
    source: "Komiyama et al. (1987)",
    fn: (D, H) => {
      const x = D * D * H;
      const ws = p(0.05466, x, 0.945);
      const wb = p(0.01579, x, 0.9124);
      const wl = p(0.0678, x, 0.5806);
      return { ws, wb, wl, wt: ws + wb + wl };
    },
  },
  mangroveOther: {
    label: "ป่าชายเลน (ชนิดอื่น)",
    use: "ไม้ป่าชายเลนชนิดอื่น",
    source: "Komiyama et al. (1987)",
    fn: (D, H) => {
      const x = D * D * H;
      const ws = p(0.0449, x, 0.9549);
      const wb = p(0.02412, x, 0.8649);
      const wl = p(0.09422, x, 0.5439);
      return { ws, wb, wl, wt: ws + wb + wl };
    },
  },
};

export interface StockResult {
  agbKg: number; // ต่อพื้นที่โครงการ
  bgbKg: number;
  carbonKg: number;
  co2Kg: number;
  treesPerRai: number;
  smallTrees: number; // ต้นที่ DBH < 4.5 ซม. หรือสูง ≤ 1.3 ม. (ไม่นับตาม T-VER)
}

export function treeBiomass(equation: string, D: number, H: number): Parts {
  const eq = ALLOMETRIC[equation] ?? ALLOMETRIC.general;
  if (!(D > 0) || !(H > 0)) return { ws: 0, wb: 0, wl: 0, wt: 0 };
  return eq.fn(D, H);
}

export function stock(rows: TreeRow[], inv: TreeInventory, projectAreaRai: number): StockResult {
  const R = ROOT_RATIOS[inv.rootRatio]?.value ?? 0.2;
  const CF = inv.carbonFraction > 0 ? inv.carbonFraction : 0.47;
  let agbPlot = 0;
  let count = 0;
  let small = 0;
  for (const t of rows) {
    const n = Math.max(0, t.count || 0);
    if (!(t.dbh >= 4.5) || !(t.height > 1.3)) { small += n; continue; }
    agbPlot += treeBiomass(inv.equation, t.dbh, t.height).wt * n;
    count += n;
  }
  const plot = inv.plotAreaRai > 0 ? inv.plotAreaRai : projectAreaRai;
  const scale = plot > 0 ? projectAreaRai / plot : 0;
  const agbKg = agbPlot * scale;
  const bgbKg = agbKg * R;
  const carbonKg = (agbKg + bgbKg) * CF;
  return { agbKg, bgbKg, carbonKg, co2Kg: carbonKg * 44 / 12, treesPerRai: plot > 0 ? count / plot : 0, smallTrees: small };
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
    // Option 1 [T-VER Tool]: จำนวนต้น × 9.5 kgCO2/ต้น/ปี (แปลงย่อย ≤ 30 ไร่ รวม ≤ 1,000 ไร่)
    const annual = Math.max(0, inv.treeCount) * MAI_PER_TREE;
    return { method: "count", baseline: null, current: null, removalKgCO2: annual * years, annualKgCO2: annual };
  }
  const b = stock(inv.baseline, inv, projectAreaRai);
  const c = stock(inv.current, inv, projectAreaRai);
  const removal = c.co2Kg - b.co2Kg;
  return { method: "allometric", baseline: b, current: c, removalKgCO2: removal, annualKgCO2: removal / years };
}
