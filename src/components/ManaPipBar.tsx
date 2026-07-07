'use client';

import { useTheme, MANA_MODES } from './ThemeProvider';

/**
 * The theme switcher: six real mana pips (via mana-font), one per mana mode.
 * White is the light mode, Black is the dark mode; the rest are full themes.
 */
export default function ManaPipBar() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="pipbar" role="radiogroup" aria-label="Color theme">
      {MANA_MODES.map(({ mode, symbol, label }) => (
        <button
          key={mode}
          onClick={() => setTheme(mode)}
          className={theme === mode ? 'pip-active' : ''}
          role="radio"
          aria-checked={theme === mode}
          aria-label={label}
          title={label}
        >
          <i className={`ms ms-${symbol}`} aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}
