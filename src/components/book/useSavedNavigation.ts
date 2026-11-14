import { useLayoutEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
export function useSavedNavigation() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const live = useRef(false);
  useLayoutEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);
  return (to: string) => {
    if (live.current) navigate(to, { state: { bookFrom: pathname } });
  };
}
