import { useState } from 'react';
import { Option } from 'effect';
import type { Card } from '../domain/Card';
import type { SpIndex } from '../services/ImageResolver';
import { resolveImageUrl } from '../services/ImageResolver';

interface Props {
  card: Card;
  spIndex?: SpIndex;
  className?: string;
  alt?: string;
}

export default function CardImage({ card, spIndex, className, alt }: Props) {
  const [error, setError] = useState(false);

  const srcOption = resolveImageUrl(card, spIndex ?? new Map());
  const src = Option.getOrNull(srcOption);
  const label = alt ?? `${card.idcard} ${card.character}`;

  if (!src || (error && Option.isNone(card.image))) {
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
