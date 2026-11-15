import { createContext, useContext, useLayoutEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
export const BeforeBookMove = createContext<(to: string) => void>(() => {});
export function useSavedNavigation() {
  const { pathname } = useLocation();
  const navigate = useNavigate(),
    prepare = useContext(BeforeBookMove);
  const live = useRef(false);
  useLayoutEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);
  return (to: string) => {
    if (live.current) {
      prepare(to);
      navigate(to, { state: { bookFrom: pathname } });
    }
  };
}
