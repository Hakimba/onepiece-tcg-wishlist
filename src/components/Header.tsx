import { useRef } from 'react';
import type { ViewMode } from '../types';

interface Props {
  view: ViewMode;
  onViewChange: (v: ViewMode) => void;
  onAdd: () => void;
  onImport: (file: File) => void;
  onExport: () => void;
  count: number;
  filteredCount: number;
  filtersActive: boolean;
  showFilters: boolean;
  onToggleFilters: () => void;
}

export default function Header({ view, onViewChange, onAdd, onImport, onExport, count, filteredCount, filtersActive, showFilters, onToggleFilters }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImport(file);
      e.target.value = '';
    }
  };

  return (
    <header className="header">
      <div className="header-top">
        <h1>OP Wishlist</h1>
        <span className="badge">{filtersActive ? `${filteredCount}/${count}` : count}</span>
      </div>
      <div className="header-actions">
        <div className="view-toggle">
          <button
            className={view === 'list' ? 'active' : ''}
            onClick={() => onViewChange('list')}
            title="Liste"
          >
            ☰
          </button>
          <button
            className={view === 'mosaic' ? 'active' : ''}
            onClick={() => onViewChange('mosaic')}
            title="Mosaïque"
          >
            ▦
          </button>
        </div>
        <button className={`btn-filter ${showFilters ? 'active' : ''}`} onClick={onToggleFilters}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
            </svg>
            {filtersActive && <span className="filter-dot" />}
          </button>
        <div className="header-buttons">
          <button className="btn-add" onClick={onAdd}>+</button>
          <button className="btn-secondary" onClick={() => fileRef.current?.click()}>
            Import
          </button>
          <button className="btn-secondary" onClick={onExport}>Export</button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".csv"
          onChange={handleFile}
          style={{ display: 'none' }}
        />
      </div>
    </header>
  );
}
