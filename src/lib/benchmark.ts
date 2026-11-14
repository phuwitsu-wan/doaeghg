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
  อ้อย: { value: 0.061, product: "อ้อยสด", source: "อ้อยปลูกใหม่ ตัดสด จ.บุรีรัมย์ 60.82 kgCO₂e/ตัน (มรภ.บุรีรัมย์)" },
  มันสำปะหลัง: { value: 0.052, product: "หัวมันสด", source: "แปลงใช้ปุ๋ยเคมี 51.83 kgCO₂e/ตัน (Janchai et al., 2025)" },
  ข้าวโพดเลี้ยงสัตว์: { value: 0.429, product: "เมล็ดข้าวโพด", source: "ค่าเฉลี่ยประเทศไทย 429 kgCO₂e/ตัน (Moungsree et al., 2022)" },
};

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
  const ratio = r.perKgProduct / ref.value;
  const level: Level = ratio < 0.8 ? "low" : ratio <= 1.2 ? "near" : "high";
  return { level, value: r.perKgProduct, ref: ref.value, ratio, product: ref.product, source: ref.source, custom: ref.custom };
}
