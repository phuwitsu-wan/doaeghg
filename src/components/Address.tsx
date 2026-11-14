import { useEffect, useId, useState } from "react";
import { PROVINCES } from "@/lib/provinces";
import { currentPosition, districtsOf, loadAddress, reverseGeocode, subdistrictsOf, type AddressData } from "@/lib/address";

export interface AddressValue { province: string; district: string; subdistrict: string; lat: string; lng: string }

function Pick({ label, value, options, onChange, disabled, placeholder }: {
  label: string; value: string; options: string[]; onChange: (v: string) => void; disabled?: boolean; placeholder: string;
}) {
  const id = useId();
  const opts = value && !options.includes(value) ? [value, ...options] : options;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <select id={id} className="inp" value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
        <option value="">{placeholder}</option>
        {opts.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

/** เลือกจังหวัด → อำเภอ → ตำบล และปุ่มใช้ตำแหน่งปัจจุบันเพื่อกรอกอัตโนมัติ */
export function AddressPicker({ value, onChange, withGps = true }: { value: AddressValue; onChange: (v: Partial<AddressValue>) => void; withGps?: boolean }) {
  const [data, setData] = useState<AddressData | null>(null);
  const [state, setState] = useState<{ busy: boolean; msg: string; err: boolean }>({ busy: false, msg: "", err: false });
  useEffect(() => { loadAddress().then(setData).catch(() => setData(null)); }, []);

  const dists = data ? districtsOf(data, value.province).map((d) => d[0]) : [];
  const subs = data ? subdistrictsOf(data, value.province, value.district) : [];

  const locate = async () => {
    setState({ busy: true, msg: "กำลังหาตำแหน่ง…", err: false });
    try {
      const pos = await currentPosition();
      const lat = pos.coords.latitude.toFixed(6), lng = pos.coords.longitude.toFixed(6);
      onChange({ lat, lng });
      setState({ busy: true, msg: "ได้พิกัดแล้ว กำลังค้นหาตำบล อำเภอ จังหวัด…", err: false });
      try {
        const p = await reverseGeocode(+lat, +lng);
        if (!p.province) throw new Error("ไม่พบชื่อจังหวัดจากพิกัดนี้");
        onChange({ lat, lng, province: p.province, district: p.district, subdistrict: p.subdistrict });
        const miss = [!p.district && "อำเภอ", !p.subdistrict && "ตำบล"].filter(Boolean).join(" และ ");
        setState({ busy: false, msg: `พบ ${[p.subdistrict && `ต.${p.subdistrict}`, p.district && `อ.${p.district}`, `จ.${p.province}`].filter(Boolean).join(" ")}${miss ? ` กรุณาเลือก${miss}เอง` : ""}`, err: false });
      } catch (e) {
        setState({ busy: false, msg: `บันทึกพิกัด ${lat}, ${lng} แล้ว แต่หาชื่อตำบลไม่ได้ (${(e as Error).message || "ไม่มีอินเทอร์เน็ต"}) กรุณาเลือกเอง`, err: true });
      }
    } catch (e) {
      setState({ busy: false, msg: (e as Error).message, err: true });
    }
  };

  return (
    <div className="stack" style={{ "--gap": "0.75rem" } as React.CSSProperties}>
      {withGps && (
        <div className="row">
          <button type="button" className="btn btn-line" onClick={locate} disabled={state.busy}>{state.busy ? "กำลังค้นหา…" : "ใช้ตำแหน่งปัจจุบัน (GPS)"}</button>
          {state.msg && <span className="small" role="status" style={{ color: state.err ? "var(--ember)" : "var(--celadon-deep)" }}>{state.msg}</span>}
        </div>
      )}
      <div className="grid3">
        <Pick label="จังหวัด" placeholder="เลือกจังหวัด" value={value.province} options={PROVINCES}
          onChange={(v) => onChange({ province: v, district: "", subdistrict: "" })} />
        <Pick label="อำเภอ / เขต" placeholder={value.province ? "เลือกอำเภอ" : "เลือกจังหวัดก่อน"} value={value.district} options={dists}
          disabled={!value.province} onChange={(v) => onChange({ district: v, subdistrict: "" })} />
        <Pick label="ตำบล / แขวง" placeholder={value.district ? "เลือกตำบล" : "เลือกอำเภอก่อน"} value={value.subdistrict} options={subs}
          disabled={!value.district} onChange={(v) => onChange({ subdistrict: v })} />
      </div>
      {withGps && (value.lat || value.lng) && <p className="small muted">พิกัด {value.lat}, {value.lng}</p>}
    </div>
  );
}
