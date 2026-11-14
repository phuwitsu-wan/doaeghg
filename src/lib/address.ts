import { PROVINCES } from "./provinces";

/** [จังหวัด, [อำเภอ, [ตำบล...]][]][] — ข้อมูลจาก kongvut/thai-province-data (MIT) */
export type AddressData = [string, [string, string[]][]][];

let cache: Promise<AddressData> | null = null;
export function loadAddress(): Promise<AddressData> {
  if (!cache) {
    cache = fetch("/thai-address.json").then((r) => {
      if (!r.ok) throw new Error(`โหลดข้อมูลที่อยู่ไม่ได้ (${r.status})`);
      return r.json();
    });
    cache.catch(() => { cache = null; });
  }
  return cache;
}

export const districtsOf = (d: AddressData, province: string) => d.find((p) => p[0] === province)?.[1] ?? [];
export const subdistrictsOf = (d: AddressData, province: string, district: string) =>
  districtsOf(d, province).find((a) => a[0] === district)?.[1] ?? [];

type Kind = "p" | "d" | "s" | "?";
const KIND: [RegExp, Kind][] = [
  [/^(จังหวัด|จ\.)\s*/, "p"],
  [/^(อำเภอ|กิ่งอำเภอ|อ\.|เขต)\s*/, "d"],
  [/^(ตำบล|ต\.|แขวง)\s*/, "s"],
  [/^เทศบาล(นคร|เมือง|ตำบล)?\s*/, "?"],
];
function classify(raw: string): { name: string; kind: Kind } {
  const t = raw.trim();
  for (const [re, k] of KIND) if (re.test(t)) return { name: t.replace(re, "").replace(/\s+/g, ""), kind: k };
  return { name: t.replace(/\s+/g, ""), kind: "?" };
}

export interface Place { province: string; district: string; subdistrict: string }

/** จับคู่ชื่อจากผลค้นหาแผนที่กับรายชื่อทางการ โดยใช้คำนำหน้า (ตำบล/อำเภอ/จังหวัด) ช่วยแยกชนิด */
export function matchPlace(tokens: string[], data: AddressData): Place {
  const toks = tokens.map(classify).filter((t) => t.name);
  const of = (...k: Kind[]) => toks.filter((t) => k.includes(t.kind)).map((t) => t.name);
  const exact = (names: string[], pool: string[]) => pool.find((n) => names.includes(n));
  const loose = (names: string[], pool: string[]) => pool.find((n) => names.some((t) => t.length > 2 && (t.includes(n) || n.includes(t))));
  const out: Place = { province: "", district: "", subdistrict: "" };

  const pNames = of("p", "?");
  out.province = exact(pNames, PROVINCES) ?? (pNames.some((t) => /กรุงเทพ|bangkok/i.test(t)) ? "กรุงเทพมหานคร" : loose(of("p"), PROVINCES) ?? "");
  if (!out.province) return out;
  const dists = districtsOf(data, out.province);
  const dNames = dists.map((d) => d[0]);
  const used = new Set([out.province]);
  const dTyped = of("d");
  const district = exact(dTyped, dNames) ?? loose(dTyped, dNames) ?? exact(of("?").filter((n) => !used.has(n)), dNames);
  const sTyped = of("s");
  if (district) {
    out.district = district;
    used.add(district);
    const subs = dists.find((d) => d[0] === district)![1];
    out.subdistrict = exact(sTyped, subs) ?? loose(sTyped, subs) ?? exact(of("?").filter((n) => !used.has(n)), subs) ?? "";
  } else {
    // ไม่พบอำเภอ: หาตำบลที่ชื่อไม่ซ้ำในจังหวัดนั้น แล้วอนุมานอำเภอ
    const names = sTyped.length ? sTyped : of("?").filter((n) => !used.has(n));
    const hits = dists.flatMap(([dn, subs]) => subs.filter((x) => names.includes(x)).map((x) => [dn, x] as const));
    if (hits.length === 1) { out.district = hits[0][0]; out.subdistrict = hits[0][1]; }
  }
  return out;
}

/** แปลงพิกัดเป็นชื่อตำบล อำเภอ จังหวัด (OpenStreetMap Nominatim ต้องต่ออินเทอร์เน็ต) */
export async function reverseGeocode(lat: number, lng: number): Promise<Place> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=14&addressdetails=1&accept-language=th`;
  const [res, data] = await Promise.all([fetch(url, { headers: { Accept: "application/json" } }), loadAddress()]);
  if (!res.ok) throw new Error(`บริการแผนที่ตอบกลับ ${res.status}`);
  const j = await res.json();
  const tokens = [...Object.values((j.address ?? {}) as Record<string, string>), ...String(j.display_name ?? "").split(",")];
  return matchPlace(tokens, data);
}

export function currentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("อุปกรณ์นี้ระบุตำแหน่งไม่ได้"));
    navigator.geolocation.getCurrentPosition(resolve, (e) => reject(new Error(
      e.code === 1 ? "ยังไม่ได้อนุญาตให้เว็บเข้าถึงตำแหน่ง กดอนุญาตที่แถบที่อยู่ของเบราว์เซอร์" : "ระบุตำแหน่งไม่ได้ ลองออกไปที่โล่งแล้วกดอีกครั้ง",
    )), { enableHighAccuracy: true, timeout: 20000, maximumAge: 60000 });
  });
}
