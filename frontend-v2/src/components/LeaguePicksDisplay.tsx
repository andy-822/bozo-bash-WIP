'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, User } from 'lucide-react';
import { useLeaguePicks, LeaguePick } from '@/hooks/usePicks';

interface LeaguePicksDisplayProps {
  leagueId: string;
  currentWeek?: number;
}

export default function LeaguePicksDisplay({ leagueId, currentWeek = 1 }: LeaguePicksDisplayProps) {
  const {
    data: picks = [],
    isLoading: loading,
    error,
  } = useLeaguePicks(leagueId, currentWeek);

  const getStatusBadge = (pick: LeaguePick) => {
    const gameTime = new Date(pick.games.start_time);
    const now = new Date();
    const isGameStarted = now >= gameTime;

    if (pick.result) {
      return (
        <Badge variant={pick.result === 'win' ? 'success' : 'destructive'}>
          {pick.result.toUpperCase()}
        </Badge>
      );
    } else if (isGameStarted) {
      return <Badge variant="pending">PENDING</Badge>;
    } else {
      return <Badge variant="secondary">ACTIVE</Badge>;
    }
  };

  const formatPickSelection = (pick: LeaguePick) => {
    switch (pick.bet_type) {
      case 'moneyline':
        return `${pick.selection} to win`;
      case 'spread':
        return pick.selection;
      case 'total':
        return `${pick.selection} points`;
      default:
        return pick.selection;
    }
  };

  const formatGameTime = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Week {currentWeek} Picks
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-gray-200 rounded"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Week {currentWeek} Picks
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-600">{error.message}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <TrendingUp className="h-5 w-5" />
        <h2 className="text-xl font-semibold">Week {currentWeek} Picks ({picks.length})</h2>
      </div>

      {picks.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <TrendingUp className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No picks submitted for Week {currentWeek} yet</p>
              <p className="text-sm text-gray-500 mt-1">
                Picks will appear here once league members make their selections
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {picks.map((pick) => {
            const gameTime = formatGameTime(pick.games.start_time);

            return (
              <Card key={pick.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <User className="h-4 w-4" />
                      {pick.profiles.username}
                    </CardTitle>
                    {getStatusBadge(pick)}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <div className="font-medium text-sm text-gray-900">
                      {pick.games.away_team.name} @ {pick.games.home_team.name}
                    </div>
                    <div className="text-xs text-gray-500">
                      {gameTime.date} • {gameTime.time}
                    </div>
                  </div>

                  <div className="p-3 bg-blue-50 rounded-lg">
                    <div className="font-medium text-blue-900 text-sm">
                      {formatPickSelection(pick)}
                    </div>
                    <div className="text-xs text-blue-600 capitalize mt-1">
                      {pick.bet_type}
                    </div>
                  </div>

                  <div className="text-xs text-gray-400">
                    Picked {new Date(pick.created_at).toLocaleDateString()}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}