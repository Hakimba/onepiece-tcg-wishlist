import type { Rarity } from '../domain/Rarity';
import { CATEGORY_COLORS, Rarity as R } from '../domain/Rarity';

interface Props {
  rarity: Rarity;
  size?: 'xs' | 'sm' | 'md';
}

const SIZE_MAP = {
  xs: { fontSize: '0.6rem', padding: '0.1rem 0.35rem', gap: '0.2rem', tagFont: '0.5rem' },
  sm: { fontSize: '0.7rem', padding: '0.15rem 0.4rem', gap: '0.25rem', tagFont: '0.58rem' },
  md: { fontSize: '0.85rem', padding: '0.2rem 0.55rem', gap: '0.3rem', tagFont: '0.7rem' },
};

const basePill = (
  label: string,
  color: string,
  s: typeof SIZE_MAP['sm'],
  dark: boolean = false,
) => (
  <span
    className="rarity-base"
    style={{
      background: color,
      color: dark ? '#1a1a2e' : '#fff',
      fontSize: s.fontSize,
      padding: s.padding,
    }}
  >
    {label}
  </span>
);

const renderRarity: (s: typeof SIZE_MAP['sm']) => (r: Rarity) => React.ReactNode = (s) =>
  R.$match({
    Unknown: () => basePill('?', CATEGORY_COLORS['?'], s),
    SP: () => (
      <span className="rarity-tag-sp" style={{ fontSize: s.tagFont, padding: s.padding }}>
        SP
      </span>
    ),
    Promo: () => basePill('P', CATEGORY_COLORS['P'], s),
    Standard: ({ base }) => basePill(
      base === 'L' ? 'Leader' : base,
      CATEGORY_COLORS[base],
      s,
      base === 'SEC',
    ),
    Parallel: ({ base }) => (
      <>
        {basePill(
          base === 'L' ? 'Leader' : base,
          CATEGORY_COLORS[base],
          s,
          base === 'SEC',
        )}
        <span className="rarity-tag-alt" style={{ fontSize: s.tagFont, padding: s.padding }}>
          ALT
        </span>
      </>
    ),
  });

export default function RarityBadge({ rarity, size = 'sm' }: Props) {
  const s = SIZE_MAP[size];
  return (
    <span className="rarity-badge" style={{ gap: s.gap }}>
      {renderRarity(s)(rarity)}
    </span>
  );
}
