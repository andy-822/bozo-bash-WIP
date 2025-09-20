'use client';

import { useUserStore } from '@/stores/userStore';
import { Button } from '@/components/ui/button';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Calendar, GamepadIcon, CheckCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import MakePickModal from '@/components/MakePickModal';
import LeaguePicksDisplay from '@/components/LeaguePicksDisplay';
import Leaderboard from '@/components/Leaderboard';
import { useSeason, useGames, useGamesForWeek } from '@/hooks/useGames';
import { useUserWeekPicks } from '@/hooks/useUserWeekPicks';
import { useModalStore } from '@/stores/modalStore';
import { useNavigationStore } from '@/stores/navigationStore';
import { Game } from '@/types';


export default function SeasonPage() {
  const { user, loading } = useUserStore();
  const router = useRouter();
  const params = useParams();
  const leagueId = params.leagueId as string;
  const seasonId = params.seasonId as string;

  const {
    pickModalOpen: showPickModal,
    selectedGame,
    openPickModal,
    closePickModal,
  } = useModalStore();

  // Use TanStack Query hooks
  const {
    data: season,
    isLoading: seasonLoading,
    error: seasonError,
  } = useSeason(seasonId);

  const {
    data: gamesData,
    isLoading: gamesLoading,
    error: gamesError,
    refetch: refetchGames,
  } = useGames(seasonId);

  const currentWeek = gamesData?.currentWeek || 1;
  const totalGames = gamesData?.totalGames || 0;

  // Week selector state
  const [selectedWeek, setSelectedWeek] = useState(currentWeek);

  // Update selected week when current week changes
  useEffect(() => {
    setSelectedWeek(currentWeek);
  }, [currentWeek]);

  // Get games for the selected week
  const {
    data: weekGamesData,
    isLoading: weekGamesLoading,
    error: weekGamesError,
  } = useGamesForWeek(seasonId, selectedWeek);

  const games = weekGamesData?.games || [];

  // Get user's picks for the selected week
  const {
    data: userWeekPicksData,
    isLoading: userPicksLoading,
  } = useUserWeekPicks(seasonId, selectedWeek);

  const userWeekPick = userWeekPicksData?.picks?.[0] || null;

  const pageLoading = seasonLoading || gamesLoading || weekGamesLoading || userPicksLoading;
  const error = seasonError || gamesError || weekGamesError;

  const setBreadcrumbs = useNavigationStore((state) => state.setBreadcrumbs);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
    }
  }, [user, loading, router]);

  // Set breadcrumbs when season data is available
  useEffect(() => {
    if (season) {
      setBreadcrumbs([
        { label: 'Leagues', href: '/leagues' },
        { label: season.leagues.name, href: `/leagues/${leagueId}` },
        { label: season.name }
      ]);
    }
  }, [season, leagueId, setBreadcrumbs]);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Not set';
    return new Date(dateString).toLocaleDateString();
  };

  const handleMakePickClick = (game: Game) => {
    openPickModal(game);
  };

  const handlePickSubmitted = () => {
    // Refresh games to show updated state
    refetchGames();
  };

  const formatGameTime = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
  };

  if (loading || pageLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-600"></div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Error</h2>
          <p className="text-gray-600 mb-4">{error.message}</p>
          <Button onClick={() => router.push(`/leagues/${leagueId}`)}>
            Back to League
          </Button>
        </div>
      </div>
    );
  }

  if (!season) {
    return null;
  }

  return (
    <>
      <div className="mb-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold mb-2">{season.name}</h1>
            <div className="flex items-center gap-4 text-gray-600">
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {season.start_date || season.end_date ? (
                  <span>
                    {formatDate(season.start_date)} - {formatDate(season.end_date)}
                  </span>
                ) : (
                  <span>No dates set</span>
                )}
              </span>
              <span className="flex items-center gap-1">
                <GamepadIcon className="h-4 w-4" />
                Week {currentWeek}: {games.length} game{games.length !== 1 ? 's' : ''}
                {totalGames > games.length && (
                  <span className="text-gray-500">({totalGames} total)</span>
                )}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {/* Week Selector */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <GamepadIcon className="h-5 w-5" />
              Week {selectedWeek}
            </h2>
            {selectedWeek !== currentWeek && (
              <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">
                {selectedWeek < currentWeek ? 'Viewing past week' : 'Viewing future week'}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedWeek(Math.max(1, selectedWeek - 1))}
              disabled={selectedWeek <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Prev
            </Button>

            <span className="text-sm text-gray-600 min-w-[60px] text-center">
              Week {selectedWeek}
            </span>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedWeek(Math.min(18, selectedWeek + 1))}
              disabled={selectedWeek >= 18}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>

            {selectedWeek !== currentWeek && (
              <Button
                variant="default"
                size="sm"
                onClick={() => setSelectedWeek(currentWeek)}
                className="ml-2"
              >
                Current Week
              </Button>
            )}
          </div>
        </div>

        {/* Games Section */}
        <div className="border rounded-lg p-6">
          <h3 className="text-lg font-medium mb-4">
            Games
          </h3>

          {games.length === 0 ? (
            <div className="text-center py-8">
              <GamepadIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 mb-4">No games scheduled for this season yet</p>
              <p className="text-sm text-gray-500">
                Games will appear here once they are added to the season
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {games.map((game) => {
                const gameTime = formatGameTime(game.start_time);
                const isCompleted = game.status === 'completed';

                // Get the best odds (for now, just use the first available)
                const bestOdds = game.odds?.[0];

                return (
                  <div
                    key={game.id}
                    className="p-4 border rounded-lg hover:bg-gray-50"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-6">
                        <div className="text-center min-w-[120px]">
                          <div className="font-medium">{game.away_team.name}</div>
                          <div className="text-sm text-gray-500">@</div>
                          <div className="font-medium">{game.home_team.name}</div>
                        </div>

                        {isCompleted && game.home_score !== null && game.away_score !== null ? (
                          <div className="text-center min-w-[80px]">
                            <div className="font-bold text-lg">
                              {game.away_score} - {game.home_score}
                            </div>
                            <div className="text-sm text-green-600 font-medium">Final</div>
                          </div>
                        ) : (
                          <div className="text-center min-w-[80px]">
                            <div className="font-medium">{gameTime.date}</div>
                            <div className="text-sm text-gray-500">{gameTime.time}</div>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          game.status === 'completed'
                            ? 'bg-green-100 text-green-800'
                            : game.status === 'live'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {game.status === 'completed' ? 'Final' :
                           game.status === 'live' ? 'Live' : 'Scheduled'}
                        </span>

                        {!isCompleted && (
                          <>
                            {userWeekPick && userWeekPick.game_id === game.id ? (
                              <div className="flex items-center gap-2 px-3 py-1 bg-green-100 text-green-800 rounded text-sm font-medium">
                                <CheckCircle className="h-4 w-4" />
                                Your Pick
                              </div>
                            ) : userWeekPick ? (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled
                                className="opacity-50 cursor-not-allowed"
                                title={`You already picked a game for Week ${selectedWeek}`}
                              >
                                Week Picked
                              </Button>
                            ) : selectedWeek !== currentWeek ? (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled
                                className="opacity-50 cursor-not-allowed"
                                title="You can only make picks for the current week"
                              >
                                {selectedWeek < currentWeek ? 'Past Week' : 'Future Week'}
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleMakePickClick(game)}
                              >
                                Make Pick
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    {/* Odds Section */}
                    {bestOdds && !isCompleted && (
                      <div className="grid grid-cols-3 gap-4 pt-3 border-t border-gray-100">
                        <div className="text-center">
                          <div className="text-xs text-gray-500 mb-1">Spread</div>
                          <div className="text-sm font-medium">
                            {bestOdds.spread_home !== null ? (
                              <>
                                {game.home_team.abbreviation} {bestOdds.spread_home > 0 ? '+' : ''}{bestOdds.spread_home}
                              </>
                            ) : (
                              'N/A'
                            )}
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-xs text-gray-500 mb-1">Total</div>
                          <div className="text-sm font-medium">
                            {bestOdds.total_over !== null ? `O/U ${bestOdds.total_over}` : 'N/A'}
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-xs text-gray-500 mb-1">Moneyline</div>
                          <div className="text-sm font-medium">
                            {bestOdds.moneyline_home !== null ? (
                              <>
                                {game.home_team.abbreviation} {bestOdds.moneyline_home > 0 ? '+' : ''}{bestOdds.moneyline_home}
                              </>
                            ) : (
                              'N/A'
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {bestOdds && !isCompleted && (
                      <div className="text-xs text-gray-400 mt-2">
                        Odds from {bestOdds.sportsbook} • Updated {new Date(bestOdds.last_update).toLocaleTimeString()}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* League Picks */}
        <LeaguePicksDisplay leagueId={leagueId} currentWeek={selectedWeek} />

        {/* Leaderboard section */}
        <Leaderboard seasonId={seasonId} currentWeek={selectedWeek} />
      </div>

      <MakePickModal
        open={showPickModal}
        onOpenChange={closePickModal}
        game={selectedGame}
        currentWeek={currentWeek}
        seasonId={seasonId}
        onPickSubmitted={handlePickSubmitted}
      />
    </>
  );
}