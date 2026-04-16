import { Option } from 'effect';
import type { FilterState, TriState } from '../domain/Filter';
import { defaultFilters, cycleTriState } from '../domain/Filter';
import type { StandardBase } from '../domain/Rarity';
import { STANDARD_BASES, RARITY_COLORS } from '../domain/Rarity';

interface Props {
  filters: FilterState;
  onChange: (f: FilterState) => void;
  allSeries: ReadonlyArray<string>;
}

const BASE_LABELS: Record<StandardBase, string> = {
  C: 'C', UC: 'UC', R: 'R', SR: 'SR', SEC: 'SEC', L: 'Leader',
};

function TriToggle({ label, value, onChange, activeColor }: {
  label: string;
  value: TriState;
  onChange: (v: TriState) => void;
  activeColor: string;
}) {
  return (
    <button
      className={`tri-toggle ${value._tag === 'Off' ? '' : value._tag === 'Include' ? 'on' : 'off'}`}
      style={
        value._tag === 'Include'
          ? { borderColor: activeColor, color: activeColor }
          : value._tag === 'Exclude'
            ? { borderColor: 'var(--danger)', color: 'var(--danger)' }
            : undefined
      }
      onClick={() => onChange(cycleTriState(value))}
    >
      {label}
      {value._tag === 'Include' && ' \u2713'}
      {value._tag === 'Exclude' && ' \u2717'}
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

  const toggleBase = (b: StandardBase) => {
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
          {STANDARD_BASES.map((b) => (
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
          <TriToggle label="Parallel" value={filters.parallel} onChange={(v) => onChange({ ...filters, parallel: v })} activeColor="var(--gold)" />
          <TriToggle label="SP" value={filters.sp} onChange={(v) => onChange({ ...filters, sp: v })} activeColor="var(--green)" />
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
