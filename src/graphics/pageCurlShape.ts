export function curlColumns(progress: number, segments: number) {
  const p = Math.max(0, Math.min(1, progress));
  let x = 0,
    z = 0;
  return Array.from({ length: segments + 1 }, (_, i) => {
    const angle =
      Math.PI *
      Math.max(0, Math.min(1, (p * 0.62 + p * p * 0.38) * 1.75 - (1 - (i - 0.5) / segments) * 0.75));
    if (i) {
      x += Math.cos(angle) / segments;
      z += Math.sin(angle) / segments;
    }
    return { x, z, shade: 1 - 0.13 * Math.sin(angle) ** 2 };
  });
}
