import { EventView } from "../components/EventView";
import { PrivateImage } from "../components/PrivateImage";
import { RecapCards } from "../components/RecapCards";
import { Mark, Note, Panel } from "../components/ui";

import { useGuest } from "./Participant";

export function Event() {
  const { data } = useGuest();
  const state = data.state;
  const waiting = state.phase === "WAITING" || state.phase === "PRE_SURVEY";
  return (
    <div className="stack">
      {state.paused && <Note>잠시 쉬어갑니다. 진행이 재개되면 화면이 자동으로 바뀝니다.</Note>}
      {waiting ? (
        <>
          <section className="event-cover">
            {data.settings.logo_path ? (
              <PrivateImage path={data.settings.logo_path} alt="회사 로고" logo />
            ) : (
              <Mark />
            )}
            <p className="overline">Your seat is here</p>
            <h1>
              한 걸음 더 가까워진,
              <br />
              그리고 가까워질 우리.
            </h1>
            <p className="event-year">2026</p>
            <p className="muted" style={{ whiteSpace: "pre-line" }}>
              {data.settings.welcome}
            </p>
          </section>
          <Panel>
            <p>{data.survey ? "당신의 이야기가 잘 도착했습니다." : "아직 들려주지 않은 이야기가 있어요."}</p>
            <p className="small">
              설문 {data.survey ? "저장 완료" : "미작성"} · 동료 추천{" "}
              {data.nomination ? "저장 완료" : "미작성"}
            </p>
            <p className="small">
              {data.settings.event_start_at
                ? `${new Date(data.settings.event_start_at).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "long", timeStyle: "short" })} 이후, 운영자의 안내에 따라 시작합니다.`
                : "행사 일정은 운영자가 안내할 예정입니다."}
            </p>
          </Panel>
        </>
      ) : state.phase === "RECAP" ? (
        <>
          <header className="page-heading">
            <p className="overline">A year, in moments</p>
            <h1>
              함께여서 남은
              <br />
              우리의 장면들.
            </h1>
            <p className="muted">천천히 넘기며, 그날의 이야기를 나눠보세요.</p>
          </header>
          <RecapCards key={state.revision} />
        </>
      ) : (
        <EventView state={state} />
      )}
      {!waiting && data.settings.logo_path && (
        <PrivateImage path={data.settings.logo_path} alt="회사 로고" logo />
      )}
    </div>
  );
}
