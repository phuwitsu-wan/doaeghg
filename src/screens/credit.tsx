import { BIOCHAR_FPERM, DEADWOOD, SOC_FI, SOC_FLU, SOC_FMG, SOC_REF, SOIL_CLASS, type DeadwoodKey, type FpermKey } from "@/lib/engine/factors";
import { DEFAULT_TVER_OPT, methodFor, tverOpt } from "@/lib/engine/evaluate";
import { socFromSamples } from "@/lib/engine/soil";
import type { Biochar, FieldRecord, SoilCarbon, SoilSample, TverOptions } from "@/lib/engine/types";
import { uid } from "@/lib/defaults";
import { Choice, Item, Num, NumInput, Q, Select } from "@/components/ui";

export function emptySoil(rec: FieldRecord): SoilCarbon {
  const flu = rec.crop === "rice" ? "paddy" : rec.crop === "fruit" || rec.crop === "forest" ? "perennial" : "annual";
  return {
    enabled: false, method: "sample", baseline: [], current: [], years: 1, climate: "T3", soilClass: "LAC", socRefCustom: null,
    bl: { flu, fmg: "full", fi: "medium" }, pj: { flu, fmg: "full", fi: "medium" },
  };
}
export const emptyBiochar = (): Biochar => ({ enabled: false, tonnesDry: 0, focPct: 0, process: "medium", dieselL: 0, kwh: 0 });

type Upd = (fn: (r: FieldRecord) => void) => void;

function SoilRows({ rows, which, upd }: { rows: SoilSample[]; which: "baseline" | "current"; upd: Upd }) {
  const set = (id: string, p: Partial<SoilSample>) => upd((r) => { const x = r.soil![which].find((y) => y.id === id); if (x) Object.assign(x, p); });
  const avg = socFromSamples(rows);
  return (
    <div>
      {rows.map((r, i) => (
        <Item key={r.id} title={<>จุดที่ {i + 1} <span className="muted small">{r.socPct && r.bd && r.depthCm ? `${(r.socPct * r.bd * r.depthCm * 0.16).toFixed(2)} tC/ไร่` : ""}</span></>}
          onRemove={() => upd((x) => { x.soil![which] = x.soil![which].filter((y) => y.id !== r.id); })}>
          <div className="field"><label>คาร์บอนอินทรีย์ (OC)</label><div className="box"><NumInput label="OC" value={r.socPct} onChange={(v) => set(r.id, { socPct: v })} /><span className="unit">%</span></div></div>
          <div className="field"><label>ความหนาแน่นรวม (BD)</label><div className="box"><NumInput label="BD" value={r.bd} onChange={(v) => set(r.id, { bd: v })} /><span className="unit">g/cm³</span></div></div>
          <div className="field"><label>ความลึก</label><div className="box"><NumInput label="ความลึก" value={r.depthCm} onChange={(v) => set(r.id, { depthCm: v })} /><span className="unit">ซม.</span></div></div>
        </Item>
      ))}
      <div className="row" style={{ marginTop: "0.6rem", alignItems: "center" }}>
        <button type="button" className="btn btn-line" onClick={() => upd((x) => { x.soil![which].push({ id: uid(), socPct: 0, bd: 1.4, depthCm: 30 }); })}>+ เพิ่มจุดเก็บดิน</button>
        {avg != null && <span className="small">เฉลี่ย <b className="num">{avg.toFixed(2)}</b> tC/ไร่</span>}
      </div>
    </div>
  );
}

function Factors({ which, soil, upd }: { which: "bl" | "pj"; soil: SoilCarbon; upd: Upd }) {
  const f = soil[which];
  return (
    <div className="grid3">
      <Select label="การใช้ที่ดิน (F_LU)" value={f.flu} options={Object.entries(SOC_FLU).map(([k, v]) => [k as typeof f.flu, v.label])} onChange={(v) => upd((r) => { r.soil![which].flu = v; })} />
      <Select label="การไถพรวน (F_MG)" value={f.fmg} options={Object.entries(SOC_FMG).map(([k, v]) => [k as typeof f.fmg, v.label])} onChange={(v) => upd((r) => { r.soil![which].fmg = v; })} />
      <Select label="อินทรียวัตถุคืนสู่ดิน (F_I)" value={f.fi} options={Object.entries(SOC_FI).map(([k, v]) => [k as typeof f.fi, v.label])} onChange={(v) => upd((r) => { r.soil![which].fi = v; })} />
    </div>
  );
}

export function CreditStep({ rec, upd }: { rec: FieldRecord; upd: Upd }) {
  const opt = tverOpt(rec);
  const setOpt = (p: Partial<TverOptions>) => upd((r) => { r.tverOpt = { ...DEFAULT_TVER_OPT, ...(r.tverOpt ?? {}), ...p }; });
  const soil = rec.soil ?? emptySoil(rec);
  const bc = rec.biochar ?? emptyBiochar();
  const setSoil = (fn: (s: SoilCarbon) => void) => upd((r) => { if (!r.soil) r.soil = emptySoil(r); fn(r.soil); });
  const setBc = (fn: (b: Biochar) => void) => upd((r) => { if (!r.biochar) r.biochar = emptyBiochar(); fn(r.biochar); });
  const canChoose = rec.crop === "field" || rec.crop === "vegetable" || rec.crop === "fruit";
  const m = methodFor(rec);
  const isTree = rec.crop === "fruit" || rec.crop === "forest";
  const usesUd = rec.crop === "rice" || opt.track === "premium";

  return (
    <>
      {canChoose && (
        <Q title="ขอรับรองแบบไหน" help="Standard ใช้ระเบียบวิธีเฉพาะกิจกรรม Premium ใช้ได้หลายกิจกรรมร่วมกัน แต่ต้องประเมินความไม่แน่นอนและการรั่วไหล">
          <Choice boxy label="ประเภทโครงการ T-VER" value={opt.track} onChange={(v) => setOpt({ track: v })} options={[
            { key: "standard", label: "Standard", sub: rec.crop === "fruit" ? "S-METH-13-06 ปลูกพืชยืนต้น" : "S-METH-13-05 ใช้ปุ๋ยถูกวิธี" },
            { key: "premium", label: "Premium", sub: "P-METH-13-06 จัดการพื้นที่เกษตรที่ดี" },
          ]} />
        </Q>
      )}
      <p className="small">ระเบียบวิธีที่ใช้คำนวณ: <b>{m.code}</b> {m.title}</p>

      <Q title="เอกสารประกอบการขอรับรอง">
        <div className="grid2">
          <Choice label="หนังสือแสดงสิทธิในที่ดิน" value={opt.landRight ? "y" : "n"} onChange={(v) => setOpt({ landRight: v === "y" })}
            options={[{ key: "y", label: "มีเอกสารสิทธิ" }, { key: "n", label: "ยังไม่มี" }]} />
          <Choice label="ข้อมูลย้อนหลัง 3 ปี" value={opt.history3y ? "y" : "n"} onChange={(v) => setOpt({ history3y: v === "y" })}
            options={[{ key: "y", label: "มีข้อมูลย้อนหลัง 3 ปี" }, { key: "n", label: "ยังไม่มี" }]} />
        </div>
      </Q>

      {usesUd && (
        <Q title="ค่าปรับลดความไม่แน่นอน" help="ใช้ค่าแนะนำ (default) ให้หัก 15% ถ้าตรวจวัดจริงและประเมินความไม่แน่นอนได้ ≤ 20% ปรับเป็น 0">
          <div className="grid2">
            <Num label="U_d" unit="%" value={opt.ud * 100} onChange={(v) => setOpt({ ud: Math.min(100, Math.max(0, v)) / 100 })} />
            {opt.track === "premium" && rec.crop !== "rice" && (
              <Num label="คาร์บอนในวัสดุอินทรีย์ที่ซื้อจากภายนอก" unit="กก.C" value={opt.outsideOrgC} onChange={(v) => setOpt({ outsideOrgC: v })}
                hint="เฉพาะส่วนที่เพิ่มจากกรณีฐาน คิดการรั่วไหล 12%" />
            )}
          </div>
        </Q>
      )}

      {isTree && (
        <Q title="ต้นไม้ในโครงการ" help="ตาม T-VER-S-TOOL-01-01 และ 01-03">
          <div className="grid2">
            <Choice label="ไม้ขุดล้อม" value={rec.trees.transplanted ? "y" : "n"} onChange={(v) => upd((r) => { r.trees.transplanted = v === "y"; })}
              options={[{ key: "n", label: "ปลูกจากกล้า" }, { key: "y", label: "ไม้ขุดล้อมมาปลูก (ไม่คิดราก)" }]} />
            <Select<DeadwoodKey> label="ไม้ตายและเศษซากพืช (TOOL-01-03)" value={rec.trees.deadwood ?? "none"}
              options={Object.entries(DEADWOOD).map(([k, v]) => [k as DeadwoodKey, v.label])} onChange={(v) => upd((r) => { r.trees.deadwood = v; })} />
          </div>
        </Q>
      )}

      <Q title="คาร์บอนในดิน (ทางเลือก)" help="T-VER-S-TOOL-01-02: เก็บดินลึก 0–30 ซม. ก่อนเริ่มและเมื่อติดตามผล ใช้วิธีเดียวกันทั้งสองช่วง">
        <Choice label="ประเมินคาร์บอนในดิน" value={soil.enabled ? "y" : "n"} onChange={(v) => setSoil((s) => { s.enabled = v === "y"; })}
          options={[{ key: "n", label: "ไม่ประเมิน" }, { key: "y", label: "ประเมิน" }]} />
        {soil.enabled && (
          <div className="stack" style={{ marginTop: "0.75rem" }}>
            <Choice boxy label="วิธีประเมินคาร์บอนในดิน" value={soil.method} onChange={(v) => setSoil((s) => { s.method = v; })} options={[
              { key: "sample", label: "เก็บตัวอย่างดิน", sub: "ส่งห้องปฏิบัติการ ทุกขนาดโครงการ" },
              { key: "ref", label: "ค่าอ้างอิง IPCC", sub: "โครงการขนาดเล็กมาก ≤ 1,000 tCO₂e/ปี" },
            ]} />
            <Num label="ระยะเวลาติดตามผล" unit="ปี" value={soil.years} onChange={(v) => setSoil((s) => { s.years = v; })} />
            {soil.method === "sample" ? (
              <>
                <h4>ก่อนเริ่มโครงการ</h4>
                <SoilRows rows={soil.baseline} which="baseline" upd={upd} />
                <h4>ปีที่ติดตามผล</h4>
                <SoilRows rows={soil.current} which="current" upd={upd} />
              </>
            ) : (
              <>
                <div className="grid3">
                  <Select label="เขตภูมิอากาศ" value={soil.climate} options={Object.entries(SOC_REF).map(([k, v]) => [k as SoilCarbon["climate"], v.label])} onChange={(v) => setSoil((s) => { s.climate = v; })} />
                  <Select label="ชนิดดิน" value={soil.soilClass} options={Object.entries(SOIL_CLASS).map(([k, v]) => [k as SoilCarbon["soilClass"], v])} onChange={(v) => setSoil((s) => { s.soilClass = v; })} />
                  <Num label="SOC อ้างอิงที่วัดเอง (ถ้ามี)" unit="tC/ha" value={soil.socRefCustom ?? 0} onChange={(v) => setSoil((s) => { s.socRefCustom = v > 0 ? v : null; })} />
                </div>
                <h4>ก่อนเริ่มโครงการ</h4>
                <Factors which="bl" soil={soil} upd={upd} />
                <h4>หลังเข้าร่วมโครงการ</h4>
                <Factors which="pj" soil={soil} upd={upd} />
              </>
            )}
          </div>
        )}
      </Q>

      <Q title="ผลิตถ่านชีวภาพจากเศษพืช (ทางเลือก)" help="T-VER-P-METH-14-03: คิดแยกเป็นอีกโครงการ ใช้เมื่อนำเศษพืชไปเผาในเตาปิดแล้วนำถ่านกลับลงดิน">
        <Choice label="ผลิตถ่านชีวภาพ" value={bc.enabled ? "y" : "n"} onChange={(v) => setBc((b) => { b.enabled = v === "y"; })}
          options={[{ key: "n", label: "ไม่มี" }, { key: "y", label: "มี" }]} />
        {bc.enabled && (
          <div className="grid3" style={{ marginTop: "0.75rem" }}>
            <Num label="ถ่านชีวภาพ (น้ำหนักแห้ง)" unit="ตัน/ปี" value={bc.tonnesDry} onChange={(v) => setBc((b) => { b.tonnesDry = v; })} />
            <Num label="คาร์บอนอินทรีย์ในถ่าน (FOC)" unit="%" value={bc.focPct} onChange={(v) => setBc((b) => { b.focPct = v; })} hint="จากผลวิเคราะห์ห้องปฏิบัติการ" />
            <Select<FpermKey> label="อุณหภูมิการผลิต" value={bc.process} options={Object.entries(BIOCHAR_FPERM).map(([k, v]) => [k as FpermKey, `${v.label} (F_perm ${v.value})`])} onChange={(v) => setBc((b) => { b.process = v; })} />
            <Num label="ดีเซลที่ใช้ผลิต/ขนส่ง" unit="ลิตร" value={bc.dieselL} onChange={(v) => setBc((b) => { b.dieselL = v; })} />
            <Num label="ไฟฟ้าที่ใช้" unit="kWh" value={bc.kwh} onChange={(v) => setBc((b) => { b.kwh = v; })} />
          </div>
        )}
      </Q>
    </>
  );
}
