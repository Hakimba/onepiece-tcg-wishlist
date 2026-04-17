import { useState } from 'react';
import { Option } from 'effect';
import type { Card } from '../domain/Card';
import type { SpIndex } from '../services/ImageResolver';
import { resolveImageUrl } from '../services/ImageResolver';
import { useImageCache } from '../hooks/useImageCache';

interface Props {
  card: Card;
  spIndex?: SpIndex;
  className?: string;
  alt?: string;
}

export default function CardImage({ card, spIndex, className, alt }: Props) {
  const [error, setError] = useState(false);

  const srcOption = resolveImageUrl(card, spIndex ?? new Map());
  const rawSrc = Option.getOrNull(srcOption);
  const label = alt ?? `${card.idcard} ${card.character}`;

  const isCustom = Option.isSome(card.image);
  const { src, onImgLoad } = useImageCache(isCustom ? null : rawSrc);
  const finalSrc = isCustom ? rawSrc : src;

  if (!finalSrc || (error && Option.isNone(card.image))) {
    return (
      <div className={`card-image-placeholder ${className ?? ''}`}>
        <span>{card.idcard}</span>
      </div>
    );
  }

  return (
    <img
      src={finalSrc}
      alt={label}
      className={className}
      loading="lazy"
      onLoad={isCustom ? undefined : onImgLoad}
      onError={() => setError(true)}
    />
  );
}
