import { useSyncExternalStore } from "react";

/**
 * Router แบบ hash (#/plot/abc) — ไม่ต้องตั้งค่า rewrite บนเซิร์ฟเวอร์
 * ทำงานได้ทั้ง Vercel, StackBlitz และเปิดแบบออฟไลน์
 */
const sub = (l: () => void) => { window.addEventListener("hashchange", l); return () => window.removeEventListener("hashchange", l); };
const get = () => window.location.hash.replace(/^#/, "") || "/";

export function useRoute(): string[] {
  const path = useSyncExternalStore(sub, get, () => "/");
  return path.split("?")[0].split("/").filter(Boolean);
}
export function go(path: string) {
  window.location.hash = path;
  window.scrollTo({ top: 0 });
}
export const href = (path: string) => `#${path}`;
