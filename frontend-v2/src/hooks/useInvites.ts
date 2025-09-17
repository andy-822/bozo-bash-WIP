import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface CreateInviteData {
  league_id: string;
  email?: string;
}

export interface InviteResponse {
  success: boolean;
  message: string;
  invite_link?: string;
}

export interface LeagueDetails {
  id: number;
  name: string;
  sport_name: string;
  member_count: number;
}

export interface ValidateInviteResponse {
  league: LeagueDetails;
}

export interface JoinLeagueData {
  league_id: number;
}

const createInvite = async (inviteData: CreateInviteData): Promise<InviteResponse> => {
  const response = await fetch('/api/league-invites', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(inviteData),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to create invite');
  }

  return data;
};

const validateInvite = async (code: string): Promise<ValidateInviteResponse> => {
  // Decode the invite code to get league ID
  const decoded = atob(code);
  const [leagueId] = decoded.split(':');

  if (!leagueId) {
    throw new Error('Invalid invite link');
  }

  const response = await fetch(`/api/leagues/${leagueId}`);
  const data = await response.json();

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('League not found. This invite may have expired.');
    } else {
      throw new Error(data.error || 'Failed to load league information');
    }
  }

  return { league: data.league };
};

const joinLeague = async (joinData: JoinLeagueData): Promise<{ success: boolean }> => {
  const response = await fetch('/api/league-memberships', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(joinData),
  });

  const data = await response.json();

  if (!response.ok) {
    if (response.status === 400 && data.error?.includes('already a member')) {
      throw new Error('You are already a member of this league');
    } else {
      throw new Error(data.error || 'Failed to join league');
    }
  }

  return { success: true };
};

export const useCreateInvite = () => {
  return useMutation({
    mutationFn: createInvite,
  });
};

export const useValidateInvite = (code: string) => {
  return useQuery({
    queryKey: ['validate-invite', code],
    queryFn: () => validateInvite(code),
    enabled: !!code,
    retry: false, // Don't retry on failed validation
  });
};

export const useJoinLeague = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: joinLeague,
    onSuccess: () => {
      // Invalidate leagues query to refetch after joining
      queryClient.invalidateQueries({ queryKey: ['leagues'] });
    },
  });
};