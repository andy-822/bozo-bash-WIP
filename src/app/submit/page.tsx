'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Send, Calculator, ArrowLeft, Gamepad2 } from 'lucide-react';
import Link from 'next/link';
import Header from '@/components/ui/Header';
import { games, users, formatOdds, calculatePotentialWinnings } from '@/lib/data';
import { BetType } from '@/lib/types';

interface PickFormData {
  userName: string;
  gameId: string;
  betType: BetType;
  selection: string;
  odds: string;
}

export default function SubmitPick() {
  const router = useRouter();
  const [formData, setFormData] = useState<PickFormData>({
    userName: '',
    gameId: '',
    betType: 'moneyline',
    selection: '',
    odds: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Partial<PickFormData>>({});

  const validateForm = (): boolean => {
    const newErrors: Partial<PickFormData> = {};

    if (!formData.userName.trim()) {
      newErrors.userName = 'Name is required';
    }
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

    setIsSubmitting(true);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // In a real app, you'd submit to your backend here
    console.log('Submitting pick:', formData);
    
    router.push('/?submitted=true');
  };

  const handleInputChange = (field: keyof PickFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const selectedGame = games.find(game => game.id === formData.gameId);
  const oddsNumber = parseFloat(formData.odds) || 0;
  const potentialWinnings = oddsNumber !== 0 ? calculatePotentialWinnings([{
    id: 'temp',
    userId: 'temp',
    user: users[0],
    gameId: formData.gameId,
    game: selectedGame!,
    betType: formData.betType,
    odds: oddsNumber,
    selection: formData.selection,
    status: 'pending',
    submittedAt: new Date(),
    week: 15,
    season: 2024,
  }], 10) : 0;

  const getBetTypeOptions = () => {
    switch (formData.betType) {
      case 'spread':
        return selectedGame ? [
          `${selectedGame.homeTeam} -3.5`,
          `${selectedGame.awayTeam} +3.5`,
          `${selectedGame.homeTeam} -7.5`,
          `${selectedGame.awayTeam} +7.5`,
        ] : [];
      case 'over':
      case 'under':
        return ['Over 47.5', 'Under 47.5', 'Over 52.5', 'Under 52.5'];
      case 'moneyline':
        return selectedGame ? [
          `${selectedGame.homeTeam} ML`,
          `${selectedGame.awayTeam} ML`,
        ] : [];
      default:
        return [];
    }
  };

  return (
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
                {/* User Name */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-200 mb-2">
                    Your Name
                  </label>
                  <input
                    type="text"
                    className={`input-dark w-full ${errors.userName ? 'border-red-danger' : ''}`}
                    placeholder="Enter your name"
                    value={formData.userName}
                    onChange={(e) => handleInputChange('userName', e.target.value)}
                  />
                  {errors.userName && (
                    <p className="text-red-400 text-sm mt-1">{errors.userName}</p>
                  )}
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
                        {game.awayTeam} @ {game.homeTeam} - {new Intl.DateTimeFormat('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit'
                        }).format(game.gameTime)}
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
  );
}