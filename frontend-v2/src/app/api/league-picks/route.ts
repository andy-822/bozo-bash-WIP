import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { validateId, validateWeek } from '@/lib/validation';

export async function GET(request: NextRequest) {
    try {
        const supabase = await createServerSupabaseClient();
        const { searchParams } = new URL(request.url);
        const leagueId = searchParams.get('league_id');
        const week = searchParams.get('week');

        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
            return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
        }

        // Validate league ID to prevent SQL injection
        const leagueValidation = validateId(leagueId, 'League ID');
        if (!leagueValidation.isValid) {
            return NextResponse.json({ error: leagueValidation.errorMessage }, { status: 400 });
        }

        // Validate week if provided
        if (week) {
            const weekValidation = validateWeek(week);
            if (!weekValidation.isValid) {
                return NextResponse.json({ error: weekValidation.errorMessage }, { status: 400 });
            }
        }

        // Verify user has access to this league (either admin or member)
        const { data: league, error: leagueError } = await supabaseAdmin
            .from('leagues')
            .select('id, admin_id')
            .eq('id', leagueId)
            .single();

        if (leagueError || !league) {
            return NextResponse.json({ error: 'League not found' }, { status: 404 });
        }

        // Check if user has access to this league
        let hasAccess = league.admin_id === user.id;

        // If not admin, check if user is a member
        if (!hasAccess) {
            const { data: membership, error: membershipError } = await supabaseAdmin
                .from('league_memberships')
                .select('user_id')
                .eq('league_id', leagueId)
                .eq('user_id', user.id)
                .single();

            hasAccess = !membershipError && !!membership;
        }

        if (!hasAccess) {
            return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }

        // Get all league members
        const { data: members, error: membersError } = await supabaseAdmin
            .from('league_memberships')
            .select('user_id')
            .eq('league_id', leagueId);

        if (membersError || !members) {
            return NextResponse.json({ error: 'Failed to fetch league members' }, { status: 500 });
        }

        const memberIds = members.map(m => m.user_id);

        if (memberIds.length === 0) {
            return NextResponse.json({ picks: [] });
        }

        // Fetch picks from all league members
        let query = supabaseAdmin
            .from('picks')
            .select(`
                id,
                user_id,
                bet_type,
                selection,
                result,
                created_at,
                profiles!inner(username),
                games!inner(
                    id,
                    start_time,
                    home_team:teams!games_home_team_id_fkey(
                        name,
                        abbreviation
                    ),
                    away_team:teams!games_away_team_id_fkey(
                        name,
                        abbreviation
                    )
                )
            `)
            .in('user_id', memberIds)
            .order('created_at', { ascending: false });

        // If week is specified, filter by recent picks (simplified approach)
        if (week) {
            // For now, just get picks from the last 7 days
            // In production, you might want to store week numbers on picks for better filtering
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            query = query.gte('created_at', weekAgo.toISOString());
        }

        const { data: picks, error: picksError } = await query;

        if (picksError) {
            return NextResponse.json({ error: 'Failed to fetch picks' }, { status: 500 });
        }

        // Transform the data to match our interface
        const transformedPicks = picks?.map(pick => ({
            id: pick.id,
            bet_type: pick.bet_type,
            selection: pick.selection,
            result: pick.result,
            created_at: pick.created_at,
            user: {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                username: Array.isArray(pick.profiles) ? pick.profiles[0]?.username : (pick.profiles as any)?.username
            },
            games: pick.games
        })) || [];

        return NextResponse.json({ picks: transformedPicks });

    } catch (err) {
        console.error('API: Unhandled error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}