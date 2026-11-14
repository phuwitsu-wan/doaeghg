import type { CropGroup, FieldRecord, Scenario, Settings, TreeInventory } from "./engine/types";

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export const DEFAULT_SETTINGS: Settings = { gwp: "AR5", elec: "tgo2026", elecCustom: null };

const RESIDUE_BY_CROP: Record<CropGroup, string> = {
  rice: "rice",
  field: "sugarcane",
  vegetable: "other",
  fruit: "other",
  forest: "other",
};

export function emptyScenario(crop: CropGroup): Scenario {
  return {
    areaRai: 0,
    yieldKgPerRai: 0,
    rice: { harvestedAreaRai: 0, days: 120, waterRegime: "continuous", preSeason: "short", organics: [] },
    chemFerts: [],
    orgFerts: [],
    limestoneKgPerRai: 0,
    dolomiteKgPerRai: 0,
    residue: { type: RESIDUE_BY_CROP[crop], kgPerRai: 0, removedPct: 0, burnedAreaRai: 0 },
    machines: [],
    transports: [],
  };
}

export function emptyTrees(crop: CropGroup): TreeInventory {
  return {
    method: "allometric",
    equation: "general",
    rootRatio: crop === "forest" ? "moistDecid" : "moistDecid",
    carbonFraction: 0.47,
    plotAreaRai: 1,
    baseline: [],
    current: [],
    years: 1,
    treeCount: 0,
  };
}

export const CROP_NAMES: Record<CropGroup, string[]> = {
  rice: ["ข้าวนาปี", "ข้าวนาปรัง", "ข้าวไร่"],
  field: ["อ้อย", "มันสำปะหลัง", "ข้าวโพดเลี้ยงสัตว์", "ถั่วเหลือง", "ถั่วลิสง", "อื่น ๆ"],
  vegetable: ["ผักใบ", "พริก", "มะเขือเทศ", "แตง", "หอม/กระเทียม", "อื่น ๆ"],
  fruit: ["มะม่วง", "ทุเรียน", "ลำไย", "มังคุด", "เงาะ", "ส้ม", "ยางพารา", "มะพร้าว", "อื่น ๆ"],
  forest: ["ปลูกป่าผสม", "สัก", "ยูคาลิปตัส", "กระถินเทพา", "ไม้พื้นถิ่น", "อื่น ๆ"],
};

export function newRecord(crop: CropGroup): FieldRecord {
  const now = new Date().toISOString();
  const s = emptyScenario(crop);
  return {
    id: uid(),
    createdAt: now,
    updatedAt: now,
    crop,
    cropName: CROP_NAMES[crop][0],
    standard: "mrv",
    hasProject: false,
    info: { farmer: "", plotName: "", province: "", district: "", subdistrict: "", lat: "", lng: "", season: String(new Date().getFullYear() + 543), officer: "", note: "" },
    baseline: s,
    project: structuredClone(s),
    trees: emptyTrees(crop),
  };
}

/** สร้างข้อมูลตัวอย่าง (ตามค่าใน Worksheet ของคู่มือ MRV) */
export function sampleRice(): FieldRecord {
  const r = newRecord("rice");
  r.info = { ...r.info, farmer: "ตัวอย่าง เกษตรกร", plotName: "แปลงตัวอย่าง 1", province: "นครสวรรค์", season: "2568" };
  r.hasProject = true;
  const b = r.baseline;
  b.areaRai = 20; b.yieldKgPerRai = 700;
  b.rice = { harvestedAreaRai: 20, days: 111, waterRegime: "continuous", preSeason: "short", organics: [] };
  b.chemFerts = [
    { id: uid(), round: 1, formula: "16-20-0", kgPerRai: 30 },
    { id: uid(), round: 2, formula: "46-0-0", kgPerRai: 15 },
    { id: uid(), round: 3, formula: "46-0-0", kgPerRai: 10 },
  ];
  b.residue = { type: "rice", kgPerRai: 725.6, removedPct: 0, burnedAreaRai: 20 };
  b.machines = [
    { id: uid(), stage: "เตรียมดิน", machine: "tractorM", fuel: "diesel", mode: "hours", hoursPerRai: 0.5, times: 2, lph: 14, liters: 0, kwh: 0 },
    { id: uid(), stage: "สูบน้ำ", machine: "pump", fuel: "diesel", mode: "hours", hoursPerRai: 1, times: 4, lph: 2, liters: 0, kwh: 0 },
    { id: uid(), stage: "เก็บเกี่ยว", machine: "combine", fuel: "diesel", mode: "hours", hoursPerRai: 0.25, times: 1, lph: 15, liters: 0, kwh: 0 },
  ];
  const p = structuredClone(b);
  p.rice.waterRegime = "awd";
  p.residue = { type: "rice", kgPerRai: 725.6, removedPct: 50, burnedAreaRai: 0 };
  p.chemFerts = p.chemFerts.map((f) => (f.formula === "46-0-0" ? { ...f, kgPerRai: f.kgPerRai * 0.8 } : f));
  p.machines = [...p.machines, { id: uid(), stage: "อัดฟาง", machine: "tractorS", fuel: "diesel", mode: "hours", hoursPerRai: 0.3, times: 1, lph: 8.4, liters: 0, kwh: 0 }];
  p.transports = [{ id: uid(), desc: "ขนส่งฟางอัดก้อนไปโรงงาน", fuel: "diesel", amount: 40 }];
  r.project = p;
  return r;
}
