'use client';

import { useState } from 'react';
import { GenerationConstraints } from '@/lib/types';

interface ShareButtonProps {
  commanderName: string;
  constraints: GenerationConstraints;
}

function buildShareUrl(commanderName: string, constraints: GenerationConstraints): string {
  const params = new URLSearchParams();
  params.set('commander', commanderName);
  params.set('budget', String(constraints.total_budget));
  params.set('maxCard', String(constraints.max_card_price));
  if (constraints.prefer_cheapest) params.set('cheap', '1');
  if (constraints.targetBracket != null) params.set('bracket', String(constraints.targetBracket));
  if (constraints.landCount != null) params.set('lands', String(constraints.landCount));
  if (constraints.nonBasicLandCount != null) params.set('nonBasic', String(constraints.nonBasicLandCount));
  if (constraints.random_tag_count != null) params.set('spice', String(constraints.random_tag_count));
  if (constraints.pacing) params.set('pacing', constraints.pacing);
  if (constraints.hyperFocus) params.set('hyperFocus', '1');
  if (constraints.gameChangerLimit != null) params.set('gameChangers', String(constraints.gameChangerLimit));
  if (constraints.maxRarity && constraints.maxRarity !== 'mythic') params.set('rarity', constraints.maxRarity);
  if (constraints.comboCount != null) params.set('combos', String(constraints.comboCount));
  if (constraints.keywords?.length) params.set('keywords', constraints.keywords.join(','));
  if (constraints.mustIncludeCards?.length) params.set('include', constraints.mustIncludeCards.join(','));
  if (constraints.excludedCards?.length) params.set('exclude', constraints.excludedCards.join(','));
  if (constraints.no_infinite_combos) params.set('noInfinite', '1');
  if (constraints.no_land_destruction) params.set('noLandDestroy', '1');
  if (constraints.no_extra_turns) params.set('noExtraTurns', '1');
  if (constraints.no_stax) params.set('noStax', '1');
  if (constraints.no_fast_mana) params.set('noFastMana', '1');
  if (constraints.card_type_weights) params.set('weights', JSON.stringify(constraints.card_type_weights));
  return `https://bigdeckenergy.org?${params.toString()}`;
}

export { buildShareUrl };

export default function ShareButton({ commanderName, constraints }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  const shareUrl = buildShareUrl(commanderName, constraints);
  const shareText = `I generated a chaos Commander deck for ${commanderName} on bigdeckenergy.org — generate your own with the same settings!`;

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = shareUrl;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }
    (window as any).gtag?.('event', 'deck_shared', { method: 'clipboard' });
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    const isMobile = navigator.maxTouchPoints > 0 && window.innerWidth < 768;
    if (isMobile && navigator.share) {
      try {
        await navigator.share({ title: 'My Chaos Deck', text: shareText, url: shareUrl });
        (window as any).gtag?.('event', 'deck_shared', { method: 'mobile' });
      } catch {
        // User cancelled — fall back to clipboard
        await copyToClipboard();
      }
    } else {
      await copyToClipboard();
    }
  };

  return (
    <button
      onClick={handleShare}
      aria-label="Share this chaos deck"
      className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-md shadow-sm text-sm font-medium hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 transition-colors min-h-[44px] min-w-[44px]"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
      </svg>
      <span style={{ fontFamily: 'Impact, "Arial Black", sans-serif', textTransform: 'uppercase' }}>
        {copied ? 'COPIED!' : 'SHARE THIS DECK'}
      </span>
    </button>
  );
}
