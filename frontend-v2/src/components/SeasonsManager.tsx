'use client';

import { Button } from '@/components/ui/button';
import { Plus, Calendar, Edit2, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import CreateSeasonModal from './CreateSeasonModal';
import { useSeasons } from '@/hooks/useSeasons';
import { useModalStore } from '@/stores/modalStore';
import { useToast } from '@/hooks/use-toast';


interface SeasonsManagerProps {
  leagueId: string;
  isAdmin: boolean;
}

export default function SeasonsManager({ leagueId, isAdmin }: SeasonsManagerProps) {
  const router = useRouter();
  const { toast } = useToast();

  const {
    data: seasons = [],
    isLoading: loading,
    error,
    refetch: refetchSeasons,
  } = useSeasons(leagueId);

  const {
    createSeasonOpen: showCreateModal,
    openCreateSeason,
    closeCreateSeason,
  } = useModalStore();

  const handleSeasonCreated = () => {
    refetchSeasons();
    closeCreateSeason();
  };

  const handleDeleteSeason = async (seasonId: number) => {
    if (!confirm('Are you sure you want to delete this season? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/seasons/${seasonId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete season');
      }

      // Refresh seasons list
      refetchSeasons();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Failed to delete season",
        description: error instanceof Error ? error.message : 'An unexpected error occurred',
      });
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Not set';
    return new Date(dateString).toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="border rounded-lg p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-3 bg-gray-200 rounded"></div>
            <div className="h-3 bg-gray-200 rounded w-5/6"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="border rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Seasons ({seasons.length})
          </h2>
          {isAdmin && (
            <Button
              onClick={() => openCreateSeason(leagueId)}
              size="sm"
              className="flex items-center gap-1"
            >
              <Plus className="h-4 w-4" />
              Add Season
            </Button>
          )}
        </div>

        {error && (
          <div className="text-red-600 mb-4 p-3 bg-red-50 rounded-md">
            {error.message}
          </div>
        )}

        {seasons.length === 0 ? (
          <div className="text-center py-8">
            <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 mb-4">No seasons created yet</p>
            {isAdmin && (
              <Button
                onClick={() => openCreateSeason(leagueId)}
                variant="outline"
                className="flex items-center gap-1 mx-auto"
              >
                <Plus className="h-4 w-4" />
                Create First Season
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {seasons.map((season) => (
              <div
                key={season.id}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 cursor-pointer"
                onClick={() => router.push(`/leagues/${leagueId}/seasons/${season.id}`)}
              >
                <div className="flex-1">
                  <h3 className="font-medium">{season.name}</h3>
                  <div className="text-sm text-gray-600 mt-1">
                    {season.start_date || season.end_date ? (
                      <span>
                        {formatDate(season.start_date)} - {formatDate(season.end_date)}
                      </span>
                    ) : (
                      <span>No dates set</span>
                    )}
                  </div>
                </div>

                {isAdmin && (
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      title="Edit season"
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteSeason(season.id);
                      }}
                      title="Delete season"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <CreateSeasonModal
        open={showCreateModal}
        onOpenChange={closeCreateSeason}
        leagueId={leagueId}
        onSeasonCreated={handleSeasonCreated}
      />
    </>
  );
}