import type { FuelKey, MachineKey } from "./engine/factors";
import type { CropGroup } from "./engine/types";

/**
 * รายการเครื่องจักรแยกตามชนิดพืชและขั้นตอน
 * อัตราสิ้นเปลือง:
 *  [MRV]   คู่มือ MRV Eq.8.2 (แทรกเตอร์ตามแรงม้า, รถดำนา, รถเกี่ยวนวด, รถตัดอ้อย, เครื่องสูบน้ำ, เครื่องพ่นสะพายหลัง)
 *  [กลุ่มฯ] ข้อมูลจากกลุ่มอารักขาพืช สนง.เกษตรจังหวัดเพชรบูรณ์ (รถคีบอ้อย, รถตีใบ, รถบรรทุก)
 *  [ประมาณ] ค่าประมาณทั่วไป ผู้ใช้แก้ได้ในแต่ละแถว
 * เครื่องที่ "ติดแทรกเตอร์" คิดน้ำมันตามแรงม้าของแทรกเตอร์ [MRV]
 */
export interface MachineDef {
  id: string;
  label: string;
  sub: string; // คำอธิบายสั้น ๆ บนปุ่ม
  base: MachineKey; // กลุ่มในตาราง MRV
  lph: number;
  fuel: FuelKey | "electric";
  hp?: number; // มีแรงม้า = คิดน้ำมันตามกลุ่มแรงม้าของแทรกเตอร์
  note?: string; // คำแนะนำในการกรอก
  perTonHour?: number; // ความสามารถทำงาน ตัน/ชม. (ใช้ประมาณชั่วโมงจากผลผลิต)
  source: "MRV" | "กลุ่มอารักขาพืช" | "ค่าประมาณ";
}

const M = (d: MachineDef) => d;

export const MACHINE_DEFS = {
  walkTractor: M({ id: "walkTractor", label: "รถไถเดินตาม", sub: "ต่ำกว่า 21 แรงม้า", base: "tractorXS", lph: 2.4, fuel: "diesel", hp: 12, source: "MRV" }),
  tractor: M({ id: "tractor", label: "รถแทรกเตอร์", sub: "ไถ พรวน ยกร่อง ระบุแรงม้า", base: "tractorM", lph: 14, fuel: "diesel", hp: 60, source: "MRV" }),
  paddyPuddle: M({ id: "paddyPuddle", label: "แทรกเตอร์ทำเทือก / ย่ำนา", sub: "ระบุแรงม้า", base: "tractorS", lph: 8.4, fuel: "diesel", hp: 35, source: "MRV" }),

  // ---- ข้าว: ปลูก ----
  transplanterWalk: M({ id: "transplanterWalk", label: "รถดำนาเดินตาม", sub: "1 ลิตร/ชม. เบนซิน", base: "transplanterWalk", lph: 1.0, fuel: "gas4", source: "MRV" }),
  transplanterRide: M({ id: "transplanterRide", label: "รถดำนานั่งขับ", sub: "3.8 ลิตร/ชม. ดีเซล", base: "transplanterRide", lph: 3.8, fuel: "diesel", source: "MRV" }),
  seedBlower: M({ id: "seedBlower", label: "เครื่องพ่นเมล็ด / พ่นปุ๋ยสะพายหลัง", sub: "2 จังหวะ 0.5 ลิตร/ชม.", base: "sprayer", lph: 0.5, fuel: "gas2", source: "MRV", note: "ใช้อัตราเครื่องยนต์สะพายหลังตามคู่มือ MRV" }),
  droneSeed: M({ id: "droneSeed", label: "โดรนหว่านเมล็ด", sub: "แบตเตอรี่ กรอกเป็น kWh", base: "sprayer", lph: 0, fuel: "electric", source: "ค่าประมาณ", note: "kWh = จำนวนครั้งที่ชาร์จ × ความจุแบตเตอรี่ (ดูที่ตัวแบต เช่น 1.5 kWh) ถ้าชาร์จด้วยเครื่องปั่นไฟ ให้เปลี่ยนเป็นน้ำมันเบนซินแล้วกรอกลิตร" }),
  tractorSeeder: M({ id: "tractorSeeder", label: "รถหยอดเมล็ด (ติดแทรกเตอร์)", sub: "ระบุแรงม้า", base: "tractorS", lph: 8.4, fuel: "diesel", hp: 35, source: "MRV" }),

  // ---- อ้อย ----
  canePlanter: M({ id: "canePlanter", label: "เครื่องปลูกอ้อย (ติดแทรกเตอร์)", sub: "ระบุแรงม้า", base: "tractorL", lph: 23.4, fuel: "diesel", hp: 90, source: "MRV" }),
  caneHarvester: M({ id: "caneHarvester", label: "รถตัดอ้อย", sub: "23.4 ลิตร/ชม. ดีเซล", base: "caneHarvester", lph: 23.4, fuel: "diesel", source: "MRV" }),
  leafStripper: M({ id: "leafStripper", label: "รถตีใบอ้อย", sub: "แทรกเตอร์ 24–27 แรงม้า", base: "tractorS", lph: 8.4, fuel: "diesel", hp: 25, source: "กลุ่มอารักขาพืช", note: "เช่น คูโบต้า 24–27 แรงม้า ใช้ตีใบก่อนตัดอ้อยสด" }),
  caneLoader: M({ id: "caneLoader", label: "รถคีบอ้อย", sub: "ดีเซล 2–4 ลิตร/ชม. คีบ 30–40 ตัน/ชม.", base: "tractorXS", lph: 3, fuel: "diesel", perTonHour: 35, source: "กลุ่มอารักขาพืช", note: "คีบได้ 30–40 ตัน/ชม. ระบบประมาณชั่วโมงจากผลผลิตให้ (แก้ได้)" }),
  caneBaler: M({ id: "caneBaler", label: "เครื่องอัดใบอ้อย (ติดแทรกเตอร์)", sub: "ระบุแรงม้า", base: "tractorM", lph: 14, fuel: "diesel", hp: 60, source: "MRV" }),

  // ---- มันสำปะหลัง ข้าวโพด พืชไร่อื่น ----
  cassavaPlanter: M({ id: "cassavaPlanter", label: "เครื่องปลูกมันสำปะหลัง (ติดแทรกเตอร์)", sub: "ระบุแรงม้า", base: "tractorM", lph: 14, fuel: "diesel", hp: 50, source: "MRV" }),
  cassavaDigger: M({ id: "cassavaDigger", label: "ไถขุดมันสำปะหลัง (ติดแทรกเตอร์)", sub: "ระบุแรงม้า", base: "tractorM", lph: 14, fuel: "diesel", hp: 60, source: "MRV" }),
  cornHarvester: M({ id: "cornHarvester", label: "รถเก็บเกี่ยวข้าวโพด", sub: "15 ลิตร/ชม. ดีเซล", base: "combine", lph: 15, fuel: "diesel", source: "MRV", note: "ใช้อัตรารถเกี่ยวนวดตามคู่มือ MRV" }),
  beanCombine: M({ id: "beanCombine", label: "รถเกี่ยวนวดถั่ว / พืชไร่", sub: "15 ลิตร/ชม. ดีเซล", base: "combine", lph: 15, fuel: "diesel", source: "MRV", note: "ใช้อัตรารถเกี่ยวนวดตามคู่มือ MRV" }),

  // ---- ข้าว: เก็บเกี่ยวและฟาง ----
  combine: M({ id: "combine", label: "รถเกี่ยวนวดข้าว", sub: "15 ลิตร/ชม. ดีเซล", base: "combine", lph: 15, fuel: "diesel", source: "MRV" }),
  strawBaler: M({ id: "strawBaler", label: "เครื่องอัดฟาง (ติดแทรกเตอร์)", sub: "ระบุแรงม้า", base: "tractorS", lph: 8.4, fuel: "diesel", hp: 35, source: "MRV" }),
  strawRake: M({ id: "strawRake", label: "เครื่องกวาดฟาง (ติดแทรกเตอร์)", sub: "ระบุแรงม้า", base: "tractorS", lph: 8.4, fuel: "diesel", hp: 35, source: "MRV" }),

  // ---- น้ำ ----
  pump: M({ id: "pump", label: "เครื่องสูบน้ำ (ดีเซล)", sub: "2 ลิตร/ชม.", base: "pump", lph: 2, fuel: "diesel", source: "MRV" }),
  pumpElectric: M({ id: "pumpElectric", label: "ปั๊มน้ำไฟฟ้า / ระบบน้ำหยด", sub: "กรอกเป็น kWh", base: "pump", lph: 0, fuel: "electric", source: "MRV", note: "kWh ดูจากบิลค่าไฟ หรือ กำลังมอเตอร์ (kW) × ชั่วโมงที่สูบ" }),

  // ---- ดูแล ----
  sprayer: M({ id: "sprayer", label: "เครื่องพ่นยาสะพายหลัง", sub: "2 จังหวะ 0.5 ลิตร/ชม.", base: "sprayer", lph: 0.5, fuel: "gas2", source: "MRV" }),
  droneSpray: M({ id: "droneSpray", label: "โดรนพ่นสาร / หว่านปุ๋ย", sub: "แบตเตอรี่ กรอกเป็น kWh", base: "sprayer", lph: 0, fuel: "electric", source: "ค่าประมาณ", note: "kWh = จำนวนครั้งที่ชาร์จ × ความจุแบตเตอรี่ ถ้าชาร์จด้วยเครื่องปั่นไฟ ให้เปลี่ยนเป็นน้ำมันเบนซินแล้วกรอกลิตร" }),
  brushCutter: M({ id: "brushCutter", label: "เครื่องตัดหญ้าสะพายหลัง", sub: "2 จังหวะ 0.5 ลิตร/ชม.", base: "sprayer", lph: 0.5, fuel: "gas2", source: "MRV", note: "ใช้อัตราเครื่องยนต์สะพายหลังตามคู่มือ MRV" }),
  tractorSpreader: M({ id: "tractorSpreader", label: "เครื่องใส่ปุ๋ย / พรวนดิน (ติดแทรกเตอร์)", sub: "ระบุแรงม้า", base: "tractorS", lph: 8.4, fuel: "diesel", hp: 35, source: "MRV" }),
  airBlast: M({ id: "airBlast", label: "รถพ่นยาแบบลากจูง (สวน)", sub: "ระบุแรงม้า", base: "tractorS", lph: 8.4, fuel: "diesel", hp: 35, source: "MRV" }),
  chainsaw: M({ id: "chainsaw", label: "เลื่อยยนต์ตัดแต่งกิ่ง", sub: "2 จังหวะ ประมาณ 1 ลิตร/ชม.", base: "sprayer", lph: 1, fuel: "gas2", source: "ค่าประมาณ" }),
  miniTiller: M({ id: "miniTiller", label: "เครื่องพรวนดินขนาดเล็ก", sub: "เบนซิน ประมาณ 1 ลิตร/ชม.", base: "tractorXS", lph: 1, fuel: "gas4", source: "ค่าประมาณ" }),
} satisfies Record<string, MachineDef>;
export type MachineDefId = keyof typeof MACHINE_DEFS;

export type Stage = "เตรียมดิน" | "ปลูก" | "สูบน้ำ" | "ใส่ปุ๋ย/ฉีดพ่น/ดูแล" | "เก็บเกี่ยว" | "จัดการเศษวัสดุ";

/** เครื่องจักรที่แสดงให้เลือก ตามชนิดพืชและขั้นตอน */
export function machinesFor(crop: CropGroup, cropName: string, stage: Stage, plantMethod?: string): MachineDefId[] {
  const cane = cropName === "อ้อย";
  const cassava = cropName === "มันสำปะหลัง";
  const corn = cropName.startsWith("ข้าวโพด");
  const water: MachineDefId[] = ["pump", "pumpElectric"];
  const care: MachineDefId[] = ["sprayer", "droneSpray", "brushCutter"];

  if (crop === "rice") {
    switch (stage) {
      case "เตรียมดิน": return ["walkTractor", "tractor", "paddyPuddle"];
      case "ปลูก":
        if (plantMethod === "machineTransplant") return ["transplanterWalk", "transplanterRide"];
        if (plantMethod === "transplant") return [];
        if (plantMethod === "drone") return ["droneSeed"];
        if (plantMethod === "dryBroadcast" || plantMethod === "wetBroadcast") return ["seedBlower", "droneSeed", "tractorSeeder"];
        return ["transplanterWalk", "transplanterRide", "seedBlower", "droneSeed", "tractorSeeder"];
      case "สูบน้ำ": return water;
      case "ใส่ปุ๋ย/ฉีดพ่น/ดูแล": return ["seedBlower", ...care];
      case "เก็บเกี่ยว": return ["combine"];
      case "จัดการเศษวัสดุ": return ["strawRake", "strawBaler"];
    }
  }
  if (crop === "field") {
    switch (stage) {
      case "เตรียมดิน": return ["tractor", "walkTractor"];
      case "ปลูก": return cane ? ["canePlanter"] : cassava ? ["cassavaPlanter"] : ["tractorSeeder"];
      case "สูบน้ำ": return water;
      case "ใส่ปุ๋ย/ฉีดพ่น/ดูแล": return ["tractorSpreader", ...care];
      case "เก็บเกี่ยว":
        if (cane) return ["caneHarvester", "leafStripper", "caneLoader"];
        if (cassava) return ["cassavaDigger"];
        if (corn) return ["cornHarvester"];
        return ["beanCombine"];
      case "จัดการเศษวัสดุ": return cane ? ["caneBaler"] : ["tractorSpreader"];
    }
  }
  if (crop === "vegetable") {
    switch (stage) {
      case "เตรียมดิน": return ["walkTractor", "miniTiller", "tractor"];
      case "ปลูก": return ["tractorSeeder"];
      case "สูบน้ำ": return water;
      case "ใส่ปุ๋ย/ฉีดพ่น/ดูแล": return care;
      case "เก็บเกี่ยว": return [];
      case "จัดการเศษวัสดุ": return ["walkTractor"];
    }
  }
  // ไม้ผล / ป่าไม้
  switch (stage) {
    case "เตรียมดิน": return ["tractor", "walkTractor"];
    case "สูบน้ำ": return water;
    case "ใส่ปุ๋ย/ฉีดพ่น/ดูแล": return [...care, "airBlast", "chainsaw", "pump", "pumpElectric"];
    case "จัดการเศษวัสดุ": return ["chainsaw"];
    default: return [];
  }
}

/** คำอธิบายเมื่อขั้นตอนนั้นไม่มีเครื่องจักรให้เลือก */
export function noMachineNote(crop: CropGroup, stage: Stage): string | null {
  if (crop === "vegetable" && stage === "เก็บเกี่ยว") return "พืชผักส่วนใหญ่เก็บเกี่ยวด้วยแรงงานคน จึงไม่มีการปล่อยจากเครื่องจักรในขั้นนี้";
  if (stage === "ปลูก") return "ปลูกด้วยแรงงานคน ไม่ต้องกรอกเครื่องจักร";
  return null;
}

/* ---------------- รถขนส่ง ---------------- */
export interface VehicleDef { id: string; label: string; sub: string; kmPerL: number; range: string; tons: number; source: MachineDef["source"] }
export const VEHICLES: VehicleDef[] = [
  { id: "pickup", label: "รถกระบะ", sub: "บรรทุก ~1 ตัน", kmPerL: 10, range: "8–12 กม./ลิตร", tons: 1, source: "ค่าประมาณ" },
  { id: "truck6", label: "รถบรรทุก 6 ล้อ", sub: "บรรทุก 10–15 ตัน", kmPerL: 5.5, range: "4–7 กม./ลิตร", tons: 12.5, source: "กลุ่มอารักขาพืช" },
  { id: "truck10", label: "รถบรรทุก 10 ล้อ", sub: "บรรทุก ~25 ตัน", kmPerL: 3.75, range: "2.5–5 กม./ลิตร", tons: 25, source: "กลุ่มอารักขาพืช" },
  { id: "truck18", label: "รถ 18 ล้อ / รถพ่วง", sub: "ไม่เกิน 45 ตันตามกฎหมาย", kmPerL: 2.75, range: "2–3.5 กม./ลิตร", tons: 45, source: "กลุ่มอารักขาพืช" },
];

/** ชนิดรถที่แนะนำตามพืช */
export function vehiclesFor(crop: CropGroup, cropName: string): VehicleDef[] {
  if (cropName === "อ้อย" || cropName === "มันสำปะหลัง") return VEHICLES.filter((v) => v.id !== "pickup");
  if (crop === "vegetable" || crop === "fruit") return VEHICLES.filter((v) => v.id === "pickup" || v.id === "truck6");
  return VEHICLES;
}

export const RICE_PLANT_METHODS: { key: string; label: string; sub: string }[] = [
  { key: "transplant", label: "ปักดำด้วยแรงงาน", sub: "ไม่ใช้เครื่องจักร" },
  { key: "machineTransplant", label: "ดำนาด้วยรถ", sub: "รถดำนาเดินตาม / นั่งขับ" },
  { key: "wetBroadcast", label: "หว่านน้ำตม", sub: "หว่านเมล็ดงอกบนเทือก" },
  { key: "dryBroadcast", label: "หว่านแห้ง / หว่านสำรวย", sub: "หว่านเมล็ดแห้งก่อนฝน" },
  { key: "drone", label: "หว่านด้วยโดรน", sub: "" },
];
