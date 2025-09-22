'use client';

import { useState } from 'react';
import { useWeeklyStandings, getStreakDisplayText, getStreakColorClass, formatPointsBreakdown, type WeeklyStanding } from '@/hooks/useWeeklyStandings';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Image from 'next/image';
import {
  Trophy,
  TrendingUp,
  TrendingDown,
  Minus,
  Crown,
  Medal,
  Award,
  RefreshCw,
  Timer,
  Zap,
  Star
} from 'lucide-react';

interface WeeklyStandingsProps {
  seasonId: string;
  week: number;
  autoRefresh?: boolean;
}

export default function WeeklyStandings({ seasonId, week, autoRefresh = true }: WeeklyStandingsProps) {
  const [showDetails, setShowDetails] = useState(false);

  const {
    data,
    isLoading,
    error,
    refetch,
    isFetching
  } = useWeeklyStandings(seasonId, week);

  const handleRefresh = () => {
    refetch();
  };

  const getRankIcon = (rank: number, isWinner: boolean) => {
    if (isWinner) return <Crown className="h-5 w-5 text-yellow-500" />;
    if (rank === 1) return <Crown className="h-5 w-5 text-yellow-500" />;
    if (rank === 2) return <Medal className="h-5 w-5 text-gray-400" />;
    if (rank === 3) return <Award className="h-5 w-5 text-amber-600" />;
    return <span className="text-sm font-semibold text-gray-600">#{rank}</span>;
  };

  const getStreakIcon = (streak: number) => {
    if (streak === 0) return <Minus className="h-4 w-4 text-gray-400" />;
    if (streak > 0) return <TrendingUp className="h-4 w-4 text-green-600" />;
    return <TrendingDown className="h-4 w-4 text-red-600" />;
  };

  const getPerformanceBadge = (standing: WeeklyStanding) => {
    if (standing.is_weekly_winner) {
      return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">Weekly Winner!</Badge>;
    }
    if (standing.rank <= 3) {
      return <Badge variant="secondary">Top 3</Badge>;
    }
    if (standing.current_streak >= 3) {
      return <Badge className="bg-green-100 text-green-800">Hot Streak!</Badge>;
    }
    if (standing.current_streak <= -3) {
      return <Badge variant="destructive">Cold Streak</Badge>;
    }
    return null;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            Week {week} Standings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse">
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="h-16 bg-gray-200 rounded-lg"></div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            Week {week} Standings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Trophy className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 mb-2">Failed to load weekly standings</p>
            <p className="text-sm text-red-600 mb-4">{error.message}</p>
            <Button onClick={handleRefresh} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const standings = data?.standings || [];
  const scoringRules = data?.scoring_rules;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            Week {week} Standings
            {isFetching && <RefreshCw className="h-4 w-4 animate-spin text-blue-500" />}
          </CardTitle>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDetails(!showDetails)}
            >
              {showDetails ? 'Simple View' : 'Detailed View'}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isFetching}
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Scoring Rules Summary */}
        {showDetails && scoringRules && (
          <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
            <div className="font-medium mb-2">Scoring Rules:</div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              <div>Win: +{scoringRules.points_per_win}</div>
              <div>Loss: {scoringRules.points_per_loss >= 0 ? '+' : ''}{scoringRules.points_per_loss}</div>
              <div>Push: {scoringRules.points_per_push >= 0 ? '+' : ''}{scoringRules.points_per_push}</div>
              {scoringRules.streak_bonus > 0 && (
                <div>Streak Bonus: +{scoringRules.streak_bonus}</div>
              )}
              {scoringRules.weekly_winner_bonus > 0 && (
                <div>Winner Bonus: +{scoringRules.weekly_winner_bonus}</div>
              )}
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent>
        {standings.length === 0 ? (
          <div className="text-center py-8">
            <Trophy className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 mb-2">No standings available yet</p>
            <p className="text-sm text-gray-500">
              Rankings will appear once picks are submitted and games are completed for week {week}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Header */}
            <div className={`grid gap-4 text-xs font-medium text-gray-500 uppercase tracking-wide pb-2 border-b ${
              showDetails ? 'grid-cols-16' : 'grid-cols-12'
            }`}>
              <div className="col-span-1">Rank</div>
              <div className="col-span-3">Player</div>
              <div className="col-span-2 text-center">Record</div>
              <div className="col-span-2 text-center">Points</div>
              <div className="col-span-2 text-center">Win %</div>
              <div className="col-span-2 text-center">Streak</div>
              {showDetails && (
                <>
                  <div className="col-span-2 text-center">Bonuses</div>
                  <div className="col-span-2 text-center">Status</div>
                </>
              )}
            </div>

            {/* Standings Entries */}
            {standings.map((standing) => (
              <div
                key={standing.user_id}
                className={`grid gap-4 items-center p-4 rounded-lg transition-colors border ${
                  standing.is_current_user
                    ? 'border-blue-200 bg-blue-50'
                    : standing.is_weekly_winner
                    ? 'border-yellow-200 bg-yellow-50'
                    : 'border-gray-200 hover:bg-gray-50'
                } ${showDetails ? 'grid-cols-16' : 'grid-cols-12'}`}
              >
                {/* Rank */}
                <div className="col-span-1 flex items-center">
                  {getRankIcon(standing.rank, standing.is_weekly_winner)}
                </div>

                {/* Player */}
                <div className="col-span-3 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                    {standing.avatar_url ? (
                      <Image
                        src={standing.avatar_url}
                        alt={standing.username}
                        width={40}
                        height={40}
                        className="w-10 h-10 rounded-full"
                      />
                    ) : (
                      <span className="text-white font-semibold">
                        {standing.username.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-gray-900 truncate flex items-center gap-2">
                      {standing.username}
                      {standing.is_current_user && (
                        <Badge variant="outline" className="text-xs">You</Badge>
                      )}
                      {standing.is_weekly_winner && (
                        <Star className="h-4 w-4 text-yellow-500" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Record */}
                <div className="col-span-2 text-center">
                  <div className="text-sm font-medium">
                    {standing.wins}-{standing.losses}
                    {standing.pushes > 0 && `-${standing.pushes}`}
                  </div>
                  <div className="text-xs text-gray-500">
                    {standing.total_picks} picks
                  </div>
                </div>

                {/* Points */}
                <div className="col-span-2 text-center">
                  <div className="text-lg font-bold text-gray-900">
                    {standing.total_points}
                  </div>
                  {showDetails && (
                    <div className="text-xs text-gray-500">
                      {formatPointsBreakdown(standing)}
                    </div>
                  )}
                </div>

                {/* Win Percentage */}
                <div className="col-span-2 text-center">
                  <div className="text-sm font-medium">
                    {standing.win_percentage}%
                  </div>
                </div>

                {/* Streak */}
                <div className="col-span-2 text-center">
                  <div className={`flex items-center justify-center gap-1 ${getStreakColorClass(standing.current_streak)}`}>
                    {getStreakIcon(standing.current_streak)}
                    <span className="text-sm font-medium">
                      {getStreakDisplayText(standing.current_streak)}
                    </span>
                  </div>
                </div>

                {/* Detailed View Columns */}
                {showDetails && (
                  <>
                    {/* Bonuses */}
                    <div className="col-span-2 text-center">
                      <div className="text-xs space-y-1">
                        {standing.streak_bonus_points > 0 && (
                          <div className="flex items-center justify-center gap-1 text-green-600">
                            <Zap className="h-3 w-3" />
                            +{standing.streak_bonus_points}
                          </div>
                        )}
                        {standing.weekly_winner_bonus > 0 && (
                          <div className="flex items-center justify-center gap-1 text-yellow-600">
                            <Crown className="h-3 w-3" />
                            +{standing.weekly_winner_bonus}
                          </div>
                        )}
                        {standing.streak_bonus_points === 0 && standing.weekly_winner_bonus === 0 && (
                          <span className="text-gray-400">—</span>
                        )}
                      </div>
                    </div>

                    {/* Status */}
                    <div className="col-span-2 text-center">
                      {getPerformanceBadge(standing)}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Summary Stats */}
        {standings.length > 0 && (
          <div className="mt-6 pt-4 border-t">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-gray-900">{data?.total_participants}</div>
                <div className="text-sm text-gray-600">Total Players</div>
              </div>

              <div>
                <div className="text-2xl font-bold text-yellow-600">
                  {standings.filter(s => s.is_weekly_winner).length}
                </div>
                <div className="text-sm text-gray-600">Weekly Winners</div>
              </div>

              <div>
                <div className="text-2xl font-bold text-green-600">
                  {standings.filter(s => s.current_streak >= 3).length}
                </div>
                <div className="text-sm text-gray-600">Hot Streaks (3+)</div>
              </div>
            </div>

            {autoRefresh && (
              <div className="mt-4 text-center">
                <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
                  <Timer className="h-3 w-3" />
                  Auto-refreshes every 5 minutes
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}