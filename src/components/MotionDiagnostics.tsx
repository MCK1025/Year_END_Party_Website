import { useEffect, useState } from "react";
import { clearMotion, motionReport } from "../lib/motionDebug";
export function MotionDiagnostics({ still }: { readonly still: boolean }) {
  const [open, setOpen] = useState(false);
  const [, refresh] = useState(0);
  const [manual, setManual] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => {
    if (!open) return;
    const timer = window.setInterval(() => refresh((n) => n + 1), 500);
    return () => clearInterval(timer);
  }, [open]);
  const report = open ? motionReport(still) : null;
  function decision(scope: "invitation" | "book") {
    const labels: Record<string, string> = {
      webgl: "WebGL",
      dom: "본문 입체 전환",
      simple: scope === "invitation" ? "간단한 봉투 효과" : "간단한 전환",
      static: "정적 초대장",
      "3d": "3D",
      none: "효과 없음",
    };
    const latest = report?.events
      .filter(
        (e) =>
          e.scope === scope && typeof e.details.mode === "string" && Object.hasOwn(labels, e.details.mode),
      )
      .at(-1);
    return latest ? `${labels[String(latest.details.mode)]} · ${latest.event}` : "미관측";
  }
  return (
    <details className="motion-diagnostics" onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>모션 진단</summary>
      {report && (
        <div>
          <p>
            빌드 {report.build} · 기기 동작 줄이기{" "}
            {report.reduced === null ? "확인 불가" : report.reduced ? "켜짐" : "꺼짐"} · 페이지 효과{" "}
            {still ? "꺼짐" : "켜짐"}
          </p>
          {(["invitation", "book"] as const).map((scope) => (
            <p key={scope}>
              {scope === "invitation" ? "편지" : "책장"} · {decision(scope)}
            </p>
          ))}
          <p>최근 기록 · {report.events.at(-1)?.event ?? "없음"}</p>
          <button
            type="button"
            onClick={async () => {
              const json = JSON.stringify(motionReport(still), null, 2);
              try {
                await navigator.clipboard.writeText(json);
                setManual("");
                setNotice("복사했습니다.");
              } catch {
                setManual(json);
                setNotice("아래 내용을 선택해 복사해주세요.");
              }
            }}
          >
            진단 정보 복사
          </button>
          <button
            type="button"
            onClick={() => {
              clearMotion();
              setManual("");
              setNotice("진단 기록을 지웠습니다.");
              refresh((n) => n + 1);
            }}
          >
            진단 기록 지우기
          </button>
          <p role="status">{notice}</p>
          {manual && (
            <textarea
              aria-label="복사할 진단 정보"
              readOnly
              value={manual}
              onFocus={(e) => e.target.select()}
            />
          )}
        </div>
      )}
    </details>
  );
}
