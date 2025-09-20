'use client';

import { useUserStore } from '@/stores/userStore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Calendar, GamepadIcon, CheckCircle, ChevronLeft, ChevronRight, ArrowLeft } from 'lucide-react';
import MakePickModal from '@/components/MakePickModal';
import LeaguePicksDisplay from '@/components/LeaguePicksDisplay';
import Leaderboard from '@/components/Leaderboard';
import { useSeason, useGames, useGamesForWeek } from '@/hooks/useGames';
import { useUserWeekPicks } from '@/hooks/useUserWeekPicks';
import { useLeaguePicks } from '@/hooks/usePicks';
import { useModalStore } from '@/stores/modalStore';
import { useNavigationStore } from '@/stores/navigationStore';
import { Game } from '@/types';


type ViewState = 'overview' | 'game-details';

export default function SeasonPage() {
  const { user, loading } = useUserStore();
  const router = useRouter();
  const params = useParams();
  const leagueId = params.leagueId as string;
  const seasonId = params.seasonId as string;

  // UI State
  const [viewState, setViewState] = useState<ViewState>('overview');
  const [selectedGameForDetails, setSelectedGameForDetails] = useState<Game | null>(null);

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

  // Get all league picks for the selected week
  const {
    data: leaguePicksData,
    isLoading: leaguePicksLoading,
  } = useLeaguePicks(leagueId, selectedWeek);

  const userWeekPick = userWeekPicksData?.picks?.[0] || null;
  const leaguePicks = leaguePicksData || [];

  const pageLoading = seasonLoading || gamesLoading || weekGamesLoading || userPicksLoading || leaguePicksLoading;
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

  const handleGameClick = (game: Game) => {
    setSelectedGameForDetails(game);
    setViewState('game-details');
  };

  const handleBackToOverview = () => {
    setViewState('overview');
    setSelectedGameForDetails(null);
  };

  const getGameStatusBadge = (game: Game) => {
    if (game.status === 'completed') {
      return <Badge variant="default" className="bg-green-100 text-green-800">Final</Badge>;
    }
    if (game.status === 'live') {
      return <Badge variant="default" className="bg-red-100 text-red-800">Live</Badge>;
    }
    return <Badge variant="outline">Scheduled</Badge>;
  };

  const hasUserPickedGame = (gameId: number) => {
    return leaguePicks.some(pick => pick.game_id === gameId && pick.user_id === user?.id);
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
    <div className="flex h-screen">
      {/* Left Sidebar */}
      <div className="w-80  border-r border-gray-200 flex flex-col">
        {/* Sidebar Header with Week Selector */}
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold mb-3">Week {selectedWeek}</h2>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedWeek(Math.max(1, selectedWeek - 1))}
              disabled={selectedWeek <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
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
              <ChevronRight className="h-4 w-4" />
            </Button>

            {selectedWeek !== currentWeek && (
              <Button
                variant="default"
                size="sm"
                onClick={() => setSelectedWeek(currentWeek)}
                className="ml-2"
              >
                Current
              </Button>
            )}
          </div>
        </div>

        {/* Games List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {games.length === 0 ? (
            <div className="text-center py-8">
              <GamepadIcon className="h-8 w-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-600">No games this week</p>
            </div>
          ) : (
            games.map((game) => {
              const gameTime = formatGameTime(game.start_time);
              const isCompleted = game.status === 'completed';
              const userPicked = hasUserPickedGame(game.id);

              return (
                <Card
                  key={game.id}
                  className={`cursor-pointer transition-colors hover:bg-gray-50 ${
                    selectedGameForDetails?.id === game.id ? 'ring-2 ring-blue-500' : ''
                  } ${userPicked ? 'border-green-200 bg-green-50' : ''}`}
                  onClick={() => handleGameClick(game)}
                >
                  <CardContent className="p-3">
                    <div className="flex justify-between items-start mb-2">
                      <div className="text-sm">
                        <div className="font-medium">{game.away_team.abbreviation}</div>
                        <div className="text-gray-500 text-xs">@</div>
                        <div className="font-medium">{game.home_team.abbreviation}</div>
                      </div>
                      {getGameStatusBadge(game)}
                    </div>

                    {isCompleted && game.home_score !== null && game.away_score !== null ? (
                      <div className="text-center">
                        <div className="font-bold text-sm">
                          {game.away_score} - {game.home_score}
                        </div>
                        <div className="text-xs text-green-600">Final</div>
                      </div>
                    ) : (
                      <div className="text-center">
                        <div className="text-xs text-gray-600">{gameTime.date}</div>
                        <div className="text-xs text-gray-500">{gameTime.time}</div>
                      </div>
                    )}

                    {userPicked && (
                      <div className="mt-2 flex items-center justify-center">
                        <div className="flex items-center gap-1 text-xs text-green-700">
                          <CheckCircle className="h-3 w-3" />
                          Picked
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="border-b border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">{season.name}</h1>
              <div className="flex items-center gap-4 text-sm text-gray-600 mt-1">
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
                </span>
              </div>
            </div>

            {viewState === 'game-details' && (
              <Button variant="outline" onClick={handleBackToOverview}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Overview
              </Button>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {viewState === 'overview' ? (
            <div className="grid grid-cols-2 gap-6 h-full">
              {/* League Picks Column */}
              <div>
                <Card className="h-full">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <GamepadIcon className="h-5 w-5" />
                      Week {selectedWeek} Picks
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="overflow-y-auto">
                    <LeaguePicksDisplay leagueId={leagueId} currentWeek={selectedWeek} />
                  </CardContent>
                </Card>
              </div>

              {/* Leaderboard Column */}
              <div>
                <Card className="h-full">
                  <CardHeader>
                    <CardTitle>Leaderboard</CardTitle>
                  </CardHeader>
                  <CardContent className="overflow-y-auto">
                    <Leaderboard seasonId={seasonId} currentWeek={selectedWeek} />
                  </CardContent>
                </Card>
              </div>
            </div>
          ) : (
            /* Game Details View */
            selectedGameForDetails && (
              <div className="max-w-4xl mx-auto">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-xl">
                      {selectedGameForDetails.away_team.name} @ {selectedGameForDetails.home_team.name}
                    </CardTitle>
                    <div className="text-sm text-gray-600">
                      {formatGameTime(selectedGameForDetails.start_time).date} at {formatGameTime(selectedGameForDetails.start_time).time}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-8">
                      {/* Team Info */}
                      <div className="space-y-4">
                        <div className="text-center p-4 border rounded-lg">
                          <h3 className="font-semibold">{selectedGameForDetails.away_team.name}</h3>
                          <p className="text-sm text-gray-600">Away</p>
                        </div>
                        <div className="text-center p-4 border rounded-lg">
                          <h3 className="font-semibold">{selectedGameForDetails.home_team.name}</h3>
                          <p className="text-sm text-gray-600">Home</p>
                        </div>
                      </div>

                      {/* Betting Options */}
                      <div className="space-y-4">
                        <h3 className="font-semibold">Betting Options</h3>
                        {selectedGameForDetails.odds && selectedGameForDetails.odds.length > 0 ? (
                          <div className="space-y-3">
                            {/* Add betting interface here - this will be enhanced next */}
                            <div className="p-4 border rounded-lg">
                              <h4 className="font-medium mb-2">Moneyline</h4>
                              <div className="grid grid-cols-2 gap-2">
                                <Button variant="outline" className="h-auto p-3">
                                  <div>
                                    <div className="font-medium">{selectedGameForDetails.away_team.abbreviation}</div>
                                    <div className="text-sm">{selectedGameForDetails.odds[0]?.moneyline_away || 'N/A'}</div>
                                  </div>
                                </Button>
                                <Button variant="outline" className="h-auto p-3">
                                  <div>
                                    <div className="font-medium">{selectedGameForDetails.home_team.abbreviation}</div>
                                    <div className="text-sm">{selectedGameForDetails.odds[0]?.moneyline_home || 'N/A'}</div>
                                  </div>
                                </Button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <p className="text-gray-600">No odds available</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )
          )}
        </div>
      </div>

      <MakePickModal
        open={showPickModal}
        onOpenChange={closePickModal}
        game={selectedGame}
        currentWeek={currentWeek}
        seasonId={seasonId}
        onPickSubmitted={handlePickSubmitted}
      />
    </div>
  );
}