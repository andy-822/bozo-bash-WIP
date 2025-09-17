'use client';

import { useUserStore } from '@/stores/userStore';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import CreateLeagueModal from '@/components/CreateLeagueModal';
import { useLeagues } from '@/hooks/useLeagues';
import { useModalStore } from '@/stores/modalStore';
import { useNavigationStore } from '@/stores/navigationStore';

export default function LeaguesPage() {
  const { user, loading } = useUserStore();
  const router = useRouter();

  const {
    createLeagueOpen: isCreateModalOpen,
    openCreateLeague,
    closeCreateLeague,
  } = useModalStore();

  const {
    data: leagues = [],
    isLoading: leaguesLoading,
    error,
    refetch: refetchLeagues,
  } = useLeagues();

  const setBreadcrumbs = useNavigationStore((state) => state.setBreadcrumbs);

  // Set breadcrumbs
  useEffect(() => {
    setBreadcrumbs([{ label: 'Leagues' }]);
  }, [setBreadcrumbs]);

  // Redirect if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
    }
  }, [user, loading, router]);

  const handleLeagueCreated = () => {
    // TanStack Query will automatically refetch leagues after mutation
    refetchLeagues();
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
    <div>
      <main>
        <div className="mb-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Your Leagues</h2>
            <div className="space-x-4">
              <Button onClick={openCreateLeague}>Create League</Button>
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
            <p className="text-red-600 mb-6">{error.message}</p>
            <Button onClick={() => refetchLeagues()} variant="outline">Try Again</Button>
          </div>
        ) : leagues.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-lg">
            <h3 className="text-lg font-medium mb-2">No leagues yet</h3>
            <p className="text-gray-600 mb-6">
              Create your first league or join an existing one to get started!
            </p>
            <Button onClick={openCreateLeague}>Create Your First League</Button>
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
        onOpenChange={closeCreateLeague}
        onLeagueCreated={handleLeagueCreated}
      />
    </div>
  );
}