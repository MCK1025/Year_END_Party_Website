import { useCallback, useEffect, useState } from "react";
import { type Dashboard, dashboardSchema } from "../../supabase/functions/_shared/contracts";
import { Button, Note } from "../components/ui";
import { api, message, supabase } from "../lib/api";
import { Forest } from "../pages/Forest";
import { AdminLogin } from "./AdminLogin";
import { AdminContext } from "./context";
import { DataPanel } from "./DataPanel";
import { PeoplePanel } from "./PeoplePanel";
import { ProgressPanel } from "./ProgressPanel";
import { QuestionsPanel } from "./QuestionsPanel";
import { RecapsPanel } from "./RecapsPanel";
import { RoundsPanel } from "./RoundsPanel";
import { SettingsPanel } from "./SettingsPanel";
import { TastesPanel } from "./TastesPanel";
import { TreePanel } from "./TreePanel";

const tabs = [
  "실시간 진행",
  "사원 관리",
  "설문·추천",
  "대나무숲",
  "마음 트리",
  "질문 관리",
  "1년 회고",
  "인물 맞히기",
  "취향 통계",
  "리허설",
  "설정·내보내기",
] as const;
type Tab = (typeof tabs)[number];
function Contents({ tab }: { readonly tab: Tab }) {
  switch (tab) {
    case "실시간 진행":
      return <ProgressPanel />;
    case "사원 관리":
      return <PeoplePanel />;
    case "설문·추천":
      return <DataPanel />;
    case "대나무숲":
      return <Forest admin />;
    case "마음 트리":
      return <TreePanel />;
    case "질문 관리":
      return <QuestionsPanel />;
    case "1년 회고":
      return <RecapsPanel />;
    case "인물 맞히기":
      return <RoundsPanel />;
    case "취향 통계":
      return <TastesPanel />;
    case "리허설":
      return <ProgressPanel rehearsal />;
    case "설정·내보내기":
      return <SettingsPanel />;
    default:
      return tab satisfies never;
  }
}
export function Admin() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("실시간 진행");
  const refresh = useCallback(async () => {
    const next = await api({ action: "dashboard", payload: {} }, dashboardSchema);
    setData(next);
    setError("");
  }, []);
  useEffect(() => {
    let live = true;
    supabase.auth
      .getUser()
      .then(async ({ data }) => {
        if (live && data.user && !data.user.is_anonymous) await refresh();
      })
      .catch((e: unknown) => {
        if (live) setError(message(e));
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [refresh]);
  useEffect(() => {
    if (!data) return;
    const timer = setInterval(() => {
      void refresh().catch((e: unknown) => setError(message(e)));
    }, 20000);
    return () => clearInterval(timer);
  }, [data, refresh]);
  if (loading)
    return (
      <main className="guest">
        <Note>운영자 권한을 확인하고 있습니다.</Note>
      </main>
    );
  if (!data)
    return (
      <>
        <AdminLogin onLogin={refresh} />
        {error && (
          <div className="guest">
            <Note error>{error}</Note>
          </div>
        )}
      </>
    );
  return (
    <AdminContext.Provider value={{ data, refresh }}>
      <main className="admin">
        <header className="admin-title">
          <div>
            <p className="overline">2026 · Organizer's desk</p>
            <h1 style={{ fontSize: 36 }}>우리의 저녁을 준비합니다.</h1>
          </div>
          <div className="actions">
            <Button
              variant="secondary"
              onClick={() => void refresh().catch((e: unknown) => setError(message(e)))}
            >
              새로고침
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                void supabase.auth.signOut();
                setData(null);
              }}
            >
              로그아웃
            </Button>
          </div>
        </header>
        {error && <Note error>{error}</Note>}
        <nav className="admin-nav" aria-label="운영 메뉴">
          {tabs.map((t) => (
            <button
              type="button"
              key={t}
              aria-current={tab === t ? "page" : undefined}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ))}
        </nav>
        <Contents tab={tab} />
      </main>
    </AdminContext.Provider>
  );
}
