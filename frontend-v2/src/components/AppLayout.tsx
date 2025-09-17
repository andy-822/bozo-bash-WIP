'use client';

import { useUserStore } from '@/stores/userStore';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ThemeToggle';
import Breadcrumbs from '@/components/Breadcrumbs';

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const { user, signOut } = useUserStore();

  // Don't show header for non-authenticated users (login page)
  if (!user) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen">
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container flex h-16 items-center justify-between px-4 max-w-7xl mx-auto">
          <div className="flex items-center gap-6">
            <h1 className="text-xl font-bold">Bozo Bash</h1>
            <Breadcrumbs />
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground hidden sm:block">
              Welcome, {user.email}
            </span>
            <ThemeToggle />
            <Button onClick={signOut} variant="outline" size="sm">
              Sign Out
            </Button>
          </div>
        </div>
      </header>
      <main className="container px-4 py-6 max-w-7xl mx-auto">
        {children}
      </main>
    </div>
  );
}