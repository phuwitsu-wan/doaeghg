import type { CFOAKey, FuelKey, GwpKey, MachineKey, ResidueKey, RootKey, SFpKey, SFwKey, TransportKey, ElecKey } from "./factors";

export type CropGroup = "rice" | "field" | "vegetable" | "fruit" | "forest";
export type Standard = "mrv" | "tver";

export const CROP_GROUPS: Record<CropGroup, { label: string; icon: string; examples: string; tverMethod: string }> = {
  rice: { label: "ข้าว", icon: "🌾", examples: "นาปี นาปรัง ข้าวไร่", tverMethod: "T-VER-P-METH-13-08 (การจัดการพื้นที่ปลูกข้าวที่ดี)" },
  field: { label: "พืชไร่", icon: "🌱", examples: "อ้อย มันสำปะหลัง ข้าวโพด", tverMethod: "T-VER-S-METH-13-05 (การใช้ปุ๋ยอย่างถูกวิธี)" },
  vegetable: { label: "พืชผัก", icon: "🥬", examples: "ผักใบ พริก มะเขือเทศ", tverMethod: "T-VER-S-METH-13-05 (การใช้ปุ๋ยอย่างถูกวิธี)" },
  fruit: { label: "ไม้ผล / พืชยืนต้น", icon: "🥭", examples: "มะม่วง ทุเรียน ลำไย ยางพารา", tverMethod: "T-VER-S-METH-13-06 (การปลูกพืชเกษตรยืนต้น)" },
  forest: { label: "ป่าไม้", icon: "🌳", examples: "ปลูกป่า สวนป่า ไม้โตเร็ว", tverMethod: "T-VER-S-METH-13-01 / 13-04 (การปลูกป่า)" },
};

export interface ChemFertApp {
  id: string;
  round: number; // ครั้งที่ใส่
  formula: string; // N-P-K
  kgPerRai: number;
}
export interface OrgFertApp {
  id: string;
  type: string; // key of ORGANIC_FERTS
  nPct: number;
  kgPerRai: number;
}
export interface RiceOrganic {
  id: string;
  type: CFOAKey;
  kgPerRai: number; // น้ำหนักแห้งสำหรับฟาง, น้ำหนักสดสำหรับอื่น ๆ
}
export interface MachineUse {
  id: string;
  stage: string; // เตรียมดิน / ปลูก / ใส่ปุ๋ย / ...
  machine: MachineKey;
  fuel: FuelKey | "electric";
  mode: "hours" | "liters";
  hoursPerRai: number; // ชม./ไร่/ครั้ง
  times: number; // จำนวนครั้ง
  lph: number; // ลิตร/ชม. (แก้ไขได้)
  liters: number; // ลิตร (รวมทั้งแปลง) เมื่อ mode = liters
  kwh: number; // kWh (รวมทั้งแปลง) เมื่อ fuel = electric
  hp?: number; // แรงม้า (รถแทรกเตอร์)
}
export interface TransportUse {
  id: string;
  desc: string;
  fuel: TransportKey;
  amount: number; // ลิตร หรือ กก. รวม
}

/** ข้อมูลกิจกรรมของ 1 กรณี (กรณีฐาน หรือ กรณีดำเนินโครงการ) */
export interface Scenario {
  areaRai: number;
  yieldKgPerRai: number;
  rice: {
    harvestedAreaRai: number;
    days: number;
    waterRegime: SFwKey;
    preSeason: SFpKey;
    organics: RiceOrganic[];
  };
  chemFerts: ChemFertApp[];
  orgFerts: OrgFertApp[];
  limestoneKgPerRai: number;
  dolomiteKgPerRai: number;
  residue: {
    type: ResidueKey;
    kgPerRai: number; // ปริมาณเศษวัสดุทั้งหมดหลังเก็บเกี่ยว (แห้ง)
    removedPct: number; // % ที่นำออก (อัดฟาง/อัดใบ ขาย)
    burnedAreaRai: number; // พื้นที่ที่เผา
  };
  machines: MachineUse[];
  transports: TransportUse[];
}

export interface TreeRow {
  id: string;
  dbh: number; // ซม.
  height: number; // ม.
  count: number; // จำนวนต้นที่มีขนาดนี้
}
export interface TreeInventory {
  method: "allometric" | "count";
  equation: string; // key of ALLOMETRIC
  rootRatio: RootKey;
  carbonFraction: number;
  plotAreaRai: number; // พื้นที่แปลงตัวอย่าง
  baseline: TreeRow[]; // ปีฐาน (t0)
  current: TreeRow[]; // ปีที่ติดตามผล (t)
  years: number; // ระยะเวลาระหว่าง t0 กับ t
  treeCount: number; // สำหรับ method = count
}

export interface Settings {
  gwp: GwpKey;
  elec: ElecKey;
  elecCustom: number | null;
  /** ค่าอ้างอิงที่หน่วยงานกำหนดเอง (kgCO2e/กก.ผลผลิต) ตามชนิดพืช */
  benchmarks?: Record<string, number>;
}

export interface FieldRecord {
  id: string;
  createdAt: string;
  updatedAt: string;
  crop: CropGroup;
  cropName: string;
  standard: Standard;
  hasProject: boolean;
  info: {
    farmer: string;
    plotName: string;
    province: string;
    district: string;
    subdistrict: string;
    lat: string;
    lng: string;
    season: string;
    officer: string;
    note: string;
  };
  baseline: Scenario;
  project: Scenario;
  trees: TreeInventory;
  /** ผู้บันทึก (เจ้าหน้าที่) ณ ตอนสร้างแปลง */
  createdBy?: { id: string; name: string; agency: string };
}

export interface SourceLine {
  key: string;
  label: string;
  group: "fire" | "rice" | "n2o" | "co2soil" | "energy";
  gas: "CO2" | "CH4" | "N2O" | "mix";
  kgCO2e: number;
  mass?: number; // kg ของก๊าซนั้น (ถ้ามี)
  eq: string; // อ้างอิงสมการ
}

export interface ScenarioResult {
  lines: SourceLine[];
  totalKgCO2e: number;
  perRai: number;
  perKgProduct: number | null;
  byGas: { CO2: number; CH4: number; N2O: number };
  nInputs: { FSN: number; FON: number; FCR: number };
  warnings: string[];
}
