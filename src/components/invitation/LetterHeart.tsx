import { useBookView } from "../book/preferences";

export function LetterHeart({ motionAllowed }: { readonly motionAllowed: boolean }) {
  const { still } = useBookView();
  return (
    <svg
      className="letter-heart"
      data-motion={motionAllowed && !still}
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 360 262"
      preserveAspectRatio="none"
    >
      <path
        className="heart-ink"
        pathLength="1"
        d="M59 247 C94 252 133 240 166 223 C233 190 317 137 327 77
           C335 29 304 7 269 14 C231 21 199 55 182 91
           C177 57 153 21 121 15 C77 5 37 30 31 73
           C20 133 81 187 150 217 C180 231 207 239 228 240"
      />
      <g className="heart-glints">
        <path className="heart-glint" d="M80 12 Q81 18 85 19 Q81 20 80 26 Q79 20 75 19 Q79 18 80 12Z" />
        <path
          className="heart-glint"
          d="M310 17 Q311 22 315 23 Q311 24 310 29 Q309 24 305 23 Q309 22 310 17Z"
        />
      </g>
    </svg>
  );
}
