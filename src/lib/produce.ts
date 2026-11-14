/** อัปเดตแบบ immutable อย่างง่าย: clone แล้วแก้ไข (ข้อมูลแปลงมีขนาดเล็ก) */
export function produce<T>(base: T, fn: (draft: T) => void): T {
  const draft = structuredClone(base);
  fn(draft);
  return draft;
}
