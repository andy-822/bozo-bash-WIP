'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Send, Calculator, ArrowLeft, Gamepad2 } from 'lucide-react';
import Link from 'next/link';
import Header from '@/components/ui/Header';
import AppWrapper from '@/components/AppWrapper';
import { useUser } from '@/contexts/UserContext';
import { useLeague } from '@/contexts/LeagueContext';
import { useGamesWithOdds } from '@/hooks/useGamesWithOdds';
import { formatGameData } from '@/lib/formatGameData';
import { formatOdds } from '@/lib/data';
import { BetType } from '@/lib/types';
import { supabase } from '@/lib/supabase';

interface PickFormData {
  gameId: string;
  betType: BetType;
  selection: string;
  odds: string;
}

export default function SubmitPick() {
  const router = useRouter();
  const { currentUser } = useUser();
  const { currentLeague, currentSeason } = useLeague();
  const { games: gamesWithOdds, loading: gamesLoading, error: gamesError } = useGamesWithOdds();
  const games = gamesWithOdds.map(formatGameData);
  const [formData, setFormData] = useState<PickFormData>({
    gameId: '',
    betType: 'moneyline',
    selection: '',
    odds: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Partial<PickFormData>>({});
  const [submitError, setSubmitError] = useState('');

  const validateForm = (): boolean => {
    const newErrors: Partial<PickFormData> = {};

    if (!formData.gameId) {
      newErrors.gameId = 'Please select a game';
    }
    if (!formData.selection.trim()) {
      newErrors.selection = 'Selection is required';
    }
    if (!formData.odds.trim()) {
      newErrors.odds = 'Odds are required';
    } else {
      const oddsNum = parseFloat(formData.odds);
      if (isNaN(oddsNum) || oddsNum === 0) {
        newErrors.odds = 'Please enter valid odds (e.g., -110, +150)';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    if (!currentUser || !currentSeason) return;

    setIsSubmitting(true);
    setSubmitError('');
    
    try {
      const { data, error } = await supabase
        .from('picks')
        .insert({
          user_id: currentUser.id,
          season_id: currentSeason.id,
          game_id: formData.gameId,
          bet_type: formData.betType,
          selection: formData.selection,
          odds: parseFloat(formData.odds),
          week: 15, // For now, hardcoded to week 15
          status: 'pending'
        });

      if (error) {
        throw error;
      }

      router.push('/?submitted=true');
    } catch (error) {
      console.error('Error submitting pick:', error);
      setSubmitError(error instanceof Error ? error.message : 'Failed to submit pick');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: keyof PickFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const selectedGame = games.find(game => game.id === formData.gameId);
  const selectedGameWithOdds = gamesWithOdds.find(game => game.id === formData.gameId);
  const oddsNumber = parseFloat(formData.odds) || 0;
  
  // Simple potential winnings calculation for American odds
  const calculateWinnings = (odds: number, betAmount: number = 10): number => {
    if (odds === 0) return 0;
    if (odds > 0) {
      return betAmount * (odds / 100);
    } else {
      return betAmount * (100 / Math.abs(odds));
    }
  };
  
  const potentialWinnings = calculateWinnings(oddsNumber, 10);

  const getBetTypeOptions = () => {
    if (!selectedGameWithOdds || !selectedGameWithOdds.odds.length) return [];
    
    const odds = selectedGameWithOdds.odds;
    
    switch (formData.betType) {
      case 'spread': {
        const spreadOdds = odds.filter(o => o.market_type === 'spreads');
        const options: string[] = [];
        
        for (const odd of spreadOdds) {
          const outcomes = odd.outcomes as any[];
          for (const outcome of outcomes) {
            if (outcome.point !== undefined) {
              const sign = outcome.point > 0 ? '+' : '';
              options.push(`${outcome.name} ${sign}${outcome.point} (${formatOdds(outcome.price)})`);
            }
          }
        }
        
        return [...new Set(options)]; // Remove duplicates
      }
      
      case 'over':
      case 'under': {
        const totalsOdds = odds.filter(o => o.market_type === 'totals');
        const options: string[] = [];
        
        for (const odd of totalsOdds) {
          const outcomes = odd.outcomes as any[];
          for (const outcome of outcomes) {
            if (outcome.point !== undefined && outcome.name.toLowerCase() === formData.betType) {
              options.push(`${outcome.name} ${outcome.point} (${formatOdds(outcome.price)})`);
            }
          }
        }
        
        return [...new Set(options)]; // Remove duplicates
      }
      
      case 'moneyline': {
        const moneylineOdds = odds.filter(o => o.market_type === 'h2h');
        const options: string[] = [];
        
        for (const odd of moneylineOdds) {
          const outcomes = odd.outcomes as any[];
          for (const outcome of outcomes) {
            options.push(`${outcome.name} (${formatOdds(outcome.price)})`);
          }
        }
        
        return [...new Set(options)]; // Remove duplicates
      }
      
      default:
        return [];
    }
  };

  // Loading and error states
  if (gamesLoading) {
    return (
      <AppWrapper>
        <div className="min-h-screen bg-slate-900">
          <Header />
          <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                <p className="text-gray-400">Loading games...</p>
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
          <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="text-center py-20">
              <h2 className="text-2xl font-bold text-white mb-4">No League Selected</h2>
              <p className="text-gray-400 mb-6">Please select a league to submit picks.</p>
              <Link href="/leagues">
                <button className="btn-primary">Manage Leagues</button>
              </Link>
            </div>
          </main>
        </div>
      </AppWrapper>
    );
  }

  if (gamesError) {
    return (
      <AppWrapper>
        <div className="min-h-screen bg-slate-900">
          <Header />
          <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="text-center py-20">
              <h2 className="text-2xl font-bold text-white mb-4">Error Loading Games</h2>
              <p className="text-gray-400 mb-6">{gamesError}</p>
              <button onClick={() => window.location.reload()} className="btn-primary">
                Retry
              </button>
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
      
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <Link href="/" className="inline-flex items-center text-blue-500 hover:text-blue-400 mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Link>
          <h1 className="text-3xl font-bold text-white mb-2">Submit Your Pick</h1>
          <p className="text-gray-400">
            Choose your game, make your pick, and join the parlay challenge for Week 15.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Form */}
          <div className="lg:col-span-2">
            <form onSubmit={handleSubmit} className="bg-slate-800 rounded-lg p-6 border border-slate-600">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Current User Display */}
                <div className="md:col-span-2 mb-4 p-4 bg-slate-700 rounded-lg">
                  <div className="flex items-center space-x-3">
                    {currentUser?.user_metadata?.avatar_url ? (
                      <img 
                        src={currentUser.user_metadata.avatar_url} 
                        alt="Profile" 
                        className="w-10 h-10 rounded-full"
                      />
                    ) : (
                      <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-medium text-lg">
                        {currentUser?.user_metadata?.full_name?.[0] || currentUser?.email?.[0] || 'U'}
                      </div>
                    )}
                    <div>
                      <p className="text-white font-medium">
                        Submitting as: {currentUser?.user_metadata?.full_name || currentUser?.email?.split('@')[0]}
                      </p>
                      <p className="text-gray-400 text-sm">Week 15 • {currentSeason?.name}</p>
                    </div>
                  </div>
                </div>

                {/* Game Selection */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-200 mb-2">
                    Select Game
                  </label>
                  <select
                    className={`input-dark w-full ${errors.gameId ? 'border-red-danger' : ''}`}
                    value={formData.gameId}
                    onChange={(e) => handleInputChange('gameId', e.target.value)}
                  >
                    <option value="">Choose a game...</option>
                    {games.map(game => (
                      <option key={game.id} value={game.id}>
                        {game.awayTeam} @ {game.homeTeam} - {game.time}
                      </option>
                    ))}
                  </select>
                  {errors.gameId && (
                    <p className="text-red-400 text-sm mt-1">{errors.gameId}</p>
                  )}
                </div>

                {/* Bet Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-2">
                    Bet Type
                  </label>
                  <select
                    className="input-dark w-full"
                    value={formData.betType}
                    onChange={(e) => handleInputChange('betType', e.target.value as BetType)}
                  >
                    <option value="moneyline">Money Line</option>
                    <option value="spread">Spread</option>
                    <option value="over">Over</option>
                    <option value="under">Under</option>
                  </select>
                </div>

                {/* Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-2">
                    Your Pick
                  </label>
                  {getBetTypeOptions().length > 0 ? (
                    <select
                      className={`input-dark w-full ${errors.selection ? 'border-red-danger' : ''}`}
                      value={formData.selection}
                      onChange={(e) => handleInputChange('selection', e.target.value)}
                    >
                      <option value="">Choose your pick...</option>
                      {getBetTypeOptions().map(option => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      className={`input-dark w-full ${errors.selection ? 'border-red-danger' : ''}`}
                      placeholder="Enter your selection"
                      value={formData.selection}
                      onChange={(e) => handleInputChange('selection', e.target.value)}
                    />
                  )}
                  {errors.selection && (
                    <p className="text-red-400 text-sm mt-1">{errors.selection}</p>
                  )}
                </div>

                {/* Odds */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-200 mb-2">
                    Odds
                  </label>
                  <input
                    type="text"
                    className={`input-dark w-full ${errors.odds ? 'border-red-danger' : ''}`}
                    placeholder="Enter odds (e.g., -110, +150, -200)"
                    value={formData.odds}
                    onChange={(e) => handleInputChange('odds', e.target.value)}
                  />
                  {errors.odds && (
                    <p className="text-red-400 text-sm mt-1">{errors.odds}</p>
                  )}
                  <p className="text-gray-500 text-xs mt-1">
                    Use American odds format: negative for favorites (-110), positive for underdogs (+150)
                  </p>
                </div>
              </div>

              {submitError && (
                <div className="mt-4 p-4 bg-red-500/20 border border-red-500/30 rounded-lg">
                  <p className="text-red-400">{submitError}</p>
                </div>
              )}

              {/* Submit Button */}
              <div className="mt-8 flex justify-end">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`btn-primary inline-flex items-center ${
                    isSubmitting ? 'opacity-75 cursor-not-allowed' : ''
                  }`}
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Submit Pick
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Sidebar - Pick Preview */}
          <div className="space-y-6">
            {/* Pick Preview */}
            <div className="bg-slate-800 rounded-lg p-6 border border-slate-600">
              <div className="flex items-center mb-4">
                <Calculator className="h-5 w-5 text-blue-500 mr-2" />
                <h3 className="text-lg font-semibold text-white">Pick Preview</h3>
              </div>

              {formData.gameId && selectedGame ? (
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-gray-400">Game</p>
                    <p className="text-white font-medium">
                      {selectedGame.awayTeam} @ {selectedGame.homeTeam}
                    </p>
                  </div>

                  {formData.selection && (
                    <div>
                      <p className="text-sm text-gray-400">Selection</p>
                      <p className="text-white font-medium">{formData.selection}</p>
                    </div>
                  )}

                  {formData.odds && (
                    <div>
                      <p className="text-sm text-gray-400">Odds</p>
                      <p className={`font-bold ${oddsNumber > 0 ? 'text-green-400' : 'text-gray-200'}`}>
                        {formatOdds(oddsNumber)}
                      </p>
                    </div>
                  )}

                  {potentialWinnings > 0 && (
                    <div className="pt-3 border-t border-slate-600">
                      <p className="text-sm text-gray-400">Potential Winnings ($10 bet)</p>
                      <p className="text-xl font-bold text-green-400">
                        ${potentialWinnings.toFixed(2)}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Gamepad2 className="h-12 w-12 text-gray-500 mx-auto mb-3" />
                  <p className="text-gray-400">
                    Select a game to see your pick preview
                  </p>
                </div>
              )}
            </div>

            {/* Tips */}
            <div className="bg-slate-800 rounded-lg p-6 border border-slate-600">
              <h3 className="text-lg font-semibold text-white mb-3">Pro Tips</h3>
              <ul className="space-y-2 text-sm text-gray-400">
                <li>• Check injury reports before making your pick</li>
                <li>• Weather can impact outdoor games significantly</li>
                <li>• Look for line movement throughout the week</li>
                <li>• Don&apos;t chase losses with bigger bets</li>
                <li>• Trust your analysis, not your heart</li>
              </ul>
            </div>
          </div>
        </div>
      </main>
      </div>
    </AppWrapper>
  );
}