'use client';

import React, {ReactNode, useEffect, useState} from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useUserStore } from '@/stores/userStore';
import { useThemeStore } from '@/stores/themeStore';
import AppLayout from '@/components/AppLayout';

function StoreInitializer({ children }: { children: ReactNode }) {
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

export default function AppWrapper({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60 * 5, // 5 minutes
            gcTime: 1000 * 60 * 10, // 10 minutes
            retry: (failureCount, error: unknown) => {
              // Don't retry on 4xx errors
              if (typeof error === 'object' && error !== null && 'status' in error) {
                const statusCode = (error as { status: number }).status;
                if (statusCode >= 400 && statusCode < 500) {
                  return false;
                }
              }
              return failureCount < 3;
            },
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <StoreInitializer>
        <AppLayout>
          {children}
        </AppLayout>
      </StoreInitializer>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}