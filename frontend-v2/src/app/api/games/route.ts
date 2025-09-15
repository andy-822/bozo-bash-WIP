import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(request: NextRequest) {
    try {
        const supabase = await createServerSupabaseClient();
        const { searchParams } = new URL(request.url);
        const seasonId = searchParams.get('season_id');

        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
            return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
        }

        if (!seasonId) {
            return NextResponse.json({ error: 'Season ID is required' }, { status: 400 });
        }

        // Verify user has access to this season's league
        const { data: season, error: seasonError } = await supabaseAdmin
            .from('seasons')
            .select(`
                id,
                league_id,
                leagues!inner(
                    id,
                    admin_id
                )
            `)
            .eq('id', seasonId)
            .single();

        if (seasonError || !season) {
            return NextResponse.json({ error: 'Season not found' }, { status: 404 });
        }

        // Check if user has access to this league
        let hasAccess = season.leagues.admin_id === user.id;

        // If not admin, check if user is a member
        if (!hasAccess) {
            const { data: membership, error: membershipError } = await supabaseAdmin
                .from('league_memberships')
                .select('user_id')
                .eq('league_id', season.league_id)
                .eq('user_id', user.id)
                .single();

            hasAccess = !membershipError && !!membership;
        }

        if (!hasAccess) {
            return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }

        // Fetch games for this season with team info
        const { data: games, error: gamesError } = await supabaseAdmin
            .from('games')
            .select(`
                id,
                season_id,
                home_team_id,
                away_team_id,
                start_time,
                home_score,
                away_score,
                status,
                home_team:teams!games_home_team_id_fkey(
                    name,
                    abbreviation
                ),
                away_team:teams!games_away_team_id_fkey(
                    name,
                    abbreviation
                )
            `)
            .eq('season_id', seasonId)
            .order('start_time', { ascending: true });

        if (gamesError) {
            return NextResponse.json({ error: 'Failed to fetch games' }, { status: 500 });
        }

        return NextResponse.json({ games });

    } catch (err) {
        console.error('API: Unhandled error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}