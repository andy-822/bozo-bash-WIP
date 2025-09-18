'use client';

import { useUserStore } from '@/stores/userStore';
import { useNavigationStore } from '@/stores/navigationStore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { UserPlus, Check, X, Trophy, Users } from 'lucide-react';
import { decodeInviteCode } from '@/lib/validation';

interface League {
  id: number;
  name: string;
  sport_name: string;
  member_count: number;
}

export default function InvitePage() {
  const { user, loading } = useUserStore();
  const router = useRouter();
  const params = useParams();
  const inviteCode = params.code as string;

  const [league, setLeague] = useState<League | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [success, setSuccess] = useState(false);

  const setBreadcrumbs = useNavigationStore((state) => state.setBreadcrumbs);

  useEffect(() => {
    setBreadcrumbs([{ label: 'Join League' }]);
  }, [setBreadcrumbs]);

  useEffect(() => {
    if (!loading && !user) {
      // Redirect to login with return URL
      router.push(`/?invite=${inviteCode}`);
    }
  }, [user, loading, router, inviteCode]);

  useEffect(() => {
    if (user && inviteCode) {
      decodeInvite();
    }
  }, [user, inviteCode]); // eslint-disable-line react-hooks/exhaustive-deps

  const decodeInvite = async () => {
    try {
      setPageLoading(true);
      setError(null);

      // Securely decode and validate the invite code
      const decoded = decodeInviteCode(inviteCode);
      if (!decoded.isValid) {
        setError(decoded.errorMessage || 'Invalid invite link');
        return;
      }

      const leagueId = decoded.leagueId!;

      // Fetch league information
      const response = await fetch(`/api/leagues/${leagueId}`);
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 404) {
          setError('League not found. This invite may have expired.');
        } else {
          setError(data.error || 'Failed to load league information');
        }
        return;
      }

      setLeague(data.league);

    } catch (error) {
      console.error('Error decoding invite:', error);
      setError('Invalid invite link');
    } finally {
      setPageLoading(false);
    }
  };

  const joinLeague = async () => {
    if (!league) return;

    setJoining(true);
    setError(null);

    try {
      const response = await fetch('/api/league-memberships', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          league_id: league.id,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 400 && data.error?.includes('already a member')) {
          setError('You are already a member of this league');
        } else {
          setError(data.error || 'Failed to join league');
        }
        return;
      }

      setSuccess(true);

      // Redirect to league page after a short delay
      setTimeout(() => {
        router.push(`/leagues/${league.id}`);
      }, 2000);

    } catch (error) {
      console.error('Error joining league:', error);
      setError('Failed to join league');
    } finally {
      setJoining(false);
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
    return null; // Will redirect to login
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <X className="h-6 w-6 text-red-600" />
            </div>
            <CardTitle>Invitation Error</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => router.push('/leagues')}
              className="w-full"
            >
              Go to My Leagues
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <Check className="h-6 w-6 text-green-600" />
            </div>
            <CardTitle>Successfully Joined!</CardTitle>
            <CardDescription>
              Welcome to {league?.name}! Redirecting you to the league...
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (!league) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
            <UserPlus className="h-6 w-6 text-blue-600" />
          </div>
          <CardTitle>Join League</CardTitle>
          <CardDescription>
            You&apos;ve been invited to join a league
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="text-center">
              <h3 className="text-xl font-semibold">{league.name}</h3>
              <div className="flex items-center justify-center gap-4 mt-2 text-sm text-gray-600">
                <span className="flex items-center gap-1">
                  <Trophy className="h-4 w-4" />
                  {league.sport_name}
                </span>
                <span className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  {league.member_count} member{league.member_count !== 1 ? 's' : ''}
                </span>
              </div>
            </div>

            <div className="border-t pt-4">
              <p className="text-sm text-gray-600 text-center mb-4">
                By joining this league, you&apos;ll be able to make picks and compete with other members.
              </p>

              <div className="space-y-3">
                <Button
                  onClick={joinLeague}
                  disabled={joining}
                  className="w-full"
                >
                  {joining ? 'Joining...' : `Join ${league.name}`}
                </Button>

                <Button
                  variant="outline"
                  onClick={() => router.push('/leagues')}
                  className="w-full"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}