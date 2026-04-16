import type { Rarity } from '../domain/Rarity';
import { rarityColor, getBase, isParallel, isSP, isUnknown } from '../domain/Rarity';

interface Props {
  rarity: Rarity;
  size?: 'xs' | 'sm' | 'md';
}

const SIZE_MAP = {
  xs: { fontSize: '0.6rem', padding: '0.1rem 0.35rem', gap: '0.2rem', tagFont: '0.5rem' },
  sm: { fontSize: '0.7rem', padding: '0.15rem 0.4rem', gap: '0.25rem', tagFont: '0.58rem' },
  md: { fontSize: '0.85rem', padding: '0.2rem 0.55rem', gap: '0.3rem', tagFont: '0.7rem' },
};

export default function RarityBadge({ rarity, size = 'sm' }: Props) {
  const color = rarityColor(rarity);
  const s = SIZE_MAP[size];
  const base = getBase(rarity);
  const isDark = base === 'SEC';

  if (isUnknown(rarity)) {
    return (
      <span className="rarity-badge" style={{ gap: s.gap }}>
        <span
          className="rarity-base"
          style={{
            background: color,
            color: '#fff',
            fontSize: s.fontSize,
            padding: s.padding,
          }}
        >
          ?
        </span>
      </span>
    );
  }

  if (isSP(rarity)) {
    return (
      <span className="rarity-badge" style={{ gap: s.gap }}>
        <span
          className="rarity-tag-sp"
          style={{ fontSize: s.tagFont, padding: s.padding }}
        >
          SP
        </span>
      </span>
    );
  }

  return (
    <span className="rarity-badge" style={{ gap: s.gap }}>
      <span
        className="rarity-base"
        style={{
          background: color,
          color: isDark ? '#1a1a2e' : '#fff',
          fontSize: s.fontSize,
          padding: s.padding,
        }}
      >
        {base === 'L' ? 'Leader' : base}
      </span>
      {isParallel(rarity) && (
        <span
          className="rarity-tag-alt"
          style={{ fontSize: s.tagFont, padding: s.padding }}
        >
          ALT
        </span>
      )}
    </span>
  );
}
