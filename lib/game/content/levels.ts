// XP curve. Level n needs `xpForLevel(n)` total XP. Quadratic so early
// levels come quickly and later ones take real questing.

export const MAX_LEVEL = 50

export const xpForLevel = (level: number) => (level <= 1 ? 0 : 100 * (level - 1) * (level - 1))

export const levelForXp = (xp: number) => {
  let level = 1
  while (level < MAX_LEVEL && xp >= xpForLevel(level + 1)) level += 1
  return level
}

// Progress within the current level, for a progress bar.
export const levelProgress = (xp: number) => {
  const level = levelForXp(xp)
  const floor = xpForLevel(level)
  const ceiling = level >= MAX_LEVEL ? floor : xpForLevel(level + 1)
  const span = Math.max(1, ceiling - floor)
  return { level, xp, floor, ceiling, fraction: level >= MAX_LEVEL ? 1 : (xp - floor) / span }
}
