import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useLeague } from '@/contexts/LeagueContext';
import { Database } from '@/lib/database.types';

type Pick = Database['public']['Tables']['picks']['Row'];
type Game = Database['public']['Tables']['games']['Row'];

interface DashboardData {
  currentWeekPicks: (Pick & { games: Game })[];
  totalUsers: number;
  totalSeason: number;
  totalWins: number;
  overallHitRate: number;
  submittedPicks: number;
  totalPicks: number;
  loading: boolean;
}

export function useDashboardData(): DashboardData {
  const { currentLeague, currentSeason } = useLeague();
  const [data, setData] = useState<DashboardData>({
    currentWeekPicks: [],
    totalUsers: 0,
    totalSeason: 0,
    totalWins: 0,
    overallHitRate: 0,
    submittedPicks: 0,
    totalPicks: 0,
    loading: true
  });

  useEffect(() => {
    if (currentLeague && currentSeason) {
      loadDashboardData();
    }
  }, [currentLeague, currentSeason]);

  const loadDashboardData = async () => {
    if (!currentLeague || !currentSeason) return;

    try {
      // Get current week (for now, use week 15 as example)
      const currentWeek = 15;

      // Get current week picks with game details
      const { data: picksData, error: picksError } = await supabase
        .from('picks')
        .select(`
          *,
          games (*)
        `)
        .eq('season_id', currentSeason.id)
        .eq('week', currentWeek);

      if (picksError) {
        console.error('Error loading picks:', picksError);
        return;
      }

      // Get total users in league
      const { data: usersData, error: usersError } = await supabase
        .from('league_memberships')
        .select('user_id')
        .eq('league_id', currentLeague.id);

      if (usersError) {
        console.error('Error loading users:', usersError);
        return;
      }

      // Get all picks for season stats
      const { data: allPicksData, error: allPicksError } = await supabase
        .from('picks')
        .select('id, status')
        .eq('season_id', currentSeason.id);

      if (allPicksError) {
        console.error('Error loading all picks:', allPicksError);
        return;
      }

      const totalUsers = usersData?.length || 0;
      const totalSeason = allPicksData?.length || 0;
      const totalWins = allPicksData?.filter(pick => pick.status === 'won').length || 0;
      const overallHitRate = totalSeason > 0 ? (totalWins / totalSeason) * 100 : 0;
      const submittedPicks = picksData?.length || 0;
      
      // For now, assume each user can submit one pick per week
      const totalPicks = totalUsers;

      setData({
        currentWeekPicks: picksData || [],
        totalUsers,
        totalSeason,
        totalWins,
        overallHitRate,
        submittedPicks,
        totalPicks,
        loading: false
      });
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      setData(prev => ({ ...prev, loading: false }));
    }
  };

  return data;
}