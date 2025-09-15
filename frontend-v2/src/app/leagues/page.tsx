'use client';

import { useUser } from '@/contexts/UserContext';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import CreateLeagueModal from '@/components/CreateLeagueModal';

export default function LeaguesPage() {
  const { user, loading, signOut } = useUser();
  const router = useRouter();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-600"></div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <header className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold">Leagues</h1>
          <div className="flex items-center gap-4">
            <span>Welcome, {user.email}</span>
            <Button onClick={signOut} variant="outline">
              Sign Out
            </Button>
          </div>
        </header>

        <main>
          <div className="text-center py-12">
            <h2 className="text-xl font-semibold mb-4">Your Leagues</h2>
            <p className="text-gray-600 mb-8">
              You haven&#39;t joined any leagues yet. Create or join a league to get started!
            </p>
            <div className="space-x-4">
              <Button onClick={() => setIsCreateModalOpen(true)}>Create League</Button>
              <Button variant="outline">Join League</Button>
            </div>
          </div>
        </main>

        <CreateLeagueModal
          open={isCreateModalOpen}
          onOpenChange={setIsCreateModalOpen}
        />
      </div>
    </div>
  );
}