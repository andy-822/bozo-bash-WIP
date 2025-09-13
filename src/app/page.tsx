'use client';

import { useState } from 'react';
import { useLeague } from '@/contexts/LeagueContext';
import { useUser } from '@/contexts/UserContext';
import { useDashboardData } from '@/hooks/useDashboardData';
import AppWrapper from '@/components/AppWrapper';
import LeagueSelection from '@/components/LeagueSelection';
import Header from '@/components/ui/Header';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

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

  const [selectedGame, setSelectedGame] = useState<GameData | null>(null);
  const [selectedBetType, setSelectedBetType] = useState('moneyline');
  const [selectedBet, setSelectedBet] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState('');

  // Mock games data - in the future this would come from your database
  const mockGames = [
    {
      id: '1',
      time: 'Sun, Dec 15 • 1:20 PM MST',
      awayTeam: 'Buffalo Bills',
      awayLogo: 'BUF',
      homeTeam: 'Kansas City Chiefs',
      homeLogo: 'KC',
      spread: 'KC -2.5',
      total: 'O/U 54.5',
      moneyline: 'BUF +120',
      hasPick: true
    },
    {
      id: '2',
      time: 'Sun, Dec 15 • 1:00 PM EST',
      awayTeam: 'N.Y. Jets',
      awayLogo: 'NYJ',
      homeTeam: 'Miami Dolphins',
      homeLogo: 'MIA',
      spread: 'MIA -6.5',
      total: 'O/U 44.5',
      moneyline: 'NYJ +240',
      hasPick: false
    },
    {
      id: '3',
      time: 'Sun, Dec 15 • 1:00 PM EST',
      awayTeam: 'Tennessee Titans',
      awayLogo: 'TEN',
      homeTeam: 'Cincinnati Bengals',
      homeLogo: 'CIN',
      spread: 'CIN -7.5',
      total: 'O/U 47.5',
      moneyline: 'TEN +280',
      hasPick: false
    },
    {
      id: '4',
      time: 'Sun, Dec 15 • 4:05 PM EST',
      awayTeam: 'Baltimore Ravens',
      awayLogo: 'BAL',
      homeTeam: 'N.Y. Giants',
      homeLogo: 'NYG',
      spread: 'BAL -15.5',
      total: 'O/U 43.5',
      moneyline: 'BAL -1200',
      hasPick: false
    },
    {
      id: '5',
      time: 'Sun, Dec 15 • 4:25 PM EST',
      awayTeam: 'L.A. Rams',
      awayLogo: 'LAR',
      homeTeam: 'San Francisco 49ers',
      homeLogo: 'SF',
      spread: 'SF -2.5',
      total: 'O/U 49.5',
      moneyline: 'LAR +110',
      hasPick: false
    }
  ];


interface GameData {
  id: string;
  time: string;
  awayTeam: string;
  awayLogo: string;
  homeTeam: string;
  homeLogo: string;
  spread: string;
  total: string;
  moneyline: string;
  hasPick: boolean;
}

  const handleGameSelect = (game: GameData) => {
    setSelectedGame(game);
    setSelectedBetType('moneyline');
    setSelectedBet(null);
  };

  const handleBackToLeague = () => {
    setSelectedGame(null);
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
      // Map the selected bet to submission data
      let selection = '';
      let odds = 0;

      switch (selectedBet) {
        case 'kc-ml':
          selection = `${selectedGame.homeTeam} ML`;
          odds = -300;
          break;
        case 'buf-ml':
          selection = `${selectedGame.awayTeam} ML`;
          odds = +240;
          break;
        case 'kc-spread':
          selection = 'Chiefs -2.5';
          odds = -110;
          break;
        case 'buf-spread':
          selection = 'Bills +2.5';
          odds = -110;
          break;
        case 'over':
          selection = 'Over 54.5';
          odds = -110;
          break;
        case 'under':
          selection = 'Under 54.5';
          odds = -110;
          break;
        default:
          throw new Error('Invalid bet selection');
      }

      // Get the first available game from the current season
      // Since we're using mock data in the UI, we'll just use any game from the season
      console.log('Looking for games in season:', currentSeason.id);
      const { data: games, error: gameError } = await supabase
        .from('games')
        .select('id, home_team, away_team')
        .eq('season_id', currentSeason.id)
        .limit(5);

      console.log('Games found:', games?.length || 0, 'Error:', gameError);

      if (gameError) {
        throw new Error(`Database error: ${gameError.message}`);
      }

      if (!games || games.length === 0) {
        throw new Error(`No games found for season "${currentSeason.name}". The league creator needs to add games for this season.`);
      }

      const gameId = games[0].id;

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
        <div className="min-h-screen bg-slate-900 flex items-center justify-center">
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
        <div className="min-h-screen bg-slate-900">
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
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
        <Header />
        
        <div className="flex">
          {/* Games Sidebar */}
          <div className="w-96 bg-slate-800 border-r border-slate-700 h-[calc(100vh-64px)] overflow-y-auto">
            <div className="p-5 border-b border-slate-700 bg-slate-900">
              <div className="text-white font-semibold mb-1">Week 15 Games</div>
              <div className="text-gray-400 text-sm">December 15, 2024 • {mockGames.length} games</div>
            </div>
            
            <div className="p-4 space-y-3">
              {mockGames.map((game) => (
                <div
                  key={game.id}
                  onClick={() => handleGameSelect(game)}
                  className={`relative bg-slate-900 border rounded-xl p-4 cursor-pointer transition-all duration-200 hover:border-cyan-400 hover:shadow-lg hover:shadow-cyan-400/10 ${
                    selectedGame?.id === game.id ? 'border-cyan-400 bg-cyan-400/5' : 'border-slate-600'
                  }`}
                >
                  {game.hasPick && (
                    <div className="absolute top-2 right-2 w-2 h-2 bg-green-400 rounded-full"></div>
                  )}
                  
                  <div className="text-gray-400 text-xs mb-2">{game.time}</div>
                  
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-slate-600 rounded text-xs font-semibold flex items-center justify-center text-white">
                        {game.awayLogo}
                      </div>
                      <div className="text-white text-sm font-medium">{game.awayTeam}</div>
                    </div>
                    <div className="text-gray-400 text-xs">@</div>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-slate-600 rounded text-xs font-semibold flex items-center justify-center text-white">
                        {game.homeLogo}
                      </div>
                      <div className="text-white text-sm font-medium">{game.homeTeam}</div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="text-center p-1 bg-slate-800 rounded">
                      <div className="text-gray-400">Spread</div>
                      <div className="text-white font-medium">{game.spread}</div>
                    </div>
                    <div className="text-center p-1 bg-slate-800 rounded">
                      <div className="text-gray-400">Total</div>
                      <div className="text-white font-medium">{game.total}</div>
                    </div>
                    <div className="text-center p-1 bg-slate-800 rounded">
                      <div className="text-gray-400">ML</div>
                      <div className="text-white font-medium">{game.moneyline}</div>
                    </div>
                  </div>
                </div>
              ))}
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
                    <button className="bg-gradient-to-r from-cyan-500 to-cyan-600 text-slate-900 px-6 py-2 rounded-lg font-semibold hover:shadow-lg hover:shadow-cyan-400/30 transition-all duration-200">
                      Submit Pick
                    </button>
                  </Link>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                  <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
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
                  <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
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
                  <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
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
                  <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-2xl font-bold text-white">{totalUsers}</div>
                        <div className="text-gray-400 text-sm">Players</div>
                      </div>
                      <div className="w-10 h-10 bg-slate-600/50 rounded-lg flex items-center justify-center">
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
                        <div key={index} className="bg-slate-900 rounded-lg p-4 flex items-center justify-between">
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
                    <div className="flex items-center p-3 bg-slate-900 rounded-lg">
                      <div className="w-8 h-8 bg-cyan-400 rounded-full flex items-center justify-center text-slate-900 font-bold mr-3">
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
                        : 'bg-gradient-to-r from-cyan-500 to-cyan-600 text-slate-900 hover:shadow-lg hover:shadow-cyan-400/30'
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
                      <div className="w-16 h-16 bg-slate-600 rounded-xl flex items-center justify-center text-xl font-bold text-white mb-3">
                        {selectedGame.awayLogo}
                      </div>
                      <div className="text-lg font-semibold text-white mb-1">{selectedGame.awayTeam}</div>
                      <div className="text-gray-400 text-sm">10-3 (7-6 ATS)</div>
                    </div>
                    <div className="text-gray-400 text-lg">@</div>
                    <div className="text-center">
                      <div className="w-16 h-16 bg-slate-600 rounded-xl flex items-center justify-center text-xl font-bold text-white mb-3">
                        {selectedGame.homeLogo}
                      </div>
                      <div className="text-lg font-semibold text-white mb-1">{selectedGame.homeTeam}</div>
                      <div className="text-gray-400 text-sm">12-1 (8-5 ATS)</div>
                    </div>
                  </div>

                  {/* Betting Options */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div 
                      className={`bg-slate-900 border rounded-xl p-5 cursor-pointer transition-all duration-200 ${
                        selectedBetType === 'moneyline' ? 'border-cyan-400 bg-cyan-400/5' : 'border-slate-600 hover:border-slate-500'
                      }`}
                      onClick={() => setSelectedBetType('moneyline')}
                    >
                      <div className="font-semibold text-white mb-3">Moneyline</div>
                      <div className="space-y-2">
                        <div 
                          className={`flex justify-between items-center p-3 rounded-lg cursor-pointer transition-colors ${
                            selectedBet === 'kc-ml' ? 'bg-cyan-400 text-slate-900' : 'bg-slate-800 hover:bg-slate-700 text-white'
                          }`}
                          onClick={(e) => { e.stopPropagation(); setSelectedBet('kc-ml'); }}
                        >
                          <span>{selectedGame.homeTeam}</span>
                          <span className="font-semibold">-300</span>
                        </div>
                        <div 
                          className={`flex justify-between items-center p-3 rounded-lg cursor-pointer transition-colors ${
                            selectedBet === 'buf-ml' ? 'bg-cyan-400 text-slate-900' : 'bg-slate-800 hover:bg-slate-700 text-white'
                          }`}
                          onClick={(e) => { e.stopPropagation(); setSelectedBet('buf-ml'); }}
                        >
                          <span>{selectedGame.awayTeam}</span>
                          <span className="font-semibold">+240</span>
                        </div>
                      </div>
                    </div>

                    <div 
                      className={`bg-slate-900 border rounded-xl p-5 cursor-pointer transition-all duration-200 ${
                        selectedBetType === 'spread' ? 'border-cyan-400 bg-cyan-400/5' : 'border-slate-600 hover:border-slate-500'
                      }`}
                      onClick={() => setSelectedBetType('spread')}
                    >
                      <div className="font-semibold text-white mb-3">Point Spread</div>
                      <div className="space-y-2">
                        <div 
                          className={`flex justify-between items-center p-3 rounded-lg cursor-pointer transition-colors ${
                            selectedBet === 'kc-spread' ? 'bg-cyan-400 text-slate-900' : 'bg-slate-800 hover:bg-slate-700 text-white'
                          }`}
                          onClick={(e) => { e.stopPropagation(); setSelectedBet('kc-spread'); }}
                        >
                          <span>Chiefs -2.5</span>
                          <span className="font-semibold">-110</span>
                        </div>
                        <div 
                          className={`flex justify-between items-center p-3 rounded-lg cursor-pointer transition-colors ${
                            selectedBet === 'buf-spread' ? 'bg-cyan-400 text-slate-900' : 'bg-slate-800 hover:bg-slate-700 text-white'
                          }`}
                          onClick={(e) => { e.stopPropagation(); setSelectedBet('buf-spread'); }}
                        >
                          <span>Bills +2.5</span>
                          <span className="font-semibold">-110</span>
                        </div>
                      </div>
                    </div>

                    <div 
                      className={`bg-slate-900 border rounded-xl p-5 cursor-pointer transition-all duration-200 ${
                        selectedBetType === 'total' ? 'border-cyan-400 bg-cyan-400/5' : 'border-slate-600 hover:border-slate-500'
                      }`}
                      onClick={() => setSelectedBetType('total')}
                    >
                      <div className="font-semibold text-white mb-3">Total Points</div>
                      <div className="space-y-2">
                        <div 
                          className={`flex justify-between items-center p-3 rounded-lg cursor-pointer transition-colors ${
                            selectedBet === 'over' ? 'bg-cyan-400 text-slate-900' : 'bg-slate-800 hover:bg-slate-700 text-white'
                          }`}
                          onClick={(e) => { e.stopPropagation(); setSelectedBet('over'); }}
                        >
                          <span>Over 54.5</span>
                          <span className="font-semibold">-110</span>
                        </div>
                        <div 
                          className={`flex justify-between items-center p-3 rounded-lg cursor-pointer transition-colors ${
                            selectedBet === 'under' ? 'bg-cyan-400 text-slate-900' : 'bg-slate-800 hover:bg-slate-700 text-white'
                          }`}
                          onClick={(e) => { e.stopPropagation(); setSelectedBet('under'); }}
                        >
                          <span>Under 54.5</span>
                          <span className="font-semibold">-110</span>
                        </div>
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
