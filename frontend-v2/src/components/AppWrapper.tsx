'use client';

import { useEffect } from 'react';
import { useUserStore } from '@/stores/userStore';
import { useThemeStore } from '@/stores/themeStore';

function StoreInitializer({ children }: { children: React.ReactNode }) {
  const initializeUser = useUserStore((state) => state.initialize);
  const initializeTheme = useThemeStore((state) => state.initialize);

  useEffect(() => {
    const userCleanup = initializeUser();
    const themeCleanup = initializeTheme();

    return () => {
      userCleanup?.();
      themeCleanup?.();
    };
  }, [initializeUser, initializeTheme]);

  return <>{children}</>;
}

export default function AppWrapper({ children }: { children: React.ReactNode }) {
  return (
    <StoreInitializer>
      {children}
    </StoreInitializer>
  );
}