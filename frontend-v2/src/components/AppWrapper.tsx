'use client';

import { UserProvider } from '@/contexts/UserContext';

export default function AppWrapper({ children }: { children: React.ReactNode }) {
  return (
    <UserProvider>
      {children}
    </UserProvider>
  );
}