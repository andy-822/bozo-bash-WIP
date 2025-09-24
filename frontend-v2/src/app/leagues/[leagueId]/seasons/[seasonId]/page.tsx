'use client';

import { useUserStore } from '@/stores/userStore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState, useMemo } from 'react';
import { Calendar, GamepadIcon, CheckCircle, ChevronLeft, ChevronRight, ArrowLeft } from 'lucide-react';
import MakePickModal from '@/components/MakePickModal';
import LeaguePicksDisplay from '@/components/LeaguePicksDisplay';
import Leaderboard from '@/components/Leaderboard';
import { useSeason, useGames, useGamesForWeek } from '@/hooks/useGames';
import { useUserWeekPicks } from '@/hooks/useUserWeekPicks';
import { useLeaguePicks, useCreatePick } from '@/hooks/usePicks';
import { useToast } from '@/hooks/use-toast';
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

  // Pick creation state for game details view
  const [selectedBetType, setSelectedBetType] = useState<'moneyline' | 'spread' | 'total' | null>(null);
  const [selectedBetOption, setSelectedBetOption] = useState<string | null>(null);
  const [isSubmittingPick, setIsSubmittingPick] = useState(false);

  const {
    pickModalOpen: showPickModal,
    selectedGame,
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

  const games: Game[] = useMemo(() => weekGamesData?.games || [], [weekGamesData?.games]);

  // Auto-refresh for live games
  useEffect(() => {
    // Check if there are any live games
    const hasLiveGames = games.some(game => game.status === 'live');

    if (!hasLiveGames) return;

    // Set up polling interval for live games (every 30 seconds)
    const interval = setInterval(() => {
      console.log('Refreshing live game data...');
      refetchGames();
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [games, refetchGames]);

  // Get user's picks for the selected week
  const {
    isLoading: userPicksLoading,
  } = useUserWeekPicks(seasonId, selectedWeek);

  // Get all league picks for the selected week
  const {
    data: leaguePicksData,
    isLoading: leaguePicksLoading,
  } = useLeaguePicks(leagueId, selectedWeek);

  const leaguePicks = leaguePicksData || [];

  // Pick creation mutation
  const createPickMutation = useCreatePick();
  const { toast } = useToast();

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
    // Reset pick selection state when switching games
    setSelectedBetType(null);
    setSelectedBetOption(null);
  };

  const handleBackToOverview = () => {
    setViewState('overview');
    setSelectedGameForDetails(null);
    // Reset pick selection state
    setSelectedBetType(null);
    setSelectedBetOption(null);
  };

  const handleBetSelection = (betType: 'moneyline' | 'spread' | 'total', option: string) => {
    setSelectedBetType(betType);
    setSelectedBetOption(option);
  };

  const handleSubmitPick = async () => {
    if (!selectedGameForDetails || !selectedBetType || !selectedBetOption) {
      toast({
        variant: "destructive",
        title: "No selection made",
        description: "Please select a betting option before submitting.",
      });
      return;
    }

    setIsSubmittingPick(true);

    try {
      await createPickMutation.mutateAsync({
        game_id: selectedGameForDetails.id,
        bet_type: selectedBetType,
        selection: selectedBetOption,
        week: selectedWeek,
        season_id: seasonId,
      });

      toast({
        title: "Pick submitted successfully!",
        description: `Your ${selectedBetType} pick has been recorded.`,
      });

      // Reset selection and go back to overview
      setSelectedBetType(null);
      setSelectedBetOption(null);
      setViewState('overview');

      // Refresh data
      refetchGames();

    } catch (error) {
      toast({
        variant: "destructive",
        title: "Failed to submit pick",
        description: error instanceof Error ? error.message : 'An unexpected error occurred',
      });
    } finally {
      setIsSubmittingPick(false);
    }
  };

  const getGameStatusBadge = (game: Game) => {
    if (game.status === 'completed') {
      return <Badge variant="default" className="bg-success/10 text-success border-success/20">Final</Badge>;
    }
    if (game.status === 'live') {
      return (
        <Badge variant="default" className="bg-live-pulse/10 text-live-pulse border-live-pulse/20 animate-pulse">
          🔴 Live
        </Badge>
      );
    }
    return <Badge variant="outline">Scheduled</Badge>;
  };

  const hasUserPickedGame = (gameId: number) => {
    return leaguePicks.some(pick => pick.game_id === gameId && pick.user_id === user?.id);
  };

  const isGameStarted = (game: Game) => {
    const gameTime = new Date(game.start_time);
    const now = new Date();
    return now >= gameTime;
  };

  const canMakePick = (game: Game) => {
    return !isGameStarted(game) && game.status !== 'live' && game.status !== 'completed';
  };

  if (loading || pageLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
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
          <p className="text-muted-foreground mb-4">{error.message}</p>
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
    <div className="flex h-screen bg-background text-foreground">
      {/* Left Sidebar */}
      <div className="w-80 border-r border-border bg-card flex flex-col">
        {/* Sidebar Header with Week Selector */}
        <div className="p-4 border-b border-border bg-card text-card-foreground">
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

            <span className="text-sm text-muted-foreground min-w-[60px] text-center">
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
              <GamepadIcon className="h-8 w-8 text-muted-foreground/60 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No games this week</p>
            </div>
          ) : (
            games.map((game) => {
              const gameTime = formatGameTime(game.start_time);
              const isCompleted = game.status === 'completed';
              const isLive = game.status === 'live';
              const hasScores = game.home_score !== null && game.away_score !== null;
              const userPicked = hasUserPickedGame(game.id);
              const gameStarted = isGameStarted(game);
              const pickingAllowed = canMakePick(game);

              return (
                <Card
                  key={game.id}
                  className={`cursor-pointer transition-colors hover:bg-accent bg-card text-card-foreground border-border ${
                    selectedGameForDetails?.id === game.id ? 'ring-2 ring-primary' : ''
                  } ${userPicked ? 'border-success/30 bg-success/5' : ''} ${
                    isLive ? 'border-live-pulse/30 bg-live-pulse/5' : ''
                  } ${gameStarted && !pickingAllowed ? 'opacity-60' : ''}`}
                  onClick={() => handleGameClick(game)}
                >
                  <CardContent className="p-3">
                    <div className="flex justify-between items-start mb-2">
                      <div className="text-sm">
                        <div className="font-medium">{game.away_team.abbreviation}</div>
                        <div className="text-muted-foreground text-xs">@</div>
                        <div className="font-medium">{game.home_team.abbreviation}</div>
                      </div>
                      {getGameStatusBadge(game)}
                    </div>

                    {hasScores ? (
                      <div className="text-center">
                        <div className="font-bold text-sm">
                          {game.away_score} - {game.home_score}
                        </div>
                        {isLive ? (
                          <div className="text-xs">
                            <div className="text-red-600 font-medium">
                              {game.display_clock && game.display_clock !== '0:00' ? game.display_clock : 'Live'}
                            </div>
                            {game.status_detail && (
                              <div className="text-muted-foreground">{game.status_detail}</div>
                            )}
                          </div>
                        ) : isCompleted ? (
                          <div className="text-xs text-green-600">Final</div>
                        ) : (
                          <div className="text-xs text-muted-foreground">
                            {game.status_detail || 'Scheduled'}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center">
                        <div className="text-xs text-muted-foreground">{gameTime.date}</div>
                        <div className="text-xs text-muted-foreground">{gameTime.time}</div>
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

                    {gameStarted && !pickingAllowed && !userPicked && (
                      <div className="mt-2 flex items-center justify-center">
                        <div className="text-xs text-muted-foreground">
                          🔒 Picks closed
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
        <div className="border-b border-border p-6 bg-card">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-card-foreground">{season.name}</h1>
              <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
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

            <div className="flex items-center gap-3">
              {viewState === 'game-details' && (
                <Button variant="outline" onClick={handleBackToOverview}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Overview
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {viewState === 'overview' ? (
            <div className="grid grid-cols-2 gap-6 h-full">
              {/* League Picks Column */}
              <div className="overflow-y-auto">
                <LeaguePicksDisplay leagueId={leagueId} currentWeek={selectedWeek} />
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
            /* Game Details View *//* Game Details View */
            selectedGameForDetails && (
              <div className="max-w-2xl mx-auto">
                <Card>
                  <CardHeader className="text-center">
                    <CardTitle className="text-2xl mb-2">Game Info</CardTitle>
                    <div className="text-xl font-semibold">
                      {selectedGameForDetails.away_team.name} @ {selectedGameForDetails.home_team.name}
                    </div>

                    {/* Live Score Display */}
                    {selectedGameForDetails.home_score !== null && selectedGameForDetails.away_score !== null ? (
                      <div className="my-4 p-4 bg-muted rounded-lg">
                        <div className="grid grid-cols-3 items-center gap-4">
                          <div className="text-center">
                            <div className="font-medium text-lg">{selectedGameForDetails.away_team.abbreviation}</div>
                            <div className="text-2xl font-bold">{selectedGameForDetails.away_score}</div>
                          </div>
                          <div className="text-center">
                            <div className="text-sm text-muted-foreground">vs</div>
                            {selectedGameForDetails.status === 'live' ? (
                              <div className="space-y-1">
                                <div className="text-red-600 font-bold">
                                  {selectedGameForDetails.display_clock && selectedGameForDetails.display_clock !== '0:00'
                                    ? selectedGameForDetails.display_clock
                                    : 'LIVE'
                                  }
                                </div>
                                {selectedGameForDetails.status_detail && (
                                  <div className="text-xs text-muted-foreground">
                                    {selectedGameForDetails.status_detail}
                                  </div>
                                )}
                              </div>
                            ) : selectedGameForDetails.status === 'completed' ? (
                              <div className="text-green-600 font-medium">FINAL</div>
                            ) : (
                              <div className="text-xs text-muted-foreground">
                                {selectedGameForDetails.status_detail || 'Scheduled'}
                              </div>
                            )}
                          </div>
                          <div className="text-center">
                            <div className="font-medium text-lg">{selectedGameForDetails.home_team.abbreviation}</div>
                            <div className="text-2xl font-bold">{selectedGameForDetails.home_score}</div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground mt-2">
                        {formatGameTime(selectedGameForDetails.start_time).date} at {formatGameTime(selectedGameForDetails.start_time).time}
                      </div>
                    )}
                  </CardHeader>
                  <CardContent>
                    {selectedGameForDetails.odds && selectedGameForDetails.odds.length > 0 ? (
                      <div className="space-y-6">
                        {/* Deadline Warning */}
                        {!canMakePick(selectedGameForDetails) && (
                          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                            <div className="flex items-center gap-2">
                              <span className="text-yellow-600">🔒</span>
                              <div className="text-sm text-yellow-800">
                                <div className="font-medium">Picks are closed for this game</div>
                                <div className="text-xs">
                                  {isGameStarted(selectedGameForDetails)
                                    ? 'Game has already started'
                                    : 'Game is live or completed'
                                  }
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                        {/* Betting Options Grid */}
                        <div className="grid grid-cols-3 gap-6">
                          {/* Money Line Column */}
                          <div className="text-center">
                            <h3 className="font-semibold mb-4 text-lg">ML</h3>
                            <div className="space-y-3">
                              <Button
                                variant={selectedBetType === 'moneyline' && selectedBetOption === selectedGameForDetails.away_team.name ? 'default' : 'outline'}
                                className="w-full h-auto p-4 flex flex-col"
                                onClick={() => handleBetSelection('moneyline', selectedGameForDetails.away_team.name)}
                                disabled={!canMakePick(selectedGameForDetails)}
                              >
                                <div className="font-medium">{selectedGameForDetails.away_team.abbreviation}</div>
                                <div className="text-sm text-muted-foreground">
                                  {selectedGameForDetails.odds[0]?.moneyline_away ?
                                    (selectedGameForDetails.odds[0].moneyline_away > 0 ?
                                      `+${selectedGameForDetails.odds[0].moneyline_away}` :
                                      selectedGameForDetails.odds[0].moneyline_away
                                    ) : 'N/A'
                                  }
                                </div>
                              </Button>
                              <Button
                                variant={selectedBetType === 'moneyline' && selectedBetOption === selectedGameForDetails.home_team.name ? 'default' : 'outline'}
                                className="w-full h-auto p-4 flex flex-col"
                                onClick={() => handleBetSelection('moneyline', selectedGameForDetails.home_team.name)}
                                disabled={!canMakePick(selectedGameForDetails)}
                              >
                                <div className="font-medium">{selectedGameForDetails.home_team.abbreviation}</div>
                                <div className="text-sm text-muted-foreground">
                                  {selectedGameForDetails.odds[0]?.moneyline_home ?
                                    (selectedGameForDetails.odds[0].moneyline_home > 0 ?
                                      `+${selectedGameForDetails.odds[0].moneyline_home}` :
                                      selectedGameForDetails.odds[0].moneyline_home
                                    ) : 'N/A'
                                  }
                                </div>
                              </Button>
                            </div>
                          </div>

                          {/* Spread Column */}
                          <div className="text-center">
                            <h3 className="font-semibold mb-4 text-lg">SP</h3>
                            <div className="space-y-3">
                              {(() => {
                                const awaySpreadSelection = selectedGameForDetails.odds[0]?.spread_away !== null && selectedGameForDetails.odds[0]?.spread_away !== undefined ?
                                  `${selectedGameForDetails.away_team.name} ${selectedGameForDetails.odds[0].spread_away > 0 ? '+' : ''}${selectedGameForDetails.odds[0].spread_away}` : null;
                                const homeSpreadSelection = selectedGameForDetails.odds[0]?.spread_home !== null && selectedGameForDetails.odds[0]?.spread_home !== undefined ?
                                  `${selectedGameForDetails.home_team.name} ${selectedGameForDetails.odds[0].spread_home > 0 ? '+' : ''}${selectedGameForDetails.odds[0].spread_home}` : null;

                                return (
                                  <>
                                    <Button
                                      variant={selectedBetType === 'spread' && selectedBetOption === awaySpreadSelection ? 'default' : 'outline'}
                                      className="w-full h-auto p-4 flex flex-col"
                                      onClick={() => awaySpreadSelection && handleBetSelection('spread', awaySpreadSelection)}
                                      disabled={!awaySpreadSelection || !canMakePick(selectedGameForDetails)}
                                    >
                                      <div className="font-medium">{selectedGameForDetails.away_team.abbreviation}</div>
                                      <div className="text-sm text-muted-foreground">
                                        {selectedGameForDetails.odds[0]?.spread_away !== null && selectedGameForDetails.odds[0]?.spread_away !== undefined ?
                                          (selectedGameForDetails.odds[0].spread_away > 0 ?
                                            `+${selectedGameForDetails.odds[0].spread_away}` :
                                            selectedGameForDetails.odds[0].spread_away
                                          ) : 'N/A'
                                        }
                                      </div>
                                    </Button>
                                    <Button
                                      variant={selectedBetType === 'spread' && selectedBetOption === homeSpreadSelection ? 'default' : 'outline'}
                                      className="w-full h-auto p-4 flex flex-col"
                                      onClick={() => homeSpreadSelection && handleBetSelection('spread', homeSpreadSelection)}
                                      disabled={!homeSpreadSelection || !canMakePick(selectedGameForDetails)}
                                    >
                                      <div className="font-medium">{selectedGameForDetails.home_team.abbreviation}</div>
                                      <div className="text-sm text-muted-foreground">
                                        {selectedGameForDetails.odds[0]?.spread_home !== null && selectedGameForDetails.odds[0]?.spread_home !== undefined ?
                                          (selectedGameForDetails.odds[0].spread_home > 0 ?
                                            `+${selectedGameForDetails.odds[0].spread_home}` :
                                            selectedGameForDetails.odds[0].spread_home
                                          ) : 'N/A'
                                        }
                                      </div>
                                    </Button>
                                  </>
                                );
                              })()}
                            </div>
                          </div>

                          {/* Over/Under Column */}
                          <div className="text-center">
                            <h3 className="font-semibold mb-4 text-lg">OU</h3>
                            <div className="space-y-3">
                              {(() => {
                                const overSelection = selectedGameForDetails.odds[0]?.total_over ? `Over ${selectedGameForDetails.odds[0].total_over}` : null;
                                const underSelection = selectedGameForDetails.odds[0]?.total_under ? `Under ${selectedGameForDetails.odds[0].total_under}` : null;

                                return (
                                  <>
                                    <Button
                                      variant={selectedBetType === 'total' && selectedBetOption === overSelection ? 'default' : 'outline'}
                                      className="w-full h-auto p-4 flex flex-col"
                                      onClick={() => overSelection && handleBetSelection('total', overSelection)}
                                      disabled={!overSelection || !canMakePick(selectedGameForDetails)}
                                    >
                                      <div className="font-medium">Over</div>
                                      <div className="text-sm text-muted-foreground">
                                        {selectedGameForDetails.odds[0]?.total_over || 'N/A'}
                                      </div>
                                    </Button>
                                    <Button
                                      variant={selectedBetType === 'total' && selectedBetOption === underSelection ? 'default' : 'outline'}
                                      className="w-full h-auto p-4 flex flex-col"
                                      onClick={() => underSelection && handleBetSelection('total', underSelection)}
                                      disabled={!underSelection || !canMakePick(selectedGameForDetails)}
                                    >
                                      <div className="font-medium">Under</div>
                                      <div className="text-sm text-muted-foreground">
                                        {selectedGameForDetails.odds[0]?.total_under || 'N/A'}
                                      </div>
                                    </Button>
                                  </>
                                );
                              })()}
                            </div>
                          </div>
                        </div>

                        {/* Pick Selection Summary */}
                        {selectedBetType && selectedBetOption && (
                          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                            <h4 className="font-medium text-blue-900 mb-2">Your Selection:</h4>
                            <p className="text-blue-800 mb-3">
                              {selectedBetType === 'moneyline' && `${selectedBetOption} to win`}
                              {selectedBetType === 'spread' && `${selectedBetOption}`}
                              {selectedBetType === 'total' && `${selectedBetOption} points`}
                            </p>
                            <Button
                              onClick={handleSubmitPick}
                              disabled={isSubmittingPick || !canMakePick(selectedGameForDetails)}
                              className="w-full"
                            >
                              {isSubmittingPick ? 'Submitting...' :
                               !canMakePick(selectedGameForDetails) ? 'Picks Closed' : 'Submit Pick'}
                            </Button>
                          </div>
                        )}

                        {/* Odds Source Info */}
                        {selectedGameForDetails.odds[0] && (
                          <div className="text-center text-xs text-muted-foreground pt-4 border-t">
                            Odds from {selectedGameForDetails.odds[0].sportsbook} •
                            Updated {new Date(selectedGameForDetails.odds[0].last_update).toLocaleTimeString()}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <p className="text-muted-foreground">No odds available for this game</p>
                      </div>
                    )}
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