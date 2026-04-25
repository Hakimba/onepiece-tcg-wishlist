import { useState, useEffect } from 'react';
import type { ViewMode, SortPrice } from '../state/AppState';
import type { Theme } from '../hooks/useTheme';

interface Props {
  view: ViewMode;
  onViewChange: (v: ViewMode) => void;
  onAdd: () => void;
  onOpenImportModal: () => void;
  onExport: () => void;
  onShare: () => Promise<string>;
  onClear: () => void;
  sortPrice: SortPrice;
  onSortPrice: (s: SortPrice) => void;
  showFavoritesOnly: boolean;
  onToggleFavorites: () => void;
  count: number;
  filteredCount: number;
  filtersActive: boolean;
  showFilters: boolean;
  onToggleFilters: () => void;
  onMenuOpen: () => void;
  theme: Theme;
  onToggleTheme: () => void;
}

export default function Header({ view, onViewChange, onAdd, onOpenImportModal, onExport, onShare, onClear, sortPrice, onSortPrice, showFavoritesOnly, onToggleFavorites, count, filteredCount, filtersActive, showFilters, onToggleFilters, onMenuOpen, theme, onToggleTheme }: Props) {
  const [confirmClear, setConfirmClear] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    if (!confirmClear) return;
    const timer = setTimeout(() => setConfirmClear(false), 3000);
    return () => clearTimeout(timer);
  }, [confirmClear]);

  useEffect(() => {
    if (!showToast) return;
    const timer = setTimeout(() => setShowToast(false), 2000);
    return () => clearTimeout(timer);
  }, [showToast]);

  const handleShare = () => {
    if (sharing) return;
    setSharing(true);
    onShare()
      .then(() => setShowToast(true))
      .finally(() => setSharing(false));
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
        <span className="badge">{filtersActive ? `${filteredCount}/${count} cartes` : `${count} cartes`}</span>
        <button className="btn-theme-toggle" onClick={onToggleTheme} title={theme === 'dark' ? 'Mode jour' : 'Mode nuit'}>
          {theme === 'dark' ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="5" />
              <line x1="12" y1="1" x2="12" y2="3" />
              <line x1="12" y1="21" x2="12" y2="23" />
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
              <line x1="1" y1="12" x2="3" y2="12" />
              <line x1="21" y1="12" x2="23" y2="12" />
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          )}
        </button>
      </div>
      <div className="header-actions">
        <div className="header-toolbar">
          <div className="view-toggle">
            <button
              className={view === 'list' ? 'active' : ''}
              onClick={() => onViewChange('list')}
              title="Liste"
            >
              &#9776;
            </button>
            <button
              className={view === 'mosaic' ? 'active' : ''}
              onClick={() => onViewChange('mosaic')}
              title="Mosa&iuml;que"
            >
              &#9638;
            </button>
          </div>
          <button className={`btn-filter ${showFilters ? 'active' : ''}`} onClick={onToggleFilters}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
              </svg>
              {filtersActive && <span className="filter-dot" />}
            </button>
          <div className="sort-toggle">
            <button
              className={sortPrice === 'asc' ? 'active' : ''}
              onClick={() => onSortPrice(sortPrice === 'asc' ? 'none' : 'asc')}
              title="Prix croissant"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="19" x2="12" y2="5" />
                <polyline points="5 12 12 5 19 12" />
              </svg>
              <span className="sort-label">&euro;</span>
            </button>
            <button
              className={sortPrice === 'desc' ? 'active' : ''}
              onClick={() => onSortPrice(sortPrice === 'desc' ? 'none' : 'desc')}
              title="Prix d&eacute;croissant"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <polyline points="19 12 12 19 5 12" />
              </svg>
              <span className="sort-label">&euro;</span>
            </button>
          </div>
          <button
            className={`btn-favorites ${showFavoritesOnly ? 'active' : ''}`}
            onClick={onToggleFavorites}
            title={showFavoritesOnly ? 'Afficher tout' : 'Favoris uniquement'}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill={showFavoritesOnly ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          </button>
        </div>
        <div className="header-buttons">
          <button className="btn-add" onClick={onAdd}>+</button>
          <button className="btn-secondary" onClick={onOpenImportModal}>
            Import
          </button>
          <button className="btn-secondary" onClick={onExport}>Export</button>
          <button className="btn-secondary" onClick={handleShare} disabled={sharing} title="Partager">
            {sharing ? (
              <span className="share-spinner" />
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                <polyline points="16 6 12 2 8 6" />
                <line x1="12" y1="2" x2="12" y2="15" />
              </svg>
            )}
          </button>
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
      </div>
      {showToast && (
        <div className="share-toast">Lien copie !</div>
      )}
    </header>
  );
}
