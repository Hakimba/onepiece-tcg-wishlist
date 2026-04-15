import { useRef, useState, useEffect } from 'react';
import type { ViewMode } from '../types';

interface Props {
  view: ViewMode;
  onViewChange: (v: ViewMode) => void;
  onAdd: () => void;
  onImport: (file: File) => void;
  onExport: () => void;
  onClear: () => void;
  count: number;
  filteredCount: number;
  filtersActive: boolean;
  showFilters: boolean;
  onToggleFilters: () => void;
  onMenuOpen: () => void;
}

export default function Header({ view, onViewChange, onAdd, onImport, onExport, onClear, count, filteredCount, filtersActive, showFilters, onToggleFilters, onMenuOpen }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    if (!confirmClear) return;
    const timer = setTimeout(() => setConfirmClear(false), 3000);
    return () => clearTimeout(timer);
  }, [confirmClear]);

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
        <button className="btn-hamburger" onClick={onMenuOpen} title="Menu">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
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
          {confirmClear ? (
            <div className="header-confirm-clear">
              <button className="btn-danger btn-small" onClick={() => { onClear(); setConfirmClear(false); }}>Oui</button>
              <button className="btn-secondary btn-small" onClick={() => setConfirmClear(false)}>Non</button>
            </div>
          ) : (
            <button className="btn-secondary btn-clear" onClick={() => setConfirmClear(true)} title="Tout vider">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </button>
          )}
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
