'use client';

import { useState, useRef, useCallback, type ReactNode } from 'react';

interface CardImageTooltipProps {
  cardName: string;
  imageUri?: string;
  cardId?: string;
  children: ReactNode;
  /** Extra classes for the wrapper span — e.g. `min-w-0 flex-1 truncate` to let it shrink and truncate inside a flex row. */
  className?: string;
}

function getImageUrl(imageUri?: string, cardId?: string): string | null {
  if (imageUri) return imageUri;
  if (cardId && cardId.length >= 2) {
    return `https://cards.scryfall.io/normal/front/${cardId[0]}/${cardId[1]}/${cardId}.jpg`;
  }
  return null;
}

export default function CardImageTooltip({ cardName, imageUri, cardId, children, className }: CardImageTooltipProps) {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [flipped, setFlipped] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLSpanElement>(null);

  const imageUrl = getImageUrl(imageUri, cardId);
  if (!imageUrl) return <>{children}</>;

  const showTooltip = useCallback(() => {
    timerRef.current = setTimeout(() => {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const tooltipWidth = 244;
      const shouldFlip = rect.right + tooltipWidth + 16 > viewportWidth;
      setFlipped(shouldFlip);
      setPosition({
        x: shouldFlip ? rect.left : rect.right,
        y: rect.top,
      });
      setVisible(true);
    }, 150);
  }, []);

  const hideTooltip = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setVisible(false);
  }, []);

  return (
    <span
      ref={containerRef}
      className={className ? `relative ${className}` : 'relative'}
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
    >
      {children}
      {visible && (
        <div
          className="fixed z-[9999] pointer-events-none"
          style={{
            left: flipped ? position.x - 244 - 12 : position.x + 12,
            top: Math.min(position.y - 40, window.innerHeight - 360),
          }}
        >
          <img
            src={imageUrl}
            alt={cardName}
            width={244}
            height={340}
            className="rounded-[12px] shadow-xl"
            style={{ boxShadow: '0 0 0 3px var(--frame, #e5e7eb), 0 8px 24px rgba(0,0,0,0.35)' }}
          />
        </div>
      )}
    </span>
  );
}
