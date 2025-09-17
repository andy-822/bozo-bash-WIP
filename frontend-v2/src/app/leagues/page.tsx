'use client';

import { useUserStore } from '@/stores/userStore';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import CreateLeagueModal from '@/components/CreateLeagueModal';
import { ThemeToggle } from '@/components/ThemeToggle';

interface League {
  id: number;
  name: string;
  created_at: string;
  admin_id: string;
  sport_id: number;
  sports: { name: string }[];
}

export default function LeaguesPage() {
  const { user, loading, signOut } = useUserStore();
  const router = useRouter();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [leagues, setLeagues] = useState<League[]>([]);
  const [leaguesLoading, setLeaguesLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch leagues when user is available
  useEffect(() => {
    if (user) {
      fetchLeagues();
    }
  }, [user]);

  // Redirect if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
    }
  }, [user, loading, router]);

  const fetchLeagues = async () => {
    try {
      setLeaguesLoading(true);
      setError(null);

      const response = await fetch('/api/leagues');
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to fetch leagues');
        return;
      }

      setLeagues(data.leagues || []);
    } catch (error) {
      console.error('Error fetching leagues:', error);
      setError('Failed to load leagues');
    } finally {
      setLeaguesLoading(false);
    }
  };

  const handleLeagueCreated = () => {
    // Refresh leagues after creating a new one
    fetchLeagues();
  };

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
            <ThemeToggle />
            <Button onClick={signOut} variant="outline">
              Sign Out
            </Button>
          </div>
        </header>

        <main>
          <div className="mb-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">Your Leagues</h2>
              <div className="space-x-4">
                <Button onClick={() => setIsCreateModalOpen(true)}>Create League</Button>
                <Button variant="outline">Join League</Button>
              </div>
            </div>
          </div>

          {leaguesLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-600"></div>
            </div>
          ) : error ? (
            <div className="text-center py-12 border-2 border-red-200 rounded-lg bg-red-50">
              <h3 className="text-lg font-medium mb-2 text-red-800">Error</h3>
              <p className="text-red-600 mb-6">{error}</p>
              <Button onClick={fetchLeagues} variant="outline">Try Again</Button>
            </div>
          ) : leagues.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-lg">
              <h3 className="text-lg font-medium mb-2">No leagues yet</h3>
              <p className="text-gray-600 mb-6">
                Create your first league or join an existing one to get started!
              </p>
              <Button onClick={() => setIsCreateModalOpen(true)}>Create Your First League</Button>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {leagues.map((league) => (
                <div
                  key={league.id}
                  className="border rounded-lg p-6 hover:shadow-md transition-shadow"
                >
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="font-semibold text-lg">{league.name}</h3>
                    {league.admin_id === user?.id && (
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                        Admin
                      </span>
                    )}
                  </div>

                  <div className="text-sm text-gray-600 space-y-1">
                    <p>Sport: {league.sports?.[0]?.name || 'Unknown'}</p>
                    <p>Created: {new Date(league.created_at).toLocaleDateString()}</p>
                  </div>

                  <div className="mt-4 pt-4 border-t">
                    <Button
                      size="sm"
                      className="w-full"
                      onClick={() => router.push(`/leagues/${league.id}`)}
                    >
                      View League
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>

        <CreateLeagueModal
          open={isCreateModalOpen}
          onOpenChange={setIsCreateModalOpen}
          onLeagueCreated={handleLeagueCreated}
        />
      </div>
    </div>
  );
}