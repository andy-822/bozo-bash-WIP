'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, TrendingUp, TrendingDown } from 'lucide-react';

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

interface PlayerPropsListProps {
  gameId: number;
  onSelectProp?: (prop: PlayerProp, selection: 'over' | 'under') => void;
}

const MARKET_LABELS: Record<string, string> = {
  player_pass_yds: 'Passing Yards',
  player_rush_yds: 'Rushing Yards',
  player_reception_yds: 'Receiving Yards',
  player_anytime_td: 'Anytime TD',
  player_pass_tds: 'Passing TDs',
  player_rush_tds: 'Rushing TDs',
  player_reception_tds: 'Receiving TDs',
  player_receptions: 'Receptions'
};

const MARKET_CATEGORIES: Record<string, string> = {
  player_pass_yds: 'passing',
  player_pass_tds: 'passing',
  player_rush_yds: 'rushing',
  player_rush_tds: 'rushing',
  player_reception_yds: 'receiving',
  player_reception_tds: 'receiving',
  player_receptions: 'receiving',
  player_anytime_td: 'touchdown'
};

function formatOdds(odds: number): string {
  if (odds > 0) {
    return `+${odds}`;
  }
  return odds.toString();
}

function getCategoryColor(category: string): string {
  switch (category) {
    case 'passing': return 'bg-blue-100 text-blue-800';
    case 'rushing': return 'bg-green-100 text-green-800';
    case 'receiving': return 'bg-purple-100 text-purple-800';
    case 'touchdown': return 'bg-red-100 text-red-800';
    default: return 'bg-gray-100 text-gray-800';
  }
}

export default function PlayerPropsList({ gameId, onSelectProp }: PlayerPropsListProps) {
  const [props, setProps] = useState<PlayerProp[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  useEffect(() => {
    const fetchPlayerProps = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/games/${gameId}/player-props`);

        if (!response.ok) {
          throw new Error('Failed to fetch player props');
        }

        const data = await response.json();
        setProps(data.props || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchPlayerProps();
  }, [gameId]);

  const filteredProps = props.filter(prop => {
    const matchesSearch = prop.athlete_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         MARKET_LABELS[prop.market_key]?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCategory = selectedCategory === 'all' ||
                           MARKET_CATEGORIES[prop.market_key] === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  const categories = ['all', ...Array.from(new Set(Object.values(MARKET_CATEGORIES)))];

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Player Props</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
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
          <CardTitle>Player Props</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-600">Error: {error}</p>
        </CardContent>
      </Card>
    );
  }

  if (props.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Player Props</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500">No player props available for this game.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Player Props
          <Badge variant="outline">{props.length} available</Badge>
        </CardTitle>

        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search players or prop types..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {categories.map(category => (
              <Button
                key={category}
                variant={selectedCategory === category ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(category)}
                className="capitalize"
              >
                {category}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-4">
          {filteredProps.map(prop => (
            <Card key={`${prop.id}-${prop.sportsbook}`} className="border-l-4 border-l-blue-500">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold">{prop.athlete_name}</span>
                    <Badge
                      className={getCategoryColor(MARKET_CATEGORIES[prop.market_key] || 'default')}
                    >
                      {MARKET_LABELS[prop.market_key] || prop.market_key}
                    </Badge>
                  </div>
                  <Badge variant="outline">{prop.sportsbook}</Badge>
                </div>

                {prop.point && (
                  <div className="mb-3">
                    <span className="text-lg font-bold text-gray-700">
                      O/U {prop.point}
                    </span>
                  </div>
                )}

                <div className="flex space-x-2">
                  {prop.over_price && (
                    <Button
                      variant="outline"
                      className="flex-1 flex items-center justify-center space-x-1 hover:bg-green-50 hover:border-green-500"
                      onClick={() => onSelectProp?.(prop, 'over')}
                    >
                      <TrendingUp className="w-4 h-4" />
                      <span>Over {formatOdds(prop.over_price)}</span>
                    </Button>
                  )}

                  {prop.under_price && (
                    <Button
                      variant="outline"
                      className="flex-1 flex items-center justify-center space-x-1 hover:bg-red-50 hover:border-red-500"
                      onClick={() => onSelectProp?.(prop, 'under')}
                    >
                      <TrendingDown className="w-4 h-4" />
                      <span>Under {formatOdds(prop.under_price)}</span>
                    </Button>
                  )}
                </div>

                <div className="mt-2 text-xs text-gray-500">
                  Updated: {new Date(prop.last_update).toLocaleString()}
                </div>
              </CardContent>
            </Card>
          ))}

          {filteredProps.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No player props match your search criteria.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}