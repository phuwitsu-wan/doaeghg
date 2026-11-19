import { useEffect, useMemo, useRef, useState } from "react";
import { evaluate } from "@/lib/engine/evaluate";
import { CROP_GROUPS, type FieldRecord, type Scenario, type TreeInventory } from "@/lib/engine/types";
import { getRecord, saveRecord, useSettings } from "@/lib/store";
import { produce } from "@/lib/produce";
import { co2s } from "@/lib/format";
import { go, href } from "@/lib/router";
import { Report, Tally, headline } from "@/components/Results";
import { Glyph } from "@/components/Glyph";
import { exportXlsx } from "@/lib/exportXlsx";
import { getProfile, logEvent } from "@/lib/profile";
import { assess } from "@/lib/benchmark";
import { CropCtx, FertStep, HarvestStep, PlantStep, PlotStep, PrepStep, TreeStep } from "./steps";
import { CreditStep } from "./credit";

type StepKey = "plot" | "prep" | "plant" | "fert" | "harvest" | "trees" | "care" | "residue" | "credit" | "result";
const STEP_INFO: Record<StepKey, { name: string; title: string; lead: string; scenario: boolean }> = {
  plot: { name: "แปลง", title: "ข้อมูลแปลง", lead: "ใครเป็นเจ้าของ แปลงใหญ่แค่ไหน และต้องการคำนวณแบบไหน", scenario: false },
  prep: { name: "เตรียมดิน", title: "การเตรียมดิน", lead: "ไถ พรวน และปรับสภาพดินก่อนปลูก", scenario: true },
  plant: { name: "ปลูกและน้ำ", title: "การปลูกและการให้น้ำ", lead: "วิธีปลูก การจัดการน้ำ และเครื่องสูบน้ำ", scenario: true },
  fert: { name: "ปุ๋ย", title: "การใส่ปุ๋ย", lead: "ปุ๋ยเคมีและปุ๋ยอินทรีย์ทุกครั้งที่ใส่ในฤดูนี้", scenario: true },
  harvest: { name: "เก็บเกี่ยว", title: "เก็บเกี่ยวและเศษพืช", lead: "การเก็บเกี่ยว การจัดการเศษพืช และการขนส่ง", scenario: true },
  trees: { name: "ต้นไม้", title: "ต้นไม้ในแปลง", lead: "ใช้คำนวณคาร์บอนที่ต้นไม้กักเก็บไว้", scenario: false },
  care: { name: "ดูแลแปลง", title: "ปุ๋ยและการดูแลแปลง", lead: "ปุ๋ย ปูน และเครื่องจักรที่ใช้ดูแลในรอบปี", scenario: true },
  residue: { name: "เศษกิ่งใบ", title: "เศษกิ่ง ใบ และการขนส่ง", lead: "การจัดการเศษกิ่งใบที่ตัดแต่ง และการขนส่งผลผลิต", scenario: true },
  credit: { name: "คาร์บอนเครดิต", title: "ข้อมูลเพิ่มเติมสำหรับคาร์บอนเครดิต T-VER", lead: "เลือกระเบียบวิธี เอกสาร คาร์บอนในดิน และถ่านชีวภาพ ตามระเบียบและเครื่องมือของ อบก.", scenario: false },
  result: { name: "ผลลัพธ์", title: "ผลการคำนวณ", lead: "", scenario: false },
};

export function Record({ id }: { id: string }) {
  const [settings] = useSettings();
  const [rec, setRec] = useState<FieldRecord | null>(() => getRecord(id));
  const [step, setStep] = useState(0);
  const [view, setView] = useState<"baseline" | "project">("baseline");
  const [saved, setSaved] = useState(true);
  const [busy, setBusy] = useState(false);
  const ref = useRef(rec);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  ref.current = rec;

  useEffect(() => { setRec(getRecord(id)); setStep(0); }, [id]);
  useEffect(() => () => { if (timer.current && ref.current) { clearTimeout(timer.current); saveRecord(ref.current); } }, []);
  useEffect(() => {
    const open = () => document.querySelectorAll("details").forEach((d) => d.setAttribute("open", ""));
    window.addEventListener("beforeprint", open);
    return () => window.removeEventListener("beforeprint", open);
  }, []);

  const update = (fn: (r: FieldRecord) => void) => {
    if (!ref.current) return;
    const next = produce(ref.current, fn);
    ref.current = next;
    setRec(next);
    setSaved(false);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { saveRecord(next); setSaved(true); timer.current = null; }, 300);
  };

  const ev = useMemo(() => (rec ? evaluate(rec, settings) : null), [rec, settings]);
  const loggedResult = useRef(false);

  if (!rec || !ev) {
    return (
      <div className="page stack">
        <h1>ไม่พบแปลงนี้ในเครื่อง</h1>
        <p className="muted">แปลงอาจถูกลบ หรือบันทึกไว้ในอุปกรณ์อื่น นำเข้าไฟล์สำรองที่หน้าแรกเพื่อเปิดแปลงจากเครื่องอื่น</p>
        <p><a className="btn btn-main" href={href("/")}>กลับหน้าแรก</a></p>
      </div>
    );
  }

  const isTree = rec.crop === "fruit" || rec.crop === "forest";
  const steps: StepKey[] = [
    ...(isTree ? (["plot", "trees", "care", "residue"] as StepKey[]) : (["plot", "prep", "plant", "fert", "harvest"] as StepKey[])),
    ...(rec.standard === "tver" ? (["credit"] as StepKey[]) : []),
    "result",
  ];
  const cur = steps[Math.min(step, steps.length - 1)];
  const info = STEP_INFO[cur];
  const v = rec.hasProject && info.scenario ? view : "baseline";
  const s = rec[v];
  const updS = (fn: (x: Scenario) => void) => update((r) => fn(r[v]));
  const updT = (fn: (t: TreeInventory) => void) => update((r) => fn(r.trees));
  const goStep = (i: number) => {
    setStep(i);
    if (steps[i] === "result" && !loggedResult.current) {
      loggedResult.current = true;
      const a = assess(rec, ev, settings);
      logEvent("plot_result", {
        plot: rec.id, crop: rec.cropName, standard: rec.standard, province: rec.info.province, district: rec.info.district, subdistrict: rec.info.subdistrict,
        areaRai: rec.baseline.areaRai, totalKgCO2e: Math.round(ev.baseline.totalKgCO2e * 100) / 100,
        perKg: ev.baseline.perKgProduct != null ? Math.round(ev.baseline.perKgProduct * 1000) / 1000 : null, level: a?.level ?? null,
        reductionKgCO2e: ev.reductionKgCO2e != null ? Math.round(ev.reductionKgCO2e) : null,
      }, settings);
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
    requestAnimationFrame(() => document.querySelectorAll(".step")[i]?.scrollIntoView({ inline: "center", block: "nearest" }));
  };

  const doExport = () => {
    setBusy(true);
    try {
      exportXlsx([{ rec, ev }], settings, getProfile(), `คาร์บอน-${rec.info.plotName || rec.cropName}-${rec.info.season}.xlsx`);
      logEvent("export", { plot: rec.id, crop: rec.cropName }, settings);
    } catch (e) {
      window.alert(`สร้างไฟล์ Excel ไม่สำเร็จ: ${(e as Error).message}`);
      console.error(e);
    } finally { setBusy(false); }
  };

  return (
    <div>
      <div className="rec-head">
        <Glyph crop={rec.crop} size={48} />
        <div className="grow">
          <a className="crumb" href={href("/")}>แปลงทั้งหมด</a>
          <h1>{rec.info.plotName || `${CROP_GROUPS[rec.crop].label}แปลงใหม่`}</h1>
          <p className="small muted" aria-live="polite">
            {[rec.cropName, rec.info.farmer, rec.baseline.areaRai ? `${rec.baseline.areaRai} ไร่` : ""].filter(Boolean).join(", ")}
            {"  "}{saved ? "บันทึกในเครื่องแล้ว" : "กำลังบันทึก…"}
          </p>
        </div>
      </div>

      <nav className="steps" aria-label="ขั้นตอนการบันทึก">
        {steps.map((k, i) => (
          <button key={k} type="button" className="step" aria-current={i === step ? "step" : undefined} data-done={i < step} onClick={() => goStep(i)}>
            <span className="dot">{i + 1}</span><span className="nm">{STEP_INFO[k].name}</span>
          </button>
        ))}
      </nav>

      <div className="rec-body">
        <main className="page">
          {cur !== "result" && <><h2>{info.title}</h2><p className="lead">{info.lead}</p></>}

          {rec.hasProject && info.scenario && (
            <div className="scen" role="group" aria-label="กรอกข้อมูลของช่วงไหน">
              <button type="button" aria-pressed={view === "baseline"} onClick={() => setView("baseline")}>ก่อนเข้าร่วมโครงการ<small>วิธีที่ทำอยู่เดิม</small></button>
              <button type="button" aria-pressed={view === "project"} onClick={() => setView("project")}>หลังเข้าร่วมโครงการ<small>วิธีที่เปลี่ยนใหม่</small></button>
            </div>
          )}

          <CropCtx.Provider value={{ crop: rec.crop, cropName: rec.cropName }}>
          {cur === "plot" && <PlotStep rec={rec} upd={update} />}
          {cur === "prep" && <PrepStep key={v} s={s} upd={updS} />}
          {cur === "plant" && <PlantStep key={v} s={s} upd={updS} crop={rec.crop} />}
          {cur === "fert" && <FertStep key={v} s={s} upd={updS} />}
          {cur === "harvest" && <HarvestStep key={v} s={s} upd={updS} crop={rec.crop} />}
          {cur === "trees" && <TreeStep t={rec.trees} upd={updT} />}
          {cur === "care" && <FertStep key={v} s={s} upd={updS} care />}
          {cur === "residue" && <HarvestStep key={v} s={s} upd={updS} crop={rec.crop} />}
          {cur === "credit" && <CreditStep rec={rec} upd={update} />}
          </CropCtx.Provider>
          {cur === "result" && (
            <>
              <div className="print-only" style={{ marginBottom: "1rem" }}>
                <p className="small muted">
                  {[rec.info.farmer, rec.info.subdistrict, rec.info.district, rec.info.province].filter(Boolean).join(" ")} ฤดูกาล {rec.info.season},
                  {" "}{CROP_GROUPS[rec.crop].label} ({rec.cropName}) {rec.baseline.areaRai} ไร่, มาตรฐาน {rec.standard === "tver" ? "T-VER" : "MRV / IPCC"}, GWP {settings.gwp}
                </p>
              </div>
              <Report ev={ev} rec={rec} settings={settings} />
              <div className="row no-print" style={{ marginTop: "2rem" }}>
                <button type="button" className="btn btn-main" onClick={doExport} disabled={busy}>{busy ? "กำลังสร้างไฟล์…" : "ดาวน์โหลด Excel"}</button>
                <button type="button" className="btn btn-line" onClick={() => window.print()}>พิมพ์ / บันทึก PDF</button>
                <button type="button" className="btn btn-line" onClick={() => go("/")}>บันทึกแปลงอื่น</button>
              </div>
            </>
          )}

          {cur !== "result" && (
            <div className="pager">
              {step > 0 && <button type="button" className="btn btn-line" onClick={() => goStep(step - 1)}>ย้อนกลับ</button>}
              <button type="button" className="btn btn-main" onClick={() => goStep(step + 1)}>
                {steps[step + 1] === "result" ? "ดูผลการคำนวณ" : `ถัดไป: ${STEP_INFO[steps[step + 1]].name}`}
              </button>
            </div>
          )}
        </main>

        {cur !== "result" && <aside className="tally"><Tally ev={ev} rec={rec} view={v} settings={settings} /></aside>}
      </div>

      {cur !== "result" && (
        <div className="mobile-tally">
          <div>
            <small>{headline(ev, rec, v).label}</small>
            <span className="v num">{co2s(headline(ev, rec, v).kg)}</span>
          </div>
          {(ev.tver || (ev.reductionKgCO2e != null && !ev.trees)) && (
            <div>
              <small>{ev.tver ? "เครดิต T-VER" : "ลดได้"}</small>
              <span className="num" style={{ fontWeight: 700 }}>{co2s(ev.tver ? ev.tver.creditKgCO2e : ev.reductionKgCO2e!)}</span>
            </div>
          )}
          <button type="button" className="btn" onClick={() => goStep(steps.length - 1)}>ดูผล</button>
        </div>
      )}
    </div>
  );
}
