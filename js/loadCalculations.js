// Per-side loading math (spec §7): weight per side = max(0, (target - bar) / 2).
// If target is below bar weight, show zero per side with a clear message
// instead of a negative load.
export function computePerSideWeight(targetWeight, barWeight) {
  const isBelowBar = targetWeight < barWeight;
  const perSide = isBelowBar ? 0 : Math.max(0, (targetWeight - barWeight) / 2);
  return { perSide, isBelowBar };
}

export function formatPerSideText(targetWeight, barWeight, units) {
  const { perSide, isBelowBar } = computePerSideWeight(targetWeight, barWeight);
  if (isBelowBar) {
    return `Bar only — target (${targetWeight} ${units}) is below the bar (${barWeight} ${units}).`;
  }
  return `${perSide} ${units} per side`;
}

// Per-side difference between the current and next exercise, framed as
// add/remove/no change per spec §9.
export function computeLoadDifferenceText(currentTargetWeight, currentBarWeight, nextTargetWeight, nextBarWeight, units) {
  const current = computePerSideWeight(currentTargetWeight, currentBarWeight).perSide;
  const next = computePerSideWeight(nextTargetWeight, nextBarWeight).perSide;
  const delta = next - current;
  if (delta === 0) return 'No change per side.';
  const sign = delta > 0 ? '+' : '-';
  return `${sign}${Math.abs(delta)} ${units} per side.`;
}
