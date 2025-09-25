'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCreatePick, CreatePickData } from '@/hooks/usePicks';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import PlayerPropsList from '@/components/PlayerPropsList';

interface Game {
  id: number;
  home_team: { name: string; abbreviation: string };
  away_team: { name: string; abbreviation: string };
  start_time: string;
  espn_game_id?: string;
  espn_event_name?: string;
  venue_name?: string;
  week?: number;
  status?: string;
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
  seasonId: string;
  onPickSubmitted?: () => void;
}

type BetType = 'moneyline' | 'spread' | 'total' | 'player_prop';
type Selection = string;

interface PlayerProp {
  id: number;
  athlete_id: string;
  athlete_name: string;
  market_key: string;
  description: string;
  sportsbook: string;
  over_price?: number;
  under_price?: number;
  point?: number;
  last_update: string;
}

export default function MakePickModal({
  open,
  onOpenChange,
  game,
  currentWeek,
  seasonId,
  onPickSubmitted
}: MakePickModalProps) {
  const [selectedBetType, setSelectedBetType] = useState<BetType | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<Selection | null>(null);
  const [selectedPlayerProp, setSelectedPlayerProp] = useState<{
    prop: PlayerProp;
    selection: 'over' | 'under';
  } | null>(null);

  const createPickMutation = useCreatePick();
  const { toast } = useToast();

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
    setSelectedPlayerProp(null);
  };

  const handleSubmit = async () => {
    if (!selectedBetType) return;
    if (selectedBetType !== 'player_prop' && !selectedTeam) return;
    if (selectedBetType === 'player_prop' && !selectedPlayerProp) return;

    try {
      let pickData: CreatePickData;

      if (selectedBetType === 'player_prop' && selectedPlayerProp) {
        pickData = {
          game_id: game.id,
          bet_type: selectedBetType,
          week: currentWeek,
          season_id: seasonId,
          selection: `${selectedPlayerProp.prop.athlete_name} ${selectedPlayerProp.prop.market_key} ${selectedPlayerProp.selection} ${selectedPlayerProp.prop.point || ''}`,
          player_prop_id: selectedPlayerProp.prop.id
        };
      } else {
        pickData = {
          game_id: game.id,
          bet_type: selectedBetType,
          week: currentWeek,
          season_id: seasonId,
          selection: selectedTeam || ''
        };
      }

      await createPickMutation.mutateAsync(pickData);

      handleClose();
      onPickSubmitted?.();

    } catch (error) {
      toast({
        variant: "destructive",
        title: "Failed to submit pick",
        description: error instanceof Error ? error.message : 'An unexpected error occurred',
      });
    }
  };

  const formatOdds = (odds: number | null, type: 'moneyline' | 'spread' | 'total' = 'moneyline') => {
    if (odds === null) {
      // Provide context-specific messaging for different bet types
      switch (type) {
        case 'moneyline':
          return 'No Line'; // Common sportsbook terminology for unavailable moneyline
        case 'spread':
          return 'No Spread'; // Indicates spread betting not offered for this game
        case 'total':
          return 'No Total'; // Indicates over/under not available
        default:
          return 'Unavailable'; // Generic fallback
      }
    }

    // Format moneyline odds with + for positive values
    if (type === 'moneyline') {
      return odds > 0 ? `+${odds}` : `${odds}`;
    }

    // Format spread with + for positive values
    if (type === 'spread') {
      return odds > 0 ? `+${odds}` : `${odds}`;
    }

    // Format totals as plain numbers (always positive)
    return `${odds}`;
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            Make Your Week {game.week || currentWeek} Pick
            {game.espn_game_id && (
              <span className="text-sm font-normal text-gray-500 ml-2">
                ESPN #{game.espn_game_id}
              </span>
            )}
          </DialogTitle>
          <DialogDescription>
            <div className="space-y-1">
              <div className="font-medium">
                {game.espn_event_name || `${game.away_team.name} @ ${game.home_team.name}`}
              </div>
              <div className="text-sm text-gray-600">
                {gameTime.toLocaleString()}
                {game.venue_name && (
                  <span className="ml-2">at {game.venue_name}</span>
                )}
              </div>
              {game.status && game.status !== 'scheduled' && (
                <div className="text-xs text-blue-600 font-medium">
                  Status: {game.status.replace('_', ' ').toUpperCase()}
                </div>
              )}
              {isPastDeadline && (
                <span className="text-red-600 font-medium block mt-1">
                  Game has started - picks are locked
                </span>
              )}
            </div>
          </DialogDescription>
        </DialogHeader>

        {isPastDeadline ? (
          <div className="py-8 text-center">
            <p className="text-gray-600">
              Picks are no longer available for this game.
            </p>
          </div>
        ) : (
          <Tabs defaultValue="game-lines" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="game-lines">Game Lines</TabsTrigger>
              <TabsTrigger value="player-props">Player Props</TabsTrigger>
            </TabsList>

            <TabsContent value="game-lines" className="space-y-6">
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
                      {formatOdds(odds.moneyline_away, 'moneyline')}
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
                      {formatOdds(odds.moneyline_home, 'moneyline')}
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
                      {formatOdds(odds.spread_away, 'spread')}
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
                      {formatOdds(odds.spread_home, 'spread')}
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
                      if (odds.total_over !== null) {
                        setSelectedTeam(`Over ${odds.total_over}`);
                      }
                    }}
                    disabled={!odds.total_over}
                  >
                    <div className="font-medium">Over</div>
                    <div className="text-sm text-gray-600">{formatOdds(odds.total_over, 'total')}</div>
                  </Button>
                  <Button
                    variant={selectedBetType === 'total' && selectedTeam === `Under ${odds.total_under}` ? 'default' : 'outline'}
                    className="h-auto p-4 flex flex-col"
                    onClick={() => {
                      setSelectedBetType('total');
                      if (odds.total_under !== null) {
                        setSelectedTeam(`Under ${odds.total_under}`);
                      }
                    }}
                    disabled={!odds.total_under}
                  >
                    <div className="font-medium">Under</div>
                    <div className="text-sm text-gray-600">{formatOdds(odds.total_under, 'total')}</div>
                  </Button>
                </div>
              </div>
            )}

            {selectedBetType && selectedTeam && selectedBetType !== 'player_prop' && (
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
            </TabsContent>

            <TabsContent value="player-props" className="space-y-6">
              <PlayerPropsList
                gameId={game.id}
                onSelectProp={(prop, selection) => {
                  setSelectedBetType('player_prop');
                  setSelectedTeam(null);
                  setSelectedPlayerProp({ prop, selection });
                }}
              />

              {selectedBetType === 'player_prop' && selectedPlayerProp && (
                <div className="p-4 bg-blue-50 rounded-lg">
                  <h4 className="font-medium text-blue-900">Your Pick:</h4>
                  <p className="text-blue-800">
                    {selectedPlayerProp.prop.athlete_name} -
                    {selectedPlayerProp.prop.market_key.replace('player_', '').replace('_', ' ').toUpperCase()}
                  </p>
                  <p className="text-blue-700">
                    {selectedPlayerProp.selection.toUpperCase()} {selectedPlayerProp.prop.point || ''}
                    {selectedPlayerProp.selection === 'over' && selectedPlayerProp.prop.over_price &&
                      ` (${selectedPlayerProp.prop.over_price > 0 ? '+' : ''}${selectedPlayerProp.prop.over_price})`
                    }
                    {selectedPlayerProp.selection === 'under' && selectedPlayerProp.prop.under_price &&
                      ` (${selectedPlayerProp.prop.under_price > 0 ? '+' : ''}${selectedPlayerProp.prop.under_price})`
                    }
                  </p>
                  <p className="text-sm text-blue-600 mt-1">
                    This will replace any previous pick for Week {currentWeek}
                  </p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          {!isPastDeadline && (
            <Button
              onClick={handleSubmit}
              disabled={(!selectedBetType || (!selectedTeam && !selectedPlayerProp)) || createPickMutation.isPending}
            >
              {createPickMutation.isPending ? 'Submitting...' : 'Submit Pick'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}