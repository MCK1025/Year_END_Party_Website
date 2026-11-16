import { useLayoutEffect, useRef, useState } from "react";
import { useBookView } from "../book/preferences";

const outline =
  "M180 436 C165 428 23 350 14 212 C8 139 6 44 57 20 C109 -4 157 46 178 99 Q180 105 182 99 C203 46 247 -5 293 16 C347 40 353 112 347 192 C339 314 286 376 180 436 Z";

export function LetterHeart({
  reading,
  motionAllowed,
}: {
  readonly reading: boolean;
  readonly motionAllowed: boolean;
}) {
  const { still } = useBookView();
  const foil = useRef<SVGPathElement>(null);
  const opened = useRef(false);
  const [complete, setComplete] = useState(false);
  useLayoutEffect(() => {
    if (!reading) return;
    const path = foil.current;
    const firstReading = !opened.current;
    opened.current = true;
    if (!firstReading || still || !motionAllowed || !path || typeof path.animate !== "function") {
      setComplete(true);
      return;
    }
    // Draw in the outline's own coordinates. Once finished the SVG paints its normal solid stroke.
    let drawing: Animation;
    try {
      const length = path.getTotalLength() + 1;
      const dash = `${length} ${length}`;
      drawing = path.animate(
        [
          { strokeDasharray: dash, strokeDashoffset: length },
          { strokeDasharray: dash, strokeDashoffset: 0 },
        ],
        { duration: 1800, easing: "ease-in-out" },
      );
    } catch {
      setComplete(true);
      return;
    }
    drawing.onfinish = () => setComplete(true);
    return () => {
      drawing.onfinish = null;
      drawing.cancel();
    };
  }, [reading, motionAllowed, still]);
  return (
    <svg
      className="letter-heart"
      data-lamplight={complete && reading && motionAllowed && !still}
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 360 460"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="letter-gold" x1="0" y1="0" x2="1" y2=".8">
          <stop stopColor="#d8ab18" />
          <stop offset=".32" stopColor="#f1c928" />
          <stop offset=".64" stopColor="#d4a71a" />
          <stop offset="1" stopColor="#e9c128" />
        </linearGradient>
      </defs>
      <path className="heart-halo" vectorEffect="non-scaling-stroke" d={outline} />
      <path className="heart-foil" stroke="url(#letter-gold)" ref={foil} d={outline} />
    </svg>
  );
}
