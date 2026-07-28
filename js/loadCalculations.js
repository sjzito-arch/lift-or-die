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
    return `Bar only — target (${targetWeight} ${units}) is below the bar (${barWeight} ${units})`;
  }
  return `${perSide} ${units} per side`;
}

// Small "bar + side × 2 = total" breakdown line, shown alongside the (now
// dominant) per-side number — per-side is the actionable figure at the rack,
// this is supporting context. The "bar only" edge case stays a plain
// sentence rather than being forced into the equation shape.
export function formatLoadBreakdownText(targetWeight, barWeight, units) {
  const { perSide, isBelowBar } = computePerSideWeight(targetWeight, barWeight);
  if (isBelowBar) {
    return `Bar only — target (${targetWeight} ${units}) is below the bar (${barWeight} ${units})`;
  }
  return `${barWeight} (bar) + ${perSide} (side) × 2 = ${targetWeight} ${units} total`;
}

// Shared markup for the weight display block on the ready/rest screens:
// per-side is the actionable figure at the rack, so it's the dominant
// number; the bar+side=total breakdown is small, supporting context. When
// target is below the bar, there's no meaningful per-side number to lead
// with, so just the plain sentence shows (in the small line's slot).
export function weightDisplayMarkup(targetWeight, barWeight, units) {
  const { isBelowBar } = computePerSideWeight(targetWeight, barWeight);
  const breakdown = formatLoadBreakdownText(targetWeight, barWeight, units);
  if (isBelowBar) {
    return `<p class="load-breakdown">${breakdown}</p>`;
  }
  return `
    <p class="per-side-text">${formatPerSideText(targetWeight, barWeight, units)}</p>
    <p class="load-breakdown">${breakdown}</p>
  `;
}

// Per-side difference between the current and next exercise, framed as
// add/remove/no change per spec §9.
export function computeLoadDifferenceText(currentTargetWeight, currentBarWeight, nextTargetWeight, nextBarWeight, units) {
  const current = computePerSideWeight(currentTargetWeight, currentBarWeight).perSide;
  const next = computePerSideWeight(nextTargetWeight, nextBarWeight).perSide;
  const delta = next - current;
  if (delta === 0) return 'No change per side';
  const amount = Math.abs(delta);
  return delta > 0 ? `Add ${amount} ${units} per side` : `Remove ${amount} ${units} per side`;
}
