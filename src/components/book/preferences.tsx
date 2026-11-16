import { createContext, type ReactNode, useContext, useState } from "react";
import { useLocation } from "react-router-dom";

import { debuggingMotion } from "../../lib/motionDebug";
import { MotionDiagnostics } from "../MotionDiagnostics";

const key = "hyeseong:2026:book-view";
function readStill() {
  try {
    const saved = localStorage.getItem(key);
    return saved === "still" || saved?.endsWith(":still") === true;
  } catch {
    return false;
  }
}
const View = createContext({
  still: false,
  change: (_still: boolean) => {},
});
export function BookPreferences({ children }: { readonly children: ReactNode }) {
  const [still, setStill] = useState(readStill);
  const { pathname } = useLocation();
  function change(stop: boolean) {
    setStill(stop);
    try {
      localStorage.setItem(key, stop ? "still" : "turn");
    } catch {
      /* Keep the current in-memory choice. */
    }
  }
  return (
    <View.Provider value={{ still, change }}>
      {!pathname.startsWith("/admin") && (
        <link
          data-book-font="gamja"
          rel="stylesheet"
          href={`${import.meta.env.BASE_URL}fonts/gamja-flower/font.css`}
        />
      )}
      <div className={pathname.startsWith("/admin") ? "operator-view" : "employee-view"}>{children}</div>
    </View.Provider>
  );
}
export function useBookView() {
  return useContext(View);
}
export function BookSettings() {
  const { still, change } = useBookView();
  return (
    <details className="book-settings">
      <summary>보기 설정</summary>
      <fieldset>
        <legend className="sr-only">공책 보기 설정</legend>
        <label>
          <input type="checkbox" checked={still} onChange={(e) => change(e.target.checked)} /> 페이지 효과
          끄기
        </label>
        <p className="book-motion-note">기기의 동작 줄이기 설정에 따라 페이지를 바로 이동합니다.</p>
        {debuggingMotion && <MotionDiagnostics still={still} />}
      </fieldset>
    </details>
  );
}
