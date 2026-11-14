/**
 * ค่าสัมประสิทธิ์และค่าคงที่ทั้งหมดที่ใช้ในการคำนวณ
 * ทุกค่ามีแหล่งอ้างอิงกำกับ (ดูหน้า "วิธีการคำนวณ" ในแอป)
 *
 * แหล่งหลัก:
 *  [MRV]  คู่มือ MRV การปล่อยก๊าซเรือนกระจกในภาคเกษตร (GIZ/TGC EMC, 2568) และ Worksheet_Rice/Sugarcane_GHG_Cal
 *  [IPCC06] 2006 IPCC Guidelines Vol.2 (Energy) / Vol.4 (AFOLU)
 *  [IPCC19] 2019 Refinement to the 2006 IPCC Guidelines Vol.4
 *  [TGO]  องค์การบริหารจัดการก๊าซเรือนกระจก (อบก.)
 *  [TVER-13-08] T-VER-P-METH-13-08 v01 Enhanced Good Practices in Paddy Rice Field
 *  [TVER-13-05] T-VER-S-METH-13-05 v03 Good Fertilization Practice in Agricultural Land
 *  [TVER-13-06] T-VER-S-METH-13-06 v03 Perennial Crop Plantation
 *  [TVER-TOOL]  T-VER-TOOL-FOR/AGR-01 (T-VER-S-TOOL-01-01) Calculation for Carbon Sequestration
 */

export const RAI_PER_HA = 6.25;
export const HA_PER_RAI = 0.16;

/** GWP 100 ปี — AR5 ใช้กับ T-VER ตั้งแต่ 1 ม.ค. 2564 [TGO]; AR6 เตรียมไว้สำหรับอนาคต */
export const GWP_SETS = {
  AR5: { label: "IPCC AR5 (ค่าเริ่มต้น / T-VER)", CO2: 1, CH4: 28, N2O: 265 },
  AR4: { label: "IPCC AR4 (T-VER ก่อนปี 2564)", CO2: 1, CH4: 25, N2O: 298 },
  AR6: { label: "IPCC AR6 (ยังไม่บังคับใช้)", CO2: 1, CH4: 27, N2O: 273 },
} as const;
export type GwpKey = keyof typeof GWP_SETS;

/* ---------- Rice CH4 (IPCC 2019 Tables 5.11–5.14) [MRV Eq.2] ---------- */
export const EF_C_RICE = 1.22; // kgCH4/ha/day, Southeast Asia, IPCC19 Table 5.11

export const SF_W = {
  upland: { label: "ข้าวไร่ – ไม่ขังน้ำ", value: 0.0, drained: true },
  continuous: { label: "นาชลประทาน – ขังน้ำต่อเนื่อง", value: 1.0, drained: false },
  single: { label: "นาชลประทาน – ขังน้ำเป็นระยะ ระบายน้ำ 1 ครั้ง", value: 0.71, drained: true },
  multiple: { label: "นาชลประทาน – ขังน้ำเป็นระยะ ระบายน้ำหลายครั้ง", value: 0.55, drained: true },
  awd: { label: "นาชลประทาน – เปียกสลับแห้ง (AWD)", value: 0.55, drained: true },
  rainfed: { label: "นาน้ำฝน – นาลุ่ม (ฝนตกต่อเนื่อง)", value: 0.54, drained: true },
  drought: { label: "นาน้ำฝน – นาดอน (แห้งแล้ง)", value: 0.16, drained: true },
  deep: { label: "นาน้ำฝน – นาน้ำลึก", value: 0.06, drained: true },
} as const;
export type SFwKey = keyof typeof SF_W;

export const SF_P = {
  flooded30: { label: "ขังน้ำก่อนปลูก มากกว่า 30 วัน", value: 2.41 },
  short: { label: "ไม่ขังน้ำก่อนปลูก < 180 วัน หรือขังน้ำสั้นๆ < 30 วัน", value: 1.0 },
  dry180: { label: "ไม่ขังน้ำก่อนปลูก มากกว่า 180 วัน", value: 0.89 },
  dry365: { label: "ไม่ขังน้ำก่อนปลูก มากกว่า 365 วัน", value: 0.59 },
} as const;
export type SFpKey = keyof typeof SF_P;

export const CFOA = {
  strawShort: { label: "ไถกลบฟางข้าวก่อนปลูก < 30 วัน", value: 1.0 },
  strawLong: { label: "ไถกลบฟางข้าวก่อนปลูก > 30 วัน", value: 0.19 },
  manure: { label: "ปุ๋ยคอก", value: 0.21 },
  compost: { label: "ปุ๋ยหมัก", value: 0.17 },
  green: { label: "ปุ๋ยพืชสด", value: 0.45 },
} as const;
export type CFOAKey = keyof typeof CFOA;

/* ---------- N2O (IPCC 2019 Tables 11.1, 11.3) [MRV Eq.3–5] ---------- */
export const N2O = {
  EF1: 0.01, // kg N2O-N / kg N ดินเกษตรทั่วไป
  EF1FR: 0.004, // นาข้าว (aggregated)
  EF1FR_CONT: 0.003, // นาข้าวขังน้ำต่อเนื่อง (disaggregated) [TVER-13-08]
  EF1FR_DRAIN: 0.005, // นาข้าวระบายน้ำ 1 ครั้ง/หลายครั้ง (disaggregated) [TVER-13-08]
  FRAC_GASF: 0.11,
  FRAC_GASM: 0.21,
  EF4: 0.01,
  FRAC_LEACH: 0.24,
  EF5: 0.011,
};

/** ปุ๋ยเคมีสูตรที่พบบ่อย (จากแบบสำรวจ TGC EMC) — %N คือตัวเลขตัวแรกของสูตร */
export const CHEM_FERTS = ["46-0-0", "15-15-15", "16-20-0", "16-16-8", "16-12-8", "18-12-6", "20-20-0", "18-46-0", "21-0-0", "0-0-60", "0-3-0"];

/** %N ในปุ๋ยอินทรีย์ [MRV ตาราง 4.4, 4.5 ใน Worksheet] และหมวด CFOA สำหรับนาข้าว */
export const ORGANIC_FERTS: Record<string, { label: string; nPct: number; cfoa: CFOAKey }> = {
  cow: { label: "มูลโค", nPct: 1.1, cfoa: "manure" },
  buffalo: { label: "มูลกระบือ (แห้ง)", nPct: 1.0, cfoa: "manure" },
  duck: { label: "มูลเป็ด (แห้ง)", nPct: 0.8, cfoa: "manure" },
  chicken: { label: "มูลไก่", nPct: 2.7, cfoa: "manure" },
  bat: { label: "มูลค้างคาว", nPct: 3.1, cfoa: "manure" },
  pig: { label: "มูลสุกร", nPct: 1.3, cfoa: "manure" },
  raintree: { label: "ใบจามจุรีหมัก", nPct: 1.45, cfoa: "compost" },
  strawCow: { label: "ฟางข้าวหมักผสมมูลโค", nPct: 1.82, cfoa: "compost" },
  strawChicken: { label: "ฟางข้าวหมักผสมมูลไก่", nPct: 1.07, cfoa: "compost" },
  hyacinthPig: { label: "ผักตบชวาหมักผสมมูลสุกร", nPct: 1.85, cfoa: "compost" },
  cornCow: { label: "ตอซังข้าวโพดหมักผสมมูลโค", nPct: 2.43, cfoa: "compost" },
  cornChicken: { label: "ตอซังข้าวโพดหมักผสมมูลไก่", nPct: 1.73, cfoa: "compost" },
  compost: { label: "ปุ๋ยหมัก (ทั่วไป)", nPct: 1.7, cfoa: "compost" },
  green: { label: "ปุ๋ยพืชสด", nPct: 1.7, cfoa: "green" },
  other: { label: "อื่น ๆ (ค่าเฉลี่ย)", nPct: 1.7, cfoa: "compost" },
};

/* ---------- Urea / Lime (IPCC 2006 Vol.4 Ch.11) [MRV Eq.6–7] ---------- */
export const EF_UREA = 0.2; // kg C / kg urea
export const EF_LIMESTONE = 0.12; // kg C / kg
export const EF_DOLOMITE = 0.13; // kg C / kg

/* ---------- Crop residues & burning [MRV Eq.1, Eq.3.3; IPCC 2006 Tables 2.4–2.6] ---------- */
export const BURN = {
  CF: 0.8, // combustion factor, crop residues (Table 2.6)
  EF_CH4: 2.7, // g/kg dm burnt (Table 2.5, agricultural residues)
  EF_N2O: 0.07,
  UNBURNT_FRACTION: 0.2, // [MRV Eq.3.3] เศษวัสดุที่เหลือหลังเผา = ก่อนเผา × 0.2
};

/**
 * ชนิดเศษวัสดุ: %N [MRV Eq.3.3] และปริมาณเศษวัสดุอ้างอิง (kg แห้ง/ไร่) ใช้เป็นค่าเริ่มต้นเท่านั้น
 * ข้าว: ผลเก็บตัวอย่างฟาง+ตอซัง จ.นครสวรรค์ (Worksheet, 725.6 kg/ไร่)
 * อ้อย/ข้าวโพด: IPCC 2006 Table 2.4 (biomass consumption ×1000/6.25 ÷ Cf) — ควรแทนด้วยค่าวัดจริง
 */
export const RESIDUES: Record<string, { label: string; nPct: number; defaultKgPerRai: number; note: string }> = {
  rice: { label: "ตอซังและฟางข้าว", nPct: 0.62, defaultKgPerRai: 725.6, note: "ค่าวัด จ.นครสวรรค์ (คู่มือ MRV)" },
  sugarcane: { label: "ใบและยอดอ้อย", nPct: 0.51, defaultKgPerRai: 1300, note: "IPCC 2006 Table 2.4 (6.5 t/ha ÷ Cf 0.8)" },
  maize: { label: "ต้นและซังข้าวโพด", nPct: 0.65, defaultKgPerRai: 2000, note: "IPCC 2006 Table 2.4 (10 t/ha ÷ Cf 0.8)" },
  other: { label: "เศษวัสดุพืชอื่น ๆ", nPct: 0.59, defaultKgPerRai: 0, note: "ระบุค่าวัดจริง" },
};
export type ResidueKey = string;

/* ---------- Fuel & energy [MRV Eq.8–10, Worksheet 'Data & EF'] ---------- */
/** Off-road (เครื่องจักรเกษตร) kgCO2e/L — IPCC Vol.2 Table 3.3.1 + NCV DEDE + GWP AR5 (ตาราง CFO ของ อบก.) */
export const FUELS = {
  diesel: { label: "ดีเซล", efPerL: 2.9793 },
  gas4: { label: "เบนซิน 4 จังหวะ", efPerL: 2.2738 },
  gas2: { label: "เบนซิน 2 จังหวะ", efPerL: 2.3171 },
} as const;
export type FuelKey = keyof typeof FUELS;

/** อัตราสิ้นเปลืองน้ำมันของเครื่องจักร L/ชม. [MRV Eq.8.2] */
export const MACHINES = {
  sprayer: { label: "เครื่องพ่นสะพายหลัง", lph: 0.5, fuel: "gas2" as FuelKey },
  pump: { label: "เครื่องสูบน้ำ", lph: 2.0, fuel: "diesel" as FuelKey },
  tractorXS: { label: "แทรกเตอร์ < 21 แรงม้า (รถไถเดินตาม)", lph: 2.4, fuel: "diesel" as FuelKey },
  tractorS: { label: "แทรกเตอร์ 21–45 แรงม้า", lph: 8.4, fuel: "diesel" as FuelKey },
  tractorM: { label: "แทรกเตอร์ 46–75 แรงม้า", lph: 14.0, fuel: "diesel" as FuelKey },
  tractorL: { label: "แทรกเตอร์ > 75 แรงม้า", lph: 23.4, fuel: "diesel" as FuelKey },
  transplanterWalk: { label: "รถดำนาเดินตาม < 15 แรงม้า", lph: 1.0, fuel: "gas4" as FuelKey },
  transplanterRide: { label: "รถดำนานั่งขับ > 15 แรงม้า", lph: 3.8, fuel: "diesel" as FuelKey },
  combine: { label: "รถเกี่ยวนวดข้าว", lph: 15.0, fuel: "diesel" as FuelKey },
  caneHarvester: { label: "รถตัดอ้อย", lph: 23.4, fuel: "diesel" as FuelKey },
  custom: { label: "กำหนดเอง", lph: 0, fuel: "diesel" as FuelKey },
} as const;
export type MachineKey = keyof typeof MACHINES;

/** ค่าการปล่อยจากการใช้ไฟฟ้า kgCO2e/kWh — ให้ผู้ดูแลเลือก/แก้ได้ */
export const ELEC_EF = {
  tgo2026: { label: "อบก. CFO Scope 2 (บังคับใช้ 1 ม.ค. 2569)", value: 0.475 },
  tgo2016: { label: "Grid mix 2016–2018 (ตามคู่มือ MRV/Worksheet)", value: 0.4999 },
} as const;
export type ElecKey = keyof typeof ELEC_EF;

/** การขนส่ง (On-road) [MRV Eq.10, ตาราง CFO อบก.] */
export const TRANSPORT_FUELS = {
  diesel: { label: "น้ำมันดีเซล (ลิตร)", ef: 2.7406, unit: "L" },
  gasoline: { label: "น้ำมันเบนซิน – ไม่ควบคุม (ลิตร)", ef: 2.2394, unit: "L" },
  gasolineCat: { label: "น้ำมันเบนซิน – มีตัวเร่งปฏิกิริยา (ลิตร)", ef: 2.2719, unit: "L" },
  cng: { label: "ก๊าซธรรมชาติอัด NGV (กก.)", ef: 2.2609, unit: "kg" },
  lpgL: { label: "LPG (ลิตร)", ef: 1.7306, unit: "L" },
  lpgKg: { label: "LPG (กก.)", ef: 3.2049, unit: "kg" },
} as const;
export type TransportKey = keyof typeof TRANSPORT_FUELS;

/* ---------- Trees [TVER-TOOL Appendix 2] ---------- */
export const CARBON_FRACTION = 0.47; // IPCC default
export const MAI_PER_TREE = 9.5; // kgCO2/ต้น/ปี (Option 1 นับจำนวนต้น)

/** สัดส่วนรากต่อลำต้น (R) — IPCC 2006 Vol.4 Table 4.4 */
export const ROOT_RATIOS = {
  moistDecid: { label: "ป่าเขตร้อนชื้นผลัดใบ (AGB < 125 t/ha)", value: 0.2 },
  moistDecidHigh: { label: "ป่าเขตร้อนชื้นผลัดใบ (AGB > 125 t/ha)", value: 0.24 },
  rainforest: { label: "ป่าดิบชื้นเขตร้อน", value: 0.37 },
  dryLow: { label: "ป่าเขตร้อนแห้ง (AGB < 20 t/ha)", value: 0.56 },
  dryHigh: { label: "ป่าเขตร้อนแห้ง (AGB > 20 t/ha)", value: 0.28 },
  mountain: { label: "ป่าภูเขาเขตร้อน", value: 0.27 },
} as const;
export type RootKey = keyof typeof ROOT_RATIOS;

/* ---------- T-VER specific ---------- */
export const TVER = {
  RICE_CONSERVATIVENESS: 0.89, // CF applied to baseline CH4 [TVER-13-08]
  RICE_UNCERTAINTY_DEDUCTION: 0.15, // Method 3 (default values) [TVER-13-08]
  SIGNIFICANCE: 0.05, // fuel/burning counted if ≥ 5% of reductions
  MIN_N_REDUCTION: 0.05, // chemical N must fall ≥ 5% [13-05, 13-06, 13-08]
};
