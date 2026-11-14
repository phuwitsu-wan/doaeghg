import { CFOA, ELEC_EF, FUELS, GWP_SETS, MACHINES, N2O, ORGANIC_FERTS, RESIDUES, ROOT_RATIOS, SF_P, SF_W, TRANSPORT_FUELS, BURN } from "@/lib/engine/factors";
import { ALLOMETRIC } from "@/lib/engine/trees";
import { BENCHMARKS } from "@/lib/benchmark";


function Eq({ code, children }: { code: string; children: React.ReactNode }) {
  return (
    <div className="eq"><b>{code}</b>{children}</div>
  );
}

function T({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table>
        <thead><tr>{head.map((h) => <th key={h}>{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

export function Methodology() {
  return (
    <article className="doc">
      <header className="stack">
        <h1>วิธีคำนวณและค่าสัมประสิทธิ์</h1>
        <p className="muted">
          ระบบคำนวณตามคู่มือ MRV การปล่อยก๊าซเรือนกระจกในภาคเกษตร (GIZ / TGC EMC, 2568) ซึ่งอ้างอิง 2006 IPCC Guidelines และ 2019 Refinement ระดับ Tier 1
          และระเบียบวิธี T-VER ขององค์การบริหารจัดการก๊าซเรือนกระจก (อบก.) ผลลัพธ์ทุกค่าอยู่ในหน่วย kgCO₂e
        </p>
      </header>

      <section>
        <h2>ขอบเขตการคำนวณ</h2>
        <p>Scope 1 ในแปลง: การเผาเศษวัสดุ มีเทนจากนาข้าว N₂O จากปุ๋ยและเศษวัสดุ CO₂ จากยูเรียและปูน และน้ำมันเครื่องจักรกลเกษตร
          Scope 2 นอกแปลง: การใช้ไฟฟ้าและการขนส่งเศษวัสดุหรือผลผลิต สำหรับไม้ผลและป่าไม้ คิดการกักเก็บคาร์บอนของต้นไม้เพิ่ม</p>
        <T head={["ชุด GWP", "CO₂", "CH₄", "N₂O"]} rows={Object.values(GWP_SETS).map((g) => [g.label, g.CO2, g.CH4, g.N2O])} />
      </section>

      <section>
        <h2>การเผาเศษวัสดุ</h2>
        <Eq code="Eq.1">L_fire = A × MB × Cf × Gef × 10⁻³ × GWP{"\n"}A = พื้นที่เผา (ไร่), MB = ชีวมวลก่อนเผา (กก./ไร่), Cf = {BURN.CF}, Gef CH₄ = {BURN.EF_CH4} g/kg, N₂O = {BURN.EF_N2O} g/kg</Eq>
        <p>เศษวัสดุที่เหลือหลังเผาคิดเป็น {BURN.UNBURNT_FRACTION * 100}% ของปริมาณก่อนเผา และนำไปคิด N₂O ต่อ (Eq.3.3)</p>
        <T head={["เศษวัสดุ", "N (%)", "ค่าอ้างอิง (กก./ไร่)", "ที่มา"]} rows={Object.values(RESIDUES).map((r) => [r.label, r.nPct, r.defaultKgPerRai || "–", r.note])} />
      </section>

      <section>
        <h2>มีเทนจากนาข้าว</h2>
        <Eq code="Eq.2">CH₄ = EF × t × (AH × 0.16) × GWP_CH₄{"\n"}EF = EFc × SFw × SFp × SFo,   EFc = 1.22 kgCH₄/ha/วัน (เอเชียตะวันออกเฉียงใต้){"\n"}SFo = (1 + Σ ROAᵢ × 0.00625 × CFOAᵢ)^0.59</Eq>
        <T head={["การจัดการน้ำระหว่างปลูก", "SFw"]} rows={Object.values(SF_W).map((v) => [v.label, v.value])} />
        <T head={["การจัดการน้ำก่อนปลูก", "SFp"]} rows={Object.values(SF_P).map((v) => [v.label, v.value])} />
        <T head={["สารอินทรีย์", "CFOA"]} rows={Object.values(CFOA).map((v) => [v.label, v.value])} />
      </section>

      <section>
        <h2>ไนตรัสออกไซด์จากดิน</h2>
        <Eq code="Eq.3">N₂O_direct = (FSN + FON + FCR) × EF1 × 44/28 × GWP_N₂O{"\n"}EF1 = {N2O.EF1} (ดินทั่วไป), EF1FR = {N2O.EF1FR} (นาข้าว)</Eq>
        <Eq code="Eq.4">N₂O_ATD = (FSN × {N2O.FRAC_GASF} + FON × {N2O.FRAC_GASM}) × {N2O.EF4} × 44/28 × GWP_N₂O</Eq>
        <Eq code="Eq.5">N₂O_L = (FSN + FON + FCR) × {N2O.FRAC_LEACH} × {N2O.EF5} × 44/28 × GWP_N₂O</Eq>
        <p>FSN = Σ พื้นที่ × อัตราปุ๋ย × %N ของสูตร, FON = Σ พื้นที่ × ปุ๋ยอินทรีย์ × %N, FCR = เศษวัสดุที่เหลือในแปลง × %N</p>
        <T head={["ปุ๋ยอินทรีย์", "N (%)"]} rows={Object.values(ORGANIC_FERTS).map((v) => [v.label, v.nPct])} />
      </section>

      <section>
        <h2>ยูเรีย ปูน และพลังงาน</h2>
        <Eq code="Eq.6">CO₂ = ปุ๋ยยูเรีย (กก.) × 0.20 × 44/12</Eq>
        <Eq code="Eq.7">CO₂ = (ปูนขาว × 0.12 + โดโลไมต์ × 0.13) × 44/12</Eq>
        <Eq code="Eq.8">CO₂e = ลิตรน้ำมัน × EF ต่อลิตร,   ลิตร = ชม./ไร่ × จำนวนครั้ง × L/ชม. × พื้นที่</Eq>
        <T head={["เชื้อเพลิงเครื่องจักร (off-road)", "kgCO₂e/ลิตร"]} rows={Object.values(FUELS).map((v) => [v.label, v.efPerL])} />
        <T head={["เครื่องจักร", "ลิตร/ชม."]} rows={Object.values(MACHINES).filter((m) => m.lph).map((v) => [v.label, v.lph])} />
        <Eq code="Eq.9">CO₂e = ไฟฟ้า (kWh) × EF ไฟฟ้า</Eq>
        <T head={["EF ไฟฟ้า", "kgCO₂e/kWh"]} rows={Object.values(ELEC_EF).map((v) => [v.label, v.value])} />
        <Eq code="Eq.10">CO₂e = ปริมาณเชื้อเพลิงขนส่ง × EF</Eq>
        <T head={["เชื้อเพลิงขนส่ง (on-road)", "kgCO₂e/หน่วย"]} rows={Object.values(TRANSPORT_FUELS).map((v) => [v.label, v.ef])} />
      </section>

      <section>
        <h2>การกักเก็บคาร์บอนของต้นไม้</h2>
        <p>ตาม T-VER-TOOL-FOR/AGR-01: มวลชีวภาพเหนือดินจากสมการแอลโลเมตรี (D = DBH ซม., H = ม.) นับเฉพาะต้นที่ DBH ≥ 4.5 ซม. และสูงเกิน 1.3 ม.</p>
        <Eq code="Tree">CO₂ = (AGB + AGB × R) × CF × 44/12,   CF = 0.47{"\n"}การกักเก็บ = CO₂(ปีที่วัด) − CO₂(ปีฐาน){"\n"}วิธีนับต้น: จำนวนต้น × 9.5 kgCO₂/ต้น/ปี</Eq>
        <T head={["สมการ", "ที่มา"]} rows={Object.values(ALLOMETRIC).map((v) => [v.label, v.source])} />
        <p>ใบตามสมการ Ogawa ใช้รูป 1/WL = 28/(WS+WB) + 0.025 ซึ่งเป็นรูปดั้งเดิมของ Ogawa et al. (1965)</p>
        <T head={["สัดส่วนราก/ลำต้น (IPCC Table 4.4)", "R"]} rows={Object.values(ROOT_RATIOS).map((v) => [v.label, v.value])} />
      </section>

      <section>
        <h2>โหมด T-VER</h2>
        <ul>
          <li><strong>ข้าว (T-VER-P-METH-13-08):</strong> ER = (BE − PE) × (1 − 0.15); CH₄ กรณีฐานคูณ 0.89; N₂O ใช้ FSN + FON ด้วย EF 0.003 (ขังน้ำต่อเนื่อง) หรือ 0.005 (ระบายน้ำ); เชื้อเพลิงและการเผานับเมื่อ ≥ 5% ของปริมาณที่ลดได้</li>
          <li><strong>พืชไร่ พืชผัก (T-VER-S-METH-13-05):</strong> ER = BE − PE จาก N₂O (EF 0.010) ยูเรีย ปูน และเชื้อเพลิง ต้องลดปุ๋ยเคมี N ≥ 5%</li>
          <li><strong>ไม้ผล พืชยืนต้น (T-VER-S-METH-13-06):</strong> การกักเก็บของต้นไม้ + (การปล่อยกรณีฐาน − กรณีโครงการ)</li>
          <li><strong>ป่าไม้ (T-VER-S-METH-13-01 / 13-04):</strong> การกักเก็บของต้นไม้ที่เพิ่มขึ้น หักการปล่อยจากกิจกรรมโครงการ</li>
        </ul>
        <p>ผลในโหมด T-VER เป็นการประมาณการเบื้องต้น ใช้วางแผนและคัดกรองโครงการ การขอรับรองจริงต้องจัดทำเอกสารข้อเสนอโครงการ (PDD) และผ่านการตรวจสอบโดยผู้ประเมินภายนอก</p>
      </section>

      <section>
        <h2>การเทียบระดับกับค่าอ้างอิง</h2>
        <p>ประเทศไทยยังไม่มีมาตรฐานการปล่อยก๊าซเรือนกระจกระดับแปลงตามกฎหมาย ระบบจึงเทียบค่าการปล่อยต่อผลผลิต 1 กก. กับค่าเฉลี่ยจากงานวิจัยในประเทศ
          ต่ำกว่า 80% ของค่าอ้างอิง = ต่ำกว่าค่าอ้างอิง, 80–120% = อยู่ในเกณฑ์, เกิน 120% = สูงกว่าค่าอ้างอิง หน่วยงานแก้ค่าอ้างอิงเองได้ในหน้าตั้งค่า</p>
        <T head={["พืช", "kgCO₂e/กก.", "ที่มา"]} rows={Object.entries(BENCHMARKS).map(([k, v]) => [k, v.value, v.source])} />
      </section>

      <section>
        <h2>แหล่งอ้างอิง</h2>
        <ul>
          <li>คู่มือ MRV การปล่อยก๊าซเรือนกระจกในภาคเกษตร สำหรับโครงการส่งเสริมการจัดการชีวมวลของข้าวและอ้อยหลังการเก็บเกี่ยว (GIZ, 2568) และ Worksheet_Rice / Sugarcane_GHG_Cal</li>
          <li>IPCC (2006) Guidelines for National GHG Inventories, Vol.2 Energy และ Vol.4 AFOLU; IPCC (2019) Refinement Vol.4</li>
          <li><a href="https://ghgreduction.tgo.or.th/" target="_blank" rel="noreferrer">อบก.: ระเบียบวิธี T-VER, ค่า GWP สำหรับโครงการ T-VER และค่า Emission Factor</a></li>
          <li>ค่า EF ไฟฟ้า 0.4750 kgCO₂e/kWh: ประกาศ อบก. สำหรับคาร์บอนฟุตพริ้นท์องค์กร มีผลตั้งแต่ 1 ม.ค. 2569</li>
        </ul>
      </section>
    </article>
  );
}
