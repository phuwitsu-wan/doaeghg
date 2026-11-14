import type { Evaluation } from "./engine/evaluate";
import type { FieldRecord, Settings } from "./engine/types";

/**
 * ค่าอ้างอิงคาร์บอนฟุตพริ้นท์ระดับแปลง (kgCO2e ต่อ กก. ผลผลิต ณ หน้าฟาร์ม) จากงานวิจัยในประเทศไทย
 * หมายเหตุ: ประเทศไทยยังไม่มี "มาตรฐาน" ทางกฎหมายสำหรับการปล่อยก๊าซระดับแปลง
 * จึงใช้ค่าเฉลี่ยจากงานวิจัยเป็นเกณฑ์เทียบ และให้หน่วยงานแก้ค่าเองได้ในหน้าตั้งค่า
 */
export const BENCHMARKS: Record<string, { value: number; product: string; source: string }> = {
  ข้าวนาปี: { value: 1.1, product: "ข้าวเปลือก", source: "SMART GHG 3 ชุมชน 1.09–1.77 (Cha-un et al., 2022); นาลุ่ม 1.02 (แม่แจ่ม, 2023)" },
  ข้าวนาปรัง: { value: 1.1, product: "ข้าวเปลือก", source: "SMART GHG 3 ชุมชน 1.09–1.77 (Cha-un et al., 2022); นาลุ่ม 1.02 (แม่แจ่ม, 2023)" },
  ข้าวไร่: { value: 0.17, product: "ข้าวเปลือก", source: "ข้าวไร่ อ.แม่แจ่ม จ.เชียงใหม่ (2023)" },
  อ้อย: { value: 0.061, product: "อ้อยสด", source: "อ้อยปลูกใหม่ ตัดสด จ.บุรีรัมย์ 60.82 kgCO₂e/ตัน (มรภ.บุรีรัมย์) ใกล้เคียงขั้นปลูกอ้อยภาคตะวันออก 0.49 kgCO₂e/กก.น้ำตาล (Yuttitham et al., 2011) ส่วนอ้อยเผามีค่า 429–525 kgCO₂e/ตัน" },
  มันสำปะหลัง: { value: 0.052, product: "หัวมันสด", source: "แปลงใช้ปุ๋ยเคมี 51.83 kgCO₂e/ตัน (Janchai et al., 2025)" },
  ข้าวโพดเลี้ยงสัตว์: { value: 0.429, product: "เมล็ดข้าวโพด", source: "ค่าเฉลี่ยประเทศไทย 429 kgCO₂e/ตัน (Moungsree et al., 2022)" },
};

/** ช่วงผลผลิตที่เป็นไปได้ (กก./ไร่) ใช้ตรวจการกรอกผิดหน่วย เช่น กรอกเป็นตันลงช่องกิโลกรัม */
export const YIELD_RANGE: Record<string, { min: number; max: number; tons: boolean; typical: string }> = {
  ข้าวนาปี: { min: 150, max: 1500, tons: false, typical: "400–800 กก./ไร่" },
  ข้าวนาปรัง: { min: 150, max: 1500, tons: false, typical: "500–900 กก./ไร่" },
  ข้าวไร่: { min: 80, max: 1000, tons: false, typical: "200–400 กก./ไร่" },
  อ้อย: { min: 2000, max: 30000, tons: true, typical: "8–15 ตัน/ไร่" },
  มันสำปะหลัง: { min: 800, max: 12000, tons: true, typical: "3–5 ตัน/ไร่" },
  ข้าวโพดเลี้ยงสัตว์: { min: 200, max: 2500, tons: false, typical: "600–1,000 กก./ไร่" },
};

/** ข้อความเตือนเมื่อผลผลิตผิดปกติ (มักเกิดจากกรอกผิดหน่วย) */
export function yieldIssue(cropName: string, kgPerRai: number): string | null {
  const r = YIELD_RANGE[cropName];
  if (!r || !(kgPerRai > 0)) return null;
  if (kgPerRai < r.min) return `ผลผลิต ${kgPerRai.toLocaleString("th-TH")} กก./ไร่ ต่ำผิดปกติสำหรับ${cropName} (ปกติ ${r.typical})${r.tons ? " ถ้ากรอกเป็นตัน ให้แตะหน่วยเพื่อเปลี่ยนเป็น ตัน/ไร่ แล้วกรอกใหม่" : " ตรวจหน่วยอีกครั้ง"}`;
  if (kgPerRai > r.max) return `ผลผลิต ${(kgPerRai / (r.tons ? 1000 : 1)).toLocaleString("th-TH", { maximumFractionDigits: 1 })} ${r.tons ? "ตัน" : "กก."}/ไร่ สูงผิดปกติสำหรับ${cropName} (ปกติ ${r.typical}) ถ้าเป็นผลผลิตรวมทั้งแปลง ให้แตะหน่วยเปลี่ยนเป็น "ตันทั้งแปลง"`;
  return null;
}

/** แสดงสัดส่วนเทียบค่าอ้างอิง: ไม่เกิน 3 เท่าแสดงเป็น %, เกินกว่านั้นแสดงเป็นเท่า */
export const ratioText = (ratio: number) =>
  ratio >= 3 ? `${ratio.toLocaleString("th-TH", { maximumFractionDigits: 1 })} เท่าของค่าอ้างอิง` : `${Math.round(ratio * 100)}% ของค่าอ้างอิง`;

export type Level = "low" | "near" | "high";
export const LEVEL_TEXT: Record<Level, { title: string; color: string }> = {
  low: { title: "ต่ำกว่าค่าอ้างอิง", color: "var(--celadon-deep)" },
  near: { title: "อยู่ในเกณฑ์ค่าอ้างอิง", color: "var(--turmeric)" },
  high: { title: "สูงกว่าค่าอ้างอิง", color: "var(--ember)" },
};

export interface Assessment {
  level: Level;
  value: number; // kgCO2e/kg ของแปลง
  ref: number;
  ratio: number;
  product: string;
  source: string;
  custom: boolean;
}

export function refFor(cropName: string, settings: Settings) {
  const custom = settings.benchmarks?.[cropName];
  const base = BENCHMARKS[cropName];
  if (custom && custom > 0) return { value: custom, product: base?.product ?? "ผลผลิต", source: "ค่าที่หน่วยงานกำหนดในหน้าตั้งค่า", custom: true };
  if (base) return { ...base, custom: false };
  return null;
}

/** เทียบค่าการปล่อยต่อ กก. ผลผลิต กับค่าอ้างอิง (±20% ถือว่าอยู่ในเกณฑ์) */
export function assess(rec: FieldRecord, ev: Evaluation, settings: Settings, which: "baseline" | "project" = "baseline"): Assessment | null {
  const r = which === "project" && ev.project ? ev.project : ev.baseline;
  const ref = refFor(rec.cropName, settings);
  if (!ref || r.perKgProduct == null || r.perKgProduct <= 0) return null;
  const s = which === "project" && ev.project ? rec.project : rec.baseline;
  if (yieldIssue(rec.cropName, s.yieldKgPerRai)) return null; // ผลผลิตผิดปกติ: ไม่เทียบ เพื่อไม่ให้สรุปผิด
  const ratio = r.perKgProduct / ref.value;
  const level: Level = ratio < 0.8 ? "low" : ratio <= 1.2 ? "near" : "high";
  return { level, value: r.perKgProduct, ref: ref.value, ratio, product: ref.product, source: ref.source, custom: ref.custom };
}

/** ข้อความระดับชุดเดียวกัน ใช้ทั้งแถบสรุป หน้าผลลัพธ์ และ Excel */
export const LEVEL_RULE: Record<Level, string> = {
  low: "น้อยกว่า 80% ของค่าอ้างอิง",
  near: "80–120% ของค่าอ้างอิง",
  high: "มากกว่า 120% ของค่าอ้างอิง",
};
export function levelSentence(a: Assessment): string {
  const v = a.value.toLocaleString("th-TH", { maximumFractionDigits: 3 });
  return `แปลงนี้ปล่อย ${v} kgCO₂e ต่อ${a.product} 1 กก. เทียบกับค่าอ้างอิง ${a.ref} kgCO₂e คิดเป็น ${ratioText(a.ratio)}`;
}
