import { useEffect } from "react";
import { CONFIG } from "@/config";
import { href, useRoute } from "@/lib/router";
import { flush, logEvent, useProfile } from "@/lib/profile";
import { useSettings } from "@/lib/store";
import { Home } from "@/screens/Home";
import { Record } from "@/screens/Record";
import { Methodology } from "@/screens/Methodology";
import { Settings } from "@/screens/Settings";
import { ProfileScreen } from "@/screens/ProfileScreen";

let openedLogged = false;

export function App() {
  const [page, id] = useRoute();
  const profile = useProfile();
  const [settings] = useSettings();

  useEffect(() => {
    const t = { plot: "บันทึกแปลง", method: "วิธีคำนวณ", settings: "ตั้งค่า", profile: "ผู้ใช้งาน" }[page ?? ""];
    document.title = t ? `${t} | ${CONFIG.appName}` : CONFIG.appName;
  }, [page]);

  // บันทึกการเปิดใช้งาน 1 ครั้งต่อการเปิดแอป และส่งข้อมูลที่ค้างเมื่อกลับมาออนไลน์
  useEffect(() => {
    if (profile && !openedLogged) { openedLogged = true; logEvent("open", undefined, settings); }
    void flush(settings);
    const on = () => void flush(settings);
    window.addEventListener("online", on);
    return () => window.removeEventListener("online", on);
  }, [profile, settings]);

  const cur = (p?: string) => (page === p ? "page" : undefined);
  let body: React.ReactNode;
  if (!profile && page !== "method") body = <ProfileScreen firstRun />;
  else if (page === "plot" && id) body = <Record id={id} />;
  else if (page === "method") body = <Methodology />;
  else if (page === "settings") body = <Settings />;
  else if (page === "profile") body = <ProfileScreen firstRun={false} />;
  else body = <Home />;

  return (
    <>
      <header className="top">
        <div className="top-in">
          <a className="brand" href={href("/")}>
            <img src="/icon-192.png" alt="" width={34} height={34} style={{ borderRadius: 8 }} />
            <span><b className="bn"><span className="full">{CONFIG.appName}</span><span className="short">{CONFIG.appShortName}</span></b><small className="bs">{CONFIG.references}</small></span>
          </a>
          <nav>
            {profile && <a className="who" href={href("/profile")} aria-current={cur("profile")} title="ข้อมูลผู้ใช้งาน">{profile.name}</a>}
            <a href={href("/")} aria-current={!page || page === "plot" ? "page" : undefined}>แปลง</a>
            <a href={href("/method")} aria-current={cur("method")}>วิธีคำนวณ</a>
            <a href={href("/settings")} aria-current={cur("settings")}>ตั้งค่า</a>
          </nav>
        </div>
      </header>
      <div className="wrap">{body}</div>
    </>
  );
}
