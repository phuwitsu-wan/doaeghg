import { useSyncExternalStore } from "react";
import type { Settings } from "./engine/types";
import { CONFIG } from "@/config";

/**
 * ข้อมูลผู้ใช้งาน (เจ้าหน้าที่) + ประวัติการใช้งาน
 * - เก็บในเครื่องเสมอ
 * - ส่งเข้า Google Sheets อัตโนมัติ (URL อยู่ใน src/config.ts) ถ้าออฟไลน์จะเข้าคิวไว้ส่งเมื่อกลับมาออนไลน์
 * - ไม่ส่งชื่อเกษตรกร
 */
export interface Profile {
  id: string;
  name: string;
  position: string;
  agency: string;
  province: string;
  phone: string;
  email: string;
  consentAt: string;
  createdAt: string;
}
export interface UsageEvent {
  id?: string;
  at: string;
  type: "register" | "update_profile" | "open" | "plot_create" | "plot_result" | "export";
  detail?: Record<string, unknown>;
}

const K_PROFILE = "doaeghg.profile.v1";
const K_LOG = "doaeghg.usage.v1";
const K_QUEUE = "doaeghg.queue.v1";
const MAX_LOG = 3000;

const ls = {
  get<T>(k: string, f: T): T { try { const r = localStorage.getItem(k); return r ? JSON.parse(r) : f; } catch { return f; } },
  set(k: string, v: unknown) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* full */ } },
};

const subs = new Set<() => void>();
let cached: { raw: string | null; val: Profile | null } = { raw: undefined as unknown as null, val: null };
function snap(): Profile | null {
  let raw: string | null = null;
  try { raw = localStorage.getItem(K_PROFILE); } catch { /* ignore */ }
  if (raw !== cached.raw) cached = { raw, val: raw ? JSON.parse(raw) : null };
  return cached.val;
}
export const useProfile = () => useSyncExternalStore((l) => { subs.add(l); return () => subs.delete(l); }, snap, () => null);
export const getProfile = snap;

export function saveProfile(p: Profile, settings: Settings) {
  const isNew = !snap();
  ls.set(K_PROFILE, p);
  subs.forEach((l) => l());
  logEvent(isNew ? "register" : "update_profile", {
    position: p.position, agency: p.agency, province: p.province, phone: p.phone, email: p.email, consentAt: p.consentAt, createdAt: p.createdAt,
  }, settings);
}

export const getLog = (): UsageEvent[] => ls.get<UsageEvent[]>(K_LOG, []);

export function logEvent(type: UsageEvent["type"], detail: Record<string, unknown> | undefined, settings: Settings) {
  const ev: UsageEvent = { id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`, at: new Date().toISOString(), type, detail };
  const log = getLog();
  log.push(ev);
  ls.set(K_LOG, log.slice(-MAX_LOG));
  // เข้าคิวเสมอ: ถ้ายังไม่ได้ใส่ URL ข้อมูลจะรอไว้ และส่งทันทีเมื่อแอปถูกตั้ง URL แล้ว
  const p = snap();
  const q = ls.get<unknown[]>(K_QUEUE, []);
  q.push({ ...ev, user: p ? { id: p.id, name: p.name, position: p.position, agency: p.agency, province: p.province } : null, app: "doae-ghg" });
  ls.set(K_QUEUE, q.slice(-MAX_LOG));
  void flush(settings);
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function collectUrl(_settings?: Settings): string {
  return CONFIG.collectUrl;
}

let flushing = false;
/** ส่งข้อมูลที่ค้างในคิวเข้า Google Sheets (ส่งเป็น text/plain เพื่อให้ Google Apps Script รับได้โดยไม่ติด CORS) */
export async function flush(settings: Settings): Promise<number> {
  const url = collectUrl(settings);
  if (!url || flushing || !navigator.onLine) return 0;
  flushing = true;
  let sent = 0;
  try {
    let q = ls.get<unknown[]>(K_QUEUE, []);
    while (q.length) {
      const batch = q.slice(0, 50);
      await fetch(url, { method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ events: batch }) });
      sent += batch.length;
      q = ls.get<unknown[]>(K_QUEUE, []).slice(batch.length);
      ls.set(K_QUEUE, q);
    }
  } catch { /* ออฟไลน์ — ส่งใหม่ครั้งถัดไป */ }
  finally { flushing = false; }
  return sent;
}
export const queueSize = () => ls.get<unknown[]>(K_QUEUE, []).length;

export const EVENT_TEXT: Record<UsageEvent["type"], string> = {
  register: "ลงทะเบียนผู้ใช้", update_profile: "แก้ไขข้อมูลผู้ใช้", open: "เปิดใช้งาน",
  plot_create: "สร้างแปลงใหม่", plot_result: "ดูผลการคำนวณ", export: "ดาวน์โหลดรายงาน",
};
