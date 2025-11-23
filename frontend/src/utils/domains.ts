export function minmax(nums: number[]) {
  const arr = nums.filter((n) => Number.isFinite(n)) as number[];
  if (arr.length === 0) return [0, 0] as const;
  return [Math.min(...arr), Math.max(...arr)] as const;
}

export function paddedDomain(min: number, max: number) {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1] as const;
  if (min === max) {
    const pad = Math.max(0.01, Math.abs(min) * 0.001);
    return [min - pad, max + pad] as const;
  }
  const pad = (max - min) * 0.05;
  return [min - pad, max + pad] as const;
}
