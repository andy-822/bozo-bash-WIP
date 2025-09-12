'use client';

import { TrendingUp, Users, DollarSign, Target, Plus } from 'lucide-react';
import Link from 'next/link';
import Header from '@/components/ui/Header';
import StatsCard from '@/components/ui/StatsCard';
import ProgressBar from '@/components/ui/ProgressBar';
import PickCard from '@/components/PickCard';
import { picks, weekStats, userStats, formatCurrency, calculatePotentialWinnings } from '@/lib/data';

export default function Dashboard() {
  const currentWeekPicks = picks.filter(pick => pick.week === 15 && pick.season === 2024);
  const totalUsers = userStats.length;
  const totalSeason = userStats.reduce((sum, user) => sum + user.totalParlays, 0);
  const totalWins = userStats.reduce((sum, user) => sum + user.wins, 0);
  const totalWinnings = userStats.reduce((sum, user) => sum + user.totalWinnings, 0);
  const overallHitRate = totalSeason > 0 ? (totalWins / totalSeason) * 100 : 0;

  return (
    <div className="min-h-screen bg-slate-900">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Top Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatsCard
            title="Season Parlays"
            value={totalSeason}
            subtitle={`${totalUsers} players`}
            icon={<Target className="h-6 w-6 text-blue-500" />}
            trend="neutral"
          />
          <StatsCard
            title="Total Hits"
            value={totalWins}
            subtitle={`${overallHitRate.toFixed(1)}% hit rate`}
            icon={<TrendingUp className="h-6 w-6 text-green-400" />}
            trend="up"
          />
          <StatsCard
            title="Total Winnings"
            value={formatCurrency(totalWinnings)}
            subtitle="All time"
            icon={<DollarSign className="h-6 w-6 text-green-400" />}
            trend="up"
          />
          <StatsCard
            title="Active Players"
            value={totalUsers}
            subtitle="This season"
            icon={<Users className="h-6 w-6 text-blue-500" />}
            trend="neutral"
          />
        </div>

        {/* Current Week Status */}
        <div className="bg-slate-800 rounded-lg p-6 mb-8 card-hover border border-slate-600">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white">Week 15 Progress</h2>
            <div className="text-sm text-gray-400">
              Potential Winnings: {formatCurrency(calculatePotentialWinnings(currentWeekPicks, 10))}
            </div>
          </div>
          
          <ProgressBar
            current={weekStats.submittedPicks}
            total={weekStats.totalPicks}
            label="Picks Submitted"
            color="blue"
            size="md"
          />
          
          <div className="mt-4 text-center">
            <p className="text-gray-400 text-sm">
              {weekStats.submittedPicks} of {weekStats.totalPicks} players have submitted their picks
            </p>
          </div>
        </div>

        {/* Current Picks and Submit Button */}
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Current Picks */}
          <div className="flex-1">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">Current Picks</h2>
              <span className="text-sm text-gray-400">
                {currentWeekPicks.length} picks submitted
              </span>
            </div>

            {currentWeekPicks.length > 0 ? (
              <div className="space-y-4">
                {currentWeekPicks.map(pick => (
                  <PickCard key={pick.id} pick={pick} showUser={true} />
                ))}
              </div>
            ) : (
              <div className="bg-slate-800 rounded-lg p-12 text-center border border-slate-600">
                <Target className="h-12 w-12 text-gray-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-white mb-2">No picks yet</h3>
                <p className="text-gray-400 mb-6">Be the first to submit your parlay for this week!</p>
                <Link href="/submit">
                  <button className="btn-primary">Submit Your Pick</button>
                </Link>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="lg:w-80">
            {/* Submit Pick Card */}
            <div className="bg-gradient-to-br from-blue-500 to-blue-700 rounded-lg p-6 mb-6 text-white">
              <div className="flex items-center mb-4">
                <Plus className="h-6 w-6 mr-2" />
                <h3 className="text-lg font-bold">Submit Your Pick</h3>
              </div>
              <p className="text-blue-100 mb-4 text-sm">
                Got a hot take for this week? Submit your parlay and show the bozos how it&apos;s done!
              </p>
              <Link href="/submit">
                <button className="w-full bg-white text-blue-500 font-semibold py-3 px-6 rounded-lg hover:bg-gray-100 transition-colors">
                  Make Your Pick
                </button>
              </Link>
            </div>

            {/* Quick Stats */}
            <div className="bg-slate-800 rounded-lg p-6 border border-slate-600">
              <h3 className="text-lg font-semibold text-white mb-4">Quick Stats</h3>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Most Popular Bet</span>
                  <span className="text-white font-medium">Spread</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Highest Odds</span>
                  <span className="text-white font-medium">+450</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Games This Week</span>
                  <span className="text-white font-medium">16</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Deadline</span>
                  <span className="text-white font-medium">Sun 1:00 PM</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
