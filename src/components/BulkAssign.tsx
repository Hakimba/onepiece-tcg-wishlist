import { useState, useEffect, useMemo, useRef } from 'react';
import type { Card } from '../types';
import RarityBadge from './RarityBadge';

interface Props {
  cards: Card[];
  onUpdate: (card: Card) => void;
  onBack: () => void;
}

export default function BulkAssign({ cards, onUpdate, onBack }: Props) {
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [assignedIndices, setAssignedIndices] = useState<Set<number>>(new Set());
  const [navPosition, setNavPosition] = useState(0);
  const [preview, setPreview] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [assignedCount, setAssignedCount] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const unassignedIndices = useMemo(
    () => Array.from({ length: pendingFiles.length }, (_, i) => i).filter((i) => !assignedIndices.has(i)),
    [pendingFiles.length, assignedIndices]
  );

  const currentFileIndex = unassignedIndices[navPosition] ?? -1;

  // Clamp navPosition when unassigned list shrinks
  useEffect(() => {
    if (unassignedIndices.length > 0 && navPosition >= unassignedIndices.length) {
      setNavPosition(unassignedIndices.length - 1);
    }
  }, [unassignedIndices.length, navPosition]);

  // Create/revoke object URL for current image only
  useEffect(() => {
    if (currentFileIndex >= 0 && pendingFiles[currentFileIndex]) {
      const url = URL.createObjectURL(pendingFiles[currentFileIndex]);
      setPreview(url);
      return () => URL.revokeObjectURL(url);
    }
    setPreview('');
  }, [pendingFiles, currentFileIndex]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setPendingFiles(Array.from(files));
    setNavPosition(0);
    setAssignedIndices(new Set());
    setAssignedCount(0);
  };

  const handleAssign = (card: Card) => {
    if (currentFileIndex < 0) return;
    const file = pendingFiles[currentFileIndex];
    if (!file) return;
    const idx = currentFileIndex;
    const reader = new FileReader();
    reader.onload = () => {
      onUpdate({ ...card, image: reader.result as string });
      setAssignedIndices((prev) => new Set(prev).add(idx));
      setAssignedCount((c) => c + 1);
      // navPosition stays — the list shrinks so the next unassigned slides in
    };
    reader.readAsDataURL(file);
  };

  const sortedCards = useMemo(() => {
    let filtered = cards;
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      filtered = cards.filter(
        (c) =>
          c.character.toLowerCase().includes(q) ||
          c.idcard.toLowerCase().includes(q)
      );
    }
    return [...filtered].sort((a, b) => {
      const aHas = a.image ? 1 : 0;
      const bHas = b.image ? 1 : 0;
      if (aHas !== bHas) return aHas - bHas;
      return a.idcard.localeCompare(b.idcard);
    });
  }, [cards, searchQuery]);

  // Landing
  if (pendingFiles.length === 0) {
    return (
      <div className="bulk-assign">
        <div className="bulk-header">
          <button className="btn-back" onClick={onBack}>← Retour</button>
          <h2>Association images</h2>
        </div>
        <div className="bulk-landing">
          <p>Sélectionne les images depuis ta pellicule pour les associer aux cartes.</p>
          <button className="btn-save" onClick={() => fileRef.current?.click()}>
            Sélectionner des images
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
        </div>
      </div>
    );
  }

  // Done — all images assigned
  if (unassignedIndices.length === 0) {
    return (
      <div className="bulk-assign">
        <div className="bulk-header">
          <button className="btn-back" onClick={onBack}>← Retour</button>
          <h2>Association images</h2>
        </div>
        <div className="bulk-done">
          <div className="bulk-done-count">{assignedCount}</div>
          <p>image{assignedCount > 1 ? 's' : ''} assignée{assignedCount > 1 ? 's' : ''} sur {pendingFiles.length}</p>
          <button className="btn-save" onClick={onBack}>Terminé</button>
        </div>
      </div>
    );
  }

  // Assignment mode
  const remaining = unassignedIndices.length;

  return (
    <div className="bulk-assign">
      <div className="bulk-header">
        <button className="btn-back" onClick={onBack}>← Retour</button>
        <h2>Association images</h2>
        <span className="badge">{assignedCount}/{pendingFiles.length}</span>
      </div>

      <div className="bulk-progress">
        <div
          className="bulk-progress-bar"
          style={{ width: `${(assignedCount / pendingFiles.length) * 100}%` }}
        />
      </div>

      <div className="bulk-preview">
        {preview && <img src={preview} alt={`Image ${currentFileIndex + 1}`} />}
      </div>

      <div className="bulk-actions">
        <button
          className="btn-secondary"
          onClick={() => setNavPosition((p) => p - 1)}
          disabled={navPosition === 0}
        >
          ←
        </button>
        <span className="bulk-counter">{navPosition + 1} / {remaining}</span>
        <button
          className="btn-secondary"
          onClick={() => setNavPosition((p) => p + 1)}
          disabled={navPosition >= remaining - 1}
        >
          →
        </button>
      </div>

      <div className="bulk-search">
        <input
          type="text"
          placeholder="Rechercher une carte..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <ul className="bulk-card-list">
        {sortedCards.map((card) => (
          <li
            key={card.id}
            className={`bulk-card-row ${card.image ? 'has-image' : ''}`}
            onClick={() => handleAssign(card)}
          >
            <span className="bulk-card-id">{card.idcard}</span>
            <span className="bulk-card-char">{card.character}</span>
            <RarityBadge rarity={card.rarity} size="xs" />
          </li>
        ))}
      </ul>
    </div>
  );
}
