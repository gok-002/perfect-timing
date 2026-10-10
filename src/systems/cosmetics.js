/**
 * Cosmetic themes. A theme only changes colours, never gameplay.
 * Unlocks are driven by lifetime stars from missions; `productId` is reserved
 * for a future paid theme pack (see monetization.js) and is unused today.
 */
export const THEMES = Object.freeze([
  {
    id: 'neon',
    name: 'Neon Night',
    requiredStars: 0,
    colors: {
      bgTop: '#070914', bgBottom: '#141634', grid: 'rgba(160,170,255,0.05)',
      block: '#6ff3ff', blockEdge: '#e9fdff', glow: 'rgba(111,243,255,0.55)',
      target: '#ff4fd8', targetFill: 'rgba(255,79,216,0.10)',
      towerA: '#262a5c', towerB: '#323773', towerEdge: 'rgba(160,170,255,0.25)',
      perfect: '#ffe66d', great: '#6ff3ff', good: '#a5b4fc', miss: '#ff5370',
      particles: ['#6ff3ff', '#ff4fd8', '#ffe66d', '#ffffff'],
      accent: '#6ff3ff', accent2: '#ff4fd8',
    },
  },
  {
    id: 'ember',
    name: 'Ember',
    requiredStars: 3,
    colors: {
      bgTop: '#120806', bgBottom: '#2a0f0a', grid: 'rgba(255,170,120,0.05)',
      block: '#ffb347', blockEdge: '#fff1dc', glow: 'rgba(255,179,71,0.55)',
      target: '#ff5e5b', targetFill: 'rgba(255,94,91,0.10)',
      towerA: '#3b1a14', towerB: '#4d231a', towerEdge: 'rgba(255,170,120,0.22)',
      perfect: '#fff275', great: '#ffb347', good: '#f7a072', miss: '#ff3b3b',
      particles: ['#ffb347', '#ff5e5b', '#fff275', '#ffffff'],
      accent: '#ffb347', accent2: '#ff5e5b',
    },
  },
  {
    id: 'mint',
    name: 'Mint Dusk',
    requiredStars: 8,
    colors: {
      bgTop: '#04110f', bgBottom: '#0b2723', grid: 'rgba(140,255,220,0.05)',
      block: '#7dffc4', blockEdge: '#eafff6', glow: 'rgba(125,255,196,0.5)',
      target: '#b79cff', targetFill: 'rgba(183,156,255,0.10)',
      towerA: '#123a33', towerB: '#174840', towerEdge: 'rgba(140,255,220,0.22)',
      perfect: '#fff59d', great: '#7dffc4', good: '#9ad1c6', miss: '#ff6b81',
      particles: ['#7dffc4', '#b79cff', '#fff59d', '#ffffff'],
      accent: '#7dffc4', accent2: '#b79cff',
    },
  },
  {
    id: 'mono',
    name: 'Monochrome',
    requiredStars: 15,
    colors: {
      bgTop: '#0a0a0a', bgBottom: '#1b1b1b', grid: 'rgba(255,255,255,0.05)',
      block: '#f5f5f5', blockEdge: '#ffffff', glow: 'rgba(255,255,255,0.45)',
      target: '#9a9a9a', targetFill: 'rgba(255,255,255,0.06)',
      towerA: '#2a2a2a', towerB: '#353535', towerEdge: 'rgba(255,255,255,0.18)',
      perfect: '#ffffff', great: '#dddddd', good: '#a0a0a0', miss: '#ff4d4d',
      particles: ['#ffffff', '#bdbdbd', '#8a8a8a'],
      accent: '#f5f5f5', accent2: '#9a9a9a',
    },
  },
].map(Object.freeze));

export const DEFAULT_THEME_ID = 'neon';

export function getTheme(id) {
  return THEMES.find((t) => t.id === id) || THEMES[0];
}

export function isThemeUnlocked(theme, lifetimeStars, ownedProducts = []) {
  if (!theme) return false;
  if (theme.productId && ownedProducts.includes(theme.productId)) return true;
  return (Number.isFinite(lifetimeStars) ? lifetimeStars : 0) >= theme.requiredStars;
}
