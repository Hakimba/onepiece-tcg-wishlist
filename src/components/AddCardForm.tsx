import { useState } from 'react';
import type { Card } from '../types';
import type { BaseRarity } from '../rarity';
import { buildRarityString, RARITY_COLORS } from '../rarity';

interface Props {
  onAdd: (card: Omit<Card, 'id'>) => void;
  onCancel: () => void;
  error?: string;
}

const RARITIES: BaseRarity[] = ['C', 'UC', 'R', 'SR', 'SEC', 'L'];
const VALID_ID_REGEX = /^[A-Z]{2,4}\d{1,2}-\d{3}[A-Z]?$/;

export default function AddCardForm({ onAdd, onCancel, error }: Props) {
  const [serie, setSerie] = useState('');
  const [idcard, setIdcard] = useState('');
  const [character, setCharacter] = useState('');
  const [baseRarity, setBaseRarity] = useState<BaseRarity>('R');
  const [isParallel, setIsParallel] = useState(false);
  const [isSP, setIsSP] = useState(false);
  const [price, setPrice] = useState('');
  const [idError, setIdError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const id = idcard.trim().toUpperCase();
    if (!id) { setIdError('ID carte requis'); return; }
    if (!VALID_ID_REGEX.test(id)) {
      setIdError('Format invalide (ex: OP01-013)');
      return;
    }
    const idPrefix = id.match(/^([A-Z]{2,4}\d{1,2})/)?.[1] ?? '';
    if (serie.trim() && idPrefix !== serie.trim().toUpperCase()) {
      setIdError(`Série incohérente avec l'ID (attendu: ${idPrefix})`);
      return;
    }
    setIdError('');
    onAdd({
      serie: serie.trim() || idPrefix,
      idcard: id,
      character: character.trim(),
      rarity: buildRarityString(baseRarity, isParallel, isSP),
      price: price.trim(),
    });
  };

  return (
    <div className="form-screen">
      <div className="form-header">
        <button className="btn-back" onClick={onCancel}>← Retour</button>
        <h2>Ajouter une carte</h2>
      </div>
      <form onSubmit={handleSubmit} className="add-form">
        <div className="form-field">
          <label>Série</label>
          <input
            type="text"
            placeholder="OP01"
            value={serie}
            onChange={(e) => setSerie(e.target.value)}
          />
        </div>
        <div className="form-field">
          <label>ID Carte *</label>
          <input
            type="text"
            placeholder="OP01-025"
            value={idcard}
            onChange={(e) => { setIdcard(e.target.value); setIdError(''); }}
            required
          />
          {(idError || error) && <span className="field-error">{idError || error}</span>}
        </div>
        <div className="form-field">
          <label>Personnage</label>
          <input
            type="text"
            placeholder="Roronoa Zoro"
            value={character}
            onChange={(e) => setCharacter(e.target.value)}
          />
        </div>
        <div className="form-field">
          <label>Rareté</label>
          <div className="rarity-picker">
            {RARITIES.map((r) => (
              <button
                key={r}
                type="button"
                className={`rarity-pill${baseRarity === r ? ' selected' : ''}`}
                style={{
                  '--pill-color': RARITY_COLORS[r],
                } as React.CSSProperties}
                onClick={() => setBaseRarity(r)}
              >
                {r === 'L' ? 'Leader' : r}
              </button>
            ))}
          </div>
          <div className="rarity-toggles">
            <label className="rarity-toggle">
              <input
                type="checkbox"
                checked={isParallel}
                onChange={(e) => setIsParallel(e.target.checked)}
              />
              <span className="toggle-label toggle-alt">Parallel / Alt</span>
            </label>
            <label className="rarity-toggle">
              <input
                type="checkbox"
                checked={isSP}
                onChange={(e) => setIsSP(e.target.checked)}
              />
              <span className="toggle-label toggle-sp">SP</span>
            </label>
          </div>
        </div>
        <div className="form-field">
          <label>Prix</label>
          <input
            type="text"
            placeholder="10-15"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </div>
        <button type="submit" className="btn-add btn-submit">Ajouter</button>
      </form>
    </div>
  );
}
