'use client';

import React from 'react';

interface ManaCostProps {
  manaCost?: string;
  className?: string;
}

interface ManaSymbol {
  type: 'generic' | 'colored' | 'hybrid' | 'phyrexian';
  value: string;
  colors: string[];
}

export default function ManaCost({ manaCost, className = '' }: ManaCostProps) {
  if (!manaCost) return null;

  const symbols = parseManaCost(manaCost);

  return (
    <div className={`flex items-center space-x-1 ${className}`}>
      {symbols.map((symbol, index) => (
        <ManaSymbolComponent key={`${symbol.type}-${symbol.value}-${index}`} symbol={symbol} />
      ))}
    </div>
  );
}

function parseManaCost(manaCost: string): ManaSymbol[] {
  const symbols: ManaSymbol[] = [];
  const regex = /\{([^}]+)\}/g;
  let match;

  while ((match = regex.exec(manaCost)) !== null) {
    const content = match[1];
    symbols.push(parseManaSymbol(content));
  }

  return symbols;
}

function parseManaSymbol(content: string): ManaSymbol {
  // Generic mana (numbers)
  if (/^\d+$/.test(content)) {
    return {
      type: 'generic',
      value: content,
      colors: []
    };
  }

  // Colored mana
  if (/^[WUBRG]$/.test(content)) {
    return {
      type: 'colored',
      value: content,
      colors: [content]
    };
  }

  // Hybrid mana (e.g., W/U, 2/W)
  if (content.includes('/')) {
    const parts = content.split('/');
    return {
      type: 'hybrid',
      value: content,
      colors: parts.filter(p => /^[WUBRG]$/.test(p))
    };
  }

  // Phyrexian mana (e.g., W/P)
  if (content.includes('P')) {
    return {
      type: 'phyrexian',
      value: content,
      colors: [content.replace('/P', '')]
    };
  }

  // Colorless or unknown
  return {
    type: 'generic',
    value: content,
    colors: []
  };
}

function ManaSymbolComponent({ symbol }: { symbol: ManaSymbol }) {
  const getColorClass = (color: string): string => {
    switch (color) {
      case 'W': return 'bg-gray-100 border-2 border-black text-black'; // White with black outline
      case 'U': return 'bg-blue-500 text-white border border-blue-600';
      case 'B': return 'bg-gray-900 text-white border border-gray-800';
      case 'R': return 'bg-red-500 text-white border border-red-600';
      case 'G': return 'bg-green-500 text-white border border-green-600';
      default: return 'bg-gray-300 text-gray-700 border border-gray-400'; // Colorless
    }
  };

  const getHybridClass = (colors: string[]): string => {
    if (colors.length === 2) {
      // Create a gradient for hybrid mana
      const color1 = colors[0];
      const color2 = colors[1];
      const gradientMap: Record<string, string> = {
        'W': 'from-gray-100',
        'U': 'from-blue-500',
        'B': 'from-gray-900',
        'R': 'from-red-500',
        'G': 'from-green-500'
      };
      const gradientMap2: Record<string, string> = {
        'W': 'to-gray-100',
        'U': 'to-blue-500',
        'B': 'to-gray-900',
        'R': 'to-red-500',
        'G': 'to-green-500'
      };
      return `bg-gradient-to-r ${gradientMap[color1]} ${gradientMap2[color2]} text-white border border-gray-400`;
    }
    return getColorClass(colors[0] || '');
  };

  if (symbol.type === 'generic') {
    return (
      <div className="w-5 h-5 rounded-full bg-gray-300 text-gray-700 border border-gray-400 flex items-center justify-center text-xs font-medium">
        {symbol.value}
      </div>
    );
  }

  if (symbol.type === 'colored') {
    return (
      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${getColorClass(symbol.value)}`}>
        {symbol.value}
      </div>
    );
  }

  if (symbol.type === 'hybrid') {
    return (
      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${getHybridClass(symbol.colors)}`}>
        <span className="text-[10px]">{symbol.value}</span>
      </div>
    );
  }

  if (symbol.type === 'phyrexian') {
    return (
      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold border-2 ${getColorClass(symbol.colors[0] || '')}`}>
        <span className="text-[8px]">Φ</span>
      </div>
    );
  }

  return null;
}