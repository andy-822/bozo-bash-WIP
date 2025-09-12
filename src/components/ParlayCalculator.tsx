'use client';

import { useState, useEffect } from 'react';
import { Calculator, Plus, X, DollarSign } from 'lucide-react';
import { calculateParlayOdds, formatOdds, formatCurrency } from '@/lib/data';

interface ParlayLeg {
  id: string;
  selection: string;
  odds: number;
}

interface ParlayCalculatorProps {
  initialLegs?: ParlayLeg[];
  className?: string;
}

export default function ParlayCalculator({ initialLegs = [], className = '' }: ParlayCalculatorProps) {
  const [legs, setLegs] = useState<ParlayLeg[]>(initialLegs);
  const [betAmount, setBetAmount] = useState<number>(10);
  const [newLeg, setNewLeg] = useState({ selection: '', odds: '' });

  const addLeg = () => {
    if (newLeg.selection && newLeg.odds) {
      const oddsNumber = parseFloat(newLeg.odds);
      if (!isNaN(oddsNumber) && oddsNumber !== 0) {
        const leg: ParlayLeg = {
          id: Date.now().toString(),
          selection: newLeg.selection,
          odds: oddsNumber,
        };
        setLegs([...legs, leg]);
        setNewLeg({ selection: '', odds: '' });
      }
    }
  };

  const removeLeg = (id: string) => {
    setLegs(legs.filter(leg => leg.id !== id));
  };

  const parlayOdds = legs.length > 0 ? calculateParlayOdds(legs.map(leg => ({ 
    odds: leg.odds 
  } as any))) : 1;
  
  const potentialPayout = (parlayOdds - 1) * betAmount;
  const totalPayout = parlayOdds * betAmount;
  
  // Convert decimal odds back to American format for display
  const americanOdds = parlayOdds >= 2 
    ? Math.round((parlayOdds - 1) * 100)
    : Math.round(-100 / (parlayOdds - 1));

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addLeg();
    }
  };

  return (
    <div className={`bg-slate-800 rounded-lg border border-slate-600 overflow-hidden ${className}`}>
      <div className="px-6 py-4 border-b border-slate-600 bg-gradient-to-r from-blue-500/10 to-transparent">
        <div className="flex items-center">
          <Calculator className="h-5 w-5 text-blue-500 mr-2" />
          <h3 className="text-lg font-semibold text-white">Parlay Calculator</h3>
        </div>
      </div>

      <div className="p-6">
        {/* Current Legs */}
        {legs.length > 0 && (
          <div className="mb-6">
            <h4 className="text-sm font-medium text-gray-200 mb-3">Current Legs</h4>
            <div className="space-y-2">
              {legs.map((leg) => (
                <div
                  key={leg.id}
                  className="flex items-center justify-between bg-slate-900 rounded-lg p-3"
                >
                  <div className="flex-1">
                    <p className="text-white font-medium text-sm">{leg.selection}</p>
                    <p className={`text-xs ${leg.odds > 0 ? 'text-green-400' : 'text-gray-400'}`}>
                      {formatOdds(leg.odds)}
                    </p>
                  </div>
                  <button
                    onClick={() => removeLeg(leg.id)}
                    className="text-red-400 hover:text-red-500 p-1"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Add New Leg */}
        <div className="mb-6">
          <h4 className="text-sm font-medium text-gray-200 mb-3">Add Leg</h4>
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Selection (e.g., Chiefs -3.5)"
              className="input-dark w-full text-sm"
              value={newLeg.selection}
              onChange={(e) => setNewLeg({ ...newLeg, selection: e.target.value })}
              onKeyPress={handleKeyPress}
            />
            <div className="flex space-x-2">
              <input
                type="text"
                placeholder="Odds (e.g., -110)"
                className="input-dark flex-1 text-sm"
                value={newLeg.odds}
                onChange={(e) => setNewLeg({ ...newLeg, odds: e.target.value })}
                onKeyPress={handleKeyPress}
              />
              <button
                onClick={addLeg}
                disabled={!newLeg.selection || !newLeg.odds}
                className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-400 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Bet Amount */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-200 mb-2">
            Bet Amount
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <DollarSign className="h-4 w-4 text-gray-500" />
            </div>
            <input
              type="number"
              min="1"
              step="0.01"
              className="input-dark pl-10 w-full"
              value={betAmount}
              onChange={(e) => setBetAmount(parseFloat(e.target.value) || 0)}
            />
          </div>
        </div>

        {/* Results */}
        {legs.length > 0 && (
          <div className="space-y-4 p-4 bg-gradient-to-br from-blue-500/5 to-green-500/5 rounded-lg border border-blue-500/20">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-400">Parlay Odds</p>
                <p className={`text-lg font-bold ${americanOdds > 0 ? 'text-green-400' : 'text-gray-200'}`}>
                  {formatOdds(americanOdds)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Decimal Odds</p>
                <p className="text-lg font-bold text-white">
                  {parlayOdds.toFixed(2)}
                </p>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-600">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-400">Potential Profit</p>
                  <p className="text-xl font-bold text-green-400">
                    {formatCurrency(potentialPayout)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Total Payout</p>
                  <p className="text-xl font-bold text-white">
                    {formatCurrency(totalPayout)}
                  </p>
                </div>
              </div>
            </div>

            {legs.length > 1 && (
              <div className="pt-2 border-t border-slate-600">
                <p className="text-xs text-gray-400 text-center">
                  {legs.length} leg parlay • All legs must win to cash
                </p>
              </div>
            )}
          </div>
        )}

        {legs.length === 0 && (
          <div className="text-center py-8">
            <Calculator className="h-12 w-12 text-gray-500 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">
              Add some legs to calculate your parlay odds
            </p>
          </div>
        )}
      </div>
    </div>
  );
}