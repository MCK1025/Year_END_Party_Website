export const storiesPerTree = 30;

// Coordinates follow the silhouette from crown to hem. Staggered branch tips
// leave room for a full touch target even at the narrowest supported width.
const full = [
  [50.1, 17],
  [37.9, 23],
  [61, 25.1],
  [45.4, 30.8],
  [68.4, 33.3],
  [28.5, 37.9],
  [51.2, 39],
  [73.9, 42.4],
  [46.9, 45],
  [23.9, 46],
  [69.9, 48.6],
  [34.7, 51.7],
  [82.4, 55.3],
  [59.9, 55.3],
  [37.4, 57.4],
  [14.9, 60.7],
  [60.4, 61],
  [83.5, 61.7],
  [35.3, 66.4],
  [88, 67.4],
  [64.3, 67.5],
  [12.3, 68.8],
  [39.4, 72.1],
  [81.1, 73.2],
  [15.5, 75.1],
  [58.1, 77.8],
  [88, 79],
  [35, 80.8],
  [65, 83.5],
  [12, 84.4],
] as const;
const small = [
  [47, 20],
  [62, 31],
  [35, 34],
  [53, 45],
  [77, 49],
  [24, 48.5],
  [40, 60],
  [65, 62],
  [18, 70],
  [85, 74],
  [55, 75],
  [32, 83],
] as const;
const designs = [
  "눈꽃 양말",
  "리본 선물",
  "줄무늬 양말",
  "긴 선물 상자",
  "호랑가시나무 양말",
  "둥근 선물 상자",
] as const;
const tilts = [-9, 6, -4, 12, -7, 3, 8, -12, 4];
const sizes = [0.94, 0.82, 1, 0.88, 0.78, 0.97, 0.86];
const cords = [9, 16, 7, 12, 18, 10, 14];

export function ornament(index: number, count: number) {
  const spots =
    count === 3
      ? [
          [49, 22],
          [39, 53],
          [30, 77],
        ]
      : count <= small.length
        ? small
        : full;
  const slot = count === 1 ? 3 : Math.round((index * (spots.length - 1)) / (count - 1));
  const [x, y] = spots[slot] ?? [50, 50];
  const style = index % designs.length;
  return {
    x,
    y,
    tilt: tilts[slot % tilts.length] ?? 0,
    size: sizes[slot % sizes.length] ?? 1,
    cord: cords[slot % cords.length] ?? 10,
    label: designs[style],
    sprite: `${Math.floor(style / 2) * 50}% ${(style % 2) * 100}%`,
    hue: [0, 45, -56, 145, 208][Math.floor(index / 6) % 5] ?? 0,
  };
}
