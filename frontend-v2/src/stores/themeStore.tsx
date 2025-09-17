'use client';

import { create } from 'zustand';

type Theme = 'light' | 'dark' | 'system';

interface ThemeStore {
  theme: Theme;
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: Theme) => void;
  initialize: () => void;
}

export const useThemeStore = create<ThemeStore>((set, get) => ({
  theme: 'system',
  resolvedTheme: 'light',

  setTheme: (theme: Theme) => {
    set({ theme });

    // Save theme to localStorage
    localStorage.setItem('theme', theme);

    // Determine resolved theme
    const resolvedTheme = theme === 'system'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : theme;

    set({ resolvedTheme });

    // Apply theme to document
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(resolvedTheme);
  },

  initialize: () => {
    // Get theme from localStorage on mount
    const savedTheme = localStorage.getItem('theme') as Theme | null;
    if (savedTheme) {
      get().setTheme(savedTheme);
    } else {
      get().setTheme('system');
    }

    // Listen for system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      const currentTheme = get().theme;
      if (currentTheme === 'system') {
        const resolvedTheme = e.matches ? 'dark' : 'light';
        set({ resolvedTheme });

        // Apply theme to document
        const root = document.documentElement;
        root.classList.remove('light', 'dark');
        root.classList.add(resolvedTheme);
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  },
}));