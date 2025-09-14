'use client';

import { useState } from 'react';
import { useLeague } from '@/contexts/LeagueContext';
import { useUser } from '@/contexts/UserContext';
import { useDashboardData } from '@/hooks/useDashboardData';
import { useGamesWithOdds } from '@/hooks/useGamesWithOdds';
import { formatGameData, GameData } from '@/lib/formatGameData';
import AppWrapper from '@/components/AppWrapper';
import LeagueSelection from '@/components/LeagueSelection';
import Header from '@/components/ui/Header';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { RefreshCw } from 'lucide-react';

export default function Dashboard() {
  const { currentLeague, currentSeason } = useLeague();
  const { currentUser } = useUser();
  const {
    currentWeekPicks,
    totalUsers,
    totalSeason,
    totalWins,
    overallHitRate,
    loading,
    refreshData
  } = useDashboardData();

  const {
    games: gamesWithOdds,
    loading: gamesLoading,
    error: gamesError,
    refreshGames
  } = useGamesWithOdds();

  const [selectedGame, setSelectedGame] = useState<GameData | null>(null);
  const [selectedGameWithOdds, setSelectedGameWithOdds] = useState<typeof gamesWithOdds[0] | null>(null);
  const [selectedBetType, setSelectedBetType] = useState('moneyline');
  const [selectedBet, setSelectedBet] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState('');
  const [isRefreshingOdds, setIsRefreshingOdds] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState('');

  // Convert real games with odds to UI format
  const games = gamesWithOdds.map(formatGameData);

  // Helper function to format odds
  const formatOdds = (price: number): string => {
    if (price > 0) return `+${price}`;
    return price.toString();
  };

  // Handle manual odds refresh
  const handleRefreshOdds = async () => {
    setIsRefreshingOdds(true);
    setRefreshMessage('');

    try {
      const response = await fetch('/api/sync-odds', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      const result = await response.json();

      if (result.success) {
        setRefreshMessage(`✅ Refreshed ${result.gamesProcessed} games`);

        // Refresh games data without full page reload
        await refreshGames();
      } else {
        setRefreshMessage(`❌ ${result.error || result.message || 'Failed to refresh odds'}`);
        console.error('API Error:', result);
      }
    } catch (error) {
      setRefreshMessage('❌ Network error while refreshing odds');
      console.error('Network Error details:', error);
    } finally {
      setIsRefreshingOdds(false);
      // Clear message after 5 seconds
      setTimeout(() => setRefreshMessage(''), 5000);
    }
  };

  // Generate real betting options from odds data
  const getBettingOptions = () => {
    if (!selectedGameWithOdds || !selectedGameWithOdds.odds.length) return {};
    
    const odds = selectedGameWithOdds.odds;
    
    // Get moneyline options
    const moneylineOdds = odds.filter((o) => o.market_type === 'h2h');
    const moneylineOptions: Array<{id: string, team: string, odds: number}> = [];
    
    for (const odd of moneylineOdds) {
      const outcomes = odd.outcomes as Array<{name: string; price: number; point?: number}>;
      for (const outcome of outcomes) {
        const isHome = outcome.name === selectedGameWithOdds.home_team;
        const id = isHome ? 'home-ml' : 'away-ml';
        moneylineOptions.push({
          id,
          team: outcome.name,
          odds: outcome.price
        });
      }
    }
    
    // Get spread options
    const spreadOdds = odds.filter((o) => o.market_type === 'spreads');
    const spreadOptions: Array<{id: string, team: string, spread: number, odds: number}> = [];
    
    for (const odd of spreadOdds) {
      const outcomes = odd.outcomes as Array<{name: string; price: number; point?: number}>;
      for (const outcome of outcomes) {
        if (outcome.point !== undefined) {
          const isHome = outcome.name === selectedGameWithOdds.home_team;
          const id = isHome ? 'home-spread' : 'away-spread';
          spreadOptions.push({
            id,
            team: outcome.name,
            spread: outcome.point,
            odds: outcome.price
          });
        }
      }
    }
    
    // Get totals options
    const totalsOdds = odds.filter((o) => o.market_type === 'totals');
    const totalsOptions: Array<{id: string, type: string, total: number, odds: number}> = [];
    
    for (const odd of totalsOdds) {
      const outcomes = odd.outcomes as Array<{name: string; price: number; point?: number}>;
      for (const outcome of outcomes) {
        if (outcome.point !== undefined) {
          const id = outcome.name.toLowerCase() === 'over' ? 'over' : 'under';
          totalsOptions.push({
            id,
            type: outcome.name,
            total: outcome.point,
            odds: outcome.price
          });
        }
      }
    }
    
    return {
      moneyline: moneylineOptions.slice(0, 2), // Take first 2 (one for each team)
      spread: spreadOptions.slice(0, 2), // Take first 2 (one for each team)
      totals: totalsOptions.slice(0, 2) // Take first 2 (over/under)
    };
  };

  const bettingOptions = getBettingOptions();

// GameData interface moved to formatGameData.ts

  const handleGameSelect = (game: GameData) => {
    setSelectedGame(game);
    // Find the corresponding game with odds
    const gameWithOdds = gamesWithOdds.find(g => g.id === game.id);
    setSelectedGameWithOdds(gameWithOdds);
    setSelectedBetType('moneyline');
    setSelectedBet(null);
  };

  const handleBackToLeague = () => {
    setSelectedGame(null);
    setSelectedGameWithOdds(null);
    setSelectedBetType('moneyline');
    setSelectedBet(null);
    setSubmitMessage('');
  };

  const handleSubmitPick = async () => {
    if (!selectedGame || !selectedBet || !currentUser || !currentSeason) {
      setSubmitMessage('Please select a game and make a pick first.');
      return;
    }

    setIsSubmitting(true);
    setSubmitMessage('');

    try {
      // Map the selected bet to submission data using real odds
      let selection = '';
      let odds = 0;

      // Find the selected bet in the real betting options
      const allOptions = [
        ...(bettingOptions.moneyline || []).map((opt) => ({ ...opt, type: 'moneyline' as const })),
        ...(bettingOptions.spread || []).map((opt) => ({ ...opt, type: 'spread' as const })),
        ...(bettingOptions.totals || []).map((opt) => ({ ...opt, type: 'totals' as const }))
      ];

      const selectedOption = allOptions.find((opt) => opt.id === selectedBet);

      if (selectedOption) {
        if (selectedOption.type === 'moneyline') {
          selection = `${selectedOption.team} ML`;
          odds = selectedOption.odds;
        } else if (selectedOption.type === 'spread') {
          const spreadText = selectedOption.spread > 0 ? `+${selectedOption.spread}` : selectedOption.spread;
          selection = `${selectedOption.team.split(' ').slice(-2).join(' ')} ${spreadText}`;
          odds = selectedOption.odds;
        } else if (selectedOption.type === 'totals') {
          selection = `${selectedOption.type} ${selectedOption.total}`;
          odds = selectedOption.odds;
        }
      } else {
        throw new Error('Invalid bet selection');
      }

      // Use the actual selected game ID
      const gameId = selectedGame.id;

      // Use upsert to either insert or update - this handles duplicates automatically
      const { error } = await supabase
        .from('picks')
        .upsert({
          user_id: currentUser.id,
          season_id: currentSeason.id,
          game_id: gameId,
          bet_type: selectedBetType,
          selection: selection,
          odds: odds,
          week: 15,
          status: 'pending'
        }, {
          onConflict: 'user_id,game_id'
        });

      if (error) {
        throw error;
      }

      setSubmitMessage('Pick saved successfully! 🎉');
      
      // Refresh the dashboard data to show the new pick
      await refreshData();
      
      // Clear selections after successful submission
      setTimeout(() => {
        setSelectedGame(null);
        setSelectedGameWithOdds(null);
        setSelectedBetType('moneyline');
        setSelectedBet(null);
        setSubmitMessage('');
      }, 2000);

    } catch (error) {
      console.error('Error submitting pick:', error);
      setSubmitMessage(`Error: ${error instanceof Error ? error.message : 'Failed to submit pick'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <AppWrapper>
        <div className="min-h-screen bg-dark-bg flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400 mx-auto mb-4"></div>
            <p className="text-gray-400">Loading dashboard...</p>
          </div>
        </div>
      </AppWrapper>
    );
  }

  if (!currentLeague || !currentSeason) {
    return (
      <AppWrapper>
        <div className="min-h-screen bg-dark-bg">
          <Header />
          <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="mb-8 text-center">
              <h1 className="text-3xl font-bold text-white mb-2">Welcome to Bozos Parlay Challenge</h1>
              <p className="text-gray-400">
                Select a league to get started or create a new one.
              </p>
            </div>
            <LeagueSelection />
          </main>
        </div>
      </AppWrapper>
    );
  }

  return (
    <AppWrapper>
      <div className="min-h-screen bg-gradient-to-br from-dark-bg to-gray-800">
        <Header />
        
        <div className="flex">
          {/* Games Sidebar */}
          <div className="w-96 bg-dark-bg border-r border-gray-700 h-[calc(100vh-64px)] overflow-y-auto">
            <div className="p-5 border-b border-gray-700 bg-dark-bg">
              <div className="flex items-center justify-between mb-2">
                <div className="text-white font-semibold">Upcoming Games</div>
                <button
                  onClick={handleRefreshOdds}
                  disabled={isRefreshingOdds}
                  className="p-2 rounded-lg hover:bg-gray-700 transition-colors text-gray-400 hover:text-accent-cyan"
                  title="Refresh odds"
                >
                  <RefreshCw className={`h-4 w-4 ${isRefreshingOdds ? 'animate-spin' : ''}`} />
                </button>
              </div>
              <div className="text-gray-400 text-sm">{games.length} upcoming games</div>
              {refreshMessage && (
                <div className="text-xs mt-2 p-2 bg-gray-800 rounded">{refreshMessage}</div>
              )}
            </div>
            
            <div className="p-4 space-y-3">
              {gamesLoading ? (
                <div className="text-center text-gray-400 py-8">Loading games...</div>
              ) : gamesError ? (
                <div className="text-center text-red-400 py-8">Error: {gamesError}</div>
              ) : games.length === 0 ? (
                <div className="text-center text-gray-400 py-8">No upcoming games found</div>
              ) : (
                games.map((game) => (
                <div
                  key={game.id}
                  onClick={() => handleGameSelect(game)}
                  className={`relative bg-dark-bg border rounded-xl p-4 cursor-pointer transition-all duration-200 hover:border-accent-cyan hover:shadow-lg hover:shadow-accent-cyan/10 ${
                    selectedGame?.id === game.id ? 'border-accent-cyan bg-accent-cyan/5' : 'border-gray-600'
                  }`}
                >
                  {game.hasPick && (
                    <div className="absolute top-2 right-2 w-2 h-2 bg-green-400 rounded-full"></div>
                  )}
                  
                  <div className="text-gray-400 text-xs mb-2">{game.time}</div>
                  
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-gray-600 rounded text-xs font-semibold flex items-center justify-center text-white">
                        {game.awayLogo}
                      </div>
                      <div className="text-white text-sm font-medium">{game.awayTeam}</div>
                    </div>
                    <div className="text-gray-400 text-xs">@</div>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-gray-600 rounded text-xs font-semibold flex items-center justify-center text-white">
                        {game.homeLogo}
                      </div>
                      <div className="text-white text-sm font-medium">{game.homeTeam}</div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="text-center p-1 bg-gray-800 rounded">
                      <div className="text-gray-400">Spread</div>
                      <div className="text-white font-medium">{game.spread}</div>
                    </div>
                    <div className="text-center p-1 bg-gray-800 rounded">
                      <div className="text-gray-400">Total</div>
                      <div className="text-white font-medium">{game.total}</div>
                    </div>
                    <div className="text-center p-1 bg-gray-800 rounded">
                      <div className="text-gray-400">ML</div>
                      <div className="text-white font-medium">{game.moneyline}</div>
                    </div>
                  </div>
                </div>
                ))
              )}
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 p-6 overflow-y-auto h-[calc(100vh-64px)]">
            {!selectedGame ? (
              // League Info View
              <div className="max-w-4xl mx-auto">
                <div className="flex items-center justify-between mb-6">
                  <h1 className="text-2xl font-bold text-white">
                    {currentLeague?.name || 'League Dashboard'}
                  </h1>
                  <Link href="/submit">
                    <button className="bg-gradient-to-r from-accent-cyan to-info-blue text-dark-bg px-6 py-2 rounded-lg font-semibold hover:shadow-lg hover:shadow-accent-cyan/30 transition-all duration-200">
                      Submit Pick
                    </button>
                  </Link>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                  <div className="bg-dark-bg border border-gray-700 rounded-xl p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-2xl font-bold text-white">{totalSeason}</div>
                        <div className="text-gray-400 text-sm">Season Picks</div>
                      </div>
                      <div className="w-10 h-10 bg-cyan-400/20 rounded-lg flex items-center justify-center">
                        🎯
                      </div>
                    </div>
                  </div>
                  <div className="bg-dark-bg border border-gray-700 rounded-xl p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-2xl font-bold text-green-400">{totalWins}</div>
                        <div className="text-gray-400 text-sm">Total Wins</div>
                      </div>
                      <div className="w-10 h-10 bg-green-400/20 rounded-lg flex items-center justify-center">
                        ✅
                      </div>
                    </div>
                  </div>
                  <div className="bg-dark-bg border border-gray-700 rounded-xl p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-2xl font-bold text-cyan-400">{overallHitRate.toFixed(1)}%</div>
                        <div className="text-gray-400 text-sm">Hit Rate</div>
                      </div>
                      <div className="w-10 h-10 bg-cyan-400/20 rounded-lg flex items-center justify-center">
                        📈
                      </div>
                    </div>
                  </div>
                  <div className="bg-dark-bg border border-gray-700 rounded-xl p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-2xl font-bold text-white">{totalUsers}</div>
                        <div className="text-gray-400 text-sm">Players</div>
                      </div>
                      <div className="w-10 h-10 bg-gray-600/50 rounded-lg flex items-center justify-center">
                        👥
                      </div>
                    </div>
                  </div>
                </div>

                {/* Current Week Picks */}
                <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 mb-6">
                  <h2 className="text-xl font-semibold text-white mb-4">Week 15 Picks</h2>
                  {currentWeekPicks.length > 0 ? (
                    <div className="space-y-3">
                      {currentWeekPicks.map((pick, index) => (
                        <div key={index} className="bg-dark-bg rounded-lg p-4 flex items-center justify-between">
                          <div>
                            <div className="text-white font-medium">{pick.selection}</div>
                            <div className="text-gray-400 text-sm capitalize">{pick.bet_type}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-cyan-400 font-semibold">
                              {pick.odds !== null && pick.odds !== undefined 
                                ? (pick.odds > 0 ? `+${pick.odds}` : pick.odds.toString())
                                : 'N/A'
                              }
                            </div>
                            <div className={`text-xs px-2 py-1 rounded ${
                              pick.status === 'won' ? 'bg-green-400/20 text-green-400' :
                              pick.status === 'lost' ? 'bg-red-400/20 text-red-400' :
                              'bg-yellow-400/20 text-yellow-400'
                            }`}>
                              {pick.status}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-400">
                      <div className="text-4xl mb-2">🎯</div>
                      <div>No picks submitted yet</div>
                      <div className="text-sm">Select a game to make your pick!</div>
                    </div>
                  )}
                </div>

                {/* Leaderboard */}
                <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
                  <h2 className="text-xl font-semibold text-white mb-4">Current Standings</h2>
                  <div className="space-y-3">
                    <div className="flex items-center p-3 bg-dark-bg rounded-lg">
                      <div className="w-8 h-8 bg-accent-cyan rounded-full flex items-center justify-center text-dark-bg font-bold mr-3">
                        1
                      </div>
                      <div className="flex-1 text-white font-medium">
                        {currentUser?.email?.split('@')[0] || 'You'}
                      </div>
                      <div className="flex gap-6 text-sm">
                        <div className="text-center">
                          <div className="text-cyan-400 font-semibold">{totalWins}</div>
                          <div className="text-gray-400">Wins</div>
                        </div>
                        <div className="text-center">
                          <div className="text-cyan-400 font-semibold">{totalSeason}</div>
                          <div className="text-gray-400">Picks</div>
                        </div>
                        <div className="text-center">
                          <div className="text-cyan-400 font-semibold">{overallHitRate.toFixed(1)}%</div>
                          <div className="text-gray-400">Hit Rate</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              // Game Detail View
              <div className="max-w-4xl mx-auto">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <button
                      onClick={handleBackToLeague}
                      className="text-gray-400 hover:text-white transition-colors"
                    >
                      ← Back to League
                    </button>
                    <h1 className="text-2xl font-bold text-white">
                      {selectedGame.awayTeam} @ {selectedGame.homeTeam}
                    </h1>
                  </div>
                  <button 
                    onClick={handleSubmitPick}
                    disabled={!selectedBet || isSubmitting}
                    className={`px-6 py-2 rounded-lg font-semibold transition-all duration-200 ${
                      !selectedBet || isSubmitting 
                        ? 'bg-gray-600 text-gray-400 cursor-not-allowed' 
                        : 'bg-gradient-to-r from-accent-cyan to-info-blue text-dark-bg hover:shadow-lg hover:shadow-accent-cyan/30'
                    }`}
                  >
                    {isSubmitting ? 'Submitting...' : 'Submit Your Pick'}
                  </button>
                </div>

                {/* Submission Message */}
                {submitMessage && (
                  <div className={`mb-4 p-4 rounded-lg ${
                    submitMessage.includes('successfully') || submitMessage.includes('🎉')
                      ? 'bg-green-500/20 border border-green-500/30 text-green-400'
                      : 'bg-red-500/20 border border-red-500/30 text-red-400'
                  }`}>
                    {submitMessage}
                  </div>
                )}

                {/* Game Detail Card */}
                <div className="bg-slate-800 border border-slate-700 rounded-xl p-8 mb-6">
                  <div className="text-center mb-8">
                    <div className="text-gray-400 mb-2">{selectedGame.time}</div>
                  </div>

                  <div className="flex items-center justify-center gap-12 mb-8">
                    <div className="text-center">
                      <div className="w-16 h-16 bg-gray-600 rounded-xl flex items-center justify-center text-xl font-bold text-white mb-3">
                        {selectedGame.awayLogo}
                      </div>
                      <div className="text-lg font-semibold text-white mb-1">{selectedGame.awayTeam}</div>
                      <div className="text-gray-400 text-sm">10-3 (7-6 ATS)</div>
                    </div>
                    <div className="text-gray-400 text-lg">@</div>
                    <div className="text-center">
                      <div className="w-16 h-16 bg-gray-600 rounded-xl flex items-center justify-center text-xl font-bold text-white mb-3">
                        {selectedGame.homeLogo}
                      </div>
                      <div className="text-lg font-semibold text-white mb-1">{selectedGame.homeTeam}</div>
                      <div className="text-gray-400 text-sm">12-1 (8-5 ATS)</div>
                    </div>
                  </div>

                  {/* Betting Options */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div 
                      className={`bg-dark-bg border rounded-xl p-5 cursor-pointer transition-all duration-200 ${
                        selectedBetType === 'moneyline' ? 'border-accent-cyan bg-accent-cyan/5' : 'border-gray-600 hover:border-gray-500'
                      }`}
                      onClick={() => setSelectedBetType('moneyline')}
                    >
                      <div className="font-semibold text-white mb-3">Moneyline</div>
                      <div className="space-y-2">
                        {bettingOptions.moneyline && bettingOptions.moneyline.length > 0 ? (
                          bettingOptions.moneyline.map((option) => (
                            <div 
                              key={option.id}
                              className={`flex justify-between items-center p-3 rounded-lg cursor-pointer transition-colors ${
                                selectedBet === option.id ? 'bg-accent-cyan text-dark-bg' : 'bg-gray-800 hover:bg-gray-700 text-white'
                              }`}
                              onClick={(e) => { e.stopPropagation(); setSelectedBet(option.id); }}
                            >
                              <span>{option.team}</span>
                              <span className="font-semibold">{formatOdds(option.odds)}</span>
                            </div>
                          ))
                        ) : (
                          <div className="text-gray-400 text-sm p-3">No moneyline odds available</div>
                        )}
                      </div>
                    </div>

                    <div 
                      className={`bg-dark-bg border rounded-xl p-5 cursor-pointer transition-all duration-200 ${
                        selectedBetType === 'spread' ? 'border-accent-cyan bg-accent-cyan/5' : 'border-gray-600 hover:border-gray-500'
                      }`}
                      onClick={() => setSelectedBetType('spread')}
                    >
                      <div className="font-semibold text-white mb-3">Point Spread</div>
                      <div className="space-y-2">
                        {bettingOptions.spread && bettingOptions.spread.length > 0 ? (
                          bettingOptions.spread.map((option) => (
                            <div 
                              key={option.id}
                              className={`flex justify-between items-center p-3 rounded-lg cursor-pointer transition-colors ${
                                selectedBet === option.id ? 'bg-accent-cyan text-dark-bg' : 'bg-gray-800 hover:bg-gray-700 text-white'
                              }`}
                              onClick={(e) => { e.stopPropagation(); setSelectedBet(option.id); }}
                            >
                              <span>{option.team.split(' ').slice(-2).join(' ')} {option.spread > 0 ? '+' : ''}{option.spread}</span>
                              <span className="font-semibold">{formatOdds(option.odds)}</span>
                            </div>
                          ))
                        ) : (
                          <div className="text-gray-400 text-sm p-3">No spread odds available</div>
                        )}
                      </div>
                    </div>

                    <div 
                      className={`bg-dark-bg border rounded-xl p-5 cursor-pointer transition-all duration-200 ${
                        selectedBetType === 'total' ? 'border-accent-cyan bg-accent-cyan/5' : 'border-gray-600 hover:border-gray-500'
                      }`}
                      onClick={() => setSelectedBetType('total')}
                    >
                      <div className="font-semibold text-white mb-3">Total Points</div>
                      <div className="space-y-2">
                        {bettingOptions.totals && bettingOptions.totals.length > 0 ? (
                          bettingOptions.totals.map((option) => (
                            <div 
                              key={option.id}
                              className={`flex justify-between items-center p-3 rounded-lg cursor-pointer transition-colors ${
                                selectedBet === option.id ? 'bg-accent-cyan text-dark-bg' : 'bg-gray-800 hover:bg-gray-700 text-white'
                              }`}
                              onClick={(e) => { e.stopPropagation(); setSelectedBet(option.id); }}
                            >
                              <span>{option.type} {option.total}</span>
                              <span className="font-semibold">{formatOdds(option.odds)}</span>
                            </div>
                          ))
                        ) : (
                          <div className="text-gray-400 text-sm p-3">No totals odds available</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppWrapper>
  );
}
