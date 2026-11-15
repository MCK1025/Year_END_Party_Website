// Coordinates are shared by the paper artwork, the wire and its lamps.
export const artWidth = 400;
export const artHeight = 520;
export const wires = [
  { left: 149, right: 255, start: 181, end: 163, sag: 15, count: 7 },
  { left: 103, right: 302, start: 325, end: 281, sag: 15, count: 11 },
] as const;

export function wirePoint(wire: (typeof wires)[number], u: number) {
  return {
    x: wire.left + (wire.right - wire.left) * u,
    y: wire.start + (wire.end - wire.start) * u + 4 * wire.sag * u * (1 - u),
  };
}

export const lamps = wires.flatMap((wire, row) =>
  Array.from({ length: wire.count }, (_, i) => {
    const index = i + row * wires[0].count;
    return {
      ...wirePoint(wire, (i + 0.35) / (wire.count - 0.3)),
      steady: index % 3 === 1,
      rise: 1 + ((index * 37) % 97) / 100,
      fall: 1 + ((index * 53 + 19) % 99) / 100,
      offset: index * 1.713,
    };
  }),
);

export function lampLevel(lamp: (typeof lamps)[number], time: number) {
  if (lamp.steady) return 0.88;
  const t = (time + lamp.offset) % (lamp.rise + lamp.fall);
  const u = t < lamp.rise ? t / lamp.rise : 1 - (t - lamp.rise) / lamp.fall;
  return 0.2 + 0.8 * u * u * (3 - 2 * u);
}

export function snowSeeds(seed = 2026) {
  let bits = seed >>> 0;
  const random = () => {
    bits = (Math.imul(1664525, bits) + 1013904223) >>> 0;
    return bits / 4294967296;
  };
  return Array.from({ length: 120 }, (_, i) => {
    const kind = i % 24 === 7 ? 3 : i % 10 < 4 ? 0 : i % 10 < 8 ? 1 : 2;
    const bands = [
      [1.5, 1, 0.24, 0.15, 8, 6],
      [3, 2, 0.52, 0.19, 19, 10],
      [5, 3, 0.31, 0.17, 30, 14],
      [8, 4, 0.48, 0.16, 15, 9],
    ] as const;
    const [diameter, range, alpha, variation, speed, spread] = bands[kind];
    return {
      kind,
      x: random(),
      y: random(),
      size: diameter + range * random(),
      opacity: alpha + variation * random(),
      speed: speed + spread * random(),
      drift: 2 + kind * 1.7 + random() * 3,
      phase: random() * Math.PI * 2,
    };
  });
}
