import { useEffect, useId, useState } from "react";

/** ช่องตัวเลข: แป้นตัวเลขบนมือถือ พิมพ์ทศนิยมได้ เลือกทั้งช่องเมื่อแตะ */
export function NumInput({ value, onChange, id, label, scale = 1 }: {
  value: number; onChange: (n: number) => void; id?: string; label?: string; scale?: number;
}) {
  const shown = value / scale;
  const [text, setText] = useState(shown ? String(round(shown)) : "");
  useEffect(() => {
    const p = parseFloat(text);
    if (Math.abs((Number.isFinite(p) ? p : 0) - shown) > 1e-9) setText(shown ? String(round(shown)) : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown]);
  return (
    <input
      id={id} aria-label={label} className="inp n" inputMode="decimal" placeholder="0" value={text}
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => {
        const t = e.target.value.replace(/,/g, "").replace(/[^0-9.]/g, "");
        setText(t);
        const n = parseFloat(t);
        onChange(Number.isFinite(n) ? n * scale : 0);
      }}
    />
  );
}
const round = (n: number) => Math.round(n * 1e4) / 1e4;

/** ช่องตัวเลขพร้อมป้ายกำกับและหน่วย; units หลายหน่วยกดสลับได้ (เช่น กก. ↔ กระสอบ) */
export function Num({ label, value, onChange, unit, units, hint }: {
  label: string; value: number; onChange: (n: number) => void; unit?: string;
  units?: { label: string; scale: number }[]; hint?: string;
}) {
  const id = useId();
  const [ui, setUi] = useState(0);
  const u = units?.[ui];
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="box">
        <NumInput id={id} value={value} onChange={onChange} scale={u?.scale ?? 1} />
        {units ? (
          <button type="button" className="unit unit-toggle" title="กดเพื่อเปลี่ยนหน่วย" onClick={() => setUi((ui + 1) % units.length)}>{u!.label}</button>
        ) : unit ? <span className="unit">{unit}</span> : null}
      </div>
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}

export function Text({ label, value, onChange, placeholder, hint }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; hint?: string }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input id={id} className="inp" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}

export function Select<K extends string>({ label, value, options, onChange }: { label: string; value: K; options: [K, string][]; onChange: (v: K) => void }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <select id={id} className="inp" value={value} onChange={(e) => onChange(e.target.value as K)}>
        {options.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
      </select>
    </div>
  );
}

/** เลือก 1 ตัวเลือกด้วยชิป */
export function Choice<K extends string>({ value, options, onChange, boxy, label }: {
  value: K; options: { key: K; label: string; sub?: string }[]; onChange: (k: K) => void; boxy?: boolean; label: string;
}) {
  return (
    <div className={`chips${boxy ? " boxy" : ""}`} role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.key} type="button" className="chip" aria-pressed={value === o.key} onClick={() => onChange(o.key)}>
          <span>{o.label}</span>{o.sub && <small>{o.sub}</small>}
        </button>
      ))}
    </div>
  );
}

/** คำถาม 1 ข้อในหน้า */
export function Q({ title, help, children }: { title: string; help?: string; children: React.ReactNode }) {
  return (
    <div className="q">
      <h3>{title}</h3>
      {help && <p className="muted">{help}</p>}
      {children}
    </div>
  );
}

export function Item({ title, onRemove, children }: { title: React.ReactNode; onRemove: () => void; children?: React.ReactNode }) {
  return (
    <div className="item">
      <div className="item-title"><span>{title}</span><button type="button" className="btn-link btn-del" onClick={onRemove}>ลบ</button></div>
      {children && <div className="grid3">{children}</div>}
    </div>
  );
}
