/**
 * ค่าตั้งต้นของแอป — แก้ที่ไฟล์นี้ไฟล์เดียว
 *
 * COLLECT_URL: URL เว็บแอป Google Apps Script ที่รับข้อมูลผู้ใช้งานเข้า Google Sheets
 *   วิธีได้ URL: ดู README.md หัวข้อ "เก็บข้อมูลผู้ใช้งานลง Google Sheets อัตโนมัติ"
 *   วาง URL ที่ลงท้ายด้วย /exec ระหว่างเครื่องหมายคำพูดด้านล่าง
 *   (หรือตั้งตัวแปร VITE_COLLECT_URL บน Vercel ซึ่งจะใช้แทนค่านี้)
 */
const COLLECT_URL = "";

export const CONFIG = {
  collectUrl: ((import.meta.env.VITE_COLLECT_URL as string | undefined) || COLLECT_URL).trim(),
  appName: "บันทึกการปล่อยก๊าซเรือนกระจกภาคการเกษตร",
  appShortName: "บันทึกก๊าซเรือนกระจก",
  references: "ฐานข้อมูลอ้างอิงจาก MRV, IPCC และ T-VER",
  madeBy: "กลุ่มอารักขาพืช สำนักงานเกษตรจังหวัดเพชรบูรณ์",
};
