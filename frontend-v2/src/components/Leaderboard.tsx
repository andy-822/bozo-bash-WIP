'use client';

import { useState } from 'react';
import { useSeasonLeaderboard, useWeeklyLeaderboard } from '@/hooks/useLeaderboard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trophy, TrendingUp, TrendingDown, Minus, Crown, Medal, Award } from 'lucide-react';

interface LeaderboardProps {
  seasonId: string;
  currentWeek?: number;
  showWeeklyToggle?: boolean;
}

export default function Leaderboard({ seasonId, currentWeek = 1, showWeeklyToggle = true }: LeaderboardProps) {
  const [viewType, setViewType] = useState<'season' | 'week'>('season');

  const {
    data: seasonData,
    isLoading: seasonLoading,
    error: seasonError
  } = useSeasonLeaderboard(seasonId);

  const {
    data: weeklyData,
    isLoading: weeklyLoading,
    error: weeklyError
  } = useWeeklyLeaderboard(seasonId, currentWeek);

  const data = viewType === 'season' ? seasonData : weeklyData;
  const loading = viewType === 'season' ? seasonLoading : weeklyLoading;
  const error = viewType === 'season' ? seasonError : weeklyError;

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Crown className="h-5 w-5 text-yellow-500" />;
    if (rank === 2) return <Medal className="h-5 w-5 text-gray-400" />;
    if (rank === 3) return <Award className="h-5 w-5 text-amber-600" />;
    return <span className="text-sm font-semibold text-gray-600">#{rank}</span>;
  };

  const getStreakDisplay = (streak: number) => {
    if (streak === 0) return <Minus className="h-4 w-4 text-gray-400" />;
    if (streak > 0) return (
      <div className="flex items-center gap-1 text-green-600">
        <TrendingUp className="h-4 w-4" />
        <span className="text-sm font-medium">W{streak}</span>
      </div>
    );
    return (
      <div className="flex items-center gap-1 text-red-600">
        <TrendingDown className="h-4 w-4" />
        <span className="text-sm font-medium">L{Math.abs(streak)}</span>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="border rounded-lg p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-12 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="border rounded-lg p-6">
        <div className="text-center">
          <Trophy className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">Failed to load leaderboard</p>
          <p className="text-sm text-red-600 mt-2">{error.message}</p>
        </div>
      </div>
    );
  }

  const leaderboard = data?.leaderboard || [];

  return (
    <div className="border rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-semibold flex items-center gap-2">
          <Trophy className="h-5 w-5" />
          {viewType === 'season' ? 'Season Leaderboard' : `Week ${currentWeek} Standings`}
        </h3>

        {showWeeklyToggle && (
          <div className="flex rounded-md bg-gray-100 p-1">
            <Button
              variant={viewType === 'season' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewType('season')}
              className="h-8"
            >
              Season
            </Button>
            <Button
              variant={viewType === 'week' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewType('week')}
              className="h-8"
            >
              Week {currentWeek}
            </Button>
          </div>
        )}
      </div>

      {leaderboard.length === 0 ? (
        <div className="text-center py-8">
          <Trophy className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 mb-2">No standings available yet</p>
          <p className="text-sm text-gray-500">
            Rankings will appear once picks are submitted and games are completed
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Header */}
          <div className="grid grid-cols-12 gap-4 text-xs font-medium text-gray-500 uppercase tracking-wide pb-2 border-b">
            <div className="col-span-1">Rank</div>
            <div className="col-span-3">Player</div>
            <div className="col-span-2 text-center">Record</div>
            <div className="col-span-2 text-center">Points</div>
            <div className="col-span-2 text-center">Win %</div>
            {viewType === 'season' && <div className="col-span-2 text-center">Streak</div>}
            {viewType === 'week' && <div className="col-span-2 text-center">This Week</div>}
          </div>

          {/* Leaderboard Entries */}
          {leaderboard.map((entry) => (
            <div
              key={entry.user_id}
              className={`grid grid-cols-12 gap-4 items-center p-3 rounded-lg transition-colors ${
                entry.is_current_user
                  ? 'bg-blue-50 border border-blue-200'
                  : 'hover:bg-gray-50'
              }`}
            >
              {/* Rank */}
              <div className="col-span-1 flex items-center">
                {getRankIcon(entry.rank)}
              </div>

              {/* Player */}
              <div className="col-span-3 flex items-center gap-3">
                <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
                  {entry.avatar_url ? (
                    <img
                      src={entry.avatar_url}
                      alt={entry.username}
                      className="w-8 h-8 rounded-full"
                    />
                  ) : (
                    <span className="text-sm font-medium">
                      {entry.username.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="font-medium text-gray-900 truncate flex items-center gap-2">
                    {entry.username}
                    {entry.is_current_user && (
                      <Badge variant="outline" className="text-xs">You</Badge>
                    )}
                  </div>
                </div>
              </div>

              {/* Record */}
              <div className="col-span-2 text-center">
                <div className="text-sm font-medium">
                  {entry.wins}-{entry.losses}
                  {entry.pushes > 0 && `-${entry.pushes}`}
                </div>
                <div className="text-xs text-gray-500">
                  {entry.total_picks} picks
                </div>
              </div>

              {/* Points */}
              <div className="col-span-2 text-center">
                <div className="text-lg font-semibold text-gray-900">
                  {entry.total_points}
                </div>
                {viewType === 'season' && entry.total_picks > 0 && (
                  <div className="text-xs text-gray-500">
                    {(entry.total_points / entry.total_picks).toFixed(1)}/pick
                  </div>
                )}
              </div>

              {/* Win Percentage */}
              <div className="col-span-2 text-center">
                <div className="text-sm font-medium">
                  {entry.win_percentage}%
                </div>
              </div>

              {/* Streak/Week Info */}
              <div className="col-span-2 text-center">
                {viewType === 'season' && entry.current_streak !== undefined ? (
                  <div className="flex flex-col items-center gap-1">
                    {getStreakDisplay(entry.current_streak)}
                    {entry.best_streak > 0 && (
                      <div className="text-xs text-gray-500">
                        Best: W{entry.best_streak}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-sm font-medium">
                    +{entry.total_points}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Summary Stats */}
      {leaderboard.length > 0 && (
        <div className="mt-6 pt-4 border-t text-center">
          <div className="text-sm text-gray-600">
            Showing top {Math.min(leaderboard.length, 50)} of {leaderboard.length} players
            {viewType === 'season' ? ' this season' : ` for week ${currentWeek}`}
          </div>
        </div>
      )}
    </div>
  );
}