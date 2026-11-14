import { ELEC_EF, GWP_SETS, type ElecKey, type GwpKey } from "@/lib/engine/factors";
import { useSettings } from "@/lib/store";
import { BENCHMARKS } from "@/lib/benchmark";
import { collectUrl, getLog, getProfile, queueSize } from "@/lib/profile";
import { exportUsage } from "@/lib/exportXlsx";
import { Choice, Num, Q } from "@/components/ui";

export function Settings() {
  const [s, set] = useSettings();
  const sending = !!collectUrl();

  return (
    <div className="page" style={{ maxWidth: "50rem" }}>
      <h1>ตั้งค่า</h1>
      <p className="lead muted" style={{ marginBottom: "1rem" }}>ใช้กับทุกแปลงในเครื่องนี้ และมีผลทันที</p>

      <Q title="ค่าอ้างอิงสำหรับเทียบระดับการปล่อย" help="หน่วย kgCO₂e ต่อผลผลิต 1 กก. เว้นว่างเพื่อใช้ค่าจากงานวิจัย ใส่ค่าใหม่ได้ถ้าหน่วยงานมีเกณฑ์ของตัวเอง">
        <div className="grid2">
          {Object.entries(BENCHMARKS).map(([crop, b]) => (
            <Num key={crop} label={`${crop} (ค่าจากงานวิจัย ${b.value})`} unit="kgCO₂e/กก." value={s.benchmarks?.[crop] ?? 0}
              onChange={(v) => set({ ...s, benchmarks: { ...s.benchmarks, [crop]: v } })} />
          ))}
        </div>
      </Q>

      <Q title="ข้อมูลผู้ใช้งานและประวัติการใช้งาน" help="ระบบเก็บข้อมูลผู้ใช้ และบันทึกการเปิดใช้ การสร้างแปลง การดูผล และการดาวน์โหลดรายงานไว้ในเครื่องเสมอ">
        <div className="row">
          <button type="button" className="btn btn-line" onClick={() => exportUsage(getProfile(), getLog(), `ประวัติการใช้งาน-${new Date().toISOString().slice(0, 10)}.xlsx`)}>
            ดาวน์โหลดประวัติการใช้งาน ({getLog().length} รายการ)
          </button>
          <a className="btn btn-line" href="#/profile">แก้ไขข้อมูลผู้ใช้</a>
        </div>
        <p className="small muted" style={{ marginTop: "0.75rem" }}>
          {sending ? `ส่งเข้า Google Sheets อัตโนมัติ${queueSize() ? ` (รอส่ง ${queueSize()} รายการเมื่อออนไลน์)` : " ครบแล้ว"}` : `ยังไม่ได้ใส่ URL Google Sheets ใน src/config.ts ข้อมูลรอส่ง ${queueSize()} รายการ`}
        </p>
      </Q>

      <Q title="ค่า GWP" help="T-VER ใช้ AR5 สำหรับช่วงคิดเครดิตตั้งแต่ 1 ม.ค. 2564 ตามประกาศ อบก.">
        <Choice boxy label="ชุดค่า GWP" value={s.gwp} onChange={(v: GwpKey) => set({ ...s, gwp: v })}
          options={(Object.keys(GWP_SETS) as GwpKey[]).map((k) => ({ key: k, label: k, sub: `CH₄ ${GWP_SETS[k].CH4}, N₂O ${GWP_SETS[k].N2O}` }))} />
      </Q>
      <Q title="ค่าการปล่อยจากไฟฟ้า" help="โครงการ T-VER ให้ใช้ค่าที่ อบก. ประกาศล่าสุด ณ วันยื่นโครงการ">
        <Choice boxy label="แหล่งค่า EF ไฟฟ้า" value={s.elec} onChange={(v) => set({ ...s, elec: v, elecCustom: null })}
          options={(Object.keys(ELEC_EF) as ElecKey[]).map((k) => ({ key: k, label: `${ELEC_EF[k].value} kgCO₂e/kWh`, sub: ELEC_EF[k].label }))} />
        <div style={{ marginTop: "1rem", maxWidth: "20rem" }}>
          <Num label="หรือกำหนดค่าเอง" unit="kgCO₂e/kWh" value={s.elecCustom ?? 0} onChange={(v) => set({ ...s, elecCustom: v > 0 ? v : null })} />
        </div>
      </Q>
    </div>
  );
}
