'use client';

import { useEffect, useState } from 'react';
import { EDHRECTheme, GenerationConstraints } from '@/lib/types';

interface ThemeSelectorProps {
  commanderName: string | null;
  constraints: GenerationConstraints;
  onChange: (constraints: GenerationConstraints) => void;
}

export default function ThemeSelector({ commanderName, constraints, onChange }: ThemeSelectorProps) {
  const [themes, setThemes] = useState<EDHRECTheme[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState<string | null>(null);

  useEffect(() => {
    if (!commanderName) {
      setThemes([]);
      setSelectedTheme(null);
      return;
    }

    setLoading(true);
    fetch(`/api/themes?commander=${encodeURIComponent(commanderName)}`)
      .then(r => r.json())
      .then(data => {
        setThemes(data.themes ?? []);
      })
      .catch(() => setThemes([]))
      .finally(() => setLoading(false));
  }, [commanderName]);

  const selectTheme = (theme: EDHRECTheme | null) => {
    const name = theme?.name ?? null;
    setSelectedTheme(name);

    // Remove previous theme keyword and add new one
    const currentKeywords = (constraints.keyword_focus || []).filter(
      k => !themes.some(t => t.name === k)
    );

    if (name) {
      onChange({
        ...constraints,
        keyword_focus: [...currentKeywords, name]
      });
    } else {
      onChange({
        ...constraints,
        keyword_focus: currentKeywords.length > 0 ? currentKeywords : undefined
      });
    }
  };

  // Nothing to show until a commander is chosen
  if (!commanderName) return null;

  return (
    <div>
      <h3 className="text-sm font-medium text-gray-700 mb-2">EDHREC Themes</h3>
      {loading ? (
        <p className="text-xs text-gray-500">Loading themes…</p>
      ) : themes.length === 0 ? (
        <p className="text-xs text-gray-500">No EDHREC themes available for this commander.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {/* "No theme" pill */}
          <button
            type="button"
            onClick={() => selectTheme(null)}
            className={`px-3 py-1 rounded-full text-sm border transition-colors ${
              selectedTheme === null
                ? 'bg-gray-700 text-white border-gray-700'
                : 'bg-white text-gray-600 border-gray-300 hover:border-gray-500'
            }`}
          >
            No theme (goodstuff)
          </button>

          {themes.map(theme => (
            <button
              key={theme.slug}
              type="button"
              onClick={() => selectTheme(theme)}
              className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                selectedTheme === theme.name
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400 hover:text-blue-600'
              }`}
              title={`${theme.count.toLocaleString()} decks`}
            >
              {theme.name}
              <span className="ml-1 text-xs opacity-70">({theme.count.toLocaleString()})</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
