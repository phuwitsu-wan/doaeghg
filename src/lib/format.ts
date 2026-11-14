export const fmt = (n: number, d = 2) =>
  Number.isFinite(n) ? n.toLocaleString("th-TH", { minimumFractionDigits: d, maximumFractionDigits: d }) : "–";

/** แสดง kgCO2e ในหน่วยที่อ่านง่าย */
export function co2(kg: number): { value: string; unit: string } {
  if (Math.abs(kg) >= 1000) return { value: fmt(kg / 1000, 2), unit: "tCO₂e" };
  return { value: fmt(kg, 1), unit: "kgCO₂e" };
}
export const co2s = (kg: number) => {
  const c = co2(kg);
  return `${c.value} ${c.unit}`;
};

export const thaiDate = (iso: string) =>
  new Date(iso).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
