import { useState } from 'react';
import { Option } from 'effect';
import type { Card } from '../domain/Card';
import { makeCard } from '../domain/Card';
import type { StandardBase } from '../domain/Rarity';
import { STANDARD_BASES, RARITY_COLORS, buildRarity } from '../domain/Rarity';
import { parsePrice } from '../domain/Price';

interface Props {
  onAdd: (card: Card) => void;
  onCancel: () => void;
  error: Option.Option<string>;
}

const VALID_ID_REGEX = /^[A-Z]{2,4}\d{1,2}-\d{3}[A-Z]?$/;

export default function AddCardForm({ onAdd, onCancel, error }: Props) {
  const [serie, setSerie] = useState('');
  const [idcard, setIdcard] = useState('');
  const [character, setCharacter] = useState('');
  const [baseRarity, setBaseRarity] = useState<StandardBase | null>('R');
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
    onAdd(
      makeCard({
        serie: serie.trim() || idPrefix,
        idcard: id,
        character: character.trim(),
        rarity: buildRarity(baseRarity, isParallel, isSP),
        price: parsePrice(price.trim()),
      }),
    );
  };

  const displayError = idError || Option.getOrElse(error, () => '');

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
          {displayError && <span className="field-error">{displayError}</span>}
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
            <button
              type="button"
              className={`rarity-pill${baseRarity === null && !isSP ? ' selected' : ''}`}
              style={{ '--pill-color': '#6b7280' } as React.CSSProperties}
              onClick={() => { setBaseRarity(null); setIsParallel(false); setIsSP(false); }}
            >
              ?
            </button>
            {STANDARD_BASES.map((r) => (
              <button
                key={r}
                type="button"
                className={`rarity-pill${baseRarity === r && !isSP ? ' selected' : ''}`}
                style={{
                  '--pill-color': RARITY_COLORS[r],
                } as React.CSSProperties}
                onClick={() => { setBaseRarity(r); setIsSP(false); }}
              >
                {r === 'L' ? 'Leader' : r}
              </button>
            ))}
            <button
              type="button"
              className={`rarity-pill${isSP ? ' selected' : ''}`}
              style={{ '--pill-color': RARITY_COLORS['SP'] } as React.CSSProperties}
              onClick={() => { setIsSP(true); setBaseRarity(null); setIsParallel(false); }}
            >
              SP
            </button>
          </div>
          {baseRarity !== null && !isSP && (
            <div className="rarity-toggles">
              <label className="rarity-toggle">
                <input
                  type="checkbox"
                  checked={isParallel}
                  onChange={(e) => setIsParallel(e.target.checked)}
                />
                <span className="toggle-label toggle-alt">Parallel / Alt</span>
              </label>
            </div>
          )}
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
