/**
 * Theme management utilities for easy color scheme switching
 */

export type ThemeVariant = 'default' | 'sports' | 'team' | 'professional';

export const THEME_VARIANTS: Record<ThemeVariant, { name: string; description: string }> = {
  default: {
    name: 'Default',
    description: 'Clean modern look'
  },
  sports: {
    name: 'Sports',
    description: 'Blue and green sports theme'
  },
  team: {
    name: 'Team',
    description: 'Red and gold team colors'
  },
  professional: {
    name: 'Professional',
    description: 'Navy and gray professional look'
  }
};

/**
 * Apply theme variant to document
 */
export function setThemeVariant(variant: ThemeVariant) {
  const root = document.documentElement;

  console.log('Setting theme variant:', variant);

  // Remove existing theme classes
  Object.keys(THEME_VARIANTS).forEach(theme => {
    root.classList.remove(`theme-${theme}`);
  });

  // Add new theme class (except for default)
  if (variant !== 'default') {
    root.classList.add(`theme-${variant}`);
    console.log('Added theme class:', `theme-${variant}`);
  }

  // Store preference
  localStorage.setItem('theme-variant', variant);

  console.log('Current root classes:', root.className);
}

/**
 * Get current theme variant from localStorage
 */
export function getThemeVariant(): ThemeVariant {
  if (typeof window === 'undefined') return 'default';

  const stored = localStorage.getItem('theme-variant') as ThemeVariant;
  return Object.keys(THEME_VARIANTS).includes(stored) ? stored : 'default';
}

/**
 * Initialize theme on app load
 */
export function initializeTheme() {
  const variant = getThemeVariant();
  setThemeVariant(variant);
}

/**
 * Game status color classes - these adapt to theme variants
 */
export const GAME_STATUS_COLORS = {
  live: 'bg-live-pulse/10 text-live-pulse border-live-pulse/20 animate-pulse',
  completed: 'bg-success/10 text-success border-success/20',
  scheduled: 'bg-muted text-muted-foreground border-border',
} as const;

/**
 * Pick result color classes
 */
export const PICK_RESULT_COLORS = {
  win: 'bg-success/10 text-success border-success/20',
  loss: 'bg-destructive/10 text-destructive border-destructive/20',
  push: 'bg-warning/10 text-warning border-warning/20',
  pending: 'bg-muted text-muted-foreground border-border',
} as const;