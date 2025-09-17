'use client';

import { useUserStore } from '@/stores/userStore';
import { Button } from '@/components/ui/button';
import { useRouter, useParams } from 'next/navigation';
import { useEffect } from 'react';
import { Calendar, GamepadIcon } from 'lucide-react';
import MakePickModal from '@/components/MakePickModal';
import LeaguePicksDisplay from '@/components/LeaguePicksDisplay';
import { useSeason, useGames } from '@/hooks/useGames';
import { usePicks } from '@/hooks/usePicks';
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

  const games = gamesData?.games || [];
  const currentWeek = gamesData?.currentWeek || 1;
  const totalGames = gamesData?.totalGames || 0;

  const {
    data: picks = [],
    isLoading: picksLoading,
    error: picksError,
  } = usePicks(currentWeek);

  const pageLoading = seasonLoading || gamesLoading || picksLoading;
  const error = seasonError || gamesError || picksError;

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
                Weeks {currentWeek}-{currentWeek + 1}: {games.length} game{games.length !== 1 ? 's' : ''}
                {totalGames > games.length && (
                  <span className="text-gray-500">({totalGames} total)</span>
                )}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {/* Games Section */}
        <div className="border rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <GamepadIcon className="h-5 w-5" />
            Week {currentWeek} & {currentWeek + 1} Games
          </h2>

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
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleMakePickClick(game)}
                          >
                            Make Pick
                          </Button>
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
        <LeaguePicksDisplay leagueId={leagueId} currentWeek={currentWeek} />

        {/* Upcoming: Picks & Leaderboard sections */}
        <div className="grid gap-6 md:grid-cols-2">
          <div className="border rounded-lg p-6">
            <h3 className="font-semibold mb-4">My Picks (Week {currentWeek})</h3>

            {picks.length === 0 ? (
              <p className="text-gray-600 text-sm">
                No picks made for Week {currentWeek} yet
              </p>
            ) : (
              <div className="space-y-3">
                {picks.map((pick) => {
                  const gameTime = new Date(pick.games.start_time);
                  const isGameStarted = new Date() >= gameTime;

                  return (
                    <div
                      key={pick.id}
                      className="p-3 border rounded-lg bg-blue-50"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="font-medium text-sm">
                          {pick.games.away_team.name} @ {pick.games.home_team.name}
                        </div>
                        <div className="text-xs text-gray-500">
                          {gameTime.toLocaleDateString()} {gameTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>

                      <div className="flex justify-between items-center">
                        <div>
                          <div className="font-medium text-blue-900">
                            {pick.bet_type === 'moneyline' && `${pick.selection} to win`}
                            {pick.bet_type === 'spread' && `${pick.selection}`}
                            {pick.bet_type === 'total' && `${pick.selection} points`}
                          </div>
                          <div className="text-xs text-blue-600 capitalize">
                            {pick.bet_type}
                          </div>
                        </div>

                        <div className="text-right">
                          {pick.result ? (
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              pick.result === 'win'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {pick.result.toUpperCase()}
                            </span>
                          ) : isGameStarted ? (
                            <span className="px-2 py-1 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                              PENDING
                            </span>
                          ) : (
                            <span className="px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-800">
                              ACTIVE
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="border rounded-lg p-6">
            <h3 className="font-semibold mb-4">Season Leaderboard</h3>
            <p className="text-gray-600 text-sm">
              Season standings will be calculated here
            </p>
          </div>
        </div>
      </div>

      <MakePickModal
        open={showPickModal}
        onOpenChange={closePickModal}
        game={selectedGame}
        currentWeek={currentWeek}
        onPickSubmitted={handlePickSubmitted}
      />
    </>
  );
}