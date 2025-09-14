import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useLeague } from '@/contexts/LeagueContext';
import { Database } from '@/lib/database.types';

type Game = Database['public']['Tables']['games']['Row'];
type Odds = Database['public']['Tables']['odds']['Row'] & {
  sportsbooks: Database['public']['Tables']['sportsbooks']['Row'];
};

export interface GameWithOdds extends Game {
  odds: Odds[];
  hasPick?: boolean;
}

interface UseGamesWithOddsResult {
  games: GameWithOdds[];
  loading: boolean;
  error: string | null;
  refreshGames: () => Promise<void>;
}

export function useGamesWithOdds(): UseGamesWithOddsResult {
  const { currentSeason } = useLeague();
  const [games, setGames] = useState<GameWithOdds[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Cache management
  const lastFetchRef = useRef<number>(0);
  const lastSeasonIdRef = useRef<string>('');
  const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  const loadGamesWithOdds = async (forceRefresh = false) => {
    if (!currentSeason) {
      setLoading(false);
      return;
    }

    // Check if we should skip fetching (cache is still fresh)
    const now = Date.now();
    const timeSinceLastFetch = now - lastFetchRef.current;
    const seasonChanged = lastSeasonIdRef.current !== currentSeason.id;
    
    if (!forceRefresh && !seasonChanged && timeSinceLastFetch < CACHE_DURATION && games.length > 0) {
      console.log('Using cached games data');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Get games for current season
      const { data: gamesData, error: gamesError } = await supabase
        .from('games')
        .select('*')
        .eq('season_id', currentSeason.id)
        .gte('game_time', new Date().toISOString()) // Only future games
        .order('game_time', { ascending: true })
        .limit(16); // Limit to next 20 games

      if (gamesError) {
        throw gamesError;
      }

      if (!gamesData || gamesData.length === 0) {
        setGames([]);
        setLoading(false);
        return;
      }

      // Get odds for these games
      const gameIds = gamesData.map(game => game.id);
      
      const { data: oddsData, error: oddsError } = await supabase
        .from('odds')
        .select(`
          *,
          sportsbooks (*)
        `)
        .in('game_id', gameIds)
        .gt('expires_at', new Date().toISOString()) // Only non-expired odds
        .order('fetched_at', { ascending: false });

      if (oddsError) {
        throw oddsError;
      }

      // Group odds by game
      const oddsGroupedByGame = (oddsData || []).reduce((acc, odds) => {
        if (!acc[odds.game_id]) {
          acc[odds.game_id] = [];
        }
        acc[odds.game_id].push(odds);
        return acc;
      }, {} as Record<string, Odds[]>);

      // Combine games with their odds
      const gamesWithOdds: GameWithOdds[] = gamesData.map(game => ({
        ...game,
        odds: oddsGroupedByGame[game.id] || [],
        hasPick: false // TODO: Check if user has already made a pick for this game
      }));

      setGames(gamesWithOdds);
      
      // Update cache timestamps
      lastFetchRef.current = Date.now();
      lastSeasonIdRef.current = currentSeason.id;
    } catch (err) {
      console.error('Error loading games with odds:', err);
      setError(err instanceof Error ? err.message : 'Failed to load games');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentSeason) {
      loadGamesWithOdds();
    }
  }, [currentSeason]);

  return {
    games,
    loading,
    error,
    refreshGames: () => loadGamesWithOdds(true) // Force refresh when manually called
  };
}