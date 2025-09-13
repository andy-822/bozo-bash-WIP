import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useLeague } from '@/contexts/LeagueContext';
import { Database } from '@/lib/database.types';

type Game = Database['public']['Tables']['games']['Row'];

export function useGames() {
  const { currentSeason } = useLeague();
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (currentSeason) {
      loadGames();
    }
  }, [currentSeason, loadGames]);

  const loadGames = async () => {
    if (!currentSeason) return;

    setLoading(true);
    setError(null);
    
    try {
      const { data, error: gamesError } = await supabase
        .from('games')
        .select('*')
        .eq('season_id', currentSeason.id)
        .order('game_time', { ascending: true });

      if (gamesError) {
        throw gamesError;
      }

      setGames(data || []);
    } catch (err) {
      console.error('Error loading games:', err);
      setError(err instanceof Error ? err.message : 'Failed to load games');
    } finally {
      setLoading(false);
    }
  };

  return {
    games,
    loading,
    error,
    refetch: loadGames
  };
}