import { useCallback, useSyncExternalStore } from "react";
import type { FieldRecord, Settings } from "./engine/types";
import { DEFAULT_SETTINGS } from "./defaults";

/** เก็บข้อมูลในเบราว์เซอร์ (localStorage) ใช้งานออฟไลน์ได้ */
const KEY_RECORDS = "doaeghg.records.v1";
const KEY_SETTINGS = "doaeghg.settings.v1";
const OLD_KEY = "agrighg.records.v1"; // ย้ายข้อมูลจากรุ่นก่อน

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
function subscribe(l: () => void) {
  listeners.add(l);
  const onStorage = (e: StorageEvent) => { if (e.key?.startsWith("doaeghg.")) { cache.clear(); l(); } };
  window.addEventListener("storage", onStorage);
  return () => { listeners.delete(l); window.removeEventListener("storage", onStorage); };
}

const cache = new Map<string, { raw: string | null; val: unknown }>();
function read<T>(key: string, fallback: T): T {
  let raw: string | null = null;
  try { raw = localStorage.getItem(key); } catch { /* private mode */ }
  const c = cache.get(key);
  if (c && c.raw === raw) return c.val as T;
  let val: T = fallback;
  try { if (raw) val = JSON.parse(raw) as T; } catch { /* broken JSON */ }
  cache.set(key, { raw, val });
  return val;
}
function write(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    window.alert("บันทึกไม่สำเร็จ: พื้นที่เก็บข้อมูลในเครื่องเต็ม สำรองข้อมูลแล้วลบแปลงเก่าออกก่อน");
  }
  emit();
}

try {
  if (!localStorage.getItem(KEY_RECORDS) && localStorage.getItem(OLD_KEY)) {
    localStorage.setItem(KEY_RECORDS, localStorage.getItem(OLD_KEY)!);
  }
} catch { /* ignore */ }

const EMPTY: FieldRecord[] = [];
export const getRecords = () => read<FieldRecord[]>(KEY_RECORDS, EMPTY);
export const getRecord = (id: string) => getRecords().find((r) => r.id === id) ?? null;

export function saveRecord(rec: FieldRecord) {
  const all = [...getRecords()];
  const next = { ...rec, updatedAt: new Date().toISOString() };
  const i = all.findIndex((r) => r.id === rec.id);
  if (i >= 0) all[i] = next; else all.unshift(next);
  write(KEY_RECORDS, all);
}
export function deleteRecord(id: string) {
  write(KEY_RECORDS, getRecords().filter((r) => r.id !== id));
}
export function importRecords(list: unknown[]): number {
  const byId = new Map(getRecords().map((r) => [r.id, r]));
  let n = 0;
  for (const r of list as FieldRecord[]) {
    if (!r || typeof r !== "object" || !r.id || !r.crop || !r.baseline) continue;
    byId.set(r.id, r);
    n++;
  }
  write(KEY_RECORDS, [...byId.values()].sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "")));
  return n;
}

export const useRecords = () => useSyncExternalStore(subscribe, getRecords, () => EMPTY);

export function useSettings(): [Settings, (s: Settings) => void] {
  const s = useSyncExternalStore(subscribe, () => read(KEY_SETTINGS, DEFAULT_SETTINGS), () => DEFAULT_SETTINGS);
  const set = useCallback((v: Settings) => write(KEY_SETTINGS, v), []);
  return [{ ...DEFAULT_SETTINGS, ...s }, set];
}
