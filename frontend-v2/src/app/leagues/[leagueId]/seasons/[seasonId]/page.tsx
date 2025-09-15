'use client';

import { useUser } from '@/contexts/UserContext';
import { Button } from '@/components/ui/button';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ArrowLeft, Calendar, GamepadIcon } from 'lucide-react';

interface Season {
  id: number;
  name: string;
  league_id: number;
  start_date: string | null;
  end_date: string | null;
  leagues: {
    id: number;
    name: string;
    admin_id: string;
  };
}

interface Game {
  id: number;
  season_id: number;
  home_team_id: number;
  away_team_id: number;
  start_time: string;
  home_score: number | null;
  away_score: number | null;
  status: string;
  home_team: {
    name: string;
    abbreviation: string;
  };
  away_team: {
    name: string;
    abbreviation: string;
  };
}

export default function SeasonPage() {
  const { user, loading } = useUser();
  const router = useRouter();
  const params = useParams();
  const leagueId = params.leagueId as string;
  const seasonId = params.seasonId as string;

  const [season, setSeason] = useState<Season | null>(null);
  const [games, setGames] = useState<Game[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user && seasonId) {
      fetchSeasonData();
    }
  }, [user, seasonId]);

  const fetchSeasonData = async () => {
    try {
      setPageLoading(true);
      setError(null);

      // Fetch season details
      const seasonResponse = await fetch(`/api/seasons/${seasonId}`);
      const seasonData = await seasonResponse.json();

      if (!seasonResponse.ok) {
        setError(seasonData.error || 'Failed to load season');
        return;
      }

      setSeason(seasonData.season);

      // Fetch games for this season
      const gamesResponse = await fetch(`/api/games?season_id=${seasonId}`);
      const gamesData = await gamesResponse.json();

      if (!gamesResponse.ok) {
        console.error('Failed to load games:', gamesData.error);
        setGames([]); // Don't show error for games, just empty list
      } else {
        setGames(gamesData.games || []);
      }

    } catch (error) {
      console.error('Error fetching season data:', error);
      setError('Failed to load season');
    } finally {
      setPageLoading(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Not set';
    return new Date(dateString).toLocaleDateString();
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
          <p className="text-gray-600 mb-4">{error}</p>
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
    <div className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        <header className="mb-8">
          <Button
            variant="ghost"
            onClick={() => router.push(`/leagues/${leagueId}`)}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to {season.leagues.name}
          </Button>

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
                  {games.length} game{games.length !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
          </div>
        </header>

        <div className="space-y-6">
          {/* Games Section */}
          <div className="border rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <GamepadIcon className="h-5 w-5" />
              Games
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

                  return (
                    <div
                      key={game.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-4">
                          <div className="text-center min-w-[100px]">
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
                          <Button size="sm" variant="outline">
                            Make Pick
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Upcoming: Picks & Leaderboard sections */}
          <div className="grid gap-6 md:grid-cols-2">
            <div className="border rounded-lg p-6">
              <h3 className="font-semibold mb-4">My Picks</h3>
              <p className="text-gray-600 text-sm">
                Your picks for this season will appear here
              </p>
            </div>

            <div className="border rounded-lg p-6">
              <h3 className="font-semibold mb-4">Season Leaderboard</h3>
              <p className="text-gray-600 text-sm">
                Season standings will be calculated here
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}