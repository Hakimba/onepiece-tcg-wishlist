import { useMemo } from 'react';
import type { Card } from '../types';

interface Props {
  cards: Card[];
  onSelectCharacter: (name: string) => void;
  onBack: () => void;
}

export default function CharactersPage({ cards, onSelectCharacter, onBack }: Props) {
  const characters = useMemo(() => {
    const map = new Map<string, number>();
    for (const card of cards) {
      const name = card.character.trim();
      if (!name) continue;
      map.set(name, (map.get(name) ?? 0) + 1);
    }
    return [...map.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [cards]);

  return (
    <div className="characters-page">
      <div className="characters-header">
        <button className="btn-back" onClick={onBack}>← Retour</button>
        <h2>Personnages</h2>
        <span className="badge">{characters.length}</span>
      </div>
      <ul className="characters-list">
        {characters.map(({ name, count }) => (
          <li key={name} className="character-row" onClick={() => onSelectCharacter(name)}>
            <span className="character-name">{name}</span>
            <span className="character-count">{count} carte{count > 1 ? 's' : ''}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
