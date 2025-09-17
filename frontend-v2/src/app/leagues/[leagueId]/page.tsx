'use client';

import { useUserStore } from '@/stores/userStore';
import { Button } from '@/components/ui/button';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Users, Calendar, Trophy } from 'lucide-react';
import SeasonsManager from '@/components/SeasonsManager';
import InviteModal from '@/components/InviteModal';
import { useModalStore } from '@/stores/modalStore';
import { useNavigationStore } from '@/stores/navigationStore';

interface League {
  id: number;
  name: string;
  created_at: string;
  admin_id: string;
  sport_id: number;
  sports: { name: string } | null;
}

interface LeagueMember {
  user_id: string;
  joined_at: string;
  profiles: {
    username: string;
    avatar_url?: string;
  }[];
}

export default function LeaguePage() {
  const { user, loading } = useUserStore();
  const router = useRouter();
  const params = useParams();
  const leagueId = params.leagueId as string;

  const [league, setLeague] = useState<League | null>(null);
  const [members, setMembers] = useState<LeagueMember[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const {
    inviteModalOpen: showInviteModal,
    openInviteModal,
    closeInviteModal,
  } = useModalStore();

  const setBreadcrumbs = useNavigationStore((state) => state.setBreadcrumbs);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user && leagueId) {
      fetchLeagueData();
    }
  }, [user, leagueId]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchLeagueData = async () => {
    try {
      setPageLoading(true);
      setError(null);

      // Fetch league details
      const { data: rawLeagueData, error: leagueError } = await supabase
        .from('leagues')
        .select(`
          id,
          name,
          created_at,
          admin_id,
          sport_id,
          sports(name)
        `)
        .eq('id', leagueId)
        .single();

      if (leagueError) {
        setError('League not found');
        return;
      }

      // Transform the data to match our interface
      const leagueData: League = {
        ...rawLeagueData,
        sports: Array.isArray(rawLeagueData.sports) ? rawLeagueData.sports[0] || null : rawLeagueData.sports
      };

      setLeague(leagueData);

      // Set breadcrumbs
      setBreadcrumbs([
        { label: 'Leagues', href: '/leagues' },
        { label: leagueData.name }
      ]);

      // Fetch league members
      const { data: membersData, error: membersError } = await supabase
        .from('league_memberships')
        .select(`
          user_id,
          joined_at,
          profiles!inner(
            username,
            avatar_url
          )
        `)
        .eq('league_id', leagueId);

      if (membersError) {
        console.error('Error fetching members:', membersError);
      } else {
        setMembers(membersData || []);
      }

    } catch (error) {
      console.error('Error fetching league data:', error);
      setError('Failed to load league');
    } finally {
      setPageLoading(false);
    }
  };

  if (loading || pageLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-600"></div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Error</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <Button onClick={() => router.push('/leagues')}>
            Back to Leagues
          </Button>
        </div>
      </div>
    );
  }

  if (!league) {
    return null;
  }

  const isAdmin = league.admin_id === user.id;

  return (
    <div>
      <div className="mb-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold mb-2">{league.name}</h1>
            <div className="flex items-center gap-4 text-gray-600">
              <span className="flex items-center gap-1">
                <Trophy className="h-4 w-4" />
                {league.sports?.name}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                Created {new Date(league.created_at).toLocaleDateString()}
              </span>
              <span className="flex items-center gap-1">
                <Users className="h-4 w-4" />
                {members.length} member{members.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {isAdmin && (
              <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                Admin
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Main Content */}
        <div className="md:col-span-2 space-y-6">
          <SeasonsManager leagueId={leagueId} isAdmin={isAdmin} />

          <div className="border rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Leaderboard</h2>
            <p className="text-gray-600">
              Leaderboard will appear here once picks start coming in.
            </p>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="border rounded-lg p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Users className="h-4 w-4" />
              Members ({members.length})
            </h3>

            {members.length === 0 ? (
              <p className="text-gray-600 text-sm">No members yet</p>
            ) : (
              <div className="space-y-3">
                {members.map((member) => (
                  <div key={member.user_id} className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                      {member.profiles[0]?.username.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{member.profiles[0]?.username}</p>
                      <p className="text-xs text-gray-500">
                        Joined {new Date(member.joined_at).toLocaleDateString()}
                      </p>
                    </div>
                    {member.user_id === league.admin_id && (
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                        Admin
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="border rounded-lg p-6">
            <h3 className="font-semibold mb-4">Quick Actions</h3>
            <div className="space-y-2">
              <Button className="w-full" size="sm">
                Make Picks
              </Button>
              <Button
                variant="outline"
                className="w-full"
                size="sm"
                onClick={() => openInviteModal(leagueId)}
              >
                Invite Friends
              </Button>
              {isAdmin && (
                <Button variant="outline" className="w-full" size="sm">
                  League Settings
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <InviteModal
        open={showInviteModal}
        onOpenChange={closeInviteModal}
        leagueId={leagueId}
        leagueName={league.name}
        onMemberAdded={fetchLeagueData}
      />
    </div>
  );
}

