import { createContext, type ReactNode, useContext, useState } from "react";
import { useLocation } from "react-router-dom";

const key = "hyeseong:2026:book-view";
function read() {
  try {
    return localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}
const View = createContext({ plain: false, still: false, change: (_plain: boolean, _still: boolean) => {} });
export function BookPreferences({ children }: { readonly children: ReactNode }) {
  const [choice, setChoice] = useState(read);
  const { pathname } = useLocation();
  const plain = choice.startsWith("ui:");
  const still = choice.endsWith(":still");
  function change(usePlain: boolean, stop: boolean) {
    const value = (usePlain ? "ui" : "pen") + (stop ? ":still" : ":turn");
    setChoice(value);
    try {
      localStorage.setItem(key, value);
    } catch {
      /* Keep the current in-memory choice. */
    }
  }
  return (
    <View.Provider value={{ plain, still, change }}>
      {!plain && !pathname.startsWith("/admin") && (
        <link rel="stylesheet" href={`${import.meta.env.BASE_URL}fonts/nanum-pen/font.css`} />
      )}
      <div
        className={pathname.startsWith("/admin") ? "operator-view" : "employee-view"}
        data-script={plain ? "system" : "pen"}
      >
        {children}
      </div>
    </View.Provider>
  );
}
export function useBookView() {
  return useContext(View);
}
export function BookSettings() {
  const { plain, still, change } = useBookView();
  return (
    <details className="book-settings">
      <summary>보기 설정</summary>
      <fieldset>
        <legend className="sr-only">공책 보기 설정</legend>
        <label>
          글씨
          <select
            aria-label="글씨"
            value={plain ? "ui" : "pen"}
            onChange={(e) => change(e.target.value === "ui", still)}
          >
            <option value="pen">손글씨</option>
            <option value="ui">기본 글씨</option>
          </select>
        </label>
        <label>
          <input type="checkbox" checked={still} onChange={(e) => change(plain, e.target.checked)} /> 페이지
          효과 끄기
        </label>
      </fieldset>
    </details>
  );
}
