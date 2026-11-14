import { useMemo, useRef, useState } from "react";
import { CROP_GROUPS, type CropGroup } from "@/lib/engine/types";
import { evaluate } from "@/lib/engine/evaluate";
import { deleteRecord, importRecords, saveRecord, useRecords, useSettings } from "@/lib/store";
import { newRecord, sampleRice } from "@/lib/defaults";
import { co2s, thaiDate } from "@/lib/format";
import { go, href } from "@/lib/router";
import { Glyph } from "@/components/Glyph";
import { Band } from "@/components/Results";
import { exportXlsx } from "@/lib/exportXlsx";
import { getProfile, logEvent } from "@/lib/profile";
import { assess, LEVEL_TEXT } from "@/lib/benchmark";

export function Home() {
  const records = useRecords();
  const [settings] = useSettings();
  const fileRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);

  const rows = useMemo(() => records
    .filter((r) => !q || [r.info.plotName, r.info.farmer, r.info.province, r.cropName].join(" ").includes(q.trim()))
    .map((rec) => ({ rec, ev: evaluate(rec, settings) })), [records, settings, q]);

  const stamp = (r: ReturnType<typeof newRecord>) => {
    const p = getProfile();
    if (p) { r.createdBy = { id: p.id, name: p.name, agency: p.agency }; r.info.officer = p.name; if (!r.info.province) r.info.province = p.province; }
    return r;
  };
  const create = (crop: CropGroup) => {
    const r = stamp(newRecord(crop));
    saveRecord(r);
    logEvent("plot_create", { crop: r.crop }, settings);
    go(`/plot/${r.id}`);
  };

  const backup = () => {
    const blob = new Blob([JSON.stringify({ app: "doae-ghg", version: 2, exportedAt: new Date().toISOString(), records }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `สำรองข้อมูลแปลง-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  };
  const restore = async (f: File) => {
    try {
      const data = JSON.parse(await f.text());
      const n = importRecords(Array.isArray(data) ? data : data.records ?? []);
      window.alert(n ? `นำเข้าแล้ว ${n} แปลง` : "ไฟล์นี้ไม่มีข้อมูลแปลงที่นำเข้าได้");
    } catch { window.alert("อ่านไฟล์ไม่ได้ ต้องเป็นไฟล์สำรอง (.json) จากแอปนี้"); }
  };
  const exportAll = () => {
    setBusy(true);
    try {
      exportXlsx(rows, settings, getProfile(), `คาร์บอนทุกแปลง-${new Date().toISOString().slice(0, 10)}.xlsx`);
      logEvent("export", { plots: rows.length }, settings);
    } catch (e) {
      window.alert(`สร้างไฟล์ Excel ไม่สำเร็จ: ${(e as Error).message}`);
    } finally { setBusy(false); }
  };

  return (
    <div className="home">
      <section>
        <h1>วันนี้ลงพื้นที่แปลงอะไร</h1>
        <p className="muted" style={{ marginTop: "0.4rem" }}>เลือกกลุ่มพืช แล้วตอบคำถามไปทีละขั้นตามฤดูกาล ยอดคาร์บอนจะคำนวณให้ทันที ใช้ได้แม้ไม่มีสัญญาณ</p>
        <ul className="crop-list">
          {(Object.keys(CROP_GROUPS) as CropGroup[]).map((k) => (
            <li key={k}>
              <button type="button" onClick={() => create(k)}>
                <Glyph crop={k} />
                <span><b>{CROP_GROUPS[k].label}</b><span className="muted small">{CROP_GROUPS[k].examples}</span></span>
                <span className="go">เริ่มบันทึก</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <div className="row" style={{ alignItems: "flex-end" }}>
          <h2 className="grow">แปลงที่บันทึกไว้{records.length > 0 && <span className="muted"> {records.length} แปลง</span>}</h2>
          {records.length > 1 && <input className="inp" style={{ maxWidth: "15rem" }} placeholder="ค้นหาชื่อ แปลง จังหวัด" value={q} onChange={(e) => setQ(e.target.value)} aria-label="ค้นหาแปลง" />}
        </div>

        {records.length === 0 ? (
          <div className="empty stack" style={{ marginTop: "1rem" }}>
            <p><b>ยังไม่มีแปลงในเครื่องนี้</b></p>
            <p className="muted">เลือกกลุ่มพืชเพื่อเริ่มบันทึก หรือเปิดแปลงข้าวตัวอย่างเพื่อดูว่าคำนวณอย่างไร</p>
            <div className="row">
              <button type="button" className="btn btn-main" onClick={() => { const r = stamp(sampleRice()); saveRecord(r); go(`/plot/${r.id}`); }}>เปิดแปลงข้าวตัวอย่าง</button>
              <button type="button" className="btn btn-line" onClick={() => fileRef.current?.click()}>นำเข้าไฟล์สำรอง</button>
            </div>
          </div>
        ) : (
          <table className="ledger" style={{ marginTop: "1rem" }}>
            <thead>
              <tr><th>แปลง</th><th className="hide-sm" style={{ width: "28%" }}>แหล่งปล่อย</th><th className="r">ปล่อยรวม</th><th aria-label="ลบ" /></tr>
            </thead>
            <tbody>
              {rows.map(({ rec, ev }) => (
                <tr key={rec.id}>
                  <td>
                    <a className="plot" href={href(`/plot/${rec.id}`)}>{rec.info.plotName || `${rec.cropName} (ไม่มีชื่อแปลง)`}</a>{" "}
                    {rec.standard === "tver" && <span className="tag">T-VER</span>}
                    <div className="small muted">{[rec.cropName, rec.info.farmer, rec.info.province, rec.baseline.areaRai ? `${rec.baseline.areaRai} ไร่` : ""].filter(Boolean).join(", ")}</div>
                  </td>
                  <td className="hide-sm"><Band r={ev.baseline} /></td>
                  <td className="r"><b className="num">{co2s(ev.baseline.totalKgCO2e)}</b>
                    {(() => { const a = assess(rec, ev, settings); return a ? <div className="small" style={{ color: LEVEL_TEXT[a.level].color, fontWeight: 600 }}>{LEVEL_TEXT[a.level].title}</div> : null; })()}
                    <div className="small muted">{thaiDate(rec.updatedAt)}</div></td>
                  <td className="r"><button type="button" className="btn-link btn-del" onClick={() => { if (window.confirm(`ลบแปลง “${rec.info.plotName || rec.cropName}” ถาวร?`)) deleteRecord(rec.id); }}>ลบ</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="row" style={{ marginTop: "1.5rem" }}>
          {records.length > 0 && <button type="button" className="btn btn-main" onClick={exportAll} disabled={busy}>{busy ? "กำลังสร้างไฟล์…" : "ดาวน์โหลด Excel ทุกแปลง"}</button>}
          {records.length > 0 && <button type="button" className="btn btn-line" onClick={backup}>สำรองข้อมูล</button>}
          {records.length > 0 && <button type="button" className="btn btn-line" onClick={() => fileRef.current?.click()}>นำเข้าไฟล์สำรอง</button>}
          <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) restore(f); e.target.value = ""; }} />
        </div>
        <p className="small muted" style={{ marginTop: "0.75rem" }}>ข้อมูลเก็บในเบราว์เซอร์ของเครื่องนี้ สำรองเป็นไฟล์ไว้เป็นประจำ และใช้ไฟล์นั้นย้ายหรือรวมข้อมูลจากหลายเครื่อง</p>
      </section>
    </div>
  );
}
