import { useId } from "react";
import { lampLevel, lamps, snowSeeds, wirePoint, wires } from "../../graphics/treeModel";

const tiers = [
  [222, 429, 167, -2],
  [184, 354, 140, 3],
  [147, 286, 115, -3],
  [113, 226, 91, 2],
  [83, 170, 66, -1],
  [60, 121, 43, 0],
] as const;
const crests = [-1, -0.73, -0.35, -0.04, 0.34, 0.75, 1];
const hems = [0, 6, -3, 2, 6, -1, 1];
const papers = [
  ["#668354", "#315638"],
  ["#536e41", "#24472f"],
  ["#71905e", "#35573a"],
  ["#466c48", "#264c33"],
  ["#648656", "#395d3c"],
];
const snowCaps = [
  [41, 407, 32, -18],
  [283, 392, 42, 19],
  [82, 335, 24, -21],
  [258, 268, 40, 22],
  [103, 276, 27, -15],
  [225, 115, 22, 24],
  [154, 120, 19, -24],
] as const;
const drift =
  "M9 482 Q20 473 35 474 Q47 465 61 467 Q78 455 92 460 Q108 449 124 454 Q138 445 153 452 Q165 446 179 454 Q195 446 206 452 Q218 442 234 449 Q250 440 265 451 Q278 446 290 453 Q310 449 320 459 Q337 456 349 467 Q372 467 393 482 Q342 505 199 502 Q64 502 9 482Z";
const staticSnow = snowSeeds().slice(0, 96);
export function PaperFir({ staticEffects }: { readonly staticEffects: boolean }) {
  const id = useId().replace(/:/g, "");
  const paint = (key: string) => `url(#${id}-${key})`;
  const star = Array.from({ length: 10 }, (_, i) => {
    const angle = (Math.PI * i) / 5 - Math.PI / 2;
    const r = i % 2 ? 10 : 24;
    return [200 + Math.cos(angle) * r, 48 + Math.sin(angle) * r].join(",");
  });
  return (
    <>
      <svg
        className="paper-fir"
        viewBox="0 0 400 520"
        preserveAspectRatio="none"
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          <filter id={`${id}-fiber`} x="-2%" y="-2%" width="104%" height="104%">
            <feTurbulence type="fractalNoise" baseFrequency=".21" numOctaves="3" seed="26" />
            <feColorMatrix type="saturate" values="0" />
            <feComponentTransfer>
              <feFuncA type="linear" slope=".12" />
            </feComponentTransfer>
            <feComposite in2="SourceGraphic" operator="in" />
            <feBlend in2="SourceGraphic" mode="soft-light" />
          </filter>
          <radialGradient id={`${id}-fade`} cx=".5" cy=".15" r=".58">
            <stop offset=".4" stopColor="white" />
            <stop offset="1" stopColor="black" />
          </radialGradient>
          <mask id={`${id}-drift-edge`}>
            <rect x="6" y="441" width="388" height="64" fill={paint("fade")} />
          </mask>
          {papers.map(([light, dark], i) => (
            <linearGradient
              id={`${id}-leaf${i}`}
              key={light}
              x2=".72"
              y2="1"
              gradientUnits="objectBoundingBox"
            >
              <stop stopColor={light} />
              <stop offset=".62" stopColor={dark} />
              <stop offset="1" stopColor={light} />
            </linearGradient>
          ))}
          <linearGradient id={`${id}-bark`}>
            <stop stopColor="#57412d" />
            <stop offset=".38" stopColor="#926b44" />
            <stop offset=".67" stopColor="#795836" />
            <stop offset="1" stopColor="#4d3c2c" />
          </linearGradient>
          <linearGradient id={`${id}-bank`} x2=".03" y2="1">
            <stop stopColor="#f7ead0" />
            <stop offset=".30" stopColor="#e6e4d1" />
            <stop offset=".63" stopColor="#a8b7a6" />
            <stop offset="1" stopColor="#516d61" stopOpacity=".09" />
          </linearGradient>
          <linearGradient id={`${id}-snow`} x2=".18" y2="1">
            <stop stopColor="#fff6df" />
            <stop offset=".62" stopColor="#dedfcd" />
            <stop offset="1" stopColor="#91a89a" />
          </linearGradient>
          <radialGradient id={`${id}-light`}>
            <stop stopColor="#fff5c2" stopOpacity=".8" />
            <stop offset=".25" stopColor="#f4cb6b" stopOpacity=".37" />
            <stop offset="1" stopColor="#ddb55e" stopOpacity="0" />
          </radialGradient>
        </defs>
        <path d="M187 406 Q188 439 182 458 Q201 464 217 458 L211 406Z" fill={paint("bark")} />
        <g filter={paint("fiber")}>
          {tiers.map(([top, hem, r, skew], tier) => {
            const apex = 200 + skew;
            return (
              <g key={hem}>
                <path
                  d={`M${apex} ${top + 5} Q${apex - r * 0.43} ${(hem + top) / 2 + 13} ${200 - r} ${hem - 2} Q${200 - r * 0.7} ${hem + 4} ${200 - r * 0.46} ${hem + 7} Q${200 - r * 0.18} ${hem + 1} 200 ${hem + 6} Q${200 + r * 0.18} ${hem + 2} ${200 + r * 0.4} ${hem + 9} L${200 + r * 0.75} ${hem + 3} L${200 + r} ${hem - 1}Z`}
                  fill="#133626"
                  opacity=".65"
                />
                {crests.slice(0, -1).map((left, i) => {
                  const right = crests[i + 1] ?? 1,
                    mid = (left + right) / 2;
                  const xl = 200 + left * r,
                    xr = 200 + right * r,
                    tip = 200 + mid * r;
                  const yl = hem - 6 * Math.abs(left) + (hems[i] ?? 0),
                    yr = hem - 6 * Math.abs(right) + (hems[i + 1] ?? 0);
                  const end = hem + 3 + 3 * Math.cos(tier * 2 + i * 1.7);
                  const shoulder = (tip + apex) / 2 + mid * 4;
                  const fold = `M${apex} ${top} Q${(apex + xl) / 2 - left * 7} ${(top + yl) / 2 + 13} ${xl - 1} ${yl} L${tip - 4} ${end - 5} Q${xr - 9} ${yr - 1} ${xr + 2} ${yr + 3} Q${(apex + xr) / 2 - right * 7} ${(top + yr) / 2 + 13} ${apex} ${top}Z`;
                  return (
                    <g key={left}>
                      <path d={fold} fill={paint(`leaf${(i + 2 * tier) % papers.length}`)} />
                      <path
                        d={`M${apex} ${top} Q${shoulder} ${(top + end) / 2 + 7} ${tip} ${end} Q${(tip + xr) / 2} ${yr - 2} ${xr} ${yr} Q${(apex + xr) / 2 - right * 7} ${(top + yr) / 2 + 13} ${apex} ${top}Z`}
                        fill="#0d3029"
                        opacity={0.04 + (i % 3) * 0.035}
                      />
                    </g>
                  );
                })}
              </g>
            );
          })}
          {snowCaps.map(([x, y, width, angle]) => (
            <g key={x} transform={`translate(${x} ${y}) rotate(${angle}) scale(${width / 40})`}>
              <path
                d="M0 3Q2 -3 7 -3Q10 -10 17 -7Q23 -15 30 -8Q35 -9 41 1Q32 5 21 3Q8 7 0 3Z"
                fill={paint("snow")}
              />
            </g>
          ))}
        </g>
        {wires.map((wire) => {
          const middle = wirePoint(wire, 0.5);
          return (
            <path
              key={wire.left}
              d={`M${wire.left} ${wire.start} Q${middle.x} ${(wire.start + wire.end) / 2 + wire.sag * 2} ${wire.right} ${wire.end}`}
              fill="none"
              stroke="#dfc780"
              strokeWidth="1"
              opacity=".76"
            />
          );
        })}
        <g mask={paint("drift-edge")} filter={paint("fiber")}>
          <path d={drift} fill={paint("bank")} />
          <path
            d="M30 477Q51 465 68 468Q83 457 99 462Q114 454 130 459Q111 457 94 467Q63 468 30 477ZM258 456Q277 451 286 457Q313 453 340 470Q317 464 301 463Q282 457 258 456Z"
            fill="#f4f1e7"
            opacity=".44"
          />
        </g>
        {staticEffects && (
          <>
            {lamps.map((l) => (
              <g key={l.x} opacity={0.4 + 0.6 * lampLevel(l, 0)}>
                <circle cx={l.x} cy={l.y} r="12" fill={paint("light")} />
                <circle cx={l.x} cy={l.y} r="2.4" fill="#fff1b2" />
              </g>
            ))}
            {staticSnow.map((f) =>
              f.kind === 3 ? (
                <path
                  key={f.phase}
                  transform={`translate(${f.x * 400} ${f.y * 469}) scale(.72)`}
                  d="M-6 0H6M-3 -5L3 5M3 -5L-3 5M-4 -2L-3 0L-4 2M4 -2L3 0L4 2"
                  fill="none"
                  stroke="#f5f0de"
                  opacity={f.opacity}
                />
              ) : (
                <circle
                  key={f.phase}
                  cx={f.x * 400}
                  cy={f.y * 469}
                  r={f.size * 0.46}
                  fill="#f6f1dd"
                  opacity={f.opacity}
                />
              ),
            )}
          </>
        )}
      </svg>
      <svg className="paper-star" viewBox="155 3 90 90" aria-hidden="true" focusable="false">
        <circle cx="200" cy="48" r="37" fill={paint("light")} opacity=".65" />
        {star.map((point, i) => (
          <path
            key={point}
            d={`M200 48 L${point} L${star[(i + 1) % 10]}Z`}
            fill={
              [
                "#ffedab",
                "#f9d77a",
                "#d9a94f",
                "#f7cf6d",
                "#e9bf60",
                "#ffe494",
                "#e4bc65",
                "#fff2bf",
                "#f5d581",
                "#fff6d1",
              ][i]
            }
          />
        ))}
      </svg>
    </>
  );
}
