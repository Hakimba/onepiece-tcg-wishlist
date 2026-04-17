import { Option } from 'effect';
import type { Rarity as RarityType } from '../domain/Rarity';
import {
  STANDARD_BASES,
  CATEGORY_COLORS,
  Standard,
  Parallel,
  SP,
  Unknown,
  Rarity,
  getBase,
  isParallel as rarityIsParallel,
} from '../domain/Rarity';

interface Props {
  rarity: RarityType;
  onChange: (r: RarityType) => void;
  isPromo: boolean;
}

export default function RarityPicker({ rarity, onChange, isPromo }: Props) {
  const currentBase = Option.getOrNull(getBase(rarity));

  if (isPromo) {
    return (
      <div className="rarity-picker">
        <button type="button" className="rarity-pill selected" style={{ '--pill-color': CATEGORY_COLORS['P'] } as React.CSSProperties}>
          Promo
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="rarity-picker">
        <button
          type="button"
          className={`rarity-pill${Rarity.$is("Unknown")(rarity) ? ' selected' : ''}`}
          style={{ '--pill-color': CATEGORY_COLORS['?'] } as React.CSSProperties}
          onClick={() => onChange(Unknown())}
        >
          ?
        </button>
        {STANDARD_BASES.map((b) => (
          <button
            key={b}
            type="button"
            className={`rarity-pill${currentBase === b && !Rarity.$is("SP")(rarity) ? ' selected' : ''}`}
            style={{ '--pill-color': CATEGORY_COLORS[b] } as React.CSSProperties}
            onClick={() => onChange(Standard({ base: b }))}
          >
            {b === 'L' ? 'Leader' : b}
          </button>
        ))}
        <button
          type="button"
          className={`rarity-pill${Rarity.$is("SP")(rarity) ? ' selected' : ''}`}
          style={{ '--pill-color': CATEGORY_COLORS['SP'] } as React.CSSProperties}
          onClick={() => onChange(SP())}
        >
          SP
        </button>
      </div>
      {currentBase !== null && !Rarity.$is("SP")(rarity) && (
        <div className="rarity-toggles">
          <label className="rarity-toggle">
            <input
              type="checkbox"
              checked={rarityIsParallel(rarity)}
              onChange={(e) => onChange(
                e.target.checked && currentBase
                  ? Parallel({ base: currentBase })
                  : currentBase ? Standard({ base: currentBase }) : Unknown(),
              )}
            />
            <span className="toggle-label toggle-alt">Parallel / Alt</span>
          </label>
        </div>
      )}
    </>
  );
}
