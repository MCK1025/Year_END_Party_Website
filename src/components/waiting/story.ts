type Point = readonly [number, number];
type Surface = { center: Point; radii: Point; kind: "ripple" | "calendar" | "reflection" };
export type StoryScene = {
  title: string;
  caption: string;
  alt: string;
  size: Point;
  duration: number;
  anchors: Record<string, Point>;
  focus: Point;
  scale: readonly [number, number];
  surface?: Surface;
};

// Pixel measurements on the original artwork, before resizing the delivery assets.
export const scenes: readonly [StoryScene, ...StoryScene[]] = [
  {
    title: "연구소",
    caption: "한 방울의 차이까지, 소스와 식품의 가능성을 연구합니다.",
    alt: "연구원이 비커 속 소스 샘플을 살피고 동료가 실험 결과를 기록한다.",
    size: [536, 448],
    duration: 3700,
    focus: [274, 313],
    scale: [0.976, 1],
    anchors: { "스포이드 끝": [276, 313], "비커 입구": [274, 300], 액면: [274, 324] },
    surface: { center: [274, 324], radii: [13, 2.1], kind: "ripple" },
  },
  {
    title: "사무실",
    caption: "일정을 계획하고 세무를 계산하며, 모든 과정이 이어지도록 준비합니다.",
    alt: "달력이 걸린 사무실에서 세 동료가 일정표와 계산기, 업무 문서를 검토한다.",
    size: [536, 448],
    duration: 3700,
    focus: [270, 107],
    scale: [0.987, 1],
    anchors: { "달력 일정 칸": [268, 107], "책상 위 차트": [378, 402] },
    surface: { center: [268, 107], radii: [8, 8], kind: "calendar" },
  },
  {
    title: "생산실",
    caption: "하나의 맛으로 만들어지는 과정",
    alt: "두 작업자가 배합통에 재료를 붓고 중앙 배합축을 중심으로 소스가 섞인다.",
    size: [536, 448],
    duration: 4200,
    focus: [293, 310],
    scale: [0.972, 1],
    anchors: {
      "왼쪽 용기": [199, 228],
      "왼쪽 투입": [249, 313],
      "오른쪽 용기": [359, 247],
      "오른쪽 투입": [328, 305],
      배합축: [293, 310],
    },
    surface: { center: [333, 324], radii: [24, 4], kind: "reflection" },
  },
  {
    title: "생산실",
    caption: "맛을 안전하게 전달하기 위해 정성을 다해 담아 포장합니다.",
    alt: "충진 설비 아래 캡스파우트가 놓여 있고 작업자가 완성된 제품을 상자에 담는다.",
    size: [1448, 1086],
    duration: 4200,
    focus: [953, 735],
    scale: [0.975, 1],
    anchors: {
      "노즐 1": [490, 219],
      "노즐 2": [696, 219],
      "노즐 3": [876, 219],
      "입구 1": [490, 289],
      "입구 2": [696, 288],
      "입구 3": [876, 285],
      컨베이어: [728, 551],
      "포장 상자": [954, 735],
    },
  },
  {
    title: "물류팀",
    caption: "완성된 제품을 안전하게 보관하고, 지게차로 세상에 전달할 준비를 합니다.",
    alt: "창고에서 지게차가 박스가 쌓인 파레트를 받치고 동료가 적재 상태를 확인한다.",
    size: [1374, 1145],
    duration: 4200,
    focus: [754, 657],
    scale: [0.973, 1],
    anchors: { 포크: [588, 875], "파레트 하단": [853, 870], "적재 중심": [754, 657] },
  },
  {
    title: "우리가 만드는 맛있는 세상",
    caption: "우리가 만드는 맛있는 세상으로!",
    alt: "돈가스와 샐러드, 찌개에 소스가 어우러지고 그 아래로 공장과 해돋이가 보인다.",
    size: [1374, 1145],
    duration: 6000,
    focus: [684, 720],
    scale: [1, 0.967],
    anchors: { "음식 중심": [660, 331], 해돋이: [684, 720], 건물: [780, 979] },
  },
];
export function unitPoint([x, y]: Point, [w, h]: Point): Point {
  return [x / w, y / h];
}
export const storyAsset = (file: string) => `${import.meta.env.BASE_URL}waiting-story/${file}`;
export const imageUrl = (index: number) => storyAsset(`scene-${index + 1}.webp`);
