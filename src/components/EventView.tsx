import type { EventState } from "../../supabase/functions/_shared/contracts";
import { Mark, Panel } from "./ui";

export const phaseNames = {
  PRE_SURVEY: "사전 설문",
  WAITING: "대기실",
  RECAP: "1년의 장면들",
  WHO_AM_I: "이 사람, 누구일까요?",
  TASTES: "우리의 취향",
  AWARDS: "고마운 동료",
  END: "다음 한 걸음",
} as const;
export function EventView({ state }: { readonly state: EventState }) {
  const p = state.payload;
  const maxCount = Math.max(...(p.results ?? []).map((v) => v.count), 1);
  switch (state.phase) {
    case "WHO_AM_I":
      return (
        <div className="stack">
          <header className="page-heading">
            <p className="overline">
              Who is behind the story? {p.round_index ? `· ${String(p.round_index).padStart(2, "0")}` : ""}
            </p>
            <h1>
              아는 사람.
              <br />
              몰랐던 이야기.
            </h1>
            <p className="muted">
              옆 동료와 이야기하며 맞혀보세요.
              <br />
              정답은 잠시 뒤 함께 확인합니다.
            </p>
          </header>
          {!p.round_id && (
            <Panel>
              <p className="empty">다음 이야기의 주인공을 기다리고 있습니다.</p>
            </Panel>
          )}
          {p.round_id && !p.hints?.length && (
            <Panel>
              <p className="empty">첫 번째 힌트가 곧 도착합니다.</p>
            </Panel>
          )}
          {p.hints?.map((hint, i) => (
            <article className="hint" key={hint}>
              <span className="overline">CLUE {String(i + 1).padStart(2, "0")}</span>
              <p>{hint}</p>
            </article>
          ))}
          {p.person && (
            <Panel dark>
              <p className="overline">이 이야기의 주인공은</p>
              <h2>{p.person.name}</h2>
              <p>{p.person.department}</p>
              <p className="small">
                조금 다르게 보이기 시작했다면,
                <br />
                우리 오늘 한 걸음 가까워진 거겠죠.
              </p>
            </Panel>
          )}
        </div>
      );
    case "TASTES":
      return (
        <div className="stack">
          <header className="page-heading">
            <p className="overline">The things we have in common</p>
            <h1>
              생각보다,
              <br />
              우린 닮았을지도.
            </h1>
            <p className="muted">우리 회사에서 가장 많이 나온 답은 무엇일까요?</p>
          </header>
          <Panel title={p.question ?? "다음 취향을 기다리는 중"}>
            {p.results ? (
              <div className="chart">
                {p.results.length === 0 && <p className="empty">공개할 응답이 없습니다.</p>}
                {p.results.map((r) => (
                  <div className="bar-row" key={r.label}>
                    <div className="bar-label">
                      <span>{r.label}</span>
                      <strong>{r.count}명</strong>
                    </div>
                    <div className="bar-track" aria-hidden="true">
                      <div className="bar-fill" style={{ width: `${(r.count / maxCount) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted">
                잠깐, 옆 동료와 예상해보세요.
                <br />
                관리자가 결과를 공개하면 여기에 나타납니다.
              </p>
            )}
          </Panel>
        </div>
      );
    case "AWARDS":
      return (
        <div className="stack">
          <header className="page-heading">
            <p className="overline">With our gratitude</p>
            <h1>
              당신이 있어,
              <br />참 다행이었습니다.
            </h1>
            <p className="muted">동료들의 마음이 가장 많이 모인 분을 소개합니다.</p>
          </header>
          {!p.winners?.length && (
            <Panel>
              <p className="empty">이번에는 집계된 추천이 없습니다.</p>
            </Panel>
          )}
          {p.winners?.map((w) => (
            <Panel key={w.id} dark>
              <p className="overline">{(p.winners?.length ?? 0) > 1 ? "공동 1위" : "올해의 추천 동료"}</p>
              <h2>{w.name}</h2>
              <p>
                {w.department} · {w.votes}표
              </p>
              {w.reasons.map((reason) => (
                <blockquote key={reason}>“{reason}”</blockquote>
              ))}
            </Panel>
          ))}
        </div>
      );
    case "END":
      return (
        <section className="event-cover">
          <Mark />
          <p className="overline">To our next chapter</p>
          <h1>
            <span className="keep-phrase">다음 한 걸음도,</span>
            <br />
            함께.
          </h1>
          <p style={{ whiteSpace: "pre-line" }}>{p.message}</p>
          <p className="event-year">2026</p>
        </section>
      );
    case "PRE_SURVEY":
    case "WAITING":
      return <p className="empty">우리의 시간이 곧 시작됩니다.</p>;
    case "RECAP":
      return <p className="empty">함께한 1년의 장면들을 돌아봅니다.</p>;
    default:
      return state.phase satisfies never;
  }
}
