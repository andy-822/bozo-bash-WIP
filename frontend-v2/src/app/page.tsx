'use client';

import { useUser } from '@/contexts/UserContext';
import Login from '@/components/Login';
import { Button } from '@/components/ui/button';

export default function Home() {
  const { user, loading, signOut } = useUser();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <header className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold">The Bozos Parlay Challenge</h1>
          <div className="flex items-center gap-4">
            <span>Welcome, {user.email}</span>
            <Button onClick={signOut} variant="outline">
              Sign Out
            </Button>
          </div>
        </header>

        <main>
          <p className="text-gray-400">You&apos;re successfully logged in! Time to start building your parlay challenge features.</p>
        </main>
      </div>
    </div>
  );
}
