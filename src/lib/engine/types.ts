import type {
  CFOAKey, ClimateKey, DeadwoodKey, ElecKey, FiKey, FluKey, FmgKey, FpermKey, FuelKey, GwpKey, MachineKey, ResidueKey, RootKey,
  SFpKey, SFwKey, SoilClassKey, TransportKey,
} from "./factors";

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
  hp?: number; // แรงม้า (รถแทรกเตอร์และเครื่องที่ติดแทรกเตอร์)
  label?: string; // ชื่อเครื่องจักรตามรายการของพืช เช่น "รถคีบอ้อย"
}
export interface TransportUse {
  id: string;
  desc: string;
  fuel: TransportKey;
  amount: number; // ลิตร หรือ กก. รวม (เมื่อ mode = fuel)
  /** distance: คิดจากระยะทาง ÷ อัตราสิ้นเปลือง (กม./ลิตร) */
  mode?: "fuel" | "distance";
  vehicle?: string; // รหัสชนิดรถ (pickup, truck6, truck10, truck18)
  km?: number; // ระยะทางเที่ยวเดียว
  trips?: number; // จำนวนเที่ยว
  kmPerL?: number; // อัตราสิ้นเปลือง กม./ลิตร
  roundTrip?: boolean; // คิดเที่ยวกลับด้วย
}

/** ข้อมูลกิจกรรมของ 1 กรณี (กรณีฐาน หรือ กรณีดำเนินโครงการ) */
export interface Scenario {
  areaRai: number;
  yieldKgPerRai: number;
  rice: {
    harvestedAreaRai: number;
    days: number;
    waterRegime: SFwKey;
    plantMethod?: string; // วิธีปลูกข้าว: transplant, machineTransplant, wetBroadcast, dryBroadcast, drone
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
  /** ไม้ขุดล้อมมาปลูก: ไม่คิดมวลชีวภาพใต้ดิน (bBLG = 0) [TOOL-01-01 ขั้นตอนที่ 3] */
  transplanted?: boolean;
  /** ไม้ตายและเศษซากพืช [TOOL-01-03] */
  deadwood?: DeadwoodKey;
}

/** ตัวอย่างดิน 1 จุด (0–30 ซม.) */
export interface SoilSample {
  id: string;
  socPct: number; // กรัมคาร์บอน/ดิน 100 กรัม (%OC)
  bd: number; // ความหนาแน่นรวม g/cm³
  depthCm: number; // ความลึก ≥ 30 ซม.
}
/** คาร์บอนในดิน [T-VER-S-TOOL-01-02] */
export interface SoilCarbon {
  enabled: boolean;
  method: "sample" | "ref"; // ทางเลือกที่ 1 เก็บตัวอย่าง / ทางเลือกที่ 2 ค่าอ้างอิง (โครงการ ≤ 1,000 tCO2e/ปี)
  baseline: SoilSample[];
  current: SoilSample[];
  years: number; // ปีที่ติดตามผล
  climate: ClimateKey;
  soilClass: SoilClassKey;
  socRefCustom: number | null; // tC/ha ถ้ามีค่าวัดจากพื้นที่ธรรมชาติ
  bl: { flu: FluKey; fmg: FmgKey; fi: FiKey };
  pj: { flu: FluKey; fmg: FmgKey; fi: FiKey };
}
/** ถ่านชีวภาพ [T-VER-P-METH-14-03] */
export interface Biochar {
  enabled: boolean;
  tonnesDry: number; // W น้ำหนักแห้ง (ตัน/ปี)
  focPct: number; // %C อินทรีย์ในถ่าน (ผลแล็บ)
  process: FpermKey;
  dieselL: number; // เชื้อเพลิงในการผลิต/ขนส่งในโครงการ
  kwh: number;
}
/** ตัวเลือกการคิดคาร์บอนเครดิต T-VER */
export interface TverOptions {
  /** standard: S-METH, premium: P-METH */
  track: "standard" | "premium";
  /** ค่าปรับลดความไม่แน่นอน (0–1) */
  ud: number;
  /** คาร์บอนในวัสดุอินทรีย์ที่นำมาจากภายนอกและเพิ่มจากกรณีฐาน (กก.C) — รั่วไหล 12% */
  outsideOrgC: number;
  landRight: boolean; // มีหนังสือแสดงสิทธิในที่ดิน
  history3y: boolean; // มีข้อมูลย้อนหลัง ≥ 3 ปี
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
  soil?: SoilCarbon;
  biochar?: Biochar;
  tverOpt?: TverOptions;
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
  /** ข้อมูลกิจกรรม (activity data) ที่ใช้บันทึกพารามิเตอร์ตามมาตรฐาน */
  activity: {
    dieselL: number;
    gasolineL: number;
    otherFuelKgCO2: number;
    kwh: number;
    ureaKg: number;
    limestoneKg: number;
    dolomiteKg: number;
    burnedRai: number;
    burnedDmKg: number; // มวลแห้งที่ถูกเผา (ก่อนคูณ Cf)
    burnCf: number;
    rice?: { harvestedRai: number; days: number; sfw: number; sfp: number; sfo: number; efDaily: number };
  };
  warnings: string[];
}
