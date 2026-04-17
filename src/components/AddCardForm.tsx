import { useState } from 'react';
import { Option } from 'effect';
import type { Card } from '../domain/Card';
import { makeCard, normalizeIdCard } from '../domain/Card';
import type { Rarity as RarityType } from '../domain/Rarity';
import { Standard, Promo } from '../domain/Rarity';
import { parsePrice } from '../domain/Price';
import type { SetCode } from '../domain/SetCode';
import * as SC from '../domain/SetCode';
import RarityPicker from './RarityPicker';

interface Props {
  onAdd: (card: Card) => void;
  onCancel: () => void;
  error: Option.Option<string>;
  validPrefixes: ReadonlySet<SetCode>;
}

const ID_STRUCTURE_REGEX = /^[A-Z]{1,4}\d{0,2}-\d{3}[A-Z]?$/;

export default function AddCardForm({ onAdd, onCancel, error, validPrefixes }: Props) {
  const [serie, setSerie] = useState('');
  const [idcard, setIdcard] = useState('');
  const [character, setCharacter] = useState('');
  const [rarity, setRarity] = useState<RarityType>(Standard({ base: 'R' }));
  const [price, setPrice] = useState('');
  const [idError, setIdError] = useState('');

  const idCardBranded = normalizeIdCard(idcard);
  const setCode = SC.extractFromIdCard(idCardBranded);
  const isPromoId = SC.isPromoId(idCardBranded);
  const effectiveRarity = isPromoId ? Promo() : rarity;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const id = idcard.trim().toUpperCase();
    if (!id) { setIdError('ID carte requis'); return; }
    if (!ID_STRUCTURE_REGEX.test(id)) {
      setIdError('Format invalide (ex: OP01-013, P-033)');
      return;
    }
    const prefix = Option.getOrNull(setCode);
    if (!prefix || !validPrefixes.has(prefix)) {
      const display = prefix ?? id.match(/^([A-Z]+\d*)/)?.[1] ?? id;
      setIdError(`Préfixe inconnu "${display}" (ex: OP01, ST01, P, EB01)`);
      return;
    }
    const prefixStr = String(prefix);
    if (serie.trim() && prefixStr !== serie.trim().toUpperCase()) {
      setIdError(`Série incohérente avec l'ID (attendu: ${prefixStr})`);
      return;
    }
    setIdError('');
    onAdd(
      makeCard({
        serie: serie.trim() || (isPromoId ? '' : prefixStr),
        idcard: id,
        character: character.trim(),
        rarity: effectiveRarity,
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
          <RarityPicker rarity={rarity} onChange={setRarity} isPromo={isPromoId} />
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
