import { Fragment } from "react";
import type { Evaluation, TverResult } from "@/lib/engine/evaluate";
import type { FieldRecord, ScenarioResult, Settings, SourceLine } from "@/lib/engine/types";
import { assess, LEVEL_RULE, LEVEL_TEXT, levelSentence, yieldIssue, type Assessment } from "@/lib/benchmark";
import { co2, co2s, fmt } from "@/lib/format";

export const GROUPS: Record<SourceLine["group"], { label: string; color: string }> = {
  rice: { label: "มีเทนจากนาข้าว", color: "var(--water)" },
  n2o: { label: "ไนตรัสออกไซด์จากดิน", color: "var(--soil)" },
  co2soil: { label: "ยูเรียและปูน", color: "var(--limec)" },
  fire: { label: "การเผา", color: "var(--ember)" },
  energy: { label: "น้ำมันและไฟฟ้า", color: "var(--energy)" },
};

const pct = (v: number, t: number) => (t > 0 ? `${((v / t) * 100).toLocaleString("th-TH", { maximumFractionDigits: 1 })}%` : "0%");

function groups(r: ScenarioResult) {
  const g: Partial<Record<SourceLine["group"], number>> = {};
  for (const l of r.lines) g[l.group] = (g[l.group] ?? 0) + l.kgCO2e;
  return (Object.entries(g) as [SourceLine["group"], number][]).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
}

export function Band({ r, max }: { r: ScenarioResult; max?: number }) {
  const m = max ?? r.totalKgCO2e;
  const gs = groups(r);
  return (
    <div className="band" role="img" aria-label={gs.map(([k, v]) => `${GROUPS[k].label} ${co2s(v)}`).join(", ") || "ยังไม่มีการปล่อย"}>
      {m > 0 && gs.map(([k, v]) => <i key={k} style={{ width: `${(v / m) * 100}%`, background: GROUPS[k].color }} title={`${GROUPS[k].label} ${co2s(v)}`} />)}
    </div>
  );
}

/** ตัวเลขหลักที่แสดง: แปลงต้นไม้แสดงคาร์บอนที่กักเก็บ, แปลงอื่นแสดงการปล่อย */
export function headline(ev: Evaluation, rec: FieldRecord, view: "baseline" | "project"): { label: string; kg: number } {
  if (ev.trees) return { label: "ต้นไม้กักเก็บคาร์บอนเพิ่ม", kg: ev.trees.removalKgCO2 };
  const r = view === "project" && ev.project ? ev.project : ev.baseline;
  const label = !rec.hasProject ? "แปลงนี้ปล่อยก๊าซเรือนกระจก" : view === "project" ? "หลังเข้าร่วมโครงการ ปล่อย" : "ก่อนเข้าร่วมโครงการ ปล่อย";
  return { label, kg: r.totalKgCO2e };
}

/** ช่องยอดรวมด้านข้าง (จอใหญ่) */
export function Tally({ ev, rec, view, settings }: { ev: Evaluation; rec: FieldRecord; view: "baseline" | "project"; settings: Settings }) {
  const r = view === "project" && ev.project ? ev.project : ev.baseline;
  const head = headline(ev, rec, view);
  const c = co2(head.kg);
  return (
    <div className="tally-card">
      <div className="tally-num">
        <p className="small">{head.label}</p>
        <p><span className="v num">{c.value}</span><span className="u">{c.unit}</span></p>
        {ev.trees && <p className="small" style={{ marginTop: "0.3rem" }}>การปล่อยจากการดูแลแปลง {co2s(r.totalKgCO2e)}</p>}
      </div>
      <div className="tally-body">
        <Band r={r} />
        <ul className="legend">
          {groups(r).map(([k, v]) => (
            <li key={k}><span className="sw" style={{ background: GROUPS[k].color }} /><span className="nm">{GROUPS[k].label}<small>{co2s(v)}</small></span><span className="pc">{pct(v, r.totalKgCO2e)}</span></li>
          ))}
          {r.totalKgCO2e === 0 && <li className="muted">กรอกข้อมูลแล้วยอดจะขึ้นที่นี่ทันที</li>}
        </ul>
        <div className="kv">
          <div>ต่อไร่<b>{co2s(r.perRai)}</b></div>
          <div>ต่อผลผลิต 1 กก.<b>{r.perKgProduct != null ? `${fmt(r.perKgProduct, 3)} kg` : "–"}</b></div>
        </div>
        {(() => {
          const a = assess(rec, ev, settings, view);
          return a ? (
            <div className="tally-level" style={{ "--c": LEVEL_TEXT[a.level].color } as React.CSSProperties}>
              <b>{LEVEL_TEXT[a.level].title}</b>
              <p className="small">{levelSentence(a)}</p>
              <p className="small muted">เกณฑ์: {LEVEL_TEXT[a.level].title} = {LEVEL_RULE[a.level]}</p>
            </div>
          ) : null;
        })()}
        {ev.reductionKgCO2e != null && !(ev.trees && !ev.project) && (
          <div className="credit">
            <span className="small">{ev.trees && !ev.project ? "ต้นไม้กักเก็บคาร์บอนเพิ่ม" : "ลดการปล่อยได้"}</span>
            <b className="num">{co2s(ev.reductionKgCO2e)}</b>
          </div>
        )}
        {ev.tver && (
          <div className="credit">
            <span className="small">เครดิต T-VER ประมาณการ</span>
            <b className="num">{co2s(ev.tver.creditKgCO2e)}</b>
          </div>
        )}
      </div>
    </div>
  );
}

function Lines({ r, title }: { r: ScenarioResult; title: string }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <h3 style={{ marginBottom: "0.5rem" }}>{title}</h3>
      <table style={{ minWidth: 520 }}>
        <thead><tr><th>แหล่งปล่อย</th><th>สมการ</th><th className="r">มวลก๊าซ (กก.)</th><th className="r">kgCO₂e</th><th className="r">%</th></tr></thead>
        <tbody>
          {r.lines.map((l) => (
            <tr key={l.key}>
              <td><span className="sw" style={{ display: "inline-block", width: 10, height: 10, marginRight: 8, borderRadius: 2, background: GROUPS[l.group].color }} />{l.label}</td>
              <td className="small muted">{l.eq}</td>
              <td className="r">{l.mass != null ? fmt(l.mass, 3) : "–"}</td>
              <td className="r">{fmt(l.kgCO2e, 2)}</td>
              <td className="r">{pct(l.kgCO2e, r.totalKgCO2e)}</td>
            </tr>
          ))}
          <tr className="total"><td colSpan={3}>รวม</td><td className="r">{fmt(r.totalKgCO2e, 2)}</td><td className="r">{r.totalKgCO2e > 0 ? "100%" : "–"}</td></tr>
        </tbody>
      </table>
      <p className="small muted" style={{ marginTop: "0.4rem" }}>
        ไนโตรเจนที่ใส่ลงดิน: ปุ๋ยเคมี {fmt(r.nInputs.FSN, 2)} กก., ปุ๋ยอินทรีย์ {fmt(r.nInputs.FON, 2)} กก., เศษพืช {fmt(r.nInputs.FCR, 2)} กก.
      </p>
    </div>
  );
}

/** รายงานผลเต็ม */
export function Report({ ev, rec, settings }: { ev: Evaluation; rec: FieldRecord; settings: Settings }) {
  const both = ev.project ? [ev.baseline, ev.project] : [ev.baseline];
  const max = Math.max(...both.map((r) => r.totalKgCO2e), 0);
  const warnings = [...new Set([...ev.baseline.warnings, ...(ev.project?.warnings ?? [])])];
  return (
    <div className="report">
      {warnings.length > 0 && (
        <div className="warn" style={{ marginBottom: "1.5rem" }}>
          <b>ข้อมูลยังไม่ครบ</b>
          <ul style={{ margin: "0.25rem 0 0", paddingLeft: "1.2rem" }}>{warnings.map((w) => <li key={w}>{w}</li>)}</ul>
        </div>
      )}
      <section>
        <h2>{ev.project ? "ก่อนและหลังเข้าร่วมโครงการ" : "การปล่อยก๊าซเรือนกระจกของแปลง"}</h2>
        <div className="compare">
          {both.map((r, i) => (
            <div key={i} style={{ display: "contents" }}>
              <span>{i === 0 ? (ev.project ? "ก่อนเข้าร่วม" : "ทั้งแปลง") : "หลังเข้าร่วม"}</span>
              <Band r={r} max={max} />
              <span className="v num">{co2s(r.totalKgCO2e)}</span>
            </div>
          ))}
        </div>
        <Share r={ev.project ?? ev.baseline} other={ev.project ? ev.baseline : null} />
        {ev.reductionKgCO2e != null && (
          <p className="headline">
            {ev.trees ? "ลดการปล่อยรวมการกักเก็บของต้นไม้ " : "ลดการปล่อยได้ "}<b className="num">{co2s(ev.reductionKgCO2e)}</b>
            {ev.project && ev.baseline.totalKgCO2e > 0 && <span className="muted"> หรือ {fmt(((ev.baseline.totalKgCO2e - ev.project.totalKgCO2e) / ev.baseline.totalKgCO2e) * 100, 1)}% ของก่อนเข้าร่วม</span>}
          </p>
        )}
      </section>

      <LevelSection a={assess(rec, ev, settings, ev.project ? "project" : "baseline")} rec={rec} hasProject={!!ev.project} />

      {ev.trees && (
        <section>
          <h2>คาร์บอนที่ต้นไม้กักเก็บ</h2>
          {ev.trees.method === "count" ? (
            <p className="headline">{rec.trees.treeCount.toLocaleString()} ต้น × 9.5 kgCO₂ × {rec.trees.years} ปี = <b className="num">{co2s(ev.trees.removalKgCO2)}</b></p>
          ) : (
            <>
              <table style={{ marginTop: "0.5rem" }}>
                <thead><tr><th>รายการ (ทั้งแปลง)</th><th className="r">ปีฐาน</th><th className="r">ปีที่วัด</th></tr></thead>
                <tbody>
                  {([["มวลชีวภาพเหนือดิน", "agbKg"], ["มวลชีวภาพในราก", "bgbKg"], ...(rec.trees.deadwood && rec.trees.deadwood !== "none" ? [["คาร์บอนไม้ตาย/เศษซาก", "deadKg"] as const] : []), ["คาร์บอน", "carbonKg"], ["คิดเป็น CO₂", "co2Kg"]] as const).map(([l, k]) => (
                    <tr key={k}><td>{l}</td><td className="r">{fmt((ev.trees!.baseline?.[k] ?? 0) / 1000, 2)} ตัน</td><td className="r">{fmt((ev.trees!.current?.[k] ?? 0) / 1000, 2)} ตัน</td></tr>
                  ))}
                </tbody>
              </table>
              <p className="headline">กักเก็บเพิ่มขึ้น <b className="num">{co2s(ev.trees.removalKgCO2)}</b> <span className="muted">เฉลี่ยปีละ {co2s(ev.trees.annualKgCO2)}</span></p>
            </>
          )}
        </section>
      )}

      {ev.soil && (
        <section>
          <h2>คาร์บอนในดิน</h2>
          <p className="headline">
            SOC {fmt(ev.soil.soc0PerRai, 2)} → {fmt(ev.soil.soctPerRai, 2)} tC/ไร่ เพิ่มขึ้น <b className="num">{co2s(ev.soil.deltaKgCO2)}</b>
            <span className="muted"> ในช่วง {ev.soil.years} ปี ({ev.soil.method === "sample" ? "เก็บตัวอย่างดิน" : "ค่าอ้างอิง IPCC"})</span>
          </p>
        </section>
      )}

      {ev.tver && <TverBlock r={ev.tver} />}
      {ev.extras.map((x) => <TverBlock key={x.method} r={x} />)}

      <section>
        <details className="more" open={false}>
          <summary>ดูรายละเอียดการคำนวณทุกแหล่งปล่อย</summary>
          <div className="stack" style={{ "--gap": "1.5rem", marginTop: "0.75rem" } as React.CSSProperties}>
            <Lines r={ev.baseline} title={ev.project ? "ก่อนเข้าร่วมโครงการ" : "ทุกแหล่งปล่อย"} />
            {ev.project && <Lines r={ev.project} title="หลังเข้าร่วมโครงการ" />}
          </div>
        </details>
      </section>
    </div>
  );
}

/** สัดส่วนการปล่อยของแต่ละกิจกรรม แสดง % ใต้ชื่อกิจกรรม */
function Share({ r, other }: { r: ScenarioResult; other: ScenarioResult | null }) {
  const gs = groups(r);
  if (!gs.length) return <p className="muted" style={{ marginTop: "0.75rem" }}>ยังไม่มีข้อมูลกิจกรรมที่ปล่อยก๊าซ</p>;
  return (
    <>
      <p className="small muted" style={{ marginTop: "1rem" }}>{other ? "สัดส่วนตามกิจกรรม (หลังเข้าร่วมโครงการ)" : "สัดส่วนตามกิจกรรม"}</p>
      <ul className="share">
        {gs.map(([k, v]) => (
          <li key={k} style={{ "--c": GROUPS[k].color } as React.CSSProperties}>
            <span className="nm">{GROUPS[k].label}</span>
            <span className="pc">{pct(v, r.totalKgCO2e)}</span>
            <span className="sub"> ของการปล่อยทั้งหมด</span>
            <span className="sub" style={{ display: "block" }}>{co2s(v)}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

/** เทียบค่าการปล่อยต่อผลผลิตกับค่าอ้างอิง */
function LevelSection({ a, rec, hasProject }: { a: Assessment | null; rec: FieldRecord; hasProject: boolean }) {
  if (rec.crop === "fruit" || rec.crop === "forest") return null;
  return (
    <section>
      <h2>ระดับการปล่อยเมื่อเทียบค่าอ้างอิง</h2>
      {!a && yieldIssue(rec.cropName, (hasProject ? rec.project : rec.baseline).yieldKgPerRai) ? (
        <p className="warn" style={{ marginTop: "0.5rem" }}>
          ยังเทียบไม่ได้: {yieldIssue(rec.cropName, (hasProject ? rec.project : rec.baseline).yieldKgPerRai)} (แก้ได้ในขั้นที่ 1 แปลง)
        </p>
      ) : !a ? (
        <p className="muted" style={{ marginTop: "0.5rem" }}>
          {rec.baseline.yieldKgPerRai > 0
            ? `ยังไม่มีค่าอ้างอิงสำหรับ${rec.cropName} ผู้ดูแลระบบกำหนดค่าเองได้ในหน้าตั้งค่า`
            : "กรอกผลผลิต (กก./ไร่) ในขั้นที่ 1 เพื่อเทียบระดับการปล่อยต่อผลผลิต"}
        </p>
      ) : (
        <div className="level" style={{ "--c": LEVEL_TEXT[a.level].color } as React.CSSProperties}>
          <p className="t">{LEVEL_TEXT[a.level].title}{hasProject ? " (หลังเข้าร่วมโครงการ)" : ""}</p>
          <p>{levelSentence(a)}</p>
          <p className="small">เกณฑ์: {LEVEL_TEXT[a.level].title} = {LEVEL_RULE[a.level]}</p>
          <Gauge ratio={a.ratio} />
          <p className="small muted">
            เกณฑ์ทั้งหมด: ต่ำกว่าค่าอ้างอิง = {LEVEL_RULE.low}, อยู่ในเกณฑ์ = {LEVEL_RULE.near}, สูงกว่าค่าอ้างอิง = {LEVEL_RULE.high}
            <br />ค่าอ้างอิง: {a.source}
            <br />ประเทศไทยยังไม่มีมาตรฐานการปล่อยระดับแปลงตามกฎหมาย จึงเทียบกับค่าเฉลี่ยจากงานวิจัยในประเทศ ขอบเขตการคำนวณของแต่ละงานอาจต่างกัน
          </p>
        </div>
      )}
    </section>
  );
}

function Gauge({ ratio }: { ratio: number }) {
  // สเกล 0–300% ของค่าอ้างอิง
  const pos = Math.max(0, Math.min(100, (ratio / 3) * 100));
  return (
    <div className="gauge" aria-hidden>
      <span className="mk" style={{ left: `${pos}%` }}><span>แปลงนี้</span></span>
      <span className="ref" style={{ left: "33.33%" }}>ค่าอ้างอิง</span>
      <span className="ref" style={{ left: "0%", transform: "none" }}>0</span>
      <span className="ref" style={{ left: "100%", transform: "translateX(-100%)" }}>3 เท่า</span>
    </div>
  );
}

/** ผลคาร์บอนเครดิต 1 ระเบียบวิธี + ตารางพารามิเตอร์สำหรับบันทึกตามมาตรฐาน */
function TverBlock({ r }: { r: TverResult }) {
  const show = (v: string | number | null) => (v == null ? "" : typeof v === "number" ? fmt(v, Number.isInteger(v) ? 0 : Math.abs(v) < 10 ? 4 : 2) : v);
  return (
    <section>
      <h2>คาร์บอนเครดิต T-VER (ประมาณการ)</h2>
      <p><b>{r.method}</b> {r.title}</p>
      <p className="muted small">สมการ: {r.equation} — ใช้คัดกรองและเตรียมข้อมูลเบื้องต้น การขอรับรองจริงต้องผ่านผู้ประเมินภายนอก (VVB) และ อบก.</p>
      <table style={{ maxWidth: 640, marginTop: "0.5rem" }}>
        <thead><tr><th>องค์ประกอบ</th><th className="r">kgCO₂e</th><th className="r">tCO₂e</th></tr></thead>
        <tbody>
          {r.steps.map((s) => <tr key={s.label}><td>{s.label}</td><td className="r">{fmt(s.value, 2)}</td><td className="r">{fmt(s.value / 1000, 3)}</td></tr>)}
          <tr className="total"><td>เครดิตที่ขอรับรองได้</td><td className="r">{fmt(r.creditKgCO2e, 2)}</td><td className="r">{fmt(r.creditKgCO2e / 1000, 3)}</td></tr>
          {r.periodYears !== 1 && <tr><td>เฉลี่ยต่อปี ({r.periodYears} ปี)</td><td className="r">{fmt(r.perYearKgCO2e, 2)}</td><td className="r">{fmt(r.perYearKgCO2e / 1000, 3)}</td></tr>}
        </tbody>
      </table>
      <ul className="checks">
        {r.checks.map((c) => <li key={c.text}><span className={c.ok ? "ok" : "no"}>{c.ok ? "ผ่าน" : "ไม่ผ่าน"}</span><span>{c.text}</span></li>)}
      </ul>
      <details className="more"><summary>ข้อกำหนดและสมมติฐานของระเบียบวิธี</summary>
        <ul className="small muted" style={{ paddingLeft: "1.2rem" }}>{r.notes.map((n) => <li key={n}>{n}</li>)}</ul>
      </details>
      <details className="more"><summary>ตารางพารามิเตอร์สำหรับบันทึกตามมาตรฐาน (PDD / รายงานติดตามผล)</summary>
        <div style={{ overflowX: "auto" }}>
          <table className="params">
            <thead><tr><th>พารามิเตอร์</th><th>ความหมาย</th><th>หน่วย</th><th className="r">กรณีฐาน</th><th className="r">กรณีโครงการ</th><th>แหล่งข้อมูล / วิธีติดตามผล</th></tr></thead>
            <tbody>
              {(["ต้องติดตามผล", "ไม่ต้องติดตามผล (ค่าคงที่)"] as const).map((g, gi) => (
                <Fragment key={g}>
                  <tr className="grp"><td colSpan={6}>{g}</td></tr>
                  {r.params.filter((p) => p.monitored === (gi === 0)).map((p) => (
                    <tr key={p.sym + p.desc}><td><b>{p.sym}</b></td><td>{p.desc}</td><td>{p.unit}</td><td className="r">{show(p.bl)}</td><td className="r">{show(p.pj)}</td><td className="small">{p.source}</td></tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
        <p className="small muted">ดาวน์โหลด Excel เพื่อได้ชีต "T-VER" ที่มีตารางนี้ครบ ใช้กรอกเอกสารข้อเสนอโครงการและรายงานการติดตามผลตามแบบของ อบก.</p>
      </details>
    </section>
  );
}
