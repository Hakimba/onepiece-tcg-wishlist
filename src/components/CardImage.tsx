import { useState } from 'react';
import type { Card } from '../types';
import { resolveImageUrl } from '../imageResolver';

interface Props {
  card: Card;
  spIndex?: Map<string, string>;
  className?: string;
  alt?: string;
}

export default function CardImage({ card, spIndex, className, alt }: Props) {
  const [error, setError] = useState(false);

  const src = card.image || resolveImageUrl(card.idcard, card.rarity, spIndex, card.imageSuffix);
  const label = alt ?? `${card.idcard} ${card.character}`;

  if (!src || (error && !card.image)) {
    return (
      <div className={`card-image-placeholder ${className ?? ''}`}>
        <span>{card.idcard}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={label}
      className={className}
      loading="lazy"
      onError={() => setError(true)}
    />
  );
}
