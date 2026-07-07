'use client';

import { createContext, useContext, useEffect, useState } from 'react';

export type ManaMode = 'white' | 'blue' | 'black' | 'red' | 'green' | 'colorless';

export const MANA_MODES: { mode: ManaMode; symbol: string; label: string }[] = [
  { mode: 'white', symbol: 'w', label: 'White — Plains (light)' },
  { mode: 'blue', symbol: 'u', label: 'Blue — Island' },
  { mode: 'black', symbol: 'b', label: 'Black — Swamp (dark)' },
  { mode: 'red', symbol: 'r', label: 'Red — Mountain' },
  { mode: 'green', symbol: 'g', label: 'Green — Forest' },
  { mode: 'colorless', symbol: 'c', label: 'Colorless — Wastes' },
];

const VALID_MODES: ManaMode[] = MANA_MODES.map(m => m.mode);

const ThemeContext = createContext<{
  theme: ManaMode;
  setTheme: (mode: ManaMode) => void;
  toggleTheme: () => void;
}>({
  theme: 'white',
  setTheme: () => {},
  toggleTheme: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

/** Migrate pre-mana-modes stored values. */
function normalizeStoredTheme(stored: string | null): ManaMode | null {
  if (!stored) return null;
  if (stored === 'light') return 'white';
  if (stored === 'dark') return 'black';
  return VALID_MODES.includes(stored as ManaMode) ? (stored as ManaMode) : null;
}

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<ManaMode>('white');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = normalizeStoredTheme(localStorage.getItem('bde-theme'));
    if (stored) {
      setTheme(stored);
    }
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('bde-theme', theme);
  }, [theme, mounted]);

  // Legacy API: cycles light-equivalent <-> dark-equivalent.
  const toggleTheme = () => {
    setTheme(prev => (prev === 'black' ? 'white' : 'black'));
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
