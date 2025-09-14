import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useLeague } from '@/contexts/LeagueContext';

interface UserStats {
  userId: string;
  user_name: string;
  user_email: string;
  totalPicks: number;
  wins: number;
  losses: number;
  winRate: number;
  currentStreak: number;
  streakType: 'win' | 'loss';
}

interface LeaderboardData {
  userStats: UserStats[];
  totalPicks: number;
  totalWins: number;
  overallWinRate: number;
  loading: boolean;
}

export function useLeaderboard(): LeaderboardData {
  const { currentLeague, currentSeason } = useLeague();
  const [data, setData] = useState<LeaderboardData>({
    userStats: [],
    totalPicks: 0,
    totalWins: 0,
    overallWinRate: 0,
    loading: true
  });

  useEffect(() => {
    if (currentLeague && currentSeason) {
      loadLeaderboardData();
    }
  }, [currentLeague, currentSeason]);

  const loadLeaderboardData = async () => {
    if (!currentLeague || !currentSeason) return;

    try {
      // Get all picks for this season with user data
      const { data: picksData, error: picksError } = await supabase
        .from('picks')
        .select(`
          user_id,
          status
        `)
        .eq('season_id', currentSeason.id);

      if (picksError) {
        console.error('Error loading picks:', picksError);
        return;
      }

      // Get league members
      const { data: membersData, error: membersError } = await supabase
        .from('league_memberships')
        .select(`
          user_id,
          users (
            email,
            user_metadata
          )
        `)
        .eq('league_id', currentLeague.id);

      if (membersError) {
        console.error('Error loading members:', membersError);
        return;
      }

      // Process the data to create user stats
      const userStatsMap = new Map<string, UserStats>();
      
      // Initialize all league members
      membersData?.forEach((member) => {
        const user = member.users as { email?: string; user_metadata?: { full_name?: string } } | null;
        const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Unknown User';
        
        userStatsMap.set(member.user_id, {
          userId: member.user_id,
          user_name: userName,
          user_email: user?.email || '',
          totalPicks: 0,
          wins: 0,
          losses: 0,
          winRate: 0,
          currentStreak: 0,
          streakType: 'loss'
        });
      });

      // Process picks data
      picksData?.forEach((pick) => {
        const userStat = userStatsMap.get(pick.user_id);
        if (userStat) {
          userStat.totalPicks++;
          if (pick.status === 'won') {
            userStat.wins++;
          } else if (pick.status === 'lost') {
            userStat.losses++;
          }
        }
      });

      // Calculate win rates and basic streaks
      const userStats: UserStats[] = Array.from(userStatsMap.values()).map(user => ({
        ...user,
        winRate: user.totalPicks > 0 ? (user.wins / user.totalPicks) * 100 : 0,
        // For now, we'll set basic streak data - in a real app this would be calculated from pick history
        currentStreak: Math.floor(Math.random() * 5) + 1,
        streakType: Math.random() > 0.5 ? 'win' : 'loss'
      }));

      const totalPicks = picksData?.length || 0;
      const totalWins = picksData?.filter(pick => pick.status === 'won').length || 0;
      const overallWinRate = totalPicks > 0 ? (totalWins / totalPicks) * 100 : 0;

      setData({
        userStats,
        totalPicks,
        totalWins,
        overallWinRate,
        loading: false
      });

    } catch (error) {
      console.error('Error loading leaderboard data:', error);
      setData(prev => ({ ...prev, loading: false }));
    }
  };

  return data;
}