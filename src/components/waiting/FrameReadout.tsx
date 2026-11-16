import { type RefObject, useEffect, useState } from "react";

export function FrameReadout({ plate }: { plate: RefObject<HTMLDivElement | null> }) {
  const [size, setSize] = useState("");
  useEffect(() => {
    const el = plate.current;
    if (!el) return;
    const measure = () =>
      setSize(`브라우저 ${innerWidth} × ${innerHeight} · 장면 ${el.clientWidth} × ${el.clientHeight}px`);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [plate]);
  return <p>{size}</p>;
}
