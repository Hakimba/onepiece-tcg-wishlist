import type { FilterState } from '../types';
import type { BaseRarity } from '../rarity';
import { RARITY_COLORS } from '../rarity';
import { defaultFilters } from '../filters';

interface Props {
  filters: FilterState;
  onChange: (f: FilterState) => void;
  allSeries: string[];
}

const BASES: BaseRarity[] = ['C', 'UC', 'R', 'SR', 'SEC', 'L'];
const BASE_LABELS: Record<BaseRarity, string> = {
  C: 'C', UC: 'UC', R: 'R', SR: 'SR', SEC: 'SEC', L: 'Leader',
};

function TriToggle({ label, value, onChange, activeColor }: {
  label: string;
  value: boolean | null;
  onChange: (v: boolean | null) => void;
  activeColor: string;
}) {
  const next = value === null ? true : value === true ? false : null;
  return (
    <button
      className={`tri-toggle ${value === null ? '' : value ? 'on' : 'off'}`}
      style={value === true ? { borderColor: activeColor, color: activeColor } : value === false ? { borderColor: 'var(--danger)', color: 'var(--danger)' } : undefined}
      onClick={() => onChange(next)}
    >
      {label}
      {value === true && ' ✓'}
      {value === false && ' ✗'}
    </button>
  );
}

export default function FilterPanel({ filters, onChange, allSeries }: Props) {
  const toggleSerie = (s: string) => {
    const series = filters.series.includes(s)
      ? filters.series.filter((x) => x !== s)
      : [...filters.series, s];
    onChange({ ...filters, series });
  };

  const toggleBase = (b: string) => {
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
          {BASES.map((b) => (
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
        <label className="filter-label">Modificateurs</label>
        <div className="filter-pills">
          <TriToggle label="Parallel" value={filters.rarityParallel} onChange={(v) => onChange({ ...filters, rarityParallel: v })} activeColor="var(--gold)" />
          <TriToggle label="SP" value={filters.raritySP} onChange={(v) => onChange({ ...filters, raritySP: v })} activeColor="var(--green)" />
        </div>
      </div>

      <div className="filter-section">
        <label className="filter-label">Prix</label>
        <div className="filter-price-row">
          <input
            type="number"
            className="filter-price-input"
            placeholder="Min"
            value={filters.priceMin}
            onChange={(e) => onChange({ ...filters, priceMin: e.target.value })}
            min="0"
            step="0.01"
          />
          <span className="filter-price-sep">—</span>
          <input
            type="number"
            className="filter-price-input"
            placeholder="Max"
            value={filters.priceMax}
            onChange={(e) => onChange({ ...filters, priceMax: e.target.value })}
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
