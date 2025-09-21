'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Palette, Check } from 'lucide-react';
import {
  setThemeVariant,
  getThemeVariant,
  THEME_VARIANTS,
  type ThemeVariant
} from '@/lib/theme';

export function ThemeSelector() {
  const [currentTheme, setCurrentTheme] = useState<ThemeVariant>('default');
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setCurrentTheme(getThemeVariant());
  }, []);

  const handleThemeChange = (variant: ThemeVariant) => {
    setThemeVariant(variant);
    setCurrentTheme(variant);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="gap-2 bg-primary/10 border-primary/20"
      >
        <Palette className="h-4 w-4" />
        Theme
      </Button>

      {isOpen && (
        <Card className="absolute top-full right-0 mt-2 w-64 z-50 shadow-lg">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Choose Theme</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {Object.entries(THEME_VARIANTS).map(([variant, config]) => (
              <button
                key={variant}
                onClick={() => handleThemeChange(variant as ThemeVariant)}
                className="w-full text-left p-3 rounded-lg border border-border hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-sm">{config.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {config.description}
                    </div>
                  </div>
                  {currentTheme === variant && (
                    <Check className="h-4 w-4 text-primary" />
                  )}
                </div>

                {/* Theme preview */}
                <div className="flex gap-1 mt-2">
                  <div className={`w-3 h-3 rounded ${
                    variant === 'sports' ? 'bg-blue-500' :
                    variant === 'team' ? 'bg-red-500' :
                    variant === 'professional' ? 'bg-slate-600' :
                    'bg-gray-400'
                  }`} />
                  <div className={`w-3 h-3 rounded ${
                    variant === 'sports' ? 'bg-green-500' :
                    variant === 'team' ? 'bg-yellow-500' :
                    variant === 'professional' ? 'bg-gray-400' :
                    'bg-blue-400'
                  }`} />
                  <div className="w-3 h-3 rounded bg-primary opacity-60" />
                </div>
              </button>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Click outside to close */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}

/**
 * Mini theme preview for settings pages
 */
export function ThemePreview({ variant }: { variant: ThemeVariant }) {
  const config = THEME_VARIANTS[variant];

  return (
    <div className="p-4 border rounded-lg space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">{config.name}</h3>
        <Badge variant="outline" className="text-xs">Preview</Badge>
      </div>

      <div className="space-y-2">
        <div className="flex gap-2">
          <Badge className="bg-success/10 text-success border-success/20">Win</Badge>
          <Badge className="bg-live-pulse/10 text-live-pulse border-live-pulse/20">Live</Badge>
          <Badge className="bg-destructive/10 text-destructive border-destructive/20">Loss</Badge>
        </div>

        <div className="p-2 bg-card rounded border">
          <div className="text-card-foreground text-sm">Game Card Preview</div>
          <div className="text-muted-foreground text-xs mt-1">
            {config.description}
          </div>
        </div>
      </div>
    </div>
  );
}