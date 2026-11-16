import { createContext, type ReactNode, useContext, useState } from "react";
import { useLocation } from "react-router-dom";

import { debuggingMotion } from "../../lib/motionDebug";
import { MotionDiagnostics } from "../MotionDiagnostics";

const key = "hyeseong:2026:book-view";
const faces = [
  { id: "pen", label: "나눔손글씨 펜", directory: "nanum-pen" },
  { id: "gamja", label: "감자꽃 (Gamja Flower)", directory: "gamja-flower" },
  { id: "yeon", label: "연성체 (Yeon Sung)", directory: "yeon-sung" },
  { id: "ui", label: "기본 글씨", directory: null },
] as const;
type Face = (typeof faces)[number]["id"];
function faceFor(id: string | undefined) {
  return faces.find((face) => face.id === id) ?? faces[0];
}
function read() {
  try {
    return localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}
const View = createContext({
  face: faces[0].id as Face,
  still: false,
  change: (_face: Face, _still: boolean) => {},
});
export function BookPreferences({ children }: { readonly children: ReactNode }) {
  const [choice, setChoice] = useState(read);
  const { pathname } = useLocation();
  const face = faceFor(choice.split(":")[0]);
  const still = choice.endsWith(":still");
  function change(id: Face, stop: boolean) {
    const value = id + (stop ? ":still" : ":turn");
    setChoice(value);
    try {
      localStorage.setItem(key, value);
    } catch {
      /* Keep the current in-memory choice. */
    }
  }
  return (
    <View.Provider value={{ face: face.id, still, change }}>
      {face.directory && !pathname.startsWith("/admin") && (
        <link
          data-book-font={face.id}
          rel="stylesheet"
          href={`${import.meta.env.BASE_URL}fonts/${face.directory}/font.css`}
        />
      )}
      <div
        className={pathname.startsWith("/admin") ? "operator-view" : "employee-view"}
        data-script={face.id === "ui" ? "system" : face.id}
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
  const { face, still, change } = useBookView();
  return (
    <details className="book-settings">
      <summary>보기 설정</summary>
      <fieldset>
        <legend className="sr-only">공책 보기 설정</legend>
        <label>
          글씨
          <select aria-label="글씨" value={face} onChange={(e) => change(faceFor(e.target.value).id, still)}>
            {faces.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <input type="checkbox" checked={still} onChange={(e) => change(face, e.target.checked)} /> 페이지
          효과 끄기
        </label>
        <p className="book-motion-note">기기의 동작 줄이기 설정에 따라 페이지를 바로 이동합니다.</p>
        {debuggingMotion && <MotionDiagnostics still={still} />}
      </fieldset>
    </details>
  );
}
