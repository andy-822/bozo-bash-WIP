'use client';

import {createContext, useContext, useState, useEffect, ReactNode} from 'react';
import {supabase} from '@/lib/supabase';
import {useUser} from './UserContext';
import {Database} from '@/lib/database.types';

type League = Database['public']['Tables']['leagues']['Row'];
type Season = Database['public']['Tables']['seasons']['Row'];

interface LeagueContextType {
    currentLeague: League | null;
    currentSeason: Season | null;
    userLeagues: League[];
    availableSeasons: Season[];
    loading: boolean;
    setCurrentLeague: (league: League) => void;
    setCurrentSeason: (season: Season) => void;
    createLeague: (name: string, description?: string) => Promise<League>;
    joinLeague: (inviteCode: string) => Promise<void>;
    refreshLeagues: () => Promise<void>;
}

const LeagueContext = createContext<LeagueContextType | undefined>(undefined);

interface LeagueProviderProps {
    children: ReactNode;
}

export function LeagueProvider({children}: LeagueProviderProps) {
    const {currentUser} = useUser();
    const [currentLeague, setCurrentLeagueState] = useState<League | null>(null);
    const [currentSeason, setCurrentSeasonState] = useState<Season | null>(null);
    const [userLeagues, setUserLeagues] = useState<League[]>([]);
    const [availableSeasons, setAvailableSeasons] = useState<Season[]>([]);
    const [loading, setLoading] = useState(true);

    const loadUserLeagues = async () => {
        if (!currentUser) {
            setLoading(false);
            return;
        }

        console.log('Loading leagues for user:', currentUser.id);
        setLoading(true);

        // Add timeout to prevent infinite loading
        const timeoutId = setTimeout(() => {
            console.warn('League loading timeout after 10 seconds');
            setLoading(false);
            setUserLeagues([]);
        }, 10000);

        try {
            // Get user's league memberships with league details
            const {data, error} = await supabase
                .from('league_memberships')
                .select(`
          leagues!inner (
            *
          )
        `)
                .eq('user_id', currentUser.id);

            console.log('League memberships query result:', {data, error});

            if (error) {
                console.error('Supabase error:', error);
                throw error;
            }

            const leagues = data?.map(item => {
                const membership = item as { leagues: League };
                return membership.leagues;
            }).filter(Boolean) as League[];
            console.log('Processed leagues:', leagues);
            setUserLeagues(leagues || []);

            // Don't automatically select a league - let user choose
        } catch (error) {
            console.error('Error loading user leagues:', error);
            // Set empty leagues on error to prevent infinite loading
            setUserLeagues([]);
        } finally {
            clearTimeout(timeoutId);
            console.log('Setting loading to false');
            setLoading(false);
        }
    };

    const loadSeasons = async (leagueId: string) => {
        console.log('Loading seasons for league:', leagueId);
        try {
            const {data, error} = await supabase
                .from('seasons')
                .select('*')
                .eq('league_id', leagueId)
                .eq('is_active', true)
                .order('created_at', {ascending: false});

            console.log('Seasons query result:', {data, error});

            if (error) {
                console.error('Error loading seasons:', error);
                return;
            }

            setAvailableSeasons(data || []);
            console.log('Set available seasons:', data?.length || 0);

            // Set first season as current if none selected
            if (data && data.length > 0 && !currentSeason) {
                console.log('Setting current season to:', data[0]);
                setCurrentSeasonState(data[0]);
            }
        } catch (error) {
            console.error('Error loading seasons:', error);
        }
    };

    useEffect(() => {
        if (currentUser) {
            console.log('Current user changed, loading leagues:', currentUser.id);
            loadUserLeagues();
        } else {
            console.log('No current user, setting loading to false');
            setLoading(false);
            setUserLeagues([]);
            setCurrentLeagueState(null);
            setCurrentSeasonState(null);
            setAvailableSeasons([]);
        }
    }, [currentUser]);

    useEffect(() => {
        if (currentLeague) {
            loadSeasons(currentLeague.id);
        }
    }, [currentLeague]);


    const setCurrentLeague = (league: League) => {
        setCurrentLeagueState(league);
        setCurrentSeasonState(null); // Reset season when league changes
        setAvailableSeasons([]); // Clear seasons while new ones load
    };

    const setCurrentSeason = (season: Season) => {
        setCurrentSeasonState(season);
    };

    const createLeague = async (name: string, description?: string): Promise<League> => {
        if (!currentUser) throw new Error('Must be logged in to create league');

        console.log('Creating league:', {name, description, userId: currentUser.id});

        // Generate random invite code
        const inviteCode = Math.random().toString(36).substring(2, 10).toUpperCase();

        const {data, error} = await supabase
            .from('leagues')
            .insert({
                name,
                description: description || null,
                invite_code: inviteCode,
                creator_id: currentUser.id
            } satisfies Database['public']['Tables']['leagues']['Insert'])
            .select()
            .single();

        if (error) {
            console.error('Error creating league:', error);
            throw error;
        }

        console.log('League created:', data);

        // Add creator as admin member
        const {error: membershipError} = await supabase
            .from('league_memberships')
            .insert({
                user_id: currentUser.id,
                league_id: data.id,
                role: 'admin'
            } satisfies Database['public']['Tables']['league_memberships']['Insert']);

        if (membershipError) {
            console.error('Error creating membership:', membershipError);
            throw membershipError;
        }

        console.log('Membership created');

        // Create default NFL season
        const {data: seasonData, error: seasonError} = await supabase
            .from('seasons')
            .insert({
                league_id: data.id,
                name: '2024 NFL Season',
                sport: 'NFL',
                year: 2024,
                start_date: '2024-09-01',
                end_date: '2025-02-15'
            } satisfies Database['public']['Tables']['seasons']['Insert'])
            .select()
            .single();

        if (seasonError) {
            console.error('Error creating season:', seasonError);
            throw seasonError;
        }

        console.log('Season created:', seasonData);

        // Create sample games for the season
        if (seasonData) {
            const sampleGames = [
                {
                    season_id: seasonData.id,
                    home_team: 'Kansas City Chiefs',
                    away_team: 'Buffalo Bills',
                    game_time: '2024-12-15T20:20:00Z',
                    week: 15
                },
                {
                    season_id: seasonData.id,
                    home_team: 'Dallas Cowboys',
                    away_team: 'Philadelphia Eagles',
                    game_time: '2024-12-15T17:00:00Z',
                    week: 15
                },
                {
                    season_id: seasonData.id,
                    home_team: 'Green Bay Packers',
                    away_team: 'Minnesota Vikings',
                    game_time: '2024-12-16T13:00:00Z',
                    week: 15
                },
                {
                    season_id: seasonData.id,
                    home_team: 'Los Angeles Rams',
                    away_team: 'San Francisco 49ers',
                    game_time: '2024-12-16T16:25:00Z',
                    week: 15
                },
                {
                    season_id: seasonData.id,
                    home_team: 'Miami Dolphins',
                    away_team: 'New York Jets',
                    game_time: '2024-12-17T20:15:00Z',
                    week: 15
                }
            ];

            const {error: gamesError} = await supabase
                .from('games')
                .insert(sampleGames satisfies Database['public']['Tables']['games']['Insert'][]);

            if (gamesError) {
                console.error('Error creating sample games:', gamesError);
            }
        }

        // Refresh leagues and load the new season
        await refreshLeagues();

        // Set the newly created league and season as current
        setCurrentLeagueState(data);
        if (seasonData) {
            setCurrentSeasonState(seasonData);
        }

        return data;
    };

    const joinLeague = async (inviteCode: string): Promise<void> => {
        if (!currentUser) throw new Error('Must be logged in to join league');

        // Find league by invite code
        const {data: league, error: leagueError} = await supabase
            .from('leagues')
            .select('id')
            .eq('invite_code', inviteCode.toUpperCase())
            .eq('is_active', true)
            .single();

        if (leagueError || !league) {
            throw new Error('Invalid invite code');
        }

        // Add user as member
        const {error: membershipError} = await supabase
            .from('league_memberships')
            .insert({
                user_id: currentUser.id,
                league_id: league.id,
                role: 'member'
            } satisfies Database['public']['Tables']['league_memberships']['Insert']);

        if (membershipError) {
            if (membershipError.code === '23505') { // Unique constraint violation
                throw new Error('You are already a member of this league');
            }
            throw membershipError;
        }

        await refreshLeagues();
    };

    const refreshLeagues = async () => {
        await loadUserLeagues();
    };

    return (
        <LeagueContext.Provider value={{
            currentLeague,
            currentSeason,
            userLeagues,
            availableSeasons,
            loading,
            setCurrentLeague,
            setCurrentSeason,
            createLeague,
            joinLeague,
            refreshLeagues
        }}>
            {children}
        </LeagueContext.Provider>
    );
}

export function useLeague() {
    const context = useContext(LeagueContext);
    if (context === undefined) {
        throw new Error('useLeague must be used within a LeagueProvider');
    }
    return context;
}