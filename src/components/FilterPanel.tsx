import { Option } from 'effect';
import type { FilterState } from '../domain/Filter';
import { defaultFilters } from '../domain/Filter';
import type { StandardBase } from '../domain/Rarity';
import { STANDARD_BASES, RARITY_COLORS } from '../domain/Rarity';

interface Props {
  filters: FilterState;
  onChange: (f: FilterState) => void;
  allSeries: ReadonlyArray<string>;
}

const BASE_LABELS: Record<StandardBase | 'SP', string> = {
  C: 'C', UC: 'UC', R: 'R', SR: 'SR', SEC: 'SEC', L: 'Leader', SP: 'SP',
};

const ALL_BASES: ReadonlyArray<StandardBase | 'SP'> = [...STANDARD_BASES, 'SP'];

export default function FilterPanel({ filters, onChange, allSeries }: Props) {
  const toggleSerie = (s: string) => {
    const series = filters.series.includes(s)
      ? filters.series.filter((x) => x !== s)
      : [...filters.series, s];
    onChange({ ...filters, series });
  };

  const toggleBase = (b: StandardBase | 'SP') => {
    const rarityBases = filters.rarityBases.includes(b)
      ? filters.rarityBases.filter((x) => x !== b)
      : [...filters.rarityBases, b];
    onChange({ ...filters, rarityBases });
  };

  return (
    <div className="filter-panel">
      <div className="filter-section">
        <label className="filter-label">Série</label>
        <div className="filter-pills">
          {allSeries.map((s) => (
            <button
              key={s}
              className={`filter-pill ${filters.series.includes(s) ? 'selected' : ''}`}
              onClick={() => toggleSerie(s)}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="filter-section">
        <label className="filter-label">Rareté</label>
        <div className="filter-pills">
          {ALL_BASES.map((b) => (
            <button
              key={b}
              className={`filter-pill ${filters.rarityBases.includes(b) ? 'selected' : ''}`}
              style={filters.rarityBases.includes(b) ? { background: RARITY_COLORS[b], color: b === 'SEC' ? '#1a1a2e' : '#fff', borderColor: RARITY_COLORS[b] } : undefined}
              onClick={() => toggleBase(b)}
            >
              {BASE_LABELS[b]}
            </button>
          ))}
        </div>
      </div>

      <div className="filter-section">
        <label className="filter-label">Modificateur</label>
        <div className="filter-pills">
          <button
            className={`filter-pill ${filters.parallel ? 'selected' : ''}`}
            style={filters.parallel ? { borderColor: 'var(--gold)', color: 'var(--gold)' } : undefined}
            onClick={() => onChange({ ...filters, parallel: !filters.parallel })}
          >
            Parallel{filters.parallel ? ' ✓' : ''}
          </button>
        </div>
      </div>

      <div className="filter-section">
        <label className="filter-label">Prix</label>
        <div className="filter-price-row">
          <input
            type="number"
            className="filter-price-input"
            placeholder="Min"
            value={Option.match(filters.priceMin, { onNone: () => '', onSome: (n) => String(n) })}
            onChange={(e) => onChange({
              ...filters,
              priceMin: e.target.value ? Option.some(parseFloat(e.target.value)) : Option.none(),
            })}
            min="0"
            step="0.01"
          />
          <span className="filter-price-sep">—</span>
          <input
            type="number"
            className="filter-price-input"
            placeholder="Max"
            value={Option.match(filters.priceMax, { onNone: () => '', onSome: (n) => String(n) })}
            onChange={(e) => onChange({
              ...filters,
              priceMax: e.target.value ? Option.some(parseFloat(e.target.value)) : Option.none(),
            })}
            min="0"
            step="0.01"
          />
        </div>
      </div>

      <button className="filter-reset" onClick={() => onChange(defaultFilters)}>
        Réinitialiser
      </button>
    </div>
  );
}
