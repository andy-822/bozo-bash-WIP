'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useCreatePick } from '@/hooks/usePicks';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface Game {
  id: number;
  home_team: { name: string; abbreviation: string };
  away_team: { name: string; abbreviation: string };
  start_time: string;
  odds: Array<{
    sportsbook: string;
    moneyline_home: number | null;
    moneyline_away: number | null;
    spread_home: number | null;
    spread_away: number | null;
    total_over: number | null;
    total_under: number | null;
  }>;
}

interface MakePickModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  game: Game | null;
  currentWeek: number;
  onPickSubmitted?: () => void;
}

type BetType = 'moneyline' | 'spread' | 'total';
type Selection = string;

export default function MakePickModal({
  open,
  onOpenChange,
  game,
  currentWeek,
  onPickSubmitted
}: MakePickModalProps) {
  const [selectedBetType, setSelectedBetType] = useState<BetType | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<Selection | null>(null);

  const createPickMutation = useCreatePick();

  if (!game || !game.odds || game.odds.length === 0) {
    return null;
  }

  const odds = game.odds[0]; // Use first available odds
  const gameTime = new Date(game.start_time);
  const now = new Date();
  const isPastDeadline = now >= gameTime;

  const handleClose = () => {
    onOpenChange(false);
    setSelectedBetType(null);
    setSelectedTeam(null);
  };

  const handleSubmit = async () => {
    if (!selectedBetType || !selectedTeam) return;

    try {
      await createPickMutation.mutateAsync({
        game_id: game.id,
        bet_type: selectedBetType,
        selection: selectedTeam,
        week: currentWeek,
      });

      handleClose();
      onPickSubmitted?.();

    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to submit pick');
    }
  };

  const formatOdds = (odds: number | null) => {
    if (odds === null) return 'N/A';
    return odds > 0 ? `+${odds}` : `${odds}`;
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Make Your Week {currentWeek} Pick</DialogTitle>
          <DialogDescription>
            {game.away_team.name} @ {game.home_team.name}<br />
            {gameTime.toLocaleString()}
            {isPastDeadline && (
              <span className="text-red-600 font-medium block mt-1">
                Game has started - picks are locked
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        {isPastDeadline ? (
          <div className="py-8 text-center">
            <p className="text-gray-600">
              Picks are no longer available for this game.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Moneyline */}
            {(odds.moneyline_home || odds.moneyline_away) && (
              <div className="space-y-3">
                <h3 className="font-medium">Moneyline (Pick Winner)</h3>
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    variant={selectedBetType === 'moneyline' && selectedTeam === game.away_team.name ? 'default' : 'outline'}
                    className="h-auto p-4 flex flex-col"
                    onClick={() => {
                      setSelectedBetType('moneyline');
                      setSelectedTeam(game.away_team.name);
                    }}
                    disabled={!odds.moneyline_away}
                  >
                    <div className="font-medium">{game.away_team.name}</div>
                    <div className="text-sm text-gray-600">
                      {formatOdds(odds.moneyline_away)}
                    </div>
                  </Button>
                  <Button
                    variant={selectedBetType === 'moneyline' && selectedTeam === game.home_team.name ? 'default' : 'outline'}
                    className="h-auto p-4 flex flex-col"
                    onClick={() => {
                      setSelectedBetType('moneyline');
                      setSelectedTeam(game.home_team.name);
                    }}
                    disabled={!odds.moneyline_home}
                  >
                    <div className="font-medium">{game.home_team.name}</div>
                    <div className="text-sm text-gray-600">
                      {formatOdds(odds.moneyline_home)}
                    </div>
                  </Button>
                </div>
              </div>
            )}

            {/* Spread */}
            {(odds.spread_home || odds.spread_away) && (
              <div className="space-y-3">
                <h3 className="font-medium">Point Spread</h3>
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    variant={selectedBetType === 'spread' && selectedTeam?.includes(game.away_team.name) ? 'default' : 'outline'}
                    className="h-auto p-4 flex flex-col"
                    onClick={() => {
                      setSelectedBetType('spread');
                      if (odds.spread_away !== null) {
                        setSelectedTeam(`${game.away_team.name} ${odds.spread_away > 0 ? '+' : ''}${odds.spread_away}`);
                      }
                    }}
                    disabled={!odds.spread_away}
                  >
                    <div className="font-medium">{game.away_team.name}</div>
                    <div className="text-sm text-gray-600">
                      {odds.spread_away !== null ? `${odds.spread_away > 0 ? '+' : ''}${odds.spread_away}` : 'N/A'}
                    </div>
                  </Button>
                  <Button
                    variant={selectedBetType === 'spread' && selectedTeam?.includes(game.home_team.name) ? 'default' : 'outline'}
                    className="h-auto p-4 flex flex-col"
                    onClick={() => {
                      setSelectedBetType('spread');
                      if (odds.spread_home !== null) {
                        setSelectedTeam(`${game.home_team.name} ${odds.spread_home > 0 ? '+' : ''}${odds.spread_home}`);
                      }
                    }}
                    disabled={!odds.spread_home}
                  >
                    <div className="font-medium">{game.home_team.name}</div>
                    <div className="text-sm text-gray-600">
                      {odds.spread_home !== null ? `${odds.spread_home > 0 ? '+' : ''}${odds.spread_home}` : 'N/A'}
                    </div>
                  </Button>
                </div>
              </div>
            )}

            {/* Total */}
            {(odds.total_over || odds.total_under) && (
              <div className="space-y-3">
                <h3 className="font-medium">Total Points</h3>
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    variant={selectedBetType === 'total' && selectedTeam === `Over ${odds.total_over}` ? 'default' : 'outline'}
                    className="h-auto p-4 flex flex-col"
                    onClick={() => {
                      setSelectedBetType('total');
                      setSelectedTeam(`Over ${odds.total_over}`);
                    }}
                    disabled={!odds.total_over}
                  >
                    <div className="font-medium">Over</div>
                    <div className="text-sm text-gray-600">{odds.total_over}</div>
                  </Button>
                  <Button
                    variant={selectedBetType === 'total' && selectedTeam === `Under ${odds.total_under}` ? 'default' : 'outline'}
                    className="h-auto p-4 flex flex-col"
                    onClick={() => {
                      setSelectedBetType('total');
                      setSelectedTeam(`Under ${odds.total_under}`);
                    }}
                    disabled={!odds.total_under}
                  >
                    <div className="font-medium">Under</div>
                    <div className="text-sm text-gray-600">{odds.total_under}</div>
                  </Button>
                </div>
              </div>
            )}

            {selectedBetType && selectedTeam && (
              <div className="p-4 bg-blue-50 rounded-lg">
                <h4 className="font-medium text-blue-900">Your Pick:</h4>
                <p className="text-blue-800">
                  {selectedBetType === 'moneyline' && `${selectedTeam} to win`}
                  {selectedBetType === 'spread' && `${selectedTeam}`}
                  {selectedBetType === 'total' && `${selectedTeam} points`}
                </p>
                <p className="text-sm text-blue-600 mt-1">
                  This will replace any previous pick for Week {currentWeek}
                </p>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          {!isPastDeadline && (
            <Button
              onClick={handleSubmit}
              disabled={!selectedBetType || !selectedTeam || createPickMutation.isPending}
            >
              {createPickMutation.isPending ? 'Submitting...' : 'Submit Pick'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}