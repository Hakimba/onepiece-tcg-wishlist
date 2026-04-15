import { useState, useEffect, type ReactNode } from 'react';
import type { PageId } from '../types';

interface Props {
  open: boolean;
  currentPage: PageId;
  onNavigate: (page: PageId) => void;
  onClose: () => void;
  onClear: () => void;
}

const PAGES: { id: PageId; label: string; icon: ReactNode }[] = [
  {
    id: 'home',
    label: 'Accueil',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    id: 'characters',
    label: 'Personnages',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
];

export default function SideDrawer({ open, currentPage, onNavigate, onClose, onClear }: Props) {
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    if (!open) setConfirmClear(false);
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <div className={`drawer-backdrop ${open ? 'open' : ''}`} onClick={onClose}>
      <nav className={`drawer-panel ${open ? 'open' : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="drawer-title">OP Wishlist</div>
        {PAGES.map((page) => (
          <button
            key={page.id}
            className={`drawer-item ${currentPage === page.id ? 'active' : ''}`}
            onClick={() => onNavigate(page.id)}
          >
            {page.icon}
            {page.label}
          </button>
        ))}
        <div className="drawer-spacer" />
        {confirmClear ? (
          <div className="drawer-confirm">
            <span>Tout supprimer ?</span>
            <button className="btn-danger" onClick={onClear}>Oui</button>
            <button className="btn-secondary" onClick={() => setConfirmClear(false)}>Non</button>
          </div>
        ) : (
          <button className="drawer-item drawer-clear" onClick={() => setConfirmClear(true)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
            Tout vider
          </button>
        )}
      </nav>
    </div>
  );
}
