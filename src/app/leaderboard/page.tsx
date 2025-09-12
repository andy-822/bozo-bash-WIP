'use client';

import { Trophy, TrendingUp, TrendingDown, Minus, Crown, Flame, Zap } from 'lucide-react';
import Link from 'next/link';
import Header from '@/components/ui/Header';
import ProgressBar from '@/components/ui/ProgressBar';
import AppWrapper from '@/components/AppWrapper';
import { formatCurrency } from '@/lib/data';
import { useLeaderboard } from '@/hooks/useLeaderboard';
import { useLeague } from '@/contexts/LeagueContext';

export default function Leaderboard() {
  const { currentLeague, currentSeason } = useLeague();
  const { userStats, totalPicks, totalWins, overallWinRate, loading } = useLeaderboard();
  
  const sortedUsers = [...userStats].sort((a, b) => {
    // Primary sort by win rate
    if (b.winRate !== a.winRate) {
      return b.winRate - a.winRate;
    }
    // Secondary sort by total picks (experience)
    return b.totalPicks - a.totalPicks;
  });

  const getPerformanceIcon = (winRate: number, currentStreak: number, streakType: 'win' | 'loss') => {
    if (streakType === 'win' && currentStreak >= 3) {
      return <Flame className="h-5 w-5 text-orange-500" />;
    }
    if (streakType === 'loss' && currentStreak >= 4) {
      return <Zap className="h-5 w-5 text-blue-300" />;
    }
    if (winRate >= 50) {
      return <TrendingUp className="h-5 w-5 text-green-400" />;
    }
    if (winRate < 30) {
      return <TrendingDown className="h-5 w-5 text-red-400" />;
    }
    return <Minus className="h-5 w-5 text-gray-400" />;
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Crown className="h-6 w-6 text-yellow-400" />;
      case 2:
        return <div className="w-6 h-6 bg-gray-400 rounded-full flex items-center justify-center text-xs font-bold text-slate-900">2</div>;
      case 3:
        return <div className="w-6 h-6 bg-yellow-600 rounded-full flex items-center justify-center text-xs font-bold text-white">3</div>;
      default:
        return <div className="w-6 h-6 bg-slate-600 rounded-full flex items-center justify-center text-xs font-bold text-gray-200">{rank}</div>;
    }
  };

  const getWinRateColor = (winRate: number) => {
    if (winRate >= 50) return 'text-green-400';
    if (winRate >= 40) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getStreakText = (streak: number, type: 'win' | 'loss') => {
    const streakLabel = type === 'win' ? 'W' : 'L';
    return `${streak}${streakLabel}`;
  };

  const getStreakColor = (streak: number, type: 'win' | 'loss') => {
    if (type === 'win') {
      return streak >= 3 ? 'text-orange-500' : 'text-green-400';
    } else {
      return streak >= 4 ? 'text-blue-300' : 'text-red-400';
    }
  };

  // For now, we don't track total winnings, so set to 0
  const totalWinnings = 0;

  if (loading) {
    return (
      <AppWrapper>
        <div className="min-h-screen bg-slate-900">
          <Header />
          <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                <p className="text-gray-400">Loading leaderboard...</p>
              </div>
            </div>
          </main>
        </div>
      </AppWrapper>
    );
  }

  if (!currentLeague || !currentSeason) {
    return (
      <AppWrapper>
        <div className="min-h-screen bg-slate-900">
          <Header />
          <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="text-center py-20">
              <h2 className="text-2xl font-bold text-white mb-4">No League Selected</h2>
              <p className="text-gray-400 mb-6">Please select a league to view the leaderboard.</p>
              <Link href="/leagues">
                <button className="btn-primary">Manage Leagues</button>
              </Link>
            </div>
          </main>
        </div>
      </AppWrapper>
    );
  }

  return (
    <AppWrapper>
      <div className="min-h-screen bg-slate-900">
        <Header />
      
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2 flex items-center">
            <Trophy className="h-8 w-8 text-yellow-400 mr-3" />
            Season Leaderboard
          </h1>
          <p className="text-gray-400">
            Rankings based on win rate and total picks for {currentSeason?.name}.
          </p>
        </div>

        {/* Season Summary */}
        <div className="bg-slate-800 rounded-lg p-6 mb-8 border border-slate-600">
          <h2 className="text-xl font-bold text-white mb-6">Season Summary</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="text-center">
              <p className="text-3xl font-bold text-blue-500">{totalPicks}</p>
              <p className="text-sm text-gray-400">Total Picks</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-green-400">{totalWins}</p>
              <p className="text-sm text-gray-400">Total Wins</p>
            </div>
            <div className="text-center">
              <p className={`text-3xl font-bold ${getWinRateColor(overallWinRate)}`}>
                {overallWinRate.toFixed(1)}%
              </p>
              <p className="text-sm text-gray-400">Overall Win Rate</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-green-400">{formatCurrency(totalWinnings)}</p>
              <p className="text-sm text-gray-400">Total Winnings</p>
            </div>
          </div>
        </div>

        {/* Leaderboard */}
        <div className="bg-slate-800 rounded-lg border border-slate-600 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-600">
            <h2 className="text-xl font-bold text-white">Player Rankings</h2>
          </div>

          <div className="divide-y divide-slate-600">
            {sortedUsers.map((user, index) => {
              const rank = index + 1;
              return (
                <div
                  key={user.userId}
                  className={`p-6 hover:bg-slate-700/30 transition-colors ${
                    rank <= 3 ? 'bg-gradient-to-r from-blue-500/5 to-transparent' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4 flex-1">
                      {/* Rank */}
                      <div className="flex-shrink-0">
                        {getRankIcon(rank)}
                      </div>

                      {/* User Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-3 mb-2">
                          <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-medium">
                            {user.user_name[0]?.toUpperCase() || 'U'}
                          </div>
                          <div>
                            <h3 className="text-lg font-semibold text-white">
                              {user.user_name}
                            </h3>
                            <p className="text-sm text-gray-400">
                              {user.wins}W - {user.losses}L ({user.totalPicks} total)
                            </p>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <ProgressBar
                          current={user.wins}
                          total={user.totalPicks}
                          showNumbers={false}
                          color={user.winRate >= 50 ? 'green' : user.winRate >= 40 ? 'yellow' : 'red'}
                          size="sm"
                        />
                      </div>

                      {/* Stats */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                        {/* Win Rate */}
                        <div>
                          <p className={`text-xl font-bold ${getWinRateColor(user.winRate)}`}>
                            {user.winRate.toFixed(1)}%
                          </p>
                          <p className="text-xs text-gray-500">Win Rate</p>
                        </div>

                        {/* Total Picks */}
                        <div>
                          <p className="text-xl font-bold text-blue-400">
                            {user.totalPicks}
                          </p>
                          <p className="text-xs text-gray-500">Total Picks</p>
                        </div>

                        {/* Current Streak */}
                        <div>
                          <div className="flex items-center justify-center space-x-1">
                            <p className={`text-xl font-bold ${getStreakColor(user.currentStreak, user.streakType)}`}>
                              {getStreakText(user.currentStreak, user.streakType)}
                            </p>
                          </div>
                          <p className="text-xs text-gray-500">Streak</p>
                        </div>

                        {/* Performance Indicator */}
                        <div>
                          <div className="flex justify-center">
                            {getPerformanceIcon(user.winRate, user.currentStreak, user.streakType)}
                          </div>
                          <p className="text-xs text-gray-500">Form</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Performance Categories */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Hot Streaks */}
          <div className="bg-slate-800 rounded-lg p-6 border border-slate-600">
            <div className="flex items-center mb-4">
              <Flame className="h-5 w-5 text-orange-500 mr-2" />
              <h3 className="text-lg font-semibold text-white">🔥 Hot Streaks</h3>
            </div>
            <div className="space-y-3">
              {sortedUsers
                .filter(user => user.streakType === 'win' && user.currentStreak >= 2)
                .slice(0, 3)
                .map(user => (
                  <div key={user.userId} className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white font-medium text-xs">
                        {user.user_name[0]?.toUpperCase() || 'U'}
                      </div>
                      <span className="text-white text-sm font-medium">{user.user_name}</span>
                    </div>
                    <span className="text-orange-500 font-bold">
                      {getStreakText(user.currentStreak, user.streakType)}
                    </span>
                  </div>
                ))}
            </div>
          </div>

          {/* Cold Streaks */}
          <div className="bg-slate-800 rounded-lg p-6 border border-slate-600">
            <div className="flex items-center mb-4">
              <Zap className="h-5 w-5 text-blue-300 mr-2" />
              <h3 className="text-lg font-semibold text-white">🥶 Cold Streaks</h3>
            </div>
            <div className="space-y-3">
              {sortedUsers
                .filter(user => user.streakType === 'loss' && user.currentStreak >= 3)
                .slice(0, 3)
                .map(user => (
                  <div key={user.userId} className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white font-medium text-xs">
                        {user.user_name[0]?.toUpperCase() || 'U'}
                      </div>
                      <span className="text-white text-sm font-medium">{user.user_name}</span>
                    </div>
                    <span className="text-blue-300 font-bold">
                      {getStreakText(user.currentStreak, user.streakType)}
                    </span>
                  </div>
                ))}
            </div>
          </div>

          {/* Most Active */}
          <div className="bg-slate-800 rounded-lg p-6 border border-slate-600">
            <div className="flex items-center mb-4">
              <TrendingUp className="h-5 w-5 text-green-400 mr-2" />
              <h3 className="text-lg font-semibold text-white">🎯 Most Active</h3>
            </div>
            <div className="space-y-3">
              {[...sortedUsers]
                .sort((a, b) => b.totalPicks - a.totalPicks)
                .slice(0, 3)
                .map(user => (
                  <div key={user.userId} className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white font-medium text-xs">
                        {user.user_name[0]?.toUpperCase() || 'U'}
                      </div>
                      <span className="text-white text-sm font-medium">{user.user_name}</span>
                    </div>
                    <span className="text-green-400 font-bold">
                      {user.totalPicks} picks
                    </span>
                  </div>
                ))}
            </div>
          </div>
        </div>

        {/* Call to Action */}
        <div className="mt-8 bg-gradient-to-br from-blue-500 to-blue-700 rounded-lg p-6 text-white text-center">
          <h3 className="text-xl font-bold mb-2">Think you can do better?</h3>
          <p className="text-blue-100 mb-4">
            Submit your pick for this week and climb the leaderboard!
          </p>
          <Link href="/submit">
            <button className="bg-white text-blue-500 font-semibold py-3 px-6 rounded-lg hover:bg-gray-100 transition-colors">
              Submit Your Pick
            </button>
          </Link>
        </div>
      </main>
      </div>
    </AppWrapper>
  );
}